/**
 * Certificate generation utilities — pure functions for building HTML certificates and reports.
 */

const crypto = require('crypto');

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeMerge(target, ...sources) {
    const result = Object.create(null);
    for (const key of Object.keys(target || {})) {
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            result[key] = target[key];
        }
    }
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

function normalizeReport(reportJson) {
    if (!reportJson || typeof reportJson !== 'object') return {};
    const type = reportJson.type || '';

    // 1. Complete-scan wrapper: pull the simplebeacon sub-report up
    const sub = reportJson?.results?.simplebeacon;
    if (sub && typeof sub === 'object') {
        const nested = sub.results?.simplebeacon;
        if (nested && typeof nested === 'object') {
            const issues = nested.detectedIssues || sub.detectedIssues || reportJson.detectedIssues || [];
            return { ...safeMerge(reportJson), ...safeMerge(sub), ...safeMerge(nested), detectedIssues: issues, issueCount: nested.issueCount ?? sub.issueCount ?? reportJson.issueCount ?? issues.length };
        }
        const issues = sub.detectedIssues || reportJson.detectedIssues || [];
        return { ...safeMerge(reportJson), ...safeMerge(sub), detectedIssues: issues, issueCount: sub.issueCount ?? reportJson.issueCount ?? issues.length };
    }

    // 2. Public-summary: synthesize gate and detectedIssues from summary/severityCounts
    if (type === 'simplebeacon-public-summary') {
        const s = reportJson.summary || {};
        const sc = reportJson.severityCounts || {};
        const detectedIssues = [];
        ['critical', 'high', 'medium', 'low'].forEach(sev => {
            const count = sc[sev] || 0;
            for (let i = 0; i < Math.min(count, 5); i++) {
                detectedIssues.push({ severity: sev, filePath: '—', rule: 'Aggregated from summary', impact: 'See detailed report for file-level findings.', fix: 'Run complete scan for remediation steps.' });
            }
        });
        return {
            ...reportJson,
            gate: { pass: s.gatePass ?? true, blockingCount: (sc.critical || 0) + (sc.high || 0), warningCount: (sc.medium || 0) + (sc.low || 0) },
            qualityScore: s.qualityScore ?? 100,
            totalFiles: s.filesScanned || s.gateRepositoryFilesTotal || 0,
            issueCount: detectedIssues.length,
            detectedIssues,
            summary: s
        };
    }

    // 3. Hygiene summary (complete scan wrapper)
    if (type === 'simplebeacon-hygiene-summary') {
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

    // 5. Generic synthesis for partial/standalone module reports
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

        const debugCount = reportJson.debugArtifactCount || 0;
        const mockCount = reportJson.mockSampleFiles || 0;
        const credHits = reportJson.credentialFindings || 0;
        const totalIssues = debugCount + mockCount + credHits + (reportJson.issueCount || 0);
        return {
            ...reportJson,
            gate: {
                pass: credHits === 0,
                blockingCount: credHits,
                warningCount: totalIssues - credHits
            },
            qualityScore: reportJson.qualityScore ?? (totalIssues === 0 ? 100 : Math.max(0, 100 - totalIssues * 2)),
            totalFiles: reportJson.totalFiles ?? reportJson.filesAnalyzed ?? 0,
            issueCount: totalIssues,
            detectedIssues: reportJson.detectedIssues || []
        };
    }

    // 6. Direct simplebeacon-report
    return reportJson;
}

function getTierConfig(tier) {
    const configs = {
        euai: { label: 'EU AI Act Sprint', kicker: 'SimpleBeacon · EU AI Act Readiness', subtitle: 'EU AI Act compliance deliverable — Article 52, 10, and 13 readiness assessment.', badge: 'EU AI ACT', badgeClass: 'badge-gold' },
        executive: { label: 'Executive Risk Certificate', kicker: 'SimpleBeacon · Executive Risk Certificate', subtitle: 'Executive clearance — pre-launch security gate attestation.', badge: 'EXECUTIVE', badgeClass: 'badge-gold' },
        instant: { label: 'Instant Code Hygiene Report', kicker: 'SimpleBeacon · Instant Code Hygiene Report', subtitle: 'Quick-turn security snapshot — lightweight gate scan with credential, mock data, and AI pattern detection.', badge: 'INSTANT', badgeClass: 'badge-pass' },
        community: { label: 'AI Slop Audit', kicker: 'SimpleBeacon · Community Audit', subtitle: 'Complimentary AI slop and leak detection — open source, unlimited scans.', badge: 'COMMUNITY', badgeClass: 'badge-pass' },
        agency: { label: 'Agency License', kicker: 'SimpleBeacon · Agency Partner Certificate', subtitle: 'Agency partner deliverable — white-label security attestation.', badge: 'AGENCY', badgeClass: 'badge-gold' },
        universal: { label: 'Operator License', kicker: 'SimpleBeacon · Operator Vault Certificate', subtitle: 'Operator vault — full platform access with all engines.', badge: 'OPERATOR', badgeClass: 'badge-gold' }
    };
    return configs[tier] || configs.executive;
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
    buildModuleHtml
};
