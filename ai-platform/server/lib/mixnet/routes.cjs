const express = require('express');
const Mixnet = require('./mixnet.cjs');

// create a router that manages an in-memory mixnet instance
const router = express.Router();
const net = new Mixnet(3, { seed: 'global-mixnet-seed', threshold: 5, epochMs: 3000 });

router.post('/register-node', (req, res) => {
  // PoC: accept and echo back registration
  const { id, pubkey } = req.body || {};
  if (!id || !pubkey) return res.status(400).json({ error: 'id and pubkey required' });
  // For PoC we don't persist — return ok
  res.json({ ok: true, id });
});

router.post('/submit-packet', async (req, res) => {
  const pkt = req.body;
  if (!pkt || !pkt.id || pkt.payload === undefined) return res.status(400).json({ error: 'packet missing id/payload' });
  // packet.payload is expected to be base64 of the outermost layer
  await net.submitPacket({ id: pkt.id, payload: Buffer.from(pkt.payload, 'base64') });
  res.json({ accepted: true });
});

router.post('/forward-batch', async (req, res) => {
  // internal forward (PoC accepts a batch)
  const batch = req.body && req.body.batch;
  if (!Array.isArray(batch)) return res.status(400).json({ error: 'batch required' });
  await net.nodes[0].submitBatch(batch);
  res.json({ ok: true });
});

router.get('/sink', (req, res) => {
  res.json({ sink: net.sink.map(p => ({ id: p.id, payload: p.payload.toString('base64') })) });
});

module.exports = router;
