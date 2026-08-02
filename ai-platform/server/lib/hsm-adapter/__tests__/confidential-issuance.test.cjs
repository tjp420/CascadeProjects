'use strict';

/**
 * Track 44: Confidential token issuance tests.
 */
const { ConfidentialTokenIssuer } = require('../confidential-token-issuer.cjs');
const { TokenClaimVerifier } = require('../token-claim-verifier.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minTokenBitLength: 256,
  allowedBlindingSchemes: ['pedersen', 'hash-to-curve'],
  requireMintingAttestation: true,
  allowedMintingAuthorities: ['mock-authority'],
  requireZkSnarkProof: true,
  minProofAgeSeconds: 0,
  maxProofAgeSeconds: 60,
  allowedCommitmentCurves: ['secp256k1', 'bn254'],
  minIssuanceQuorum: 2,
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

describe('Track 44 confidential token issuance', () => {
  test('ConfidentialTokenIssuer mints an attested token and emits telemetry', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = issuer.mint('gold', 2n ** 260n, mockAttestation(), ['a', 'b']);
    expect(result.token).toBeDefined();
    expect(result.token.commitment).toMatch(/^C-/);
    expect(result.token.proof).toMatch(/[a-f0-9]{64}/);
    expect(events.some((e) => e.event === 'CONFIDENTIAL_TOKEN_MINTED')).toBe(true);
  });

  test('ConfidentialTokenIssuer rejects un-attested mint', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
    });
    expect(() => issuer.mint('gold', 2n ** 260n, { authority: 'bad' }, ['a', 'b'])).toThrow(HsmAdapterError);
  });

  test('ConfidentialTokenIssuer rejects amount below bit length', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
    });
    expect(() => issuer.mint('gold', 100n, mockAttestation(), ['a', 'b'])).toThrow(HsmAdapterError);
  });

  test('ConfidentialTokenIssuer rejects quorum below minimum', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
    });
    expect(() => issuer.mint('gold', 2n ** 260n, mockAttestation(), ['a'])).toThrow(HsmAdapterError);
  });

  test('TokenClaimVerifier validates a fresh ownership claim', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
    });
    const { token, amount, blinding } = issuer.mint('gold', 2n ** 260n, mockAttestation(), ['a', 'b']);
    const verifier = new TokenClaimVerifier({
      policy: POLICY,
      audit: (event, info) => events.push({ event, info }),
    });
    const claim = {
      commitment: token.commitment,
      amount,
      blinding,
    };
    const result = verifier.verify(token, claim);
    expect(result.verified).toBe(true);
    expect(events.some((e) => e.event === 'ISSUANCE_PROOF_VALIDATED')).toBe(true);
  });

  test('TokenClaimVerifier rejects stale proof', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
    });
    const { token } = issuer.mint('gold', 2n ** 260n, mockAttestation(), ['a', 'b']);
    token.timestamp = Math.floor(Date.now() / 1000) - 100;
    const verifier = new TokenClaimVerifier({ policy: POLICY });
    expect(() => verifier.verify(token, { commitment: token.commitment })).toThrow(HsmAdapterError);
  });

  test('TokenClaimVerifier rejects commitment mismatch', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ConfidentialTokenIssuer({
      policy: POLICY,
      attestationClient,
    });
    const { token } = issuer.mint('gold', 2n ** 260n, mockAttestation(), ['a', 'b']);
    const verifier = new TokenClaimVerifier({ policy: POLICY });
    expect(() => verifier.verify(token, { commitment: 'wrong' })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates confidential issuance configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'confidentialIssuance', {
      tokenBitLength: 256,
      blindingScheme: 'pedersen',
      mintingAttestation: true,
      mintingAuthority: 'mock-authority',
      zkSnarkProof: true,
      proofAgeSeconds: 30,
      commitmentCurve: 'secp256k1',
      issuanceQuorum: 2,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'confidentialIssuance', { tokenBitLength: 128 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { blindingScheme: 'plain' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { mintingAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { mintingAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { zkSnarkProof: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { proofAgeSeconds: 120 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { commitmentCurve: 'ed25519' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'confidentialIssuance', { issuanceQuorum: 1 })).toThrow(HsmAdapterError);
  });
});
