'use strict';

/**
 * Tests for deterministic canonical request serializer and replay detector.
 *
 * Verifies that canonicalizeRequest() produces stable fingerprints
 * regardless of key order, and that createReplayDetector() correctly
 * detects duplicate payloads within the TTL window.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Canonical Request Serializer', () => {
  let cryptoUtils;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-canonical-'));
    process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-key-for-canonical';
    jest.resetModules();
    cryptoUtils = require('../crypto-utils.cjs');
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── canonicalizeRequest ────────────────────────────────────────────────────

  describe('canonicalizeRequest', () => {
    it('should produce deterministic output for simple object', () => {
      const payload = { b: 2, a: 1 };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"a":1,"b":2}');
    });

    it('should produce same fingerprint regardless of key order', () => {
      const payload1 = { b: 2, a: 1, c: 3 };
      const payload2 = { c: 3, a: 1, b: 2 };
      const r1 = cryptoUtils.canonicalizeRequest(payload1);
      const r2 = cryptoUtils.canonicalizeRequest(payload2);
      assert.strictEqual(r1.fingerprint, r2.fingerprint);
      assert.strictEqual(r1.canonical, r2.canonical);
    });

    it('should sort nested object keys recursively', () => {
      const payload = { outer: { z: 1, a: 2 } };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"outer":{"a":2,"z":1}}');
    });

    it('should preserve array order (not sort arrays)', () => {
      const payload = { items: [3, 1, 2] };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"items":[3,1,2]}');
    });

    it('should recursively canonicalize array elements (objects)', () => {
      const payload = { items: [{ z: 1, a: 2 }, { y: 3, b: 4 }] };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"items":[{"a":2,"z":1},{"b":4,"y":3}]}');
    });

    it('should handle deeply nested objects', () => {
      const payload = { level1: { level2: { level3: { z: 1, a: 2 } } } };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.ok(result.canonical.includes('"a":2'));
      assert.ok(result.canonical.indexOf('"a"') < result.canonical.indexOf('"z"'));
    });

    it('should handle null values', () => {
      const payload = { a: null, b: 1 };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"a":null,"b":1}');
    });

    it('should handle string values', () => {
      const payload = { name: 'test', value: 'hello' };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"name":"test","value":"hello"}');
    });

    it('should handle boolean values', () => {
      const payload = { active: true, disabled: false };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"active":true,"disabled":false}');
    });

    it('should handle empty object', () => {
      const result = cryptoUtils.canonicalizeRequest({});
      assert.strictEqual(result.canonical, '{}');
    });

    it('should handle empty array', () => {
      const result = cryptoUtils.canonicalizeRequest({ items: [] });
      assert.strictEqual(result.canonical, '{"items":[]}');
    });

    it('should handle nested arrays', () => {
      const payload = { matrix: [[3, 1], [2, 4]] };
      const result = cryptoUtils.canonicalizeRequest(payload);
      assert.strictEqual(result.canonical, '{"matrix":[[3,1],[2,4]]}');
    });

    it('should produce sha256: prefixed fingerprint', () => {
      const result = cryptoUtils.canonicalizeRequest({ a: 1 });
      assert.ok(result.fingerprint.startsWith('sha256:'));
      assert.strictEqual(result.fingerprint, `sha256:${result.hash}`);
    });

    it('should produce correct SHA-256 hash', () => {
      const result = cryptoUtils.canonicalizeRequest({ a: 1 });
      const expectedHash = crypto.createHash('sha256').update('{"a":1}', 'utf8').digest('hex');
      assert.strictEqual(result.hash, expectedHash);
    });

    it('should not mutate the original payload', () => {
      const payload = { b: 2, a: 1 };
      const originalKeys = Object.keys(payload);
      cryptoUtils.canonicalizeRequest(payload);
      assert.deepStrictEqual(Object.keys(payload), originalKeys);
    });

    it('should handle mixed types', () => {
      const payload = {
        str: 'hello',
        num: 42,
        bool: true,
        null: null,
        arr: [1, 2],
        obj: { z: 1, a: 2 },
      };
      const result = cryptoUtils.canonicalizeRequest(payload);
      // Keys should be sorted
      const keys = Object.keys(JSON.parse(result.canonical));
      assert.deepStrictEqual(keys, ['arr', 'bool', 'null', 'num', 'obj', 'str']);
    });

    it('should produce stable fingerprint across multiple calls', () => {
      const payload = { b: 2, a: 1, c: { z: 3, a: 1 } };
      const r1 = cryptoUtils.canonicalizeRequest(payload);
      const r2 = cryptoUtils.canonicalizeRequest(payload);
      const r3 = cryptoUtils.canonicalizeRequest({ c: { a: 1, z: 3 }, a: 1, b: 2 });
      assert.strictEqual(r1.fingerprint, r2.fingerprint);
      assert.strictEqual(r1.fingerprint, r3.fingerprint);
    });

    it('should handle non-object input (string)', () => {
      const result = cryptoUtils.canonicalizeRequest('hello');
      assert.strictEqual(result.canonical, '"hello"');
      assert.ok(result.fingerprint.startsWith('sha256:'));
    });

    it('should handle non-object input (number)', () => {
      const result = cryptoUtils.canonicalizeRequest(42);
      assert.strictEqual(result.canonical, '42');
    });
  });

  // ── createReplayDetector ───────────────────────────────────────────────────

  describe('createReplayDetector', () => {
    it('should detect replay on second check', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });
      const fp = 'sha256:abc123';

      const r1 = detector.checkAndMark('org-1', fp);
      assert.strictEqual(r1.isReplay, false);

      const r2 = detector.checkAndMark('org-1', fp);
      assert.strictEqual(r2.isReplay, true);
      assert.ok(r2.firstSeen > 0);
    });

    it('should NOT detect replay for different orgs', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });
      const fp = 'sha256:abc123';

      detector.checkAndMark('org-1', fp);
      const r2 = detector.checkAndMark('org-2', fp);
      assert.strictEqual(r2.isReplay, false);
    });

    it('should NOT detect replay for different fingerprints', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });

      detector.checkAndMark('org-1', 'sha256:aaa');
      const r2 = detector.checkAndMark('org-1', 'sha256:bbb');
      assert.strictEqual(r2.isReplay, false);
    });

    it('should expire entries after TTL', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 50 });
      const fp = 'sha256:abc123';

      detector.checkAndMark('org-1', fp);

      return new Promise((resolve) => {
        setTimeout(() => {
          const r2 = detector.checkAndMark('org-1', fp);
          assert.strictEqual(r2.isReplay, false);
          resolve();
        }, 60);
      });
    });

    it('should track totalChecked and totalReplays in stats', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });
      const fp = 'sha256:abc123';

      detector.checkAndMark('org-1', fp);
      detector.checkAndMark('org-1', fp);

      const stats = detector.getStats();
      assert.strictEqual(stats.totalChecked, 2);
      assert.strictEqual(stats.totalReplays, 1);
    });

    it('should enforce maxPerOrg limit', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000, maxPerOrg: 3 });

      detector.checkAndMark('org-1', 'sha256:001');
      detector.checkAndMark('org-1', 'sha256:002');
      detector.checkAndMark('org-1', 'sha256:003');
      detector.checkAndMark('org-1', 'sha256:004'); // Should evict 001

      // 001 should no longer be detected as replay
      const r = detector.checkAndMark('org-1', 'sha256:001');
      assert.strictEqual(r.isReplay, false);
    });

    it('should clear fingerprints for a specific org', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });

      detector.checkAndMark('org-1', 'sha256:001');
      detector.checkAndMark('org-2', 'sha256:001');
      detector.clear('org-1');

      // org-1 should not detect replay
      const r1 = detector.checkAndMark('org-1', 'sha256:001');
      assert.strictEqual(r1.isReplay, false);

      // org-2 should still detect replay
      const r2 = detector.checkAndMark('org-2', 'sha256:001');
      assert.strictEqual(r2.isReplay, true);
    });

    it('should clear all fingerprints when no orgId provided', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });

      detector.checkAndMark('org-1', 'sha256:001');
      detector.checkAndMark('org-2', 'sha256:002');
      detector.clear();

      const stats = detector.getStats();
      assert.strictEqual(stats.orgCount, 0);
      assert.strictEqual(stats.totalFingerprints, 0);
    });

    it('should report orgCount and totalFingerprints in stats', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });

      detector.checkAndMark('org-1', 'sha256:001');
      detector.checkAndMark('org-1', 'sha256:002');
      detector.checkAndMark('org-2', 'sha256:003');

      const stats = detector.getStats();
      assert.strictEqual(stats.orgCount, 2);
      assert.strictEqual(stats.totalFingerprints, 3);
    });

    it('should report ttlMs and maxPerOrg config in stats', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 30000, maxPerOrg: 500 });
      const stats = detector.getStats();
      assert.strictEqual(stats.ttlMs, 30000);
      assert.strictEqual(stats.maxPerOrg, 500);
    });

    it('should use check() without marking', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });
      const fp = 'sha256:abc123';

      const r1 = detector.check('org-1', fp);
      assert.strictEqual(r1.isReplay, false);

      // check() should not mark — second check should still be false
      const r2 = detector.check('org-1', fp);
      assert.strictEqual(r2.isReplay, false);

      // mark() then check() should detect
      detector.mark('org-1', fp);
      const r3 = detector.check('org-1', fp);
      assert.strictEqual(r3.isReplay, true);
    });
  });

  // ── Integration: canonicalizeRequest + replayDetector ──────────────────────

  describe('integration: canonicalizeRequest + replayDetector', () => {
    it('should detect replay of same payload with different key order', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });

      const payload1 = { agentId: 'agent-1', input: 'hello', options: { model: 'gpt-4' } };
      const payload2 = { options: { model: 'gpt-4' }, input: 'hello', agentId: 'agent-1' };

      const r1 = cryptoUtils.canonicalizeRequest(payload1);
      const r2 = cryptoUtils.canonicalizeRequest(payload2);

      // Same fingerprint despite different key order
      assert.strictEqual(r1.fingerprint, r2.fingerprint);

      // Replay detector should catch it
      const check1 = detector.checkAndMark('org-1', r1.fingerprint);
      assert.strictEqual(check1.isReplay, false);

      const check2 = detector.checkAndMark('org-1', r2.fingerprint);
      assert.strictEqual(check2.isReplay, true);
    });

    it('should NOT detect replay for different payloads', () => {
      const detector = cryptoUtils.createReplayDetector({ ttlMs: 60000 });

      const payload1 = { input: 'hello', agentId: 'agent-1' };
      const payload2 = { input: 'world', agentId: 'agent-1' };

      const r1 = cryptoUtils.canonicalizeRequest(payload1);
      const r2 = cryptoUtils.canonicalizeRequest(payload2);

      assert.notStrictEqual(r1.fingerprint, r2.fingerprint);

      const check1 = detector.checkAndMark('org-1', r1.fingerprint);
      assert.strictEqual(check1.isReplay, false);

      const check2 = detector.checkAndMark('org-1', r2.fingerprint);
      assert.strictEqual(check2.isReplay, false);
    });
  });
});
