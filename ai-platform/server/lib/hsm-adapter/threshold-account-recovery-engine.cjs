'use strict';

/**
 * Track 39: Threshold Account Recovery.
 *
 * Provides multi-signature social recovery for accounts. Account owners
 * designate N guardians who hold recovery shares; recovery requires
 * t-of-N guardian approvals to restore access. Includes time-locked
 * recovery, guardian management, and anti-replay protection.
 *
 * Components:
 *   - GuardianRegistry: per-account guardian management
 *   - RecoveryRequest: unique request with nonce, timestamp, time-lock
 *   - Recovery state machine: IDLE → REQUESTED → APPROVING →
 *     RECOVERING → RESTORED (with REJECTED terminal)
 *   - BFT quorum gating: t-of-N guardian approvals
 *   - Time-lock: configurable delay before execution
 *   - Anti-replay: unique request IDs with nonce tracking
 *
 * @module hsm-adapter/threshold-account-recovery-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// ── Recovery states ──────────────────────────────────────────────
const RECOVERY_STATE = {
  IDLE: 'idle',
  REQUESTED: 'requested',
  APPROVING: 'approving',
  RECOVERING: 'recovering',
  RESTORED: 'restored',
  REJECTED: 'rejected',
};

// ── Valid state transitions ──────────────────────────────────────
const VALID_TRANSITIONS = {
  [RECOVERY_STATE.IDLE]: [RECOVERY_STATE.REQUESTED],
  [RECOVERY_STATE.REQUESTED]: [RECOVERY_STATE.APPROVING, RECOVERY_STATE.REJECTED],
  [RECOVERY_STATE.APPROVING]: [RECOVERY_STATE.RECOVERING, RECOVERY_STATE.REJECTED],
  [RECOVERY_STATE.RECOVERING]: [RECOVERY_STATE.RESTORED, RECOVERY_STATE.REJECTED],
  [RECOVERY_STATE.RESTORED]: [],
  [RECOVERY_STATE.REJECTED]: [],
};

/**
 * GuardianRegistry — manages designated guardians per account.
 */
class GuardianRegistry {
  constructor() {
    this._accounts = new Map(); // accountId -> { guardians: Set, threshold, recoveryShares: Map }
  }

  /**
   * Register an account with guardians and threshold.
   * @param {string} accountId
   * @param {string[]} guardians
   * @param {number} threshold
   */
  registerAccount(accountId, guardians, threshold) {
    if (!accountId) throw new HsmAdapterError('INVALID_INPUT', 'accountId is required');
    if (!Array.isArray(guardians) || guardians.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'guardians must be a non-empty array');
    }
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > guardians.length) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `threshold must be 1 ≤ t ≤ ${guardians.length}`);
    }
    this._accounts.set(accountId, {
      guardians: new Set(guardians),
      threshold,
      recoveryShares: new Map(), // guardianId -> share (hex)
    });
  }

  /**
   * Check if an account is registered.
   * @param {string} accountId
   * @returns {boolean}
   */
  hasAccount(accountId) {
    return this._accounts.has(accountId);
  }

  /**
   * Get account info.
   * @param {string} accountId
   * @returns {object}
   */
  getAccount(accountId) {
    const account = this._accounts.get(accountId);
    if (!account) throw new HsmAdapterError('ACCOUNT_NOT_FOUND', `account ${accountId} not found`);
    return {
      accountId,
      guardians: Array.from(account.guardians),
      threshold: account.threshold,
      guardianCount: account.guardians.size,
    };
  }

  /**
   * Check if a guardian is designated for an account.
   * @param {string} accountId
   * @param {string} guardianId
   * @returns {boolean}
   */
  isGuardian(accountId, guardianId) {
    const account = this._accounts.get(accountId);
    if (!account) return false;
    return account.guardians.has(guardianId);
  }

  /**
   * Store a recovery share from a guardian.
   * @param {string} accountId
   * @param {string} guardianId
   * @param {string} share — hex-encoded share
   */
  storeShare(accountId, guardianId, share) {
    const account = this._accounts.get(accountId);
    if (!account) throw new HsmAdapterError('ACCOUNT_NOT_FOUND', `account ${accountId} not found`);
    if (!account.guardians.has(guardianId)) {
      throw new HsmAdapterError('GUARDIAN_UNKNOWN', `guardian ${guardianId} not designated for account ${accountId}`);
    }
    account.recoveryShares.set(guardianId, share);
  }

  /**
   * Get a stored recovery share.
   * @param {string} accountId
   * @param {string} guardianId
   * @returns {string|null}
   */
  getShare(accountId, guardianId) {
    const account = this._accounts.get(accountId);
    if (!account) return null;
    return account.recoveryShares.get(guardianId) || null;
  }

  /**
   * Add a guardian to an account (requires existing quorum approval).
   * @param {string} accountId
   * @param {string} guardianId
   * @param {string[]} approverIds — existing guardians who approved
   */
  addGuardian(accountId, guardianId, approverIds) {
    const account = this._accounts.get(accountId);
    if (!account) throw new HsmAdapterError('ACCOUNT_NOT_FOUND', `account ${accountId} not found`);
    this._validateApprovers(account, approverIds);
    account.guardians.add(guardianId);
  }

  /**
   * Remove a guardian from an account (requires existing quorum approval).
   * @param {string} accountId
   * @param {string} guardianId
   * @param {string[]} approverIds
   */
  removeGuardian(accountId, guardianId, approverIds) {
    const account = this._accounts.get(accountId);
    if (!account) throw new HsmAdapterError('ACCOUNT_NOT_FOUND', `account ${accountId} not found`);
    this._validateApprovers(account, approverIds);
    if (!account.guardians.has(guardianId)) {
      throw new HsmAdapterError('GUARDIAN_UNKNOWN', `guardian ${guardianId} not designated for account ${accountId}`);
    }
    if (account.guardians.size <= account.threshold) {
      throw new HsmAdapterError('GUARDIAN_REMOVAL_BLOCKED', `removing guardian would make quorum impossible (${account.guardians.size - 1} < ${account.threshold})`);
    }
    account.guardians.delete(guardianId);
    account.recoveryShares.delete(guardianId);
  }

  /**
   * Validate that approvers form a quorum.
   * @param {object} account
   * @param {string[]} approverIds
   */
  _validateApprovers(account, approverIds) {
    if (!Array.isArray(approverIds) || approverIds.length < account.threshold) {
      throw new HsmAdapterError('INSUFFICIENT_APPROVERS', `need ${account.threshold} approvers, got ${approverIds?.length || 0}`);
    }
    for (const approverId of approverIds) {
      if (!account.guardians.has(approverId)) {
        throw new HsmAdapterError('APPROVER_UNAUTHORIZED', `approver ${approverId} is not a designated guardian`);
      }
    }
  }

  /**
   * Get all registered account IDs.
   * @returns {string[]}
   */
  getAccountIds() {
    return Array.from(this._accounts.keys());
  }
}

/**
 * ThresholdAccountRecoveryEngine.
 *
 * Manages the full lifecycle of threshold account recovery with
 * BFT-gated approvals, time-locks, and anti-replay protection.
 */
class ThresholdAccountRecoveryEngine {
  /**
   * @param {object} options
   * @param {number} [options.defaultTimeLockMs] — default time-lock duration
   * @param {number} [options.maxRecoveryRequests] — max active recovery requests
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.defaultTimeLockMs = options.defaultTimeLockMs !== undefined ? options.defaultTimeLockMs : 86400000; // 24 hours
    this.maxRecoveryRequests = options.maxRecoveryRequests || 100;
    this._audit = options.audit || null;

    this._registry = new GuardianRegistry();
    this._recoveryRequests = new Map(); // requestId -> { accountId, state, approvals, nonce, timestamp, timeLockUntil }
    this._seenNonces = new Set();
    this._nextRequestId = 1;
  }

  /**
   * Register an account with guardians.
   * @param {string} accountId
   * @param {string[]} guardians
   * @param {number} threshold
   */
  registerAccount(accountId, guardians, threshold) {
    this._registry.registerAccount(accountId, guardians, threshold);
    this._emitAudit('ACCOUNT_REGISTERED', { accountId, guardianCount: guardians.length, threshold });
  }

  /**
   * Store a recovery share from a guardian.
   * @param {string} accountId
   * @param {string} guardianId
   * @param {string} share
   */
  storeRecoveryShare(accountId, guardianId, share) {
    this._registry.storeShare(accountId, guardianId, share);
    this._emitAudit('RECOVERY_SHARE_STORED', { accountId, guardianId });
  }

  /**
   * Initiate a recovery request for an account.
   * @param {string} accountId
   * @param {number} [timeLockMs] — override default time-lock
   * @returns {object} recovery request
   */
  initiateRecovery(accountId, timeLockMs) {
    if (!this._registry.hasAccount(accountId)) {
      throw new HsmAdapterError('ACCOUNT_NOT_FOUND', `account ${accountId} not registered`);
    }
    if (this._recoveryRequests.size >= this.maxRecoveryRequests) {
      throw new HsmAdapterError('RECOVERY_LIMIT_EXCEEDED', `max ${this.maxRecoveryRequests} active requests`);
    }

    // Check if there's already an active recovery for this account
    for (const req of this._recoveryRequests.values()) {
      if (req.accountId === accountId && req.state !== RECOVERY_STATE.RESTORED && req.state !== RECOVERY_STATE.REJECTED) {
        throw new HsmAdapterError('RECOVERY_ALREADY_ACTIVE', `account ${accountId} already has active recovery ${req.requestId}`);
      }
    }

    const requestId = `rec-${this._nextRequestId}`;
    this._nextRequestId++;
    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const lockMs = timeLockMs !== undefined ? timeLockMs : this.defaultTimeLockMs;

    this._recoveryRequests.set(requestId, {
      requestId,
      accountId,
      state: RECOVERY_STATE.REQUESTED,
      approvals: new Map(), // guardianId -> timestamp
      nonce,
      timestamp: now,
      timeLockUntil: now + lockMs,
    });

    this._seenNonces.add(nonce);
    this._emitAudit('RECOVERY_REQUESTED', { requestId, accountId, timeLockUntil: now + lockMs });
    return { requestId, accountId, state: RECOVERY_STATE.REQUESTED, nonce, timeLockUntil: now + lockMs };
  }

  /**
   * A guardian approves a recovery request.
   * @param {string} requestId
   * @param {string} guardianId
   * @param {string} nonce — the request nonce (anti-replay)
   */
  approveRecovery(requestId, guardianId, nonce) {
    const req = this._getRecoveryRequest(requestId);

    // Anti-replay: verify nonce
    if (req.nonce !== nonce) {
      throw new HsmAdapterError('RECOVERY_NONCE_MISMATCH', 'nonce does not match recovery request');
    }

    // Verify guardian is designated
    if (!this._registry.isGuardian(req.accountId, guardianId)) {
      throw new HsmAdapterError('GUARDIAN_UNAUTHORIZED', `guardian ${guardianId} not designated for account ${req.accountId}`);
    }

    // Check state
    if (req.state !== RECOVERY_STATE.REQUESTED && req.state !== RECOVERY_STATE.APPROVING) {
      throw new HsmAdapterError('RECOVERY_NOT_ACCEPTING', `recovery ${requestId} in state ${req.state} does not accept approvals`);
    }

    // Transition to APPROVING on first approval
    if (req.state === RECOVERY_STATE.REQUESTED) {
      this._transition(requestId, RECOVERY_STATE.APPROVING);
    }

    // Check for duplicate approval
    if (req.approvals.has(guardianId)) {
      throw new HsmAdapterError('GUARDIAN_ALREADY_APPROVED', `guardian ${guardianId} already approved recovery ${requestId}`);
    }

    req.approvals.set(guardianId, Date.now());

    const account = this._registry.getAccount(req.accountId);
    const quorumReached = req.approvals.size >= account.threshold;

    this._emitAudit('RECOVERY_APPROVED', { requestId, guardianId, approvals: req.approvals.size, threshold: account.threshold, quorumReached });

    return {
      requestId,
      guardianId,
      approvals: req.approvals.size,
      threshold: account.threshold,
      quorumReached,
      state: req.state,
    };
  }

  /**
   * Execute the recovery after quorum and time-lock.
   * @param {string} requestId
   * @returns {object} recovery result
   */
  executeRecovery(requestId) {
    const req = this._getRecoveryRequest(requestId);
    const account = this._registry.getAccount(req.accountId);

    // Check quorum
    if (req.approvals.size < account.threshold) {
      throw new HsmAdapterError('RECOVERY_QUORUM_NOT_MET', `only ${req.approvals.size} approvals, need ${account.threshold}`);
    }

    // Check time-lock
    if (Date.now() < req.timeLockUntil) {
      throw new HsmAdapterError('RECOVERY_TIME_LOCKED', `time-lock expires at ${new Date(req.timeLockUntil).toISOString()}`);
    }

    // Check state
    if (req.state !== RECOVERY_STATE.APPROVING) {
      throw new HsmAdapterError('RECOVERY_NOT_APPROVING', `recovery ${requestId} in state ${req.state}, must be approving`);
    }

    this._transition(requestId, RECOVERY_STATE.RECOVERING);

    // Collect shares from approving guardians
    const shares = [];
    for (const [guardianId] of req.approvals) {
      const share = this._registry.getShare(req.accountId, guardianId);
      if (share) shares.push({ guardianId, share });
    }

    this._transition(requestId, RECOVERY_STATE.RESTORED);

    this._emitAudit('RECOVERY_EXECUTED', { requestId, accountId: req.accountId, sharesCollected: shares.length });
    return {
      requestId,
      accountId: req.accountId,
      state: RECOVERY_STATE.RESTORED,
      sharesCollected: shares.length,
      shares,
    };
  }

  /**
   * Reject a recovery request.
   * @param {string} requestId
   * @param {string} [reason]
   */
  rejectRecovery(requestId, reason = 'manual') {
    const req = this._getRecoveryRequest(requestId);
    if (req.state === RECOVERY_STATE.RESTORED) {
      throw new HsmAdapterError('RECOVERY_ALREADY_RESTORED', `recovery ${requestId} already restored`);
    }
    if (req.state === RECOVERY_STATE.REJECTED) {
      throw new HsmAdapterError('RECOVERY_ALREADY_REJECTED', `recovery ${requestId} already rejected`);
    }
    this._transition(requestId, RECOVERY_STATE.REJECTED);
    this._emitAudit('RECOVERY_REJECTED', { requestId, reason });
    return { requestId, state: RECOVERY_STATE.REJECTED, reason };
  }

  /**
   * Get the state of a recovery request.
   * @param {string} requestId
   * @returns {object}
   */
  getRecoveryState(requestId) {
    const req = this._getRecoveryRequest(requestId);
    const account = this._registry.getAccount(req.accountId);
    return {
      requestId,
      accountId: req.accountId,
      state: req.state,
      approvals: req.approvals.size,
      threshold: account.threshold,
      quorumReached: req.approvals.size >= account.threshold,
      timeLockUntil: req.timeLockUntil,
      timeLockExpired: Date.now() >= req.timeLockUntil,
    };
  }

  /**
   * Get the guardian registry.
   * @returns {GuardianRegistry}
   */
  getRegistry() {
    return this._registry;
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    const activeRecoveries = Array.from(this._recoveryRequests.values()).filter(
      (r) => r.state !== RECOVERY_STATE.RESTORED && r.state !== RECOVERY_STATE.REJECTED,
    ).length;
    return {
      registeredAccounts: this._registry.getAccountIds().length,
      totalRecoveryRequests: this._recoveryRequests.size,
      activeRecoveries,
    };
  }

  /**
   * Get a recovery request or throw.
   * @param {string} requestId
   * @returns {object}
   */
  _getRecoveryRequest(requestId) {
    const req = this._recoveryRequests.get(requestId);
    if (!req) {
      throw new HsmAdapterError('RECOVERY_NOT_FOUND', `recovery request ${requestId} not found`);
    }
    return req;
  }

  /**
   * Transition a recovery request to a new state.
   * @param {string} requestId
   * @param {string} newState
   */
  _transition(requestId, newState) {
    const req = this._recoveryRequests.get(requestId);
    const allowed = VALID_TRANSITIONS[req.state] || [];
    if (!allowed.includes(newState)) {
      throw new HsmAdapterError(
        'RECOVERY_INVALID_TRANSITION',
        `cannot transition recovery ${requestId} from ${req.state} to ${newState}`,
      );
    }
    req.state = newState;
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  ThresholdAccountRecoveryEngine,
  GuardianRegistry,
  RECOVERY_STATE,
  VALID_TRANSITIONS,
};
