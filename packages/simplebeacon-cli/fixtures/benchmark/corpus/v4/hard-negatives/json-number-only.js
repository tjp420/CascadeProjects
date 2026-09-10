/**
 * BORDERLINE HARD NEGATIVE — JSON.parse then eval of a numeric-looking path
 * that is actually just Number(); fabricated RCE claim must not Verified.
 */
"use strict";

function parseScore(req) {
  const raw = req.body.score || "0";
  const parsed = JSON.parse(JSON.stringify(raw));
  return Number(parsed);
}

module.exports = { parseScore };
