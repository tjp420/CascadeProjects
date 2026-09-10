/**
 * Juice Shop–style product search SQL injection (minimal extract).
 * Inspired by OWASP Juice Shop routes/search.ts — MIT (see ../juice-shop/NOTICE).
 *
 * Attack path (intentional):
 *   req.query.q → string-interpolated SELECT … LIKE '%criteria%'
 */
"use strict";

function buildProductSearchQuery(req) {
  let criteria = req.query.q === "undefined" ? "" : req.query.q || "";
  criteria = criteria.length <= 200 ? criteria : criteria.substring(0, 200);
  // DELIBERATE VULNERABILITY — attacker-controlled SQL concatenation
  return (
    "SELECT * FROM Products WHERE ((name LIKE '%" +
    criteria +
    "%' OR description LIKE '%" +
    criteria +
    "%') AND deletedAt IS NULL) ORDER BY name"
  );
}

module.exports = { buildProductSearchQuery };
