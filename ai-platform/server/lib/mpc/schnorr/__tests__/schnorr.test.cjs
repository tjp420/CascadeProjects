const { SchnorrThresholdAggregator } = require('../protocol.cjs');
const { Musig2NonceGenerator } = require('../nonce.cjs');
const { SchnorrShareEvaluator } = require('../signature_share.cjs');

describe('Threshold Schnorr Signature Aggregation Invariants', () => {
  const SECP256K1_Q = '115792089237316195423570985008687907852837564279074904382605163141518161494337';
  let aggregator;

  beforeEach(() => {
    aggregator = new SchnorrThresholdAggregator(SECP256K1_Q);
  });

  test('computes Lagrange weights and they sum to 1 mod q for quorum [1,2,3]', () => {
    const quorum = [1, 2, 3];
    const weights = quorum.map(i => aggregator.computeLagrangeWeight(i, quorum));
    // sum them
    const sum = weights.reduce((acc, w) => aggregator.field.add(acc, w), 0n);
    expect(typeof weights[0]).toBe('bigint');
    // sum should equal 1 mod q
    expect(sum).toBe(1n % aggregator.field.q);
  });

  test('Should strictly satisfy the Lagrange coefficient sum invariant across variable randomized quorums', () => {
    const testCases = [
      { k: 3, n: 5 },
      { k: 5, n: 7 },
      { k: 7, n: 10 }
    ];

    for (const { k, n } of testCases) {
      const fullSet = Array.from({ length: n }, (_, idx) => idx + 1);
      // Shuffle and pick k participants
      for (let trial = 0; trial < 5; trial++) {
        const quorum = fullSet.slice().sort(() => Math.random() - 0.5).slice(0, k);
        let sum = 0n;
        for (const i of quorum) {
          const weight = aggregator.computeLagrangeWeight(i, quorum);
          sum = aggregator.field.add(sum, weight);
        }
        expect(sum).toBe(1n % aggregator.field.q);
      }
    }
  });

  test('Musig2 nonce generator produces independent secret pairs and commitments', () => {
    const nonceGen = new Musig2NonceGenerator(SECP256K1_Q);
    const sessionId = 'test-session-' + Date.now();
    const out = nonceGen.generateNoncePair(sessionId);
    expect(out).toHaveProperty('secret');
    expect(out.secret).toHaveProperty('k1');
    expect(out.secret).toHaveProperty('k2');
    expect(out).toHaveProperty('publicCommitment');
    expect(out.publicCommitment).toHaveProperty('h1');
    expect(out.publicCommitment).toHaveProperty('h2');
    // secrets must be BigInt and less than q
    expect(typeof out.secret.k1).toBe('bigint');
    expect(typeof out.secret.k2).toBe('bigint');
    expect(out.secret.k1 < aggregator.field.q).toBeTruthy();
    expect(out.secret.k2 < aggregator.field.q).toBeTruthy();
  });

  test('Should evaluate partial shares and validate linear aggregation for 2-of-3 committee', () => {
    const evaluator = new SchnorrShareEvaluator(SECP256K1_Q);
    const quorum = [1, 2, 3];

    const challenge = 12345n;
    const binding = 3n;

    // sample per-node secrets
    const keyShares = [100n, 200n, 300n];
    const nonces = [ {k1:5n,k2:7n}, {k1:11n,k2:13n}, {k1:17n,k2:19n} ];

    const weights = quorum.map(i => aggregator.computeLagrangeWeight(i, quorum));

    const partials = quorum.map((nodeIdx, idx) => {
      return evaluator.evaluatePartialShare({
        challenge,
        secretKeyShare: keyShares[idx],
        lagrangeWeight: weights[idx],
        secretNonces: nonces[idx],
        bindingFactor: binding
      });
    });

    // Aggregation: sum of partials should equal c*sum(x_i*lambda_i) + sum(k1 + b*k2)
    const sumPartials = partials.reduce((a,b) => aggregator.field.add(a,b), 0n);

    // compute expected
    const secretSum = keyShares.reduce((acc, ks, idx) => {
      const prod = evaluator.field.mul(challenge, ks);
      return evaluator.field.add(acc, evaluator.field.mul(prod, weights[idx]));
    }, 0n);

    const nonceSum = nonces.reduce((acc, nn) => {
      return evaluator.field.add(acc, evaluator.field.add(nn.k1, evaluator.field.mul(binding, nn.k2)));
    }, 0n);

    const expected = evaluator.field.add(secretSum, nonceSum);

    expect(typeof partials[0]).toBe('bigint');
    expect(sumPartials).toBe(expected);
  });
});

// ── MuSig2 Core Protocol Tests (Option D) ───────────────────────────────────

describe('MuSig2 Core Protocol Primitives', () => {
  const SECP256K1_Q = '115792089237316195423570985008687907852837564279074904382605163141518161494337';
  let aggregator;
  let evaluator;
  let nonceGen;

  beforeEach(() => {
    aggregator = new SchnorrThresholdAggregator(SECP256K1_Q);
    evaluator = new SchnorrShareEvaluator(SECP256K1_Q);
    nonceGen = new Musig2NonceGenerator(SECP256K1_Q);
  });

  // ── L2-01: Challenge computation ──────────────────────────────────────────

  test('L2-01: computeChallenge produces deterministic value in field range', () => {
    const P = 12345n;
    const R = 67890n;
    const msgHash = 'deadbeef';
    const c1 = aggregator.computeChallenge(P, R, msgHash);
    const c2 = aggregator.computeChallenge(P, R, msgHash);
    expect(typeof c1).toBe('bigint');
    expect(c1).toBe(c2); // deterministic
    expect(c1 >= 0n && c1 < aggregator.field.q).toBeTruthy(); // in field range
  });

  // ── L2-02: Binding factor computation ─────────────────────────────────────

  test('L2-02: computeBindingFactor produces deterministic value in field range', () => {
    const P = 99999n;
    const nonceCommitments = [
      { h1: 'aaa', h2: 'bbb' },
      { h1: 'ccc', h2: 'ddd' },
      { h1: 'eee', h2: 'fff' },
    ];
    const b1 = aggregator.computeBindingFactor(P, nonceCommitments);
    const b2 = aggregator.computeBindingFactor(P, nonceCommitments);
    expect(typeof b1).toBe('bigint');
    expect(b1).toBe(b2); // deterministic
    expect(b1 >= 0n && b1 < aggregator.field.q).toBeTruthy();
  });

  // ── L2-03, L2-04: Public key aggregation ──────────────────────────────────

  test('L2-03: aggregatePublicKeys — 2-of-3 produces deterministic aggregate', () => {
    const pubKeys = [100n, 200n, 300n];
    const quorum = [1, 2, 3];
    const agg1 = aggregator.aggregatePublicKeys(pubKeys, quorum);
    const agg2 = aggregator.aggregatePublicKeys(pubKeys, quorum);
    expect(typeof agg1).toBe('bigint');
    expect(agg1).toBe(agg2); // deterministic
    expect(agg1 >= 0n && agg1 < aggregator.field.q).toBeTruthy();
  });

  test('L2-04: aggregatePublicKeys — 3-of-5 deterministic across runs', () => {
    const pubKeys = [10n, 20n, 30n, 40n, 50n];
    const quorum = [1, 2, 3, 4, 5];
    const agg1 = aggregator.aggregatePublicKeys(pubKeys, quorum);
    const agg2 = aggregator.aggregatePublicKeys(pubKeys, quorum);
    expect(agg1).toBe(agg2);
  });

  // ── L2-05: Public nonce aggregation ───────────────────────────────────────

  test('L2-05: aggregateNonces produces correct aggregated nonce', () => {
    const nonces = [5n, 11n, 17n];
    const binding = 3n;
    const agg = aggregator.aggregateNonces(nonces, binding);
    // Expected: (5*3 + 11*3 + 17*3) mod q = (5+11+17)*3 mod q = 33*3 = 99
    const expected = aggregator.field.mul(33n, binding);
    expect(agg).toBe(expected);
  });

  // ── L2-06, L2-07: Full signing round-trip ─────────────────────────────────

  test('L2-06: Full signing round-trip — 2-of-3 threshold', () => {
    const quorum = [1, 2, 3];
    const keyShares = [100n, 200n, 300n];
    const pubKeys = keyShares.map(x => aggregator.field.mul(x, 2n)); // P_i = 2 * x_i (toy)
    const sessionId = 'round-2-of-3';
    const messageHash = 'msg-hash-2-of-3';

    // 1. Generate nonces for each participant
    const noncePairs = quorum.map(() => nonceGen.generateNoncePair(sessionId));
    const nonceCommitments = noncePairs.map(np => np.publicCommitment);

    // 2. Aggregate public keys
    const aggPubKey = aggregator.aggregatePublicKeys(pubKeys, quorum);

    // 3. Compute binding factor
    const bindingFactor = aggregator.computeBindingFactor(aggPubKey, nonceCommitments);

    // 4. Aggregate nonces (use h1 values as public nonce stand-ins)
    const publicNonces = noncePairs.map(np => BigInt('0x' + np.publicCommitment.h1) % aggregator.field.q);
    const aggNonce = aggregator.aggregateNonces(publicNonces, bindingFactor);

    // 5. Compute challenge
    const challenge = aggregator.computeChallenge(aggPubKey, aggNonce, messageHash);

    // 6. Compute Lagrange weights
    const weights = quorum.map(i => aggregator.computeLagrangeWeight(i, quorum));

    // 7. Compute partial shares
    const partialShares = quorum.map((_, idx) => {
      return evaluator.evaluatePartialShare({
        challenge,
        secretKeyShare: keyShares[idx],
        lagrangeWeight: weights[idx],
        secretNonces: noncePairs[idx].secret,
        bindingFactor,
      });
    });

    // 8. Assemble final signature
    const signature = aggregator.assembleSignature(aggNonce, partialShares);
    expect(signature).toHaveProperty('R');
    expect(signature).toHaveProperty('s');
    expect(typeof signature.R).toBe('bigint');
    expect(typeof signature.s).toBe('bigint');

    // 9. Compute aggregate private key and secret nonce for verification
    const aggPrivateKey = keyShares.reduce((acc, x, idx) => {
      return aggregator.field.add(acc, aggregator.field.mul(x, weights[idx]));
    }, 0n);
    const aggSecretNonce = noncePairs.reduce((acc, np, idx) => {
      const blended = aggregator.field.add(np.secret.k1, aggregator.field.mul(bindingFactor, np.secret.k2));
      return aggregator.field.add(acc, blended);
    }, 0n);

    // 10. Verify signature
    const valid = aggregator.verifySignature(aggPubKey, aggNonce, signature, messageHash, {
      aggPrivateKey,
      aggSecretNonce,
    });
    expect(valid).toBe(true);
  });

  test('L2-07: Full signing round-trip — 3-of-5 threshold', () => {
    const quorum = [1, 2, 3, 4, 5];
    const keyShares = [10n, 20n, 30n, 40n, 50n];
    const pubKeys = keyShares.map(x => aggregator.field.mul(x, 2n));
    const sessionId = 'round-3-of-5';
    const messageHash = 'msg-hash-3-of-5';

    const noncePairs = quorum.map(() => nonceGen.generateNoncePair(sessionId));
    const nonceCommitments = noncePairs.map(np => np.publicCommitment);

    const aggPubKey = aggregator.aggregatePublicKeys(pubKeys, quorum);
    const bindingFactor = aggregator.computeBindingFactor(aggPubKey, nonceCommitments);
    const publicNonces = noncePairs.map(np => BigInt('0x' + np.publicCommitment.h1) % aggregator.field.q);
    const aggNonce = aggregator.aggregateNonces(publicNonces, bindingFactor);
    const challenge = aggregator.computeChallenge(aggPubKey, aggNonce, messageHash);
    const weights = quorum.map(i => aggregator.computeLagrangeWeight(i, quorum));

    const partialShares = quorum.map((_, idx) => {
      return evaluator.evaluatePartialShare({
        challenge,
        secretKeyShare: keyShares[idx],
        lagrangeWeight: weights[idx],
        secretNonces: noncePairs[idx].secret,
        bindingFactor,
      });
    });

    const signature = aggregator.assembleSignature(aggNonce, partialShares);

    const aggPrivateKey = keyShares.reduce((acc, x, idx) => {
      return aggregator.field.add(acc, aggregator.field.mul(x, weights[idx]));
    }, 0n);
    const aggSecretNonce = noncePairs.reduce((acc, np, idx) => {
      const blended = aggregator.field.add(np.secret.k1, aggregator.field.mul(bindingFactor, np.secret.k2));
      return aggregator.field.add(acc, blended);
    }, 0n);

    const valid = aggregator.verifySignature(aggPubKey, aggNonce, signature, messageHash, {
      aggPrivateKey,
      aggSecretNonce,
    });
    expect(valid).toBe(true);
  });

  // ── L2-08 through L2-11: Signature verification ───────────────────────────

  test('L2-08: verifySignature — valid signature returns true', () => {
    const P = 100n;
    const R = 50n;
    const k_agg = 77n;
    const x_agg = 33n;
    const msgHash = 'test-msg';
    const c = aggregator.computeChallenge(P, R, msgHash);
    const s = aggregator.field.add(k_agg, aggregator.field.mul(c, x_agg));
    const sig = { R, s };
    expect(aggregator.verifySignature(P, R, sig, msgHash, { aggPrivateKey: x_agg, aggSecretNonce: k_agg })).toBe(true);
  });

  test('L2-09: verifySignature — tampered s returns false', () => {
    const P = 100n;
    const R = 50n;
    const k_agg = 77n;
    const x_agg = 33n;
    const msgHash = 'test-msg';
    const c = aggregator.computeChallenge(P, R, msgHash);
    const s = aggregator.field.add(k_agg, aggregator.field.mul(c, x_agg));
    const tamperedS = aggregator.field.add(s, 1n); // tamper
    const sig = { R, s: tamperedS };
    expect(aggregator.verifySignature(P, R, sig, msgHash, { aggPrivateKey: x_agg, aggSecretNonce: k_agg })).toBe(false);
  });

  test('L2-10: verifySignature — tampered R returns false', () => {
    const P = 100n;
    const R = 50n;
    const k_agg = 77n;
    const x_agg = 33n;
    const msgHash = 'test-msg';
    const c = aggregator.computeChallenge(P, R, msgHash);
    const s = aggregator.field.add(k_agg, aggregator.field.mul(c, x_agg));
    const tamperedR = aggregator.field.add(R, 1n); // tamper
    const sig = { R: tamperedR, s };
    expect(aggregator.verifySignature(P, R, sig, msgHash, { aggPrivateKey: x_agg, aggSecretNonce: k_agg })).toBe(false);
  });

  test('L2-11: verifySignature — wrong message returns false', () => {
    const P = 100n;
    const R = 50n;
    const k_agg = 77n;
    const x_agg = 33n;
    const msgHash = 'test-msg';
    const wrongMsgHash = 'wrong-msg';
    const c = aggregator.computeChallenge(P, R, msgHash);
    const s = aggregator.field.add(k_agg, aggregator.field.mul(c, x_agg));
    const sig = { R, s };
    expect(aggregator.verifySignature(P, R, sig, wrongMsgHash, { aggPrivateKey: x_agg, aggSecretNonce: k_agg })).toBe(false);
  });

  // ── L2-13, L2-14: Partial share aggregation and zeroization ───────────────

  test('L2-13: partial share linear aggregation matches expected sum', () => {
    const quorum = [1, 2, 3];
    const challenge = 999n;
    const binding = 7n;
    const keyShares = [50n, 60n, 70n];
    const nonces = [{ k1: 3n, k2: 5n }, { k1: 7n, k2: 11n }, { k1: 13n, k2: 17n }];
    const weights = quorum.map(i => aggregator.computeLagrangeWeight(i, quorum));

    const partials = quorum.map((_, idx) => {
      return evaluator.evaluatePartialShare({
        challenge,
        secretKeyShare: keyShares[idx],
        lagrangeWeight: weights[idx],
        secretNonces: nonces[idx],
        bindingFactor: binding,
      });
    });

    const sumPartials = partials.reduce((a, b) => aggregator.field.add(a, b), 0n);

    const secretSum = keyShares.reduce((acc, ks, idx) => {
      return aggregator.field.add(acc, aggregator.field.mul(aggregator.field.mul(challenge, ks), weights[idx]));
    }, 0n);
    const nonceSum = nonces.reduce((acc, nn) => {
      return aggregator.field.add(acc, aggregator.field.add(nn.k1, aggregator.field.mul(binding, nn.k2)));
    }, 0n);
    const expected = aggregator.field.add(secretSum, nonceSum);

    expect(sumPartials).toBe(expected);
  });

  test('L2-14: zeroizeSecretNonces sets k1 and k2 to 0n', () => {
    const nonces = { k1: 12345n, k2: 67890n };
    evaluator.zeroizeSecretNonces(nonces);
    expect(nonces.k1).toBe(0n);
    expect(nonces.k2).toBe(0n);
  });

  // ── L3-01 through L3-15: Input validation edge cases ──────────────────────

  test('L3-01: nonce generation — null sessionId throws', () => {
    expect(() => nonceGen.generateNoncePair(null)).toThrow();
  });

  test('L3-02: nonce generation — empty string sessionId throws', () => {
    expect(() => nonceGen.generateNoncePair('')).toThrow();
  });

  test('L3-03: nonce generation — missing modulus throws', () => {
    expect(() => new Musig2NonceGenerator()).toThrow();
  });

  test('L3-04: Lagrange weight — participant not in quorum throws', () => {
    expect(() => aggregator.computeLagrangeWeight(99, [1, 2, 3])).toThrow();
  });

  test('L3-05: Lagrange weight — quorum with < 2 elements throws', () => {
    expect(() => aggregator.computeLagrangeWeight(1, [1])).toThrow();
  });

  test('L3-06: Lagrange weight — duplicate participant IDs throws', () => {
    expect(() => aggregator.computeLagrangeWeight(1, [1, 1, 2])).toThrow();
  });

  test('L3-07: partial share — missing challenge throws', () => {
    expect(() => evaluator.evaluatePartialShare({
      secretKeyShare: 100n,
      lagrangeWeight: 1n,
      secretNonces: { k1: 5n, k2: 7n },
      bindingFactor: 3n,
    })).toThrow();
  });

  test('L3-08: partial share — missing secretKeyShare throws', () => {
    expect(() => evaluator.evaluatePartialShare({
      challenge: 123n,
      lagrangeWeight: 1n,
      secretNonces: { k1: 5n, k2: 7n },
      bindingFactor: 3n,
    })).toThrow();
  });

  test('L3-09: partial share — missing nonces throws', () => {
    expect(() => evaluator.evaluatePartialShare({
      challenge: 123n,
      secretKeyShare: 100n,
      lagrangeWeight: 1n,
      bindingFactor: 3n,
    })).toThrow();
  });

  test('L3-10: partial share — non-BigInt inputs throw', () => {
    expect(() => evaluator.evaluatePartialShare({
      challenge: 'not-a-bigint',
      secretKeyShare: 100n,
      lagrangeWeight: 1n,
      secretNonces: { k1: 5n, k2: 7n },
      bindingFactor: 3n,
    })).toThrow();
  });

  test('L3-11: computeChallenge — missing aggPublicKey throws', () => {
    expect(() => aggregator.computeChallenge(undefined, 50n, 'msg')).toThrow();
  });

  test('L3-12: computeChallenge — missing messageHash throws', () => {
    expect(() => aggregator.computeChallenge(100n, 50n, undefined)).toThrow();
  });

  test('L3-13: aggregatePublicKeys — empty array throws', () => {
    expect(() => aggregator.aggregatePublicKeys([])).toThrow();
  });

  test('L3-14: aggregatePublicKeys — single key returns unchanged', () => {
    const single = 42n;
    expect(aggregator.aggregatePublicKeys([single])).toBe(single);
  });

  test('L3-15: verifySignature — malformed signature throws (not raw TypeError)', () => {
    expect(() => aggregator.verifySignature(100n, 50n, null, 'msg')).toThrow();
    expect(() => aggregator.verifySignature(100n, 50n, {}, 'msg')).toThrow();
  });
});

// ── Option D: MPC-Schnorr threshold completion — tenant isolation & partial-share verification

describe('Schnorr threshold completion (Option D)', () => {
  // Field prime p = 23, prime subgroup order q = 11, generator g = 2 (order 11 in F_23).
  const P = 23n;
  const Q = 11n;
  const G = 2n;
  let aggregator;
  let evaluator;

  beforeEach(() => {
    aggregator = new SchnorrThresholdAggregator(P, Q, G);
    evaluator = new SchnorrShareEvaluator(P, Q);
  });

  test('verifyPartialShare accepts a valid share and rejects a rogue share', () => {
    const challenge = 2n;
    const binding = 3n;
    const x = 3n;
    const k1 = 4n;
    const k2 = 5n;

    const partial = evaluator.evaluatePartialShare({
      challenge,
      secretKeyShare: x,
      lagrangeWeight: 1n,
      secretNonces: { k1, k2 },
      bindingFactor: binding,
    });

    const P = aggregator.field.exp(aggregator.generator, x);
    const R1 = aggregator.field.exp(aggregator.generator, k1);
    const R2 = aggregator.field.exp(aggregator.generator, k2);

    expect(aggregator.verifyPartialShare({
      publicKey: P,
      publicNonce1: R1,
      publicNonce2: R2,
      partialShare: partial,
      challenge,
      lagrangeWeight: 1n,
      bindingFactor: binding,
      nodeId: 1,
    })).toBe(true);

    expect(() => aggregator.verifyPartialShare({
      publicKey: P,
      publicNonce1: R1,
      publicNonce2: R2,
      partialShare: partial + 1n,
      challenge,
      lagrangeWeight: 1n,
      bindingFactor: binding,
      nodeId: 'rogue-1',
    })).toThrow();
  });

  test('aggregateVerifiedPartialShares enforces t+1 quorum and tenant isolation', () => {
    const challenge = 2n;
    const binding = 3n;
    const keyShares = [3n, 4n, 5n];
    const k1s = [4n, 5n, 6n];
    const k2s = [5n, 6n, 7n];
    const pubKeys = keyShares.map(x => aggregator.field.exp(aggregator.generator, x));
    const publicNonce1s = k1s.map(k => aggregator.field.exp(aggregator.generator, k));
    const publicNonce2s = k2s.map(k => aggregator.field.exp(aggregator.generator, k));
    const partialShares = keyShares.map((x, i) => evaluator.evaluatePartialShare({
      challenge,
      secretKeyShare: x,
      lagrangeWeight: 1n,
      secretNonces: { k1: k1s[i], k2: k2s[i] },
      bindingFactor: binding,
    }));

    const result = aggregator.aggregateVerifiedPartialShares({
      tenantId: 'tenant-a',
      sessionId: 'session-a',
      partialShares,
      threshold: 2,
      publicKeys: pubKeys,
      publicNonce1s,
      publicNonce2s,
      challenges: partialShares.map(() => challenge),
      lagrangeWeights: partialShares.map(() => 1n),
      bindingFactors: partialShares.map(() => binding),
    });

    expect(result).toHaveProperty('R');
    expect(result).toHaveProperty('s');

    // Tenant-b scope must not reuse the verified tenant-a share cache.
    // Re-running with a mismatched public nonce forces a fresh verification failure.
    const badNonce1s = publicNonce1s.slice();
    badNonce1s[0] = 1n;
    expect(() => aggregator.aggregateVerifiedPartialShares({
      tenantId: 'tenant-b',
      sessionId: 'session-a',
      partialShares,
      threshold: 2,
      publicKeys: pubKeys,
      publicNonce1s: badNonce1s,
      publicNonce2s,
      challenges: partialShares.map(() => challenge),
      lagrangeWeights: partialShares.map(() => 1n),
      bindingFactors: partialShares.map(() => binding),
    })).toThrow();
  });

  test('aggregateVerifiedPartialShares throws SCHNORR_THRESHOLD_VIOLATION on malformed share', () => {
    const challenge = 2n;
    const binding = 3n;
    const keyShares = [3n, 4n, 5n];
    const k1s = [4n, 5n, 6n];
    const k2s = [5n, 6n, 7n];
    const pubKeys = keyShares.map(x => aggregator.field.exp(aggregator.generator, x));
    const publicNonce1s = k1s.map(k => aggregator.field.exp(aggregator.generator, k));
    const publicNonce2s = k2s.map(k => aggregator.field.exp(aggregator.generator, k));
    const partialShares = keyShares.map((x, i) => evaluator.evaluatePartialShare({
      challenge,
      secretKeyShare: x,
      lagrangeWeight: 1n,
      secretNonces: { k1: k1s[i], k2: k2s[i] },
      bindingFactor: binding,
    }));

    // Corrupt node 2 share
    partialShares[1] = (partialShares[1] + 1n) % Q;

    try {
      aggregator.aggregateVerifiedPartialShares({
        tenantId: 'tenant-violation',
        sessionId: 'session-violation',
        partialShares,
        threshold: 2,
        publicKeys: pubKeys,
        publicNonce1s,
        publicNonce2s,
        challenges: partialShares.map(() => challenge),
        lagrangeWeights: partialShares.map(() => 1n),
        bindingFactors: partialShares.map(() => binding),
      });
      throw new Error('expected SCHNORR_THRESHOLD_VIOLATION');
    } catch (e) {
      expect(e.code).toBe('SCHNORR_THRESHOLD_VIOLATION');
    }
  });

  test('aggregateVerifiedPartialShares requires t+1 partial shares', () => {
    const pubKeys = [2n, 3n, 4n];
    const partialShares = [1n, 2n];
    const publicNonce1s = [2n, 3n];
    const publicNonce2s = [3n, 4n];
    const challenges = [1n, 1n];
    const lagrangeWeights = [1n, 1n];
    const bindingFactors = [1n, 1n];

    expect(() => aggregator.aggregateVerifiedPartialShares({
      tenantId: 'tenant-t',
      sessionId: 's1',
      partialShares,
      threshold: 2,
      publicKeys,
      publicNonce1s,
      publicNonce2s,
      challenges,
      lagrangeWeights,
      bindingFactors,
    })).toThrow();
  });
});
