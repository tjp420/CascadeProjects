const assert = require('assert');
const crypto = require('crypto');
const { PartialShareProofManager } = require('../proofs.cjs');

describe('PartialShareProof validation', () => {
  test('valid and invalid partial share proofs are handled correctly', () => {
    const mgr = new PartialShareProofManager();

    // Generate keypair for signing/verification
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

    // Good envelope
    const envelope = { sender: 'node-1', round: 1, share: { x: 123, y: 456 } };

    // Create proof
    const proof = mgr.createPartialShareProof(envelope, privateKey);
    assert(proof && proof.proof_material && proof.proof_material.evidence_id, 'proof must contain evidence_id');
    const resGood = mgr.verifyPartialShareProof(proof, publicKey);
    assert(resGood && resGood.ok === true, 'valid proof must verify');

    // Negative: missing proof_material
    const bad1 = { envelope };
    const resBad1 = mgr.verifyPartialShareProof(bad1, publicKey);
    assert(resBad1 && resBad1.ok === false && resBad1.reason === 'schema', 'missing proof_material should fail with schema error');

    // Negative: wrong type for detached_signature
    const bad2 = JSON.parse(JSON.stringify(proof));
    bad2.proof_material.detached_signature = 12345;
    const resBad2 = mgr.verifyPartialShareProof(bad2, publicKey);
    assert(resBad2 && resBad2.ok === false && resBad2.reason === 'schema', 'wrong typed signature should fail with schema error');

    // Negative: injected __bigint_hex marker in envelope should be rejected by canonicalizer/schema
    const bad3 = JSON.parse(JSON.stringify(proof));
    bad3.envelope = { __bigint_hex: 'deadbeef' };
    const resBad3 = mgr.verifyPartialShareProof(bad3, publicKey);
    assert(resBad3 && resBad3.ok === false && resBad3.reason === 'canonicalization', '__bigint_hex injected envelope should fail with canonicalization error');
  });
});
