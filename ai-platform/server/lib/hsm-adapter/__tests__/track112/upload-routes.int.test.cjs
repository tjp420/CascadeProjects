"use strict";

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../../../index.cjs');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

describe('Track112 upload routes (integration)', () => {
  test('create -> chunk -> commit flow', async () => {
    const createRes = await request(app)
      .post('/api/track112/uploads')
      .send({ tenant: 't1', maxBytes: 8192 })
      .set('Accept', 'application/json');
    expect(createRes.status).toBe(201);
    expect(createRes.body.sessionId).toBeTruthy();
    const id = createRes.body.sessionId;

    const chunk = Buffer.alloc(4096, 'a');
    const chunkRes = await request(app)
      .post(`/api/track112/uploads/${id}/chunk?offset=0`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk);
    expect(chunkRes.status).toBe(204);

    const root = sha256(chunk);
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' });
    const signature = crypto.sign(null, root, keyPair.privateKey).toString('base64');

    const commitRes = await request(app)
      .post(`/api/track112/uploads/${id}/commit`)
      .send({ publicKeyPem, signature })
      .set('Accept', 'application/json');
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.root).toBeTruthy();
  }, 20000);
});
