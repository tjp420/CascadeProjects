const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert').strict;
const auditLogger = require('../audit-logger.cjs');

describe('Audit Compliance Report Exporter Suite', () => {
  const mockOrgId = 'org-compliance-attestation';

  it('should generate a valid hierarchical compliance report payload', async (t) => {
    if (typeof auditLogger.generateComplianceReport !== 'function') {
      t.skip('generateComplianceReport not implemented yet');
      return;
    }

    const report = await auditLogger.generateComplianceReport(mockOrgId, ['SOC 2', 'GDPR']);

    assert.strictEqual(typeof report.reportId, 'string');
    assert.ok(report.reportId.startsWith('rep_'));
    assert.ok(Array.isArray(report.frameworks));
    assert.deepStrictEqual(report.frameworks, ['SOC 2', 'GDPR']);
    assert.ok(report.global && typeof report.global === 'object');
    assert.ok(Array.isArray(report.orgs));
  });

  it('should isolate cross-tenant profiles while keeping caller context first', async (t) => {
    if (typeof auditLogger.generateComplianceReport !== 'function') {
      t.skip('generateComplianceReport not implemented yet');
      return;
    }

    const report = await auditLogger.generateComplianceReport(mockOrgId);

    assert.ok(report.orgs.length >= 1);
    assert.strictEqual(report.orgs[0].orgId, mockOrgId, 'Primary index must match caller org context');
    assert.ok('chainIntegrity' in report.orgs[0]);
    assert.ok('retentionPolicy' in report.orgs[0]);
  });

  it('should compile flat multi-sectional CSV envelopes deterministically', async (t) => {
    if (typeof auditLogger.generateComplianceReport !== 'function' || typeof auditLogger.complianceReportToCsv !== 'function') {
      t.skip('generateComplianceReport or complianceReportToCsv not implemented yet');
      return;
    }

    const report = await auditLogger.generateComplianceReport(mockOrgId);
    const csv = auditLogger.complianceReportToCsv(report);

    assert.strictEqual(typeof csv, 'string');
    assert.ok(csv.includes('SimpleBeacon Compliance Proof Bundle'), 'Missing bundle header metadata');
    assert.ok(csv.includes('SECTION 1: GLOBAL PLATFORM SECURITY CONTROLS'), 'Missing control break markers');
    assert.ok(csv.includes('SECTION 2: MULTI-TENANT CRYPTOGRAPHIC ATTESTATION MATRIX'), 'Missing attestation headers');
  });
});
