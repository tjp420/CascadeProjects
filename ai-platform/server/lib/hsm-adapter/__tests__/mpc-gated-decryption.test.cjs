'use strict';

/**
 * Track 54: MPC gated decryption tests.
 */
const { MpcCircuitProcessor } = require('../mpc-circuit-processor.cjs');
const { MpcGatedDecryptor } = require('../mpc-gated-decryptor.cjs');
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
  minCircuitNodes: 3,
  maxMultiplicationGateDepth: 8,
  transactionTimeoutSeconds: 300,
  requireEnclaveAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  requireCircuitSatisfactionProof: true,
  requireCanonicalPayloadLayout: true,
};

const PQC_THRESHOLD_POLICY = {
  minSignatureThreshold: 3,
  maxCommitteeSize: 10,
  signatureAlgorithm: 'ML-DSA-65',
  requireHybridMode: true,
  allowedCurves: ['P-256', 'P-384', 'P-521'],
  maxSignatureAgeSeconds: 300,
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

function baseNodes() {
  return [
    { nodeId: 'node-a', attestation: mockAttestation() },
    { nodeId: 'node-b', attestation: mockAttestation() },
    { nodeId: 'node-c', attestation: mockAttestation() },
  ];
}

describe('Track 54 MPC gated decryption', () => {
  test('MpcCircuitProcessor initiates and completes circuit evaluation', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const processor = new MpcCircuitProcessor({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const circuit = processor.initiate({
      circuitId: 'circuit-1',
      gateType: 'add',
      nodes: baseNodes(),
      multiplicationGateDepth: 2,
    });
    expect(circuit.status).toBe('pending');
    expect(events.some((e) => e.event === 'MPC_CIRCUIT_EVALUATION_INITIATED')).toBe(true);

    processor.submit('circuit-1', 'node-a', 'share-a');
    processor.submit('circuit-1', 'node-b', 'share-b');
    const result = processor.submit('circuit-1', 'node-c', 'share-c');
    expect(result.status).toBe('satisfied');
  });

  test('MpcGatedDecryptor unlocks after valid circuit satisfaction', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const processor = new MpcCircuitProcessor({
      policy: POLICY,
      attestationClient,
    });
    const circuit = processor.initiate({
      circuitId: 'circuit-2',
      gateType: 'mul',
      nodes: baseNodes(),
      multiplicationGateDepth: 3,
    });
    processor.submit('circuit-2', 'node-a', 'share-a');
    processor.submit('circuit-2', 'node-b', 'share-b');
    processor.submit('circuit-2', 'node-c', 'share-c');

    const decryptor = new MpcGatedDecryptor({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = decryptor.unseal({
      circuit,
      circuitSatisfactionProof: circuit.satisfactionProofHash,
      enclaveAttestation: mockAttestation(),
    });
    expect(result.unsealed).toBe(true);
    expect(events.some((e) => e.event === 'MPC_DECRYPTION_GATE_UNLOCKED')).toBe(true);
  });

  test('MpcGatedDecryptor rejects without circuit satisfaction proof', () => {
    const attestationClient = new MockAttestationClient();
    const processor = new MpcCircuitProcessor({
      policy: POLICY,
      attestationClient,
    });
    const circuit = processor.initiate({
      circuitId: 'circuit-3',
      nodes: baseNodes(),
    });
    const decryptor = new MpcGatedDecryptor({
      policy: POLICY,
      attestationClient,
    });
    expect(() => decryptor.unseal({
      circuit,
      enclaveAttestation: mockAttestation(),
    })).toThrow(HsmAdapterError);
  });

  test('MpcGatedDecryptor rejects unsatisfied circuit', () => {
    const attestationClient = new MockAttestationClient();
    const processor = new MpcCircuitProcessor({
      policy: POLICY,
      attestationClient,
    });
    const circuit = processor.initiate({
      circuitId: 'circuit-4',
      nodes: baseNodes(),
    });
    processor.submit('circuit-4', 'node-a', 'share-a');
    const decryptor = new MpcGatedDecryptor({
      policy: POLICY,
      attestationClient,
    });
    expect(() => decryptor.unseal({
      circuit,
      circuitSatisfactionProof: 'proof',
      enclaveAttestation: mockAttestation(),
    })).toThrow(HsmAdapterError);
  });

  test('MpcCircuitProcessor rejects un-attested node', () => {
    const attestationClient = new MockAttestationClient();
    const processor = new MpcCircuitProcessor({
      policy: POLICY,
      attestationClient,
    });
    const nodes = baseNodes();
    nodes[0].attestation = { authority: 'bad' };
    expect(() => processor.initiate({
      circuitId: 'circuit-5',
      nodes,
    })).toThrow(HsmAdapterError);
  });

  test('MpcCircuitProcessor rejects insufficient circuit nodes', () => {
    const processor = new MpcCircuitProcessor({ policy: POLICY });
    expect(() => processor.initiate({
      circuitId: 'circuit-6',
      nodes: [baseNodes()[0]],
    })).toThrow(HsmAdapterError);
  });

  test('MpcCircuitProcessor rejects multiplication gate depth exceeding maximum', () => {
    const processor = new MpcCircuitProcessor({ policy: POLICY });
    expect(() => processor.initiate({
      circuitId: 'circuit-7',
      nodes: baseNodes(),
      multiplicationGateDepth: 16,
    })).toThrow(HsmAdapterError);
  });

  test('MpcGatedDecryptor rejects un-attested enclave', () => {
    const attestationClient = new MockAttestationClient();
    const processor = new MpcCircuitProcessor({
      policy: POLICY,
      attestationClient,
    });
    const circuit = processor.initiate({
      circuitId: 'circuit-8',
      nodes: baseNodes(),
    });
    processor.submit('circuit-8', 'node-a', 'share-a');
    processor.submit('circuit-8', 'node-b', 'share-b');
    processor.submit('circuit-8', 'node-c', 'share-c');

    const decryptor = new MpcGatedDecryptor({
      policy: POLICY,
      attestationClient,
    });
    expect(() => decryptor.unseal({
      circuit,
      circuitSatisfactionProof: circuit.satisfactionProofHash,
      enclaveAttestation: { authority: 'bad' },
    })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates MPC gated decryption configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'mpcGatedDecryption', {
      circuitNodes: 3,
      multiplicationGateDepth: 4,
      transactionAgeSeconds: 100,
      enclaveAttestation: true,
      attestationAuthority: 'mock-authority',
      circuitSatisfactionProof: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'mpcGatedDecryption', { circuitNodes: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'mpcGatedDecryption', { multiplicationGateDepth: 16 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'mpcGatedDecryption', { transactionAgeSeconds: 600 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'mpcGatedDecryption', { enclaveAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'mpcGatedDecryption', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'mpcGatedDecryption', { circuitSatisfactionProof: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'mpcGatedDecryption', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates PQC threshold configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqcThreshold', {
      signatureThreshold: 3,
      committeeSize: 5,
      signatureAlgorithm: 'ML-DSA-65',
      hybridMode: true,
      curve: 'P-256',
      signatureAgeSeconds: 100,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqcThreshold', { signatureThreshold: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcThreshold', { committeeSize: 20 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcThreshold', { signatureAlgorithm: 'ML-DSA-87' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcThreshold', { hybridMode: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcThreshold', { curve: 'secp256k1' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcThreshold', { signatureAgeSeconds: 600 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcThreshold', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
