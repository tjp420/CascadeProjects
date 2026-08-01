'use strict';

/**
 * Track 23: Provable multiparty declassification token.
 *
 * Wraps the signed consent payloads from the EscrowBroker, the broker's
 * attestation signature, and a temporal anchor. External auditors can
 * verify this token to prove that a cross-tenant key boundary violation
 * was explicitly authorized by both source and destination policy holders.
 *
 * @module hsm-adapter/declassification-proof
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

function _stringToBuffer(value) {
  return Buffer.from(String(value), 'utf8');
}

class DeclassificationProof {
  /**
   * @param {object} fields
   * @param {string} fields.escrowId
   * @param {string} fields.sourceTenantId
   * @param {string} fields.destTenantId
   * @param {string} fields.keyRef
   * @param {number} fields.consensusTimestamp
   * @param {number} fields.expiry
   * @param {Array<{tenantId, payload, signature}>} fields.consentSignatures
   * @param {string} [fields.brokerSignature]
   */
  constructor(fields = {}) {
    this.version = 1;
    this.escrowId = fields.escrowId || '';
    this.sourceTenantId = fields.sourceTenantId || '';
    this.destTenantId = fields.destTenantId || '';
    this.keyRef = fields.keyRef || '';
    this.consensusTimestamp = fields.consensusTimestamp || 0;
    this.expiry = fields.expiry || 0;
    this.consentSignatures = Array.isArray(fields.consentSignatures) ? fields.consentSignatures : [];
    this.brokerSignature = fields.brokerSignature || null;
  }

  _consentHash() {
    const canonical = this.consentSignatures
      .slice()
      .sort((a, b) => a.tenantId.localeCompare(b.tenantId))
      .map((s) => `${s.tenantId}:${s.payload}:${s.signature}`)
      .join('|');
    return crypto.createHash('sha256').update(_stringToBuffer(canonical)).digest();
  }

  _canonical() {
    const parts = [
      _stringToBuffer(this.version),
      _stringToBuffer(this.escrowId),
      _stringToBuffer(this.sourceTenantId),
      _stringToBuffer(this.destTenantId),
      _stringToBuffer(this.keyRef),
      _stringToBuffer(this.consensusTimestamp),
      _stringToBuffer(this.expiry),
      this._consentHash(),
    ];
    return Buffer.concat(parts);
  }

  /**
   * Sign this proof with the broker's private key.
   * @param {Buffer|string} brokerPrivateKey
   * @returns {DeclassificationProof}
   */
  sign(brokerPrivateKey) {
    const signer = crypto.createSign('sha256');
    signer.update(this._canonical());
    this.brokerSignature = signer.sign(brokerPrivateKey, 'base64');
    return this;
  }

  /**
   * Verify all signatures and the temporal window.
   * @param {object} publicKeys - map of tenantId to public key (PEM/Buffer)
   * @param {Buffer|string} brokerPublicKey
   * @param {number} currentTimestamp
   * @returns {boolean}
   */
  verify(publicKeys, brokerPublicKey, currentTimestamp) {
    if (!this.brokerSignature) {
      throw new HsmAdapterError('EPOCH_SIGNATURE_INVALID', 'declassification proof has no broker signature');
    }
    if (typeof currentTimestamp === 'number' && currentTimestamp > this.expiry) {
      throw new HsmAdapterError('ESCROW_CONSENT_MISSING', 'declassification token has expired');
    }

    const verifier = crypto.createVerify('sha256');
    verifier.update(this._canonical());
    if (!verifier.verify(brokerPublicKey, this.brokerSignature, 'base64')) {
      throw new HsmAdapterError('INVALID_ESCROW_SIGNATURE', 'broker attestation signature is invalid');
    }

    for (const consent of this.consentSignatures) {
      const publicKey = publicKeys && publicKeys[consent.tenantId];
      if (!publicKey) {
        throw new HsmAdapterError('INVALID_ESCROW_SIGNATURE', `no public key for tenant ${consent.tenantId}`);
      }
      const cv = crypto.createVerify('sha256');
      cv.update(_stringToBuffer(consent.payload));
      if (!cv.verify(publicKey, consent.signature, 'base64')) {
        throw new HsmAdapterError('INVALID_ESCROW_SIGNATURE', `consent signature from ${consent.tenantId} is invalid`);
      }
    }

    return true;
  }
}

module.exports = {
  DeclassificationProof,
};
