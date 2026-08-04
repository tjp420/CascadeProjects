"use strict";

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Request tracing middleware: extract or generate `x-track112-trace-id` per incoming request
function getOrCreateTraceId(req) {
  const hdr = req.get && req.get('x-track112-trace-id');
  if (hdr) return hdr;
  if (req.query && req.query.traceId) return req.query.traceId;
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random()*100000)}`;
}

router.use((req, res, next) => {
  try {
    const tid = getOrCreateTraceId(req);
    req.track112TraceId = tid;
    res.setHeader('x-track112-trace-id', tid);
  } catch (e) {
    // non-fatal, continue without tracking
  }
  next();
});

// Sessions persisted in-memory metadata; chunk data stored on disk under server/.data/track112/<sessionId>
const sessions = new Map();

function makeId() {
  return `upload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
}

function sessionDir(sessionId) {
  return path.join(__dirname, '..', '..', '.data', 'track112', sessionId);
}

router.post('/uploads', express.json(), (req, res) => {
  const { tenant, maxBytes } = req.body || {};
  const id = makeId();
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });
  sessions.set(id, { tenant: tenant || 'dev', maxBytes: maxBytes || 0, dir, createdAt: Date.now(), traceId: req.track112TraceId });
  res.status(201).json({ sessionId: id, traceId: req.track112TraceId });
});

// Write incoming chunk data directly to a file named by its offset
router.post('/uploads/:id/chunk', (req, res) => {
  const id = req.params.id;
  const q = req.query || {};
  const offset = Number(q.offset || 0);
  const sess = sessions.get(id);
  if (!sess) return res.status(404).json({ error: 'session_not_found' });
  const filePath = path.join(sess.dir, `${offset}.chunk`);
  const ws = fs.createWriteStream(filePath, { flags: 'w' });
  req.pipe(ws);
  ws.on('finish', () => {
    // echo trace id for correlation
    res.setHeader('x-track112-trace-id', req.track112TraceId || sess.traceId);
    res.status(204).end();
  });
  ws.on('error', (err) => {
    res.status(500).json({ error: 'write_failed', message: err.message });
  });
});

// Commit: compute root over persisted chunk files, verify Ed25519 signature, then remove session data
router.post('/uploads/:id/commit', express.json(), (req, res) => {
  const id = req.params.id;
  const { publicKeyPem, signature } = req.body || {};
  const sess = sessions.get(id);
  if (!sess) return res.status(404).json({ error: 'session_not_found' });
  if (!publicKeyPem || !signature) return res.status(400).json({ error: 'missing_publicKey_or_signature' });

  // Read chunk files sorted by numeric offset
  const files = fs.readdirSync(sess.dir).filter(f => f.endsWith('.chunk'));
  const offsets = files.map(f => Number(f.replace('.chunk', ''))).sort((a,b)=>a-b);
  const bufs = offsets.map(o => fs.readFileSync(path.join(sess.dir, `${o}.chunk`)));
  const total = Buffer.concat(bufs.length ? bufs : [Buffer.alloc(0)]);
  const rootBuf = crypto.createHash('sha256').update(total).digest();
  const rootHex = rootBuf.toString('hex');

  try {
    // Accept PEM public key (SPKI). Signature is expected base64.
    const pubKeyObj = crypto.createPublicKey(publicKeyPem);
    const sigBuf = Buffer.from(signature, 'base64');
    const ok = crypto.verify(null, rootBuf, pubKeyObj, sigBuf);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'signature_verification_failed', message: e.message });
  }

  // On success, cleanup persisted data
  try {
    fs.rmSync(sess.dir, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup failures
  }
  sessions.delete(id);
  res.json({ status: 'committed', root: rootHex, traceId: req.track112TraceId || sess.traceId });
});

module.exports = router;
