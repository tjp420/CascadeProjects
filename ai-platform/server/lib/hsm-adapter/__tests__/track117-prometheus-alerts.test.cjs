"use strict";

/**
 * Track 117 Prometheus Alert Rule Compliance Tests
 *
 * Verifies that the track117_bft_shard_sync_alerts rule group
 * in prometheus-mesh-alerts.yml is structurally valid, has correct PromQL
 * expressions, severity labels, and references counters that exist in
 * hsm-metrics.cjs.
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

function loadAlertDoc() {
  return yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
}

function findGroup(doc, name) {
  return doc.groups.find((g) => g.name === name);
}

describe("Track 117 Prometheus alert rule compliance", () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, "track117_bft_shard_sync_alerts");
  });

  test("ALERT-117-01: YAML structural validity — track117 group exists with 2 rules", () => {
    expect(doc).toHaveProperty("groups");
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty("name", "track117_bft_shard_sync_alerts");
    expect(group).toHaveProperty("interval", "15s");
    expect(Array.isArray(group.rules)).toBe(true);
    expect(group.rules.length).toBe(2);
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

  test("ALERT-117-02: Track117ByzantineShardDivergenceDetected — correct name, PromQL, severity, for window", () => {
    const rule = group.rules.find(
      (r) => r.alert === "Track117ByzantineShardDivergenceDetected",
    );
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("critical");
    expect(rule.for).toBe("0m");
    // PromQL must reference the byzantine detected counter
    expect(rule.expr).toContain("hsm_shard_byzantine_detected_total");
    expect(rule.expr).toContain("> 0");
    expect(rule.expr).toMatch(
      /rate\(\s*hsm_shard_byzantine_detected_total\[5m\]\s*\)/,
    );
    // Labels
    expect(rule.labels.track).toBe("117");
    expect(rule.labels.component).toBe("hsm-mesh-vault");
    expect(rule.labels.tier).toBe("post-quantum-crypto");
    expect(rule.labels.service).toBe("hsm-vault-bft-shard-sync");
  });

  test("ALERT-117-03: Track117ShardSyncLaggingNodesSpike — correct name, PromQL, severity, for window", () => {
    const rule = group.rules.find(
      (r) => r.alert === "Track117ShardSyncLaggingNodesSpike",
    );
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe("warning");
    expect(rule.for).toBe("5m");
    // PromQL must reference the lagging nodes gauge
    expect(rule.expr).toContain("hsm_shard_lagging_nodes");
    expect(rule.expr).toContain("> 4");
    // Labels
    expect(rule.labels.track).toBe("117");
    expect(rule.labels.component).toBe("hsm-mesh-vault");
    expect(rule.labels.tier).toBe("post-quantum-crypto");
    expect(rule.labels.service).toBe("hsm-vault-bft-shard-sync");
  });

  test("ALERT-117-04: runbook URLs, no secrets, and shard counters exist in hsm-metrics.cjs", () => {
    // All runbook URLs point to internal repo
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toContain(
        "github.com/tjp420/CascadeProjects",
      );
      expect(r.annotations.runbook_url).toMatch(/TRACK117_/);
    }

    // No secrets or key material in alert YAML text
    const yamlText = fs.readFileSync(ALERTS_YML, "utf8");
    const track117Section = yamlText.slice(
      yamlText.indexOf("track117_bft_shard_sync_alerts"),
    );
    const secretPatterns = [
      /password\s*[:=]/i,
      /api[_-]?key\s*[:=]/i,
      /private[_-]?key\s*[:=]/i,
      /[0-9a-f]{64}/i,
    ];
    for (const p of secretPatterns) {
      expect(track117Section).not.toMatch(p);
    }

    // Shard counters referenced in alerts must exist in hsm-metrics.cjs
    const metricsContent = fs.readFileSync(METRICS_CJS, "utf8");
    const requiredCounters = [
      "hsm_shard_byzantine_detected_total",
      "hsm_shard_lagging_nodes",
      "hsm_shard_limit_exceeded_total",
    ];
    for (const c of requiredCounters) {
      expect(metricsContent).toContain(c);
    }
  });
});
