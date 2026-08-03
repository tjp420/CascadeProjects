'use strict';

/**
 * Track 48: PQC asset bridge tests.
 */
const { PqcAssetBridgeHub } = require('../pqc-asset-bridge-hub.cjs');
const { BridgeTimeLockEscrow } = require('../bridge-time-lock-escrow.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
}

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

function baseTransfer() {
  return {
    transferId: 'bridge-1',
    sourcePlatform: 'platform-a',
    targetPlatform: 'platform-b',
    assetId: 'asset-xyz',
    amount: 100000,
    recipient: 'recipient-1',
    lockEpoch: 100,
    releaseEpoch: 200,
    sourceAttestation: mockAttestation(),
    targetAttestation: mockAttestation(),
    bridgeAuthority: 'mock-authority',
  };
}

describe('Track 48 PQC asset bridge', () => {
  test('PqcAssetBridgeHub initiates and releases with escrow', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const escrow = new BridgeTimeLockEscrow();
    escrow.setEpoch(200);
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
      escrow,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = hub.initiate(baseTransfer());
    expect(result.initiated).toBe(true);
    expect(result.payload).toMatch(/^BRIDGE:/);
    expect(events.some((e) => e.event === 'BRIDGE_TRANSFER_INITIATED')).toBe(true);

    hub.signAndRelease('bridge-1', 'cm-1', mockAttestation(), 'sig-1');
    hub.signAndRelease('bridge-1', 'cm-2', mockAttestation(), 'sig-2');
    const release = hub.signAndRelease('bridge-1', 'cm-3', mockAttestation(), 'sig-3');
    expect(release.released).toBe(true);
    expect(events.some((e) => e.event === 'ESCROW_RELEASE_FINALIZED')).toBe(true);
  });

  test('PqcAssetBridgeHub validates a cross-chain claim', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
    });
    const result = hub.validateClaim({
      transferId: 'bridge-1',
      targetPlatform: 'platform-b',
      lockedAtEpoch: 100,
      claimedAtEpoch: 105,
      targetAttestation: mockAttestation(),
    });
    expect(result.valid).toBe(true);
  });

  test('PqcAssetBridgeHub rejects excessive asset value', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
    });
    const transfer = baseTransfer();
    transfer.amount = 2000000;
    expect(() => hub.initiate(transfer)).toThrow(HsmAdapterError);
  });

  test('PqcAssetBridgeHub rejects un-attested source', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
    });
    const transfer = baseTransfer();
    transfer.sourceAttestation = { authority: 'bad' };
    expect(() => hub.initiate(transfer)).toThrow(HsmAdapterError);
  });

  test('PqcAssetBridgeHub rejects short lock duration', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
    });
    const transfer = baseTransfer();
    transfer.releaseEpoch = 130;
    expect(() => hub.initiate(transfer)).toThrow(HsmAdapterError);
  });

  test('BridgeTimeLockEscrow rejects release before time-lock', () => {
    const escrow = new BridgeTimeLockEscrow();
    escrow.setEpoch(150);
    escrow.lock('bridge-1', 100000, 100, 200);
    expect(escrow.validateClaim('bridge-1').valid).toBe(false);
  });

  test('PqcAssetBridgeHub rejects expired cross-chain claim', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcAssetBridgeHub({
      policy: POLICY,
      attestationClient,
    });
    expect(() => hub.validateClaim({
      transferId: 'bridge-1',
      targetPlatform: 'platform-b',
      lockedAtEpoch: 100,
      claimedAtEpoch: 120,
      targetAttestation: mockAttestation(),
    })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates asset bridge configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'assetBridge', {
      committeeQuorum: 3,
      assetTransactionValue: 500000,
      lockEpochDuration: 100,
      claimExpirationEpochs: 5,
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
