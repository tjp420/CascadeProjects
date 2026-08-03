'use strict';

/**
 * Track 41: Hardware enclave tests.
 */
const { HardwareEnclaveAdapter } = require('../hardware-enclave-adapter.cjs');
const { EnclaveAttestationClient, _signMock } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 41 hardware enclaves', () => {
  function buildAttestation(opts = {}) {
    const doc = {
      version: 1,
      enclaveType: 'mock',
      mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
      timestamp: Math.floor(Date.now() / 1000),
      attestationAgeSeconds: 0,
      authority: 'mock-authority',
      ...opts,
    };
    doc.signature = _signMock(doc);
    return doc;
  }

  test('EnclaveAttestationClient accepts a valid mock attestation', async () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      expectedMrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    });
    const result = await client.verify(buildAttestation());
    expect(result.valid).toBe(true);
    expect(result.mrenclave).toBe('MOCK_MRENCLAVE_00000000000000000000000000000000');
  });

  test('EnclaveAttestationClient rejects an unknown authority', async () => {
    const client = new EnclaveAttestationClient({ allowedAuthorities: ['mock-authority'] });
    const doc = buildAttestation({ authority: 'evil-authority' });
    doc.signature = _signMock(doc);
    const result = await client.verify(doc);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/authority/);
  });

  test('EnclaveAttestationClient rejects an expired attestation', async () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      maxAttestationAgeSeconds: 10,
    });
    const doc = buildAttestation({ attestationAgeSeconds: 120 });
    doc.signature = _signMock(doc);
    const result = await client.verify(doc);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/);
  });

  test('EnclaveAttestationClient rejects a mismatched MRENCLAVE', async () => {
    const client = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      expectedMrenclave: 'EXPECTED_MEASUREMENT',
    });
    const result = await client.verify(buildAttestation());
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/MRENCLAVE/);
  });

  test('HardwareEnclaveAdapter initializes with a valid attestation', async () => {
    const adapter = new HardwareEnclaveAdapter({
      enclaveType: 'mock',
      mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    });
    const events = [];
    adapter._audit = (event, info) => events.push({ event, info });
    const result = await adapter.initialize(buildAttestation());
    expect(result.initialized).toBe(true);
    expect(events.some((e) => e.event === 'ENCLAVE_HARDWARE_BOOTSTRAPPED')).toBe(true);
    expect(events.some((e) => e.event === 'ATTESTATION_CHALLENGE_VERIFIED')).toBe(true);
  });

  test('HardwareEnclaveAdapter seals and unseals key material', async () => {
    const adapter = new HardwareEnclaveAdapter({
      enclaveType: 'mock',
      mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    });
    await adapter.initialize(buildAttestation());
    const key = Buffer.from('post-quantum-key-material', 'utf8');
    await adapter.sealKey('kek-1', key);
    const unsealed = await adapter.unsealKey('kek-1');
    expect(unsealed.toString('utf8')).toBe('post-quantum-key-material');
  });

  test('HardwareEnclaveAdapter rejects initialization with bad attestation', async () => {
    const adapter = new HardwareEnclaveAdapter({
      enclaveType: 'mock',
      mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    });
    const doc = buildAttestation({ attestationAgeSeconds: 600 });
    doc.signature = _signMock(doc);
    await expect(adapter.initialize(doc)).rejects.toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates enclave configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'enclave', {
      enclaveType: 'mock',
      mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
      attestationAuthority: 'mock-authority',
      attestationAgeSeconds: 0,
      enclaveCipher: 'aes-256-gcm',
      requireRemoteAttestation: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'enclave', { enclaveType: 'arm-trustzone' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { attestationAuthority: 'evil-authority' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { attestationAgeSeconds: 120 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { enclaveCipher: 'rc4' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'enclave', { requireRemoteAttestation: false })).toThrow(HsmAdapterError);
  });
});
