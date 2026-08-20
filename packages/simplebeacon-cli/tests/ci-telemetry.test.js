"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  buildCiTelemetryPayload,
  postTeamTelemetry,
  TELEMETRY_POST_TIMEOUT_MS,
  LEGACY_FIELDS_ENABLED,
} = require("../src/lib/ci-telemetry");
const { generateLicenseToken } = require("../src/lib/license-token");

const BIN = path.join(__dirname, "..", "bin", "simplebeacon.js");
const PAID_REPORT = {
  gate: { pass: true, blockingCount: 0 },
  severityCounts: {},
  qualityScore: 92,
};
const PAID_LICENSE = { paid: true, tier: "team" };

function withMockFetch(mockFn, fn) {
  if (typeof globalThis.fetch !== "function") {
    return fn();
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFn;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = originalFetch;
  });
}

function withEnv(vars, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe("ci-telemetry", () => {
  test("buildCiTelemetryPayload extracts team aggregation metadata", () => {
    const report = {
      projectRoot: "/home/acme/widget",
      gate: { pass: false, blockingCount: 2 },
      severityCounts: { critical: 1, high: 1, medium: 3, low: 2 },
      totalFiles: 12,
      qualityScore: 88,
      scanScope: {
        diffOnly: true,
        diffFileCount: 4,
        rulesEnabled: ["gate", "fiction"],
      },
      rawIssues: [
        { type: "Fiction KPI", severity: "high", count: 2 },
        { type: "EU AI Act Risk", severity: "medium", count: 1 },
      ],
    };
    const payload = buildCiTelemetryPayload(
      report,
      { paid: true, tier: "team" },
      {
        scanSource: "ci",
      },
    );
    assert.equal(payload.gate_pass, false);
    assert.equal(payload.gates_tripped, 1);
    assert.equal(payload.critical_blocked, 1);
    assert.equal(payload.high_blocked, 1);
    assert.equal(payload.diff_only, true);
    assert.equal(payload.diff_files, 4);
    assert.equal(payload.tier, "team");
    assert.equal(payload.event, "team_scan");
    assert.equal(payload.scan_source, "ci");
    assert.match(payload.workspace_fingerprint, /^[0-9a-f]{24}$/);
    assert.equal(payload.severity_rollup.critical, 1);
    assert.equal(payload.severity_rollup.low, 2);
    assert.ok(payload.category_rollup["ai-quality"] >= 2);
    assert.ok(payload.category_rollup.compliance >= 1);
    assert.match(payload.rules_fingerprint, /^[0-9a-f]{16}$/);
    assert.equal(payload.repository, undefined);
  });

  test("buildCiTelemetryPayload marks pass when gate clean", () => {
    const payload = buildCiTelemetryPayload(
      { gate: { pass: true, blockingCount: 0 }, severityCounts: {} },
      { tier: "developer" },
    );
    assert.equal(payload.gate_pass, true);
    assert.equal(payload.gates_tripped, 0);
    assert.equal(payload.event, "team_scan");
  });

  test("legacy CI fields are omitted unless env flag is set", () => {
    const report = {
      gate: { pass: true, blockingCount: 0 },
      severityCounts: {},
    };
    const payload = buildCiTelemetryPayload(
      report,
      { tier: "team" },
      {
        repository: "acme/widget",
        workflow: "SimpleBeacon Gate",
      },
    );
    if (LEGACY_FIELDS_ENABLED) {
      assert.equal(payload.repository, "acme/widget");
      assert.equal(payload.workflow, "SimpleBeacon Gate");
    } else {
      assert.equal(payload.repository, undefined);
      assert.equal(payload.workflow, undefined);
    }
  });

  test("postTeamTelemetry is an alias of postCiTelemetry", () => {
    assert.equal(typeof postTeamTelemetry, "function");
  });

  test("TELEMETRY_POST_TIMEOUT_MS defaults to 3000", () => {
    assert.equal(TELEMETRY_POST_TIMEOUT_MS, 3000);
  });

  test("postTeamTelemetry skips when air-gapped", async () => {
    await withMockFetch(
      () => {
        throw new Error("fetch should not run");
      },
      async () => {
        const result = await postTeamTelemetry(PAID_REPORT, PAID_LICENSE, {
          airGapped: true,
        });
        assert.equal(result.skipped, true);
        assert.equal(result.reason, "air_gapped");
      },
    );
  });

  test("postTeamTelemetry skips when offline", async () => {
    await withMockFetch(
      () => {
        throw new Error("fetch should not run");
      },
      async () => {
        const result = await postTeamTelemetry(PAID_REPORT, PAID_LICENSE, {
          offline: true,
        });
        assert.equal(result.skipped, true);
        assert.equal(result.reason, "offline");
      },
    );
  });

  test("postTeamTelemetry skips community tier", async () => {
    await withMockFetch(
      () => {
        throw new Error("fetch should not run");
      },
      async () => {
        const result = await postTeamTelemetry(PAID_REPORT, {
          paid: false,
          tier: "developer",
        });
        assert.equal(result.skipped, true);
        assert.equal(result.reason, "community_tier");
      },
    );
  });

  test("postTeamTelemetry skips when license token missing", async () => {
    await withEnv({ SIMPLEBEACON_LICENSE_TOKEN: undefined }, async () => {
      await withMockFetch(
        () => {
          throw new Error("fetch should not run");
        },
        async () => {
          const result = await postTeamTelemetry(PAID_REPORT, PAID_LICENSE);
          assert.equal(result.skipped, true);
          assert.equal(result.reason, "missing_token");
        },
      );
    });
  });

  test("postTeamTelemetry POSTs team_scan payload for paid tier", async () => {
    await withEnv({ SIMPLEBEACON_LICENSE_TOKEN: "test-token" }, async () => {
      await withMockFetch(
        async (url, opts) => {
          const body = JSON.parse(opts.body);
          assert.equal(body.event, "team_scan");
          assert.equal(body.scan_source, "ci");
          assert.equal(body.gate_pass, true);
          assert.equal(body.quality_score, 92);
          assert.equal(opts.headers.Authorization, "Bearer test-token");
          assert.match(String(url), /telemetry/);
          return { ok: true, json: async () => ({ accepted: true }) };
        },
        async () => {
          const result = await postTeamTelemetry(PAID_REPORT, PAID_LICENSE, {
            scanSource: "ci",
          });
          assert.equal(result.ok, true);
        },
      );
    });
  });

  test("postTeamTelemetry returns networkError without throwing", async () => {
    await withEnv({ SIMPLEBEACON_LICENSE_TOKEN: "test-token" }, async () => {
      await withMockFetch(
        async () => {
          throw new Error("ECONNREFUSED");
        },
        async () => {
          const result = await postTeamTelemetry(PAID_REPORT, PAID_LICENSE, {
            scanSource: "ci",
          });
          assert.equal(result.ok, false);
          assert.equal(result.networkError, true);
        },
      );
    });
  });

  test("postTeamTelemetry includes gate_pass false on failed gate", async () => {
    await withEnv({ SIMPLEBEACON_LICENSE_TOKEN: "test-token" }, async () => {
      await withMockFetch(
        async (_url, opts) => {
          const body = JSON.parse(opts.body);
          assert.equal(body.gate_pass, false);
          assert.equal(body.gates_tripped, 1);
          return { ok: true, json: async () => ({}) };
        },
        async () => {
          const report = {
            gate: { pass: false, blockingCount: 2 },
            severityCounts: { critical: 1, high: 1 },
          };
          await postTeamTelemetry(report, PAID_LICENSE, { scanSource: "ci" });
        },
      );
    });
  });
});

describe("ci-telemetry CLI hook", () => {
  test("air-gapped scan skips telemetry POST", async () => {
    if (typeof globalThis.fetch !== "function") return;

    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "sb-telemetry-"));
    const configPath = path.join(root, ".simplebeacon", "config.json");
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      `${JSON.stringify(
        {
          profile: "minimal",
          scanPaths: ["."],
          productionPaths: ["."],
          gate: { failOn: ["critical"] },
          rules: {
            credentials: { enabled: false },
            "production-leak": { enabled: false },
            "fiction-kpi-patterns": { enabled: false },
          },
        },
        null,
        2,
      )}\n`,
    );
    await fsp.writeFile(path.join(root, "sample.txt"), "hello\n");

    const secret = "telemetry-hook-test-secret";
    const token = generateLicenseToken(
      { email: "team@test.com", tier: "team" },
      secret,
      3600,
    );

    const result = spawnSync(
      process.execPath,
      [
        BIN,
        "scan",
        "--path",
        root,
        "--format",
        "json",
        "--air-gapped",
        "--no-trust-banner",
        "--quiet",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          NO_COLOR: "1",
          SIMPLEBEACON_LICENSE_SECRET: secret,
          SIMPLEBEACON_LICENSE_TOKEN: token,
          SIMPLEBEACON_CI_TELEMETRY_URL: "http://127.0.0.1:1/telemetry",
        },
      },
    );

    try {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.doesNotMatch(
        `${result.stdout}\n${result.stderr}`,
        /Team telemetry recorded/,
      );
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });

  test("unreachable telemetry endpoint does not fail scan exit code", async () => {
    if (typeof globalThis.fetch !== "function") return;

    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "sb-telemetry-"));
    const configPath = path.join(root, ".simplebeacon", "config.json");
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      `${JSON.stringify(
        {
          profile: "minimal",
          scanPaths: ["."],
          productionPaths: ["."],
          gate: { failOn: ["critical"] },
          rules: {
            credentials: { enabled: false },
            "production-leak": { enabled: false },
            "fiction-kpi-patterns": { enabled: false },
          },
        },
        null,
        2,
      )}\n`,
    );
    await fsp.writeFile(path.join(root, "sample.txt"), "hello\n");

    const secret = "telemetry-hook-unreachable-secret";
    const token = generateLicenseToken(
      { email: "team@test.com", tier: "team" },
      secret,
      3600,
    );

    const result = spawnSync(
      process.execPath,
      [
        BIN,
        "scan",
        "--path",
        root,
        "--format",
        "json",
        "--gate",
        "--no-trust-banner",
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 60000,
        env: {
          ...process.env,
          NO_COLOR: "1",
          SIMPLEBEACON_LICENSE_SECRET: secret,
          SIMPLEBEACON_LICENSE_TOKEN: token,
          SIMPLEBEACON_CI_TELEMETRY_URL: "http://127.0.0.1:1/telemetry",
          SIMPLEBEACON_CI_TELEMETRY_TIMEOUT_MS: "500",
        },
      },
    );

    try {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(
        `${result.stdout}\n${result.stderr}`,
        /Warning: Team telemetry endpoint unreachable/,
      );
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
