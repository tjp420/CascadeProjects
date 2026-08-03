const crypto = require('crypto');
const { PartialShareProofManager } = require('./proofs.cjs');

function run() {
  const mgr = new PartialShareProofManager();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const prev = process.env.PROOF_MAX_FIELD_BITS;
  process.env.PROOF_MAX_FIELD_BITS = '256';
  try {
    const big257 = (1n << 256n) + 1n;
    const envelope = { sender: 'node-1', round: 1, share: { x: big257 } };
    const proof = mgr.createPartialShareProof(envelope, privateKey);
    const res = mgr.verifyPartialShareProof(proof, publicKey);
    if (!(res && res.ok === false && res.reason === 'numeric_oversize')) {
      console.error('257-bit oversize test failed', res);
      process.exit(1);
    }
    console.log('OK: 257-bit oversize rejected as expected');
  } finally {
    if (typeof prev === 'undefined') delete process.env.PROOF_MAX_FIELD_BITS; else process.env.PROOF_MAX_FIELD_BITS = prev;
  }
}

run();
