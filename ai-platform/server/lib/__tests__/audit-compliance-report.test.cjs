'use strict';

/**
 * Tests for Compliance Report Exporter (user-authored variant).
 *
 * Validates generateComplianceReport() and complianceReportToCsv()
 * produce correctly structured output with caller-org-first ordering
 * and deterministic CSV section markers.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert').strict;
const auditLogger = require('../audit-logger.cjs');

describe('Audit Compliance Report Exporter Suite', () => {
  const mockOrgId = 'org-compliance-attestation';

  it('should generate a valid hierarchical compliance report payload', () => {
    const report = auditLogger.generateComplianceReport(mockOrgId, ['SOC 2', 'GDPR']);

    assert.strictEqual(typeof report.reportId, 'string');
    assert.ok(report.reportId.startsWith('rep_'));
    assert.ok(Array.isArray(report.frameworks));
    assert.deepStrictEqual(report.frameworks, ['SOC 2', 'GDPR']);
    assert.ok(report.global && typeof report.global === 'object');
    assert.ok(Array.isArray(report.orgs));
  });

  it('should isolate cross-tenant profiles while keeping caller context first', () => {
    const report = auditLogger.generateComplianceReport(mockOrgId);

    assert.ok(report.orgs.length >= 1);
    assert.strictEqual(report.orgs[0].orgId, mockOrgId, 'Primary index must match caller org context');
    assert.ok('chainIntegrity' in report.orgs[0]);
    assert.ok('retentionPolicy' in report.orgs[0]);
  });

  it('should compile flat multi-sectional CSV envelopes deterministically', () => {
    const report = auditLogger.generateComplianceReport(mockOrgId);
    const csv = auditLogger.complianceReportToCsv(report);

    assert.strictEqual(typeof csv, 'string');
    assert.ok(csv.includes('SimpleBeacon Compliance Proof Bundle'), 'Missing bundle header metadata');
    assert.ok(csv.includes('SECTION 1: GLOBAL PLATFORM SECURITY CONTROLS'), 'Missing control break markers');
    assert.ok(csv.includes('SECTION 2: MULTI-TENANT CRYPTOGRAPHIC ATTESTATION MATRIX'), 'Missing attestation headers');
  });
});
