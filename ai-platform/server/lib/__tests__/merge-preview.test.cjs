'use strict';

const {
  buildMergePreview,
  resolveProjectFile,
  assessMergeRisk,
  CONFIRMATION_PHRASE,
  PREVIEW_TTL_MS
} = require('../merge-preview.cjs');

describe('merge-preview', () => {
  test('exports expected functions and constants', () => {
    expect(typeof buildMergePreview).toBe('function');
    expect(typeof resolveProjectFile).toBe('function');
    expect(typeof assessMergeRisk).toBe('function');
    expect(typeof CONFIRMATION_PHRASE).toBe('string');
    expect(typeof PREVIEW_TTL_MS).toBe('number');
    expect(CONFIRMATION_PHRASE).toBe('QUARANTINE_DUPLICATES');
    expect(PREVIEW_TTL_MS).toBeGreaterThan(0);
  });

  test('resolveProjectFile resolves within project root', () => {
    const result = resolveProjectFile('/project', 'src/index.js');
    expect(result).toBe(require('path').resolve('/project', 'src/index.js'));
  });

  test('resolveProjectFile throws on path escaping root', () => {
    expect(() => resolveProjectFile('/project', '../../etc/passwd')).toThrow(/escapes project root/);
  });

  test('resolveProjectFile handles backslash paths', () => {
    const result = resolveProjectFile('/project', 'src\\index.js');
    expect(result).toContain('src');
    expect(result).toContain('index.js');
  });

  test('assessMergeRisk returns low for exact duplicate without conflicts', () => {
    const candidate = { mergeType: 'exact-duplicate', risk: 'medium' };
    const snapshots = [{ exists: true, validJson: true }];
    const result = assessMergeRisk(candidate, snapshots, []);
    expect(result.level).toBe('low');
    expect(result.autoMergeAllowed).toBe(false);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.quarantineOnly).toBe(true);
  });

  test('assessMergeRisk returns high when conflicts exist', () => {
    const candidate = { mergeType: 'exact-duplicate' };
    const snapshots = [{ exists: true, validJson: true }];
    const result = assessMergeRisk(candidate, snapshots, [{ file: 'a', reason: 'conflict' }]);
    expect(result.level).toBe('high');
    expect(result.factors).toContain('1 conflict(s) detected');
  });

  test('assessMergeRisk returns high when files missing', () => {
    const candidate = { mergeType: 'fuzzy-near-duplicate', similarity: 0.9 };
    const snapshots = [{ exists: false }];
    const result = assessMergeRisk(candidate, snapshots, []);
    expect(result.level).toBe('high');
    expect(result.factors).toContain('1 file(s) missing on disk');
  });

  test('assessMergeRisk handles structure-based merge type', () => {
    const candidate = { mergeType: 'structure-based' };
    const snapshots = [{ exists: true, validJson: true }];
    const result = assessMergeRisk(candidate, snapshots, []);
    expect(result.level).toBe('medium');
    expect(result.factors).toContain('Shared JSON schema — content may differ');
  });

  test('buildMergePreview throws when no files provided', async () => {
    await expect(buildMergePreview({ projectRoot: '/tmp', candidate: { files: [] } })).rejects.toThrow(/at least one file/);
  });
});
