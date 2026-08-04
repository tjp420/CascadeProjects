const assert = require('assert');
const crypto = require('crypto');
const PoRepVerifier = require('../track112/poRep-verifier.cjs');

(async () => {
  const v = new PoRepVerifier();

  const bad = await v.verify({});
  console.log('bad:', bad);
  assert.strictEqual(bad.valid, false);
  assert.strictEqual(bad.reason, 'malformed_proof');

  const leaf = Buffer.from('test-leaf');
  const leafHash = crypto.createHash('sha256').update(leaf).digest();
  const rootHex = leafHash.toString('hex');
  const proof = {
    root: rootHex,
    challenges: [ { leaf: leaf.toString('base64'), index: 0, path: [] } ]
  };

  const ok = await v.verify(proof);
  console.log('ok:', ok);
  assert.strictEqual(ok.valid, true);

  console.log('SMOKE: PoRep verifier smoke runner passed.');
})();