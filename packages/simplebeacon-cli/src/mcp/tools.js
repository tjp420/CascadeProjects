/**
 * MCP tool handlers — local-only, no network.
 */

const path = require('path');
const { createNetworkGuard } = require('../lib/trust-guard');
const { createScanHandlers } = require('./handlers/scan-handlers');
const { createReportHandlers } = require('./handlers/report-handlers');
const { createUtilityHandlers } = require('./handlers/utility-handlers');
const { createAgentLoopHandlers } = require('./handlers/agent-loop-handlers');
const { createAgentContextHandlers } = require('./handlers/agent-context-handlers');
const { createProblemSolverHandlers } = require('./handlers/problem-solver-handlers');
const { createSuperchargeHandlers } = require('./handlers/supercharge-handlers');
const { createAgentVerifyHandlers } = require('./handlers/agent-verify-handlers');
const { assertCapability, resolveAgentTier } = require('../lib/agent-tier-capabilities');
const constants = require('../lib/constants');

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

function _validateArgs(args, schema) {
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
        if (Date.now() - entry.timestamp > 10 * constants.ONE_MINUTE_MS) {
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

    function withTierGuard(toolName, fn) {
        return (...args) => {
            const check = assertCapability(toolName, resolveAgentTier());
            if (!check.allowed) {
                return formatToolResult(check.upsell);
            }
            return fn(...args);
        };
    }

    const handlerDeps = {
        withGuard,
        withTierGuard,
        resolveProjectRoot,
        formatToolResult,
        formatMarkdownResult,
        cacheReport,
        getCachedReport
    };

    const scanHandlers = createScanHandlers(handlerDeps);
    const reportHandlers = createReportHandlers(handlerDeps);
    const utilityHandlers = createUtilityHandlers(handlerDeps);
    const agentLoopHandlers = createAgentLoopHandlers(handlerDeps);
    const agentContextHandlers = createAgentContextHandlers(handlerDeps);
    const problemSolverHandlers = createProblemSolverHandlers(handlerDeps);
    const superchargeHandlers = createSuperchargeHandlers(handlerDeps);
    const agentVerifyHandlers = createAgentVerifyHandlers(handlerDeps);

    return {
        ...scanHandlers,
        ...reportHandlers,
        ...utilityHandlers,
        ...agentLoopHandlers,
        ...agentContextHandlers,
        ...problemSolverHandlers,
        ...superchargeHandlers,
        ...agentVerifyHandlers,
        dispose() {
            if (networkGuard) networkGuard.dispose();
        }
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
        description: 'Scan one file on disk within the project root using the same rules as scan_snippet. Runs locally — no upload.',
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
        name: 'code_suggestions',
        description: 'Return simple before/after code hints from the latest gate or cleanup scan — quick wins, auto-fixable patterns, and dead-export trims. Deterministic, no LLM.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                reportPath: { type: 'string', description: 'Override report path relative to project root' },
                maxSuggestions: { type: 'number', description: 'Max suggestions (default 20)' }
            }
        }
    },
    {
        name: 'master_engineering_brief',
        description: 'Synthesize gate, cleanup, code suggestions, and recovery playbooks into a ten-cylinder master plan with "yes you can" steps and curated online resources. Deterministic — no LLM.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                refresh: { type: 'boolean', description: 'Write .simplebeacon/master-engineering-brief.md to disk (default false)' }
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
        name: 'handoff_check',
        description: 'Check whether an AI agent may claim the task complete — gate pass with zero blocking issues. Free tier allowed.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' }
            }
        }
    },
    {
        name: 'init_project',
        description: 'Initialize a new project with .simplebeacon/config.json and baseline.json. Optionally install universal agent bootstrap (MCP configs, instructions, hooks, CI).',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                profile: { type: 'string', description: 'Force profile: minimal, standard, cascade, executive, euai, universal' },
                force: { type: 'boolean', description: 'Overwrite existing config/baseline' },
                withMcp: { type: 'boolean', description: 'Write MCP configs for selected hosts' },
                withHooks: { type: 'boolean', description: 'Install Cursor preToolUse hook (blocks slop on apply when paid)' },
                paidTier: { type: 'boolean', description: 'Install paid 11/10 agent instruction template' },
                withCi: { type: 'boolean', description: 'Write CI pipeline workflow' },
                starter: { type: 'boolean', description: 'Universal agent bootstrap: all hosts + hooks + CI' },
                agent: { type: 'boolean', description: 'Alias for starter' },
                hosts: { type: 'string', description: 'Hosts: all | auto | cursor,windsurf,continue,claude,universal' }
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
    },
    {
        name: 'get_agent_brief',
        description: 'Return tier-aware agent brief markdown from the latest scan — gate status, pipeline metrics, top findings, next action. Optionally write .simplebeacon/agent-brief.md.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                task: { type: 'string', description: 'Task hint: hygiene, handoff, security, refactor, gamedev, extension' },
                writeDisk: { type: 'boolean', description: 'Write .simplebeacon/agent-brief.md (default false)' }
            }
        }
    },
    {
        name: 'get_context_pack',
        description: 'Structured AI context pack — repo map, entry points, pipeline metrics, verify commands, MCP workflow. Free tier preview; paid tier full findings. Optionally write .simplebeacon/ai-context.md.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string' },
                task: { type: 'string', description: 'Task profile: hygiene, handoff, security, refactor, gamedev, extension' },
                format: { type: 'string', description: 'json (default) or markdown' },
                writeDisk: { type: 'boolean', description: 'Write .simplebeacon/ai-context.md' }
            }
        }
    },
    {
        name: 'propose_fix',
        description: 'Paid: return deterministic search/replace patch for a finding (AST remediator). Free tier blocked.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string' },
                patternId: { type: 'string', description: 'Pattern id from scan_snippet/scan_file' },
                pattern: { type: 'string', description: 'Alias for patternId' },
                filePath: { type: 'string' },
                line: { type: 'number' },
                type: { type: 'string' },
                findingId: { type: 'string' },
                dryRun: { type: 'boolean', description: 'Default true — do not write disk' }
            }
        }
    },
    {
        name: 'verify_fix',
        description: 'Paid: re-scan patched snippet or file; returns blockingCountBefore/After. Free tier blocked.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string' },
                content: { type: 'string' },
                filePath: { type: 'string' },
                blockingCountBefore: { type: 'number' },
                findingId: { type: 'string' }
            }
        }
    },
    {
        name: 'scan_staged',
        description: 'Paid: run gate rules on git staged files only. Free tier blocked.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string' }
            }
        }
    },
    {
        name: 'agent_status',
        description: 'Paid: read/update .simplebeacon/agent-session.json — open findings, next action. Free tier blocked.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string' },
                patch: { type: 'object', description: 'Optional session fields to merge' }
            }
        }
    },
    {
        name: 'solve_problem',
        description: 'Master engineer problem solver — takes a natural-language problem statement and returns a "yes you can" resolution plan with step-by-step instructions, curated online resources, and recommended MCP tools. Covers CI failures, test issues, dependency vulnerabilities, secrets, Lighthouse/a11y, TypeScript errors, circular deps, Docker, database migrations, git recovery, ESM/CJS, performance, monorepo CI, Redis, Cloudflare Workers, memory leaks, SPA rendering, test coverage, env config, API design, and auth. Deterministic — no LLM inference. Free tier.',
        inputSchema: {
            type: 'object',
            properties: {
                problem: { type: 'string', description: 'Natural language problem statement (e.g. "CI is failing with 37 test errors" or "Lighthouse a11y score is 0.87")' },
                projectRoot: { type: 'string', description: 'Project root for gate context (default: cwd)' }
            },
            required: ['problem']
        }
    },
    {
        name: 'diagnose_error',
        description: 'Diagnose an error message or stack trace — returns root cause, confidence level, fix, and curated resources. Covers Node.js errors (ERR_REQUIRE_ESM, ECONNREFUSED, ENOENT, heap OOM), TypeScript errors (TS2304, TS2339, TS2322), Jest errors (timeout, snapshot, open handles), Docker errors, Lighthouse errors (button-name, color-contrast), Git errors (merge conflict, not a repo), and npm errors (ERESOLVE, EACCES). Deterministic — no LLM inference. Free tier.',
        inputSchema: {
            type: 'object',
            properties: {
                errorText: { type: 'string', description: 'Error message or stack trace to diagnose' },
                error: { type: 'string', description: 'Alias for errorText' },
                message: { type: 'string', description: 'Alias for errorText' }
            },
            required: ['errorText']
        }
    },
    {
        name: 'supercharge_agent',
        description: 'One-call mission briefing for any AI coding agent — bundles gate status, context pack, code suggestions, master engineering summary, git snapshot, host plugin status, session playbook, and tool router. Start here every session. Free tier. PDA modes: task handoff (ship readiness), security (credentials/leaks), gamedev (game project integrity).',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                task: { type: 'string', description: 'Task profile / PDA mode: handoff | security | gamedev (first-class PDA modes), or hygiene | refactor | extension' },
                format: { type: 'string', description: 'json (default) or markdown' },
                writeDisk: { type: 'boolean', description: 'Write .simplebeacon/agent-supercharge.md (default false)' },
                includeGit: { type: 'boolean', description: 'Include git branch/dirty snapshot (default true)' }
            }
        }
    },
    {
        name: 'install_agent_plugin',
        description: 'Wire SimpleBeacon MCP + instructions into coding agent plugins: Cursor, Windsurf, Continue, Claude, Cline, GitHub Copilot, Aider, Universal (AGENTS.md). Free tier.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                hosts: { type: 'string', description: 'Hosts: all | cursor,windsurf,continue,cline,copilot,aider,universal,claude' },
                force: { type: 'boolean', description: 'Overwrite existing configs' },
                supercharge: { type: 'boolean', description: 'Install supercharge workflow instructions (default true)' },
                paidTier: { type: 'boolean', description: 'Install paid-tier instruction variant when supercharge is false' },
                withMcp: { type: 'boolean', description: 'Write MCP server configs (default true)' },
                withInstructions: { type: 'boolean', description: 'Write agent instruction files (default true)' },
                dryRun: { type: 'boolean', description: 'Preview changes without writing' }
            }
        }
    },
    {
        name: 'verify_before_write',
        description: 'Pre-write verification gate — agent passes proposed file content and path; returns passed/violations/recommendedAction (ok-to-write | fix-and-retry | consult-user). Runs swallowed-exception, phantom-API, hallucinated-import, and AI-slop scanners in-process. Sub-100ms warm. Free tier.',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'Proposed file content to verify before writing to disk' },
                filePath: { type: 'string', description: 'Target file path (e.g. src/api/handler.ts)' },
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' }
            },
            required: ['content', 'filePath']
        }
    },
    {
        name: 'verify_completion',
        description: 'Task completion verifier — checks gate pass, test suite, and build status. Returns canClaimComplete: true|false with evidence. Prevents the "confident and wrong" failure mode where agents claim tasks are done when they are not. Free tier.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', description: 'Project root (default: cwd)' },
                checkTests: { type: 'boolean', description: 'Run test suite (default true)' },
                checkBuild: { type: 'boolean', description: 'Run build (default false — slower)' },
                testCommand: { type: 'string', description: 'Override test command (default: auto-detect from package.json)' },
                buildCommand: { type: 'string', description: 'Override build command (default: auto-detect from package.json)' }
            }
        }
    },
    {
        name: 'watch_project',
        description: 'Real-time file monitoring — watches the project directory and pushes findings to the agent via notifications/message as files change. No tool call needed for subsequent findings; they arrive automatically. Actions: start (begin watching), stop (stop watching), status (check watcher state). Free tier.',
        inputSchema: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'start | stop | status (default: start)' },
                projectRoot: { type: 'string', description: 'Project root to watch (default: cwd)' }
            }
        }
    }
];

module.exports = {
    createMcpToolHandlers,
    TOOL_DEFINITIONS,
    formatToolResult,
    formatMarkdownResult
};
