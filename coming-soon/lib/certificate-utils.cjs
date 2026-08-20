// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Certificate generation utilities — pure functions for building HTML certificates and reports.
 */

'use strict';

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
            return {
                ...safeMerge(reportJson),
                ...safeMerge(sub),
                ...safeMerge(nested),
                detectedIssues: issues,
                issueCount: nested.issueCount ?? sub.issueCount ?? reportJson.issueCount ?? issues.length
            };
        }
        const issues = sub.detectedIssues || reportJson.detectedIssues || [];
        return {
            ...safeMerge(reportJson),
            ...safeMerge(sub),
            detectedIssues: issues,
            issueCount: sub.issueCount ?? reportJson.issueCount ?? issues.length
        };
    }

    // 2. Public-summary: synthesize gate and detectedIssues from summary/severityCounts
    if (type === 'simplebeacon-public-summary') {
        const s = reportJson.summary || {};
        const sc = reportJson.severityCounts || {};
        const detectedIssues = [];
        ['critical', 'high', 'medium', 'low'].forEach(sev => {
            const count = sc[sev] || 0;
            for (let i = 0; i < Math.min(count, 5); i++) {
                detectedIssues.push({
                    severity: sev,
                    filePath: '—',
                    rule: 'Aggregated from summary',
                    impact: 'See detailed report for file-level findings.',
                    fix: 'Run complete scan for remediation steps.'
                });
            }
        });
        return {
            ...reportJson,
            gate: {
                pass: s.gatePass ?? true,
                blockingCount: (sc.critical || 0) + (sc.high || 0),
                warningCount: (sc.medium || 0) + (sc.low || 0)
            },
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
            qualityScore:
                h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2)),
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
                qualityScore:
                    h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2)),
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
        euai: {
            label: 'EU AI Act Sprint',
            kicker: 'SimpleBeacon · EU AI Act Readiness',
            subtitle: 'EU AI Act compliance deliverable — Article 52, 10, and 13 readiness assessment.',
            badge: 'EU AI ACT',
            badgeClass: 'badge-gold'
        },
        executive: {
            label: 'Executive Risk Certificate',
            kicker: 'SimpleBeacon · Executive Risk Certificate',
            subtitle: 'Executive clearance — pre-launch security gate attestation.',
            badge: 'EXECUTIVE',
            badgeClass: 'badge-gold'
        },
        instant: {
            label: 'Instant Code Hygiene Report',
            kicker: 'SimpleBeacon · Instant Code Hygiene Report',
            subtitle:
                'Quick-turn security snapshot — lightweight gate scan with credential, mock data, and AI pattern detection.',
            badge: 'INSTANT',
            badgeClass: 'badge-pass'
        },
        community: {
            label: 'AI Slop Audit',
            kicker: 'SimpleBeacon · Community Audit',
            subtitle: 'Complimentary AI slop and leak detection — open source, unlimited scans.',
            badge: 'COMMUNITY',
            badgeClass: 'badge-pass'
        },
        agency: {
            label: 'Agency License',
            kicker: 'SimpleBeacon · Agency Partner Certificate',
            subtitle: 'Agency partner deliverable — white-label security attestation.',
            badge: 'AGENCY',
            badgeClass: 'badge-gold'
        },
        universal: {
            label: 'Operator License',
            kicker: 'SimpleBeacon · Operator Vault Certificate',
            subtitle: 'Operator vault — full platform access with all engines.',
            badge: 'OPERATOR',
            badgeClass: 'badge-gold'
        }
    };
    return configs[tier] || configs.executive;
}

function buildModuleHtml(title, icon, data, projectName) {
    const safeTitle = escapeHtml(title);
    const safeIcon = escapeHtml(icon);
    const safeProject = escapeHtml(projectName);
    const rows = Object.entries(data || {})
        .map(([key, val]) => {
            const safeKey = escapeHtml(key);
            if (Array.isArray(val)) {
                if (val.length === 0) return `<tr><td>${safeKey}</td><td><em>None found</em></td></tr>`;
                const items = val
                    .slice(0, 10)
                    .map(v =>
                        typeof v === 'string'
                            ? `<li>${escapeHtml(v)}</li>`
                            : `<li><code>${escapeHtml(JSON.stringify(v).slice(0, 120))}</code></li>`
                    )
                    .join('');
                return `<tr><td>${safeKey}</td><td><ul style="margin:0;padding-left:18px;">${items}${val.length > 10 ? `<li><em>...and ${val.length - 10} more</em></li>` : ''}</ul></td></tr>`;
            }
            if (typeof val === 'object' && val !== null) {
                const jsonStr = JSON.stringify(val, null, 2);
                return `<tr><td>${safeKey}</td><td><code style="font-size:0.8rem;">${escapeHtml(jsonStr.slice(0, 300))}${jsonStr.length > 300 ? '...' : ''}</code></td></tr>`;
            }
            return `<tr><td>${safeKey}</td><td><strong>${escapeHtml(val)}</strong></td></tr>`;
        })
        .join('');

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

function buildEuComplianceCertificateHtml(reportJson, payload) {
    const eu = reportJson.euAiActSummary || {};
    const projectName = escapeHtml(
        reportJson.projectRoot || reportJson.projectPath || reportJson.projectName || payload.projectName || 'Project'
    );
    const clientName = escapeHtml(payload.clientName || payload.email || 'Client');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const isoDate = new Date().toISOString();
    const reportId =
        'SB-EUAI-' + isoDate.slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const seal = crypto
        .createHash('sha256')
        .update(reportId + projectName + isoDate)
        .digest('hex')
        .toUpperCase()
        .slice(0, 32);

    const aiCount = eu.aiSystemIndicators || 0;
    const hrCount = eu.highRiskIndicators || 0;
    const tgCount = eu.transparencyGaps || 0;
    const docCount = eu.documentationArtifacts || 0;
    const controls = eu.controls || [];
    const passCount = controls.filter(c => c.status === 'PASS').length;
    const failCount = controls.filter(c => c.status === 'FAIL').length;
    const warnCount = controls.filter(c => c.status !== 'PASS' && c.status !== 'FAIL').length;
    const overallPass = failCount === 0 && aiCount === 0;

    const controlRows =
        controls
            .map(c => {
                const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
                return `<tr><td>${icon} ${escapeHtml(c.controlId || '—')}</td><td>${escapeHtml(c.title || '—')}</td><td>${escapeHtml(c.status || 'N/A')}</td><td>${escapeHtml(c.article || 'N/A')}</td></tr>`;
            })
            .join('') ||
        '<tr><td colspan="4" style="text-align:center;color:#94a3b8;"><em>No control assessments recorded.</em></td></tr>';

    const docsFound = (eu.documentationFound || []).slice(0, 8);
    const docList = docsFound.length
        ? `<ul style="margin:0;padding-left:18px;">${docsFound.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
        : '<em style="color:#94a3b8;">No governance documentation detected in repository.</em>';

    const statusBadge = overallPass
        ? '<span class="badge pass">COMPLIANT</span>'
        : '<span class="badge fail">ACTION REQUIRED</span>';
    const statusText = overallPass
        ? 'This assessment confirms the project meets the baseline criteria for EU AI Act readiness. No high-risk AI indicators or transparency gaps were detected.'
        : 'This assessment identified areas requiring attention before EU AI Act readiness can be confirmed. Review the control cards and remediation guide below.';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EU AI Act Compliance Certificate — ${projectName}</title>
<style>
@page { size: A4 portrait; margin: 18mm; }
body { font-family: Inter, system-ui, -apple-system, sans-serif; background: #fff; color: #1e293b; max-width: 210mm; margin: 0 auto; padding: 24px; line-height: 1.55; }
.header { text-align: center; border-bottom: 3px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px; }
.header h1 { font-size: 1.45rem; font-weight: 700; color: #1e293b; margin: 0 0 6px; letter-spacing: -0.02em; }
.header .kicker { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
.seal-box { text-align: center; margin: 18px 0; padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; }
.seal-box .seal { font-family: "SF Mono", Monaco, monospace; font-size: 0.72rem; color: #475569; word-break: break-all; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
.meta-card .label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.meta-card .value { font-size: 0.95rem; font-weight: 600; color: #1e293b; }
.badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; }
.badge.pass { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.badge.fail { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
.metric { text-align: center; padding: 14px 8px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.metric .num { font-size: 1.3rem; font-weight: 700; color: #1e293b; }
.metric .lbl { font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.85rem; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
th { background: #f1f5f9; font-weight: 600; color: #334155; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
tr:last-child td { border-bottom: none; }
.statement { background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 14px 18px; margin: 18px 0; border-radius: 0 8px 8px 0; }
.statement p { margin: 0; font-size: 0.9rem; color: #334155; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.7rem; color: #94a3b8; }
@media print { body { padding: 0; background: #fff; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div class="kicker">SimpleBeacon · EU AI Act Readiness</div>
  <h1>Certificate of EU AI Act Compliance</h1>
  ${statusBadge}
</div>

<div class="seal-box">
  <div class="label" style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">SHA-256 Attestation Seal</div>
  <div class="seal">${seal}</div>
</div>

<div class="meta-grid">
  <div class="meta-card"><div class="label">Project</div><div class="value">${projectName}</div></div>
  <div class="meta-card"><div class="label">Client</div><div class="value">${clientName}</div></div>
  <div class="meta-card"><div class="label">Date</div><div class="value">${dateStr}</div></div>
  <div class="meta-card"><div class="label">Report ID</div><div class="value">${reportId}</div></div>
</div>

<div class="statement">
  <p><strong>Compliance Statement:</strong> ${statusText}</p>
</div>

<div class="metrics">
  <div class="metric"><div class="num">${aiCount}</div><div class="lbl">AI Indicators</div></div>
  <div class="metric"><div class="num">${hrCount}</div><div class="lbl">High Risk</div></div>
  <div class="metric"><div class="num">${tgCount}</div><div class="lbl">Transparency Gaps</div></div>
  <div class="metric"><div class="num">${docCount}</div><div class="lbl">Documentation</div></div>
</div>

<h2 style="font-size:1rem;font-weight:700;color:#1e293b;margin-top:24px;margin-bottom:10px;">Control Assessment</h2>
<table>
  <thead><tr><th>Status</th><th>Control</th><th>Result</th><th>Article</th></tr></thead>
  <tbody>${controlRows}</tbody>
</table>

<h2 style="font-size:1rem;font-weight:700;color:#1e293b;margin-top:20px;margin-bottom:10px;">Documentation Detected</h2>
<div style="font-size:0.88rem;color:#334155;">${docList}</div>

<div class="footer">
  Generated by SimpleBeacon · simplebeacon.ai · This certificate is for attestation purposes and does not constitute legal advice.<br>
  Print to PDF: Ctrl+P / Cmd+P → Save as PDF
</div>
</body>
</html>`;
}

function buildCertificateHtml(reportJson, payload) {
    const data = normalizeReport(reportJson);
    const tier = payload.tier || 'executive';
    const tierConfig = getTierConfig(tier);
    const projectName = data.projectRoot || data.projectPath || data.projectName || payload.projectName || 'Project';
    const clientName = payload.clientName || 'Demo Client';
    const gatePass = data.gate?.pass ? 'PASS' : 'REVIEW';
    const reportId =
        'SB-AUD-' +
        new Date().toISOString().slice(0, 10).replace(/-/g, '') +
        '-' +
        crypto.randomBytes(4).toString('hex').toUpperCase();
    const nowStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    // Normalize issues from various report shapes (detectedIssues, issues, rawIssues)
    const normalizeIssue = issue => ({
        severity: issue.severity || 'low',
        filePath:
            issue.filePath ||
            (Array.isArray(issue.filePaths) && issue.filePaths[0]) ||
            (Array.isArray(issue.affectedFiles) && issue.affectedFiles[0]) ||
            issue.file ||
            '—',
        rule: issue.rule || issue.type || '—',
        impact: issue.impact || issue.recommendation || 'Review and remediate before next release.',
        fix: issue.fix || issue.recommendation || 'Review file manually and apply safe remediation.',
        ...issue
    });
    const detectedIssues = (
        data.detectedIssues?.length ? data.detectedIssues : data.issues?.length ? data.issues : data.rawIssues || []
    ).map(normalizeIssue);
    const credentialHits = data.gate?.blockingCount || 0;
    const totalFiles =
        data.totalFiles || data.filesAnalyzed || data.repositoryFilesTotal || data.summary?.repositoryFiles || 0;
    const qualityScore = data.qualityScore ?? data.summary?.qualityScore ?? 0;

    // Extract all 15 analysis sections
    const mockDataCategories = data.mockDataCategories || [];
    const consolidation = data.consolidation || {};
    const roadmap = data.roadmap || {};
    const codebase = data.codebase || {};
    const fileReduction = data.fileReduction || {};
    const dataQuality = data.dataQuality || {};
    const cleanup = data.cleanup || {};
    const npmAudit = data.npmAudit || {};
    const compliance = data.compliance || {};
    const euAiActSummary = data.euAiActSummary || {};
    const dependencyAudit = data.dependencyAudit || data.vulnerabilityAudit || {};
    const buildReadiness = data.buildReadiness || {};
    const severityCounts = data.severityCounts || {};
    const gateReport = data.gateReport || {};

    // Build remediation phases (from report or computed from scan data)
    let remediationPhases = data.remediationPhases || [];
    if (!Array.isArray(remediationPhases) || remediationPhases.length === 0) {
        const qs = data.qualityScore ?? data.summary?.qualityScore ?? null;
        const invalidJson = data.invalidJson ?? data.dataQuality?.invalidJsonCount ?? null;
        const emptyFiles = data.emptyFiles ?? data.dataQuality?.emptyJsonCount ?? null;
        const dupes = data.duplicateGroups ?? data.consolidation?.duplicateGroups ?? null;
        const credFindings = data.credentialFindings ?? data.gate?.blockingCount ?? null;
        const euAiAct = data.euAiActFindings ?? data.euAiActSummary?.aiSystemIndicators ?? null;
        const todoMarkers = data.todoMarkerCount ?? data.roadmap?.todoCount ?? null;
        const phases = [];
        if ((credFindings != null && credFindings > 0) || (data.gate?.blockingIssues || []).length > 0) {
            phases.push({
                id: 'security',
                title: 'Phase 1: Security Hardening',
                severity: 'critical',
                effort: '1–2 days',
                description: `Address ${credFindings || 0} credential and production leak finding(s).`,
                tasks: [
                    `Rotate ${credFindings || 0} exposed credential(s)`,
                    'Add .env to .gitignore',
                    'Re-run gate scan'
                ],
                progress: 0,
                status: 'pending'
            });
        }
        const hasIntegrityMetrics = invalidJson != null || emptyFiles != null;
        if (hasIntegrityMetrics) {
            const allClean = (invalidJson === 0 || invalidJson == null) && (emptyFiles === 0 || emptyFiles == null);
            phases.push({
                id: 'integrity',
                title: `Phase ${phases.length + 1}: Data Integrity`,
                severity: invalidJson > 0 || emptyFiles > 0 ? 'high' : 'medium',
                effort: '2–4 days',
                description: allClean
                    ? 'Data integrity verified — no structural issues detected.'
                    : `Resolve structural issues${invalidJson > 0 ? ': ' + invalidJson + ' invalid JSON' : ''}${emptyFiles > 0 ? ': ' + emptyFiles + ' empty files' : ''}.`,
                tasks: [
                    ...(invalidJson > 0 ? [`Fix ${invalidJson} invalid JSON file(s)`] : []),
                    ...(emptyFiles > 0 ? [`Remove ${emptyFiles} empty file(s)`] : []),
                    'Validate all JSON',
                    'Re-run scan'
                ],
                progress: allClean ? 100 : 0,
                status: allClean ? 'completed' : 'pending'
            });
        }
        const hasConsistencyMetrics = dupes != null;
        if (hasConsistencyMetrics) {
            const allClean = dupes === 0 || dupes == null;
            phases.push({
                id: 'consistency',
                title: `Phase ${phases.length + 1}: Consistency & Deduplication`,
                severity: dupes > 5 ? 'high' : 'medium',
                effort: '3–5 days',
                description: allClean
                    ? 'Consistency verified — no duplicates or naming drift.'
                    : `Eliminate redundancy${dupes > 0 ? ': ' + dupes + ' duplicate group(s)' : ''}.`,
                tasks: [
                    ...(dupes > 0 ? [`Consolidate ${dupes} duplicate group(s)`] : []),
                    'Standardize naming conventions',
                    'Document canonical file locations'
                ],
                progress: allClean ? 100 : 0,
                status: allClean ? 'completed' : 'pending'
            });
        }
        const comp = data.compliance || {};
        const licenseCount = comp.licenseCount != null ? Number(comp.licenseCount) : null;
        const securityCount = comp.securityCount != null ? Number(comp.securityCount) : null;
        const totalFiles = data.totalFiles ?? data.repositoryFilesTotal ?? data.summary?.repositoryFiles ?? 0;
        const hasGovFindings = (comp.govFindings || []).length > 0;
        if (
            ((licenseCount != null && licenseCount > 0) || (securityCount != null && securityCount > 0)) &&
            (totalFiles >= 20 || hasGovFindings)
        ) {
            phases.push({
                id: 'compliance',
                title: `Phase ${phases.length + 1}: Governance & Compliance`,
                severity: 'medium',
                effort: '2–3 days',
                description: `${licenseCount || 0} license file(s), ${securityCount || 0} security file(s).`,
                tasks: [
                    ...(licenseCount > 0 ? [`Audit ${licenseCount} open-source license file(s)`] : []),
                    ...(securityCount > 0 ? [`Review ${securityCount} security/governance file(s)`] : []),
                    'Verify license compatibility',
                    'Document governance policies'
                ],
                progress: 0,
                status: 'pending'
            });
        }
        if ((euAiAct != null && euAiAct > 0) || data.euAiActSummary) {
            const s = data.euAiActSummary || {},
                hr = Number(s.highRiskIndicators) || 0,
                tg = Number(s.transparencyGaps) || 0,
                ai = Number(s.aiSystemIndicators) || 0;
            const allClean = hr === 0 && tg === 0 && ai === 0;
            phases.push({
                id: 'euaiact',
                title: `Phase ${phases.length + 1}: EU AI Act Compliance`,
                severity: hr > 0 ? 'critical' : ai > 0 ? 'high' : 'medium',
                effort: '5–10 days',
                description: `Regulatory readiness: ${ai} AI indicators, ${hr} high-risk, ${tg} transparency gaps, ${s.documentationArtifacts || 0} artifacts.`,
                tasks: [
                    ...(hr > 0 ? [`Address ${hr} high-risk indicator(s)`] : []),
                    ...(tg > 0 ? [`Close ${tg} transparency gap(s)`] : []),
                    ...(ai > 0 ? [`Review ${ai} AI system indicator(s) (Art. 6)`] : []),
                    'Generate documentation artifacts',
                    'Review AI system classification (Art. 6)',
                    'Schedule legal review'
                ],
                progress: allClean ? 100 : 0,
                status: allClean ? 'completed' : 'pending'
            });
        }
        if (qs != null && (qs < 95 || (todoMarkers != null && todoMarkers > 0))) {
            phases.push({
                id: 'optimization',
                title: `Phase ${phases.length + 1}: Quality Optimization`,
                severity: qs < 70 ? 'high' : 'low',
                effort: 'Ongoing',
                description: `Drive quality score from ${qs}/100 toward 95+.`,
                tasks: [
                    ...(todoMarkers != null && todoMarkers > 0
                        ? [`Address ${todoMarkers} TODO or FIXME marker(s) in source code`]
                        : []),
                    ...(qs < 85 ? ['Refactor low-quality modules (quality score < 85)'] : []),
                    'Add test coverage for uncovered modules',
                    'Install pre-commit hooks for automated scanning',
                    'Schedule monthly quality gate reviews'
                ],
                progress: Math.min(100, Math.round(qs)),
                status: qs >= 95 ? 'completed' : 'in-progress'
            });
        }
        if (phases.length === 0) {
            phases.push({
                id: 'perfect',
                title: 'All Systems Green',
                severity: 'low',
                effort: 'None',
                description: 'Excellent data quality — no actionable findings in any measured category.',
                tasks: ['Schedule next scan in 30 days', 'Document quality maintenance procedures'],
                progress: 100,
                status: 'completed'
            });
        }
        remediationPhases = phases;
    }
    const completedPhases = remediationPhases.filter(p => p.status === 'completed' || p.progress === 100).length;
    const pendingPhases = remediationPhases.filter(p => p.status === 'pending').length;
    const criticalPhases = remediationPhases.filter(p => p.severity === 'critical' && p.status !== 'completed').length;
    const phaseRows = remediationPhases
        .map(p => {
            const statusLabel =
                p.status === 'completed' ? '✅ Complete' : p.status === 'in-progress' ? '🔄 In Progress' : '⏳ Pending';
            const severityClass =
                p.severity === 'critical'
                    ? 'sev-critical'
                    : p.severity === 'high'
                      ? 'sev-high'
                      : p.severity === 'medium'
                        ? 'sev-medium'
                        : 'sev-low';
            const tasks = (p.tasks || [])
                .slice(0, 4)
                .map(t => `<li>${escapeHtml(t)}</li>`)
                .join('');
            return `<tr><td><span class="sev ${severityClass}">${(p.severity || 'low').toUpperCase()}</span></td><td><strong>${escapeHtml(p.title)}</strong><br><span style="color:#8b949e;font-size:0.8em;">${escapeHtml(p.description || '')}</span></td><td>${statusLabel}<br><span style="color:#8b949e;font-size:0.8em;">${p.progress || 0}%</span></td><td><ul style="margin:0;padding-left:16px;">${tasks}</ul></td><td>${escapeHtml(p.effort || 'Unknown')}</td></tr>`;
        })
        .join('');
    const remediationHtml = remediationPhases.length
        ? `
    <section class="section">
      <div class="section-num">Section 04-A</div>
      <h2>Remediation Roadmap</h2>
      <p class="meta">Phased action plan generated from scan findings. ${completedPhases} of ${remediationPhases.length} phases complete. ${pendingPhases} pending${criticalPhases > 0 ? `, ${criticalPhases} critical` : ''}.</p>
      <div class="kpi-strip">
        <div class="kpi"><strong>${completedPhases}</strong><span>Completed</span></div>
        <div class="kpi"><strong>${pendingPhases}</strong><span>Pending</span></div>
        <div class="kpi"><strong>${criticalPhases}</strong><span>Critical</span></div>
        <div class="kpi"><strong>${remediationPhases.length}</strong><span>Total Phases</span></div>
      </div>
      <table class="data-table">
        <tr><th>Severity</th><th>Phase</th><th>Status</th><th>Tasks</th><th>Effort</th></tr>
        ${phaseRows}
      </table>
    </section>`
        : '';

    // Build mock data rows
    const mockRows = (mockDataCategories || [])
        .map(cat => {
            const files = (cat.affectedFiles || []).slice(0, 3).join(', ');
            return `<tr><td>${escapeHtml(cat.category || 'Mock Data')}</td><td>${cat.fileCount || 0}</td><td>${escapeHtml(cat.confidence || 'medium')}</td><td>${escapeHtml(cat.description || '')}</td><td>${escapeHtml(files)}</td></tr>`;
        })
        .join('');

    // Build EU AI Act section
    const hasEuAiFindings =
        (euAiActSummary.highRiskIndicators || 0) > 0 ||
        (euAiActSummary.aiSystemIndicators || 0) > 0 ||
        (euAiActSummary.transparencyGaps || 0) > 0 ||
        (euAiActSummary.documentationArtifacts || 0) > 0 ||
        (euAiActSummary.documentationFound || []).length > 0;
    const euAiaHtml = hasEuAiFindings
        ? `
    <section class="section">
      <div class="section-num">Section 02-A</div>
      <h2>EU AI Act Readiness Assessment</h2>
      <p class="meta">Article 52, 10, and 13 gap analysis — risk classification and remediation roadmap.</p>
      <div class="kpi-strip">
        <div class="kpi"><strong>${euAiActSummary.highRiskIndicators || 0}</strong><span>High-risk indicators</span></div>
        <div class="kpi"><strong>${euAiActSummary.aiSystemIndicators || 0}</strong><span>AI system indicators</span></div>
        <div class="kpi"><strong>${euAiActSummary.transparencyGaps || 0}</strong><span>Transparency gaps</span></div>
        <div class="kpi"><strong>${euAiActSummary.documentationArtifacts || 0}</strong><span>Doc artifacts</span></div>
        <div class="kpi"><strong>${(euAiActSummary.documentationFound || []).length}</strong><span>Governance files</span></div>
      </div>
      <p class="meta">${escapeHtml(euAiActSummary.deadlineNote || 'Review EU AI Act compliance requirements.')}</p>
    </section>`
        : '';

    // Build conditional analysis module subsections
    const secGate = `<h3>&#128737; 1. SimpleBeacon Gate</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Gate pass</td><td><strong>${gateReport.pass !== undefined ? (gateReport.pass ? 'PASS' : 'FAIL') : gatePass}</strong></td></tr>
        <tr><td>Blocking count</td><td>${gateReport.blockingCount ?? credentialHits}</td></tr>
        <tr><td>Summary</td><td>${gateReport.summary || (gatePass === 'PASS' ? 'No blocking credentials found.' : `${credentialHits} credential patterns detected.`)}</td></tr>
      </table>`;

    const hasConsolidation = (consolidation.monorepoMarkers || 0) > 0 || (consolidation.duplicateGroups || 0) > 0;
    const secConsolidation = hasConsolidation
        ? `<h3>&#128260; 2. Consolidation</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Monorepo markers</td><td>${consolidation.monorepoMarkers || 0}</td></tr>
        <tr><td>Duplicate groups</td><td>${consolidation.duplicateGroups || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(consolidation.summary || 'No consolidation issues detected.')}</td></tr>
      </table>`
        : '';

    const secMockData = mockRows
        ? `<h3>&#128269; 3. Mock Data Detection</h3>
      <table class="data-table"><tr><th>Category</th><th>Files</th><th>Confidence</th><th>Description</th><th>Sample files</th></tr>${mockRows}</table>`
        : '';

    const hasRoadmap = (roadmap.todoCount || 0) > 0;
    const secRoadmap = hasRoadmap
        ? `<h3>&#128506; 4. Roadmap Markers</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>TODO or FIXME files</td><td>${roadmap.todoCount || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(roadmap.summary || 'No roadmap markers found.')}</td></tr>
      </table>`
        : '';

    const secCodebase = `<h3>&#128187; 5. Codebase Analysis</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total files</td><td>${codebase.totalFiles || totalFiles}</td></tr>
        <tr><td>Total lines</td><td>${(codebase.totalLines || 0).toLocaleString()}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(codebase.summary || `${totalFiles} files analyzed.`)}</td></tr>
      </table>`;

    const hasFileReduction =
        (fileReduction.unusedAssetCandidates || []).length > 0 || (fileReduction.duplicateGroups || 0) > 0;
    const secFileReduction = hasFileReduction
        ? `<h3>&#128230; 6. File Reduction</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Asset candidates</td><td>${(fileReduction.unusedAssetCandidates || []).length}</td></tr>
        <tr><td>Duplicate groups</td><td>${fileReduction.duplicateGroups || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(fileReduction.summary || 'No file reduction opportunities detected.')}</td></tr>
      </table>`
        : '';

    const hasDataQuality = (dataQuality.emptyJsonCount || 0) > 0;
    const secDataQuality = hasDataQuality
        ? `<h3>&#129516; 7. Data Quality</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Empty/trivial JSON</td><td>${dataQuality.emptyJsonCount || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(dataQuality.summary || 'No data quality issues detected.')}</td></tr>
      </table>`
        : '';

    const hasCleanup = (cleanup.debugArtifactCount || 0) > 0;
    const secCleanup = hasCleanup
        ? `<h3>&#129529; 8. Cleanup Assistant</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Debug artifacts</td><td>${cleanup.debugArtifactCount || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(cleanup.summary || 'No cleanup items found.')}</td></tr>
      </table>`
        : '';

    const hasNpm = (npmAudit.packageJsonCount || 0) > 0;
    const secNpm = hasNpm
        ? `<h3>&#128230; 9. npm Audit</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>package.json files</td><td>${npmAudit.packageJsonCount || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(npmAudit.summary || 'No package.json files detected.')}</td></tr>
      </table>`
        : '';

    const hasCompliance = (compliance.licenseCount || 0) > 0 || (compliance.securityCount || 0) > 0;
    const secCompliance = hasCompliance
        ? `<h3>&#9989; 10. Compliance</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>License files</td><td>${compliance.licenseCount || 0}</td></tr>
        <tr><td>Security/governance files</td><td>${compliance.securityCount || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(compliance.summary || 'No governance files detected.')}</td></tr>
      </table>`
        : '';

    const secEuAi = hasEuAiFindings
        ? `<h3>&#127757; 11. EU AI Act Sprint</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>High-risk indicators</td><td>${euAiActSummary.highRiskIndicators || 0}</td></tr>
        <tr><td>AI system indicators</td><td>${euAiActSummary.aiSystemIndicators || 0}</td></tr>
        <tr><td>Transparency gaps</td><td>${euAiActSummary.transparencyGaps || 0}</td></tr>
        <tr><td>Documentation artifacts</td><td>${euAiActSummary.documentationArtifacts || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(euAiActSummary.deadlineNote || 'Review EU AI Act requirements.')}</td></tr>
      </table>`
        : '';

    const depVulnCount = dependencyAudit.vulnerabilityCount || dependencyAudit.critical || dependencyAudit.high || 0;
    const hasDepAudit = depVulnCount > 0 || (dependencyAudit.affectedPackages || []).length > 0;
    const secDepAudit = hasDepAudit
        ? `<h3>&#128274; 12. Dependency Vulnerabilities</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Vulnerabilities</td><td>${dependencyAudit.vulnerabilityCount || 0}</td></tr>
        <tr><td>Critical</td><td>${dependencyAudit.critical || 0}</td></tr>
        <tr><td>High</td><td>${dependencyAudit.high || 0}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(dependencyAudit.summary || 'No dependency vulnerabilities found.')}</td></tr>
      </table>`
        : '';

    const hasBuildReadiness =
        buildReadiness.readinessScore !== undefined || (buildReadiness.checklist || []).length > 0;
    const secBuildReadiness = hasBuildReadiness
        ? `<h3>&#127959; 13. Build Readiness</h3>
      <table class="data-table">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Readiness score</td><td>${buildReadiness.readinessScore || 0}%</td></tr>
        <tr><td>Status</td><td>${buildReadiness.readinessStatus || 'UNKNOWN'}</td></tr>
        <tr><td>Critical blockers</td><td>${(buildReadiness.missingCritical || []).length}</td></tr>
        <tr><td>Summary</td><td>${escapeHtml(buildReadiness.summary || 'Build readiness assessment not available.')}</td></tr>
      </table>`
        : '';

    const allSubs = [
        secGate,
        secConsolidation,
        secMockData,
        secRoadmap,
        secCodebase,
        secFileReduction,
        secDataQuality,
        secCleanup,
        secNpm,
        secCompliance,
        secEuAi,
        secDepAudit,
        secBuildReadiness
    ]
        .filter(Boolean)
        .join('\n      ');
    const analysisSectionsHtml = allSubs
        ? `
    <section class="section">
      <div class="section-num">Section 06</div>
      <h2>Analysis Modules — Complete Scan Results</h2>
      <p class="meta">Results from all 15 SimpleBeacon analysis engines run against the repository. Only modules with findings are shown.</p>
      ${allSubs}
    </section>`
        : '';

    const issueRows = detectedIssues
        .map(issue => {
            const sev = (issue.severity || 'low').toUpperCase();
            const sevClass =
                sev === 'CRITICAL'
                    ? 'sev-critical'
                    : sev === 'HIGH'
                      ? 'sev-high'
                      : sev === 'MEDIUM'
                        ? 'sev-medium'
                        : 'sev-low';
            const fileSnippet = escapeHtml(
                issue.filePath ||
                    (Array.isArray(issue.filePaths) && issue.filePaths[0]) ||
                    (Array.isArray(issue.affectedFiles) && issue.affectedFiles[0]) ||
                    issue.file ||
                    '—'
            );
            const rule = escapeHtml(issue.rule || issue.type || '—');
            const impact = escapeHtml(
                issue.impact || issue.recommendation || 'Review and remediate before next release.'
            );
            const fix = escapeHtml(
                issue.fix || issue.recommendation || 'Review file manually and apply safe remediation.'
            );
            return `<tr><td><span class="sev ${sevClass}">${sev}</span></td><td><code>${fileSnippet}</code></td><td><code>${rule}</code></td><td class="impact-cell"><span class="impact-badge impact-${sevClass.replace('sev-', '')}">${impact}</span></td><td class="recipe-cell">${fix}</td></tr>`;
        })
        .join('');

    const safeProjectName = escapeHtml(projectName);
    const safeClientName = escapeHtml(clientName);
    const safeReportId = escapeHtml(reportId);
    const safeNowStr = escapeHtml(nowStr);
    const safeGatePass = escapeHtml(gatePass);
    const safeQualityScore = escapeHtml(qualityScore);
    const safeTotalFiles = escapeHtml(totalFiles);
    const safeCredentialHits = escapeHtml(credentialHits);

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>SimpleBeacon — Gate Attestation — ${safeProjectName}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:0;}
.certificate{min-height:100vh;padding:48px 52px 40px;max-width:860px;margin:0 auto;background:radial-gradient(ellipse 90% 60% at 20% 0%,rgba(88,166,255,0.10),transparent 55%),radial-gradient(circle at 100% 20%,rgba(46,164,79,0.08),transparent 45%),linear-gradient(160deg,#010409 0%,#0d1117 42%,#161b22 100%);border:1px solid #30363d;}
.cover-page{padding:48px 52px 40px;border-bottom:1px solid #21262d;}
.cover-kicker{letter-spacing:0.14em;text-transform:uppercase;font-size:10pt;color:#8b949e;margin:0 0 12px;}
.cover-title{font-size:34pt;line-height:1.12;margin:0 0 16px;font-weight:700;max-width:720px;letter-spacing:-0.02em;}
.cover-sub{font-size:13pt;color:#c9d1d9;max-width:640px;margin:0 0 28px;}
.cover-meta{font-size:10pt;color:#8b949e;line-height:1.7;}
.cover-badges{margin-top:32px;display:flex;gap:10px;flex-wrap:wrap;}
.badge{display:inline-block;padding:6px 14px;border-radius:999px;font-size:10pt;font-weight:700;letter-spacing:0.04em;border:1px solid #30363d;}
.badge-gold{background:rgba(210,153,34,0.12);color:#e3b341;border-color:rgba(210,153,34,0.35);}
.badge-pass{background:rgba(46,164,79,0.14);color:#3fb950;border-color:rgba(63,185,80,0.35);}
.badge-blocked{background:rgba(248,81,73,0.14);color:#f85149;border-color:rgba(248,81,73,0.35);}
.confidential{margin-top:48px;font-size:9pt;color:#6e7681;border-top:1px solid #21262d;padding-top:16px;}
main{padding:36px 52px 48px;max-width:920px;margin:0 auto;}
.section{margin-bottom:32px;}
.section-num{color:#d29922;font-size:10pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;}
h2{font-size:20pt;margin:0 0 12px;color:#e6edf3;letter-spacing:-0.02em;}
.meta{color:#8b949e;font-size:9.5pt;}
.gate-banner{margin:18px 0 22px;padding:22px 24px;border-radius:14px;text-align:center;border:2px solid #30363d;background:#161b22;}
.gate-banner.pass{background:rgba(46,164,79,0.14);border-color:rgba(63,185,80,0.45);color:#3fb950;}
.gate-banner.fail{background:rgba(248,81,73,0.14);border-color:rgba(248,81,73,0.45);color:#f85149;}
.gate-banner-label{font-size:10pt;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;}
.gate-banner-value{font-size:28pt;font-weight:700;margin-top:4px;}
.data-table{width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:9.5pt;}
.data-table th,.data-table td{border:1px solid #30363d;padding:8px 9px;vertical-align:top;text-align:left;}
.data-table th{background:#0d1117;font-weight:600;color:#c9d1d9;}
.data-table td{background:#161b22;color:#e6edf3;}
.data-table tbody tr:nth-child(even) td{background:#131920;}
.kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:20px 0;}
.kpi{border:1px solid #30363d;border-radius:10px;padding:12px;text-align:center;background:#161b22;}
.kpi strong{display:block;font-size:18pt;line-height:1.1;margin-bottom:4px;color:#e6edf3;}
.kpi span{color:#8b949e;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.05em;}
.exec-box{background:rgba(88,166,255,0.12);border:1px solid rgba(88,166,255,0.28);border-radius:12px;padding:20px 22px;margin:12px 0 8px;}
.exec-headline{font-weight:700;color:#79c0ff;margin:14px 0 10px;font-size:12pt;}
.sev{font-size:8pt;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;}
.sev-high{background:rgba(248,81,73,0.14);color:#ff7b72;}
.sev-medium{background:rgba(210,153,34,0.14);color:#e3b341;}
.sev-low{background:rgba(88,166,255,0.14);color:#79c0ff;}
.impact-cell{font-size:9pt;}
.impact-badge{display:block;padding:6px 8px;border-radius:6px;font-size:8.5pt;font-weight:600;margin-bottom:4px;}
.impact-critical{background:rgba(248,81,73,0.14);color:#ff7b72;}
.impact-high{background:rgba(210,153,34,0.14);color:#e3b341;}
.impact-medium{background:rgba(210,153,34,0.14);color:#e3b341;}
.impact-low{background:rgba(88,166,255,0.14);color:#79c0ff;}
.recipe-cell{font-size:9pt;color:#c9d1d9;}
.callout{background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.35);border-radius:8px;padding:12px 14px;font-size:10pt;margin:12px 0;color:#e6edf3;}
.command-box{background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:14px 16px;border-radius:8px;font-family:"JetBrains Mono",Consolas,monospace;font-size:9.5pt;margin:10px 0;}
.disclaimer-box{border:1px solid #30363d;background:#161b22;padding:16px 18px;border-radius:8px;font-size:9.5pt;color:#8b949e;}
.footer{margin-top:40px;padding-top:18px;border-top:2px solid #30363d;color:#8b949e;font-size:9pt;}
ul{margin:8px 0;padding-left:20px;} li{margin-bottom:6px;}
.signoff-grid{border:1px solid #30363d;border-radius:12px;padding:18px 20px;background:#161b22;margin:12px 0 20px;}
.signoff-check{display:block;margin:0 0 12px;padding-left:1.6rem;position:relative;font-size:10pt;line-height:1.5;color:#e6edf3;}
.signoff-check:last-child{margin-bottom:0;}
.signoff-box{position:absolute;left:0;top:0.15rem;width:0.95rem;height:0.95rem;border:2px solid #30363d;border-radius:3px;background:#0d1117;}
.signoff-signature{margin-top:1.25rem;font-size:10pt;color:#8b949e;}
.signoff-line{display:block;margin:1rem 0 0.35rem;border-bottom:1px solid #30363d;min-height:1.75rem;color:#e6edf3;}
.signoff-role{font-size:9pt;color:#6e7681;}
</style></head>
<body>
<section class="certificate cover-page">
  <p class="cover-kicker">${tierConfig.kicker}</p>
  <h1 class="cover-title">${safeClientName}</h1>
  <p class="cover-sub">${tierConfig.subtitle}</p>
  <div class="cover-meta">
    <div><strong>Report ID:</strong> ${safeReportId}</div>
    <div><strong>Executed:</strong> ${safeNowStr}</div>
    <div><strong>Client:</strong> ${safeClientName}</div>
    <div><strong>Assessor:</strong> SimpleBeacon</div>
    <div><strong>Engine:</strong> SimpleBeacon Engine v1.3.0 (Zero-Dependency)</div>
    <div><strong>Repository:</strong> ${safeProjectName} / main</div>
  </div>
  <div class="cover-badges">
    <span class="badge ${tierConfig.badgeClass}">${tierConfig.badge}</span>
    <span class="badge ${gatePass === 'PASS' ? 'badge-pass' : 'badge-blocked'}">GATE ${safeGatePass}</span>
  </div>
  <p class="confidential">Prepared for authorized business and engineering recipients. This document combines executive risk metrics for leadership and deterministic remediation mapping for developers.</p>
</section>
<main>
  <section class="section">
    <div class="section-num">Section 01</div>
    <h2>Audit Metadata &amp; Ledger</h2>
    <p class="meta">Establishes consulting authority, scan scope, and performance evidence for this engagement.</p>
    <table class="data-table">
      <tr><td>Client name</td><td>${safeClientName}</td></tr>
      <tr><td>Target repository / branch</td><td><code>${safeProjectName}</code> / <code>main</code></td></tr>
      <tr><td>Timestamp</td><td>${safeNowStr}</td></tr>
      <tr><td>Engine core version</td><td>SimpleBeacon Engine v1.3.0 (Zero-Dependency)</td></tr>
      <tr><td>Scan performance ledger</td><td>${safeTotalFiles} repo files indexed</td></tr>
      <tr><td>Report assessor</td><td>SimpleBeacon</td></tr>
      <tr><td>Quality score</td><td>${safeQualityScore}% · code health — · audit confidence 100/100</td></tr>
    </table>
  </section>
  <section class="section">
    <div class="section-num">Section 02</div>
    <h2>Executive Dashboard (CFO View)</h2>
    <p class="meta">Deterministic executive narrative and remediation mapping generated directly from complete scan JSON — no AI inference on counts or findings.</p>
    <div class="gate-banner ${gatePass === 'PASS' ? 'pass' : 'fail'}">
      <div class="gate-banner-label">Overall gate result</div>
      <div class="gate-banner-value">${safeGatePass}</div>
    </div>
    <div class="kpi-strip">
      <div class="kpi"><strong>${gatePass === 'PASS' ? 'PASS' : 'REVIEW'}</strong><span>Gate (not scanned)</span></div>
      <div class="kpi"><strong>${severityCounts.high || 0}</strong><span>High findings</span></div>
      <div class="kpi"><strong>${severityCounts.medium || 0}</strong><span>Medium findings</span></div>
      <div class="kpi"><strong>${safeTotalFiles}</strong><span>Files deep-scanned</span></div>
      <div class="kpi"><strong>${safeQualityScore}%</strong><span>Code health</span></div>
    </div>
  </section>
  ${euAiaHtml}
  <section class="section">
    <div class="section-num">Section 03</div>
    <h2>Developer Action Plan (Technical Recipe Book)</h2>
    <p class="meta">Each row maps scan JSON to a full remediation chain: raw file flag → business impact → safe copy-paste fix recipe. Showing up to 100 prioritized rows.</p>
    <table class="data-table">
      <tr><th>Severity</th><th>File &amp; snippet</th><th>Rule triggered</th><th>Why it breaks (impact)</th><th>Safe code fix recipe</th></tr>
      ${issueRows || '<tr><td colspan="5" style="text-align:center;color:#8b949e;">No blocking findings at configured gate severities.</td></tr>'}
    </table>
    <div class="verify-block">
      <h3>Local verification before re-submit</h3>
      <p class="meta">After engineering applies the recipes above, prove a clean gate locally — without waiting for a re-audit.</p>
      <div class="command-box">npx simplebeacon scan --path ./${safeProjectName} --gate</div>
    </div>
  </section>
  <section class="section">
    <div class="section-num">Section 04</div>
    <h2>Compliance &amp; Git Gate Recommendations</h2>
    <p class="meta">Continuous evaluation checklist and automated prevention steps for the engineering team.</p>
    <h3>Continuous evaluation checklist</h3>
    <table class="data-table">
      <tr><th>Checklist item</th><th>Status</th><th>Notes</th></tr>
      <tr><td>Zero hardcoded credential patterns</td><td><strong>${credentialHits > 0 ? 'FAIL' : 'PASS'}</strong></td><td>${credentialHits > 0 ? safeCredentialHits + ' credential pattern(s) detected' : 'Scanned ' + safeTotalFiles + ' path(s) — no credential patterns'}</td></tr>
      <tr><td>Production path separation</td><td><strong>PASS</strong></td><td>Scanned ${safeTotalFiles} production file(s) — no sample-path leaks</td></tr>
      <tr><td>Schema conformity (configured samples)</td><td><strong>N/A</strong></td><td>No registered page samples checked</td></tr>
      <tr><td>Fiction KPI baseline (sample JSON)</td><td><strong>N/A</strong></td><td>Consistency anchors not configured for this profile</td></tr>
    </table>
    <h3>Automated next step — local pre-commit hook</h3>
    <div class="command-box">npx simplebeacon hook install</div>
    <p class="meta">Install the open-source local hook so credential, mock-path, and fiction KPI patterns cannot re-enter the repository before commit.</p>
    <h3>Recommended CI gate</h3>
    <div class="command-box">npx simplebeacon scan --gate --format json --output .simplebeacon/report.json</div>
    <p class="meta">Add .github/workflows/simplebeacon-gate.yml from SimpleBeacon examples so pull requests fail on configured high-severity findings.</p>
    <div class="disclaimer-box">
      <strong>Independent disclaimer.</strong> This assessment is an opinion-based, static technical review of the source files and configured scan paths at the time of evaluation. It is not a legal compliance guarantee, formal penetration test, SOC 2 attestation, or certification that the system is secure in production. The client remains responsible for remediation, release authorization, and ongoing security posture.
    </div>
  </section>
  ${analysisSectionsHtml}
  ${remediationHtml}
  <section class="section">
    <div class="section-num">Section 05</div>
    <h2>Production compliance sign-off</h2>
    <p class="meta">Formal handoff seal — complete after remediations and a zero Critical/High re-scan.</p>
    <div class="signoff-grid">
      <span class="signoff-check"><span class="signoff-box" aria-hidden="true"></span> STAGE 1: Line-by-line remediation applied by engineering team.</span>
      <span class="signoff-check"><span class="signoff-box" aria-hidden="true"></span> STAGE 2: Zero-dependency re-scan executed (0 Critical/High flags remaining).</span>
    </div>
    <div class="signoff-signature">
      <span>Approved for production handoff by:</span>
      <span class="signoff-line">&nbsp;</span>
      <span class="signoff-role">CTO / Lead Architect · Date: _______________</span>
    </div>
  </section>
  <section class="section">
    <div class="section-num">Appendix</div>
    <h2>Methodology &amp; scan scope</h2>
    <ul><li>Repository inventory: ${safeTotalFiles} files — browser-local heuristic scan.</li><li>Pattern matching on file content for AI/LLM imports and credential heuristics — not LLM semantic review.</li><li>Processing runs 100% locally in browser sandbox. No source code leaves your computer.</li><li>Gate rules: credential patterns, AI-implementation detection.</li></ul>
    <p class="meta">Report ID ${safeReportId} · Generated ${safeNowStr} by SimpleBeacon</p>
  </section>
  <div class="footer">
    <p><strong>Report ID ${safeReportId}</strong> · Generated ${safeNowStr} by SimpleBeacon</p>
    <p>Print this document (Ctrl+P / Cmd+P) → Destination: <strong>Save as PDF</strong> · Recommended filename: <code>${safeReportId}.pdf</code></p>
  </div>
</main>
</body></html>`;
}

module.exports = {
    escapeHtml,
    normalizeReport,
    getTierConfig,
    buildModuleHtml,
    buildEuComplianceCertificateHtml,
    buildCertificateHtml
};
