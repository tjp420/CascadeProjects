/**
 * Certificate generator service — builds HTML certificates and ZIP archives from scan reports.
 */

'use strict';

const crypto = require('crypto');

/** Escape HTML special characters to prevent XSS. */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** Deep-merge objects without prototype pollution. */
function safeMerge(target, ...sources) {
    const result = { ...target };
    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const key of Object.keys(src)) {
            if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
                result[key] = src[key];
            }
        }
    }
    return result;
}

/**
 * Normalize a scan report JSON into a consistent structure for certificate generation.
 */
function normalizeReport(reportJson) {
    if (!reportJson || typeof reportJson !== 'object') return {};
    const type = reportJson.type || '';

    const safeKeys = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const out = {};
        for (const key of Object.keys(obj)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            out[key] = obj[key];
        }
        return out;
    };

    const sub = reportJson?.results?.simplebeacon;
    if (sub && typeof sub === 'object') {
        const nested = sub.results?.simplebeacon;
        if (nested && typeof nested === 'object') {
            const issues = nested.detectedIssues || sub.detectedIssues || reportJson.detectedIssues || [];
            return { ...safeKeys(reportJson), ...safeKeys(sub), ...safeKeys(nested), detectedIssues: issues, issueCount: nested.issueCount ?? sub.issueCount ?? reportJson.issueCount ?? issues.length };
        }
        const issues = sub.detectedIssues || reportJson.detectedIssues || [];
        return { ...safeKeys(reportJson), ...safeKeys(sub), detectedIssues: issues, issueCount: sub.issueCount ?? reportJson.issueCount ?? issues.length };
    }

    if (type === 'simplebeacon-public-summary') {
        const summary = reportJson.summary || {};
        return {
            ...reportJson,
            gate: {
                pass: summary.gatePass ?? null,
                blockingCount: (reportJson.severityCounts?.critical || 0) + (reportJson.severityCounts?.high || 0),
                warningCount: (reportJson.severityCounts?.medium || 0) + (reportJson.severityCounts?.low || 0)
            },
            qualityScore: summary.qualityScore ?? 0,
            totalFiles: summary.filesScanned ?? 0,
            issueCount: summary.totalIssuesFound ?? 0,
            detectedIssues: []
        };
    }

    if (type === 'simplebeacon-re-attestation-note') {
        const isReference = reportJson.workflowStatus === 'reference-only' || reportJson.currentGate === null;
        const cg = reportJson.currentGate || {};
        return {
            ...reportJson,
            gate: {
                pass: isReference ? null : (cg.pass ?? false),
                blockingCount: isReference ? null : (cg.blockingCount ?? 0),
                warningCount: 0
            },
            isReferenceTemplate: isReference,
            qualityScore: cg.qualityScore ?? 0,
            totalFiles: cg.repositoryFilesTotal ?? 0,
            issueCount: 0,
            detectedIssues: []
        };
    }

    if (type === 'simplebeacon-npm-audit') {
        const h = reportJson.hygieneSummary || {};
        const pkgCount = reportJson.packageJsonCount ?? 0;
        const depCount = reportJson.dependencyCount ?? 0;
        const critical = h.critical || 0;
        const high = h.high || 0;
        const moderate = h.moderate || 0;
        const low = h.low || 0;
        return {
            ...reportJson,
            gate: {
                pass: h.gatePass ?? true,
                blockingCount: critical + high,
                warningCount: moderate + low
            },
            qualityScore: h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2)),
            totalFiles: pkgCount,
            issueCount: critical + high + moderate + low,
            detectedIssues: [],
            npmAudit: {
                packageJsonCount: pkgCount,
                dependencyCount: depCount,
                summary: `${pkgCount} package.json files found with ${depCount} total dependencies.`,
                supplyChainStatus: reportJson.supplyChainStatus || 'not-applicable'
            }
        };
    }

    if (!reportJson.gate) {
        if (reportJson.packageJsonCount !== undefined || reportJson.dependencyCount !== undefined) {
            const pkgCount = reportJson.packageJsonCount ?? 0;
            const depCount = reportJson.dependencyCount ?? 0;
            const h = reportJson.hygieneSummary || {};
            const critical = h.critical || 0;
            const high = h.high || 0;
            const moderate = h.moderate || 0;
            const low = h.low || 0;
            return {
                ...reportJson,
                gate: {
                    pass: h.gatePass ?? true,
                    blockingCount: critical + high,
                    warningCount: moderate + low
                },
                qualityScore: h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2)),
                totalFiles: pkgCount,
                issueCount: critical + high + moderate + low,
                detectedIssues: [],
                npmAudit: {
                    packageJsonCount: pkgCount,
                    dependencyCount: depCount,
                    summary: `${pkgCount} package.json files found with ${depCount} total dependencies.`,
                    supplyChainStatus: reportJson.supplyChainStatus || 'not-applicable'
                }
            };
        }
    }

    return reportJson;
}

function getTierConfig(tier) {
    const configs = {
        euai: { label: 'EU AI Act Sprint', kicker: 'SimpleBeacon · EU AI Act Readiness', subtitle: 'EU AI Act compliance deliverable — Article 52, 10, and 13 readiness assessment.', badge: 'EU AI ACT', badgeClass: 'badge-gold' },
        executive: { label: 'Executive Risk Certificate', kicker: 'SimpleBeacon · Executive Risk Certificate', subtitle: 'Executive clearance — pre-launch security gate attestation.', badge: 'EXECUTIVE', badgeClass: 'badge-gold' },
        instant: { label: 'Instant Report', kicker: 'SimpleBeacon · Instant Report', subtitle: 'Rapid security snapshot — ideal for one-time audits and pre-release checks.', badge: 'INSTANT', badgeClass: 'badge-blue' },
        free: { label: 'Community Audit', kicker: 'SimpleBeacon · Community Audit', subtitle: 'Free community audit — AI slop and hygiene scan with public summary.', badge: 'COMMUNITY', badgeClass: 'badge-green' },
        default: { label: 'Security Audit', kicker: 'SimpleBeacon · Security Audit', subtitle: 'Static source code analysis and security hygiene review.', badge: 'AUDIT', badgeClass: 'badge-blue' }
    };
    return configs[tier] || configs[tier?.replace('_', '')] || configs.default;
}

function buildModuleHtml(title, icon, data, projectName) {
    const safeTitle = escapeHtml(title);
    const safeIcon = escapeHtml(icon);
    const safeProject = escapeHtml(projectName);
    const rows = Object.entries(data || {}).map(([key, val]) => {
        const safeKey = escapeHtml(key);
        if (Array.isArray(val)) {
            if (val.length === 0) return `<tr><td>${safeKey}</td><td><em>None found</em></td></tr>`;
            const items = val.slice(0, 10).map(v => typeof v === 'string' ? `<li>${escapeHtml(v)}</li>` : `<li><code>${escapeHtml(JSON.stringify(v).slice(0, 120))}</code></li>`).join('');
            return `<tr><td>${safeKey}</td><td><ul style="margin:0;padding-left:18px;">${items}${val.length > 10 ? `<li><em>...and ${val.length - 10} more</em></li>` : ''}</ul></td></tr>`;
        }
        if (typeof val === 'object' && val !== null) {
            const jsonStr = JSON.stringify(val, null, 2);
            return `<tr><td>${safeKey}</td><td><code style="font-size:0.8rem;">${escapeHtml(jsonStr.slice(0, 300))}${jsonStr.length > 300 ? '...' : ''}</code></td></tr>`;
        }
        return `<tr><td>${safeKey}</td><td><strong>${escapeHtml(val)}</strong></td></tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safeTitle} — ${safeProject}</title>
<style>
body { font-family: Inter, system-ui, -apple-system, sans-serif; background: #0B0F19; color: #E2E8F0; max-width: 900px; margin: 0 auto; padding: 40px 24px; }
h1 { font-size: 1.5rem; margin-bottom: 8px; color: #F1F5F9; }
.meta { color: #94A3B8; font-size: 0.85rem; margin-bottom: 24px; }
table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.4); border: 1px solid #1E293B; }
th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #1E293B; }
th { background: #0F172A; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: #60A5FA; }
td { font-size: 0.9rem; vertical-align: top; color: #E2E8F0; }
tr:last-child td { border-bottom: none; }
ul { margin: 0; color: #CBD5E1; }
em { color: #94A3B8; }
code { background: #1E293B; color: #60A5FA; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #1E293B; font-size: 0.75rem; color: #64748B; }
@media print { body { background: #fff; color: #1e293b; padding: 0; } table { background: #fff; border: 1px solid #e2e8f0; } th { background: #f1f5f9; color: #1e293b; } td { color: #1e293b; } code { background: #f1f5f9; color: #2563EB; } }
</style>
</head>
<body>
<h1>${safeIcon} ${safeTitle}</h1>
<p class="meta">Project: <strong>${safeProject}</strong> · Generated by SimpleBeacon</p>
<table>
${rows || '<tr><td colspan="2"><em>No data available for this module.</em></td></tr>'}
</table>
<div class="footer">Print this page (Ctrl+P / Cmd+P) → Destination: Save as PDF</div>
</body>
</html>`;
}

module.exports = {
    escapeHtml,
    normalizeReport,
    getTierConfig,
    buildModuleHtml,
    safeMerge
};
