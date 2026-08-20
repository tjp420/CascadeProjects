/**
 * Setup Oracle search routes under /api/oracle
 */
"use strict";

const express = require("express");
const logger = require("../lib/app-logger.cjs");
const oracleSearch = require("../lib/oracle-search.cjs");
const { optionalAuthenticate } = require("../middleware/auth.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

function setupOracleSearch(app) {
  const router = express.Router();

  // GET /api/oracle/search?q=...&max_results=3
  router.get("/search", optionalAuthenticate, async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q)
      return sendError(res, 400, "missing_query", {
        message: 'Query parameter "q" is required',
      });
    const max = Math.min(
      5,
      Math.max(1, parseInt(req.query.max_results || "3", 10) || 3),
    );
    const delay = parseFloat(req.query.delay_between_fetch || "0.5");
    try {
      const results = await oracleSearch(q, {
        maxResults: max,
        delayBetweenFetch: delay,
      });
      return res.json({ query: q, results });
    } catch (e) {
      logger.error(
        "[OracleSearch] search failed:",
        e && e.stack ? e.stack : String(e),
      );
      return sendError(res, 500, "oracle_search_failed", {
        message: String(e),
      });
    }
  });

  app.use("/api/oracle", router);
}

module.exports = setupOracleSearch;
