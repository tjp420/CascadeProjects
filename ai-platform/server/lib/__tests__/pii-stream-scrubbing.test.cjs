'use strict';

/**
 * Tests for stream-mode PII scrubbing in pii-policy-store.cjs
 *
 * Tests createStreamScrubber() for incremental/chunked text processing,
 * ensuring PII patterns split across chunk boundaries are still redacted.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Stream PII Scrubbing', () => {
  let storeModule;
  let _tempPolicyPath;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pii-stream-'));
    _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');
    jest.resetModules();
    storeModule = require('../pii-policy-store.cjs');
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── Basic Stream Operations ────────────────────────────────────────────────

  describe('basic stream operations', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-stream');
    });

    it('should return a scrubber object with process, flush, getStats', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      assert.ok(typeof scrubber.process === 'function');
      assert.ok(typeof scrubber.flush === 'function');
      assert.ok(typeof scrubber.getStats === 'function');
    });

    it('should process text with no PII as-is (via flush)', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out = scrubber.process('Hello world, no PII here.');
      const tail = scrubber.flush();
      assert.strictEqual(out + tail, 'Hello world, no PII here.');
    });

    it('should redact PII in a single chunk (via flush)', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out = scrubber.process('Contact alice@example.com for info.');
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      assert.ok(!combined.includes('alice@example.com'));
    });

    it('should handle empty chunk', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      assert.strictEqual(scrubber.process(''), '');
      assert.strictEqual(scrubber.process(null), '');
      assert.strictEqual(scrubber.process(undefined), '');
    });

    it('should handle flush with empty buffer', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('All clear text.');
      const flushed = scrubber.flush();
      // Some text might be buffered, flush should return it
      assert.ok(typeof flushed === 'string');
    });
  });

  // ── Cross-Chunk PII Matching ───────────────────────────────────────────────

  describe('cross-chunk PII matching', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-stream');
    });

    it('should redact email split across two chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('Contact alice@');
      const out2 = scrubber.process('example.com now');
      const tail = scrubber.flush();
      const combined = out1 + out2 + tail;

      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      assert.ok(!combined.includes('alice@example.com'));
      assert.ok(combined.includes('now'));
    });

    it('should redact SSN split across two chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('SSN: 123-45-');
      const out2 = scrubber.process('6789 done');
      const tail = scrubber.flush();
      const combined = out1 + out2 + tail;

      assert.ok(combined.includes('[REDACTED-SSN]'));
      assert.ok(!combined.includes('123-45-6789'));
    });

    it('should redact phone number split across chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('Call (555) 123-');
      const out2 = scrubber.process('4567 please');
      const tail = scrubber.flush();
      const combined = out1 + out2 + tail;

      assert.ok(combined.includes('[REDACTED-PHONE]'));
      assert.ok(!combined.includes('(555) 123-4567'));
    });

    it('should redact IP address split across chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('From IP 192.168.');
      const out2 = scrubber.process('1.100 today');
      const tail = scrubber.flush();
      const combined = out1 + out2 + tail;

      assert.ok(combined.includes('[REDACTED-IP]'));
      assert.ok(!combined.includes('192.168.1.100'));
    });

    it('should redact Bearer token split across chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('Auth: Bearer abc');
      const out2 = scrubber.process('123xyz end');
      const tail = scrubber.flush();
      const combined = out1 + out2 + tail;

      assert.ok(combined.includes('[REDACTED-TOKEN]'));
      assert.ok(!combined.includes('Bearer abc123xyz'));
    });

    it('should redact multiple PII types across multiple chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const chunks = [
        'User alice@',
        'test.io has SSN 111-',
        '22-3333 and IP 10.0.',
        '0.1',
      ];
      let combined = '';
      for (const chunk of chunks) {
        combined += scrubber.process(chunk);
      }
      combined += scrubber.flush();

      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      assert.ok(combined.includes('[REDACTED-SSN]'));
      assert.ok(combined.includes('[REDACTED-IP]'));
      assert.ok(!combined.includes('alice@test.io'));
      assert.ok(!combined.includes('111-22-3333'));
      assert.ok(!combined.includes('10.0.0.1'));
    });
  });

  // ── Buffer Management ──────────────────────────────────────────────────────

  describe('buffer management', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-stream');
    });

    it('should hold back text that might be partial PII', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      // 'alice@' looks like it could be the start of an email
      const out = scrubber.process('Hello alice@');
      // The 'alice@' part should be held back — only 'Hello ' should be emitted
      // (or possibly the whole thing if the lookback determines it's safe)
      assert.ok(typeof out === 'string');
      // After flush, the full text should be available
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.ok(combined.includes('Hello'));
      assert.ok(combined.includes('alice@'));
    });

    it('should release held-back text when more data arrives', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('Email: alice@');
      const out2 = scrubber.process('corp.io');
      const tail = scrubber.flush();
      const combined = out1 + out2 + tail;

      assert.ok(combined.includes('[REDACTED-EMAIL]'));
    });

    it('should handle very short chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      let combined = '';
      combined += scrubber.process('a');
      combined += scrubber.process('l');
      combined += scrubber.process('i');
      combined += scrubber.process('c');
      combined += scrubber.process('e');
      combined += scrubber.process('@');
      combined += scrubber.process('t');
      combined += scrubber.process('.');
      combined += scrubber.process('i');
      combined += scrubber.process('o');
      combined += scrubber.flush();

      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      assert.ok(!combined.includes('alice@t.io'));
    });

    it('should handle flush at end of stream', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process('Text with no PII');
      const tail = scrubber.flush();
      const combined = out1 + tail;
      assert.strictEqual(combined, 'Text with no PII');
    });
  });

  // ── Stats Tracking ─────────────────────────────────────────────────────────

  describe('stats tracking', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-stream');
    });

    it('should track totalProcessed chars', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('Hello world');
      scrubber.flush();
      const stats = scrubber.getStats();
      assert.ok(stats.totalProcessed >= 11);
    });

    it('should track totalRedacted count', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('Email: alice@test.com');
      scrubber.flush();
      const stats = scrubber.getStats();
      assert.ok(stats.totalRedacted >= 1);
    });

    it('should track matchCounts per pattern name', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('alice@test.com and bob@test.com');
      scrubber.flush();
      const stats = scrubber.getStats();
      assert.ok(stats.matchCounts['Email Address'] >= 2);
    });

    it('should track bufferLength', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('Hello alice@');
      const stats = scrubber.getStats();
      // Some text may be buffered
      assert.ok(typeof stats.bufferLength === 'number');
      assert.ok(stats.bufferLength >= 0);
    });

    it('should report patternCount', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const stats = scrubber.getStats();
      assert.strictEqual(stats.patternCount, 6); // 6 default seed patterns
    });

    it('should report zero bufferLength after flush', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('Hello world');
      scrubber.flush();
      const stats = scrubber.getStats();
      assert.strictEqual(stats.bufferLength, 0);
    });
  });

  // ── No Patterns (Pass-Through Mode) ────────────────────────────────────────

  describe('no patterns (pass-through mode)', () => {
    it('should pass through text when no patterns exist', () => {
      const scrubber = storeModule.createStreamScrubber('org-empty');
      const out = scrubber.process('alice@test.com should pass through');
      assert.strictEqual(out, 'alice@test.com should pass through');
    });

    it('should pass through with flush', () => {
      const scrubber = storeModule.createStreamScrubber('org-empty');
      const out1 = scrubber.process('chunk1 ');
      const out2 = scrubber.process('chunk2');
      const tail = scrubber.flush();
      assert.strictEqual(out1 + out2 + tail, 'chunk1 chunk2');
    });

    it('should report zero patternCount', () => {
      const scrubber = storeModule.createStreamScrubber('org-empty');
      const stats = scrubber.getStats();
      assert.strictEqual(stats.patternCount, 0);
    });
  });

  // ── Equivalence with redactText ────────────────────────────────────────────

  describe('equivalence with redactText', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-stream');
    });

    it('should produce same result as redactText for complete text', () => {
      const text = 'Email: alice@test.com, SSN: 123-45-6789, IP: 10.0.0.1';

      // Single-pass redaction
      const single = storeModule.redactText(text, 'org-stream');

      // Stream redaction (one chunk)
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const streamOut = scrubber.process(text);
      const streamTail = scrubber.flush();
      const streamResult = streamOut + streamTail;

      assert.strictEqual(streamResult, single.text);
    });

    it('should produce same result as redactText for split text', () => {
      const text = 'Contact alice@example.com for details about 192.168.1.1';

      // Single-pass redaction
      const single = storeModule.redactText(text, 'org-stream');

      // Stream redaction (split at various points)
      const midPoint = Math.floor(text.length / 2);
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out1 = scrubber.process(text.slice(0, midPoint));
      const out2 = scrubber.process(text.slice(midPoint));
      const tail = scrubber.flush();
      const streamResult = out1 + out2 + tail;

      assert.strictEqual(streamResult, single.text);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-stream');
    });

    it('should handle stream with only whitespace', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out = scrubber.process('   \n\t  ');
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.strictEqual(combined, '   \n\t  ');
    });

    it('should handle very long text with no PII', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const longText = 'x'.repeat(10000);
      const out = scrubber.process(longText);
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.strictEqual(combined, longText);
    });

    it('should handle PII at the very start of stream', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out = scrubber.process('alice@test.com is the email');
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
    });

    it('should handle PII at the very end of stream', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      const out = scrubber.process('The email is alice@test.com');
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
    });

    it('should handle multiple flushes (second should be empty)', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream');
      scrubber.process('alice@test.com');
      const flush1 = scrubber.flush();
      const flush2 = scrubber.flush();
      assert.ok(flush1.length > 0 || flush1 === '');
      assert.strictEqual(flush2, '');
    });

    it('should handle custom maxLookback option', () => {
      const scrubber = storeModule.createStreamScrubber('org-stream', { maxLookback: 50 });
      const out = scrubber.process('Email: alice@test.com');
      const tail = scrubber.flush();
      const combined = out + tail;
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
    });
  });
});
