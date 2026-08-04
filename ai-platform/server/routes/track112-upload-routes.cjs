"use strict";

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// In-memory sessions: { id -> { tenant, maxBytes, received: Map(offset->buf), size } }
const sessions = new Map();

function makeId() {
  return `upload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
}

router.post('/uploads', express.json(), (req, res) => {
  const { tenant, maxBytes } = req.body || {};
  const id = makeId();
  sessions.set(id, { tenant: tenant || 'dev', maxBytes: maxBytes || 0, received: new Map(), size: 0 });
  res.status(201).json({ sessionId: id });
});

router.post('/uploads/:id/chunk', (req, res) => {
  const id = req.params.id;
  const q = req.query || {};
  const offset = Number(q.offset || 0);
  const sess = sessions.get(id);
  if (!sess) return res.status(404).json({ error: 'session_not_found' });
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    // store by offset
    sess.received.set(offset, buf);
    sess.size += buf.length;
    res.status(204).end();
  });
});

router.post('/uploads/:id/commit', express.json(), (req, res) => {
  const id = req.params.id;
  const sess = sessions.get(id);
  if (!sess) return res.status(404).json({ error: 'session_not_found' });
  // For smoke, compute a simple root hash over concatenated chunks by offset order
  const offsets = Array.from(sess.received.keys()).sort((a,b)=>a-b);
  const bufs = offsets.map(o => sess.received.get(o));
  const total = Buffer.concat(bufs.length ? bufs : [Buffer.alloc(0)]);
  const root = crypto.createHash('sha256').update(total).digest('hex');
  // mark committed
  sessions.delete(id);
  res.json({ status: 'committed', root });
});

module.exports = router;
