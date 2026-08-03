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
