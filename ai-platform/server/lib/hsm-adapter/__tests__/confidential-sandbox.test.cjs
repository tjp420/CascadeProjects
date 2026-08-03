'use strict';

const crypto = require('crypto');

const {
  ConfidentialSandboxEngine,
  Sandbox,
  SANDBOX_STATES,
  DEFAULT_ALLOWED_OPERATIONS,
} = require('../confidential-sandbox-engine.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('ConfidentialSandboxEngine — Track 28 Confidential Computing Sandboxing', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  // ── Helper: create a mock attestation ──
  function _mockAttestation(measurement = 'mock-measurement-1') {
    return {
      authority: 'mock-authority',
      measurement,
      timestamp: Date.now() / 1000,
      attestationAgeSeconds: 0,
      enclaveType: 'mock',
      signature: 'mock-sig-valid',
    };
  }

  // ── Helper: create attestation client ──
  function _attestationClient() {
    return new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['mock-measurement-1', 'mock-measurement-2'],
      maxAttestationAgeSeconds: 60,
    });
  }

  // ── L2.01: Full happy-path ──
  describe('L2.01: happy-path sandbox lifecycle', () => {
    test('create → attest → execute → zeroize → destroy', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      expect(sandbox.state).toBe(SANDBOX_STATES.CREATED);
      expect(sandbox.id).toMatch(/^sbx-/);

      const attResult = engine.attest(sandbox.id, _mockAttestation());
      expect(attResult.verified).toBe(true);
      expect(sandbox.state).toBe(SANDBOX_STATES.ATTESTED);

      const result = engine.execute(sandbox.id, 'hash', { data: Buffer.from('test') });
      expect(result.operation).toBe('hash');
      expect(Buffer.isBuffer(result.digest)).toBe(true);
      expect(sandbox.state).toBe(SANDBOX_STATES.COMPLETED);

      engine.zeroize(sandbox.id);
      expect(sandbox.state).toBe(SANDBOX_STATES.ZEROIZED);

      engine.destroy(sandbox.id);
      expect(() => engine.getSandboxState(sandbox.id)).toThrow(HsmAdapterError);
    });
  });

  // ── L2.02/L2.03: Attestation gating ──
  describe('L2.02/L2.03: attestation gating', () => {
    test('valid attestation passes', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      const result = engine.attest(sandbox.id, _mockAttestation());
      expect(result.verified).toBe(true);
    });

    test('invalid attestation rejected', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      expect(() => engine.attest(sandbox.id, _mockAttestation('unknown-measurement')))
        .toThrow(HsmAdapterError);
    });
  });

  // ── L2.04: Execute operations ──
  describe('L2.04: execute operations inside sandbox', () => {
    test('hash operation returns correct digest', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      engine.attest(sandbox.id, _mockAttestation());
      const result = engine.execute(sandbox.id, 'hash', { data: Buffer.from('hello') });
      expect(result.digestHex).toBe(crypto.createHash('sha256').update('hello').digest('hex'));
    });

    test('sign and verify round-trip', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      engine.attest(sandbox.id, _mockAttestation());
      const signingKey = crypto.randomBytes(32);
      sandbox.setMemory('signingKey', signingKey);
      const data = Buffer.from('sign me');
      const signResult = engine.execute(sandbox.id, 'sign', { data });
      const verifyResult = engine.execute(sandbox.id, 'verify', { data, signature: signResult.signature });
      expect(verifyResult.valid).toBe(true);
    });

    test('encrypt and decrypt round-trip', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      engine.attest(sandbox.id, _mockAttestation());
      const encryptionKey = crypto.randomBytes(32);
      sandbox.setMemory('encryptionKey', encryptionKey);
      const plaintext = Buffer.from('secret data');
      const encResult = engine.execute(sandbox.id, 'encrypt', { plaintext });
      const decResult = engine.execute(sandbox.id, 'decrypt', {
        ciphertext: encResult.ciphertext,
        iv: encResult.iv,
        tag: encResult.tag,
      });
      expect(decResult.plaintext.equals(plaintext)).toBe(true);
    });

    test('derive operation returns 32-byte key', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      engine.attest(sandbox.id, _mockAttestation());
      const result = engine.execute(sandbox.id, 'derive', { ikm: Buffer.from('seed') });
      expect(result.derivedKey.length).toBe(32);
    });
  });

  // ── L2.05: Memory zeroization ──
  describe('L2.05: memory zeroization', () => {
    test('sensitive data is zeroized after zeroize()', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      const sensitiveKey = crypto.randomBytes(32);
      sandbox.setMemory('signingKey', sensitiveKey);
      expect(sandbox.getMemory('signingKey')).toBeDefined();

      engine.zeroize(sandbox.id);
      expect(sandbox.getMemory('signingKey')).toBeUndefined();
      expect(sensitiveKey.every((b) => b === 0)).toBe(true);
    });
  });

  // ── L2.06: Cannot execute before attestation ──
  describe('L2.06: cannot execute before attestation', () => {
    test('execute throws SANDBOX_INVALID_STATE before attestation', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      expect(() => engine.execute(sandbox.id, 'hash', {})).toThrow(HsmAdapterError);
      try {
        engine.execute(sandbox.id, 'hash', {});
      } catch (e) {
        expect(e.code).toBe('SANDBOX_INVALID_STATE');
      }
    });
  });

  // ── L2.07: Cannot execute after destruction ──
  describe('L2.07: cannot execute after destruction', () => {
    test('execute throws SANDBOX_NOT_FOUND after destroy', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      engine.attest(sandbox.id, _mockAttestation());
      engine.destroy(sandbox.id);
      expect(() => engine.execute(sandbox.id, 'hash', {})).toThrow(HsmAdapterError);
    });
  });

  // ── L2.08/L2.09: Policy validation ──
  describe('L2.08/L2.09: policy validation', () => {
    test('maxExecutionTimeSeconds enforced', () => {
      const engine = new ConfidentialSandboxEngine({
        policy: { maxExecutionTimeSeconds: 10 },
      });
      expect(() => engine.create('tenant-a', { maxExecutionTimeSeconds: 60 }))
        .toThrow(HsmAdapterError);
    });

    test('allowedOperations enforced', () => {
      const engine = new ConfidentialSandboxEngine({
        policy: { allowedOperations: ['hash', 'derive'] },
      });
      expect(() => engine.create('tenant-a', { allowedOperations: new Set(['hash', 'sign']) }))
        .toThrow(HsmAdapterError);
    });

    test('policy allows operations within limits', () => {
      const engine = new ConfidentialSandboxEngine({
        policy: { maxExecutionTimeSeconds: 60, allowedOperations: ['hash', 'sign'] },
      });
      const sandbox = engine.create('tenant-a', {
        allowedOperations: new Set(['hash']),
        maxExecutionTimeSeconds: 30,
      });
      expect(sandbox.id).toMatch(/^sbx-/);
    });

    test('CryptoPolicyEngine includes confidentialSandbox block', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.confidentialSandbox).toBeDefined();
      expect(policy.confidentialSandbox.maxExecutionTimeSeconds).toBe(30);
      expect(policy.confidentialSandbox.allowedOperations).toContain('sign');
      expect(policy.confidentialSandbox.requireAttestation).toBe(true);
    });

    test('tenant policy can override confidentialSandbox settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { confidentialSandbox: { maxExecutionTimeSeconds: 60 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.confidentialSandbox.maxExecutionTimeSeconds).toBe(60);
    });
  });

  // ── L3.01: Unattested sandbox cannot execute ──
  describe('L3.01: unattested sandbox cannot execute', () => {
    test('execute without attestation throws SANDBOX_INVALID_STATE', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      // Skip attestation
      expect(() => engine.execute(sandbox.id, 'hash', {})).toThrow(HsmAdapterError);
    });
  });

  // ── L3.02: Expired attestation rejected ──
  describe('L3.02: expired attestation rejected', () => {
    test('expired attestation throws ATTESTATION_EXPIRED', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      const sandbox = engine.create('tenant-a');
      const expiredAttestation = _mockAttestation();
      expiredAttestation.timestamp = Date.now() / 1000 - 120; // 2 minutes ago
      expiredAttestation.attestationAgeSeconds = 120;
      expect(() => engine.attest(sandbox.id, expiredAttestation)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.03: Disallowed operation rejected ──
  describe('L3.03: disallowed operation rejected', () => {
    test('operation not in allowedOperations throws SANDBOX_OPERATION_DENIED', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a', { allowedOperations: new Set(['hash']) });
      engine.attest(sandbox.id, _mockAttestation());
      expect(() => engine.execute(sandbox.id, 'sign', {})).toThrow(HsmAdapterError);
      try {
        engine.execute(sandbox.id, 'sign', {});
      } catch (e) {
        expect(e.code).toBe('SANDBOX_OPERATION_DENIED');
      }
    });
  });

  // ── L3.04: Memory zeroization verified ──
  describe('L3.04: memory zeroization verified', () => {
    test('all memory entries cleared and zeroized', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(16);
      sandbox.setMemory('key1', key1);
      sandbox.setMemory('key2', key2);
      expect(sandbox.getState().memoryEntries).toBe(2);

      engine.zeroize(sandbox.id);
      expect(sandbox.getState().memoryEntries).toBe(0);
      expect(key1.every((b) => b === 0)).toBe(true);
      expect(key2.every((b) => b === 0)).toBe(true);
    });

    test('destroy auto-zeroizes if not already zeroized', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      const sensitive = crypto.randomBytes(32);
      sandbox.setMemory('key', sensitive);
      engine.destroy(sandbox.id);
      expect(sensitive.every((b) => b === 0)).toBe(true);
    });
  });

  // ── Metrics ──
  describe('metrics counters', () => {
    test('hsm-metrics includes sandbox counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_sandbox_created_total', 0);
      expect(metrics).toHaveProperty('hsm_sandbox_destroyed_total', 0);
      expect(metrics).toHaveProperty('hsm_sandbox_attested_total', 0);
      expect(metrics).toHaveProperty('hsm_sandbox_execute_total', 0);
      expect(metrics).toHaveProperty('hsm_sandbox_zeroized_total', 0);
      expect(metrics).toHaveProperty('hsm_sandbox_active', 0);
    });

    test('incrementCounter works for sandbox counters', () => {
      hsmMetrics.incrementCounter('hsm_sandbox_created_total', 1);
      hsmMetrics.incrementCounter('hsm_sandbox_execute_total', 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_sandbox_created_total).toBe(1);
      expect(metrics.hsm_sandbox_execute_total).toBe(3);
    });

    test('Prometheus output includes sandbox metrics', () => {
      hsmMetrics.incrementCounter('hsm_sandbox_created_total', 2);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_sandbox_created_total');
      expect(output).toContain('# TYPE hsm_sandbox_created_total counter');
      expect(output).toContain('hsm_sandbox_created_total 2');
    });
  });

  // ── Engine state telemetry ──
  describe('getEngineState telemetry', () => {
    test('returns correct engine state', () => {
      const engine = new ConfidentialSandboxEngine({ attestationClient: _attestationClient() });
      expect(engine.getEngineState().activeSandboxes).toBe(0);
      expect(engine.getEngineState().hasAttestationClient).toBe(true);

      engine.create('tenant-a');
      expect(engine.getEngineState().activeSandboxes).toBe(1);
    });
  });

  // ── Sandbox not found ──
  describe('sandbox not found', () => {
    test('attest throws SANDBOX_NOT_FOUND for unknown ID', () => {
      const engine = new ConfidentialSandboxEngine();
      expect(() => engine.attest('unknown', _mockAttestation())).toThrow(HsmAdapterError);
    });

    test('execute throws SANDBOX_NOT_FOUND for unknown ID', () => {
      const engine = new ConfidentialSandboxEngine();
      expect(() => engine.execute('unknown', 'hash', {})).toThrow(HsmAdapterError);
    });

    test('zeroize throws SANDBOX_NOT_FOUND for unknown ID', () => {
      const engine = new ConfidentialSandboxEngine();
      expect(() => engine.zeroize('unknown')).toThrow(HsmAdapterError);
    });
  });

  // ── No attestation client (mock mode) ──
  describe('no attestation client (mock mode)', () => {
    test('accepts mock attestation without client', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      const result = engine.attest(sandbox.id, _mockAttestation());
      expect(result.verified).toBe(true);
    });

    test('rejects missing attestation document', () => {
      const engine = new ConfidentialSandboxEngine();
      const sandbox = engine.create('tenant-a');
      expect(() => engine.attest(sandbox.id, null)).toThrow(HsmAdapterError);
    });
  });

  // ── Sandbox class unit tests ──
  describe('Sandbox class', () => {
    test('isOperationAllowed checks allowedOperations', () => {
      const sandbox = new Sandbox('test', { allowedOperations: new Set(['hash']) });
      expect(sandbox.isOperationAllowed('hash')).toBe(true);
      expect(sandbox.isOperationAllowed('sign')).toBe(false);
    });

    test('getState returns correct state info', () => {
      const sandbox = new Sandbox('test', { tenantId: 'tenant-a' });
      const state = sandbox.getState();
      expect(state.id).toBe('test');
      expect(state.tenantId).toBe('tenant-a');
      expect(state.state).toBe(SANDBOX_STATES.CREATED);
      expect(state.memoryEntries).toBe(0);
      expect(state.hasAttestation).toBe(false);
    });
  });
});
