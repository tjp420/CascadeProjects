const assert = require('assert');
const kem = require('../ratchet/kem-provider.cjs');

function run() {
  const recipient = kem.generateKeyPair();
  const senderResult = kem.encapsulate(recipient.publicKeyObj);
  const recipientSecret = kem.decapsulate(senderResult.ciphertext, recipient.privateKeyObj);

  const sBuf = Buffer.from(senderResult.sharedSecret);
  const rBuf = Buffer.from(recipientSecret);
  console.log('senderSecret:', sBuf.toString('hex'));
  console.log('recipientSecret:', rBuf.toString('hex'));

  assert.strictEqual(sBuf.byteLength, 32);
  assert.strictEqual(rBuf.byteLength, 32);
  assert.deepStrictEqual(sBuf, rBuf);
  console.log('KEM happy-path: OK');
}

if (require.main === module) run();
module.exports = { run };
