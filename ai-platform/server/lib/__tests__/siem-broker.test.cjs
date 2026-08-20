"use strict";

const assert = require("node:assert");
const { describe, it, beforeEach, afterEach } = require("node:test");
const path = require("path");

const BROKER_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "siem",
  "siem-broker.cjs",
);
const SiemSecurityBroker = require(BROKER_PATH);

describe("SiemSecurityBroker (unit)", () => {
  let broker;

  beforeEach(() => {
    broker = new SiemSecurityBroker({
      rateLimitMaxTokens: 5,
      rateLimitRefillRateMs: 10000,
      transportStrategy: "HYBRID",
    });
  });

  afterEach(() => {
    broker.close();
  });

  describe("logEvent", () => {
    it("accepts a valid event and returns true", () => {
      const result = broker.logEvent({
        siemSeverity: "HIGH",
        siemCategory: "ATTESTATION_NONCE_MISMATCH",
        siemSource: "hardware-attestation-verify",
        context: { sandboxId: "sbx-001" },
      });
      assert.strictEqual(result, true);
    });

    it("throws-then-fails-silent on missing siemSeverity", () => {
      const result = broker.logEvent({
        siemCategory: "TEST_EVENT",
      });
      assert.strictEqual(result, false);
    });

    it("fails-silent on missing siemCategory", () => {
      const result = broker.logEvent({
        siemSeverity: "HIGH",
      });
      assert.strictEqual(result, false);
    });

    it("fails-silent on invalid siemSeverity", () => {
      const result = broker.logEvent({
        siemSeverity: "INVALID",
        siemCategory: "TEST_EVENT",
      });
      assert.strictEqual(result, false);
    });

    it("fails-silent on null payload", () => {
      const result = broker.logEvent(null);
      assert.strictEqual(result, false);
    });

    it("fails-silent on non-object payload", () => {
      const result = broker.logEvent("not-an-object");
      assert.strictEqual(result, false);
    });
  });

  describe("rate limiting (token bucket)", () => {
    it("processes events up to maxTokens then drops", () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          broker.logEvent({
            siemSeverity: "LOW",
            siemCategory: `TEST_EVENT_${i}`,
          }),
        );
      }
      // First 5 should pass (maxTokens=5), rest dropped
      const passed = results.filter(Boolean).length;
      assert.strictEqual(passed, 5, "expected 5 events to pass rate limiter");
    });

    it("emits telemetry_dropped event when rate limited", () => {
      let droppedEvents = [];
      broker.on("telemetry_dropped", (info) => droppedEvents.push(info));

      for (let i = 0; i < 10; i++) {
        broker.logEvent({
          siemSeverity: "LOW",
          siemCategory: `TEST_EVENT_${i}`,
        });
      }

      assert.strictEqual(
        droppedEvents.length,
        5,
        "expected 5 telemetry_dropped events",
      );
      assert.strictEqual(droppedEvents[0].category, "TEST_EVENT_5");
    });

    it("increments siem_events_dropped_total metric", () => {
      for (let i = 0; i < 10; i++) {
        broker.logEvent({
          siemSeverity: "LOW",
          siemCategory: `TEST_EVENT_${i}`,
        });
      }
      const metrics = broker.getMetrics();
      assert.strictEqual(metrics.siem_events_dropped_total, 5);
    });
  });

  describe("CRITICAL/FATAL bypass", () => {
    it("CRITICAL events bypass rate limiter entirely", () => {
      // Exhaust all tokens first
      for (let i = 0; i < 5; i++) {
        broker.logEvent({ siemSeverity: "LOW", siemCategory: `FILL_${i}` });
      }

      // CRITICAL should still pass
      const result = broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "STATE_CORRUPTION",
        siemSource: "cluster-keyring-sync",
      });
      assert.strictEqual(result, true);
    });

    it("FATAL events bypass rate limiter entirely", () => {
      for (let i = 0; i < 5; i++) {
        broker.logEvent({ siemSeverity: "LOW", siemCategory: `FILL_${i}` });
      }

      const result = broker.logEvent({
        siemSeverity: "FATAL",
        siemCategory: "CATASTROPHIC_FAILURE",
      });
      assert.strictEqual(result, true);
    });

    it("increments siem_events_bypassed_total for CRITICAL", () => {
      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "CRITICAL_EVENT",
      });
      const metrics = broker.getMetrics();
      assert.strictEqual(metrics.siem_events_bypassed_total, 1);
    });
  });

  describe("transport strategies", () => {
    it("HYBRID emits transport_batch_queue for LOW severity", () => {
      let batched = [];
      broker.on("transport_batch_queue", (event) => batched.push(event));

      broker.logEvent({
        siemSeverity: "LOW",
        siemCategory: "LOW_EVENT",
      });

      assert.strictEqual(batched.length, 1);
      assert.strictEqual(batched[0].siemCategory, "LOW_EVENT");
    });

    it("HYBRID emits transport_winston_stream for CRITICAL severity", () => {
      let streamed = [];
      broker.on("transport_winston_stream", (event) => streamed.push(event));

      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "CRITICAL_EVENT",
      });

      assert.strictEqual(streamed.length, 1);
      assert.strictEqual(streamed[0].siemCategory, "CRITICAL_EVENT");
    });

    it("STREAMING emits transport_winston_stream for all severities", () => {
      broker.close();
      broker = new SiemSecurityBroker({ transportStrategy: "STREAMING" });

      let streamed = [];
      broker.on("transport_winston_stream", (event) => streamed.push(event));

      broker.logEvent({ siemSeverity: "LOW", siemCategory: "LOW_EVENT" });
      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "CRITICAL_EVENT",
      });

      assert.strictEqual(streamed.length, 2);
    });

    it("STDOUT_ONLY does not emit transport events", () => {
      broker.close();
      broker = new SiemSecurityBroker({ transportStrategy: "STDOUT_ONLY" });

      let emitted = false;
      broker.on("transport_batch_queue", () => {
        emitted = true;
      });
      broker.on("transport_winston_stream", () => {
        emitted = true;
      });

      broker.logEvent({ siemSeverity: "LOW", siemCategory: "LOW_EVENT" });

      assert.strictEqual(
        emitted,
        false,
        "STDOUT_ONLY should not emit transport events",
      );
    });
  });

  describe("event normalization", () => {
    it("produces immutable event with eventId and timestamp", () => {
      let captured;
      broker.on("transport_batch_queue", (event) => {
        captured = event;
      });

      broker.logEvent({
        siemSeverity: "HIGH",
        siemCategory: "TEST_EVENT",
        siemSource: "test-module",
        context: { sandboxId: "sbx-001", nonce: "abc123" },
      });

      assert.ok(captured);
      assert.ok(captured.eventId, "eventId should be set");
      assert.ok(captured.timestamp, "timestamp should be set");
      assert.strictEqual(captured.siemSeverity, "HIGH");
      assert.strictEqual(captured.siemCategory, "TEST_EVENT");
      assert.strictEqual(captured.siemSource, "test-module");
      assert.strictEqual(captured.metadata.sandboxId, "sbx-001");
      assert.strictEqual(captured.metadata.nonce, "abc123");

      // Verify immutability
      assert.strictEqual(Object.isFrozen(captured), true);
    });

    it("defaults siemSource to unknown when not provided", () => {
      let captured;
      broker.on("transport_batch_queue", (event) => {
        captured = event;
      });

      broker.logEvent({
        siemSeverity: "LOW",
        siemCategory: "TEST_EVENT",
      });

      assert.strictEqual(captured.siemSource, "unknown");
    });

    it("defaults metadata to empty object when context not provided", () => {
      let captured;
      broker.on("transport_batch_queue", (event) => {
        captured = event;
      });

      broker.logEvent({
        siemSeverity: "LOW",
        siemCategory: "TEST_EVENT",
      });

      assert.deepStrictEqual(captured.metadata, {});
    });
  });

  describe("metrics", () => {
    it("tracks processed, dropped, bypassed, and consumed tokens", () => {
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "A" });
      broker.logEvent({ siemSeverity: "CRITICAL", siemCategory: "B" });

      // Exhaust remaining tokens
      for (let i = 0; i < 4; i++) {
        broker.logEvent({ siemSeverity: "LOW", siemCategory: `FILL_${i}` });
      }
      // This one should be dropped
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "DROPPED" });

      const m = broker.getMetrics();
      assert.strictEqual(m.siem_events_processed_total, 6);
      assert.strictEqual(m.siem_events_dropped_total, 1);
      assert.strictEqual(m.siem_events_bypassed_total, 1);
      assert.strictEqual(m.siem_tokens_consumed_total, 5);
    });

    it("includes currentTokens in metrics snapshot", () => {
      broker.logEvent({ siemSeverity: "LOW", siemCategory: "A" });
      const m = broker.getMetrics();
      assert.strictEqual(
        m.currentTokens,
        4,
        "should have 4 tokens remaining after 1 consumption",
      );
    });
  });

  describe("close", () => {
    it("removes all listeners and clears timer", () => {
      broker.on("test", () => {});
      assert.strictEqual(broker.listenerCount("test"), 1);

      broker.close();

      assert.strictEqual(broker.listenerCount("test"), 0);
    });
  });
});
