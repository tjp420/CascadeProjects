"use strict";

/**
 * Track 46: Homomorphic computation tests.
 */
const {
  HomomorphicContractEngine,
  _pedersenCommitment,
} = require("../homomorphic-contract-engine.cjs");
const { ZkRangeProofProcessor } = require("../zk-range-proof-processor.cjs");
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
  allowedOperations: ["add", "scalarMul"],
  maxRangeBitWidth: 64,
  requireWorkerAttestation: true,
  allowedWorkerAuthorities: ["mock-authority"],
  maxContractVerificationWindowSeconds: 60,
  requireZkRangeProof: true,
  minRangeBits: 8,
  maxRangeBits: 4096,
};

const P = 170141183460469231731687303715884105727n;

function commitment(value, blinding) {
  return {
    value: typeof value === "bigint" ? value : BigInt(value),
    blinding: typeof blinding === "bigint" ? blinding : BigInt(blinding),
    commitment: _pedersenCommitment(value, blinding),
  };
}

function mockAttestation() {
  return {
    version: 1,
    enclaveType: "mock",
    measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
    mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: "mock-authority",
    signature: "mock-signature-placeholder",
  };
}

describe("Track 46 homomorphic computation", () => {
  test("HomomorphicContractEngine adds two encrypted commitments", () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const engine = new HomomorphicContractEngine({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const a = commitment(100n, 5n);
    const b = commitment(200n, 7n);
    const result = engine.execute("c-1", "add", [a, b], mockAttestation());
    expect(result.result.value).toBe(300n);
    expect(result.result.commitment).toBe(_pedersenCommitment(300n, 12n));
    expect(
      events.some((e) => e.event === "HOMOMORPHIC_CONTRACT_EXECUTED"),
    ).toBe(true);
  });

  test("HomomorphicContractEngine scalar multiplies a commitment", () => {
    const attestationClient = new MockAttestationClient();
    const engine = new HomomorphicContractEngine({
      policy: POLICY,
      attestationClient,
    });
    const a = commitment(50n, 3n);
    const result = engine.execute(
      "c-2",
      "scalarMul",
      [a, { scalar: 4n }],
      mockAttestation(),
    );
    expect(result.result.value).toBe(200n);
    expect(result.result.blinding).toBe(12n);
  });

  test("HomomorphicContractEngine rejects un-attested worker", () => {
    const attestationClient = new MockAttestationClient();
    const engine = new HomomorphicContractEngine({
      policy: POLICY,
      attestationClient,
    });
    expect(() =>
      engine.execute("c-1", "add", [commitment(1n, 1n), commitment(2n, 2n)], {
        authority: "bad",
      }),
    ).toThrow(HsmAdapterError);
  });

  test("HomomorphicContractEngine rejects a disallowed operation", () => {
    const attestationClient = new MockAttestationClient();
    const engine = new HomomorphicContractEngine({
      policy: POLICY,
      attestationClient,
    });
    expect(() =>
      engine.execute(
        "c-1",
        "mul",
        [commitment(1n, 1n), commitment(2n, 2n)],
        mockAttestation(),
      ),
    ).toThrow(HsmAdapterError);
  });

  test("ZkRangeProofProcessor generates and verifies a valid proof", () => {
    const events = [];
    const processor = new ZkRangeProofProcessor({
      policy: POLICY,
      audit: (event, info) => events.push({ event, info }),
    });
    const c = commitment(256n, 7n);
    const bundle = processor.generate("c-3", c, 0, 1000, mockAttestation());
    const result = processor.verify(bundle, mockAttestation());
    expect(result.verified).toBe(true);
    expect(events.some((e) => e.event === "ZK_RANGE_PROOF_VERIFIED")).toBe(
      true,
    );
  });

  test("ZkRangeProofProcessor rejects out-of-bounds value", () => {
    const processor = new ZkRangeProofProcessor({ policy: POLICY });
    const c = commitment(150n, 7n);
    expect(() =>
      processor.generate("c-4", c, 0, 100, mockAttestation()),
    ).toThrow(HsmAdapterError);
  });

  test("ZkRangeProofProcessor rejects bit width above maximum", () => {
    const processor = new ZkRangeProofProcessor({ policy: POLICY });
    const c = commitment(2n ** 70n, 7n);
    expect(() =>
      processor.generate("c-5", c, 0, 2n ** 70n, mockAttestation()),
    ).toThrow(HsmAdapterError);
  });

  test("CryptoPolicyEngine validates homomorphic computation configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "homomorphicComputation", {
        operation: "add",
        rangeBitWidth: 32,
        workerAttestation: true,
        workerAuthority: "mock-authority",
        contractVerificationWindowSeconds: 60,
        zkRangeProof: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "homomorphicComputation", { operation: "mul" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "homomorphicComputation", { rangeBitWidth: 4 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "homomorphicComputation", { rangeBitWidth: 8192 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "homomorphicComputation", {
        workerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "homomorphicComputation", {
        workerAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "homomorphicComputation", {
        contractVerificationWindowSeconds: 120,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "homomorphicComputation", { zkRangeProof: false }),
    ).toThrow(HsmAdapterError);
  });
});
