"use strict";

/**
 * Track 43B: Disaster recovery tests.
 */
const {
  ClusterDisasterRecoveryCoordinator,
} = require("../cluster-disaster-recovery-coordinator.cjs");
const {
  CrossRegionStateReconstructor,
} = require("../cross-region-state-reconstructor.cjs");
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
  maxCrossRegionHeartbeatLatencyMs: 5000,
  minFailoverQuorumNodes: 3,
  allowedFailoverModes: ["bft-vote", "operator-override"],
  requireStandbyAttestation: true,
  allowedStandbyAuthorities: ["mock-authority"],
  maxStateReconstructionAgeSeconds: 60,
  requireByzantineFaultProofs: true,
  minSurvivingRegions: 2,
};

describe("Track 43B disaster recovery", () => {
  test("BFT failover quorum triggers REGIONAL_FAILOVER_INITIATED", () => {
    const events = [];
    const coordinator = new ClusterDisasterRecoveryCoordinator({
      policy: POLICY,
      regions: [{ id: "us-east" }, { id: "eu-west" }, { id: "ap-south" }],
      audit: (event, info) => events.push({ event, info }),
    });
    coordinator.heartbeat("us-east", Date.now(), 6000);
    coordinator.voteFailover("us-east", "monitor-1");
    coordinator.voteFailover("us-east", "monitor-2");
    const result = coordinator.voteFailover("us-east", "monitor-3");
    expect(result.initiated).toBe(true);
    expect(coordinator.isFailed("us-east")).toBe(true);
    expect(events.some((e) => e.event === "REGIONAL_FAILOVER_INITIATED")).toBe(
      true,
    );
  });

  test("failover does not trigger without enough votes", () => {
    const coordinator = new ClusterDisasterRecoveryCoordinator({
      policy: POLICY,
      regions: [{ id: "us-east" }],
    });
    coordinator.heartbeat("us-east", Date.now(), 6000);
    const result = coordinator.voteFailover("us-east", "monitor-1");
    expect(result.initiated).toBeUndefined();
    expect(coordinator.isFailed("us-east")).toBe(false);
  });

  test("healthy region rejects failover vote", () => {
    const coordinator = new ClusterDisasterRecoveryCoordinator({
      policy: POLICY,
      regions: [{ id: "us-east" }],
    });
    coordinator.heartbeat("us-east", Date.now(), 100);
    const result = coordinator.voteFailover("us-east", "monitor-1");
    expect(result.voted).toBe(false);
  });

  test("operator override failover works with valid token", () => {
    const events = [];
    const coordinator = new ClusterDisasterRecoveryCoordinator({
      policy: POLICY,
      regions: [{ id: "us-east" }],
      audit: (event, info) => events.push({ event, info }),
    });
    const result = coordinator.operatorOverride(
      "us-east",
      "valid-operator-token",
    );
    expect(result.initiated).toBe(true);
    expect(events.some((e) => e.event === "REGIONAL_FAILOVER_INITIATED")).toBe(
      true,
    );
  });

  test("CrossRegionStateReconstructor provisions attested standby cluster from reconciliation digest", () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    attestationClient.verify({
      version: 1,
      enclaveType: "mock",
      measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
      mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
      timestamp: Math.floor(Date.now() / 1000),
      attestationAgeSeconds: 0,
      authority: "mock-authority",
      signature: "mock-signature-placeholder",
    });
    const reconstructor = new CrossRegionStateReconstructor({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const attestationDoc = {
      version: 1,
      enclaveType: "mock",
      measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
      mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
      timestamp: Math.floor(Date.now() / 1000),
      attestationAgeSeconds: 0,
      authority: "mock-authority",
      signature: "mock-signature-placeholder",
    };
    const reconciliationDigest = {
      keyId: "kek-001",
      severity: "none",
      divergentNodes: [],
      quorumEpoch: 7,
      majorityFingerprint: "abcdef1234567890",
      majorityCount: 2,
      fingerprintGroups: 1,
      ageSeconds: 0,
    };
    const result = reconstructor.reconstruct(
      ["eu-west", "ap-south"],
      ["standby-1"],
      reconciliationDigest,
      { "standby-1": attestationDoc },
    );
    expect(result.reconstructed).toBe(true);
    expect(result.keyRing).toBe("kek-ring-abcdef1234567890-7");
    expect(result.keyId).toBe("kek-001");
    expect(result.quorumEpoch).toBe(7);
    expect(events.some((e) => e.event === "STANDBY_CLUSTER_PROVISIONED")).toBe(
      true,
    );
  });

  test("CrossRegionStateReconstructor provisions attested standby cluster from live cluster reconciler", () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const {
      ClusterKeyReconciliationEngine,
    } = require("../cluster-key-reconciliation-engine.cjs");
    const clusterReconciler = new ClusterKeyReconciliationEngine({
      clusterNodes: ["eu-west", "ap-south"],
      minQuorumNodes: 2,
      audit: () => {},
    });
    clusterReconciler.registerKey(
      "kek-001",
      "eu-west",
      7,
      "shared-key-material",
    );
    clusterReconciler.registerKey(
      "kek-001",
      "ap-south",
      7,
      "shared-key-material",
    );
    clusterReconciler.scan();
    const reconstructor = new CrossRegionStateReconstructor({
      policy: POLICY,
      attestationClient,
      clusterReconciler,
      audit: (event, info) => events.push({ event, info }),
    });
    const attestationDoc = {
      version: 1,
      enclaveType: "mock",
      measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
      mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
      timestamp: Math.floor(Date.now() / 1000),
      attestationAgeSeconds: 0,
      authority: "mock-authority",
      signature: "mock-signature-placeholder",
    };
    const result = reconstructor.reconstruct(
      ["eu-west", "ap-south"],
      ["standby-1"],
      "kek-001",
      { "standby-1": attestationDoc },
    );
    expect(result.reconstructed).toBe(true);
    expect(result.keyId).toBe("kek-001");
    expect(result.keyRing.startsWith("kek-ring-")).toBe(true);
    expect(events.some((e) => e.event === "STANDBY_CLUSTER_PROVISIONED")).toBe(
      true,
    );
  });

  test("CrossRegionStateReconstructor rejects critical divergence digest", () => {
    const attestationClient = new MockAttestationClient();
    const reconstructor = new CrossRegionStateReconstructor({
      policy: POLICY,
      attestationClient,
    });
    const attestationDoc = {
      version: 1,
      enclaveType: "mock",
      measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
      mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
      timestamp: Math.floor(Date.now() / 1000),
      attestationAgeSeconds: 0,
      authority: "mock-authority",
      signature: "mock-signature-placeholder",
    };
    const reconciliationDigest = {
      keyId: "kek-001",
      severity: "critical",
      divergentNodes: [
        { nodeId: "eu-west", epoch: 5, fingerprint: "a" },
        { nodeId: "ap-south", epoch: 6, fingerprint: "b" },
      ],
      quorumEpoch: 5,
      majorityFingerprint: "a",
      majorityCount: 1,
      fingerprintGroups: 2,
      ageSeconds: 0,
    };
    expect(() =>
      reconstructor.reconstruct(
        ["eu-west", "ap-south"],
        ["standby-1"],
        reconciliationDigest,
        { "standby-1": attestationDoc },
      ),
    ).toThrow(HsmAdapterError);
  });

  test("CrossRegionStateReconstructor rejects un-attested standby", () => {
    const attestationClient = new MockAttestationClient();
    const reconstructor = new CrossRegionStateReconstructor({
      policy: POLICY,
      attestationClient,
    });
    expect(() =>
      reconstructor.reconstruct(
        ["eu-west", "ap-south"],
        ["standby-1"],
        [{ index: 1, value: 101n, ageSeconds: 0 }],
      ),
    ).toThrow(HsmAdapterError);
  });

  test("CrossRegionStateReconstructor rejects insufficient surviving regions", () => {
    const reconstructor = new CrossRegionStateReconstructor({
      policy: POLICY,
    });
    expect(() =>
      reconstructor.reconstruct(
        ["eu-west"],
        [],
        [{ index: 1, value: 101n, ageSeconds: 0 }],
      ),
    ).toThrow(HsmAdapterError);
  });

  test("CryptoPolicyEngine validates disaster recovery configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "disasterRecovery", {
        crossRegionHeartbeatLatencyMs: 5000,
        failoverQuorumNodes: 3,
        failoverMode: "bft-vote",
        standbyAttestation: true,
        standbyAuthority: "mock-authority",
        stateReconstructionAgeSeconds: 60,
        survivingRegions: 2,
        byantineFaultProofs: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "disasterRecovery", {
        crossRegionHeartbeatLatencyMs: 10000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", { failoverQuorumNodes: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", { failoverMode: "auto" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", { standbyAttestation: false }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", { standbyAuthority: "bad" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", {
        stateReconstructionAgeSeconds: 999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", { survivingRegions: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "disasterRecovery", { byantineFaultProofs: false }),
    ).toThrow(HsmAdapterError);
  });
});
