"use strict";

const express = require("express");
const { authenticate } = require("../middleware/auth.cjs");
const logger = require("../lib/app-logger.cjs");

const router = express.Router();

/**
 * GET /api/scans/count
 * Returns the authenticated user's scan count for the current month.
 * Uses PostgreSQL when available, falls back to in-memory store.
 */
router.get("/count", authenticate, async (req, res) => {
  try {
    const db = req.app?.locals?.db;
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.json({ count: 0 });
    }
    if (db) {
      const result = await db.query(
        `SELECT scan_count FROM scan_counts
         WHERE user_id = $1 AND month_bucket = date_trunc('month', NOW())
         LIMIT 1`,
        [userId],
      );
      const count =
        result.rows.length > 0 ? parseInt(result.rows[0].scan_count, 10) : 0;
      return res.json({ count });
    }
    // No DB — return 0 (frontend uses localStorage as source of truth)
    return res.json({ count: 0 });
  } catch (err) {
    logger.warn("[ScanCounter] Failed to fetch count:", err.message);
    return res.json({ count: 0 });
  }
});

/**
 * POST /api/scans/increment
 * Increments the authenticated user's scan count for the current month.
 * Uses PostgreSQL upsert when available.
 */
router.post("/increment", authenticate, async (req, res) => {
  try {
    const db = req.app?.locals?.db;
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.json({ count: 0, incremented: false });
    }
    if (db) {
      await db.query(
        `INSERT INTO scan_counts (user_id, month_bucket, scan_count)
         VALUES ($1, date_trunc('month', NOW()), 1)
         ON CONFLICT (user_id, month_bucket)
         DO UPDATE SET scan_count = scan_counts.scan_count + 1
         RETURNING scan_count`,
        [userId],
      );
      return res.json({ incremented: true });
    }
    // No DB — frontend localStorage is the source of truth
    return res.json({ incremented: false });
  } catch (err) {
    logger.warn("[ScanCounter] Failed to increment:", err.message);
    return res.json({ incremented: false });
  }
});

module.exports = router;
