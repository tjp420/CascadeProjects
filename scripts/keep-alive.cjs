#!/usr/bin/env node
/**
 * Render Keep-Alive Ping Script
 *
 * Prevents Render's free-tier container from spinning down after 15 min
 * of inactivity by sending a lightweight GET request to /api/health at
 * randomized intervals (10-14 min). The jitter avoids Render's robotic
 * traffic pattern detection.
 *
 * Zero dependencies — uses only Node.js built-ins (https, child_process).
 *
 * Usage:
 *   node scripts/keep-alive.cjs                 # long-running loop (default)
 *   node scripts/keep-alive.cjs --once          # single ping (for cron)
 *   node scripts/keep-alive.cjs --interval 9    # custom base interval in minutes
 *   RENDER_URL=https://my-app.onrender.com node scripts/keep-alive.cjs
 *
 * Exit codes:
 *   0 — ping succeeded (or loop exited cleanly via SIGINT/SIGTERM)
 *   1 — ping failed (network error or non-200 response)
 *   2 — configuration error
 */

"use strict";

const https = require("https");
const { URL } = require("url");

// --- Configuration ---------------------------------------------------------

const DEFAULT_RENDER_URL =
  process.env.RENDER_URL || "https://cascadeprojects-yzzd.onrender.com";
const DEFAULT_INTERVAL_MIN = 10; // base interval (minutes)
const JITTER_MIN = 0; // min jitter (minutes)
const JITTER_MAX = 4; // max jitter (minutes) → 10-14 min range
const REQUEST_TIMEOUT_MS = 15000; // 15s timeout per ping
const HEALTH_PATH = "/api/health";

const RENDER_URL = process.env.RENDER_URL || DEFAULT_RENDER_URL;
const ONCE = process.argv.includes("--once");
const INTERVAL_FLAG_IDX = process.argv.indexOf("--interval");
const BASE_INTERVAL =
  INTERVAL_FLAG_IDX !== -1
    ? parseInt(process.argv[INTERVAL_FLAG_IDX + 1], 10) || DEFAULT_INTERVAL_MIN
    : DEFAULT_INTERVAL_MIN;

// --- Helpers ---------------------------------------------------------------

function jitteredIntervalMs() {
  const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
  const totalMin = BASE_INTERVAL + jitter;
  return Math.round(totalMin * 60 * 1000);
}

function timestamp() {
  return new Date().toISOString();
}

function ping(urlStr) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(urlStr);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }

    const options = {
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: "GET",
      headers: {
        "User-Agent": "SimpleBeacon-KeepAlive/1.0",
        Accept: "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            status: res.statusCode,
            body,
            durationMs: Date.now() - startTime,
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${urlStr}`));
        }
      });
    });

    const startTime = Date.now();

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.end();
  });
}

async function runPing() {
  const url = RENDER_URL + HEALTH_PATH;
  const nextInterval = jitteredIntervalMs();
  const nextAt = new Date(Date.now() + nextInterval).toISOString();

  try {
    const result = await ping(url);
    const data = (() => {
      try {
        return JSON.parse(result.body);
      } catch {
        return null;
      }
    })();
    const status = data?.status || "unknown";
    console.log(
      `[${timestamp()}] OK ${result.status} (${result.durationMs}ms) status=${status} — next ping at ${nextAt}`,
    );
    return true;
  } catch (err) {
    console.error(
      `[${timestamp()}] FAIL ${err.message} — next ping at ${nextAt}`,
    );
    return false;
  }
}

async function runLoop() {
  console.log(`[${timestamp()}] Keep-alive loop started`);
  console.log(`  Target:    ${RENDER_URL}${HEALTH_PATH}`);
  console.log(
    `  Interval:  ${BASE_INTERVAL}-${BASE_INTERVAL + JITTER_MAX} min (jittered)`,
  );
  console.log(`  PID:       ${process.pid}`);
  console.log(`  Press Ctrl+C to stop\n`);

  // Send first ping immediately
  await runPing();

  const scheduleNext = () => {
    const delay = jitteredIntervalMs();
    setTimeout(async () => {
      await runPing();
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  // Handle graceful shutdown
  const shutdown = (sig) => {
    console.log(`\n[${timestamp()}] Received ${sig}, exiting cleanly`);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function main() {
  if (!RENDER_URL || !RENDER_URL.startsWith("http")) {
    console.error("Error: RENDER_URL must be a valid HTTP(S) URL");
    process.exit(2);
  }

  if (ONCE) {
    const ok = await runPing();
    process.exit(ok ? 0 : 1);
  } else {
    await runLoop();
  }
}

main().catch((err) => {
  console.error(`[${timestamp()}] Fatal: ${err.message}`);
  process.exit(1);
});
