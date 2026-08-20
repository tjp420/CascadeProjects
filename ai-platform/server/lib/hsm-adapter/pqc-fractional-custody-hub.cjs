"use strict";

/**
 * Track 65: PQC Fractional Custody Hub.
 *
 * Interlocking fractional asset supervisor that instantiates
 * multi-tenant vaults using homomorphically split Pedersen
 * commitments over distinct ownership shards and asset
 * denominations. Parses FRACVAULT packets, enforces
 * maxAssetCustodyCap, and tracks state transitions alongside
 * the minCustodianQuorum boundary.
 *
 * Extended with cross-chain liquidity bridge support, escrow
 * locking, batch vault initialization, custodian committee
 * signature aggregation, vault cancellation, cross-chain
 * settlement, and summary statistics.
 *
 * @module hsm-adapter/pqc-fractional-custody-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const VAULT_STATUS = {
  OPEN: "open",
  ESCROWED: "escrowed",
  LIQUIDATED: "liquidated",
  SETTLED: "settled",
  CANCELLED: "cancelled",
};

const ESCROW_LOCK_TYPES = {
  TIME_LOCK: "time_lock",
  HASH_LOCK: "hash_lock",
  QUORUM_LOCK: "quorum_lock",
};

class PqcFractionalCustodyHub {
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
    this._vaults = new Map();
    this._escrows = new Map();
    this._settlements = new Map();
    this._maxVaults = options.maxVaults || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._liquidateCount = 0;
    this._settleCount = 0;
    this._escrowCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize a fractional custody vault.
   * @param {object} request
   * @returns {object}
   */
  initializeVault(request) {
    _validateInitRequest(this.policy, request);
    if (this._vaults.size >= this._maxVaults) {
      throw new HsmAdapterError(
        "FRACVAULT_MAX_VAULTS",
        `maximum ${this._maxVaults} vaults reached`,
      );
    }
    if (this.policy.requireClaimantAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.claimantAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "FRACVAULT_CLAIMANT_UNATTESTED",
            "claimant attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "FRACVAULT_CLAIMANT_UNATTESTED",
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
        "FRACVAULT_ATTESTATION_AUTHORITY_BLOCKED",
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
        "FRACVAULT_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.fractionalBits === "number" &&
      request.fractionalBits > (this.policy.maxFractionalBits || 64)
    ) {
      throw new HsmAdapterError(
        "FRACVAULT_FRACTIONAL_BITS_EXCEEDED",
        `fractional bits ${request.fractionalBits} exceeds maximum ${this.policy.maxFractionalBits}`,
      );
    }
    if (
      typeof request.assetCustodyCap === "number" &&
      request.assetCustodyCap > (this.policy.maxAssetCustodyCap || 1000000000)
    ) {
      throw new HsmAdapterError(
        "FRACVAULT_ASSET_CUSTODY_CAP_EXCEEDED",
        `asset custody cap ${request.assetCustodyCap} exceeds maximum ${this.policy.maxAssetCustodyCap}`,
      );
    }
    const vaultId =
      request.vaultId || `vault-${crypto.randomBytes(4).toString("hex")}`;
    if (this._vaults.has(vaultId)) {
      throw new HsmAdapterError(
        "FRACVAULT_DUPLICATE",
        `vault ${vaultId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    // Parse cross-chain liquidity bridge parameters if provided
    const liquidityBridge = request.liquidityBridge
      ? this._parseLiquidityBridge(request.liquidityBridge)
      : null;
    const vault = {
      vaultId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedBalanceCommitment: request.blindedBalanceCommitment,
      assetDenomination: request.assetDenomination || "base",
      assetCustodyCap: request.assetCustodyCap || 0,
      fractionalBits: request.fractionalBits || 32,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: VAULT_STATUS.OPEN,
      releasedFractionSum: 0,
      releaseCount: 0,
      liquidatedAt: null,
      liquidityBridge,
      escrowStatus: null,
      escrowedAt: null,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._vaults.set(vaultId, vault);
    this._initCount++;
    if (this._audit) {
      this._audit("FRACTIONAL_VAULT_INITIALIZED", { ...vault });
    }
    return vault;
  }

  /**
   * Batch initialize multiple fractional custody vaults.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializeVaults(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "FRACVAULT_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "FRACVAULT_BATCH_TOO_LARGE",
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`,
      );
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const vault = this.initializeVault(req);
        results.push({ vaultId: vault.vaultId, initialized: true });
        successCount++;
      } catch (err) {
        results.push({
          vaultId: req.vaultId || "auto",
          initialized: false,
          error: err.code || "FRACVAULT_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("FRACVAULT_BATCH_INITIALIZED", {
        successCount,
        failedCount,
        batchSize: requests.length,
      });
    }
    return {
      totalRequests: requests.length,
      successCount,
      failedCount,
      results,
    };
  }

  /**
   * Get a vault by id.
   * @param {string} vaultId
   * @returns {object|null}
   */
  getVault(vaultId) {
    return this._vaults.get(vaultId) || null;
  }

  /**
   * Record a fractional release.
   * @param {string} vaultId
   * @param {number} fractionValue
   * @returns {object}
   */
  recordRelease(vaultId, fractionValue) {
    const vault = this._vaults.get(vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${vaultId} not found`,
      );
    }
    if (
      vault.status !== VAULT_STATUS.OPEN &&
      vault.status !== VAULT_STATUS.ESCROWED
    ) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_OPEN",
        `vault ${vaultId} is not open (status: ${vault.status})`,
      );
    }
    vault.releasedFractionSum += fractionValue;
    vault.releaseCount += 1;
    return vault;
  }

  /**
   * Lock vault assets in escrow.
   * @param {object} request
   * @returns {object}
   */
  lockEscrow(request) {
    if (!request || !request.vaultId) {
      throw new HsmAdapterError(
        "FRACVAULT_ESCROW_FIELDS_MISSING",
        "vaultId is required",
      );
    }
    const vault = this._vaults.get(request.vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${request.vaultId} not found`,
      );
    }
    if (vault.status !== VAULT_STATUS.OPEN) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_OPEN",
        `vault ${request.vaultId} status is ${vault.status}, expected open`,
      );
    }
    const lockType = request.lockType || ESCROW_LOCK_TYPES.TIME_LOCK;
    if (!Object.values(ESCROW_LOCK_TYPES).includes(lockType)) {
      throw new HsmAdapterError(
        "FRACVAULT_ESCROW_LOCK_TYPE_INVALID",
        `lock type ${lockType} is not valid; allowed: ${Object.values(ESCROW_LOCK_TYPES).join(", ")}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const escrowId =
      request.escrowId || `escrow-${crypto.randomBytes(4).toString("hex")}`;
    const escrow = {
      escrowId,
      vaultId: request.vaultId,
      lockType,
      lockExpiry: request.lockExpiry || now + 86400,
      hashPreimage: request.hashPreimage || null,
      lockedAmount: request.lockedAmount || vault.assetCustodyCap,
      lockedAt: now,
    };
    vault.status = VAULT_STATUS.ESCROWED;
    vault.escrowStatus = "locked";
    vault.escrowedAt = now;
    this._escrows.set(escrowId, escrow);
    this._escrowCount++;
    if (this._audit) {
      this._audit("FRACVAULT_ESCROW_LOCKED", { ...escrow });
    }
    return escrow;
  }

  /**
   * Release escrow lock.
   * @param {string} escrowId
   * @returns {object}
   */
  releaseEscrow(escrowId) {
    const escrow = this._escrows.get(escrowId);
    if (!escrow) {
      throw new HsmAdapterError(
        "FRACVAULT_ESCROW_NOT_FOUND",
        `escrow ${escrowId} not found`,
      );
    }
    const vault = this._vaults.get(escrow.vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${escrow.vaultId} not found`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    vault.status = VAULT_STATUS.OPEN;
    vault.escrowStatus = "released";
    escrow.releasedAt = now;
    if (this._audit) {
      this._audit("FRACVAULT_ESCROW_RELEASED", {
        escrowId,
        vaultId: escrow.vaultId,
      });
    }
    return { escrowId, vaultId: escrow.vaultId, released: true };
  }

  /**
   * Get an escrow record by id.
   * @param {string} escrowId
   * @returns {object|null}
   */
  getEscrow(escrowId) {
    return this._escrows.get(escrowId) || null;
  }

  /**
   * Liquidate a vault after all fractions reconcile.
   * @param {object} request
   * @returns {object}
   */
  liquidateVault(request) {
    _validateLiquidateRequest(this.policy, request);
    const vault = this._vaults.get(request.vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${request.vaultId} not found`,
      );
    }
    if (
      vault.status !== VAULT_STATUS.OPEN &&
      vault.status !== VAULT_STATUS.ESCROWED
    ) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_OPEN",
        `vault ${request.vaultId} is not open (status: ${vault.status})`,
      );
    }
    if (vault.releaseCount < (this.policy.minCustodianQuorum || 3)) {
      throw new HsmAdapterError(
        "FRACVAULT_QUORUM_INSUFFICIENT",
        `custodian releases ${vault.releaseCount} below minimum ${this.policy.minCustodianQuorum}`,
      );
    }
    if (
      typeof request.releasedFractionSum === "number" &&
      request.releasedFractionSum !== vault.releasedFractionSum
    ) {
      throw new HsmAdapterError(
        "FRACVAULT_RECONCILIATION_FAILED",
        `released fraction sum ${request.releasedFractionSum} does not match vault sum ${vault.releasedFractionSum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    vault.status = VAULT_STATUS.LIQUIDATED;
    vault.liquidatedAt = now;
    const liquidationId =
      request.liquidationId || `liq-${crypto.randomBytes(4).toString("hex")}`;
    const liquidation = {
      liquidationId,
      vaultId: request.vaultId,
      releasedFractionSum: vault.releasedFractionSum,
      custodianSignatureCount: vault.releaseCount,
      liquidatedAt: now,
    };
    this._liquidateCount++;
    if (this._audit) {
      this._audit("CUSTODY_VAULT_LIQUIDATED", { ...liquidation });
    }
    return liquidation;
  }

  /**
   * Settle a liquidated vault cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settleVault(request) {
    if (!request || !request.vaultId) {
      throw new HsmAdapterError(
        "FRACVAULT_SETTLE_FIELDS_MISSING",
        "vaultId is required",
      );
    }
    const vault = this._vaults.get(request.vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${request.vaultId} not found`,
      );
    }
    if (vault.status !== VAULT_STATUS.LIQUIDATED) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_LIQUIDATED",
        `vault ${request.vaultId} status is ${vault.status}, expected liquidated`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "FRACVAULT_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== vault.targetChainId) {
      throw new HsmAdapterError(
        "FRACVAULT_SETTLE_CHAIN_MISMATCH",
        `settlement chain ${request.targetChainId} does not match vault target ${vault.targetChainId}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const settlementId =
      request.settlementId || `settle-${crypto.randomBytes(4).toString("hex")}`;
    const settlement = {
      settlementId,
      vaultId: request.vaultId,
      targetChainId: request.targetChainId,
      settlementProofHash:
        request.settlementProofHash ||
        crypto
          .createHash("sha256")
          .update(`${request.vaultId}:${request.targetChainId}:${now}`)
          .digest("hex"),
      settledAt: now,
    };
    vault.status = VAULT_STATUS.SETTLED;
    vault.settlementStatus = "settled";
    vault.settledAt = now;
    this._settlements.set(request.vaultId, settlement);
    this._settleCount++;
    if (this._audit) {
      this._audit("FRACVAULT_SETTLED", { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate custodian committee signatures for vault liquidation.
   * @param {string} vaultId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCustodianSignatures(vaultId, partialSignatures) {
    const vault = this._vaults.get(vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${vaultId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "FRACVAULT_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minCustodianQuorum || 3)) {
      throw new HsmAdapterError(
        "FRACVAULT_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minCustodianQuorum || 3}`,
      );
    }
    const aggregatedSig = crypto
      .createHash("sha256")
      .update(partialSignatures.map((s) => s.signature).join(":"))
      .digest("hex");
    const result = {
      vaultId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
      participantIds: partialSignatures.map((s) => s.peerId || "anonymous"),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("FRACVAULT_SIGNATURES_AGGREGATED", {
        vaultId,
        count: partialSignatures.length,
      });
    }
    return result;
  }

  /**
   * Cancel a vault (only if not yet liquidated).
   * @param {string} vaultId
   * @returns {object}
   */
  cancelVault(vaultId) {
    const vault = this._vaults.get(vaultId);
    if (!vault) {
      throw new HsmAdapterError(
        "FRACVAULT_NOT_FOUND",
        `vault ${vaultId} not found`,
      );
    }
    if (
      vault.status === VAULT_STATUS.LIQUIDATED ||
      vault.status === VAULT_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "FRACVAULT_ALREADY_LIQUIDATED",
        `vault ${vaultId} has been liquidated/settled and cannot be cancelled`,
      );
    }
    if (vault.status === VAULT_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "FRACVAULT_ALREADY_CANCELLED",
        `vault ${vaultId} is already cancelled`,
      );
    }
    vault.status = VAULT_STATUS.CANCELLED;
    vault.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit("FRACVAULT_CANCELLED", { vaultId });
    }
    return { vaultId, cancelled: true };
  }

  /**
   * Get a settlement record by vault id.
   * @param {string} vaultId
   * @returns {object|null}
   */
  getSettlement(vaultId) {
    return this._settlements.get(vaultId) || null;
  }

  /**
   * Get all vaults (metadata only).
   * @returns {object[]}
   */
  getVaults() {
    return Array.from(this._vaults.values()).map((v) => ({
      vaultId: v.vaultId,
      sourceTenantId: v.sourceTenantId,
      targetChainId: v.targetChainId,
      status: v.status,
      assetDenomination: v.assetDenomination,
      assetCustodyCap: v.assetCustodyCap,
      releaseCount: v.releaseCount,
    }));
  }

  /**
   * Get the current vault count.
   * @returns {number}
   */
  getVaultCount() {
    return this._vaults.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const vaultsByStatus = {};
    for (const v of this._vaults.values()) {
      vaultsByStatus[v.status] = (vaultsByStatus[v.status] || 0) + 1;
    }
    return {
      totalVaults: this._vaults.size,
      totalEscrows: this._escrows.size,
      totalSettlements: this._settlements.size,
      vaultsByStatus,
      initCount: this._initCount,
      liquidateCount: this._liquidateCount,
      settleCount: this._settleCount,
      escrowCount: this._escrowCount,
      cancelCount: this._cancelCount,
    };
  }

  /**
   * Parse cross-chain liquidity bridge parameters.
   * @private
   */
  _parseLiquidityBridge(bridge) {
    if (!bridge || typeof bridge !== "object") {
      throw new HsmAdapterError(
        "FRACVAULT_BRIDGE_INVALID",
        "liquidityBridge must be an object",
      );
    }
    if (!bridge.sourceChainId || !bridge.targetChainId) {
      throw new HsmAdapterError(
        "FRACVAULT_BRIDGE_CHAINS_MISSING",
        "liquidityBridge.sourceChainId and targetChainId are required",
      );
    }
    return {
      sourceChainId: bridge.sourceChainId,
      targetChainId: bridge.targetChainId,
      bridgeType: bridge.bridgeType || "hash_lock",
      bridgeCapacity: bridge.bridgeCapacity || 0,
      bridgeFeeBps: bridge.bridgeFeeBps || 0,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "FRACVAULT_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (!request.blindedBalanceCommitment) {
    throw new HsmAdapterError(
      "FRACVAULT_FIELDS_MISSING",
      "blindedBalanceCommitment is required",
    );
  }
  if (policy.requireClaimantAttestation && !request.claimantAttestation) {
    throw new HsmAdapterError(
      "FRACVAULT_CLAIMANT_ATTESTATION_MISSING",
      "claimant attestation is required",
    );
  }
}

function _validateLiquidateRequest(policy, request) {
  if (!request.vaultId) {
    throw new HsmAdapterError(
      "FRACVAULT_LIQUIDATE_FIELDS_MISSING",
      "vaultId is required",
    );
  }
}

module.exports = {
  PqcFractionalCustodyHub,
  VAULT_STATUS,
  ESCROW_LOCK_TYPES,
};
