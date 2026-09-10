/**
 * V4 OOS — Command injection via spawn(..., { shell: true }).
 * Different API than child_process.exec.
 */
"use strict";

const { spawn } = require("child_process");

function runPing(req) {
  const host = req.query.host || "127.0.0.1";
  // DELIBERATE VULNERABILITY — shell:true with interpolated host
  return spawn("ping -c 1 " + host, { shell: true });
}

module.exports = { runPing };
