'use strict';

/**
 * Track 48: PQC asset bridge tests.
 */
const { PqcAssetBridgeHub } = require('../pqc-asset-bridge-hub.cjs');
const { BridgeTimeLockEscrow } = require('../bridge-time-lock-escrow.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minCommitteeQuorum: 3,
  maxAssetTransactionValue: 1000000,
  minLockEpochDuration: 60,
  maxClaimExpirationEpochs: 10,
  requireSourceAttestation: true,
  requireTargetAttestation: true,
  allowedBridgeAuthorities: ['mock-authority'],
  requireTimeLockEscrow: true,
  requireCanonicalPayloadLayout: true,
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
    sourcePlatform: 'platform-a',
    targetPlatform: 'platform-b',
    assetId: 'asset-123',
    amount: 10000,
    recipient: 'recipient-1',
    lockEpoch: 100,
    releaseEpoch: 200,
    sourceAttestation: mockAttestation(),
    targetAttestation: mockAttestation(),
  };
}

describe('Track 48 PQC asset bridge', () => {
  test('PqcAssetBridgeHub initiates and finalizes a transfer', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const escrow = new BridgeTimeLockEscrow({ policy: POLICY });
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
      escrow,
      audit: (event, info) => events.push({ event, info }),
    });
    let transfer = hub.initiate(baseRequest());
    expect(transfer.status).toBe('initiated');
    expect(transfer.payload).toMatch(/^BRIDGE:/);
    expect(events.some((e) => e.event === 'BRIDGE_TRANSFER_INITIATED')).toBe(true);

    transfer = hub.sign(transfer, 'c-1', mockAttestation(), 'sig-1');
    transfer = hub.sign(transfer, 'c-2', mockAttestation(), 'sig-2');
    transfer = hub.sign(transfer, 'c-3', mockAttestation(), 'sig-3');
    expect(transfer.status).toBe('validated');
    expect(events.some((e) => e.event === 'CROSS_CHAIN_CLAIM_VALIDATED')).toBe(true);

    escrow.lock(transfer);
    transfer = hub.finalize(transfer, 200);
    expect(transfer.status).toBe('released');
    expect(events.some((e) => e.event === 'ESCROW_RELEASE_FINALIZED')).toBe(true);
  });

  test('PqcAssetBridgeHub rejects value above maximum', () => {
    const hub = new PqcAssetBridgeHub({ policy: POLICY });
    const request = baseRequest();
    request.amount = 2000000;
    expect(() => hub.initiate(request)).toThrow(HsmAdapterError);
  });

  test('PqcAssetBridgeHub rejects lock duration too short', () => {
    const hub = new PqcAssetBridgeHub({ policy: POLICY });
    const request = baseRequest();
    request.releaseEpoch = 110;
    expect(() => hub.initiate(request)).toThrow(HsmAdapterError);
  });

  test('BridgeTimeLockEscrow rejects early release', () => {
    const escrow = new BridgeTimeLockEscrow({ policy: POLICY });
    const request = baseRequest();
    escrow.lock(request);
    expect(() => escrow.release(request, 150)).toThrow(HsmAdapterError);
  });

  test('BridgeTimeLockEscrow rejects expired claim', () => {
    const escrow = new BridgeTimeLockEscrow({ policy: POLICY });
    const request = baseRequest();
    escrow.lock(request);
    expect(() => escrow.release(request, 220)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates asset bridge configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'assetBridge', {
      committeeQuorum: 3,
      assetTransactionValue: 1000000,
      lockEpochDuration: 60,
      claimExpirationEpochs: 10,
      sourceAttestation: true,
      targetAttestation: true,
      bridgeAuthority: 'mock-authority',
      timeLockEscrow: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'assetBridge', { committeeQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { assetTransactionValue: 2000000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { lockEpochDuration: 30 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { claimExpirationEpochs: 20 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { sourceAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { targetAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { bridgeAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { timeLockEscrow: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'assetBridge', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
