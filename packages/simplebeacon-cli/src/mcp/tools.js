/**
 * MCP tool handlers — local-only, no network.
 */

const fs = require('fs');
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

    // Shared in-memory cache: projectRoot -> { report, timestamp }
    const scanCache = new Map();
    function cacheReport(root, report) {
        scanCache.set(root, { report, timestamp: Date.now() });
    }
    function getCachedReport(root) {
        const entry = scanCache.get(root);
        if (!entry) return null;
        // 10-minute TTL
        if (Date.now() - entry.timestamp > 10 * 60 * 1000) {
            scanCache.delete(root);
            return null;
        }
        return entry.report;
    }

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
        scan_snippet: withGuard((args) => {
            validateArgs(args, { required: ['content'] });
            const result = scanSnippetContent(String(args.content || ''), {
                filePath: args.filePath || 'snippet.txt',
                projectRoot: resolveProjectRoot(args.projectRoot)
            });
            return formatToolResult({
                ...result,
                localOnly: true,
                methodology: 'Deterministic regex — not LLM semantic review'
            });
        }),

        scan_file: withGuard((args) => {
            validateArgs(args, { required: ['filePath'] });
            const { filePath, projectRoot } = args;
            try {
                const result = scanFileOnDisk(resolveProjectRoot(projectRoot), filePath);
                return formatToolResult({ ...result, localOnly: true });
            } catch (err) {
                return formatToolResult({ error: err.message, filePath });
            }
        }),

        scan_project: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { runScan } = require('../scan');
            const { loadSimplebeaconConfig } = require('../index');
            try {
                const configPath = args.configPath ? path.resolve(root, args.configPath) : null;
                const config = configPath && fs.existsSync(configPath)
                    ? loadSimplebeaconConfig(root, configPath)
                    : loadSimplebeaconConfig(root);
                if (args.complete === true) {
                    config.fullDirectoryScan = true;
                }
                if (args.profile) {
                    config.profile = args.profile;
                }
                if (args.gate === true) {
                    config.gate = config.gate || {};
                    config.gate.enabled = true;
                }
                const report = await runScan(root, {
                    config,
                    configPath,
                    offline: true
                });
                cacheReport(root, report);
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
                const payload = {
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
                };
                if (args.format === 'json') {
                    return formatToolResult(payload);
                }
                return formatToolResult(payload);
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
            let report = getCachedReport(root);
            if (!report) {
                const fs = require('fs');
                const rp = reportPath ? path.resolve(root, reportPath) : path.join(root, '.simplebeacon', 'report.json');
                try {
                    report = JSON.parse(fs.readFileSync(rp, 'utf8'));
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

        get_action_plan: withGuard(({ projectRoot, reportPath }) => {
            const root = resolveProjectRoot(projectRoot);
            let report = getCachedReport(root);
            if (!report) {
                const rp = reportPath ? path.resolve(root, reportPath) : path.join(root, '.simplebeacon', 'report.json');
                try {
                    report = JSON.parse(fs.readFileSync(rp, 'utf8'));
                } catch {
                    return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
                }
            }
            const { formatActionPlanReport } = require('../reporters/text');
            const { evaluateGate } = require('../gate');
            const { loadSimplebeaconConfig } = require('../index');
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

        explain_finding: withGuard((args) => {
            validateArgs(args, { required: ['patternId'] });
            return formatToolResult(explainFinding(args.patternId, { type: args.type }));
        }),

        init_project: withGuard((args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { initSimplebeacon } = require('../index');
            const { installDeveloperStack } = require('../lib/developer-onboarding');
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

        compliance_checklist: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { evaluateComplianceChecklist } = require('../compliance-checklist');
            const rp = args.reportPath ? path.resolve(root, args.reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(fs.readFileSync(rp, 'utf8'));
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

        generate_marketing: withGuard((args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const fs = require('fs');
            const rp = args.reportPath ? path.resolve(root, args.reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(fs.readFileSync(rp, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
            }
            const { generateMarketingContent } = require('../lib/marketing/marketing-content-generator');
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

        export_report: withGuard((args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const fs = require('fs');
            const rp = args.reportPath ? path.resolve(root, args.reportPath) : path.join(root, '.simplebeacon', 'report.json');
            let report;
            try {
                report = JSON.parse(fs.readFileSync(rp, 'utf8'));
            } catch {
                return formatToolResult({ error: 'No scan report found. Run scan_project first.' });
            }
            const outPath = args.outPath ? path.resolve(root, args.outPath) : path.join(root, '.simplebeacon', 'exported-report.json');
            try {
                fs.mkdirSync(path.dirname(outPath), { recursive: true });
                fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
                return formatToolResult({
                    exported: true,
                    path: outPath,
                    sizeBytes: fs.statSync(outPath).size,
                    localOnly: true
                });
            } catch (err) {
                return formatToolResult({ error: err.message, path: outPath });
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
        description: 'Run a full project scan (gate or complete) on the local filesystem. Supports custom config, profile override, and complete scan mode. Returns gate pass, quality score, top issues, and file count. No code is uploaded.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root to scan (default: cwd)' },
                configPath: { type: 'string', description: 'Path to custom .simplebeacon/config.json relative to project root' },
                profile: { type: 'string', description: 'Override scan profile: minimal, standard, cascade, executive, euai, universal' },
                fullDirectoryScan: { type: 'boolean', description: 'Walk entire repo tree instead of selective paths (slower, more thorough)' },
                complete: { type: 'boolean', description: 'Shorthand for fullDirectoryScan + all analyzers (same as --complete in CLI)' },
                gate: { type: 'boolean', description: 'Run gate-only scan (credentials + AI heuristics) instead of full scan' },
                format: { type: 'string', description: 'Response format: json (default) | markdown' }
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
        name: 'get_action_plan',
        description: 'Return a focused, human-readable action plan from the latest scan report — prioritized playbooks with time estimates, step-by-step steps, and verify commands. Uses the same deterministic remediation guides as the CLI --format action-plan.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                reportPath: { type: 'string', description: 'Override report path relative to project root' }
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
        name: 'init_project',
        description: 'Initialize a new project with .simplebeacon/config.json and baseline.json. Optionally install MCP config, Cursor rules, and CI workflow.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                profile: { type: 'string', description: 'Force profile: minimal, standard, cascade, executive, euai, universal' },
                force: { type: 'boolean', description: 'Overwrite existing config/baseline' },
                withMcp: { type: 'boolean', description: 'Write .cursor/mcp.json + agent rule for Cursor MCP' },
                withCi: { type: 'boolean', description: 'Write .github/workflows/simplebeacon.yml' },
                starter: { type: 'boolean', description: 'Shorthand for withMcp + withCi' }
            }
        }
    },
    {
        name: 'compliance_checklist',
        description: 'Evaluate corporate safety checklist from a scan report. Returns pass/fail per rule, compliance score, and headline.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                reportPath: { type: 'string', description: 'Override report path relative to project root (default: .simplebeacon/report.json)' },
                checklistProfile: { type: 'string', description: 'Optional checklist profile name' }
            }
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
        name: 'generate_marketing',
        description: 'Generate marketing content (blog, twitter, linkedin, etc.) from a scan report. Runs locally — no data uploaded.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root for reading .simplebeacon/report.json (default: cwd)' },
                reportPath: { type: 'string', description: 'Override report path relative to project root' },
                channel: { type: 'string', description: 'Channel: blog, twitter, linkedin, newsletter, case-study, press-kit, one-pager (default: blog)' },
                tone: { type: 'string', description: 'Tone: professional, casual, technical (default: professional)' }
            }
        }
    },
    {
        name: 'export_report',
        description: 'Export the latest scan report to a JSON file on disk. Useful for CI artifacts or sharing.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root for reading .simplebeacon/report.json (default: cwd)' },
                reportPath: { type: 'string', description: 'Override source report path relative to project root' },
                outPath: { type: 'string', description: 'Destination path relative to project root (default: .simplebeacon/exported-report.json)' }
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
    formatToolResult,
    formatMarkdownResult
};
