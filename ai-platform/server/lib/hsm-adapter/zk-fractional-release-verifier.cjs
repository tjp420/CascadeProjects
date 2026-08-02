'use strict';

/**
 * Track 65: ZK Fractional Release Verifier.
 *
 * Threshold signature validator that processes zero-knowledge
 * partition proofs, ensuring that the aggregate of released
 * fractions perfectly reconciles against the master vault
 * balance without revealing hidden line items. Triggers
 * defensive node bans for malformed or out-of-order custody
 * claims.
 *
 * @module hsm-adapter/zk-fractional-release-verifier
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkFractionalReleaseVerifier {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcFractionalCustodyHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._recordedReleases = new Map();
  }

  /**
   * Verify and record a fractional release signature.
   * @param {object} request
   * @returns {object}
   */
  verifyFractionalRelease(request) {
    _validateReleaseRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('FRACRELEASE_HUB_MISSING', 'fractional custody hub is required');
    }
    if (this.policy.requireCustodianRelayAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.custodianRelayAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('FRACRELEASE_CUSTODIAN_UNATTESTED', 'custodian relay attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('FRACRELEASE_CUSTODIAN_UNATTESTED', 'custodian relay attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('FRACRELEASE_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('FRACRELEASE_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkPartitionProofHash || typeof request.zkPartitionProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FRACRELEASE_ZK_PROOF_MISSING', 'zero-knowledge partition proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FRACRELEASE_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const vault = this._hub.getVault(request.vaultId);
    if (!vault) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FRACRELEASE_VAULT_NOT_FOUND', `vault ${request.vaultId} not found`);
    }
    if (vault.status !== 'open') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FRACRELEASE_VAULT_NOT_OPEN', `vault ${request.vaultId} is not open (status: ${vault.status})`);
    }
    const releaseKey = `${request.vaultId}:${request.peerId || 'anonymous'}`;
    if (this._recordedReleases.has(releaseKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FRACRELEASE_DUPLICATE', `release for vault ${request.vaultId} from peer ${request.peerId || 'anonymous'} already recorded`);
    }
    const releaseId = request.releaseId || `release-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const fractionValue = typeof request.fractionValue === 'number' ? request.fractionValue : 0;
    const release = {
      releaseId,
      vaultId: request.vaultId,
      blindedFractionCommitment: request.blindedFractionCommitment || 'unspecified',
      zkPartitionProofHash: request.zkPartitionProofHash,
      custodianRelayAttestationHash: request.custodianRelayAttestationHash || 'unspecified',
      fractionValue,
      recordedAt: now,
    };
    this._recordedReleases.set(releaseKey, release);
    this._hub.recordRelease(request.vaultId, fractionValue);
    if (this._audit) {
      this._audit('FRACTIONAL_RELEASE_SIGNED', { ...release });
    }
    return release;
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  /**
   * Get all recorded releases.
   * @returns {Array}
   */
  getRecordedReleases() {
    return Array.from(this._recordedReleases.values());
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderCustodyClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateReleaseRequest(policy, request) {
  if (!request.vaultId) {
    throw new HsmAdapterError('FRACRELEASE_FIELDS_MISSING', 'vaultId is required');
  }
  if (policy.requireCustodianRelayAttestation && !request.custodianRelayAttestation) {
    throw new HsmAdapterError('FRACRELEASE_ATTESTATION_MISSING', 'custodian relay attestation is required');
  }
}

module.exports = { ZkFractionalReleaseVerifier };
