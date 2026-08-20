"use strict";

/**
 * Track 68: PQ Supply Chain Escrow tests.
 */
const {
  PqcSupplyChainEscrowHub,
} = require("../pqc-supply-chain-escrow-hub.cjs");
const {
  ZkOrderMilestoneValidator,
} = require("../zk-order-milestone-validator.cjs");
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
  minOrderMatchingQuorum: 3,
  maxProcurementDeliveryEpochs: 30,
  maxEscrowFundingCap: 1000000000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireProcurementInitiatorAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderDeliveryAssertions: true,
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

function baseInitRequest() {
  return {
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    blindedOrderValueCommitment: "pedersen-order-001",
    blindedLogisticsVolumeCommitment: "pedersen-logistics-001",
    blindedDepositMarginCommitment: "pedersen-deposit-001",
    deliveryEpochs: 15,
    escrowFundingCap: 1000000,
    pqcSignatureScheme: "ML-DSA-65",
    procurementInitiatorAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseMilestoneRequest(orderId) {
  return {
    orderId: orderId || "order-001",
    blindedDeliveryQuantityCommitment: "pedersen-quantity-001",
    blindedDeliveryValueCommitment: "pedersen-deliveryvalue-001",
    zkMilestoneRangeProofHash: "zk-milestone-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    deliveryEpoch: 10,
  };
}

function baseReleaseRequest(orderId) {
  return {
    orderId: orderId || "order-001",
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcSupplyChainEscrowHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkOrderMilestoneValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitOrder() {
  const ctx = setupHubAndValidator();
  const order = ctx.hub.initializeOrder(baseInitRequest());
  return { ...ctx, order };
}

function setupInitAndMilestone() {
  const ctx = setupAndInitOrder();
  const milestone = ctx.validator.verifyMilestone(
    baseMilestoneRequest(ctx.order.orderId),
  );
  return { ...ctx, milestone };
}

describe("Track 68 PQ supply chain escrow", () => {
  test("PqcSupplyChainEscrowHub initializes an order and emits SUPPLY_CHAIN_ORDER_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const order = hub.initializeOrder(baseInitRequest());
    expect(order.status).toBe("open");
    expect(order.orderId).toBeDefined();
    expect(
      events.some((e) => e.event === "SUPPLY_CHAIN_ORDER_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkOrderMilestoneValidator verifies a milestone and emits ZK_DELIVERY_MILESTONE_VERIFIED", () => {
    const { events, validator, order } = setupAndInitOrder();
    const milestone = validator.verifyMilestone(
      baseMilestoneRequest(order.orderId),
    );
    expect(milestone.milestoneId).toBeDefined();
    expect(
      events.some((e) => e.event === "ZK_DELIVERY_MILESTONE_VERIFIED"),
    ).toBe(true);
  });

  test("PqcSupplyChainEscrowHub releases escrow after milestone and emits PROCUREMENT_ESCROW_RELEASED", () => {
    const { events, hub, order } = setupInitAndMilestone();
    const release = hub.releaseEscrow(baseReleaseRequest(order.orderId));
    expect(release.releaseId).toBeDefined();
    expect(events.some((e) => e.event === "PROCUREMENT_ESCROW_RELEASED")).toBe(
      true,
    );
  });

  test("PqcSupplyChainEscrowHub rejects delivery epochs exceeding maximum", () => {
    const hub = new PqcSupplyChainEscrowHub({ policy: POLICY });
    const request = baseInitRequest();
    request.deliveryEpochs = 60;
    expect(() => hub.initializeOrder(request)).toThrow(HsmAdapterError);
  });

  test("PqcSupplyChainEscrowHub rejects escrow funding cap exceeding maximum", () => {
    const hub = new PqcSupplyChainEscrowHub({ policy: POLICY });
    const request = baseInitRequest();
    request.escrowFundingCap = 2000000000;
    expect(() => hub.initializeOrder(request)).toThrow(HsmAdapterError);
  });

  test("PqcSupplyChainEscrowHub rejects un-attested procurement initiator", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcSupplyChainEscrowHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.procurementInitiatorAttestation = { authority: "bad" };
    expect(() => hub.initializeOrder(request)).toThrow(HsmAdapterError);
  });

  test("ZkOrderMilestoneValidator rejects un-attested clearing committee", () => {
    const { hub, order } = setupAndInitOrder();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkOrderMilestoneValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const msReq = baseMilestoneRequest(order.orderId);
    msReq.clearingCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifyMilestone(msReq)).toThrow(HsmAdapterError);
  });

  test("PqcSupplyChainEscrowHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcSupplyChainEscrowHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializeOrder(request)).toThrow(HsmAdapterError);
  });

  test("PqcSupplyChainEscrowHub rejects duplicate order initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.orderId = "order-dup";
    hub.initializeOrder(request);
    expect(() => hub.initializeOrder(request)).toThrow(HsmAdapterError);
  });

  test("PqcSupplyChainEscrowHub rejects escrow release before milestone verification", () => {
    const { hub, order } = setupAndInitOrder();
    expect(() => hub.releaseEscrow(baseReleaseRequest(order.orderId))).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcSupplyChainEscrowHub rejects escrow release with insufficient quorum", () => {
    const { hub, order } = setupInitAndMilestone();
    const relReq = baseReleaseRequest(order.orderId);
    relReq.committeeSignatures = ["sig-a"];
    expect(() => hub.releaseEscrow(relReq)).toThrow(HsmAdapterError);
  });

  test("ZkOrderMilestoneValidator bans peers broadcasting malformed milestones", () => {
    const { validator, order } = setupAndInitOrder();
    const msReq = baseMilestoneRequest(order.orderId);
    msReq.zkMilestoneRangeProofHash = null;
    msReq.peerId = "peer-bad";
    expect(() => validator.verifyMilestone(msReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkOrderMilestoneValidator bans peers broadcasting out-of-bounds epochs", () => {
    const { validator, order } = setupAndInitOrder();
    const msReq = baseMilestoneRequest(order.orderId);
    msReq.deliveryEpoch = 999;
    msReq.peerId = "peer-bad";
    expect(() => validator.verifyMilestone(msReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkOrderMilestoneValidator bans peers broadcasting duplicate milestones", () => {
    const { validator, order } = setupAndInitOrder();
    const msReq = baseMilestoneRequest(order.orderId);
    msReq.peerId = "peer-bad";
    validator.verifyMilestone(msReq);
    expect(() => validator.verifyMilestone(msReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq supply chain escrow configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        orderMatchingQuorum: 3,
        procurementDeliveryEpochs: 15,
        escrowFundingCap: 1000000,
        pqcSignatureScheme: "ML-DSA-65",
        procurementInitiatorAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderDeliveryAssertions: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", { orderMatchingQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        procurementDeliveryEpochs: 60,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        escrowFundingCap: 2000000000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        procurementInitiatorAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        clearingCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        banMalformedOrOutOfOrderDeliveryAssertions: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSupplyChainEscrow", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
