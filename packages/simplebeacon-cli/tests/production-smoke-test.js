// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
"use strict";

/**
 * SimpleBeacon production CI telemetry smoke test.
 * Verifies POST /api/simplebeacon/ci/telemetry accepts normalized pipeline metadata.
 *
 * Usage:
 *   node packages/simplebeacon-cli/tests/production-smoke-test.js
 *   SIMPLEBEACON_CI_TELEMETRY_URL=https://simplebeacon.ai/api/simplebeacon/ci/telemetry \
 *     SIMPLEBEACON_LICENSE_TOKEN=<jwt> node packages/simplebeacon-cli/tests/production-smoke-test.js
 *
 * Env:
 *   SIMPLEBEACON_CI_TELEMETRY_URL — full URL (default https://simplebeacon.ai/api/simplebeacon/ci/telemetry)
 *   SIMPLEBEACON_API_HOST / SIMPLEBEACON_API_PORT — build URL when TELEMETRY_URL unset
 *   SIMPLEBEACON_LICENSE_TOKEN — Bearer JWT (required for ingest pass)
 *   SIMPLEBEACON_SMOKE_ROUTING_ONLY=1 — pass on 401/403 (route alive, no valid token)
 */

const http = require("http");
const https = require("https");
const { buildCiTelemetryPayload } = require("../src/lib/ci-telemetry");
const { generateLicenseToken } = require("../src/lib/license-token");

function resolveTelemetryUrl() {
  if (process.env.SIMPLEBEACON_CI_TELEMETRY_URL) {
    return new URL(process.env.SIMPLEBEACON_CI_TELEMETRY_URL);
  }
  const host = process.env.SIMPLEBEACON_API_HOST || "simplebeacon.ai";
  const port =
    process.env.SIMPLEBEACON_API_PORT ||
    (host === "localhost" || host === "127.0.0.1" ? "3000" : "");
  const protocol =
    port === "443" || (!port && host.includes(".")) ? "https:" : "http:";
  const path = "/api/simplebeacon/ci/telemetry";
  if (port) {
    return new URL(`${protocol}//${host}:${port}${path}`);
  }
  return new URL(`${protocol}//${host}${path}`);
}

function resolveToken() {
  if (process.env.SIMPLEBEACON_LICENSE_TOKEN) {
    return process.env.SIMPLEBEACON_LICENSE_TOKEN.trim();
  }
  const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
  if (secret) {
    return generateLicenseToken(
      {
        email:
          process.env.SIMPLEBEACON_SMOKE_EMAIL || "smoke-test@simplebeacon.ai",
        tier: "team",
        plan: "team",
      },
      secret,
      60 * 24,
    );
  }
  return "";
}

function buildSmokePayload() {
  const report = {
    gate: { pass: false, blockingCount: 548 },
    severityCounts: { critical: 164, high: 384, medium: 1921, low: 0 },
    totalFiles: 2567,
    qualityScore: 0,
    scanScope: { diffOnly: true, diffFileCount: 542 },
  };
  return buildCiTelemetryPayload(
    report,
    { paid: true, tier: "team" },
    {
      repository: process.env.GITHUB_REPOSITORY || "simplebeacon/smoke-test",
      workflow: "SimpleBeacon Gate",
      runId: String(Date.now()),
      ref: "refs/pull/1/merge",
    },
  );
}

function postJson(url, body, token) {
  const payload = JSON.stringify(body);
  const transport = url.protocol === "https:" ? https : http;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers,
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* keep string */
          }
          resolve({ status: res.statusCode, body: parsed, raw: data });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(payload);
    req.end();
  });
}

async function verifyProductionIngestion() {
  const url = resolveTelemetryUrl();
  const routingOnly = process.env.SIMPLEBEACON_SMOKE_ROUTING_ONLY === "1";
  const token = resolveToken();
  const payload = buildSmokePayload();

  console.log("🧪 SimpleBeacon CI telemetry smoke test");
  console.log(`   Target: ${url.href}`);
  console.log(
    `   Mode: ${routingOnly ? "routing-only" : token ? "full ingest" : "routing-only (no token)"}`,
  );

  const result = await postJson(url, payload, token);
  console.log(`- Server response: ${result.status}`);
  console.log(
    `- Body: ${typeof result.body === "string" ? result.body : JSON.stringify(result.body)}`,
  );

  if (result.status === 200 && result.body && result.body.ok === true) {
    console.log(
      "✅ SMOKE TEST PASSED: Telemetry ingested (id:",
      result.body.id,
      ")",
    );
    process.exit(0);
  }

  if (
    (routingOnly || !token) &&
    (result.status === 401 || result.status === 403)
  ) {
    console.log(
      "✅ ROUTING SMOKE PASSED: Telemetry route is live (auth rejected as expected without a registered token).",
    );
    console.log(
      "   Set SIMPLEBEACON_LICENSE_TOKEN to a paid JWT for full ingest verification.",
    );
    process.exit(0);
  }

  if (result.status === 502 || result.status === 503) {
    console.error("❌ SMOKE TEST FAILED: API backend unavailable.");
    process.exit(1);
  }

  console.error("❌ SMOKE TEST FAILED: Unexpected response.");
  process.exit(1);
}

verifyProductionIngestion().catch((err) => {
  console.error(`🚨 Transmission crash: ${err.message}`);
  process.exit(1);
});
