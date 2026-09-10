/**
 * HARD NEGATIVE — no attacker sink. Used when fabricated RCE evidence
 * claims eval/req.body but source is pure arithmetic.
 */
"use strict";

function add(a, b) {
  return a + b;
}

module.exports = { add };
