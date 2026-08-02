'use strict';

/**
 * Track 58: PQC Vesting Locks tests.
 */
const { PqcVestingEscrowHub } = require('../pqc-vesting-escrow-hub.cjs');
const { VestingTemporalGuard } = require('../vesting-temporal-guard.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minVestingEpochSeconds: 3600,
  minReleaseSignatureQuorum: 3,
  maxAssetValueCap: 1000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireClaimantAttestation: true,
  requireCommitteeRelayAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banExpiredOrDuplicateClaims: true,
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

function baseInitRequest() {
  return {
    sourceTenantId: 'tenant-a',
    assetId: 'asset-1',
    assetValue: 100000,
    totalEpochs: 3,
    epochSeconds: 3600,
    pqcSignatureScheme: 'ML-DSA-65',
    claimantAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(lockId, epochIndex) {
  return {
    lockId,
    epochIndex,
    claimantAttestation: mockAttestation(),
    committeeRelays: [
      { nodeId: 'relay-a', attestation: mockAttestation() },
      { nodeId: 'relay-b', attestation: mockAttestation() },
      { nodeId: 'relay-c', attestation: mockAttestation() },
    ],
    thresholdSignatures: ['sig-a', 'sig-b', 'sig-c'],
    claimTimestamp: Math.floor(Date.now() / 1000),
  };
}

describe('Track 58 PQC vesting locks', () => {
  test('PqcVestingEscrowHub initializes a vesting lock and emits VESTING_LOCK_INITIALIZED', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const lock = hub.initializeLock(baseInitRequest());
    expect(lock.status).toBe('active');
    expect(lock.lockId).toBeDefined();
    expect(events.some((e) => e.event === 'VESTING_LOCK_INITIALIZED')).toBe(true);
  });

  test('PqcVestingEscrowHub processes a valid epoch release claim', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const temporalGuard = new VestingTemporalGuard({ policy: POLICY });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
      temporalGuard,
      audit: (event, info) => events.push({ event, info }),
    });
    const lock = hub.initializeLock(baseInitRequest());
    // Simulate time elapse by using a future timestamp
    const futureTime = lock.initializedAt + 3601;
    const claimReq = baseClaimRequest(lock.lockId, 1);
    claimReq.claimTimestamp = futureTime;
    const result = hub.claimEpochRelease(claimReq);
    expect(result.claim.releaseAmount).toBeGreaterThan(0);
    expect(events.some((e) => e.event === 'VESTING_EPOCH_RELEASE_CLAIMED')).toBe(true);
  });

  test('PqcVestingEscrowHub completes escrow after all epochs and emits VESTING_ESCROW_COMPLETED', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const temporalGuard = new VestingTemporalGuard({ policy: POLICY });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
      temporalGuard,
      audit: (event, info) => events.push({ event, info }),
    });
    const lock = hub.initializeLock(baseInitRequest());
    for (let i = 1; i <= 3; i++) {
      const claimReq = baseClaimRequest(lock.lockId, i);
      claimReq.claimTimestamp = lock.initializedAt + (i * 3600) + 1;
      hub.claimEpochRelease(claimReq);
    }
    const finalLock = hub.getLock(lock.lockId);
    expect(finalLock.status).toBe('completed');
    expect(events.some((e) => e.event === 'VESTING_ESCROW_COMPLETED')).toBe(true);
  });

  test('PqcVestingEscrowHub rejects un-attested claimant', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.claimantAttestation = { authority: 'bad' };
    expect(() => hub.initializeLock(request)).toThrow(HsmAdapterError);
  });

  test('PqcVestingEscrowHub rejects un-attested committee relay', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const temporalGuard = new VestingTemporalGuard({ policy: POLICY });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
      temporalGuard,
    });
    const lock = hub.initializeLock(baseInitRequest());
    const claimReq = baseClaimRequest(lock.lockId, 1);
    claimReq.claimTimestamp = lock.initializedAt + 3601;
    claimReq.committeeRelays[0].attestation = { authority: 'bad' };
    expect(() => hub.claimEpochRelease(claimReq)).toThrow(HsmAdapterError);
  });

  test('PqcVestingEscrowHub rejects insufficient release signature quorum', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const temporalGuard = new VestingTemporalGuard({ policy: POLICY });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
      temporalGuard,
    });
    const lock = hub.initializeLock(baseInitRequest());
    const claimReq = baseClaimRequest(lock.lockId, 1);
    claimReq.claimTimestamp = lock.initializedAt + 3601;
    claimReq.thresholdSignatures = ['sig-a', 'sig-b'];
    expect(() => hub.claimEpochRelease(claimReq)).toThrow(HsmAdapterError);
  });

  test('PqcVestingEscrowHub rejects asset value exceeding cap', () => {
    const hub = new PqcVestingEscrowHub({ policy: POLICY });
    const request = baseInitRequest();
    request.assetValue = 2000000;
    expect(() => hub.initializeLock(request)).toThrow(HsmAdapterError);
  });

  test('PqcVestingEscrowHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcVestingEscrowHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializeLock(request)).toThrow(HsmAdapterError);
  });

  test('PqcVestingEscrowHub rejects vesting epoch below minimum', () => {
    const hub = new PqcVestingEscrowHub({ policy: POLICY });
    const request = baseInitRequest();
    request.epochSeconds = 60;
    expect(() => hub.initializeLock(request)).toThrow(HsmAdapterError);
  });

  test('PqcVestingEscrowHub bans peers broadcasting duplicate claims', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const temporalGuard = new VestingTemporalGuard({ policy: POLICY });
    const hub = new PqcVestingEscrowHub({
      policy: POLICY,
      attestationClient,
      temporalGuard,
    });
    const lock = hub.initializeLock(baseInitRequest());
    const claimReq = baseClaimRequest(lock.lockId, 1);
    claimReq.claimTimestamp = lock.initializedAt + 3601;
    claimReq.peerId = 'peer-bad';
    hub.claimEpochRelease(claimReq);
    // Try duplicate epoch
    const dupReq = baseClaimRequest(lock.lockId, 1);
    dupReq.claimTimestamp = lock.initializedAt + 3601;
    dupReq.peerId = 'peer-bad';
    expect(() => hub.claimEpochRelease(dupReq)).toThrow(HsmAdapterError);
    expect(hub.isPeerBanned('peer-bad')).toBe(true);
  });

  test('VestingTemporalGuard blocks premature release claims', () => {
    const guard = new VestingTemporalGuard({ policy: POLICY });
    const result = guard.verifyEpochWindow({
      lockId: 'lock-1',
      epochIndex: 1,
      initializedAt: Math.floor(Date.now() / 1000),
      epochSeconds: 3600,
      claimTimestamp: Math.floor(Date.now() / 1000),
    });
    expect(result.allowed).toBe(false);
  });

  test('VestingTemporalGuard permits release after epoch window elapses', () => {
    const guard = new VestingTemporalGuard({ policy: POLICY });
    const now = Math.floor(Date.now() / 1000);
    const result = guard.verifyEpochWindow({
      lockId: 'lock-1',
      epochIndex: 1,
      initializedAt: now - 3700,
      epochSeconds: 3600,
      claimTimestamp: now,
    });
    expect(result.allowed).toBe(true);
  });

  test('CryptoPolicyEngine validates pqc vesting locks configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqcVestingLocks', {
      vestingEpochSeconds: 3600,
      releaseSignatureQuorum: 3,
      assetValue: 100000,
      pqcSignatureScheme: 'ML-DSA-65',
      claimantAttestation: true,
      committeeRelayAttestation: true,
      attestationAuthority: 'mock-authority',
      banExpiredOrDuplicateClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqcVestingLocks', { vestingEpochSeconds: 60 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { releaseSignatureQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { assetValue: 2000000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { claimantAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { committeeRelayAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { banExpiredOrDuplicateClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcVestingLocks', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
