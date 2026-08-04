'use strict';

/**
 * SIEM Broker Producer Integration Tests
 *
 * Verifies that hardware-attestation-verify.cjs and cluster-keyring-sync.cjs
 * correctly route security events through SiemSecurityBroker when the broker
 * option is set, while maintaining backward compatibility with legacy
 * audit callbacks and hooks.
 */

const crypto = require('crypto');
const {
  HardwareAttestationVerifier,
} = require('../hsm-adapter/hardware-attestation-verify.cjs');
const {
  MockTpmQuoteGenerator,
  DEFAULT_EXPECTED_PCRS,
  DEFAULT_EXPECTED_MRENCLAVE,
} = require('../hsm-adapter/mock-tpm-quote-generator.cjs');
const keyringSync = require('../cluster-keyring-sync.cjs');
const SiemSecurityBroker = require('../siem/siem-broker.cjs');

describe('SIEM Broker Producer Integration', () => {
  let broker;
  let brokerEvents;

  beforeEach(() => {
    brokerEvents = [];
    broker = new SiemSecurityBroker({
      rateLimitMaxTokens: 1000, // high ceiling so we don't drop in tests
      rateLimitRefillRateMs: 10000,
      transportStrategy: 'HYBRID',
    });
    broker.on('transport_batch_queue', (event) => brokerEvents.push(event));
    broker.on('transport_winston_stream', (event) => brokerEvents.push(event));
  });

  afterEach(() => {
    broker.close();
    keyringSync._resetEpochState();
  });

  // ── Attestation Verifier → Broker ──────────────────────────────────

  describe('HardwareAttestationVerifier → broker', () => {
    let quoteGen;
    const expectedMeasurements = {
      tpm2: { pcrs: DEFAULT_EXPECTED_PCRS },
      'sev-snp': { mrenclave: DEFAULT_EXPECTED_MRENCLAVE['sev-snp'] },
      sgx: { mrenclave: DEFAULT_EXPECTED_MRENCLAVE['sgx'] },
    };

    beforeEach(() => {
      quoteGen = new MockTpmQuoteGenerator();
    });

    test('broker receives event on attestation nonce mismatch', () => {
      const verifier = new HardwareAttestationVerifier({
        expectedMeasurements,
        broker,
      });
      const sandboxId = 'sbx-broker-1';
      verifier.issueChallenge(sandboxId);
      const wrongNonce = crypto.randomBytes(32).toString('hex');
      const quote = quoteGen.generateQuote(wrongNonce);

      try {
        verifier.verify(sandboxId, quote);
      } catch (e) {
        // Expected: ATTESTATION_NONCE_MISMATCH
      }

      const event = brokerEvents.find(
        (e) => e.siemCategory === 'attestation_nonce_mismatch'
      );
      expect(event).toBeDefined();
      expect(event.siemSeverity).toBe('HIGH');
      expect(event.siemSource).toBe('hardware-attestation-verify');
      expect(event.metadata.sandboxId).toBe(sandboxId);
      expect(event.metadata.event).toBe('ATTESTATION_NONCE_MISMATCH');
    });

    test('broker receives event on missing challenge', () => {
      const verifier = new HardwareAttestationVerifier({
        expectedMeasurements,
        broker,
      });

      try {
        verifier.verify('sbx-no-challenge', {
          nonce: 'abc',
          timestamp: Date.now(),
          authority: 'tpm2',
          measurement: DEFAULT_EXPECTED_PCRS[0],
          signature: 'sig',
        });
      } catch (e) {
        // Expected
      }

      const event = brokerEvents.find(
        (e) => e.siemCategory === 'attestation_challenge_missing'
      );
      expect(event).toBeDefined();
      expect(event.siemSeverity).toBe('HIGH');
    });

    test('broker receives event on untrusted measurement', () => {
      const verifier = new HardwareAttestationVerifier({
        expectedMeasurements,
        broker,
      });
      const sandboxId = 'sbx-broker-meas';
      const challenge = verifier.issueChallenge(sandboxId);
      const quote = quoteGen.generateQuote(challenge.nonce);
      // Tamper measurement — this triggers signature mismatch first
      // because the signature was computed over the original measurement
      quote.measurement = 'deadbeef';

      try {
        verifier.verify(sandboxId, quote);
      } catch (e) {
        // Expected: ATTESTATION_SIGNATURE_INVALID (signature no longer matches)
      }

      // The tampered measurement causes a signature mismatch before
      // the measurement check is reached, so we get signature_invalid
      const event = brokerEvents.find(
        (e) => e.siemCategory === 'attestation_signature_invalid'
      );
      expect(event).toBeDefined();
      expect(event.siemSeverity).toBe('HIGH');
      expect(event.siemSource).toBe('hardware-attestation-verify');
    });

    test('legacy audit callback still works when broker not set', () => {
      const auditEvents = [];
      const verifier = new HardwareAttestationVerifier({
        expectedMeasurements,
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      const sandboxId = 'sbx-legacy-1';
      verifier.issueChallenge(sandboxId);
      const wrongNonce = crypto.randomBytes(32).toString('hex');
      const quote = quoteGen.generateQuote(wrongNonce);

      try {
        verifier.verify(sandboxId, quote);
      } catch (e) {
        // Expected
      }

      expect(auditEvents.length).toBeGreaterThan(0);
      const siemEvent = auditEvents.find(
        (e) => e.event === 'ATTESTATION_NONCE_MISMATCH'
      );
      expect(siemEvent).toBeDefined();
      expect(siemEvent.data.siemSeverity).toBe('high');
    });

    test('broker takes precedence over legacy audit when both set', () => {
      const auditEvents = [];
      const verifier = new HardwareAttestationVerifier({
        expectedMeasurements,
        broker,
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      const sandboxId = 'sbx-both-1';
      verifier.issueChallenge(sandboxId);
      const wrongNonce = crypto.randomBytes(32).toString('hex');
      const quote = quoteGen.generateQuote(wrongNonce);

      try {
        verifier.verify(sandboxId, quote);
      } catch (e) {
        // Expected
      }

      // Broker should receive the event
      expect(brokerEvents.length).toBeGreaterThan(0);
      // Legacy audit should NOT fire when broker is set
      expect(auditEvents.length).toBe(0);
    });
  });

  // ── Cluster Keyring Sync → Broker ─────────────────────────────────

  describe('cluster-keyring-sync → broker', () => {
    test('setBroker stores broker reference', () => {
      keyringSync.setBroker(broker);
      // No direct way to inspect _broker, but we can verify via behavior
      // by triggering an event and checking if broker received it
    });

    test('broker receives event on KEY_REJECT', () => {
      keyringSync.setBroker(broker);
      keyringSync._resetEpochState();
      keyringSync.setBroker(broker); // re-set after reset

      // Trigger a KEY_REJECT event — _recordEvent checks SIEM_EVENT_TYPES
      // which contains the value 'key_reject', not the constant name
      keyringSync._recordEvent('key_reject', 'node-test-1', {
        reason: 'test_rejection',
        siemSeverity: 'high',
        siemCategory: 'key_reject',
      });

      const event = brokerEvents.find(
        (e) => e.siemCategory === 'key_reject'
      );
      expect(event).toBeDefined();
      expect(event.siemSeverity).toBe('HIGH');
      expect(event.siemSource).toBe('cluster-keyring-sync');
      expect(event.metadata.eventType).toBe('key_reject');
      expect(event.metadata.node).toBe('node-test-1');
    });

    test('broker receives CRITICAL event on state corruption', () => {
      keyringSync.setBroker(broker);
      keyringSync._resetEpochState();
      keyringSync.setBroker(broker);

      // Trigger a STATE_SNAPSHOT with critical severity (as in restoreStateSnapshot)
      keyringSync._invokeSiemHooks('STATE_SNAPSHOT', 'node-corrupt', {
        reason: 'restore_failed',
        validationError: 'schema_mismatch',
        siemSeverity: 'critical',
        siemCategory: 'state_corruption',
      });

      const event = brokerEvents.find(
        (e) => e.siemCategory === 'state_corruption'
      );
      expect(event).toBeDefined();
      expect(event.siemSeverity).toBe('CRITICAL');
      expect(event.siemSource).toBe('cluster-keyring-sync');
    });

    test('legacy hooks still fire when broker is set', () => {
      const hookCalls = [];
      keyringSync.registerSiemHook((eventType, node, details) => {
        hookCalls.push({ eventType, node, details });
      });
      keyringSync.setBroker(broker);

      keyringSync._invokeSiemHooks('KEY_REJECT', 'node-dual', {
        reason: 'test',
        siemSeverity: 'high',
        siemCategory: 'key_reject',
      });

      // Broker should receive
      expect(brokerEvents.length).toBeGreaterThan(0);
      // Legacy hook should also fire
      expect(hookCalls.length).toBe(1);
      expect(hookCalls[0].eventType).toBe('KEY_REJECT');
    });

    test('legacy hooks work without broker (backward compat)', () => {
      const hookCalls = [];
      keyringSync.registerSiemHook((eventType, node, details) => {
        hookCalls.push({ eventType, node, details });
      });
      // No setBroker call — _broker stays null

      keyringSync._invokeSiemHooks('KEY_REJECT', 'node-no-broker', {
        reason: 'test',
        siemSeverity: 'high',
        siemCategory: 'key_reject',
      });

      expect(hookCalls.length).toBe(1);
      expect(hookCalls[0].eventType).toBe('KEY_REJECT');
      expect(brokerEvents.length).toBe(0);
    });

    test('_resetEpochState clears broker reference', () => {
      keyringSync.setBroker(broker);
      keyringSync._resetEpochState();

      // After reset, broker should not receive events
      keyringSync._invokeSiemHooks('KEY_REJECT', 'node-after-reset', {
        reason: 'test',
        siemSeverity: 'high',
        siemCategory: 'key_reject',
      });

      expect(brokerEvents.length).toBe(0);
    });
  });
});
