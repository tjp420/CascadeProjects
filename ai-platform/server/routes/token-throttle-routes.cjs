"use strict";

/**
 * Token-Throttling Backpressure Mesh API
 *
 * Endpoints for monitoring and configuring real-time token/request
 * throttling per organization and per provider.
 *
 * @module token-throttle-routes
 */

const express = require("express");
const mesh = require("../lib/token-throttle-mesh.cjs");
const { authorize } = require("../middleware/authorize.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

function resolveOrgId(req) {
  return req.orgId || req.query.orgId || req.body.orgId || "default";
}

// GET /api/token-throttle/status?orgId=...&provider=...
router.get("/status", function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const provider = req.query.provider;
    if (!provider) return sendError(res, 400, "missing_provider");
    res.json({ success: true, ...mesh.getStatus(orgId, provider) });
  } catch (err) {
    sendError(res, 500, "throttle_status_failed", { message: err.message });
  }
});

// POST /api/token-throttle/configure
router.post("/configure", authorize("admin:all"), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const provider = (req.body && req.body.provider) || null;
    const rpm = Number(req.body && req.body.rpm);
    const tpm = Number(req.body && req.body.tpm);
    if (!provider) return sendError(res, 400, "missing_provider");
    const result = mesh.setLimits(orgId, provider, { rpm, tpm });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, "throttle_configure_failed", { message: err.message });
  }
});

// POST /api/token-throttle/reset
router.post("/reset", authorize("admin:all"), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const provider = (req.body && req.body.provider) || null;
    if (!provider) return sendError(res, 400, "missing_provider");
    const result = mesh.reset(orgId, provider);
    res.json(result);
  } catch (err) {
    sendError(res, 500, "throttle_reset_failed", { message: err.message });
  }
});

module.exports = router;
