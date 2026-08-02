'use strict';

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
 * @module hsm-adapter/pqc-fractional-custody-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

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
  }

  /**
   * Initialize a fractional custody vault.
   * @param {object} request
   * @returns {object}
   */
  initializeVault(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireClaimantAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.claimantAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('FRACVAULT_CLAIMANT_UNATTESTED', 'claimant attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('FRACVAULT_CLAIMANT_UNATTESTED', 'claimant attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('FRACVAULT_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('FRACVAULT_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.fractionalBits === 'number' && request.fractionalBits > (this.policy.maxFractionalBits || 64)) {
      throw new HsmAdapterError('FRACVAULT_FRACTIONAL_BITS_EXCEEDED', `fractional bits ${request.fractionalBits} exceeds maximum ${this.policy.maxFractionalBits}`);
    }
    if (typeof request.assetCustodyCap === 'number' && request.assetCustodyCap > (this.policy.maxAssetCustodyCap || 1000000000)) {
      throw new HsmAdapterError('FRACVAULT_ASSET_CUSTODY_CAP_EXCEEDED', `asset custody cap ${request.assetCustodyCap} exceeds maximum ${this.policy.maxAssetCustodyCap}`);
    }
    const vaultId = request.vaultId || `vault-${crypto.randomBytes(4).toString('hex')}`;
    if (this._vaults.has(vaultId)) {
      throw new HsmAdapterError('FRACVAULT_DUPLICATE', `vault ${vaultId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const vault = {
      vaultId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedBalanceCommitment: request.blindedBalanceCommitment,
      assetDenomination: request.assetDenomination || 'base',
      assetCustodyCap: request.assetCustodyCap || 0,
      fractionalBits: request.fractionalBits || 32,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      releasedFractionSum: 0,
      releaseCount: 0,
      liquidatedAt: null,
    };
    this._vaults.set(vaultId, vault);
    if (this._audit) {
      this._audit('FRACTIONAL_VAULT_INITIALIZED', { ...vault });
    }
    return vault;
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
      throw new HsmAdapterError('FRACVAULT_NOT_FOUND', `vault ${vaultId} not found`);
    }
    if (vault.status !== 'open') {
      throw new HsmAdapterError('FRACVAULT_NOT_OPEN', `vault ${vaultId} is not open (status: ${vault.status})`);
    }
    vault.releasedFractionSum += fractionValue;
    vault.releaseCount += 1;
    return vault;
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
      throw new HsmAdapterError('FRACVAULT_NOT_FOUND', `vault ${request.vaultId} not found`);
    }
    if (vault.status !== 'open') {
      throw new HsmAdapterError('FRACVAULT_NOT_OPEN', `vault ${request.vaultId} is not open (status: ${vault.status})`);
    }
    if (vault.releaseCount < (this.policy.minCustodianQuorum || 3)) {
      throw new HsmAdapterError('FRACVAULT_QUORUM_INSUFFICIENT', `custodian releases ${vault.releaseCount} below minimum ${this.policy.minCustodianQuorum}`);
    }
    if (typeof request.releasedFractionSum === 'number' && request.releasedFractionSum !== vault.releasedFractionSum) {
      throw new HsmAdapterError('FRACVAULT_RECONCILIATION_FAILED', `released fraction sum ${request.releasedFractionSum} does not match vault sum ${vault.releasedFractionSum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    vault.status = 'liquidated';
    vault.liquidatedAt = now;
    const liquidationId = request.liquidationId || `liq-${crypto.randomBytes(4).toString('hex')}`;
    const liquidation = {
      liquidationId,
      vaultId: request.vaultId,
      releasedFractionSum: vault.releasedFractionSum,
      custodianSignatureCount: vault.releaseCount,
      liquidatedAt: now,
    };
    if (this._audit) {
      this._audit('CUSTODY_VAULT_LIQUIDATED', { ...liquidation });
    }
    return liquidation;
  }

  /**
   * Get the current vault count.
   * @returns {number}
   */
  getVaultCount() {
    return this._vaults.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('FRACVAULT_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedBalanceCommitment) {
    throw new HsmAdapterError('FRACVAULT_FIELDS_MISSING', 'blindedBalanceCommitment is required');
  }
  if (policy.requireClaimantAttestation && !request.claimantAttestation) {
    throw new HsmAdapterError('FRACVAULT_CLAIMANT_ATTESTATION_MISSING', 'claimant attestation is required');
  }
}

function _validateLiquidateRequest(policy, request) {
  if (!request.vaultId) {
    throw new HsmAdapterError('FRACVAULT_LIQUIDATE_FIELDS_MISSING', 'vaultId is required');
  }
}

module.exports = { PqcFractionalCustodyHub };
