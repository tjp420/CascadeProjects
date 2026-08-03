'use strict';

/**
 * Track 65: PQC Fractional Custody & ZK Release Verifiers —
 * extension tests.
 *
 * Tests the new cross-chain liquidity bridge support, escrow
 * locking, batch vault initialization, custodian committee
 * signature aggregation, vault cancellation, cross-chain
 * settlement, HW-SNARK proof generation, batch release
 * verification, slashing window validation, partial signature
 * aggregation, and summary statistics.
 */
const { PqcFractionalCustodyHub, VAULT_STATUS, ESCROW_LOCK_TYPES } = require('../pqc-fractional-custody-hub.cjs');
const { ZkFractionalReleaseVerifier, RELEASE_STATUS, SLASH_REASON, HW_ACCEL_TYPES } = require('../zk-fractional-release-verifier.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minCustodianQuorum: 3,
  maxFractionalBits: 64,
  maxAssetCustodyCap: 1000000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireClaimantAttestation: true,
  requireCustodianRelayAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderCustodyClaims: true,
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
    targetChainId: 'chain-b',
    blindedBalanceCommitment: 'pedersen-balance-001',
    assetDenomination: 'base',
    assetCustodyCap: 1000000,
    fractionalBits: 32,
    pqcSignatureScheme: 'ML-DSA-65',
    claimantAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseReleaseRequest(vaultId) {
  return {
    vaultId: vaultId || 'vault-001',
    blindedFractionCommitment: 'pedersen-fraction-001',
    zkPartitionProofHash: 'zk-partition-proof-001',
    custodianRelayAttestation: mockAttestation(),
    custodianRelayAttestationHash: 'relay-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    fractionValue: 100,
  };
}

function baseLiquidateRequest(vaultId, releasedFractionSum) {
  return {
    vaultId: vaultId || 'vault-001',
    releasedFractionSum: releasedFractionSum || 300,
  };
}

function setupHubAndVerifier() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcFractionalCustodyHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const verifier = new ZkFractionalReleaseVerifier({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, verifier };
}

function setupAndInitVault() {
  const ctx = setupHubAndVerifier();
  const vault = ctx.hub.initializeVault(baseInitRequest());
  return { ...ctx, vault };
}

function setupInitAndReleases(releaseCount = 3, fractionValue = 100) {
  const ctx = setupAndInitVault();
  for (let i = 0; i < releaseCount; i++) {
    const releaseReq = baseReleaseRequest(ctx.vault.vaultId);
    releaseReq.peerId = `peer-${i}`;
    releaseReq.fractionValue = fractionValue;
    ctx.verifier.verifyFractionalRelease(releaseReq);
  }
  return { ...ctx };
}

describe('Track 65 PQC Fractional Custody extensions', () => {
  describe('PqcFractionalCustodyHub — cross-chain liquidity bridges', () => {
    test('initializes vault with liquidity bridge parameters', () => {
      const ctx = setupHubAndVerifier();
      const req = baseInitRequest();
      req.liquidityBridge = {
        sourceChainId: 'chain-a',
        targetChainId: 'chain-b',
        bridgeType: 'hash_lock',
        bridgeCapacity: 500000,
        bridgeFeeBps: 10,
      };
      const vault = ctx.hub.initializeVault(req);
      expect(vault.liquidityBridge).toBeDefined();
      expect(vault.liquidityBridge.sourceChainId).toBe('chain-a');
      expect(vault.liquidityBridge.bridgeType).toBe('hash_lock');
    });

    test('rejects liquidity bridge with missing chain IDs', () => {
      const ctx = setupHubAndVerifier();
      const req = baseInitRequest();
      req.liquidityBridge = { bridgeType: 'hash_lock' };
      expect(() => ctx.hub.initializeVault(req)).toThrow(HsmAdapterError);
    });

    test('rejects invalid liquidity bridge object', () => {
      const ctx = setupHubAndVerifier();
      const req = baseInitRequest();
      req.liquidityBridge = 'not-an-object';
      expect(() => ctx.hub.initializeVault(req)).toThrow(HsmAdapterError);
    });

    test('VAULT_STATUS and ESCROW_LOCK_TYPES constants are exported', () => {
      expect(VAULT_STATUS.OPEN).toBe('open');
      expect(VAULT_STATUS.ESCROWED).toBe('escrowed');
      expect(VAULT_STATUS.LIQUIDATED).toBe('liquidated');
      expect(VAULT_STATUS.SETTLED).toBe('settled');
      expect(VAULT_STATUS.CANCELLED).toBe('cancelled');
      expect(ESCROW_LOCK_TYPES.TIME_LOCK).toBe('time_lock');
      expect(ESCROW_LOCK_TYPES.HASH_LOCK).toBe('hash_lock');
      expect(ESCROW_LOCK_TYPES.QUORUM_LOCK).toBe('quorum_lock');
    });
  });

  describe('PqcFractionalCustodyHub — escrow locking', () => {
    test('locks vault assets in escrow', () => {
      const ctx = setupAndInitVault();
      const escrow = ctx.hub.lockEscrow({
        vaultId: ctx.vault.vaultId,
        lockType: ESCROW_LOCK_TYPES.TIME_LOCK,
        lockedAmount: 500000,
      });
      expect(escrow.escrowId).toBeDefined();
      expect(escrow.lockType).toBe(ESCROW_LOCK_TYPES.TIME_LOCK);
      const vault = ctx.hub.getVault(ctx.vault.vaultId);
      expect(vault.status).toBe(VAULT_STATUS.ESCROWED);
    });

    test('releases escrow lock', () => {
      const ctx = setupAndInitVault();
      const escrow = ctx.hub.lockEscrow({
        vaultId: ctx.vault.vaultId,
        lockType: ESCROW_LOCK_TYPES.HASH_LOCK,
      });
      const result = ctx.hub.releaseEscrow(escrow.escrowId);
      expect(result.released).toBe(true);
      const vault = ctx.hub.getVault(ctx.vault.vaultId);
      expect(vault.status).toBe(VAULT_STATUS.OPEN);
    });

    test('rejects escrow on non-open vault', () => {
      const ctx = setupInitAndReleases();
      ctx.hub.liquidateVault(baseLiquidateRequest(ctx.vault.vaultId, 300));
      expect(() => ctx.hub.lockEscrow({ vaultId: ctx.vault.vaultId }))
        .toThrow(HsmAdapterError);
    });

    test('rejects escrow with invalid lock type', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.hub.lockEscrow({
        vaultId: ctx.vault.vaultId,
        lockType: 'invalid_lock',
      })).toThrow(HsmAdapterError);
    });

    test('rejects escrow with missing vaultId', () => {
      const { hub } = setupHubAndVerifier();
      expect(() => hub.lockEscrow({})).toThrow(HsmAdapterError);
    });

    test('rejects release of unknown escrow', () => {
      const { hub } = setupHubAndVerifier();
      expect(() => hub.releaseEscrow('unknown')).toThrow(HsmAdapterError);
    });

    test('returns escrow record via getEscrow', () => {
      const ctx = setupAndInitVault();
      const escrow = ctx.hub.lockEscrow({ vaultId: ctx.vault.vaultId });
      const retrieved = ctx.hub.getEscrow(escrow.escrowId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.escrowId).toBe(escrow.escrowId);
    });

    test('allows release recording on escrowed vault', () => {
      const ctx = setupAndInitVault();
      ctx.hub.lockEscrow({ vaultId: ctx.vault.vaultId });
      const release = ctx.verifier.verifyFractionalRelease(
        baseReleaseRequest(ctx.vault.vaultId)
      );
      expect(release.status).toBe(RELEASE_STATUS.RECORDED);
    });
  });

  describe('PqcFractionalCustodyHub — batch initialization', () => {
    test('batch initializes multiple vaults', () => {
      const { hub } = setupHubAndVerifier();
      const reqs = [];
      for (let i = 0; i < 3; i++) {
        const r = baseInitRequest();
        r.vaultId = `vault-batch-${i}`;
        reqs.push(r);
      }
      const result = hub.batchInitializeVaults(reqs);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test('batch init handles mixed valid/invalid', () => {
      const { hub } = setupHubAndVerifier();
      const r1 = baseInitRequest();
      r1.vaultId = 'vault-ok';
      const r2 = baseInitRequest();
      r2.vaultId = 'vault-ok'; // duplicate
      const r3 = baseInitRequest();
      r3.vaultId = 'vault-ok2';
      r3.fractionalBits = 128; // exceeds max
      const result = hub.batchInitializeVaults([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test('rejects empty batch', () => {
      const { hub } = setupHubAndVerifier();
      expect(() => hub.batchInitializeVaults([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { hub } = setupHubAndVerifier();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializeVaults(bigBatch)).toThrow(HsmAdapterError);
    });
  });

  describe('PqcFractionalCustodyHub — cross-chain settlement', () => {
    test('settles a liquidated vault cross-chain', () => {
      const ctx = setupInitAndReleases();
      ctx.hub.liquidateVault(baseLiquidateRequest(ctx.vault.vaultId, 300));
      const settlement = ctx.hub.settleVault({
        vaultId: ctx.vault.vaultId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe('chain-b');
    });

    test('rejects settlement of non-liquidated vault', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.hub.settleVault({
        vaultId: ctx.vault.vaultId,
        targetChainId: 'chain-b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with mismatched chain', () => {
      const ctx = setupInitAndReleases();
      ctx.hub.liquidateVault(baseLiquidateRequest(ctx.vault.vaultId, 300));
      expect(() => ctx.hub.settleVault({
        vaultId: ctx.vault.vaultId,
        targetChainId: 'wrong-chain',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with missing vaultId', () => {
      const { hub } = setupHubAndVerifier();
      expect(() => hub.settleVault({ targetChainId: 'chain-b' }))
        .toThrow(HsmAdapterError);
    });

    test('returns settlement record via getSettlement', () => {
      const ctx = setupInitAndReleases();
      ctx.hub.liquidateVault(baseLiquidateRequest(ctx.vault.vaultId, 300));
      ctx.hub.settleVault({ vaultId: ctx.vault.vaultId, targetChainId: 'chain-b' });
      const s = ctx.hub.getSettlement(ctx.vault.vaultId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe('chain-b');
    });
  });

  describe('PqcFractionalCustodyHub — committee aggregation', () => {
    test('aggregates custodian signatures', () => {
      const ctx = setupAndInitVault();
      const result = ctx.hub.aggregateCustodianSignatures(ctx.vault.vaultId, [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects aggregation with insufficient signatures', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.hub.aggregateCustodianSignatures(ctx.vault.vaultId, [
        { peerId: 'p1', signature: 'sig-1' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with no signatures', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.hub.aggregateCustodianSignatures(ctx.vault.vaultId, []))
        .toThrow(HsmAdapterError);
    });

    test('rejects aggregation for unknown vault', () => {
      const { hub } = setupHubAndVerifier();
      expect(() => hub.aggregateCustodianSignatures('unknown', [
        { peerId: 'p1', signature: 's1' },
        { peerId: 'p2', signature: 's2' },
        { peerId: 'p3', signature: 's3' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('PqcFractionalCustodyHub — cancellation', () => {
    test('cancels an open vault', () => {
      const ctx = setupAndInitVault();
      const result = ctx.hub.cancelVault(ctx.vault.vaultId);
      expect(result.cancelled).toBe(true);
      const vault = ctx.hub.getVault(ctx.vault.vaultId);
      expect(vault.status).toBe(VAULT_STATUS.CANCELLED);
    });

    test('rejects cancelling liquidated vault', () => {
      const ctx = setupInitAndReleases();
      ctx.hub.liquidateVault(baseLiquidateRequest(ctx.vault.vaultId, 300));
      expect(() => ctx.hub.cancelVault(ctx.vault.vaultId))
        .toThrow(HsmAdapterError);
    });

    test('rejects double cancellation', () => {
      const ctx = setupAndInitVault();
      ctx.hub.cancelVault(ctx.vault.vaultId);
      expect(() => ctx.hub.cancelVault(ctx.vault.vaultId))
        .toThrow(HsmAdapterError);
    });

    test('rejects cancelling unknown vault', () => {
      const { hub } = setupHubAndVerifier();
      expect(() => hub.cancelVault('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('PqcFractionalCustodyHub — queries and stats', () => {
    test('returns vaults list', () => {
      const ctx = setupAndInitVault();
      expect(ctx.hub.getVaults().length).toBe(1);
    });

    test('returns summary stats', () => {
      const ctx = setupAndInitVault();
      const stats = ctx.hub.getStats();
      expect(stats.totalVaults).toBe(1);
      expect(stats.vaultsByStatus).toBeDefined();
      expect(stats.initCount).toBeGreaterThan(0);
    });
  });

  describe('ZkFractionalReleaseVerifier — HW-SNARK proof generation', () => {
    test('generates a hardware-accelerated SNARK proof', () => {
      const ctx = setupAndInitVault();
      const proof = ctx.verifier.generateHwSnarkProof({
        vaultId: ctx.vault.vaultId,
        fractionValue: 250,
      });
      expect(proof.zkPartitionProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe('groth16');
    });

    test('rejects proof generation with missing vaultId', () => {
      const { verifier } = setupHubAndVerifier();
      expect(() => verifier.generateHwSnarkProof({ fractionValue: 100 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects proof generation with missing fractionValue', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.verifier.generateHwSnarkProof({ vaultId: ctx.vault.vaultId }))
        .toThrow(HsmAdapterError);
    });

    test('rejects proof generation for unknown vault', () => {
      const { verifier } = setupHubAndVerifier();
      expect(() => verifier.generateHwSnarkProof({
        vaultId: 'unknown',
        fractionValue: 100,
      })).toThrow(HsmAdapterError);
    });
  });

  describe('ZkFractionalReleaseVerifier — batch release verification', () => {
    test('batch verifies multiple fractional releases', () => {
      const ctx = setupHubAndVerifier();
      const vaults = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.vaultId = `vault-bv-${i}`;
        const v = ctx.hub.initializeVault(req);
        vaults.push(v);
      }
      const batch = vaults.map((v, i) => {
        const r = baseReleaseRequest(v.vaultId);
        r.peerId = `peer-bv-${i}`;
        return r;
      });
      const result = ctx.verifier.batchVerifyReleases(batch);
      expect(result.recordedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test('batch verification handles mixed valid/invalid', () => {
      const ctx = setupHubAndVerifier();
      const req = baseInitRequest();
      req.vaultId = 'vault-mix';
      ctx.hub.initializeVault(req);
      const batch = [
        (() => { const r = baseReleaseRequest('vault-mix'); r.peerId = 'p1'; return r; })(),
        (() => { const r = baseReleaseRequest('vault-mix'); r.peerId = 'p2'; return r; })(),
        (() => { const r = baseReleaseRequest('unknown-vault'); r.peerId = 'p3'; return r; })(),
      ];
      const result = ctx.verifier.batchVerifyReleases(batch);
      expect(result.recordedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test('rejects empty batch', () => {
      const { verifier } = setupHubAndVerifier();
      expect(() => verifier.batchVerifyReleases([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { verifier } = setupHubAndVerifier();
      const bigBatch = Array.from({ length: 101 }, () => baseReleaseRequest('x'));
      expect(() => verifier.batchVerifyReleases(bigBatch)).toThrow(HsmAdapterError);
    });

    test('records batch history', () => {
      const ctx = setupHubAndVerifier();
      const req = baseInitRequest();
      req.vaultId = 'vault-bh';
      ctx.hub.initializeVault(req);
      const r = baseReleaseRequest('vault-bh');
      r.peerId = 'p-bh';
      ctx.verifier.batchVerifyReleases([r]);
      expect(ctx.verifier.getBatchHistory().length).toBe(1);
    });
  });

  describe('ZkFractionalReleaseVerifier — partial signature aggregation', () => {
    test('aggregates partial signatures', () => {
      const ctx = setupAndInitVault();
      const result = ctx.verifier.aggregatePartialSignatures(ctx.vault.vaultId, [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects aggregation with banned peer', () => {
      const ctx = setupAndInitVault();
      // Ban a peer first
      const releaseReq = baseReleaseRequest(ctx.vault.vaultId);
      releaseReq.zkPartitionProofHash = null;
      releaseReq.peerId = 'bad-peer';
      try { ctx.verifier.verifyFractionalRelease(releaseReq); } catch (e) { /* expected */ }
      expect(ctx.verifier.isPeerBanned('bad-peer')).toBe(true);
      expect(() => ctx.verifier.aggregatePartialSignatures(ctx.vault.vaultId, [
        { peerId: 'bad-peer', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with insufficient signatures', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.verifier.aggregatePartialSignatures(ctx.vault.vaultId, [
        { peerId: 'p1', signature: 'sig-1' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with missing vaultId', () => {
      const { verifier } = setupHubAndVerifier();
      expect(() => verifier.aggregatePartialSignatures('', [
        { peerId: 'p1', signature: 's1' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('ZkFractionalReleaseVerifier — slashing window validation', () => {
    test('validates release within slashing window', () => {
      const ctx = setupAndInitVault();
      const releaseTs = Math.floor(Date.now() / 1000);
      const result = ctx.verifier.validateSlashingWindow(ctx.vault.vaultId, releaseTs);
      expect(result.withinWindow).toBe(true);
    });

    test('detects release outside slashing window', () => {
      const ctx = setupAndInitVault();
      const releaseTs = Math.floor(Date.now() / 1000) + 100000;
      const result = ctx.verifier.validateSlashingWindow(ctx.vault.vaultId, releaseTs);
      expect(result.withinWindow).toBe(false);
    });

    test('rejects validation for unknown vault', () => {
      const { verifier } = setupHubAndVerifier();
      expect(() => verifier.validateSlashingWindow('unknown', 1000))
        .toThrow(HsmAdapterError);
    });

    test('rejects validation with invalid timestamp', () => {
      const ctx = setupAndInitVault();
      expect(() => ctx.verifier.validateSlashingWindow(ctx.vault.vaultId, 'bad'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('ZkFractionalReleaseVerifier — slashing and stats', () => {
    test('records slashes for malformed releases', () => {
      const ctx = setupAndInitVault();
      const releaseReq = baseReleaseRequest(ctx.vault.vaultId);
      releaseReq.zkPartitionProofHash = null;
      releaseReq.peerId = 'peer-slash';
      try { ctx.verifier.verifyFractionalRelease(releaseReq); } catch (e) { /* expected */ }
      const stats = ctx.verifier.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('returns slashed releases list', () => {
      const ctx = setupAndInitVault();
      const releaseReq = baseReleaseRequest(ctx.vault.vaultId);
      releaseReq.zkPartitionProofHash = null;
      releaseReq.peerId = 'peer-slash-2';
      try { ctx.verifier.verifyFractionalRelease(releaseReq); } catch (e) { /* expected */ }
      expect(ctx.verifier.getSlashedReleases().length).toBeGreaterThan(0);
    });

    test('returns summary stats', () => {
      const ctx = setupInitAndReleases();
      const stats = ctx.verifier.getStats();
      expect(stats.totalRecorded).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test('RELEASE_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported', () => {
      expect(RELEASE_STATUS.RECORDED).toBe('recorded');
      expect(RELEASE_STATUS.SLASHED).toBe('slashed');
      expect(SLASH_REASON.MALFORMED).toBe('malformed_release');
      expect(SLASH_REASON.DUPLICATE).toBe('duplicate_release');
      expect(SLASH_REASON.BANNED_PEER).toBe('banned_peer');
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe('gpu_cuda');
      expect(HW_ACCEL_TYPES.ASIC).toBe('asic');
      expect(HW_ACCEL_TYPES.SIMULATED).toBe('simulated');
    });
  });

  describe('full Track 65 extended flow', () => {
    test('complete init → escrow → release → liquidate → settle flow', () => {
      const ctx = setupHubAndVerifier();
      // Initialize vault with liquidity bridge
      const req = baseInitRequest();
      req.vaultId = 'vault-full-flow';
      req.liquidityBridge = {
        sourceChainId: 'chain-a',
        targetChainId: 'chain-b',
        bridgeType: 'hash_lock',
      };
      const vault = ctx.hub.initializeVault(req);
      expect(vault.liquidityBridge).toBeDefined();
      // Lock escrow
      const escrow = ctx.hub.lockEscrow({
        vaultId: vault.vaultId,
        lockType: ESCROW_LOCK_TYPES.HASH_LOCK,
      });
      expect(escrow.escrowId).toBeDefined();
      // Generate HW-SNARK proof
      const snarkProof = ctx.verifier.generateHwSnarkProof({
        vaultId: vault.vaultId,
        fractionValue: 100,
      });
      expect(snarkProof.zkPartitionProofHash).toBeDefined();
      // Record fractional releases (on escrowed vault)
      for (let i = 0; i < 3; i++) {
        const releaseReq = baseReleaseRequest(vault.vaultId);
        releaseReq.peerId = `peer-${i}`;
        releaseReq.zkPartitionProofHash = `${snarkProof.zkPartitionProofHash}-${i}`;
        const release = ctx.verifier.verifyFractionalRelease(releaseReq);
        expect(release.status).toBe(RELEASE_STATUS.RECORDED);
      }
      // Aggregate custodian signatures
      const sigResult = ctx.hub.aggregateCustodianSignatures(vault.vaultId, [
        { peerId: 'peer-0', signature: 'sig-0' },
        { peerId: 'peer-1', signature: 'sig-1' },
        { peerId: 'peer-2', signature: 'sig-2' },
      ]);
      expect(sigResult.signatureCount).toBe(3);
      // Liquidate vault
      const liquidation = ctx.hub.liquidateVault({
        vaultId: vault.vaultId,
        releasedFractionSum: 300,
      });
      expect(liquidation.liquidationId).toBeDefined();
      // Settle cross-chain
      const settlement = ctx.hub.settleVault({
        vaultId: vault.vaultId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      // Validate slashing window
      const windowResult = ctx.verifier.validateSlashingWindow(
        vault.vaultId,
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      // Verify stats
      const hStats = ctx.hub.getStats();
      expect(hStats.liquidateCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      expect(hStats.escrowCount).toBeGreaterThan(0);
      const vStats = ctx.verifier.getStats();
      expect(vStats.releaseCount).toBeGreaterThan(0);
      expect(vStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
