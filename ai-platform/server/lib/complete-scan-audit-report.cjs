/**
 * Complete-scan executive audit report — premium HTML for print/PDF export.
 */

const path = require('path');
const {
    assessAuditExportTier,
    resolveAuditClientName
} = require('./audit-export-tier.cjs');
const {
    collectIssues,
    resolveSeverityCounts,
    buildDetailedFindings,
    buildComplianceTable,
    buildHowToFixSection,
    buildPersonalizedActionPlan,
    formatRule,
    defaultRemediation
} = require('../../packages/simplebeacon-cli/src/reporters/audit-report');

const { escapeHtml } = require('./code-roadmap-export.cjs');
// simplebeacon:production-leak-intent: fixtures-path - Legitimate fixture data for audit report generation in development/demo mode
const { buildSampleAuditReportModel: buildSampleAuditReportModelFromFixtures } = require('./fixtures/sample-audit-report-data.cjs');
const {
    enrichRemediationRow,
    buildVerificationCommand
} = require('./audit-remediation-recipes.cjs');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const PRODUCTION_PREFIXES = ['server/', 'src/', 'packages/', 'app/', 'lib/', 'client/', 'api/'];
const NOISE_PREFIXES = ['docs/', 'tests/', 'test/', 'templates/', '.cursor/', 'archive/'];

function normalizeFindingDescription(finding) {
    let raw = String(finding.description || finding.match || finding.type || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const basename = String(finding.filePath || '').split(/[/\\]/).pop()?.toLowerCase() || '';
    if (basename) {
        raw = raw.replace(new RegExp(basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }
    raw = raw.replace(/\s+in\s+[\w./_-]+\s*$/g, '').trim();
    if (/\b(stub|not implemented)\b/.test(raw)) return 'stub-not-implemented';
    if (/\b(python\s+todo|todo\s+comment|todo\s+marker|fixme\s+marker)\b/.test(raw) || /\btodo\b/.test(raw)) {
        return 'todo-marker';
    }
    if (/\bdeprecated\b/.test(raw)) return 'deprecated-marker';
    if (/\bfixme\b/.test(raw)) return 'fixme-marker';
    return raw.slice(0, 80);
}

function dedupeFindings(findings = []) {
    const seen = new Set();
    const out = [];
    for (const item of findings) {
        const key = [
            normalizeFindingPath(item.filePath),
            item.line,
            item.category,
            normalizeFindingDescription(item)
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

function sortBySeverity(findings) {
    return [...findings].sort((a, b) => {
        const left = SEVERITY_ORDER[a.severity] ?? 9;
        const right = SEVERITY_ORDER[b.severity] ?? 9;
        if (left !== right) return left - right;
        if (a.productionPriority !== b.productionPriority) {
            return (b.productionPriority || 0) - (a.productionPriority || 0);
        }
        return String(a.filePath || '').localeCompare(String(b.filePath || ''));
    });
}

function normalizeFindingPath(filePath) {
    const rel = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    return idx >= 0 ? rel.slice(idx + marker.length) : rel;
}

function isDocumentationPath(filePath) {
    const rel = normalizeFindingPath(filePath);
    if (/\.(md|markdown|rst)$/i.test(rel)) return true;
    return NOISE_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`));
}

function isProductionCodePath(filePath) {
    const rel = normalizeFindingPath(filePath);
    if (isDocumentationPath(rel)) return false;
    if (/\.(test|spec)\.[jt]s$/i.test(rel)) return false;
    return PRODUCTION_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`));
}

/** Client handoff scope — runtime deploy paths, not CLI reporters, test harnesses, or legacy src trees. */
function isAuditProductionRuntimePath(filePath) {
    const rel = normalizeFindingPath(filePath);
    if (isDocumentationPath(rel)) return false;
    if (/\.(test|spec)\.[jt]s$/i.test(rel)) return false;
    if (/\.(?:ps1|sh|bat|cmd)$/i.test(rel)) return false;
    if (/(?:^|\/)scripts\//.test(rel) || /(?:^|\/)tools\//.test(rel)) return false;
    if (/(?:^|\/)reporters\//.test(rel)) return false;
    if (/^server\/test[-_.]/i.test(rel) || /\/test-gateway\./i.test(rel)) return false;
    if (/^src\/ai-system\//.test(rel)) return false;
    if (rel.startsWith('server/')) return true;
    if (rel.startsWith('web/') || rel.includes('/web/simplebeacon-dashboard/')) return true;
    if (rel.startsWith('packages/') || rel.includes('/packages/')) {
        if (/(?:^|\/)packages\/[^/]+\/(?:reporters|bin|scripts|tools)\//.test(rel)) return false;
        if (/(?:^|\/)packages\/[^/]+\/publish\.(?:ps1|sh)$/i.test(rel)) return false;
        if (/(?:^|\/)packages\/[^/]+\/src\/(?:reporters|bin|scripts|tools)\//.test(rel)) return false;
        return /(?:^|\/)packages\/[^/]+\/src\//.test(rel);
    }
    if (rel.startsWith('src/api/') || rel.startsWith('src/server/') || rel.startsWith('src/web/')) return true;
    if (rel.startsWith('app/') || rel.startsWith('lib/') || rel.startsWith('client/') || rel.startsWith('api/')) {
        return true;
    }
    return false;
}

function scoreFinding(finding) {
    let score = 0;
    if (finding.severity === 'high') score += 40;
    else if (finding.severity === 'medium') score += 25;
    else score += 10;
    if (isAuditProductionRuntimePath(finding.filePath)) score += 35;
    if (finding.category === 'broken') score += 30;
    if (finding.category === 'debug-artifact' && isAuditProductionRuntimePath(finding.filePath)) score += 20;
    if (isDocumentationPath(finding.filePath)) score -= 30;
    return score;
}

function enrichFindings(findings = []) {
    return dedupeFindings(findings).map((f) => ({
        ...f,
        productionPriority: scoreFinding(f),
        tier: isAuditProductionRuntimePath(f.filePath)
            ? 'production'
            : (isDocumentationPath(f.filePath) ? 'documentation' : 'general')
    }));
}

const ENGINE_VERSION = '1.1.0';

/** Shared dark-theme CSS for web sample report + exported audit PDFs (matches simplebeacon.ai). */
function getAuditReportStyles() {
    return `
    @page {
      margin: 14mm 16mm;
      background: #0d1117;
    }
    :root {
      color-scheme: dark;
      --bg: #0d1117;
      --bg-elevated: #161b22;
      --bg-panel: #010409;
      --border: #30363d;
      --border-muted: #21262d;
      --text: #e6edf3;
      --muted: #8b949e;
      --dim: #6e7681;
      --line: #30363d;
      --accent: #58a6ff;
      --accent-soft: rgba(88, 166, 255, 0.12);
      --pass: #3fb950;
      --pass-bg: rgba(46, 164, 79, 0.14);
      --warn: #d29922;
      --warn-bg: rgba(210, 153, 34, 0.14);
      --blocked: #f85149;
      --blocked-bg: rgba(248, 81, 73, 0.14);
      --gold: #d29922;
      --green-glow: rgba(46, 164, 79, 0.12);
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body {
      font-family: "Inter", "Segoe UI", system-ui, sans-serif;
      color: var(--text);
      margin: 0;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, var(--green-glow), transparent 55%),
        radial-gradient(circle at 100% 80%, rgba(88, 166, 255, 0.06), transparent 40%),
        var(--bg);
      font-size: 11pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover-page {
      min-height: 100vh;
      padding: 48px 52px 40px;
      background:
        radial-gradient(ellipse 90% 60% at 20% 0%, rgba(46, 164, 79, 0.18), transparent 55%),
        radial-gradient(circle at 100% 20%, rgba(88, 166, 255, 0.12), transparent 45%),
        linear-gradient(160deg, #010409 0%, #0d1117 42%, #161b22 100%);
      color: var(--text);
      border-bottom: 1px solid var(--border);
      page-break-after: always;
    }
    .cover-kicker { letter-spacing: 0.14em; text-transform: uppercase; font-size: 10pt; color: var(--muted); margin: 0 0 12px; }
    .cover-title { font-family: "Inter", "Segoe UI", sans-serif; font-size: 34pt; line-height: 1.12; margin: 0 0 16px; font-weight: 700; max-width: 720px; letter-spacing: -0.02em; }
    .cover-sub { font-size: 13pt; color: #c9d1d9; max-width: 640px; margin: 0 0 28px; }
    .cover-meta { font-size: 10pt; color: var(--muted); line-height: 1.7; }
    .cover-badges { margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .cover-badges .badge { display: inline-flex; margin: 0; flex-shrink: 0; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 10pt; font-weight: 700; letter-spacing: 0.04em; border: 1px solid var(--border); }
    .badge-gold { background: rgba(210, 153, 34, 0.12); color: #e3b341; border-color: rgba(210, 153, 34, 0.35); }
    .badge-pass { background: var(--pass-bg); color: var(--pass); border-color: rgba(63, 185, 80, 0.35); }
    .badge-warn { background: var(--warn-bg); color: var(--warn); border-color: rgba(210, 153, 34, 0.35); }
    .badge-blocked { background: var(--blocked-bg); color: var(--blocked); border-color: rgba(248, 81, 73, 0.35); }
    .confidential { margin-top: 48px; font-size: 9pt; color: var(--dim); border-top: 1px solid var(--border-muted); padding-top: 16px; }
    main { padding: 36px 52px 48px; max-width: 920px; margin: 0 auto; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-num { color: var(--gold); font-size: 10pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
    h2 { font-family: "Inter", "Segoe UI", sans-serif; font-size: 20pt; margin: 0 0 12px; color: var(--text); page-break-after: avoid; letter-spacing: -0.02em; }
    h3 { font-size: 12pt; margin: 18px 0 8px; color: #c9d1d9; }
    .meta { color: var(--muted); font-size: 9.5pt; }
    .verdict-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin: 16px 0 24px; }
    .verdict-card { border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; background: var(--bg-elevated); }
    .verdict-card.ready { border-left: 5px solid var(--pass); }
    .verdict-card.conditional { border-left: 5px solid var(--warn); }
    .verdict-card.blocked { border-left: 5px solid var(--blocked); }
    .verdict-label { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
    .verdict-value { font-family: "Inter", "Segoe UI", sans-serif; font-size: 18pt; font-weight: 700; margin-bottom: 8px; }
    .score-ring { font-size: 28pt; font-weight: 700; color: var(--accent); }
    .exec-box { background: var(--accent-soft); border: 1px solid rgba(88, 166, 255, 0.28); border-radius: 12px; padding: 20px 22px; margin: 12px 0 8px; }
    .exec-headline { font-weight: 700; color: #79c0ff; margin: 14px 0 10px; font-size: 12pt; }
    .kpi-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
    .kpi { border: 1px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; background: var(--bg-elevated); }
    .kpi strong { display: block; font-size: 18pt; line-height: 1.1; margin-bottom: 4px; color: var(--text); }
    .kpi span { color: var(--muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
    .risk-matrix { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .risk-matrix th, .risk-matrix td { border: 1px solid var(--border); padding: 10px; font-size: 10pt; }
    .risk-matrix th { background: var(--bg-panel); text-align: left; color: #c9d1d9; }
    .data-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; }
    .data-table th, .data-table td { border: 1px solid var(--border); padding: 8px 9px; vertical-align: top; text-align: left; }
    .data-table th { background: var(--bg-panel); font-weight: 600; color: #c9d1d9; }
    .data-table td { background: var(--bg-elevated); color: var(--text); }
    .data-table tbody tr:nth-child(even) td { background: #131920; }
    .data-table .empty { color: var(--muted); font-style: italic; }
    code { font-size: 9pt; word-break: break-word; background: rgba(110, 118, 129, 0.18); color: #e6edf3; padding: 1px 4px; border-radius: 4px; font-family: "JetBrains Mono", Consolas, monospace; }
    .sev { font-size: 8pt; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
    .sev-high { background: var(--blocked-bg); color: #ff7b72; }
    .sev-medium { background: var(--warn-bg); color: #e3b341; }
    .sev-low { background: var(--accent-soft); color: #79c0ff; }
    .callout { background: rgba(210, 153, 34, 0.1); border: 1px solid rgba(210, 153, 34, 0.35); border-radius: 8px; padding: 12px 14px; font-size: 10pt; margin: 12px 0; color: #e6edf3; }
    .gate-banner { margin: 18px 0 22px; padding: 22px 24px; border-radius: 14px; text-align: center; border: 2px solid var(--border); background: var(--bg-elevated); }
    .gate-banner.pass { background: var(--pass-bg); border-color: rgba(63, 185, 80, 0.45); color: var(--pass); }
    .gate-banner.fail { background: var(--blocked-bg); border-color: rgba(248, 81, 73, 0.45); color: var(--blocked); }
    .gate-banner-label { font-size: 10pt; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
    .gate-banner-value { font-family: "Inter", "Segoe UI", sans-serif; font-size: 42pt; font-weight: 800; line-height: 1.1; margin-top: 6px; }
    .gate-banner-value.gate-banner-compact { font-size: 24pt; line-height: 1.25; }
    .ledger-table td:first-child { width: 34%; font-weight: 600; background: var(--bg-panel); color: #c9d1d9; }
    .tier-dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-right: 6px; vertical-align: middle; }
    .tier-critical { background: #f85149; }
    .tier-high { background: #d29922; }
    .tier-medium { background: #58a6ff; }
    code.snippet { display: block; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; background: var(--bg-panel); border: 1px solid var(--border-muted); padding: 6px 8px; }
    .fix-cell { min-width: 140px; word-break: break-word; overflow-wrap: anywhere; }
    .impact-cell, .recipe-cell { min-width: 160px; max-width: 240px; font-size: 9pt; line-height: 1.45; vertical-align: top; }
    .impact-badge { display: block; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); font-weight: 600; }
    .impact-critical { background: var(--blocked-bg); color: #ff7b72; border-color: rgba(248, 81, 73, 0.35); }
    .impact-high { background: rgba(210, 153, 34, 0.12); color: #e3b341; border-color: rgba(210, 153, 34, 0.35); }
    .impact-hygiene { background: var(--accent-soft); color: #79c0ff; border-color: rgba(88, 166, 255, 0.28); }
    .impact-review { background: rgba(110, 118, 129, 0.12); color: #c9d1d9; }
    .recipe-cell { color: #c9d1d9; }
    .recipe-cell code { display: inline; font-size: 8.5pt; }
    .verify-block { margin: 18px 0 8px; }
    .verify-block h3 { margin-top: 0; }
    .signoff-section { page-break-before: always; }
    .signoff-grid { border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; background: var(--bg-elevated); margin: 12px 0 20px; }
    .signoff-check { display: block; margin: 0 0 12px; padding-left: 1.6rem; position: relative; font-size: 10pt; line-height: 1.5; color: var(--text); }
    .signoff-check:last-child { margin-bottom: 0; }
    .signoff-box { position: absolute; left: 0; top: 0.15rem; width: 0.95rem; height: 0.95rem; border: 2px solid var(--border); border-radius: 3px; background: var(--bg-panel); }
    .signoff-signature { margin-top: 1.25rem; font-size: 10pt; color: var(--muted); }
    .signoff-line { display: block; margin: 1rem 0 0.35rem; border-bottom: 1px solid var(--border); min-height: 1.75rem; color: var(--text); }
    .signoff-role { font-size: 9pt; color: var(--dim); }
    .command-box { background: var(--bg-panel); color: #c9d1d9; border: 1px solid var(--border); padding: 14px 16px; border-radius: 8px; font-family: "JetBrains Mono", Consolas, monospace; font-size: 9.5pt; margin: 10px 0; }
    .disclaimer-box { border: 1px solid var(--border); background: var(--bg-elevated); padding: 16px 18px; border-radius: 8px; font-size: 9.5pt; color: var(--muted); }
    .footer { margin-top: 40px; padding-top: 18px; border-top: 2px solid var(--border); color: var(--muted); font-size: 9pt; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin-bottom: 6px; }
    a { color: #79c0ff; }
    @media print {
      html, body, main, section, .section {
        background: var(--bg) !important;
        color: var(--text) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .cover-page { min-height: auto; padding: 24mm 18mm; }
      main { padding: 0; max-width: none; }
      .kpi-strip { grid-template-columns: repeat(5, 1fr); }
      .cover-page, .gate-banner, .gate-banner.pass, .gate-banner.fail,
      .kpi, .verdict-card, .exec-box, .callout, .command-box, .disclaimer-box,
      .data-table th, .data-table td, .risk-matrix th, .risk-matrix td,
      .ledger-table td:first-child, .badge, code, code.snippet {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }`;
}

function formatReportTimestamp(iso) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) {
        return new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    }
    return date.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
}

function formatScanDuration(durationMs) {
    const elapsedMs = Number(durationMs);
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return '—';
    if (elapsedMs < 1000) return `${(elapsedMs / 1000).toFixed(2)} seconds`;
    return `${(elapsedMs / 1000).toFixed(1)} seconds`;
}

function truncateForDisplay(text, maxLen = 96) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '—';
    if (clean.length <= maxLen) return clean;
    const slice = clean.slice(0, maxLen);
    const wordBreak = slice.lastIndexOf(' ');
    const cut = wordBreak > Math.floor(maxLen * 0.55) ? slice.slice(0, wordBreak) : slice;
    return `${cut.trim()}…`;
}

function redactSnippet(text) {
    if (!text) return '—';
    const redacted = String(text)
        .replace(/(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/gi, 'sk_****REDACTED****')
        .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA****REDACTED****')
        .replace(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{4,}['"]/gi, (match) => match.replace(/(['"])[^'"]+(['"])/, '$1****REDACTED****$2'))
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '****@****.***');
    return truncateForDisplay(redacted, 96);
}

function formatCodebaseRule(finding) {
    const category = finding.category || finding.type || 'scan-rule';
    const map = {
        'debug-artifact': 'DEBUG_ARTIFACT / CONSOLE_OR_DEBUGGER',
        'tech-debt': 'TECH_DEBT_MARKER / TODO_FIXME',
        broken: 'SYNTAX_OR_PARSE_ERROR',
        'meaningless-data': 'FICTION_KPI_PATTERN',
        eslint: 'ESLINT_RULE',
        empty: 'EMPTY_OR_WHITESPACE_FILE',
        artifact: 'GENERATED_ARTIFACT',
        duplicate: 'DUPLICATE_BASENAME'
    };
    return map[category] || String(category).toUpperCase().replace(/-/g, '_');
}

function classifyGateIssueBusinessTier(issue) {
    const type = String(issue.type || '').toLowerCase();
    const severity = String(issue.severity || 'low').toLowerCase();
    if (/credential/i.test(type) || severity === 'critical') return 'critical';
    if (/production leak/i.test(type) || severity === 'high') return 'high';
    if (/fiction|kpi|consistency|schema/i.test(type)) return 'medium';
    return 'low';
}

function classifyCodebaseBusinessTier(finding) {
    if (finding.category === 'meaningless-data') return 'medium';
    if (finding.category === 'broken' || finding.severity === 'high') return 'high';
    if (finding.category === 'debug-artifact') return 'medium';
    if (finding.severity === 'medium') return 'medium';
    return 'low';
}

function buildBusinessRiskCounts(model) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of model.issues || []) {
        const tier = classifyGateIssueBusinessTier(issue);
        counts[tier] += issue.count || 1;
    }
    for (const finding of (model.allCodeFindings || []).filter((f) => f.tier === 'production')) {
        const tier = classifyCodebaseBusinessTier(finding);
        counts[tier] += 1;
    }
    return counts;
}

function dedupeRemediationRows(rows) {
    const seen = new Set();
    return rows.filter((row) => {
        const key = `${row.location}|${row.rule}|${row.snippet}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const MAX_REMEDIATION_ROWS = 100;

function buildDeveloperRemediationRows(model) {
    const rows = [];

    for (const issue of sortBySeverity(model.issues || [])) {
        rows.push(enrichRemediationRow({
            severity: issue.severity || 'high',
            location: issue.line ? `${issue.filePath}:${issue.line}` : issue.filePath,
            rule: formatRule(issue).replace(/`/g, ''),
            snippet: redactSnippet(issue.snippet || issue.match || issue.description),
            remediation: issue.recommendedAction || defaultRemediation(issue),
            source: 'Simplebeacon gate'
        }));
    }

    const runtimeFindings = sortBySeverity(
        (model.allCodeFindings || []).filter((f) => f.tier === 'production')
    );
    for (const finding of runtimeFindings) {
        rows.push(enrichRemediationRow({
            severity: finding.severity || 'medium',
            location: finding.line ? `${finding.filePath}:${finding.line}` : finding.filePath,
            rule: formatCodebaseRule(finding),
            snippet: redactSnippet(finding.match || finding.description),
            remediation: truncateForDisplay(finding.recommendedAction || 'Review and remediate before client handoff.', 160),
            source: 'Runtime codebase scan'
        }));
    }

    return dedupeRemediationRows(rows).slice(0, MAX_REMEDIATION_ROWS);
}

function formatLedgerFilesScanned(summary) {
    const parts = [];
    if (summary.codeFilesAnalyzed != null) {
        parts.push(`${Number(summary.codeFilesAnalyzed).toLocaleString()} code files deep-scanned`);
    }
    if (summary.ruleScopedFiles === 0) {
        parts.push('0 gate-rule files — configure production paths in simplebeacon.config.json for credential/leak rules');
    } else if (summary.ruleScopedFiles != null) {
        parts.push(`${Number(summary.ruleScopedFiles).toLocaleString()} gate-rule files checked`);
    } else if (summary.gatePass == null) {
        parts.push('Gate scan not included in this bundle');
    }
    if (summary.repositoryFiles != null) {
        parts.push(`${Number(summary.repositoryFiles).toLocaleString()} repo files indexed`);
    }
    return parts.length ? parts.join(' · ') : '—';
}

function _formatReportDate(iso) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) {
        return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function redactPathForDisplay(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/').trim();
    if (!normalized) return 'Project';
    const parts = normalized.split('/').filter(Boolean);
    if (/^[A-Za-z]:$/i.test(parts[0]) && parts.length > 1) parts.shift();
    if (parts.length <= 2) return parts.join('/') || 'Project';
    return parts.slice(-2).join('/');
}

function buildReportId(iso) {
    const d = iso ? new Date(iso) : new Date();
    const stamp = Number.isNaN(d.getTime()) ? '00000000' : d.toISOString().slice(0, 10).replace(/-/g, '');
    return `SB-AUD-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function countByTier(findings) {
    return findings.reduce((acc, f) => {
        acc[f.tier] = (acc[f.tier] || 0) + 1;
        return acc;
    }, { production: 0, documentation: 0, general: 0 });
}

function countBySeverity(findings) {
    return findings.reduce((acc, f) => {
        const band = String(f.severity || 'low').toLowerCase();
        acc[band] = (acc[band] || 0) + 1;
        return acc;
    }, { high: 0, medium: 0, low: 0 });
}

function countProductionSeverity(findings) {
    return findings
        .filter((f) => f.tier === 'production')
        .reduce((acc, f) => {
            const band = String(f.severity || 'low').toLowerCase();
            acc[band] = (acc[band] || 0) + 1;
            return acc;
        }, { high: 0, medium: 0, low: 0 });
}

function normalizeSimplebeaconForCompliance(simplebeacon, summary = {}) {
    if (!simplebeacon || typeof simplebeacon !== 'object') return simplebeacon;
    const ruleScoped = simplebeacon.ruleScopedFilesAnalyzed
        ?? simplebeacon.scanScope?.ruleScopedFilesAnalyzed
        ?? summary.ruleScopedFiles
        ?? null;
    const credentialScanned = simplebeacon.credentialScanned
        ?? simplebeacon.scanScope?.credentialScanned
        ?? ruleScoped
        ?? 0;
    const productionLeakScanned = simplebeacon.productionLeakScanned
        ?? simplebeacon.scanScope?.productionDirsScanned
        ?? simplebeacon.scanScope?.productionLeakScanned
        ?? ruleScoped
        ?? 0;
    return {
        ...simplebeacon,
        credentialScanned,
        productionLeakScanned,
        schemaChecked: simplebeacon.schemaChecked ?? 0,
        schemaPassed: simplebeacon.schemaPassed ?? 0,
        consistencyChecked: simplebeacon.consistencyChecked ?? 0,
        ruleScopedFilesAnalyzed: ruleScoped
    };
}

function isPlaceholderExecutiveText(executiveText) {
    const normalizedText = String(executiveText || '').trim();
    if (!normalizedText) return true;
    return /^priority\s+\d+$/i.test(normalizedText)
        || /^priority\s*[:-]?\s*\d+$/i.test(normalizedText)
        || /^item\s+\d+$/i.test(normalizedText);
}

function mergeExecutiveSummary(deterministic, aiParsed) {
    if (!aiParsed) return deterministic;
    const intro = String(aiParsed.intro || '').trim();
    const businessImpact = String(aiParsed.businessImpact || '').trim();
    const headline = String(aiParsed.headline || '').trim();
    return {
        ...deterministic,
        intro: intro.length >= 40 && !isPlaceholderExecutiveText(intro) ? intro : deterministic.intro,
        businessImpact: businessImpact.length >= 40 && !isPlaceholderExecutiveText(businessImpact)
            ? businessImpact
            : deterministic.businessImpact,
        headline: headline.length >= 20 && !isPlaceholderExecutiveText(headline)
            ? headline
            : deterministic.headline
    };
}

function resolveTierCounts(codebaseSummary, enrichedFindings) {
    if (enrichedFindings?.length) {
        return countByTier(enrichedFindings);
    }
    const fromSummary = codebaseSummary?.tierCounts;
    if (fromSummary && typeof fromSummary === 'object') {
        return {
            production: fromSummary.production ?? 0,
            documentation: fromSummary.documentation ?? 0,
            general: fromSummary.general ?? 0
        };
    }
    return { production: 0, documentation: 0, general: 0 };
}

function buildCategoryRollupFromScan(codebase, enrichedFindings) {
    return buildCategoryRollup(enrichedFindings)
        .sort((a, b) => b.production - a.production || b.count - a.count);
}

function buildCategoryRollup(findings) {
    const buckets = new Map();
    for (const f of findings) {
        const key = f.category || f.type || 'other';
        const bucket = buckets.get(key) || {
            category: key,
            count: 0,
            production: 0,
            high: 0,
            medium: 0,
            low: 0
        };
        bucket.count += 1;
        if (f.tier === 'production') bucket.production += 1;
        bucket[f.severity || 'low'] = (bucket[f.severity || 'low'] || 0) + 1;
        buckets.set(key, bucket);
    }
    return [...buckets.values()].sort((a, b) => b.production - a.production || b.count - a.count);
}

function calculateAuditConfidence(summary, simplebeacon = {}) {
    const gate = simplebeacon && typeof simplebeacon === 'object' ? simplebeacon : {};
    let score = 100;
    if (summary.ruleScopedFiles === 0) score -= 15;
    if (summary.gatePass == null) score -= 10;
    if (summary.codebaseHealth != null && summary.codebaseHealth < 50) score -= 10;
    if (summary.codebaseHealth != null && summary.codebaseHealth < 30) score -= 15;
    if ((summary.codeFilesAnalyzed || 0) > 1000) score += 5;
    const schemaChecked = gate.schemaChecked ?? 0;
    const schemaPassed = gate.schemaPassed ?? 0;
    if (schemaChecked > 0 && schemaPassed < schemaChecked) score -= 5;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function buildExecutivePriorities(summary) {
    if (summary.gatePass === false || summary.severityCounts?.high > 0) {
        return [
            'Clear all gate-blocking findings before any production deploy',
            summary.productionFindings > 0
                ? `Remediate ${Math.min(MAX_REMEDIATION_ROWS, summary.productionFindings)} runtime-path finding(s) in Week 1`
                : 'Re-run gate scan after fixes to confirm PASS before handoff',
            summary.codebaseHealth != null && summary.codebaseHealth < 90
                ? `Improve production-path hygiene from ${summary.codebaseHealth}% toward 90%+`
                : 'Document allowlists for intentional test fixtures and demo data paths'
        ];
    }
    if (summary.dataQualityFindings > 0 && summary.gatePass == null && summary.productionFindings === 0) {
        return [
            `Data quality scan: ${Number(summary.dataQualityFindings).toLocaleString()} finding(s) across config, privacy, and lineage`,
            summary.orphanedDataFiles > 0
                ? `Review ${Number(summary.orphanedDataFiles).toLocaleString()} orphaned data file(s) — archive or wire consumers`
                : 'Align PORT/CORS_ORIGIN across .env and .env.example before onboarding new developers',
            'Run a Simplebeacon gate scan before production handoff — gate was not included in this export'
        ];
    }
    if (summary.productionFindings === 0) {
        const filesLabel = summary.codeFilesAnalyzed != null
            ? summary.codeFilesAnalyzed.toLocaleString()
            : 'all scoped';
        return [
            `Zero production-path issues — ${filesLabel} code files analyzed under this profile`,
            summary.documentationFindings > 0
                ? `Track ${summary.documentationFindings.toLocaleString()} documentation-tier markers separately — not release blockers`
                : 'Schedule quarterly complete scans before major releases',
            summary.ruleScopedFiles === 0 || summary.ruleScopedFiles == null
                ? 'Configure gate rules in simplebeacon.config.json and enforce `npx simplebeacon scan --gate` in CI'
                : 'Keep Simplebeacon gate in CI on every pull request'
        ];
    }
    return [
        'Keep Simplebeacon gate in CI on every pull request',
        `Remediate ${Math.min(MAX_REMEDIATION_ROWS, summary.productionFindings)} runtime-path finding(s) in Week 1 (server/ and packages/*/src/)`,
        summary.codebaseHealth != null && summary.codebaseHealth < 90
            ? `Improve codebase health from ${summary.codebaseHealth}% via targeted tech-debt reduction in production paths`
            : 'Document allowlists for intentional test fixtures and demo data paths'
    ];
}

function buildCleanScanRemediationMessage(summary = {}) {
    const parts = ['No production-path issues detected under this audit profile.'];
    if (summary.documentationFindings > 0) {
        parts.push(`${Number(summary.documentationFindings).toLocaleString()} documentation-tier marker(s) tracked for hygiene (non-blocking).`);
    }
    if (summary.generalFindings > 0) {
        parts.push(`${Number(summary.generalFindings).toLocaleString()} tooling/script-tier marker(s) in dev paths (non-blocking).`);
    }
    if (summary.codebaseHealth != null && summary.codebaseHealth < 90) {
        parts.push(`Consider addressing hygiene markers to improve code health from ${summary.codebaseHealth}%.`);
    } else if (summary.codebaseHealth != null) {
        parts.push(`Code health ${summary.codebaseHealth}% — production paths are clean.`);
    }
    if (summary.codeFilesAnalyzed != null) {
        parts.push(`${Number(summary.codeFilesAnalyzed).toLocaleString()} code files deep-scanned with zero runtime-path blockers.`);
    }
    return parts.join(' ');
}

function buildLaunchReadiness(model) {
    const s = model.summary;
    const sev = s.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
    const productionHigh = s.productionSeverity?.high ?? 0;
    if (s.gatePass === false || sev.high > 0) {
        return { label: 'Not ready for production', tone: 'blocked', score: Math.max(15, 40 - sev.high * 10) };
    }
    if (s.productionFindings > 0 || productionHigh > 0) {
        return { label: 'Ready with conditions', tone: 'conditional', score: Math.min(85, 55 + (s.codebaseHealth || 0) * 0.3) };
    }
    if (s.gatePass === true) {
        const docNote = s.documentationFindings > 0 ? ' — documentation markers tracked separately' : '';
        return {
            label: `Gate clear — maintain CI enforcement${docNote}`,
            tone: 'ready',
            score: Math.min(98, 70 + (s.codebaseHealth || 0) * 0.25)
        };
    }
    return { label: 'Review required', tone: 'conditional', score: 50 };
}

function buildCodebaseActionPlan(model) {
    const prod = model.priorityFindings.filter((f) => f.tier === 'production');
    const high = prod.filter((f) => f.severity === 'high');
    const medium = prod.filter((f) => f.severity === 'medium').slice(0, 5);

    if (!prod.length && !model.summary.codebaseFindingsDeduped) {
        return 'No production-path hygiene backlog detected in analyzed code. Schedule quarterly complete scans before major releases.';
    }

    const week1 = high.length
        ? high.slice(0, 4).map((f, i) => `${i + 1}. **Remediate ${f.category}** in \`${f.filePath}\`${f.line ? ` (line ${f.line})` : ''} — ${f.recommendedAction || 'Review and fix before handoff'}`)
        : [`1. **Triage ${model.summary.productionFindings} production-path marker(s)** — start with ${medium[0]?.filePath || 'server/ and packages/'}`, '2. **Run** `npx simplebeacon scan --gate` after each fix batch'];

    const week2 = [
        '1. **Reduce medium-severity debt** in server/ and packages/ (TODO/FIXME, debug artifacts)',
        '2. **Enable ESLint in CI** for packages/ and server/ if not already enforced',
        '3. **Exclude or archive** documentation-only debt markers from release-blocking criteria'
    ];

    const week3 = [
        '1. **Integrate Simplebeacon gate** on pull requests (`.github/workflows/simplebeacon-gate.yml`)',
        '2. **Sync baseline** after green test run: `npx simplebeacon baseline sync`',
        '3. **Re-run complete scan** to verify health score improvement'
    ];

    return `### Week 1 — Production-path fixes (est. 4–8 hours)

${week1.join('\n\n')}

### Week 2 — Engineering hygiene (est. 6–10 hours)

${week2.join('\n\n')}

### Week 3 — Prevention & verification (est. 3–5 hours)

${week3.join('\n\n')}

**Note:** ${model.summary.documentationFindings.toLocaleString()} documentation-tier markers are tracked separately and are not release blockers under this audit profile.`;
}

function normalizeCompleteScanInput(completeScan) {
    if (!completeScan || typeof completeScan !== 'object') return null;
    if (completeScan.results && Object.values(completeScan.results).some(Boolean)) {
        return completeScan;
    }
    if (completeScan.type === 'data-cleanup-report') {
        const profile = completeScan.scanProfile || 'data-quality';
        const resultKey = profile === 'file-reduction' ? 'fileReduction' : 'dataQuality';
        return {
            type: 'simplebeacon-complete-scan',
            version: completeScan.version || '1.3.0',
            generatedAt: completeScan.generatedAt || new Date().toISOString(),
            projectPath: completeScan.projectRoot || completeScan.projectPath || '',
            scanDurationMs: completeScan.durationMs ?? null,
            summary: {
                scanKind: profile,
                dataQualityFindings: completeScan.summary?.totalFindings ?? null,
                fileReductionFindings: completeScan.summary?.totalFindings ?? null
            },
            results: {
                [resultKey]: completeScan
            }
        };
    }
    return hydrateCompleteScanFromSteps(completeScan);
}

function hydrateCompleteScanFromSteps(completeScan) {
    if (!completeScan || typeof completeScan !== 'object') return null;
    const steps = Array.isArray(completeScan.steps) ? completeScan.steps : [];
    if (!steps.length) return completeScan;

    const byId = new Map(steps.filter(Boolean).map((step) => [step.id, step]));
    const results = { ...(completeScan.results || {}) };
    const assign = (engineId, resultKey, ...fields) => {
        if (results[resultKey]) return;
        const step = byId.get(engineId);
        if (!step) return;
        for (const field of fields) {
            if (step[field]) {
                results[resultKey] = step[field];
                return;
            }
        }
    };

    assign('simplebeacon', 'simplebeacon', 'report');
    assign('consolidation', 'consolidation', 'scan');
    assign('mock-scan', 'mockScan', 'report');
    assign('roadmap', 'roadmap', 'roadmap', 'data');
    assign('codebase', 'codebase', 'scan');
    assign('file-reduction', 'fileReduction', 'scan');
    assign('data-quality', 'dataQuality', 'scan');
    assign('cleanup-assistant', 'cleanupAssistant', 'brief');
    assign('compliance', 'compliance', 'checklist');
    assign('npm-audit', 'npmAudit', 'npmAudit');
    assign('eu-ai-act', 'sprint', 'sprint');

    if (results.roadmap?.roadmap && !results.roadmap.codeAnalysis) {
        results.roadmap = results.roadmap.roadmap;
    }

    return {
        ...completeScan,
        type: completeScan.type || 'simplebeacon-complete-scan',
        results
    };
}

function completeScanHasExportableResults(completeScan) {
    const normalized = normalizeCompleteScanInput(completeScan);
    if (!normalized) return false;
    if (normalized.results && Object.values(normalized.results).some(Boolean)) return true;
    return Array.isArray(normalized.steps) && normalized.steps.some((step) => step && (
        step.report || step.scan || step.checklist || step.npmAudit || step.sprint || step.brief
        || step.roadmap || step.data?.roadmap
    ));
}

function buildCompleteAuditModel(completeScan, options = {}) {
    const normalizedScan = normalizeCompleteScanInput(completeScan) || completeScan;
    const results = normalizedScan?.results || {};
    const dataQuality = results.dataQuality || null;
    const fileReduction = results.fileReduction || null;
    const simplebeacon = results.simplebeacon || null;
    const codebase = results.codebase || null;
    const consolidation = results.consolidation || null;
    const mockScan = results.mockScan || null;
    const issues = collectIssues(simplebeacon || { rawIssues: [] });
    const severityCounts = resolveSeverityCounts(simplebeacon || {}, issues);
    const allCodeFindings = enrichFindings(codebase?.findings || []);
    const tierCounts = resolveTierCounts(codebase?.summary, allCodeFindings);
    const priorityFindings = sortBySeverity(allCodeFindings.filter((f) => f.tier === 'production')).slice(0, 15);
    const appendixFindings = sortBySeverity(allCodeFindings.filter((f) => f.tier !== 'production')).slice(0, 8);
    const dedupedSeverity = countBySeverity(allCodeFindings);
    const productionSeverity = countProductionSeverity(allCodeFindings);
    const rawTotal = codebase?.summary?.findingsTotal ?? allCodeFindings.length;
    const dedupedTotal = codebase?.summary?.tierCounts
        ? tierCounts.production + tierCounts.documentation + tierCounts.general
        : allCodeFindings.length;
    const truncated = Boolean(codebase?.summary?.findingsTruncated);

    const scopeLines = [
        ...(simplebeacon?.scanScope?.limitations || []),
        ...(codebase?.scanScope?.limitations || []),
        ...(consolidation?.scanScope?.limitations || [])
    ].filter(Boolean);

    const normalizedSimplebeacon = normalizeSimplebeaconForCompliance(simplebeacon);
    const projectPath = normalizedScan?.projectPath || simplebeacon?.projectRoot || dataQuality?.projectRoot || '';
    const resolvedClient = resolveAuditClientName(options, projectPath || redactPathForDisplay(projectPath));

    const model = {
        reportId: buildReportId(normalizedScan?.generatedAt),
        projectPath,
        platformRoot: simplebeacon?.platformRoot || codebase?.platformRoot || null,
        generatedAt: normalizedScan?.generatedAt || new Date().toISOString(),
        client: resolvedClient,
        company: resolvedClient,
        assessor: options.assessor || 'Simplebeacon Security Audit Service',
        branch: options.branch || normalizedScan?.branch || 'main',
        engineLabel: `Simplebeacon Engine v${normalizedScan?.version || ENGINE_VERSION} (Zero-Dependency)`,
        scanDurationMs: normalizedScan?.scanDurationMs
            ?? normalizedScan?.summary?.scanDurationMs
            ?? dataQuality?.durationMs
            ?? fileReduction?.durationMs
            ?? null,
        repositoryLabel: redactPathForDisplay(normalizedScan?.projectPath || simplebeacon?.projectRoot || ''),
        summary: {
            gatePass: simplebeacon?.gate?.pass ?? normalizedScan?.summary?.simplebeaconGatePass ?? null,
            simplebeaconIssues: simplebeacon?.issueCount ?? issues.length,
            qualityScore: simplebeacon?.qualityScore ?? null,
            repositoryFiles: simplebeacon?.repositoryFilesTotal
                ?? dataQuality?.inventory?.totalFiles
                ?? fileReduction?.inventory?.totalFiles
                ?? codebase?.summary?.repositoryFilesTotal
                ?? consolidation?.summary?.repositoryFilesTotal
                ?? null,
            ruleScopedFiles: simplebeacon?.ruleScopedFilesAnalyzed
                ?? simplebeacon?.scanScope?.ruleScopedFilesAnalyzed
                ?? null,
            codebaseHealth: codebase?.summary?.healthScore ?? normalizedScan?.summary?.codebaseHealthScore ?? null,
            codebaseFindingsRaw: rawTotal,
            codebaseFindingsDeduped: dedupedTotal,
            findingsTruncated: truncated,
            productionFindings: tierCounts.production,
            documentationFindings: tierCounts.documentation,
            generalFindings: tierCounts.general,
            codeFilesAnalyzed: codebase?.summary?.codeFilesAnalyzed ?? null,
            codeFilesDiscovered: codebase?.summary?.codeFilesDiscovered ?? null,
            duplicateGroups: consolidation?.summary?.exactDuplicateGroups ?? null,
            fictionKpiHits: mockScan?.fictionIssues?.reduce((sum, i) => sum + (i.count || 1), 0) ?? null,
            dataQualityFindings: dataQuality?.summary?.totalFindings ?? normalizedScan?.summary?.dataQualityFindings ?? null,
            fileReductionFindings: fileReduction?.summary?.totalFindings ?? normalizedScan?.summary?.fileReductionFindings ?? null,
            orphanedDataFiles: dataQuality?.executiveSummary?.data?.orphanedDataFiles ?? null,
            fileReductionReclaimableBytes: fileReduction?.summary?.reclaimableBytes
                ?? normalizedScan?.summary?.fileReductionReclaimableBytes
                ?? null,
            roadmapCompletion: results.roadmap?.executiveSummary?.completionRate
                ?? normalizedScan?.summary?.roadmapCompletion
                ?? null,
            roadmapSprints: results.roadmap?.executiveSummary?.totalFeatures
                ?? normalizedScan?.summary?.roadmapSprints
                ?? null,
            roadmapFiles: results.roadmap?.codeAnalysis?.structure?.totalFiles
                ?? normalizedScan?.summary?.roadmapFiles
                ?? null,
            cleanupSafeFiles: results.cleanupAssistant?.estimatedReduction?.files
                ?? normalizedScan?.summary?.cleanupSafeFiles
                ?? null,
            scanKind: normalizedScan?.summary?.scanKind ?? null,
            severityCounts,
            codeSeverity: dedupedSeverity,
            productionSeverity
        },
        simplebeacon: normalizedSimplebeacon,
        dataQualitySummary: dataQuality?.executiveSummary || null,
        fileReductionSummary: fileReduction?.executiveSummary || null,
        issues,
        allCodeFindings,
        priorityFindings,
        appendixFindings,
        categoryRollup: buildCategoryRollupFromScan(codebase, allCodeFindings),
        consolidationSummary: consolidation?.summary || null,
        scopeLines: [...new Set(scopeLines)].slice(0, 10),
        markdown: {
            detailedFindings: buildDetailedFindings(issues),
            howToFix: buildHowToFixSection(issues, options.assessment),
            gateActionPlan: buildPersonalizedActionPlan(issues, options.assessment),
            compliance: normalizedSimplebeacon
                ? buildComplianceTable(
                    normalizedSimplebeacon,
                    options.assessment,
                    completeScan?.projectPath || normalizedSimplebeacon.projectRoot || ''
                )
                : '| Checklist item | Status | Notes |\n|----------------|--------|-------|\n| Simplebeacon gate | N/A | Gate scan not included |'
        }
    };
    model.readiness = buildLaunchReadiness(model);
    model.summary.confidenceScore = calculateAuditConfidence(model.summary, normalizedSimplebeacon);
    model.codebaseActionPlan = buildCodebaseActionPlan(model);
    model.businessRiskCounts = buildBusinessRiskCounts(model);
    model.remediationRows = buildDeveloperRemediationRows(model);
    model.exportTier = assessAuditExportTier(normalizedScan);
    return model;
}

function buildDeterministicExecutive(model) {
    const s = model.summary;
    const sev = s.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
    const gate = s.gatePass === true ? 'PASS' : s.gatePass === false ? 'REVIEW REQUIRED' : 'NOT EVALUATED';
    const readiness = model.readiness;
    const tier = model.exportTier?.tier || 'handoff';
    const stepKey = model.exportTier?.stepKey || s.scanKind || null;

    let headline;
    let intro;
    let businessImpact;

    if (tier === 'codebase-only') {
        headline = s.productionFindings > 0
            ? `Prioritize ${s.productionFindings} production-path hygiene item(s) before handoff — attach gate PASS evidence separately.`
            : `Production paths are clean under configured rules (${s.codeFilesAnalyzed?.toLocaleString() ?? '—'} files deep-scanned) — pair with gate attestation for sign-off.`;
        intro = `Supplementary codebase hygiene deliverable: deep scan on ${s.codeFilesAnalyzed?.toLocaleString() ?? '—'} source files at ${s.codebaseHealth ?? '—'}% code health. Simplebeacon gate attestation was not included in this export bundle.`;
        businessImpact = s.productionFindings > 0
            ? 'Unresolved production-path debt increases regression risk and on-call burden even when gate evidence is tracked separately.'
            : 'Codebase paths look clean under configured rules; residual risk is regression without automated gate enforcement between audits.';
    } else if (tier === 'supplementary') {
        if (stepKey === 'data-quality') {
            headline = `Data quality review: ${(s.dataQualityFindings ?? 0).toLocaleString()} finding(s) across config, privacy, and lineage — not a security gate result.`;
            intro = `Supplementary data-quality scan covering config sprawl, env keys, stale data, privacy patterns, and lineage. ${(s.dataQualityFindings ?? 0).toLocaleString()} finding(s) recorded — run Simplebeacon gate + codebase for vendor handoff.`;
            businessImpact = 'Config and lineage hygiene reduce operational risk but do not replace gate attestation or production-path deep scan evidence.';
        } else if (stepKey === 'file-reduction') {
            headline = `File reduction dry-run: ${(s.fileReductionFindings ?? 0).toLocaleString()} reclaim candidate(s) identified — review before delete.`;
            intro = `Supplementary file-reduction scan listing build artifacts, duplicate assets, and unused-file candidates (dry-run). Gate attestation and codebase deep scan are not included.`;
            businessImpact = 'Disk reclamation is operational efficiency — it does not attest production security posture for client questionnaires.';
        } else if (stepKey === 'consolidation') {
            headline = `Consolidation scan: ${(s.duplicateGroups ?? 0).toLocaleString()} exact duplicate JSON group(s) — merge candidates only.`;
            intro = `Supplementary data-consolidation scan for duplicate JSON groups and merge candidates. Not a compliance gate or codebase hygiene attestation.`;
            businessImpact = 'Duplicate data groups increase maintenance cost but are separate from credential, mock-path, and fiction KPI gate rules.';
        } else if (stepKey === 'roadmap') {
            headline = `Roadmap analysis: ${s.roadmapCompletion != null ? `${s.roadmapCompletion}% sprint completion` : 'filesystem sprint metrics'} — engineering planning, not security attestation.`;
            intro = `Supplementary roadmap analysis from filesystem structure and sprint phase detection. Use for engineering planning — not vendor security questionnaires.`;
            businessImpact = 'Roadmap metrics reflect detected project structure, not runtime security posture or gate compliance.';
        } else if (stepKey === 'cleanup-assistant') {
            headline = s.cleanupSafeFiles != null
                ? `Cleanup assistant: ${Number(s.cleanupSafeFiles).toLocaleString()} files flagged tier-1 safe — dry-run delete plan only.`
                : 'Cleanup assistant: tiered safe-delete plan — dry-run only, not a security attestation.';
            intro = 'Supplementary cleanup-assistant deliverable with tiered safe-delete recommendations and agent brief export. Gate and codebase evidence are not included.';
            businessImpact = 'Cleanup tiers reduce repository noise; they do not substitute for gate PASS or production-path audit evidence.';
        } else if (stepKey === 'mock-scan') {
            headline = `Fiction and KPI digest: ${(s.fictionKpiHits ?? 0).toLocaleString()} hit(s) in repository JSON samples.`;
            intro = `Supplementary mock-data and fiction KPI digest scoped to JSON sample files — not a full gate or codebase attestation.`;
            businessImpact = 'Fiction KPI hits in sample JSON threaten demo credibility; pair with gate scan for release evidence.';
        } else {
            headline = `${model.exportTier?.label || 'Supplementary scan'} — not a standalone pre-launch security handoff.`;
            intro = `Supplementary scan deliverable (${model.exportTier?.label || 'partial step'}). Run Analyze → Complete or combine gate attestation + codebase audit PDFs for vendor sign-off.`;
            businessImpact = 'Partial scan exports support internal triage — they do not alone satisfy vendor security questionnaire requirements.';
        }
    } else if (s.gatePass === false || sev.high) {
        headline = `Release blocked: resolve ${sev.high || s.simplebeaconIssues} gate-level issue(s) before client handoff.`;
        intro = `Independent pre-launch assessment combining Simplebeacon gate analysis (${gate}), full-tree inventory, and deep codebase hygiene on ${s.codeFilesAnalyzed?.toLocaleString() ?? '—'} source files. This deliverable is scoped to configured paths and deterministic rules — not a penetration test.`;
        businessImpact = 'Credential leaks, mock data in production paths, or fiction KPIs at this stage directly threaten client trust, incident response cost, and launch timelines.';
    } else if (s.productionFindings > 0) {
        headline = `Gate is clear. Prioritize ${s.productionFindings} production-path hygiene item(s); ${s.documentationFindings.toLocaleString()} doc-tier markers are non-blocking.`;
        intro = `Independent pre-launch assessment combining Simplebeacon gate analysis (${gate}), full-tree inventory, and deep codebase hygiene on ${s.codeFilesAnalyzed?.toLocaleString() ?? '—'} source files. This deliverable is scoped to configured paths and deterministic rules — not a penetration test.`;
        businessImpact = 'Launch is feasible from a gate perspective, but unresolved production-path debt increases regression risk, on-call burden, and the probability of embarrassing demo data surfacing post-handoff.';
    } else {
        headline = tier === 'gate-only'
            ? `Gate attestation: ${gate} — attach codebase deep-scan PDF for unified vendor handoff.`
            : 'Gate and production paths are clean under configured rules — lock in CI enforcement before release.';
        intro = tier === 'gate-only'
            ? `Supplementary gate attestation deliverable with Simplebeacon gate result (${gate}). Codebase deep scan was not included — export codebase hygiene separately or run Complete scan.`
            : `Independent pre-launch assessment combining Simplebeacon gate analysis (${gate}), full-tree inventory, and deep codebase hygiene on ${s.codeFilesAnalyzed?.toLocaleString() ?? '—'} source files. This deliverable is scoped to configured paths and deterministic rules — not a penetration test.`;
        businessImpact = tier === 'gate-only'
            ? 'Gate PASS attests configured rule compliance; pair with codebase audit evidence for full stakeholder sign-off.'
            : 'Primary residual risk is regression: without automated gate enforcement, placeholder metrics and debug artifacts can re-enter production between audits.';
    }

    return {
        verdict: readiness.label,
        intro,
        businessImpact,
        headline,
        priorities: buildExecutivePriorities(s)
    };
}

function buildExecutiveDashboardBanner(model) {
    const tier = model.exportTier || { tier: 'handoff' };
    const s = model.summary;
    const gatePass = s.gatePass === true;
    const gateLabel = gatePass ? 'PASS' : s.gatePass === false ? 'FAIL' : 'NOT EVALUATED';
    const stepKey = tier.stepKey || s.scanKind || null;
    const scopeNote = '<p class="meta" style="margin-top:10px">Gate attestation not included in this export — run Simplebeacon gate or Complete scan, or attach a gate PDF separately.</p>';

    if (tier.tier === 'handoff' || tier.tier === 'gate-only') {
        return `<div class="gate-banner ${gatePass ? 'pass' : s.gatePass === false ? 'fail' : 'fail'}">
        <div class="gate-banner-label">Overall gate result</div>
        <div class="gate-banner-value">${escapeHtml(gateLabel)}</div>
      </div>`;
    }

    if (tier.tier === 'codebase-only') {
        const health = s.codebaseHealth != null ? `${s.codebaseHealth}%` : '—';
        const files = s.codeFilesAnalyzed != null ? Number(s.codeFilesAnalyzed).toLocaleString() : '—';
        const prodFindings = s.productionFindings ?? 0;
        return `<div class="gate-banner pass">
        <div class="gate-banner-label">Codebase deep scan</div>
        <div class="gate-banner-value gate-banner-compact">${escapeHtml(files)} files · ${escapeHtml(health)} health</div>
        <p class="meta" style="margin-top:10px">${Number(prodFindings).toLocaleString()} production-path finding(s) · gate attestation not in this export</p>
      </div>`;
    }

    let bannerLabel = tier.label || 'Supplementary scan';
    let bannerValue = 'See metrics below';
    let bannerClass = 'pass';

    switch (stepKey) {
        case 'data-quality':
            bannerLabel = 'Data quality scan';
            bannerValue = `${Number(s.dataQualityFindings ?? 0).toLocaleString()} finding(s)`;
            break;
        case 'file-reduction':
            bannerLabel = 'File reduction scan';
            bannerValue = `${Number(s.fileReductionFindings ?? 0).toLocaleString()} finding(s)`;
            break;
        case 'consolidation':
            bannerLabel = 'Data consolidation scan';
            bannerValue = `${Number(s.duplicateGroups ?? 0).toLocaleString()} duplicate group(s)`;
            break;
        case 'roadmap':
            bannerLabel = 'Roadmap analysis';
            bannerValue = s.roadmapCompletion != null
                ? `${s.roadmapCompletion}% complete · ${s.roadmapSprints ?? '—'} sprints`
                : `${s.roadmapFiles != null ? Number(s.roadmapFiles).toLocaleString() : '—'} files scanned`;
            break;
        case 'cleanup-assistant':
            bannerLabel = 'Cleanup assistant';
            bannerValue = s.cleanupSafeFiles != null
                ? `${Number(s.cleanupSafeFiles).toLocaleString()} tier-1 safe file(s)`
                : 'Tiered cleanup plan';
            break;
        case 'mock-scan':
            bannerLabel = 'Fiction and KPI digest';
            bannerValue = `${Number(s.fictionKpiHits ?? 0).toLocaleString()} hit(s)`;
            break;
        default:
            bannerClass = 'fail';
            break;
    }

    return `<div class="gate-banner ${bannerClass}">
        <div class="gate-banner-label">${escapeHtml(bannerLabel)}</div>
        <div class="gate-banner-value gate-banner-compact">${escapeHtml(bannerValue)}</div>
        ${scopeNote}
      </div>`;
}

function buildExecutiveKpiStrip(model) {
    const s = model.summary;
    const tier = model.exportTier?.tier || 'handoff';
    const stepKey = model.exportTier?.stepKey || s.scanKind || null;
    const codeHealthSuffix = s.codebaseHealth != null ? '%' : '';
    const kpis = [];

    const pushKpi = (value, label) => {
        kpis.push(`<div class="kpi"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`);
    };

    if (tier === 'handoff' || tier.tier === 'gate-only') {
        pushKpi(s.simplebeaconIssues ?? 0, 'Gate issues');
        pushKpi(s.productionFindings ?? 0, 'Runtime findings');
        pushKpi(s.documentationFindings ?? 0, 'Doc-tier (info)');
        pushKpi(`${s.codebaseHealth ?? '—'}${codeHealthSuffix}`, 'Code health');
        pushKpi(s.codeFilesAnalyzed ?? '—', 'Files deep-scanned');
    } else if (tier === 'codebase-only') {
        pushKpi(s.codeFilesAnalyzed ?? '—', 'Files deep-scanned');
        pushKpi(`${s.codebaseHealth ?? '—'}${codeHealthSuffix}`, 'Code health');
        pushKpi(s.productionFindings ?? 0, 'Production findings');
        pushKpi(s.documentationFindings ?? 0, 'Doc-tier (info)');
        pushKpi('N/A', 'Gate (not scanned)');
    } else {
        switch (stepKey) {
            case 'data-quality':
                pushKpi(s.dataQualityFindings ?? 0, 'DQ findings');
                pushKpi(s.orphanedDataFiles ?? '—', 'Orphaned data');
                pushKpi(s.repositoryFiles ?? '—', 'Repo files');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'file-reduction':
                pushKpi(s.fileReductionFindings ?? 0, 'FR findings');
                pushKpi(s.fileReductionReclaimableBytes != null ? `${Math.round(s.fileReductionReclaimableBytes / 1024 / 1024)} MB` : '—', 'Reclaimable');
                pushKpi(s.repositoryFiles ?? '—', 'Repo files');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'consolidation':
                pushKpi(s.duplicateGroups ?? 0, 'Dup groups');
                pushKpi(s.repositoryFiles ?? '—', 'Repo files');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                pushKpi('N/A', 'Code health');
                break;
            case 'roadmap':
                pushKpi(s.roadmapSprints ?? '—', 'Sprints');
                pushKpi(s.roadmapCompletion != null ? `${s.roadmapCompletion}%` : '—', 'Complete');
                pushKpi(s.roadmapFiles ?? '—', 'Files scanned');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'cleanup-assistant':
                pushKpi(s.cleanupSafeFiles ?? '—', 'Safe-delete files');
                pushKpi(s.dataQualityFindings ?? '—', 'DQ findings');
                pushKpi(s.fileReductionFindings ?? '—', 'FR findings');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'mock-scan':
                pushKpi(s.fictionKpiHits ?? 0, 'Fiction/KPI hits');
                pushKpi(s.simplebeaconIssues ?? 0, 'Gate issues');
                pushKpi('N/A', 'Deep scan');
                pushKpi('N/A', 'Code health');
                pushKpi('N/A', 'Production findings');
                break;
            default:
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi(s.productionFindings ?? 0, 'Runtime findings');
                pushKpi(s.dataQualityFindings ?? '—', 'DQ findings');
                pushKpi(s.codeFilesAnalyzed ?? '—', 'Files deep-scanned');
                pushKpi(`${s.codebaseHealth ?? '—'}${codeHealthSuffix}`, 'Code health');
                break;
        }
    }

    while (kpis.length < 5) {
        pushKpi('—', 'N/A');
    }

    return kpis.slice(0, 5).join('\n        ');
}

function buildCompleteAuditPrompt(model) {
    const s = model.summary;
    return `You are writing the executive summary for a premium pre-launch codebase audit ($499 deliverable, enterprise tone). Audience: agency owner presenting to a client stakeholder.

Return STRICT JSON only (no markdown fences):
{
  "verdict": "Not ready for production | Ready with conditions | Gate clear",
  "summary": "2 professional sentences using ONLY the facts below",
  "businessImpact": "1 short paragraph on client handoff risk",
  "headline": "1 sentence priority call to action",
  "priorities": ["Concrete action using scan facts", "Second action", "Third action"]
}

FACTS (use exactly — do not invent):
Project: ${redactPathForDisplay(model.projectPath)}
Launch readiness score: ${Math.round(model.readiness.score)}/100
Gate: ${s.gatePass === true ? 'PASS' : s.gatePass === false ? 'FAIL' : 'unknown'}
Gate issues: ${s.simplebeaconIssues} (high ${s.severityCounts.high}, medium ${s.severityCounts.medium}, low ${s.severityCounts.low})
Production-path codebase findings: ${s.productionFindings} (high ${s.codeSeverity.high}, medium ${s.codeSeverity.medium}, low ${s.codeSeverity.low})
Documentation-tier markers (non-blocking): ${s.documentationFindings}
Deduped codebase total: ${s.codebaseFindingsDeduped}${s.findingsTruncated ? ` (report cap; raw scan ${s.codebaseFindingsRaw})` : ''}
Code health: ${s.codebaseHealth ?? '—'}%
Files analyzed: ${s.codeFilesAnalyzed ?? '—'} / ${s.codeFilesDiscovered ?? '—'}
Repository files indexed: ${s.repositoryFiles ?? '—'}
Duplicate groups: ${s.duplicateGroups ?? 0}

If gate PASS with 0 gate issues, do NOT say the project is blocked. Distinguish gate findings from documentation hygiene.`;
}

function parseAiExecutive(raw) {
    const trimmed = String(raw || '').trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.summary || !parsed.headline) return null;
        return {
            verdict: parsed.verdict || null,
            intro: parsed.summary,
            businessImpact: parsed.businessImpact || '',
            headline: parsed.headline,
            priorities: Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 4) : []
        };
    } catch {
        return null;
    }
}

function markdownToHtml(markdown) {
    const lines = String(markdown || '').split('\n');
    const html = [];
    let tableRows = [];

    function flushTable() {
        if (!tableRows.length) return;
        html.push('<table class="data-table"><tbody>');
        tableRows.forEach((row, index) => {
            const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
            if (!cells.length) return;
            if (index === 1 && cells.every((c) => /^[-:]+$/.test(c))) return;
            const tag = index === 0 ? 'th' : 'td';
            html.push('<tr>', ...cells.map((c) => `<${tag}>${inlineMarkdown(c)}</${tag}>`), '</tr>');
        });
        html.push('</tbody></table>');
        tableRows = [];
    }

    function inlineMarkdown(text) {
        return escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|')) {
            tableRows.push(trimmed);
            continue;
        }
        flushTable();
        if (!trimmed) continue;
        if (trimmed.startsWith('### ')) html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
        else if (trimmed.startsWith('## ')) html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
        else if (trimmed.startsWith('- ')) html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
        else html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    }
    flushTable();
    return html.join('\n');
}

function _renderFindingRows(findings, emptyMessage) {
    if (!findings.length) {
        return `<tr><td colspan="5" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
    }
    return findings.map((f) => `
        <tr>
            <td><span class="sev sev-${escapeHtml(f.severity || 'low')}">${escapeHtml(String(f.severity || 'low').toUpperCase())}</span></td>
            <td>${escapeHtml((f.category || f.type || '—').replace(/-/g, ' '))}</td>
            <td><code>${escapeHtml(f.filePath || '—')}</code>${f.line ? `<div class="meta">line ${escapeHtml(String(f.line))}</div>` : ''}</td>
            <td>${escapeHtml(f.description || f.match || '—')}</td>
            <td class="fix-cell">${escapeHtml(f.recommendedAction || 'Review and remediate before handoff')}</td>
        </tr>
    `).join('');
}

function renderCategoryRollupRows(categories) {
    if (!categories.length) return '<tr><td colspan="5" class="empty">No codebase categories in bundle.</td></tr>';
    return categories.map((c) => `
        <tr>
            <td>${escapeHtml(c.category.replace(/-/g, ' '))}</td>
            <td><strong>${c.count}</strong></td>
            <td>${c.production}</td>
            <td>${c.high || 0}</td>
            <td>${c.medium || 0} / ${c.low || 0}</td>
        </tr>
    `).join('');
}

function renderRecipeHtml(recipe) {
    const safe = escapeHtml(String(recipe || '—'));
    return safe.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderDeveloperRemediationRows(rows, summary = {}) {
    if (!rows.length) {
        return `<tr><td colspan="6" class="empty clean-scan">${escapeHtml(buildCleanScanRemediationMessage(summary))}</td></tr>`;
    }
    return rows.map((row) => `
        <tr>
            <td><span class="sev sev-${escapeHtml(row.severity || 'medium')}">${escapeHtml(String(row.severity || 'medium').toUpperCase())}</span></td>
            <td><code>${escapeHtml(row.location || '—')}</code><code class="snippet">${escapeHtml(row.snippet || '—')}</code></td>
            <td><code>${escapeHtml(row.rule || '—')}</code></td>
            <td class="impact-cell"><span class="impact-badge ${escapeHtml(row.impactClass || 'impact-review')}">${escapeHtml(row.impact || '—')}</span></td>
            <td class="recipe-cell">${renderRecipeHtml(row.recipe)}</td>
        </tr>
    `).join('');
}

function buildCoverPresentation(model) {
    const tier = model.exportTier || { tier: 'handoff', showReadinessScore: true, showSignOffBlock: true, label: 'Pre-launch security audit' };
    const s = model.summary;
    const gatePass = s.gatePass === true;
    const gateLabel = gatePass ? 'PASS' : s.gatePass === false ? 'FAIL' : 'NOT EVALUATED';
    const readiness = model.readiness;

    let kicker;
    let subtitle;
    if (tier.tier === 'handoff') {
        kicker = 'Simplebeacon · Pre-Launch Security Audit';
        subtitle = 'Formal static assessment for vendor security questionnaires, client handoff packages, and production readiness sign-off.';
    } else {
        kicker = `Simplebeacon · Supplementary — ${tier.label}`;
        subtitle = `Supplementary scan deliverable — not a standalone pre-launch security handoff. ${tier.handoffHint || ''}`.trim();
    }

    let badges = '<span class="badge badge-gold">CONFIDENTIAL</span>';
    if (tier.tier === 'handoff') {
        badges += `<span class="badge ${gatePass ? 'badge-pass' : 'badge-blocked'}">GATE ${escapeHtml(gateLabel)}</span>`;
        badges += `<span class="badge badge-gold">READINESS ${Math.round(readiness.score)}/100</span>`;
    } else if (tier.tier === 'gate-only') {
        badges += `<span class="badge ${gatePass ? 'badge-pass' : 'badge-blocked'}">GATE ${escapeHtml(gateLabel)}</span>`;
        badges += '<span class="badge badge-gold">SUPPLEMENTARY</span>';
    } else {
        badges += '<span class="badge badge-gold">SUPPLEMENTARY</span>';
        if (tier.readinessDisplay) {
            badges += `<span class="badge badge-blocked">${escapeHtml(tier.readinessDisplay)}</span>`;
        }
    }

    const supplementaryCallout = tier.tier !== 'handoff' && tier.missingForHandoff?.length
        ? `<div class="callout"><strong>Not a full handoff bundle.</strong> Missing for vendor sign-off: ${escapeHtml(tier.missingForHandoff.join(' · '))}.</div>`
        : '';

    const pageTitle = tier.tier === 'handoff'
        ? `Pre-Launch Code Audit — ${model.client}`
        : `Supplementary Audit — ${tier.label} — ${model.client}`;

    return { kicker, subtitle, badges, supplementaryCallout, pageTitle, tier };
}

function renderCompleteAuditHtml(model, options = {}) {
    const exec = options.executive || buildDeterministicExecutive(model);
    const s = model.summary;
    const risk = model.businessRiskCounts || buildBusinessRiskCounts(model);
    const cover = buildCoverPresentation(model);
    const tier = cover.tier;
    const executiveBanner = buildExecutiveDashboardBanner(model);
    const executiveKpis = buildExecutiveKpiStrip(model);
    const verificationCommand = buildVerificationCommand(model.projectPath);
    const narrativeLine = options.aiEnhanced
        ? `Executive narrative refined by ${escapeHtml(options.aiProvider || 'AI')} · all metrics and remediation rows are deterministic from scan JSON`
        : 'Deterministic executive narrative and remediation mapping generated directly from complete scan JSON — no AI inference on counts or findings.';

    const platformCell = model.platformRoot
        ? ' · platform <code>' + escapeHtml(redactPathForDisplay(model.platformRoot)) + '</code>'
        : '';
    const scanDurationNote = model.scanDurationMs
        ? ' · execution ' + escapeHtml(formatScanDuration(model.scanDurationMs))
        : '';
    const qualityScoreCell = (s.qualityScore != null ? escapeHtml(String(s.qualityScore)) + '%' : '—')
        + ' · code health '
        + (s.codebaseHealth != null ? escapeHtml(String(s.codebaseHealth)) + '%' : '—')
        + ' · audit confidence '
        + (s.confidenceScore != null ? escapeHtml(String(s.confidenceScore)) + '/100' : '—');
    const section03IntroSuffix = s.codebaseFindingsRaw > (model.remediationRows?.length || 0)
        ? ' from ' + Number(s.codebaseFindingsRaw).toLocaleString() + ' total scan match(es)'
        : '';
    const section03CapCallout = (model.remediationRows || []).length >= MAX_REMEDIATION_ROWS
        ? '<div class="callout">Section 03 lists the first <strong>' + MAX_REMEDIATION_ROWS + '</strong> prioritized runtime-path rows. Every row is complete — nothing is cut mid-sentence. Export the complete-scan JSON for the full match list.</div>'
        : '';
    const tierExclusionCallout = s.documentationFindings > 0 || s.generalFindings > 0
        ? '<div class="callout"><strong>' + s.documentationFindings.toLocaleString() + ' documentation-tier</strong> and <strong>' + (s.generalFindings || 0).toLocaleString() + ' tooling/script-tier</strong> markers were excluded from Section 03 — they are tracked for hygiene but not release blockers.</div>'
        : '';
    const categoryScopeNote = s.findingsTruncated
        ? ' (' + Number(s.codebaseFindingsRaw).toLocaleString() + ' total scan matches before cap)'
        : '';
    const consolidationMeta = model.consolidationSummary
        ? '<p class="meta">Consolidation: ' + escapeHtml(String(model.consolidationSummary.exactDuplicateGroups ?? 0)) + ' duplicate group(s) · ' + escapeHtml(String(model.consolidationSummary.jsonFilesAnalyzed ?? '—')) + ' JSON files hashed.</p>'
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0d1117">
  <title>${escapeHtml(cover.pageTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${getAuditReportStyles()}
  </style>
</head>
<body>
  <section class="cover-page">
    <p class="cover-kicker">${escapeHtml(cover.kicker)}</p>
    <h1 class="cover-title">${escapeHtml(model.client)}</h1>
    <p class="cover-sub">${escapeHtml(cover.subtitle)}</p>
    <div class="cover-meta">
      <div><strong>Report ID:</strong> ${escapeHtml(model.reportId)}</div>
      <div><strong>Executed:</strong> ${escapeHtml(formatReportTimestamp(model.generatedAt))}</div>
      <div><strong>Client:</strong> ${escapeHtml(model.company)}</div>
      <div><strong>Assessor:</strong> ${escapeHtml(model.assessor)}</div>
      <div><strong>Engine:</strong> ${escapeHtml(model.engineLabel)}</div>
      <div><strong>Repository:</strong> ${escapeHtml(model.repositoryLabel)} / ${escapeHtml(model.branch)}</div>
    </div>
    <div class="cover-badges">
      ${cover.badges}
    </div>
    ${cover.supplementaryCallout}
    <p class="confidential">Prepared for authorized business and engineering recipients. This document combines executive risk metrics for leadership and deterministic remediation mapping for developers.</p>
  </section>

  <main>
    <section class="section">
      <div class="section-num">Section 01</div>
      <h2>Audit Metadata &amp; Ledger</h2>
      <p class="meta">Establishes consulting authority, scan scope, and performance evidence for this engagement.</p>
      <table class="data-table ledger-table">
        <tr><td>Client name</td><td>${escapeHtml(model.company)}</td></tr>
        <tr><td>Target repository / branch</td><td><code>${escapeHtml(model.repositoryLabel)}</code> / <code>${escapeHtml(model.branch)}</code>${platformCell}</td></tr>
        <tr><td>Timestamp</td><td>${escapeHtml(formatReportTimestamp(model.generatedAt))}</td></tr>
        <tr><td>Engine core version</td><td>${escapeHtml(model.engineLabel)}</td></tr>
        <tr><td>Scan performance ledger</td><td>${escapeHtml(formatLedgerFilesScanned(s))}${scanDurationNote}</td></tr>
        <tr><td>Report assessor</td><td>${escapeHtml(model.assessor)}</td></tr>
        <tr><td>Quality score</td><td>${qualityScoreCell}</td></tr>
      </table>
    </section>

    <section class="section">
      <div class="section-num">Section 02</div>
      <h2>Executive Dashboard (CFO View)</h2>
      <p class="meta">${narrativeLine}</p>
      ${executiveBanner}
      <table class="data-table">
        <tr><th>Risk tier</th><th>Count</th><th>Business meaning</th></tr>
        <tr>
          <td><span class="tier-dot tier-critical"></span>Critical</td>
          <td><strong>${risk.critical.toLocaleString()}</strong></td>
          <td>High-risk cloud exposure — private keys, AWS/Stripe/API tokens in source</td>
        </tr>
        <tr>
          <td><span class="tier-dot tier-high"></span>High</td>
          <td><strong>${risk.high.toLocaleString()}</strong></td>
          <td>Structural release risk — mock/sample paths referenced from production code</td>
        </tr>
        <tr>
          <td><span class="tier-dot tier-medium"></span>Medium</td>
          <td><strong>${risk.medium.toLocaleString()}</strong></td>
          <td>AI-fiction and hygiene patterns — placeholders, fake KPIs, debug artifacts</td>
        </tr>
      </table>
      <div class="exec-box">
        <p>${escapeHtml(exec.intro)}</p>
        <p class="exec-headline">${escapeHtml(exec.headline)}</p>
        <ol>${(exec.priorities || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ol>
      </div>
      <div class="kpi-strip">
        ${executiveKpis}
      </div>
    </section>

    <section class="section">
      <div class="section-num">Section 03</div>
      <h2>Developer Action Plan (Technical Recipe Book)</h2>
      <p class="meta">Each row maps scan JSON to a full remediation chain: raw file flag → business impact → safe copy-paste fix recipe. Showing up to ${MAX_REMEDIATION_ROWS} prioritized rows${section03IntroSuffix}.</p>
      <table class="data-table remediation-recipe-table">
        <tr><th>Severity</th><th>File &amp; snippet</th><th>Rule triggered</th><th>Why it breaks (impact)</th><th>Safe code fix recipe</th></tr>
        ${renderDeveloperRemediationRows(model.remediationRows || [], s)}
      </table>
      ${section03CapCallout}
      ${tierExclusionCallout}
      <div class="verify-block">
        <h3>Local verification before re-submit</h3>
        <p class="meta">After engineering applies the recipes above, prove a clean gate locally — without waiting for a re-audit.</p>
        <div class="command-box">${escapeHtml(verificationCommand)}</div>
      </div>
      <h3>Category distribution (runtime scope)</h3>
      <p class="meta">Counts below reflect runtime-path findings included in this audit sample${categoryScopeNote}.</p>
      <table class="data-table">
        <tr><th>Category</th><th>Total</th><th>Production paths</th><th>High</th><th>Med / Low</th></tr>
        ${renderCategoryRollupRows(model.categoryRollup)}
      </table>
    </section>

    <section class="section">
      <div class="section-num">Section 04</div>
      <h2>Compliance &amp; Git Gate Recommendations</h2>
      <p class="meta">Continuous evaluation checklist and automated prevention steps for the engineering team.</p>
      <h3>Continuous evaluation checklist</h3>
      ${markdownToHtml(model.markdown.compliance)}
      <h3>Automated next step — local pre-commit hook</h3>
      <div class="command-box">npx simplebeacon hook install</div>
      <p class="meta">Install the open-source local hook so credential, mock-path, and fiction KPI patterns cannot re-enter the repository before commit.</p>
      <h3>Recommended CI gate</h3>
      <div class="command-box">npx simplebeacon scan --gate --format json --output .simplebeacon/report.json</div>
      <p class="meta">Add <code>.github/workflows/simplebeacon-gate.yml</code> from Simplebeacon examples so pull requests fail on configured high-severity findings.</p>
      <div class="disclaimer-box">
        <strong>Independent disclaimer.</strong> This assessment is an opinion-based, static technical review of the source files and configured scan paths at the time of evaluation. It is not a legal compliance guarantee, formal penetration test, SOC 2 attestation, or certification that the system is secure in production. The client remains responsible for remediation, release authorization, and ongoing security posture.
      </div>
    </section>

    ${tier.showSignOffBlock ? `
    <section class="section signoff-section">
      <div class="section-num">Section 05</div>
      <h2>Simplebeacon production compliance sign-off</h2>
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
    ` : `
    <section class="section signoff-section">
      <div class="section-num">Section 05</div>
      <h2>Production compliance sign-off</h2>
      <p class="meta">Not applicable for supplementary deliverables. Run Analyze → Complete (gate + codebase) for a unified handoff PDF, or combine gate attestation and codebase audit exports.</p>
    </section>
    `}

    <section class="section">
      <div class="section-num">Appendix</div>
      <h2>Methodology &amp; scan scope</h2>
      <ul>${model.scopeLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      ${consolidationMeta}
    </section>

    <div class="footer">
      <p><strong>Report ID ${escapeHtml(model.reportId)}</strong> · Generated ${escapeHtml(formatReportTimestamp(model.generatedAt))} by Simplebeacon</p>
      <p>Print this document (Ctrl+P / Cmd+P) → Destination: <strong>Save as PDF</strong> · Recommended filename: <code>${escapeHtml(model.reportId)}.pdf</code></p>
    </div>
  </main>
</body>
</html>`;
}

async function buildCompleteAuditReport(completeScan, options = {}) {
    const normalizedScan = normalizeCompleteScanInput(completeScan) || completeScan;
    const model = buildCompleteAuditModel(normalizedScan, options);
    const deterministic = buildDeterministicExecutive(model);
    let executive = deterministic;
    let aiEnhanced = false;
    const aiProvider = options.aiProvider || 'demo';
    const allowAiExecutive = options.enhanceExecutive === true
        && aiProvider
        && aiProvider !== 'demo'
        && options.summarizeFn;

    if (allowAiExecutive) {
        try {
            const prompt = buildCompleteAuditPrompt(model);
            const result = await options.summarizeFn(aiProvider, { prompt, projectPath: model.projectPath }, options);
            const parsed = parseAiExecutive(result?.summary);
            if (parsed) {
                executive = mergeExecutiveSummary(deterministic, parsed);
                aiEnhanced = true;
            }
        } catch {
            executive = deterministic;
        }
    }

    const html = renderCompleteAuditHtml(model, {
        executive,
        aiEnhanced,
        aiProvider: aiEnhanced ? aiProvider : 'deterministic'
    });

    const slug = redactPathForDisplay(model.projectPath).replace(/[^\w.-]+/g, '-').slice(0, 40);
    const _date = new Date(model.generatedAt).toISOString().slice(0, 10);

    return {
        html,
        filename: `${model.reportId}-${slug}.html`,
        model,
        aiEnhanced,
        aiProvider: aiEnhanced ? aiProvider : 'deterministic',
        tier: model.exportTier?.tier || 'handoff',
        exportTierLabel: model.exportTier?.label || 'Pre-launch security audit',
        missingForHandoff: model.exportTier?.missingForHandoff || []
    };
}

function buildSampleAuditReportModel() {
    const model = buildSampleAuditReportModelFromFixtures(ENGINE_VERSION);
    model.readiness = buildLaunchReadiness(model);
    model.summary.confidenceScore = calculateAuditConfidence(model.summary, {
        credentialScanned: 342,
        productionLeakScanned: 298,
        schemaChecked: 12,
        schemaPassed: 12,
        ruleScopedFilesAnalyzed: 342
    });
    model.businessRiskCounts = buildBusinessRiskCounts(model);
    model.remediationRows = (model.remediationRows || []).map(enrichRemediationRow);
    return model;
}

function buildSampleAuditReportHtml(options = {}) {
    const model = buildSampleAuditReportModel();
    const auditHtml = renderCompleteAuditHtml(model, {
        executive: buildDeterministicExecutive(model)
    });

    if (options.siteChrome === false) {
        return auditHtml;
    }

    const siteStyles = `
    .sample-site-bar {
      position: sticky; top: 0; z-index: 20;
      background: rgba(210, 153, 34, 0.12);
      border-bottom: 1px solid rgba(210, 153, 34, 0.35);
      padding: 10px 16px; font-size: 10pt; color: #e3b341;
    }
    .sample-site-bar strong { color: #f0c14b; }
    .sample-site-bar a { color: #79c0ff; font-weight: 600; margin-left: 12px; text-decoration: none; }
    .sample-site-nav {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 8px 16px; max-width: 920px; margin: 0 auto 0; padding: 12px 52px;
      background: rgba(13, 17, 23, 0.92);
      border-bottom: 1px solid #21262d;
      color: #e6edf3; font-size: 10pt;
      backdrop-filter: blur(12px);
    }
    .sample-site-nav .brand { font-weight: 700; letter-spacing: -0.02em; }
    .sample-site-nav a { color: #8b949e; text-decoration: none; margin-left: 14px; }
    .sample-site-nav a:hover { color: #e6edf3; }
    @media print {
      .sample-site-bar, .sample-site-nav { display: none !important; }
    }`;

    const siteBar = `
    <div class="sample-site-bar" role="status">
      <strong>Sample deliverable only.</strong> Fictional client and redacted paths.
      Paid audits use this same dark layout with your repository&rsquo;s actual findings.
      <a href="/">Home</a><a href="/pricing">Pricing</a><a href="/" data-stripe-checkout>Book audit &mdash; $499</a>
    </div>
    <div class="sample-site-nav">
      <span class="brand">🛡️ SimpleBeacon</span>
      <span><a href="/">Home</a><a href="/sample-report">Sample report</a><a href="mailto:audit@simplebeacon.ai">audit@simplebeacon.ai</a></span>
    </div>`;

    return auditHtml
        .replace('</head>', `<style>${siteStyles}</style></head>`)
        .replace('<body>', `<body>${siteBar}`);
}

function wrapSampleReportForWebsite(_fullHtml) {
    return buildSampleAuditReportHtml({ siteChrome: true });
}

module.exports = {
    buildCompleteAuditModel,
    buildCompleteAuditPrompt,
    buildDeterministicExecutive,
    renderCompleteAuditHtml,
    buildCompleteAuditReport,
    buildSampleAuditReportModel,
    buildSampleAuditReportHtml,
    wrapSampleReportForWebsite,
    getAuditReportStyles,
    markdownToHtml,
    dedupeFindings,
    enrichFindings,
    isProductionCodePath,
    isAuditProductionRuntimePath,
    mergeExecutiveSummary,
    normalizeSimplebeaconForCompliance,
    isPlaceholderExecutiveText,
    normalizeCompleteScanInput,
    hydrateCompleteScanFromSteps,
    completeScanHasExportableResults,
    buildLaunchReadiness,
    calculateAuditConfidence,
    buildExecutivePriorities,
    buildCleanScanRemediationMessage
};
