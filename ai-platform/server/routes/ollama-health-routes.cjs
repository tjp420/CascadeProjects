'use strict';

/**
 * Ollama Health API — connection status, model info, and latency tracking.
 *
 * GET /health  — probe local Ollama daemon, return status + models + latency
 */

const express = require('express');
const { ollamaHealth, ollamaListModels, DEFAULT_OLLAMA_URL } = require('../services/ollama-client.cjs');
const { authenticate } = require('../middleware/auth.cjs');

const router = express.Router();

let _lastProbe = null;
let _lastProbeAt = 0;
const PROBE_CACHE_MS = 5000;

router.get('/health', authenticate, async (req, res) => {
  const now = Date.now();
  const baseUrl = req.query.baseUrl
    ? String(req.query.baseUrl).replace(/\/$/, '')
    : DEFAULT_OLLAMA_URL;

  if (_lastProbe && _lastProbe.baseUrl === baseUrl && now - _lastProbeAt < PROBE_CACHE_MS) {
    return res.json({ success: true, ..._lastProbe, cached: true });
  }

  const startedAt = now;
  try {
    const health = await ollamaHealth(baseUrl, { timeoutMs: 5000 });
    const latencyMs = Date.now() - startedAt;

    let models = [];
    if (health.ok) {
      try {
        models = await ollamaListModels(baseUrl, { timeoutMs: 5000, forceRefresh: true });
      } catch {
        // Health passed but tags failed — still report healthy
      }
    }

    const result = {
      ok: health.ok,
      baseUrl,
      endpoint: health.endpoint || null,
      latencyMs,
      models,
      modelCount: models.length,
      checkedAt: new Date().toISOString(),
    };

    _lastProbe = result;
    _lastProbeAt = Date.now();

    res.json({ success: true, ...result, cached: false });
  } catch (err) {
    const result = {
      ok: false,
      baseUrl,
      endpoint: null,
      latencyMs: Date.now() - startedAt,
      models: [],
      modelCount: 0,
      error: err.message,
      checkedAt: new Date().toISOString(),
    };

    _lastProbe = result;
    _lastProbeAt = Date.now();

    res.json({ success: true, ...result, cached: false });
  }
});

module.exports = router;
