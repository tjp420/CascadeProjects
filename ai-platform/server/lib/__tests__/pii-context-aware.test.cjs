'use strict';

/**
 * Tests for context-aware PII redaction (skipCodeBlocks option).
 *
 * Tests that redactText() and createStreamScrubber() correctly preserve
 * PII in code blocks (fenced ``` and inline `code`) while still redacting
 * PII in prose segments. This prevents false positives on test fixtures,
 * API examples, and documentation code samples.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Context-Aware PII Redaction (skipCodeBlocks)', () => {
  let storeModule;
  let _tempPolicyPath;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pii-code-'));
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

  // ── _splitCodeSegments ─────────────────────────────────────────────────────

  describe('_splitCodeSegments', () => {
    it('should return single prose segment for plain text', () => {
      const segments = storeModule._splitCodeSegments('Hello world');
      assert.strictEqual(segments.length, 1);
      assert.strictEqual(segments[0].type, 'prose');
      assert.strictEqual(segments[0].text, 'Hello world');
    });

    it('should detect fenced code block', () => {
      const text = 'Before\n```js\nconst x = 1;\n```\nAfter';
      const segments = storeModule._splitCodeSegments(text);
      assert.ok(segments.length >= 3);
      assert.strictEqual(segments[0].type, 'prose');
      assert.ok(segments[0].text.includes('Before'));
      assert.strictEqual(segments[1].type, 'code');
      assert.ok(segments[1].text.includes('const x = 1'));
      assert.strictEqual(segments[2].type, 'prose');
      assert.ok(segments[2].text.includes('After'));
    });

    it('should detect inline code', () => {
      const text = 'Use `test@example.com` for testing';
      const segments = storeModule._splitCodeSegments(text);
      assert.ok(segments.length >= 3);
      assert.strictEqual(segments[0].type, 'prose');
      assert.ok(segments[0].text.includes('Use '));
      assert.strictEqual(segments[1].type, 'code');
      assert.ok(segments[1].text.includes('test@example.com'));
      assert.strictEqual(segments[2].type, 'prose');
      assert.ok(segments[2].text.includes('for testing'));
    });

    it('should handle multiple fenced code blocks', () => {
      const text = 'A\n```\ncode1\n```\nB\n```\ncode2\n```\nC';
      const segments = storeModule._splitCodeSegments(text);
      const codeSegments = segments.filter((s) => s.type === 'code');
      assert.strictEqual(codeSegments.length, 2);
      const proseSegments = segments.filter((s) => s.type === 'prose');
      assert.ok(proseSegments.length >= 3);
    });

    it('should handle fenced block at start of text', () => {
      const text = '```js\nconst x = 1;\n```\nAfter';
      const segments = storeModule._splitCodeSegments(text);
      assert.strictEqual(segments[0].type, 'code');
      assert.ok(segments[0].text.includes('const x = 1'));
    });

    it('should handle fenced block at end of text', () => {
      const text = 'Before\n```js\nconst x = 1;\n```';
      const segments = storeModule._splitCodeSegments(text);
      assert.strictEqual(segments[segments.length - 1].type, 'code');
    });

    it('should handle empty text', () => {
      const segments = storeModule._splitCodeSegments('');
      assert.strictEqual(segments.length, 1);
      assert.strictEqual(segments[0].type, 'prose');
    });
  });

  // ── redactText with skipCodeBlocks ─────────────────────────────────────────

  describe('redactText with skipCodeBlocks', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-code');
    });

    it('should redact PII in prose when skipCodeBlocks is true', () => {
      const text = 'Contact alice@test.com for details';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(!result.text.includes('alice@test.com'));
    });

    it('should NOT redact PII in fenced code blocks', () => {
      const text = 'Email: alice@test.com\n```js\nconst email = "test@example.com";\n```\nDone';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Prose email should be redacted
      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(!result.text.includes('alice@test.com'));
      // Code email should be preserved
      assert.ok(result.text.includes('test@example.com'));
    });

    it('should NOT redact PII in inline code', () => {
      const text = 'Use `alice@test.com` in your config';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Inline code should be preserved
      assert.ok(result.text.includes('alice@test.com'));
      assert.ok(!result.text.includes('[REDACTED-EMAIL]'));
    });

    it('should redact PII in prose between code blocks', () => {
      const text = '```\nconst x = "test@example.com";\n```\nEmail: bob@test.com\n```\nconst y = "admin@test.com";\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Code emails preserved
      assert.ok(result.text.includes('test@example.com'));
      assert.ok(result.text.includes('admin@test.com'));
      // Prose email redacted
      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(!result.text.includes('bob@test.com'));
    });

    it('should still redact when skipCodeBlocks is false (default)', () => {
      const text = '```js\nconst email = "test@example.com";\n```';
      const result = storeModule.redactText(text, 'org-code');
      // Default behavior: everything is redacted
      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(!result.text.includes('test@example.com'));
    });

    it('should handle text with no code blocks', () => {
      const text = 'Contact alice@test.com';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
    });

    it('should handle text with only code blocks', () => {
      const text = '```js\nconst email = "test@example.com";\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      assert.ok(result.text.includes('test@example.com'));
      assert.ok(!result.text.includes('[REDACTED-EMAIL]'));
    });

    it('should handle IP addresses in code blocks', () => {
      const text = 'Server: 192.168.1.1\n```bash\nssh root@10.0.0.1\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Prose IP redacted
      assert.ok(result.text.includes('[REDACTED-IP]'));
      assert.ok(!result.text.includes('192.168.1.1'));
      // Code IP preserved
      assert.ok(result.text.includes('10.0.0.1'));
    });

    it('should handle SSN in code blocks', () => {
      const text = 'SSN: 123-45-6789\n```js\nconst ssn = "987-65-4321";\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Prose SSN redacted
      assert.ok(result.text.includes('[REDACTED-SSN]'));
      assert.ok(!result.text.includes('123-45-6789'));
      // Code SSN preserved
      assert.ok(result.text.includes('987-65-4321'));
    });

    it('should handle Bearer tokens in code blocks', () => {
      const text = 'Token: Bearer abc123\n```http\nAuthorization: Bearer xyz789\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Prose token redacted
      assert.ok(result.text.includes('[REDACTED-TOKEN]'));
      assert.ok(!result.text.includes('Bearer abc123'));
      // Code token preserved
      assert.ok(result.text.includes('Bearer xyz789'));
    });

    it('should track matches only from prose segments', () => {
      const text = 'alice@test.com\n```\nbob@test.com\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Should have matches for the prose email only
      assert.ok(result.matches.length > 0);
      const emailMatch = result.matches.find((m) => m.name === 'Email Address');
      if (emailMatch) {
        // Should only count prose matches, not code matches
        assert.ok(emailMatch.count >= 1);
      }
    });
  });

  // ── Stream scrubber with skipCodeBlocks ────────────────────────────────────

  describe('createStreamScrubber with skipCodeBlocks', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-code');
    });

    it('should preserve PII in code blocks during streaming', () => {
      const scrubber = storeModule.createStreamScrubber('org-code', { skipCodeBlocks: true });
      const text = 'Email: alice@test.com\n```js\nconst e = "bob@test.com";\n```';
      const out = scrubber.process(text);
      const tail = scrubber.flush();
      const combined = (typeof out === 'string' ? out : out.text) + (typeof tail === 'string' ? tail : tail.text);

      // Prose email redacted
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      assert.ok(!combined.includes('alice@test.com'));
      // Code email preserved
      assert.ok(combined.includes('bob@test.com'));
    });

    it('should report skipCodeBlocks in stats', () => {
      const scrubber = storeModule.createStreamScrubber('org-code', { skipCodeBlocks: true });
      const stats = scrubber.getStats();
      assert.strictEqual(stats.skipCodeBlocks, true);
    });

    it('should report skipCodeBlocks=false by default', () => {
      const scrubber = storeModule.createStreamScrubber('org-code');
      const stats = scrubber.getStats();
      assert.strictEqual(stats.skipCodeBlocks, false);
    });

    it('should handle code block split across chunks', () => {
      const scrubber = storeModule.createStreamScrubber('org-code', { skipCodeBlocks: true });
      const out1 = scrubber.process('Email: alice@test.com\n```js\n');
      const out2 = scrubber.process('const e = "bob@test.com";\n');
      const out3 = scrubber.process('```\nDone');
      const tail = scrubber.flush();

      const combined = [out1, out2, out3, tail]
        .map((o) => typeof o === 'string' ? o : o.text)
        .join('');

      // Prose email redacted
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      assert.ok(!combined.includes('alice@test.com'));
      // Code email preserved (may be split but content should survive)
      assert.ok(combined.includes('bob@test.com'));
    });

    it('should work with block-aware mode + skipCodeBlocks', () => {
      const scrubber = storeModule.createStreamScrubber('org-code', { skipCodeBlocks: true });
      const out1 = scrubber.process({ text: 'Email: alice@test.com', type: 'text' });
      const out2 = scrubber.process({ text: '```js\nconst e = "bob@test.com";\n```', type: 'text' });
      const tail = scrubber.flush();

      const combined = [out1, out2, tail]
        .map((o) => typeof o === 'object' ? o.text : o)
        .join('');

      // Prose email redacted
      assert.ok(combined.includes('[REDACTED-EMAIL]'));
      // Code email preserved
      assert.ok(combined.includes('bob@test.com'));
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-code');
    });

    it('should handle unclosed code block (treat rest as code)', () => {
      const text = '```\nconst email = "test@example.com";\n';
      const segments = storeModule._splitCodeSegments(text);
      // Unclosed code block — should be detected as code
      assert.ok(segments.some((s) => s.type === 'code' && s.text.includes('test@example.com')));
    });

    it('should handle nested backticks in fenced block', () => {
      const text = '```js\nconst s = `template ${email}`;\n```';
      const segments = storeModule._splitCodeSegments(text);
      // The entire fenced block should be one code segment
      const codeSegments = segments.filter((s) => s.type === 'code');
      assert.ok(codeSegments.length >= 1);
    });

    it('should handle empty code blocks', () => {
      const text = 'Before\n```\n```\nAfter';
      const segments = storeModule._splitCodeSegments(text);
      assert.ok(segments.length >= 2);
    });

    it('should handle code block with language specifier', () => {
      const text = '```python\nemail = "test@example.com"\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      assert.ok(result.text.includes('test@example.com'));
    });

    it('should not break on text with only backticks', () => {
      const text = '``';
      const segments = storeModule._splitCodeSegments(text);
      // Should not crash, should return prose
      assert.ok(segments.length >= 1);
    });

    it('should handle mixed inline and fenced code', () => {
      const text = 'Use `alice@test.com` then:\n```js\nconst e = "bob@test.com";\n```';
      const result = storeModule.redactText(text, 'org-code', { skipCodeBlocks: true });
      // Both should be preserved
      assert.ok(result.text.includes('alice@test.com'));
      assert.ok(result.text.includes('bob@test.com'));
      assert.ok(!result.text.includes('[REDACTED-EMAIL]'));
    });
  });
});
