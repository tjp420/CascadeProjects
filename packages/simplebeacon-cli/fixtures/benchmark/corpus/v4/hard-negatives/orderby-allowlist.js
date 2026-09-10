/**
 * HARD NEGATIVE — ORDER BY with allowlisted column map.
 */
"use strict";

const ALLOWED = { name: "name", price: "price", created: "createdAt" };

function buildSortedQuery(req) {
  const key = ALLOWED[req.query.sort] || "name";
  return "SELECT * FROM Products WHERE deletedAt IS NULL ORDER BY " + key + " ASC";
}

module.exports = { buildSortedQuery };
