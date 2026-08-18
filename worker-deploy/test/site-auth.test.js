'use strict';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleSiteAuthRegister,
  handleSiteAuthLogin,
  hashPassword,
  randomSalt,
  readUser
} from '../src/site-auth.js';

const TEST_SECRET = 'test-site-auth-secret-key-for-unit-tests';

function mockKv() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); }
  };
}

function mockEnv(kv) {
  return {
    LICENSE_STORE: kv,
    SIMPLEBEACON_LICENSE_SECRET: TEST_SECRET
  };
}

function authRequest(path, body) {
  return new Request(`https://simplebeacon.ai${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('register + login round-trip at edge', async () => {
  const env = mockEnv(mockKv());
  const email = `user-${Date.now()}@example.com`;
  const password = 'testpass123';

  const regRes = await handleSiteAuthRegister(authRequest('/api/auth/register', { email, password }), env, 'https://simplebeacon.ai');
  assert.equal(regRes.status, 201);
  const regBody = await regRes.json();
  assert.ok(regBody.token);
  assert.equal(regBody.user.email, email.toLowerCase());

  const loginRes = await handleSiteAuthLogin(authRequest('/api/auth/login', { email, password: 'wrong' }), env, 'https://simplebeacon.ai');
  assert.equal(loginRes.status, 401);

  const okLogin = await handleSiteAuthLogin(authRequest('/api/auth/login', { email, password }), env, 'https://simplebeacon.ai');
  assert.equal(okLogin.status, 200);
  const loginBody = await okLogin.json();
  assert.ok(loginBody.token);
  assert.equal(loginBody.email, email.toLowerCase());
});

test('login returns null for unknown edge user (Render fallback)', async () => {
  const env = mockEnv(mockKv());
  const res = await handleSiteAuthLogin(authRequest('/api/auth/login', {
    email: 'nobody@example.com',
    password: 'whatever12'
  }), env, 'https://simplebeacon.ai');
  assert.equal(res, null);
});

test('register rejects weak password', async () => {
  const env = mockEnv(mockKv());
  const res = await handleSiteAuthRegister(authRequest('/api/auth/register', {
    email: 'a@b.com',
    password: 'short'
  }), env, 'https://simplebeacon.ai');
  assert.equal(res.status, 400);
});

test('hashPassword is deterministic for same salt', async () => {
  const salt = randomSalt();
  const a = await hashPassword('hunter2', salt);
  const b = await hashPassword('hunter2', salt);
  assert.equal(a, b);
});
