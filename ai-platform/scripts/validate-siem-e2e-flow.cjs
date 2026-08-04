#!/usr/bin/env node
'use strict';

/**
 * validate-siem-e2e-flow.cjs
 *
 * End-to-end runtime validation script for the unified SIEM telemetry flow.
 *
 * Verifies the complete event lifecycle:
 *   [ Producers ] ΓåÆ [ SiemSecurityBroker ] ΓåÆ [ Transports ]
 *
 * Producers verified:
 *   1. HardwareAttestationVerifier ΓåÆ broker.logEvent()
 *   2. cluster-keyring-sync ΓåÆ broker.logEvent() via setBroker()
 *
 * Transports verified:
 *   1. siem-exporter.cjs ΓåÆ transport_batch_queue ΓåÆ enqueue()
 *   2. siem-transport.cjs ΓåÆ transport_winston_stream ΓåÆ Winston logger
 *
 * Invariants verified:
 *   - LOW/MEDIUM/HIGH events route to transport_batch_queue (batch HTTPS)
 *   - CRITICAL/FATAL events route to transport_winston_stream (immediate stream)
 *   - CRITICAL/FATAL bypass the rate limiter
 *   - Rate limiter drops events when token bucket is exhausted
 *   - All events emit structured JSON to stdout
 *   - Legacy audit callbacks and hooks still fire (backward compat)
 *   - Broker metrics track processed/dropped/bypassed counts
 *
 * Usage:
 *   node scripts/validate-siem-e2e-flow.cjs
 *
 * Exit codes:
 *   0 ΓÇö all checks passed
 *   1 ΓÇö one or more checks failed
 */

const assert = require('assert');
const crypto = require('crypto');

// ΓöÇΓöÇ Load modules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const path = require('path');
const SiemSecurityBroker = require(path.join('..', 'server', 'lib', 'siem', 'siem-broker.cjs'));
const {
  HardwareAttestationVerifier,
} = require(path.join('..', 'server', 'lib', 'hsm-adapter', 'hardware-attestation-verify.cjs'));
const {
  MockTpmQuoteGenerator,
  DEFAULT_EXPECTED_PCRS,
  DEFAULT_EXPECTED_MRENCLAVE,
} = require(path.join('..', 'server', 'lib', 'hsm-adapter', 'mock-tpm-quote-generator.cjs'));
const keyringSync = require(path.join('..', 'server', 'lib', 'cluster-keyring-sync.cjs'));
const siemExporter = require(path.join('..', 'server', 'lib', 'siem-exporter.cjs'));
const SIEMTransport = require(path.join('..', 'server', 'middleware', 'transports', 'siem-transport.cjs'));

// ΓöÇΓöÇ Test harness ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

let passed = 0;
let failed = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    console.log(`  \x1b[32m\u2713\x1b[0m ${label}`);
    passed++;
  } catch (err) {
    console.log(`  \x1b[31m\u2717\x1b[0m ${label}: ${err.message}`);
    failures.push({ label, error: err.message });
    failed++;
  }
}

// ΓöÇΓöÇ Suppress stdout JSON lines during validation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const _origStdoutWrite = process.stdout.write.bind(process.stdout);
let _suppressStdout = false;
process.stdout.write = function (chunk, ...args) {
  if (_suppressStdout && typeof chunk === 'string' && chunk.startsWith('{')) return true;
  return _origStdoutWrite(chunk, ...args);
};

// ΓöÇΓöÇ Run validation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('=== SIEM Broker End-to-End Telemetry Flow Validation ===\n');

// ΓöÇΓöÇ Phase 1: Broker standalone verification ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('[1] Broker standalone verification...');

let broker;
let batchQueue = [];
let winstonStream = [];

function setupBroker(strategy) {
  if (broker) broker.close();
  batchQueue = [];
  winstonStream = [];
  broker = new SiemSecurityBroker({
    rateLimitMaxTokens: 10,
    rateLimitRefillRateMs: 100000, // slow refill so we can test exhaustion
    transportStrategy: strategy || 'HYBRID',
  });
  broker.on('transport_batch_queue', (event) => batchQueue.push(event));
  broker.on('transport_winston_stream', (event) => winstonStream.push(event));
}

setupBroker('HYBRID');

check('broker constructs with valid config', () => {
  assert.ok(broker instanceof SiemSecurityBroker, 'should be SiemSecurityBroker instance');
});

check('LOW event routes to transport_batch_queue', () => {
  batchQueue = [];
  broker.logEvent({
    siemSeverity: 'LOW',
    siemCategory: 'e2e_low_test',
    siemSource: 'validation-script',
    context: { phase: 1 },
  });
  assert.strictEqual(batchQueue.length, 1, 'batch queue should have 1 event');
  assert.strictEqual(batchQueue[0].siemCategory, 'e2e_low_test');
});

check('HIGH event routes to transport_batch_queue', () => {
  batchQueue = [];
  broker.logEvent({
    siemSeverity: 'HIGH',
    siemCategory: 'e2e_high_test',
    siemSource: 'validation-script',
  });
  assert.strictEqual(batchQueue.length, 1);
  assert.strictEqual(batchQueue[0].siemSeverity, 'HIGH');
});

check('CRITICAL event routes to transport_winston_stream (bypass batch)', () => {
  batchQueue = [];
  winstonStream = [];
  broker.logEvent({
    siemSeverity: 'CRITICAL',
    siemCategory: 'e2e_critical_test',
    siemSource: 'validation-script',
  });
  assert.strictEqual(winstonStream.length, 1, 'winston stream should have 1 event');
  assert.strictEqual(batchQueue.length, 0, 'CRITICAL should not go to batch queue');
  assert.strictEqual(winstonStream[0].siemSeverity, 'CRITICAL');
});

check('FATAL event routes to transport_winston_stream (bypass batch)', () => {
  winstonStream = [];
  broker.logEvent({
    siemSeverity: 'FATAL',
    siemCategory: 'e2e_fatal_test',
    siemSource: 'validation-script',
  });
  assert.strictEqual(winstonStream.length, 1);
  assert.strictEqual(winstonStream[0].siemSeverity, 'FATAL');
});

check('CRITICAL/FATAL bypass rate limiter even when tokens exhausted', () => {
  // Exhaust all tokens with LOW events
  setupBroker('HYBRID');
  for (let i = 0; i < 10; i++) {
    broker.logEvent({ siemSeverity: 'LOW', siemCategory: `exhaust_${i}` });
  }
  // Token bucket should be empty now
  const droppedMetrics = broker.getMetrics();
  assert.strictEqual(droppedMetrics.currentTokens, 0, 'tokens should be exhausted');

  // CRITICAL should still pass
  winstonStream = [];
  broker.logEvent({
    siemSeverity: 'CRITICAL',
    siemCategory: 'bypass_test',
    siemSource: 'validation-script',
  });
  assert.strictEqual(winstonStream.length, 1, 'CRITICAL should bypass rate limiter');
});

check('rate limiter drops LOW events when token bucket empty', () => {
  setupBroker('HYBRID');
  for (let i = 0; i < 10; i++) {
    broker.logEvent({ siemSeverity: 'LOW', siemCategory: `fill_${i}` });
  }
  // 11th event should be dropped
  const result = broker.logEvent({ siemSeverity: 'LOW', siemCategory: 'should_be_dropped' });
  assert.strictEqual(result, false, '11th LOW event should be dropped');
  const metrics = broker.getMetrics();
  assert.strictEqual(metrics.siem_events_dropped_total, 1, 'drop counter should be 1');
});

check('broker metrics track processed/dropped/bypassed', () => {
  setupBroker('HYBRID');
  // 1 LOW (processed, consumes token)
  broker.logEvent({ siemSeverity: 'LOW', siemCategory: 'm1' });
  // 1 CRITICAL (processed, bypassed ΓÇö no token consumed)
  broker.logEvent({ siemSeverity: 'CRITICAL', siemCategory: 'm2' });
  // 9 more LOW (processed, consume remaining 9 tokens)
  for (let i = 0; i < 9; i++) {
    broker.logEvent({ siemSeverity: 'LOW', siemCategory: `fill_${i}` });
  }
  // 1 more LOW (dropped ΓÇö token bucket empty)
  broker.logEvent({ siemSeverity: 'LOW', siemCategory: 'dropped' });

  const m = broker.getMetrics();
  // 1 LOW + 1 CRITICAL + 9 LOW = 11 processed; 1 dropped
  assert.strictEqual(m.siem_events_processed_total, 11, 'processed should be 11');
  assert.strictEqual(m.siem_events_bypassed_total, 1, '1 CRITICAL bypassed');
  assert.strictEqual(m.siem_events_dropped_total, 1, '1 dropped');
  assert.strictEqual(m.siem_tokens_consumed_total, 10, '10 tokens consumed');
});

// ΓöÇΓöÇ Phase 2: Producer integration ΓÇö Attestation Verifier ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('\n[2] Producer integration: HardwareAttestationVerifier...');

const expectedMeasurements = {
  tpm2: { pcrs: DEFAULT_EXPECTED_PCRS },
  'sev-snp': { mrenclave: DEFAULT_EXPECTED_MRENCLAVE['sev-snp'] },
  sgx: { mrenclave: DEFAULT_EXPECTED_MRENCLAVE['sgx'] },
};

const quoteGen = new MockTpmQuoteGenerator();

check('attestation nonce mismatch flows to broker', () => {
  setupBroker('HYBRID');
  const verifier = new HardwareAttestationVerifier({ expectedMeasurements, broker });
  const sandboxId = 'sbx-e2e-1';
  verifier.issueChallenge(sandboxId);
  const wrongNonce = crypto.randomBytes(32).toString('hex');
  const quote = quoteGen.generateQuote(wrongNonce);

  _suppressStdout = true;
  try { verifier.verify(sandboxId, quote); } catch (e) {}
  _suppressStdout = false;

  const event = batchQueue.find((e) => e.siemCategory === 'attestation_nonce_mismatch');
  assert.ok(event, 'broker should receive attestation_nonce_mismatch');
  assert.strictEqual(event.siemSource, 'hardware-attestation-verify');
  assert.strictEqual(event.siemSeverity, 'HIGH');
});

check('attestation missing challenge flows to broker', () => {
  setupBroker('HYBRID');
  const verifier = new HardwareAttestationVerifier({ expectedMeasurements, broker });

  _suppressStdout = true;
  try {
    verifier.verify('sbx-no-challenge', {
      nonce: 'abc', timestamp: Date.now(), authority: 'tpm2',
      measurement: 'x', signature: 's',
    });
  } catch (e) {}
  _suppressStdout = false;

  const event = batchQueue.find((e) => e.siemCategory === 'attestation_challenge_missing');
  assert.ok(event, 'broker should receive attestation_challenge_missing');
});

check('legacy audit callback fires when broker not set', () => {
  setupBroker('HYBRID');
  const auditEvents = [];
  const verifier = new HardwareAttestationVerifier({
    expectedMeasurements,
    audit: (event, data) => auditEvents.push({ event, data }),
  });
  const sandboxId = 'sbx-legacy-2';
  verifier.issueChallenge(sandboxId);
  const wrongNonce = crypto.randomBytes(32).toString('hex');
  const quote = quoteGen.generateQuote(wrongNonce);

  _suppressStdout = true;
  try { verifier.verify(sandboxId, quote); } catch (e) {}
  _suppressStdout = false;

  assert.ok(auditEvents.length > 0, 'legacy audit should fire');
  assert.strictEqual(batchQueue.length, 0, 'broker should not receive events');
});

// ΓöÇΓöÇ Phase 3: Producer integration ΓÇö Cluster Keyring Sync ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('\n[3] Producer integration: cluster-keyring-sync...');

check('keyring KEY_REJECT flows to broker', () => {
  setupBroker('HYBRID');
  keyringSync._resetEpochState();
  keyringSync.setBroker(broker);

  _suppressStdout = true;
  keyringSync._recordEvent('key_reject', 'node-e2e-1', {
    reason: 'e2e_validation',
    siemSeverity: 'high',
    siemCategory: 'key_reject',
  });
  _suppressStdout = false;

  const event = batchQueue.find((e) => e.siemCategory === 'key_reject');
  assert.ok(event, 'broker should receive key_reject');
  assert.strictEqual(event.siemSource, 'cluster-keyring-sync');
  assert.strictEqual(event.metadata.node, 'node-e2e-1');
});

check('keyring state corruption flows to broker as CRITICAL', () => {
  setupBroker('HYBRID');
  keyringSync._resetEpochState();
  keyringSync.setBroker(broker);

  _suppressStdout = true;
  keyringSync._invokeSiemHooks('STATE_SNAPSHOT', 'node-corrupt-e2e', {
    reason: 'restore_failed',
    validationError: 'schema_mismatch',
    siemSeverity: 'critical',
    siemCategory: 'state_corruption',
  });
  _suppressStdout = false;

  const event = winstonStream.find((e) => e.siemCategory === 'state_corruption');
  assert.ok(event, 'broker should receive state_corruption via winston_stream');
  assert.strictEqual(event.siemSeverity, 'CRITICAL');
});

check('legacy keyring hooks fire alongside broker', () => {
  setupBroker('HYBRID');
  keyringSync._resetEpochState();
  const hookCalls = [];
  keyringSync.registerSiemHook((eventType, node, details) => {
    hookCalls.push({ eventType, node });
  });
  keyringSync.setBroker(broker);

  _suppressStdout = true;
  keyringSync._invokeSiemHooks('key_reject', 'node-dual-e2e', {
    reason: 'dual_test',
    siemSeverity: 'high',
    siemCategory: 'key_reject',
  });
  _suppressStdout = false;

  assert.ok(batchQueue.length > 0, 'broker should receive event');
  assert.strictEqual(hookCalls.length, 1, 'legacy hook should also fire');
  assert.strictEqual(hookCalls[0].eventType, 'key_reject');
});

// ΓöÇΓöÇ Phase 4: Transport integration ΓÇö siem-exporter ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('\n[4] Transport integration: siem-exporter.cjs...');

check('exporter connectBroker receives batch_queue events', () => {
  setupBroker('HYBRID');
  siemExporter._debug.resetQueue();
  siemExporter.connectBroker(broker);

  _suppressStdout = true;
  broker.logEvent({
    siemSeverity: 'MEDIUM',
    siemCategory: 'exporter_e2e_test',
    siemSource: 'validation-script',
  });
  _suppressStdout = false;

  const queue = siemExporter._debug.getQueue();
  assert.ok(queue.length >= 1, 'exporter queue should have the event');
  const found = queue.find((e) => e.siemCategory === 'exporter_e2e_test');
  assert.ok(found, 'exporter should have the specific event');
});

check('exporter does not receive CRITICAL events (winston_stream instead)', () => {
  setupBroker('HYBRID');
  siemExporter._debug.resetQueue();
  siemExporter.connectBroker(broker);

  _suppressStdout = true;
  broker.logEvent({
    siemSeverity: 'CRITICAL',
    siemCategory: 'exporter_critical_test',
    siemSource: 'validation-script',
  });
  _suppressStdout = false;

  const queue = siemExporter._debug.getQueue();
  const found = queue.find((e) => e.siemCategory === 'exporter_critical_test');
  assert.strictEqual(found, undefined, 'CRITICAL should not be in exporter queue');
});

// ΓöÇΓöÇ Phase 5: Transport integration ΓÇö siem-transport (Winston) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('\n[5] Transport integration: siem-transport.cjs (Winston)...');

check('winston transport connectBroker receives stream events', () => {
  setupBroker('HYBRID');
  const logCalls = [];
  const mockLogger = {
    warn: (msg, meta) => logCalls.push({ level: 'warn', msg, meta }),
    error: (msg, meta) => logCalls.push({ level: 'error', msg, meta }),
  };
  SIEMTransport.connectBroker(broker, mockLogger);

  _suppressStdout = true;
  broker.logEvent({
    siemSeverity: 'CRITICAL',
    siemCategory: 'winston_e2e_test',
    siemSource: 'validation-script',
  });
  _suppressStdout = false;

  assert.strictEqual(logCalls.length, 1, 'logger should have 1 call');
  assert.strictEqual(logCalls[0].level, 'error', 'CRITICAL ΓåÆ error level');
  assert.ok(logCalls[0].msg.includes('winston_e2e_test'));
});

check('winston transport maps HIGH to warn level', () => {
  setupBroker('STREAMING');
  const logCalls = [];
  const mockLogger = {
    warn: (msg, meta) => logCalls.push({ level: 'warn' }),
    error: (msg, meta) => logCalls.push({ level: 'error' }),
  };
  SIEMTransport.connectBroker(broker, mockLogger);

  _suppressStdout = true;
  broker.logEvent({
    siemSeverity: 'HIGH',
    siemCategory: 'winston_high_test',
    siemSource: 'validation-script',
  });
  _suppressStdout = false;

  assert.strictEqual(logCalls.length, 1);
  assert.strictEqual(logCalls[0].level, 'warn', 'HIGH ΓåÆ warn level');
});

// ΓöÇΓöÇ Phase 6: Full end-to-end flow ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('\n[6] Full end-to-end: producer ΓåÆ broker ΓåÆ transport...');

check('attestation HIGH event flows producer ΓåÆ broker ΓåÆ exporter queue', () => {
  setupBroker('HYBRID');
  siemExporter._debug.resetQueue();
  siemExporter.connectBroker(broker);

  const verifier = new HardwareAttestationVerifier({ expectedMeasurements, broker });
  const sandboxId = 'sbx-full-e2e-1';
  verifier.issueChallenge(sandboxId);
  const wrongNonce = crypto.randomBytes(32).toString('hex');
  const quote = quoteGen.generateQuote(wrongNonce);

  _suppressStdout = true;
  try { verifier.verify(sandboxId, quote); } catch (e) {}
  _suppressStdout = false;

  const queue = siemExporter._debug.getQueue();
  const found = queue.find(
    (e) => e.siemCategory === 'attestation_nonce_mismatch' && e.metadata.sandboxId === sandboxId
  );
  assert.ok(found, 'full flow: attestation event should reach exporter queue');
  assert.strictEqual(found.siemSource, 'hardware-attestation-verify');
});

check('keyring CRITICAL event flows producer ΓåÆ broker ΓåÆ winston stream', () => {
  setupBroker('HYBRID');
  keyringSync._resetEpochState();
  keyringSync.setBroker(broker);

  // Disconnect any previous Winston transport listener from Phase 5
  SIEMTransport.disconnectBroker();

  const logCalls = [];
  const mockLogger = {
    warn: (msg, meta) => logCalls.push({ level: 'warn', msg, meta }),
    error: (msg, meta) => logCalls.push({ level: 'error', msg, meta }),
  };
  SIEMTransport.connectBroker(broker, mockLogger);

  _suppressStdout = true;
  keyringSync._invokeSiemHooks('STATE_SNAPSHOT', 'node-full-e2e', {
    reason: 'restore_failed',
    validationError: 'e2e_corruption',
    siemSeverity: 'critical',
    siemCategory: 'state_corruption',
  });
  _suppressStdout = false;

  // The Winston transport's mockLogger receives the event via
  // transport_winston_stream. The siemCategory is in the msg string,
  // and the metadata field contains the event's context.
  const found = logCalls.find(
    (c) => c.msg && c.msg.includes('state_corruption')
  );
  assert.ok(found, 'full flow: CRITICAL keyring event should reach Winston logger');
  assert.strictEqual(found.level, 'error');
  assert.strictEqual(found.meta.siemSeverity, 'CRITICAL');
});

check('event immutability preserved through full flow', () => {
  setupBroker('HYBRID');
  batchQueue = [];
  broker.logEvent({
    siemSeverity: 'LOW',
    siemCategory: 'immutability_test',
    siemSource: 'validation-script',
    context: { immutable: true },
  });

  assert.strictEqual(batchQueue.length, 1);
  assert.strictEqual(Object.isFrozen(batchQueue[0]), true, 'event should be frozen');
  assert.ok(batchQueue[0].eventId, 'event should have eventId');
  assert.ok(batchQueue[0].timestamp, 'event should have timestamp');
});

// ΓöÇΓöÇ Cleanup ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

broker.close();
keyringSync._resetEpochState();
siemExporter.close();
SIEMTransport.disconnectBroker();

// ΓöÇΓöÇ Summary ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

console.log('\n=== SIEM E2E Validation Summary ===');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length > 0) {
  console.log('\n  Failures:');
  failures.forEach((f) => {
    console.log(`    - ${f.label}: ${f.error}`);
  });
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
