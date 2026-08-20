"use strict";

/**
 * Track 47: Hardware root rotation tests.
 */
const { EnclaveRootRotator } = require("../enclave-root-rotator.cjs");
const { EnclaveKeyDeriver } = require("../enclave-key-deriver.cjs");
const {
  EnclaveAttestationClient,
} = require("../enclave-attestation-client.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== "object")
      return { verified: false };
    if (!attestation.authority || attestation.authority !== "mock-authority")
      return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minAdminQuorum: 3,
  maxSignatureExpirationSeconds: 60,
  requireAdminAttestation: true,
  allowedAdminAuthorities: ["mock-authority"],
  requirePreviousSeedZeroization: true,
  maxRotationEpochIntervalSeconds: 86400,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation(ageSeconds = 0) {
  return {
    version: 1,
    enclaveType: "mock",
    measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
    mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
    timestamp: Math.floor(Date.now() / 1000) - ageSeconds,
    attestationAgeSeconds: ageSeconds,
    authority: "mock-authority",
    signature: "mock-signature-placeholder",
  };
}

function mockProposal(rotator) {
  const ts = Math.floor(Date.now() / 1000);
  return rotator.propose(
    1,
    Buffer.from("old-seed"),
    Buffer.from("new-seed"),
    "proposer-1",
    ts,
  );
}

describe("Track 47 hardware root rotation", () => {
  test("EnclaveRootRotator proposes and commits with quorum", () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const rotator = new EnclaveRootRotator({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const deriver = new EnclaveKeyDeriver();
    const proposal = mockProposal(rotator);
    expect(proposal.payload).toMatch(/^ROTATION:/);
    expect(
      events.some((e) => e.event === "ENCLAVE_ROOT_ROTATION_INITIATED"),
    ).toBe(true);

    rotator.sign(1, "admin-1", mockAttestation(), "sig-1");
    rotator.sign(1, "admin-2", mockAttestation(), "sig-2");
    rotator.sign(1, "admin-3", mockAttestation(), "sig-3");

    const result = rotator.commit(1, deriver);
    expect(result.committed).toBe(true);
    expect(result.rootKeys).toBeDefined();
    expect(result.rootKeys.public).toMatch(/^PK-/);
    expect(events.some((e) => e.event === "HARDWARE_SEED_COMMITTED")).toBe(
      true,
    );
  });

  test("EnclaveRootRotator rejects un-attested admin", () => {
    const attestationClient = new MockAttestationClient();
    const rotator = new EnclaveRootRotator({
      policy: POLICY,
      attestationClient,
    });
    mockProposal(rotator);
    expect(() =>
      rotator.sign(1, "admin-1", { authority: "bad" }, "sig-1"),
    ).toThrow(HsmAdapterError);
  });

  test("EnclaveRootRotator rejects expired signature", () => {
    const attestationClient = new MockAttestationClient();
    const rotator = new EnclaveRootRotator({
      policy: POLICY,
      attestationClient,
    });
    mockProposal(rotator);
    expect(() =>
      rotator.sign(1, "admin-1", mockAttestation(100), "sig-1"),
    ).toThrow(HsmAdapterError);
  });

  test("EnclaveRootRotator rejects commit without quorum", () => {
    const attestationClient = new MockAttestationClient();
    const rotator = new EnclaveRootRotator({
      policy: POLICY,
      attestationClient,
    });
    mockProposal(rotator);
    rotator.sign(1, "admin-1", mockAttestation(), "sig-1");
    expect(() => rotator.commit(1)).toThrow(HsmAdapterError);
  });

  test("EnclaveKeyDeriver regenerates root keys and zeroizes seed", () => {
    const deriver = new EnclaveKeyDeriver();
    const seed = Buffer.from("master-seed");
    const keys = deriver.derive(seed);
    expect(keys.public).toMatch(/^PK-/);
    expect(keys.private).toHaveLength(48);
    expect(seed.toString("hex")).toBe("00".repeat("master-seed".length));
    deriver.destroy(keys);
    expect(keys.private.toString("hex")).toBe("00".repeat(48));
  });

  test("CryptoPolicyEngine validates hardware root rotation configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", {
        adminQuorum: 3,
        signatureAgeSeconds: 30,
        adminAttestation: true,
        adminAuthority: "mock-authority",
        previousSeedZeroized: true,
        rotationEpochIntervalSeconds: 86400,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "hardwareRootRotation", { adminQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", {
        signatureAgeSeconds: 120,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", {
        adminAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", { adminAuthority: "bad" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", {
        previousSeedZeroized: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", {
        rotationEpochIntervalSeconds: 60,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "hardwareRootRotation", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
