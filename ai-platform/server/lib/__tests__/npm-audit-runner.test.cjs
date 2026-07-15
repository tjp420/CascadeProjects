'use strict';

const {
  parseNpmAuditJson,
  runNpmAudit,
  runNpmAuditAsync,
  clearNpmAuditCache
} = require('../npm-audit-runner.cjs');

describe('npm-audit-runner', () => {
  test('exports expected functions', () => {
    expect(typeof parseNpmAuditJson).toBe('function');
    expect(typeof runNpmAudit).toBe('function');
    expect(typeof runNpmAuditAsync).toBe('function');
    expect(typeof clearNpmAuditCache).toBe('function');
  });

  test('parseNpmAuditJson parses a valid audit report', () => {
    const raw = {
      auditReportVersion: 2,
      metadata: {
        vulnerabilities: { total: 2, high: 1, low: 1 },
        dependencies: { prod: 10, dev: 5, total: 15 }
      },
      vulnerabilities: {
        'lodash': {
          severity: 'high',
          via: [{ title: 'Prototype Pollution', url: 'https://example.com/CVE-1234', severity: 'high' }],
          fixAvailable: true,
          isDirect: false
        },
        'minimist': {
          severity: 'low',
          via: [{ title: 'Prototype Pollution', severity: 'low' }],
          fixAvailable: false,
          isDirect: true
        }
      }
    };
    const result = parseNpmAuditJson(raw);
    expect(result.auditReportVersion).toBe(2);
    expect(result.vulnerabilities).toHaveLength(2);
    expect(result.vulnerabilities[0].severity).toBe('high');
    expect(result.vulnerabilities[0].component).toBe('lodash');
    expect(result.vulnerabilities[0].fixAvailable).toBe(true);
    expect(result.vulnerabilities[1].severity).toBe('low');
    expect(result.summary.total).toBe(2);
    expect(result.dependencies.total).toBe(15);
  });

  test('parseNpmAuditJson handles empty vulnerabilities', () => {
    const result = parseNpmAuditJson({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 }, dependencies: {} } });
    expect(result.vulnerabilities).toEqual([]);
    expect(result.summary.total).toBe(0);
  });

  test('parseNpmAuditJson handles string input', () => {
    const raw = JSON.stringify({
      metadata: { vulnerabilities: { total: 1 }, dependencies: { prod: 1 } },
      vulnerabilities: { 'pkg': { severity: 'critical', via: [{}] } }
    });
    const result = parseNpmAuditJson(raw);
    expect(result.vulnerabilities).toHaveLength(1);
    expect(result.vulnerabilities[0].severity).toBe('critical');
  });

  test('parseNpmAuditJson sorts by severity (critical first)', () => {
    const raw = {
      metadata: { vulnerabilities: {}, dependencies: {} },
      vulnerabilities: {
        'low-pkg': { severity: 'low', via: [{}] },
        'critical-pkg': { severity: 'critical', via: [{}] },
        'high-pkg': { severity: 'high', via: [{}] }
      }
    };
    const result = parseNpmAuditJson(raw);
    expect(result.vulnerabilities[0].severity).toBe('critical');
    expect(result.vulnerabilities[1].severity).toBe('high');
    expect(result.vulnerabilities[2].severity).toBe('low');
  });

  test('clearNpmAuditCache does not throw', () => {
    expect(() => clearNpmAuditCache()).not.toThrow();
  });
});
