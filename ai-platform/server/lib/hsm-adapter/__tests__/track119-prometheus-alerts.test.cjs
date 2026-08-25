"use strict";

/**
 * Track 119 Prometheus Alert Rule Compliance Tests
 *
 * Verifies that the track119_cross_cluster_migration_alerts rule group
 * in prometheus-mesh-alerts.yml is structurally valid, has correct PromQL
 * expressions, severity labels, and references counters that exist in
 * hsm-metrics.cjs. Also verifies that all 7 runbook .md files exist.
 *
 * Modeled on track118-prometheus-alerts.test.cjs.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ALERTS_YML = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "monitoring",
  "prometheus-mesh-alerts.yml",
);
const METRICS_CJS = path.join(__dirname, "..", "hsm-metrics.cjs");
const RUNBOOKS_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "runbooks",
);

function loadAlertDoc() {
  return yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
}

function findGroup(doc, name) {
  return doc.groups.find((g) => g.name === name);
}

const EXPECTED_ALERT_NAMES = [
  "Track119VerificationFailureSpike",
  "Track119RollbackStall",
  "Track119ConcurrentMigrationSaturation",
  "Track119CommitStall",
  "Track119AttestationGap",
  "Track119AckStarvation",
  "Track119RollbackRateHigh",
];

const ALL_TRACK119_COUNTERS = [
  "hsm_migration_initiated_total",
  "hsm_migration_attested_total",
  "hsm_migration_committed_total",
  "hsm_migration_rolled_back_total",
  "hsm_migration_ack_total",
  "hsm_migration_verification_failed_total",
  "hsm_migration_active",
];

const EXPECTED_RUNBOOKS = [
  "TRACK119_VERIFICATION_FAILURE_SPIKE.md",
  "TRACK119_ROLLBACK_STALL.md",
  "TRACK119_CONCURRENT_MIGRATION_SATURATION.md",
  "TRACK119_COMMIT_STALL.md",
  "TRACK119_ATTESTATION_GAP.md",
  "TRACK119_ACK_STARVATION.md",
  "TRACK119_ROLLBACK_RATE_HIGH.md",
];

describe("Track 119 Prometheus alert rule compliance", () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, "track119_cross_cluster_migration_alerts");
  });

  // ── L2-01: YAML group exists with 7 rules ───────────────────────────
  test("ALERT-119-L2-01: YAML structural validity — track119 group exists with 7 rules", () => {
    expect(doc).toHaveProperty("groups");
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty(
      "name",
      "track119_cross_cluster_migration_alerts",
    );
    expect(group).toHaveProperty("interval", "15s");
    expect(Array.isArray(group.rules)).toBe(true);
    expect(group.rules.length).toBe(7);
    for (const r of group.rules) {
      expect(r).toHaveProperty("alert");
      expect(r).toHaveProperty("expr");
      expect(r).toHaveProperty("for");
      expect(r).toHaveProperty("labels.severity");
      expect(r).toHaveProperty("annotations.summary");
      expect(r).toHaveProperty("annotations.description");
      expect(r).toHaveProperty("annotations.runbook_url");
    }
  });

  // ── L2-02: All 7 rules have required fields ─────────────────────────
  test("ALERT-119-L2-02: all 7 rules have required fields and expected alert names", () => {
    const alertNames = group.rules.map((r) => r.alert);
    expect(alertNames.sort()).toEqual([...EXPECTED_ALERT_NAMES].sort());
    for (const r of group.rules) {
      expect(typeof r.expr).toBe("string");
      expect(r.expr.length).toBeGreaterThan(0);
      expect(r.for).toMatch(/^\d+m$/);
      expect(["critical", "warning"]).toContain(r.labels.severity);
    }
  });

  // ── L2-03: Track119VerificationFailureSpike ─────────────────────────
  test("ALERT-119-L2-03: Track119VerificationFailureSpike — correct structure", () => {
    const rule = group.rules.find(
      (r) => r.alert === "Track119VerificationFailureSpike",
    );
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("critical");
    expect(rule.for).toBe("1m");
    expect(rule.expr).toContain("hsm_migration_verification_failed_total");
    expect(rule.expr).toMatch(
      /rate\(\s*hsm_migration_verification_failed_total\[5m\]\s*\)/,
    );
    expect(rule.expr).toContain("> 2");
  });

  // ── L2-04: Track119RollbackStall ────────────────────────────────────
  test("ALERT-119-L2-04: Track119RollbackStall — correct structure", () => {
    const rule = group.rules.find((r) => r.alert === "Track119RollbackStall");
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("critical");
    expect(rule.for).toBe("5m");
    expect(rule.expr).toContain("hsm_migration_verification_failed_total[10m]");
    expect(rule.expr).toContain("hsm_migration_rolled_back_total[10m]");
    expect(rule.expr).toContain("== 0");
  });

  // ── L2-05: Track119ConcurrentMigrationSaturation ────────────────────
  test("ALERT-119-L2-05: Track119ConcurrentMigrationSaturation — correct structure", () => {
    const rule = group.rules.find(
      (r) => r.alert === "Track119ConcurrentMigrationSaturation",
    );
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("warning");
    expect(rule.for).toBe("3m");
    expect(rule.expr).toContain("hsm_migration_active");
    expect(rule.expr).toContain("> 14");
  });

  // ── L2-06: Track119CommitStall ──────────────────────────────────────
  test("ALERT-119-L2-06: Track119CommitStall — correct structure", () => {
    const rule = group.rules.find((r) => r.alert === "Track119CommitStall");
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("critical");
    expect(rule.for).toBe("5m");
    expect(rule.expr).toContain("hsm_migration_initiated_total[10m]");
    expect(rule.expr).toContain("hsm_migration_committed_total[10m]");
    expect(rule.expr).toContain("== 0");
  });

  // ── L2-07: Track119AttestationGap ───────────────────────────────────
  test("ALERT-119-L2-07: Track119AttestationGap — correct structure", () => {
    const rule = group.rules.find((r) => r.alert === "Track119AttestationGap");
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("warning");
    expect(rule.for).toBe("3m");
    expect(rule.expr).toContain("hsm_migration_initiated_total[5m]");
    expect(rule.expr).toContain("hsm_migration_attested_total[5m]");
    expect(rule.expr).toContain("== 0");
  });

  // ── L2-08: Track119AckStarvation ────────────────────────────────────
  test("ALERT-119-L2-08: Track119AckStarvation — correct structure", () => {
    const rule = group.rules.find((r) => r.alert === "Track119AckStarvation");
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("warning");
    expect(rule.for).toBe("5m");
    expect(rule.expr).toContain("hsm_migration_committed_total[10m]");
    expect(rule.expr).toContain("hsm_migration_ack_total[10m]");
    expect(rule.expr).toContain("== 0");
  });

  // ── L2-09: Track119RollbackRateHigh — division safety ───────────────
  test("ALERT-119-L2-09: Track119RollbackRateHigh — correct structure with + 1 denominator offset", () => {
    const rule = group.rules.find(
      (r) => r.alert === "Track119RollbackRateHigh",
    );
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("warning");
    expect(rule.for).toBe("2m");
    expect(rule.expr).toContain("hsm_migration_rolled_back_total");
    expect(rule.expr).toContain("hsm_migration_committed_total");
    // Division-safety: the + 1 denominator offset must be present
    expect(rule.expr).toContain("+ 1");
    expect(rule.expr).toContain("> 0.3");
    // Verify the denominator includes both counters plus the offset
    expect(rule.expr).toMatch(/hsm_migration_committed_total\[5m\]/);
    expect(rule.expr).toMatch(/hsm_migration_rolled_back_total\[5m\]/);
  });

  // ── L2-10: All rules have correct labels ────────────────────────────
  test("ALERT-119-L2-10: all rules have correct labels (track, component, tier, service)", () => {
    for (const r of group.rules) {
      expect(r.labels.track).toBe("119");
      expect(r.labels.component).toBe("hsm-mesh-vault");
      expect(r.labels.tier).toBe("post-quantum-crypto");
      expect(r.labels.service).toBe("hsm-vault-cross-cluster-migration");
    }
  });

  // ── L3-01: All 7 Track 119 counters referenced across 7 rules ───────
  test("ALERT-119-L3-01: all 7 Track 119 counters are referenced across the 7 rules", () => {
    const allExprText = group.rules.map((r) => r.expr).join("\n");
    for (const counter of ALL_TRACK119_COUNTERS) {
      expect(allExprText).toContain(counter);
    }
  });

  // ── L3-02: All runbook URLs point to internal repo ──────────────────
  test("ALERT-119-L3-02: all runbook URLs point to internal repo and match TRACK119_ pattern", () => {
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toContain(
        "github.com/tjp420/CascadeProjects",
      );
      expect(r.annotations.runbook_url).toMatch(/TRACK119_/);
      expect(r.annotations.runbook_url).toMatch(/\.md$/);
    }
  });

  // ── L3-03: No secrets in alert YAML ─────────────────────────────────
  test("ALERT-119-L3-03: no secrets in Track 119 alert YAML section", () => {
    const yamlText = fs.readFileSync(ALERTS_YML, "utf8");
    const track119Start = yamlText.indexOf(
      "track119_cross_cluster_migration_alerts",
    );
    // Bound the slice to just the Track 119 section (stop at the next group or end of file)
    const nextGroupIdx = yamlText.indexOf(
      "\n  - name: track",
      track119Start + 1,
    );
    const track119Section =
      nextGroupIdx > 0
        ? yamlText.slice(track119Start, nextGroupIdx)
        : yamlText.slice(track119Start);
    const secretPatterns = [
      /password\s*[:=]/i,
      /api[_-]?key\s*[:=]/i,
      /private[_-]?key\s*[:=]/i,
      /[0-9a-f]{64}/i,
    ];
    for (const p of secretPatterns) {
      expect(track119Section).not.toMatch(p);
    }
  });

  // ── L3-04: All referenced counters exist in hsm-metrics.cjs ─────────
  test("ALERT-119-L3-04: all referenced counters exist in hsm-metrics.cjs", () => {
    const metricsContent = fs.readFileSync(METRICS_CJS, "utf8");
    for (const counter of ALL_TRACK119_COUNTERS) {
      expect(metricsContent).toContain(counter);
    }
  });

  // ── L3-05: All 7 runbook .md files exist ────────────────────────────
  test("ALERT-119-L3-05: all 7 runbook .md files exist in docs/runbooks/", () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookPath = path.join(RUNBOOKS_DIR, filename);
      expect(fs.existsSync(runbookPath)).toBe(true);
    }
  });

  // ── L3-06: Existing Track 117/118 alert groups unchanged ────────────
  test("ALERT-119-L3-06: existing Track 117/118 alert groups unchanged", () => {
    const track117Group = findGroup(doc, "track117_bft_shard_sync_alerts");
    const track118Group = findGroup(
      doc,
      "track118_distributed_consensus_coordinator_alerts",
    );
    expect(track117Group).toBeDefined();
    expect(track117Group.rules.length).toBe(2);
    expect(track118Group).toBeDefined();
    expect(track118Group.rules.length).toBe(7);
  });

  // ── S-01: No credentials / PII in alert rules or runbooks ───────────
  test("ALERT-119-S-01: no credentials or PII in alert rules or runbook files", () => {
    const yamlText = fs.readFileSync(ALERTS_YML, "utf8");
    const track119Start = yamlText.indexOf(
      "track119_cross_cluster_migration_alerts",
    );
    // Bound the slice to just the Track 119 section (stop at the next group or end of file)
    const nextGroupIdx = yamlText.indexOf(
      "\n  - name: track",
      track119Start + 1,
    );
    const track119Section =
      nextGroupIdx > 0
        ? yamlText.slice(track119Start, nextGroupIdx)
        : yamlText.slice(track119Start);
    // Check for actual secret patterns, not the word "credential" in descriptions
    expect(track119Section).not.toMatch(/password\s*[:=]\s*["']?[^\s"']+/i);
    expect(track119Section).not.toMatch(/api[_-]?key\s*[:=]\s*["']?[^\s"']+/i);
    expect(track119Section).not.toMatch(/secret\s*[:=]\s*["']?[^\s"']+/i);
    expect(track119Section).not.toMatch(/[0-9a-f]{64}/i);
    expect(track119Section).not.toContain("userEmail");
    // Check runbooks for actual secret patterns
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookContent = fs.readFileSync(
        path.join(RUNBOOKS_DIR, filename),
        "utf8",
      );
      expect(runbookContent).not.toMatch(/password\s*[:=]\s*["']?[^\s"']+/i);
      expect(runbookContent).not.toMatch(/api[_-]?key\s*[:=]\s*["']?[^\s"']+/i);
      expect(runbookContent).not.toMatch(/secret\s*[:=]\s*["']?[^\s"']+/i);
      expect(runbookContent).not.toMatch(/[0-9a-f]{64}/i);
    }
  });

  // ── S-02: Runbook URLs use HTTPS and point to internal repo only ────
  test("ALERT-119-S-02: runbook URLs use HTTPS and point to internal repo only", () => {
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toMatch(/^https:\/\//);
      expect(r.annotations.runbook_url).toContain(
        "github.com/tjp420/CascadeProjects",
      );
      expect(r.annotations.runbook_url).not.toContain("http://");
    }
  });

  // ── S-03: No real node identifiers, tenant IDs, or key material ─────
  test("ALERT-119-S-03: no real node identifiers, tenant IDs, or key material in runbook examples", () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookContent = fs.readFileSync(
        path.join(RUNBOOKS_DIR, filename),
        "utf8",
      );
      // Runbooks should use placeholder examples, not real identifiers
      expect(runbookContent).not.toMatch(/tenant-[a-f0-9]{8,}/i);
      expect(runbookContent).not.toMatch(/node-[a-f0-9]{16,}/i);
      expect(runbookContent).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    }
  });
});
