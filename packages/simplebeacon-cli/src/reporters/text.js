/**
 * Text reporter for simplebeacon scan results.
 */

const {
    GUIDE_PLAYBOOKS,
    issueKind,
    collectActiveGuideIds
} = require('./remediation-guides');

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

function colorEnabled() {
    if (process.env.NO_COLOR != null) return false;
    if (process.env.FORCE_COLOR === '0') return false;
    return process.stdout.isTTY === true;
}

function paint(text, color) {
    if (!colorEnabled()) return text;
    return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function severityColor(severity) {
    if (severity === 'critical') return 'red';
    if (severity === 'high') return 'red';
    if (severity === 'medium') return 'yellow';
    return 'dim';
}

function formatTextReport(report, gateResult = null) {
    const { detectTier } = require('../lib/tier-detector');
    const tierInfo = detectTier();
    const isPaid = tierInfo.paid;

    const lines = [];
    lines.push(paint('Simplebeacon', 'cyan'));
    lines.push('==================');
    lines.push(`Root: ${report.projectRoot || 'unknown'}`);
    if (report.repositoryFilesTotal != null) {
        lines.push(`Repository files: ${report.repositoryFilesTotal.toLocaleString()}`);
    }
    lines.push(`Gate rules checked: ${(report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? report.totalFiles ?? 0)} files`);
    if (report.mockSampleFiles != null) {
        lines.push(`Mock/sample files: ${report.mockSampleFiles}`);
    }
    // Show quality score for all users
    lines.push(`Quality score: ${(report.qualityScore ?? 0)}/100`);
    lines.push('');

    // Remove free tier limitations
    // if (!isPaid) {
    //     lines.push(paint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow'));
    //     lines.push(paint('  FREE TIER — showing first 5 findings only', 'yellow'));
    //     lines.push(paint('  Upgrade: https://simplebeacon.ai/pricing', 'yellow'));
    //     lines.push(paint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow'));
    //     lines.push('');
    // }

    const counts = report.severityCounts || {};
    lines.push(
        `${paint('Critical', 'red')}: ${counts.critical || 0}  `
        + `${paint('High', 'red')}: ${counts.high || 0}  `
        + `${paint('Medium', 'yellow')}: ${counts.medium || 0}  `
        + `${paint('Low', 'dim')}: ${counts.low || 0}`
    );
    if (report.productionLeakScanned != null) {
        lines.push(`Production files scanned: ${report.productionLeakScanned} (${report.productionLeakFindings || 0} leak(s))`);
    }
    if (report.credentialScanned != null) {
        lines.push(`Credential files scanned: ${report.credentialScanned} (${report.credentialFindings || 0} finding(s))`);
    }
    if (report.jestBaselineChecked) {
        lines.push(`Jest baseline: ${report.jestBaselinePassed ? paint('PASS', 'green') : paint('FAIL', 'red')}`);
    }
    lines.push('');

    if (gateResult) {
        lines.push(gateResult.pass ? paint('Gate: PASS', 'green') : paint('Gate: FAIL', 'red'));
        lines.push('');
    }

    const issues = report.rawIssues || [];
    if (issues.length === 0) {
        lines.push(paint('No issues detected.', 'green'));
        return lines.join('\n');
    }

    const displayLimit = 1000; // Show all findings instead of capping
    lines.push('Issues:');
    for (const issue of issues.slice(0, displayLimit)) {
        const label = `[${issue.severity}] ${issue.type}`;
        lines.push(`  ${paint(label, severityColor(issue.severity))}: ${issue.description}`);
    }

    const hiddenCount = issues.length - displayLimit;
    if (hiddenCount > 0) {
        lines.push(`  ... and ${hiddenCount} more`);
    }

    return lines.join('\n');
}

function formatActionPlanReport(report, gateResult = null) {
    const lines = [];
    lines.push(paint('Simplebeacon Action Plan', 'cyan'));
    lines.push('========================');
    lines.push(`Root: ${report.projectRoot || 'unknown'}`);
    lines.push(`Quality score: ${(report.qualityScore ?? 0)}/100`);
    lines.push('');

    if (gateResult) {
        lines.push(gateResult.pass ? paint('Gate: PASS', 'green') : paint('Gate: FAIL', 'red'));
        lines.push('');
    }

    const counts = report.severityCounts || {};
    lines.push('Severity counts:');
    lines.push(`  ${paint('Critical', 'red')}: ${counts.critical || 0}`);
    lines.push(`  ${paint('High', 'red')}: ${counts.high || 0}`);
    lines.push(`  ${paint('Medium', 'yellow')}: ${counts.medium || 0}`);
    lines.push(`  ${paint('Low', 'dim')}: ${counts.low || 0}`);
    lines.push('');

    const issues = report.rawIssues || [];
    if (issues.length === 0) {
        lines.push(paint('No issues detected. No action required.', 'green'));
        return lines.join('\n');
    }

    const guideIds = collectActiveGuideIds(issues, null)
        .filter((id) => id !== 'ci-integration' && id !== 'roadmap');

    if (guideIds.length === 0) {
        lines.push(paint('No prioritized action items — scan is clean under configured paths.', 'green'));
        return lines.join('\n');
    }

    const kindCounts = {};
    for (const issue of issues) {
        const kind = issueKind(issue);
        if (GUIDE_PLAYBOOKS[kind]) {
            kindCounts[kind] = (kindCounts[kind] || 0) + (issue.count || 1);
        }
    }

    const orderedIds = [
        'credentials',
        'production-leak',
        'npm-audit',
        'fiction-kpi',
        'schema',
        'roadmap',
        'ci-integration'
    ].filter((id) => guideIds.includes(id));

    const ESTIMATES = {
        credentials: 45,
        'production-leak': 60,
        'fiction-kpi': 35,
        schema: 30,
        'npm-audit': 20,
        roadmap: 10
    };

    let totalMinutes = 0;
    lines.push(paint('Prioritized Remediation', 'cyan'));
    lines.push('');

    for (const id of orderedIds) {
        const guide = GUIDE_PLAYBOOKS[id];
        const count = kindCounts[id] || 0;
        const est = ESTIMATES[id] || 30;
        totalMinutes += est;
        const diffColor = guide.difficulty === 'Easy' ? 'green' : (guide.difficulty === 'Moderate' ? 'yellow' : 'red');
        lines.push(`${paint(`[${guide.difficulty}]`, diffColor)} ${guide.title}${count > 1 ? ` (${count} findings)` : ''}`);
        lines.push(`  Time: ${guide.timeRequired}`);
        lines.push(`  Impact: ${guide.whyItMatters}`);
        lines.push('  Steps:');
        for (const step of guide.steps) {
            lines.push(`    • ${step}`);
        }
        lines.push(`  Verify: ${guide.verify}`);
        lines.push('');
    }

    const hours = Math.max(1, Math.round(totalMinutes / 60));
    lines.push(`Estimated total effort: ~${hours} hour${hours === 1 ? '' : 's'}`);
    lines.push(paint('Run `npx simplebeacon scan --gate` after fixes to verify.', 'green'));

    return lines.join('\n');
}

module.exports = {
    formatTextReport,
    formatActionPlanReport,
    paint,
    colorEnabled
};
