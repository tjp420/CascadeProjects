'use strict';

/**
 * Track 41: Hardware enclave tests.
 */
const { HardwareEnclaveAdapter } = require('../hardware-enclave-adapter.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const ATTESTATION = {
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
};

const POLICY = {
  allowedEnclaveTypes: ['mock', 'intel-sgx', 'aws-nitro'],
  requiredMRENCLAVEHashes: ['MOCK_MRENCLAVE_00000000000000000000000000000000'],
  allowedAttestationAuthorities: ['mock-authority'],
  requireRemoteAttestation: true,
  maxAttestationAgeSeconds: 60,
  allowedEnclaveCiphers: ['aes-256-gcm'],
};

describe('Track 41 hardware enclave', () => {
  test('EnclaveAttestationClient verifies a valid mock attestation', () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MRENCLAVE_00000000000000000000000000000000'],
    });
    const result = client.verify(ATTESTATION);
    expect(result.verified).toBe(true);
    expect(client.isVerified(ATTESTATION.measurement)).toBe(true);
  });

  test('EnclaveAttestationClient rejects an untrusted authority', () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['other'],
      allowedMeasurements: [ATTESTATION.measurement],
    });
    expect(() => client.verify(ATTESTATION)).toThrow(HsmAdapterError);
  });

  test('EnclaveAttestationClient rejects an untrusted measurement', () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['other'],
    });
    expect(() => client.verify(ATTESTATION)).toThrow(HsmAdapterError);
  });

  test('EnclaveAttestationClient rejects an expired attestation', () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: [ATTESTATION.measurement],
      maxAttestationAgeSeconds: 0,
    });
    const stale = { ...ATTESTATION, timestamp: ATTESTATION.timestamp - 1 };
    expect(() => client.verify(stale)).toThrow(HsmAdapterError);
  });

  test('HardwareEnclaveAdapter initializes with valid attestation', async () => {
    const adapter = new HardwareEnclaveAdapter({
      backend: 'mock',
      policy: POLICY,
    });
    const result = await adapter.initialize(ATTESTATION);
    expect(result.ok).toBe(true);
    expect(result.backend).toBe('mock');
  });

  test('HardwareEnclaveAdapter blocks operations before initialization', async () => {
    const adapter = new HardwareEnclaveAdapter({
      backend: 'mock',
      policy: POLICY,
    });
    await expect(adapter.seal('secret')).rejects.toThrow(HsmAdapterError);
  });

  test('HardwareEnclaveAdapter seals and unseals data', async () => {
    const adapter = new HardwareEnclaveAdapter({
      backend: 'mock',
      mrenclave: ATTESTATION.mrenclave,
      policy: POLICY,
    });
    await adapter.initialize(ATTESTATION);
    const { ciphertext } = await adapter.seal('hello enclave');
    const plain = await adapter.unseal(ciphertext);
    expect(plain.toString()).toBe('hello enclave');
  });

  test('HardwareEnclaveAdapter provisions a key after attestation', async () => {
    const adapter = new HardwareEnclaveAdapter({
      backend: 'mock',
      policy: POLICY,
    });
    await adapter.initialize(ATTESTATION);
    const result = await adapter.provisionKey({ key: 'kek-material' });
    expect(result.provisioned).toBe(true);
    expect(result.keyId).toMatch(/^enc-/);
  });

  test('CryptoPolicyEngine validates enclave configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'enclave', {
      enclaveType: 'mock',
      mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
      attestationAuthority: 'mock-authority',
      attestationAgeSeconds: 0,
      requireRemoteAttestation: true,
      enclaveCipher: 'aes-256-gcm',
    })).not.toThrow();

    expect(() => engine.validate('t1', 'enclave', { enclaveType: 'amd-sev' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { mrenclave: 'UNKNOWN' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { attestationAgeSeconds: 9999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { requireRemoteAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { enclaveCipher: 'rc4' })).toThrow(HsmAdapterError);
  });
});
