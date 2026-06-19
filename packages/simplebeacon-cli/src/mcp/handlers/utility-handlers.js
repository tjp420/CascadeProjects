/**
 * MCP utility handlers — init_project, generate_marketing, run_analyzer_suite, explain_finding, list_rulesets
 */

const fs = require('fs');
const path = require('path');
const { readFile } = fs.promises;
const { explainFinding, RULE_CATALOG, LEAK_PATTERNS } = require('../rule-catalog');
const { ERROR_TYPE_CODES, SEVERITY_BANDS } = require('../../lib/anonymized-export');

function createUtilityHandlers({ withGuard, resolveProjectRoot, formatToolResult, formatMarkdownResult }) {
    return {
        explain_finding: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (args.patternId === undefined || args.patternId === null || args.patternId === '') {
                throw new Error('Missing required argument: patternId');
            }
            return formatToolResult(explainFinding(args.patternId, { type: args.type }));
        }),

        init_project: withGuard((args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { initSimplebeacon } = require('../../index');
            const { installDeveloperStack } = require('../../lib/developer-onboarding');
            try {
                const result = initSimplebeacon(root, {
                    profile: args.profile || undefined,
                    force: args.force === true
                });
                let stack = null;
                if (args.withMcp === true || args.withCi === true || args.starter === true) {
                    stack = installDeveloperStack(root, {
                        withMcp: args.withMcp === true || args.starter === true,
                        withCursorRule: args.withMcp === true || args.starter === true,
                        withCi: args.withCi === true || args.starter === true,
                        force: args.force === true
                    });
                }
                return formatToolResult({
                    initialized: true,
                    projectRoot: root,
                    configPath: result.configPath,
                    baselinePath: result.baselinePath,
                    profile: result.detected?.profile || args.profile || 'standard',
                    developerStack: stack ? {
                        mcp: stack.mcp ? { created: !!stack.mcp.created, path: stack.mcp.path } : null,
                        cursorRule: stack.cursorRule ? { created: !!stack.cursorRule.created, path: stack.cursorRule.path } : null,
                        ciWorkflow: stack.ciWorkflow ? { created: !!stack.ciWorkflow.created, path: stack.ciWorkflow.path } : null
                    } : null,
                    nextSteps: [
                        'Run `scan_project` to perform your first scan',
                        'Run `gate_status` to check pass/fail after scanning',
                        ...(args.withMcp === true ? ['Reload Cursor → Settings → MCP → enable simplebeacon'] : [])
                    ]
                });
            } catch (err) {
                return formatToolResult({ error: err.message, projectRoot: root });
            }
        }),

        run_analyzer_suite: withGuard(async ({ projectRoot, selectedIssueIds }) => {
            const { buildAiSystemsIssueAnalysis } = require('../../lib/ai-problem-analyzer-suite');
            const { getCachedAnalysis, setCachedAnalysis } = require('../../lib/ai-problem-analyzer-cache');
            const { sanitizeAiProblemAnalyzerExport } = require('../../lib/ai-problem-analyzer-export-sanitize');
            const root = resolveProjectRoot(projectRoot);
            const reportPath = path.join(root, '.simplebeacon', 'report.json');
            let report = null;
            try {
                report = JSON.parse(await readFile(reportPath, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run `npx simplebeacon scan --format json --output .simplebeacon/report.json` first.' });
            }
            const cached = getCachedAnalysis(root, report);
            let analysisResult;
            if (cached) {
                analysisResult = cached;
            } else {
                const ids = Array.isArray(selectedIssueIds) && selectedIssueIds.length
                    ? selectedIssueIds
                    : Array.from({ length: 48 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`);
                analysisResult = buildAiSystemsIssueAnalysis(ids, { context: { scanReport: report } });
                setCachedAnalysis(root, report, analysisResult);
            }
            const payload = sanitizeAiProblemAnalyzerExport(analysisResult, { projectPath: root, context: { healthScore: report.qualityScore } });
            return formatToolResult({
                localOnly: true,
                measured: analysisResult.riskSummary.executionStatus.measured,
                insufficientData: analysisResult.riskSummary.executionStatus.insufficientData,
                stub: analysisResult.riskSummary.executionStatus.stub,
                overallRiskLevel: analysisResult.riskSummary.overallRiskLevel,
                peakSeverity: analysisResult.riskSummary.severityCounts.critical > 0 ? 'critical' : analysisResult.riskSummary.severityCounts.high > 0 ? 'high' : 'low',
                topPriorityIssues: payload.topPriorityIssues?.map((i) => ({ id: i.id, title: i.title, severity: i.severity, priorityScore: i.priorityScore })) || [],
                coverageGaps: payload.coverageGaps?.map((g) => ({ id: g.id, title: g.title, missingInputPointer: g.missingInputPointer })) || [],
                methodology: 'Deterministic local analyzer suite — no code uploaded to remote servers'
            });
        }),

        generate_marketing: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const rp = args.reportPath ? path.resolve(root, args.reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(await readFile(rp, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
            }
            const { generateMarketingContent } = require('../../lib/marketing/marketing-content-generator');
            const channel = args.channel || 'blog';
            const validChannels = ['blog', 'twitter', 'linkedin', 'newsletter', 'case-study', 'press-kit', 'one-pager'];
            if (!validChannels.includes(channel)) {
                return formatToolResult({ error: `Invalid channel: ${channel}. Valid: ${validChannels.join(', ')}` });
            }
            try {
                const content = generateMarketingContent(report, { channel, tone: args.tone || 'professional' });
                return formatMarkdownResult(`Marketing Content — ${channel}`, content);
            } catch (err) {
                return formatToolResult({ error: err.message || 'Marketing generation failed' });
            }
        }),

        list_rulesets: withGuard(() => {
            const rulesets = {
                schemaVersion: 'simplebeacon-rules-v1',
                generatedAt: new Date().toISOString(),
                deterministic: true,
                usesLlm: false,
                categories: [
                    { id: 'schema', label: 'JSON Schema Compliance', severityDefault: 'high' },
                    { id: 'syntax', label: 'Syntax / Structural', severityDefault: 'high' },
                    { id: 'security', label: 'Credential & Production Leak', severityDefault: 'critical' },
                    { id: 'ai-quality', label: 'AI-Generated Slop & Fiction KPI', severityDefault: 'medium' },
                    { id: 'compliance', label: 'Regulatory (EU AI Act)', severityDefault: 'medium' },
                    { id: 'testing', label: 'Test Baseline', severityDefault: 'high' },
                    { id: 'data-quality', label: 'Data Hygiene', severityDefault: 'low' }
                ],
                severityBands: SEVERITY_BANDS,
                anonymizedTypeCodes: ERROR_TYPE_CODES,
                patterns: {
                    llmSlop: RULE_CATALOG.map((r) => ({
                        id: r.id,
                        category: 'ai-quality',
                        severity: r.severity,
                        summary: r.description,
                        banned: true
                    })),
                    productionLeak: LEAK_PATTERNS.map((r) => ({
                        id: r.id,
                        category: 'security',
                        severity: 'critical',
                        summary: r.description || `Leak pattern ${r.id}`,
                        banned: true
                    }))
                },
                mcpInstructions: {
                    purpose: 'When writing code, avoid all banned patterns. Use runtime config or sample data fixtures instead of hardcoded metrics, credentials, or mock paths.',
                    enforcement: 'Local deterministic scan — no code uploaded to remote servers',
                    privacyNote: 'Rule queries are stateless; no source code leaves the developer machine'
                }
            };
            return formatToolResult(rulesets);
        })
    };
}

module.exports = { createUtilityHandlers };
