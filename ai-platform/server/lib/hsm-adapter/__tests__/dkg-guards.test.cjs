const { DkgSnarkEngine, DkgNodeContribution } = require('../dkg-snark-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('DkgSnarkEngine numeric guards', () => {
  test('accepts normal contribution within bit limits', () => {
    const nodeIds = ['n1', 'n2', 'n3'];
    const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });
    const contrib = engine.generateContribution('n1');
    // Should validate for persistence with default mapping (secp256k1 -> 256)
    expect(engine.validateContributionForPersistence(contrib)).toBe(true);
  });

  test('rejects oversize polynomial coefficient', () => {
    const nodeIds = ['n1', 'n2', 'n3'];
    const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });
    const contrib = engine.generateContribution('n1');
    // Inject an oversize coefficient (e.g., 2^(300)) beyond 256-bit
    contrib.polynomial[0] = 1n << 300n;
    expect(() => engine.validateContributionForPersistence(contrib)).toThrow(HsmAdapterError);
    try {
      engine.validateContributionForPersistence(contrib);
    } catch (e) {
      expect(e.code).toBe('NUMERIC_OVERSIZE');
    }
  });
});
