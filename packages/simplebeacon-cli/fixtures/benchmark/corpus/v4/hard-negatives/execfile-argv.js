/**
 * HARD NEGATIVE — execFile with fixed binary + argv array (no shell).
 * Detector bait: child_process + user input nearby.
 */
"use strict";

const { execFile } = require("child_process");

function pingHost(req, cb) {
  const host = String(req.query.host || "127.0.0.1").replace(/[^a-zA-Z0-9.-]/g, "");
  return execFile("ping", ["-c", "1", host], cb);
}

module.exports = { pingHost };
