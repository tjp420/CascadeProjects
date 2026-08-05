'use strict';

const {
  makeHashChainPrng,
  FUZZ_SEED,
  mutateBitFlip,
  mutateTruncate,
  mutateStructuralNoise,
  applyRandomMutation,
  buildValidMerkleProof,
  runZkVerificationRunner,
} = require('./tenant-fuzz-harness.cjs');

const PoRepVerifier = require('../track112/poRep-verifier.cjs');

describe('Post-Quantum Mutation Fuzzing Utilities', () => {

  describe('mutateBitFlip', () => {
    test('MUT-01: flips exactly one bit by default', () => {
      const original = Buffer.from('hello world', 'utf8');
      const mutated = mutateBitFlip(original);
      expect(mutated.length).toBe(original.length);
      let diffBytes = 0;
      for (let i = 0; i < original.length; i++) {
        if (original[i] !== mutated[i]) diffBytes++;
      }
      expect(diffBytes).toBe(1);
    });

    test('MUT-02: flips multiple bits when count specified', () => {
      const original = Buffer.from('test-payload-12345', 'utf8');
      const prng = makeHashChainPrng(FUZZ_SEED + '-multi-flip');
      const mutated = mutateBitFlip(original, { count: 5, prng });
      let diffBytes = 0;
      for (let i = 0; i < original.length; i++) {
        if (original[i] !== mutated[i]) diffBytes++;
      }
      expect(diffBytes).toBeGreaterThan(0);
      expect(diffBytes).toBeLessThanOrEqual(5);
    });

    test('MUT-03: does not modify original buffer', () => {
      const original = Buffer.from('immutable', 'utf8');
      const originalCopy = Buffer.from(original);
      mutateBitFlip(original);
      expect(original.equals(originalCopy)).toBe(true);
    });

    test('MUT-04: is deterministic with same PRNG seed', () => {
      const original = Buffer.from('deterministic-test', 'utf8');
      const prng1 = makeHashChainPrng(FUZZ_SEED + '-det-1');
      const prng2 = makeHashChainPrng(FUZZ_SEED + '-det-1');
      const m1 = mutateBitFlip(original, { prng: prng1 });
      const m2 = mutateBitFlip(original, { prng: prng2 });
      expect(m1.equals(m2)).toBe(true);
    });

    test('MUT-05: handles non-Buffer input by converting', () => {
      const mutated = mutateBitFlip('string-input');
      expect(Buffer.isBuffer(mutated)).toBe(true);
      expect(mutated.length).toBeGreaterThan(0);
    });

    test('MUT-06: produces different output with different seeds', () => {
      const original = Buffer.from('seed-difference-test', 'utf8');
      const prng1 = makeHashChainPrng(FUZZ_SEED + '-seed-a');
      const prng2 = makeHashChainPrng(FUZZ_SEED + '-seed-b');
      const m1 = mutateBitFlip(original, { prng: prng1 });
      const m2 = mutateBitFlip(original, { prng: prng2 });
      expect(m1.equals(m2)).toBe(false);
    });
  });

  describe('mutateTruncate', () => {
    test('MUT-07: removes bytes from end by default', () => {
      const original = Buffer.from('0123456789', 'utf8');
      const mutated = mutateTruncate(original, { removeBytes: 3 });
      expect(mutated.length).toBe(7);
      expect(mutated.toString('utf8')).toBe('0123456');
    });

    test('MUT-08: removes bytes from beginning when fromEnd=false', () => {
      const original = Buffer.from('0123456789', 'utf8');
      const mutated = mutateTruncate(original, { removeBytes: 3, fromEnd: false });
      expect(mutated.length).toBe(7);
      expect(mutated.toString('utf8')).toBe('3456789');
    });

    test('MUT-09: does not modify original buffer', () => {
      const original = Buffer.from('immutable-truncate', 'utf8');
      const originalCopy = Buffer.from(original);
      mutateTruncate(original, { removeBytes: 5 });
      expect(original.equals(originalCopy)).toBe(true);
    });

    test('MUT-10: returns empty buffer when removing all bytes', () => {
      const original = Buffer.from('short', 'utf8');
      const mutated = mutateTruncate(original, { removeBytes: 10 });
      expect(mutated.length).toBe(0);
    });

    test('MUT-11: removes exactly one byte by default', () => {
      const original = Buffer.from('exactly-one', 'utf8');
      const mutated = mutateTruncate(original);
      expect(mutated.length).toBe(original.length - 1);
    });
  });

  describe('mutateStructuralNoise', () => {
    test('MUT-12: mutates payload structure (corrupts or injects)', () => {
      const original = { root: 'abc123', challenges: [] };
      const prng = makeHashChainPrng(FUZZ_SEED + '-noise-1');
      const mutated = mutateStructuralNoise(original, { prng, injectCount: 3 });
      // Payload should differ from original (corrupted field or injected key)
      expect(JSON.stringify(mutated)).not.toEqual(JSON.stringify(original));
    });

    test('MUT-13: does not modify original payload', () => {
      const original = { root: 'abc', challenges: [{ leaf: 'x', index: 0, path: [] }] };
      const originalCopy = JSON.parse(JSON.stringify(original));
      mutateStructuralNoise(original, { injectCount: 5 });
      expect(original).toEqual(originalCopy);
    });

    test('MUT-14: can inject null bytes into string fields', () => {
      const original = { root: 'abcdef123456', challenges: [] };
      const prng = makeHashChainPrng(FUZZ_SEED + '-null-inject');
      let foundNullByte = false;
      for (let i = 0; i < 20; i++) {
        const mutated = mutateStructuralNoise(original, { prng, injectCount: 3 });
        if (mutated.root && mutated.root.includes('\x00')) {
          foundNullByte = true;
          break;
        }
      }
      expect(foundNullByte).toBe(true);
    });

    test('MUT-15: handles non-object input gracefully', () => {
      const mutated = mutateStructuralNoise('not-an-object');
      expect(mutated).toBe('not-an-object');
    });

    test('MUT-16: skips __proto__ and constructor injection', () => {
      const original = { data: 'test' };
      const mutated = mutateStructuralNoise(original, { injectCount: 10 });
      expect(Object.prototype).not.toHaveProperty('polluted');
      expect(Object.keys(mutated).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('applyRandomMutation', () => {
    test('MUT-17: returns mutation type descriptor', () => {
      const payload = { root: 'abc', challenges: [{ leaf: 'x', index: 0, path: [] }] };
      const { mutation } = applyRandomMutation(payload);
      expect(['bitFlip', 'truncate', 'structuralNoise']).toContain(mutation);
    });

    test('MUT-18: is deterministic with same PRNG', () => {
      const payload = { root: 'abc123', challenges: [] };
      const prng1 = makeHashChainPrng(FUZZ_SEED + '-apply-1');
      const prng2 = makeHashChainPrng(FUZZ_SEED + '-apply-1');
      const r1 = applyRandomMutation(payload, { prng: prng1 });
      const r2 = applyRandomMutation(payload, { prng: prng2 });
      expect(r1.mutation).toBe(r2.mutation);
      expect(JSON.stringify(r1.payload)).toBe(JSON.stringify(r2.payload));
    });

    test('MUT-19: handles Buffer payloads', () => {
      const buf = Buffer.from('binary-payload-data', 'utf8');
      const { payload, mutation } = applyRandomMutation(buf);
      expect(['bitFlip', 'truncate']).toContain(mutation);
      expect(Buffer.isBuffer(payload) || typeof payload === 'object').toBe(true);
    });
  });

  describe('buildValidMerkleProof', () => {
    test('MUT-20: builds a valid 2-leaf Merkle proof', () => {
      const proof = buildValidMerkleProof(2);
      expect(proof.root).toBeDefined();
      expect(proof.challenges).toHaveLength(2);
      expect(proof.challenges[0].path).toHaveLength(1);
      expect(proof.challenges[1].path).toHaveLength(1);
    });

    test('MUT-21: builds a valid 4-leaf Merkle proof', () => {
      const proof = buildValidMerkleProof(4);
      expect(proof.root).toBeDefined();
      expect(proof.challenges).toHaveLength(4);
      expect(proof.challenges[0].path).toHaveLength(2);
    });

    test('MUT-22: proof verifies against poRep-verifier', async () => {
      const verifier = new PoRepVerifier();
      const proof = buildValidMerkleProof(2);
      const result = await verifier.verify(proof);
      expect(result.valid).toBe(true);
    });

    test('MUT-23: is deterministic with same PRNG seed', () => {
      const p1 = buildValidMerkleProof(2, { prng: makeHashChainPrng(FUZZ_SEED + '-merkle-det') });
      const p2 = buildValidMerkleProof(2, { prng: makeHashChainPrng(FUZZ_SEED + '-merkle-det') });
      expect(p1.root).toBe(p2.root);
    });
  });
});

describe('runZkVerificationRunner — Fail-Closed Mutation Fuzzing', () => {
  test('ZK-RUN-01: valid proofs are accepted without mutation', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2);
    const result = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs: [validProof],
      fuzzProfile: {
        mutationRate: 0.0,
        iterations: 20,
      },
    });
    expect(result.total).toBe(20);
    expect(result.mutated).toBe(0);
    expect(result.accepted).toBe(20);
    expect(result.failures).toHaveLength(0);
  });

  test('ZK-RUN-02: 100% mutation rate rejects all mutated proofs', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2);
    const result = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs: [validProof],
      fuzzProfile: {
        mutationRate: 1.0,
        iterations: 50,
      },
    });
    expect(result.total).toBe(50);
    expect(result.mutated).toBe(50);
    expect(result.failures.filter(f => f.reason === 'MUTATED_PROOF_ACCEPTED')).toHaveLength(0);
    expect(result.rejected).toBe(50);
  });

  test('ZK-RUN-03: 50% mutation rate produces mix of accepted and rejected', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2, {
      prng: makeHashChainPrng(FUZZ_SEED + '-zk-run-3'),
    });
    const result = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs: [validProof],
      fuzzProfile: {
        mutationRate: 0.5,
        iterations: 100,
        prng: makeHashChainPrng(FUZZ_SEED + '-zk-run-3-runner'),
      },
    });
    expect(result.total).toBe(100);
    expect(result.mutated).toBeGreaterThan(0);
    expect(result.accepted).toBeGreaterThan(0);
    expect(result.failures.filter(f => f.reason === 'MUTATED_PROOF_ACCEPTED')).toHaveLength(0);
  });

  test('ZK-RUN-04: fail-closed invariant — no mutated proof is ever accepted', async () => {
    const verifier = new PoRepVerifier();
    const validProofs = [
      buildValidMerkleProof(2, { prng: makeHashChainPrng(FUZZ_SEED + '-inv-2') }),
      buildValidMerkleProof(4, { prng: makeHashChainPrng(FUZZ_SEED + '-inv-4') }),
    ];
    const result = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs,
      fuzzProfile: {
        mutationRate: 0.8,
        iterations: 200,
        prng: makeHashChainPrng(FUZZ_SEED + '-inv-runner'),
      },
    });
    const acceptedMutated = result.failures.filter(f => f.reason === 'MUTATED_PROOF_ACCEPTED');
    expect(acceptedMutated).toHaveLength(0);
    expect(result.mutated).toBeGreaterThan(0);
    expect(result.passed).toBe(result.total);
  });

  test('ZK-RUN-05: rejects on missing verifyFn', async () => {
    const result = runZkVerificationRunner({});
    await expect(result).rejects.toThrow('verifyFn');
  });

  test('ZK-RUN-06: handles empty validProofs array gracefully', async () => {
    const result = await runZkVerificationRunner({
      verifyFn: () => ({ valid: true }),
      validProofs: [],
      fuzzProfile: { iterations: 10 },
    });
    expect(result.total).toBe(10);
  });

  test('ZK-RUN-07: handles verifyFn that throws on mutated input', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2);
    const result = await runZkVerificationRunner({
      verifyFn: (proof) => {
        if (proof.__malformed) throw new Error('PARSE_ERROR');
        return verifier.verify(proof);
      },
      validProofs: [validProof],
      fuzzProfile: {
        mutationRate: 1.0,
        iterations: 50,
      },
    });
    expect(result.mutated).toBe(50);
    expect(result.failures.filter(f => f.reason === 'MUTATED_PROOF_ACCEPTED')).toHaveLength(0);
  });

  test('ZK-RUN-08: deterministic results with same PRNG seed', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2, {
      prng: makeHashChainPrng(FUZZ_SEED + '-det-run'),
    });
    const r1 = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs: [validProof],
      fuzzProfile: {
        mutationRate: 0.5,
        iterations: 50,
        prng: makeHashChainPrng(FUZZ_SEED + '-det-runner'),
      },
    });
    const r2 = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs: [validProof],
      fuzzProfile: {
        mutationRate: 0.5,
        iterations: 50,
        prng: makeHashChainPrng(FUZZ_SEED + '-det-runner'),
      },
    });
    expect(r1.mutated).toBe(r2.mutated);
    expect(r1.accepted).toBe(r2.accepted);
    expect(r1.rejected).toBe(r2.rejected);
  });

  test('ZK-RUN-09: bitFlip mutation on proof root causes rejection', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2);
    const rootBuf = Buffer.from(validProof.root, 'hex');
    const mutatedRoot = mutateBitFlip(rootBuf);
    const mutatedProof = { ...validProof, root: mutatedRoot.toString('hex') };
    const result = await verifier.verify(mutatedProof);
    expect(result.valid).toBe(false);
  });

  test('ZK-RUN-10: truncate mutation on proof leaf causes rejection', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2);
    const leafBuf = Buffer.from(validProof.challenges[0].leaf, 'hex');
    const truncatedLeaf = mutateTruncate(leafBuf, { removeBytes: 4 });
    const mutatedProof = {
      ...validProof,
      challenges: validProof.challenges.map((ch, i) =>
        i === 0 ? { ...ch, leaf: truncatedLeaf.toString('hex') } : ch
      ),
    };
    const result = await verifier.verify(mutatedProof);
    expect(result.valid).toBe(false);
  });

  test('ZK-RUN-11: structuralNoise on proof causes rejection or malformed', async () => {
    const verifier = new PoRepVerifier();
    const validProof = buildValidMerkleProof(2);
    const noisedProof = mutateStructuralNoise(validProof, { injectCount: 5 });
    const result = await verifier.verify(noisedProof);
    expect(result.valid).toBe(false);
  });

  test('ZK-RUN-12: high-volume stress run (500 iterations) maintains fail-closed', async () => {
    const verifier = new PoRepVerifier();
    const validProofs = [
      buildValidMerkleProof(2, { prng: makeHashChainPrng(FUZZ_SEED + '-stress-2') }),
      buildValidMerkleProof(4, { prng: makeHashChainPrng(FUZZ_SEED + '-stress-4') }),
      buildValidMerkleProof(1, { prng: makeHashChainPrng(FUZZ_SEED + '-stress-1') }),
    ];
    const result = await runZkVerificationRunner({
      verifyFn: (proof) => verifier.verify(proof),
      validProofs,
      fuzzProfile: {
        mutationRate: 0.7,
        iterations: 500,
        prng: makeHashChainPrng(FUZZ_SEED + '-stress-runner'),
      },
    });
    expect(result.total).toBe(500);
    expect(result.mutated).toBeGreaterThan(100);
    expect(result.failures.filter(f => f.reason === 'MUTATED_PROOF_ACCEPTED')).toHaveLength(0);
    expect(result.passed).toBe(result.total);
  });
});
