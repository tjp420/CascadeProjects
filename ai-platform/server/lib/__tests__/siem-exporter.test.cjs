"use strict";

const assert = require("node:assert");
const { describe, it } = require("node:test");
const path = require("path");

const SIEM_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "siem-exporter.cjs",
);

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

function reloadSiem() {
  // Clean up previous module instance (clear interval timer)
  const cached = require.cache[SIEM_PATH];
  if (cached && cached.exports && typeof cached.exports.close === "function") {
    cached.exports.close();
  }
  // Use Jest's module reset if available (Jest's module cache doesn't
  // always respect delete require.cache). Fall back to delete for node:test.
  if (typeof jest !== "undefined" && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[SIEM_PATH];
  }
  return require(SIEM_PATH);
}

describe("siem-exporter (unit)", () => {
  it("flushes a full batch and posts mapped payload", async () => {
    const restore = withEnv({
      SIEM_BATCH_SIZE: "3",
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_API_KEY: "testkey",
    });
    try {
      const calls = [];
      global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200 };
      };

      const se = reloadSiem();

      se.enqueue({ foo: 1 });
      se.enqueue({ foo: 2 });
      se.enqueue({ foo: 3 });

      // Force a flush rather than waiting on interval
      await se.flush();

      assert.equal(calls.length, 1, "Expected exactly one outbound fetch call");
      const call = calls[0];
      assert.equal(call.url, "https://siem.test/ingest");
      assert.ok(call.opts.headers["Content-Type"], "application/json");
      assert.equal(call.opts.headers.Authorization, "Bearer testkey");
      const body = JSON.parse(call.opts.body);
      assert.equal(body.source, "ai-platform");
      assert.equal(Array.isArray(body.events), true);
      assert.equal(body.events.length, 3);
      // queue drained
      assert.equal(se._debug.getQueue().length, 0);
    } finally {
      delete global.fetch;
      restore();
    }
  });

  it("re-enqueues on network failure and bounds queue to 1000", async () => {
    const restore = withEnv({
      SIEM_BATCH_SIZE: "10",
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_RETRY_BASE_MS: "1",
      SIEM_RETRY_MAX_ATTEMPTS: "3",
    });
    try {
      // fetch always throws to simulate outage
      global.fetch = async () => {
        throw new Error("network down");
      };

      const se = reloadSiem();
      se._debug.resetQueue();

      // Verify BATCH_SIZE was correctly loaded from env
      assert.equal(se._debug.getBatchSize(), 10, "BATCH_SIZE should be 10");

      // populate queue beyond 1000 to exercise the trim behavior
      const preQ = se._debug.getQueue();
      for (let i = 0; i < 1205; i++) preQ.push({ i });
      // ensure initial state
      assert.ok(preQ.length >= 1205, "precondition: queue seeded");

      // call flush which will attempt to send then on failure re-enqueue and trim
      await se.flush();

      // Wait for retries to exhaust and queue to be trimmed.
      // flush() is fire-and-forget (doesn't await sendBatch), so we poll
      // until the queue is trimmed or timeout.
      const timeoutAt = Date.now() + 3000;
      while (Date.now() < timeoutAt) {
        const q = se._debug.getQueue();
        if (q.length <= 1000) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
      }

      const postQ = se._debug.getQueue();
      // queue should be trimmed to at most 1000 after retries exhausted
      assert.ok(
        postQ.length <= 1000,
        `queue trimmed to <=1000, actual=${postQ.length}`,
      );
      // confirm that at least one send attempt occurred
      assert.ok(
        se._debug.getTotalSendAttempts() >= 1,
        `expected send attempts >= 1, actual=${se._debug.getTotalSendAttempts()}`,
      );
      // metrics should reflect observed retries and possible drops
      const metrics = se._debug.getMetrics();
      assert.ok(
        typeof metrics.siem_delivery_retries_total === "number",
        "metrics.retries_total present",
      );
      assert.ok(
        metrics.siem_delivery_retries_total >= 1,
        `expected retries >= 1, actual=${metrics.siem_delivery_retries_total}`,
      );
      assert.ok(
        typeof metrics.siem_delivery_dropped_total === "number",
        "metrics.dropped_total present",
      );
    } finally {
      delete global.fetch;
      restore();
    }
  });

  it("enqueue is no-op for invalid events and does not throw", async () => {
    const restore = withEnv({ SIEM_BATCH_SIZE: "2", SIEM_ENDPOINT: "" });
    try {
      // ensure a harmless fetch impl exists so module doesn't require node-fetch
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      // invalid inputs
      se.enqueue(null);
      se.enqueue("string");
      se.enqueue({ ok: true });
      // flush should not throw even if endpoint is empty
      await se.flush();
      assert.ok(Array.isArray(se._debug.getQueue()));
    } finally {
      delete global.fetch;
      restore();
    }
  });
});

// ── mTLS Transport Layer Hardening Tests ─────────────────────────────

describe("siem-exporter mTLS transport (unit)", () => {
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  let tmpDir;

  function setupTestCerts() {
    tmpDir = path.join(
      os.tmpdir(),
      "siem-mtls-test-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "ca.pem"),
      "-----BEGIN CERTIFICATE-----\nMIIBdummyCA==\n-----END CERTIFICATE-----\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "client-cert.pem"),
      "-----BEGIN CERTIFICATE-----\nMIIBdummyCert==\n-----END CERTIFICATE-----\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "client-key.pem"),
      "-----BEGIN RSA PRIVATE KEY-----\nMIIBdummyKey==\n-----END RSA PRIVATE KEY-----\n",
    );
  }

  function cleanupTestCerts() {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  // T1: When all 3 cert paths are set, an https.Agent is created with cert/key/ca
  it("T1: creates an https.Agent when all 3 cert paths are configured", () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      assert.equal(se._debug.isMtlsEnabled(), true, "mTLS should be enabled");
      const agent = se._debug.getMtlsAgent();
      assert.ok(agent, "https.Agent should be created");
      assert.equal(typeof agent, "object");
      // Verify agent has the cert/key/ca options set
      assert.ok(agent.options, "agent should have options");
      assert.ok(agent.options.cert, "agent should have cert");
      assert.ok(agent.options.key, "agent should have key");
      assert.ok(agent.options.ca, "agent should have ca");
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T2: When rejectUnauthorized is not explicitly set, it defaults to true
  it("T2: rejectUnauthorized defaults to true when mTLS is enabled", () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      const agent = se._debug.getMtlsAgent();
      assert.equal(
        agent.options.rejectUnauthorized,
        true,
        "rejectUnauthorized should default to true",
      );
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T3: When SIEM_TLS_REJECT_UNAUTHORIZED is 'false', rejectUnauthorized is false
  it("T3: rejectUnauthorized is false when SIEM_TLS_REJECT_UNAUTHORIZED=false", () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_TLS_REJECT_UNAUTHORIZED: "false",
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      const agent = se._debug.getMtlsAgent();
      assert.equal(
        agent.options.rejectUnauthorized,
        false,
        "rejectUnauthorized should be false",
      );
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T4: The agent is cached at module load (not re-created per request)
  it("T4: agent is cached at module load and reused across requests", async () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_BATCH_SIZE: "2",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      const agent1 = se._debug.getMtlsAgent();

      // Enqueue and flush a batch
      se.enqueue({ foo: 1 });
      se.enqueue({ foo: 2 });
      await se.flush();

      // Agent should be the same instance
      const agent2 = se._debug.getMtlsAgent();
      assert.equal(
        agent1,
        agent2,
        "agent should be the same instance across requests",
      );
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T5: When no cert paths are set, exporter falls back to standard fetch (no agent)
  it("T5: falls back to standard fetch when no cert paths are configured", () => {
    const restore = withEnv({
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      assert.equal(se._debug.isMtlsEnabled(), false, "mTLS should be disabled");
      assert.equal(
        se._debug.getMtlsAgent(),
        null,
        "no agent should be created",
      );
    } finally {
      delete global.fetch;
      restore();
    }
  });

  // T6: When only some cert paths are set (partial config), exporter falls back with a warning
  it("T6: falls back when only partial cert paths are configured", () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      // Missing SIEM_TLS_CLIENT_KEY_PATH and SIEM_TLS_CA_CERT_PATH
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      assert.equal(
        se._debug.isMtlsEnabled(),
        false,
        "mTLS should be disabled on partial config",
      );
      assert.equal(
        se._debug.getMtlsAgent(),
        null,
        "no agent should be created",
      );
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T7: Missing cert files (path exists but file doesn't) causes fallback, not a crash
  it("T7: falls back gracefully when cert files do not exist (no crash)", () => {
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: "/nonexistent/cert.pem",
      SIEM_TLS_CLIENT_KEY_PATH: "/nonexistent/key.pem",
      SIEM_TLS_CA_CERT_PATH: "/nonexistent/ca.pem",
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      // Should not throw during module load
      const se = reloadSiem();
      assert.equal(
        se._debug.isMtlsEnabled(),
        false,
        "mTLS should be disabled on missing files",
      );
      assert.equal(
        se._debug.getMtlsAgent(),
        null,
        "no agent should be created",
      );
    } finally {
      delete global.fetch;
      restore();
    }
  });

  // T8: Fallback mode does not set rejectUnauthorized on any agent
  it("T8: fallback mode has no agent and does not set rejectUnauthorized", () => {
    const restore = withEnv({
      SIEM_ENDPOINT: "https://siem.test/ingest",
    });
    try {
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      assert.equal(se._debug.getMtlsAgent(), null, "no agent in fallback mode");
    } finally {
      delete global.fetch;
      restore();
    }
  });

  // T9: sendBatch() uses the mTLS agent when configured (agent option present in fetch call)
  it("T9: sendBatch passes agent option to fetch when mTLS is enabled", async () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_BATCH_SIZE: "2",
    });
    try {
      const calls = [];
      global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200 };
      };
      const se = reloadSiem();
      se.enqueue({ foo: 1 });
      se.enqueue({ foo: 2 });
      await se.flush();
      assert.equal(calls.length, 1, "Expected one fetch call");
      assert.ok(calls[0].opts.agent, "fetch call should include agent option");
      assert.equal(
        calls[0].opts.agent,
        se._debug.getMtlsAgent(),
        "agent should be the mTLS agent",
      );
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T10: sendBatch() does not include agent option when in fallback mode
  it("T10: sendBatch does not include agent option in fallback mode", async () => {
    const restore = withEnv({
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_BATCH_SIZE: "2",
    });
    try {
      const calls = [];
      global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200 };
      };
      const se = reloadSiem();
      se.enqueue({ foo: 1 });
      se.enqueue({ foo: 2 });
      await se.flush();
      assert.equal(calls.length, 1, "Expected one fetch call");
      assert.equal(
        calls[0].opts.agent,
        undefined,
        "fetch call should not include agent option",
      );
    } finally {
      delete global.fetch;
      restore();
    }
  });

  // T11: Existing retry/re-enqueue behavior works correctly with mTLS agent
  it("T11: retry behavior works with mTLS agent on network failure", async () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_BATCH_SIZE: "10",
      SIEM_RETRY_BASE_MS: "1",
      SIEM_RETRY_MAX_ATTEMPTS: "2",
    });
    try {
      global.fetch = async () => {
        throw new Error("mtls handshake failed");
      };
      const se = reloadSiem();
      se._debug.resetQueue();
      const q = se._debug.getQueue();
      for (let i = 0; i < 5; i++) q.push({ i });
      await se.flush();
      // Wait for retries to process
      const timeoutAt = Date.now() + 2000;
      while (Date.now() < timeoutAt) {
        if (se._debug.getTotalSendAttempts() >= 1) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(
        se._debug.getTotalSendAttempts() >= 1,
        "should have attempted at least one send",
      );
      const metrics = se._debug.getMetrics();
      assert.ok(
        metrics.siem_delivery_retries_total >= 1,
        "should have recorded retries",
      );
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });

  // T12: Existing batch size, flush interval, and API key behavior unchanged
  it("T12: batch size and API key behavior unchanged with mTLS enabled", async () => {
    setupTestCerts();
    const restore = withEnv({
      SIEM_TLS_CLIENT_CERT_PATH: path.join(tmpDir, "client-cert.pem"),
      SIEM_TLS_CLIENT_KEY_PATH: path.join(tmpDir, "client-key.pem"),
      SIEM_TLS_CA_CERT_PATH: path.join(tmpDir, "ca.pem"),
      SIEM_ENDPOINT: "https://siem.test/ingest",
      SIEM_API_KEY: "mtls-test-key",
      SIEM_BATCH_SIZE: "3",
    });
    try {
      const calls = [];
      global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200 };
      };
      const se = reloadSiem();
      assert.equal(se._debug.getBatchSize(), 3, "batch size should be 3");
      se.enqueue({ foo: 1 });
      se.enqueue({ foo: 2 });
      se.enqueue({ foo: 3 });
      await se.flush();
      assert.equal(calls.length, 1, "Expected one fetch call");
      assert.equal(
        calls[0].opts.headers.Authorization,
        "Bearer mtls-test-key",
        "API key header should be present",
      );
      const body = JSON.parse(calls[0].opts.body);
      assert.equal(body.events.length, 3, "batch should contain 3 events");
      assert.equal(body.source, "ai-platform", "source should be ai-platform");
    } finally {
      delete global.fetch;
      restore();
      cleanupTestCerts();
    }
  });
});
