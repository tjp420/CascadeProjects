'use strict';

/**
 * Track 50: Confidential Federated Learning and ZK Model Aggregation tests.
 */
const {
  ConfidentialFederatedLearning,
  DEFAULT_OPTIONS,
  ROUND_PHASE,
  PROOF_STATUS,
} = require('../confidential-federated-learning.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 50: ConfidentialFederatedLearning', () => {
  let fl;

  beforeEach(() => {
    fl = new ConfidentialFederatedLearning({
      minParticipants: 2,
      maxParticipants: 10,
      requireZkProof: true,
      requireAttestation: false,
      minProofLength: 64,
      noiseScale: 0,
      roundTimeoutMs: 60000,
    });
  });

  describe('initiateRound', () => {
    test('initiates a round with valid participants', () => {
      const result = fl.initiateRound({
        participantIds: ['e1', 'e2', 'e3'],
        modelId: 'test-model',
      });
      expect(result.roundId).toBeDefined();
      expect(result.roundNumber).toBe(1);
      expect(result.phase).toBe(ROUND_PHASE.INITIATED);
      expect(result.participantIds.length).toBe(3);
    });

    test('rejects insufficient participants', () => {
      expect(() => fl.initiateRound({
        participantIds: ['e1'],
      })).toThrow(HsmAdapterError);
    });

    test('rejects too many participants', () => {
      const big = new ConfidentialFederatedLearning({ minParticipants: 1, maxParticipants: 2 });
      expect(() => big.initiateRound({
        participantIds: ['e1', 'e2', 'e3'],
      })).toThrow(HsmAdapterError);
    });

    test('rejects duplicate participants', () => {
      expect(() => fl.initiateRound({
        participantIds: ['e1', 'e1'],
      })).toThrow(HsmAdapterError);
    });

    test('rejects null config', () => {
      expect(() => fl.initiateRound(null)).toThrow(HsmAdapterError);
    });

    test('auto-increments round number', () => {
      const r1 = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      const r2 = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(r2.roundNumber).toBe(r1.roundNumber + 1);
    });
  });

  describe('submitGradient', () => {
    test('submits a valid gradient', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      const result = fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1, 0.2, 0.3],
        zkProof: 'a'.repeat(64),
        weight: 10,
      });
      expect(result.submitted).toBe(true);
      expect(result.totalSubmissions).toBe(1);
    });

    test('rejects unknown participant', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => fl.submitGradient(round.roundId, 'e3', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      })).toThrow(HsmAdapterError);
    });

    test('rejects duplicate submission', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      expect(() => fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.2],
        zkProof: 'b'.repeat(64),
      })).toThrow(HsmAdapterError);
    });

    test('rejects empty gradient', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [],
        zkProof: 'a'.repeat(64),
      })).toThrow(HsmAdapterError);
    });

    test('rejects missing ZK proof when required', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
      })).toThrow(HsmAdapterError);
    });

    test('rejects short ZK proof', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'short',
      })).toThrow(HsmAdapterError);
    });

    test('rejects gradient too large', () => {
      const small = new ConfidentialFederatedLearning({ maxGradientSize: 10 });
      const round = small.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => small.submitGradient(round.roundId, 'e1', {
        encryptedGradient: new Array(20).fill(0.1),
        zkProof: 'a'.repeat(64),
      })).toThrow(HsmAdapterError);
    });

    test('rejects unknown round', () => {
      expect(() => fl.submitGradient('unknown', 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      })).toThrow(HsmAdapterError);
    });

    test('rejects attestation requirement when enabled', () => {
      const strict = new ConfidentialFederatedLearning({ requireAttestation: true });
      const round = strict.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => strict.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      })).toThrow(HsmAdapterError);
    });

    test('accepts submission with attestation', () => {
      const strict = new ConfidentialFederatedLearning({ requireAttestation: true });
      const round = strict.initiateRound({ participantIds: ['e1', 'e2'] });
      const result = strict.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
        attestation: { verified: true },
      });
      expect(result.submitted).toBe(true);
    });
  });

  describe('verifyGradients', () => {
    test('verifies all valid gradients', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1, 0.2],
        zkProof: 'a'.repeat(64),
      });
      fl.submitGradient(round.roundId, 'e2', {
        encryptedGradient: [0.3, 0.4],
        zkProof: 'b'.repeat(64),
      });
      const result = fl.verifyGradients(round.roundId);
      expect(result.verifiedCount).toBe(2);
      expect(result.phase).toBe(ROUND_PHASE.AGGREGATING);
    });

    test('rejects verification before all submissions', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      expect(() => fl.verifyGradients(round.roundId)).toThrow(HsmAdapterError);
    });

    test('rejects verification in wrong phase', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      expect(() => fl.verifyGradients(round.roundId)).toThrow(HsmAdapterError);
    });

    test('fails on invalid proof', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      // Submit with non-hex proof (invalid)
      fl.submitGradient(round.roundId, 'e2', {
        encryptedGradient: [0.3],
        zkProof: 'z'.repeat(64), // 'z' is not a hex char
      });
      const result = fl.verifyGradients(round.roundId);
      expect(result.verifiedCount).toBe(1);
      expect(result.phase).toBe(ROUND_PHASE.FAILED);
    });
  });

  describe('aggregateGradients', () => {
    test('aggregates verified gradients into new model', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1, 0.2],
        zkProof: 'a'.repeat(64),
        weight: 2,
      });
      fl.submitGradient(round.roundId, 'e2', {
        encryptedGradient: [0.3, 0.4],
        zkProof: 'b'.repeat(64),
        weight: 2,
      });
      fl.verifyGradients(round.roundId);
      const result = fl.aggregateGradients(round.roundId);
      expect(result.phase).toBe(ROUND_PHASE.COMPLETED);
      expect(result.aggregatedWeights.length).toBe(2);
      expect(result.participantCount).toBe(2);
    });

    test('rejects aggregation before verification', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      fl.submitGradient(round.roundId, 'e2', {
        encryptedGradient: [0.3],
        zkProof: 'b'.repeat(64),
      });
      expect(() => fl.aggregateGradients(round.roundId)).toThrow(HsmAdapterError);
    });

    test('updates global model version', () => {
      const round = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(round.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      fl.submitGradient(round.roundId, 'e2', {
        encryptedGradient: [0.3],
        zkProof: 'b'.repeat(64),
      });
      fl.verifyGradients(round.roundId);
      const result = fl.aggregateGradients(round.roundId);
      const model = fl.getGlobalModel();
      expect(model.version).toBe(result.roundNumber);
      expect(model.weights).toEqual(result.aggregatedWeights);
    });
  });

  describe('full training round', () => {
    test('complete initiate -> submit -> verify -> aggregate flow', () => {
      const initResult = fl.initiateRound({
        participantIds: ['e1', 'e2', 'e3'],
        modelId: 'test-model',
      });
      // All participants submit
      for (const pid of ['e1', 'e2', 'e3']) {
        fl.submitGradient(initResult.roundId, pid, {
          encryptedGradient: [0.1, 0.2, 0.3],
          zkProof: pid.charCodeAt(0).toString(16).padStart(64, '0'),
          weight: 5,
        });
      }
      const verifyResult = fl.verifyGradients(initResult.roundId);
      expect(verifyResult.verifiedCount).toBe(3);
      const aggResult = fl.aggregateGradients(initResult.roundId);
      expect(aggResult.phase).toBe(ROUND_PHASE.COMPLETED);
      expect(aggResult.participantCount).toBe(3);
    });
  });

  describe('getRound', () => {
    test('returns active round state', () => {
      const init = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      const round = fl.getRound(init.roundId);
      expect(round).not.toBeNull();
      expect(round.roundId).toBe(init.roundId);
    });

    test('returns completed round from history', () => {
      const init = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(init.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      fl.submitGradient(init.roundId, 'e2', {
        encryptedGradient: [0.3],
        zkProof: 'b'.repeat(64),
      });
      fl.verifyGradients(init.roundId);
      fl.aggregateGradients(init.roundId);
      const round = fl.getRound(init.roundId);
      expect(round).not.toBeNull();
      expect(round.roundNumber).toBe(init.roundNumber);
    });

    test('returns null for unknown round', () => {
      expect(fl.getRound('unknown')).toBeNull();
    });
  });

  describe('getActiveRounds', () => {
    test('returns all active rounds', () => {
      fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.initiateRound({ participantIds: ['e3', 'e4'] });
      const active = fl.getActiveRounds();
      expect(active.length).toBe(2);
    });
  });

  describe('getCompletedRounds', () => {
    test('returns completed rounds history', () => {
      const init = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(init.roundId, 'e1', {
        encryptedGradient: [0.1],
        zkProof: 'a'.repeat(64),
      });
      fl.submitGradient(init.roundId, 'e2', {
        encryptedGradient: [0.3],
        zkProof: 'b'.repeat(64),
      });
      fl.verifyGradients(init.roundId);
      fl.aggregateGradients(init.roundId);
      const completed = fl.getCompletedRounds();
      expect(completed.length).toBe(1);
    });
  });

  describe('checkExpiredRounds', () => {
    test('expires rounds past timeout', () => {
      const fast = new ConfidentialFederatedLearning({ roundTimeoutMs: 50 });
      const init = fast.initiateRound({ participantIds: ['e1', 'e2'] });
      return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        const expired = fast.checkExpiredRounds();
        expect(expired.length).toBe(1);
        expect(expired[0]).toBe(init.roundId);
      });
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      fl.initiateRound({ participantIds: ['e1', 'e2'] });
      const stats = fl.getStats();
      expect(stats.activeRounds).toBe(1);
      expect(stats.completedRounds).toBe(0);
      expect(stats.aggregationAlgorithm).toBe('fedavg');
    });
  });

  describe('getGlobalModel', () => {
    test('returns initial model state', () => {
      const model = fl.getGlobalModel();
      expect(model.version).toBe(0);
      expect(model.weights).toBeNull();
    });

    test('returns updated model after aggregation', () => {
      const init = fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.submitGradient(init.roundId, 'e1', {
        encryptedGradient: [0.1, 0.2],
        zkProof: 'a'.repeat(64),
      });
      fl.submitGradient(init.roundId, 'e2', {
        encryptedGradient: [0.3, 0.4],
        zkProof: 'b'.repeat(64),
      });
      fl.verifyGradients(init.roundId);
      fl.aggregateGradients(init.roundId);
      const model = fl.getGlobalModel();
      expect(model.version).toBe(1);
      expect(model.weights.length).toBe(2);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      fl.initiateRound({ participantIds: ['e1', 'e2'] });
      fl.reset();
      expect(fl.getActiveRounds().length).toBe(0);
      expect(fl.getCompletedRounds().length).toBe(0);
      const model = fl.getGlobalModel();
      expect(model.version).toBe(0);
    });
  });

  describe('no ZK proof mode', () => {
    test('allows submission without ZK proof', () => {
      const noProof = new ConfidentialFederatedLearning({ requireZkProof: false, requireAttestation: false });
      const init = noProof.initiateRound({ participantIds: ['e1', 'e2'] });
      const result = noProof.submitGradient(init.roundId, 'e1', {
        encryptedGradient: [0.1],
      });
      expect(result.submitted).toBe(true);
      noProof.reset();
    });
  });
});
