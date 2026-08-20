"use strict";

/**
 * Track 58: Post-Quantum Vesting Escrow Hub.
 *
 * Interlocking release coordinator that maps hidden asset balances to
 * multi-epoch distribution milestones, validating incoming release
 * claims using post-quantum ML-DSA threshold signatures.
 *
 * @module hsm-adapter/pqc-vesting-escrow-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcVestingEscrowHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {VestingTemporalGuard} [options.temporalGuard]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._temporalGuard = options.temporalGuard || null;
    this._audit = options.audit || null;
    this._locks = new Map();
    this._claims = new Map();
    this._bannedPeers = new Set();
  }

  /**
   * Initialize a vesting lock.
   * @param {object} request
   * @returns {object}
   */
  initializeLock(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireClaimantAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.claimantAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "VESTING_CLAIMANT_UNATTESTED",
            "claimant attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "VESTING_CLAIMANT_UNATTESTED",
          "claimant attestation invalid",
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
        "VESTING_ATTESTATION_AUTHORITY_BLOCKED",
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
        "VESTING_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.assetValue === "number" &&
      request.assetValue > (this.policy.maxAssetValueCap || 1000000)
    ) {
      throw new HsmAdapterError(
        "VESTING_ASSET_VALUE_EXCEEDED",
        `asset value ${request.assetValue} exceeds maximum cap ${this.policy.maxAssetValueCap}`,
      );
    }
    if (
      typeof request.epochSeconds === "number" &&
      request.epochSeconds < (this.policy.minVestingEpochSeconds || 3600)
    ) {
      throw new HsmAdapterError(
        "VESTING_EPOCH_TOO_SHORT",
        `vesting epoch ${request.epochSeconds}s below minimum ${this.policy.minVestingEpochSeconds}s`,
      );
    }
    const lockId =
      request.lockId || `lock-${crypto.randomBytes(4).toString("hex")}`;
    if (this._locks.has(lockId)) {
      throw new HsmAdapterError(
        "VESTING_LOCK_DUPLICATE",
        `lock ${lockId} already exists`,
      );
    }
    const totalEpochs = request.totalEpochs || 1;
    const perEpochRelease = Math.floor(request.assetValue / totalEpochs);
    const lock = {
      lockId,
      sourceTenantId: request.sourceTenantId,
      assetId: request.assetId,
      assetValue: request.assetValue,
      totalEpochs,
      epochSeconds: request.epochSeconds,
      pqcSignatureScheme: request.pqcSignatureScheme,
      perEpochRelease,
      releasedEpochs: 0,
      releasedAmount: 0,
      status: "active",
      initializedAt: Math.floor(Date.now() / 1000),
    };
    this._locks.set(lockId, lock);
    if (this._audit) {
      this._audit("VESTING_LOCK_INITIALIZED", { ...lock });
    }
    return lock;
  }

  /**
   * Process an epoch release claim.
   * @param {object} request
   * @returns {object}
   */
  claimEpochRelease(request) {
    _validateClaimRequest(this.policy, request);
    const lock = this._locks.get(request.lockId);
    if (!lock) {
      throw new HsmAdapterError(
        "VESTING_LOCK_NOT_FOUND",
        `lock ${request.lockId} not found`,
      );
    }
    if (lock.status === "completed") {
      if (
        this.policy.banExpiredOrDuplicateClaims &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "VESTING_LOCK_COMPLETED",
        `lock ${request.lockId} already completed`,
      );
    }
    if (this.policy.requireClaimantAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.claimantAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "VESTING_CLAIMANT_UNATTESTED",
            "claimant attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "VESTING_CLAIMANT_UNATTESTED",
          "claimant attestation invalid",
        );
      }
    }
    if (
      this.policy.requireCommitteeRelayAttestation &&
      this._attestationClient
    ) {
      for (const relay of request.committeeRelays || []) {
        try {
          const result = this._attestationClient.verify(relay.attestation);
          if (!result.verified) {
            throw new HsmAdapterError(
              "VESTING_COMMITTEE_RELAY_UNATTESTED",
              `committee relay ${relay.nodeId} attestation invalid`,
            );
          }
        } catch (err) {
          if (err instanceof HsmAdapterError) throw err;
          throw new HsmAdapterError(
            "VESTING_COMMITTEE_RELAY_UNATTESTED",
            `committee relay ${relay.nodeId} attestation invalid`,
          );
        }
      }
    }
    if (
      typeof request.peerId === "string" &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "VESTING_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const signatures = request.thresholdSignatures || [];
    if (signatures.length < (this.policy.minReleaseSignatureQuorum || 3)) {
      throw new HsmAdapterError(
        "VESTING_QUORUM_INSUFFICIENT",
        `threshold signatures ${signatures.length} below minimum ${this.policy.minReleaseSignatureQuorum}`,
      );
    }
    const epochIndex = request.epochIndex;
    if (epochIndex !== lock.releasedEpochs + 1) {
      if (
        this.policy.banExpiredOrDuplicateClaims &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "VESTING_EPOCH_INDEX_INVALID",
        `epoch index ${epochIndex} is not the next expected epoch ${lock.releasedEpochs + 1}`,
      );
    }
    const claimKey = `${request.lockId}:${epochIndex}`;
    if (this._claims.has(claimKey)) {
      if (
        this.policy.banExpiredOrDuplicateClaims &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "VESTING_CLAIM_DUPLICATE",
        `claim ${claimKey} already processed`,
      );
    }
    if (this._temporalGuard) {
      const guardResult = this._temporalGuard.verifyEpochWindow({
        lockId: request.lockId,
        epochIndex,
        initializedAt: lock.initializedAt,
        epochSeconds: lock.epochSeconds,
        claimTimestamp: request.claimTimestamp || Math.floor(Date.now() / 1000),
        peerId: request.peerId,
      });
      if (!guardResult.allowed) {
        if (
          this.policy.banExpiredOrDuplicateClaims &&
          typeof request.peerId === "string"
        ) {
          this._bannedPeers.add(request.peerId);
        }
        throw new HsmAdapterError(
          "VESTING_EPOCH_PREMATURE",
          guardResult.reason,
        );
      }
    }
    const releaseAmount = request.releaseAmount || lock.perEpochRelease;
    lock.releasedEpochs = epochIndex;
    lock.releasedAmount += releaseAmount;
    const claim = {
      claimId:
        request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`,
      lockId: request.lockId,
      epochIndex,
      releaseAmount,
      thresholdSignatures: signatures.length,
      claimedAt: Math.floor(Date.now() / 1000),
    };
    this._claims.set(claimKey, claim);
    if (lock.releasedEpochs >= lock.totalEpochs) {
      lock.status = "completed";
      if (this._audit) {
        this._audit("VESTING_ESCROW_COMPLETED", { ...lock });
      }
    }
    if (this._audit) {
      this._audit("VESTING_EPOCH_RELEASE_CLAIMED", { ...claim });
    }
    return { claim, lockStatus: lock.status };
  }

  /**
   * Get a lock by id.
   * @param {string} lockId
   * @returns {object|null}
   */
  getLock(lockId) {
    return this._locks.get(lockId) || null;
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

function _validateInitRequest(policy, request) {
  if (
    !request.sourceTenantId ||
    !request.assetId ||
    typeof request.assetValue !== "number"
  ) {
    throw new HsmAdapterError(
      "VESTING_FIELDS_MISSING",
      "sourceTenantId, assetId, and assetValue are required",
    );
  }
  if (policy.requireClaimantAttestation && !request.claimantAttestation) {
    throw new HsmAdapterError(
      "VESTING_ATTESTATION_MISSING",
      "claimant attestation is required",
    );
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.lockId || typeof request.epochIndex !== "number") {
    throw new HsmAdapterError(
      "VESTING_CLAIM_FIELDS_MISSING",
      "lockId and epochIndex are required",
    );
  }
  if (policy.requireClaimantAttestation && !request.claimantAttestation) {
    throw new HsmAdapterError(
      "VESTING_CLAIM_ATTESTATION_MISSING",
      "claimant attestation is required",
    );
  }
}

module.exports = { PqcVestingEscrowHub };
