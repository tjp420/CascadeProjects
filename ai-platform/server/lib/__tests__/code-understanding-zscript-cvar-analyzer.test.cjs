'use strict';

const {
  parseCvarInfoFile,
  findCvarInfoFiles,
  extractFindCvarUsages,
} = require('../code-understanding/zscript-cvar-analyzer.cjs');

describe('code-understanding/zscript-cvar-analyzer', () => {
  test('exports expected functions', () => {
    expect(typeof parseCvarInfoFile).toBe('function');
    expect(typeof findCvarInfoFiles).toBe('function');
    expect(typeof extractFindCvarUsages).toBe('function');
  });

  test('parseCvarInfoFile returns array of definitions', () => {
    const content = 'user int player_health = 100;';
    const result = parseCvarInfoFile(content);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('player_health');
    expect(result[0].type).toBe('int');
  });

  test('parseCvarInfoFile returns empty array for empty content', () => {
    const result = parseCvarInfoFile('');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  test('findCvarInfoFiles returns array (async)', async () => {
    const result = await findCvarInfoFiles('/nonexistent/path');
    expect(Array.isArray(result)).toBe(true);
  });

  test('extractFindCvarUsages returns array', () => {
    const content = 'CVar.FindCVar("player_health");';
    const result = extractFindCvarUsages(content, 'test.zs');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].cvarName).toBe('player_health');
  });

  test('extractFindCvarUsages returns empty array for no matches', () => {
    const result = extractFindCvarUsages('A_Log("hello");', 'test.zs');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
