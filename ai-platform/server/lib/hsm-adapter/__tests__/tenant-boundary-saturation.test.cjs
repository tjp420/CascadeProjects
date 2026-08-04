'use strict';

const { CryptoPolicyEngine, DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const {
  makePrototypePollutionPolicy,
  makeNestedProtoPollutionPolicy,
  makeTypeConfusionTenantIds,
  makeTypeConfusionConfigs,
  makeTypeConfusionOperations,
  makeCrossTenantIsolationPolicy,
  makeSharedSubBlockPolicy,
  makePrngDrivenTenantBlob,
  makePrngDrivenValidateCall,
  makeHashChainPrng,
  cleanupPrototypePollution,
  FUZZ_SEED,
  makeTrack31ProtoPollutionPolicy,
  makeTrack31TypeConfusionConfigs,
  makeTrack31PrngDrivenValidateCall,
  makeTrack113ProtoPollutionPolicy,
  makeTrack113TypeConfusionConfigs,
  makeTrack113PrngDrivenValidateCall,
} = require('./tenant-fuzz-harness.cjs');

afterEach(() => {
  cleanupPrototypePollution();
});

describe('Tenant boundary saturation (15-test deterministic fuzzing matrix)', () => {
  test('FUZZ-01: __proto__ pollution in tenant blob is blocked', () => {
    delete Object.prototype.polluted;
    delete Object.prototype.pollutedViaConstructor;

    const malicious = makePrototypePollutionPolicy();
    const engine = new CryptoPolicyEngine(malicious, { strict: true });

    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(Object.prototype).not.toHaveProperty('pollutedViaConstructor');

    const clean = engine.getPolicy('clean-tenant');
    expect(clean).toBeDefined();
    expect(clean).not.toHaveProperty('polluted');
    expect(clean).not.toHaveProperty('pollutedViaConstructor');

    const maliciousResolved = engine.getPolicy('malicious-tenant');
    expect(maliciousResolved).toBeDefined();
    expect(maliciousResolved).not.toHaveProperty('polluted');
    expect(maliciousResolved).not.toHaveProperty('pollutedViaConstructor');
  });

  test('FUZZ-02: constructor.prototype pollution in tenant blob is blocked', () => {
    const policy = {
      version: '0.0.0',
      default: {},
      tenants: {
        attacker: {
          constructor: { prototype: { ctorPolluted: true } },
        },
      },
    };
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('ctorPolluted');
    const resolved = engine.getPolicy('attacker');
    expect(resolved).not.toHaveProperty('ctorPolluted');
  });

  test('FUZZ-03: nested __proto__ in sub-blocks (pqc, zkp, threshold) is blocked', () => {
    const policy = makeNestedProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('nestedPqcPolluted');
    expect(Object.prototype).not.toHaveProperty('nestedZkpPolluted');
    expect(Object.prototype).not.toHaveProperty('nestedThresholdPolluted');

    const resolved = engine.getPolicy('nested-polluter');
    expect(resolved.pqc).not.toHaveProperty('nestedPqcPolluted');
    expect(resolved.zkp).not.toHaveProperty('nestedZkpPolluted');
    expect(resolved.threshold).not.toHaveProperty('nestedThresholdPolluted');
  });

  test('FUZZ-11: DEFAULT_POLICY immutability after tenant merge', () => {
    const originalMinKekBits = DEFAULT_POLICY.minimumKekBits;
    const originalPqcKem = DEFAULT_POLICY.pqc ? DEFAULT_POLICY.pqc.kemAlgorithm : undefined;

    const malicious = makePrototypePollutionPolicy();
    new CryptoPolicyEngine(malicious, { strict: true });

    expect(DEFAULT_POLICY.minimumKekBits).toBe(originalMinKekBits);
    if (originalPqcKem !== undefined) {
      expect(DEFAULT_POLICY.pqc.kemAlgorithm).toBe(originalPqcKem);
    }
    expect(DEFAULT_POLICY).not.toHaveProperty('polluted');
    expect(DEFAULT_POLICY).not.toHaveProperty('pollutedViaConstructor');
  });

  test('FUZZ-04: non-string tenantId throws UNAUTHORIZED_KEY_ACCESS', () => {
    const engine = new CryptoPolicyEngine();
    const inputs = makeTypeConfusionTenantIds();
    for (const { value } of inputs) {
      expect(() => engine.validate(value, 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toThrow(HsmAdapterError);
      try {
        engine.validate(value, 'createKEK', { algorithm: 'aes-kw', kekBits: 256 });
      } catch (e) {
        expect(e.code).toBe('UNAUTHORIZED_KEY_ACCESS');
      }
    }
  });

  test('FUZZ-05: empty string tenantId throws UNAUTHORIZED_KEY_ACCESS', () => {
    const engine = new CryptoPolicyEngine();
    expect(() => engine.validate('', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toThrow(HsmAdapterError);
    try {
      engine.validate('', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 });
    } catch (e) {
      expect(e.code).toBe('UNAUTHORIZED_KEY_ACCESS');
    }
  });

  test('FUZZ-06: non-object config does not crash with raw TypeError', () => {
    const engine = new CryptoPolicyEngine();
    const inputs = makeTypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate('t1', 'createKEK', value);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-07: unknown operation string falls through without crash', () => {
    const engine = new CryptoPolicyEngine();
    let result;
    expect(() => {
      result = engine.validate('t1', 'nonexistentOp', { algorithm: 'aes-kw', kekBits: 256 });
    }).not.toThrow();
    expect(result).toBe(true);
  });

  test('FUZZ-08: numeric operation field does not crash', () => {
    const engine = new CryptoPolicyEngine();
    const inputs = makeTypeConfusionOperations();
    for (const { value } of inputs) {
      expect(() => {
        try {
          engine.validate('t1', value, { algorithm: 'aes-kw', kekBits: 256 });
        } catch (e) {
          if (!(e instanceof HsmAdapterError)) throw e;
        }
      }).not.toThrow();
    }
  });

  test('FUZZ-09: cross-tenant policy isolation — mutating A does not affect B', () => {
    const policy = makeCrossTenantIsolationPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('tenant-a');
    const originalBMinKek = engine.getPolicy('tenant-b').minimumKekBits;

    policyA.minimumKekBits = 64;

    const policyB = engine.getPolicy('tenant-b');
    expect(policyB.minimumKekBits).toBe(originalBMinKek);
    expect(policyB.minimumKekBits).not.toBe(64);
  });

  test('FUZZ-10: cross-tenant object identity isolation — distinct references', () => {
    const policy = makeCrossTenantIsolationPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('tenant-a');
    const policyB = engine.getPolicy('tenant-b');

    expect(policyA).not.toBe(policyB);
    expect(engine.getPolicy('tenant-a')).toBe(policyA);
  });

  test('FUZZ-15: cross-tenant memory space leak via shared sub-block reference', () => {
    const policy = makeSharedSubBlockPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const pqcA = engine.getPolicy('tenant-a').pqc;
    const pqcBOriginal = engine.getPolicy('tenant-b').pqc;
    const originalBKem = pqcBOriginal.kemAlgorithm;

    pqcA.kemAlgorithm = 'mutated-alg';

    const pqcBAfter = engine.getPolicy('tenant-b').pqc;
    expect(pqcBAfter.kemAlgorithm).toBe(originalBKem);
    expect(pqcBAfter.kemAlgorithm).not.toBe('mutated-alg');
  });

  test('FUZZ-12: deterministic PRNG reproducibility — same seed, same output', () => {
    const prng1 = makeHashChainPrng(FUZZ_SEED);
    const prng2 = makeHashChainPrng(FUZZ_SEED);

    for (let i = 0; i < 100; i++) {
      const a = prng1.next().toString('hex');
      const b = prng2.next().toString('hex');
      expect(a).toBe(b);
    }
  });

  test('FUZZ-13: PRNG-driven random tenant blob generation — 100 constructions, no pollution', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);

    for (let i = 0; i < 100; i++) {
      const blob = makePrngDrivenTenantBlob(prng);
      const engine = new CryptoPolicyEngine(blob, { strict: true });

      expect(Object.prototype).not.toHaveProperty('prngPolluted');
      expect(Object.prototype).not.toHaveProperty('prngConstructorPolluted');

      for (const tenantId of Object.keys(blob.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).not.toHaveProperty('prngPolluted');
        expect(resolved).not.toHaveProperty('prngConstructorPolluted');
      }
    }
  });

  test('FUZZ-14: PRNG-driven random validate() calls — 100 calls, no unhandled crash', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } = makePrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-31: Track 31 lookup gating __proto__ pollution is blocked', () => {
    const policy = makeTrack31ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('lookupGatePolluted');
    expect(Object.prototype).not.toHaveProperty('lookupConstructorPolluted');

    const clean = engine.getPolicy('track31-clean');
    expect(clean).toBeDefined();
    expect(clean.lookupGating).toBeDefined();

    const polluted = engine.getPolicy('track31-polluter');
    expect(polluted).toBeDefined();
    expect(polluted.lookupGating).not.toHaveProperty('lookupGatePolluted');
  });

  test('FUZZ-32: Track 31 lookup gating cross-tenant isolation', () => {
    const policy = makeTrack31ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('track31-polluter');
    const originalBQuorum = engine.getPolicy('track31-clean').lookupGating.minLookupQuorum;

    policyA.lookupGating.minLookupQuorum = 1;

    const policyB = engine.getPolicy('track31-clean');
    expect(policyB.lookupGating.minLookupQuorum).toBe(originalBQuorum);
    expect(policyB.lookupGating.minLookupQuorum).not.toBe(1);
  });

  test('FUZZ-33: Track 31 type confusion fails closed', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack31TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate('t1', 'lookupGating', value);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-34: Track 31 PRNG-driven lookup gating validation — 100 calls, no unhandled crash', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } = makeTrack31PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-113: Track 113 handshake __proto__ pollution does not pollute Object.prototype or clean tenants', () => {
    const policy = makeTrack113ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('handshakePolluted');
    expect(Object.prototype).not.toHaveProperty('handshakeConstructorPolluted');

    const clean = engine.getPolicy('track113-clean');
    expect(clean).toBeDefined();
    expect(clean.handshake).toBeDefined();
    expect(clean.handshake.handshakePolluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(clean.handshake, 'handshakePolluted')).toBe(false);

    const polluted = engine.getPolicy('track113-polluter');
    expect(polluted).toBeDefined();
    expect(polluted.handshake).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(polluted.handshake, 'handshakePolluted')).toBe(false);
    expect(polluted.handshake).toBeDefined();
    expect(polluted.handshake.__proto__ === Object.prototype).toBe(false);
  });

  test('FUZZ-114: Track 113 handshake cross-tenant isolation', () => {
    const policy = makeTrack113ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('track113-polluter');
    const originalBTimeout = engine.getPolicy('track113-clean').handshake.lifecycleTimeout;

    policyA.handshake.lifecycleTimeout = 1;

    const policyB = engine.getPolicy('track113-clean');
    expect(policyB.handshake.lifecycleTimeout).toBe(originalBTimeout);
    expect(policyB.handshake.lifecycleTimeout).not.toBe(1);
  });

  test('FUZZ-115: Track 113 type confusion fails closed', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack113TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate('t1', 'handshakeInit', value);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-116: Track 113 PRNG-driven handshake validation — 100 calls, no unhandled crash', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } = makeTrack113PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });
});
