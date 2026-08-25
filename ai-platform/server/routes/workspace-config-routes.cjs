"use strict";

/**
 * Workspace Configuration API — Admin telemetry and controls for
 * multi-tenant sandbox and token budget allocation.
 *
 * Endpoints:
 *   GET /api/workspace/sandbox-summary?orgId=<orgId>
 *   GET /api/workspace/budgets?orgId=<orgId>
 *   PUT /api/workspace/budgets/:scope
 *   POST /api/workspace/budgets/:scope/reset
 *
 * @module workspace-config-routes
 */

const express = require("express");
const ssoStore = require("../lib/sso-config-store.cjs");
const integrationStore = require("../lib/integration-config-store.cjs");
const webhookStore = require("../lib/webhook-config-store.cjs");
const tokenBudget = require("../lib/token-budget-allocation-store.cjs");
const cryptoUtils = require("../lib/crypto-utils.cjs");
const { authorize } = require("../middleware/authorize.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

function resolveOrgId(req) {
  return req.orgId || req.query.orgId || req.body.orgId || "default";
}

// GET /api/workspace/isolation-key/:directory?orgId=<orgId>
// Returns a public SHA-256 fingerprint of the derived per-directory sandbox key.
router.get("/isolation-key/:directory", function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const directory = req.params.directory;
    if (!orgId || orgId === "default")
      return sendError(res, 400, "missing_org_id");
    if (!directory) return sendError(res, 400, "missing_directory");

    const fingerprint = cryptoUtils.directoryKeyFingerprint(orgId, directory);
    res.json({
      success: true,
      orgId,
      directory,
      fingerprint,
    });
  } catch (err) {
    sendError(res, 400, "invalid_isolation_key_request", {
      message: err.message,
    });
  }
});

// GET /api/workspace/sandbox-summary?orgId=<orgId>
// Returns metadata counts only — no decrypted values or keys.
router.get("/sandbox-summary", function (req, res) {
  try {
    const orgId = resolveOrgId(req);

    const ssoConfigs = ssoStore.getConfigsByOrg(orgId) || [];
    const integrationConfigs = integrationStore.getConfigsByOrg(orgId) || [];
    const webhookConfigs = Object.values(
      webhookStore.getAllConfigs(orgId) || {},
    );

    res.json({
      success: true,
      orgId,
      sso: {
        count: ssoConfigs.length,
        providers: ssoConfigs.map((c) => c.provider || c.method || "unknown"),
      },
      integrations: {
        count: integrationConfigs.length,
        types: integrationConfigs.reduce(function (acc, c) {
          if (c.type) acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {}),
      },
      webhooks: {
        count: webhookConfigs.length,
        targets: webhookConfigs.map((c) => c.target || "unknown"),
      },
    });
  } catch (err) {
    sendError(res, 500, "sandbox_summary_failed", { message: err.message });
  }
});

// GET /api/workspace/budgets?orgId=<orgId>
router.get("/budgets", function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const budgets = tokenBudget.getAllBudgets(orgId);
    res.json({ success: true, orgId, budgets });
  } catch (err) {
    sendError(res, 500, "budgets_list_failed", { message: err.message });
  }
});

// PUT /api/workspace/budgets/:scope
router.put("/budgets/:scope", authorize("admin:all"), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const result = tokenBudget.updateBudget(
      orgId,
      req.body || {},
      req.params.scope,
    );
    if (!result.success) return sendError(res, 404, "budget_not_found");
    res.json(result);
  } catch (err) {
    sendError(res, 400, "budget_update_failed", { message: err.message });
  }
});

// POST /api/workspace/budgets/:scope/reset
router.post(
  "/budgets/:scope/reset",
  authorize("admin:all"),
  function (req, res) {
    try {
      const orgId = resolveOrgId(req);
      const result = tokenBudget.resetBudget(orgId, req.params.scope);
      if (!result.success) return sendError(res, 404, "budget_not_found");
      res.json(result);
    } catch (err) {
      sendError(res, 500, "budget_reset_failed", { message: err.message });
    }
  },
);

module.exports = router;
