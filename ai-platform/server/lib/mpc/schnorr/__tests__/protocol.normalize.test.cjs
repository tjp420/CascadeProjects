const { SchnorrThresholdAggregator } = require('../protocol.cjs');

function run() {
  const agg = new SchnorrThresholdAggregator('97'); // small prime modulus for easy checks

  // numeric inputs
  const w1 = agg.computeLagrangeWeight(1, [1, 2, 3]);

  // mixed-format inputs: strings, hex with 0x, BigInt
  const w2 = agg.computeLagrangeWeight('0x1', ['0x2', 3n]);

  if (w1 !== w2) throw new Error('Mixed-format quorum produced different Lagrange weight');

  // Aborted/missing node scenario: quorum with missing participant should still compute for present index
  const w3 = agg.computeLagrangeWeight('1', ['2', '3']); // index 1 not in quorum -> numerator/denom behavior
  // Since index is not in quorum, computeLagrangeWeight treats index as external; ensure it returns a BigInt
  if (typeof w3 !== 'bigint') throw new Error('Expected bigint result for external index');

  // Float input should be rejected
  let threw = false;
  try {
    agg.computeLagrangeWeight(1.5, [1, 2, 3]);
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('Expected float input to be rejected');

  console.log('OK: protocol normalization tests passed');
}

if (typeof test === 'function') test('protocol normalize inputs', run);
else { try { run(); } catch (e) { console.error('FAILED:', e && e.message); process.exit(1) } }
