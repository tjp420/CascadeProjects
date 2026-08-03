'use strict';

/**
 * Track 112 structural reconnaissance service routes
 * Mount at: app.use('/api/track112', require('./routes/track112-routes.cjs'))
 */

const express = require('express');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');

const router = express.Router();

function runAsync(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Public health check
router.get('/health', runAsync(async (req, res) => {
  res.json({ success: true, service: 'track112-structural', version: process.env.APP_VERSION || 'dev' });
}));

// Ingest endpoint: simple size/bounds checks, returns accepted boolean
const MAX_INGEST_BYTES = 64 * 1024; // 64 KiB
router.post('/ingest', runAsync(async (req, res) => {
  const payload = req.body && req.body.payload;
  if (!payload) return sendError(res, 400, 'missing_payload');
  const size = Buffer.byteLength(typeof payload === 'string' ? payload : JSON.stringify(payload));
  if (size > MAX_INGEST_BYTES) return sendError(res, 413, 'payload_too_large');
  // Normally enqueue for async processing — here we accept and return an id
  const jobId = `track112-${Date.now()}-${Math.floor(Math.random()*10000)}`;
  // Increment ingest counter
  try { hsmMetrics.incrementCounter('hsm_track112_ingest_total'); } catch (e) {}
  res.json({ success: true, jobId, size });
}));

// Scan endpoint: admin-only trigger for structural reconnaissance
router.post('/scan', authorize('admin:all'), runAsync(async (req, res) => {
  // In production this would schedule an async job and return job id
  const jobId = `scan-${Date.now()}`;
  // Record that a scan was initiated
  try { hsmMetrics.incrementCounter('hsm_track112_scans_initiated_total'); } catch (e) {}
  res.json({ success: true, jobId });
}));

// Proof submission: admin-only
router.post('/proof', authorize('admin:all'), runAsync(async (req, res) => {
  const proof = req.body && req.body.proof;
  if (!proof) return sendError(res, 400, 'missing_proof');
  // Validate/stash proof (placeholder)
  try { hsmMetrics.incrementCounter('hsm_track112_proofs_verified_total'); } catch (e) {}
  res.json({ success: true, stored: true });
}));

// Metrics: admin-only, exposes a JSON snapshot for now
router.get('/metrics', authorize('admin:all'), runAsync(async (req, res) => {
  const accept = (req.get('accept') || '').toLowerCase();
  if (accept.includes('text/plain')) {
    res.type('text/plain').send(hsmMetrics.renderPrometheus());
    return;
  }
  const all = hsmMetrics.getMetrics();
  const metrics = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith('hsm_track112_')) metrics[k] = v;
  }
  res.json({ success: true, metrics, timestamp: Date.now() });
}));

module.exports = router;
