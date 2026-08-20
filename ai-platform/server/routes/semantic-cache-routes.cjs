"use strict";

/**
 * Semantic Cache API — Management endpoints for the inference response cache
 *
 * Endpoints:
 *   GET    /api/semantic-cache/stats                — Cache stats
 *   GET    /api/semantic-cache/config                — Get config
 *   PUT    /api/semantic-cache/config                — Update config
 *   POST   /api/semantic-cache/config/reset          — Reset config to defaults
 *   GET    /api/semantic-cache/entries               — List cache entries
 *   POST   /api/semantic-cache/clear                 — Clear entire cache
 *   POST   /api/semantic-cache/invalidate/provider   — Invalidate by provider
 *   POST   /api/semantic-cache/invalidate/pattern    — Invalidate by pattern
 *   POST   /api/semantic-cache/test-similarity       — Test similarity between texts
 *
 * @module semantic-cache-routes
 */

const express = require("express");
const logger = require("../lib/app-logger.cjs");
const semanticCache = require("../lib/semantic-cache-store.cjs");
const { authorize } = require("../middleware/authorize.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

// GET /stats
router.get("/stats", function (req, res) {
  try {
    res.json({ success: true, stats: semanticCache.getStats() });
  } catch (err) {
    sendError(res, 500, "cache_stats_failed", { message: err.message });
  }
});

// GET /config
router.get("/config", function (req, res) {
  try {
    res.json({ success: true, config: semanticCache.getConfig() });
  } catch (err) {
    sendError(res, 500, "cache_config_failed", { message: err.message });
  }
});

// PUT /config
router.put("/config", authorize("admin:all"), function (req, res) {
  try {
    var result = semanticCache.updateConfig(req.body || {});
    logger.info(
      "[SemanticCache] Config updated by " +
        ((req.user && req.user.email) || "admin"),
    );
    res.json(result);
  } catch (err) {
    sendError(res, 400, "cache_config_update_failed", { message: err.message });
  }
});

// POST /config/reset
router.post("/config/reset", authorize("admin:all"), function (req, res) {
  try {
    var result = semanticCache.resetConfig();
    logger.info(
      "[SemanticCache] Config reset by " +
        ((req.user && req.user.email) || "admin"),
    );
    res.json(result);
  } catch (err) {
    sendError(res, 500, "cache_config_reset_failed", { message: err.message });
  }
});

// GET /entries
router.get("/entries", function (req, res) {
  try {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json({ success: true, entries: semanticCache.getEntries(limit) });
  } catch (err) {
    sendError(res, 500, "cache_entries_failed", { message: err.message });
  }
});

// POST /clear
router.post("/clear", authorize("admin:all"), function (req, res) {
  try {
    var result = semanticCache.clearCache();
    logger.info(
      "[SemanticCache] Cache cleared by " +
        ((req.user && req.user.email) || "admin") +
        " (" +
        result.cleared +
        " entries)",
    );
    res.json(result);
  } catch (err) {
    sendError(res, 500, "cache_clear_failed", { message: err.message });
  }
});

// POST /invalidate/provider
router.post(
  "/invalidate/provider",
  authorize("admin:all"),
  function (req, res) {
    try {
      var provider = req.body.provider;
      if (!provider) return sendError(res, 400, "provider_required");
      var result = semanticCache.invalidateByProvider(provider);
      logger.info(
        "[SemanticCache] Invalidated provider=" +
          provider +
          " (" +
          result.invalidated +
          " entries) by " +
          ((req.user && req.user.email) || "admin"),
      );
      res.json(result);
    } catch (err) {
      sendError(res, 500, "invalidate_provider_failed", {
        message: err.message,
      });
    }
  },
);

// POST /invalidate/pattern
router.post("/invalidate/pattern", authorize("admin:all"), function (req, res) {
  try {
    var pattern = req.body.pattern;
    if (!pattern) return sendError(res, 400, "pattern_required");
    var result = semanticCache.invalidateByPattern(pattern);
    logger.info(
      "[SemanticCache] Invalidated pattern=" +
        pattern +
        " (" +
        result.invalidated +
        " entries) by " +
        ((req.user && req.user.email) || "admin"),
    );
    res.json(result);
  } catch (err) {
    sendError(res, 500, "invalidate_pattern_failed", { message: err.message });
  }
});

// POST /test-similarity
router.post("/test-similarity", function (req, res) {
  try {
    var textA = req.body.textA;
    var textB = req.body.textB;
    if (!textA || !textB)
      return sendError(res, 400, "textA_and_textB_required");
    var result = semanticCache.testSimilarity(textA, textB);
    res.json({ success: true, result: result });
  } catch (err) {
    sendError(res, 500, "test_similarity_failed", { message: err.message });
  }
});

module.exports = router;
