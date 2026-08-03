"use strict";

const request = require('supertest');
const path = require('path');
const app = require(path.resolve(__dirname, '../../../index.cjs'));

async function run() {
  try {
    const createRes = await request(app)
      .post('/api/track112/upload/uploads')
      .send({ tenant: 'smoke', maxBytes: 8192 })
      .set('Accept', 'application/json');
    console.log('CREATE', createRes.status, createRes.body);
    if (createRes.status !== 201) process.exit(2);
    const id = createRes.body.sessionId;

    const chunk = Buffer.alloc(4096, 'a');
    const chunkRes = await request(app)
      .post(`/api/track112/upload/uploads/${id}/chunk?offset=0`)
      .set('Content-Type', 'application/octet-stream')
      .send(chunk);
    console.log('CHUNK', chunkRes.status);
    if (chunkRes.status !== 204) process.exit(3);

    const commitRes = await request(app)
      .post(`/api/track112/upload/uploads/${id}/commit`)
      .send({ signature: 'sig' })
      .set('Accept', 'application/json');
    console.log('COMMIT', commitRes.status, commitRes.body);
    if (commitRes.status !== 200) process.exit(4);
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e && e.message);
    process.exit(1);
  }
}

run();
