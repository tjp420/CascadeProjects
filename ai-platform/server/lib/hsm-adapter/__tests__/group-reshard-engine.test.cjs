const { GroupReshardEngine } = require('../group-reshard-engine.cjs');

describe('GroupReshardEngine', () => {
  const policy = {
    maxCommitteeSize: 11,
    maxCommitteeExpansionFactor: 2.0,
    minEpochIntervalMs: 1,
    requireNewNodeAttestation: true,
  };

  test('rejects when committee size exceeded', async () => {
    const engine = new GroupReshardEngine({ policy, attestationClient: { verify: async () => true } });
    const current = { epoch: 1, nodeIds: ['a','b','c'], lastRotationMs: Date.now() - 2000, shares: { a: true, b: true, c: true } };
    const target = { nodeIds: Array.from({ length: 12 }, (_, i) => `n${i}`), attestations: {} };
    await expect(engine.computeReshardDistribution(current, target)).rejects.toThrow('ERR_COMMITTEE_SIZE_EXCEEDED');
  });

  test('rejects when attestation fails for new node', async () => {
    const attestationClient = { verify: jest.fn().mockResolvedValue(false) };
    const engine = new GroupReshardEngine({ policy, attestationClient });
    const current = { epoch: 1, nodeIds: ['a','b'], lastRotationMs: Date.now() - 2000, shares: { a: true, b: true } };
    const target = { nodeIds: ['a','b','c'], attestations: { c: 'bad' } };
    await expect(engine.computeReshardDistribution(current, target)).rejects.toThrow(/ERR_INVALID_NODE_ATTESTATION/);
    expect(attestationClient.verify).toHaveBeenCalledWith('bad');
  });

  test('returns equal-weight distribution mapping when attestations valid', async () => {
    const attestationClient = { verify: jest.fn().mockResolvedValue(true) };
    const engine = new GroupReshardEngine({ policy, attestationClient });
    const current = { epoch: 2, nodeIds: ['a','b'], lastRotationMs: Date.now() - 2000, shares: { a: true, b: true } };
    const target = { nodeIds: ['a','b','c'], attestations: { c: 'good' } };
    const res = await engine.computeReshardDistribution(current, target);
    expect(res.epoch).toBe(3);
    expect(Object.keys(res.distribution)).toEqual(['a','b','c']);
    const sum = Object.values(res.distribution).reduce((s, v) => s + (v.coefficient || 0), 0);
    expect(sum).toBeCloseTo(1.0);
  });
});
