'use strict';

/**
 * Track 45: Enclave Key Rotation and Cryptographic Heartbeats tests.
 */
const crypto = require('crypto');
const { EnclaveKeyRotationEngine, DEFAULT_OPTIONS, KEY_STATUS, HEARTBEAT_STATUS } = require('../enclave-key-rotation-heartbeat.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 45: EnclaveKeyRotationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new EnclaveKeyRotationEngine({
      rotationIntervalMs: 1000,
      heartbeatIntervalMs: 100,
      heartbeatTimeoutMs: 300,
      maxMissedHeartbeats: 3,
    });
  });

  afterEach(() => {
    engine.reset();
  });

  describe('registerEnclave', () => {
    test('registers an enclave with initial key', () => {
      engine.registerEnclave('e1');
      const state = engine.getKeyState('e1');
      expect(state).not.toBeNull();
      expect(state.enclaveId).toBe('e1');
      expect(state.epoch).toBe(0);
      expect(state.status).toBe(KEY_STATUS.ACTIVE);
    });

    test('rejects empty ID', () => {
      expect(() => engine.registerEnclave('')).toThrow(HsmAdapterError);
    });

    test('rejects duplicate', () => {
      engine.registerEnclave('e1');
      expect(() => engine.registerEnclave('e1')).toThrow(HsmAdapterError);
    });

    test('accepts custom initial key', () => {
      const customKey = Buffer.alloc(32, 0xAB);
      engine.registerEnclave('e1', { initialKey: customKey });
      const state = engine.getKeyState('e1');
      expect(state).not.toBeNull();
    });
  });

  describe('unregisterEnclave', () => {
    test('removes enclave and cleans up', () => {
      engine.registerEnclave('e1');
      engine.unregisterEnclave('e1');
      expect(engine.getKeyState('e1')).toBeNull();
      expect(engine.getHeartbeatState('e1')).toBeNull();
    });

    test('rejects unknown enclave', () => {
      expect(() => engine.unregisterEnclave('unknown')).toThrow(HsmAdapterError);
    });

    test('cleans up pending challenges', () => {
      engine.registerEnclave('e1');
      engine.issueHeartbeat('e1');
      engine.unregisterEnclave('e1');
      expect(engine.getPendingChallenges().length).toBe(0);
    });
  });

  describe('heartbeat challenge-response', () => {
    test('issueHeartbeat creates a challenge', () => {
      engine.registerEnclave('e1');
      const challenge = engine.issueHeartbeat('e1');
      expect(challenge.challengeId).toBeDefined();
      expect(challenge.nonce).toBeDefined();
      expect(challenge.epoch).toBe(0);
    });

    test('issueHeartbeat rejects unknown enclave', () => {
      expect(() => engine.issueHeartbeat('unknown')).toThrow(HsmAdapterError);
    });

    test('issueHeartbeat rejects quarantined enclave', () => {
      engine.registerEnclave('e1');
      const state = engine._enclaveKeys.get('e1');
      state.status = KEY_STATUS.QUARANTINED;
      expect(() => engine.issueHeartbeat('e1')).toThrow(HsmAdapterError);
    });

    test('processHeartbeatResponse verifies valid response', () => {
      engine.registerEnclave('e1');
      const challenge = engine.issueHeartbeat('e1');
      const keyState = engine._enclaveKeys.get('e1');
      const expectedResponse = crypto.createHmac('sha256', keyState.keyMaterial)
        .update(challenge.nonce).digest('hex');
      const result = engine.processHeartbeatResponse(challenge.challengeId, 'e1', expectedResponse);
      expect(result.verified).toBe(true);
      expect(result.enclaveId).toBe('e1');
    });

    test('processHeartbeatResponse rejects invalid response', () => {
      engine.registerEnclave('e1');
      const challenge = engine.issueHeartbeat('e1');
      expect(() => engine.processHeartbeatResponse(challenge.challengeId, 'e1', 'invalid-response'))
        .toThrow(HsmAdapterError);
    });

    test('processHeartbeatResponse rejects unknown challenge', () => {
      engine.registerEnclave('e1');
      expect(() => engine.processHeartbeatResponse('fake-id', 'e1', 'response'))
        .toThrow(HsmAdapterError);
    });

    test('processHeartbeatResponse rejects mismatched enclave', () => {
      engine.registerEnclave('e1');
      engine.registerEnclave('e2');
      const challenge = engine.issueHeartbeat('e1');
      expect(() => engine.processHeartbeatResponse(challenge.challengeId, 'e2', 'response'))
        .toThrow(HsmAdapterError);
    });

    test('successful heartbeat resets missed count', () => {
      engine.registerEnclave('e1');
      // Manually increment missed count
      const hbState = engine._heartbeatState.get('e1');
      hbState.missedCount = 2;
      hbState.status = HEARTBEAT_STATUS.DEGRADED;
      // Issue and respond to heartbeat
      const challenge = engine.issueHeartbeat('e1');
      const keyState = engine._enclaveKeys.get('e1');
      const response = crypto.createHmac('sha256', keyState.keyMaterial)
        .update(challenge.nonce).digest('hex');
      engine.processHeartbeatResponse(challenge.challengeId, 'e1', response);
      const after = engine.getHeartbeatState('e1');
      expect(after.missedCount).toBe(0);
      expect(after.status).toBe(HEARTBEAT_STATUS.HEALTHY);
    });
  });

  describe('heartbeat timeout and quarantine', () => {
    test('expired challenge increments missed count', () => {
      engine.registerEnclave('e1');
      engine.issueHeartbeat('e1');
      return new Promise(resolve => setTimeout(resolve, 350)).then(() => {
        engine.checkExpiredChallenges();
        const hb = engine.getHeartbeatState('e1');
        expect(hb.missedCount).toBeGreaterThanOrEqual(1);
      });
    });

    test('quarantines after max missed heartbeats', () => {
      engine.registerEnclave('e1');
      const hbState = engine._heartbeatState.get('e1');
      // Simulate 3 missed heartbeats
      for (let i = 0; i < 3; i++) {
        engine._incrementMissed('e1');
      }
      const keyState = engine.getKeyState('e1');
      expect(keyState.status).toBe(KEY_STATUS.QUARANTINED);
      const hb = engine.getHeartbeatState('e1');
      expect(hb.status).toBe(HEARTBEAT_STATUS.UNRESPONSIVE);
    });

    test('degraded status after first miss', () => {
      engine.registerEnclave('e1');
      engine._incrementMissed('e1');
      const hb = engine.getHeartbeatState('e1');
      expect(hb.status).toBe(HEARTBEAT_STATUS.DEGRADED);
      expect(hb.missedCount).toBe(1);
    });
  });

  describe('rotateKey', () => {
    test('rotates key and advances epoch', () => {
      engine.registerEnclave('e1');
      const result = engine.rotateKey('e1');
      expect(result.oldEpoch).toBe(0);
      expect(result.newEpoch).toBe(1);
      expect(result.oldKeyId).not.toBe(result.newKeyId);
      const state = engine.getKeyState('e1');
      expect(state.epoch).toBe(1);
    });

    test('rejects unknown enclave', () => {
      expect(() => engine.rotateKey('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects quarantined key', () => {
      engine.registerEnclave('e1');
      const state = engine._enclaveKeys.get('e1');
      state.status = KEY_STATUS.QUARANTINED;
      expect(() => engine.rotateKey('e1')).toThrow(HsmAdapterError);
    });

    test('records rotation history', () => {
      engine.registerEnclave('e1');
      engine.rotateKey('e1');
      engine.rotateKey('e1');
      const history = engine.getRotationHistory('e1');
      expect(history.length).toBe(3); // initial + 2 rotations
      expect(history[0].epoch).toBe(0);
      expect(history[2].epoch).toBe(2);
    });

    test('zeroizes old key material', () => {
      engine.registerEnclave('e1', { initialKey: Buffer.alloc(32, 0xFF) });
      const oldKey = engine._enclaveKeys.get('e1').keyMaterial;
      engine.rotateKey('e1');
      // Old key should be zeroized
      const allZero = oldKey.every(b => b === 0);
      expect(allZero).toBe(true);
    });
  });

  describe('checkAndRotate', () => {
    test('rotates keys older than rotation interval', () => {
      engine.registerEnclave('e1');
      return new Promise(resolve => setTimeout(resolve, 1100)).then(() => {
        const rotations = engine.checkAndRotate();
        expect(rotations.length).toBe(1);
        expect(rotations[0].enclaveId).toBe('e1');
      });
    });

    test('does not rotate fresh keys', () => {
      engine.registerEnclave('e1');
      const rotations = engine.checkAndRotate();
      expect(rotations.length).toBe(0);
    });

    test('skips quarantined enclaves', () => {
      engine.registerEnclave('e1');
      const state = engine._enclaveKeys.get('e1');
      state.status = KEY_STATUS.QUARANTINED;
      state.rotatedAt = 0; // very old
      const rotations = engine.checkAndRotate();
      expect(rotations.length).toBe(0);
    });
  });

  describe('revokeKey', () => {
    test('revokes a quarantined key', () => {
      engine.registerEnclave('e1');
      engine._incrementMissed('e1');
      engine._incrementMissed('e1');
      engine._incrementMissed('e1');
      const result = engine.revokeKey('e1');
      expect(result.revoked).toBe(true);
      const state = engine.getKeyState('e1');
      expect(state.status).toBe(KEY_STATUS.REVOKED);
    });

    test('rejects revoking non-quarantined key', () => {
      engine.registerEnclave('e1');
      expect(() => engine.revokeKey('e1')).toThrow(HsmAdapterError);
    });

    test('rejects unknown enclave', () => {
      expect(() => engine.revokeKey('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('recoverEnclave', () => {
    test('recovers a quarantined enclave via key rotation', () => {
      engine.registerEnclave('e1');
      engine._incrementMissed('e1');
      engine._incrementMissed('e1');
      engine._incrementMissed('e1');
      expect(engine.getKeyState('e1').status).toBe(KEY_STATUS.QUARANTINED);
      const result = engine.recoverEnclave('e1');
      expect(result.recovered).toBe(true);
      const state = engine.getKeyState('e1');
      expect(state.status).toBe(KEY_STATUS.ACTIVE);
      const hb = engine.getHeartbeatState('e1');
      expect(hb.missedCount).toBe(0);
      expect(hb.status).toBe(HEARTBEAT_STATUS.HEALTHY);
    });

    test('rejects recovery of non-quarantined enclave', () => {
      engine.registerEnclave('e1');
      expect(() => engine.recoverEnclave('e1')).toThrow(HsmAdapterError);
    });
  });

  describe('getKeyState and getHeartbeatState', () => {
    test('getKeyState returns key info', () => {
      engine.registerEnclave('e1');
      const state = engine.getKeyState('e1');
      expect(state.enclaveId).toBe('e1');
      expect(state.epoch).toBe(0);
      expect(state.keyId).toBeDefined();
      expect(state.keyAgeMs).toBeGreaterThanOrEqual(0);
    });

    test('getKeyState returns null for unknown', () => {
      expect(engine.getKeyState('unknown')).toBeNull();
    });

    test('getHeartbeatState returns heartbeat info', () => {
      engine.registerEnclave('e1');
      const hb = engine.getHeartbeatState('e1');
      expect(hb.status).toBe(HEARTBEAT_STATUS.HEALTHY);
      expect(hb.missedCount).toBe(0);
    });

    test('getHeartbeatState returns null for unknown', () => {
      expect(engine.getHeartbeatState('unknown')).toBeNull();
    });
  });

  describe('getEnclaves', () => {
    test('returns all registered enclaves', () => {
      engine.registerEnclave('e1');
      engine.registerEnclave('e2');
      const enclaves = engine.getEnclaves();
      expect(enclaves.length).toBe(2);
    });
  });

  describe('getPendingChallenges', () => {
    test('returns pending challenges', () => {
      engine.registerEnclave('e1');
      engine.issueHeartbeat('e1');
      const pending = engine.getPendingChallenges();
      expect(pending.length).toBe(1);
      expect(pending[0].enclaveId).toBe('e1');
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      engine.registerEnclave('e1');
      engine.registerEnclave('e2');
      engine._incrementMissed('e1');
      engine._incrementMissed('e1');
      engine._incrementMissed('e1');
      const stats = engine.getStats();
      expect(stats.enclaveCount).toBe(2);
      expect(stats.activeKeys).toBe(1);
      expect(stats.quarantinedKeys).toBe(1);
      expect(stats.healthyEnclaves).toBe(1);
      expect(stats.unresponsiveEnclaves).toBe(1);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      engine.registerEnclave('e1');
      engine.registerEnclave('e2');
      engine.reset();
      expect(engine.getEnclaves().length).toBe(0);
      expect(engine.getPendingChallenges().length).toBe(0);
    });
  });

  describe('maxEpochs', () => {
    test('rejects rotation beyond max epochs', () => {
      const small = new EnclaveKeyRotationEngine({ maxEpochs: 1 });
      small.registerEnclave('e1');
      small.rotateKey('e1'); // epoch 1
      expect(() => small.rotateKey('e1')).toThrow(HsmAdapterError);
      small.reset();
    });
  });
});
