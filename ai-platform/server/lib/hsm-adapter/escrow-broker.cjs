"use strict";

/**
 * Track 23: Cross-tenant key escrow broker.
 *
 * Orchestrates dual-authorization escrow workflows between a source and
 * destination tenant. Each party must sign a canonical consent payload;
 * the broker then mints a tamper-evident DeclassificationProof that the
 * destination can present when requesting an escrowed key unwrap.
 *
 * @module hsm-adapter/escrow-broker
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");
const { DeclassificationProof } = require("./declassification-proof.cjs");

class EscrowBroker {
  /**
   * @param {object} [options]
   * @param {object} [options.publicKeys] - map of tenantId to public key
   * @param {CryptoPolicyEngine} [options.policyEngine]
   * @param {TimeAnchorEngine} [options.timeAnchor]
   * @param {object} [options.brokerKeyPair] - { publicKey, privateKey }
   */
  constructor(options = {}) {
    this._publicKeys = options.publicKeys || {};
    this._policyEngine = options.policyEngine || null;
    this._timeAnchor = options.timeAnchor || null;
    this._brokerKeyPair =
      options.brokerKeyPair ||
      crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    this._escrows = new Map();
    this._byKeyRef = new Map();
  }

  _consentCanonical(escrow, tenantId) {
    return `${escrow.version}|${escrow.escrowId}|${escrow.sourceTenantId}|${escrow.destTenantId}|${escrow.keyRef}|${escrow.initiatedAt}|${tenantId}`;
  }

  _consensusTime() {
    return this._timeAnchor ? this._timeAnchor.currentEpoch() : Date.now();
  }

  /**
   * Begin a new escrow between two tenants.
   * @param {string} sourceTenantId
   * @param {string} destTenantId
   * @param {string} keyRef
   * @returns {string} escrowId
   */
  initiateEscrow(sourceTenantId, destTenantId, keyRef) {
    if (sourceTenantId === destTenantId) {
      throw new HsmAdapterError(
        "POLICY_VIOLATION_BLOCKED",
        "source and destination tenant must be different",
      );
    }
    if (!this._publicKeys[sourceTenantId] || !this._publicKeys[destTenantId]) {
      throw new HsmAdapterError(
        "UNAUTHORIZED_KEY_ACCESS",
        "escrow requires public keys for both tenants",
      );
    }

    const escrowId = crypto.randomUUID();
    const escrow = {
      version: 1,
      escrowId,
      sourceTenantId,
      destTenantId,
      keyRef,
      initiatedAt: Date.now(),
      consents: new Map(),
      finalized: false,
      proof: null,
    };

    this._escrows.set(escrowId, escrow);
    this._byKeyRef.set(keyRef, escrowId);
    return escrowId;
  }

  /**
   * Submit a signed consent from one of the escrow parties.
   * @param {string} escrowId
   * @param {string} tenantId
   * @param {string} signature - base64
   */
  consentToEscrow(escrowId, tenantId, signature) {
    const escrow = this._escrows.get(escrowId);
    if (!escrow) {
      throw new HsmAdapterError(
        "UNKNOWN_ESCROW",
        `escrow not found: ${escrowId}`,
      );
    }
    if (escrow.finalized) {
      throw new HsmAdapterError(
        "ESCROW_ALREADY_FINALIZED",
        `escrow ${escrowId} is already finalized`,
      );
    }
    if (
      tenantId !== escrow.sourceTenantId &&
      tenantId !== escrow.destTenantId
    ) {
      throw new HsmAdapterError(
        "UNAUTHORIZED_KEY_ACCESS",
        `tenant ${tenantId} is not a party to escrow ${escrowId}`,
      );
    }
    if (escrow.consents.has(tenantId)) {
      throw new HsmAdapterError(
        "ESCROW_ALREADY_CONSENTED",
        `tenant ${tenantId} already consented to escrow ${escrowId}`,
      );
    }

    const publicKey = this._publicKeys[tenantId];
    if (!publicKey) {
      throw new HsmAdapterError(
        "UNAUTHORIZED_KEY_ACCESS",
        `no public key registered for tenant ${tenantId}`,
      );
    }

    const payload = this._consentCanonical(escrow, tenantId);
    const verifier = crypto.createVerify("sha256");
    verifier.update(Buffer.from(payload, "utf8"));
    if (!verifier.verify(publicKey, signature, "base64")) {
      throw new HsmAdapterError(
        "INVALID_ESCROW_SIGNATURE",
        `invalid consent signature from tenant ${tenantId}`,
      );
    }

    escrow.consents.set(tenantId, { tenantId, payload, signature });
  }

  /**
   * Finalize an escrow once both parties have consented.
   * @param {string} escrowId
   * @param {object} [options]
   * @param {number} [options.tokenExpiryMs]
   * @returns {DeclassificationProof}
   */
  finalizeEscrow(escrowId, options = {}) {
    const escrow = this._escrows.get(escrowId);
    if (!escrow) {
      throw new HsmAdapterError(
        "UNKNOWN_ESCROW",
        `escrow not found: ${escrowId}`,
      );
    }
    if (escrow.finalized) {
      return escrow.proof;
    }

    const consentCount = escrow.consents.size;
    if (consentCount < 2) {
      throw new HsmAdapterError(
        "ESCROW_CONSENT_MISSING",
        `only ${consentCount} consent signatures, require 2`,
      );
    }

    const consensusTimestamp = this._consensusTime();
    const tokenExpiryMs = options.tokenExpiryMs || 300000;
    const expiry = consensusTimestamp + tokenExpiryMs;

    if (this._policyEngine) {
      this._policyEngine.validate(escrow.destTenantId, "escrow", {
        sourceTenantId: escrow.sourceTenantId,
        destTenantId: escrow.destTenantId,
        consentCount,
        tokenExpiryMs,
        escrowLifetimeMs: consensusTimestamp - escrow.initiatedAt,
        algorithm: "aes-kw",
      });
    }

    const proof = new DeclassificationProof({
      escrowId: escrow.escrowId,
      sourceTenantId: escrow.sourceTenantId,
      destTenantId: escrow.destTenantId,
      keyRef: escrow.keyRef,
      consensusTimestamp,
      expiry,
      consentSignatures: Array.from(escrow.consents.values()),
    });

    const brokerPrivateKey =
      this._brokerKeyPair.privateKey || this._brokerKeyPair.private;
    proof.sign(brokerPrivateKey);
    escrow.finalized = true;
    escrow.proof = proof;
    return proof;
  }

  /**
   * Validate a declassification token at unwrap time.
   * @param {string} keyRef
   * @param {string} tenantId
   * @param {DeclassificationProof|object} [token]
   * @returns {object|null} escrow record, or null when no active escrow exists
   */
  requireToken(keyRef, tenantId, token) {
    const escrowId = this._byKeyRef.get(keyRef);
    if (!escrowId) {
      return null;
    }

    const escrow = this._escrows.get(escrowId);
    if (!escrow || !escrow.finalized) {
      throw new HsmAdapterError(
        "ESCROW_CONSENT_MISSING",
        `escrow for ${keyRef} is not finalized`,
      );
    }

    if (!token) {
      throw new HsmAdapterError(
        "ESCROW_CONSENT_MISSING",
        `declassification token required for escrowed key ${keyRef}`,
      );
    }

    const proof =
      token instanceof DeclassificationProof
        ? token
        : new DeclassificationProof(token);
    if (proof.keyRef !== keyRef || proof.destTenantId !== tenantId) {
      throw new HsmAdapterError(
        "ESCROW_CONSENT_MISSING",
        "declassification token does not match key or destination tenant",
      );
    }

    const currentTime = this._consensusTime();
    const brokerPublicKey =
      this._brokerKeyPair.publicKey || this._brokerKeyPair.public;
    proof.verify(this._publicKeys, brokerPublicKey, currentTime);
    return escrow;
  }
}

module.exports = {
  EscrowBroker,
};
