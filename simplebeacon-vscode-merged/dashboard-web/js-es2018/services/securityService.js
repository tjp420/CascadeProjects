/** Security findings extracted from live Simplebeacon report (credential + production-leak rules). */
import { apiUrl } from '../utils.js';
export const SECURITY_ISSUE_PATTERN = /credential|production leak/i;
/**
 * Is security issue.
 * @param {boolean} issue
 * @returns {any}
 */
export function isSecurityIssue(issue) {
    return SECURITY_ISSUE_PATTERN.test(String((issue === null || issue === void 0 ? void 0 : issue.type) || ''));
}
/**
 * Normalize security finding.
 * @param {boolean} issue
 * @param {number} index
 * @returns {any}
 */
export function normalizeSecurityFinding(issue, index = 0) {
    var _a, _b, _c, _d, _e;
    const filePath = issue.filePath
        || ((_a = issue.filePaths) === null || _a === void 0 ? void 0 : _a[0])
        || ((_c = (_b = issue.metadata) === null || _b === void 0 ? void 0 : _b.duplicatePaths) === null || _c === void 0 ? void 0 : _c[0])
        || ((_d = issue.affectedFiles) === null || _d === void 0 ? void 0 : _d[0])
        || null;
    return {
        id: issue.id || `${issue.severity}|${issue.type}|${index}`,
        severity: issue.severity || issue.severityBand || 'medium',
        type: issue.type || 'Unknown',
        file: filePath,
        description: issue.description || '',
        recommendation: issue.recommendedAction || issue.recommendation || 'Review and remediate before merge',
        count: (_e = issue.count) !== null && _e !== void 0 ? _e : 1
    };
}
/**
 * Extract security findings.
 * @param {number} report
 * @returns {any}
 */
export function extractSecurityFindings(report) {
    var _a, _b;
    const raw = (_b = (_a = report === null || report === void 0 ? void 0 : report.rawIssues) !== null && _a !== void 0 ? _a : report === null || report === void 0 ? void 0 : report.detectedIssues) !== null && _b !== void 0 ? _b : [];
    return raw.filter(isSecurityIssue).map((issue, index) => normalizeSecurityFinding(issue, index));
}
/**
 * Build security summary.
 * @param {number} report
 * @param {Array} findings
 * @returns {any}
 */
export function buildSecuritySummary(report, findings = []) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const finding of findings) {
        const band = String(finding.severity || 'medium').toLowerCase();
        const increment = (_a = finding.count) !== null && _a !== void 0 ? _a : 1;
        if (band === 'critical')
            severityCounts.critical += increment;
        else if (band === 'high')
            severityCounts.high += increment;
        else if (band === 'medium')
            severityCounts.medium += increment;
        else
            severityCounts.low += increment;
    }
    const credentialFindings = (_b = report === null || report === void 0 ? void 0 : report.credentialFindings) !== null && _b !== void 0 ? _b : findings.filter((f) => /credential/i.test(f.type)).reduce((sum, f) => { var _a; return sum + ((_a = f.count) !== null && _a !== void 0 ? _a : 1); }, 0);
    const productionLeakFindings = (_c = report === null || report === void 0 ? void 0 : report.productionLeakFindings) !== null && _c !== void 0 ? _c : findings.filter((f) => /production leak/i.test(f.type)).reduce((sum, f) => { var _a; return sum + ((_a = f.count) !== null && _a !== void 0 ? _a : 1); }, 0);
    return {
        credentialScanned: (_d = report === null || report === void 0 ? void 0 : report.credentialScanned) !== null && _d !== void 0 ? _d : null,
        credentialFindings,
        productionLeakScanned: (_e = report === null || report === void 0 ? void 0 : report.productionLeakScanned) !== null && _e !== void 0 ? _e : null,
        productionLeakFindings,
        totalFindings: findings.reduce((sum, f) => { var _a; return sum + ((_a = f.count) !== null && _a !== void 0 ? _a : 1); }, 0),
        severityCounts,
        gatePass: (_g = (_f = report === null || report === void 0 ? void 0 : report.gate) === null || _f === void 0 ? void 0 : _f.pass) !== null && _g !== void 0 ? _g : null,
        generatedAt: (_h = report === null || report === void 0 ? void 0 : report.generatedAt) !== null && _h !== void 0 ? _h : null
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
    var _a, _b, _c;
    return {
        type: 'simplebeacon-security-scan-export',
        exportedAt: new Date().toISOString(),
        summary: buildSecuritySummary(report, findings),
        compliance: compliance
            ? {
                securityScore: (_a = compliance.securityScore) !== null && _a !== void 0 ? _a : null,
                gatePass: (_b = compliance.gatePass) !== null && _b !== void 0 ? _b : null,
                optimizationCompliance: (_c = compliance.optimizationCompliance) !== null && _c !== void 0 ? _c : null
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
    const complianceHttpResponse = await fetch(apiUrl('/api/optimization/compliance'), {
        headers: { Accept: 'application/json' }
    });
    if (!complianceHttpResponse.ok) {
        throw new Error('Compliance API unavailable');
    }
    const complianceHeadline = await complianceHttpResponse.json();
    return complianceHeadline.success === false ? null : complianceHeadline;
}
