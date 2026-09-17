const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const store = require('../server/lib/certificate-store.cjs');
const certsApi = require('../src/api/certificates.cjs');

test('certificate store encrypt/decrypt roundtrip', async (t) => {
  await t.test('saveCertificate and loadCertificate preserve payload and metadata', () => {
    const id = `cert-test-${Date.now()}`;
    const payload = Buffer.from('SAMPLE-CERT-BYTES');
    const meta = { owner: 'tester@example.com' };

    const filePath = store.saveCertificate(id, payload, meta);
    assert.ok(filePath && filePath.endsWith(`${id}.json`));

    const loaded = store.loadCertificate(id);
    assert.ok(loaded && Buffer.isBuffer(loaded.buffer));
    assert.strictEqual(loaded.buffer.toString(), payload.toString());
    assert.deepStrictEqual(loaded.metadata, meta);
  });
});

test('signed url generation and verification', async (t) => {
  await t.test('generateSignedUrl -> verifySignedToken roundtrip', () => {
    const certId = 'cert-roundtrip-1';
    const expiresAt = Date.now() + 60_000;
    const q = certsApi.generateSignedUrl(certId, expiresAt);
    const m = q.match(/token=([^&]*)&sig=(.*)/);
    assert.ok(m, 'expected token query string');
    const token = decodeURIComponent(m[1]);
    const sig = m[2];
    const verified = certsApi.verifySignedToken(token, sig);
    assert.strictEqual(verified, certId);

    // expired token should return null
    const expired = certsApi.generateSignedUrl('x', Date.now() - 1000);
    const me = expired.match(/token=([^&]*)&sig=(.*)/);
    const tok = decodeURIComponent(me[1]);
    const sg = me[2];
    const v2 = certsApi.verifySignedToken(tok, sg);
    assert.strictEqual(v2, null);
  });
});
