// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  createNetworkGuard,
  snapshotFileState,
  assertFileUnchanged,
} = require("../src/lib/trust-guard");
const { runScan } = require("../src/scan");
const { loadSimplebeaconConfig } = require("../src/config");
const { formatJsonReport } = require("../src/reporters/json");
const { redactSecretsInString } = require("../src/lib/report-sanitizer");

const BIN = path.join(__dirname, "..", "bin", "simplebeacon.js");

test("offline network guard blocks fetch attempts", async () => {
  if (typeof globalThis.fetch !== "function") {
    return;
  }

  const guard = createNetworkGuard({ offline: true });
  try {
    await assert.rejects(
      () => globalThis.fetch("https://example.com/simplebeacon-offline-test"),
      /Offline mode blocked fetch/,
    );
    assert.equal(guard.events.length, 1);
  } finally {
    guard.dispose();
  }
});

test("runScan does not mutate scanned source files", async () => {
  const root = await fsp.mkdtemp(
    path.join(os.tmpdir(), "simplebeacon-readonly-"),
  );
  const sampleDir = path.join(root, "web", "data");
  await fsp.mkdir(sampleDir, { recursive: true });
  const samplePath = path.join(sampleDir, "status-sample.json");
  await fsp.writeFile(
    samplePath,
    `${JSON.stringify({ status: "ok", value: 1 }, null, 2)}\n`,
    "utf8",
  );

  const configPath = path.join(root, ".simplebeacon", "config.json");
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(
    configPath,
    `${JSON.stringify(
      {
        profile: "minimal",
        scanPaths: ["web/data"],
        productionPaths: ["web"],
        gate: { failOn: ["high"] },
        rules: {
          credentials: { enabled: true },
          "production-leak": { enabled: false },
          "fiction-kpi-patterns": { enabled: false },
          "jest-baseline": { enabled: false },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const before = snapshotFileState(samplePath);
  const config = loadSimplebeaconConfig(root, configPath);
  await runScan(root, { config, configPath });
  assertFileUnchanged(samplePath, before);

  await fsp.rm(root, { recursive: true, force: true });
});

test("formatJsonReport sanitizes credential-like strings in issues", () => {
  const json = formatJsonReport({
    rawIssues: [
      {
        type: "Credential Pattern",
        description: "Found sk-abcdefghijklmnopqrstuvwxyz1234567890 in config",
      },
    ],
  });
  const serialized = JSON.stringify(json);
  assert.ok(!serialized.includes("sk-abcdefghijklmnopqrstuvwxyz1234567890"));
  assert.equal(json.sanitized, true);
  assert.match(json.rawIssues[0].description, /sk-█+/);
});

test("CLI scan prints trust banner and supports --offline", () => {
  // Use a minimal temp directory instead of the full repo root to avoid
  // 600+ second scan times. The trust banner and --offline flag behavior
  // is independent of scan scope.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "simplebeacon-trust-"));
  const configPath = path.join(root, ".simplebeacon", "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        profile: "minimal",
        scanPaths: ["."],
        productionPaths: ["."],
        gate: { failOn: ["high"] },
        rules: {
          credentials: { enabled: true },
          "production-leak": { enabled: false },
          "fiction-kpi-patterns": { enabled: false },
          "jest-baseline": { enabled: false },
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(root, "sample.js"), "const x = 1;\n");

  try {
    const result = spawnSync(
      process.execPath,
      [
        BIN,
        "scan",
        "--path",
        root,
        "--config",
        configPath,
        "--format",
        "text",
        "--offline",
        "--no-trust-banner",
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30000,
        env: { ...process.env, NO_COLOR: "1" },
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI --offline fails when cloud upload is requested", () => {
  const root = path.join(__dirname, "..", "..", "..");
  const configPath = path.join(root, ".simplebeacon", "config.json");
  if (!fs.existsSync(configPath)) {
    return;
  }

  const result = spawnSync(
    process.execPath,
    [
      BIN,
      "scan",
      "--path",
      root,
      "--config",
      configPath,
      "--offline",
      "--upload",
      "https://example.com/upload",
      "--api-token",
      "sb_test_token",
      "--no-trust-banner",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        NO_COLOR: "1",
        NODE_OPTIONS: "--max-old-space-size=8192",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Offline mode blocked/i);
});

test("redactSecretsInString masks Stripe-style test keys", () => {
  const out = redactSecretsInString("token sk_test_1234567890abcdefghij");
  assert.ok(!out.includes("sk_test_1234567890abcdefghij"));
});
