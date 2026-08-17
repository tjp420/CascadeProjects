/**
 * MCP report handlers — gate_status, suggest_fixes, get_action_plan, compliance_checklist, export_report
 */

const fs = require('fs');
const path = require('path');
const { readFile, writeFile, mkdir, stat } = fs.promises;
const { readGateStatus } = require('../../lib/snippet-scanner');
const {
    resolveAgentTier,
    assertCapability,
    FREE_SUGGEST_FIX_CAP,
    UPGRADE_URL
} = require('../../lib/agent-tier-capabilities');

function createReportHandlers({ withGuard, withTierGuard, resolveProjectRoot, formatToolResult, _formatMarkdownResult, getCachedReport }) {
    return {
        gate_status: withGuard(({ projectRoot, reportPath, limit }) => {
            const result = readGateStatus(resolveProjectRoot(projectRoot), {
                reportPath,
                limit: limit ? Number(limit) : 12
            });
            return formatToolResult(result);
        }),

        suggest_fixes: withGuard(async ({ projectRoot, reportPath, maxFixes }) => {
            const root = resolveProjectRoot(projectRoot);
            const tierCtx = resolveAgentTier();
            let report = getCachedReport(root);
            if (!report) {
                const rp = reportPath ? path.resolve(root, reportPath) : path.join(root, '.simplebeacon', 'report.json');
                try {
                    report = JSON.parse(await readFile(rp, 'utf8'));
                } catch {
                    return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
                }
            }
            const issues = (report.detectedIssues || report.rawIssues || []).filter(i => i.severity === 'critical' || i.severity === 'high');
            const cap = tierCtx.paid
                ? (maxFixes ? Number(maxFixes) : 5)
                : FREE_SUGGEST_FIX_CAP;
            const codePayload = report.codeSuggestions || require('../../lib/code-suggestions').buildCodeSuggestions(report);
            const hintByPath = new Map(
                (codePayload.suggestions || []).map((s) => [
                    `${s.patternId}|${s.filePath}|${s.line || ''}`,
                    s
                ])
            );
            const suggestions = issues.slice(0, cap).map((issue, idx) => {
                const patternId = issue.pattern || issue.rule || issue.type;
                const filePath = issue.filePath || issue.path || 'unknown';
                const hint = hintByPath.get(`${patternId}|${filePath}|${issue.line || ''}`)
                    || (codePayload.suggestions || []).find((s) => s.filePath === filePath && s.patternId === patternId);
                return {
                    priority: idx + 1,
                    severity: issue.severity,
                    type: issue.type || issue.rule || 'unknown',
                    filePath,
                    line: issue.line || hint?.line || null,
                    description: issue.description || issue.impact || 'Review required',
                    recommendedAction: tierCtx.paid
                        ? (hint?.suggestion || issue.fix || issue.recommendedAction || issue.recommendation || 'Manual review required')
                        : 'Upgrade to see remediation steps',
                    codeHint: tierCtx.paid ? (hint?.codeHint || null) : null,
                    autoFixable: tierCtx.paid ? Boolean(hint?.autoFixable) : false,
                    effort: hint?.effort || (issue.severity === 'critical' ? 'high' : 'medium')
                };
            });
            return formatToolResult({
                totalIssues: issues.length,
                suggestions,
                quickWins: (codePayload.quickWins || []).slice(0, 3),
                summary: `${suggestions.length} prioritized fixes from ${issues.length} blocking/high issues.`,
                methodology: 'Deterministic rule mapping — no LLM inference',
                agentExperience: tierCtx.paid ? '11/10' : '2/10',
                ...(!tierCtx.paid ? {
                    upsell: 'Upgrade for full suggest_fixes, propose_fix, and verify_fix — https://simplebeacon.ai/pricing',
                    upgradeUrl: UPGRADE_URL
                } : {})
            });
        }),

        code_suggestions: withGuard(async ({ projectRoot, reportPath, maxSuggestions }) => {
            const root = resolveProjectRoot(projectRoot);
            let report = getCachedReport(root);
            if (!report) {
                const rp = reportPath ? path.resolve(root, reportPath) : path.join(root, '.simplebeacon', 'report.json');
                try {
                    report = JSON.parse(await readFile(rp, 'utf8'));
                } catch {
                    const frPath = path.join(root, '.simplebeacon', 'file-reduction-report.json');
                    try {
                        report = JSON.parse(await readFile(frPath, 'utf8'));
                    } catch {
                        return formatToolResult({ error: 'No scan report found. Run scan_project or file reduction first.' });
                    }
                }
            }
            const { buildCodeSuggestions, formatCodeSuggestionsMarkdown } = require('../../lib/code-suggestions');
            const payload = report.codeSuggestions || buildCodeSuggestions(report, {
                maxSuggestions: maxSuggestions ? Number(maxSuggestions) : 20
            });
            return formatToolResult({
                ...payload,
                markdown: formatCodeSuggestionsMarkdown(payload),
                artifacts: ['.simplebeacon/code-suggestions.md', '.simplebeacon/code-suggestions.json'],
                methodology: payload.methodology,
                localOnly: true
            });
        }),

        master_engineering_brief: withGuard(async ({ projectRoot, refresh }) => {
            const root = resolveProjectRoot(projectRoot);
            const { buildMasterEngineeringBrief, formatMasterEngineeringMarkdown, writeMasterEngineeringArtifacts } = require('../../lib/master-engineering-brief');
            if (refresh === true) {
                const written = writeMasterEngineeringArtifacts(root);
                return formatToolResult({
                    ...written.brief,
                    markdown: formatMasterEngineeringMarkdown(written.brief),
                    refreshed: true,
                    localOnly: true
                });
            }
            const brief = buildMasterEngineeringBrief(root);
            return formatToolResult({
                ...brief,
                markdown: formatMasterEngineeringMarkdown(brief),
                localOnly: true
            });
        }),

        get_action_plan: withTierGuard('get_action_plan', withGuard(async ({ projectRoot, reportPath }) => {
            const root = resolveProjectRoot(projectRoot);
            let report = getCachedReport(root);
            if (!report) {
                const rp = reportPath ? path.resolve(root, reportPath) : path.join(root, '.simplebeacon', 'report.json');
                try {
                    report = JSON.parse(await readFile(rp, 'utf8'));
                } catch {
                    return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
                }
            }
            const { formatActionPlanReport } = require('../../reporters/text');
            const { evaluateGate } = require('../../gate');
            const { loadSimplebeaconConfig } = require('../../config');
            let gateResult = null;
            try {
                const config = loadSimplebeaconConfig(root);
                gateResult = evaluateGate(report, config.gate);
            } catch {
                // no gate without config
            }
            const text = formatActionPlanReport(report, gateResult);
            return {
                content: [{ type: 'text', text }]
            };
        })),

        compliance_checklist: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { evaluateComplianceChecklist } = require('../../compliance-checklist');
            const rp = args.reportPath ? path.resolve(root, args.reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(await readFile(rp, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
            }
            const checklist = evaluateComplianceChecklist(report, {
                projectRoot: report.projectRoot || root,
                checklistProfile: args.checklistProfile || undefined
            });
            return formatToolResult({
                headline: checklist.summary.headline,
                passed: checklist.summary.passed,
                failed: checklist.summary.failed,
                total: checklist.summary.total,
                complianceScore: checklist.summary.complianceScore,
                rules: checklist.rules.map(r => ({
                    id: r.id,
                    title: r.title,
                    status: r.status,
                    evidence: r.evidence,
                    severity: r.severity
                })),
                localOnly: true
            });
        }),

        export_report: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const rp = args.reportPath ? path.resolve(root, args.reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(await readFile(rp, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
            }
            const outPath = args.outPath ? path.resolve(root, args.outPath) : path.join(root, '.simplebeacon', 'exported-report.json');
            try {
                await mkdir(path.dirname(outPath), { recursive: true });
                await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
                const s = await stat(outPath);
                return formatToolResult({
                    exported: true,
                    path: outPath,
                    sizeBytes: s.size,
                    localOnly: true
                });
            } catch (err) {
                return formatToolResult({ error: err.message, path: outPath });
            }
        })
    };
}

module.exports = { createReportHandlers };
