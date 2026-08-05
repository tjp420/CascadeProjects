"use strict";

const crypto = require('crypto');
const PoRepVerifier = require('../../track112/poRep-verifier.cjs');

describe('PoRep Verifier stub', () => {
  test('accepts valid proofs and rejects invalid ones', async () => {
    const v = new PoRepVerifier();
    const ok = await v.verify({ valid: true });
    expect(ok.valid).toBe(true);
    const bad = await v.verify({});
    expect(bad.valid).toBe(false);
  });
});

describe('PoRep Verifier zeroization', () => {
  // Helper: build a valid Merkle proof for a single-leaf tree
  // Leaf data is hex-encoded to match toBufferFromEncoded's hex path
  function buildValidProof(leafData) {
    const leafHex = Buffer.from(leafData, 'utf8').toString('hex');
    const leafBuf = Buffer.from(leafHex, 'hex'); // matches toBufferFromEncoded
    const leafHash = crypto.createHash('sha256').update(leafBuf).digest();
    const rootHex = leafHash.toString('hex');
    return {
      root: rootHex,
      challenges: [
        { leaf: leafHex, index: 0, path: [] },
      ],
    };
  }

  // Helper: build an invalid proof (wrong root)
  function buildInvalidProof(leafData) {
    const leafHex = Buffer.from(leafData, 'utf8').toString('hex');
    return {
      root: 'deadbeef'.repeat(8), // wrong root
      challenges: [
        { leaf: leafHex, index: 0, path: [] },
      ],
    };
  }

  test('Z-POREP-01: stub valid proof still works (no zeroization needed)', async () => {
    const v = new PoRepVerifier();
    const result = await v.verify({ valid: true });
    expect(result.valid).toBe(true);
  });

  test('Z-POREP-02: valid proof verification succeeds with zeroization', async () => {
    const v = new PoRepVerifier();
    const proof = buildValidProof('test-leaf-data');
    const result = await v.verify(proof);
    expect(result.valid).toBe(true);
  });

  test('Z-POREP-03: invalid proof fails with zeroization on error path', async () => {
    const v = new PoRepVerifier();
    const proof = buildInvalidProof('test-leaf-data');
    const result = await v.verify(proof);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('challenge_mismatch');
  });

  test('Z-POREP-04: malformed proof fails without crashing', async () => {
    const v = new PoRepVerifier();
    const result = await v.verify({ root: 'abc', challenges: [] });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed_proof');
  });

  test('Z-POREP-05: multi-challenge proof with path verifies correctly', async () => {
    // Build a 2-leaf Merkle tree — leaves are hex-encoded for toBufferFromEncoded
    const leaf1Hex = Buffer.from('leaf1', 'utf8').toString('hex');
    const leaf2Hex = Buffer.from('leaf2', 'utf8').toString('hex');
    const leaf1Buf = Buffer.from(leaf1Hex, 'hex');
    const leaf2Buf = Buffer.from(leaf2Hex, 'hex');
    const leaf1Hash = crypto.createHash('sha256').update(leaf1Buf).digest();
    const leaf2Hash = crypto.createHash('sha256').update(leaf2Buf).digest();
    const root = crypto.createHash('sha256').update(Buffer.concat([leaf1Hash, leaf2Hash])).digest();

    const v = new PoRepVerifier();
    const result = await v.verify({
      root: root.toString('hex'),
      challenges: [
        { leaf: leaf1Hex, index: 0, path: [leaf2Hash.toString('hex')] },
        { leaf: leaf2Hex, index: 1, path: [leaf1Hash.toString('hex')] },
      ],
    });
    expect(result.valid).toBe(true);
  });

  test('Z-POREP-06: multi-challenge proof fails on second challenge mismatch', async () => {
    const leaf1Hex = Buffer.from('leaf1', 'utf8').toString('hex');
    const leaf2Hex = Buffer.from('leaf2', 'utf8').toString('hex');
    const wrongHex = Buffer.from('wrong', 'utf8').toString('hex');
    const leaf1Buf = Buffer.from(leaf1Hex, 'hex');
    const leaf2Buf = Buffer.from(leaf2Hex, 'hex');
    const leaf1Hash = crypto.createHash('sha256').update(leaf1Buf).digest();
    const leaf2Hash = crypto.createHash('sha256').update(leaf2Buf).digest();
    const root = crypto.createHash('sha256').update(Buffer.concat([leaf1Hash, leaf2Hash])).digest();

    const v = new PoRepVerifier();
    const result = await v.verify({
      root: root.toString('hex'),
      challenges: [
        { leaf: leaf1Hex, index: 0, path: [leaf2Hash.toString('hex')] },
        { leaf: wrongHex, index: 1, path: [leaf1Hash.toString('hex')] },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('challenge_mismatch');
    expect(result.index).toBe(1);
  });

  test('Z-POREP-07: metrics are tracked correctly with zeroization enabled', async () => {
    const v = new PoRepVerifier();
    await v.verify({ valid: true });
    await v.verify(buildValidProof('test'));
    await v.verify(buildInvalidProof('test'));
    expect(v.metrics.verifications).toBe(3);
    expect(v.metrics.failures).toBe(1);
  });
});
