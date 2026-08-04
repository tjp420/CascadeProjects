'use strict';

const crypto = require('crypto');

// Minimal fuzzing utilities for tenant-boundary saturation tests.

// ── Deterministic SHA-256 hash-chain PRNG ────────────────────────────────────
//
// Fixed-seed deterministic PRNG for reproducible fuzzing. Each call to next()
// advances the chain: state = sha256(state). Returns a 256-bit Buffer.
const FUZZ_SEED =
  'tenant-fuzz-v1-0000000000000000000000000000000000000000000000000000000000000001';

function makeHashChainPrng(seed) {
  let state = crypto.createHash('sha256').update(seed || FUZZ_SEED).digest();
  return {
    next() {
      state = crypto.createHash('sha256').update(state).digest();
      return state;
    },
    nextInt(max) {
      const buf = this.next();
      const n = buf.readUInt32BE(0);
      return max === undefined ? n : n % max;
    },
    nextString(length) {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let out = '';
      for (let i = 0; i < length; i++) {
        out += chars[this.nextInt(chars.length)];
      }
      return out;
    },
    nextChoice(arr) {
      return arr[this.nextInt(arr.length)];
    },
  };
}

// ── Prototype pollution payload generators ───────────────────────────────────

exports.makePrototypePollutionPolicy = function () {
  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'malicious-tenant': {
        __proto__: { polluted: true },
        constructor: { prototype: { pollutedViaConstructor: true } },
      },
      'clean-tenant': {
        minimumKekBits: 256,
      },
    },
  };
};

exports.makeNestedProtoPollutionPolicy = function () {
  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'nested-polluter': {
        pqc: {
          __proto__: { nestedPqcPolluted: true },
        },
        zkp: {
          __proto__: { nestedZkpPolluted: true },
        },
        threshold: {
          __proto__: { nestedThresholdPolluted: true },
        },
      },
      'clean-tenant': {
        minimumKekBits: 256,
      },
    },
  };
};

// ── Type confusion payload generators ────────────────────────────────────────

exports.makeTypeConfusionTenantIds = function () {
  return [
    { value: 123, label: 'number' },
    { value: null, label: 'null' },
    { value: undefined, label: 'undefined' },
    { value: [], label: 'array' },
    { value: {}, label: 'object' },
    { value: true, label: 'boolean' },
  ];
};

exports.makeTypeConfusionConfigs = function () {
  return [
    { value: 'string', label: 'string' },
    { value: 42, label: 'number' },
    { value: null, label: 'null' },
    { value: [], label: 'array' },
    { value: true, label: 'boolean' },
  ];
};

exports.makeTypeConfusionOperations = function () {
  return [
    { value: 42, label: 'number' },
    { value: null, label: 'null' },
    { value: undefined, label: 'undefined' },
    { value: [], label: 'array' },
    { value: {}, label: 'object' },
  ];
};

// ── Cross-tenant isolation payload generators ────────────────────────────────

exports.makeCrossTenantIsolationPolicy = function () {
  return {
    version: '0.0.0',
    default: { minimumKekBits: 256 },
    tenants: {
      'tenant-a': {
        minimumKekBits: 128,
        pqc: { kemAlgorithm: 'ml-kem-512', requireNistLevel: 1 },
      },
      'tenant-b': {
        minimumKekBits: 256,
        pqc: { kemAlgorithm: 'ml-kem-1024', requireNistLevel: 3 },
      },
    },
  };
};

exports.makeSharedSubBlockPolicy = function () {
  return {
    version: '0.0.0',
    default: {
      pqc: { kemAlgorithm: 'ml-kem-768', requireNistLevel: 2 },
    },
    tenants: {
      'tenant-a': {
        pqc: { kemAlgorithm: 'ml-kem-512', requireNistLevel: 1 },
      },
      'tenant-b': {
        pqc: { kemAlgorithm: 'ml-kem-1024', requireNistLevel: 3 },
      },
    },
  };
};

// ── PRNG-driven random policy/config generators ──────────────────────────────

const RANDOM_OPERATIONS = [
  'createKEK', 'threshold', 'ratchet', 'escrow', 'blind', 'pir',
  'homomorphic', 'pqc', 'zkp', 'governance', 'identity', 'recoverySync',
  'consensus', 'enclave', 'secretSealing', 'resharding', 'disasterRecovery',
  'confidentialIssuance', 'crossTenantAudit', 'dkg', 'time',
  'nonexistentOp', 'pqMultiEnclaveConfidentialMeshStateReconciliationGating',
];

const RANDOM_ALGORITHMS = ['aes-kw', 'rsa-oaep', 'ecdh', 'ml-kem-512', 'unknown-alg'];

exports.makePrngDrivenTenantBlob = function (prng) {
  const tenantCount = prng.nextInt(5) + 1;
  const tenants = {};
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = 'tenant-' + prng.nextString(8);
    const hasProto = prng.nextInt(10) === 0;
    const blob = {
      minimumKekBits: prng.nextChoice([128, 192, 256, 384, 512]),
    };
    if (hasProto) {
      blob.__proto__ = { prngPolluted: true };
    }
    const hasConstructor = prng.nextInt(10) === 0;
    if (hasConstructor) {
      blob.constructor = { prototype: { prngConstructorPolluted: true } };
    }
    tenants[tenantId] = blob;
  }
  return {
    version: '0.0.0',
    default: {},
    tenants,
  };
};

exports.makePrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    'tenant-' + prng.nextString(6),
    prng.nextInt(999).toString(),
    '',
    null,
    undefined,
    42,
    [],
  ]);
  const operation = prng.nextChoice(RANDOM_OPERATIONS);
  const configType = prng.nextInt(4);
  let config;
  switch (configType) {
    case 0:
      config = {
        algorithm: prng.nextChoice(RANDOM_ALGORITHMS),
        kekBits: prng.nextChoice([64, 128, 192, 256, 512]),
      };
      break;
    case 1:
      config = null;
      break;
    case 2:
      config = 'not-an-object';
      break;
    case 3:
      config = [];
      break;
    default:
      config = {};
  }
  return { tenantId, operation, config };
};

// ── Cleanup utilities ────────────────────────────────────────────────────────

exports.cleanupPrototypePollution = function () {
  const keys = [
    'polluted',
    'pollutedViaConstructor',
    'nestedPqcPolluted',
    'nestedZkpPolluted',
    'nestedThresholdPolluted',
    'prngPolluted',
    'prngConstructorPolluted',
  ];
  for (const key of keys) {
    delete Object.prototype[key];
  }
};

// ── Exports ──────────────────────────────────────────────────────────────────

exports.makeHashChainPrng = makeHashChainPrng;
exports.FUZZ_SEED = FUZZ_SEED;
