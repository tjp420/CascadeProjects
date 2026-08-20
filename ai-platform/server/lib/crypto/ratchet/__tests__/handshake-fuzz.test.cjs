"use strict";

/**
 * Track 113: Fuzzing and interop tests for handshake resilience.
 *
 * Covers Issue #408 acceptance criteria:
 * - Fuzzing for handshake resilience (malformed inputs, truncated buffers,
 *   version mismatches, component injection attacks)
 * - Interop: two independent ratchet instances converge to the same key
 *   after hybrid and classical handshakes
 *
 * @module crypto/ratchet/__tests__/handshake-fuzz.test.cjs
 */

const assert = require("node:assert");
const { describe, it } = require("node:test");
const path = require("path");
const crypto = require("node:crypto");

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
const {
  initiateHandshake,
  acceptHandshake,
  detectMode,
  CompatibilityError,
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

describe("Track 113 — Handshake Fuzzing", () => {
  describe("deserializePublicKey fuzzing", () => {
    it("rejects empty buffer", () => {
      assert.throws(
        () => bootstrap.deserializePublicKey(Buffer.alloc(0)),
        bootstrap.HybridBootstrapError,
      );
    });

    it("rejects single-byte buffer", () => {
      assert.throws(
        () => bootstrap.deserializePublicKey(Buffer.from([0x01])),
        bootstrap.HybridBootstrapError,
      );
    });

    it("rejects unsupported version", () => {
      assert.throws(
        () => bootstrap.deserializePublicKey(Buffer.from([0xff, 0x00])),
        (err) =>
          err instanceof bootstrap.HybridBootstrapError &&
          err.code === "UNSUPPORTED_HYBRID_KEY_VERSION",
      );
    });

    it("rejects truncated component header", () => {
      // version=1, numComponents=3, but only 2 bytes follow (need 3 per component header)
      assert.throws(
        () =>
          bootstrap.deserializePublicKey(Buffer.from([0x01, 0x03, 0x01, 0x00])),
        (err) =>
          err instanceof bootstrap.HybridBootstrapError &&
          err.code === "INVALID_HYBRID_KEY_LAYOUT",
      );
    });

    it("rejects component length exceeding buffer", () => {
      // version=1, numComponents=1, component id=1, length=999 (but only 2 bytes follow)
      const buf = Buffer.alloc(7);
      buf[0] = 0x01; // version
      buf[1] = 0x01; // 1 component
      buf[2] = 0x01; // component id = ed25519
      buf.writeUInt16BE(999, 3); // length = 999
      buf[5] = 0xaa;
      buf[6] = 0xbb;
      assert.throws(
        () => bootstrap.deserializePublicKey(buf),
        (err) =>
          err instanceof bootstrap.HybridBootstrapError &&
          err.code === "INVALID_HYBRID_KEY_LAYOUT",
      );
    });

    it("returns empty components for zero-component key (parser tolerates, encapsulate rejects)", () => {
      // deserializePublicKey with numComponents=0 returns {} — the parser
      // doesn't enforce a minimum. The error surfaces later in encapsulate/
      // detectMode when a required component is missing.
      const components = bootstrap.deserializePublicKey(
        Buffer.from([0x01, 0x00]),
      );
      assert.strictEqual(Object.keys(components).length, 0);
    });
  });

  describe("encapsulate/decapsulate fuzzing", () => {
    it("rejects random bytes as public key", async () => {
      const garbage = crypto.randomBytes(64);
      await assert.rejects(
        () => bootstrap.encapsulate(garbage),
        bootstrap.HybridBootstrapError,
      );
    }, 60000);

    it("rejects truncated cipherText", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      const enc = await alice.encapsulateFor(bob.publicKey);
      // Truncate the cipherText to 10 bytes (way too short)
      const truncated = enc.cipherText.subarray(0, 10);
      await assert.rejects(
        () => bob.decapsulateFrom(truncated),
        (err) => err instanceof bootstrap.HybridBootstrapError,
      );
    }, 60000);

    it("rejects cipherText with wrong version byte", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      const enc = await alice.encapsulateFor(bob.publicKey);
      // Corrupt the version byte
      const corrupted = Buffer.from(enc.cipherText);
      corrupted[0] = 0xff;
      await assert.rejects(
        () => bob.decapsulateFrom(corrupted),
        (err) =>
          err instanceof bootstrap.HybridBootstrapError &&
          err.code === "UNSUPPORTED_HYBRID_KEY_VERSION",
      );
    }, 60000);

    it("rejects cipherText with corrupted ML-KEM component", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      const enc = await alice.encapsulateFor(bob.publicKey);
      // Corrupt bytes in the middle of the ML-KEM ciphertext (bytes 100-110)
      const corrupted = Buffer.from(enc.cipherText);
      for (let i = 100; i < 110 && i < corrupted.length; i++) {
        corrupted[i] = corrupted[i] ^ 0xff;
      }
      // Decapsulation may either throw or produce a wrong key.
      // ML-KEM is designed to fail silently (produce wrong secret) on corruption,
      // so we check that the chain key does NOT match the original.
      try {
        const dec = await bob.decapsulateFrom(corrupted);
        // If it doesn't throw, the chain key should differ from the original
        assert.notStrictEqual(
          enc.chainKey,
          dec.chainKey,
          "corrupted cipherText should not produce same key",
        );
      } catch (e) {
        // Acceptable: ML-KEM decapsulation throws on corrupted input
        assert.ok(
          e instanceof bootstrap.HybridBootstrapError || e instanceof Error,
        );
      }
    }, 60000);

    it("rejects empty cipherText", async () => {
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      await assert.rejects(
        () => bob.decapsulateFrom(Buffer.alloc(0)),
        (err) => err instanceof bootstrap.HybridBootstrapError,
      );
    }, 60000);
  });

  describe("signature fuzzing", () => {
    it("rejects corrupted signature", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      const transcript = Buffer.from("handshake-v1");
      const signature = alice.signHandshake(transcript);
      // Flip one bit in the signature
      const corrupted = Buffer.from(signature);
      corrupted[0] = corrupted[0] ^ 0x01;
      assert.strictEqual(
        bob.verifyHandshake(corrupted, transcript, alice.publicKey),
        false,
      );
    });

    it("rejects signature with wrong transcript", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      const signature = alice.signHandshake(Buffer.from("handshake-v1"));
      assert.strictEqual(
        bob.verifyHandshake(
          signature,
          Buffer.from("handshake-v2"),
          alice.publicKey,
        ),
        false,
      );
    });

    it("rejects signature with wrong public key", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      const carol = await new IdentityRatchet({ deviceId: "carol" }).generate();
      const transcript = Buffer.from("handshake-v1");
      const signature = alice.signHandshake(transcript);
      assert.strictEqual(
        bob.verifyHandshake(signature, transcript, carol.publicKey),
        false,
      );
    });
  });

  describe("compatibility shim fuzzing", () => {
    it("rejects handshake with invalid version byte", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      // Create a handshake with an invalid version byte
      const fakeHandshake = Buffer.concat([
        Buffer.from([0xff]),
        crypto.randomBytes(100),
      ]);
      await assert.rejects(
        () => acceptHandshake(bob, fakeHandshake, alice.publicKey),
        (err) => err instanceof CompatibilityError,
      );
    }, 60000);

    it("rejects handshake with truncated classical payload", async () => {
      const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
      const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
      // Classical handshake version with too-short payload
      const fakeHandshake = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await assert.rejects(
        () => acceptHandshake(bob, fakeHandshake, alice.publicKey),
        (err) => err instanceof CompatibilityError,
      );
    }, 60000);

    it("rejects detectMode for random bytes", () => {
      assert.throws(
        () => detectMode(crypto.randomBytes(32)),
        CompatibilityError,
      );
    });

    it("rejects detectMode for buffer with valid version but no components", () => {
      // version=1 but numComponents=0
      assert.throws(
        () => detectMode(Buffer.from([0x01, 0x00])),
        (err) => err instanceof CompatibilityError,
      );
    });
  });

  describe("randomized fuzzing (50 iterations)", () => {
    it("survives random garbage inputs without crashing", async () => {
      for (let i = 0; i < 50; i++) {
        const garbage = crypto.randomBytes(Math.floor(Math.random() * 256));
        // Should throw a typed error, not crash. However, random bytes may
        // accidentally form a valid-looking structure (e.g. version byte 0x01
        // with valid component headers), so success is also acceptable.
        try {
          await bootstrap.encapsulate(garbage);
        } catch (e) {
          assert.ok(e instanceof bootstrap.HybridBootstrapError);
        }
        try {
          bootstrap.deserializePublicKey(garbage);
        } catch (e) {
          assert.ok(e instanceof bootstrap.HybridBootstrapError);
        }
        try {
          detectMode(garbage);
        } catch (e) {
          assert.ok(
            e instanceof CompatibilityError ||
              e instanceof bootstrap.HybridBootstrapError,
          );
        }
      }
    }, 60000);
  });
});

describe("Track 113 — Interop Tests", () => {
  it("two ratchets converge to same key after hybrid handshake", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();

    const enc = await alice.encapsulateFor(bob.publicKey);
    const dec = await bob.decapsulateFrom(enc.cipherText);

    assert.strictEqual(
      enc.chainKey,
      dec.chainKey,
      "Alice and Bob must converge to the same chain key",
    );
  }, 60000);

  it("two ratchets converge to same key after compatibility shim hybrid handshake", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();

    const init = await initiateHandshake(alice, bob.publicKey);
    const accept = await acceptHandshake(bob, init.handshake, alice.publicKey);

    assert.strictEqual(init.mode, "HYBRID");
    assert.strictEqual(accept.mode, "HYBRID");
    assert.strictEqual(
      init.chainKey,
      accept.chainKey,
      "Initiator and acceptor must converge",
    );
  }, 60000);

  it("two ratchets converge to same key after classical fallback handshake", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    // Bob is classical-only (no ML-KEM component)
    const bobFull = await new IdentityRatchet({ deviceId: "bob" }).generate();
    const components = bootstrap.deserializePublicKey(bobFull.publicKey);
    const classicalPublic = bootstrap.serializePublicKey({
      [bootstrap.COMP_ED25519]: components[bootstrap.COMP_ED25519],
      [bootstrap.COMP_X25519]: components[bootstrap.COMP_X25519],
    });
    const bob = new IdentityRatchet({
      deviceId: "bob",
      secretKey: bobFull.secretKey,
      publicKey: classicalPublic,
    });

    const init = await initiateHandshake(alice, bob.publicKey);
    const accept = await acceptHandshake(bob, init.handshake, alice.publicKey);

    assert.strictEqual(init.mode, "CLASSICAL");
    assert.strictEqual(accept.mode, "CLASSICAL");
    assert.strictEqual(
      init.chainKey,
      accept.chainKey,
      "Classical handshake must converge",
    );
  }, 60000);

  it("stepped message keys match between two converged ratchets", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();

    // Establish shared secret
    const enc = await alice.encapsulateFor(bob.publicKey);
    await bob.decapsulateFrom(enc.cipherText);

    // Both should produce the same message keys for the first N steps
    for (let i = 0; i < 5; i++) {
      const aliceKey = alice.step().toString("hex");
      const bobKey = bob.step().toString("hex");
      assert.strictEqual(
        aliceKey,
        bobKey,
        `Message key ${i} must match after convergence`,
      );
    }
  }, 60000);

  it("rotation produces matching keys on both sides", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();

    const enc = await alice.encapsulateFor(bob.publicKey);
    await bob.decapsulateFrom(enc.cipherText);

    // Both rotate
    const aliceResult = alice.rotateNow();
    const bobResult = bob.rotateNow();

    assert.strictEqual(
      aliceResult.chainKey,
      bobResult.chainKey,
      "Rotated chain keys must match",
    );
    assert.strictEqual(
      aliceResult.rotationEpoch,
      bobResult.rotationEpoch,
      "Rotation epochs must match",
    );

    // Post-rotation message keys should also match
    const aliceKey = alice.step().toString("hex");
    const bobKey = bob.step().toString("hex");
    assert.strictEqual(
      aliceKey,
      bobKey,
      "Post-rotation message keys must match",
    );
  }, 60000);

  it("three-party handshake: Alice → Bob and Alice → Carol produce different keys", async () => {
    const alice = await new IdentityRatchet({ deviceId: "alice" }).generate();
    const bob = await new IdentityRatchet({ deviceId: "bob" }).generate();
    const carol = await new IdentityRatchet({ deviceId: "carol" }).generate();

    const encBob = await alice.encapsulateFor(bob.publicKey);
    const decBob = await bob.decapsulateFrom(encBob.cipherText);

    const encCarol = await alice.encapsulateFor(carol.publicKey);
    const decCarol = await carol.decapsulateFrom(encCarol.cipherText);

    assert.strictEqual(encBob.chainKey, decBob.chainKey);
    assert.strictEqual(encCarol.chainKey, decCarol.chainKey);
    assert.notStrictEqual(
      encBob.chainKey,
      encCarol.chainKey,
      "Different peers must get different keys",
    );
  }, 60000);
});
