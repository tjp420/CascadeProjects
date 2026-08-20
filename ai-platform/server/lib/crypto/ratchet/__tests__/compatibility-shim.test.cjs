"use strict";

const assert = require("node:assert");
const { describe, it } = require("node:test");
const path = require("path");

const { IdentityRatchet } = require(
  path.resolve(
    process.cwd(),
    "server",
    "lib",
    "crypto",
    "ratchet",
    "identity-ratchet.cjs",
  ),
);
const {
  detectMode,
  initiateHandshake,
  acceptHandshake,
  CompatibilityError,
  RatchetMetrics,
} = require(
  path.resolve(
    process.cwd(),
    "server",
    "lib",
    "crypto",
    "ratchet",
    "compatibility-shim.cjs",
  ),
);

async function createPeer(hybrid = true) {
  const r = await new IdentityRatchet({ deviceId: "peer" }).generate();
  if (hybrid) return r;
  // classical-only: rebuild public key from x25519 + ed25519 components only
  const bootstrap = require(
    path.resolve(
      process.cwd(),
      "server",
      "lib",
      "crypto",
      "ratchet",
      "hybrid-bootstrap.cjs",
    ),
  );
  const components = bootstrap.deserializePublicKey(r.publicKey);
  const classicalPublic = bootstrap.serializePublicKey({
    [bootstrap.COMP_ED25519]: components[bootstrap.COMP_ED25519],
    [bootstrap.COMP_X25519]: components[bootstrap.COMP_X25519],
  });
  return new IdentityRatchet({
    deviceId: r.deviceId,
    secretKey: r.secretKey,
    publicKey: classicalPublic,
  });
}

describe("Compatibility Shim (Track 113)", () => {
  it("detects HYBRID for full public key", async () => {
    const peer = await createPeer(true);
    assert.strictEqual(detectMode(peer.publicKey).mode, "HYBRID");
  });

  it("detects CLASSICAL for PQC-stripped public key", async () => {
    const peer = await createPeer(false);
    assert.strictEqual(detectMode(peer.publicKey).mode, "CLASSICAL");
  });

  it("completes hybrid handshake end-to-end", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();

    const init = await initiateHandshake(alice, bob.publicKey);
    assert.strictEqual(init.mode, "HYBRID");
    const accept = await acceptHandshake(bob, init.handshake, alice.publicKey);
    assert.strictEqual(accept.mode, "HYBRID");
    assert.strictEqual(init.chainKey, accept.chainKey);
  });

  it("completes classical handshake end-to-end", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await createPeer(false);
    const telemetry = [];
    const init = await initiateHandshake(alice, bob.publicKey, {
      telemetry: (ev) => telemetry.push(ev),
    });
    assert.strictEqual(init.mode, "CLASSICAL");
    assert.ok(telemetry.includes("IDENTITY_COMPAT_CLASSICAL_FALLBACK"));
    const accept = await acceptHandshake(bob, init.handshake, alice.publicKey);
    assert.strictEqual(accept.mode, "CLASSICAL");
    assert.strictEqual(init.chainKey, accept.chainKey);
  });

  it("rejects handshake past deprecation deadline", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await createPeer(false);
    const past = Date.now() - 1000;
    await assert.rejects(
      () =>
        initiateHandshake(alice, bob.publicKey, {
          deprecationDeadline: past,
          now: Date.now(),
        }),
      (err) =>
        err instanceof CompatibilityError &&
        err.code === "CLASSICAL_DEPRECATION_DEADLINE",
    );
  });

  it("rejects invalid public key", async () => {
    await assert.rejects(
      () => detectMode(Buffer.alloc(0)),
      (err) => err instanceof CompatibilityError,
    );
  });

  it("records hybrid and classical handshake duration metrics", async () => {
    const metrics = new RatchetMetrics();
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await createPeer(true);
    const init = await initiateHandshake(alice, bob.publicKey, { metrics });
    const accept = await acceptHandshake(bob, init.handshake, alice.publicKey, {
      metrics,
    });
    assert.strictEqual(init.chainKey, accept.chainKey);

    const snap = metrics.snapshot();
    assert.ok(
      snap.identity_handshake_duration_ms.hybrid,
      "hybrid duration recorded",
    );
    assert.strictEqual(snap.identity_handshake_duration_ms.hybrid.count, 2);
    assert.strictEqual(
      snap.identity_handshake_failed_total["signature_invalid"] || 0,
      0,
    );
  });

  it("records failure metrics for expired deadline", async () => {
    const metrics = new RatchetMetrics();
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await createPeer(false);
    await assert.rejects(
      () =>
        initiateHandshake(alice, bob.publicKey, {
          metrics,
          deprecationDeadline: Date.now() - 1,
          now: Date.now(),
        }),
      (err) => err instanceof CompatibilityError,
    );
    const snap = metrics.snapshot();
    assert.ok(snap.identity_handshake_failed_total.expired_deadline >= 1);
  });
});
