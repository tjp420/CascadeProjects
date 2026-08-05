'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MODULE_PATH = '../cluster-keyring-sync.cjs';

function cleanEnv() {
  delete process.env.CLUSTER_CERT;
  delete process.env.CLUSTER_KEY;
  delete process.env.CLUSTER_CA_CERT;
  delete process.env.CLUSTER_KEYRING_ALLOW_PLAINTEXT;
  delete process.env.CLUSTER_KEYRING_WRAP_SECRET;
  delete process.env.CLUSTER_KEYRING_WRAP_SECRET_PREVIOUS;
}

describe('Cluster keyring sync mTLS configuration', () => {
  let originalEnv;
  let clusterKeyring;

  beforeEach(() => {
    originalEnv = { ...process.env };
    cleanEnv();
    process.env.NODE_ID = 'test-node';
    process.env.CLUSTER_KEYRING_PORT = '17000';
    process.env.CLUSTER_NODES = '127.0.0.1:17001';
    jest.resetModules();
    clusterKeyring = require(MODULE_PATH);
  });

  afterEach(() => {
    if (clusterKeyring && typeof clusterKeyring.shutdown === 'function') {
      try { clusterKeyring.shutdown(); } catch (_) {}
    }
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
    jest.resetModules();
  });

  test('throws CLUSTER_KEYRING_TLS_REQUIRED when certs missing', () => {
    expect(() => clusterKeyring.init()).toThrow('CLUSTER_KEYRING_TLS_REQUIRED');
  });

  test('getClusterTransportStatus reports insecure when TLS material missing', () => {
    const status = clusterKeyring.getClusterTransportStatus();
    expect(status.tls).toBe(false);
    expect(status.plaintext).toBe(false);
    expect(status.wrapConfigured).toBe(false);
    expect(status.secure).toBe(false);
  });

  test('getClusterTransportStatus reports plaintext fallback when allowed', () => {
    process.env.CLUSTER_KEYRING_ALLOW_PLAINTEXT = '1';
    jest.resetModules();
    clusterKeyring = require(MODULE_PATH);
    const status = clusterKeyring.getClusterTransportStatus();
    expect(status.tls).toBe(false);
    expect(status.plaintext).toBe(true);
    expect(status.secure).toBe(false);
  });

  test('getClusterTransportStatus reports secure when TLS and wrap are configured', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cluster-tls-'));
    const ca = generateSelfSignedPem(dir, 'ca');
    const server = generateSelfSignedPem(dir, 'server');
    process.env.CLUSTER_CERT = server.cert;
    process.env.CLUSTER_KEY = server.key;
    process.env.CLUSTER_CA_CERT = ca.cert;
    process.env.CLUSTER_KEYRING_WRAP_SECRET = '0'.repeat(64);
    jest.resetModules();
    clusterKeyring = require(MODULE_PATH);
    const status = clusterKeyring.getClusterTransportStatus();
    expect(status.tls).toBe(true);
    expect(status.plaintext).toBe(false);
    expect(status.wrapConfigured).toBe(true);
    expect(status.secure).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('emits QUANTUM_DEGRADE when plaintext fallback is active', () => {
    process.env.CLUSTER_KEYRING_ALLOW_PLAINTEXT = '1';
    jest.resetModules();
    clusterKeyring = require(MODULE_PATH);
    clusterKeyring.init();
    const stats = clusterKeyring.getEventStats();
    expect(stats.byType['quantum_downgrade']).toBeGreaterThan(0);
  });
});

function generateSelfSignedPem(dir, name) {
  const forge = require('node-forge');
  const kp = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.serialNumber = '01';
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  cert.validity.notBefore = now;
  cert.validity.notAfter = later;
  const attrs = [{ name: 'commonName', value: name }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.publicKey = kp.publicKey;
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
  ]);
  cert.sign(kp.privateKey, forge.md.sha256.create());

  const certPath = path.join(dir, `${name}.crt`);
  const keyPath = path.join(dir, `${name}.key`);
  fs.writeFileSync(certPath, forge.pki.certificateToPem(cert));
  fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(kp.privateKey));
  return { cert: certPath, key: keyPath };
}
