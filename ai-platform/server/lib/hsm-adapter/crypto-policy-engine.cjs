'use strict';

/**
 * Track 14: Dynamic cryptographic policy engine.
 *
 * Provides runtime validation of HSM operations against per-tenant JSON
 * policies. Supports hot-reloading, default-deny fallbacks, deprecation
 * warnings, and algorithm/KEK-size constraints.
 *
 * @module hsm-adapter/crypto-policy-engine
 */

const fs = require('fs');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_POLICY = {
  version: '1.1.0',
  default: true,
  minimumKekBits: 128,
  keyExpirationDays: 0,
  allowEphemeralSecrets: false,
  allowedAlgorithms: {
    aes: { kw: true, kwp: true, bits: [128, 192, 256] },
    rsa: { oaep: true, minBits: 2048 },
    ecdh: { curves: ['P-256', 'P-384', 'P-521'] },
  },
  deprecatedAlgorithms: [],
  eviction: {
    inactivityEvictionSeconds: 0,
    zeroizeStrategy: 'random',
    auditOnEvict: true,
  },
  threshold: {
    minThreshold: 2,
    maxTotal: 7,
  },
  ratchet: {
    maxSkipped: 1000,
    sessionExpiryMs: 86400000,
    allowDhRatchet: true,
  },
  homomorphic: {
    maxModulusBits: 2048,
    tokenExpiryMs: 300000,
    allowBlinding: true,
  },
  pqc: {
    minKemLevel: 512,
    maxKemLevel: 1024,
    hybridMode: true,
    allowedCurves: ['P-256', 'P-384', 'P-521'],
  },
  zkp: {
    tokenExpiryMs: 300000,
    maxProofs: 100,
    allowedPrimes: [],
  },
  time: {
    maxDriftMs: 60000,
    minQuorum: 3,
    requireEpochChain: true,
  },
  fips: {
    enabled: false,
    level: 3,
    allowedCurves: ['P-256', 'P-384'],
    allowedKemLevels: [768, 1024],
    graceTokenExpiryMs: 0,
    allowBlinding: false,
  },
  escrow: {
    requireDualConsent: true,
    minAuthorizationQuorum: 2,
    maxEscrowLifetimeMs: 86400000,
    declassificationTokenExpiryMs: 300000,
    allowedEscrowAlgorithms: ['aes-kw', 'rsa-oaep'],
  },
  privacy: {
    blindSignature: {
      publicExponent: 65537,
      allowedPublicExponents: [65537],
      minModulusBits: 2048,
      allowedHashFunctions: ['sha256'],
      requireFullDomainHash: true,
    },
    pir: {
      maxRows: 10000,
      maxDimensions: 2,
      maxQuerySizeBytes: 1048576,
      allowedHomomorphicSchemes: ['paillier', 'bfv'],
    },
  },
};

function _isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _mergeWithDefault(tenantPolicy) {
  // Shallow merge: tenant explicitly provided values win; missing values
  // fall back to the built-in default for a deny-by-default posture.
  // NOTE: ...tenantPolicy is spread FIRST so the explicit nested-merge
  // keys below always win. Spreading it last (a prior bug) clobbered the
  // deep-merged zkp/threshold/ratchet/etc. blocks with whatever the
  // tenant provided (often {} or undefined), causing defaults to vanish.
  return {
    ...DEFAULT_POLICY,
    ...tenantPolicy,
    allowedAlgorithms: {
      aes: { ...DEFAULT_POLICY.allowedAlgorithms.aes, ...(tenantPolicy.allowedAlgorithms && tenantPolicy.allowedAlgorithms.aes) },
      rsa: { ...DEFAULT_POLICY.allowedAlgorithms.rsa, ...(tenantPolicy.allowedAlgorithms && tenantPolicy.allowedAlgorithms.rsa) },
      ecdh: { ...DEFAULT_POLICY.allowedAlgorithms.ecdh, ...(tenantPolicy.allowedAlgorithms && tenantPolicy.allowedAlgorithms.ecdh) },
    },
    deprecatedAlgorithms: tenantPolicy.deprecatedAlgorithms || DEFAULT_POLICY.deprecatedAlgorithms,
    eviction: {
      ...DEFAULT_POLICY.eviction,
      ...(tenantPolicy.eviction || {}),
    },
    threshold: {
      ...DEFAULT_POLICY.threshold,
      ...(tenantPolicy.threshold || {}),
    },
    ratchet: {
      ...DEFAULT_POLICY.ratchet,
      ...(tenantPolicy.ratchet || {}),
    },
    homomorphic: {
      ...DEFAULT_POLICY.homomorphic,
      ...(tenantPolicy.homomorphic || {}),
    },
    pqc: {
      ...DEFAULT_POLICY.pqc,
      ...(tenantPolicy.pqc || {}),
    },
    zkp: {
      ...DEFAULT_POLICY.zkp,
      ...(tenantPolicy.zkp || {}),
    },
    time: {
      ...DEFAULT_POLICY.time,
      ...(tenantPolicy.time || {}),
    },
    fips: {
      ...DEFAULT_POLICY.fips,
      ...(tenantPolicy.fips || {}),
    },
    escrow: {
      ...DEFAULT_POLICY.escrow,
      ...(tenantPolicy.escrow || {}),
    },
    privacy: {
      ...DEFAULT_POLICY.privacy,
      blindSignature: {
        ...DEFAULT_POLICY.privacy.blindSignature,
        ...(tenantPolicy.privacy && tenantPolicy.privacy.blindSignature) || {},
      },
      pir: {
        ...DEFAULT_POLICY.privacy.pir,
        ...(tenantPolicy.privacy && tenantPolicy.privacy.pir) || {},
      },
    },
  };
}

class CryptoPolicyEngine {
  /**
   * @param {object} [policy] - full policy document with `default` and `tenants`
   * @param {object} [options]
   * @param {string} [options.path] - optional path for hot-reload
   * @param {boolean} [options.strict=true] - hard-block on policy violation
   */
  constructor(policy = DEFAULT_POLICY, options = {}) {
    this._path = options.path || null;
    this._strict = options.strict !== false;
    this._policy = this._parsePolicy(policy);
  }

  /**
   * Load a policy from a JSON file on disk.
   * @param {string} filePath
   * @param {object} [options]
   * @returns {CryptoPolicyEngine}
   */
  static load(filePath, options = {}) {
    if (!filePath) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', 'Policy file path is required');
    }
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', `Cannot read policy file: ${err.message}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', `Invalid JSON policy: ${err.message}`);
    }
    return new CryptoPolicyEngine(parsed, { ...options, path: filePath });
  }

  /**
   * Hot-reload the policy from the configured file path.
   * @returns {void}
   */
  reload() {
    if (!this._path) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', 'No policy file path configured for reload');
    }
    this._policy = this._parsePolicy(CryptoPolicyEngine.load(this._path)._policy);
  }

  _parsePolicy(policy) {
    if (!_isObject(policy)) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', 'Policy must be an object');
    }
    return {
      version: policy.version || '0.0.0',
      default: _mergeWithDefault(policy.default || {}),
      tenants: policy.tenants && _isObject(policy.tenants)
        ? Object.fromEntries(Object.entries(policy.tenants).map(([k, v]) => [k, _mergeWithDefault(v)]))
        : {},
    };
  }

  _getTenantPolicy(tenantId) {
    return this._policy.tenants[tenantId] || this._policy.default;
  }

  /**
   * Public accessor for the resolved tenant policy.
   * @param {string} tenantId
   * @returns {object}
   */
  getPolicy(tenantId) {
    return this._getTenantPolicy(tenantId);
  }

  _validateBits(tenantPolicy, kekBits, label = 'kekBits') {
    if (typeof kekBits !== 'number') return;
    const min = tenantPolicy.minimumKekBits;
    if (kekBits < min) {
      throw new HsmAdapterError(
        'POLICY_VIOLATION_BLOCKED',
        `${label} ${kekBits} is below the tenant minimum of ${min}`
      );
    }
  }

  _validateAlgorithm(tenantPolicy, algorithm, keySize) {
    const allowed = tenantPolicy.allowedAlgorithms;
    if (!algorithm) return;

    if (algorithm === 'aes-kw' || algorithm === 'aes-kwp') {
      if (!allowed || !allowed.aes) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `AES is not allowed by tenant policy`);
      }
      const mode = algorithm === 'aes-kwp' ? 'kwp' : 'kw';
      if (!allowed.aes[mode]) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `${algorithm} is not allowed by tenant policy`);
      }
      if (typeof keySize === 'number' && allowed.aes.bits && !allowed.aes.bits.includes(keySize)) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `AES ${keySize}-bit not allowed; permitted: ${allowed.aes.bits.join(', ')}`
        );
      }
      return;
    }

    if (algorithm === 'rsa-oaep') {
      if (!allowed || !allowed.rsa || !allowed.rsa.oaep) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'RSA-OAEP is not allowed by tenant policy');
      }
      if (typeof keySize === 'number' && allowed.rsa.minBits && keySize < allowed.rsa.minBits) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `RSA-OAEP keySize ${keySize} is below tenant minimum ${allowed.rsa.minBits}`
        );
      }
      return;
    }

    if (algorithm === 'ecdh') {
      if (!allowed || !allowed.ecdh) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ECDH is not allowed by tenant policy');
      }
      const curve = typeof keySize === 'number' ? `P-${keySize}` : keySize;
      if (typeof curve === 'string' && allowed.ecdh.curves && !allowed.ecdh.curves.includes(curve)) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `ECDH curve ${curve} is not allowed; permitted: ${allowed.ecdh.curves.join(', ')}`
        );
      }
      return;
    }

    throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `Algorithm ${algorithm} is not recognized by policy`);
  }

  _validatePqc(tenantPolicy, config) {
    const policy = tenantPolicy.pqc || DEFAULT_POLICY.pqc;
    const kemLevel = config.kemLevel;
    if (typeof kemLevel === 'number') {
      if (kemLevel < policy.minKemLevel || kemLevel > policy.maxKemLevel) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `kemLevel ${kemLevel} is outside allowed [${policy.minKemLevel}, ${policy.maxKemLevel}]`);
      }
      const validLevels = [512, 768, 1024];
      if (!validLevels.includes(kemLevel)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `kemLevel ${kemLevel} is not a supported PQC level`);
      }
    }
    if (config.hybridMode === true && !policy.hybridMode) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'hybrid PQC mode is not allowed by policy');
    }
  }

  _validateZkp(tenantPolicy, config) {
    const policy = tenantPolicy.zkp || DEFAULT_POLICY.zkp;
    if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.tokenExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `tokenExpiryMs ${config.tokenExpiryMs} exceeds policy ${policy.tokenExpiryMs}`);
    }
    if (typeof config.maxProofs === 'number' && config.maxProofs > policy.maxProofs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxProofs ${config.maxProofs} exceeds policy ${policy.maxProofs}`);
    }
    if (typeof config.primeHex === 'string' && policy.allowedPrimes.length > 0 && !policy.allowedPrimes.includes(config.primeHex)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'prime is not in allowedPrimes list');
    }
  }

  _validateTime(tenantPolicy, config) {
    const policy = tenantPolicy.time || DEFAULT_POLICY.time;
    if (typeof config.maxDriftMs === 'number' && config.maxDriftMs > policy.maxDriftMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxDriftMs ${config.maxDriftMs} exceeds policy ${policy.maxDriftMs}`);
    }
    if (typeof config.minQuorum === 'number' && config.minQuorum < policy.minQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `minQuorum ${config.minQuorum} below policy ${policy.minQuorum}`);
    }
  }

  _validateEscrow(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.escrow, ...(tenantPolicy.escrow || {}) };
    if (config.sourceTenantId === config.destTenantId) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'source and destination tenant must be different');
    }
    if (typeof config.consentCount === 'number' && config.consentCount < policy.minAuthorizationQuorum) {
      throw new HsmAdapterError('ESCROW_CONSENT_MISSING', `only ${config.consentCount} consent signatures, require ${policy.minAuthorizationQuorum}`);
    }
    if (policy.requireDualConsent && typeof config.consentCount === 'number' && config.consentCount < 2) {
      throw new HsmAdapterError('ESCROW_CONSENT_MISSING', 'dual consent is required');
    }
    if (typeof config.escrowLifetimeMs === 'number' && config.escrowLifetimeMs > policy.maxEscrowLifetimeMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `escrow lifetime ${config.escrowLifetimeMs}ms exceeds policy ${policy.maxEscrowLifetimeMs}ms`);
    }
    if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.declassificationTokenExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `token expiry ${config.tokenExpiryMs}ms exceeds policy ${policy.declassificationTokenExpiryMs}ms`);
    }
    if (typeof config.algorithm === 'string' && policy.allowedEscrowAlgorithms.length > 0 && !policy.allowedEscrowAlgorithms.includes(config.algorithm)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `escrow algorithm ${config.algorithm} is not allowed`);
    }
  }

  _validateBlind(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.privacy.blindSignature, ...(tenantPolicy.privacy && tenantPolicy.privacy.blindSignature) || {} };
    if (typeof config.publicExponent === 'number' && policy.allowedPublicExponents.length > 0 && !policy.allowedPublicExponents.includes(config.publicExponent)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `public exponent ${config.publicExponent} is not allowed for blind signatures`);
    }
    if (typeof config.modulusBits === 'number' && config.modulusBits < policy.minModulusBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `modulus bits ${config.modulusBits} below policy minimum ${policy.minModulusBits}`);
    }
    if (typeof config.hashFunction === 'string' && policy.allowedHashFunctions.length > 0 && !policy.allowedHashFunctions.includes(config.hashFunction)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `hash function ${config.hashFunction} is not allowed for blind signatures`);
    }
  }

  _validatePir(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.privacy.pir, ...(tenantPolicy.privacy && tenantPolicy.privacy.pir) || {} };
    if (typeof config.rows === 'number' && config.rows > policy.maxRows) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir rows ${config.rows} exceed policy ${policy.maxRows}`);
    }
    if (typeof config.columns === 'number' && config.columns > policy.maxDimensions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir dimensions ${config.columns} exceed policy ${policy.maxDimensions}`);
    }
    if (typeof config.querySizeBytes === 'number' && config.querySizeBytes > policy.maxQuerySizeBytes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir query size ${config.querySizeBytes} bytes exceeds policy ${policy.maxQuerySizeBytes} bytes`);
    }
    if (typeof config.scheme === 'string' && policy.allowedHomomorphicSchemes.length > 0 && !policy.allowedHomomorphicSchemes.includes(config.scheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir homomorphic scheme ${config.scheme} is not allowed`);
    }
  }

  _validateHomomorphic(tenantPolicy, config) {
    const policy = tenantPolicy.homomorphic || DEFAULT_POLICY.homomorphic;
    if (typeof config.maxModulusBits === 'number' && config.maxModulusBits > policy.maxModulusBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxModulusBits ${config.maxModulusBits} exceeds policy ${policy.maxModulusBits}`);
    }
    if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.tokenExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `tokenExpiryMs ${config.tokenExpiryMs} exceeds policy ${policy.tokenExpiryMs}`);
    }
    if (typeof config.allowBlinding === 'boolean' && config.allowBlinding && !policy.allowBlinding) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'blinding is not allowed by policy');
    }
  }

  _validateRatchet(tenantPolicy, config) {
    const policy = tenantPolicy.ratchet || DEFAULT_POLICY.ratchet;
    if (typeof config.maxSkipped === 'number' && config.maxSkipped > policy.maxSkipped) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxSkipped ${config.maxSkipped} exceeds policy ${policy.maxSkipped}`);
    }
    if (typeof config.sessionExpiryMs === 'number' && config.sessionExpiryMs > policy.sessionExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sessionExpiryMs ${config.sessionExpiryMs} exceeds policy ${policy.sessionExpiryMs}`);
    }
    if (typeof config.allowDhRatchet === 'boolean' && config.allowDhRatchet && !policy.allowDhRatchet) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'DH ratchet is not allowed by policy');
    }
  }

  _validateFips(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.fips, ...(tenantPolicy.fips || {}) };
    if (!policy.enabled) return;

    if (config.algorithm === 'ecdh') {
      const curve = typeof config.keySize === 'number' ? `P-${config.keySize}` : config.keySize;
      if (typeof curve === 'string' && !policy.allowedCurves.includes(curve)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: ECDH curve ${curve} is not approved; permitted: ${policy.allowedCurves.join(', ')}`);
      }
    }

    if (config.algorithm === 'pqc' || config.algorithm === 'hybrid-kem') {
      const kemLevel = config.kemLevel;
      if (typeof kemLevel === 'number' && !policy.allowedKemLevels.includes(kemLevel)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: KEM level ${kemLevel} is not approved; permitted: ${policy.allowedKemLevels.join(', ')}`);
      }
    }

    if (config.algorithm === 'homomorphic' || config.algorithm === 'blinding') {
      if (config.allowBlinding && !policy.allowBlinding) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'FIPS mode: homomorphic blinding is not approved');
      }
      if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.graceTokenExpiryMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: token expiry grace window ${config.tokenExpiryMs}ms exceeds approved ${policy.graceTokenExpiryMs}ms`);
      }
    }

    if (config.algorithm === 'zkp') {
      if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.graceTokenExpiryMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: ZKP token grace window ${config.tokenExpiryMs}ms exceeds approved ${policy.graceTokenExpiryMs}ms`);
      }
    }
  }

  _validateThreshold(tenantPolicy, threshold, total) {
    const policy = tenantPolicy.threshold || DEFAULT_POLICY.threshold;
    if (typeof threshold !== 'number' || typeof total !== 'number') {
      throw new HsmAdapterError('INVALID_THRESHOLD', 'threshold and total must be numbers');
    }
    if (threshold < 1 || total < 1 || threshold > total) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `threshold (${threshold}) must satisfy 1 ╬ô├½├▒ threshold ╬ô├½├▒ total (${total})`);
    }
    if (threshold < policy.minThreshold) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `threshold ${threshold} is below policy minimum ${policy.minThreshold}`);
    }
    if (total > policy.maxTotal) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `total ${total} exceeds policy maximum ${policy.maxTotal}`);
    }
  }

  _checkDeprecation(tenantPolicy, algorithm, createdAt) {
    const deprecated = (tenantPolicy.deprecatedAlgorithms || []).find(
      (d) => d.algorithm === algorithm
    );
    if (deprecated) {
      throw new HsmAdapterError(
        'POLICY_DEPRECATED_WARNING',
        `Algorithm ${algorithm} is deprecated: ${deprecated.reason || 'no reason provided'}`
      );
    }

    const expiryDays = tenantPolicy.keyExpirationDays;
    if (createdAt && expiryDays > 0) {
      const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (ageDays > expiryDays) {
        throw new HsmAdapterError(
          'POLICY_DEPRECATED_WARNING',
          `Key has exceeded policy lifetime (${ageDays.toFixed(1)} days > ${expiryDays} days)`
        );
      }
    }
  }

  /**
   * Validate an operation for a tenant against the active policy.
   * @param {string} tenantId
   * @param {string} operation - 'createKEK', 'wrap', 'unwrap', 'rotateKEK', 'threshold'
   * @param {object} config - { algorithm, keySize, kekBits, createdAt, threshold, total }
   * @returns {boolean}
   */
  validate(tenantId, operation, config = {}) {
    if (!this._strict) return true;
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new HsmAdapterError('UNAUTHORIZED_KEY_ACCESS', 'tenantId must be a non-empty string');
    }

    const tenantPolicy = this._getTenantPolicy(tenantId);

    this._validateFips(tenantPolicy, config);

    if (operation === 'threshold') {
      this._validateThreshold(tenantPolicy, config.threshold, config.total);
      return true;
    }

    if (operation === 'ratchet') {
      this._validateRatchet(tenantPolicy, config);
      return true;
    }

    if (operation === 'homomorphic') {
      this._validateHomomorphic(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqc') {
      this._validatePqc(tenantPolicy, config);
      return true;
    }

    if (operation === 'zkp') {
      this._validateZkp(tenantPolicy, config);
      return true;
    }

    if (operation === 'time') {
      this._validateTime(tenantPolicy, config);
      return true;
    }

    if (operation === 'escrow') {
      this._validateEscrow(tenantPolicy, config);
      return true;
    }

    if (operation === 'blind') {
      this._validateBlind(tenantPolicy, config);
      return true;
    }

    if (operation === 'pir') {
      this._validatePir(tenantPolicy, config);
      return true;
    }

    if (typeof config.kekBits === 'number') {
      this._validateBits(tenantPolicy, config.kekBits, 'kekBits');
    }

    this._validateAlgorithm(tenantPolicy, config.algorithm, config.keySize || config.kekBits);
    this._checkDeprecation(tenantPolicy, config.algorithm, config.createdAt);

    return true;
  }
}

module.exports = {
  CryptoPolicyEngine,
  DEFAULT_POLICY,
};
