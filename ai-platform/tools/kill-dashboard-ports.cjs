#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Stop node processes listening on SimpleBeacon local dashboard ports.
 * Usage: node tools/kill-dashboard-ports.js
 */

const { execSync } = require("child_process");

const constants = require("../server/config/constants.cjs");
const PORTS = [constants.DASHBOARD_PORT, 8081];

function listListeningPids(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPort(port) {
  const pids = listListeningPids(port);
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      process.stdout.write(
        [`[kill-dashboard-ports] Stopped PID ${pid} on port ${port}`].join(
          " ",
        ) + "\n",
      );
    } catch (error) {
      process.stderr.write(
        [
          `[kill-dashboard-ports] Could not stop PID ${pid} on port ${port}: ${error.message}`,
        ].join(" ") + "\n",
      );
    }
  }
  if (!pids.length) {
    process.stdout.write(
      [`[kill-dashboard-ports] No listener on port ${port}`].join(" ") + "\n",
    );
  }
}

for (const port of PORTS) {
  killPort(port);
}
