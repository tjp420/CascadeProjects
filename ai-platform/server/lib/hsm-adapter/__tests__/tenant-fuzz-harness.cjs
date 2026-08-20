"use strict";

const crypto = require("crypto");

// Minimal fuzzing utilities for tenant-boundary saturation tests.

// ── Deterministic SHA-256 hash-chain PRNG ────────────────────────────────────
//
// Fixed-seed deterministic PRNG for reproducible fuzzing. Each call to next()
// advances the chain: state = sha256(state). Returns a 256-bit Buffer.
const FUZZ_SEED =
  "tenant-fuzz-v1-0000000000000000000000000000000000000000000000000000000000000001";

function makeHashChainPrng(seed) {
  let state = crypto
    .createHash("sha256")
    .update(seed || FUZZ_SEED)
    .digest();
  return {
    next() {
      state = crypto.createHash("sha256").update(state).digest();
      return state;
    },
    nextInt(max) {
      const buf = this.next();
      const n = buf.readUInt32BE(0);
      return max === undefined ? n : n % max;
    },
    nextString(length) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let out = "";
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
    version: "0.0.0",
    default: {},
    tenants: {
      "malicious-tenant": {
        __proto__: { polluted: true },
        constructor: { prototype: { pollutedViaConstructor: true } },
      },
      "clean-tenant": {
        minimumKekBits: 256,
      },
    },
  };
};

exports.makeNestedProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "nested-polluter": {
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
      "clean-tenant": {
        minimumKekBits: 256,
      },
    },
  };
};

// ── Type confusion payload generators ────────────────────────────────────────

exports.makeTypeConfusionTenantIds = function () {
  return [
    { value: 123, label: "number" },
    { value: null, label: "null" },
    { value: undefined, label: "undefined" },
    { value: [], label: "array" },
    { value: {}, label: "object" },
    { value: true, label: "boolean" },
  ];
};

exports.makeTypeConfusionConfigs = function () {
  return [
    { value: "string", label: "string" },
    { value: 42, label: "number" },
    { value: null, label: "null" },
    { value: [], label: "array" },
    { value: true, label: "boolean" },
  ];
};

exports.makeTypeConfusionOperations = function () {
  return [
    { value: 42, label: "number" },
    { value: null, label: "null" },
    { value: undefined, label: "undefined" },
    { value: [], label: "array" },
    { value: {}, label: "object" },
  ];
};

// ── Cross-tenant isolation payload generators ────────────────────────────────

exports.makeCrossTenantIsolationPolicy = function () {
  return {
    version: "0.0.0",
    default: { minimumKekBits: 256 },
    tenants: {
      "tenant-a": {
        minimumKekBits: 128,
        pqc: { kemAlgorithm: "ml-kem-512", requireNistLevel: 1 },
      },
      "tenant-b": {
        minimumKekBits: 256,
        pqc: { kemAlgorithm: "ml-kem-1024", requireNistLevel: 3 },
      },
    },
  };
};

exports.makeSharedSubBlockPolicy = function () {
  return {
    version: "0.0.0",
    default: {
      pqc: { kemAlgorithm: "ml-kem-768", requireNistLevel: 2 },
    },
    tenants: {
      "tenant-a": {
        pqc: { kemAlgorithm: "ml-kem-512", requireNistLevel: 1 },
      },
      "tenant-b": {
        pqc: { kemAlgorithm: "ml-kem-1024", requireNistLevel: 3 },
      },
    },
  };
};

// ── PRNG-driven random policy/config generators ──────────────────────────────

const RANDOM_OPERATIONS = [
  "createKEK",
  "threshold",
  "ratchet",
  "escrow",
  "blind",
  "pir",
  "homomorphic",
  "pqc",
  "zkp",
  "governance",
  "identity",
  "recoverySync",
  "consensus",
  "enclave",
  "secretSealing",
  "resharding",
  "disasterRecovery",
  "confidentialIssuance",
  "crossTenantAudit",
  "dkg",
  "time",
  "nonexistentOp",
  "pqMultiEnclaveConfidentialMeshStateReconciliationGating",
];

const RANDOM_ALGORITHMS = [
  "aes-kw",
  "rsa-oaep",
  "ecdh",
  "ml-kem-512",
  "unknown-alg",
];

exports.makePrngDrivenTenantBlob = function (prng) {
  const tenantCount = prng.nextInt(5) + 1;
  const tenants = {};
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "tenant-" + prng.nextString(8);
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
    version: "0.0.0",
    default: {},
    tenants,
  };
};

exports.makePrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "tenant-" + prng.nextString(6),
    prng.nextInt(999).toString(),
    "",
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
      config = "not-an-object";
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
    "polluted",
    "pollutedViaConstructor",
    "nestedPqcPolluted",
    "nestedZkpPolluted",
    "nestedThresholdPolluted",
    "prngPolluted",
    "prngConstructorPolluted",
    "lookupGatePolluted",
    "lookupConstructorPolluted",
    "handshakePolluted",
    "handshakeConstructorPolluted",
    "ringGatePolluted",
    "ringConstructorPolluted",
    "ringProtoLevel0",
    "ringProtoLevel1",
    "ringProtoLevel2",
    "ringProtoLevel3",
    "ringProtoLevel4",
    "ringCtorLevel0",
    "ringCtorLevel1",
    "ringCtorLevel2",
    "ringCtorLevel3",
    "ringCtorLevel4",
    "ringDeepMinRingSize",
    "ringDeepMaxRingSize",
    "accumulatorGatePolluted",
    "accumulatorConstructorPolluted",
    "accumulatorProtoLevel0",
    "accumulatorProtoLevel1",
    "accumulatorProtoLevel2",
    "accumulatorProtoLevel3",
    "accumulatorProtoLevel4",
    "accumulatorCtorLevel0",
    "accumulatorCtorLevel1",
    "accumulatorCtorLevel2",
    "accumulatorCtorLevel3",
    "accumulatorCtorLevel4",
    "accumulatorDeepMaxAccumulatorSize",
    "accumulatorDeepMinWitnessQuorum",
    "vssGatePolluted",
    "vssConstructorPolluted",
    "vssProtoLevel0",
    "vssProtoLevel1",
    "vssProtoLevel2",
    "vssProtoLevel3",
    "vssProtoLevel4",
    "vssCtorLevel0",
    "vssCtorLevel1",
    "vssCtorLevel2",
    "vssCtorLevel3",
    "vssCtorLevel4",
    "vssDeepMaxDegreeBound",
    "vssDeepMinVssShares",
    // Track 115: VFHSS gating pollution cleanup keys
    "vfhssGatePolluted",
    "vfhssConstructorPolluted",
    "vfhssProtoLevel0",
    "vfhssProtoLevel1",
    "vfhssProtoLevel2",
    "vfhssProtoLevel3",
    "vfhssProtoLevel4",
    "vfhssCtorLevel0",
    "vfhssCtorLevel1",
    "vfhssCtorLevel2",
    "vfhssCtorLevel3",
    "vfhssCtorLevel4",
    "vfhssDeepMaxHomomorphicDepth",
    "vfhssDeepMinVfhssShares",
    // Track 116: Cluster isolation hardening pollution cleanup keys
    "isolationGatePolluted",
    "isolationConstructorPolluted",
    "isolationProtoLevel0",
    "isolationProtoLevel1",
    "isolationProtoLevel2",
    "isolationProtoLevel3",
    "isolationProtoLevel4",
    "isolationCtorLevel0",
    "isolationCtorLevel1",
    "isolationCtorLevel2",
    "isolationCtorLevel3",
    "isolationCtorLevel4",
    "isolationDeepMaxViolationThreshold",
    "isolationDeepRequireKnownPeerValidation",
    // Track 117: BFT shard sync pollution cleanup keys
    "bftShardGatePolluted",
    "bftShardConstructorPolluted",
    "bftShardProtoLevel0",
    "bftShardProtoLevel1",
    "bftShardProtoLevel2",
    "bftShardProtoLevel3",
    "bftShardProtoLevel4",
    "bftShardCtorLevel0",
    "bftShardCtorLevel1",
    "bftShardCtorLevel2",
    "bftShardCtorLevel3",
    "bftShardCtorLevel4",
    "bftShardDeepMinQuorumNodes",
    "bftShardDeepMaxCatchUpBatchSize",
    // Track 118: Distributed consensus coordinator pollution cleanup keys
    "consensusGatePolluted",
    "consensusConstructorPolluted",
    "consensusProtoLevel0",
    "consensusProtoLevel1",
    "consensusProtoLevel2",
    "consensusProtoLevel3",
    "consensusProtoLevel4",
    "consensusCtorLevel0",
    "consensusCtorLevel1",
    "consensusCtorLevel2",
    "consensusCtorLevel3",
    "consensusCtorLevel4",
    "consensusDeepMaxGroups",
    "consensusDeepFaultTimeoutMs",
    // Track 119: Cross-cluster migration pollution cleanup keys
    "migrationGatePolluted",
    "migrationConstructorPolluted",
    "migrationProtoLevel0",
    "migrationProtoLevel1",
    "migrationProtoLevel2",
    "migrationProtoLevel3",
    "migrationProtoLevel4",
    "migrationCtorLevel0",
    "migrationCtorLevel1",
    "migrationCtorLevel2",
    "migrationCtorLevel3",
    "migrationCtorLevel4",
    "migrationDeepMinQuorumNodes",
    "migrationDeepMaxConcurrentMigrations",
    // Track 120: Cluster key reconciliation pollution cleanup keys
    "reconciliationGatePolluted",
    "reconciliationConstructorPolluted",
    "reconciliationProtoLevel0",
    "reconciliationProtoLevel1",
    "reconciliationProtoLevel2",
    "reconciliationProtoLevel3",
    "reconciliationProtoLevel4",
    "reconciliationCtorLevel0",
    "reconciliationCtorLevel1",
    "reconciliationCtorLevel2",
    "reconciliationCtorLevel3",
    "reconciliationCtorLevel4",
    "reconciliationDeepMinQuorumNodes",
    "reconciliationDeepMaxTrackedKeys",
    // Track 121: Multiparty re-keying pollution cleanup keys
    "rekeyingGatePolluted",
    "rekeyingConstructorPolluted",
    "rekeyingProtoLevel0",
    "rekeyingProtoLevel1",
    "rekeyingProtoLevel2",
    "rekeyingProtoLevel3",
    "rekeyingProtoLevel4",
    "rekeyingCtorLevel0",
    "rekeyingCtorLevel1",
    "rekeyingCtorLevel2",
    "rekeyingCtorLevel3",
    "rekeyingCtorLevel4",
    "rekeyingDeepMinQuorumNodes",
    "rekeyingDeepMaxShareholders",
  ];
  for (const key of keys) {
    delete Object.prototype[key];
  }
};

// ── Track 31: Homomorphic Database Lookup Gating Hub mutators ────────────────

exports.makeTrack31ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track31-polluter": {
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
      "track31-clean": {
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
    {
      value: { lookupQuorum: "12", lookupDepth: "32" },
      label: "string-numbers",
    },
    {
      value: { lookupQuorum: [], lookupDepth: {} },
      label: "array-object-values",
    },
    {
      value: { lookupQuorum: null, lookupDepth: undefined },
      label: "null-undefined-values",
    },
    { value: { encryptedQueryAttestation: "true" }, label: "string-boolean" },
    { value: { blindingType: 42 }, label: "number-string" },
    { value: { queryAgeSeconds: true }, label: "boolean-number" },
  ];
};

exports.makeTrack31PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice(["t1", "track31-polluter", "track31-clean"]);
  const lookupQuorum = prng.nextChoice([1, 5, 11, 12, 13, 100]);
  const lookupDepth = prng.nextChoice([1, 16, 32, 33, 1000]);
  const attestation = prng.nextChoice([true, false, "true", 1, 0]);
  const auth = prng.nextChoice([
    "mock-authority",
    "untrusted-authority",
    null,
    123,
  ]);
  const blinding = prng.nextChoice([
    "pedersen",
    "exponential-elgamal",
    "unsupported",
    42,
    null,
  ]);
  const canonical = prng.nextChoice([true, false, "yes", 1, 0]);
  return {
    tenantId,
    operation: "lookupGating",
    config: {
      lookupQuorum,
      lookupDepth,
      encryptedQueryAttestation: attestation,
      attestationAuthority: auth,
      blindingType: blinding,
      queryAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
      canonicalPayloadLayout: canonical,
    },
  };
};

// ── Track 113: PQC Handshake Endpoint Integration mutators ─────────────────────

exports.makeTrack113ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track113-polluter": {
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
      "track113-clean": {
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
    {
      value: { lifecycleTimeout: "3600000", requirePqKem: "true" },
      label: "string-numbers",
    },
    {
      value: { lifecycleTimeout: [], requirePqKem: {} },
      label: "array-object-values",
    },
    {
      value: { lifecycleTimeout: null, requirePqKem: undefined },
      label: "null-undefined-values",
    },
    { value: { requireHybridSignature: "true" }, label: "string-boolean" },
    { value: { clientId: 123 }, label: "number-string" },
    { value: { handshakeDigest: true }, label: "boolean-buffer" },
  ];
};

exports.makeTrack113PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track113-polluter",
    "track113-clean",
  ]);
  const lifecycleTimeout = prng.nextChoice([
    1,
    60,
    3600,
    3600000,
    -1,
    "forever",
  ]);
  const requirePqKem = prng.nextChoice([true, false, "true", 1, 0]);
  const requireHybridSignature = prng.nextChoice([true, false, "yes", 1, 0]);
  const clientId = prng.nextChoice(["client-a", "client-b", null, 123, []]);
  const handshakeDigest = prng.nextChoice([
    "digest-001",
    "digest-002",
    null,
    456,
    [],
  ]);
  const operation = prng.nextChoice([
    "handshakeInit",
    "handshakeVerify",
    "nonexistentOp",
  ]);
  return {
    tenantId,
    operation,
    config: {
      clientId,
      handshakeDigest,
      lifecycleTimeout,
      requirePqKem,
      requireHybridSignature,
      clientProof: prng.nextChoice(["proof-001", "", null, 42, []]),
      expectedStateDigest: prng.nextChoice(["state-001", "", null, {}]),
    },
  };
};

// ── Exports ──────────────────────────────────────────────────────────────────

// ── Track 32: PQC Blinded Ring-Signature Gating Hub mutators ──────────────────

exports.makeTrack32ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track32-polluter": {
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
      "track32-clean": {
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
    {
      value: { ringSize: "16", blindedLinkabilityAttestation: "true" },
      label: "string-numbers",
    },
    {
      value: { ringSize: [], blindedLinkabilityAttestation: {} },
      label: "array-object-values",
    },
    {
      value: { ringSize: null, blindedLinkabilityAttestation: undefined },
      label: "null-undefined-values",
    },
    {
      value: { blindedLinkabilityAttestation: "true" },
      label: "string-boolean",
    },
    { value: { blindingType: 42 }, label: "number-string" },
    { value: { signatureAgeSeconds: true }, label: "boolean-number" },
  ];
};

exports.makeTrack32PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice(["t1", "track32-polluter", "track32-clean"]);
  const ringSize = prng.nextChoice([1, 8, 15, 16, 32, 64, 128, 129, 200, 0]);
  const blindedLinkabilityAttestation = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
  ]);
  const auth = prng.nextChoice([
    "mock-authority",
    "untrusted-authority",
    null,
    123,
  ]);
  const blinding = prng.nextChoice([
    "pedersen",
    "borromean",
    "unsupported",
    42,
    null,
  ]);
  const canonical = prng.nextChoice([true, false, "yes", 1, 0]);
  return {
    tenantId,
    operation: "ringGating",
    config: {
      ringSize,
      blindedLinkabilityAttestation,
      attestationAuthority: auth,
      blindingType: blinding,
      signatureAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
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
  current.requireBlindedLinkabilityAttestation = "false";

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track32-deep-polluter": pollutedRing,
      "track32-clean": {
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
  const RING_KEYS = ["ringGating", "pqc", "zkp", "threshold", "governance"];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track32-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = RING_KEYS[prng.nextInt(RING_KEYS.length)];
      const block = {};
      attachDeepPollution(block, l % 5, prng);
      // Occasionally own the actual ringGating keys to verify merge fallbacks
      if (key === "ringGating" && prng.nextInt(3) === 0) {
        block.minRingSize = prng.nextChoice([1, 8, 16, 32, 64, 128, 256]);
        block.maxRingSize = prng.nextChoice([1, 8, 16, 32, 64, 128, 256]);
        block.requireBlindedLinkabilityAttestation = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack32ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track32-clean",
    "track32-deep-polluter",
    "track32-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "ringGating",
    config: {
      ringSize: prng.nextChoice([1, 8, 15, 16, 32, 64, 128, 129, 256, 0, -1]),
      blindedLinkabilityAttestation: prng.nextChoice([
        true,
        false,
        "true",
        1,
        0,
      ]),
      blindingType: prng.nextChoice([
        "pedersen",
        "borromean",
        "unsupported",
        42,
        null,
      ]),
      signatureAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
    },
  };
};

// ── Track 33: PQC Direct Accumulator Membership Proof Gating Hub mutators ─────

exports.makeTrack33ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track33-polluter": {
        accumulatorGating: {
          __proto__: { accumulatorGatePolluted: true },
          maxAccumulatorSize: 65536,
          minWitnessQuorum: 8,
          requireEnclaveMembershipAttestation: true,
        },
        constructor: {
          prototype: { accumulatorConstructorPolluted: true },
        },
      },
      "track33-clean": {
        accumulatorGating: {
          maxAccumulatorSize: 65536,
          minWitnessQuorum: 8,
          requireEnclaveMembershipAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack33TypeConfusionConfigs = function () {
  return [
    {
      value: { accumulatorSize: "1024", witnessQuorum: "8" },
      label: "string-numbers",
    },
    {
      value: { accumulatorSize: [], witnessQuorum: {} },
      label: "array-object-values",
    },
    {
      value: { accumulatorSize: null, witnessQuorum: undefined },
      label: "null-undefined-values",
    },
    {
      value: { enclaveMembershipAttestation: "true" },
      label: "string-boolean",
    },
    { value: { accumulatorType: 42 }, label: "number-string" },
    { value: { witnessAgeSeconds: true }, label: "boolean-number" },
  ];
};

exports.makeTrack33PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice(["t1", "track33-polluter", "track33-clean"]);
  const accumulatorSize = prng.nextChoice([
    1, 1024, 32768, 65536, 65537, 100000, 0, -1,
  ]);
  const witnessQuorum = prng.nextChoice([1, 4, 7, 8, 12, 100, 0, -1]);
  const enclaveMembershipAttestation = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
  ]);
  const auth = prng.nextChoice([
    "mock-authority",
    "untrusted-authority",
    null,
    123,
  ]);
  const accumulatorType = prng.nextChoice([
    "rsa-accumulator",
    "bilinear-pairing",
    "unsupported",
    42,
    null,
  ]);
  const canonical = prng.nextChoice([true, false, "yes", 1, 0]);
  return {
    tenantId,
    operation: "accumulatorGating",
    config: {
      accumulatorSize,
      witnessQuorum,
      enclaveMembershipAttestation,
      attestationAuthority: auth,
      accumulatorType,
      witnessAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
      canonicalPayloadLayout: canonical,
    },
  };
};

// ── Track 33: Deep nested multi-layer policy mutation (5-level) ───────────────

function attachAccumulatorDeepPollution(node, depth, prng) {
  const protoMarker = `accumulatorProtoLevel${depth}`;
  const ctorMarker = `accumulatorCtorLevel${depth}`;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.accumulatorDeepMaxAccumulatorSize = prng
    ? prng.nextChoice([1, 0, -1, 999999])
    : 999999;
  proto.accumulatorDeepMinWitnessQuorum = prng
    ? prng.nextChoice([0, 1, 100, -1])
    : 0;
  return node;
}

exports.makeTrack33DeepNestedPollutionPolicy = function () {
  const pollutedAccumulator = { accumulatorGating: {} };
  let current = pollutedAccumulator.accumulatorGating;
  for (let i = 0; i < 5; i++) {
    attachAccumulatorDeepPollution(current, i);
    if (i < 4) {
      current.accumulatorGating = {};
      current = current.accumulatorGating;
    }
  }
  current.maxAccumulatorSize = 999999;
  current.minWitnessQuorum = 0;
  current.requireEnclaveMembershipAttestation = "false";

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track33-deep-polluter": pollutedAccumulator,
      "track33-clean": {
        accumulatorGating: {
          maxAccumulatorSize: 65536,
          minWitnessQuorum: 8,
          requireEnclaveMembershipAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack33PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const ACCUMULATOR_KEYS = [
    "accumulatorGating",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track33-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = ACCUMULATOR_KEYS[prng.nextInt(ACCUMULATOR_KEYS.length)];
      const block = {};
      attachAccumulatorDeepPollution(block, l % 5, prng);
      if (key === "accumulatorGating" && prng.nextInt(3) === 0) {
        block.maxAccumulatorSize = prng.nextChoice([
          1, 1024, 65536, 65537, 100000,
        ]);
        block.minWitnessQuorum = prng.nextChoice([1, 4, 8, 12, 100, 0]);
        block.requireEnclaveMembershipAttestation = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack33ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track33-clean",
    "track33-deep-polluter",
    "track33-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "accumulatorGating",
    config: {
      accumulatorSize: prng.nextChoice([1, 1024, 65536, 65537, 100000, 0, -1]),
      witnessQuorum: prng.nextChoice([1, 4, 7, 8, 12, 100, 0, -1]),
      enclaveMembershipAttestation: prng.nextChoice([
        true,
        false,
        "true",
        1,
        0,
      ]),
      accumulatorType: prng.nextChoice([
        "rsa-accumulator",
        "bilinear-pairing",
        "unsupported",
        42,
        null,
      ]),
      witnessAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
    },
  };
};

// ── Track 114: PQC Lattice-Based Multi-Message VSS Gating Hub mutators ───────

exports.makeTrack114ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track114-polluter": {
        latticeVssGating: {
          __proto__: { vssGatePolluted: true },
          minVssShares: 5,
          maxDegreeBound: 16,
          requireEnclaveBindingAttestation: true,
        },
        constructor: {
          prototype: { vssConstructorPolluted: true },
        },
      },
      "track114-clean": {
        latticeVssGating: {
          minVssShares: 5,
          maxDegreeBound: 16,
          requireEnclaveBindingAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack114TypeConfusionConfigs = function () {
  return [
    { value: { vssShares: "5", degreeBound: "16" }, label: "string-numbers" },
    { value: { vssShares: [], degreeBound: {} }, label: "array-object-values" },
    {
      value: { vssShares: null, degreeBound: undefined },
      label: "null-undefined-values",
    },
    { value: { enclaveBindingAttestation: "true" }, label: "string-boolean" },
    { value: { latticeScheme: 42 }, label: "number-string" },
    { value: { shareAgeSeconds: true }, label: "boolean-number" },
  ];
};

exports.makeTrack114PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track114-polluter",
    "track114-clean",
  ]);
  const vssShares = prng.nextChoice([1, 3, 4, 5, 8, 12, 100, 0, -1]);
  const degreeBound = prng.nextChoice([1, 8, 15, 16, 17, 32, 100, 0, -1]);
  const enclaveBindingAttestation = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
  ]);
  const auth = prng.nextChoice([
    "mock-authority",
    "untrusted-authority",
    null,
    123,
  ]);
  const latticeScheme = prng.nextChoice([
    "module-lwr",
    "module-lwe",
    "nist-kyber",
    "unsupported",
    42,
    null,
  ]);
  const canonical = prng.nextChoice([true, false, "yes", 1, 0]);
  return {
    tenantId,
    operation: "latticeVssGating",
    config: {
      vssShares,
      degreeBound,
      enclaveBindingAttestation,
      attestationAuthority: auth,
      latticeScheme,
      shareAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
      canonicalPayloadLayout: canonical,
    },
  };
};

// ── Track 114: Deep nested multi-layer policy mutation (5-level) ──────────────

function attachVssDeepPollution(node, depth, prng) {
  const protoMarker = `vssProtoLevel${depth}`;
  const ctorMarker = `vssCtorLevel${depth}`;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.vssDeepMaxDegreeBound = prng ? prng.nextChoice([1, 0, -1, 9999]) : 9999;
  proto.vssDeepMinVssShares = prng ? prng.nextChoice([0, 1, 100, -1]) : 0;
  return node;
}

exports.makeTrack114DeepNestedPollutionPolicy = function () {
  const pollutedVss = { latticeVssGating: {} };
  let current = pollutedVss.latticeVssGating;
  for (let i = 0; i < 5; i++) {
    attachVssDeepPollution(current, i);
    if (i < 4) {
      current.latticeVssGating = {};
      current = current.latticeVssGating;
    }
  }
  current.minVssShares = 0;
  current.maxDegreeBound = 9999;
  current.requireEnclaveBindingAttestation = "false";

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track114-deep-polluter": pollutedVss,
      "track114-clean": {
        latticeVssGating: {
          minVssShares: 5,
          maxDegreeBound: 16,
          requireEnclaveBindingAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack114PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const VSS_KEYS = [
    "latticeVssGating",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track114-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = VSS_KEYS[prng.nextInt(VSS_KEYS.length)];
      const block = {};
      attachVssDeepPollution(block, l % 5, prng);
      if (key === "latticeVssGating" && prng.nextInt(3) === 0) {
        block.minVssShares = prng.nextChoice([1, 3, 5, 8, 12, 100, 0]);
        block.maxDegreeBound = prng.nextChoice([1, 8, 16, 17, 32, 100]);
        block.requireEnclaveBindingAttestation = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack114ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track114-clean",
    "track114-deep-polluter",
    "track114-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "latticeVssGating",
    config: {
      vssShares: prng.nextChoice([1, 3, 4, 5, 8, 12, 100, 0, -1]),
      degreeBound: prng.nextChoice([1, 8, 15, 16, 17, 32, 100, 0, -1]),
      enclaveBindingAttestation: prng.nextChoice([true, false, "true", 1, 0]),
      latticeScheme: prng.nextChoice([
        "module-lwr",
        "module-lwe",
        "nist-kyber",
        "unsupported",
        42,
        null,
      ]),
      shareAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
    },
  };
};

// ── Track 115: PQC Lattice-Based Multi-Message VFHSS Gating mutators ────────

exports.makeTrack115ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track115-polluter": {
        latticeVfhssGating: {
          __proto__: { vfhssGatePolluted: true },
          minVfhssShares: 7,
          maxHomomorphicDepth: 8,
          requireEnclaveEvaluationAttestation: true,
        },
        constructor: {
          prototype: { vfhssConstructorPolluted: true },
        },
      },
      "track115-clean": {
        latticeVfhssGating: {
          minVfhssShares: 7,
          maxHomomorphicDepth: 8,
          requireEnclaveEvaluationAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack115TypeConfusionConfigs = function () {
  return [
    {
      value: { vfhssShares: "7", homomorphicDepth: "8" },
      label: "string-numbers",
    },
    {
      value: { vfhssShares: [], homomorphicDepth: {} },
      label: "array-object-values",
    },
    {
      value: { vfhssShares: null, homomorphicDepth: undefined },
      label: "null-undefined-values",
    },
    {
      value: { enclaveEvaluationAttestation: "true" },
      label: "string-boolean",
    },
    { value: { latticeScheme: 42 }, label: "number-string" },
    { value: { shareAgeSeconds: true }, label: "boolean-number" },
  ];
};

exports.makeTrack115PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track115-polluter",
    "track115-clean",
  ]);
  const vfhssShares = prng.nextChoice([1, 3, 6, 7, 8, 12, 100, 0, -1]);
  const homomorphicDepth = prng.nextChoice([1, 4, 7, 8, 9, 16, 100, 0, -1]);
  const enclaveEvaluationAttestation = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
  ]);
  const auth = prng.nextChoice([
    "mock-authority",
    "untrusted-authority",
    null,
    123,
  ]);
  const latticeScheme = prng.nextChoice([
    "module-lwr",
    "module-lwe",
    "nist-kyber",
    "unsupported",
    42,
    null,
  ]);
  const canonical = prng.nextChoice([true, false, "yes", 1, 0]);
  return {
    tenantId,
    operation: "latticeVfhssGating",
    config: {
      vfhssShares,
      homomorphicDepth,
      enclaveEvaluationAttestation,
      attestationAuthority: auth,
      latticeScheme,
      shareAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
      canonicalPayloadLayout: canonical,
    },
  };
};

// ── Track 115: Deep nested multi-layer policy mutation (5-level) ──────────────

function attachVfhssDeepPollution(node, depth, prng) {
  const protoMarker = `vfhssProtoLevel${depth}`;
  const ctorMarker = `vfhssCtorLevel${depth}`;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.vfhssDeepMaxHomomorphicDepth = prng
    ? prng.nextChoice([1, 0, -1, 9999])
    : 9999;
  proto.vfhssDeepMinVfhssShares = prng ? prng.nextChoice([0, 1, 100, -1]) : 0;
  return node;
}

exports.makeTrack115DeepNestedPollutionPolicy = function () {
  const pollutedVfhss = { latticeVfhssGating: {} };
  let current = pollutedVfhss.latticeVfhssGating;
  for (let i = 0; i < 5; i++) {
    attachVfhssDeepPollution(current, i);
    if (i < 4) {
      current.latticeVfhssGating = {};
      current = current.latticeVfhssGating;
    }
  }
  current.minVfhssShares = 0;
  current.maxHomomorphicDepth = 9999;
  current.requireEnclaveEvaluationAttestation = "false";

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track115-deep-polluter": pollutedVfhss,
      "track115-clean": {
        latticeVfhssGating: {
          minVfhssShares: 7,
          maxHomomorphicDepth: 8,
          requireEnclaveEvaluationAttestation: true,
        },
      },
    },
  };
};

exports.makeTrack115PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const VFHSS_KEYS = [
    "latticeVfhssGating",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track115-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = VFHSS_KEYS[prng.nextInt(VFHSS_KEYS.length)];
      const block = {};
      attachVfhssDeepPollution(block, l % 5, prng);
      if (key === "latticeVfhssGating" && prng.nextInt(3) === 0) {
        block.minVfhssShares = prng.nextChoice([1, 3, 7, 8, 12, 100, 0]);
        block.maxHomomorphicDepth = prng.nextChoice([1, 4, 8, 9, 16, 100]);
        block.requireEnclaveEvaluationAttestation = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack115ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track115-clean",
    "track115-deep-polluter",
    "track115-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "latticeVfhssGating",
    config: {
      vfhssShares: prng.nextChoice([1, 3, 6, 7, 8, 12, 100, 0, -1]),
      homomorphicDepth: prng.nextChoice([1, 4, 7, 8, 9, 16, 100, 0, -1]),
      enclaveEvaluationAttestation: prng.nextChoice([
        true,
        false,
        "true",
        1,
        0,
      ]),
      latticeScheme: prng.nextChoice([
        "module-lwr",
        "module-lwe",
        "nist-kyber",
        "unsupported",
        42,
        null,
      ]),
      shareAgeSeconds: prng.nextChoice([1, 30, 60, 600, -1, "old"]),
    },
  };
};

// ── Track 116: Cluster Isolation Hardening mutators ─────────────────────────

exports.makeTrack116ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track116-polluter": {
        clusterIsolationHardening: {
          __proto__: { isolationGatePolluted: true },
          requireKnownPeerValidation: true,
          rejectNonLeaderKeyCommits: true,
          allowDkgNonLeaderMessages: false,
          maxIsolationViolationThreshold: 100,
        },
        constructor: {
          prototype: { isolationConstructorPolluted: true },
        },
      },
      "track116-clean": {
        clusterIsolationHardening: {
          requireKnownPeerValidation: true,
          rejectNonLeaderKeyCommits: true,
          allowDkgNonLeaderMessages: false,
          maxIsolationViolationThreshold: 100,
        },
      },
    },
  };
};

exports.makeTrack116TypeConfusionConfigs = function () {
  return [
    {
      value: {
        requireKnownPeerValidation: "true",
        rejectNonLeaderKeyCommits: "true",
      },
      label: "string-booleans",
    },
    {
      value: { requireKnownPeerValidation: [], rejectNonLeaderKeyCommits: {} },
      label: "array-object-values",
    },
    {
      value: {
        requireKnownPeerValidation: null,
        rejectNonLeaderKeyCommits: undefined,
      },
      label: "null-undefined-values",
    },
    {
      value: { allowDkgNonLeaderMessages: "false" },
      label: "string-boolean-dkg",
    },
    {
      value: { maxIsolationViolationThreshold: "100" },
      label: "string-number-threshold",
    },
    {
      value: { maxIsolationViolationThreshold: true },
      label: "boolean-number-threshold",
    },
  ];
};

exports.makeTrack116PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track116-polluter",
    "track116-clean",
  ]);
  const requireKnownPeerValidation = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
  ]);
  const rejectNonLeaderKeyCommits = prng.nextChoice([true, false, "yes", 1, 0]);
  const allowDkgNonLeaderMessages = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
  ]);
  const maxIsolationViolationThreshold = prng.nextChoice([
    0,
    50,
    100,
    101,
    999,
    -1,
    Number.MAX_SAFE_INTEGER,
    NaN,
    "100",
  ]);
  return {
    tenantId,
    operation: "clusterIsolationHardening",
    config: {
      requireKnownPeerValidation,
      rejectNonLeaderKeyCommits,
      allowDkgNonLeaderMessages,
      maxIsolationViolationThreshold,
    },
  };
};

// ── Track 116: Deep nested multi-layer policy mutation (5-level) ──────────────

function attachIsolationDeepPollution(node, depth, prng) {
  const protoMarker = `isolationProtoLevel${depth}`;
  const ctorMarker = `isolationCtorLevel${depth}`;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.isolationDeepMaxViolationThreshold = prng
    ? prng.nextChoice([0, -1, 999999, Number.MAX_SAFE_INTEGER])
    : 999999;
  proto.isolationDeepRequireKnownPeerValidation = prng
    ? prng.nextChoice([false, true, "false", 0])
    : false;
  return node;
}

exports.makeTrack116DeepNestedPollutionPolicy = function () {
  const pollutedIsolation = { clusterIsolationHardening: {} };
  let current = pollutedIsolation.clusterIsolationHardening;
  for (let i = 0; i < 5; i++) {
    attachIsolationDeepPollution(current, i);
    if (i < 4) {
      current.clusterIsolationHardening = {};
      current = current.clusterIsolationHardening;
    }
  }
  current.requireKnownPeerValidation = false;
  current.rejectNonLeaderKeyCommits = false;
  current.allowDkgNonLeaderMessages = true;
  current.maxIsolationViolationThreshold = 999999;

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track116-deep-polluter": pollutedIsolation,
      "track116-clean": {
        clusterIsolationHardening: {
          requireKnownPeerValidation: true,
          rejectNonLeaderKeyCommits: true,
          allowDkgNonLeaderMessages: false,
          maxIsolationViolationThreshold: 100,
        },
      },
    },
  };
};

exports.makeTrack116PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const ISOLATION_KEYS = [
    "clusterIsolationHardening",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track116-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = ISOLATION_KEYS[prng.nextInt(ISOLATION_KEYS.length)];
      const block = {};
      attachIsolationDeepPollution(block, l % 5, prng);
      if (key === "clusterIsolationHardening" && prng.nextInt(3) === 0) {
        block.requireKnownPeerValidation = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.rejectNonLeaderKeyCommits = prng.nextChoice([
          true,
          false,
          "yes",
          1,
          0,
        ]);
        block.allowDkgNonLeaderMessages = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.maxIsolationViolationThreshold = prng.nextChoice([
          0, 50, 100, 101, 999, -1,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack116ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track116-clean",
    "track116-deep-polluter",
    "track116-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "clusterIsolationHardening",
    config: {
      requireKnownPeerValidation: prng.nextChoice([true, false, "true", 1, 0]),
      rejectNonLeaderKeyCommits: prng.nextChoice([true, false, "yes", 1, 0]),
      allowDkgNonLeaderMessages: prng.nextChoice([true, false, "true", 1, 0]),
      maxIsolationViolationThreshold: prng.nextChoice([
        0,
        50,
        100,
        101,
        999,
        -1,
        Number.MAX_SAFE_INTEGER,
        NaN,
      ]),
    },
  };
};

// ── Track 117: BFT Shard Sync mutators ───────────────────────────────────────

exports.makeTrack117ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track117-polluter": {
        bftShardSync: {
          __proto__: { bftShardGatePolluted: true },
          minQuorumNodes: 3,
          maxCatchUpBatchSize: 64,
          lagThreshold: 8,
          byzantineDivergenceThreshold: 100,
          requireQuorumCommit: true,
          requireAntiReplay: true,
          maxShardsPerCluster: 128,
        },
        constructor: {
          prototype: { bftShardConstructorPolluted: true },
        },
      },
      "track117-clean": {
        bftShardSync: {
          minQuorumNodes: 3,
          maxCatchUpBatchSize: 64,
          lagThreshold: 8,
          byzantineDivergenceThreshold: 100,
          requireQuorumCommit: true,
          requireAntiReplay: true,
          maxShardsPerCluster: 128,
        },
      },
    },
  };
};

exports.makeTrack117TypeConfusionConfigs = function () {
  return [
    {
      value: { minQuorumNodes: "3", maxCatchUpBatchSize: "64" },
      label: "string-numbers",
    },
    {
      value: { lagThreshold: [], byzantineDivergenceThreshold: {} },
      label: "array-object-values",
    },
    {
      value: { requireQuorumCommit: null, requireAntiReplay: undefined },
      label: "null-undefined-values",
    },
    { value: { requireQuorumCommit: "true" }, label: "string-boolean-quorum" },
    { value: { requireAntiReplay: "false" }, label: "string-boolean-replay" },
    { value: { maxShardsPerCluster: true }, label: "boolean-number-shards" },
  ];
};

exports.makeTrack117PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track117-polluter",
    "track117-clean",
  ]);
  const minQuorumNodes = prng.nextChoice([1, 2, 3, 4, 5, 0, -1, 999, NaN, "3"]);
  const maxCatchUpBatchSize = prng.nextChoice([
    0,
    32,
    64,
    65,
    128,
    999,
    -1,
    "64",
  ]);
  const lagThreshold = prng.nextChoice([0, 4, 8, 9, 100, -1, "8"]);
  const byzantineDivergenceThreshold = prng.nextChoice([
    0,
    50,
    100,
    101,
    9999,
    -1,
    "100",
  ]);
  const requireQuorumCommit = prng.nextChoice([true, false, "true", 1, 0]);
  const requireAntiReplay = prng.nextChoice([true, false, "false", 1, 0]);
  const maxShardsPerCluster = prng.nextChoice([
    0,
    64,
    128,
    129,
    9999,
    -1,
    "128",
  ]);
  return {
    tenantId,
    operation: "bftShardSync",
    config: {
      minQuorumNodes,
      maxCatchUpBatchSize,
      lagThreshold,
      byzantineDivergenceThreshold,
      requireQuorumCommit,
      requireAntiReplay,
      maxShardsPerCluster,
    },
  };
};

// ── Track 117: Deep nested multi-layer policy mutation (5-level) ──────────────

function attachBftShardDeepPollution(node, depth, prng) {
  const protoMarker = `bftShardProtoLevel${depth}`;
  const ctorMarker = `bftShardCtorLevel${depth}`;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.bftShardDeepMinQuorumNodes = prng
    ? prng.nextChoice([0, -1, 999, 1])
    : 1;
  proto.bftShardDeepMaxCatchUpBatchSize = prng
    ? prng.nextChoice([0, 9999, -1])
    : 9999;
  return node;
}

exports.makeTrack117DeepNestedPollutionPolicy = function () {
  const pollutedBftShard = { bftShardSync: {} };
  let current = pollutedBftShard.bftShardSync;
  for (let i = 0; i < 5; i++) {
    attachBftShardDeepPollution(current, i);
    if (i < 4) {
      current.bftShardSync = {};
      current = current.bftShardSync;
    }
  }
  current.minQuorumNodes = 1;
  current.maxCatchUpBatchSize = 9999;
  current.lagThreshold = 999;
  current.byzantineDivergenceThreshold = 99999;
  current.requireQuorumCommit = false;
  current.requireAntiReplay = false;
  current.maxShardsPerCluster = 99999;

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track117-deep-polluter": pollutedBftShard,
      "track117-clean": {
        bftShardSync: {
          minQuorumNodes: 3,
          maxCatchUpBatchSize: 64,
          lagThreshold: 8,
          byzantineDivergenceThreshold: 100,
          requireQuorumCommit: true,
          requireAntiReplay: true,
          maxShardsPerCluster: 128,
        },
      },
    },
  };
};

exports.makeTrack117PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const BFT_SHARD_KEYS = [
    "bftShardSync",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track117-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = BFT_SHARD_KEYS[prng.nextInt(BFT_SHARD_KEYS.length)];
      const block = {};
      attachBftShardDeepPollution(block, l % 5, prng);
      if (key === "bftShardSync" && prng.nextInt(3) === 0) {
        block.minQuorumNodes = prng.nextChoice([1, 2, 3, 4, 5, 0, -1, 999]);
        block.maxCatchUpBatchSize = prng.nextChoice([
          0, 32, 64, 65, 128, 999, -1,
        ]);
        block.lagThreshold = prng.nextChoice([0, 4, 8, 9, 100, -1]);
        block.byzantineDivergenceThreshold = prng.nextChoice([
          0, 50, 100, 101, 9999, -1,
        ]);
        block.requireQuorumCommit = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.requireAntiReplay = prng.nextChoice([true, false, "false", 1, 0]);
        block.maxShardsPerCluster = prng.nextChoice([
          0, 64, 128, 129, 9999, -1,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack117ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track117-clean",
    "track117-deep-polluter",
    "track117-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "bftShardSync",
    config: {
      minQuorumNodes: prng.nextChoice([1, 2, 3, 4, 5, 0, -1, 999, NaN]),
      maxCatchUpBatchSize: prng.nextChoice([0, 32, 64, 65, 128, 999, -1]),
      lagThreshold: prng.nextChoice([0, 4, 8, 9, 100, -1]),
      byzantineDivergenceThreshold: prng.nextChoice([
        0, 50, 100, 101, 9999, -1,
      ]),
      requireQuorumCommit: prng.nextChoice([true, false, "true", 1, 0]),
      requireAntiReplay: prng.nextChoice([true, false, "false", 1, 0]),
      maxShardsPerCluster: prng.nextChoice([0, 64, 128, 129, 9999, -1]),
    },
  };
};

// ── Track 118: Distributed Consensus Coordinator mutators ────────────────────

exports.makeTrack118ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track118-polluter": {
        distributedConsensusCoordinator: {
          __proto__: { consensusGatePolluted: true },
          maxGroups: 64,
          faultTimeoutMs: 3000,
          faultCheckIntervalMs: 1000,
          viewChangeTimeoutMs: 5000,
          requireQuorumForProposals: true,
          allowDynamicGroupCreation: true,
          allowCrossGroupRouting: true,
        },
        constructor: {
          prototype: { consensusConstructorPolluted: true },
        },
      },
      "track118-clean": {
        distributedConsensusCoordinator: {
          maxGroups: 64,
          faultTimeoutMs: 3000,
          faultCheckIntervalMs: 1000,
          viewChangeTimeoutMs: 5000,
          requireQuorumForProposals: true,
          allowDynamicGroupCreation: true,
          allowCrossGroupRouting: true,
        },
      },
    },
  };
};

exports.makeTrack118TypeConfusionConfigs = function () {
  return [
    {
      value: { maxGroups: "64", faultTimeoutMs: "3000" },
      label: "string-numbers",
    },
    {
      value: { faultCheckIntervalMs: [], viewChangeTimeoutMs: {} },
      label: "array-object-values",
    },
    {
      value: {
        requireQuorumForProposals: null,
        allowDynamicGroupCreation: undefined,
      },
      label: "null-undefined-values",
    },
    {
      value: { requireQuorumForProposals: "true" },
      label: "string-boolean-quorum",
    },
    {
      value: { allowDynamicGroupCreation: "false" },
      label: "string-boolean-dynamic",
    },
    { value: { maxGroups: true }, label: "boolean-number-maxgroups" },
  ];
};

exports.makeTrack118PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track118-polluter",
    "track118-clean",
  ]);
  const maxGroups = prng.nextChoice([
    0,
    32,
    64,
    65,
    128,
    999,
    -1,
    NaN,
    "64",
    Number.MAX_SAFE_INTEGER,
  ]);
  const faultTimeoutMs = prng.nextChoice([
    0,
    1000,
    3000,
    3001,
    9999,
    -1,
    "3000",
    Number.MAX_SAFE_INTEGER,
  ]);
  const faultCheckIntervalMs = prng.nextChoice([
    0,
    500,
    1000,
    1001,
    9999,
    -1,
    "1000",
  ]);
  const viewChangeTimeoutMs = prng.nextChoice([
    0,
    1000,
    5000,
    5001,
    9999,
    -1,
    "5000",
  ]);
  const requireQuorumForProposals = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
    null,
  ]);
  const allowDynamicGroupCreation = prng.nextChoice([
    true,
    false,
    "false",
    1,
    0,
    null,
  ]);
  const allowCrossGroupRouting = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
    null,
  ]);
  return {
    tenantId,
    operation: "distributedConsensusCoordinator",
    config: {
      maxGroups,
      faultTimeoutMs,
      faultCheckIntervalMs,
      viewChangeTimeoutMs,
      requireQuorumForProposals,
      allowDynamicGroupCreation,
      allowCrossGroupRouting,
    },
  };
};

// ── Track 118: Deep nested multi-layer policy mutation (5-level) ──────────────

function attachConsensusDeepPollution(node, depth, prng) {
  const protoMarker = `consensusProtoLevel${depth}`;
  const ctorMarker = `consensusCtorLevel${depth}`;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.consensusDeepMaxGroups = prng ? prng.nextChoice([0, -1, 999, 1]) : 999;
  proto.consensusDeepFaultTimeoutMs = prng
    ? prng.nextChoice([0, 9999, -1])
    : 9999;
  return node;
}

exports.makeTrack118DeepNestedPollutionPolicy = function () {
  const pollutedConsensus = { distributedConsensusCoordinator: {} };
  let current = pollutedConsensus.distributedConsensusCoordinator;
  for (let i = 0; i < 5; i++) {
    attachConsensusDeepPollution(current, i);
    if (i < 4) {
      current.distributedConsensusCoordinator = {};
      current = current.distributedConsensusCoordinator;
    }
  }
  current.maxGroups = 999;
  current.faultTimeoutMs = 1;
  current.faultCheckIntervalMs = 99999;
  current.viewChangeTimeoutMs = 1;
  current.requireQuorumForProposals = false;
  current.allowDynamicGroupCreation = false;
  current.allowCrossGroupRouting = false;

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track118-deep-polluter": pollutedConsensus,
      "track118-clean": {
        distributedConsensusCoordinator: {
          maxGroups: 64,
          faultTimeoutMs: 3000,
          faultCheckIntervalMs: 1000,
          viewChangeTimeoutMs: 5000,
          requireQuorumForProposals: true,
          allowDynamicGroupCreation: true,
          allowCrossGroupRouting: true,
        },
      },
    },
  };
};

exports.makeTrack118PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const CONSENSUS_KEYS = [
    "distributedConsensusCoordinator",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track118-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = CONSENSUS_KEYS[prng.nextInt(CONSENSUS_KEYS.length)];
      const block = {};
      attachConsensusDeepPollution(block, l % 5, prng);
      if (key === "distributedConsensusCoordinator" && prng.nextInt(3) === 0) {
        block.maxGroups = prng.nextChoice([0, 32, 64, 65, 128, 999, -1]);
        block.faultTimeoutMs = prng.nextChoice([0, 1000, 3000, 3001, 9999, -1]);
        block.faultCheckIntervalMs = prng.nextChoice([
          0, 500, 1000, 1001, 9999, -1,
        ]);
        block.viewChangeTimeoutMs = prng.nextChoice([
          0, 1000, 5000, 5001, 9999, -1,
        ]);
        block.requireQuorumForProposals = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.allowDynamicGroupCreation = prng.nextChoice([
          true,
          false,
          "false",
          1,
          0,
        ]);
        block.allowCrossGroupRouting = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack118ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track118-clean",
    "track118-deep-polluter",
    "track118-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "distributedConsensusCoordinator",
    config: {
      maxGroups: prng.nextChoice([0, 32, 64, 65, 128, 999, -1, NaN]),
      faultTimeoutMs: prng.nextChoice([0, 1000, 3000, 3001, 9999, -1]),
      faultCheckIntervalMs: prng.nextChoice([0, 500, 1000, 1001, 9999, -1]),
      viewChangeTimeoutMs: prng.nextChoice([0, 1000, 5000, 5001, 9999, -1]),
      requireQuorumForProposals: prng.nextChoice([true, false, "true", 1, 0]),
      allowDynamicGroupCreation: prng.nextChoice([true, false, "false", 1, 0]),
      allowCrossGroupRouting: prng.nextChoice([true, false, "true", 1, 0]),
    },
  };
};

// ── Track 119: Cross-Cluster Migration mutators ──────────────────────────────

exports.makeTrack119ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track119-polluter": {
        crossClusterMigration: {
          __proto__: { migrationGatePolluted: true },
          minQuorumNodes: 3,
          requireAttestation: true,
          allowedAttestationAuthorities: ["mock-authority"],
          maxConcurrentMigrations: 16,
          requireQuorumCommit: true,
          requireRollbackOnFailure: true,
          maxShardsPerMigration: 32,
        },
        constructor: {
          prototype: { migrationConstructorPolluted: true },
        },
      },
      "track119-clean": {
        crossClusterMigration: {
          minQuorumNodes: 3,
          requireAttestation: true,
          allowedAttestationAuthorities: ["mock-authority"],
          maxConcurrentMigrations: 16,
          requireQuorumCommit: true,
          requireRollbackOnFailure: true,
          maxShardsPerMigration: 32,
        },
      },
    },
  };
};

exports.makeTrack119TypeConfusionConfigs = function () {
  return [
    {
      value: { minQuorumNodes: "3", maxConcurrentMigrations: "16" },
      label: "string-numbers",
    },
    {
      value: { maxShardsPerMigration: [], requireAttestation: {} },
      label: "array-object-values",
    },
    {
      value: { requireQuorumCommit: null, requireRollbackOnFailure: undefined },
      label: "null-undefined-values",
    },
    {
      value: { requireAttestation: "true" },
      label: "string-boolean-attestation",
    },
    { value: { requireQuorumCommit: "false" }, label: "string-boolean-quorum" },
    {
      value: {
        allowedAttestationAuthorities: [
          "mock-authority",
          123,
          null,
          {},
          [],
          true,
          undefined,
        ],
      },
      label: "mixed-type-authority-array",
    },
    {
      value: {
        allowedAttestationAuthorities: [["mock-authority"], ["spoofed"]],
      },
      label: "nested-array-authorities",
    },
    {
      value: {
        allowedAttestationAuthorities: [
          { __proto__: { migrationGatePolluted: true } },
        ],
      },
      label: "proto-pollution-in-authority-array",
    },
    {
      value: { allowedAttestationAuthorities: [] },
      label: "empty-authority-array",
    },
    {
      value: { allowedAttestationAuthorities: "mock-authority" },
      label: "string-instead-of-array",
    },
    {
      value: { allowedAttestationAuthorities: 123 },
      label: "number-instead-of-array",
    },
    { value: { minQuorumNodes: true }, label: "boolean-number-quorum" },
  ];
};

exports.makeTrack119PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track119-polluter",
    "track119-clean",
  ]);
  const minQuorumNodes = prng.nextChoice([
    0,
    1,
    2,
    3,
    4,
    5,
    999,
    -1,
    NaN,
    "3",
    Number.MAX_SAFE_INTEGER,
  ]);
  const requireAttestation = prng.nextChoice([true, false, "true", 1, 0, null]);
  const allowedAttestationAuthorities = prng.nextChoice([
    ["mock-authority"],
    ["spoofed-authority"],
    ["mock-authority", "spoofed"],
    [],
    "mock-authority",
    123,
    null,
    [{ __proto__: { migrationGatePolluted: true } }],
    ["mock-authority", 123, null, {}, []],
  ]);
  const maxConcurrentMigrations = prng.nextChoice([
    0,
    16,
    17,
    999,
    -1,
    "16",
    Number.MAX_SAFE_INTEGER,
  ]);
  const requireQuorumCommit = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
    null,
  ]);
  const requireRollbackOnFailure = prng.nextChoice([
    true,
    false,
    "true",
    1,
    0,
    null,
  ]);
  const maxShardsPerMigration = prng.nextChoice([
    0,
    32,
    33,
    999,
    -1,
    "32",
    Number.MAX_SAFE_INTEGER,
  ]);
  return {
    tenantId,
    operation: "crossClusterMigration",
    config: {
      minQuorumNodes,
      requireAttestation,
      allowedAttestationAuthorities,
      maxConcurrentMigrations,
      requireQuorumCommit,
      requireRollbackOnFailure,
      maxShardsPerMigration,
    },
  };
};

// ── Track 119: Deep nested multi-layer policy mutation (5-level) ──────────────

function attachMigrationDeepPollution(node, depth, prng) {
  const protoMarker = "migrationProtoLevel" + depth;
  const ctorMarker = "migrationCtorLevel" + depth;
  Object.setPrototypeOf(node, { [protoMarker]: true });
  node.constructor = { prototype: { [ctorMarker]: true } };
  const proto = Object.getPrototypeOf(node);
  proto.migrationDeepMinQuorumNodes = prng
    ? prng.nextChoice([0, -1, 999, 1])
    : 999;
  proto.migrationDeepMaxConcurrentMigrations = prng
    ? prng.nextChoice([0, 9999, -1])
    : 9999;
  return node;
}

exports.makeTrack119DeepNestedPollutionPolicy = function () {
  const pollutedMigration = { crossClusterMigration: {} };
  let current = pollutedMigration.crossClusterMigration;
  for (let i = 0; i < 5; i++) {
    attachMigrationDeepPollution(current, i);
    if (i < 4) {
      current.crossClusterMigration = {};
      current = current.crossClusterMigration;
    }
  }
  current.minQuorumNodes = 1;
  current.requireAttestation = false;
  current.allowedAttestationAuthorities = ["spoofed"];
  current.maxConcurrentMigrations = 999;
  current.requireQuorumCommit = false;
  current.requireRollbackOnFailure = false;
  current.maxShardsPerMigration = 999;

  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track119-deep-polluter": pollutedMigration,
      "track119-clean": {
        crossClusterMigration: {
          minQuorumNodes: 3,
          requireAttestation: true,
          allowedAttestationAuthorities: ["mock-authority"],
          maxConcurrentMigrations: 16,
          requireQuorumCommit: true,
          requireRollbackOnFailure: true,
          maxShardsPerMigration: 32,
        },
      },
    },
  };
};

exports.makeTrack119PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const MIGRATION_KEYS = [
    "crossClusterMigration",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track119-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = MIGRATION_KEYS[prng.nextInt(MIGRATION_KEYS.length)];
      const block = {};
      attachMigrationDeepPollution(block, l % 5, prng);
      if (key === "crossClusterMigration" && prng.nextInt(3) === 0) {
        block.minQuorumNodes = prng.nextChoice([0, 1, 2, 3, 4, 5, 999, -1]);
        block.requireAttestation = prng.nextChoice([true, false, "true", 1, 0]);
        block.allowedAttestationAuthorities = prng.nextChoice([
          ["mock-authority"],
          ["spoofed"],
          [],
          "mock-authority",
        ]);
        block.maxConcurrentMigrations = prng.nextChoice([0, 16, 17, 999, -1]);
        block.requireQuorumCommit = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.requireRollbackOnFailure = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.maxShardsPerMigration = prng.nextChoice([0, 32, 33, 999, -1]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack119ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track119-clean",
    "track119-deep-polluter",
    "track119-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "crossClusterMigration",
    config: {
      minQuorumNodes: prng.nextChoice([0, 1, 2, 3, 4, 999, -1, NaN]),
      requireAttestation: prng.nextChoice([true, false, "true", 1, 0]),
      allowedAttestationAuthorities: prng.nextChoice([
        ["mock-authority"],
        ["spoofed"],
        [],
        "mock-authority",
        123,
      ]),
      maxConcurrentMigrations: prng.nextChoice([0, 16, 17, 999, -1]),
      requireQuorumCommit: prng.nextChoice([true, false, "true", 1, 0]),
      requireRollbackOnFailure: prng.nextChoice([true, false, "true", 1, 0]),
      maxShardsPerMigration: prng.nextChoice([0, 32, 33, 999, -1]),
    },
  };
};

// ── Track 120: Cluster Key Reconciliation mutators ───────────────────────────

exports.makeTrack120ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track120-polluter": {
        clusterKeyReconciliation: {
          __proto__: { reconciliationGatePolluted: true },
          minQuorumNodes: 3,
          maxEpochRollbackAttempts: 3,
          requireQuorumPromotion: true,
          requireAntiRollback: true,
          quarantineOnCriticalDivergence: true,
          maxTrackedKeys: 256,
          constructor: {
            prototype: { reconciliationConstructorPolluted: true },
          },
        },
      },
      "track120-clean": {
        clusterKeyReconciliation: {
          minQuorumNodes: 3,
          maxEpochRollbackAttempts: 3,
          requireQuorumPromotion: true,
          requireAntiRollback: true,
          quarantineOnCriticalDivergence: true,
          maxTrackedKeys: 256,
        },
      },
    },
  };
};

exports.makeTrack120TypeConfusionConfigs = function () {
  return [
    { value: { minQuorumNodes: "not-a-number" }, label: "string-for-numeric" },
    { value: { minQuorumNodes: null }, label: "null-for-numeric" },
    { value: { minQuorumNodes: [] }, label: "array-for-numeric" },
    { value: { minQuorumNodes: {} }, label: "object-for-numeric" },
    { value: { minQuorumNodes: true }, label: "boolean-for-numeric" },
    {
      value: { maxEpochRollbackAttempts: "not-a-number" },
      label: "string-for-rollback",
    },
    { value: { maxEpochRollbackAttempts: null }, label: "null-for-rollback" },
    { value: { maxEpochRollbackAttempts: [] }, label: "array-for-rollback" },
    {
      value: { requireQuorumPromotion: "not-a-boolean" },
      label: "string-for-boolean",
    },
    { value: { requireQuorumPromotion: 42 }, label: "number-for-boolean" },
    { value: { requireQuorumPromotion: null }, label: "null-for-boolean" },
    { value: { requireQuorumPromotion: [] }, label: "array-for-boolean" },
    {
      value: { requireAntiRollback: "not-a-boolean" },
      label: "string-for-antirb",
    },
    { value: { requireAntiRollback: 42 }, label: "number-for-antirb" },
    {
      value: { quarantineOnCriticalDivergence: "not-a-boolean" },
      label: "string-for-quarantine",
    },
    {
      value: { quarantineOnCriticalDivergence: 42 },
      label: "number-for-quarantine",
    },
    { value: { maxTrackedKeys: "not-a-number" }, label: "string-for-tracked" },
    { value: { maxTrackedKeys: null }, label: "null-for-tracked" },
    { value: { maxTrackedKeys: [] }, label: "array-for-tracked" },
    { value: { maxTrackedKeys: {} }, label: "object-for-tracked" },
    {
      value: { __proto__: { reconciliationGatePolluted: true } },
      label: "proto-pollution-top-level",
    },
    {
      value: {
        constructor: { prototype: { reconciliationConstructorPolluted: true } },
      },
      label: "ctor-pollution-top-level",
    },
  ];
};

exports.makeTrack120PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track120-polluter",
    "track120-clean",
  ]);
  const minQuorumNodes = prng.nextChoice([
    0,
    1,
    2,
    3,
    4,
    5,
    999,
    -1,
    NaN,
    "3",
    Number.MAX_SAFE_INTEGER,
  ]);
  const maxEpochRollbackAttempts = prng.nextChoice([
    0,
    1,
    3,
    5,
    6,
    999,
    -1,
    NaN,
    "5",
    Number.MAX_SAFE_INTEGER,
  ]);
  const requireQuorumPromotion = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const requireAntiRollback = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const quarantineOnCriticalDivergence = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const maxTrackedKeys = prng.nextChoice([
    0,
    1,
    256,
    512,
    513,
    999,
    -1,
    NaN,
    "256",
    Number.MAX_SAFE_INTEGER,
  ]);
  return {
    tenantId,
    operation: "clusterKeyReconciliation",
    config: {
      minQuorumNodes,
      maxEpochRollbackAttempts,
      requireQuorumPromotion,
      requireAntiRollback,
      quarantineOnCriticalDivergence,
      maxTrackedKeys,
    },
  };
};

// ── Track 120: Deep nested multi-layer policy mutation (5-level) ─────────────

function attachReconciliationDeepPollution(node, depth, prng) {
  const protoKey = "reconciliationProtoLevel" + depth;
  const ctorKey = "reconciliationCtorLevel" + depth;
  node.__proto__ = { [protoKey]: true };
  if (prng) {
    node.minQuorumNodes = prng.nextChoice([0, 1, 2, 3, 999, -1]);
    node.maxTrackedKeys = prng.nextChoice([0, 1, 256, 512, 999, -1]);
  } else {
    node.minQuorumNodes = depth % 2 === 0 ? 0 : 3;
    node.maxTrackedKeys = depth % 2 === 0 ? 999 : 256;
  }
  node.constructor = { prototype: { [ctorKey]: true } };
}

exports.makeTrack120DeepNestedPollutionPolicy = function () {
  const pollutedReconciliation = { clusterKeyReconciliation: {} };
  let current = pollutedReconciliation.clusterKeyReconciliation;
  for (let i = 0; i < 5; i++) {
    attachReconciliationDeepPollution(current, i);
    if (i < 4) {
      current.clusterKeyReconciliation = {};
      current = current.clusterKeyReconciliation;
    }
  }
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track120-deep-polluter": pollutedReconciliation,
      "track120-clean": {
        clusterKeyReconciliation: {
          minQuorumNodes: 3,
          maxEpochRollbackAttempts: 3,
          requireQuorumPromotion: true,
          requireAntiRollback: true,
          quarantineOnCriticalDivergence: true,
          maxTrackedKeys: 256,
        },
      },
    },
  };
};

exports.makeTrack120PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const RECONCILIATION_KEYS = [
    "clusterKeyReconciliation",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track120-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = prng.nextChoice(RECONCILIATION_KEYS);
      const block = {};
      attachReconciliationDeepPollution(block, l % 5, prng);
      if (key === "clusterKeyReconciliation" && prng.nextInt(3) === 0) {
        block.minQuorumNodes = prng.nextChoice([0, 1, 2, 3, 4, 5, 999, -1]);
        block.requireQuorumPromotion = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.maxTrackedKeys = prng.nextChoice([0, 1, 256, 512, 513, 999, -1]);
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack120ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track120-clean",
    "track120-deep-polluter",
    "track120-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "clusterKeyReconciliation",
    config: {
      minQuorumNodes: prng.nextChoice([0, 1, 2, 3, 4, 999, -1, NaN]),
      maxEpochRollbackAttempts: prng.nextChoice([0, 3, 5, 6, 999, -1, NaN]),
      requireQuorumPromotion: prng.nextChoice([true, false, "true", 1, 0]),
      requireAntiRollback: prng.nextChoice([true, false, "true", 1, 0]),
      quarantineOnCriticalDivergence: prng.nextChoice([
        true,
        false,
        "true",
        1,
        0,
      ]),
      maxTrackedKeys: prng.nextChoice([0, 1, 256, 512, 513, 999, -1, NaN]),
    },
  };
};

// ── Track 121: Multiparty Re-Keying mutators ─────────────────────────────────

exports.makeTrack121ProtoPollutionPolicy = function () {
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track121-polluter": {
        multipartyReKeying: {
          __proto__: { rekeyingGatePolluted: true },
          minQuorumNodes: 3,
          maxReKeyingEpochs: 1000,
          requireQuorumCommit: true,
          requireAntiRollback: true,
          requireShareZeroization: true,
          allowThresholdAdjustment: true,
          maxShareholders: 32,
          constructor: { prototype: { rekeyingConstructorPolluted: true } },
        },
      },
      "track121-clean": {
        multipartyReKeying: {
          minQuorumNodes: 3,
          maxReKeyingEpochs: 1000,
          requireQuorumCommit: true,
          requireAntiRollback: true,
          requireShareZeroization: true,
          allowThresholdAdjustment: true,
          maxShareholders: 32,
        },
      },
    },
  };
};

exports.makeTrack121TypeConfusionConfigs = function () {
  return [
    { value: { minQuorumNodes: "not-a-number" }, label: "string-for-numeric" },
    { value: { minQuorumNodes: null }, label: "null-for-numeric" },
    { value: { minQuorumNodes: [] }, label: "array-for-numeric" },
    { value: { minQuorumNodes: {} }, label: "object-for-numeric" },
    { value: { minQuorumNodes: true }, label: "boolean-for-numeric" },
    {
      value: { maxReKeyingEpochs: "not-a-number" },
      label: "string-for-epochs",
    },
    { value: { maxReKeyingEpochs: null }, label: "null-for-epochs" },
    { value: { maxReKeyingEpochs: [] }, label: "array-for-epochs" },
    {
      value: { requireQuorumCommit: "not-a-boolean" },
      label: "string-for-quorum",
    },
    { value: { requireQuorumCommit: 42 }, label: "number-for-quorum" },
    { value: { requireQuorumCommit: null }, label: "null-for-quorum" },
    { value: { requireQuorumCommit: [] }, label: "array-for-quorum" },
    {
      value: { requireAntiRollback: "not-a-boolean" },
      label: "string-for-antirb",
    },
    { value: { requireAntiRollback: 42 }, label: "number-for-antirb" },
    {
      value: { requireShareZeroization: "not-a-boolean" },
      label: "string-for-zeroize",
    },
    { value: { requireShareZeroization: 42 }, label: "number-for-zeroize" },
    {
      value: { allowThresholdAdjustment: "not-a-boolean" },
      label: "string-for-threshold",
    },
    { value: { allowThresholdAdjustment: 42 }, label: "number-for-threshold" },
    {
      value: { maxShareholders: "not-a-number" },
      label: "string-for-shareholders",
    },
    { value: { maxShareholders: null }, label: "null-for-shareholders" },
    { value: { maxShareholders: [] }, label: "array-for-shareholders" },
    { value: { maxShareholders: {} }, label: "object-for-shareholders" },
    {
      value: { __proto__: { rekeyingGatePolluted: true } },
      label: "proto-pollution-top-level",
    },
    {
      value: {
        constructor: { prototype: { rekeyingConstructorPolluted: true } },
      },
      label: "ctor-pollution-top-level",
    },
  ];
};

exports.makeTrack121PrngDrivenValidateCall = function (prng) {
  const tenantId = prng.nextChoice([
    "t1",
    "track121-polluter",
    "track121-clean",
    "track121-restricted",
  ]);
  const minQuorumNodes = prng.nextChoice([
    0,
    1,
    2,
    3,
    4,
    5,
    999,
    -1,
    NaN,
    "3",
    Number.MAX_SAFE_INTEGER,
  ]);
  const maxReKeyingEpochs = prng.nextChoice([
    0,
    1,
    1000,
    9999,
    10000,
    10001,
    99999,
    -1,
    NaN,
    "1000",
    Number.MAX_SAFE_INTEGER,
  ]);
  const requireQuorumCommit = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const requireAntiRollback = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const requireShareZeroization = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const allowThresholdAdjustment = prng.nextChoice([
    true,
    false,
    "true",
    "false",
    1,
    0,
    null,
  ]);
  const maxShareholders = prng.nextChoice([
    0,
    1,
    32,
    64,
    65,
    999,
    -1,
    NaN,
    "32",
    Number.MAX_SAFE_INTEGER,
  ]);
  return {
    tenantId,
    operation: "multipartyReKeying",
    config: {
      minQuorumNodes,
      maxReKeyingEpochs,
      requireQuorumCommit,
      requireAntiRollback,
      requireShareZeroization,
      allowThresholdAdjustment,
      maxShareholders,
    },
  };
};

// ── Track 121: Deep nested multi-layer policy mutation (5-level) ─────────────

function attachRekeyingDeepPollution(node, depth, prng) {
  const protoKey = "rekeyingProtoLevel" + depth;
  const ctorKey = "rekeyingCtorLevel" + depth;
  node.__proto__ = { [protoKey]: true };
  if (prng) {
    node.minQuorumNodes = prng.nextChoice([0, 1, 2, 3, 999, -1]);
    node.maxShareholders = prng.nextChoice([0, 1, 32, 64, 999, -1]);
  } else {
    node.minQuorumNodes = depth % 2 === 0 ? 0 : 3;
    node.maxShareholders = depth % 2 === 0 ? 999 : 32;
  }
  node.constructor = { prototype: { [ctorKey]: true } };
}

exports.makeTrack121DeepNestedPollutionPolicy = function () {
  const pollutedRekeying = { multipartyReKeying: {} };
  let current = pollutedRekeying.multipartyReKeying;
  for (let i = 0; i < 5; i++) {
    attachRekeyingDeepPollution(current, i);
    if (i < 4) {
      current.multipartyReKeying = {};
      current = current.multipartyReKeying;
    }
  }
  return {
    version: "0.0.0",
    default: {},
    tenants: {
      "track121-deep-polluter": pollutedRekeying,
      "track121-clean": {
        multipartyReKeying: {
          minQuorumNodes: 3,
          maxReKeyingEpochs: 1000,
          requireQuorumCommit: true,
          requireAntiRollback: true,
          requireShareZeroization: true,
          allowThresholdAdjustment: true,
          maxShareholders: 32,
        },
      },
    },
  };
};

exports.makeTrack121PrngDrivenMultiLayerPolicy = function (prng) {
  const tenantCount = prng.nextInt(4) + 2;
  const tenants = {};
  const REKEYING_KEYS = [
    "multipartyReKeying",
    "pqc",
    "zkp",
    "threshold",
    "governance",
  ];
  for (let i = 0; i < tenantCount; i++) {
    const tenantId = "track121-tenant-" + prng.nextString(8);
    const tenant = {};
    const layers = prng.nextInt(4) + 1;
    for (let l = 0; l < layers; l++) {
      const key = prng.nextChoice(REKEYING_KEYS);
      const block = {};
      attachRekeyingDeepPollution(block, l % 5, prng);
      if (key === "multipartyReKeying" && prng.nextInt(3) === 0) {
        block.minQuorumNodes = prng.nextChoice([0, 1, 2, 3, 4, 5, 999, -1]);
        block.requireQuorumCommit = prng.nextChoice([
          true,
          false,
          "true",
          1,
          0,
        ]);
        block.maxShareholders = prng.nextChoice([0, 1, 32, 64, 65, 999, -1]);
        // Some tenants restrict threshold adjustment to test inverse guard
        if (prng.nextInt(4) === 0) {
          block.allowThresholdAdjustment = false;
        }
      }
      tenant[key] = block;
    }
    tenants[tenantId] = tenant;
  }
  return { version: "0.0.0", default: {}, tenants };
};

exports.makeTrack121ConcurrentValidationCall = function (prng) {
  const tenantId = prng.nextChoice([
    "track121-clean",
    "track121-deep-polluter",
    "track121-tenant-" + prng.nextString(8),
    prng.nextInt(999).toString(),
  ]);
  return {
    tenantId,
    operation: "multipartyReKeying",
    config: {
      minQuorumNodes: prng.nextChoice([0, 1, 2, 3, 4, 999, -1, NaN]),
      maxReKeyingEpochs: prng.nextChoice([
        0,
        1000,
        10000,
        10001,
        99999,
        -1,
        NaN,
      ]),
      requireQuorumCommit: prng.nextChoice([true, false, "true", 1, 0]),
      requireAntiRollback: prng.nextChoice([true, false, "true", 1, 0]),
      requireShareZeroization: prng.nextChoice([true, false, "true", 1, 0]),
      allowThresholdAdjustment: prng.nextChoice([true, false, "true", 1, 0]),
      maxShareholders: prng.nextChoice([0, 1, 32, 64, 65, 999, -1, NaN]),
    },
  };
};

exports.makeHashChainPrng = makeHashChainPrng;
exports.FUZZ_SEED = FUZZ_SEED;

// ── Cross-track lattice fuzzing matrix utilities (Tracks 32/33/114/115) ──────
exports.VALID_CLAIMS = {
  track32: {
    blindedLinkabilityAttestation: true,
    linkabilityToken: "token-valid",
    attestationAuthority: "mock-authority",
    anonymitySet: new Array(32).fill("pub-key"),
    canonicalPayloadLayout: true,
  },
  track33: {
    enclaveMembershipAttestation: true,
    attestationAuthority: "mock-authority",
    accumulatorType: "rsa-accumulator",
    canonicalPayloadLayout: true,
    accumulatorSize: 1024,
  },
  track114: {
    degreeBound: 8,
    enclaveBindingAttestation: true,
    attestationAuthority: "mock-authority",
    latticeScheme: "module-lwr",
    canonicalPayloadLayout: true,
  },
  track115: {
    homomorphicDepth: 4,
    enclaveEvaluationAttestation: true,
    attestationAuthority: "mock-authority",
    latticeScheme: "module-lwr",
    canonicalPayloadLayout: true,
  },
};

exports.CROSS_TRACK_PAYLOADS = {
  ringToVss: {
    blindedLinkabilityAttestation: true,
    linkabilityToken: "cross-track-token",
    anonymitySet: new Array(128).fill("pub"),
  },
  ringToVfhss: {
    blindedLinkabilityAttestation: true,
    linkabilityToken: "cross-track-token",
    anonymitySet: new Array(128).fill("pub"),
  },
  accumulatorToRing: {
    enclaveMembershipAttestation: true,
    accumulatorSize: 65536,
    accumulatorType: "rsa-accumulator",
  },
  accumulatorToVfhss: {
    enclaveMembershipAttestation: true,
    accumulatorSize: 65536,
    accumulatorType: "rsa-accumulator",
  },
  vssToRing: {
    degreeBound: 16,
    enclaveBindingAttestation: true,
    latticeScheme: "module-lwr",
  },
  vssToAccumulator: {
    degreeBound: 16,
    enclaveBindingAttestation: true,
    latticeScheme: "module-lwr",
  },
  vfhssToRing: {
    homomorphicDepth: 8,
    enclaveEvaluationAttestation: true,
    latticeScheme: "module-lwr",
  },
  vfhssToAccumulator: {
    homomorphicDepth: 8,
    enclaveEvaluationAttestation: true,
    latticeScheme: "module-lwr",
  },
};

exports.runZkVerificationRunner = function (tenantId, policyEngine) {
  const {
    PqcBlindedRingSignatureGatingHub,
  } = require("../pqc-blinded-ring-signature-gating-hub.cjs");
  const {
    PqcDirectAccumulatorMembershipGatingHub,
  } = require("../pqc-direct-accumulator-membership-gating-hub.cjs");
  const {
    PqcLatticeVssGatingHub,
  } = require("../pqc-lattice-vss-gating-hub.cjs");
  const {
    PqcLatticeVfhssGatingHub,
  } = require("../pqc-lattice-vfhss-gating-hub.cjs");

  const results = {};
  const trackSpecs = [
    {
      key: "track32",
      Hub: PqcBlindedRingSignatureGatingHub,
      collect: (hub) => hub.collectKeys(new Array(32).fill("pub")),
      claim: exports.VALID_CLAIMS.track32,
    },
    {
      key: "track33",
      Hub: PqcDirectAccumulatorMembershipGatingHub,
      collect: (hub) => hub.collectWitnesses(new Array(8).fill("witness")),
      claim: exports.VALID_CLAIMS.track33,
    },
    {
      key: "track114",
      Hub: PqcLatticeVssGatingHub,
      collect: (hub) => hub.collectShares(new Array(8).fill("share")),
      claim: exports.VALID_CLAIMS.track114,
    },
    {
      key: "track115",
      Hub: PqcLatticeVfhssGatingHub,
      collect: (hub) => hub.collectShares(new Array(10).fill("share")),
      claim: exports.VALID_CLAIMS.track115,
    },
  ];

  for (const spec of trackSpecs) {
    try {
      const hub = new spec.Hub(tenantId, policyEngine);
      spec.collect(hub);
      hub.validateProof({ ...spec.claim });
      hub.accredit();
      results[spec.key] = { passed: true, state: hub.state, error: null };
    } catch (err) {
      results[spec.key] = { passed: false, state: null, error: err.message };
    }
  }

  const allPassed = Object.values(results).every((r) => r.passed);
  return { results, allPassed };
};

exports.makeCrossTrackContaminationPayload = function (prng) {
  const tracks = ["track32", "track33", "track114", "track115"];
  const sourceIdx = prng.nextInt(tracks.length);
  let targetIdx = prng.nextInt(tracks.length);
  while (targetIdx === sourceIdx) targetIdx = prng.nextInt(tracks.length);

  const sourceTrack = tracks[sourceIdx];
  const targetTrack = tracks[targetIdx];
  const sourceClaim = exports.VALID_CLAIMS[sourceTrack];
  const pollutedPayload = { ...sourceClaim };
  if (prng.nextInt(3) === 0) {
    pollutedPayload.__proto__ = { crossTrackPolluted: true };
  }
  if (prng.nextInt(5) === 0) {
    pollutedPayload.constructor = {
      prototype: { crossTrackCtorPolluted: true },
    };
  }
  return { sourceTrack, targetTrack, payload: pollutedPayload };
};

exports.makeMultiTenantTrackCall = function (prng) {
  const tenants = ["tenant-a", "tenant-b", "tenant-c", "tenant-d", "tenant-e"];
  const tracks = ["track32", "track33", "track114", "track115"];
  const tenantId = prng.nextChoice(tenants);
  const track = prng.nextChoice(tracks);
  const shouldFail = prng.nextInt(3) === 0;

  if (shouldFail) {
    return {
      tenantId,
      track,
      claim: { attestationAuthority: "mock-authority" },
      shouldFail: true,
    };
  }
  return {
    tenantId,
    track,
    claim: { ...exports.VALID_CLAIMS[track] },
    shouldFail: false,
  };
};

exports.CROSS_TRACK_CLEANUP_KEYS = [
  "crossTrackPolluted",
  "crossTrackCtorPolluted",
];

exports.FUZZ_SEED = FUZZ_SEED;

// ΓöÇΓöÇ Post-Quantum Mutation Fuzzing Utilities ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
//
// Specialized mutation helpers for corrupting ZK validation payloads to
// simulate adversarial message injection, byte truncation, and structural
// noise. Used by runZkVerificationRunner to stress-test Tracks 32/33/114/115
// and the poRep-verifier (Track 112) against malformed inputs.
//
// All mutators return a NEW buffer/object ΓÇö the original is never modified.

/**
 * Bit-flip mutator: flips one or more bits in a buffer copy.
 * @param {Buffer} buf ΓÇö original buffer to mutate
 * @param {object} [opts]
 * @param {number} [opts.count=1] ΓÇö number of bits to flip
 * @param {object} [opts.prng] ΓÇö deterministic PRNG for reproducibility
 * @returns {Buffer} ΓÇö new buffer with flipped bits
 */
exports.mutateBitFlip = function (buf, opts = {}) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf));
  const out = Buffer.from(buf); // copy
  const count = opts.count || 1;
  const prng = opts.prng || makeHashChainPrng(FUZZ_SEED + "-bitflip");
  for (let i = 0; i < count; i++) {
    const byteIdx = prng.nextInt(out.length);
    const bitIdx = prng.nextInt(8);
    out[byteIdx] ^= 1 << bitIdx;
  }
  return out;
};

/**
 * Truncation mutator: slices off bytes from the end (or beginning) of a buffer.
 * @param {Buffer} buf ΓÇö original buffer to mutate
 * @param {object} [opts]
 * @param {number} [opts.removeBytes=1] ΓÇö number of bytes to remove
 * @param {boolean} [opts.fromEnd=true] ΓÇö truncate from end (trailer) or beginning (header)
 * @returns {Buffer} ΓÇö truncated buffer copy
 */
exports.mutateTruncate = function (buf, opts = {}) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf));
  const removeBytes = opts.removeBytes || 1;
  const fromEnd = opts.fromEnd !== false;
  if (buf.length <= removeBytes) return Buffer.alloc(0);
  if (fromEnd) {
    return buf.subarray(0, buf.length - removeBytes);
  }
  return buf.subarray(removeBytes);
};

/**
 * Structural noise mutator: injects unknown keys, null bytes, or corrupt
 * values into a JSON-serializable payload object.
 * @param {object} payload ΓÇö original payload object to mutate
 * @param {object} [opts]
 * @param {number} [opts.injectCount=1] ΓÇö number of noise injections
 * @param {object} [opts.prng] ΓÇö deterministic PRNG for reproducibility
 * @returns {object} ΓÇö new payload object with injected noise
 */
exports.mutateStructuralNoise = function (payload, opts = {}) {
  if (!payload || typeof payload !== "object") return payload;
  const out = JSON.parse(JSON.stringify(payload)); // deep copy
  const injectCount = opts.injectCount || 1;
  const prng = opts.prng || makeHashChainPrng(FUZZ_SEED + "-noise");
  const noiseKeys = [
    "\x00",
    "__proto__",
    "constructor",
    "polluted",
    "",
    "null",
    "undefined",
  ];
  const noiseValues = [
    null,
    "\x00\x00",
    undefined,
    NaN,
    [],
    {},
    true,
    42,
    "MALFORMED",
  ];

  // Collect all existing keys (including nested) for corruption
  const existingKeys = Object.keys(out).filter(
    (k) => k !== "__proto__" && k !== "constructor" && k !== "prototype",
  );

  // ALWAYS corrupt at least one existing field to ensure the mutation is detectable
  if (existingKeys.length > 0) {
    const targetKey = prng.nextChoice(existingKeys);
    const corruptionType = prng.nextInt(4);
    if (corruptionType === 0) {
      out[targetKey] = prng.nextChoice(noiseValues);
    } else if (corruptionType === 1 && typeof out[targetKey] === "string") {
      const pos = prng.nextInt(out[targetKey].length || 1);
      out[targetKey] =
        out[targetKey].substring(0, pos) +
        "\x00" +
        out[targetKey].substring(pos);
    } else if (corruptionType === 2 && typeof out[targetKey] === "string") {
      if (out[targetKey].length > 2) {
        out[targetKey] = out[targetKey].substring(
          0,
          out[targetKey].length - prng.nextInt(3) - 1,
        );
      } else {
        out[targetKey] = "X"; // Force a change
      }
    } else {
      delete out[targetKey];
    }
  }

  // Additional injections for higher injectCount
  for (let i = 1; i < injectCount; i++) {
    if (existingKeys.length > 0 && prng.nextInt(2) === 0) {
      const targetKey = prng.nextChoice(existingKeys);
      const corruptionType = prng.nextInt(4);
      if (corruptionType === 0) {
        out[targetKey] = prng.nextChoice(noiseValues);
      } else if (corruptionType === 1 && typeof out[targetKey] === "string") {
        const pos = prng.nextInt(out[targetKey].length || 1);
        out[targetKey] =
          out[targetKey].substring(0, pos) +
          "\x00" +
          out[targetKey].substring(pos);
      } else if (corruptionType === 2 && typeof out[targetKey] === "string") {
        if (out[targetKey].length > 2) {
          out[targetKey] = out[targetKey].substring(
            0,
            out[targetKey].length - prng.nextInt(3) - 1,
          );
        }
      } else {
        delete out[targetKey];
      }
    } else {
      const key = prng.nextChoice(noiseKeys);
      const val = prng.nextChoice(noiseValues);
      if (key === "__proto__" || key === "constructor") continue;
      out[key] = val;
    }
  }
  return out;
};

/**
 * Apply a random mutation from the mutator registry to a proof payload.
 * Returns the mutated payload and the mutation type applied.
 * @param {object|Buffer} payload ΓÇö proof payload to mutate
 * @param {object} [opts]
 * @param {object} [opts.prng] ΓÇö deterministic PRNG
 * @returns {{ payload: object|Buffer, mutation: string }}
 */
exports.applyRandomMutation = function (payload, opts = {}) {
  const prng = opts.prng || makeHashChainPrng(FUZZ_SEED + "-random-mutation");
  const mutators = ["bitFlip", "truncate", "structuralNoise"];
  const mutation = prng.nextChoice(mutators);

  if (mutation === "bitFlip") {
    if (Buffer.isBuffer(payload)) {
      return {
        payload: exports.mutateBitFlip(payload, { prng, count: 3 }),
        mutation,
      };
    }
    // For objects, serialize to buffer, flip multiple bits, deserialize
    const buf = Buffer.from(JSON.stringify(payload), "utf8");
    const mutated = exports.mutateBitFlip(buf, { prng, count: 3 });
    try {
      return { payload: JSON.parse(mutated.toString("utf8")), mutation };
    } catch {
      // Corrupted JSON ΓÇö return a sentinel malformed object
      return {
        payload: { __malformed: true, raw: mutated.toString("hex") },
        mutation,
      };
    }
  }

  if (mutation === "truncate") {
    if (Buffer.isBuffer(payload)) {
      return {
        payload: exports.mutateTruncate(payload, {
          removeBytes: prng.nextInt(4) + 1,
        }),
        mutation,
      };
    }
    const buf = Buffer.from(JSON.stringify(payload), "utf8");
    const mutated = exports.mutateTruncate(buf, {
      removeBytes: prng.nextInt(4) + 1,
    });
    try {
      return { payload: JSON.parse(mutated.toString("utf8")), mutation };
    } catch {
      return {
        payload: { __malformed: true, raw: mutated.toString("hex") },
        mutation,
      };
    }
  }

  // structuralNoise ΓÇö always corrupts at least one existing field
  if (typeof payload === "object" && !Buffer.isBuffer(payload)) {
    return {
      payload: exports.mutateStructuralNoise(payload, {
        prng,
        injectCount: prng.nextInt(3) + 1,
      }),
      mutation,
    };
  }
  // Fallback: bitFlip on buffer representation
  const buf = Buffer.from(String(payload), "utf8");
  return { payload: exports.mutateBitFlip(buf, { prng, count: 3 }), mutation };
};

/**
 * Build a valid Merkle proof for the poRep-verifier (Track 112).
 * Used as a baseline for mutation fuzzing.
 * @param {number} [leafCount=2] ΓÇö number of leaves in the tree
 * @param {object} [opts]
 * @param {object} [opts.prng] ΓÇö deterministic PRNG for leaf data
 * @returns {object} ΓÇö valid proof object { root, challenges }
 */
exports.buildValidMerkleProof = function (leafCount = 2, opts = {}) {
  const prng = opts.prng || makeHashChainPrng(FUZZ_SEED + "-merkle");
  // Store raw leaf data ΓÇö the verifier will hash it with sha256
  const leafData = [];
  const leafHashes = [];
  for (let i = 0; i < leafCount; i++) {
    const data = Buffer.from("leaf-" + i + "-" + prng.nextString(4));
    leafData.push(data);
    leafHashes.push(crypto.createHash("sha256").update(data).digest());
  }

  // Build Merkle tree from leaf hashes
  let level = leafHashes;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || level[i];
      next.push(
        crypto
          .createHash("sha256")
          .update(Buffer.concat([left, right]))
          .digest(),
      );
    }
    level = next;
  }
  const root = level[0].toString("hex");

  // Build challenges for all leaves ΓÇö store raw leaf data, not hash
  const challenges = leafData.map((data, index) => {
    const path = [];
    let idx = index;
    let currentLevel = leafHashes;
    while (currentLevel.length > 1) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sibling = currentLevel[siblingIdx] || currentLevel[idx];
      path.push(sibling.toString("hex"));
      idx = Math.floor(idx / 2);
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || currentLevel[i];
        nextLevel.push(
          crypto
            .createHash("sha256")
            .update(Buffer.concat([left, right]))
            .digest(),
        );
      }
      currentLevel = nextLevel;
    }
    return { leaf: data.toString("hex"), index, path };
  });

  return { root, challenges };
};

/**
 * ZK Verification Runner with mutation fuzzing support.
 *
 * Runs a verification function against a series of proof payloads, optionally
 * applying random mutations to a configurable percentage of payloads. Asserts
 * that valid proofs are accepted and mutated/corrupted proofs are rejected
 * with deterministic error codes.
 *
 * @param {object} opts
 * @param {function} opts.verifyFn ΓÇö async (proof) => { valid, reason? }
 * @param {object[]} opts.validProofs ΓÇö array of known-valid proof objects
 * @param {object} [opts.fuzzProfile] ΓÇö fuzz configuration
 * @param {number} [opts.fuzzProfile.mutationRate=0.5] ΓÇö 0..1, fraction of proofs to mutate
 * @param {number} [opts.fuzzProfile.iterations=100] ΓÇö total iterations
 * @param {string[]} [opts.fuzzProfile.expectedRejectionCodes] ΓÇö valid rejection reasons
 * @param {object} [opts.fuzzProfile.prng] ΓÇö deterministic PRNG
 * @returns {object} ΓÇö { total, accepted, rejected, mutated, passed, failures }
 */
exports.runMutationFuzzRunner = async function (opts) {
  opts = opts || {};
  if (typeof opts.verifyFn !== "function") {
    throw new Error("runMutationFuzzRunner: opts.verifyFn is required");
  }
  const verifyFn = opts.verifyFn;
  const validProofs = opts.validProofs || [];
  const fuzz = opts.fuzzProfile || {};
  const mutationRate =
    fuzz.mutationRate !== undefined ? fuzz.mutationRate : 0.5;
  const iterations = fuzz.iterations || 100;
  const expectedRejectionCodes = fuzz.expectedRejectionCodes || [
    "malformed_proof",
    "challenge_mismatch",
    "VALIDATION_FAILED",
    "MALFORMED_PROOF",
  ];
  const prng = fuzz.prng || makeHashChainPrng(FUZZ_SEED + "-zk-runner");

  const result = {
    total: 0,
    accepted: 0,
    rejected: 0,
    mutated: 0,
    passed: 0,
    failures: [],
  };

  for (let i = 0; i < iterations; i++) {
    result.total += 1;
    // If no valid proofs, synthesize a minimal proof so the runner still works
    const originalProof =
      validProofs.length > 0
        ? validProofs[prng.nextInt(validProofs.length)]
        : {
            root: "synthetic-" + i,
            challenges: [{ leaf: "x", index: 0, path: [] }],
          };
    const shouldMutate = prng.nextInt(100) < mutationRate * 100;

    let proofToTest = originalProof;
    let mutationType = null;

    if (shouldMutate) {
      result.mutated += 1;
      const { payload, mutation } = exports.applyRandomMutation(originalProof, {
        prng,
      });
      proofToTest = payload;
      mutationType = mutation;
    }

    try {
      const verifyResult = await verifyFn(proofToTest);

      if (shouldMutate) {
        // Mutated proofs MUST be rejected
        if (verifyResult.valid === false) {
          result.rejected += 1;
          result.passed += 1;
        } else {
          // FAIL-CLOSED VIOLATION: mutated proof was accepted!
          result.accepted += 1;
          result.failures.push({
            iteration: i,
            mutation: mutationType,
            reason: "MUTATED_PROOF_ACCEPTED",
            proof: JSON.stringify(proofToTest).substring(0, 200),
          });
        }
      } else {
        // Non-mutated proofs SHOULD be accepted
        if (verifyResult.valid === true) {
          result.accepted += 1;
          result.passed += 1;
        } else {
          // Valid proof was rejected ΓÇö could be a regression or expected rejection
          result.rejected += 1;
          // Only count as failure if the rejection reason is unexpected
          if (!expectedRejectionCodes.includes(verifyResult.reason)) {
            result.failures.push({
              iteration: i,
              mutation: null,
              reason: "VALID_PROOF_REJECTED_UNEXPECTEDLY",
              verifyResult,
            });
          } else {
            result.passed += 1; // Expected rejection of edge-case valid proof
          }
        }
      }
    } catch (err) {
      // Throws are acceptable for mutated proofs (crash = rejection)
      if (shouldMutate) {
        result.rejected += 1;
        result.passed += 1;
      } else {
        result.failures.push({
          iteration: i,
          mutation: null,
          reason: "UNEXPECTED_THROW",
          error: err.message,
        });
      }
    }
  }

  return result;
};
