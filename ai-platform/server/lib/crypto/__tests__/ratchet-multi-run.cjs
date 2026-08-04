const assert = require('assert');
const kem = require('../ratchet/kem-provider.cjs');
const ratchet = require('../ratchet/index.cjs');

async function run() {
  // Generate local keypairs for A and B
  const aKeys = kem.generateKeyPair();
  const bKeys = kem.generateKeyPair();

  // Initial KEM handshake to bootstrap shared secret
  const init = kem.encapsulate(bKeys.publicKeyObj);
  const sharedB = kem.decapsulate(init.ciphertext, bKeys.privateKeyObj);
  const sharedA = init.sharedSecret;

  // Create sessions in store with tenantId 'tenant1'
  const sid = 'session-' + Date.now();
  const tenant = 'tenant1';
  ratchet.createSessionRecord({ sessionId: sid + '-A', tenantId: tenant, localKeyPair: aKeys, remotePublicKeyObj: bKeys.publicKeyObj, initialShared: sharedA });
  ratchet.createSessionRecord({ sessionId: sid + '-B', tenantId: tenant, localKeyPair: bKeys, remotePublicKeyObj: aKeys.publicKeyObj, initialShared: sharedB });

  // perform 5 alternating DH ratchet rounds
  for (let i = 0; i < 5; i++) {
    const initiator = i % 2 === 0 ? sid + '-A' : sid + '-B';
    const responder = i % 2 === 0 ? sid + '-B' : sid + '-A';

    // initiator performs encapsulate -> sends ciphertext
    const { ciphertext } = await ratchet.dhRatchetInitiate(initiator, tenant);
    // responder processes ciphertext
    await ratchet.dhRatchetRespond(responder, tenant, ciphertext);

    // send a message from initiator to responder using updated chain keys
    const sInitiator = require('./../ratchet/session-store.cjs').get(initiator);
    const sResponder = require('./../ratchet/session-store.cjs').get(responder);
    const msg = `round-${i}-hello`;
    const encrypted = ratchet.encryptWithChainKey(sInitiator, msg);
    const decrypted = ratchet.decryptWithChainKey(sResponder, encrypted.ciphertext, encrypted.tag, encrypted.nonce);
    assert.strictEqual(decrypted.toString(), msg);
    console.log(`round ${i} ok`);
  }

  console.log('multi-round DH ratchet: OK');

  // Negative test: attempt to access session with wrong tenant
  try {
    const wrongTenant = 'attacker-tenant';
    await ratchet.dhRatchetInitiate(sid + '-A', wrongTenant);
    throw new Error('tenant validation failed: access should have been denied');
  } catch (e) {
    if (e && e.code === 'UNAUTHORIZED_SESSION_ACCESS') {
      console.log('tenant validation negative test: OK');
    } else {
      throw e;
    }
  }

  // Fast-forward purge test: purge with zero TTL should remove session files
  const Purger = require('../../storage/purger.cjs');
  const fs = require('fs');
  const path = require('path');
  const baseDir = path.join(__dirname, '..', '..', '.data', 'ratchet-sessions');
  await Purger.purgeExpiredSessions(baseDir, 0);
  // verify files removed on disk
  const base = path.join(baseDir, tenant);
  let exists = false;
  try { exists = fs.existsSync(base) && fs.readdirSync(base).length > 0; } catch (e) { exists = false; }
  if (exists) throw new Error('purge failed: tenant session files remain');
  console.log('fast-forward purge test: OK');
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });

module.exports = { run };
