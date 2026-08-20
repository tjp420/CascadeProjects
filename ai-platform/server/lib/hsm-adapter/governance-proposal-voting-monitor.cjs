"use strict";

/**
 * Track 59: Governance Proposal Voting Monitor.
 *
 * Atomic instruction execution supervisor that aggregates and counts
 * platform endorsements, strictly locking execution pathways unless
 * a valid consensus threshold is reached within the active epoch block.
 * Triggers defensive node bans for malformed or out-of-order frames.
 *
 * @module hsm-adapter/governance-proposal-voting-monitor
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class GovernanceProposalVotingMonitor {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcCrossChainGovernanceBridge} options.bridge
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._bridge = options.bridge || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._votes = new Map();
    this._bannedPeers = new Set();
  }

  /**
   * Record a governance vote from a platform.
   * @param {object} request
   * @returns {object}
   */
  recordVote(request) {
    _validateVoteRequest(this.policy, request);
    if (!this._bridge) {
      throw new HsmAdapterError(
        "GOV_VOTE_BRIDGE_MISSING",
        "governance bridge is required",
      );
    }
    const proposal = this._bridge.getProposal(request.proposalId);
    if (!proposal) {
      if (
        this.policy.banMalformedOrOutOfOrderVotes &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "GOV_PROPOSAL_NOT_FOUND",
        `proposal ${request.proposalId} not found`,
      );
    }
    if (!this._bridge.isProposalActive(request.proposalId)) {
      if (
        this.policy.banMalformedOrOutOfOrderVotes &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "GOV_PROPOSAL_INACTIVE",
        `proposal ${request.proposalId} is no longer active`,
      );
    }
    if (
      this.policy.requireVerifierRelayAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.verifierRelayAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "GOV_VERIFIER_RELAY_UNATTESTED",
            "verifier relay attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "GOV_VERIFIER_RELAY_UNATTESTED",
          "verifier relay attestation invalid",
        );
      }
    }
    if (
      typeof request.attestationAuthority === "string" &&
      !this.policy.allowedAttestationAuthorities.includes(
        request.attestationAuthority,
      )
    ) {
      throw new HsmAdapterError(
        "GOV_VOTE_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.peerId === "string" &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "GOV_VOTE_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const voteKey = `${request.proposalId}:${request.platformId}`;
    if (this._votes.has(voteKey)) {
      if (
        this.policy.banMalformedOrOutOfOrderVotes &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "GOV_VOTE_DUPLICATE",
        `vote from platform ${request.platformId} already recorded for proposal ${request.proposalId}`,
      );
    }
    const voteDecision = request.voteDecision || "approve";
    if (voteDecision !== "approve" && voteDecision !== "reject") {
      if (
        this.policy.banMalformedOrOutOfOrderVotes &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "GOV_VOTE_DECISION_INVALID",
        `vote decision ${voteDecision} is not valid; allowed: approve, reject`,
      );
    }
    if (
      !request.partialSignature ||
      typeof request.partialSignature !== "string"
    ) {
      if (
        this.policy.banMalformedOrOutOfOrderVotes &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "GOV_VOTE_SIGNATURE_MISSING",
        "partial signature is required",
      );
    }
    const voteId =
      request.voteId || `vote-${crypto.randomBytes(4).toString("hex")}`;
    const vote = {
      voteId,
      proposalId: request.proposalId,
      platformId: request.platformId,
      voteDecision,
      partialSignature: request.partialSignature,
      recordedAt: Math.floor(Date.now() / 1000),
    };
    this._votes.set(voteKey, vote);
    if (this._audit) {
      this._audit("GOVERNANCE_VOTE_RECORDED", { ...vote });
    }
    return vote;
  }

  /**
   * Check if a proposal has reached quorum and execute if so.
   * @param {string} proposalId
   * @returns {object}
   */
  checkAndExecute(proposalId) {
    if (!this._bridge) {
      throw new HsmAdapterError(
        "GOV_EXEC_BRIDGE_MISSING",
        "governance bridge is required",
      );
    }
    const proposal = this._bridge.getProposal(proposalId);
    if (!proposal) {
      throw new HsmAdapterError(
        "GOV_PROPOSAL_NOT_FOUND",
        `proposal ${proposalId} not found`,
      );
    }
    if (proposal.status === "executed") {
      throw new HsmAdapterError(
        "GOV_PROPOSAL_ALREADY_EXECUTED",
        `proposal ${proposalId} already executed`,
      );
    }
    if (!this._bridge.isProposalActive(proposalId)) {
      throw new HsmAdapterError(
        "GOV_PROPOSAL_INACTIVE",
        `proposal ${proposalId} is no longer active`,
      );
    }
    const approveVotes = [];
    for (const [key, vote] of this._votes) {
      if (key.startsWith(`${proposalId}:`) && vote.voteDecision === "approve") {
        approveVotes.push(vote);
      }
    }
    if (approveVotes.length < (this.policy.minPlatformVotingQuorum || 3)) {
      return {
        executed: false,
        reason: `approve votes ${approveVotes.length} below minimum quorum ${this.policy.minPlatformVotingQuorum}`,
        approveCount: approveVotes.length,
      };
    }
    this._bridge.markExecuted(proposalId);
    const result = {
      executed: true,
      proposalId,
      approveCount: approveVotes.length,
      executedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("CROSS_CHAIN_PROPOSAL_EXECUTED", { ...result });
    }
    return result;
  }

  /**
   * Get all votes for a proposal.
   * @param {string} proposalId
   * @returns {Array}
   */
  getVotesForProposal(proposalId) {
    const votes = [];
    for (const [key, vote] of this._votes) {
      if (key.startsWith(`${proposalId}:`)) {
        votes.push(vote);
      }
    }
    return votes;
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }
}

function _validateVoteRequest(policy, request) {
  if (!request.proposalId || !request.platformId) {
    throw new HsmAdapterError(
      "GOV_VOTE_FIELDS_MISSING",
      "proposalId and platformId are required",
    );
  }
  if (
    policy.requireVerifierRelayAttestation &&
    !request.verifierRelayAttestation
  ) {
    throw new HsmAdapterError(
      "GOV_VOTE_ATTESTATION_MISSING",
      "verifier relay attestation is required",
    );
  }
}

module.exports = { GovernanceProposalVotingMonitor };
