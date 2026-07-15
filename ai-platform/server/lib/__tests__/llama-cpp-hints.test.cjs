'use strict';

const { probeLlamaCppBin, buildSemanticHints, MAX_HINTS } = require('../llama-cpp-hints.cjs');

describe('llama-cpp-hints', () => {
  test('exports expected functions and constants', () => {
    expect(typeof probeLlamaCppBin).toBe('function');
    expect(typeof buildSemanticHints).toBe('function');
    expect(typeof MAX_HINTS).toBe('number');
    expect(MAX_HINTS).toBeGreaterThan(0);
  });

  test('probeLlamaCppBin returns not configured when no env var', () => {
    delete process.env.LLAMA_CPP_BIN;
    const result = probeLlamaCppBin();
    expect(result.configured).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.path).toBeNull();
  });

  test('probeLlamaCppBin returns configured when path provided', () => {
    const result = probeLlamaCppBin('/usr/bin/llama-cli');
    expect(result.configured).toBe(true);
    expect(result.path).toBe('/usr/bin/llama-cli');
  });

  test('buildSemanticHints returns disabled when not configured', () => {
    delete process.env.LLAMA_CPP_BIN;
    const result = buildSemanticHints([{ fileA: 'a.js', fileB: 'b.js', similarity: 0.9 }]);
    expect(result.enabled).toBe(false);
    expect(result.mode).toBe('filesystem-only');
    expect(result.hints).toEqual([]);
  });

  test('buildSemanticHints returns hints when configured', () => {
    const result = buildSemanticHints(
      [{ fileA: 'a.js', fileB: 'b.js', similarity: 0.95 }],
      { binPath: '/usr/bin/llama-cli' }
    );
    expect(result.enabled).toBe(true);
    expect(result.hints).toHaveLength(1);
    expect(result.hints[0].files).toEqual(['a.js', 'b.js']);
  });

  test('buildSemanticHints caps hints at MAX_HINTS', () => {
    const pairs = Array.from({ length: 20 }, (_, i) => ({
      fileA: `a${i}.js`, fileB: `b${i}.js`, similarity: 0.9
    }));
    const result = buildSemanticHints(pairs, { binPath: '/usr/bin/llama-cli' });
    expect(result.hints.length).toBeLessThanOrEqual(MAX_HINTS);
  });

  test('buildSemanticHints handles empty pairs', () => {
    const result = buildSemanticHints([], { binPath: '/usr/bin/llama-cli' });
    expect(result.hints).toEqual([]);
    expect(result.pairsEligible).toBe(0);
  });
});
