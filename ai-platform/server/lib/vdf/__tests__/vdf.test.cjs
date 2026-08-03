const { VDFManager } = require('../protocol.cjs');

describe('VDFManager (smoke)', () => {
  it('generates and verifies a short difficulty proof', async () => {
    const v = new VDFManager({ useWorkers: false });
    const seed = 'test-seed-' + Math.random();
    const difficulty = 100;
    const { params, proof } = await v.generateTimeLock({ seed, difficulty });
    expect(proof.iter).toBe(difficulty);
    const ok = await v.verifyTimeLock({ seed, difficulty, proof });
    expect(ok).toBe(true);
  }, 20000);
});