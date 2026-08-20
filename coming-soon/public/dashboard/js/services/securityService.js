// simplebeacon-ignore documentation
/** Security findings extracted from live Simplebeacon report (credential + production-leak rules). */

export const SECURITY_ISSUE_PATTERN = /credential|production leak/i;

/**
 * Is security issue.
 * @param {boolean} issue
 * @returns {any}
 */
export function isSecurityIssue(issue) {
    return SECURITY_ISSUE_PATTERN.test(String(issue?.type || ''));
}

/**
 * Normalize security finding.
 * @param {boolean} issue
 * @param {number} index
 * @returns {any}
 */
export function normalizeSecurityFinding(issue, index = 0) {
    const filePath =
        issue.filePath ||
        issue.filePaths?.[0] ||
        issue.metadata?.duplicatePaths?.[0] ||
        issue.affectedFiles?.[0] ||
        null;

    return {
        id: issue.id || `${issue.severity}|${issue.type}|${index}`,
        severity: issue.severity || issue.severityBand || 'medium',
        type: issue.type || 'Unknown',
        file: filePath,
        description: issue.description || '',
        recommendation: issue.recommendedAction || issue.recommendation || 'Review and remediate before merge',
        count: issue.count ?? 1
    };
}

/**
 * Extract security findings.
 * @param {number} report
 * @returns {any}
 */
export function extractSecurityFindings(report) {
    const raw = report?.rawIssues ?? report?.detectedIssues ?? [];
    return raw.filter(isSecurityIssue).map((issue, index) => normalizeSecurityFinding(issue, index));
}

/**
 * Build security summary.
 * @param {number} report
 * @param {Array} findings
 * @returns {any}
 */
export function buildSecuritySummary(report, findings = []) {
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const finding of findings) {
        const band = String(finding.severity || 'medium').toLowerCase();
        const increment = finding.count ?? 1;
        if (band === 'critical') severityCounts.critical += increment;
        else if (band === 'high') severityCounts.high += increment;
        else if (band === 'medium') severityCounts.medium += increment;
        else severityCounts.low += increment;
    }

    const credentialFindings =
        report?.credentialFindings ??
        findings.filter(f => /credential/i.test(f.type)).reduce((sum, f) => sum + (f.count ?? 1), 0);
    const productionLeakFindings =
        report?.productionLeakFindings ??
        findings.filter(f => /production leak/i.test(f.type)).reduce((sum, f) => sum + (f.count ?? 1), 0);

    return {
        credentialScanned: report?.credentialScanned ?? null,
        credentialFindings,
        productionLeakScanned: report?.productionLeakScanned ?? null,
        productionLeakFindings,
        totalFindings: findings.reduce((sum, f) => sum + (f.count ?? 1), 0),
        severityCounts,
        gatePass: report?.gate?.pass ?? null,
        generatedAt: report?.generatedAt ?? null
    };
}

/**
 * Build security export payload.
 * @param {number} report
 * @param {Array} findings
 * @param {any} compliance
 * @returns {any}
 */
export function buildSecurityExportPayload(report, findings, compliance = null) {
    return {
        type: 'simplebeacon-security-scan-export',
        exportedAt: new Date().toISOString(),
        summary: buildSecuritySummary(report, findings),
        compliance: compliance
            ? {
                  securityScore: compliance.securityScore ?? null,
                  gatePass: compliance.gatePass ?? null,
                  optimizationCompliance: compliance.optimizationCompliance ?? null
              }
            : null,
        findings
    };
}

/**
 * Fetch compliance headline.
 * @returns {any}
 */
export async function fetchComplianceHeadline() {
    const complianceHttpResponse = await fetch('/api/optimization/compliance', {
        headers: { Accept: 'application/json' }
    });
    if (!complianceHttpResponse.ok) {
        throw new Error('Compliance API unavailable');
    }
    const complianceHeadline = await complianceHttpResponse.json();
    return complianceHeadline.success === false ? null : complianceHeadline;
}
