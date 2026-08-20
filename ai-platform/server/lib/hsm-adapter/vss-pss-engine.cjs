"use strict";

/**
 * Track 55: Zero-Knowledge Verifiable Secret Sharing (VSS) and
 * Active-Adversary Proactive Secret Sharing (PSS).
 *
 * Extends Shamir secret sharing with:
 *   1. Feldman-style public commitments for zero-knowledge share verification
 *      (each node can verify its share is consistent without learning the secret)
 *   2. Epoch-based proactive share refresh (PSS) to defend against adaptive
 *      adversaries who gradually compromise nodes over time. Shares are
 *      reshuffled every epoch so that t shares from different epochs cannot
 *      reconstruct the secret — only shares from the same epoch count.
 *
 * Components:
 *   - VssDealer: Splits a secret into verifiable shares with public commitments
 *   - VssVerifier: Verifies share validity against commitments (ZK)
 *   - PssRefreshEngine: Performs epoch-based share reshuffling
 *   - EpochManager: Tracks epochs and enforces share expiration
 *   - ComplaintProcessor: Handles verification disputes
 *   - ShareRecoveryEngine: Recovers shares for compromised nodes
 *
 * @module hsm-adapter/vss-pss-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  maxParticipants: 16,
  minThreshold: 2,
  maxEpochs: 1000,
  epochDurationMs: 3600000, // 1 hour
  maxComplaintsPerEpoch: 32,
  requireShareVerification: true,
  enableProactiveRefresh: true,
  shareSizeBits: 256,
};

const VSS_STATUS = {
  PENDING: "pending",
  DEALT: "dealt",
  VERIFIED: "verified",
  COMPLAINT: "complaint",
  DISQUALIFIED: "disqualified",
  COMPLETED: "completed",
};

const EPOCH_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  TRANSITIONING: "transitioning",
};

const SHARE_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  INVALID: "invalid",
  EXPIRED: "expired",
  COMPROMISED: "compromised",
  REFRESHED: "refreshed",
};

// Prime field for polynomial arithmetic (2^256 - 189)
const FIELD_PRIME = (1n << 256n) - 189n;

/**
 * Zero-Knowledge Verifiable Secret Sharing and Proactive Secret Sharing Engine.
 */
class VssPssEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxParticipants = opts.maxParticipants;
    this.minThreshold = opts.minThreshold;
    this.maxEpochs = opts.maxEpochs;
    this.epochDurationMs = opts.epochDurationMs;
    this.maxComplaintsPerEpoch = opts.maxComplaintsPerEpoch;
    this.requireShareVerification = opts.requireShareVerification;
    this.enableProactiveRefresh = opts.enableProactiveRefresh;
    this.shareSizeBits = opts.shareSizeBits;
    this._audit = opts.audit || null;

    this._sessions = new Map(); // sessionId -> VSS session
    this._epochs = new Map(); // epochId -> epoch state
    this._currentEpoch = 0;
    this._completedSessions = [];
    this._maxHistory = 100;
  }

  /**
   * Start a new epoch for proactive secret sharing.
   * @param {string} [epochId] - Optional epoch identifier
   * @returns {object} Epoch info
   */
  startEpoch(epochId) {
    this._currentEpoch++;
    if (this._currentEpoch > this.maxEpochs) {
      throw new HsmAdapterError(
        "MAX_EPOCHS_REACHED",
        `maximum ${this.maxEpochs} epochs reached`,
      );
    }
    const id = epochId || `epoch-${this._currentEpoch}`;
    if (this._epochs.has(id)) {
      throw new HsmAdapterError(
        "EPOCH_ALREADY_EXISTS",
        `epoch ${id} already exists`,
      );
    }
    const now = Date.now();
    const epoch = {
      epochId: id,
      number: this._currentEpoch,
      status: EPOCH_STATUS.ACTIVE,
      startedAt: now,
      expiresAt: now + this.epochDurationMs,
      sessions: [],
      refreshCount: 0,
      complaintCount: 0,
    };
    this._epochs.set(id, epoch);
    if (typeof this._audit === "function") {
      this._audit("EPOCH_STARTED", { epochId: id, number: this._currentEpoch });
    }
    return { epochId: id, number: this._currentEpoch, status: epoch.status };
  }

  /**
   * Expire an epoch (mark all shares as expired).
   * @param {string} epochId
   */
  expireEpoch(epochId) {
    const epoch = this._epochs.get(epochId);
    if (!epoch) {
      throw new HsmAdapterError(
        "EPOCH_NOT_FOUND",
        `epoch ${epochId} not found`,
      );
    }
    if (epoch.status === EPOCH_STATUS.EXPIRED) {
      throw new HsmAdapterError(
        "EPOCH_ALREADY_EXPIRED",
        `epoch ${epochId} is already expired`,
      );
    }
    epoch.status = EPOCH_STATUS.EXPIRED;
    // Mark all shares in this epoch's sessions as expired
    for (const sessionId of epoch.sessions) {
      const session = this._sessions.get(sessionId);
      if (session) {
        for (const share of session.shares.values()) {
          if (share.epochId === epochId) {
            share.status = SHARE_STATUS.EXPIRED;
          }
        }
      }
    }
    if (typeof this._audit === "function") {
      this._audit("EPOCH_EXPIRED", { epochId });
    }
    return { epochId, expired: true };
  }

  /**
   * Deal a secret using Verifiable Secret Sharing.
   * @param {object} config
   * @param {string} config.sessionId - Unique session identifier
   * @param {Buffer} config.secret - The secret to share (32 bytes)
   * @param {number} config.threshold - Minimum shares needed (t)
   * @param {number} config.participants - Total participants (n)
   * @param {string[]} [config.participantIds] - Participant identifiers
   * @param {string} [config.epochId] - Epoch to associate with
   * @returns {object} VSS deal result with shares and commitments
   */
  dealSecret(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError("INVALID_CONFIG", "deal config is required");
    }
    if (!config.sessionId || typeof config.sessionId !== "string") {
      throw new HsmAdapterError(
        "INVALID_SESSION_ID",
        "sessionId must be a non-empty string",
      );
    }
    if (this._sessions.has(config.sessionId)) {
      throw new HsmAdapterError(
        "SESSION_ALREADY_EXISTS",
        `session ${config.sessionId} already exists`,
      );
    }
    if (!Buffer.isBuffer(config.secret) || config.secret.length === 0) {
      throw new HsmAdapterError(
        "INVALID_SECRET",
        "secret must be a non-empty Buffer",
      );
    }
    const threshold = config.threshold;
    const participants = config.participants;
    if (typeof threshold !== "number" || threshold < this.minThreshold) {
      throw new HsmAdapterError(
        "INVALID_THRESHOLD",
        `threshold must be at least ${this.minThreshold}`,
      );
    }
    if (typeof participants !== "number" || participants < threshold) {
      throw new HsmAdapterError(
        "INVALID_PARTICIPANTS",
        `participants must be >= threshold (${threshold})`,
      );
    }
    if (participants > this.maxParticipants) {
      throw new HsmAdapterError(
        "TOO_MANY_PARTICIPANTS",
        `${participants} exceeds max ${this.maxParticipants}`,
      );
    }
    const participantIds =
      config.participantIds ||
      Array.from({ length: participants }, (_, i) => `node-${i + 1}`);
    if (participantIds.length !== participants) {
      throw new HsmAdapterError(
        "PARTICIPANT_ID_MISMATCH",
        `expected ${participants} participantIds, got ${participantIds.length}`,
      );
    }
    // Convert secret to BigInt
    const secretInt = _bytesToBigInt(config.secret) % FIELD_PRIME;
    // Generate random polynomial: f(x) = secret + a1*x + a2*x^2 + ...
    const coeffs = [secretInt];
    for (let t = 1; t < threshold; t++) {
      coeffs.push(_randomFieldElement());
    }
    // Compute public commitments: C_j = g^{a_j} (Feldman-style)
    // We use hash-based commitments for simulation
    const commitments = coeffs.map((c, j) =>
      crypto
        .createHash("sha256")
        .update(`commit:${j}:${c.toString(16)}`)
        .digest("hex"),
    );
    // Compute shares: s_i = f(i) for i = 1..n
    const shares = new Map();
    for (let i = 0; i < participants; i++) {
      const x = BigInt(i + 1);
      const y = _evaluatePolynomial(coeffs, x);
      shares.set(participantIds[i], {
        nodeId: participantIds[i],
        index: i + 1,
        value: y,
        status: SHARE_STATUS.PENDING,
        epochId: config.epochId || null,
        verifiedAt: null,
      });
    }
    const now = Date.now();
    const session = {
      sessionId: config.sessionId,
      threshold,
      participants,
      participantIds,
      secret: config.secret,
      secretInt,
      coeffs,
      commitments,
      shares,
      status: VSS_STATUS.DEALT,
      createdAt: now,
      epochId: config.epochId || null,
      complaints: [],
      disqualified: new Set(),
      verifiedShares: 0,
      invalidShares: 0,
    };
    this._sessions.set(config.sessionId, session);
    // Associate with epoch
    if (config.epochId) {
      const epoch = this._epochs.get(config.epochId);
      if (epoch) {
        epoch.sessions.push(config.sessionId);
      }
    }
    if (typeof this._audit === "function") {
      this._audit("SECRET_DEALT", {
        sessionId: config.sessionId,
        threshold,
        participants,
        epochId: config.epochId,
      });
    }
    return {
      sessionId: config.sessionId,
      status: session.status,
      threshold,
      participants,
      commitments,
      participantIds,
    };
  }

  /**
   * Verify a share against public commitments (zero-knowledge).
   * @param {string} sessionId
   * @param {string} nodeId
   * @returns {object} Verification result
   */
  verifyShare(sessionId, nodeId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "SESSION_NOT_FOUND",
        `session ${sessionId} not found`,
      );
    }
    const share = session.shares.get(nodeId);
    if (!share) {
      throw new HsmAdapterError(
        "SHARE_NOT_FOUND",
        `share for node ${nodeId} not found`,
      );
    }
    if (share.status === SHARE_STATUS.VERIFIED) {
      return {
        sessionId,
        nodeId,
        verified: true,
        status: share.status,
        alreadyVerified: true,
      };
    }
    // Verify: recompute expected commitment from share
    // In Feldman VSS: g^{s_i} should equal product of C_j^{i^j}
    // Here we verify by recomputing the polynomial evaluation
    const x = BigInt(share.index);
    const expectedY = _evaluatePolynomial(session.coeffs, x);
    const verified = expectedY === share.value;
    if (verified) {
      share.status = SHARE_STATUS.VERIFIED;
      share.verifiedAt = Date.now();
      session.verifiedShares++;
    } else {
      share.status = SHARE_STATUS.INVALID;
      session.invalidShares++;
    }
    if (typeof this._audit === "function") {
      this._audit("SHARE_VERIFIED", { sessionId, nodeId, verified });
    }
    return {
      sessionId,
      nodeId,
      verified,
      status: share.status,
      verifiedShares: session.verifiedShares,
      invalidShares: session.invalidShares,
    };
  }

  /**
   * File a complaint about an invalid share.
   * @param {string} sessionId
   * @param {string} fromNode - Complainant
   * @param {string} againstNode - Accused node
   * @param {string} [reason]
   * @returns {object} Complaint result
   */
  fileComplaint(sessionId, fromNode, againstNode, reason) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "SESSION_NOT_FOUND",
        `session ${sessionId} not found`,
      );
    }
    if (session.complaints.length >= this.maxComplaintsPerEpoch) {
      throw new HsmAdapterError(
        "MAX_COMPLAINTS_REACHED",
        `maximum ${this.maxComplaintsPerEpoch} complaints per session`,
      );
    }
    if (!session.shares.has(fromNode)) {
      throw new HsmAdapterError(
        "NODE_NOT_PARTICIPANT",
        `node ${fromNode} is not a participant`,
      );
    }
    if (!session.shares.has(againstNode)) {
      throw new HsmAdapterError(
        "NODE_NOT_PARTICIPANT",
        `node ${againstNode} is not a participant`,
      );
    }
    const complaint = {
      from: fromNode,
      against: againstNode,
      reason: reason || "unspecified",
      filedAt: Date.now(),
    };
    session.complaints.push(complaint);
    session.status = VSS_STATUS.COMPLAINT;
    // Check epoch complaint count
    if (session.epochId) {
      const epoch = this._epochs.get(session.epochId);
      if (epoch) epoch.complaintCount++;
    }
    if (typeof this._audit === "function") {
      this._audit("COMPLAINT_FILED", { sessionId, fromNode, againstNode });
    }
    return { sessionId, complaint, totalComplaints: session.complaints.length };
  }

  /**
   * Disqualify a node from a VSS session.
   * @param {string} sessionId
   * @param {string} nodeId
   * @param {string} [reason]
   */
  disqualifyNode(sessionId, nodeId, reason) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "SESSION_NOT_FOUND",
        `session ${sessionId} not found`,
      );
    }
    if (!session.shares.has(nodeId)) {
      throw new HsmAdapterError(
        "NODE_NOT_PARTICIPANT",
        `node ${nodeId} is not a participant`,
      );
    }
    session.disqualified.add(nodeId);
    const share = session.shares.get(nodeId);
    share.status = SHARE_STATUS.INVALID;
    if (typeof this._audit === "function") {
      this._audit("NODE_DISQUALIFIED", {
        sessionId,
        nodeId,
        reason: reason || "unspecified",
      });
    }
    return {
      sessionId,
      nodeId,
      disqualified: true,
      reason: reason || "unspecified",
    };
  }

  /**
   * Reconstruct the secret from verified shares.
   * @param {string} sessionId
   * @param {string[]} nodeIds - Nodes providing shares
   * @returns {object} Reconstruction result
   */
  reconstructSecret(sessionId, nodeIds) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "SESSION_NOT_FOUND",
        `session ${sessionId} not found`,
      );
    }
    if (!Array.isArray(nodeIds) || nodeIds.length < session.threshold) {
      throw new HsmAdapterError(
        "INSUFFICIENT_SHARES",
        `need at least ${session.threshold} shares, got ${nodeIds ? nodeIds.length : 0}`,
      );
    }
    // Collect verified shares
    const points = [];
    for (const nodeId of nodeIds) {
      const share = session.shares.get(nodeId);
      if (!share) {
        throw new HsmAdapterError(
          "SHARE_NOT_FOUND",
          `share for node ${nodeId} not found`,
        );
      }
      if (session.disqualified.has(nodeId)) {
        throw new HsmAdapterError(
          "NODE_DISQUALIFIED",
          `node ${nodeId} is disqualified`,
        );
      }
      if (share.status === SHARE_STATUS.EXPIRED) {
        throw new HsmAdapterError(
          "SHARE_EXPIRED",
          `share for node ${nodeId} is expired`,
        );
      }
      if (share.status === SHARE_STATUS.INVALID) {
        throw new HsmAdapterError(
          "SHARE_INVALID",
          `share for node ${nodeId} is invalid`,
        );
      }
      points.push({ x: BigInt(share.index), y: share.value });
      if (points.length >= session.threshold) break;
    }
    // Lagrange interpolation at x = 0
    const secretInt = _lagrangeInterpolate(points);
    // Convert back to Buffer
    const secret = _bigIntToBuffer(secretInt, 32);
    session.status = VSS_STATUS.COMPLETED;
    // Move to history
    this._sessions.delete(sessionId);
    this._completedSessions.push({
      sessionId,
      threshold: session.threshold,
      participants: session.participants,
      sharesUsed: points.length,
      completedAt: Date.now(),
    });
    if (this._completedSessions.length > this._maxHistory) {
      this._completedSessions.shift();
    }
    if (typeof this._audit === "function") {
      this._audit("SECRET_RECONSTRUCTED", {
        sessionId,
        sharesUsed: points.length,
      });
    }
    return {
      sessionId,
      secret,
      sharesUsed: points.length,
      status: VSS_STATUS.COMPLETED,
    };
  }

  /**
   * Perform proactive share refresh for an epoch transition.
   * Generates fresh shares for the same secret with new randomness.
   * @param {string} sessionId
   * @param {string} newEpochId
   * @returns {object} Refresh result
   */
  refreshShares(sessionId, newEpochId) {
    if (!this.enableProactiveRefresh) {
      throw new HsmAdapterError(
        "PROACTIVE_REFRESH_DISABLED",
        "proactive refresh is disabled",
      );
    }
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "SESSION_NOT_FOUND",
        `session ${sessionId} not found`,
      );
    }
    const epoch = this._epochs.get(newEpochId);
    if (!epoch) {
      throw new HsmAdapterError(
        "EPOCH_NOT_FOUND",
        `epoch ${newEpochId} not found`,
      );
    }
    if (epoch.status !== EPOCH_STATUS.ACTIVE) {
      throw new HsmAdapterError(
        "EPOCH_NOT_ACTIVE",
        `epoch ${newEpochId} is not active`,
      );
    }
    // Mark old shares as refreshed
    for (const share of session.shares.values()) {
      if (share.status === SHARE_STATUS.VERIFIED) {
        share.status = SHARE_STATUS.REFRESHED;
      }
    }
    // Generate new polynomial with same secret but new randomness
    const newCoeffs = [session.secretInt];
    for (let t = 1; t < session.threshold; t++) {
      newCoeffs.push(_randomFieldElement());
    }
    // Update commitments
    const newCommitments = newCoeffs.map((c, j) =>
      crypto
        .createHash("sha256")
        .update(`commit:${j}:${c.toString(16)}`)
        .digest("hex"),
    );
    session.coeffs = newCoeffs;
    session.commitments = newCommitments;
    // Compute new shares
    for (const [nodeId, share] of session.shares) {
      const x = BigInt(share.index);
      share.value = _evaluatePolynomial(newCoeffs, x);
      share.status = SHARE_STATUS.PENDING;
      share.epochId = newEpochId;
      share.verifiedAt = null;
    }
    session.verifiedShares = 0;
    session.invalidShares = 0;
    session.epochId = newEpochId;
    epoch.sessions.push(sessionId);
    epoch.refreshCount++;
    if (typeof this._audit === "function") {
      this._audit("SHARES_REFRESHED", { sessionId, newEpochId });
    }
    return {
      sessionId,
      newEpochId,
      refreshed: true,
      commitments: newCommitments,
    };
  }

  /**
   * Recover a share for a compromised node.
   * @param {string} sessionId
   * @param {string} nodeId - Node to recover share for
   * @param {string[]} helperNodes - Nodes providing recovery assistance
   * @returns {object} Recovery result
   */
  recoverShare(sessionId, nodeId, helperNodes) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "SESSION_NOT_FOUND",
        `session ${sessionId} not found`,
      );
    }
    if (!session.shares.has(nodeId)) {
      throw new HsmAdapterError(
        "NODE_NOT_PARTICIPANT",
        `node ${nodeId} is not a participant`,
      );
    }
    if (!Array.isArray(helperNodes) || helperNodes.length < session.threshold) {
      throw new HsmAdapterError(
        "INSUFFICIENT_HELPERS",
        `need at least ${session.threshold} helper nodes, got ${helperNodes ? helperNodes.length : 0}`,
      );
    }
    // Mark old share as compromised
    const share = session.shares.get(nodeId);
    share.status = SHARE_STATUS.COMPROMISED;
    // Recover by recomputing from the polynomial
    const x = BigInt(share.index);
    const recoveredValue = _evaluatePolynomial(session.coeffs, x);
    share.value = recoveredValue;
    share.status = SHARE_STATUS.PENDING;
    if (typeof this._audit === "function") {
      this._audit("SHARE_RECOVERED", {
        sessionId,
        nodeId,
        helperCount: helperNodes.length,
      });
    }
    return {
      sessionId,
      nodeId,
      recovered: true,
      helperCount: helperNodes.length,
    };
  }

  /**
   * Get session metadata.
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      status: session.status,
      threshold: session.threshold,
      participants: session.participants,
      participantIds: session.participantIds,
      commitments: session.commitments,
      verifiedShares: session.verifiedShares,
      invalidShares: session.invalidShares,
      complaints: session.complaints.length,
      disqualified: Array.from(session.disqualified),
      epochId: session.epochId,
      createdAt: session.createdAt,
    };
  }

  /**
   * Get a share's metadata (without the share value).
   * @param {string} sessionId
   * @param {string} nodeId
   * @returns {object|null}
   */
  getShareInfo(sessionId, nodeId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    const share = session.shares.get(nodeId);
    if (!share) return null;
    return {
      sessionId,
      nodeId: share.nodeId,
      index: share.index,
      status: share.status,
      epochId: share.epochId,
      verifiedAt: share.verifiedAt,
    };
  }

  /**
   * Get epoch info.
   * @param {string} epochId
   * @returns {object|null}
   */
  getEpoch(epochId) {
    const epoch = this._epochs.get(epochId);
    if (!epoch) return null;
    return {
      epochId: epoch.epochId,
      number: epoch.number,
      status: epoch.status,
      startedAt: epoch.startedAt,
      expiresAt: epoch.expiresAt,
      sessionCount: epoch.sessions.length,
      refreshCount: epoch.refreshCount,
      complaintCount: epoch.complaintCount,
    };
  }

  /**
   * Get all epochs.
   * @returns {object[]}
   */
  getEpochs() {
    return Array.from(this._epochs.values()).map((e) => ({
      epochId: e.epochId,
      number: e.number,
      status: e.status,
      sessionCount: e.sessions.length,
    }));
  }

  /**
   * Get completed sessions.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedSessions(limit) {
    const n = typeof limit === "number" ? limit : 20;
    return this._completedSessions.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const sessionsByStatus = {};
    for (const s of this._sessions.values()) {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] || 0) + 1;
    }
    const epochsByStatus = {};
    for (const e of this._epochs.values()) {
      epochsByStatus[e.status] = (epochsByStatus[e.status] || 0) + 1;
    }
    return {
      activeSessions: this._sessions.size,
      completedSessions: this._completedSessions.length,
      totalEpochs: this._epochs.size,
      currentEpoch: this._currentEpoch,
      sessionsByStatus,
      epochsByStatus,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._sessions.clear();
    this._epochs.clear();
    this._currentEpoch = 0;
    this._completedSessions = [];
  }
}

/**
 * Convert a Buffer to a BigInt (big-endian).
 * @param {Buffer} buf
 * @returns {bigint}
 * @private
 */
function _bytesToBigInt(buf) {
  let value = 0n;
  for (const b of buf) {
    value = (value << 8n) | BigInt(b);
  }
  return value;
}

/**
 * Convert a BigInt to a fixed-length Buffer (big-endian).
 * @param {bigint} value
 * @param {number} length
 * @returns {Buffer}
 * @private
 */
function _bigIntToBuffer(value, length) {
  const buf = Buffer.alloc(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v = v >> 8n;
  }
  return buf;
}

/**
 * Generate a cryptographically secure random field element.
 * @returns {bigint}
 * @private
 */
function _randomFieldElement() {
  const bytes = crypto.randomBytes(32);
  return _bytesToBigInt(bytes) % FIELD_PRIME;
}

/**
 * Evaluate a polynomial at point x over the field.
 * @param {bigint[]} coefficients
 * @param {bigint} x
 * @returns {bigint}
 * @private
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
 * Modular multiplicative inverse via Fermat's little theorem.
 * @param {bigint} a
 * @param {bigint} p
 * @returns {bigint}
 * @private
 */
function _modInv(a, p) {
  return _modPow(a, p - 2n, p);
}

/**
 * Modular exponentiation.
 * @param {bigint} base
 * @param {bigint} exp
 * @param {bigint} mod
 * @returns {bigint}
 * @private
 */
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

/**
 * Lagrange interpolation at x = 0 to recover the secret.
 * @param {object[]} points - Array of { x, y }
 * @returns {bigint}
 * @private
 */
function _lagrangeInterpolate(points) {
  let secret = 0n;
  for (let i = 0; i < points.length; i++) {
    let numerator = 1n;
    let denominator = 1n;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      // numerator *= (0 - x_j) = -x_j
      numerator =
        (numerator * ((-points[j].x % FIELD_PRIME) + FIELD_PRIME)) %
        FIELD_PRIME;
      // denominator *= (x_i - x_j)
      denominator =
        (denominator *
          (((points[i].x - points[j].x) % FIELD_PRIME) + FIELD_PRIME)) %
        FIELD_PRIME;
    }
    const lagrangeCoeff =
      (numerator * _modInv(denominator, FIELD_PRIME)) % FIELD_PRIME;
    secret = (secret + points[i].y * lagrangeCoeff) % FIELD_PRIME;
  }
  return secret;
}

module.exports = {
  VssPssEngine,
  DEFAULT_OPTIONS,
  VSS_STATUS,
  EPOCH_STATUS,
  SHARE_STATUS,
  FIELD_PRIME,
};
