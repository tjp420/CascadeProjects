"use strict";

/**
 * SIEM Broker Prometheus Metrics Integration Tests
 *
 * Verifies that:
 *   1. hsm-metrics.cjs registers the SIEM counters with correct META
 *   2. updateSiemMetrics(broker) syncs broker counters into the registry
 *   3. renderPrometheus() emits the SIEM counters in valid exposition format
 *   4. The siem-alerts.rules.yml file is structurally valid with correct rules
 */

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");

const hsmMetrics = require(
  path.join(__dirname, "..", "hsm-adapter", "hsm-metrics.cjs"),
);
const SiemSecurityBroker = require(
  path.join(__dirname, "..", "siem", "siem-broker.cjs"),
);

const ALERTS_YML = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "monitoring",
  "siem-alerts.rules.yml",
);

describe("SIEM Broker Prometheus Metrics Integration", () => {
  // ── Counter registration ──────────────────────────────────────────

  describe("hsm-metrics.cjs SIEM counter registration", () => {
    it("registers all 5 SIEM counters", () => {
      assert.ok(
        hsmMetrics.counters.siem_events_processed_total !== undefined,
        "siem_events_processed_total registered",
      );
      assert.ok(
        hsmMetrics.counters.siem_events_dropped_total !== undefined,
        "siem_events_dropped_total registered",
      );
      assert.ok(
        hsmMetrics.counters.siem_events_bypassed_total !== undefined,
        "siem_events_bypassed_total registered",
      );
      assert.ok(
        hsmMetrics.counters.siem_tokens_consumed_total !== undefined,
        "siem_tokens_consumed_total registered",
      );
      assert.ok(
        hsmMetrics.counters.siem_token_bucket_current !== undefined,
        "siem_token_bucket_current registered",
      );
    });

    it("all SIEM counters initialize to zero", () => {
      hsmMetrics.reset();
      assert.strictEqual(hsmMetrics.counters.siem_events_processed_total, 0);
      assert.strictEqual(hsmMetrics.counters.siem_events_dropped_total, 0);
      assert.strictEqual(hsmMetrics.counters.siem_events_bypassed_total, 0);
      assert.strictEqual(hsmMetrics.counters.siem_tokens_consumed_total, 0);
      assert.strictEqual(hsmMetrics.counters.siem_token_bucket_current, 0);
    });

    it("META has help and type for all SIEM counters", () => {
      const rendered = hsmMetrics.renderPrometheus();
      assert.ok(
        rendered.includes("# HELP siem_events_processed_total"),
        "processed has HELP",
      );
      assert.ok(
        rendered.includes("# TYPE siem_events_processed_total counter"),
        "processed has TYPE",
      );
      assert.ok(
        rendered.includes("# HELP siem_events_dropped_total"),
        "dropped has HELP",
      );
      assert.ok(
        rendered.includes("# TYPE siem_events_dropped_total counter"),
        "dropped has TYPE",
      );
      assert.ok(
        rendered.includes("# HELP siem_events_bypassed_total"),
        "bypassed has HELP",
      );
      assert.ok(
        rendered.includes("# TYPE siem_events_bypassed_total counter"),
        "bypassed has TYPE",
      );
      assert.ok(
        rendered.includes("# HELP siem_tokens_consumed_total"),
        "tokens_consumed has HELP",
      );
      assert.ok(
        rendered.includes("# TYPE siem_tokens_consumed_total counter"),
        "tokens_consumed has TYPE",
      );
      assert.ok(
        rendered.includes("# HELP siem_token_bucket_current"),
        "bucket_current has HELP",
      );
      assert.ok(
        rendered.includes("# TYPE siem_token_bucket_current gauge"),
        "bucket_current is gauge type",
      );
    });
  });

  // ── updateSiemMetrics(broker) ─────────────────────────────────────

  describe("updateSiemMetrics(broker)", () => {
    let broker;

    beforeEach(() => {
      hsmMetrics.reset();
      broker = new SiemSecurityBroker({
        rateLimitMaxTokens: 10,
        rateLimitRefillRateMs: 100000,
        transportStrategy: "HYBRID",
      });
    });

    afterEach(() => {
      broker.close();
      hsmMetrics.reset();
    });

    it("syncs broker processed count into registry", () => {
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "test_sync_1" });
      broker.logEvent({ siemSeverity: "HIGH", siemCategory: "test_sync_2" });

      hsmMetrics.updateSiemMetrics(broker);
      assert.ok(
        hsmMetrics.counters.siem_events_processed_total >= 2,
        "processed should be >= 2",
      );
    });

    it("syncs broker dropped count into registry", () => {
      // Exhaust token bucket
      for (let i = 0; i < 10; i++) {
        broker.logEvent({ siemSeverity: "LOW", siemCategory: `exhaust_${i}` });
      }
      // 11th event should be dropped
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "dropped" });

      hsmMetrics.updateSiemMetrics(broker);
      assert.strictEqual(
        hsmMetrics.counters.siem_events_dropped_total,
        1,
        "1 event dropped",
      );
    });

    it("syncs broker bypassed count into registry", () => {
      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "bypass_test",
      });

      hsmMetrics.updateSiemMetrics(broker);
      assert.strictEqual(
        hsmMetrics.counters.siem_events_bypassed_total,
        1,
        "1 CRITICAL bypassed",
      );
    });

    it("syncs current token bucket capacity (gauge)", () => {
      // Consume 3 tokens
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "g1" });
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "g2" });
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "g3" });

      hsmMetrics.updateSiemMetrics(broker);
      assert.strictEqual(
        hsmMetrics.counters.siem_token_bucket_current,
        7,
        "7 tokens remaining",
      );
    });

    it("handles null broker gracefully", () => {
      // Should not throw
      hsmMetrics.updateSiemMetrics(null);
      assert.strictEqual(
        hsmMetrics.counters.siem_events_processed_total,
        0,
        "no change with null broker",
      );
    });

    it("handles broker without getMetrics gracefully", () => {
      const fakeBroker = { foo: "bar" };
      // Should not throw
      hsmMetrics.updateSiemMetrics(fakeBroker);
      assert.strictEqual(
        hsmMetrics.counters.siem_events_processed_total,
        0,
        "no change with fake broker",
      );
    });

    it("reflects updated values in renderPrometheus output", () => {
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "render_test" });
      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "render_critical",
      });

      hsmMetrics.updateSiemMetrics(broker);
      const rendered = hsmMetrics.renderPrometheus();

      assert.ok(
        rendered.match(/siem_events_processed_total\s+\d+/),
        "processed in Prometheus output",
      );
      assert.ok(
        rendered.match(/siem_events_bypassed_total\s+1/),
        "bypassed=1 in output",
      );
      assert.ok(
        rendered.match(/siem_token_bucket_current\s+\d+/),
        "bucket gauge in output",
      );
    });
  });

  // ── Alert rules YAML structural validation ────────────────────────

  describe("siem-alerts.rules.yml structural validity", () => {
    it("file exists at monitoring/siem-alerts.rules.yml", () => {
      assert.ok(
        fs.existsSync(ALERTS_YML),
        `Alert rules file should exist at ${ALERTS_YML}`,
      );
    });

    it("contains valid YAML with groups array", () => {
      const yaml = require("js-yaml");
      const content = fs.readFileSync(ALERTS_YML, "utf8");
      const doc = yaml.load(content);
      assert.ok(doc, "YAML should parse");
      assert.ok(Array.isArray(doc.groups), "groups should be array");
      assert.ok(doc.groups.length > 0, "at least 1 group");
    });

    it("has siem_broker_alerts group with correct interval", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      assert.ok(group, "siem_broker_alerts group exists");
      assert.strictEqual(group.interval, "15s", "interval is 15s");
      assert.ok(Array.isArray(group.rules), "rules is array");
      assert.ok(group.rules.length >= 5, "at least 5 rules");
    });

    it("all rules have required fields", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      for (const rule of group.rules) {
        assert.ok(rule.alert, "rule has alert name");
        assert.ok(rule.expr, "rule has expr");
        assert.ok(rule.for !== undefined, "rule has for");
        assert.ok(rule.labels, "rule has labels");
        assert.ok(rule.labels.severity, "rule has severity label");
        assert.ok(rule.labels.service, "rule has service label");
        assert.ok(rule.annotations, "rule has annotations");
        assert.ok(rule.annotations.summary, "rule has summary");
        assert.ok(rule.annotations.description, "rule has description");
        assert.ok(rule.annotations.runbook_url, "rule has runbook_url");
      }
    });

    it("SiemCriticalEventDetected rule is P1 with for: 0s", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      const rule = group.rules.find(
        (r) => r.alert === "SiemCriticalEventDetected",
      );
      assert.ok(rule, "SiemCriticalEventDetected exists");
      assert.strictEqual(
        rule.labels.severity,
        "critical",
        "severity is critical",
      );
      assert.strictEqual(rule.labels.priority, "P1", "priority is P1");
      assert.strictEqual(rule.for, "0s", "fires immediately");
      assert.ok(
        rule.expr.includes("siem_events_bypassed_total"),
        "references bypassed counter",
      );
    });

    it("SiemHighDropRate rule is P1 with 5m window", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      const rule = group.rules.find((r) => r.alert === "SiemHighDropRate");
      assert.ok(rule, "SiemHighDropRate exists");
      assert.strictEqual(
        rule.labels.severity,
        "critical",
        "severity is critical",
      );
      assert.strictEqual(rule.labels.priority, "P1", "priority is P1");
      assert.ok(
        rule.expr.includes("siem_events_dropped_total"),
        "references dropped counter",
      );
      assert.ok(rule.expr.includes("[5m]"), "uses 5m window");
    });

    it("SiemTokenBucketExhaustion rule references gauge", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      const rule = group.rules.find(
        (r) => r.alert === "SiemTokenBucketExhaustion",
      );
      assert.ok(rule, "SiemTokenBucketExhaustion exists");
      assert.ok(
        rule.expr.includes("siem_token_bucket_current"),
        "references token bucket gauge",
      );
      assert.strictEqual(
        rule.labels.severity,
        "warning",
        "severity is warning",
      );
    });

    it("SiemPipelineStall rule references processed counter", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      const rule = group.rules.find((r) => r.alert === "SiemPipelineStall");
      assert.ok(rule, "SiemPipelineStall exists");
      assert.ok(
        rule.expr.includes("siem_events_processed_total"),
        "references processed counter",
      );
      assert.ok(rule.expr.includes("[30m]"), "uses 30m window");
    });

    it("SiemHighDropRatio rule computes ratio", () => {
      const yaml = require("js-yaml");
      const doc = yaml.load(fs.readFileSync(ALERTS_YML, "utf8"));
      const group = doc.groups.find((g) => g.name === "siem_broker_alerts");
      const rule = group.rules.find((r) => r.alert === "SiemHighDropRatio");
      assert.ok(rule, "SiemHighDropRatio exists");
      assert.ok(
        rule.expr.includes("siem_events_dropped_total"),
        "references dropped counter",
      );
      assert.ok(
        rule.expr.includes("siem_events_processed_total"),
        "references processed counter",
      );
      assert.ok(rule.expr.includes("> 0.05"), "threshold is 5%");
    });
  });

  // ── End-to-end: broker → updateSiemMetrics → renderPrometheus ─────

  describe("end-to-end broker → metrics → Prometheus output", () => {
    let broker;

    beforeEach(() => {
      hsmMetrics.reset();
      broker = new SiemSecurityBroker({
        rateLimitMaxTokens: 100,
        rateLimitRefillRateMs: 100000,
        transportStrategy: "HYBRID",
      });
    });

    afterEach(() => {
      broker.close();
      hsmMetrics.reset();
    });

    it("full flow: broker events appear in Prometheus exposition format", () => {
      // Generate a mix of events
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "e2e_low" });
      broker.logEvent({ siemSeverity: "HIGH", siemCategory: "e2e_high" });
      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "e2e_critical",
      });

      // Sync to metrics registry
      hsmMetrics.updateSiemMetrics(broker);

      // Render and verify
      const output = hsmMetrics.renderPrometheus();
      const lines = output.split("\n");

      // Find the processed counter line
      const processedLine = lines.find(
        (l) =>
          l.startsWith("siem_events_processed_total ") && !l.startsWith("#"),
      );
      assert.ok(processedLine, "processed counter in output");
      const processedValue = parseInt(processedLine.split(" ")[1], 10);
      assert.ok(processedValue >= 3, "processed >= 3");

      // Find the bypassed counter line
      const bypassedLine = lines.find(
        (l) =>
          l.startsWith("siem_events_bypassed_total ") && !l.startsWith("#"),
      );
      assert.ok(bypassedLine, "bypassed counter in output");
      const bypassedValue = parseInt(bypassedLine.split(" ")[1], 10);
      assert.strictEqual(bypassedValue, 1, "bypassed = 1");

      // Find the gauge line
      const gaugeLine = lines.find(
        (l) => l.startsWith("siem_token_bucket_current ") && !l.startsWith("#"),
      );
      assert.ok(gaugeLine, "token bucket gauge in output");
    });
  });
});
