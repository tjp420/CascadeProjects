'use strict';
const fs = require('fs');
const path = require('path');

const baseDir = 'server/lib/hsm-adapter';

// 1. Fix attestation client
const attPath = path.join(baseDir, 'enclave-attestation-client.cjs');
let att = fs.readFileSync(attPath, 'utf8');
att = att.replace('async verify(attestation)', 'verify(attestation)');
att = att.replace(/return \{ valid: false/g, 'return { verified: false');
att = att.replace('return { valid: true', 'return { verified: true');
fs.writeFileSync(attPath, att);
console.log('attestation client fixed:', !att.includes('async verify') && att.includes('verified: true'));

// 2. Fix base test
const testPath = path.join(baseDir, '__tests__/pq-biometric-verification-gating.test.cjs');
let test = fs.readFileSync(testPath, 'utf8');
test = test.replace(
  "const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');",
  "const { EnclaveAttestationClient, _signMock } = require('../enclave-attestation-client.cjs');"
);
test = test.replace(
  `function mockAttestation() {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
  };
}`,
  `function mockAttestation() {
  const attestation = {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
  };
  attestation.signature = _signMock(attestation);
  return attestation;
}`
);
fs.writeFileSync(testPath, test);
console.log('base test fixed:', test.includes('_signMock'));

// 3. Fix hub - add constants
const hubPath = path.join(baseDir, 'pqc-biometric-verification-gating-hub.cjs');
let hub = fs.readFileSync(hubPath, 'utf8');
hub = hub.replace(
  "const { HsmAdapterError } = require('./base-adapter.cjs');\n\nclass PqcBiometricVerificationGatingHub",
  "const { HsmAdapterError } = require('./base-adapter.cjs');\n\nconst POOL_STATUS = {\n  OPEN: 'open',\n  REBALANCING: 'rebalancing',\n  ACCREDITED: 'accredited',\n  SETTLED: 'settled',\n  CANCELLED: 'cancelled',\n};\n\nconst REBALANCE_DIRECTION = {\n  INCREASE: 'increase',\n  DECREASE: 'decrease',\n};\n\nclass PqcBiometricVerificationGatingHub"
);

// Fix constructor
hub = hub.replace(
  `  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }`,
  `  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
    this._settlements = new Map();
    this._rebalances = new Map();
    this._maxPools = options.maxPools || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._accreditCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }`
);

// Fix pool status and add initCount
hub = hub.replace(
  `      initializedAt: now,
      status: 'open',
      biometricClaimVerified: false,
      livenessAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {`,
  `      initializedAt: now,
      status: POOL_STATUS.OPEN,
      biometricClaimVerified: false,
      livenessAccreditationCompletedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {`
);

// Add maxPools check
hub = hub.replace(
  `  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireBiometricAuthorityInitializerAttestation && this._attestationClient) {`,
  `  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError('BIOMETRICGATE_MAX_POOLS', \`maximum \${this._maxPools} pools reached\`);
    }
    if (this.policy.requireBiometricAuthorityInitializerAttestation && this._attestationClient) {`
);

// Add batchInitializePools after initializePool
hub = hub.replace(
  `    return pool;
  }

  /**
   * Get a pool by id.`,
  `    return pool;
  }

  /**
   * Batch initialize multiple biometric verification gating pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('BIOMETRICGATE_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('BIOMETRICGATE_BATCH_TOO_LARGE', \`\${requests.length} exceeds max batch size \${this._maxBatchSize}\`);
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const pool = this.initializePool(req);
        results.push({ poolId: pool.poolId, initialized: true });
        successCount++;
      } catch (err) {
        results.push({ poolId: req.poolId || 'auto', initialized: false, error: err.code || 'BIOMETRICGATE_BATCH_ERROR' });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit('BIOMETRICGATE_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
    }
    return { totalRequests: requests.length, successCount, failedCount, results };
  }

  /**
   * Get a pool by id.`
);

// Add rebalanceLivenessMetricDepth after markBiometricClaimVerified
hub = hub.replace(
  `    pool.biometricClaimVerified = true;
    return pool;
  }

  /**
   * Complete liveness attestation accreditation after quorum.`,
  `    pool.biometricClaimVerified = true;
    return pool;
  }

  /**
   * Rebalance liveness metric depth for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceLivenessMetricDepth(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', \`pool \${request.poolId} not found\`);
    }
    if (pool.status !== POOL_STATUS.OPEN && pool.status !== POOL_STATUS.REBALANCING) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_REBALANCEABLE', \`pool \${request.poolId} status is \${pool.status}, expected open or rebalancing\`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_DIRECTION_INVALID', \`direction \${direction} is not valid\`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_AMOUNT_INVALID', 'rebalanceAmount must be a positive number');
    }
    const newEpoch = pool.rebalanceEpoch + 1;
    pool.rebalanceEpoch = newEpoch;
    pool.status = POOL_STATUS.REBALANCING;
    const rebalanceId = request.rebalanceId || \`rebal-\${crypto.randomBytes(4).toString('hex')}\`;
    const rebalance = {
      rebalanceId,
      poolId: request.poolId,
      direction,
      rebalanceAmount: request.rebalanceAmount,
      rebalanceEpoch: newEpoch,
      newLivenessMetricDepth: request.newLivenessMetricDepth !== undefined ? request.newLivenessMetricDepth : pool.livenessMetricDepth,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newLivenessMetricDepth !== undefined) {
      if (request.newLivenessMetricDepth > (this.policy.maxLivenessMetricDepth || 16)) {
        throw new HsmAdapterError('BIOMETRICGATE_LIVENESS_DEPTH_EXCEEDED', \`new liveness metric depth \${request.newLivenessMetricDepth} exceeds maximum \${this.policy.maxLivenessMetricDepth}\`);
      }
      pool.livenessMetricDepth = request.newLivenessMetricDepth;
    }
    if (this._audit) {
      this._audit('BIOMETRICGATE_LIVENESS_DEPTH_REBALANCED', { ...rebalance });
    }
    return rebalance;
  }

  /**
   * Get a rebalance record by id.
   * @param {string} rebalanceId
   * @returns {object|null}
   */
  getRebalance(rebalanceId) {
    return this._rebalances.get(rebalanceId) || null;
  }

  /**
   * Complete liveness attestation accreditation after quorum.`
);

// Fix accreditation status and add accreditCount
hub = hub.replace(
  `    pool.status = 'accredited';
    pool.livenessAccreditationCompletedAt = now;`,
  `    pool.status = POOL_STATUS.ACCREDITED;
    pool.livenessAccreditationCompletedAt = now;`
);
hub = hub.replace(
  `    if (this._audit) {
      this._audit('LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  /**
   * Get the current pool count.`,
  `    this._accreditCount++;
    if (this._audit) {
      this._audit('LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  /**
   * Settle an accredited pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', \`pool \${request.poolId} not found\`);
    }
    if (pool.status !== POOL_STATUS.ACCREDITED) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_ACCREDITED', \`pool \${request.poolId} status is \${pool.status}, expected accredited\`);
    }
    if (!request.targetChainId || typeof request.targetChainId !== 'string') {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_CHAIN_MISSING', 'targetChainId is required for settlement');
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_CHAIN_MISMATCH', \`settlement chain \${request.targetChainId} does not match pool target \${pool.targetChainId}\`);
    }
    const settleNow = Math.floor(Date.now() / 1000);
    const settlementId = request.settlementId || \`settle-\${crypto.randomBytes(4).toString('hex')}\`;
    const settlement = {
      settlementId,
      poolId: request.poolId,
      targetChainId: request.targetChainId,
      settlementProofHash: request.settlementProofHash || crypto.createHash('sha256').update(\`\${request.poolId}:\${request.targetChainId}:\${settleNow}\`).digest('hex'),
      settledAt: settleNow,
    };
    pool.status = POOL_STATUS.SETTLED;
    pool.settlementStatus = 'settled';
    pool.settledAt = settleNow;
    this._settlements.set(settlementId, settlement);
    this._settleCount++;
    if (this._audit) {
      this._audit('BIOMETRICGATE_SETTLED', { ...settlement });
    }
    return settlement;
  }

  /**
   * Get a settlement record by id.
   * @param {string} settlementId
   * @returns {object|null}
   */
  getSettlement(settlementId) {
    return this._settlements.get(settlementId) || null;
  }

  /**
   * Aggregate committee signatures for accreditation completion.
   * @param {string} poolId
   * @param {object[]} partialSignatures
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', \`pool \${poolId} not found\`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('BIOMETRICGATE_NO_SIGNATURES', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minBiometricAuthorityQuorum || 3)) {
      throw new HsmAdapterError('BIOMETRICGATE_QUORUM_INSUFFICIENT', \`\${partialSignatures.length} signatures below minimum \${this.policy.minBiometricAuthorityQuorum || 3}\`);
    }
    const aggregatedSig = crypto.createHash('sha256').update(partialSignatures.map(s => s.signature).join(':')).digest('hex');
    const result = {
      poolId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
      participantIds: partialSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('BIOMETRICGATE_COMMITTEE_SIGS_AGGREGATED', { poolId, count: partialSignatures.length });
    }
    return result;
  }

  /**
   * Cancel an open or rebalancing pool.
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    if (!poolId) {
      throw new HsmAdapterError('BIOMETRICGATE_CANCEL_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', \`pool \${poolId} not found\`);
    }
    if (pool.status === POOL_STATUS.ACCREDITED || pool.status === POOL_STATUS.SETTLED) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_CANCELLABLE', \`pool \${poolId} status is \${pool.status}, cannot cancel\`);
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('BIOMETRICGATE_ALREADY_CANCELLED', \`pool \${poolId} is already cancelled\`);
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit('BIOMETRICGATE_CANCELLED', { poolId });
    }
    return { poolId, status: POOL_STATUS.CANCELLED, cancelledAt: pool.cancelledAt };
  }

  /**
   * Get all pools (metadata only).
   * @returns {object[]}
   */
  getPools() {
    return Array.from(this._pools.values()).map(p => ({
      poolId: p.poolId,
      sourceTenantId: p.sourceTenantId,
      targetChainId: p.targetChainId,
      status: p.status,
      livenessMetricDepth: p.livenessMetricDepth,
      templateExpirationSeconds: p.templateExpirationSeconds,
      biometricClaimVerified: p.biometricClaimVerified,
    }));
  }

  /**
   * Get the current pool count.`
);

// Add getStats before getPoolCount closing
hub = hub.replace(
  `  getPoolCount() {
    return this._pools.size;
  }
}`,
  `  getPoolCount() {
    return this._pools.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const poolsByStatus = {};
    for (const p of this._pools.values()) {
      poolsByStatus[p.status] = (poolsByStatus[p.status] || 0) + 1;
    }
    return {
      totalPools: this._pools.size,
      totalSettlements: this._settlements.size,
      totalRebalances: this._rebalances.size,
      poolsByStatus,
      initCount: this._initCount,
      accreditCount: this._accreditCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }
}`
);

// Fix exports
hub = hub.replace(
  'module.exports = { PqcBiometricVerificationGatingHub };',
  'module.exports = {\n  PqcBiometricVerificationGatingHub,\n  POOL_STATUS,\n  REBALANCE_DIRECTION,\n};'
);

fs.writeFileSync(hubPath, hub);
console.log('hub fixed:', hub.includes('POOL_STATUS') && hub.includes('batchInitializePools') && hub.includes('settlePool'));

// 4. Fix validator
const valPath = path.join(baseDir, 'zk-biometric-claim-validator.cjs');
let val = fs.readFileSync(valPath, 'utf8');
val = val.replace(
  "const { HsmAdapterError } = require('./base-adapter.cjs');\n\nclass ZkBiometricClaimValidator",
  "const { HsmAdapterError } = require('./base-adapter.cjs');\n\nconst CLAIM_STATUS = {\n  VERIFIED: 'verified',\n  SLASHED: 'slashed',\n};\n\nconst SLASH_REASON = {\n  MALFORMED: 'malformed_claim',\n  DUPLICATE: 'duplicate_claim',\n  TEMPLATE_EXPIRATION_OUT_OF_BOUNDS: 'template_expiration_out_of_bounds',\n  POOL_NOT_FOUND: 'pool_not_found',\n  BANNED_PEER: 'banned_peer',\n  OUT_OF_WINDOW: 'out_of_window',\n};\n\nconst HW_ACCEL_TYPES = {\n  GPU_CUDA: 'gpu_cuda',\n  FPGA: 'fpga',\n  ASIC: 'asic',\n  SIMULATED: 'simulated',\n};\n\nclass ZkBiometricClaimValidator"
);
val = val.replace(
  `  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Map();
  }`,
  `  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Map();
    this._slashedClaims = [];
    this._batchHistory = [];
    this._hwAccelType = options.hwAccelType || HW_ACCEL_TYPES.SIMULATED;
    this._maxBatchSize = options.maxBatchSize || 100;
    this._claimCount = 0;
    this._hwProofCount = 0;
    this._batchVerifyCount = 0;
  }`
);

// Add slash recording in verifyBiometricClaim
val = val.replace(
  `    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('BIOMETRICCLAIM_PEER_BANNED', \`peer \${request.peerId} is banned\`);
    }
    if (!request.zkBiometricRangeProofHash || typeof request.zkBiometricRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('BIOMETRICCLAIM_ZK_PROOF_MISSING', 'zero-knowledge biometric range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('BIOMETRICCLAIM_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('BIOMETRICCLAIM_POOL_NOT_FOUND', \`pool \${request.poolId} not found\`);
    }
    if (typeof request.templateExpirationSeconds === 'number' && request.templateExpirationSeconds > (this.policy.maxTemplateExpirationSeconds || 15552000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('BIOMETRICCLAIM_TEMPLATE_EXPIRATION_OUT_OF_BOUNDS', \`template expiration seconds \${request.templateExpirationSeconds} exceeds maximum \${this.policy.maxTemplateExpirationSeconds}\`);
    }
    const claimKey = \`\${request.poolId}:\${request.peerId || 'anonymous'}\`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('BIOMETRICCLAIM_DUPLICATE', \`biometric claim for pool \${request.poolId} already verified\`);
    }`,
  `    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.BANNED_PEER);
      throw new HsmAdapterError('BIOMETRICCLAIM_PEER_BANNED', \`peer \${request.peerId} is banned\`);
    }
    if (!request.zkBiometricRangeProofHash || typeof request.zkBiometricRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('BIOMETRICCLAIM_ZK_PROOF_MISSING', 'zero-knowledge biometric range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('BIOMETRICCLAIM_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.POOL_NOT_FOUND);
      throw new HsmAdapterError('BIOMETRICCLAIM_POOL_NOT_FOUND', \`pool \${request.poolId} not found\`);
    }
    if (typeof request.templateExpirationSeconds === 'number' && request.templateExpirationSeconds > (this.policy.maxTemplateExpirationSeconds || 15552000)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.TEMPLATE_EXPIRATION_OUT_OF_BOUNDS);
      throw new HsmAdapterError('BIOMETRICCLAIM_TEMPLATE_EXPIRATION_OUT_OF_BOUNDS', \`template expiration seconds \${request.templateExpirationSeconds} exceeds maximum \${this.policy.maxTemplateExpirationSeconds}\`);
    }
    const claimKey = \`\${request.poolId}:\${request.peerId || 'anonymous'}\`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.DUPLICATE);
      throw new HsmAdapterError('BIOMETRICCLAIM_DUPLICATE', \`biometric claim for pool \${request.poolId} already verified\`);
    }`
);

// Add status and claimCount
val = val.replace(
  `      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markBiometricClaimVerified(request.poolId);`,
  `      verifiedAt: now,
      status: CLAIM_STATUS.VERIFIED,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markBiometricClaimVerified(request.poolId);
    this._claimCount++;`
);

// Add new methods before _banPeerIfPolicy
val = val.replace(
  `  getVerifiedClaims() {
    return Array.from(this._verifiedClaims.values());
  }

  /**
   * Ban a peer if policy requires it.`,
  `  getVerifiedClaims() {
    return Array.from(this._verifiedClaims.values());
  }

  /**
   * Generate a hardware-accelerated SNARK proof for a biometric claim.
   * @param {object} request
   * @returns {object}
   */
  generateHwSnarkProof(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('BIOMETRICCLAIM_HW_PROOF_FIELDS_MISSING', 'poolId is required');
    }
    if (typeof request.livenessMetric !== 'number' || typeof request.claimValue !== 'number') {
      throw new HsmAdapterError('BIOMETRICCLAIM_HW_PROOF_FIELDS_MISSING', 'livenessMetric and claimValue numbers are required');
    }
    if (!this._hub) {
      throw new HsmAdapterError('BIOMETRICCLAIM_HUB_MISSING', 'biometric verification gating hub is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICCLAIM_POOL_NOT_FOUND', \`pool \${request.poolId} not found\`);
    }
    const proofHash = crypto.createHash('sha256').update(\`\${request.poolId}:\${request.livenessMetric}:\${request.claimValue}:\${this._hwAccelType}\`).digest('hex');
    const proof = {
      zkBiometricRangeProofHash: proofHash,
      poolId: request.poolId,
      livenessMetric: request.livenessMetric,
      claimValue: request.claimValue,
      hwAccelType: this._hwAccelType,
      proofSystem: 'groth16',
      generatedAt: Math.floor(Date.now() / 1000),
    };
    this._hwProofCount++;
    if (this._audit) {
      this._audit('BIOMETRICCLAIM_HW_SNARK_PROOF_GENERATED', { ...proof });
    }
    return proof;
  }

  /**
   * Batch verify multiple biometric claims.
   * @param {object[]} requests
   * @returns {object}
   */
  batchVerifyBiometricClaims(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('BIOMETRICCLAIM_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('BIOMETRICCLAIM_BATCH_TOO_LARGE', \`\${requests.length} exceeds max batch size \${this._maxBatchSize}\`);
    }
    const results = [];
    let verifiedCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const claim = this.verifyBiometricClaim(req);
        results.push({ poolId: req.poolId, claimId: claim.claimId, verified: true });
        verifiedCount++;
      } catch (err) {
        results.push({ poolId: req.poolId || 'unknown', verified: false, error: err.code || 'BIOMETRICCLAIM_BATCH_ERROR' });
        failedCount++;
      }
    }
    this._batchVerifyCount++;
    this._batchHistory.push({ batchSize: requests.length, verifiedCount, failedCount, verifiedAt: Math.floor(Date.now() / 1000) });
    if (this._audit) {
      this._audit('BIOMETRICCLAIM_BATCH_VERIFIED', { verifiedCount, failedCount, batchSize: requests.length });
    }
    return { totalRequests: requests.length, verifiedCount, failedCount, results };
  }

  /**
   * Validate that a claim falls within the slashing window.
   * @param {string} poolId
   * @param {number} claimTimestamp
   * @returns {object}
   */
  validateSlashingWindow(poolId, claimTimestamp) {
    if (!poolId) {
      throw new HsmAdapterError('BIOMETRICCLAIM_WINDOW_FIELDS_MISSING', 'poolId is required');
    }
    if (typeof claimTimestamp !== 'number' || claimTimestamp <= 0) {
      throw new HsmAdapterError('BIOMETRICCLAIM_WINDOW_FIELDS_MISSING', 'claimTimestamp must be a positive number');
    }
    if (!this._hub) {
      throw new HsmAdapterError('BIOMETRICCLAIM_HUB_MISSING', 'biometric verification gating hub is required');
    }
    const pool = this._hub.getPool(poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICCLAIM_POOL_NOT_FOUND', \`pool \${poolId} not found\`);
    }
    const now = Math.floor(Date.now() / 1000);
    const maxWindow = this.policy.maxTemplateExpirationSeconds || 15552000;
    const ageSeconds = Math.abs(now - claimTimestamp);
    return { poolId, claimTimestamp, currentTimestamp: now, ageSeconds, maxWindowSeconds: maxWindow, withinWindow: ageSeconds <= maxWindow };
  }

  /**
   * Aggregate partial signatures from clearing committee members.
   * @param {string} poolId
   * @param {object[]} partialSignatures
   * @returns {object}
   */
  aggregatePartialSignatures(poolId, partialSignatures) {
    if (!poolId) {
      throw new HsmAdapterError('BIOMETRICCLAIM_AGG_FIELDS_MISSING', 'poolId is required');
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('BIOMETRICCLAIM_AGG_NO_SIGNATURES', 'partialSignatures array is required');
    }
    for (const sig of partialSignatures) {
      if (sig.peerId && this._bannedPeers.has(sig.peerId)) {
        throw new HsmAdapterError('BIOMETRICCLAIM_PEER_BANNED', \`peer \${sig.peerId} is banned and cannot participate in aggregation\`);
      }
    }
    if (partialSignatures.length < (this.policy.minBiometricAuthorityQuorum || 3)) {
      throw new HsmAdapterError('BIOMETRICCLAIM_AGG_INSUFFICIENT', \`\${partialSignatures.length} signatures below minimum \${this.policy.minBiometricAuthorityQuorum || 3}\`);
    }
    const aggregatedSignature = crypto.createHash('sha256').update(partialSignatures.map(s => s.signature).join(':')).digest('hex');
    const result = {
      poolId, signatureCount: partialSignatures.length, aggregatedSignature,
      participantIds: partialSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('BIOMETRICCLAIM_PARTIAL_SIGS_AGGREGATED', { poolId, count: partialSignatures.length });
    }
    return result;
  }

  /**
   * Get all slashed claims.
   * @returns {Array}
   */
  getSlashedClaims() {
    return this._slashedClaims.slice();
  }

  /**
   * Get batch verification history.
   * @returns {Array}
   */
  getBatchHistory() {
    return this._batchHistory.slice();
  }

  /**
   * Get slashing statistics.
   * @returns {object}
   */
  getSlashingStats() {
    const byReason = {};
    for (const s of this._slashedClaims) {
      byReason[s.reason] = (byReason[s.reason] || 0) + 1;
    }
    return { totalSlashes: this._slashedClaims.length, bannedPeers: this._bannedPeers.size, byReason };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalVerified: this._verifiedClaims.size,
      totalSlashed: this._slashedClaims.length,
      totalBatchVerifications: this._batchVerifyCount,
      claimCount: this._claimCount,
      hwProofCount: this._hwProofCount,
      hwAccelType: this._hwAccelType,
      bannedPeers: this._bannedPeers.size,
    };
  }

  /**
   * Ban a peer if policy requires it.`
);

// Add _recordSlash after _banPeerIfPolicy
val = val.replace(
  `  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderBiometricClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}`,
  `  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderBiometricClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }

  /**
   * Record a slash event.
   * @param {string} poolId
   * @param {string} peerId
   * @param {string} reason
   * @private
   */
  _recordSlash(poolId, peerId, reason) {
    this._slashedClaims.push({
      poolId, peerId: peerId || 'anonymous', reason,
      slashedAt: Math.floor(Date.now() / 1000),
    });
    if (this._audit) {
      this._audit('BIOMETRICCLAIM_SLASHED', { poolId, peerId, reason });
    }
  }
}`
);

// Fix exports
val = val.replace(
  'module.exports = { ZkBiometricClaimValidator };',
  'module.exports = {\n  ZkBiometricClaimValidator,\n  CLAIM_STATUS,\n  SLASH_REASON,\n  HW_ACCEL_TYPES,\n};'
);

fs.writeFileSync(valPath, val);
console.log('validator fixed:', val.includes('CLAIM_STATUS') && val.includes('_recordSlash') && val.includes('generateHwSnarkProof'));

console.log('All fixes applied.');
