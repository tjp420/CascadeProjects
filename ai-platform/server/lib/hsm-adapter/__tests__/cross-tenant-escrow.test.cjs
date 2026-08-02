'use strict';

/**
 * Track 23: Cross-tenant key escrow, provable declassification, and
 * dual-authorization auditing.
 */
const crypto = require('crypto');
const { EscrowBroker } = require('../escrow-broker.cjs');
const { DeclassificationProof } = require('../declassification-proof.cjs');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

function _sign(payload, privateKey) {
  const signer = crypto.createSign('sha256');
  signer.update(Buffer.from(payload, 'utf8'));
  return signer.sign(privateKey, 'base64');
}

function _makeKeyset() {
  const source = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const dest = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const broker = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    source: { public: source.publicKey, private: source.privateKey },
    dest: { public: dest.publicKey, private: dest.privateKey },
    broker: { public: broker.publicKey, private: broker.privateKey },
  };
}

function _consentPayload(escrow, tenantId) {
  return `${escrow.version}|${escrow.escrowId}|${escrow.sourceTenantId}|${escrow.destTenantId}|${escrow.keyRef}|${escrow.initiatedAt}|${tenantId}`;
}

describe('EscrowBroker', () => {
  test('initiates a cross-tenant escrow and requires different tenants', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });

    expect(() => broker.initiateEscrow('source', 'source', 'kek-1')).toThrow(HsmAdapterError);
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    expect(typeof escrowId).toBe('string');
  });

  test('collects dual consent and mints a declassification proof', () => {
    const keys = _makeKeyset();
    const policyEngine = new CryptoPolicyEngine();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
      policyEngine,
    });

    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);

    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));

    const proof = broker.finalizeEscrow(escrowId);
    expect(proof).toBeInstanceOf(DeclassificationProof);
    expect(proof.consentSignatures).toHaveLength(2);
    expect(proof.brokerSignature).toBeTruthy();
  });

  test('rejects invalid consent signatures', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);

    expect(() => broker.consentToEscrow(escrowId, 'source', _sign('wrong', keys.source.private))).toThrow(HsmAdapterError);
  });

  test('rejects finalization before both parties consent', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));

    expect(() => broker.finalizeEscrow(escrowId)).toThrow(HsmAdapterError);
  });

  test('verify proof detects expired tokens', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));

    const proof = broker.finalizeEscrow(escrowId, { tokenExpiryMs: -1 });
    expect(() => proof.verify({ source: keys.source.public, dest: keys.dest.public }, keys.broker.public, Date.now())).toThrow(HsmAdapterError);
  });
});

describe('BaseHsmAdapter unwrap gating', () => {
  test('happy path: destination unwraps with a valid declassification proof', async () => {
    const keys = _makeKeyset();
    const policyEngine = new CryptoPolicyEngine();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
      policyEngine,
    });
    const adapter = new SoftwareHsmAdapter({ policyEngine, escrowBroker: broker });
    await adapter.initialize();

    const kekId = await adapter.createKEK('source');
    const plaintext = Buffer.alloc(16, 0x77);
    const wrapped = await adapter.wrap('source', kekId, plaintext);

    const escrowId = broker.initiateEscrow('source', 'dest', kekId);
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));
    const proof = broker.finalizeEscrow(escrowId);

    const unwrapped = await adapter.unwrap('dest', kekId, wrapped, proof);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });

  test('throws ESCROW_CONSENT_MISSING without a token', async () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const adapter = new SoftwareHsmAdapter({ escrowBroker: broker });
    await adapter.initialize();

    const kekId = await adapter.createKEK('source');
    const plaintext = Buffer.alloc(16, 0x88);
    const wrapped = await adapter.wrap('source', kekId, plaintext);
    broker.initiateEscrow('source', 'dest', kekId);

    await expect(adapter.unwrap('dest', kekId, wrapped)).rejects.toThrow(HsmAdapterError);
  });

  test('throws on expired declassification token', async () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const adapter = new SoftwareHsmAdapter({ escrowBroker: broker });
    await adapter.initialize();

    const kekId = await adapter.createKEK('source');
    const plaintext = Buffer.alloc(16, 0x99);
    const wrapped = await adapter.wrap('source', kekId, plaintext);

    const escrowId = broker.initiateEscrow('source', 'dest', kekId);
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));
    const proof = broker.finalizeEscrow(escrowId, { tokenExpiryMs: -1 });

    await expect(adapter.unwrap('dest', kekId, wrapped, proof)).rejects.toThrow(HsmAdapterError);
  });

  test('rejects token presented by the wrong tenant', async () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const adapter = new SoftwareHsmAdapter({ escrowBroker: broker });
    await adapter.initialize();

    const kekId = await adapter.createKEK('source');
    const plaintext = Buffer.alloc(16, 0xAA);
    const wrapped = await adapter.wrap('source', kekId, plaintext);

    const escrowId = broker.initiateEscrow('source', 'dest', kekId);
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));
    const proof = broker.finalizeEscrow(escrowId);

    await expect(adapter.unwrap('source', kekId, wrapped, proof)).rejects.toThrow(HsmAdapterError);
  });

  test('regression: wrap/unwrap still works without an escrow broker', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK('t1');
    const plaintext = Buffer.alloc(16, 0xBB);
    const wrapped = await adapter.wrap('t1', kekId, plaintext);
    const unwrapped = await adapter.unwrap('t1', kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});

describe('EscrowBroker replay protection (L3-03)', () => {
  test('rejects consent submission to an already-finalized escrow', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));
    broker.finalizeEscrow(escrowId);

    expect(() => broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private)))
      .toThrow(/already finalized/);
    try {
      broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    } catch (e) {
      expect(e.code).toBe('ESCROW_ALREADY_FINALIZED');
    }
  });

  test('reusing a consent signature on a different escrow fails (payload binds to escrowId)', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });

    const escrowId1 = broker.initiateEscrow('source', 'dest', 'kek-A');
    const escrow1 = broker._escrows.get(escrowId1);
    const sourceSig1 = _sign(_consentPayload(escrow1, 'source'), keys.source.private);

    const escrowId2 = broker.initiateEscrow('source', 'dest', 'kek-B');
    expect(() => broker.consentToEscrow(escrowId2, 'source', sourceSig1)).toThrow(HsmAdapterError);
  });

  test('finalizeEscrow is idempotent and returns the same proof on re-finalize', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));

    const proof1 = broker.finalizeEscrow(escrowId);
    const proof2 = broker.finalizeEscrow(escrowId);
    expect(proof2).toBe(proof1);
  });
});

describe('EscrowBroker confidentiality controls (S-01/S-02)', () => {
  test('S-01: escrow records and proof do not contain raw key material', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-secret-ref');
    const escrow = broker._escrows.get(escrowId);
    broker.consentToEscrow(escrowId, 'source', _sign(_consentPayload(escrow, 'source'), keys.source.private));
    broker.consentToEscrow(escrowId, 'dest', _sign(_consentPayload(escrow, 'dest'), keys.dest.private));
    const proof = broker.finalizeEscrow(escrowId);

    const secretKey = Buffer.alloc(32, 0xAB);
    const escrowJson = JSON.stringify(escrow);
    const proofJson = JSON.stringify(proof);
    expect(escrowJson).not.toContain(secretKey.toString('hex'));
    expect(escrowJson).not.toContain(secretKey.toString('base64'));
    expect(proofJson).not.toContain(secretKey.toString('hex'));
    expect(proofJson).not.toContain(secretKey.toString('base64'));

    const sourcePrivPem = keys.source.private.export({ type: 'pkcs8', format: 'pem' });
    expect(escrowJson).not.toContain(sourcePrivPem);
    expect(proofJson).not.toContain(sourcePrivPem);
  });

  test('S-02: consent payloads are not persisted to disk and are only in-memory', () => {
    const keys = _makeKeyset();
    const broker = new EscrowBroker({
      publicKeys: { source: keys.source.public, dest: keys.dest.public },
      brokerKeyPair: keys.broker,
    });
    const escrowId = broker.initiateEscrow('source', 'dest', 'kek-1');
    const escrow = broker._escrows.get(escrowId);
    const payload = _consentPayload(escrow, 'source');
    broker.consentToEscrow(escrowId, 'source', _sign(payload, keys.source.private));

    const consentRecord = escrow.consents.get('source');
    expect(consentRecord).toBeDefined();
    expect(consentRecord.signature).toBeTruthy();

    expect(typeof broker.persist).toBe('undefined');
    expect(typeof broker.save).toBe('undefined');
    expect(typeof broker.flush).toBe('undefined');

    expect(broker._escrows).toBeInstanceOf(Map);
    expect(escrow.consents).toBeInstanceOf(Map);
  });
});
