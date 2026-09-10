/**
 * Example / tutorial snippet — eval of a constant, not attacker input.
 * Lives under examples/ so triage should dismiss as non-production noise.
 */
"use strict";

const DEMO = "1 + 1";
const result = eval(DEMO);
module.exports = { result };
