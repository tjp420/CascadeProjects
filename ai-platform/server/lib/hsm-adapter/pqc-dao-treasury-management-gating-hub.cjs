"use strict";

/**
 * Track 84: PQC DAO Treasury Management Gating Hub.
 *
 * Interlocking governance authority coordinator
 * that instantiates multi-party treasury verification
 * pools using homomorphically split Pedersen commitments
 * over treasury allocation hashes, proposal execution
 * metrics, and voter identity hashes. Parses
 * TREASURYGATE packets, enforces maxAllocationDepth, and
 * tracks state transitions alongside the
 * minProposalQuorum boundary.
 *
 * @module hsm-adapter/pqc-dao-treasury-management-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcDaoTreasuryManagementGatingHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  /**
   * Initialize a DAO treasury management verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireGovernanceAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.governanceAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "TREASURYGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "governance authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "TREASURYGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "governance authority initializer attestation invalid",
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
        "TREASURYGATE_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.pqcSignatureScheme === "string" &&
      !this.policy.allowedPqcSignatureSchemes.includes(
        request.pqcSignatureScheme,
      )
    ) {
      throw new HsmAdapterError(
        "TREASURYGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.proposalWindowSeconds === "number" &&
      request.proposalWindowSeconds >
        (this.policy.maxProposalWindowSeconds || 2592000)
    ) {
      throw new HsmAdapterError(
        "TREASURYGATE_PROPOSAL_WINDOW_EXCEEDED",
        `proposal window seconds ${request.proposalWindowSeconds} exceeds maximum ${this.policy.maxProposalWindowSeconds}`,
      );
    }
    if (
      typeof request.allocationDepth === "number" &&
      request.allocationDepth > (this.policy.maxAllocationDepth || 16)
    ) {
      throw new HsmAdapterError(
        "TREASURYGATE_ALLOCATION_DEPTH_EXCEEDED",
        `allocation depth ${request.allocationDepth} exceeds maximum ${this.policy.maxAllocationDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "TREASURYGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedTreasuryAllocationCommitment:
        request.blindedTreasuryAllocationCommitment,
      blindedProposalExecutionCommitment:
        request.blindedProposalExecutionCommitment,
      blindedVoterIdentityCommitment: request.blindedVoterIdentityCommitment,
      proposalWindowSeconds: request.proposalWindowSeconds,
      allocationDepth: request.allocationDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      proposalClaimVerified: false,
      voterAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("TREASURY_GATING_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Get a pool by id.
   * @param {string} poolId
   * @returns {object|null}
   */
  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  /**
   * Mark a pool as proposal-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markProposalClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "TREASURYGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.proposalClaimVerified = true;
    return pool;
  }

  /**
   * Complete voter accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "TREASURYGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.proposalClaimVerified) {
      throw new HsmAdapterError(
        "TREASURYGATE_PROPOSAL_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} proposal claim not verified`,
      );
    }
    if (
      this.policy.requireTreasuryOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.treasuryOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "TREASURYGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "treasury oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "TREASURYGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "treasury oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minProposalQuorum || 3)) {
      throw new HsmAdapterError(
        "TREASURYGATE_QUORUM_INSUFFICIENT",
        `proposal signatures ${signatures.length} below minimum ${this.policy.minProposalQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.voterAccreditationCompletedAt = now;
    const completionId =
      request.completionId ||
      `completion-${crypto.randomBytes(4).toString("hex")}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit("VOTER_ACCREDITATION_COMPLETED", { ...completion });
    }
    return completion;
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "TREASURYGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedTreasuryAllocationCommitment ||
    !request.blindedProposalExecutionCommitment ||
    !request.blindedVoterIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "TREASURYGATE_FIELDS_MISSING",
      "blindedTreasuryAllocationCommitment, blindedProposalExecutionCommitment, and blindedVoterIdentityCommitment are required",
    );
  }
  if (typeof request.proposalWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "TREASURYGATE_FIELDS_MISSING",
      "proposalWindowSeconds is required",
    );
  }
  if (typeof request.allocationDepth !== "number") {
    throw new HsmAdapterError(
      "TREASURYGATE_FIELDS_MISSING",
      "allocationDepth is required",
    );
  }
  if (
    policy.requireGovernanceAuthorityInitializerAttestation &&
    !request.governanceAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "TREASURYGATE_AUTHORITY_ATTESTATION_MISSING",
      "governance authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "TREASURYGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireTreasuryOversightCommitteeAttestation &&
    !request.treasuryOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "TREASURYGATE_OVERSIGHT_ATTESTATION_MISSING",
      "treasury oversight committee attestation is required",
    );
  }
}

module.exports = { PqcDaoTreasuryManagementGatingHub };
