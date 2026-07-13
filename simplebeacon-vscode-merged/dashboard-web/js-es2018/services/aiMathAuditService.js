import { fetchJsonWithGuidance } from './analyzeService.js';
import { escapeHtml } from '../utils/string.js';

/**
 * Fetch AI Math Audit report for a project path.
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, report: any, projectPath: string}>}
 */
export async function fetchAiMathAudit(projectPath) {
    return fetchJsonWithGuidance('/api/analyze/ai-math-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
    }, 180_000);
}

/**
 * Slim AI Math Audit payload for ZIP / certificate export.
 * @param {any} payload
 * @returns {any}
 */
export function slimAiMathAuditForAudit(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const report = payload.report || payload;
    const summary = report.summary || {};
    return {
        type: 'ai-math-audit',
        generatedAt: report.audit_timestamp,
        source: report.source,
        summary: {
            totalFindings: summary.total_findings || 0,
            critical: summary.critical || 0,
            high: summary.high || 0,
            medium: summary.medium || 0,
            low: summary.low || 0,
        },
        thresholdsUsed: report.thresholds_used || {},
        topFindings: (report.findings || []).slice(0, 20).map((f) => ({
            severity: f.severity,
            type: f.type,
            layer: f.layer || null,
            token: f.token || null,
            detail: f.detail,
            metrics: f.metrics,
        })),
    };
}

/**
 * Build CSV export for AI Math Audit findings.
 * @param {any} payload
 * @returns {string}
 */
export function buildAiMathAuditCsv(payload) {
    const report = payload.report || payload;
    const findings = report.findings || [];
    const rows = [
        ['severity', 'type', 'layer', 'token', 'detail', 'metrics'].join(','),
        ...findings.map((f) => {
            const metrics = JSON.stringify(f.metrics || {}).replace(/"/g, '\\"');
            return [
                escapeHtml(f.severity || ''),
                escapeHtml(f.type || ''),
                escapeHtml(f.layer || ''),
                escapeHtml(f.token || ''),
                `"${escapeHtml(f.detail || '').replace(/"/g, '\\"')}"`,
                `"${metrics}"`,
            ].join(',');
        }),
    ];
    return rows.join('\n');
}
