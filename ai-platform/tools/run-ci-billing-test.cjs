#!/usr/bin/env node
/**
 * Automated Billing & Webhook End-to-End Test Wrapper
 * Spawns a local server instance with test env vars, exercises webhook + upload,
 * then tears down the server. Designed for local use and CI (non-production).
 */

const { spawnSync, spawn, execFileSync } = require("child_process");
const http = require("http");
const path = require("path");

const ROOT = process.cwd(); // expected to be ai-platform when invoked via npm script
const TOOLS_DIR = path.join(ROOT, "tools");
const SERVER_ENTRY = path.join(ROOT, "server", "index.cjs");

const serverEnv = Object.assign({}, process.env, {
  PORT: process.env.PORT || "58000",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET:
    process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret_placeholder_54200",
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@simplebeacon.ai",
  ADMIN_THROTTLE_DISABLE_REDIS:
    process.env.ADMIN_THROTTLE_DISABLE_REDIS || "false",
  // Default test signing key for CI validation
  REPORT_SIGNING_KEY:
    process.env.REPORT_SIGNING_KEY || "test-signing-key-placeholder",
  REPORT_SIGNING_KEY_ID: process.env.REPORT_SIGNING_KEY_ID || "test-key-1",
  // License secret for dev mode license token generation
  SIMPLEBEACON_LICENSE_SECRET:
    process.env.SIMPLEBEACON_LICENSE_SECRET ||
    "test-license-secret-placeholder",
});

function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      const req = http.get(url, { timeout: 2000 }, (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          if (res.statusCode === 200) return resolve(true);
          if (Date.now() - start > timeoutMs)
            return reject(new Error("health timeout"));
          setTimeout(poll, 500);
        });
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs)
          return reject(new Error("health timeout"));
        setTimeout(poll, 500);
      });
      req.end();
    })();
  });
}

async function run() {
  const OVERALL_TIMEOUT_MS =
    parseInt(process.env.CI_BILLING_TIMEOUT || "120", 10) * 1000;
  console.log(
    `=== Starting CI Billing Pipeline Verification (timeout: ${OVERALL_TIMEOUT_MS / 1000}s) ===`,
  );

  console.log("Booting local test server instance...");
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    env: serverEnv,
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (b) =>
    process.stdout.write(`[server] ${b.toString()}`),
  );
  server.stderr.on("data", (b) =>
    process.stderr.write(`[server.err] ${b.toString()}`),
  );

  // Overall timeout — kill server and exit if test takes too long
  const timeoutHandle = setTimeout(() => {
    console.error(
      `\n❌ Billing test exceeded ${OVERALL_TIMEOUT_MS / 1000}s overall timeout — aborting.`,
    );
    try {
      server.kill("SIGKILL");
    } catch (e) {
      /* ignore */
    }
    process.exit(3);
  }, OVERALL_TIMEOUT_MS);

  const healthUrl = `http://127.0.0.1:${serverEnv.PORT}/api/health`;
  try {
    process.stdout.write("Waiting for server health...\n");
    await waitForHealth(healthUrl, 30000);
  } catch (err) {
    console.error("Server failed to become healthy:", err.message || err);
    server.kill();
    clearTimeout(timeoutHandle);
    process.exitCode = 2;
    return;
  }

  try {
    console.log("Injecting signed checkout.session.completed event...");
    execFileSync(
      process.execPath,
      [path.join(TOOLS_DIR, "send-custom-stripe-webhook.cjs")],
      { env: serverEnv, cwd: ROOT, stdio: "inherit" },
    );

    console.log("Uploading test report using server-issued token...");
    // upload-test-report.cjs expects LICENSE_TOKEN env var — fetch license token via HTTP and then call the uploader
    const licenseLookup = execFileSync(
      "curl",
      [
        "-sS",
        `http://127.0.0.1:${serverEnv.PORT}/api/simplebeacon/billing/license?email=test-customer@simplebeacon.ai`,
      ],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(licenseLookup);
    const licenseToken = parsed.licenseToken;
    if (!licenseToken) throw new Error("no license token returned from lookup");

    const uploadEnv = Object.assign({}, serverEnv, {
      LICENSE_TOKEN: licenseToken,
    });
    execFileSync(
      process.execPath,
      [path.join(TOOLS_DIR, "upload-test-report.cjs")],
      { env: uploadEnv, cwd: ROOT, stdio: "inherit" },
    );

    // Verify the generated delivery file signature
    console.log("Verifying generated report signature...");
    const statusUrl = `http://127.0.0.1:${serverEnv.PORT}/api/reports/status/${encodeURIComponent(licenseToken)}`;
    const getJson = (url) =>
      new Promise((resolve, reject) => {
        http
          .get(url, { timeout: 5000 }, (res) => {
            let d = "";
            res.on("data", (c) => (d += c.toString("utf8")));
            res.on("end", () => {
              try {
                resolve(JSON.parse(d));
              } catch (e) {
                reject(e);
              }
            });
          })
          .on("error", reject);
      });

    const statusResp = await getJson(statusUrl);
    const deliveryId =
      statusResp.lastDeliveryId || statusResp.lastDeliveryId || null;
    if (!deliveryId)
      throw new Error("no deliveryId found in /api/reports/status response");

    const { REPORT_STORE_DIR } = require(
      path.join(ROOT, "src", "api", "billing", "billing-utils.cjs"),
    );
    const reportPath = path.join(REPORT_STORE_DIR, `${deliveryId}.json`);

    // Wait for the file to appear (up to 15s)
    function waitForFile(fp, timeoutMs = 15000) {
      const start = Date.now();
      return new Promise((resolve, reject) => {
        (function poll() {
          try {
            const fs = require("fs");
            if (fs.existsSync(fp)) return resolve(true);
          } catch (e) {}
          if (Date.now() - start > timeoutMs)
            return reject(new Error("file wait timeout"));
          setTimeout(poll, 300);
        })();
      });
    }

    await waitForFile(reportPath, 15000);

    const fs = require("fs");
    const content = fs.readFileSync(reportPath, "utf8");
    const reportObj = JSON.parse(content);

    const signer = require(
      path.join(ROOT, "server", "lib", "report-signer.cjs"),
    );
    const signingKey = serverEnv.REPORT_SIGNING_KEY;
    if (!signingKey) throw new Error("REPORT_SIGNING_KEY not set in test env");

    const valid = signer.verifyReportSignature(reportObj, signingKey);
    if (!valid)
      throw new Error("Signature verification failed for generated report");
    console.log("Signature verification OK");

    // Tamper test: mutate a core field and expect verification to fail
    const tampered = JSON.parse(JSON.stringify(reportObj));
    if (typeof tampered.qualityScore === "number")
      tampered.qualityScore = tampered.qualityScore + 1;
    else tampered.qualityScore = 9999;
    const tamperedValid = signer.verifyReportSignature(tampered, signingKey);
    if (tamperedValid)
      throw new Error("Tamper test failed: modified report still verifies");
    console.log("Tamper test passed (modified report rejected)");

    console.log("\n✅ End-to-End Billing Verification Passed Successfully.");
  } catch (err) {
    console.error(
      "\n❌ Pipeline Test Failure encountered:",
      err.message || err,
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timeoutHandle);
    console.log("Tearing down background test server process...");
    try {
      server.kill("SIGKILL");
    } catch (e) {
      /* ignore */
    }
  }
}

run()
  .then(() => {
    // Force exit to prevent hanging if child processes or handles remain
    process.exit(process.exitCode || 0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
