'use strict';

/**
 * Track 25: FIPS 140-3 and EU AI Act compliance gating tests.
 */

const { FipsSelfTestRunner, FipsCriticalFaultError } = require('../fips-self-test-runner.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { RobustnessTelemetryAgent } = require('../robustness-telemetry-agent.cjs');

describe('Track 25 Compliance Gating', () => {
  afterEach(() => {
    FipsSelfTestRunner.resetStatusForTesting();
  });

  describe('FipsSelfTestRunner', () => {
    test('executePowerOnSelfTests passes with NIST vectors', () => {
      expect(FipsSelfTestRunner.executePowerOnSelfTests()).toBe(true);
      expect(FipsSelfTestRunner.executePowerOnSelfTests()).toBe(true); // idempotent
      expect(FipsSelfTestRunner.isLocked()).toBe(false);
    });

    test('executePowerOnSelfTests locks on bad AES vector', () => {
      const original = FipsSelfTestRunner.VECTORS.AES_KW.ciphertext;
      FipsSelfTestRunner.VECTORS.AES_KW.ciphertext = Buffer.alloc(24, 0xff);

      try {
        expect(() => FipsSelfTestRunner.executePowerOnSelfTests()).toThrow(FipsCriticalFaultError);
        expect(FipsSelfTestRunner.isLocked()).toBe(true);
        expect(() => FipsSelfTestRunner.executePowerOnSelfTests()).toThrow(/locked/);
      } finally {
        FipsSelfTestRunner.VECTORS.AES_KW.ciphertext = original;
      }
    });
  });

  describe('CryptoPolicyEngine FIPS gating', () => {
    test('allows P-256 ecdh under FIPS default', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true } },
      });
      expect(() => engine.validate('acme', 'wrap', { algorithm: 'ecdh', keySize: 256 })).not.toThrow();
    });

    test('blocks P-521 ecdh when FIPS disables it', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true } },
      });
      expect(() => engine.validate('acme', 'wrap', { algorithm: 'ecdh', keySize: 521 })).toThrow(/P-521/);
    });

    test('allows non-FIPS curve when FIPS disabled', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: false } },
      });
      expect(() => engine.validate('acme', 'wrap', { algorithm: 'ecdh', keySize: 521 })).not.toThrow();
    });

    test('blocks blinding token grace when FIPS enabled', () => {
      const engine = new CryptoPolicyEngine({
        default: { fips: { enabled: true } },
      });
      expect(() => engine.validate('acme', 'homomorphic', { algorithm: 'homomorphic', allowBlinding: true })).toThrow(/blinding/);
      expect(() => engine.validate('acme', 'homomorphic', { algorithm: 'homomorphic', tokenExpiryMs: 300000 })).toThrow(/grace/);
    });
  });

  describe('RobustnessTelemetryAgent', () => {
    test('records tamper-evident events', () => {
      const agent = new RobustnessTelemetryAgent();
      const event = agent.record('time', 'TEMPORAL_DRIFT', { drift: 12345, tenantId: 'acme' });
      expect(event.category).toBe('time');
      expect(event.event).toBe('TEMPORAL_DRIFT');
      expect(typeof event.integrity).toBe('string');
      expect(event.integrity.length).toBe(64);
    });

    test('emits record events to subscribers', () => {
      const agent = new RobustnessTelemetryAgent();
      const captured = [];
      agent.subscribe((e) => captured.push(e));
      agent.record('zkp', 'VERIFICATION_FAILED', { proofId: 'abc123' });
      expect(captured.length).toBe(1);
      expect(captured[0].category).toBe('zkp');
    });

    test('produces attestation snapshot', () => {
      const agent = new RobustnessTelemetryAgent();
      agent.record('policy', 'HOT_RELOAD', { tenantId: 'acme' });
      agent.record('fips', 'POST_PASSED', {});
      const attestation = agent.getAttestation();
      expect(attestation.eventCount).toBe(2);
      expect(typeof attestation.latestIntegrity).toBe('string');
      expect(attestation.events.every((e) => typeof e.integrity === 'string')).toBe(true);
    });
  });
});
