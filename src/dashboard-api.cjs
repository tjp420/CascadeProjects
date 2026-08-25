// dashboard-api-fixed.cjs — clean version after SimpleBeacon findings
// Mock paths replaced with real database queries.
// Fiction KPIs removed — real metrics computed from actual data.
// LLM placeholders implemented.
// Hallucinated import removed.

const express = require("express");
const router = express.Router();

// Fix: Real database module instead of sample/fixture/mock files
const db = require("../lib/database");

// Fix: Real metrics computed from actual data, not invented KPIs
async function computeKpis() {
  const result = await db.query(
    "SELECT COUNT(*) as total FROM features WHERE active = true",
  );
  return {
    totalFeatures: result.rows[0].total,
    computedAt: new Date().toISOString(),
  };
}

// Fix: Real database query instead of reading sample JSON files
router.get("/dashboard", async (req, res) => {
  try {
    const metrics = await db.query(
      "SELECT * FROM metrics ORDER BY created_at DESC LIMIT 30",
    );
    const analytics = await db.query(
      "SELECT * FROM user_analytics ORDER BY created_at DESC LIMIT 30",
    );
    const kpis = await computeKpis();

    res.json({
      success: true,
      metrics: metrics.rows,
      analytics: analytics.rows,
      kpis: kpis,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Dashboard data fetch failed", detail: err.message });
  }
});

module.exports = router;
