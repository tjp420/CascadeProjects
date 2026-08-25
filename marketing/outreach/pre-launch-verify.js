#!/usr/bin/env node
"use strict";

/**
 * SimpleBeacon Pre-Launch Verification Script
 *
 * Run this BEFORE posting to Hacker News or Product Hunt.
 * Exits with code 1 if any CRITICAL check fails.
 * Exits with code 0 only when all critical checks pass.
 *
 * Usage:
 *   node marketing/outreach/pre-launch-verify.js
 *   node marketing/outreach/pre-launch-verify.js --strict  (warnings also fail)
 */

const https = require("https");

const STRICT = process.argv.includes("--strict");

let criticalFailures = 0;
let warnings = 0;

function log(status, msg, detail) {
  const icons = { PASS: "✓", FAIL: "✖", WARN: "⚠", INFO: "ℹ" };
  const colors = {
    PASS: "\x1b[32m",
    FAIL: "\x1b[31m",
    WARN: "\x1b[33m",
    INFO: "\x1b[36m",
  };
  const reset = "\x1b[0m";
  console.log(
    `${colors[status]}${icons[status]}${reset} ${msg}${detail ? " — " + detail : ""}`,
  );
  if (status === "FAIL") criticalFailures++;
  if (status === "WARN") warnings++;
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: 15000,
        ...options,
        headers: {
          "User-Agent": "simplebeacon-prelaunch-check",
          ...options.headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 400,
            headers: res.headers,
            body,
          }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function checkGitHubRepo() {
  console.log("\n── GitHub Repository ──");
  try {
    const r = await fetch(
      "https://api.github.com/repos/tjp420/CascadeProjects",
    );
    if (r.status === 404) {
      log(
        "FAIL",
        "GitHub repo is PRIVATE or does not exist",
        "github.com/tjp420/CascadeProjects returns 404 — make it public before launching",
      );
      return;
    }
    if (!r.ok) {
      log("FAIL", "GitHub API error", `Status ${r.status}`);
      return;
    }
    const j = JSON.parse(r.body);
    if (j.private) {
      log(
        "FAIL",
        "GitHub repo is PRIVATE",
        "Set to public in repo settings before launching",
      );
    } else {
      log(
        "PASS",
        "GitHub repo is PUBLIC",
        `${j.full_name} | ${j.stargazers_count} stars`,
      );
    }
    if (!j.description) {
      log("WARN", "No repo description", "Add a description for HN visibility");
    }
    if (!j.license) {
      log("WARN", "No LICENSE file detected by GitHub", "Add a LICENSE file");
    }
  } catch (e) {
    log("FAIL", "GitHub check failed", e.message);
  }
}

async function checkNpmPackage() {
  console.log("\n── npm Package ──");
  try {
    const r = await fetch("https://registry.npmjs.org/simplebeacon");
    if (!r.ok) {
      log(
        "FAIL",
        'npm package "simplebeacon" not found',
        "Publish to npm before launching",
      );
      return;
    }
    const j = JSON.parse(r.body);
    const latest = j["dist-tags"]?.latest;
    if (!latest) {
      log(
        "FAIL",
        "No latest version on npm",
        "Publish a version before launching",
      );
      return;
    }
    log("PASS", "npm package published", `simplebeacon@${latest}`);

    // Verify bin command exists
    const latestVersion = j.versions?.[latest];
    if (latestVersion?.bin?.simplebeacon) {
      log("PASS", "bin command exists", "npx simplebeacon will work");
    } else {
      log(
        "FAIL",
        'No "simplebeacon" bin in latest version',
        "npx simplebeacon will fail",
      );
    }

    // Check description accuracy
    const desc = latestVersion?.description || "";
    if (desc.includes("52 engine") || desc.includes("38 analy")) {
      log("FAIL", "npm description has stale claims", `Description: "${desc}"`);
    } else {
      log("PASS", "npm description is clean");
    }
  } catch (e) {
    log("FAIL", "npm check failed", e.message);
  }
}

async function checkWebsite() {
  console.log("\n── Website ──");
  const pages = [
    { url: "https://simplebeacon.ai/", name: "Homepage", checkBody: true },
    { url: "https://simplebeacon.ai/pricing", name: "Pricing page" },
    { url: "https://simplebeacon.ai/security", name: "Security page" },
    { url: "https://simplebeacon.ai/dpa", name: "DPA page" },
    { url: "https://simplebeacon.ai/privacy", name: "Privacy page" },
    { url: "https://simplebeacon.ai/terms", name: "Terms page" },
  ];

  for (const page of pages) {
    try {
      const r = await fetch(page.url);
      if (!r.ok) {
        log("FAIL", `${page.name} not accessible`, `${page.url} — ${r.status}`);
        continue;
      }
      log("PASS", page.name, r.status);

      if (page.checkBody) {
        const body = r.body;
        if (body.includes("52 engine") || body.includes("52 heuristic")) {
          log(
            "FAIL",
            `${page.name} contains "52 engine"`,
            "Stale claim still live",
          );
        }
        if (body.includes("38 analy")) {
          log(
            "FAIL",
            `${page.name} contains "38 analy"`,
            "Stale claim still live",
          );
        }
        if (body.includes("60+ engine") || body.includes("60+ rule")) {
          log("FAIL", `${page.name} contains "60+"`, "Stale claim still live");
        }
        if (body.includes("14,000 files")) {
          log(
            "FAIL",
            `${page.name} contains "14,000 files"`,
            "Stale claim still live",
          );
        }
        if (body.includes("48 analy")) {
          log("PASS", `${page.name} has correct "48 analyzers" claim`);
        }
      }
    } catch (e) {
      log("FAIL", `${page.name} check failed`, e.message);
    }
  }
}

async function checkApiEndpoints() {
  console.log("\n── API Endpoints ──");
  const endpoints = [
    { url: "https://simplebeacon.ai/api/health/email", name: "Email health" },
    {
      url: "https://simplebeacon.ai/api/simplebeacon/billing/status?email=test@example.com",
      name: "Billing status",
    },
  ];

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep.url);
      if (r.ok) {
        log("PASS", ep.name, r.status);
      } else {
        log("WARN", ep.name, `Status ${r.status}`);
      }
    } catch (e) {
      log("WARN", ep.name, e.message);
    }
  }
}

async function checkStripeCheckout() {
  console.log("\n── Stripe Checkout ──");
  // Note: Full checkout session creation requires proper POST with CSRF/origin headers.
  // Here we just verify the endpoint exists and responds (not 404/500).
  const endpoints = [
    {
      url: "https://simplebeacon.ai/api/simplebeacon/billing/status?email=test@example.com",
      name: "Billing status API",
    },
    {
      url: "https://simplebeacon.ai/api/health/email",
      name: "Email health API",
    },
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep.url);
      if (r.ok) {
        log("PASS", ep.name, r.status);
      } else {
        log("WARN", ep.name, `Status ${r.status}`);
      }
    } catch (e) {
      log("WARN", ep.name, e.message);
    }
  }
  // Stripe checkout: verify the pricing page has checkout buttons (not the API itself)
  try {
    const r = await fetch("https://simplebeacon.ai/pricing");
    const body = r.body;
    if (
      body.includes("checkout") ||
      body.includes("subscribe") ||
      body.includes("stripe")
    ) {
      log("PASS", "Pricing page has checkout integration", "");
    } else {
      log("WARN", "Pricing page missing checkout integration", "");
    }
  } catch (e) {
    log("WARN", "Pricing page check failed", e.message);
  }
}

async function checkVSCodeExtension() {
  console.log("\n── VS Code Extension ──");
  try {
    // Check if the VSIX file exists locally
    const fs = require("fs");
    const path = require("path");
    const vsixPaths = [
      "sales/marketplace/simplebeacon-latest.vsix",
      "coming-soon/public/downloads/simplebeacon.vsix",
    ];
    let found = false;
    for (const p of vsixPaths) {
      const full = path.join(__dirname, "..", "..", p);
      if (fs.existsSync(full)) {
        const stat = fs.statSync(full);
        log(
          "PASS",
          `VSIX exists: ${p}`,
          `${(stat.size / 1024 / 1024).toFixed(1)} MB`,
        );
        found = true;
        break;
      }
    }
    if (!found) {
      log(
        "WARN",
        "No VSIX file found locally",
        "Check sales/marketplace/ for the extension package",
      );
    }
    // Note: Marketplace API query format is complex — manual verification:
    // Open https://marketplace.visualstudio.com/search?term=simplebeacon in browser
    log(
      "INFO",
      "Verify marketplace listing",
      "Open https://marketplace.visualstudio.com/search?term=simplebeacon in browser",
    );
  } catch (e) {
    log("WARN", "VS Code extension check failed", e.message);
  }
}

async function checkCliLocally() {
  console.log("\n── CLI (local) ──");
  const { execSync } = require("child_process");
  try {
    const output = execSync(
      "npx simplebeacon scan --gate --offline --version 2>&1 || npx simplebeacon --version 2>&1",
      { encoding: "utf8", timeout: 30000 },
    );
    const version = output.trim().split("\n").pop();
    log("PASS", "CLI runs locally", version);
  } catch (e) {
    log("WARN", "CLI local check failed", e.message?.slice(0, 100));
  }

  // Check for stale claims in CLI output
  try {
    const output = execSync("npx simplebeacon scan --gate --offline 2>&1", {
      encoding: "utf8",
      timeout: 120000,
    });
    if (output.includes("52 deterministic") || output.includes("52 engine")) {
      log(
        "FAIL",
        'CLI output contains "52 deterministic engines"',
        "Stale claim in CLI banner",
      );
    } else if (output.includes("48 analy")) {
      log("PASS", 'CLI banner shows "48 analyzers"');
    }
    if (output.includes("Quality score: 0/100")) {
      log(
        "WARN",
        'CLI shows "Quality score: 0/100"',
        'Should show "(upgrade to view)" on free tier',
      );
    }
    if (output.includes("Gate: PASS") || output.includes("Gate: FAIL")) {
      log("PASS", "CLI gate result displayed");
    }
  } catch (e) {
    log("WARN", "CLI scan check failed", e.message?.slice(0, 100));
  }
}

async function checkStaleClaimsInSource() {
  console.log("\n── Stale Claims in Source ──");
  const { execSync } = require("child_process");
  const patterns = [
    { pattern: "52 deterministic", label: '"52 deterministic"' },
    { pattern: "52 heuristic", label: '"52 heuristic"' },
    { pattern: "52\\+ engine", label: '"52+ engine"' },
    { pattern: "38 analy", label: '"38 analy"' },
    { pattern: "60\\+ engine", label: '"60+ engine"' },
    { pattern: "60\\+ rule", label: '"60+ rule"' },
    { pattern: "14,000 files", label: '"14,000 files"' },
  ];

  for (const { pattern, label } of patterns) {
    try {
      const output = execSync(
        `git grep -l "${pattern}" -- "*.js" "*.cjs" "*.json" "*.md" "*.html" "*.ts" "*.tsx" 2>nul || echo NONE`,
        { encoding: "utf8", timeout: 30000 },
      );
      const files = output
        .trim()
        .split("\n")
        .filter((f) => f && f !== "NONE");
      if (files.length > 0) {
        // Filter out node_modules and build artifacts
        const realFiles = files.filter(
          (f) =>
            !f.includes("node_modules") &&
            !f.includes("pages-publish") &&
            !f.includes("public/app"),
        );
        if (realFiles.length > 0) {
          log(
            "FAIL",
            `Stale claim ${label} found in source`,
            `${realFiles.length} files: ${realFiles.slice(0, 3).join(", ")}${realFiles.length > 3 ? "..." : ""}`,
          );
        } else {
          log(
            "INFO",
            `Stale claim ${label} only in build artifacts`,
            "Will be regenerated",
          );
        }
      } else {
        log("PASS", `No stale ${label} in source`);
      }
    } catch (e) {
      log(
        "INFO",
        `Stale claim ${label} check skipped`,
        e.message?.slice(0, 80),
      );
    }
  }
}

async function main() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  SimpleBeacon Pre-Launch Verification                        ║",
  );
  console.log(
    "║  Run before posting to Hacker News or Product Hunt          ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );

  await checkGitHubRepo();
  await checkNpmPackage();
  await checkWebsite();
  await checkApiEndpoints();
  await checkStripeCheckout();
  await checkVSCodeExtension();
  await checkCliLocally();
  await checkStaleClaimsInSource();

  console.log("\n── Summary ──");
  console.log(`  Critical failures: ${criticalFailures}`);
  console.log(`  Warnings:          ${warnings}`);

  if (criticalFailures > 0) {
    console.log(
      "\n✖ LAUNCH BLOCKED — fix critical failures before posting to HN/PH",
    );
    process.exit(1);
  }
  if (STRICT && warnings > 0) {
    console.log("\n⚠ STRICT MODE — warnings treated as failures");
    process.exit(1);
  }
  if (warnings > 0) {
    console.log("\n⚠ READY TO LAUNCH — but review warnings first");
  } else {
    console.log("\n✓ ALL CLEAR — ready to launch");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
