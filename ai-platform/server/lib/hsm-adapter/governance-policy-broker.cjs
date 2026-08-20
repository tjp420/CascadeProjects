"use strict";

/**
 * Track 31: Governance policy broker.
 *
 * Registers, tracks, and verifies multi-party governance proposals.
 * A proposal is committed only after it carries at least minAdminQuorum
 * valid signatures from allowed administrators within the proposal expiry
 * window.
 *
 * @module hsm-adapter/governance-policy-broker
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

function _canonicalPayload({
  proposalId,
  nonce,
  sponsor,
  policyHash,
  timestamp,
  signer,
}) {
  return `${proposalId}|${nonce}|${sponsor}|${policyHash}|${timestamp}|${signer}`;
}

class GovernancePolicyBroker {
  /**
   * @param {object} options
   * @param {number} options.minAdminQuorum
   * @param {number} options.proposalExpiryMs
   * @param {string[]} [options.allowedAdmins]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.minAdminQuorum = options.minAdminQuorum || 2;
    this.proposalExpiryMs = options.proposalExpiryMs || 86400000;
    this.allowedAdmins = new Set(options.allowedAdmins || []);
    this._proposals = new Map();
    this._audit = options.audit || null;
  }

  /**
   * Register a new governance proposal.
   * @param {object} proposal
   * @param {string} proposal.proposalId
   * @param {string} proposal.nonce
   * @param {string} proposal.sponsor
   * @param {string} proposal.policyHash
   * @param {number} proposal.timestamp
   * @returns {object}
   */
  initiate(proposal) {
    if (!proposal || typeof proposal !== "object") {
      throw new HsmAdapterError("INVALID_INPUT", "proposal object is required");
    }
    const { proposalId, nonce, sponsor, policyHash, timestamp } = proposal;
    if (
      !proposalId ||
      !nonce ||
      !sponsor ||
      !policyHash ||
      typeof timestamp !== "number"
    ) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "proposalId, nonce, sponsor, policyHash, and timestamp are required",
      );
    }
    const entry = {
      proposalId,
      nonce,
      sponsor,
      policyHash,
      timestamp,
      signatures: [],
      committed: false,
    };
    this._proposals.set(proposalId, entry);

    this._emitAudit("GOVERNANCE_PROPOSAL_INITIATED", {
      proposalId,
      sponsor,
      policyHash,
      timestamp,
    });

    return entry;
  }

  /**
   * Append a verified signature to a proposal.
   * @param {string} proposalId
   * @param {{signer: string, signature: string}} sig
   * @returns {object}
   */
  sign(proposalId, sig) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) {
      throw new HsmAdapterError(
        "GOVERNANCE_PROPOSAL_NOT_FOUND",
        `no proposal ${proposalId}`,
      );
    }
    if (proposal.committed) {
      throw new HsmAdapterError(
        "GOVERNANCE_PROPOSAL_COMMITTED",
        `proposal ${proposalId} is already committed`,
      );
    }

    const now = Date.now();
    if (now - proposal.timestamp > this.proposalExpiryMs) {
      throw new HsmAdapterError(
        "GOVERNANCE_PROPOSAL_EXPIRED",
        `proposal ${proposalId} expired`,
      );
    }

    if (
      !sig ||
      typeof sig !== "object" ||
      typeof sig.signer !== "string" ||
      typeof sig.signature !== "string"
    ) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "signature must contain signer and signature strings",
      );
    }

    if (this.allowedAdmins.size > 0 && !this.allowedAdmins.has(sig.signer)) {
      throw new HsmAdapterError(
        "GOVERNANCE_SIGNER_REJECTED",
        `signer ${sig.signer} is not an allowed admin`,
      );
    }

    if (proposal.signatures.some((s) => s.signer === sig.signer)) {
      throw new HsmAdapterError(
        "GOVERNANCE_DUPLICATE_SIGNER",
        `signer ${sig.signer} already signed`,
      );
    }

    const expected = _hash(
      _canonicalPayload({ ...proposal, signer: sig.signer }),
    );
    if (sig.signature !== expected) {
      throw new HsmAdapterError(
        "GOVERNANCE_SIGNATURE_INVALID",
        `signature from ${sig.signer} does not verify`,
      );
    }

    proposal.signatures.push(sig);
    return proposal;
  }

  /**
   * Attempt to commit a proposal once quorum is reached.
   * @param {string} proposalId
   * @returns {object}
   */
  commit(proposalId) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) {
      throw new HsmAdapterError(
        "GOVERNANCE_PROPOSAL_NOT_FOUND",
        `no proposal ${proposalId}`,
      );
    }
    if (Date.now() - proposal.timestamp > this.proposalExpiryMs) {
      throw new HsmAdapterError(
        "GOVERNANCE_PROPOSAL_EXPIRED",
        `proposal ${proposalId} expired before commit`,
      );
    }
    if (proposal.signatures.length < this.minAdminQuorum) {
      throw new HsmAdapterError(
        "GOVERNANCE_QUORUM_NOT_MET",
        `signatures ${proposal.signatures.length} below quorum ${this.minAdminQuorum}`,
      );
    }

    proposal.committed = true;

    this._emitAudit("POLICY_CONSENSUS_COMMITTED", {
      proposalId,
      policyHash: proposal.policyHash,
      signers: proposal.signatures.map((s) => s.signer),
      signatureCount: proposal.signatures.length,
    });

    return proposal;
  }

  /**
   * Get the current state of a proposal.
   * @param {string} proposalId
   * @returns {object}
   */
  getProposal(proposalId) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) {
      throw new HsmAdapterError(
        "GOVERNANCE_PROPOSAL_NOT_FOUND",
        `no proposal ${proposalId}`,
      );
    }
    return proposal;
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

function _hash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

module.exports = { GovernancePolicyBroker, _canonicalPayload };
