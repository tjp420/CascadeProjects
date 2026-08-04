const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { writeAtomicSync } = require('../../../fs-atomic.cjs');
const { encryptEnvelope, decryptEnvelope } = require('../../../crypto/ratchet/envelope-crypto.cjs');

function testWriteAtomicCleanup() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'track113-'));
  const finalPath = path.join(tmpDir, 'final.txt');

  // Spy on unlinkSync to see if cleanup is attempted
  const originalUnlink = fs.unlinkSync;
  let unlinkArg = null;
  fs.unlinkSync = function (p) { unlinkArg = p; return originalUnlink.call(fs, p); };

  // Force renameSync to fail to exercise cleanup path
  const originalRename = fs.renameSync;
  fs.renameSync = function () { throw new Error('simulated rename failure'); };

  let threw = false;
  try {
    writeAtomicSync(finalPath, 'payload');
  } catch (e) {
    threw = true;
    assert.ok(/simulated rename failure/.test(String(e)), 'expected simulated rename failure');
  }

  // Restore patched fns
  fs.renameSync = originalRename;
  fs.unlinkSync = originalUnlink;

  // Ensure the function attempted cleanup by calling unlinkSync with a temp path
  assert.ok(threw, 'writeAtomicSync should throw when rename fails');
  assert.ok(unlinkArg, 'writeAtomicSync should attempt to unlink the temp file');

  // Cleanup temp dir
  try { fs.rmdirSync(tmpDir, { recursive: true }); } catch (e) {}
}

function testEnvelopeRoundTripAndTamper() {
  const kek = 'test-kek-42';
  const msg = 'hello envelope';

  const env = encryptEnvelope(msg, kek);
  assert.ok(typeof env === 'string', 'encryptEnvelope should return string');

  const pt = decryptEnvelope(env, kek);
  assert.ok(Buffer.isBuffer(pt), 'decryptEnvelope should return Buffer');
  assert.strictEqual(pt.toString('utf8'), msg, 'decrypted plaintext should match');

  // Wrong KEK should fail (auth tag mismatch)
  let failed = false;
  try { decryptEnvelope(env, 'wrong-kek'); } catch (e) { failed = true; }
  assert.ok(failed, 'decrypt with wrong KEK should throw');

  // Malformed envelope should throw (not enough segments)
  assert.throws(() => decryptEnvelope('not-valid-envelope'), /invalid envelope/);

  // Tamper with ciphertext (flip a char in ciphertext segment)
  const parts = env.split(':');
  const ct = parts[2];
  // flip first char
  const tamperedCt = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
  const tampered = `${parts[0]}:${parts[1]}:${tamperedCt}`;
  assert.throws(() => decryptEnvelope(tampered, kek));
}

function run() {
  console.log('Running hardening-primitives tests...');
  testWriteAtomicCleanup();
  testEnvelopeRoundTripAndTamper();
  console.log('OK');
}

if (require.main === module) run();

module.exports = { testWriteAtomicCleanup, testEnvelopeRoundTripAndTamper };
