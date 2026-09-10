/**
 * V5 OOS — reachable SSJS via vm.runInThisContext (sibling of runInNewContext).
 */
"use strict";

const vm = require("vm");

function runExpr(req) {
  const expr = req.body.expr || "0";
  // DELIBERATE VULNERABILITY
  return vm.runInThisContext(expr);
}

module.exports = { runExpr };
