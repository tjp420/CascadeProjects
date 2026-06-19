/**
 * MCP report handlers — gate_status, suggest_fixes, get_action_plan, compliance_checklist, export_report
 */

const fs = require('fs');
const path = require('path');
const { readFile, writeFile, mkdir, stat } = fs.promises;
const { readGateStatus } = require('../../lib/snippet-scanner');

function createReportHandlers({ withGuard, resolveProjectRoot, formatToolResult, formatMarkdownResult, getCachedReport }) {
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
            const suggestions = issues.slice(0, maxFixes ? Number(maxFixes) : 5).map((issue, idx) => ({
                priority: idx + 1,
                severity: issue.severity,
                type: issue.type || issue.rule || 'unknown',
                filePath: issue.filePath || issue.path || 'unknown',
                description: issue.description || issue.impact || 'Review required',
                recommendedAction: issue.fix || issue.recommendedAction || issue.recommendation || 'Manual review required',
                effort: issue.severity === 'critical' ? 'high' : 'medium'
            }));
            return formatToolResult({
                totalIssues: issues.length,
                suggestions,
                summary: `${suggestions.length} prioritized fixes from ${issues.length} blocking/high issues.`,
                methodology: 'Deterministic rule mapping — no LLM inference'
            });
        }),

        get_action_plan: withGuard(async ({ projectRoot, reportPath }) => {
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
            const { loadSimplebeaconConfig } = require('../../index');
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
        }),

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
