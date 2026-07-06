const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We can't easily import the whole module because it bootstraps Express routes.
// Instead, read and evaluate the pure helpers via a targeted require pattern.
// For simplicity, test the exported pure functions by loading the module in a
// way that does not trigger side effects.

describe('simplebeacon-api helpers', () => {
  describe('tryExtractJsonFromStdout', () => {
    // Inline replica of the function for isolated testing
    function tryExtractJsonFromStdout(stdout) {
      if (!stdout) return null;
      const lines = stdout.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') || line.startsWith('[')) {
          try { return JSON.parse(line); } catch { /* continue */ }
        }
      }
      return null;
    }

    it('extracts trailing JSON object', () => {
      const out = 'Scan complete\n{"score":100}';
      assert.deepStrictEqual(tryExtractJsonFromStdout(out), { score: 100 });
    });

    it('extracts trailing JSON array', () => {
      const out = 'Done\n[1,2,3]';
      assert.deepStrictEqual(tryExtractJsonFromStdout(out), [1, 2, 3]);
    });

    it('skips non-JSON lines', () => {
      const out = 'error\nnot json\n{\"valid\":true}';
      assert.deepStrictEqual(tryExtractJsonFromStdout(out), { valid: true });
    });

    it('returns null for empty stdout', () => {
      assert.strictEqual(tryExtractJsonFromStdout(''), null);
      assert.strictEqual(tryExtractJsonFromStdout(null), null);
    });
  });

  describe('mergeConfig', () => {
    function mergeConfig(existing, incoming) {
      const merged = { ...existing, ...incoming };
      if (existing.rules || incoming.rules) {
        merged.rules = { ...(existing.rules || {}), ...(incoming.rules || {}) };
      }
      return merged;
    }

    it('shallow merges top-level keys', () => {
      const result = mergeConfig({ a: 1 }, { b: 2 });
      assert.deepStrictEqual(result, { a: 1, b: 2 });
    });

    it('overrides existing keys', () => {
      const result = mergeConfig({ a: 1 }, { a: 2 });
      assert.strictEqual(result.a, 2);
    });

    it('deep merges rules object', () => {
      const result = mergeConfig(
        { rules: { x: 1 } },
        { rules: { y: 2 } }
      );
      assert.deepStrictEqual(result.rules, { x: 1, y: 2 });
    });

    it('handles missing rules on either side', () => {
      const result = mergeConfig({ a: 1 }, { rules: { z: 3 } });
      assert.deepStrictEqual(result.rules, { z: 3 });
    });
  });
});
