"use strict";

/**
 * Token Budget Allocation API — Real-time monetary expenditure tracking
 *
 * Endpoints:
 *   GET    /api/token-budget/stats               — Budget stats
 *   GET    /api/token-budget/budgets              — List budgets
 *   POST   /api/token-budget/budgets              — Create budget
 *   GET    /api/token-budget/budgets/:scope       — Get budget
 *   PUT    /api/token-budget/budgets/:scope       — Update budget
 *   DELETE /api/token-budget/budgets/:scope       — Delete budget
 *   POST   /api/token-budget/budgets/:scope/reset — Reset budget period
 *   GET    /api/token-budget/budgets/:scope/breakdown — Expenditure breakdown
 *   GET    /api/token-budget/rates                — List model rates
 *   PUT    /api/token-budget/rates/:model         — Update model rate
 *   GET    /api/token-budget/alerts               — List alert history
 *   POST   /api/token-budget/alerts/clear         — Clear alert history
 *   GET    /api/token-budget/config               — Get config
 *   PUT    /api/token-budget/config               — Update config
 *   POST   /api/token-budget/record               — Manually record usage
 *
 * @module token-budget-allocation-routes
 */

const express = require("express");
const logger = require("../lib/app-logger.cjs");
const budgetStore = require("../lib/token-budget-allocation-store.cjs");
const { authorize } = require("../middleware/authorize.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

router.get("/stats", function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || "default";
    res.json({ success: true, stats: budgetStore.getStats(orgId) });
  } catch (err) {
    sendError(res, 500, "budget_stats_failed", { message: err.message });
  }
});

router.get("/budgets", function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || "default";
    res.json({ success: true, budgets: budgetStore.getAllBudgets(orgId) });
  } catch (err) {
    sendError(res, 500, "budgets_list_failed", { message: err.message });
  }
});

router.post("/budgets", authorize("admin:all"), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || "default";
    var scope = req.body.scope || "org";
    var result = budgetStore.createBudget(orgId, req.body, scope);
    if (!result.success)
      return sendError(res, 409, "budget_create_failed", {
        message: result.error,
      });
    logger.info(
      "[TokenBudget] Budget created by " +
        ((req.user && req.user.email) || "admin"),
    );
    res.json(result);
  } catch (err) {
    sendError(res, 400, "budget_create_failed", { message: err.message });
  }
});

router.get("/budgets/:scope", function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || "default";
    var budget = budgetStore.getBudget(orgId, req.params.scope);
    if (!budget) return sendError(res, 404, "budget_not_found");
    res.json({ success: true, budget: budget });
  } catch (err) {
    sendError(res, 500, "budget_get_failed", { message: err.message });
  }
});

router.put("/budgets/:scope", authorize("admin:all"), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || "default";
    var result = budgetStore.updateBudget(orgId, req.body, req.params.scope);
    if (!result.success) return sendError(res, 404, "budget_not_found");
    res.json(result);
  } catch (err) {
    sendError(res, 400, "budget_update_failed", { message: err.message });
  }
});

router.delete("/budgets/:scope", authorize("admin:all"), function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || "default";
    var result = budgetStore.deleteBudget(orgId, req.params.scope);
    if (!result.success) return sendError(res, 404, "budget_not_found");
    res.json(result);
  } catch (err) {
    sendError(res, 500, "budget_delete_failed", { message: err.message });
  }
});

router.post(
  "/budgets/:scope/reset",
  authorize("admin:all"),
  function (req, res) {
    try {
      var orgId = req.orgId || req.body.orgId || "default";
      var result = budgetStore.resetBudget(orgId, req.params.scope);
      if (!result.success) return sendError(res, 404, "budget_not_found");
      logger.info(
        "[TokenBudget] Budget reset by " +
          ((req.user && req.user.email) || "admin"),
      );
      res.json(result);
    } catch (err) {
      sendError(res, 500, "budget_reset_failed", { message: err.message });
    }
  },
);

router.get("/budgets/:scope/breakdown", function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || "default";
    var breakdown = budgetStore.getExpenditureBreakdown(
      orgId,
      req.params.scope,
    );
    if (!breakdown) return sendError(res, 404, "budget_not_found");
    res.json({ success: true, breakdown: breakdown });
  } catch (err) {
    sendError(res, 500, "breakdown_failed", { message: err.message });
  }
});

router.get("/rates", function (req, res) {
  try {
    res.json({ success: true, rates: budgetStore.getModelRates() });
  } catch (err) {
    sendError(res, 500, "rates_list_failed", { message: err.message });
  }
});

router.put("/rates/:model", authorize("admin:all"), function (req, res) {
  try {
    var result = budgetStore.updateModelRate(req.params.model, req.body);
    logger.info("[TokenBudget] Rate updated for model: " + req.params.model);
    res.json(result);
  } catch (err) {
    sendError(res, 400, "rate_update_failed", { message: err.message });
  }
});

router.get("/alerts", function (req, res) {
  try {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json({ success: true, alerts: budgetStore.getAlertHistory(limit) });
  } catch (err) {
    sendError(res, 500, "alerts_list_failed", { message: err.message });
  }
});

router.post("/alerts/clear", authorize("admin:all"), function (req, res) {
  try {
    var result = budgetStore.clearAlertHistory();
    logger.info(
      "[TokenBudget] Alerts cleared by " +
        ((req.user && req.user.email) || "admin"),
    );
    res.json(result);
  } catch (err) {
    sendError(res, 500, "alerts_clear_failed", { message: err.message });
  }
});

router.get("/config", function (req, res) {
  try {
    res.json({ success: true, config: budgetStore.getConfig() });
  } catch (err) {
    sendError(res, 500, "config_get_failed", { message: err.message });
  }
});

router.put("/config", authorize("admin:all"), function (req, res) {
  try {
    var result = budgetStore.updateConfig(req.body || {});
    logger.info(
      "[TokenBudget] Config updated by " +
        ((req.user && req.user.email) || "admin"),
    );
    res.json(result);
  } catch (err) {
    sendError(res, 400, "config_update_failed", { message: err.message });
  }
});

router.post("/record", function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || "default";
    var result = budgetStore.recordUsage(
      orgId,
      {
        model: req.body.model || "default",
        inputTokens: req.body.inputTokens || 0,
        outputTokens: req.body.outputTokens || 0,
        userId: req.body.userId || null,
      },
      req.body.scope,
    );
    res.json({ success: true, result: result });
  } catch (err) {
    sendError(res, 500, "record_failed", { message: err.message });
  }
});

module.exports = router;
