/**
 * V5 OOS — command injection via execSync string.
 */
"use strict";

const { execSync } = require("child_process");

function listDir(req) {
  const dir = req.query.dir || ".";
  // DELIBERATE VULNERABILITY
  return execSync("ls " + dir, { encoding: "utf8" });
}

module.exports = { listDir };
