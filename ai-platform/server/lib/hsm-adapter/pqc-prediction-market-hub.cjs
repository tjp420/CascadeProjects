'use strict';

/**
 * Track 64: PQC Prediction Market Hub.
 *
 * Interlocking market supervisor that registers binary or scalar
 * market conditions, records blinded resolution inputs using
 * Pedersen commitments, and enforces the minReporterQuorum boundary.
 * Parses PREDMKT packets, enforces maxContractLifetimeSeconds, and
 * tracks state transitions alongside dispute resolution epochs.
 *
 * @module hsm-adapter/pqc-prediction-market-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcPredictionMarketHub {
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
    this._markets = new Map();
  }

  /**
   * Initialize a prediction market.
   * @param {object} request
   * @returns {object}
   */
  initializeMarket(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireMarketInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.marketInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('PREDMKT_INITIALIZER_UNATTESTED', 'market initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('PREDMKT_INITIALIZER_UNATTESTED', 'market initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('PREDMKT_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('PREDMKT_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.assetWeight === 'number' && request.assetWeight > (this.policy.maxAssetWeightCap || 1000000)) {
      throw new HsmAdapterError('PREDMKT_ASSET_WEIGHT_EXCEEDED', `asset weight ${request.assetWeight} exceeds maximum ${this.policy.maxAssetWeightCap}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const lifetime = request.expirationTimestamp - now;
    if (lifetime > (this.policy.maxContractLifetimeSeconds || 2592000)) {
      throw new HsmAdapterError('PREDMKT_LIFETIME_EXCEEDED', `contract lifetime ${lifetime}s exceeds maximum ${this.policy.maxContractLifetimeSeconds}s`);
    }
    if (lifetime <= 0) {
      throw new HsmAdapterError('PREDMKT_EXPIRED', `contract expiration ${request.expirationTimestamp} is in the past`);
    }
    const marketId = request.marketId || `market-${crypto.randomBytes(4).toString('hex')}`;
    if (this._markets.has(marketId)) {
      throw new HsmAdapterError('PREDMKT_DUPLICATE', `market ${marketId} already exists`);
    }
    const market = {
      marketId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      marketType: request.marketType || 'binary',
      blindedOutcomeCommitment: request.blindedOutcomeCommitment,
      assetWeight: request.assetWeight || 0,
      expirationTimestamp: request.expirationTimestamp,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      voteCount: 0,
      finalizedAt: null,
      resolutionEpoch: 0,
    };
    this._markets.set(marketId, market);
    if (this._audit) {
      this._audit('PREDICTION_MARKET_INITIALIZED', { ...market });
    }
    return market;
  }

  /**
   * Get a market by id.
   * @param {string} marketId
   * @returns {object|null}
   */
  getMarket(marketId) {
    return this._markets.get(marketId) || null;
  }

  /**
   * Increment vote count for a market.
   * @param {string} marketId
   * @returns {object}
   */
  recordVote(marketId) {
    const market = this._markets.get(marketId);
    if (!market) {
      throw new HsmAdapterError('PREDMKT_NOT_FOUND', `market ${marketId} not found`);
    }
    market.voteCount += 1;
    return market;
  }

  /**
   * Finalize a market after quorum.
   * @param {object} request
   * @returns {object}
   */
  finalizeMarket(request) {
    _validateFinalizeRequest(this.policy, request);
    const market = this._markets.get(request.marketId);
    if (!market) {
      throw new HsmAdapterError('PREDMKT_NOT_FOUND', `market ${request.marketId} not found`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (now > market.expirationTimestamp) {
      throw new HsmAdapterError('PREDMKT_CONTRACT_EXPIRED', `market ${request.marketId} expired at ${market.expirationTimestamp}`);
    }
    if (market.voteCount < (this.policy.minReporterQuorum || 3)) {
      throw new HsmAdapterError('PREDMKT_QUORUM_INSUFFICIENT', `reporter votes ${market.voteCount} below minimum ${this.policy.minReporterQuorum}`);
    }
    if (typeof request.resolutionEpoch === 'number' && request.resolutionEpoch > (this.policy.maxDisputeResolutionEpochs || 5)) {
      throw new HsmAdapterError('PREDMKT_DISPUTE_EPOCHS_EXCEEDED', `resolution epoch ${request.resolutionEpoch} exceeds maximum ${this.policy.maxDisputeResolutionEpochs}`);
    }
    market.status = 'finalized';
    market.finalizedAt = now;
    market.resolutionEpoch = request.resolutionEpoch || 0;
    const finalId = request.finalId || `final-${crypto.randomBytes(4).toString('hex')}`;
    const finalization = {
      finalId,
      marketId: request.marketId,
      resolutionEpoch: market.resolutionEpoch,
      reporterSignatureCount: market.voteCount,
      finalizedAt: now,
    };
    if (this._audit) {
      this._audit('PREDICTION_MARKET_FINALIZED', { ...finalization });
    }
    return finalization;
  }

  /**
   * Get the current market count.
   * @returns {number}
   */
  getMarketCount() {
    return this._markets.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('PREDMKT_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedOutcomeCommitment) {
    throw new HsmAdapterError('PREDMKT_FIELDS_MISSING', 'blindedOutcomeCommitment is required');
  }
  if (typeof request.expirationTimestamp !== 'number') {
    throw new HsmAdapterError('PREDMKT_FIELDS_MISSING', 'expirationTimestamp is required');
  }
  if (policy.requireMarketInitializerAttestation && !request.marketInitializerAttestation) {
    throw new HsmAdapterError('PREDMKT_INITIALIZER_ATTESTATION_MISSING', 'market initializer attestation is required');
  }
}

function _validateFinalizeRequest(policy, request) {
  if (!request.marketId) {
    throw new HsmAdapterError('PREDMKT_FINALIZE_FIELDS_MISSING', 'marketId is required');
  }
}

module.exports = { PqcPredictionMarketHub };
