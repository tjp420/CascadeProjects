"use strict";

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

const track112 = require('../../../routes/track112-upload-routes.cjs');

async function run() {
  const app = express();
  app.use('/api/track112/upload', track112);

  // create session
  const createRes = await request(app)
    .post('/api/track112/upload/uploads')
    .send({ tenant: 'smoke', maxBytes: 8192 })
    .set('Accept', 'application/json');
  if (createRes.status !== 201) {
    console.error('CREATE failed', createRes.status, createRes.body); process.exit(2);
  }
  const id = createRes.body.sessionId;

  // generate keypair and chunk
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const chunk = Buffer.alloc(4096, 'a');

  const chunkRes = await request(app)
    .post(`/api/track112/upload/uploads/${id}/chunk?offset=0`)
    .set('Content-Type', 'application/octet-stream')
    .send(chunk);
  if (chunkRes.status !== 204) { console.error('CHUNK failed', chunkRes.status); process.exit(3); }

  const rootBuf = crypto.createHash('sha256').update(chunk).digest();
  const sig = crypto.sign(null, rootBuf, privateKey);
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

  const commitRes = await request(app)
    .post(`/api/track112/upload/uploads/${id}/commit`)
    .send({ publicKeyPem, signature: sig.toString('base64') })
    .set('Accept', 'application/json');
  console.log('COMMIT', commitRes.status, commitRes.body);
  if (commitRes.status !== 200) process.exit(4);
  process.exit(0);
}

run();
