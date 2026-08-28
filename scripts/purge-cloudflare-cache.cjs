#!/usr/bin/env node
/**
 * Purge Cloudflare cache for simplebeacon.ai after a Pages deployment.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN  — API token with Zone.Cache Purge permission
 *   CLOUDFLARE_ZONE_ID    — Zone ID for simplebeacon.ai
 *
 * Usage:
 *   node scripts/purge-cloudflare-cache.cjs
 *   node scripts/purge-cloudflare-cache.cjs --urls "/dashboard/*,/assets/*"
 *
 * If env vars are missing, exits with a soft warning (non-blocking).
 */
"use strict";

const https = require("https");

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

function purgeEverything() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ purge_everything: true });
    const options = {
      hostname: "api.cloudflare.com",
      path: `/client/v4/zones/${ZONE_ID}/purge_cache`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!API_TOKEN || !ZONE_ID) {
    console.warn(
      "[cache-purge] CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not set — skipping purge.",
    );
    console.warn(
      "[cache-purge] Set these in your environment or Render dashboard to enable automatic cache purging.",
    );
    process.exit(0);
  }

  console.log("[cache-purge] Purging Cloudflare cache for zone", ZONE_ID, "…");
  try {
    const result = await purgeEverything();
    if (result.status === 200 && result.body?.success) {
      console.log("[cache-purge] ✓ Cache purged successfully.");
    } else {
      console.error("[cache-purge] ✗ Purge failed:", result.status, result.body);
      process.exit(1);
    }
  } catch (err) {
    console.error("[cache-purge] ✗ Error:", err.message);
    process.exit(1);
  }
}

main();
