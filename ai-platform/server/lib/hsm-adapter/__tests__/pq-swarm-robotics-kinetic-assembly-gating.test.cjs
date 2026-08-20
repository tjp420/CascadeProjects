"use strict";

/**
 * Tests for Track 114: PQC Swarm Robotics Kinetic Assembly Gating Hub.
 */

const {
  PqcSwarmRoboticsKineticAssemblyGatingHub,
} = require("../pqc-swarm-robotics-kinetic-assembly-gating-hub.cjs");
const {
  ZkKineticClaimValidator,
} = require("../zk-kinetic-claim-validator.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

const DEFAULT_POLICY = {
  minRoboticQuorum: 40,
  maxKineticValidationWindowSeconds: 1,
  maxKineticAssemblyChainDepth: 80,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  allowedAttestationAuthorities: ["mock-authority"],
  requireKineticAssemblyAuthorityInitializerAttestation: false,
  requireAssemblyEthicsOversightCommitteeAttestation: false,
};

function makeHub() {
  return new PqcSwarmRoboticsKineticAssemblyGatingHub({
    policy: DEFAULT_POLICY,
  });
}

function makeValidator() {
  return new ZkKineticClaimValidator({ policy: DEFAULT_POLICY });
}

function expectErrorCode(fn) {
  try {
    fn();
    return undefined;
  } catch (err) {
    return err.code;
  }
}

describe("Track 114 PQC Swarm Robotics Kinetic Assembly Gating Hub", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("initializes a kinetic assembly pool and increments counter", () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedIsogenyKeyExchangeDigestCommitment: "isogeny-commit",
      blindedKineticPostureCommitment: "posture-commit",
      blindedAssemblyStateCommitment: "assembly-commit",
      pqcSignatureScheme: "ML-DSA-87",
      attestationAuthority: "mock-authority",
      roboticQuorum: 45,
      kineticValidationWindowSeconds: 1,
      kineticAssemblyChainDepth: 64,
    });
    expect(pool).toMatchObject({
      status: "open",
      pqcSignatureScheme: "ML-DSA-87",
    });
    expect(hub.getPool(pool.poolId)).toEqual(pool);
    expect(hsmMetrics.getMetrics().hsm_kineticgate_pool_initialized_total).toBe(
      1,
    );
  });

  test("rejects initialize when kinetic validation window exceeds 1 second", () => {
    const hub = makeHub();
    const code = expectErrorCode(() =>
      hub.initializePool({
        blindedIsogenyKeyExchangeDigestCommitment: "isogeny-commit",
        blindedKineticPostureCommitment: "posture-commit",
        kineticValidationWindowSeconds: 2,
        pqcSignatureScheme: "ML-DSA-87",
      }),
    );
    expect(code).toBe("KINETICGATE_POSTURE_VALIDATION_WINDOW_EXCEEDED");
  });

  test("rejects initialize with disallowed PQC scheme", () => {
    const hub = makeHub();
    const code = expectErrorCode(() =>
      hub.initializePool({
        blindedIsogenyKeyExchangeDigestCommitment: "isogeny-commit",
        blindedKineticPostureCommitment: "posture-commit",
        pqcSignatureScheme: "falcon-512",
      }),
    );
    expect(code).toBe("KINETICGATE_PQC_SCHEME_BLOCKED");
  });

  test("verifies kinetic posture and increments counter", () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedIsogenyKeyExchangeDigestCommitment: "isogeny-commit",
      blindedKineticPostureCommitment: "posture-commit",
      pqcSignatureScheme: "ML-DSA-87",
    });
    const verified = hub.verifyKineticPosture({
      poolId: pool.poolId,
      proofValid: true,
    });
    expect(verified.kineticPostureVerified).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_kinetic_posture_verified_total).toBe(
      1,
    );
  });

  test("completes assembly accreditation with sufficient quorum", () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedIsogenyKeyExchangeDigestCommitment: "isogeny-commit",
      blindedKineticPostureCommitment: "posture-commit",
      pqcSignatureScheme: "ML-DSA-87",
    });
    hub.verifyKineticPosture({ poolId: pool.poolId, proofValid: true });
    const result = hub.completeAssemblyAccreditation({
      poolId: pool.poolId,
      roboticSignatures: new Array(40).fill("sig"),
    });
    expect(result.status).toBe("accredited");
    expect(
      hsmMetrics.getMetrics().hsm_assembly_accreditation_completed_total,
    ).toBe(1);
  });

  test("rejects assembly accreditation with insufficient quorum", () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedIsogenyKeyExchangeDigestCommitment: "isogeny-commit",
      blindedKineticPostureCommitment: "posture-commit",
      pqcSignatureScheme: "ML-DSA-87",
    });
    hub.verifyKineticPosture({ poolId: pool.poolId, proofValid: true });
    const code = expectErrorCode(() =>
      hub.completeAssemblyAccreditation({
        poolId: pool.poolId,
        roboticSignatures: new Array(12).fill("sig"),
      }),
    );
    expect(code).toBe("KINETICGATE_QUORUM_INSUFFICIENT");
  });
});

describe("Track 114 ZkKineticClaimValidator", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("validates a fresh claim within 1-second window", () => {
    const validator = makeValidator();
    const result = validator.validateClaim({
      poolId: "kinetic-1",
      isogenyKeyExchangeDigest: "digest-1",
      timestampMs: Date.now() - 250,
      proofValid: true,
    });
    expect(result.valid).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_kinetic_posture_verified_total).toBe(
      1,
    );
  });

  test("drops a posture timestamp 1001ms old with POSTURE_VALIDATION_WINDOW_EXCEEDED", () => {
    const validator = makeValidator();
    const code = expectErrorCode(() =>
      validator.validateClaim({
        poolId: "kinetic-1",
        isogenyKeyExchangeDigest: "digest-1",
        timestampMs: Date.now() - 1001,
        proofValid: true,
      }),
    );
    expect(code).toBe("KINETICCLAIM_POSTURE_VALIDATION_WINDOW_EXCEEDED");
  });

  test("rejects a claim with excessive kinetic assembly chain depth", () => {
    const validator = makeValidator();
    const code = expectErrorCode(() =>
      validator.validateClaim({
        poolId: "kinetic-1",
        isogenyKeyExchangeDigest: "digest-1",
        timestampMs: Date.now(),
        kineticAssemblyChainDepth: 120,
        proofValid: true,
      }),
    );
    expect(code).toBe("KINETICCLAIM_ASSEMBLY_CHAIN_DEPTH_EXCEEDED");
  });

  test("rejects a claim with disallowed PQC signature scheme", () => {
    const validator = makeValidator();
    const code = expectErrorCode(() =>
      validator.validateClaim({
        poolId: "kinetic-1",
        isogenyKeyExchangeDigest: "digest-1",
        timestampMs: Date.now(),
        pqcSignatureScheme: "falcon-512",
        proofValid: true,
      }),
    );
    expect(code).toBe("KINETICCLAIM_PQC_SCHEME_BLOCKED");
  });
});
