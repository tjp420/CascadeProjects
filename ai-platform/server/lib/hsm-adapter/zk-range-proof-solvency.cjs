'use strict';

/**
 * Track 53: Zero-Knowledge Range Proofs and Auditable Asset Solvency.
 *
 * Generates and verifies non-interactive zero-knowledge proofs that a
 * committed asset value lies within a specified range [min, max] without
 * revealing the actual value. Supports batch range proofs for solvency
 * audits (proving total assets >= total liabilities without exposing
 * individual balances).
 *
 * Components:
 *   - RangeProofGenerator: Creates ZK range proofs for committed values
 *   - RangeProofVerifier: Verifies range proofs without learning the value
 *   - SolvencyAuditor: Aggregates asset/liability proofs into solvency report
 *   - BatchProofProcessor: Processes multiple range proofs in a single batch
 *   - AuditLedger: Tamper-evident log of all proof generation and verification
 *
 * @module hsm-adapter/zk-range-proof-solvency
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  maxRangeBits: 64,
  maxBatchSize: 256,
  proofValidityMs: 3600000, // 1 hour
  requireAttestation: false,
  minLiabilityRatio: 1.0, // assets / liabilities must be >= 1.0
  maxProofAge: 86400000, // 24 hours
  enableBatchProofs: true,
  auditLogSize: 500,
};

const PROOF_STATUS = {
  GENERATED: 'generated',
  VERIFIED: 'verified',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

const AUDIT_STATUS = {
  PENDING: 'pending',
  SOLVENT: 'solvent',
  INSOLVENT: 'insolvent',
  FAILED: 'failed',
};

/**
 * Zero-Knowledge Range Proofs and Auditable Asset Solvency Engine.
 */
class ZkRangeProofSolvency {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxRangeBits = opts.maxRangeBits;
    this.maxBatchSize = opts.maxBatchSize;
    this.proofValidityMs = opts.proofValidityMs;
    this.requireAttestation = opts.requireAttestation;
    this.minLiabilityRatio = opts.minLiabilityRatio;
    this.maxProofAge = opts.maxProofAge;
    this.enableBatchProofs = opts.enableBatchProofs;
    this.auditLogSize = opts.auditLogSize;
    this._audit = opts.audit || null;

    this._proofs = new Map(); // proofId -> proof state
    this._audits = new Map(); // auditId -> audit state
    this._auditLog = []; // tamper-evident log
    this._completedAudits = [];
    this._maxHistory = 100;
  }

  /**
   * Commit to a value using a Pedersen-style commitment.
   * @param {number} value - The value to commit to
   * @param {string} [blinding] - Optional blinding factor (hex string)
   * @returns {object} Commitment { commitment, blinding, value }
   */
  commit(value, blinding) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new HsmAdapterError('INVALID_VALUE', 'value must be a finite number');
    }
    const blind = blinding || crypto.randomBytes(32).toString('hex');
    const commitment = crypto.createHash('sha256')
      .update(`${value}:${blind}`)
      .digest('hex');
    return { commitment, blinding: blind, value };
  }

  /**
   * Generate a ZK range proof for a committed value.
   * @param {object} config
   * @param {number} config.value - The actual value (prover knows this)
   * @param {string} config.blinding - Blinding factor from commit()
   * @param {number} config.min - Minimum of the range
   * @param {number} config.max - Maximum of the range
   * @param {string} [config.assetId] - Asset identifier
   * @param {string} [config.proverId] - Prover identity
   * @returns {object} Range proof
   */
  generateRangeProof(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('INVALID_CONFIG', 'proof config is required');
    }
    if (typeof config.value !== 'number' || !Number.isFinite(config.value)) {
      throw new HsmAdapterError('INVALID_VALUE', 'value must be a finite number');
    }
    if (!config.blinding || typeof config.blinding !== 'string') {
      throw new HsmAdapterError('INVALID_BLINDING', 'blinding factor is required');
    }
    if (typeof config.min !== 'number' || typeof config.max !== 'number') {
      throw new HsmAdapterError('INVALID_RANGE', 'min and max must be numbers');
    }
    if (config.min >= config.max) {
      throw new HsmAdapterError('INVALID_RANGE', 'min must be less than max');
    }
    // Check value is in range (prover-side check)
    if (config.value < config.min || config.value > config.max) {
      throw new HsmAdapterError('VALUE_OUT_OF_RANGE',
        `value ${config.value} is outside range [${config.min}, ${config.max}]`);
    }
    // Check bit width
    const bitWidth = Math.max(config.max.toString(2).length, config.min.toString(2).length);
    if (bitWidth > this.maxRangeBits) {
      throw new HsmAdapterError('RANGE_TOO_WIDE',
        `range bit width ${bitWidth} exceeds max ${this.maxRangeBits}`);
    }
    const proofId = _generateId('rproof', Date.now());
    const now = Date.now();
    // Generate proof components
    const commitment = crypto.createHash('sha256')
      .update(`${config.value}:${config.blinding}`)
      .digest('hex');
    // Simulated ZK proof: hash of (commitment, range, value-in-range witness)
    const witness = _computeWitness(config.value, config.min, config.max, config.blinding);
    const proofHash = crypto.createHash('sha256')
      .update(`${commitment}:${config.min}:${config.max}:${witness}`)
      .digest('hex');
    const proof = {
      proofId,
      commitment,
      min: config.min,
      max: config.max,
      proofHash,
      assetId: config.assetId || 'default',
      proverId: config.proverId || 'anonymous',
      status: PROOF_STATUS.GENERATED,
      generatedAt: now,
      expiresAt: now + this.proofValidityMs,
      bitWidth,
    };
    this._proofs.set(proofId, proof);
    this._appendLog('RANGE_PROOF_GENERATED', {
      proofId,
      assetId: proof.assetId,
      min: proof.min,
      max: proof.max,
      bitWidth,
    });
    if (typeof this._audit === 'function') {
      this._audit('RANGE_PROOF_GENERATED', { proofId, assetId: proof.assetId });
    }
    return {
      proofId,
      commitment,
      min: proof.min,
      max: proof.max,
      proofHash,
      status: proof.status,
      expiresAt: proof.expiresAt,
    };
  }

  /**
   * Verify a ZK range proof without learning the value.
   * @param {object} proof - The proof to verify (from generateRangeProof or external)
   * @param {string} proof.proofId - Proof identifier
   * @param {string} proof.commitment - Pedersen commitment
   * @param {number} proof.min - Range minimum
   * @param {number} proof.max - Range maximum
   * @param {string} proof.proofHash - ZK proof hash
   * @returns {object} Verification result
   */
  verifyRangeProof(proof) {
    if (!proof || typeof proof !== 'object') {
      throw new HsmAdapterError('INVALID_PROOF', 'proof is required');
    }
    if (!proof.proofId || typeof proof.proofId !== 'string') {
      throw new HsmAdapterError('INVALID_PROOF', 'proofId is required');
    }
    if (!proof.commitment || typeof proof.commitment !== 'string') {
      throw new HsmAdapterError('INVALID_PROOF', 'commitment is required');
    }
    if (!proof.proofHash || typeof proof.proofHash !== 'string') {
      throw new HsmAdapterError('INVALID_PROOF', 'proofHash is required');
    }
    if (typeof proof.min !== 'number' || typeof proof.max !== 'number') {
      throw new HsmAdapterError('INVALID_PROOF', 'min and max must be numbers');
    }
    // Check if proof is stored locally
    const stored = this._proofs.get(proof.proofId);
    let isValid = false;
    if (stored) {
      // Verify against stored proof
      isValid = stored.commitment === proof.commitment &&
        stored.min === proof.min &&
        stored.max === proof.max &&
        stored.proofHash === proof.proofHash &&
        Date.now() < stored.expiresAt;
      if (isValid) {
        stored.status = PROOF_STATUS.VERIFIED;
      } else {
        stored.status = PROOF_STATUS.INVALID;
      }
    } else {
      // External proof — verify format and hash structure
      if (proof.proofHash.length !== 64) {
        isValid = false;
      } else if (!/^[0-9a-f]+$/i.test(proof.proofHash)) {
        isValid = false;
      } else if (proof.min >= proof.max) {
        isValid = false;
      } else {
        // Recompute expected proof hash from public inputs
        const expectedHash = crypto.createHash('sha256')
          .update(`${proof.commitment}:${proof.min}:${proof.max}`)
          .digest('hex');
        // In a real ZK system, this would verify the proof cryptographically
        // Here we check that the proof hash is a valid SHA-256 hash
        isValid = proof.proofHash.length === 64 && /^[0-9a-f]+$/i.test(proof.proofHash);
      }
    }
    this._appendLog('RANGE_PROOF_VERIFIED', {
      proofId: proof.proofId,
      valid: isValid,
    });
    if (typeof this._audit === 'function') {
      this._audit('RANGE_PROOF_VERIFIED', { proofId: proof.proofId, valid: isValid });
    }
    return {
      proofId: proof.proofId,
      verified: isValid,
      status: isValid ? PROOF_STATUS.VERIFIED : PROOF_STATUS.INVALID,
      min: proof.min,
      max: proof.max,
    };
  }

  /**
   * Generate a batch of range proofs for multiple assets.
   * @param {object[]} items - Array of { value, blinding, min, max, assetId }
   * @returns {object} Batch proof result
   */
  generateBatchProofs(items) {
    if (!this.enableBatchProofs) {
      throw new HsmAdapterError('BATCH_DISABLED', 'batch proofs are disabled');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new HsmAdapterError('INVALID_BATCH', 'items must be a non-empty array');
    }
    if (items.length > this.maxBatchSize) {
      throw new HsmAdapterError('BATCH_TOO_LARGE',
        `${items.length} items exceed max batch size ${this.maxBatchSize}`);
    }
    const proofs = [];
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const proof = this.generateRangeProof(items[i]);
        proofs.push(proof);
      } catch (e) {
        errors.push({ index: i, error: e.message });
      }
    }
    // Generate batch commitment
    const batchId = _generateId('batch', Date.now());
    const batchHash = crypto.createHash('sha256')
      .update(proofs.map(p => p.proofHash).join(':'))
      .digest('hex');
    this._appendLog('BATCH_PROOFS_GENERATED', {
      batchId,
      count: proofs.length,
      errors: errors.length,
    });
    return {
      batchId,
      batchHash,
      proofs,
      errors,
      totalCount: items.length,
      successCount: proofs.length,
      errorCount: errors.length,
    };
  }

  /**
   * Initiate a solvency audit.
   * @param {object} config
   * @param {string} config.auditId - Unique audit identifier
   * @param {object[]} config.assetProofs - Array of verified range proofs for assets
   * @param {object[]} config.liabilityProofs - Array of verified range proofs for liabilities
   * @param {string} [config.auditorId] - Auditor identity
   * @returns {object} Solvency audit result
   */
  initiateSolvencyAudit(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('INVALID_CONFIG', 'audit config is required');
    }
    if (!config.auditId || typeof config.auditId !== 'string') {
      throw new HsmAdapterError('INVALID_AUDIT_ID', 'auditId must be a non-empty string');
    }
    if (this._audits.has(config.auditId)) {
      throw new HsmAdapterError('AUDIT_ALREADY_EXISTS', `audit ${config.auditId} already exists`);
    }
    if (!Array.isArray(config.assetProofs) || config.assetProofs.length === 0) {
      throw new HsmAdapterError('INVALID_ASSET_PROOFS', 'assetProofs must be a non-empty array');
    }
    if (!Array.isArray(config.liabilityProofs)) {
      throw new HsmAdapterError('INVALID_LIABILITY_PROOFS', 'liabilityProofs must be an array');
    }
    // Verify all proofs
    let assetCount = 0;
    let liabilityCount = 0;
    const verificationErrors = [];
    for (const proof of config.assetProofs) {
      const result = this.verifyRangeProof(proof);
      if (result.verified) {
        assetCount++;
      } else {
        verificationErrors.push({ proofId: proof.proofId, type: 'asset', error: 'verification failed' });
      }
    }
    for (const proof of config.liabilityProofs) {
      const result = this.verifyRangeProof(proof);
      if (result.verified) {
        liabilityCount++;
      } else {
        verificationErrors.push({ proofId: proof.proofId, type: 'liability', error: 'verification failed' });
      }
    }
    const now = Date.now();
    const audit = {
      auditId: config.auditId,
      auditorId: config.auditorId || 'anonymous',
      status: AUDIT_STATUS.PENDING,
      assetProofCount: config.assetProofs.length,
      liabilityProofCount: config.liabilityProofs.length,
      verifiedAssets: assetCount,
      verifiedLiabilities: liabilityCount,
      verificationErrors,
      initiatedAt: now,
      completedAt: null,
      result: null,
    };
    this._audits.set(config.auditId, audit);
    this._appendLog('SOLVENCY_AUDIT_INITIATED', {
      auditId,
      assetProofs: config.assetProofs.length,
      liabilityProofs: config.liabilityProofs.length,
    });
    return {
      auditId,
      status: audit.status,
      verifiedAssets: assetCount,
      verifiedLiabilities: liabilityCount,
      verificationErrors,
    };
  }

  /**
   * Complete a solvency audit by computing the solvency ratio.
   * @param {string} auditId
   * @param {object} totals - Aggregated totals (from threshold decryption)
   * @param {number} totals.totalAssets - Sum of all asset values
   * @param {number} totals.totalLiabilities - Sum of all liability values
   * @returns {object} Solvency audit result
   */
  completeSolvencyAudit(auditId, totals) {
    const audit = this._audits.get(auditId);
    if (!audit) {
      throw new HsmAdapterError('AUDIT_NOT_FOUND', `audit ${auditId} not found`);
    }
    if (audit.status !== AUDIT_STATUS.PENDING) {
      throw new HsmAdapterError('AUDIT_NOT_PENDING', `audit is in status ${audit.status}`);
    }
    if (!totals || typeof totals.totalAssets !== 'number' || typeof totals.totalLiabilities !== 'number') {
      throw new HsmAdapterError('INVALID_TOTALS', 'totalAssets and totalLiabilities are required');
    }
    if (totals.totalAssets < 0) {
      throw new HsmAdapterError('INVALID_ASSETS', 'totalAssets cannot be negative');
    }
    if (totals.totalLiabilities < 0) {
      throw new HsmAdapterError('INVALID_LIABILITIES', 'totalLiabilities cannot be negative');
    }
    const ratio = totals.totalLiabilities === 0
      ? Infinity
      : totals.totalAssets / totals.totalLiabilities;
    const isSolvent = ratio >= this.minLiabilityRatio;
    audit.status = isSolvent ? AUDIT_STATUS.SOLVENT : AUDIT_STATUS.INSOLVENT;
    audit.completedAt = Date.now();
    audit.result = {
      totalAssets: totals.totalAssets,
      totalLiabilities: totals.totalLiabilities,
      ratio,
      isSolvent,
      minRatio: this.minLiabilityRatio,
    };
    // Move to history
    this._audits.delete(auditId);
    this._completedAudits.push({
      auditId,
      auditorId: audit.auditorId,
      status: audit.status,
      ...audit.result,
      completedAt: audit.completedAt,
    });
    if (this._completedAudits.length > this._maxHistory) {
      this._completedAudits.shift();
    }
    this._appendLog('SOLVENCY_AUDIT_COMPLETED', {
      auditId,
      status: audit.status,
      ratio,
      isSolvent,
    });
    if (typeof this._audit === 'function') {
      this._audit('SOLVENCY_AUDIT_COMPLETED', { auditId, status: audit.status, ratio });
    }
    return {
      auditId,
      status: audit.status,
      totalAssets: totals.totalAssets,
      totalLiabilities: totals.totalLiabilities,
      ratio,
      isSolvent,
      minRatio: this.minLiabilityRatio,
    };
  }

  /**
   * Revoke a proof.
   * @param {string} proofId
   * @param {string} [reason]
   * @returns {object}
   */
  revokeProof(proofId, reason) {
    const proof = this._proofs.get(proofId);
    if (!proof) {
      throw new HsmAdapterError('PROOF_NOT_FOUND', `proof ${proofId} not found`);
    }
    proof.status = PROOF_STATUS.REVOKED;
    this._appendLog('PROOF_REVOKED', { proofId, reason: reason || 'unspecified' });
    return { proofId, revoked: true, reason: reason || 'unspecified' };
  }

  /**
   * Get a proof by ID.
   * @param {string} proofId
   * @returns {object|null}
   */
  getProof(proofId) {
    const proof = this._proofs.get(proofId);
    if (!proof) return null;
    return {
      proofId: proof.proofId,
      commitment: proof.commitment,
      min: proof.min,
      max: proof.max,
      proofHash: proof.proofHash,
      status: proof.status,
      assetId: proof.assetId,
      proverId: proof.proverId,
      generatedAt: proof.generatedAt,
      expiresAt: proof.expiresAt,
    };
  }

  /**
   * Get all active proofs.
   * @returns {object[]}
   */
  getActiveProofs() {
    return Array.from(this._proofs.values())
      .filter(p => p.status === PROOF_STATUS.GENERATED || p.status === PROOF_STATUS.VERIFIED)
      .map(p => ({
        proofId: p.proofId,
        assetId: p.assetId,
        status: p.status,
        min: p.min,
        max: p.max,
      }));
  }

  /**
   * Get completed audits.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedAudits(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._completedAudits.slice(-n);
  }

  /**
   * Get audit log (tamper-evident).
   * @param {number} [limit]
   * @returns {object[]}
   */
  getAuditLog(limit) {
    const n = typeof limit === 'number' ? limit : 50;
    return this._auditLog.slice(-n);
  }

  /**
   * Verify audit log integrity (tamper-evident chain).
   * @returns {object}
   */
  verifyAuditLogIntegrity() {
    for (let i = 1; i < this._auditLog.length; i++) {
      const prev = this._auditLog[i - 1];
      const curr = this._auditLog[i];
      const expectedPrevHash = crypto.createHash('sha256')
        .update(JSON.stringify(prev))
        .digest('hex');
      if (curr.prevHash !== expectedPrevHash) {
        return { intact: false, brokenAt: i };
      }
    }
    return { intact: true, entries: this._auditLog.length };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const byStatus = {};
    for (const p of this._proofs.values()) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }
    return {
      activeProofs: this._proofs.size,
      pendingAudits: this._audits.size,
      completedAudits: this._completedAudits.length,
      auditLogEntries: this._auditLog.length,
      byStatus,
      minLiabilityRatio: this.minLiabilityRatio,
      maxBatchSize: this.maxBatchSize,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._proofs.clear();
    this._audits.clear();
    this._auditLog = [];
    this._completedAudits = [];
  }

  /**
   * Append to tamper-evident audit log.
   * @param {string} event
   * @param {object} info
   * @private
   */
  _appendLog(event, info) {
    const prevHash = this._auditLog.length > 0
      ? crypto.createHash('sha256').update(JSON.stringify(this._auditLog[this._auditLog.length - 1])).digest('hex')
      : '0'.repeat(64);
    this._auditLog.push({
      seq: this._auditLog.length,
      event,
      info,
      timestamp: Date.now(),
      prevHash,
    });
    if (this._auditLog.length > this.auditLogSize) {
      this._auditLog.shift();
    }
  }
}

function _computeWitness(value, min, max, blinding) {
  // Simulated ZK witness: proves value is in [min, max] without revealing it
  // In production, this would be a proper ZK proof (Bulletproof, etc.)
  const inRange = value >= min && value <= max;
  return crypto.createHash('sha256')
    .update(`${inRange}:${value - min}:${max - value}:${blinding}`)
    .digest('hex');
}

function _generateId(prefix, timestamp) {
  return `${prefix}-${timestamp}-${Math.floor(Math.random() * 1000000)}`;
}

module.exports = {
  ZkRangeProofSolvency,
  DEFAULT_OPTIONS,
  PROOF_STATUS,
  AUDIT_STATUS,
};
