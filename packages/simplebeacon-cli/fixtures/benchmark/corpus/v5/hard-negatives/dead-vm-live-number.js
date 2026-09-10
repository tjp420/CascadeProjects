/**
 * HARD NEGATIVE — vm present but only in dead branch; live path is Number().
 */
"use strict";

const vm = require("vm");

function score(req) {
  if (false) {
    return vm.runInNewContext(req.body.expr, {});
  }
  return Number(req.body.expr) || 0;
}

module.exports = { score };
