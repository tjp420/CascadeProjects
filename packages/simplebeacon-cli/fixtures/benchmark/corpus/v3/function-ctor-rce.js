/**
 * Function-constructor RCE variant (minimal extract).
 * Same class family as eval, different sink shape: new Function(...).
 *
 * Attack path (intentional):
 *   req.body.code → new Function(code) → immediate invoke
 */
"use strict";

function runUserSnippet(req) {
  const code = req.body.code || "return 0";
  // DELIBERATE VULNERABILITY — attacker-controlled Function body
  const fn = new Function(code);
  return fn();
}

module.exports = { runUserSnippet };
