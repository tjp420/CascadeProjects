const assert = require('assert');
const crypto = require('crypto');
const { PartialShareProofManager } = require('../proofs.cjs');

const mgr = new PartialShareProofManager();

// Generate keypair for signing/verification
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

// Good envelope
const envelope = { sender: 'node-1', round: 1, share: { x: 123, y: 456 } };

// Create proof
const proof = mgr.createPartialShareProof(envelope, privateKey);
assert(proof && proof.proof_material && proof.proof_material.evidence_id, 'proof must contain evidence_id');
assert(mgr.verifyPartialShareProof(proof, publicKey) === true, 'valid proof must verify');
console.log('OK: valid proof verified');

// Negative: missing proof_material
const bad1 = { envelope };
assert(mgr.verifyPartialShareProof(bad1, publicKey) === false, 'missing proof_material should fail');
console.log('OK: missing proof_material rejected');

// Negative: wrong type for detached_signature
const bad2 = JSON.parse(JSON.stringify(proof));
bad2.proof_material.detached_signature = 12345;
assert(mgr.verifyPartialShareProof(bad2, publicKey) === false, 'wrong typed signature should fail');
console.log('OK: wrong typed signature rejected');

// Negative: injected __bigint_hex marker in envelope should be rejected by canonicalizer/schema
const bad3 = JSON.parse(JSON.stringify(proof));
bad3.envelope = { __bigint_hex: 'deadbeef' };
assert(mgr.verifyPartialShareProof(bad3, publicKey) === false, '__bigint_hex injected envelope should fail');
console.log('OK: __bigint_hex injection rejected');

console.log('All proofs validation tests passed');
