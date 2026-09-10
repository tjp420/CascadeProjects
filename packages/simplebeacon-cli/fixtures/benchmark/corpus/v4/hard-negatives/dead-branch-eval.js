/**
 * BORDERLINE HARD NEGATIVE — eval behind if (false) dead branch.
 * Convincing sink token present; not attacker-reachable production path.
 */
"use strict";

function compute(req) {
  const n = Number(req.body.n) || 0;
  if (false) {
    eval(req.body.payload);
  }
  return n * 2;
}

module.exports = { compute };
