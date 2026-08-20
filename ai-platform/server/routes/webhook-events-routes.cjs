"use strict";

/**
 * Webhook Events API — exposes recent Stripe webhook events for dashboard visualization.
 *
 * GET /webhook-events          — list recent events with optional filters
 * GET /webhook-events/stats    — summary statistics
 */

const express = require("express");
const { getRecentEvents, getStats } = require("../lib/webhook-event-log.cjs");
const { authorize } = require("../middleware/authorize.cjs");

const router = express.Router();

router.get("/stats", authorize("admin:all"), (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch webhook event stats" });
  }
});

router.get("/", authorize("admin:all"), (req, res) => {
  try {
    const opts = {};
    if (req.query.eventType) opts.eventType = String(req.query.eventType);
    if (req.query.status) opts.status = String(req.query.status);
    if (req.query.limit)
      opts.limit = Math.min(
        200,
        Math.max(1, parseInt(req.query.limit, 10) || 50),
      );
    const events = getRecentEvents(opts);
    res.json({ success: true, events, count: events.length });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch webhook events" });
  }
});

module.exports = router;
