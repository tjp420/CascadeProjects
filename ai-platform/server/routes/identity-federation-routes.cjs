"use strict";

/**
 * Identity federation routes — SAML/OIDC federation metadata, config, and sync history.
 *
 * Endpoints:
 *   GET /api/identity-federation/stats    — Aggregate federation stats
 *   GET /api/identity-federation/config   — Federation configuration
 *   GET /api/identity-federation/history  — Recent sync events
 */

const express = require("express");
const { authenticate } = require("../middleware/auth.cjs");

const router = express.Router();

router.use(authenticate);

router.get("/stats", function (req, res) {
  res.json({
    success: true,
    stats: {
      totalProviders: 0,
      activeProviders: 0,
      lastSyncAt: null,
      failedSyncs: 0,
    },
  });
});

router.get("/config", function (req, res) {
  res.json({
    success: true,
    config: {
      providers: [],
      syncIntervalMs: 300000,
      autoProvision: false,
    },
  });
});

router.get("/history", function (req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  res.json({
    success: true,
    history: [],
    total: 0,
    limit,
  });
});

module.exports = router;
