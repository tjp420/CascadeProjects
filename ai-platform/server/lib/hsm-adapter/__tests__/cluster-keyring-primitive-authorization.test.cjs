"use strict";

const {
  ClusterKeyringPrimitiveAuthorization,
} = require("../cluster-keyring-primitive-authorization.cjs");
const {
  PqcQuantumKeyDistributionLinkSwitchGatingHub,
} = require("../pqc-quantum-key-distribution-link-switch-gating-hub.cjs");
const {
  ZkQkdLinkClaimValidator,
} = require("../zk-qkd-link-claim-validator.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

class MockAttestationClient {
  constructor() {
    this._verifiedNodes = new Set();
  }
  verify(attestation) {
    if (!attestation || typeof attestation !== "object")
      return { verified: false };
    if (!attestation.authority || attestation.authority !== "mock-authority")
      return { verified: false };
    return { verified: true };
  }
  isNodeVerified(nodeId) {
    return this._verifiedNodes.has(nodeId);
  }
  isVerified(nodeId) {
    return this._verifiedNodes.has(nodeId);
  }
  markVerified(nodeId) {
    this._verifiedNodes.add(nodeId);
  }
}

class MockShardDisperser {
  constructor() {
    this.dispersed = [];
  }
  disperse(request) {
    const count = (request.destinations || []).length || 1;
    const result = { dispersed: count, shards: [] };
    this.dispersed.push({ request, result });
    return result;
  }
}

class MockRatchet {
  constructor() {
    this.evolved = [];
  }
  evolveShare(token, epochId) {
    const result = {
      nodeIndex: token.nodeIndex,
      sequence: token.sequence,
      value: token.value + 1n,
      ratchet: { derivedAt: Date.now(), epoch: epochId },
    };
    this.evolved.push({ token, epochId, result });
    return result;
  }
}

class MockStateSync {
  constructor() {
    this.synced = [];
  }
  syncState(shardId, targetEnclaveId) {
    const result = { shardId, targetEnclaveId, syncedAt: Date.now() };
    this.synced.push(result);
    return result;
  }
}

class MockReconciler {
  constructor() {
    this.divergence = { severity: "none", divergentNodes: [] };
  }
  detectDivergence(keyId) {
    return { keyId, ...this.divergence };
  }
}

class MockKeyringSync {
  constructor() {
    this.events = [];
  }
  recordTelemetry(eventType, node, details) {
    this.events.push({ eventType, node, details, timestamp: Date.now() });
  }
}

const POLICY = {
  minAuthorizationQuorum: 3,
  maxSyncWindowSeconds: 300,
  maxAuthorizedPoolRetentionSeconds: 86400,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireNodeAttestation: true,
  requireAccreditedPoolStatus: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banUnauthorizedShareDispersal: true,
  requireCanonicalPayloadLayout: true,
};

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

function setupGate() {
  const attestationClient = new MockAttestationClient();
  attestationClient.markVerified("optical-001");
  const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({
    policy: {
      minQkdQuorum: 18,
      maxEntanglementWindowSeconds: 60,
      maxQkdSwitchChainDepth: 42,
      allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      requireQkdLinkAuthorityInitializerAttestation: true,
      requireQkdEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ["mock-authority"],
      banMalformedOrOutOfOrderQkdLinkClaims: true,
      requireCanonicalPayloadLayout: true,
    },
    attestationClient,
    audit: () => {},
  });
  const validator = new ZkQkdLinkClaimValidator({
    policy: {
      minQkdQuorum: 18,
      maxEntanglementWindowSeconds: 60,
      maxQkdSwitchChainDepth: 42,
      allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      requireQkdLinkAuthorityInitializerAttestation: true,
      requireQkdEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ["mock-authority"],
      banMalformedOrOutOfOrderQkdLinkClaims: true,
      requireCanonicalPayloadLayout: true,
    },
    hub,
    attestationClient,
    audit: () => {},
  });
  const pool = hub.initializePool({
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    sourceOpticalNodeId: "optical-001",
    targetOpticalNodeId: "optical-002",
    blindedOpticalLinkPathCommitment: "pedersen-optical-link-001",
    blindedQuantumSecretSharingCommitment: "pedersen-qss-001",
    blindedEntanglingChannelCommitment: "pedersen-entangling-001",
    entanglementWindowSeconds: 60,
    qkdSwitchChainDepth: 22,
    pqcSignatureScheme: "ML-DSA-65",
    qkdLinkAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  });
  validator.verifyQkdLinkClaim({
    poolId: pool.poolId,
    blindedOpticalLinkPathCommitment: "pedersen-optical-link-001",
    blindedQuantumSecretSharingCommitment: "pedersen-qss-001",
    blindedEntanglingChannelCommitment: "pedersen-entangling-001",
    zkQkdLinkRangeProofHash: "zk-qkd-link-proof-001",
    quantumSecretSharingDigest: "qss-digest-001",
    qkdEthicsOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  });
  hub.completeAccreditation({
    poolId: pool.poolId,
    qkdEthicsOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: Array.from({ length: 18 }, (_, i) => `sig-${i}`),
  });
  return { attestationClient, hub, validator, pool };
}

function setupAuthorization() {
  const gate = setupGate();
  const events = [];
  const shardDisperser = new MockShardDisperser();
  const ratchet = new MockRatchet();
  const stateSync = new MockStateSync();
  const reconciler = new MockReconciler();
  const keyringSync = new MockKeyringSync();
  const auth = new ClusterKeyringPrimitiveAuthorization({
    policy: POLICY,
    attestationClient: gate.attestationClient,
    shardDisperser,
    ratchet,
    stateSync,
    reconciler,
    keyringSync,
    audit: (event, info) => events.push({ event, info }),
  });
  auth.registerGate("qkd", gate.hub, gate.validator);
  return {
    ...gate,
    auth,
    events,
    shardDisperser,
    ratchet,
    stateSync,
    reconciler,
    keyringSync,
  };
}

function baseAuthorizeRequest(poolId) {
  return {
    poolId,
    nodeId: "optical-001",
    pqcSignatureScheme: "ML-DSA-65",
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
    destinations: [{ platformId: "node-2" }],
    tenantId: "tenant-a",
  };
}

describe("Cluster Keyring Sync Integration Layer", () => {
  test("L2-01: authorizes an accredited pool and emits PRIMITIVE_POOL_AUTHORIZED", () => {
    const { auth, events, pool, keyringSync } = setupAuthorization();
    const rec = auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    expect(rec.authorizationId).toBeDefined();
    expect(rec.status).toBe("active");
    expect(rec.trackType).toBe("qkd");
    expect(events.some((e) => e.event === "PRIMITIVE_POOL_AUTHORIZED")).toBe(
      true,
    );
    expect(
      keyringSync.events.some(
        (e) => e.eventType === "primitive_pool_authorized",
      ),
    ).toBe(true);
  });

  test("L2-02: rejects un-accredited pool", () => {
    const attestationClient = new MockAttestationClient();
    attestationClient.markVerified("optical-001");
    const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({
      policy: {
        minQkdQuorum: 18,
        maxEntanglementWindowSeconds: 60,
        maxQkdSwitchChainDepth: 42,
        allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
        requireQkdLinkAuthorityInitializerAttestation: false,
        requireQkdEthicsOversightCommitteeAttestation: false,
        allowedAttestationAuthorities: ["mock-authority"],
        banMalformedOrOutOfOrderQkdLinkClaims: true,
        requireCanonicalPayloadLayout: true,
      },
      attestationClient,
    });
    const pool = hub.initializePool({
      sourceTenantId: "tenant-a",
      targetChainId: "chain-b",
      sourceOpticalNodeId: "optical-001",
      targetOpticalNodeId: "optical-002",
      blindedOpticalLinkPathCommitment: "c1",
      blindedQuantumSecretSharingCommitment: "c2",
      blindedEntanglingChannelCommitment: "c3",
      entanglementWindowSeconds: 60,
      qkdSwitchChainDepth: 22,
      pqcSignatureScheme: "ML-DSA-65",
      attestationAuthority: "mock-authority",
    });
    const auth = new ClusterKeyringPrimitiveAuthorization({
      policy: POLICY,
      attestationClient,
    });
    auth.registerGate("qkd", hub);
    expect(() =>
      auth.authorizeAccreditedPool(
        "qkd",
        pool.poolId,
        baseAuthorizeRequest(pool.poolId),
      ),
    ).toThrow(HsmAdapterError);
  });

  test("L2-03: rejects un-attested node", () => {
    const { auth, pool } = setupAuthorization();
    const req = baseAuthorizeRequest(pool.poolId);
    req.nodeId = "unattested-node";
    expect(() => auth.authorizeAccreditedPool("qkd", pool.poolId, req)).toThrow(
      HsmAdapterError,
    );
  });

  test("L2-04: syncs authorized pool to target enclave and emits PRIMITIVE_POOL_SYNCED", () => {
    const { auth, events, pool, stateSync, keyringSync } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    const result = auth.syncAuthorizedPool(pool.poolId, "enclave-002");
    expect(result.poolId).toBe(pool.poolId);
    expect(result.targetEnclaveId).toBe("enclave-002");
    expect(events.some((e) => e.event === "PRIMITIVE_POOL_SYNCED")).toBe(true);
    expect(
      keyringSync.events.some((e) => e.eventType === "primitive_pool_synced"),
    ).toBe(true);
    expect(stateSync.synced.length).toBe(1);
  });

  test("L2-05: revokes authorization and emits PRIMITIVE_AUTHORIZATION_REVOKED", () => {
    const { auth, events, pool, keyringSync } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    const rec = auth.revokeAuthorization(pool.poolId, "security-incident");
    expect(rec.status).toBe("revoked");
    expect(rec.revokeReason).toBe("security-incident");
    expect(
      events.some((e) => e.event === "PRIMITIVE_AUTHORIZATION_REVOKED"),
    ).toBe(true);
    expect(
      keyringSync.events.some(
        (e) => e.eventType === "primitive_authorization_revoked",
      ),
    ).toBe(true);
  });

  test("L2-06: detects share divergence for authorized pool", () => {
    const { auth, pool, reconciler } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    reconciler.divergence = { severity: "minor", divergentNodes: ["node-3"] };
    const result = auth.detectShareDivergence(pool.poolId);
    expect(result.severity).toBe("minor");
    expect(result.divergentNodes).toEqual(["node-3"]);
  });

  test("L3-01: rejects unregistered gate trackType", () => {
    const auth = new ClusterKeyringPrimitiveAuthorization({ policy: POLICY });
    expect(() => auth.authorizeAccreditedPool("unknown", "pool-1", {})).toThrow(
      HsmAdapterError,
    );
  });

  test("L3-03: rejects sync after sync window exceeded", () => {
    const { auth, pool } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    const rec = auth.getAuthorization(pool.poolId);
    rec.authorizedAt = Math.floor(Date.now() / 1000) - 999999;
    expect(() => auth.syncAuthorizedPool(pool.poolId, "enclave-002")).toThrow(
      HsmAdapterError,
    );
  });

  test("L3-04: rejects duplicate authorization", () => {
    const { auth, pool } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    expect(() =>
      auth.authorizeAccreditedPool(
        "qkd",
        pool.poolId,
        baseAuthorizeRequest(pool.poolId),
      ),
    ).toThrow(HsmAdapterError);
  });

  test("L3-05: rejects sync on revoked pool", () => {
    const { auth, pool } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    auth.revokeAuthorization(pool.poolId, "test");
    expect(() => auth.syncAuthorizedPool(pool.poolId, "enclave-002")).toThrow(
      HsmAdapterError,
    );
  });

  test("L3-06: rejects cross-tenant authorization", () => {
    const { auth, pool } = setupAuthorization();
    const req = baseAuthorizeRequest(pool.poolId);
    req.tenantId = "tenant-B";
    expect(() => auth.authorizeAccreditedPool("qkd", pool.poolId, req)).toThrow(
      HsmAdapterError,
    );
  });

  test("L3-07: registers all 18 gate types and summary shows correct count", () => {
    const auth = new ClusterKeyringPrimitiveAuthorization({ policy: POLICY });
    for (let i = 0; i < 18; i++) {
      auth.registerGate(`track-${91 + i}`, { getPool: () => null }, null);
    }
    const summary = auth.getAuthorizationSummary();
    expect(summary.registeredGateCount).toBe(18);
    expect(summary.authorizedPoolCount).toBe(0);
  });

  test("S-02: ratchets share material before dispersal", () => {
    const { auth, pool, ratchet } = setupAuthorization();
    auth.authorizeAccreditedPool(
      "qkd",
      pool.poolId,
      baseAuthorizeRequest(pool.poolId),
    );
    expect(ratchet.evolved.length).toBe(1);
    const rec = auth.getAuthorization(pool.poolId);
    expect(rec.ratcheted).toBe(true);
  });

  test("S-04: enforces tenant isolation (sourceTenantId mismatch blocked)", () => {
    const { auth, pool } = setupAuthorization();
    const req = baseAuthorizeRequest(pool.poolId);
    delete req.tenantId;
    req.tenantId = "wrong-tenant";
    expect(() => auth.authorizeAccreditedPool("qkd", pool.poolId, req)).toThrow(
      HsmAdapterError,
    );
  });

  test("CryptoPolicyEngine validates cluster keyring primitive authorization configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        authorizationQuorum: 3,
        syncWindowSeconds: 300,
        authorizedPoolRetentionSeconds: 86400,
        pqcSignatureScheme: "ML-DSA-65",
        nodeAttestation: true,
        accreditedPoolStatus: true,
        attestationAuthority: "mock-authority",
        banUnauthorizedShareDispersal: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        authorizationQuorum: 1,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        syncWindowSeconds: 999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        authorizedPoolRetentionSeconds: 999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        nodeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        accreditedPoolStatus: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        banUnauthorizedShareDispersal: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "clusterKeyringPrimitiveAuthorization", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
