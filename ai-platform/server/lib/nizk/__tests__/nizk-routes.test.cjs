const request = require('supertest');
const express = require('express');
const router = require('../routes.cjs');
const { clearStore } = require('../index.cjs');

describe('NIZK routes (contract tests)', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(router);
    clearStore();
  });

  test('POST /nizk/generate stores and returns proof', async () => {
    const res = await request(app)
      .post('/nizk/generate')
      .send({ policy_id: 'policy-1', public_inputs: { x: 1 }, scheme: 'mock' })
      .expect(200);
    expect(res.body).toHaveProperty('record');
    expect(res.body.record.policyId).toBe('policy-1');
  });

  test('POST /nizk/verify returns valid for stored proof', async () => {
    const gen = await request(app).post('/nizk/generate').send({ policy_id: 'p', public_inputs: { x: 1 }, scheme: 'mock' });
    const proof = gen.body.proof.proof_bundle;
    const v = await request(app).post('/nizk/verify').send({ policy_id: 'p', public_inputs: { x: 1 }, proof_bundle: proof }).expect(200);
    expect(v.body.is_valid).toBe(true);
  });

  test('GET /nizk/proofs/:id returns stored record', async () => {
    const gen = await request(app).post('/nizk/generate').send({ policy_id: 'p2', public_inputs: {}, scheme: 'mock' });
    const id = gen.body.record.id;
    const got = await request(app).get(`/nizk/proofs/${id}`).expect(200);
    expect(got.body.id).toBe(id);
  });

  test('POST /nizk/verify rejects bad proof', async () => {
    const v = await request(app).post('/nizk/verify').send({ policy_id: 'p', public_inputs: {}, proof_bundle: Buffer.from('bad').toString('base64') }).expect(200);
    expect(v.body.is_valid).toBe(false);
  });
});
