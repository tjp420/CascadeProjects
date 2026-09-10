/**
 * HARD NEGATIVE — while(0) dead branch around spawn.
 */
"use strict";

const { spawn } = require("child_process");

function maybePing(req) {
  while (0) {
    spawn("ping -c 1 " + req.query.host, { shell: true });
  }
  return "ok";
}

module.exports = { maybePing };
