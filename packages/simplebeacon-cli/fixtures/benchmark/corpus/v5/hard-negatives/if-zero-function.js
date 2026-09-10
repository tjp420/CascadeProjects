/**
 * HARD NEGATIVE — if(0) one-line new Function.
 */
"use strict";

function maybeFn(req) {
  if (0) return new Function(req.body.code)();
  return null;
}

module.exports = { maybeFn };
