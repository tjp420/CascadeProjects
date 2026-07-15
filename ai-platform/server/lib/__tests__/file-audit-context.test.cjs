'use strict';

const {
  normalizeAuditPath,
  resolveFileAuditContext,
  shouldIncludeFinding,
  adjustFindingSeverity,
  applyContextToFindings
} = require('../file-audit-context.cjs');

describe('file-audit-context', () => {
  test('exports expected functions', () => {
    expect(typeof normalizeAuditPath).toBe('function');
    expect(typeof resolveFileAuditContext).toBe('function');
    expect(typeof shouldIncludeFinding).toBe('function');
    expect(typeof adjustFindingSeverity).toBe('function');
    expect(typeof applyContextToFindings).toBe('function');
  });

  test('normalizeAuditPath strips ai-platform prefix', () => {
    expect(normalizeAuditPath('ai-platform/server/lib/index.js')).toBe('server/lib/index.js');
  });

  test('normalizeAuditPath normalizes backslashes', () => {
    expect(normalizeAuditPath('src\\lib\\file.js')).toBe('src/lib/file.js');
  });

  test('normalizeAuditPath handles empty input', () => {
    expect(normalizeAuditPath('')).toBe('');
  });

  test('resolveFileAuditContext classifies test files', () => {
    const ctx = resolveFileAuditContext('src/__tests__/file.test.js');
    expect(ctx.isTestFile).toBe(true);
  });

  test('resolveFileAuditContext classifies production files', () => {
    const ctx = resolveFileAuditContext('server/lib/index.js');
    expect(ctx.isProduction).toBe(true);
  });

  test('resolveFileAuditContext classifies doc files', () => {
    const ctx = resolveFileAuditContext('docs/readme.md');
    expect(ctx.isDocumentation).toBe(true);
  });

  test('resolveFileAuditContext classifies example files', () => {
    const ctx = resolveFileAuditContext('examples/demo.js');
    expect(ctx.isExampleFile).toBe(true);
  });

  test('shouldIncludeFinding returns boolean', () => {
    const ctx = resolveFileAuditContext('server/lib/index.js');
    expect(typeof shouldIncludeFinding({}, ctx)).toBe('boolean');
  });

  test('adjustFindingSeverity returns finding object', () => {
    const ctx = resolveFileAuditContext('server/lib/index.js');
    const finding = { severity: 'high', type: 'test' };
    const result = adjustFindingSeverity(finding, ctx);
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('severity');
  });

  test('applyContextToFindings returns array', () => {
    const findings = [{ severity: 'high', type: 'test' }];
    const result = applyContextToFindings(findings, 'server/lib/index.js');
    expect(Array.isArray(result)).toBe(true);
  });
});
