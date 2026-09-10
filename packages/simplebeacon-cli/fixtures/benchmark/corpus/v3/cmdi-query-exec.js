/**
 * Command-injection variant (minimal extract).
 * Different RCE sink than eval — child_process.exec.
 *
 * Attack path (intentional):
 *   req.query.cmd → child_process.exec(cmd)
 */
"use strict";

const { exec } = require("child_process");

function runUserCommand(req, callback) {
  const cmd = req.query.cmd || "echo ok";
  // DELIBERATE VULNERABILITY — attacker-controlled shell string
  return exec(cmd, callback);
}

module.exports = { runUserCommand };
