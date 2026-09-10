/**
 * SQL injection variant — ORDER BY interpolation (not WHERE concat).
 * Same class, different source→sink structure.
 *
 * Attack path (intentional):
 *   req.query.sort → ORDER BY clause → database
 */
"use strict";

function buildSortedProductsQuery(req) {
  const sort = req.query.sort || "name";
  // DELIBERATE VULNERABILITY — sort key concatenated into ORDER BY
  return (
    "SELECT * FROM Products WHERE deletedAt IS NULL ORDER BY " +
    sort +
    " ASC"
  );
}

module.exports = { buildSortedProductsQuery };
