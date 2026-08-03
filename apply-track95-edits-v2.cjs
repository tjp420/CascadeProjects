const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\user\\CascadeProjects';

// Helper: normalize line endings for matching
function normalize(str) {
  return str.replace(/\r\n/g, '\n');
}

// 1. crypto-policy-engine.cjs — 4 edits
const enginePath = path.join(ROOT, 'ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs');
let engine = fs.readFileSync(enginePath, 'utf8');
const engineN = normalize(engine);

// 1a. DEFAULT_POLICY stanza
const old1a = `  pqFisheriesGating: {
    minMaritimeQuorum: 5,
    maxCatchTrackingWindowSeconds: 2592000,
    maxVesselTelemetryChainDepth: 12,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireRfmoAuthorityInitializerAttestation: true,
    requireMarineSanctuaryOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderCatchClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  bftShardSync: {`;

const new1a = `  pqFisheriesGating: {
    minMaritimeQuorum: 5,
    maxCatchTrackingWindowSeconds: 2592000,
    maxVesselTelemetryChainDepth: 12,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireRfmoAuthorityInitializerAttestation: true,
    requireMarineSanctuaryOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderCatchClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSeabedGating: {
    minSovereignQuorum: 6,
    maxLeaseWindowSeconds: 31536000,
    maxExtractionChainDepth: 15,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireIsaAuthorityInitializerAttestation: true,
    requireSeabedOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderExtractionClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  bftShardSync: {`;

if (engineN.includes(old1a)) {
  engine = engineN.replace(old1a, new1a);
  console.log('1a. DEFAULT_POLICY stanza: applied');
} else {
  console.log('1a. DEFAULT_POLICY stanza: PATTERN NOT FOUND');
}

// 1b. Tenant merge
const old1b = `    pqFisheriesGating: {
      ...DEFAULT_POLICY.pqFisheriesGating,
      ...(tenantPolicy.pqFisheriesGating || {}),
    },
  };
}`;

const new1b = `    pqFisheriesGating: {
      ...DEFAULT_POLICY.pqFisheriesGating,
      ...(tenantPolicy.pqFisheriesGating || {}),
    },
    pqSeabedGating: {
      ...DEFAULT_POLICY.pqSeabedGating,
      ...(tenantPolicy.pqSeabedGating || {}),
    },
  };
}`;

if (engine.includes(old1b)) {
  engine = engine.replace(old1b, new1b);
  console.log('1b. Tenant merge: applied');
} else {
  console.log('1b. Tenant merge: PATTERN NOT FOUND');
}

// 1c. Validation method
const old1c = `    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateFips(tenantPolicy, config) {`;

const new1c = `    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSeabedGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSeabedGating, ...(tenantPolicy.pqSeabedGating || {}) };
    if (typeof config.sovereignQuorum === 'number' && config.sovereignQuorum < policy.minSovereignQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', \`sovereign quorum \${config.sovereignQuorum} below minimum \${policy.minSovereignQuorum}\`);
    }
    if (typeof config.leaseWindowSeconds === 'number' && config.leaseWindowSeconds > policy.maxLeaseWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', \`lease window seconds \${config.leaseWindowSeconds} exceeds maximum \${policy.maxLeaseWindowSeconds}\`);
    }
    if (typeof config.extractionChainDepth === 'number' && config.extractionChainDepth > policy.maxExtractionChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', \`extraction chain depth \${config.extractionChainDepth} exceeds maximum \${policy.maxExtractionChainDepth}\`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', \`PQC signature scheme \${config.pqcSignatureScheme} is not permitted; allowed: \${policy.allowedPqcSignatureSchemes.join(', ')}\`);
    }
    if (policy.requireIsaAuthorityInitializerAttestation && config.isaAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ISA authority initializer attestation is required');
    }
    if (policy.requireSeabedOversightCommitteeAttestation && config.seabedOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'seabed oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', \`attestation authority \${config.attestationAuthority} is not allowed; permitted: \${policy.allowedAttestationAuthorities.join(', ')}\`);
    }
    if (typeof config.banMalformedOrOutOfOrderExtractionClaims === 'boolean' && policy.banMalformedOrOutOfOrderExtractionClaims && !config.banMalformedOrOutOfOrderExtractionClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order extraction claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateFips(tenantPolicy, config) {`;

if (engine.includes(old1c)) {
  engine = engine.replace(old1c, new1c);
  console.log('1c. Validation method: applied');
} else {
  console.log('1c. Validation method: PATTERN NOT FOUND');
}

// 1d. Operation dispatch
const old1d = `    if (operation === 'pqFisheriesGating') {
      this._validatePqFisheriesGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'time') {`;

const new1d = `    if (operation === 'pqFisheriesGating') {
      this._validatePqFisheriesGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSeabedGating') {
      this._validatePqSeabedGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'time') {`;

if (engine.includes(old1d)) {
  engine = engine.replace(old1d, new1d);
  console.log('1d. Operation dispatch: applied');
} else {
  console.log('1d. Operation dispatch: PATTERN NOT FOUND');
}

fs.writeFileSync(enginePath, engine);
console.log('1. crypto-policy-engine.cjs: saved');

// 2. crypto-policy-schema.json
const schemaPath = path.join(ROOT, 'ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json');
let schema = fs.readFileSync(schemaPath, 'utf8');
const oldSchema = `    "pqFisheriesGating": {
      "minMaritimeQuorum": 5,
      "maxCatchTrackingWindowSeconds": 2592000,
      "maxVesselTelemetryChainDepth": 12,
      "allowedPqcSignatureSchemes": ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      "requireRfmoAuthorityInitializerAttestation": true,
      "requireMarineSanctuaryOversightCommitteeAttestation": true,
      "allowedAttestationAuthorities": ["mock-authority"],
      "banMalformedOrOutOfOrderCatchClaims": true,
      "requireCanonicalPayloadLayout": true
    }
  },
  "tenants": {}
}`;

const newSchema = `    "pqFisheriesGating": {
      "minMaritimeQuorum": 5,
      "maxCatchTrackingWindowSeconds": 2592000,
      "maxVesselTelemetryChainDepth": 12,
      "allowedPqcSignatureSchemes": ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      "requireRfmoAuthorityInitializerAttestation": true,
      "requireMarineSanctuaryOversightCommitteeAttestation": true,
      "allowedAttestationAuthorities": ["mock-authority"],
      "banMalformedOrOutOfOrderCatchClaims": true,
      "requireCanonicalPayloadLayout": true
    },
    "pqSeabedGating": {
      "minSovereignQuorum": 6,
      "maxLeaseWindowSeconds": 31536000,
      "maxExtractionChainDepth": 15,
      "allowedPqcSignatureSchemes": ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      "requireIsaAuthorityInitializerAttestation": true,
      "requireSeabedOversightCommitteeAttestation": true,
      "allowedAttestationAuthorities": ["mock-authority"],
      "banMalformedOrOutOfOrderExtractionClaims": true,
      "requireCanonicalPayloadLayout": true
    }
  },
  "tenants": {}
}`;

if (schema.includes(oldSchema)) {
  schema = schema.replace(oldSchema, newSchema);
  fs.writeFileSync(schemaPath, schema);
  JSON.parse(schema);
  console.log('2. crypto-policy-schema.json: applied');
} else {
  console.log('2. crypto-policy-schema.json: PATTERN NOT FOUND');
}

// 3. base-adapter.cjs
const baseAdapterPath = path.join(ROOT, 'ai-platform/server/lib/hsm-adapter/base-adapter.cjs');
let baseAdapter = fs.readFileSync(baseAdapterPath, 'utf8');
const oldBase = `  emitQuotaAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('QUOTA_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 33 recovery sync telemetry hooks ─────────────────────────`;

const newBase = `  emitQuotaAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('QUOTA_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 95 PQ deep-sea mineral rights gating telemetry hooks ──

  /**
   * Emit a seabed gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitSeabedGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('SEABED_GATING_POOL_INITIALIZED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_seabed_gating_pool_initialized_total'); } catch { }
  }

  /**
   * Emit a ZK extraction claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkExtractionClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_EXTRACTION_CLAIM_VERIFIED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_extraction_claim_verified_total'); } catch { }
  }

  /**
   * Emit a lease accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitLeaseAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('LEASE_ACCREDITATION_COMPLETED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_lease_accreditation_completed_total'); } catch { }
  }

  // ── Track 33 recovery sync telemetry hooks ─────────────────────────`;

if (baseAdapter.includes(oldBase)) {
  baseAdapter = baseAdapter.replace(oldBase, newBase);
  fs.writeFileSync(baseAdapterPath, baseAdapter);
  console.log('3. base-adapter.cjs: applied');
} else {
  console.log('3. base-adapter.cjs: PATTERN NOT FOUND');
}

// 4. hsm-metrics.cjs
const metricsPath = path.join(ROOT, 'ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs');
let metrics = fs.readFileSync(metricsPath, 'utf8');
const oldMetrics = `  hsm_fisheries_gating_pool_initialized_total: 0,
  hsm_zk_catch_claim_verified_total: 0,
  hsm_quota_accreditation_completed_total: 0,
};`;

const newMetrics = `  hsm_fisheries_gating_pool_initialized_total: 0,
  hsm_zk_catch_claim_verified_total: 0,
  hsm_quota_accreditation_completed_total: 0,
  // Track 95: PQC Deep-Sea Mineral Rights Gating counters
  hsm_seabed_gating_pool_initialized_total: 0,
  hsm_zk_extraction_claim_verified_total: 0,
  hsm_lease_accreditation_completed_total: 0,
};`;

if (metrics.includes(oldMetrics)) {
  metrics = metrics.replace(oldMetrics, newMetrics);
  fs.writeFileSync(metricsPath, metrics);
  console.log('4. hsm-metrics.cjs: applied');
} else {
  console.log('4. hsm-metrics.cjs: PATTERN NOT FOUND');
}

// 5. run-all-tracks.cjs
const runnerPath = path.join(ROOT, 'ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs');
let runner = fs.readFileSync(runnerPath, 'utf8');
const oldRunner = `  'pq-ocean-fisheries-allocation-gating',
];`;

const newRunner = `  'pq-ocean-fisheries-allocation-gating',
  'pq-deep-sea-mineral-rights-gating',
];`;

if (runner.includes(oldRunner)) {
  runner = runner.replace(oldRunner, newRunner);
  fs.writeFileSync(runnerPath, runner);
  console.log('5. run-all-tracks.cjs: applied');
} else {
  console.log('5. run-all-tracks.cjs: PATTERN NOT FOUND');
}

console.log('\nAll edits processed.');
