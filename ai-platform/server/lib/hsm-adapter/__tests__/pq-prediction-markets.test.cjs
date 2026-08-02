'use strict';

/**
 * Track 64: PQ Prediction Markets tests.
 */
const { PqcPredictionMarketHub } = require('../pqc-prediction-market-hub.cjs');
const { ZkMarketResolutionValidator } = require('../zk-market-resolution-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minReporterQuorum: 3,
  maxDisputeResolutionEpochs: 5,
  maxContractLifetimeSeconds: 2592000,
  maxAssetWeightCap: 1000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireMarketInitializerAttestation: true,
  requireReporterRelayAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderResolutionClaims: true,
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
  const now = Math.floor(Date.now() / 1000);
  return {
    sourceTenantId: 'tenant-a',
    targetChainId: 'chain-b',
    marketType: 'binary',
    blindedOutcomeCommitment: 'pedersen-outcome-001',
    assetWeight: 1000,
    expirationTimestamp: now + 86400,
    pqcSignatureScheme: 'ML-DSA-65',
    marketInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseVoteRequest(marketId) {
  return {
    marketId: marketId || 'market-001',
    blindedVoteCommitment: 'pedersen-vote-001',
    zkTruthProofHash: 'zk-truth-proof-001',
    reporterRelayAttestation: mockAttestation(),
    reporterRelayAttestationHash: 'relay-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
  };
}

function baseFinalizeRequest(marketId) {
  return {
    marketId: marketId || 'market-001',
    resolutionEpoch: 1,
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcPredictionMarketHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkMarketResolutionValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitMarket() {
  const ctx = setupHubAndValidator();
  const market = ctx.hub.initializeMarket(baseInitRequest());
  return { ...ctx, market };
}

function setupInitAndVotes(voteCount = 3) {
  const ctx = setupAndInitMarket();
  for (let i = 0; i < voteCount; i++) {
    const voteReq = baseVoteRequest(ctx.market.marketId);
    voteReq.peerId = `peer-${i}`;
    ctx.validator.recordResolutionVote(voteReq);
  }
  return { ...ctx };
}

describe('Track 64 PQ prediction markets', () => {
  test('PqcPredictionMarketHub initializes a market and emits PREDICTION_MARKET_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const market = hub.initializeMarket(baseInitRequest());
    expect(market.status).toBe('open');
    expect(market.marketId).toBeDefined();
    expect(events.some((e) => e.event === 'PREDICTION_MARKET_INITIALIZED')).toBe(true);
  });

  test('ZkMarketResolutionValidator records a vote and emits ZK_RESOLUTION_VOTE_RECORDED', () => {
    const { events, validator, market } = setupAndInitMarket();
    const voteReq = baseVoteRequest(market.marketId);
    voteReq.peerId = 'peer-1';
    const vote = validator.recordResolutionVote(voteReq);
    expect(vote.voteId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_RESOLUTION_VOTE_RECORDED')).toBe(true);
  });

  test('PqcPredictionMarketHub finalizes a market after quorum and emits PREDICTION_MARKET_FINALIZED', () => {
    const { events, hub, market } = setupInitAndVotes(3);
    const finalization = hub.finalizeMarket(baseFinalizeRequest(market.marketId));
    expect(finalization.finalId).toBeDefined();
    expect(events.some((e) => e.event === 'PREDICTION_MARKET_FINALIZED')).toBe(true);
  });

  test('PqcPredictionMarketHub rejects asset weight exceeding maximum', () => {
    const hub = new PqcPredictionMarketHub({ policy: POLICY });
    const request = baseInitRequest();
    request.assetWeight = 2000000;
    expect(() => hub.initializeMarket(request)).toThrow(HsmAdapterError);
  });

  test('PqcPredictionMarketHub rejects contract lifetime exceeding maximum', () => {
    const hub = new PqcPredictionMarketHub({ policy: POLICY });
    const request = baseInitRequest();
    request.expirationTimestamp = Math.floor(Date.now() / 1000) + 31536000;
    expect(() => hub.initializeMarket(request)).toThrow(HsmAdapterError);
  });

  test('PqcPredictionMarketHub rejects un-attested market initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcPredictionMarketHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.marketInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializeMarket(request)).toThrow(HsmAdapterError);
  });

  test('ZkMarketResolutionValidator rejects un-attested reporter relay', () => {
    const { hub, market } = setupAndInitMarket();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkMarketResolutionValidator({ policy: POLICY, hub, attestationClient });
    const voteReq = baseVoteRequest(market.marketId);
    voteReq.reporterRelayAttestation = { authority: 'bad' };
    expect(() => validator.recordResolutionVote(voteReq)).toThrow(HsmAdapterError);
  });

  test('PqcPredictionMarketHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcPredictionMarketHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializeMarket(request)).toThrow(HsmAdapterError);
  });

  test('PqcPredictionMarketHub rejects duplicate market initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.marketId = 'market-dup';
    hub.initializeMarket(request);
    expect(() => hub.initializeMarket(request)).toThrow(HsmAdapterError);
  });

  test('PqcPredictionMarketHub rejects finalization before quorum', () => {
    const { hub, market } = setupAndInitMarket();
    expect(() => hub.finalizeMarket(baseFinalizeRequest(market.marketId))).toThrow(HsmAdapterError);
  });

  test('PqcPredictionMarketHub rejects dispute resolution epochs exceeding maximum', () => {
    const { hub, market } = setupInitAndVotes(3);
    const finReq = baseFinalizeRequest(market.marketId);
    finReq.resolutionEpoch = 10;
    expect(() => hub.finalizeMarket(finReq)).toThrow(HsmAdapterError);
  });

  test('ZkMarketResolutionValidator bans peers broadcasting malformed votes', () => {
    const { validator, market } = setupAndInitMarket();
    const voteReq = baseVoteRequest(market.marketId);
    voteReq.zkTruthProofHash = null;
    voteReq.peerId = 'peer-bad';
    expect(() => validator.recordResolutionVote(voteReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkMarketResolutionValidator bans peers broadcasting duplicate votes', () => {
    const { validator, market } = setupAndInitMarket();
    const voteReq = baseVoteRequest(market.marketId);
    voteReq.peerId = 'peer-bad';
    validator.recordResolutionVote(voteReq);
    expect(() => validator.recordResolutionVote(voteReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkMarketResolutionValidator bans peers voting on non-existent markets', () => {
    const { validator } = setupAndInitMarket();
    const voteReq = baseVoteRequest('nonexistent-market');
    voteReq.peerId = 'peer-bad';
    expect(() => validator.recordResolutionVote(voteReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq prediction markets configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqPredictionMarkets', {
      reporterQuorum: 3,
      disputeResolutionEpochs: 2,
      contractLifetimeSeconds: 86400,
      assetWeightCap: 1000,
      pqcSignatureScheme: 'ML-DSA-65',
      marketInitializerAttestation: true,
      reporterRelayAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderResolutionClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqPredictionMarkets', { reporterQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { disputeResolutionEpochs: 10 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { contractLifetimeSeconds: 31536000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { assetWeightCap: 2000000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { marketInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { reporterRelayAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { banMalformedOrOutOfOrderResolutionClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPredictionMarkets', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
