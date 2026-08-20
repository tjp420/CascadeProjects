"use strict";

/**
 * SIEM Broker Transport Connection Tests
 *
 * Verifies that siem-exporter.cjs and siem-transport.cjs correctly
 * receive events from SiemSecurityBroker's transport_batch_queue and
 * transport_winston_stream event emissions.
 */

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
const EXPORTER_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "siem-exporter.cjs",
);
const TRANSPORT_PATH = path.resolve(
  process.cwd(),
  "server",
  "middleware",
  "transports",
  "siem-transport.cjs",
);

const SiemSecurityBroker = require(BROKER_PATH);

function withEnv(env) {
  const orig = {};
  for (const k of Object.keys(env)) {
    orig[k] = process.env[k];
    process.env[k] = env[k];
  }
  return () => {
    for (const k of Object.keys(env)) {
      if (orig[k] === undefined) delete process.env[k];
      else process.env[k] = orig[k];
    }
  };
}

function reloadExporter() {
  const cached = require.cache[EXPORTER_PATH];
  if (cached && cached.exports && typeof cached.exports.close === "function") {
    cached.exports.close();
  }
  if (typeof jest !== "undefined" && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[EXPORTER_PATH];
  }
  return require(EXPORTER_PATH);
}

describe("SIEM Broker Transport Connections", () => {
  let broker;
  let restoreEnv;

  beforeEach(() => {
    restoreEnv = withEnv({
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_API_KEY: "testkey",
      SIEM_BATCH_SIZE: "10",
    });
    broker = new SiemSecurityBroker({
      rateLimitMaxTokens: 1000,
      rateLimitRefillRateMs: 10000,
      transportStrategy: "HYBRID",
    });
  });

  afterEach(() => {
    broker.close();
    restoreEnv();
    // Clean up exporter
    const exporter = require(EXPORTER_PATH);
    if (typeof exporter.close === "function") exporter.close();
  });

  // ── siem-exporter.cjs → broker ────────────────────────────────────

  describe("siem-exporter connectBroker", () => {
    it("enqueues broker transport_batch_queue events", () => {
      const exporter = reloadExporter();
      exporter.connectBroker(broker);
      exporter._debug.resetQueue();

      broker.logEvent({
        siemSeverity: "HIGH",
        siemCategory: "test_exporter_event",
        siemSource: "transport-test",
        context: { foo: "bar" },
      });

      const queue = exporter._debug.getQueue();
      assert.strictEqual(queue.length, 1, "exporter queue should have 1 event");
      assert.strictEqual(queue[0].siemCategory, "test_exporter_event");
      assert.strictEqual(queue[0].siemSeverity, "HIGH");
    });

    it("does not enqueue CRITICAL events (they go to winston_stream)", () => {
      const exporter = reloadExporter();
      exporter.connectBroker(broker);
      exporter._debug.resetQueue();

      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "test_critical_event",
        siemSource: "transport-test",
      });

      const queue = exporter._debug.getQueue();
      assert.strictEqual(
        queue.length,
        0,
        "CRITICAL events should not be batched",
      );
    });

    it("handles null broker gracefully", () => {
      const exporter = reloadExporter();
      // Should not throw
      exporter.connectBroker(null);
    });

    it("close() removes broker listener", () => {
      const exporter = reloadExporter();
      exporter.connectBroker(broker);
      exporter._debug.resetQueue();

      exporter.close();

      // After close, events should not be enqueued
      broker.logEvent({
        siemSeverity: "HIGH",
        siemCategory: "after_close_event",
      });

      const queue = exporter._debug.getQueue();
      assert.strictEqual(queue.length, 0, "no events after close");
    });
  });

  // ── siem-transport.cjs → broker ───────────────────────────────────

  describe("siem-transport connectBroker", () => {
    it("forwards transport_winston_stream events to Winston logger", () => {
      const SIEMTransport = require(TRANSPORT_PATH);
      const logCalls = [];
      const mockLogger = {
        warn: (msg, meta) => logCalls.push({ level: "warn", msg, meta }),
        error: (msg, meta) => logCalls.push({ level: "error", msg, meta }),
      };

      SIEMTransport.connectBroker(broker, mockLogger);

      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "test_winston_critical",
        siemSource: "transport-test",
        context: { sandboxId: "sbx-1" },
      });

      assert.strictEqual(logCalls.length, 1, "logger should have 1 call");
      assert.strictEqual(
        logCalls[0].level,
        "error",
        "CRITICAL should map to error level",
      );
      assert.ok(logCalls[0].msg.includes("test_winston_critical"));
      assert.strictEqual(logCalls[0].meta.siemSeverity, "CRITICAL");
    });

    it("maps HIGH severity to warn level", () => {
      const SIEMTransport = require(TRANSPORT_PATH);
      const logCalls = [];
      const mockLogger = {
        warn: (msg, meta) => logCalls.push({ level: "warn", msg, meta }),
        error: (msg, meta) => logCalls.push({ level: "error", msg, meta }),
      };

      SIEMTransport.connectBroker(broker, mockLogger);

      // Use STREAMING strategy to route HIGH through winston_stream
      broker.close();
      broker = new SiemSecurityBroker({ transportStrategy: "STREAMING" });

      SIEMTransport.connectBroker(broker, mockLogger);

      broker.logEvent({
        siemSeverity: "HIGH",
        siemCategory: "test_winston_high",
        siemSource: "transport-test",
      });

      assert.strictEqual(logCalls.length, 1);
      assert.strictEqual(
        logCalls[0].level,
        "warn",
        "HIGH should map to warn level",
      );
    });

    it("disconnectBroker removes the listener", () => {
      const SIEMTransport = require(TRANSPORT_PATH);
      const logCalls = [];
      const mockLogger = {
        warn: (msg, meta) => logCalls.push({ msg }),
        error: (msg, meta) => logCalls.push({ msg }),
      };

      SIEMTransport.connectBroker(broker, mockLogger);
      SIEMTransport.disconnectBroker();

      broker.logEvent({
        siemSeverity: "CRITICAL",
        siemCategory: "after_disconnect",
      });

      assert.strictEqual(logCalls.length, 0, "no calls after disconnect");
    });

    it("handles null broker gracefully", () => {
      const SIEMTransport = require(TRANSPORT_PATH);
      // Should not throw
      SIEMTransport.connectBroker(null, {});
    });
  });

  // ── End-to-end: broker → exporter queue ───────────────────────────

  describe("end-to-end broker → exporter", () => {
    it("LOW severity event flows from broker to exporter queue", () => {
      const exporter = reloadExporter();
      exporter.connectBroker(broker);
      exporter._debug.resetQueue();

      broker.logEvent({
        siemSeverity: "LOW",
        siemCategory: "e2e_low_event",
        siemSource: "e2e-test",
        context: { source: "test" },
      });

      const queue = exporter._debug.getQueue();
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].siemCategory, "e2e_low_event");
      assert.strictEqual(queue[0].metadata.source, "test");
    });
  });
});
