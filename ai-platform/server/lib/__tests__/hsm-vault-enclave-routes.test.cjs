'use strict';

/**
 * Tests for Track 41 Route Integration — Hardware Enclave Isolation endpoints.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/authorize.cjs', () => ({
  authorize: function (permission) {
    return function mockAuthorize(req, res, next) {
      const perms = (req.user && req.user.permissions) || [];
      if (perms.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: 'insufficient_permissions',
        required: permission,
      });
    };
  },
}));

jest.mock('../../lib/admin-throttle.cjs', () => ({
  middleware: function (req, res, next) { next(); },
}));

jest.mock('../../lib/hsm-vault.cjs', () => ({
  deriveWithFailover: jest.fn().mockResolvedValue(Buffer.alloc(32)),
  getHsmVersions: jest.fn().mockReturnValue({ primary: 'test', secondary: 'test' }),
  hsmHandshake: jest.fn().mockResolvedValue({ status: 'ok' }),
  decryptWithHsm: jest.fn().mockResolvedValue('plaintext'),
  hsmRotate: jest.fn().mockResolvedValue({ rotated: true }),
}));

const hsmMetrics = require('../../lib/hsm-adapter/hsm-metrics.cjs');
const baseAdapter = require('../../lib/hsm-adapter/base-adapter.cjs');
const { HardwareEnclaveAdapter } = require('../../lib/hsm-adapter/hardware-enclave-adapter.cjs');

function buildApp(user) {
  const app = express();
  app.use(express.json());
  const router = require('../../routes/hsm-vault-routes.cjs');
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/vault', router);
  return app;
}

const ADMIN = { id: 'admin1', role: 'admin', permissions: ['admin:all'] };
const VIEWER = { id: 'viewer1', role: 'viewer', permissions: [] };

const POLICY = {
  allowedEnclaveTypes: ['mock', 'intel-sgx', 'aws-nitro'],
  requiredMRENCLAVEHashes: ['MOCK_MRENCLAVE_00000000000000000000000000000000'],
  allowedAttestationAuthorities: ['mock-authority'],
  requireRemoteAttestation: true,
  maxAttestationAgeSeconds: 60,
  allowedEnclaveCiphers: ['aes-256-gcm'],
};

function makeAttestation(overrides) {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    pcrs: { 0: 'PCR_0', 1: 'PCR_1' },
    reportData: 'mock',
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
    certificate: 'mock',
    ...overrides,
  };
}

describe('Track 41: Hardware Enclave Routes', () => {
  let adapter;

  beforeEach(() => {
    hsmMetrics.reset();
    adapter = new HardwareEnclaveAdapter({
      backend: 'mock',
      policy: POLICY,
    });
    baseAdapter.registerHardwareEnclaveAdapter(adapter);
  });

  afterEach(() => {
    baseAdapter.registerHardwareEnclaveAdapter(null);
  });

  describe('GET /enclave/status', () => {
    test('returns 200 with enclave state and counters for admin', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).get('/api/vault/enclave/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.registered).toBe(true);
      expect(res.body.backend).toBe('mock');
      expect(res.body.initialized).toBe(false);
      expect(res.body.counters).toBeDefined();
    });

    test('returns 200 with registered=false when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app).get('/api/vault/enclave/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.registered).toBe(false);
      expect(res.body.backend).toBeNull();
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app).get('/api/vault/enclave/status');
      expect(res.status).toBe(403);
    });
  });

  describe('POST /enclave/initialize', () => {
    test('initializes the enclave with a valid attestation document', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/initialize')
        .send({ attestationDocument: makeAttestation() });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ok).toBe(true);
      expect(res.body.backend).toBe('mock');
      expect(res.body.mrenclave).toBeDefined();
    });

    test('returns 400 when attestationDocument is missing', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).post('/api/vault/enclave/initialize').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('returns 403 when attestation has untrusted authority', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/initialize')
        .send({ attestationDocument: makeAttestation({ authority: 'evil-authority' }) });
      expect(res.status).toBe(403);
    });

    test('returns 403 when attestation has untrusted measurement', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/initialize')
        .send({ attestationDocument: makeAttestation({ measurement: 'UNKNOWN_HASH', mrenclave: 'UNKNOWN_HASH' }) });
      expect(res.status).toBe(403);
    });

    test('returns 503 when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/initialize')
        .send({ attestationDocument: makeAttestation() });
      expect(res.status).toBe(503);
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post('/api/vault/enclave/initialize')
        .send({ attestationDocument: makeAttestation() });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /enclave/seal', () => {
    test('seals plaintext after initialization', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/seal')
        .send({ plaintext: 'hello enclave' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ciphertext).toBeDefined();
      expect(res.body.backend).toBe('mock');
    });

    test('returns 409 when enclave is not initialized', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/seal')
        .send({ plaintext: 'hello' });
      expect(res.status).toBe(409);
    });

    test('returns 400 when plaintext is missing', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app).post('/api/vault/enclave/seal').send({});
      expect(res.status).toBe(400);
    });

    test('returns 503 when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/seal')
        .send({ plaintext: 'hello' });
      expect(res.status).toBe(503);
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post('/api/vault/enclave/seal')
        .send({ plaintext: 'hello' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /enclave/unseal', () => {
    test('unseals ciphertext after initialization', async () => {
      await adapter.initialize(makeAttestation());
      const { ciphertext } = await adapter.seal('round trip');
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/unseal')
        .send({ ciphertext });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plaintext).toBe('round trip');
    });

    test('returns 409 when enclave is not initialized', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/unseal')
        .send({ ciphertext: 'abc' });
      expect(res.status).toBe(409);
    });

    test('returns 400 when ciphertext is missing', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app).post('/api/vault/enclave/unseal').send({});
      expect(res.status).toBe(400);
    });

    test('returns 503 when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/unseal')
        .send({ ciphertext: 'abc' });
      expect(res.status).toBe(503);
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post('/api/vault/enclave/unseal')
        .send({ ciphertext: 'abc' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /enclave/provision-key', () => {
    test('provisions a key after attestation', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/provision-key')
        .send({ keyMaterial: { key: 'kek-material' } });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.provisioned).toBe(true);
      expect(res.body.keyId).toMatch(/^enc-/);
    });

    test('returns 409 when enclave is not initialized', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/provision-key')
        .send({ keyMaterial: { key: 'kek' } });
      expect(res.status).toBe(409);
    });

    test('returns 400 when keyMaterial is missing', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app).post('/api/vault/enclave/provision-key').send({});
      expect(res.status).toBe(400);
    });

    test('returns 503 when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/vault/enclave/provision-key')
        .send({ keyMaterial: { key: 'kek' } });
      expect(res.status).toBe(503);
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post('/api/vault/enclave/provision-key')
        .send({ keyMaterial: { key: 'kek' } });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /enclave/attestation/verify', () => {
    test('returns verified=true for a cached measurement', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app)
        .get('/api/vault/enclave/attestation/verify')
        .query({ measurement: 'MOCK_MRENCLAVE_00000000000000000000000000000000' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
    });

    test('returns verified=false for an unknown measurement', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app)
        .get('/api/vault/enclave/attestation/verify')
        .query({ measurement: 'UNKNOWN' });
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(false);
    });

    test('returns 400 when measurement query param is missing', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).get('/api/vault/enclave/attestation/verify');
      expect(res.status).toBe(400);
    });

    test('returns 503 when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .get('/api/vault/enclave/attestation/verify')
        .query({ measurement: 'X' });
      expect(res.status).toBe(503);
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .get('/api/vault/enclave/attestation/verify')
        .query({ measurement: 'X' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /enclave/attestation/clear-cache', () => {
    test('clears the attestation cache', async () => {
      await adapter.initialize(makeAttestation());
      const app = buildApp(ADMIN);
      const res = await request(app).post('/api/vault/enclave/attestation/clear-cache');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cleared).toBe(true);
      // After clearing, the previously verified measurement should be unverified
      const verifyRes = await request(app)
        .get('/api/vault/enclave/attestation/verify')
        .query({ measurement: 'MOCK_MRENCLAVE_00000000000000000000000000000000' });
      expect(verifyRes.body.verified).toBe(false);
    });

    test('returns 503 when no adapter is registered', async () => {
      baseAdapter.registerHardwareEnclaveAdapter(null);
      const app = buildApp(ADMIN);
      const res = await request(app).post('/api/vault/enclave/attestation/clear-cache');
      expect(res.status).toBe(503);
    });

    test('returns 403 for non-admin', async () => {
      const app = buildApp(VIEWER);
      const res = await request(app).post('/api/vault/enclave/attestation/clear-cache');
      expect(res.status).toBe(403);
    });
  });
});
