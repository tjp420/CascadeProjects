'use strict';

/**
 * Track 45: Cross-tenant access audit tests.
 */
const { CrossTenantAccessAuditor } = require('../cross-tenant-access-auditor.cjs');
const { AccessProofReceipt } = require('../access-proof-receipt.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  requireAttestationForBothEndpoints: true,
  allowedAttestationAuthorities: ['mock-authority'],
  minSignatureQuorumPerTenant: 2,
  maxVerificationWindowSeconds: 60,
  allowedOperations: ['key-escrow', 'blind-pir', 'identity-lookup'],
  requireDualLinkedProof: true,
  requireCanonicalReceiptLayout: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
  };
}

function baseRequest() {
  return {
    requestingTenant: 'tenant-a',
    resourceOwnerTenant: 'tenant-b',
    operation: 'blind-pir',
    resourceId: 'resource-123',
    requesterSignatures: ['sig-a-1', 'sig-a-2'],
    ownerSignatures: ['sig-b-1', 'sig-b-2'],
    requesterAttestation: mockAttestation(),
    ownerAttestation: mockAttestation(),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

describe('Track 45 cross-tenant audit', () => {
  test('CrossTenantAccessAuditor recognizes a valid access and chains a receipt', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const auditor = new CrossTenantAccessAuditor({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = auditor.recognize(baseRequest());
    expect(result.recognized).toBe(true);
    expect(result.serialized).toMatch(/^AUDIT:/);
    expect(events.some((e) => e.event === 'CROSS_TENANT_ACCESS_RECOGNIZED')).toBe(true);
    expect(events.some((e) => e.event === 'AUDIT_RECEIPT_CHAINED')).toBe(true);
  });

  test('AccessProofReceipt serializes and parses canonically', () => {
    const receipt = new AccessProofReceipt({
      requestingTenant: 'tenant-a',
      resourceOwnerTenant: 'tenant-b',
      operation: 'key-escrow',
      resourceId: 'resource-456',
      requesterSignatures: ['sig-a-1'],
      ownerSignatures: ['sig-b-1'],
      timestamp: 1234567890,
    });
    const serialized = receipt.serialize();
    expect(serialized).toMatch(/^AUDIT:tenant-a:tenant-b:key-escrow:resource-456:1234567890:/);
    const parsed = AccessProofReceipt.parse(serialized);
    expect(parsed.requestingTenant).toBe('tenant-a');
    expect(parsed.leafHash).toBe(receipt.leafHash);
  });

  test('CrossTenantAccessAuditor rejects missing requester attestation', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const auditor = new CrossTenantAccessAuditor({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRequest();
    request.requesterAttestation = null;
    expect(() => auditor.recognize(request)).toThrow(HsmAdapterError);
  });

  test('CrossTenantAccessAuditor rejects insufficient requester signatures', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const auditor = new CrossTenantAccessAuditor({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRequest();
    request.requesterSignatures = ['sig-a-1'];
    expect(() => auditor.recognize(request)).toThrow(HsmAdapterError);
  });

  test('CrossTenantAccessAuditor rejects an un-allowed operation', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const auditor = new CrossTenantAccessAuditor({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRequest();
    request.operation = 'forbidden-op';
    expect(() => auditor.recognize(request)).toThrow(HsmAdapterError);
  });

  test('CrossTenantAccessAuditor rejects an expired verification window', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const auditor = new CrossTenantAccessAuditor({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRequest();
    request.timestamp = Math.floor(Date.now() / 1000) - 100;
    expect(() => auditor.recognize(request)).toThrow(HsmAdapterError);
  });

  test('AccessProofReceipt rejects malformed layout', () => {
    expect(() => AccessProofReceipt.parse('BAD')).toThrow();
  });

  test('CryptoPolicyEngine validates cross-tenant audit configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'crossTenantAudit', {
      attestationForBothEndpoints: true,
      attestationAuthority: 'mock-authority',
      signatureQuorumPerTenant: 2,
      verificationWindowSeconds: 60,
      operation: 'blind-pir',
      dualLinkedProof: true,
      canonicalReceiptLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'crossTenantAudit', { attestationForBothEndpoints: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'crossTenantAudit', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'crossTenantAudit', { signatureQuorumPerTenant: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'crossTenantAudit', { verificationWindowSeconds: 120 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'crossTenantAudit', { operation: 'forbidden' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'crossTenantAudit', { dualLinkedProof: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'crossTenantAudit', { canonicalReceiptLayout: false })).toThrow(HsmAdapterError);
  });
});
