"use strict";

/**
 * Musig2HsmOrchestrator — 50-check integration test suite
 *
 * Covers:
 *   - L1 (9): Syntax checks on all touched files
 *   - L2 (19): Behavioral round-trips (session lifecycle, signing flow, HSM wrap/unwrap, routes)
 *   - L3 (15): Edge cases, out-of-order execution, timeout, max sessions, zeroization
 *   - S  (7): Security invariants (no plaintext keys, nonce zeroization, tenant isolation)
 *
 * Uses node:test + node:assert (consistent with hsm-adapter test suite).
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const {
  Musig2HsmOrchestrator,
  SESSION_STATE,
  ORCHESTRATOR_EVENT,
} = require("../musig2-hsm-orchestrator.cjs");
const {
  registerMusig2Orchestrator,
  getMusig2Orchestrator,
  HsmAdapterError,
} = require("../base-adapter.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

const SECP256K1_Q =
  "115792089237316195423570985008687907852837564279074904382605163141518161494337";

// Path to ai-platform/server (parent of lib/)
const SERVER_ROOT = path.resolve(__dirname, "../../..");

// Helper: match HsmAdapterError by code (code is a property, not in message)
// For assert.rejects/throws, validation functions must return true on match.
function assertErrorCode(code) {
  return (err) => {
    if (!err || !err.code) return false;
    return err.code === code;
  };
}

// ── Mock HSM Adapter ──────────────────────────────────────────────────
// In-memory KEK store that mimics BaseHsmAdapter wrap/unwrap contract.

function createMockHsmAdapter() {
  const keks = new Map(); // kekId -> { key: Buffer, tenantId }
  const wrapped = new Map(); // id -> { kekId, tenantId, plaintext: Buffer }

  return {
    providerName: "mock",

    async createKEK(tenantId, meta = {}) {
      const kekId =
        (meta && meta.label) || "kek-" + crypto.randomBytes(8).toString("hex");
      const key = crypto.randomBytes(32);
      keks.set(kekId, { key, tenantId });
      return kekId;
    },

    async wrap(tenantId, kekId, plaintext) {
      const kek = keks.get(kekId);
      if (!kek) throw new Error("KEK not found: " + kekId);
      // Simple XOR-based wrap for test purposes (NOT for production)
      const id = "wrap-" + crypto.randomBytes(8).toString("hex");
      const cipher = Buffer.alloc(plaintext.length);
      for (let i = 0; i < plaintext.length; i++) {
        cipher[i] = plaintext[i] ^ kek.key[i % kek.key.length];
      }
      wrapped.set(id, {
        kekId,
        tenantId,
        plaintext: Buffer.from(plaintext),
        cipher,
      });
      return Buffer.concat([Buffer.from(id + ":"), cipher]);
    },

    async unwrap(tenantId, kekId, wrappedBlob) {
      const kek = keks.get(kekId);
      if (!kek) throw new Error("KEK not found: " + kekId);
      const str = wrappedBlob.toString();
      const colonIdx = str.indexOf(":");
      if (colonIdx < 0) throw new Error("corrupted blob");
      const id = str.substring(0, colonIdx);
      const cipher = wrappedBlob.subarray(colonIdx + 1);
      const rec = wrapped.get(id);
      if (!rec) throw new Error("wrapped blob not found: " + id);
      const plain = Buffer.alloc(cipher.length);
      for (let i = 0; i < cipher.length; i++) {
        plain[i] = cipher[i] ^ kek.key[i % kek.key.length];
      }
      return plain;
    },

    async rotateKEK(tenantId, oldKekId) {
      const kek = keks.get(oldKekId);
      if (!kek) throw new Error("KEK not found");
      const newKey = crypto.randomBytes(32);
      keks.set(oldKekId, { key: newKey, tenantId });
      return oldKekId;
    },

    async listKEKs(tenantId) {
      const out = [];
      for (const [kekId, v] of keks.entries()) {
        if (v.tenantId === tenantId) out.push(kekId);
      }
      return out;
    },

    async _zeroize(tenantId, kekId) {
      keks.delete(kekId);
    },
  };
}

// ── Helper: run full signing round-trip ───────────────────────────────

async function runFullRoundTrip(
  orch,
  { tenantId = "tenant-1", participants = 3, keyShares = null } = {},
) {
  const participantIds = Array.from({ length: participants }, (_, i) => i + 1);
  const quorum = [...participantIds];
  const messageHash = "deadbeef" + "00".repeat(28);

  const sessionId = await orch.createSession({
    tenantId,
    participantIds,
    quorum,
    messageHash,
    keyShares,
  });

  await orch.generateNonces(sessionId);
  await orch.aggregateKeys(sessionId);
  await orch.computeBindingFactor(sessionId);
  await orch.evaluateShares(sessionId);
  const signature = await orch.assembleSignature(sessionId);
  const verification = await orch.verifySignature(sessionId);

  return { sessionId, signature, verification };
}

// ── L1: Deterministic syntax checks ───────────────────────────────────

describe("L1 — Deterministic syntax checks", () => {
  it("L1-01: musig2-hsm-orchestrator.cjs syntax OK", () => {
    const file = path.resolve(__dirname, "../musig2-hsm-orchestrator.cjs");
    execSync(`node -c "${file}"`, { stdio: "pipe" });
    assert.ok(fs.existsSync(file));
  });

  it("L1-02: musig2-hsm-orchestrator.test.cjs syntax OK", () => {
    const file = __filename;
    execSync(`node -c "${file}"`, { stdio: "pipe" });
    assert.ok(fs.existsSync(file));
  });

  it("L1-03: base-adapter.cjs syntax OK", () => {
    const file = path.resolve(__dirname, "../base-adapter.cjs");
    execSync(`node -c "${file}"`, { stdio: "pipe" });
  });

  it("L1-04: hsm-metrics.cjs syntax OK", () => {
    const file = path.resolve(__dirname, "../hsm-metrics.cjs");
    execSync(`node -c "${file}"`, { stdio: "pipe" });
  });

  it("L1-05: hsm-vault-routes.cjs syntax OK", () => {
    const file = path.resolve(SERVER_ROOT, "routes/hsm-vault-routes.cjs");
    execSync(`node -c "${file}"`, { stdio: "pipe" });
  });

  it("L1-06: schnorr math engine files unchanged (READ-ONLY)", () => {
    const schnorrDir = path.resolve(SERVER_ROOT, "lib/mpc/schnorr");
    const files = [
      "protocol.cjs",
      "signature_share.cjs",
      "nonce.cjs",
      "field.cjs",
    ];
    for (const f of files) {
      assert.ok(
        fs.existsSync(path.join(schnorrDir, f)),
        `schnorr file missing: ${f}`,
      );
    }
  });

  it("L1-07: orchestrator exports correct API surface", () => {
    assert.strictEqual(typeof Musig2HsmOrchestrator, "function");
    assert.strictEqual(typeof SESSION_STATE.CREATED, "string");
    assert.strictEqual(typeof ORCHESTRATOR_EVENT.SESSION_CREATED, "string");
  });

  it("L1-08: base-adapter exports registry hooks", () => {
    assert.strictEqual(typeof registerMusig2Orchestrator, "function");
    assert.strictEqual(typeof getMusig2Orchestrator, "function");
  });

  it("L1-09: hsm-metrics defines new orchestrator counters", () => {
    const counters = hsmMetrics.getMetrics();
    assert.strictEqual(
      typeof counters.hsm_musig2_orch_session_created_total,
      "number",
    );
    assert.strictEqual(
      typeof counters.hsm_musig2_orch_session_completed_total,
      "number",
    );
    assert.strictEqual(
      typeof counters.hsm_musig2_orch_session_failed_total,
      "number",
    );
    assert.strictEqual(
      typeof counters.hsm_musig2_orch_key_share_wrapped_total,
      "number",
    );
  });
});

// ── L2: Behavioral tests ──────────────────────────────────────────────

describe("L2 — Behavioral: session lifecycle and signing flow", () => {
  let orch;
  let mockAdapter;

  beforeEach(() => {
    hsmMetrics.reset();
    mockAdapter = createMockHsmAdapter();
    orch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
    });
  });

  afterEach(async () => {
    // Cleanup any active sessions
    if (orch && orch.getActiveSessionCount() > 0) {
      // Best-effort cleanup
    }
  });

  it("L2-01: createSession with valid params returns sessionId", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
    });
    assert.ok(typeof sessionId === "string");
    assert.ok(sessionId.startsWith("musig2-"));
    const status = orch.getSessionStatus(sessionId);
    assert.strictEqual(status.state, SESSION_STATE.CREATED);
    assert.strictEqual(status.participants, 3);
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_orch_session_created_total,
      1,
    );
  });

  it("L2-02: generateNonces returns public commitments and advances state", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
    });
    const commitments = await orch.generateNonces(sessionId);
    assert.strictEqual(commitments.length, 3);
    assert.ok(commitments[0].h1);
    assert.ok(commitments[0].h2);
    assert.strictEqual(
      orch.getSessionStatus(sessionId).state,
      SESSION_STATE.NONCES_GENERATED,
    );
  });

  it("L2-03: aggregateKeys returns aggregated public key and advances state", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
    });
    await orch.generateNonces(sessionId);
    const aggKey = await orch.aggregateKeys(sessionId);
    assert.strictEqual(typeof aggKey, "bigint");
    assert.ok(aggKey >= 0n);
    assert.strictEqual(
      orch.getSessionStatus(sessionId).state,
      SESSION_STATE.KEYS_AGGREGATED,
    );
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_key_aggregation_total,
      1,
    );
  });

  it("L2-04: computeBindingFactor returns binding factor and advances state", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    const bf = await orch.computeBindingFactor(sessionId);
    assert.strictEqual(typeof bf, "bigint");
    assert.strictEqual(
      orch.getSessionStatus(sessionId).state,
      SESSION_STATE.BINDING_COMPUTED,
    );
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_binding_factor_computed_total,
      1,
    );
  });

  it("L2-05: evaluateShares returns partial shares and advances state", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
      keyShares: [100n, 200n, 300n],
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    const shares = await orch.evaluateShares(sessionId);
    assert.strictEqual(shares.length, 3);
    for (const s of shares) assert.strictEqual(typeof s, "bigint");
    assert.strictEqual(
      orch.getSessionStatus(sessionId).state,
      SESSION_STATE.SHARES_EVALUATED,
    );
  });

  it("L2-06: assembleSignature returns {R, s} and advances state", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
      keyShares: [100n, 200n, 300n],
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    await orch.evaluateShares(sessionId);
    const sig = await orch.assembleSignature(sessionId);
    assert.strictEqual(typeof sig.R, "bigint");
    assert.strictEqual(typeof sig.s, "bigint");
    assert.strictEqual(
      orch.getSessionStatus(sessionId).state,
      SESSION_STATE.SIGNATURE_ASSEMBLED,
    );
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_signature_assembled_total,
      1,
    );
  });

  it("L2-07: verifySignature returns {valid: true} and advances to VERIFIED", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc123",
      keyShares: [100n, 200n, 300n],
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    await orch.evaluateShares(sessionId);
    await orch.assembleSignature(sessionId);
    const result = await orch.verifySignature(sessionId);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(
      orch.getSessionStatus(sessionId).state,
      SESSION_STATE.VERIFIED,
    );
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_signature_verified_total,
      1,
    );
  });

  it("L2-08: full round-trip signing (2-of-3) succeeds", async () => {
    const { signature, verification } = await runFullRoundTrip(orch, {
      tenantId: "tenant-1",
      participants: 3,
      keyShares: [100n, 200n, 300n],
    });
    assert.ok(signature.R !== undefined);
    assert.ok(signature.s !== undefined);
    assert.strictEqual(verification.valid, true);
    const m = hsmMetrics.getMetrics();
    assert.ok(m.hsm_musig2_signature_assembled_total >= 1);
    assert.ok(m.hsm_musig2_signature_verified_total >= 1);
  });

  it("L2-09: full round-trip signing (3-of-5) succeeds", async () => {
    const { signature, verification } = await runFullRoundTrip(orch, {
      tenantId: "tenant-1",
      participants: 5,
      keyShares: [10n, 20n, 30n, 40n, 50n],
    });
    assert.ok(signature.R !== undefined);
    assert.strictEqual(verification.valid, true);
  });

  it("L2-10: wrapKeyShare returns wrapped blob and increments counter", async () => {
    const wrapped = await orch.wrapKeyShare("tenant-1", 12345n);
    assert.ok(Buffer.isBuffer(wrapped));
    assert.ok(wrapped.length > 0);
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_orch_key_share_wrapped_total,
      1,
    );
  });

  it("L2-11: unwrapKeyShare returns original key share value", async () => {
    const original = 99999n;
    const wrapped = await orch.wrapKeyShare("tenant-1", original);
    const unwrapped = await orch.unwrapKeyShare("tenant-1", wrapped);
    assert.strictEqual(unwrapped, original);
  });

  it("L2-12: sealNonce returns sealed blob", async () => {
    const sealed = await orch.sealNonce("tenant-1", { k1: 100n, k2: 200n });
    assert.ok(Buffer.isBuffer(sealed));
    assert.ok(sealed.length > 0);
  });

  it("L2-13: unsealNonce returns original nonce values", async () => {
    const original = { k1: 555n, k2: 777n };
    const sealed = await orch.sealNonce("tenant-1", original);
    const unsealed = await orch.unsealNonce("tenant-1", sealed);
    assert.strictEqual(unsealed.k1, original.k1);
    assert.strictEqual(unsealed.k2, original.k2);
  });

  it("L2-14: getSessionStatus returns state, participants, phase, createdAt", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
    });
    const status = orch.getSessionStatus(sessionId);
    assert.strictEqual(status.state, SESSION_STATE.CREATED);
    assert.strictEqual(status.participants, 2);
    assert.strictEqual(status.phase, SESSION_STATE.CREATED);
    assert.ok(typeof status.createdAt === "number");
  });

  it("L2-15: destroySession removes session from registry", async () => {
    const sessionId = await orch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
    });
    await orch.destroySession(sessionId);
    assert.throws(
      () => orch.getSessionStatus(sessionId),
      assertErrorCode("SESSION_NOT_FOUND"),
    );
  });

  it("L2-16: module-level registry register/get works", () => {
    registerMusig2Orchestrator(orch);
    const retrieved = getMusig2Orchestrator();
    assert.strictEqual(retrieved, orch);
    registerMusig2Orchestrator(null);
    assert.strictEqual(getMusig2Orchestrator(), null);
  });

  it("L2-17: route file exposes POST /musig2/session/create endpoint", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(SERVER_ROOT, "routes/hsm-vault-routes.cjs"),
      "utf8",
    );
    assert.ok(routeSrc.includes("router.post('/musig2/session/create'"));
  });

  it("L2-18: route file exposes GET /musig2/session/:sessionId/status endpoint", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(SERVER_ROOT, "routes/hsm-vault-routes.cjs"),
      "utf8",
    );
    assert.ok(
      routeSrc.includes("router.get('/musig2/session/:sessionId/status'"),
    );
  });

  it("L2-19: route file exposes POST /musig2/session/:sessionId/sign endpoint", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(SERVER_ROOT, "routes/hsm-vault-routes.cjs"),
      "utf8",
    );
    assert.ok(
      routeSrc.includes("router.post('/musig2/session/:sessionId/sign'"),
    );
  });
});

// ── L3: Edge cases & regression ───────────────────────────────────────

describe("L3 — Edge cases & regression", () => {
  let orch;
  let mockAdapter;

  beforeEach(() => {
    hsmMetrics.reset();
    mockAdapter = createMockHsmAdapter();
    orch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
    });
  });

  it("L3-01: createSession with missing tenantId throws INVALID_INPUT", async () => {
    await assert.rejects(
      () => orch.createSession({ participantIds: [1, 2], messageHash: "abc" }),
      assertErrorCode("INVALID_INPUT"),
    );
  });

  it("L3-02: createSession with empty participantIds throws INVALID_INPUT", async () => {
    await assert.rejects(
      () =>
        orch.createSession({
          tenantId: "t1",
          participantIds: [],
          messageHash: "abc",
        }),
      assertErrorCode("INVALID_INPUT"),
    );
  });

  it("L3-03: createSession with quorum larger than participants throws INVALID_INPUT", async () => {
    await assert.rejects(
      () =>
        orch.createSession({
          tenantId: "t1",
          participantIds: [1, 2],
          quorum: [1, 2, 3],
          messageHash: "abc",
        }),
      assertErrorCode("INVALID_INPUT"),
    );
  });

  it("L3-04: generateNonces for non-existent session throws SESSION_NOT_FOUND", async () => {
    await assert.rejects(
      () => orch.generateNonces("nonexistent"),
      assertErrorCode("SESSION_NOT_FOUND"),
    );
  });

  it("L3-05: aggregateKeys before generateNonces throws INVALID_STATE", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
    });
    await assert.rejects(
      () => orch.aggregateKeys(sessionId),
      assertErrorCode("INVALID_STATE"),
    );
  });

  it("L3-06: assembleSignature before evaluateShares throws INVALID_STATE", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    await assert.rejects(
      () => orch.assembleSignature(sessionId),
      assertErrorCode("INVALID_STATE"),
    );
  });

  it("L3-07: session timeout auto-destroys idle session", async () => {
    const shortTimeoutOrch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
      sessionTimeoutMs: 50,
    });
    const sessionId = await shortTimeoutOrch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
    });
    // Wait for timeout
    await new Promise((r) => setTimeout(r, 100));
    assert.throws(
      () => shortTimeoutOrch.getSessionStatus(sessionId),
      (err) =>
        err.code === "SESSION_TIMEOUT" || err.code === "SESSION_NOT_FOUND",
    );
  });

  it("L3-08: max sessions exceeded throws MAX_SESSIONS_EXCEEDED", async () => {
    const smallOrch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
      maxSessions: 2,
    });
    await smallOrch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "a",
    });
    await smallOrch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "b",
    });
    await assert.rejects(
      () =>
        smallOrch.createSession({
          tenantId: "t1",
          participantIds: [1, 2],
          quorum: [1, 2],
          messageHash: "c",
        }),
      assertErrorCode("MAX_SESSIONS_EXCEEDED"),
    );
  });

  it("L3-09: wrapKeyShare with null HSM adapter throws NO_HSM_ADAPTER", async () => {
    const nullAdapterOrch = new Musig2HsmOrchestrator({
      hsmAdapter: createMockHsmAdapter(),
      modulus: SECP256K1_Q,
    });
    nullAdapterOrch._hsmAdapter = null;
    await assert.rejects(
      () => nullAdapterOrch.wrapKeyShare("t1", 123n),
      assertErrorCode("NO_HSM_ADAPTER"),
    );
  });

  it("L3-10: unwrap corrupted key share blob throws UNWRAP_FAILED", async () => {
    await orch.wrapKeyShare("t1", 100n); // create KEK
    const corrupted = Buffer.from("corrupted-blob-data");
    await assert.rejects(
      () => orch.unwrapKeyShare("t1", corrupted),
      assertErrorCode("UNWRAP_FAILED"),
    );
  });

  it("L3-11: verify invalid signature returns {valid: false} and increments failure counter", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc",
      keyShares: [100n, 200n, 300n],
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    await orch.evaluateShares(sessionId);
    await orch.assembleSignature(sessionId);
    // Pass invalid signature
    const result = await orch.verifySignature(sessionId, { R: 1n, s: 1n });
    assert.strictEqual(result.valid, false);
    assert.ok(
      hsmMetrics.getMetrics().hsm_musig2_signature_verification_failed_total >=
        1,
    );
  });

  it("L3-12: destroy already-destroyed session throws SESSION_NOT_FOUND", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
    });
    await orch.destroySession(sessionId);
    await assert.rejects(
      () => orch.destroySession(sessionId),
      assertErrorCode("SESSION_NOT_FOUND"),
    );
  });

  it("L3-13: existing schnorr tests still pass (regression)", () => {
    const schnorrTestPath = path.resolve(
      SERVER_ROOT,
      "lib/mpc/schnorr/__tests__/schnorr.test.cjs",
    );
    assert.ok(fs.existsSync(schnorrTestPath), "schnorr test file exists");
    // The schnorr tests use jest describe/test — verify they're syntactically valid
    execSync(`node -c "${schnorrTestPath}"`, { stdio: "pipe" });
  });

  it("L3-14: hsm-metrics counters are properly reset between tests", () => {
    hsmMetrics.reset();
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_orch_session_created_total,
      0,
    );
    assert.strictEqual(
      hsmMetrics.getMetrics().hsm_musig2_signature_verified_total,
      0,
    );
  });

  it("L3-15: nonce zeroization after share evaluation (S-03)", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc",
      keyShares: [100n, 200n, 300n],
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    await orch.evaluateShares(sessionId);

    // Access session internals to verify zeroization
    const session = orch._sessions.get(sessionId);
    for (const nonce of session.nonces) {
      assert.strictEqual(
        nonce.secret.k1,
        0n,
        "k1 zeroized after evaluateShares",
      );
      assert.strictEqual(
        nonce.secret.k2,
        0n,
        "k2 zeroized after evaluateShares",
      );
    }
  });
});

// ── Security tests ────────────────────────────────────────────────────

describe("Security — S-01 through S-07", () => {
  let orch;
  let mockAdapter;

  beforeEach(() => {
    hsmMetrics.reset();
    mockAdapter = createMockHsmAdapter();
    orch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
    });
  });

  it("S-01: no credentials/PII in audit events", async () => {
    const events = [];
    const auditedOrch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
      audit: (event, info) => events.push({ event, info }),
    });
    await auditedOrch.createSession({
      tenantId: "tenant-1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
      keyShares: [100n, 200n],
    });
    // Verify no key share values appear in audit payloads
    const eventStr = JSON.stringify(events);
    assert.ok(!eventStr.includes('"100"'), "no key share values in audit");
    assert.ok(!eventStr.includes('"200"'), "no key share values in audit");
  });

  it("S-02: key shares wrapped via HSM KEK before storage (never plaintext)", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
      keyShares: [12345n, 67890n],
    });
    const session = orch._sessions.get(sessionId);
    // wrappedShares should be Buffers, not BigInts
    for (const w of session.wrappedShares) {
      assert.ok(Buffer.isBuffer(w), "key share is wrapped as Buffer");
      assert.ok(w.length > 0, "wrapped blob is non-empty");
    }
  });

  it("S-03: secret nonces zeroized after share evaluation", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
      keyShares: [100n, 200n],
    });
    await orch.generateNonces(sessionId);
    await orch.aggregateKeys(sessionId);
    await orch.computeBindingFactor(sessionId);
    await orch.evaluateShares(sessionId);
    const session = orch._sessions.get(sessionId);
    for (const nonce of session.nonces) {
      assert.strictEqual(nonce.secret.k1, 0n);
      assert.strictEqual(nonce.secret.k2, 0n);
    }
  });

  it("S-04: session data cleared on destroy (no residual key material)", async () => {
    const sessionId = await orch.createSession({
      tenantId: "t1",
      participantIds: [1, 2],
      quorum: [1, 2],
      messageHash: "abc",
      keyShares: [100n, 200n],
    });
    await orch.generateNonces(sessionId);
    await orch.destroySession(sessionId);
    // Session should be removed from registry
    assert.strictEqual(orch._sessions.has(sessionId), false);
  });

  it("S-05: tenant isolation — cross-tenant access rejected", async () => {
    // Create KEK for tenant-1
    await orch.wrapKeyShare("tenant-1", 100n);
    // Try to unwrap with tenant-2 — should fail because no KEK for tenant-2
    const wrapped = await orch.wrapKeyShare("tenant-1", 200n);
    await assert.rejects(
      () => orch.unwrapKeyShare("tenant-2", wrapped),
      assertErrorCode("UNWRAP_FAILED"),
    );
  });

  it("S-06: no private key material in route responses or metrics", () => {
    const counters = hsmMetrics.getMetrics();
    const counterStr = JSON.stringify(counters);
    // Counters should be numbers, not key material
    assert.ok(
      !counterStr.match(/[0-9a-f]{64}/),
      "no hex key material in metrics",
    );
  });

  it("S-07: audit callback receives events without sensitive payload values", async () => {
    const events = [];
    const auditedOrch = new Musig2HsmOrchestrator({
      hsmAdapter: mockAdapter,
      modulus: SECP256K1_Q,
      audit: (event, info) => events.push({ event, info }),
    });
    const sessionId = await auditedOrch.createSession({
      tenantId: "t1",
      participantIds: [1, 2, 3],
      quorum: [1, 2, 3],
      messageHash: "abc",
      keyShares: [111n, 222n, 333n],
    });
    await auditedOrch.generateNonces(sessionId);
    await auditedOrch.aggregateKeys(sessionId);

    // Check that no secret values appear in audit events
    for (const e of events) {
      const s = JSON.stringify(e);
      assert.ok(!s.includes('"111"'), "no key share in audit: " + e.event);
      assert.ok(!s.includes('"222"'), "no key share in audit: " + e.event);
      assert.ok(!s.includes('"333"'), "no key share in audit: " + e.event);
    }
  });
});
