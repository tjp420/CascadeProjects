const fs = require('fs');
const path = require('path');

const SECURITY_SERVICE = path.join(
  __dirname,
  '../../web/simplebeacon-dashboard/js/services/securityService.js'
);
const SECURITY_VIEW = path.join(
  __dirname,
  '../../web/simplebeacon-dashboard/js/views/SecurityView.js'
);

describe('securityService finding extraction', () => {
  let source;

  beforeAll(() => {
    source = fs.readFileSync(SECURITY_SERVICE, 'utf8');
  });

  test('filters credential and production leak issue types', () => {
    expect(source).toContain('SECURITY_ISSUE_PATTERN');
    expect(source).toMatch(/credential\|production leak/i);
    expect(source).toContain('extractSecurityFindings');
  });

  test('normalizes file path and recommendation fields', () => {
    expect(source).toContain('normalizeSecurityFinding');
    expect(source).toContain('recommendedAction');
    expect(source).toContain('recommendation');
  });

  test('builds export payload with summary and findings', () => {
    expect(source).toContain('buildSecurityExportPayload');
    expect(source).toContain('simplebeacon-security-scan-export');
  });
});

describe('SecurityView scan handler wiring', () => {
  let viewSource;

  beforeAll(() => {
    viewSource = fs.readFileSync(SECURITY_VIEW, 'utf8');
  });

  test('run scan delegates to app.runScan (POST /api/simplebeacon/scan)', () => {
    expect(viewSource).toContain('runScan');
    expect(viewSource).toContain('this.app.runScan()');
  });

  test('loads live report via scanService.fetchReport', () => {
    expect(viewSource).toContain('fetchReport');
    expect(viewSource).not.toContain('/api/security/overview');
  });

  test('shows loading state and export JSON action', () => {
    expect(viewSource).toContain('scanning');
    expect(viewSource).toContain('loading-spinner');
    expect(viewSource).toContain('security-export-json');
    expect(viewSource).toContain('buildSecurityExportPayload');
  });

  test('uses compliance API for headline metrics only', () => {
    const serviceSource = fs.readFileSync(SECURITY_SERVICE, 'utf8');
    expect(viewSource).toContain('fetchComplianceHeadline');
    expect(serviceSource).toContain('/api/optimization/compliance');
  });
});

describe('securityService pure logic (evaluated)', () => {
  const moduleSource = fs.readFileSync(SECURITY_SERVICE, 'utf8');

  function loadExports() {
    const stripped = moduleSource
      .replace(/^export /gm, '')
      .replace(/^import .*$/gm, '');
    const fn = new Function(`${stripped}; return { isSecurityIssue, extractSecurityFindings, buildSecuritySummary };`);
    return fn();
  }

  test('extractSecurityFindings returns only security rule hits', () => {
    const { extractSecurityFindings } = loadExports();
    const report = {
      rawIssues: [
        { type: 'Credential Pattern', severity: 'high', filePath: 'web/data/x.json', recommendedAction: 'Rotate key' },
        { type: 'Production Leak', severity: 'medium', filePath: 'server/index.js', recommendedAction: 'Move to sample' },
        { type: 'Fictional KPI', severity: 'medium', filePath: 'web/data/y.json' }
      ]
    };
    const findings = extractSecurityFindings(report);
    expect(findings).toHaveLength(2);
    expect(findings[0].type).toBe('Credential Pattern');
    expect(findings[0].recommendation).toBe('Rotate key');
    expect(findings[1].type).toBe('Production Leak');
  });

  test('buildSecuritySummary counts severity bands', () => {
    const { buildSecuritySummary } = loadExports();
    const summary = buildSecuritySummary(
      { credentialScanned: 10, productionLeakScanned: 8, gate: { pass: false } },
      [
        { severity: 'high', count: 2, type: 'Credential Pattern' },
        { severity: 'medium', count: 1, type: 'Production Leak' }
      ]
    );
    expect(summary.severityCounts.high).toBe(2);
    expect(summary.severityCounts.medium).toBe(1);
    expect(summary.totalFindings).toBe(3);
    expect(summary.gatePass).toBe(false);
  });
});
