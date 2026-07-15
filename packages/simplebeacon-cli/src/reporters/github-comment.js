/**
 * GitHub pull-request comment formatter for simplebeacon reports.
 */

const { GUIDE_PLAYBOOKS, issueKind } = require('./remediation-guides');

function isAnonymizedReport(report) {
    return report.schemaVersion === 'anonymized-v1' || report.repoFingerprint != null;
}

function severityRank(severity) {
    const band = String(severity || 'medium').toLowerCase();
    if (band === 'critical') return 0;
    if (band === 'high') return 1;
    if (band === 'medium') return 2;
    if (band === 'low') return 3;
    return 4;
}

function normalizeIssues(report) {
    const raw = report.rawIssues || report.detectedIssues || report.issues || [];
    return raw.map((issue) => ({
        severity: String(issue.severity || issue.severityBand || 'medium').toLowerCase(),
        type: issue.type || issue.pattern || issue.category || 'Finding',
        pattern: issue.pattern || issue.type || '',
        filePath: issue.filePath || issue.file || '',
        line: issue.line || issue.lineNumber || null,
        description: issue.description || issue.message || issue.summary || '',
        remediation: issue.remediation || issue.fix || ''
    }));
}

function githubFileLink(filePath, line, options = {}) {
    if (!filePath) return '';
    const repo = options.repo || process.env.GITHUB_REPOSITORY || '';
    const server = (options.serverUrl || process.env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, '');
    const ref = options.ref || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'main';
    const normalized = String(filePath).replace(/\\/g, '/');
    if (!repo) {
        return line ? `\`${normalized}:${line}\`` : `\`${normalized}\``;
    }
    const anchor = line ? `#L${line}` : '';
    return `[${normalized}${line ? `:${line}` : ''}](${server}/${repo}/blob/${ref}/${normalized}${anchor})`;
}

function fixHint(issue) {
    if (issue.remediation) return issue.remediation;
    const kind = issueKind(issue);
    const guide = GUIDE_PLAYBOOKS[kind];
    if (guide && guide.steps && guide.steps[0]) {
        return guide.steps[0];
    }
    if (kind === 'credentials') return 'Rotate the secret and move it to an environment variable.';
    if (kind === 'production-leak') return 'Replace mock/sample JSON imports with API-backed config.';
    if (kind === 'fiction-kpi') return 'Replace placeholder KPI literals with measured baseline values.';
    return 'Run `npx simplebeacon scan --gate` locally and review the flagged pattern.';
}

function formatIssueRow(issue, options) {
    const sev = issue.severity.toUpperCase();
    const where = githubFileLink(issue.filePath, issue.line, options);
    const hint = fixHint(issue);
    return [
        `**${sev} · ${issue.type}**`,
        `- **Where:** ${where}`,
        `- **Why:** ${issue.description || 'Policy violation detected in changed code.'}`,
        `- **Fix:** ${hint}`
    ].join('\n');
}

function formatGithubComment(report, gateResult = null, options = {}) {
    const anonymized = isAnonymizedReport(report);
    const counts = report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
    const gate = gateResult || report.gate || null;
    const pass = Boolean(gate?.pass);
    const diffOnly = Boolean(report.scanScope?.diffOnly);
    const diffCount = report.scanScope?.diffFileCount || 0;
    const dashboardUrl = options.dashboardUrl || 'https://simplebeacon.ai/dashboard/dashboard';
    const pricingUrl = report.sandbox?.upgradeUrl || options.pricingUrl || 'https://simplebeacon.ai/pricing';

    const headline = pass
        ? '✅ SimpleBeacon gate **passed** — safe to merge from a policy perspective.'
        : '❌ SimpleBeacon gate **failed** — merge blocked until blocking findings are resolved.';

    const lines = [
        '## 🔦 SimpleBeacon — AI Circuit Breaker',
        '',
        headline,
        ''
    ];

    if (report.sandbox?.active) {
        lines.push(
            `> 💡 **Running in Sandbox Mode.** To unlock full multi-repo dashboards, team alert integrations, and custom policy rules for your engineering team, [upgrade at ${pricingUrl}](${pricingUrl}).`
        );
        lines.push('');
    }

    lines.push(
        '| Metric | Value |',
        '|--------|-------|',
        `| Gate | ${pass ? 'PASS' : 'FAIL'} |`,
        `| Quality score | ${report.qualityScore ?? '—'}/100 |`,
        `| Critical | ${counts.critical || 0} |`,
        `| High | ${counts.high || 0} |`,
        `| Medium | ${counts.medium || 0} |`,
        `| Scope | ${diffOnly ? `PR diff (${diffCount} files)` : 'Full configured scan paths'} |`,
        ''
    );

    if (anonymized) {
        lines.push('🔒 **Privacy-blind scan** — no source paths were transmitted.');
        lines.push('');
    }

    const failOn = gate?.failOn || report.scanScope?.gatePolicy?.failOn || ['high'];
    lines.push(`<details${pass ? '' : ' open'}>`);
    lines.push(`<summary><strong>${pass ? 'Scan summary' : `Blocking findings (${gate?.blockingCount || 0})`}</strong></summary>`);
    lines.push('');
    lines.push(`_Fails on: ${Array.isArray(failOn) ? failOn.join(', ') : failOn}_`);
    lines.push('');

    const issues = normalizeIssues(report)
        .filter((issue) => pass || severityRank(issue.severity) <= 1)
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

    if (!issues.length) {
        lines.push('No blocking findings in this scan scope.');
    } else {
        const top = issues.slice(0, 8);
        top.forEach((issue, index) => {
            lines.push(`### ${index + 1}. ${issue.type}`);
            lines.push(formatIssueRow(issue, options));
            lines.push('');
        });
        if (issues.length > top.length) {
            lines.push(`<details><summary>+ ${issues.length - top.length} more finding(s)</summary>`);
            lines.push('');
            issues.slice(top.length, 20).forEach((issue, index) => {
                lines.push(`**${index + top.length + 1}.** ${formatIssueRow(issue, options)}`);
                lines.push('');
            });
            lines.push('</details>');
        }
    }
    lines.push('</details>');
    lines.push('');
    lines.push('---');
    lines.push(`[Team dashboard](${dashboardUrl}) · [Upgrade for org-wide CI history](${pricingUrl})`);
    lines.push('');
    lines.push('_SimpleBeacon gates AI slop, credential leaks, and mock-path drift — complementary to Snyk/GHAS._');

    return lines.join('\n');
}

function formatGithubStepSummary(report, gateResult = null) {
    const gate = gateResult || report.gate || null;
    const counts = report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
    const diffNote = report.scanScope?.diffOnly
        ? ` · diff-only (${report.scanScope.diffFileCount || 0} files)`
        : '';
    const sandboxNote = report.sandbox?.active
        ? ` · 🏖️ Sandbox Mode — [upgrade to unlock team features](${report.sandbox.upgradeUrl || 'https://simplebeacon.ai/pricing'})`
        : '';
    return [
        '## SimpleBeacon',
        '',
        gate ? (gate.pass ? '✅ Gate **PASS**' : '❌ Gate **FAIL**') : 'Gate not evaluated',
        '',
        `- Critical: ${counts.critical || 0} · High: ${counts.high || 0} · Medium: ${counts.medium || 0} · Low: ${counts.low || 0}${diffNote}`,
        `- Files: ${report.totalFiles ?? 0} · Quality: ${report.qualityScore ?? '—'}%${sandboxNote}`,
        ''
    ].join('\n');
}

async function postGithubComment(reportPath, options = {}) {
    const token = options.token || process.env.GITHUB_TOKEN;
    const repo = options.repo || process.env.GITHUB_REPOSITORY;
    const issueNumber = options.issueNumber || process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER
        || process.env.GITHUB_PR_NUMBER;

    if (!token) throw new Error('GITHUB_TOKEN is required to post PR comments');
    if (!repo) throw new Error('GITHUB_REPOSITORY is required to post PR comments');
    if (!issueNumber) throw new Error('Pull request number is required (GITHUB_EVENT_PULL_REQUEST_NUMBER)');

    const fs = require('fs');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const body = formatGithubComment(report, report.gate || null, options);

    const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;
    const response = await globalThis.fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'simplebeacon'
        },
        body: JSON.stringify({ body })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub API ${response.status}: ${text}`);
    }

    return response.json();
}

module.exports = {
    formatGithubComment,
    formatGithubStepSummary,
    postGithubComment,
    githubFileLink,
    fixHint
};
