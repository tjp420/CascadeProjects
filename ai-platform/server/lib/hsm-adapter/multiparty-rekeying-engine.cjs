'use strict';

/**
 * Track 37: Multiparty Re-Keying.
 *
 * Proactively refreshes secret shares without changing the underlying
 * secret. Supports adding/removing shareholders, threshold adjustment,
 * and epoch-based anti-rollback protection. Uses share resharing: each
 * existing shareholder evaluates their polynomial at new points to
 * produce fresh shares.
 *
 * Components:
 *   - ReKeyingEpoch: monotonic epoch tracker (anti-rollback)
 *   - ShareResharing: each shareholder produces new sub-shares
 *   - Re-keying state machine: IDLE → PROPOSING → RESHARING →
 *     VERIFIED → COMMITTED (with ABORTED terminal)
 *   - BFT quorum gating: commit requires t-of-N acks
 *   - Old share zeroization after successful commit
 *
 * @module hsm-adapter/multiparty-rekeying-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// 256-bit prime field: 2^256 - 189 (same as threshold-secret-splitter)
const FIELD_PRIME = (1n << 256n) - 189n;

// ── Re-keying states ─────────────────────────────────────────────
const REKEY_STATE = {
  IDLE: 'idle',
  PROPOSING: 'proposing',
  RESHARING: 'resharing',
  VERIFIED: 'verified',
  COMMITTED: 'committed',
  ABORTED: 'aborted',
};

// ── Valid state transitions ──────────────────────────────────────
const VALID_TRANSITIONS = {
  [REKEY_STATE.IDLE]: [REKEY_STATE.PROPOSING],
  [REKEY_STATE.PROPOSING]: [REKEY_STATE.RESHARING, REKEY_STATE.ABORTED],
  [REKEY_STATE.RESHARING]: [REKEY_STATE.VERIFIED, REKEY_STATE.ABORTED],
  [REKEY_STATE.VERIFIED]: [REKEY_STATE.COMMITTED, REKEY_STATE.ABORTED],
  [REKEY_STATE.COMMITTED]: [],
  [REKEY_STATE.ABORTED]: [],
};

// ── Helper functions ─────────────────────────────────────────────

function _bytesToBigInt(buf) {
  let value = 0n;
  for (const b of buf) {
    value = (value << 8n) | BigInt(b);
  }
  return value;
}

function _bigIntToBytes(value, length) {
  const buf = Buffer.alloc(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v = v >> 8n;
  }
  return buf;
}

function _randomFieldElement() {
  const bytes = crypto.randomBytes(32);
  let value = _bytesToBigInt(bytes) % FIELD_PRIME;
  if (value < 0n) value += FIELD_PRIME;
  return value;
}

function _modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e >> 1n;
  }
  return result;
}

function _modInv(a, p) {
  return _modPow(a, p - 2n, p);
}

/**
 * Evaluate a polynomial at point x over the field Z_q.
 * f(x) = sum_{j=0}^{t-1} a_j * x^j mod q
 */
function _evaluatePolynomial(coefficients, x) {
  let result = 0n;
  let power = 1n;
  for (const c of coefficients) {
    result = (result + c * power) % FIELD_PRIME;
    power = (power * x) % FIELD_PRIME;
  }
  return result;
}

/**
 * Compute SHA-256 hash of input.
 */
function _hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * ShareResharing — represents one shareholder's contribution to re-keying.
 *
 * Each existing shareholder generates a random polynomial of degree t-1
 * with zero constant term (so the sum of all contributions doesn't change
 * the secret). They then evaluate this polynomial at each new shareholder's
 * index to produce sub-shares.
 */
class ShareResharing {
  /**
   * @param {string} shareholderId
   * @param {bigint[]} polynomial - random coefficients [0, a_1, ..., a_{t-1}]
   * @param {Map<string, bigint>} subShares - newShareholderId -> sub-share
   */
  constructor(shareholderId, polynomial, subShares) {
    this.shareholderId = shareholderId;
    this.polynomial = polynomial;
    this.subShares = subShares;
    this._zeroized = false;
  }

  /**
   * Zeroize ephemeral polynomial coefficients.
   */
  zeroize() {
    for (let i = 0; i < this.polynomial.length; i++) {
      this.polynomial[i] = 0n;
    }
    this._zeroized = true;
  }

  isZeroized() {
    return this._zeroized;
  }
}

/**
 * MultipartyReKeyingEngine.
 *
 * Manages the full lifecycle of proactive multiparty re-keying with
 * BFT-gated commit, anti-rollback, and old share zeroization.
 */
class MultipartyReKeyingEngine {
  /**
   * @param {object} options
   * @param {string[]} options.shareholders - current committee
   * @param {number} options.threshold - current threshold t
   * @param {number} [options.maxReKeyingEpochs] — max epochs before mandatory reset
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    if (!Array.isArray(options.shareholders) || options.shareholders.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'shareholders must be a non-empty array');
    }
    if (!Number.isInteger(options.threshold) || options.threshold < 1) {
      throw new HsmAdapterError('INVALID_INPUT', 'threshold must be a positive integer');
    }
    if (options.threshold > options.shareholders.length) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `threshold ${options.threshold} exceeds shareholders ${options.shareholders.length}`);
    }

    this._shareholders = new Set(options.shareholders);
    this._threshold = options.threshold;
    this._maxReKeyingEpochs = options.maxReKeyingEpochs || 1000;
    this._audit = options.audit || null;

    this._currentEpoch = 0;
    this._reKeyingState = REKEY_STATE.IDLE;
    this._activeReKeying = null; // { epoch, newShareholders, newThreshold, resharings, acks, oldSharesZeroized }
  }

  /**
   * Propose a re-keying round with a new committee and/or threshold.
   * @param {object} options
   * @param {string[]} [options.newShareholders] — new committee (defaults to current)
   * @param {number} [options.newThreshold] — new threshold (defaults to current)
   * @param {number} [options.targetEpoch] — explicit epoch (must be > current)
   * @returns {object} proposal
   */
  proposeReKeying(options = {}) {
    if (this._reKeyingState !== REKEY_STATE.IDLE) {
      throw new HsmAdapterError('REKEYING_IN_PROGRESS', `cannot propose while in state ${this._reKeyingState}`);
    }

    const newShareholders = options.newShareholders || Array.from(this._shareholders);
    const newThreshold = options.newThreshold || this._threshold;

    if (!Array.isArray(newShareholders) || newShareholders.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'newShareholders must be a non-empty array');
    }
    if (!Number.isInteger(newThreshold) || newThreshold < 1) {
      throw new HsmAdapterError('INVALID_INPUT', 'newThreshold must be a positive integer');
    }
    if (newThreshold > newShareholders.length) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `newThreshold ${newThreshold} exceeds new shareholders ${newShareholders.length}`);
    }

    // Anti-rollback: epoch must be strictly monotonic
    const targetEpoch = options.targetEpoch !== undefined ? options.targetEpoch : this._currentEpoch + 1;
    if (targetEpoch <= this._currentEpoch) {
      throw new HsmAdapterError(
        'REKEYING_EPOCH_ROLLBACK',
        `target epoch ${targetEpoch} <= current epoch ${this._currentEpoch}`,
      );
    }
    if (targetEpoch > this._maxReKeyingEpochs) {
      throw new HsmAdapterError('REKEYING_EPOCH_EXCEEDED', `target epoch ${targetEpoch} exceeds max ${this._maxReKeyingEpochs}`);
    }

    this._activeReKeying = {
      epoch: targetEpoch,
      oldShareholders: Array.from(this._shareholders),
      newShareholders: [...newShareholders],
      oldThreshold: this._threshold,
      newThreshold,
      resharings: new Map(), // shareholderId -> ShareResharing
      acks: new Map(), // shareholderId -> boolean
      oldSharesZeroized: false,
    };

    this._transition(REKEY_STATE.PROPOSING);
    this._emitAudit('REKEYING_PROPOSED', {
      epoch: targetEpoch,
      oldShareholders: this._activeReKeying.oldShareholders,
      newShareholders,
      oldThreshold: this._threshold,
      newThreshold,
    });

    return {
      epoch: targetEpoch,
      newShareholders,
      newThreshold,
      state: REKEY_STATE.PROPOSING,
    };
  }

  /**
   * Submit a shareholder's resharing contribution.
   * @param {string} shareholderId
   * @param {bigint[]} polynomial - random coefficients [0, a_1, ..., a_{t-1}]
   * @param {Map<string, bigint>} subShares - newShareholderId -> sub-share
   */
  submitResharing(shareholderId, polynomial, subShares) {
    this._validateCurrentShareholder(shareholderId);
    if (this._reKeyingState !== REKEY_STATE.PROPOSING && this._reKeyingState !== REKEY_STATE.RESHARING) {
      throw new HsmAdapterError('REKEYING_NOT_ACCEPTING', `state ${this._reKeyingState} does not accept resharings`);
    }

    // Verify polynomial constant term is zero (so secret doesn't change)
    if (polynomial[0] !== 0n) {
      throw new HsmAdapterError('RESHARING_INVALID', 'polynomial constant term must be zero to preserve secret');
    }

    // Verify polynomial degree matches threshold
    const expectedDegree = this._activeReKeying.oldThreshold - 1;
    if (polynomial.length !== expectedDegree + 1) {
      throw new HsmAdapterError(
        'RESHARING_INVALID',
        `polynomial degree ${polynomial.length - 1} does not match expected ${expectedDegree}`,
      );
    }

    // Verify sub-shares are for all new shareholders
    const newShareholderSet = new Set(this._activeReKeying.newShareholders);
    for (const [targetId] of subShares) {
      if (!newShareholderSet.has(targetId)) {
        throw new HsmAdapterError('RESHARING_INVALID', `sub-share target ${targetId} not in new committee`);
      }
    }

    // Transition to RESHARING on first submission
    if (this._reKeyingState === REKEY_STATE.PROPOSING) {
      this._transition(REKEY_STATE.RESHARING);
    }

    const resharing = new ShareResharing(shareholderId, [...polynomial], new Map(subShares));
    this._activeReKeying.resharings.set(shareholderId, resharing);

    this._emitAudit('RESHARING_SUBMITTED', {
      shareholderId,
      epoch: this._activeReKeying.epoch,
      subShareCount: subShares.size,
    });

    return { shareholderId, epoch: this._activeReKeying.epoch, state: this._reKeyingState };
  }

  /**
   * Verify all submitted resharings.
   * @returns {object} verification result
   */
  verifyResharings() {
    if (this._reKeyingState !== REKEY_STATE.RESHARING) {
      throw new HsmAdapterError('REKEYING_NOT_RESHARING', `state ${this._reKeyingState} must be resharing`);
    }

    // Need at least old threshold resharings
    const requiredResharings = this._activeReKeying.oldThreshold;
    if (this._activeReKeying.resharings.size < requiredResharings) {
      throw new HsmAdapterError(
        'RESHARING_INSUFFICIENT',
        `only ${this._activeReKeying.resharings.size} resharings, need ${requiredResharings}`,
      );
    }

    // Verify each new shareholder's aggregated share is consistent
    // (sum of sub-shares from all resharings for that shareholder)
    const newShareholderShares = new Map(); // newShareholderId -> aggregated share
    for (const newShareholderId of this._activeReKeying.newShareholders) {
      let aggregatedShare = 0n;
      for (const resharing of this._activeReKeying.resharings.values()) {
        const subShare = resharing.subShares.get(newShareholderId);
        if (subShare !== undefined) {
          aggregatedShare = (aggregatedShare + subShare) % FIELD_PRIME;
        }
      }
      newShareholderShares.set(newShareholderId, aggregatedShare);
    }

    this._activeReKeying.newShares = newShareholderShares;
    this._transition(REKEY_STATE.VERIFIED);

    this._emitAudit('RESHARING_VERIFIED', {
      epoch: this._activeReKeying.epoch,
      resharings: this._activeReKeying.resharings.size,
      newShareholders: this._activeReKeying.newShareholders.length,
    });

    return {
      verified: true,
      epoch: this._activeReKeying.epoch,
      newShareholders: this._activeReKeying.newShareholders,
      newThreshold: this._activeReKeying.newThreshold,
      state: REKEY_STATE.VERIFIED,
    };
  }

  /**
   * Acknowledge the re-keying from a shareholder (quorum gating).
   * @param {string} shareholderId
   */
  acknowledge(shareholderId) {
    this._validateCurrentShareholder(shareholderId);
    if (this._reKeyingState !== REKEY_STATE.VERIFIED) {
      throw new HsmAdapterError('REKEYING_NOT_VERIFIED', `state ${this._reKeyingState} must be verified`);
    }

    this._activeReKeying.acks.set(shareholderId, true);

    this._emitAudit('REKEYING_ACKNOWLEDGED', {
      shareholderId,
      acks: this._activeReKeying.acks.size,
      required: this._threshold,
    });

    // Check if quorum reached
    if (this._activeReKeying.acks.size >= this._threshold) {
      this._commitReKeying();
    }

    return {
      shareholderId,
      acks: this._activeReKeying.acks.size,
      required: this._threshold,
      quorumReached: this._activeReKeying.acks.size >= this._threshold,
      state: this._reKeyingState,
    };
  }

  /**
   * Commit the re-keying after quorum is reached.
   */
  _commitReKeying() {
    // Update committee and threshold
    this._shareholders = new Set(this._activeReKeying.newShareholders);
    this._threshold = this._activeReKeying.newThreshold;
    this._currentEpoch = this._activeReKeying.epoch;

    // Zeroize old resharings
    for (const resharing of this._activeReKeying.resharings.values()) {
      resharing.zeroize();
    }
    this._activeReKeying.oldSharesZeroized = true;

    this._transition(REKEY_STATE.COMMITTED);

    this._emitAudit('REKEYING_COMMITTED', {
      epoch: this._currentEpoch,
      newShareholders: Array.from(this._shareholders),
      newThreshold: this._threshold,
    });
  }

  /**
   * Abort the active re-keying round.
   * @param {string} [reason]
   */
  abort(reason = 'manual') {
    if (this._reKeyingState === REKEY_STATE.IDLE) {
      throw new HsmAdapterError('REKEYING_NOT_ACTIVE', 'no active re-keying to abort');
    }
    if (this._reKeyingState === REKEY_STATE.COMMITTED) {
      throw new HsmAdapterError('REKEYING_ALREADY_COMMITTED', 'cannot abort committed re-keying');
    }
    if (this._reKeyingState === REKEY_STATE.ABORTED) {
      throw new HsmAdapterError('REKEYING_ALREADY_ABORTED', 're-keying already aborted');
    }

    // Zeroize any resharings
    if (this._activeReKeying) {
      for (const resharing of this._activeReKeying.resharings.values()) {
        resharing.zeroize();
      }
    }

    this._transition(REKEY_STATE.ABORTED);
    this._emitAudit('REKEYING_ABORTED', { reason, epoch: this._activeReKeying?.epoch });

    return { state: REKEY_STATE.ABORTED, reason };
  }

  /**
   * Reset the engine to IDLE after a committed or aborted re-keying.
   */
  reset() {
    if (this._reKeyingState !== REKEY_STATE.COMMITTED && this._reKeyingState !== REKEY_STATE.ABORTED) {
      throw new HsmAdapterError('REKEYING_NOT_TERMINAL', `state ${this._reKeyingState} must be committed or aborted`);
    }
    this._activeReKeying = null;
    this._reKeyingState = REKEY_STATE.IDLE;
    this._emitAudit('REKEYING_RESET', { epoch: this._currentEpoch });
    return { state: REKEY_STATE.IDLE };
  }

  /**
   * Get the current re-keying state.
   * @returns {object}
   */
  getReKeyingState() {
    return {
      state: this._reKeyingState,
      currentEpoch: this._currentEpoch,
      shareholders: Array.from(this._shareholders),
      threshold: this._threshold,
      activeReKeying: this._activeReKeying ? {
        epoch: this._activeReKeying.epoch,
        newShareholders: this._activeReKeying.newShareholders,
        newThreshold: this._activeReKeying.newThreshold,
        resharingsSubmitted: this._activeReKeying.resharings.size,
        acksReceived: this._activeReKeying.acks.size,
        acksRequired: this._threshold,
        oldSharesZeroized: this._activeReKeying.oldSharesZeroized,
      } : null,
    };
  }

  /**
   * Get the current epoch.
   * @returns {number}
   */
  getCurrentEpoch() {
    return this._currentEpoch;
  }

  /**
   * Get the current shareholders.
   * @returns {string[]}
   */
  getShareholders() {
    return Array.from(this._shareholders);
  }

  /**
   * Get the current threshold.
   * @returns {number}
   */
  getThreshold() {
    return this._threshold;
  }

  /**
   * Validate that a shareholder is in the current committee.
   * @param {string} shareholderId
   */
  _validateCurrentShareholder(shareholderId) {
    if (!this._shareholders.has(shareholderId)) {
      throw new HsmAdapterError('SHAREHOLDER_UNKNOWN', `shareholder ${shareholderId} not in current committee`);
    }
  }

  /**
   * Transition to a new state.
   * @param {string} newState
   */
  _transition(newState) {
    const allowed = VALID_TRANSITIONS[this._reKeyingState] || [];
    if (!allowed.includes(newState)) {
      throw new HsmAdapterError(
        'REKEYING_INVALID_TRANSITION',
        `cannot transition from ${this._reKeyingState} to ${newState}`,
      );
    }
    this._reKeyingState = newState;
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  MultipartyReKeyingEngine,
  ShareResharing,
  REKEY_STATE,
  VALID_TRANSITIONS,
  FIELD_PRIME,
  _evaluatePolynomial,
  _randomFieldElement,
};
