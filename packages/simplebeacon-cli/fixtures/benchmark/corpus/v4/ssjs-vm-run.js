/**
 * V4 OOS — SSJS via vm.runInNewContext (not eval / new Function).
 * Attack path (intentional): req.body.expr → vm.runInNewContext(expr)
 */
"use strict";

const vm = require("vm");

function evaluateUserExpr(req) {
  const expr = req.body.expr || "0";
  // DELIBERATE VULNERABILITY — attacker-controlled VM script
  return vm.runInNewContext(expr, {});
}

module.exports = { evaluateUserExpr };
