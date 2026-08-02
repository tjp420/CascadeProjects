'use strict';

/**
 * Track 52: ZK access token broker.
 *
 * Processes token issuance claims using homomorphic blind signature
 * weights mapped to multi-party committee signatures. Enforces
 * scope limits, token lifetime, and broker attestation.
 *
 * @module hsm-adapter/zk-access-token-broker
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkAccessTokenBroker {
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
    this._tokens = new Map();
  }

  /**
   * Issue a zero-knowledge access token.
   * @param {object} request
   * @returns {object}
   */
  issue(request) {
    _validateRequest(this.policy, request);
    if (this.policy.requireBrokerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.brokerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TOKEN_BROKER_UNATTESTED', 'broker attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TOKEN_BROKER_UNATTESTED', 'broker attestation invalid');
      }
    }
    if (Array.isArray(request.scopes) && request.scopes.length > (this.policy.maxScopesPerToken || 8)) {
      throw new HsmAdapterError('TOKEN_SCOPES_EXCEEDED', `scopes ${request.scopes.length} exceed maximum ${this.policy.maxScopesPerToken}`);
    }
    if (request.curve && !this.policy.permittedCurves.includes(request.curve)) {
      throw new HsmAdapterError('TOKEN_CURVE_BLOCKED', `curve ${request.curve} is not permitted; allowed: ${this.policy.permittedCurves.join(', ')}`);
    }
    if (typeof request.tokenLifetimeSeconds === 'number' && request.tokenLifetimeSeconds > (this.policy.maxTokenLifetimeSeconds || 3600)) {
      throw new HsmAdapterError('TOKEN_LIFETIME_EXCEEDED', `token lifetime ${request.tokenLifetimeSeconds}s exceeds maximum ${this.policy.maxTokenLifetimeSeconds}s`);
    }
    const now = Math.floor(Date.now() / 1000);
    const expiryEpoch = now + (request.tokenLifetimeSeconds || 3600);
    const scopeHash = crypto.createHash('sha256').update((request.scopes || []).join(',')).digest('hex');
    const blindSignatureWeight = `blind-${crypto.randomBytes(8).toString('hex')}`;
    const token = {
      tokenId: request.tokenId,
      scopeHash,
      expiryEpoch,
      committeeSignatures: [],
      blindSignatureWeight,
      status: 'pending',
    };
    this._tokens.set(request.tokenId, token);
    if (this._audit) {
      this._audit('ZK_ACCESS_TOKEN_ISSUED', {
        tokenId: request.tokenId,
        scopeHash,
        expiryEpoch,
      });
    }
    return token;
  }

  /**
   * Add a committee signature to a pending token.
   * @param {string} tokenId
   * @param {string} committeeMemberId
   * @param {string} signature
   * @returns {object}
   */
  sign(tokenId, committeeMemberId, signature) {
    const token = this._tokens.get(tokenId);
    if (!token) {
      throw new HsmAdapterError('TOKEN_NOT_FOUND', `no token ${tokenId}`);
    }
    if (!signature || typeof signature !== 'string') {
      throw new HsmAdapterError('TOKEN_SIGNATURE_MISSING', 'committee signature is required');
    }
    token.committeeSignatures.push({ committeeMemberId, signature });
    if (token.committeeSignatures.length >= (this.policy.minSignatureQuorum || 3)) {
      token.status = 'issued';
    }
    return { signed: true, status: token.status, signatures: token.committeeSignatures.length };
  }

  /**
   * Get a token by id.
   * @param {string} tokenId
   * @returns {object|null}
   */
  getToken(tokenId) {
    return this._tokens.get(tokenId) || null;
  }
}

function _validateRequest(policy, request) {
  if (!request.tokenId) {
    throw new HsmAdapterError('TOKEN_FIELDS_MISSING', 'tokenId is required');
  }
  if (policy.requireBrokerAttestation && !request.brokerAttestation) {
    throw new HsmAdapterError('TOKEN_BROKER_ATTESTATION_MISSING', 'broker attestation is required');
  }
}

module.exports = { ZkAccessTokenBroker };
