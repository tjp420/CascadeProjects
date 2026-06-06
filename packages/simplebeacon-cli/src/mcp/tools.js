/**
 * MCP tool handlers — local-only, no network.
 */

const path = require('path');
const { scanSnippetContent, scanFileOnDisk, readGateStatus } = require('../lib/snippet-scanner');
const { explainFinding, RULE_CATALOG, LEAK_PATTERNS } = require('./rule-catalog');
const { ERROR_TYPE_CODES, SEVERITY_BANDS } = require('../lib/anonymized-export');
const { createNetworkGuard } = require('../lib/trust-guard');

function resolveProjectRoot(override) {
    return path.resolve(override || process.env.SIMPLEBEACON_PROJECT_ROOT || process.cwd());
}

function formatToolResult(payload) {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(payload, null, 2)
        }]
    };
}

function formatMarkdownResult(title, markdown) {
    return {
        content: [
            { type: 'text', text: `## ${title}\n\n${markdown}` }
        ]
    };
}

function validateArgs(args, schema) {
    if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
    const required = schema.required || [];
    for (const key of required) {
        if (args[key] === undefined || args[key] === null || args[key] === '') {
            throw new Error(`Missing required argument: ${key}`);
        }
    }
    return args;
}

function createMcpToolHandlers(options = {}) {
    const offline = options.offline !== false
        || process.env.SIMPLEBEACON_OFFLINE === '1'
        || process.env.SIMPLEBEACON_OFFLINE === 'true';
    const networkGuard = offline ? createNetworkGuard({ label: 'simplebeacon-mcp' }) : null;

    function withGuard(fn) {
        return (...args) => {
            if (networkGuard) networkGuard.assertOfflineClean();
            const result = fn(...args);
            if (result && typeof result.then === 'function') {
                return result.then((r) => {
                    if (networkGuard) networkGuard.assertOfflineClean();
                    return r;
                });
            }
            if (networkGuard) networkGuard.assertOfflineClean();
            return result;
        };
    }

    return {
        scan_snippet: withGuard(({ content, filePath, projectRoot }) => {
            const result = scanSnippetContent(String(content || ''), {
                filePath: filePath || 'snippet.txt',
                projectRoot: resolveProjectRoot(projectRoot)
            });
            return formatToolResult({
                ...result,
                localOnly: true,
                methodology: 'Deterministic regex — not LLM semantic review'
            });
        }),

        scan_file: withGuard(({ filePath, projectRoot }) => {
            if (!filePath) {
                return formatToolResult({ error: 'filePath is required' });
            }
            try {
                const result = scanFileOnDisk(resolveProjectRoot(projectRoot), filePath);
                return formatToolResult({ ...result, localOnly: true });
            } catch (err) {
                return formatToolResult({ error: err.message, filePath });
            }
        }),

        scan_project: withGuard(async ({ projectRoot, fullDirectoryScan, gate }) => {
            const root = resolveProjectRoot(projectRoot);
            const { runScan } = require('../scan');
            try {
                const report = await runScan(root, {
                    fullDirectoryScan: fullDirectoryScan === true,
                    gate: gate === true,
                    offline: true
                });
                const detectedIssues = (report.detectedIssues || []).map(i => ({
                    severity: i.severity || 'low',
                    type: i.type || 'unknown',
                    count: i.count || 1,
                    filePath: Array.isArray(i.filePaths) && i.filePaths.length
                        ? i.filePaths.slice(0, 5).join(', ')
                        : (Array.isArray(i.affectedFiles) && i.affectedFiles.length
                            ? i.affectedFiles.slice(0, 5).join(', ')
                            : (i.filePath || '')),
                    rule: i.pattern || i.rule || 'UNKNOWN',
                    impact: i.description || i.impact || 'Review required.',
                    fix: i.recommendedAction || i.recommendation || i.fix || 'Manual review required.'
                }));
                const gateBlocking = (report.gate?.blockingIssues || []).map(i => ({
                    severity: i.severity || 'medium',
                    type: i.type || 'Blocking Finding',
                    count: i.count || 1,
                    filePath: Array.isArray(i.filePaths) && i.filePaths.length
                        ? i.filePaths.slice(0, 5).join(', ')
                        : (Array.isArray(i.affectedFiles) && i.affectedFiles.length
                            ? i.affectedFiles.slice(0, 5).join(', ')
                            : (i.filePath || '')),
                    rule: i.pattern || i.rule || 'UNKNOWN',
                    impact: i.description || i.impact || 'Review required.',
                    fix: i.recommendedAction || i.recommendation || i.fix || 'Manual review required.'
                }));
                return formatToolResult({
                    type: 'simplebeacon-report',
                    version: '1.3.0',
                    generatedAt: report.generatedAt || new Date().toISOString(),
                    projectRoot: report.projectRoot || root,
                    gate: {
                        pass: report.gate?.pass ?? null,
                        blockingCount: report.gate?.blockingCount ?? 0,
                        warningCount: report.gate?.warningCount ?? 0,
                        blockingFindings: gateBlocking
                    },
                    qualityScore: report.qualityScore ?? 0,
                    totalFiles: report.totalFiles ?? 0,
                    issueCount: report.issueCount ?? 0,
                    detectedIssues: detectedIssues.slice(0, 12),
                    summary: {
                        gatePass: report.gate?.pass ?? null,
                        qualityScore: report.qualityScore ?? 0
                    },
                    localOnly: true,
                    methodology: 'Deterministic regex + AST scan — no code uploaded'
                });
            } catch (err) {
                return formatToolResult({ error: err.message, projectRoot: root });
            }
        }),

        gate_status: withGuard(({ projectRoot, reportPath, limit }) => {
            const result = readGateStatus(resolveProjectRoot(projectRoot), {
                reportPath,
                limit: limit ? Number(limit) : 12
            });
            return formatToolResult(result);
        }),

        suggest_fixes: withGuard(({ projectRoot, reportPath, maxFixes }) => {
            const root = resolveProjectRoot(projectRoot);
            const fs = require('fs');
            const rp = reportPath ? path.resolve(root, reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(fs.readFileSync(rp, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
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

        explain_finding: withGuard(({ patternId, type }) => {
            return formatToolResult(explainFinding(patternId, { type }));
        }),

        run_analyzer_suite: withGuard(({ projectRoot, selectedIssueIds }) => {
            const { buildAiSystemsIssueAnalysis } = require('../lib/ai-problem-analyzer-suite');
            const { getCachedAnalysis, setCachedAnalysis } = require('../lib/ai-problem-analyzer-cache');
            const { sanitizeAiProblemAnalyzerExport } = require('../lib/ai-problem-analyzer-export-sanitize');
            const root = resolveProjectRoot(projectRoot);
            const reportPath = path.join(root, '.simplebeacon', 'report.json');
            let report = null;
            try {
                report = JSON.parse(require('fs').readFileSync(reportPath, 'utf8'));
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

const TOOL_DEFINITIONS = [
    {
        name: 'scan_snippet',
        description: 'Scan a code snippet or pasted content for AI-fiction KPIs, mock-path leaks, credential patterns, and LLM placeholder slop. Runs locally — no upload.',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'Source text to scan' },
                filePath: { type: 'string', description: 'Virtual filename for context (e.g. src/api/handler.ts)' },
                projectRoot: { type: 'string', description: 'Project root for baseline.json (default: cwd or SIMPLEBEACON_PROJECT_ROOT)' }
            },
            required: ['content']
        }
    },
    {
        name: 'scan_file',
        description: 'Scan one file on disk within the project root using the same rules as scan_snippet.',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Relative or absolute path within project' },
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' }
            },
            required: ['filePath']
        }
    },
    {
        name: 'scan_project',
        description: 'Run a full project scan (gate or complete) on the local filesystem. Returns gate pass, quality score, top issues, and file count. No code is uploaded.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root to scan (default: cwd)' },
                fullDirectoryScan: { type: 'boolean', description: 'Walk entire repo tree instead of selective paths (slower, more thorough)' },
                gate: { type: 'boolean', description: 'Run gate-only scan (credentials + AI heuristics) instead of full scan' }
            }
        }
    },
    {
        name: 'gate_status',
        description: 'Read latest .simplebeacon/report.json gate pass/fail and top blocking issues from a prior full scan.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string' },
                reportPath: { type: 'string', description: 'Override report path relative to project root' },
                limit: { type: 'number', description: 'Max blocking issues to return (default 12)' }
            }
        }
    },
    {
        name: 'suggest_fixes',
        description: 'Read the latest scan report and return prioritized remediation steps for critical and high-severity issues. Deterministic — no LLM inference.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root for reading .simplebeacon/report.json (default: cwd)' },
                reportPath: { type: 'string', description: 'Override report path relative to project root' },
                maxFixes: { type: 'number', description: 'Max fixes to return (default 5)' }
            }
        }
    },
    {
        name: 'explain_finding',
        description: 'Explain a pattern ID from scan results — deterministic rule metadata, not LLM inference.',
        inputSchema: {
            type: 'object',
            properties: {
                patternId: { type: 'string', description: 'Pattern or rule id from scan_snippet/scan_file' },
                type: { type: 'string', description: 'Optional finding type for fallback lookup' }
            },
            required: ['patternId']
        }
    },
    {
        name: 'run_analyzer_suite',
        description: 'Run the 48-analyzer AI Problem Analyzer Suite against the latest scan report. Returns risk summary, measured/insufficient/stub counts, and top priority issues. Runs locally — no code uploaded.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root for reading .simplebeacon/report.json (default: cwd)' },
                selectedIssueIds: { type: 'array', items: { type: 'string' }, description: 'Optional subset of A-01..A-48 issue IDs to analyze' }
            }
        }
    },
    {
        name: 'list_rulesets',
        description: 'Return the full Simplebeacon deterministic rule catalog — categories, severity bands, banned patterns, and anonymized type codes. Use this to learn what is forbidden before writing code.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }
];

module.exports = {
    createMcpToolHandlers,
    TOOL_DEFINITIONS,
    formatToolResult
};
