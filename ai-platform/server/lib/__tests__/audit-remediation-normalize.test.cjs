'use strict';

jest.mock('../simplebeacon-proxy.cjs', () => ({
  collectIssues: jest.fn().mockReturnValue([])
}));

const {
  normalizeScanFinding,
  flattenDataQualityFindings,
  normalizeDataQualityFinding,
  extractFixInputsFromScan
} = require('../audit-remediation-recipes/normalize.cjs');

describe('audit-remediation-recipes/normalize', () => {
  test('exports expected functions', () => {
    expect(typeof normalizeScanFinding).toBe('function');
    expect(typeof flattenDataQualityFindings).toBe('function');
    expect(typeof normalizeDataQualityFinding).toBe('function');
    expect(typeof extractFixInputsFromScan).toBe('function');
  });

  test('normalizeScanFinding maps issue fields correctly', () => {
    const issue = {
      filePath: 'src/index.js',
      line: 42,
      severity: 'high',
      type: 'credential',
      description: 'Hardcoded API key',
      recommendedAction: 'Use env var'
    };
    const result = normalizeScanFinding(issue);
    expect(result.severity).toBe('high');
    expect(result.location).toBe('src/index.js:42');
    expect(result.rule).toBe('credential');
    expect(result.snippet).toBe('Hardcoded API key');
    expect(result.remediation).toBe('Use env var');
  });

  test('normalizeScanFinding handles missing fields with defaults', () => {
    const result = normalizeScanFinding({});
    expect(result.severity).toBe('medium');
    expect(result.location).toBe('—');
    expect(result.rule).toBe('finding');
  });

  test('normalizeScanFinding handles empty input', () => {
    const result = normalizeScanFinding();
    expect(result.severity).toBe('medium');
  });

  test('flattenDataQualityFindings handles allFindings array', () => {
    const data = { allFindings: [{ a: 1 }, { b: 2 }] };
    expect(flattenDataQualityFindings(data)).toHaveLength(2);
  });

  test('flattenDataQualityFindings handles grouped object', () => {
    const data = { findings: { group1: [{ a: 1 }], group2: [{ b: 2 }] } };
    expect(flattenDataQualityFindings(data)).toHaveLength(2);
  });

  test('flattenDataQualityFindings handles empty input', () => {
    expect(flattenDataQualityFindings({})).toEqual([]);
    expect(flattenDataQualityFindings()).toEqual([]);
  });

  test('normalizeDataQualityFinding maps fields correctly', () => {
    const finding = {
      path: 'data/sample.json',
      severity: 'low',
      type: 'schema',
      reason: 'Missing required key',
      action: 'Add the key'
    };
    const result = normalizeDataQualityFinding(finding);
    expect(result.severity).toBe('low');
    expect(result.location).toBe('data/sample.json');
    expect(result.rule).toBe('schema');
    expect(result.snippet).toBe('Missing required key');
    expect(result.remediation).toBe('Add the key');
    expect(result.source).toBe('Data quality scan');
  });

  test('extractFixInputsFromScan handles simplebeacon-report type', () => {
    const payload = { type: 'simplebeacon-report', gate: { pass: true } };
    const result = extractFixInputsFromScan(payload);
    expect(result.issues).toEqual([]);
    expect(result.gatePass).toBe(true);
  });

  test('extractFixInputsFromScan handles issues array', () => {
    const payload = { issues: [{ a: 1 }], gate: { pass: false } };
    const result = extractFixInputsFromScan(payload);
    expect(result.issues).toHaveLength(1);
    expect(result.gatePass).toBe(false);
  });
});
