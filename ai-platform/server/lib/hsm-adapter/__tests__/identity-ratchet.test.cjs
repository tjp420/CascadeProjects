"use strict";

/**
 * Track 30: PQC identity ratchet and MFA binding tests.
 */
const { PqcIdentityRatchet } = require("../pqc-identity-ratchet.cjs");
const { MfaBindingGuard } = require("../mfa-binding-guard.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 30 PQC identity ratchet", () => {
  test("ratchet derives a new chain key and emits telemetry", () => {
    const events = [];
    const ratchet = new PqcIdentityRatchet({
      deviceId: "device-1",
      scheme: "ml-kem-768",
      audit: (event, info) => events.push({ event, info }),
    });
    const initial = ratchet.getChainKey();
    const result = ratchet.step(Buffer.from("shared-secret"));
    expect(result.chainKey).not.toBe(initial);
    expect(result.skipped).toBe(1);
    expect(events.some((e) => e.event === "IDENTITY_RATCHET_STEPPED")).toBe(
      true,
    );
  });

  test("MFA guard accepts a valid token", () => {
    const guard = new MfaBindingGuard({ minSignatures: 2 });
    const token = MfaBindingGuard.generateToken("device-1");
    expect(guard.validate(token, "device-1")).toBe(true);
  });

  test("MFA guard rejects expired token", () => {
    const guard = new MfaBindingGuard({ tokenExpiryMs: 1 });
    const token = MfaBindingGuard.generateToken("device-1", Date.now() - 10);
    expect(() => guard.validate(token, "device-1")).toThrow(HsmAdapterError);
  });

  test("MFA guard rejects insufficient signatures", () => {
    const guard = new MfaBindingGuard({ minSignatures: 3 });
    const token = MfaBindingGuard.generateToken("device-1");
    expect(() => guard.validate(token, "device-1")).toThrow(HsmAdapterError);
  });

  test("MFA guard rejects device mismatch", () => {
    const guard = new MfaBindingGuard();
    const token = MfaBindingGuard.generateToken("device-1");
    expect(() => guard.validate(token, "device-2")).toThrow(HsmAdapterError);
  });

  test("CryptoPolicyEngine validates identity configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "identity", {
        kemLevel: 768,
        scheme: "ml-kem-768",
        skipped: 500,
        mfaBinding: true,
        mfaSignatures: 2,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "identity", {
        kemLevel: 2048,
      }),
    ).toThrow(HsmAdapterError);

    expect(() =>
      engine.validate("t1", "identity", {
        scheme: "rsa-oaep",
      }),
    ).toThrow(HsmAdapterError);
  });

  test("regression: ratchet requires shared secret", () => {
    const ratchet = new PqcIdentityRatchet({ deviceId: "d" });
    expect(() => ratchet.step("")).toThrow(HsmAdapterError);
  });
});
