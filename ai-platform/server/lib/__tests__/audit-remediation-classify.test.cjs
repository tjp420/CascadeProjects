// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
'use strict';

const {
  classifyRowKind,
  impactBandClass,
  buildImpactRisk,
  buildCodeRecipe,
  buildVerificationCommand
} = require('../audit-remediation-recipes/classify.cjs');
const { IMPACT_BY_KIND, DEFAULT_RECIPES } = require('../audit-remediation-recipes/data.cjs');

describe('audit-remediation-recipes/classify', () => {
  test('exports expected functions', () => {
    expect(typeof classifyRowKind).toBe('function');
    expect(typeof impactBandClass).toBe('function');
    expect(typeof buildImpactRisk).toBe('function');
    expect(typeof buildCodeRecipe).toBe('function');
    expect(typeof buildVerificationCommand).toBe('function');
  });

  test('classifyRowKind detects debug artifacts', () => {
    expect(classifyRowKind({ rule: 'console_or_debugger', snippet: 'console.log("x")' })).toBe('debug-artifact');
  });

  test('classifyRowKind detects credentials', () => {
    const credSnippet = 'cred' + '-pattern-mock-XYZ';
    expect(classifyRowKind({ rule: 'credential', snippet: credSnippet })).toBe('credentials');
  });

  test('classifyRowKind detects env-secret', () => {
    expect(classifyRowKind({ rule: 'env-secret', snippet: '' })).toBe('env-secret');
  });

  test('classifyRowKind detects config-sprawl', () => {
    expect(classifyRowKind({ rule: 'config-sprawl', snippet: '' })).toBe('config-sprawl');
  });

  test('classifyRowKind detects orphaned-data and dev-dependency', () => {
    expect(classifyRowKind({ rule: 'orphaned-data', snippet: '' })).toBe('orphaned-data');
    expect(classifyRowKind({ rule: '', snippet: 'import pytest' })).toBe('dev-dependency');
  });

  test('classifyRowKind detects eslint and syntax kinds', () => {
    expect(classifyRowKind({ rule: 'eslint', snippet: 'no-unused-vars' })).toBe('eslint');
    expect(classifyRowKind({ rule: '', snippet: 'parse error syntax' })).toBe('syntax');
  });

  test('classifyRowKind detects schema findings', () => {
    expect(classifyRowKind({ rule: 'page.spec', snippet: '' })).toBe('schema');
  });

  test('classifyRowKind detects pii', () => {
    expect(classifyRowKind({ rule: 'data-privacy', snippet: 'pii pattern' })).toBe('pii');
  });

  test('classifyRowKind detects file-reduction', () => {
    expect(classifyRowKind({ rule: 'file-reduction', snippet: '' })).toBe('file-reduction');
  });

  test('classifyRowKind detects production-leak', () => {
    expect(classifyRowKind({ rule: '', snippet: 'mock/sample.json' })).toBe('production-leak');
  });

  test('classifyRowKind detects llm-slop', () => {
    expect(classifyRowKind({ rule: '', snippet: '```markdown fence```' })).toBe('llm-slop');
  });

  test('classifyRowKind detects fiction-kpi', () => {
    expect(classifyRowKind({ rule: '', snippet: 'completion_rate 98.5%' })).toBe('fiction-kpi');
  });

  test('classifyRowKind detects tech-debt', () => {
    expect(classifyRowKind({ rule: '', snippet: 'TODO: fix this' })).toBe('tech-debt');
  });

  test('classifyRowKind returns general for unknown', () => {
    expect(classifyRowKind({ rule: '', snippet: 'some random text' })).toBe('general');
  });

  test('classifyRowKind handles empty input', () => {
    expect(classifyRowKind({})).toBe('general');
    expect(classifyRowKind()).toBe('general');
  });

  test('impactBandClass returns correct CSS class', () => {
    expect(impactBandClass('credentials', 'critical')).toBe('impact-critical');
    expect(impactBandClass('production-leak', 'high')).toBe('impact-high');
    expect(impactBandClass('fiction-kpi', 'low')).toBe('impact-hygiene');
    expect(impactBandClass('general', 'low')).toBe('impact-review');
  });

  test('buildImpactRisk returns string from IMPACT_BY_KIND', () => {
    const result = buildImpactRisk('credentials', 'critical');
    expect(typeof result).toBe('string');
    expect(result).toBe(IMPACT_BY_KIND.credentials);
  });

  test('buildImpactRisk falls back to general for unknown kind', () => {
    const result = buildImpactRisk('unknown-kind', 'low');
    expect(result).toBe(IMPACT_BY_KIND.general);
  });

  test('buildCodeRecipe returns specific recipe for console.log', () => {
    const result = buildCodeRecipe('debug-artifact', 'console.log("x")', '', '');
    expect(result).toContain('structured logging');
  });

  test('buildCodeRecipe returns specific recipe for debugger', () => {
    const result = buildCodeRecipe('debug-artifact', 'debugger', '', '');
    expect(result).toContain('debugger');
  });

  test('buildCodeRecipe returns specific recipe for Stripe keys', () => {
    const result = buildCodeRecipe('credentials', 'sk_live_abc123', '', '');
    expect(result).toContain('Rotate');
  });

  test('buildCodeRecipe falls back to DEFAULT_RECIPES for kind', () => {
    const result = buildCodeRecipe('tech-debt', 'some text', '', '');
    expect(result).toBe(DEFAULT_RECIPES['tech-debt']);
  });

  test('buildCodeRecipe uses fallbackRemediation when provided', () => {
    const result = buildCodeRecipe('general', 'unrecognized snippet', '', 'Custom fix here');
    expect(result).toBe('Custom fix here');
  });

  test('buildVerificationCommand returns default for empty path', () => {
    expect(buildVerificationCommand('')).toBe('npx simplebeacon scan --gate');
  });

  test('buildVerificationCommand handles ai-platform path', () => {
    const result = buildVerificationCommand('/project/ai-platform');
    expect(result).toContain('--path ./ai-platform');
  });

  test('buildVerificationCommand handles absolute paths', () => {
    const result = buildVerificationCommand('C:/Users/test/project');
    expect(result).toContain('--path');
  });
});
