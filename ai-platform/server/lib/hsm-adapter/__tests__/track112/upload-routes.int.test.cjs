"use strict";

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../../../index.cjs');
const hsmMetrics = require('../../../hsm-adapter/hsm-metrics.cjs');
const { canonicalize } = require('../../../crypto/jcs-canonicalize.cjs');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

describe('Track112 upload routes (integration)', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('create -> chunk -> commit flow increments counters', async () => {
    const createRes = await request(app)
      .post('/api/track112/uploads')
      .send({ tenant: 't1', maxBytes: 8192 })
      .set('Accept', 'application/json');
    expect(createRes.status).toBe(201);
    expect(createRes.body.sessionId).toBeTruthy();
    expect(hsmMetrics.getMetrics().hsm_track112_upload_create_total).toBe(1);
    const id = createRes.body.sessionId;

    const chunk = Buffer.alloc(4096, 'a');
    const chunkRes = await request(app)
      .post(`/api/track112/uploads/${id}/chunk?offset=0`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk);
    expect(chunkRes.status).toBe(204);
    expect(hsmMetrics.getMetrics().hsm_track112_upload_chunk_total).toBe(1);

    const root = sha256(chunk);
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' });
    const commitPayload = canonicalize({ root: root.toString('hex'), sessionId: id, tenant: 't1' });
    const signature = crypto.sign(null, Buffer.from(commitPayload, 'utf8'), keyPair.privateKey).toString('base64');

    const commitRes = await request(app)
      .post(`/api/track112/uploads/${id}/commit`)
      .send({ publicKeyPem, signature })
      .set('Accept', 'application/json');
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.root).toBeTruthy();
    expect(hsmMetrics.getMetrics().hsm_track112_upload_commit_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_track112_upload_commit_failed_total).toBe(0);
  }, 20000);

  test('invalid signature increments failure counter', async () => {
    const createRes = await request(app)
      .post('/api/track112/uploads')
      .send({ tenant: 't1', maxBytes: 8192 })
      .set('Accept', 'application/json');
    expect(createRes.status).toBe(201);
    const id = createRes.body.sessionId;

    const chunk = Buffer.alloc(4096, 'a');
    await request(app)
      .post(`/api/track112/uploads/${id}/chunk?offset=0`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk);

    const fakeKey = crypto.generateKeyPairSync('ed25519');
    const fakePublicKeyPem = fakeKey.publicKey.export({ type: 'spki', format: 'pem' });
    const fakeSignature = crypto.sign(null, Buffer.from('nope'), fakeKey.privateKey).toString('base64');

    const commitRes = await request(app)
      .post(`/api/track112/uploads/${id}/commit`)
      .send({ publicKeyPem: fakePublicKeyPem, signature: fakeSignature })
      .set('Accept', 'application/json');
    expect(commitRes.status).toBe(401);
    expect(hsmMetrics.getMetrics().hsm_track112_upload_commit_failed_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_track112_upload_commit_failed_invalid_signature_total).toBe(1);
  }, 20000);

  test('propagates custom x-track112-trace-id header', async () => {
    const traceId = 'trace-test-123';
    const res = await request(app)
      .post('/api/track112/uploads')
      .set('x-track112-trace-id', traceId)
      .send({ tenant: 't1' })
      .set('Accept', 'application/json');
    expect(res.status).toBe(201);
    expect(res.headers['x-track112-trace-id']).toBe(traceId);
    expect(res.body.traceId).toBe(traceId);
  }, 20000);
});
