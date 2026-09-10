/**
 * V4 OOS — NoSQL via find($where) string built from req.query.filter.
 * Different shape than NodeGoat allocations $where threshold.
 */
"use strict";

function buildWhereFilter(req) {
  const filter = req.query.filter || "true";
  // DELIBERATE VULNERABILITY — filter interpolated into $where
  return {
    $where: "this.active === true && (" + filter + ")",
  };
}

module.exports = { buildWhereFilter };
