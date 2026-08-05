'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');

const { IdentityRatchet } = require(path.resolve(process.cwd(), 'server', 'lib', 'crypto', 'ratchet', 'identity-ratchet.cjs'));
const { HybridBootstrapError, deserializePublicKey } = require(path.resolve(process.cwd(), 'server', 'lib', 'crypto', 'ratchet', 'hybrid-bootstrap.cjs'));

describe('IdentityRatchet (Track 113)', () => {
  it('generates a hybrid keypair with versioned public key', async () => {
    const ratchet = await new IdentityRatchet({ deviceId: 'test-1' }).generate();
    assert.ok(ratchet.publicKey);
    assert.ok(Buffer.isBuffer(ratchet.publicKey));
    const components = deserializePublicKey(ratchet.publicKey);
    assert.ok(components[0x01], 'ed25519 component present');
    assert.ok(components[0x02], 'x25519 component present');
    assert.ok(components[0x03], 'mlkem-768 component present');
  });

  it('encapsulates and decapsulates to the same chain key', async () => {
    const alice = await new IdentityRatchet({ deviceId: 'alice' }).generate();
    const bob = await new IdentityRatchet({ deviceId: 'bob' }).generate();

    const enc = await alice.encapsulateFor(bob.publicKey);
    assert.ok(enc.cipherText);
    const dec = await bob.decapsulateFrom(enc.cipherText);
    assert.strictEqual(enc.chainKey, dec.chainKey);
  });

  it('signs and verifies handshake transcripts', async () => {
    const alice = await new IdentityRatchet({ deviceId: 'alice' }).generate();
    const bob = await new IdentityRatchet({ deviceId: 'bob' }).generate();

    const transcript = Buffer.from('handshake-v1');
    const signature = alice.signHandshake(transcript);
    assert.ok(signature);
    assert.strictEqual(bob.verifyHandshake(signature, transcript, alice.publicKey), true);
    assert.strictEqual(bob.verifyHandshake(signature, transcript, bob.publicKey), false);
  });

  it('steps the chain and produces distinct message keys', async () => {
    const alice = await new IdentityRatchet({ deviceId: 'alice' }).generate();
    const bob = await new IdentityRatchet({ deviceId: 'bob' }).generate();
    await alice.encapsulateFor(bob.publicKey);
    await bob.decapsulateFrom((await alice.encapsulateFor(bob.publicKey)).cipherText);

    const m1 = alice.step();
    const m2 = alice.step();
    assert.notStrictEqual(m1.toString('hex'), m2.toString('hex'));
  });

  it('emits audit events when audit callback provided', async () => {
    const events = [];
    const audit = (event, info) => events.push({ event, info });
    const ratchet = await new IdentityRatchet({ deviceId: 'audit', audit }).generate();
    assert.ok(events.some(e => e.event === 'IDENTITY_RATCHET_GENERATED'));
    assert.strictEqual(ratchet.publicKey.length > 0, true);
  });

  it('emits QUANTUM_ROTATE_PENDING and rotates at message threshold', async () => {
    const events = [];
    const audit = (event, info) => events.push({ event, info });
    const alice = await new IdentityRatchet({ deviceId: 'alice', audit, rotation: { maxMessages: 10, warningRatio: 0.8 } }).generate();
    const bob = await new IdentityRatchet({ deviceId: 'bob', audit, rotation: { maxMessages: 10, warningRatio: 0.8 } }).generate();
    await alice.encapsulateFor(bob.publicKey);

    const keys = [];
    for (let i = 0; i < 12; i++) {
      keys.push(alice.step().toString('hex'));
    }

    assert.ok(events.some(e => e.event === 'QUANTUM_ROTATE_PENDING'), 'pending warning emitted');
    assert.ok(events.some(e => e.event === 'IDENTITY_RATCHET_ROTATED'), 'rotation completed');
    assert.strictEqual(keys.length, 12);
    // After rotation, message keys should be distinct from pre-rotation
    assert.notStrictEqual(keys[9], keys[10], 'rotation changes key stream');
  });

  it('rotateNow() produces a new chain key', async () => {
    const alice = await new IdentityRatchet({ deviceId: 'alice' }).generate();
    const bob = await new IdentityRatchet({ deviceId: 'bob' }).generate();
    await alice.encapsulateFor(bob.publicKey);
    const before = alice.getChainKey();
    const result = alice.rotateNow();
    const after = alice.getChainKey();
    assert.notStrictEqual(before, after);
    assert.ok(result.rotationEpoch > 0);
  });

  it('throws on unknown public key version', () => {
    assert.throws(() => deserializePublicKey(Buffer.from([0xff])), HybridBootstrapError);
  });
});
