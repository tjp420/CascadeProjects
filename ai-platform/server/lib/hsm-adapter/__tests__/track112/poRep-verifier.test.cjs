"use strict";

const crypto = require('crypto');
const PoRepVerifier = require('../../track112/poRep-verifier.cjs');

describe('PoRep Verifier', () => {
  test('rejects malformed proofs and accepts a minimal valid proof', async () => {
    const v = new PoRepVerifier();

    // empty/legacy stub should now be considered malformed
    const bad = await v.verify({});
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe('malformed_proof');

    // build a minimal valid proof: one challenge with index 0 and empty path
    const leaf = Buffer.from('test-leaf');
    const leafHash = crypto.createHash('sha256').update(leaf).digest();
    const rootHex = leafHash.toString('hex');
    const proof = {
      root: rootHex,
      challenges: [
        { leaf: leaf.toString('base64'), index: 0, path: [] }
      ]
    };

    const ok = await v.verify(proof);
    expect(ok.valid).toBe(true);
  });
});
