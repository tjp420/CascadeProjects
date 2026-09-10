/**
 * V5 OOS — NoSQL $where via req.params.id (fresh entrypoint).
 */
"use strict";

function findByDynamicWhere(req) {
  const clause = req.params.id || "1";
  // DELIBERATE VULNERABILITY
  return { $where: "this._id == " + clause };
}

module.exports = { findByDynamicWhere };
