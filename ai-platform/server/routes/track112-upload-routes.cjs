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

// Disk-backed upload manager for multipart sessions
const UploadManager = require('../lib/storage/upload-manager.cjs');
const uploadBase = path.join(__dirname, '..', '..', '.data', 'track112');
const uploadManager = new UploadManager({ baseDir: uploadBase, defaultTenant: 'dev' });

router.post('/uploads', express.json(), (req, res) => {
  const { tenant, maxBytes } = req.body || {};
  const id = uploadManager.createSession({ tenant, maxBytes, traceId: req.track112TraceId });
  res.status(201).json({ sessionId: id, traceId: req.track112TraceId });
});

// Write incoming chunk data directly to a file named by its offset
router.post('/uploads/:id/chunk', async (req, res) => {
  const id = req.params.id;
  const q = req.query || {};
  const offset = Number(q.offset || 0);
  try {
    await uploadManager.writeChunkFromStream(id, offset, req);
    res.setHeader('x-track112-trace-id', req.track112TraceId);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'write_failed', message: e.message });
  }
});

// Commit: compute root over persisted chunk files, verify Ed25519 signature, then remove session data
router.post('/uploads/:id/commit', express.json(), (req, res) => {
  const id = req.params.id;
  const { publicKeyPem, signature } = req.body || {};
  if (!publicKeyPem || !signature) return res.status(400).json({ error: 'missing_publicKey_or_signature' });
  try {
    const result = uploadManager.verifyAndCommitSession(id, publicKeyPem, signature);
    if (!result.ok) return res.status(401).json({ error: result.reason, message: result.message });
    return res.json({ status: 'committed', root: result.root, traceId: req.track112TraceId });
  } catch (e) {
    return res.status(404).json({ error: 'session_not_found' });
  }
});

module.exports = router;
