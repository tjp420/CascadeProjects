#!/usr/bin/env node
/**
 * One-shot: use wrangler OAuth to purge simplebeacon.ai dashboard cache.
 * Does not print the token.
 */
"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");

const configPath = path.join(
  process.env.APPDATA || "",
  "xdg.config",
  ".wrangler",
  "config",
  "default.toml",
);

if (!fs.existsSync(configPath)) {
  console.error("wrangler config not found:", configPath);
  process.exit(1);
}

const toml = fs.readFileSync(configPath, "utf8");
const m = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!m) {
  console.error("No oauth_token in wrangler config");
  process.exit(1);
}
const token = m[1];

function api(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "api.cloudflare.com",
        path: apiPath,
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const zones = await api("GET", "/client/v4/zones?name=simplebeacon.ai");
  if (!zones.body?.success) {
    console.error(
      "Zone lookup failed",
      zones.status,
      zones.body?.errors || zones.body,
    );
    process.exit(1);
  }
  const zoneId = zones.body.result?.[0]?.id;
  if (!zoneId) {
    console.error("Zone not found");
    process.exit(1);
  }
  console.log("Zone found:", zoneId);

  const files = [
    "https://simplebeacon.ai/dashboard/",
    "https://simplebeacon.ai/dashboard",
    "https://simplebeacon.ai/dashboard/index.html",
    "https://simplebeacon.ai/dashboard/__entry",
    "https://simplebeacon.ai/dashboard/assets/main.js",
    "https://simplebeacon.ai/dashboard/assets/main.js?v=1789019100000",
    "https://simplebeacon.ai/dashboard/assets/main.js?v=1789047600000",
    "https://simplebeacon.ai/dashboard/assets/main-DFCoPisA.js",
    "https://simplebeacon.ai/dashboard/assets/main-DFCoPisA.js?v=evidence-rc-20260910",
    "https://simplebeacon.ai/dashboard/assets/main.css",
  ];

  const purge = await api("POST", `/client/v4/zones/${zoneId}/purge_cache`, {
    files,
  });
  console.log(
    "Targeted purge status:",
    purge.status,
    "success=",
    purge.body?.success,
  );
  if (!purge.body?.success) {
    console.log(
      "Targeted purge errors:",
      JSON.stringify(purge.body?.errors || []),
    );
    console.log("Trying purge_everything…");
    const everything = await api(
      "POST",
      `/client/v4/zones/${zoneId}/purge_cache`,
      { purge_everything: true },
    );
    console.log(
      "Everything purge status:",
      everything.status,
      "success=",
      everything.body?.success,
      "errors=",
      JSON.stringify(everything.body?.errors || []),
    );
    if (!everything.body?.success) process.exit(1);
  } else {
    console.log("Purged targeted dashboard URLs");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
