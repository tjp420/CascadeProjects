const { SchnorrShareEvaluator } = require('../signature_share.cjs');
const { PrimeField, normalizeToBigInt } = require('../field.cjs');

// Runable both under jest and node
function run() {
  const SECP256K1_Q = '115792089237316195423570985008687907852837564279074904382605163141518161494337';
  const evaluator = new SchnorrShareEvaluator(SECP256K1_Q);

  const challengeNum = 12345n;
  const secret = 100n;
  const lambda = 1n;
  const nonces = { k1: 5n, k2: 7n };
  const binding = 3n;

  const resNumeric = evaluator.evaluatePartialShare({
    challenge: challengeNum,
    secretKeyShare: secret,
    lagrangeWeight: lambda,
    secretNonces: nonces,
    bindingFactor: binding,
  });

  // same values but as mixed-format strings
  const resMixed = evaluator.evaluatePartialShare({
    challenge: '0x' + challengeNum.toString(16), // hex with 0x
    secretKeyShare: '64', // decimal string 100
    lagrangeWeight: '1',
    secretNonces: { k1: '5', k2: '7' },
    bindingFactor: '0x3' // hex small
  });

  if (resNumeric !== resMixed) {
    throw new Error('Mismatch between numeric and mixed-format partials: ' + resNumeric + ' vs ' + resMixed);
  }

  // uppercase hex should also work
  const resUpper = evaluator.evaluatePartialShare({
    challenge: '0X' + challengeNum.toString(16).toUpperCase(),
    secretKeyShare: '0x64',
    lagrangeWeight: '0x1',
    secretNonces: { k1: '0X5', k2: '0X7' },
    bindingFactor: '3'
  });
  if (resNumeric !== resUpper) throw new Error('Mismatch with uppercase hex');

  console.log('OK: signature_share normalization tests passed');
}

if (typeof test === 'function') {
  test('normalizeToBigInt equivalence', run);
} else {
  try { run(); } catch (e) { console.error('FAILED:', e && e.message); process.exit(1); }
}
