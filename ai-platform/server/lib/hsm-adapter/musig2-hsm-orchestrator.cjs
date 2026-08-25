'use strict';

/**
 * Musig2HsmOrchestrator — HSM Adapter Orchestration for MuSig2 Signatures
 *
 * Bridges the software-only MuSig2/FROST math engine (server/lib/mpc/schnorr/)
 * with the HSM adapter layer (server/lib/hsm-adapter/) via a stateful
 * orchestrator that wraps key share storage, nonce generation, and signing
 * sessions behind the HSM KEK lifecycle.
 *
 * Follows the DistributedConsensusCoordinator orchestration pattern:
 *   - Async/await state machine with explicit states
 *   - HsmAdapterError for typed errors
 *   - hsmMetrics.incrementCounter() for telemetry
 *   - Module-level registry via base-adapter.cjs
 *
 * READ-ONLY: The schnorr math engine files are never modified.
 * This orchestrator composes them with HSM operations.
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');
const { SchnorrThresholdAggregator } = require('../mpc/schnorr/protocol.cjs');
const { SchnorrShareEvaluator } = require('../mpc/schnorr/signature_share.cjs');
const { Musig2NonceGenerator } = require('../mpc/schnorr/nonce.cjs');

// ── Session states (deterministic state machine) ──────────────────────
const SESSION_STATE = {
  CREATED: 'created',
  NONCES_GENERATED: 'nonces_generated',
  KEYS_AGGREGATED: 'keys_aggregated',
  BINDING_COMPUTED: 'binding_computed',
  SHARES_EVALUATED: 'shares_evaluated',
  SIGNATURE_ASSEMBLED: 'signature_assembled',
  VERIFIED: 'verified',
  FAILED: 'failed',
  DESTROYED: 'destroyed',
};

// ── Orchestrator events for audit callback ────────────────────────────
const ORCHESTRATOR_EVENT = {
  SESSION_CREATED: 'MUSIG2_SESSION_CREATED',
  SESSION_DESTROYED: 'MUSIG2_SESSION_DESTROYED',
  NONCES_GENERATED: 'MUSIG2_NONCES_GENERATED',
  KEYS_AGGREGATED: 'MUSIG2_KEYS_AGGREGATED',
  BINDING_COMPUTED: 'MUSIG2_BINDING_COMPUTED',
  SHARES_EVALUATED: 'MUSIG2_SHARES_EVALUATED',
  SIGNATURE_ASSEMBLED: 'MUSIG2_SIGNATURE_ASSEMBLED',
  SIGNATURE_VERIFIED: 'MUSIG2_SIGNATURE_VERIFIED',
  SIGNATURE_VERIFICATION_FAILED: 'MUSIG2_SIGNATURE_VERIFICATION_FAILED',
  SESSION_FAILED: 'MUSIG2_SESSION_FAILED',
  SESSION_TIMEOUT: 'MUSIG2_SESSION_TIMEOUT',
  KEY_SHARE_WRAPPED: 'MUSIG2_KEY_SHARE_WRAPPED',
  KEY_SHARE_UNWRAPPED: 'MUSIG2_KEY_SHARE_UNWRAPPED',
  NONCE_SEALED: 'MUSIG2_NONCE_SEALED',
  NONCE_UNSEALED: 'MUSIG2_NONCE_UNSEALED',
};

// Default prime field modulus (secp256k1 order)
const DEFAULT_MODULUS = '115792089237316195423570985008687907852837564279074904382605163141518161494337';

/**
 * Musig2HsmOrchestrator
 *
 * Manages MuSig2 signing sessions, wrapping key shares and nonces behind
 * the HSM adapter boundary. The schnorr math engine is composed — never
 * modified — ensuring zero drift on the cryptographic core.
 */
class Musig2HsmOrchestrator {
  /**
   * @param {object} options
   * @param {object} options.hsmAdapter - BaseHsmAdapter instance for KEK wrap/unwrap
   * @param {string|bigint} [options.modulus] - Prime field modulus (default: secp256k1 order)
   * @param {number} [options.maxSessions=128] - Maximum concurrent sessions
   * @param {number} [options.sessionTimeoutMs=60000] - Idle session timeout
   * @param {Function} [options.audit] - Audit callback (event, info) => void
   */
  constructor(options = {}) {
    if (!options.hsmAdapter) {
      throw new HsmAdapterError('INVALID_INPUT', 'hsmAdapter is required');
    }

    this._hsmAdapter = options.hsmAdapter;
    this._modulus = options.modulus || DEFAULT_MODULUS;
    this._maxSessions = options.maxSessions || 128;
    this._sessionTimeoutMs = options.sessionTimeoutMs || 60000;
    this._audit = options.audit || null;

    // Initialize math engine instances (composition — not modification)
    this._aggregator = new SchnorrThresholdAggregator(this._modulus);
    this._evaluator = new SchnorrShareEvaluator(this._modulus);
    this._nonceGen = new Musig2NonceGenerator(this._modulus);

    // Session registry: sessionId -> session object
    this._sessions = new Map();

    // KEK ID for wrapping key shares (created lazily per tenant)
    this._kekIds = new Map(); // tenantId -> kekId
  }

  // ── Session lifecycle ────────────────────────────────────────────────

  /**
   * Create a new MuSig2 signing session.
   * @param {object} params
   * @param {string} params.tenantId - Tenant identifier for HSM scoping
   * @param {Array<number>} params.participantIds - Participant identifiers
   * @param {Array<number>} [params.quorum] - Quorum IDs (defaults to participantIds)
   * @param {string} params.messageHash - Message hash to sign
   * @param {Array<bigint>} [params.keyShares] - Pre-generated key shares (optional)
   * @returns {Promise<string>} Session ID
   */
  async createSession({ tenantId, participantIds, quorum, messageHash, keyShares }) {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new HsmAdapterError('INVALID_INPUT', 'tenantId is required and must be a string');
    }
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'participantIds must be a non-empty array');
    }
    if (!messageHash) {
      throw new HsmAdapterError('INVALID_INPUT', 'messageHash is required');
    }

    const q = quorum || participantIds;
    if (q.length !== participantIds.length) {
      throw new HsmAdapterError('INVALID_INPUT', 'quorum length must match participantIds length');
    }
    if (q.length < 2) {
      throw new HsmAdapterError('INVALID_INPUT', 'at least 2 participants required');
    }

    if (this._sessions.size >= this._maxSessions) {
      throw new HsmAdapterError('MAX_SESSIONS_EXCEEDED', `maximum ${this._maxSessions} sessions reached`);
    }

    const sessionId = 'musig2-' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    // Generate or accept key shares, then wrap them via HSM
    const shares = keyShares || participantIds.map(() => {
      return BigInt('0x' + crypto.randomBytes(32).toString('hex')) % BigInt(this._modulus);
    });

    // Wrap each key share via HSM adapter
    const wrappedShares = [];
    for (let i = 0; i < shares.length; i++) {
      const wrapped = await this.wrapKeyShare(tenantId, shares[i]);
      wrappedShares.push(wrapped);
    }

    // Compute public keys from shares (for aggregation later)
    // In a real EC-based system, P_i = x_i * G. Here we use the share itself
    // as the "public key" since the math engine uses field arithmetic only.
    const publicKeys = shares.map(s => BigInt(s));

    const session = {
      sessionId,
      tenantId,
      participantIds: [...participantIds],
      quorum: [...q],
      messageHash,
      state: SESSION_STATE.CREATED,
      createdAt: now,
      lastActivity: now,
      // HSM-protected material
      wrappedShares,
      publicKeys,
      // Populated during signing flow
      nonces: null,           // Array of { secret: {k1,k2}, publicCommitment: {h1,h2,sessionId} }
      sealedNonces: null,     // Array of HSM-sealed nonce blobs
      aggPublicKey: null,
      bindingFactor: null,
      aggNonce: null,
      challenge: null,
      partialShares: null,
      signature: null,
      verificationResult: null,
    };

    this._sessions.set(sessionId, session);
    hsmMetrics.incrementCounter('hsm_musig2_orch_session_created_total');
    this._emit(ORCHESTRATOR_EVENT.SESSION_CREATED, { sessionId, tenantId, participants: participantIds.length });

    return sessionId;
  }

  /**
   * Get session status.
   * @param {string} sessionId
   * @returns {{ state: string, participants: number, phase: string, createdAt: number }}
   */
  getSessionStatus(sessionId) {
    const session = this._getSession(sessionId);
    return {
      state: session.state,
      participants: session.participantIds.length,
      phase: session.state,
      createdAt: session.createdAt,
      tenantId: session.tenantId,
    };
  }

  /**
   * Destroy a session and clear all sensitive material.
   * @param {string} sessionId
   */
  async destroySession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError('SESSION_NOT_FOUND', `session ${sessionId} not found`);
    }

    // Zeroize any in-memory nonce material
    if (session.nonces) {
      for (const nonce of session.nonces) {
        if (nonce && nonce.secret) {
          this._evaluator.zeroizeSecretNonces(nonce.secret);
        }
      }
    }

    // Clear all session data
    session.wrappedShares = null;
    session.nonces = null;
    session.sealedNonces = null;
    session.partialShares = null;
    session.signature = null;
    session.state = SESSION_STATE.DESTROYED;

    this._sessions.delete(sessionId);
    this._emit(ORCHESTRATOR_EVENT.SESSION_DESTROYED, { sessionId });
  }

  // ── Signing flow (wraps math engine with HSM operations) ─────────────

  /**
   * Generate nonces for all participants in the session.
   * Nonces are generated via the math engine, then sealed via HSM.
   * @param {string} sessionId
   * @returns {Promise<Array<{h1: string, h2: string, sessionId: string}>>} Public commitments
   */
  async generateNonces(sessionId) {
    const session = this._getSession(sessionId);
    this._requireState(session, SESSION_STATE.CREATED, 'generateNonces');

    const nonces = [];
    const sealedNonces = [];
    const publicCommitments = [];

    for (let i = 0; i < session.participantIds.length; i++) {
      const nonceResult = this._nonceGen.generateNoncePair(sessionId + '-p' + i);
      nonces.push(nonceResult);
      publicCommitments.push(nonceResult.publicCommitment);

      // Seal nonce via HSM adapter
      const sealed = await this.sealNonce(session.tenantId, nonceResult.secret);
      sealedNonces.push(sealed);
    }

    session.nonces = nonces;
    session.sealedNonces = sealedNonces;
    session.state = SESSION_STATE.NONCES_GENERATED;
    session.lastActivity = Date.now();

    this._emit(ORCHESTRATOR_EVENT.NONCES_GENERATED, { sessionId, count: nonces.length });
    return publicCommitments;
  }

  /**
   * Aggregate public keys using Lagrange-weighted sum.
   * @param {string} sessionId
   * @returns {Promise<bigint>} Aggregated public key
   */
  async aggregateKeys(sessionId) {
    const session = this._getSession(sessionId);
    this._requireState(session, SESSION_STATE.NONCES_GENERATED, 'aggregateKeys');

    const aggPublicKey = this._aggregator.aggregatePublicKeys(session.publicKeys, session.quorum);
    session.aggPublicKey = aggPublicKey;
    session.state = SESSION_STATE.KEYS_AGGREGATED;
    session.lastActivity = Date.now();

    hsmMetrics.incrementCounter('hsm_musig2_key_aggregation_total');
    this._emit(ORCHESTRATOR_EVENT.KEYS_AGGREGATED, { sessionId, aggPublicKey: 'redacted' });
    return aggPublicKey;
  }

  /**
   * Compute the MuSig2 binding factor.
   * @param {string} sessionId
   * @returns {Promise<bigint>} Binding factor
   */
  async computeBindingFactor(sessionId) {
    const session = this._getSession(sessionId);
    this._requireState(session, SESSION_STATE.KEYS_AGGREGATED, 'computeBindingFactor');

    const nonceCommitments = session.nonces.map(n => n.publicCommitment);
    const bindingFactor = this._aggregator.computeBindingFactor(session.aggPublicKey, nonceCommitments);
    session.bindingFactor = bindingFactor;
    session.state = SESSION_STATE.BINDING_COMPUTED;
    session.lastActivity = Date.now();

    hsmMetrics.incrementCounter('hsm_musig2_binding_factor_computed_total');
    this._emit(ORCHESTRATOR_EVENT.BINDING_COMPUTED, { sessionId });
    return bindingFactor;
  }

  /**
   * Evaluate partial shares for all participants.
   * Secret nonces are zeroized immediately after share evaluation.
   * @param {string} sessionId
   * @returns {Promise<Array<bigint>>} Partial signature shares
   */
  async evaluateShares(sessionId) {
    const session = this._getSession(sessionId);
    this._requireState(session, SESSION_STATE.BINDING_COMPUTED, 'evaluateShares');

    // Unwrap key shares via HSM
    const keyShares = [];
    for (let i = 0; i < session.wrappedShares.length; i++) {
      const share = await this.unwrapKeyShare(session.tenantId, session.wrappedShares[i]);
      keyShares.push(share);
    }

    // Compute challenge
    const publicNonces = session.nonces.map(n => BigInt('0x' + n.publicCommitment.h1));
    const aggNonce = this._aggregator.aggregateNonces(publicNonces, session.bindingFactor);
    session.aggNonce = aggNonce;

    const challenge = this._aggregator.computeChallenge(session.aggPublicKey, aggNonce, session.messageHash);
    session.challenge = challenge;
    hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total');
    hsmMetrics.incrementCounter('hsm_musig2_nonce_aggregation_total');

    // Evaluate partial shares
    const partialShares = [];
    for (let i = 0; i < session.participantIds.length; i++) {
      const lagrangeWeight = this._aggregator.computeLagrangeWeight(session.quorum[i], session.quorum);
      const share = this._evaluator.evaluatePartialShare({
        challenge,
        secretKeyShare: keyShares[i],
        lagrangeWeight,
        secretNonces: session.nonces[i].secret,
        bindingFactor: session.bindingFactor,
      });
      partialShares.push(share);

      // S-03: Zeroize secret nonces immediately after share evaluation
      this._evaluator.zeroizeSecretNonces(session.nonces[i].secret);
    }

    session.partialShares = partialShares;
    session.state = SESSION_STATE.SHARES_EVALUATED;
    session.lastActivity = Date.now();

    this._emit(ORCHESTRATOR_EVENT.SHARES_EVALUATED, { sessionId, count: partialShares.length });
    return partialShares;
  }

  /**
   * Assemble the final signature from partial shares.
   * @param {string} sessionId
   * @returns {Promise<{R: bigint, s: bigint}>} Final signature
   */
  async assembleSignature(sessionId) {
    const session = this._getSession(sessionId);
    this._requireState(session, SESSION_STATE.SHARES_EVALUATED, 'assembleSignature');

    const signature = this._aggregator.assembleSignature(session.aggNonce, session.partialShares);
    session.signature = signature;
    session.state = SESSION_STATE.SIGNATURE_ASSEMBLED;
    session.lastActivity = Date.now();

    hsmMetrics.incrementCounter('hsm_musig2_signature_assembled_total');
    this._emit(ORCHESTRATOR_EVENT.SIGNATURE_ASSEMBLED, { sessionId });
    return signature;
  }

  /**
   * Verify the assembled signature.
   * @param {string} sessionId
   * @param {{R: bigint, s: bigint}} [signature] - Optional signature override
   * @returns {Promise<{valid: boolean}>} Verification result
   */
  async verifySignature(sessionId, signature) {
    const session = this._getSession(sessionId);
    this._requireState(session, SESSION_STATE.SIGNATURE_ASSEMBLED, 'verifySignature');

    const sig = signature || session.signature;

    // For field-based verification, we need the aggregate private key and nonce.
    // Unwrap key shares to compute aggregate private key.
    const keyShares = [];
    for (let i = 0; i < session.wrappedShares.length; i++) {
      const share = await this.unwrapKeyShare(session.tenantId, session.wrappedShares[i]);
      keyShares.push(share);
    }

    // Compute aggregate private key: x_agg = sum(x_i * lambda_i) mod q
    let aggPrivateKey = 0n;
    for (let i = 0; i < keyShares.length; i++) {
      const lambda = this._aggregator.computeLagrangeWeight(session.quorum[i], session.quorum);
      aggPrivateKey = this._aggregator.field.add(
        aggPrivateKey,
        this._aggregator.field.mul(keyShares[i], lambda)
      );
    }

    // Compute aggregate secret nonce: k_agg = sum(k1_i + b * k2_i) mod q
    // Note: nonces were zeroized after evaluateShares, so we need to unseal them
    const unsealedNonces = [];
    for (let i = 0; i < session.sealedNonces.length; i++) {
      const nonce = await this.unsealNonce(session.tenantId, session.sealedNonces[i]);
      unsealedNonces.push(nonce);
    }

    let aggSecretNonce = 0n;
    for (let i = 0; i < unsealedNonces.length; i++) {
      const k1 = BigInt(unsealedNonces[i].k1);
      const k2 = BigInt(unsealedNonces[i].k2);
      const blended = this._aggregator.field.add(k1, this._aggregator.field.mul(session.bindingFactor, k2));
      aggSecretNonce = this._aggregator.field.add(aggSecretNonce, blended);
    }

    // Re-zeroize the unsealed nonces
    for (const nonce of unsealedNonces) {
      nonce.k1 = 0n;
      nonce.k2 = 0n;
    }

    let valid = false;
    try {
      valid = this._aggregator.verifySignature(
        session.aggPublicKey,
        session.aggNonce,
        sig,
        session.messageHash,
        { aggPrivateKey, aggSecretNonce }
      );
    } catch (e) {
      valid = false;
    }

    session.verificationResult = valid;
    session.state = valid ? SESSION_STATE.VERIFIED : SESSION_STATE.FAILED;

    if (valid) {
      hsmMetrics.incrementCounter('hsm_musig2_signature_verified_total');
      this._emit(ORCHESTRATOR_EVENT.SIGNATURE_VERIFIED, { sessionId });
    } else {
      hsmMetrics.incrementCounter('hsm_musig2_signature_verification_failed_total');
      this._emit(ORCHESTRATOR_EVENT.SIGNATURE_VERIFICATION_FAILED, { sessionId });
    }

    return { valid };
  }

  // ── HSM-protected key share management ───────────────────────────────

  /**
   * Wrap a key share via the HSM adapter.
   * @param {string} tenantId
   * @param {bigint} keyShare
   * @returns {Promise<Buffer>} Wrapped key share blob
   */
  async wrapKeyShare(tenantId, keyShare) {
    if (!this._hsmAdapter) {
      throw new HsmAdapterError('NO_HSM_ADAPTER', 'HSM adapter is not configured');
    }

    const kekId = await this._getOrCreateKek(tenantId);
    // Encode BigInt as hex with even-length padding for unambiguous decoding
    const hex = keyShare.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    const plaintext = Buffer.from(paddedHex, 'hex');
    const wrapped = await this._hsmAdapter.wrap(tenantId, kekId, plaintext);

    hsmMetrics.incrementCounter('hsm_musig2_orch_key_share_wrapped_total');
    this._emit(ORCHESTRATOR_EVENT.KEY_SHARE_WRAPPED, { tenantId, kekId });

    return wrapped;
  }

  /**
   * Unwrap a key share via the HSM adapter.
   * @param {string} tenantId
   * @param {Buffer} wrappedBlob
   * @returns {Promise<bigint>} Key share
   */
  async unwrapKeyShare(tenantId, wrappedBlob) {
    if (!this._hsmAdapter) {
      throw new HsmAdapterError('NO_HSM_ADAPTER', 'HSM adapter is not configured');
    }

    const kekId = this._kekIds.get(tenantId);
    if (!kekId) {
      throw new HsmAdapterError('UNWRAP_FAILED', 'no KEK found for tenant');
    }

    let plaintext;
    try {
      plaintext = await this._hsmAdapter.unwrap(tenantId, kekId, wrappedBlob);
    } catch (e) {
      throw new HsmAdapterError('UNWRAP_FAILED', `HSM unwrap failed: ${e.message}`);
    }

    const hex = plaintext.toString('hex') || '0';
    const keyShare = BigInt('0x' + hex);
    this._emit(ORCHESTRATOR_EVENT.KEY_SHARE_UNWRAPPED, { tenantId });
    return keyShare;
  }

  /**
   * Seal a nonce via the HSM adapter.
   * @param {string} tenantId
   * @param {{k1: bigint, k2: bigint}} nonce
   * @returns {Promise<Buffer>} Sealed nonce blob
   */
  async sealNonce(tenantId, nonce) {
    if (!this._hsmAdapter) {
      throw new HsmAdapterError('NO_HSM_ADAPTER', 'HSM adapter is not configured');
    }

    const kekId = await this._getOrCreateKek(tenantId);
    const plaintext = Buffer.from(JSON.stringify({
      k1: nonce.k1.toString(),
      k2: nonce.k2.toString(),
    }));
    const sealed = await this._hsmAdapter.wrap(tenantId, kekId, plaintext);

    this._emit(ORCHESTRATOR_EVENT.NONCE_SEALED, { tenantId });
    return sealed;
  }

  /**
   * Unseal a nonce via the HSM adapter.
   * @param {string} tenantId
   * @param {Buffer} sealedNonce
   * @returns {Promise<{k1: bigint, k2: bigint}>} Nonce
   */
  async unsealNonce(tenantId, sealedNonce) {
    if (!this._hsmAdapter) {
      throw new HsmAdapterError('NO_HSM_ADAPTER', 'HSM adapter is not configured');
    }

    const kekId = this._kekIds.get(tenantId);
    if (!kekId) {
      throw new HsmAdapterError('UNWRAP_FAILED', 'no KEK found for tenant');
    }

    let plaintext;
    try {
      plaintext = await this._hsmAdapter.unwrap(tenantId, kekId, sealedNonce);
    } catch (e) {
      throw new HsmAdapterError('UNWRAP_FAILED', `HSM unseal failed: ${e.message}`);
    }

    const parsed = JSON.parse(plaintext.toString());
    return { k1: BigInt(parsed.k1), k2: BigInt(parsed.k2) };
  }

  // ── Internal helpers ─────────────────────────────────────────────────

  /**
   * Get a session by ID, checking for timeout.
   * @private
   */
  _getSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError('SESSION_NOT_FOUND', `session ${sessionId} not found`);
    }

    // Check for session timeout (idle sessions auto-destroyed)
    const idleMs = Date.now() - session.lastActivity;
    if (idleMs > this._sessionTimeoutMs && session.state !== SESSION_STATE.DESTROYED) {
      session.state = SESSION_STATE.FAILED;
      this._sessions.delete(sessionId);
      this._emit(ORCHESTRATOR_EVENT.SESSION_TIMEOUT, { sessionId, idleMs });
      throw new HsmAdapterError('SESSION_TIMEOUT', `session ${sessionId} timed out after ${idleMs}ms idle`);
    }

    return session;
  }

  /**
   * Require a specific session state, throwing if not matched.
   * @private
   */
  _requireState(session, requiredState, operation) {
    if (session.state !== requiredState) {
      throw new HsmAdapterError(
        'INVALID_STATE',
        `${operation} requires state ${requiredState}, current state is ${session.state}`
      );
    }
  }

  /**
   * Get or create a KEK for the tenant.
   * @private
   */
  async _getOrCreateKek(tenantId) {
    let kekId = this._kekIds.get(tenantId);
    if (!kekId) {
      kekId = 'musig2-kek-' + crypto.randomBytes(8).toString('hex');
      await this._hsmAdapter.createKEK(tenantId, { label: kekId });
      this._kekIds.set(tenantId, kekId);
    }
    return kekId;
  }

  /**
   * Emit an audit event (without sensitive payload values).
   * @private
   */
  _emit(event, info) {
    if (this._audit) {
      try {
        this._audit(event, info);
      } catch (e) {
        console.error('musig2-hsm-orchestrator.cjs error:', e);
        // Audit callback failures must not disrupt the orchestrator
      }
    }
  }

  /**
   * Get the current number of active sessions.
   * @returns {number}
   */
  getActiveSessionCount() {
    return this._sessions.size;
  }

  /**
   * Get the orchestrator state for telemetry.
   * @returns {object}
   */
  getState() {
    return {
      maxSessions: this._maxSessions,
      activeSessions: this._sessions.size,
      sessionTimeoutMs: this._sessionTimeoutMs,
      hasHsmAdapter: !!this._hsmAdapter,
      tenantKeks: this._kekIds.size,
    };
  }
}

module.exports = {
  Musig2HsmOrchestrator,
  SESSION_STATE,
  ORCHESTRATOR_EVENT,
};
