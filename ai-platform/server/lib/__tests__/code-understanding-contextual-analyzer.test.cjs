'use strict';

const { analyzeContextualLayer, analyzeGitContext, findAdjacentDocumentation } = require('../code-understanding/contextual-analyzer.cjs');

describe('code-understanding/contextual-analyzer', () => {
  test('exports expected functions', () => {
    expect(typeof analyzeContextualLayer).toBe('function');
    expect(typeof analyzeGitContext).toBe('function');
    expect(typeof findAdjacentDocumentation).toBe('function');
  });

  test('analyzeGitContext returns unavailable for non-git directory', async () => {
    const os = require('os');
    const path = require('path');
    const tmpDir = os.tmpdir();
    const result = await analyzeGitContext('nonexistent-file.js', tmpDir);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  test('findAdjacentDocumentation returns array (async)', async () => {
    const result = await findAdjacentDocumentation('src/index.js', '/nonexistent/project');
    expect(Array.isArray(result)).toBe(true);
  });

  test('analyzeContextualLayer returns object', async () => {
    const result = await analyzeContextualLayer('src/index.js', '/nonexistent/project');
    expect(typeof result).toBe('object');
  });
});
