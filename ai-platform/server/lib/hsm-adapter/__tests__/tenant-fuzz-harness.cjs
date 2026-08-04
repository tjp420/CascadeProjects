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
    'lookupGatePolluted',
    'lookupConstructorPolluted',
    'handshakePolluted',
    'handshakeConstructorPolluted',
    'ringGatePolluted',
    'ringConstructorPolluted',
    'ringProtoLevel0',
    'ringProtoLevel1',
    'ringProtoLevel2',
    'ringProtoLevel3',
    'ringProtoLevel4',
    'ringCtorLevel0',
    'ringCtorLevel1',
    'ringCtorLevel2',
    'ringCtorLevel3',
    'ringCtorLevel4',
    'ringDeepMinRingSize',
    'ringDeepMaxRingSize',
  ];
  for (const key of keys) {
    delete Object.prototype[key];
  }
};

// ── Track 31: Homomorphic Database Lookup Gating Hub mutators ────────────────

exports.makeTrack31ProtoPollutionPolicy = function () {
  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'track31-polluter': {
        lookupGating: {
          __proto__: { lookupGatePolluted: true },
          minLookupQuorum: 12,
          maxLookupDepth: 32,
          requireEncryptedQueryAttestation: true,
        },
        constructor: {
          prototype: { lookupConstructorPolluted: true },
        },
      },
      'track31-clean': {
        lookupGating: {
          minLookupQuorum: 12,
          maxLookupDepth: 32,
          requireEncryptedQueryAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack31TypeConfusionConfigs = function () {
  return [
    { value: { lookupQuorum: '12', lookupDepth: '32' }, label: 'string-numbers' },
    { value: { lookupQuorum: [], lookupDepth: {} }, label: 'array-object-values' },
    { value: { lookupQuorum: null, lookupDepth: undefined }, label: 'null-undefined-values' },
    { value: { encryptedQueryAttestation: 'true' }, label: 'string-boolean' },
    { value: { blindingType: 42 }, label: 'number-string' },
    { value: { queryAgeSeconds: true }, label: 'boolean-number' },
  ];
};

exports.makeTrack31PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice(['t1', 'track31-polluter', 'track31-clean']);
  const lookupQuorum = prng.nextChoice([1, 5, 11, 12, 13, 100]);
  const lookupDepth = prng.nextChoice([1, 16, 32, 33, 1000]);
  const attestation = prng.nextChoice([true, false, 'true', 1, 0]);
  const auth = prng.nextChoice(['mock-authority', 'untrusted-authority', null, 123]);
  const blinding = prng.nextChoice(['pedersen', 'exponential-elgamal', 'unsupported', 42, null]);
  const canonical = prng.nextChoice([true, false, 'yes', 1, 0]);
  return {
    tenantId,
    operation: 'lookupGating',
    config: {
      lookupQuorum,
      lookupDepth,
      encryptedQueryAttestation: attestation,
      attestationAuthority: auth,
      blindingType: blinding,
      queryAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, 'old']),
      canonicalPayloadLayout: canonical,
    },
  };
};

// ── Track 113: PQC Handshake Endpoint Integration mutators ─────────────────────

exports.makeTrack113ProtoPollutionPolicy = function () {
  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'track113-polluter': {
        handshake: {
          __proto__: { handshakePolluted: true },
          lifecycleTimeout: 3600000,
          requirePqKem: true,
          requireHybridSignature: true,
        },
        constructor: {
          prototype: { handshakeConstructorPolluted: true },
        },
      },
      'track113-clean': {
        handshake: {
          lifecycleTimeout: 3600000,
          requirePqKem: true,
          requireHybridSignature: true,
        },
      },
    },
  };
};

exports.makeTrack113TypeConfusionConfigs = function () {
  return [
    { value: { lifecycleTimeout: '3600000', requirePqKem: 'true' }, label: 'string-numbers' },
    { value: { lifecycleTimeout: [], requirePqKem: {} }, label: 'array-object-values' },
    { value: { lifecycleTimeout: null, requirePqKem: undefined }, label: 'null-undefined-values' },
    { value: { requireHybridSignature: 'true' }, label: 'string-boolean' },
    { value: { clientId: 123 }, label: 'number-string' },
    { value: { handshakeDigest: true }, label: 'boolean-buffer' },
  ];
};

exports.makeTrack113PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice(['t1', 'track113-polluter', 'track113-clean']);
  const lifecycleTimeout = prng.nextChoice([1, 60, 3600, 3600000, -1, 'forever']);
  const requirePqKem = prng.nextChoice([true, false, 'true', 1, 0]);
  const requireHybridSignature = prng.nextChoice([true, false, 'yes', 1, 0]);
  const clientId = prng.nextChoice(['client-a', 'client-b', null, 123, []]);
  const handshakeDigest = prng.nextChoice(['digest-001', 'digest-002', null, 456, []]);
  const operation = prng.nextChoice(['handshakeInit', 'handshakeVerify', 'nonexistentOp']);
  return {
    tenantId,
    operation,
    config: {
      clientId,
      handshakeDigest,
      lifecycleTimeout,
      requirePqKem,
      requireHybridSignature,
      clientProof: prng.nextChoice(['proof-001', '', null, 42, []]),
      expectedStateDigest: prng.nextChoice(['state-001', '', null, {}]),
    },
  };
};

// ── Exports ──────────────────────────────────────────────────────────────────

// ── Track 32: PQC Blinded Ring-Signature Gating Hub mutators ──────────────────

exports.makeTrack32ProtoPollutionPolicy = function () {
  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'track32-polluter': {
        ringGating: {
          __proto__: { ringGatePolluted: true },
          minRingSize: 16,
          maxRingSize: 128,
          requireBlindedLinkabilityAttestation: true,
        },
        constructor: {
          prototype: { ringConstructorPolluted: true },
        },
      },
      'track32-clean': {
        ringGating: {
          minRingSize: 16,
          maxRingSize: 128,
          requireBlindedLinkabilityAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack32TypeConfusionConfigs = function () {
  return [
    { value: { ringSize: '16', blindedLinkabilityAttestation: 'true' }, label: 'string-numbers' },
    { value: { ringSize: [], blindedLinkabilityAttestation: {} }, label: 'array-object-values' },
    { value: { ringSize: null, blindedLinkabilityAttestation: undefined }, label: 'null-undefined-values' },
    { value: { blindedLinkabilityAttestation: 'true' }, label: 'string-boolean' },
    { value: { blindingType: 42 }, label: 'number-string' },
    { value: { signatureAgeSeconds: true }, label: 'boolean-number' },
  ];
};

exports.makeTrack32PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice(['t1', 'track32-polluter', 'track32-clean']);
  const ringSize = prng.nextChoice([1, 8, 15, 16, 32, 64, 128, 129, 200, 0]);
  const blindedLinkabilityAttestation = prng.nextChoice([true, false, 'true', 1, 0]);
  const auth = prng.nextChoice(['mock-authority', 'untrusted-authority', null, 123]);
  const blinding = prng.nextChoice(['pedersen', 'borromean', 'unsupported', 42, null]);
  const canonical = prng.nextChoice([true, false, 'yes', 1, 0]);
  return {
    tenantId,
    operation: 'ringGating',
    config: {
      ringSize,
      blindedLinkabilityAttestation,
      attestationAuthority: auth,
      blindingType: blinding,
      signatureAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, 'old']),
      canonicalPayloadLayout: canonical,
    },
  };
};

// ── Track 32: Deep nested multi-layer policy mutation (5-level) ───────────────

function attachDeepPollution(node, depth, prng) {
  const protoMarker = `ringProtoLevel${depth}`;
  const ctorMarker = `ringCtorLevel${depth}`;
  // Using setPrototypeOf to make the pollution attempt explicit
  Object.setPrototypeOf(node, { [protoMarker]: true });
  // constructor.prototype pollution stored as an own property to be safe
  node.constructor = { prototype: { [ctorMarker]: true } };
  // Attempt to shadow the actual ring keys at this depth via prototype
  const proto = Object.getPrototypeOf(node);
  proto.ringDeepMinRingSize = prng ? prng.nextChoice([1, 0, -1, 9999]) : 1;
  proto.ringDeepMaxRingSize = prng ? prng.nextChoice([1, 0, 10000, 256]) : 9999;
  return node;
}

exports.makeTrack32DeepNestedPollutionPolicy = function () {
  const pollutedRing = { ringGating: {} };
  let current = pollutedRing.ringGating;
  for (let i = 0; i < 5; i++) {
    attachDeepPollution(current, i);
    if (i < 4) {
      current.ringGating = {};
      current = current.ringGating;
    }
  }
  // Leaf owns the actual keys to verify the top-level merge still resolves correctly
  current.minRingSize = 1;
  current.maxRingSize = 9999;
  current.requireBlindedLinkabilityAttestation = 'false';

  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'track32-deep-polluter': pollutedRing,
      'track32-clean': {
        ringGating: {
          minRingSize: 16,
          maxRingSize: 128,
          requireBlindedLinkabilityAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack32PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const RING_KEYS = ['ringGating', 'pqc', 'zkp', 'threshold', 'governance'];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = 'track32-tenant-' + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = RING_KEYS[prng.nextInt(RING_KEYS.length)];
      const block = {};
      attachDeepPollution(block, l % 5, prng);
      // Occasionally own the actual ringGating keys to verify merge fallbacks
      if (key === 'ringGating' && prng.nextInt(3) === 0) {
        block.minRingSize = prng.nextChoice([1, 8, 16, 32, 64, 128, 256]);
        block.maxRingSize = prng.nextChoice([1, 8, 16, 32, 64, 128, 256]);
        block.requireBlindedLinkabilityAttestation = prng.nextChoice([true, false, 'true', 1, 0]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: '0.0.0', default: {}, tenants };
};

exports.makeTrack32ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    'track32-clean',
    'track32-deep-polluter',
    'track32-tenant-' + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: 'ringGating',
    config: {
      ringSize: prng.nextChoice([1, 8, 15, 16, 32, 64, 128, 129, 256, 0, -1]),
      blindedLinkabilityAttestation: prng.nextChoice([true, false, 'true', 1, 0]),
      blindingType: prng.nextChoice(['pedersen', 'borromean', 'unsupported', 42, null]),
      signatureAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, 'old']),
    },
  };
};

exports.makeHashChainPrng = makeHashChainPrng;
exports.FUZZ_SEED = FUZZ_SEED;
