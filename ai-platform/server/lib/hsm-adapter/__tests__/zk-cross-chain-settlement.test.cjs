'use strict';

/**
 * Track 50: ZK cross-chain settlement tests.
 */
const { ZkSettlementBroker } = require('../zk-settlement-broker.cjs');
const { ZkSettlementEqualityProver } = require('../zk-settlement-equality-prover.cjs');
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
  minClearingNodeQuorum: 3,
  maxSettlementTimeoutSeconds: 300,
  minAssetBitWidth: 8,
  maxAssetBitWidth: 256,
  requireNodeAttestation: true,
  allowedNodeAuthorities: ['mock-authority'],
  requireEqualityProof: true,
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
    settlementId: 'settle-1',
    assetId: 'asset-1',
    clearingNodes: ['node-a', 'node-b', 'node-c'],
    incomingCommitment: 1000n,
    outgoingCommitment: 1000n,
    timestamp: Math.floor(Date.now() / 1000),
    settlementTimeoutSeconds: 60,
  };
}

describe('Track 50 ZK cross-chain settlement', () => {
  test('ZkSettlementBroker initiates and finalizes a balanced settlement', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const prover = new ZkSettlementEqualityProver({ policy: POLICY });
    const broker = new ZkSettlementBroker({
      policy: POLICY,
      attestationClient,
      prover,
      audit: (event, info) => events.push({ event, info }),
    });
    broker.initiate(baseRequest());
    expect(events.some((e) => e.event === 'CROSS_CHAIN_SETTLEMENT_INITIATED')).toBe(true);

    broker.sign('settle-1', 'node-a', mockAttestation(), 'sig-a');
    broker.sign('settle-1', 'node-b', mockAttestation(), 'sig-b');
    broker.sign('settle-1', 'node-c', mockAttestation(), 'sig-c');

    const result = broker.finalize('settle-1');
    expect(result.finalized).toBe(true);
    expect(result.settlement.equalityProof).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_SETTLEMENT_FINALIZED')).toBe(true);
  });

  test('ZkSettlementBroker rejects unbalanced settlement', () => {
    const attestationClient = new MockAttestationClient();
    const prover = new ZkSettlementEqualityProver({ policy: POLICY });
    const broker = new ZkSettlementBroker({
      policy: POLICY,
      attestationClient,
      prover,
    });
    const request = baseRequest();
    request.outgoingCommitment = 900n;
    broker.initiate(request);
    broker.sign('settle-1', 'node-a', mockAttestation(), 'sig-a');
    broker.sign('settle-1', 'node-b', mockAttestation(), 'sig-b');
    broker.sign('settle-1', 'node-c', mockAttestation(), 'sig-c');
    expect(() => broker.finalize('settle-1')).toThrow(HsmAdapterError);
  });

  test('ZkSettlementBroker rejects un-attested node', () => {
    const attestationClient = new MockAttestationClient();
    const broker = new ZkSettlementBroker({
      policy: POLICY,
      attestationClient,
    });
    broker.initiate(baseRequest());
    expect(() => broker.sign('settle-1', 'node-a', { authority: 'bad' }, 'sig-a')).toThrow(HsmAdapterError);
  });

  test('ZkSettlementBroker rejects insufficient node quorum', () => {
    const broker = new ZkSettlementBroker({ policy: POLICY });
    broker.initiate(baseRequest());
    broker.sign('settle-1', 'node-a', mockAttestation(), 'sig-a');
    expect(() => broker.finalize('settle-1')).toThrow(HsmAdapterError);
  });

  test('ZkSettlementBroker rejects timeout too long', () => {
    const broker = new ZkSettlementBroker({ policy: POLICY });
    const request = baseRequest();
    request.settlementTimeoutSeconds = 600;
    expect(() => broker.initiate(request)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates ZK settlement configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'zkSettlement', {
      clearingNodeQuorum: 3,
      settlementTimeoutSeconds: 300,
      assetBitWidth: 64,
      nodeAttestation: true,
      nodeAuthority: 'mock-authority',
      equalityProof: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'zkSettlement', { clearingNodeQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { settlementTimeoutSeconds: 600 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { assetBitWidth: 4 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { assetBitWidth: 512 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { nodeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { nodeAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { equalityProof: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkSettlement', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
