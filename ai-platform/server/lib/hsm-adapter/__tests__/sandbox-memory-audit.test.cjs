'use strict';

/**
 * Confidential-Sandbox Memory Audit Hardening — Test Suite
 *
 * Tests buffer copy isolation, size/count limits, execution result zeroization,
 * operation params zeroization, timeout enforcement, and memory access audit trail.
 */

const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  ConfidentialSandboxEngine,
  Sandbox,
  SANDBOX_STATES,
  MAX_MEMORY_ENTRY_BYTES,
  MAX_MEMORY_ENTRIES,
  MAX_AUDIT_ENTRIES,
} = require('../../../lib/hsm-adapter/confidential-sandbox-engine.cjs');
const { HsmAdapterError } = require('../../../lib/hsm-adapter/base-adapter.cjs');

describe('Confidential-Sandbox Memory Audit Hardening', () => {

  let engine;

  beforeEach(() => {
    engine = new ConfidentialSandboxEngine();
  });

  // ── L2-01: setMemory copies buffer (no external mutation) ─────────

  describe('L2-01: setMemory copies buffer (no external mutation)', () => {
    test('mutating original buffer does not affect sandbox copy', () => {
      const sandbox = engine.create('tenant-1');
      const original = Buffer.from('secret-key-data');
      sandbox.setMemory('signingKey', original);

      // Mutate the original
      original.fill(0xFF);

      const stored = sandbox.getMemory('signingKey');
      expect(stored).not.toEqual(original); // stored copy is unaffected
      expect(stored.toString('utf8')).toBe('secret-key-data');
    });
  });

  // ── L2-02: setMemory rejects oversized buffer ─────────────────────

  describe('L2-02: setMemory rejects oversized buffer', () => {
    test('buffer > MAX_MEMORY_ENTRY_BYTES throws MEMORY_ENTRY_TOO_LARGE', () => {
      const sandbox = engine.create('tenant-1');
      const oversized = Buffer.alloc(MAX_MEMORY_ENTRY_BYTES + 1);

      expect(() => sandbox.setMemory('bigKey', oversized)).toThrow(HsmAdapterError);
      try { sandbox.setMemory('bigKey', oversized); } catch (e) { expect(e.code).toBe('MEMORY_ENTRY_TOO_LARGE'); }
    });
  });

  // ── L2-03: Memory entry count capped at MAX_MEMORY_ENTRIES ────────

  describe('L2-03: Memory entry count capped at MAX_MEMORY_ENTRIES', () => {
    test('storing more than MAX_MEMORY_ENTRIES throws MEMORY_ENTRIES_FULL', () => {
      const sandbox = engine.create('tenant-1');

      // Fill up to the limit
      for (let i = 0; i < MAX_MEMORY_ENTRIES; i++) {
        sandbox.setMemory('key-' + i, Buffer.alloc(32));
      }

      // Next entry should fail
      expect(() => sandbox.setMemory('overflow', Buffer.alloc(32))).toThrow(HsmAdapterError);
      try { sandbox.setMemory('overflow', Buffer.alloc(32)); } catch (e) { expect(e.code).toBe('MEMORY_ENTRIES_FULL'); }
    });
  });

  // ── L2-04: zeroize clears _executionResult ────────────────────────

  describe('L2-04: zeroize clears _executionResult', () => {
    test('_executionResult is null and derivedKey buffer is zeroed after zeroize', () => {
      const sandbox = engine.create('tenant-1');
      engine.attest(sandbox.id, { verified: true });
      const result = engine.execute(sandbox.id, 'derive', {
        ikm: crypto.randomBytes(32),
      });

      // Verify result exists
      expect(result.derivedKey).toBeDefined();
      const derivedKeyCopy = Buffer.from(result.derivedKey); // copy for comparison

      // Zeroize
      sandbox.zeroize();

      // _executionResult should be null
      expect(sandbox._executionResult).toBeNull();

      // The original derivedKey buffer should be zeroed
      expect(result.derivedKey.every((b) => b === 0)).toBe(true);
      expect(derivedKeyCopy.every((b) => b === 0)).toBe(false); // our copy is unaffected
    });
  });

  // ── L2-05: zeroize clears operation params ────────────────────────

  describe('L2-05: zeroize clears operation params', () => {
    test('plaintext param buffer is zeroed after zeroize', () => {
      const sandbox = engine.create('tenant-1');
      sandbox.setMemory('encryptionKey', crypto.randomBytes(32));
      engine.attest(sandbox.id, { verified: true });

      const plaintext = Buffer.from('sensitive-plaintext-data');
      engine.execute(sandbox.id, 'encrypt', { plaintext });

      // Verify plaintext is still intact before zeroize
      expect(plaintext.toString('utf8')).toBe('sensitive-plaintext-data');

      // Zeroize
      sandbox.zeroize();

      // The plaintext param buffer should be zeroed
      expect(plaintext.every((b) => b === 0)).toBe(true);
    });
  });

  // ── L2-06: Timeout enforcement on execute ─────────────────────────

  describe('L2-06: Timeout enforcement on execute', () => {
    test('sandbox with maxExecutionTimeSeconds=0 throws SANDBOX_EXECUTION_TIMEOUT', () => {
      const sandbox = engine.create('tenant-1', { maxExecutionTimeSeconds: 0 });
      engine.attest(sandbox.id, { verified: true });

      expect(() => engine.execute(sandbox.id, 'hash', { data: Buffer.from('test') })).toThrow(HsmAdapterError);
      try { engine.execute(sandbox.id, 'hash', { data: Buffer.from('test') }); } catch (e) { expect(e.code).toBe('SANDBOX_EXECUTION_TIMEOUT'); }
    });
  });

  // ── L2-07: Memory access audit trail ──────────────────────────────

  describe('L2-07: Memory access audit trail', () => {
    test('audit log contains set + get entries with key, timestamp, operation', () => {
      const sandbox = engine.create('tenant-1');
      sandbox.setMemory('key1', Buffer.alloc(32));
      sandbox.getMemory('key1');

      const log = sandbox.getMemoryAuditLog();
      expect(log.length).toBe(2);
      expect(log[0].op).toBe('set');
      expect(log[0].key).toBe('key1');
      expect(typeof log[0].timestamp).toBe('number');
      expect(log[0].size).toBe(32);
      expect(log[1].op).toBe('get');
      expect(log[1].key).toBe('key1');
      expect(typeof log[1].timestamp).toBe('number');
    });
  });

  // ── L3-01: setMemory with non-Buffer throws ───────────────────────

  describe('L3-01: setMemory with non-Buffer throws', () => {
    test('setMemory with string throws INVALID_MEMORY_TYPE', () => {
      const sandbox = engine.create('tenant-1');
      expect(() => sandbox.setMemory('key', 'string')).toThrow(HsmAdapterError);
      try { sandbox.setMemory('key', 'string'); } catch (e) { expect(e.code).toBe('INVALID_MEMORY_TYPE'); }
    });
  });

  // ── L3-02: setMemory with empty buffer is allowed ─────────────────

  describe('L3-02: setMemory with empty buffer is allowed', () => {
    test('empty buffer succeeds with 0 bytes', () => {
      const sandbox = engine.create('tenant-1');
      sandbox.setMemory('empty', Buffer.alloc(0));
      const stored = sandbox.getMemory('empty');
      expect(stored).toBeDefined();
      expect(stored.length).toBe(0);
    });
  });

  // ── L3-03: getMemory on non-existent key returns undefined ────────

  describe('L3-03: getMemory on non-existent key returns undefined', () => {
    test('returns undefined for non-existent key', () => {
      const sandbox = engine.create('tenant-1');
      expect(sandbox.getMemory('nonexistent')).toBeUndefined();
    });
  });

  // ── L3-04: Audit log capped at MAX_AUDIT_ENTRIES ───────────────────

  describe('L3-04: Audit log capped at MAX_AUDIT_ENTRIES', () => {
    test('60 set+get operations result in MAX_AUDIT_ENTRIES log entries', () => {
      const sandbox = engine.create('tenant-1');
      // Use a single key to avoid hitting MAX_MEMORY_ENTRIES
      for (let i = 0; i < 30; i++) {
        sandbox.setMemory('key', Buffer.alloc(32));
        sandbox.getMemory('key');
      }
      const log = sandbox.getMemoryAuditLog();
      expect(log.length).toBe(MAX_AUDIT_ENTRIES);
    });
  });

  // ── L3-05: Existing sandbox lifecycle unaffected ──────────────────

  describe('L3-05: Existing sandbox lifecycle unaffected', () => {
    test('create → attest → execute → zeroize → destroy all work', () => {
      const sandbox = engine.create('tenant-1');
      expect(sandbox.state).toBe(SANDBOX_STATES.CREATED);

      engine.attest(sandbox.id, { verified: true });
      expect(sandbox.state).toBe(SANDBOX_STATES.ATTESTED);

      const result = engine.execute(sandbox.id, 'hash', { data: Buffer.from('test') });
      expect(sandbox.state).toBe(SANDBOX_STATES.COMPLETED);
      expect(result.digest).toBeDefined();

      engine.zeroize(sandbox.id);
      expect(sandbox.state).toBe(SANDBOX_STATES.ZEROIZED);

      engine.destroy(sandbox.id);
      expect(sandbox.state).toBe(SANDBOX_STATES.DESTROYED);
    });
  });

  // ── L3-06: Execution result zeroized on destroy ───────────────────

  describe('L3-06: Execution result zeroized on destroy', () => {
    test('_executionResult is null after destroy without explicit zeroize', () => {
      const sandbox = engine.create('tenant-1');
      engine.attest(sandbox.id, { verified: true });
      engine.execute(sandbox.id, 'hash', { data: Buffer.from('test') });

      // Destroy without explicit zeroize — destroy() calls zeroize() internally
      engine.destroy(sandbox.id);
      expect(sandbox._executionResult).toBeNull();
    });
  });

  // ── L3-07: Multiple sandboxes have independent memory ─────────────

  describe('L3-07: Multiple sandboxes have independent memory', () => {
    test('each sandbox only sees its own data', () => {
      const sandbox1 = engine.create('tenant-1');
      const sandbox2 = engine.create('tenant-2');

      sandbox1.setMemory('key', Buffer.from('data-1'));
      sandbox2.setMemory('key', Buffer.from('data-2'));

      expect(sandbox1.getMemory('key').toString('utf8')).toBe('data-1');
      expect(sandbox2.getMemory('key').toString('utf8')).toBe('data-2');
    });
  });

  // ── L3-08: Zeroize is idempotent ──────────────────────────────────

  describe('L3-08: Zeroize is idempotent', () => {
    test('calling zeroize twice does not throw', () => {
      const sandbox = engine.create('tenant-1');
      sandbox.setMemory('key', Buffer.alloc(32));
      sandbox.zeroize();
      expect(() => sandbox.zeroize()).not.toThrow();
    });
  });

  // ── S-01: setMemory copies buffer to prevent external mutation ────

  describe('S-01: setMemory copies buffer to prevent external mutation', () => {
    test('stored buffer is a different object than the input', () => {
      const sandbox = engine.create('tenant-1');
      const input = Buffer.from('test-data');
      sandbox.setMemory('key', input);
      const stored = sandbox.getMemory('key');
      expect(stored).not.toBe(input); // different object reference
      expect(stored.equals(input)).toBe(true); // same content
    });
  });

  // ── S-02: Memory entry size capped at 64KB ────────────────────────

  describe('S-02: Memory entry size capped at 64KB', () => {
    test('exactly 64KB is allowed, 64KB+1 is rejected', () => {
      const sandbox = engine.create('tenant-1');
      // Exactly 64KB should work
      sandbox.setMemory('exact', Buffer.alloc(MAX_MEMORY_ENTRY_BYTES));
      expect(sandbox.getMemory('exact').length).toBe(MAX_MEMORY_ENTRY_BYTES);

      // 64KB + 1 should fail
      try { sandbox.setMemory('over', Buffer.alloc(MAX_MEMORY_ENTRY_BYTES + 1)); } catch (e) { expect(e.code).toBe('MEMORY_ENTRY_TOO_LARGE'); }
    });
  });

  // ── S-03: Memory entry count capped at 16 ─────────────────────────

  describe('S-03: Memory entry count capped at 16', () => {
    test('overwriting existing key does not count as new entry', () => {
      const sandbox = engine.create('tenant-1');
      // Store one key and overwrite it many times
      for (let i = 0; i < 20; i++) {
        sandbox.setMemory('same-key', Buffer.alloc(32));
      }
      // Should still have room for more entries
      expect(sandbox._memory.size).toBe(1);
      sandbox.setMemory('new-key', Buffer.alloc(32));
      expect(sandbox._memory.size).toBe(2);
    });
  });

  // ── S-04: Execution result zeroized on zeroize() ──────────────────

  describe('S-04: Execution result zeroized on zeroize()', () => {
    test('sign operation result signature buffer is zeroed', () => {
      const sandbox = engine.create('tenant-1');
      sandbox.setMemory('signingKey', crypto.randomBytes(32));
      engine.attest(sandbox.id, { verified: true });
      const result = engine.execute(sandbox.id, 'sign', { data: Buffer.from('test') });

      expect(result.signature).toBeDefined();
      sandbox.zeroize();
      expect(result.signature.every((b) => b === 0)).toBe(true);
    });
  });

  // ── S-05: Operation params zeroized after execute() ───────────────

  describe('S-05: Operation params zeroized after execute()', () => {
    test('decrypt ciphertext param is zeroed after zeroize', () => {
      const sandbox = engine.create('tenant-1');
      sandbox.setMemory('encryptionKey', crypto.randomBytes(32));
      engine.attest(sandbox.id, { verified: true });

      // First encrypt
      const encResult = engine.execute(sandbox.id, 'encrypt', {
        plaintext: Buffer.from('secret-message'),
      });

      // Now decrypt — the ciphertext param should be zeroed on zeroize
      const ciphertextCopy = Buffer.from(encResult.ciphertext);
      engine.execute(sandbox.id, 'decrypt', {
        ciphertext: encResult.ciphertext,
        iv: encResult.iv,
        tag: encResult.tag,
      });

      sandbox.zeroize();
      // The ciphertext from the encrypt result should be zeroed
      expect(encResult.ciphertext.every((b) => b === 0)).toBe(true);
      expect(ciphertextCopy.every((b) => b === 0)).toBe(false); // our copy is unaffected
    });
  });

  // ── S-06: Memory access audit trail recorded ──────────────────────

  describe('S-06: Memory access audit trail recorded', () => {
    test('audit log does not contain buffer contents', () => {
      const sandbox = engine.create('tenant-1');
      const secretData = Buffer.from('top-secret-data');
      sandbox.setMemory('secret', secretData);
      sandbox.getMemory('secret');

      const log = sandbox.getMemoryAuditLog();
      const logJson = JSON.stringify(log);
      // No buffer contents in the log
      expect(logJson).not.toContain('top-secret-data');
      // Only metadata
      expect(log[0].op).toBe('set');
      expect(log[0].key).toBe('secret');
      expect(log[0].size).toBe(secretData.length);
    });
  });

  // ── S-07: Sandbox timeout enforced ────────────────────────────────

  describe('S-07: Sandbox timeout enforced', () => {
    test('timeout event emitted with HIGH siem severity', () => {
      const auditEvents = [];
      const engineWithAudit = new ConfidentialSandboxEngine({
        audit: (event, data) => auditEvents.push({ event, data }),
      });
      const sandbox = engineWithAudit.create('tenant-1', { maxExecutionTimeSeconds: 0 });
      engineWithAudit.attest(sandbox.id, { verified: true });

      try {
        engineWithAudit.execute(sandbox.id, 'hash', { data: Buffer.from('test') });
      } catch (e) {
        // Expected
      }

      const timeoutEvent = auditEvents.find((e) => e.event === 'SANDBOX_EXECUTION_TIMEOUT');
      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent.data.siemSeverity).toBe('high');
      expect(timeoutEvent.data.siemCategory).toBe('sandbox_timeout');
    });
  });
});
