/**
 * V5 OOS — SQLi via LIMIT concatenation (fresh shape).
 */
"use strict";

function buildPagedQuery(req) {
  const limit = req.query.limit || "10";
  // DELIBERATE VULNERABILITY
  return "SELECT * FROM Products WHERE deletedAt IS NULL LIMIT " + limit;
}

module.exports = { buildPagedQuery };
