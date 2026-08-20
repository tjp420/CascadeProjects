"use strict";

/**
 * Track 59: PQC Cross-Chain Governance tests.
 */
const {
  PqcCrossChainGovernanceBridge,
} = require("../pqc-cross-chain-governance-bridge.cjs");
const {
  GovernanceProposalVotingMonitor,
} = require("../governance-proposal-voting-monitor.cjs");
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
  minPlatformVotingQuorum: 3,
  maxConcurrentProposals: 16,
  maxProposalExecutionWindowSeconds: 86400,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireProposalBroadcasterAttestation: true,
  requireVerifierRelayAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderVotes: true,
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

function baseBroadcastRequest() {
  return {
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    instructionType: "update-bridge-params",
    executionWindowSeconds: 3600,
    pqcSignatureScheme: "ML-DSA-65",
    broadcasterAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseVoteRequest(proposalId, platformId) {
  return {
    proposalId,
    platformId,
    voteDecision: "approve",
    partialSignature: `partial-sig-${platformId}`,
    verifierRelayAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function setupBridgeAndMonitor() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const bridge = new PqcCrossChainGovernanceBridge({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const monitor = new GovernanceProposalVotingMonitor({
    policy: POLICY,
    bridge,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, bridge, monitor };
}

describe("Track 59 PQC cross-chain governance", () => {
  test("PqcCrossChainGovernanceBridge broadcasts a proposal and emits CROSS_CHAIN_PROPOSAL_BROADCAST", () => {
    const { events, bridge } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    expect(proposal.status).toBe("broadcast");
    expect(proposal.proposalId).toBeDefined();
    expect(
      events.some((e) => e.event === "CROSS_CHAIN_PROPOSAL_BROADCAST"),
    ).toBe(true);
  });

  test("GovernanceProposalVotingMonitor records a valid vote and emits GOVERNANCE_VOTE_RECORDED", () => {
    const { events, bridge, monitor } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    const vote = monitor.recordVote(
      baseVoteRequest(proposal.proposalId, "platform-a"),
    );
    expect(vote.voteDecision).toBe("approve");
    expect(events.some((e) => e.event === "GOVERNANCE_VOTE_RECORDED")).toBe(
      true,
    );
  });

  test("GovernanceProposalVotingMonitor executes proposal after quorum and emits CROSS_CHAIN_PROPOSAL_EXECUTED", () => {
    const { events, bridge, monitor } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    monitor.recordVote(baseVoteRequest(proposal.proposalId, "platform-a"));
    monitor.recordVote(baseVoteRequest(proposal.proposalId, "platform-b"));
    monitor.recordVote(baseVoteRequest(proposal.proposalId, "platform-c"));
    const result = monitor.checkAndExecute(proposal.proposalId);
    expect(result.executed).toBe(true);
    expect(result.approveCount).toBe(3);
    expect(
      events.some((e) => e.event === "CROSS_CHAIN_PROPOSAL_EXECUTED"),
    ).toBe(true);
  });

  test("GovernanceProposalVotingMonitor refuses execution before quorum", () => {
    const { bridge, monitor } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    monitor.recordVote(baseVoteRequest(proposal.proposalId, "platform-a"));
    const result = monitor.checkAndExecute(proposal.proposalId);
    expect(result.executed).toBe(false);
  });

  test("PqcCrossChainGovernanceBridge rejects un-attested broadcaster", () => {
    const attestationClient = new MockAttestationClient();
    const bridge = new PqcCrossChainGovernanceBridge({
      policy: POLICY,
      attestationClient,
    });
    const request = baseBroadcastRequest();
    request.broadcasterAttestation = { authority: "bad" };
    expect(() => bridge.broadcastProposal(request)).toThrow(HsmAdapterError);
  });

  test("GovernanceProposalVotingMonitor rejects un-attested verifier relay", () => {
    const { bridge, monitor } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    const voteReq = baseVoteRequest(proposal.proposalId, "platform-a");
    voteReq.verifierRelayAttestation = { authority: "bad" };
    expect(() => monitor.recordVote(voteReq)).toThrow(HsmAdapterError);
  });

  test("PqcCrossChainGovernanceBridge rejects unpermitted PQC signature scheme", () => {
    const bridge = new PqcCrossChainGovernanceBridge({ policy: POLICY });
    const request = baseBroadcastRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => bridge.broadcastProposal(request)).toThrow(HsmAdapterError);
  });

  test("PqcCrossChainGovernanceBridge rejects execution window exceeding maximum", () => {
    const bridge = new PqcCrossChainGovernanceBridge({ policy: POLICY });
    const request = baseBroadcastRequest();
    request.executionWindowSeconds = 200000;
    expect(() => bridge.broadcastProposal(request)).toThrow(HsmAdapterError);
  });

  test("GovernanceProposalVotingMonitor bans peers broadcasting duplicate votes", () => {
    const { bridge, monitor } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    const voteReq = baseVoteRequest(proposal.proposalId, "platform-a");
    voteReq.peerId = "peer-bad";
    monitor.recordVote(voteReq);
    const dupReq = baseVoteRequest(proposal.proposalId, "platform-a");
    dupReq.peerId = "peer-bad";
    expect(() => monitor.recordVote(dupReq)).toThrow(HsmAdapterError);
    expect(monitor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("GovernanceProposalVotingMonitor bans peers broadcasting invalid vote decisions", () => {
    const { bridge, monitor } = setupBridgeAndMonitor();
    const proposal = bridge.broadcastProposal(baseBroadcastRequest());
    const voteReq = baseVoteRequest(proposal.proposalId, "platform-a");
    voteReq.voteDecision = "invalid";
    voteReq.peerId = "peer-bad";
    expect(() => monitor.recordVote(voteReq)).toThrow(HsmAdapterError);
    expect(monitor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("GovernanceProposalVotingMonitor bans peers voting on inactive proposals", () => {
    const { bridge, monitor } = setupBridgeAndMonitor();
    const voteReq = baseVoteRequest("nonexistent-proposal", "platform-a");
    voteReq.peerId = "peer-bad";
    expect(() => monitor.recordVote(voteReq)).toThrow(HsmAdapterError);
    expect(monitor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pqc cross-chain governance configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        platformVotingQuorum: 3,
        concurrentProposals: 5,
        proposalExecutionWindowSeconds: 3600,
        pqcSignatureScheme: "ML-DSA-65",
        proposalBroadcasterAttestation: true,
        verifierRelayAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderVotes: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        platformVotingQuorum: 1,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        concurrentProposals: 32,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        proposalExecutionWindowSeconds: 200000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        proposalBroadcasterAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        verifierRelayAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        banMalformedOrOutOfOrderVotes: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqcCrossChainGovernance", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
