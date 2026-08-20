#!/usr/bin/env node
const net = require("net");

function isPortOpen(port, host = "127.0.0.1", timeout = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let finished = false;
    socket.setTimeout(timeout);
    socket.once("connect", () => {
      finished = true;
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      if (finished) return;
      finished = true;
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  const envPort = Number(process.env.PORT) || 0;
  const defaultPort = 3000;
  const portsToCheck = new Set();
  portsToCheck.add(envPort || defaultPort);
  // Also check known problematic IDE preview port that caused stale assets
  portsToCheck.add(54358);

  const used = [];
  for (const p of portsToCheck) {
    if (!p || Number.isNaN(p)) continue;
    // eslint-disable-next-line no-await-in-loop
    const open = await isPortOpen(p);
    if (open) used.push(p);
  }

  if (used.length > 0) {
    console.error(`[check-port] Conflict: port(s) in use: ${used.join(", ")}.`);
    console.error(
      "[check-port] Stop the conflicting process(es) or change the PORT environment variable and retry.",
    );
    process.exit(1);
  }

  console.log("[check-port] No conflicting ports detected.");
  process.exit(0);
}

main().catch((err) => {
  console.error(
    "[check-port] Unexpected error:",
    err && err.stack ? err.stack : err,
  );
  process.exit(2);
});
