"use strict";

/**
 * Track 48: PQC asset bridge hub.
 *
 * Orchestrates cross-system asset locks and releases using
 * post-quantum ML-DSA/Dilithium threshold signatures from the
 * Track 27 committee. Validates attestation on both source and
 * target endpoints before broadcasting a transfer.
 *
 * @module hsm-adapter/pqc-asset-bridge-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcAssetBridgeHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {BridgeTimeLockEscrow} [options.escrow]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._escrow = options.escrow || null;
    this._audit = options.audit || null;
  }

  /**
   * Initiate a bridge transfer.
   * @param {object} transfer
   * @returns {object}
   */
  initiate(transfer) {
    _validateTransfer(this.policy, this._attestationClient, transfer);
    if (this._escrow) {
      this._escrow.lock(
        transfer.transferId,
        transfer.amount,
        transfer.lockEpoch,
        transfer.releaseEpoch,
      );
    }
    const payload = _canonicalPayload(transfer, []);
    if (this._audit) {
      this._audit("BRIDGE_TRANSFER_INITIATED", {
        transferId: transfer.transferId,
        sourcePlatform: transfer.sourcePlatform,
        targetPlatform: transfer.targetPlatform,
        assetId: transfer.assetId,
        amount: transfer.amount,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
    return { initiated: true, transferId: transfer.transferId, payload };
  }

  /**
   * Add a committee signature and release escrow when quorum is reached.
   * @param {string} transferId
   * @param {string} committeeMemberId
   * @param {object} attestation
   * @param {string} signature
   * @returns {object}
   */
  signAndRelease(transferId, committeeMemberId, attestation, signature) {
    if (this.policy.requireSourceAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError(
          "BRIDGE_COMMITTEE_UNATTESTED",
          `committee member ${committeeMemberId} attestation invalid`,
        );
      }
    }
    if (this._escrow) {
      const escrowResult = this._escrow.validateClaim(transferId);
      if (!escrowResult.valid) {
        throw new HsmAdapterError("BRIDGE_CLAIM_INVALID", escrowResult.reason);
      }
      this._escrow.addCommitteeSignature(transferId, signature);
      const release = this._escrow.attemptRelease(
        transferId,
        this.policy.minCommitteeQuorum || 3,
      );
      if (release.released) {
        if (this._audit) {
          this._audit("ESCROW_RELEASE_FINALIZED", {
            transferId,
            timestamp: Math.floor(Date.now() / 1000),
          });
        }
      }
      return {
        transferId,
        signatures: release.signatures,
        released: release.released,
      };
    }
    return { transferId, signatures: 1, released: false };
  }

  /**
   * Validate a cross-chain claim.
   * @param {object} claim
   * @returns {object}
   */
  validateClaim(claim) {
    _validateClaim(this.policy, this._attestationClient, claim);
    if (this._audit) {
      this._audit("CROSS_CHAIN_CLAIM_VALIDATED", {
        transferId: claim.transferId,
        targetPlatform: claim.targetPlatform,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
    return { valid: true, transferId: claim.transferId };
  }
}

function _validateTransfer(policy, attestationClient, transfer) {
  if (
    typeof transfer.amount !== "number" ||
    transfer.amount > (policy.maxAssetTransactionValue || 1000000)
  ) {
    throw new HsmAdapterError(
      "BRIDGE_VALUE_EXCEEDED",
      `asset transaction value ${transfer.amount} exceeds maximum ${policy.maxAssetTransactionValue}`,
    );
  }
  if (
    typeof transfer.lockEpoch !== "number" ||
    typeof transfer.releaseEpoch !== "number"
  ) {
    throw new HsmAdapterError(
      "BRIDGE_EPOCHS_INVALID",
      "lock and release epochs are required",
    );
  }
  if (
    transfer.releaseEpoch - transfer.lockEpoch <
    (policy.minLockEpochDuration || 60)
  ) {
    throw new HsmAdapterError(
      "BRIDGE_LOCK_TOO_SHORT",
      `lock duration ${transfer.releaseEpoch - transfer.lockEpoch} below minimum ${policy.minLockEpochDuration}`,
    );
  }
  if (policy.requireSourceAttestation && attestationClient) {
    const result = attestationClient.verify(transfer.sourceAttestation);
    if (!result.verified) {
      throw new HsmAdapterError(
        "BRIDGE_SOURCE_UNATTESTED",
        "source platform attestation invalid",
      );
    }
  }
  if (policy.requireTargetAttestation && attestationClient) {
    const result = attestationClient.verify(transfer.targetAttestation);
    if (!result.verified) {
      throw new HsmAdapterError(
        "BRIDGE_TARGET_UNATTESTED",
        "target platform attestation invalid",
      );
    }
  }
  if (
    typeof transfer.bridgeAuthority === "string" &&
    !policy.allowedBridgeAuthorities.includes(transfer.bridgeAuthority)
  ) {
    throw new HsmAdapterError(
      "BRIDGE_AUTHORITY_BLOCKED",
      `bridge authority ${transfer.bridgeAuthority} is not allowed; permitted: ${policy.allowedBridgeAuthorities.join(", ")}`,
    );
  }
}

function _validateClaim(policy, attestationClient, claim) {
  if (
    typeof claim.claimedAtEpoch !== "number" ||
    typeof claim.lockedAtEpoch !== "number"
  ) {
    throw new HsmAdapterError(
      "BRIDGE_CLAIM_EPOCHS_INVALID",
      "claim epochs are required",
    );
  }
  if (
    claim.claimedAtEpoch - claim.lockedAtEpoch >
    (policy.maxClaimExpirationEpochs || 10)
  ) {
    throw new HsmAdapterError(
      "BRIDGE_CLAIM_EXPIRED",
      `claim expiration ${claim.claimedAtEpoch - claim.lockedAtEpoch} exceeds maximum ${policy.maxClaimExpirationEpochs}`,
    );
  }
  if (policy.requireTargetAttestation && attestationClient) {
    const result = attestationClient.verify(claim.targetAttestation);
    if (!result.verified) {
      throw new HsmAdapterError(
        "BRIDGE_TARGET_UNATTESTED",
        "claim target attestation invalid",
      );
    }
  }
}

function _canonicalPayload(transfer, signatures) {
  const sigs = signatures.join(":");
  return `BRIDGE:${transfer.sourcePlatform}:${transfer.targetPlatform}:${transfer.assetId}:${transfer.amount}:${transfer.recipient}:${transfer.lockEpoch}:${transfer.releaseEpoch}:${sigs}`;
}

module.exports = { PqcAssetBridgeHub };
