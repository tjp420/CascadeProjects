const { generateProof, verifyProof } = require('../index.cjs');

describe('NIZK stub module', () => {
  test('generateProof returns a proof_bundle and meta', () => {
    const res = generateProof({ publicInputs: { policyId: 'policy-0001' }, scheme: 'mock-scheme' });
    expect(res).toHaveProperty('proof_bundle');
    expect(typeof res.proof_bundle).toBe('string');
    expect(res).toHaveProperty('proof_size');
    expect(res).toHaveProperty('meta');
    expect(res.meta.scheme).toBe('mock-scheme');
  });

  test('verifyProof accepts a valid mock proof', () => {
    const gen = generateProof({ publicInputs: { x: 1 }, scheme: 'mock' });
    const v = verifyProof({ publicInputs: { x: 1 }, proof_bundle: gen.proof_bundle });
    expect(v.is_valid).toBe(true);
    expect(v.error_context).toBeNull();
  });

  test('verifyProof rejects non-mock data', () => {
    const v = verifyProof({ publicInputs: {}, proof_bundle: Buffer.from('not-a-mock').toString('base64') });
    expect(v.is_valid).toBe(false);
    expect(typeof v.error_context).toBe('string');
  });
});
