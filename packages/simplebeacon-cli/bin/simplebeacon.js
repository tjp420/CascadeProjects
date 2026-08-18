#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Simplebeacon CLI
 */

const fs = require('fs');
const path = require('path');
// Policy modules may not exist on all branches — load lazily to avoid crashing
let orchestratePolicyPipeline = null;
let TrustStore = null;
let RemediationEngine = null;
let STRUCTURAL_RULES = null;
try {
    ({ orchestratePolicyPipeline } = require('../src/policy/PolicyOrchestrator'));
    ({ TrustStore } = require('../src/policy/signature-verifier'));
} catch {
    // Optional policy pipeline modules — not required for fix/scan
}
try {
    ({ RemediationEngine, STRUCTURAL_RULES } = require('../src/policy/RemediationEngine'));
} catch {
    // RemediationEngine unavailable — fix command will report clearly
}
const {
    loadSimplebeaconConfig,
    initSimplebeacon,
    runScan,
    evaluateGate,
    formatJsonReport,
    compileAuditReportMarkdown,
    syncJestBaseline,
    detectProjectProfile,
    resolvePlatformRoot,
    writeManagedFileSync,
} = require('../src/index');
const { validateFormat, selectPayload } = require('../src/lib/format-utils');
const { formatGithubComment, postGithubComment } = require('../src/reporters/github-comment');
const { resolveCiLicense } = require('../src/lib/ci-license');
const { collectGitDiffFiles } = require('../src/lib/git-diff-scope');
const { buildAssessmentReport } = require('../src/assessment');
const { sanitizeReportForCloudUpload, sanitizeHandoffExport } = require('../src/lib/report-sanitizer');
const { buildAnonymizedExport, signAnonymizedExport } = require('../src/lib/anonymized-export');
const { runLocalRemediation } = require('../src/lib/local-remediation');
const { runDeterministicRemediation, getSupportedPatterns } = require('../src/lib/ast-remediator');
const { generateExecutivePdf } = require('../src/lib/pdf-generator');
const { evaluateComplianceChecklist } = require('../src/compliance-checklist');
const { installSimplebeaconHook } = require('../src/hook-install');
const { paint } = require('../src/reporters/text');
const {
    createNetworkGuard,
    printTrustBanner,
    printTrustCompletion
} = require('../src/lib/trust-guard');
const { validateJSON, validateNotEmpty } = require('../src/lib/file-validator');
const {
    SimplebeaconError,
    ConfigError
} = require('../src/lib/errors');
const {
    resolveCliProjectRoot,
    sanitizeCliPathOptions
} = require('../src/lib/path-utils');
const { sanitizePath } = require('../src/lib/path-sanitizer');

const { appendScanHistory } = require('../src/lib/scan-history');
const { enhanceExecutiveSummary } = require('../src/reporters/report-enhance');
const { runFileReductionScan } = require('../src/lib/file-reduction-orchestrator');
const { generateFileReductionReport } = require('../src/reporters/file-reduction-report');
const { readGateStatus } = require('../src/lib/snippet-scanner');
const { installAgentStack, runSmokeScan, refreshArtifacts } = require('../src/lib/developer-onboarding');
const VALID_COMMANDS = new Set(['scan', 'fix', 'init', 'comment', 'baseline-sync', 'assess', 'compliance', 'report', 'hook-install', 'reduce', 'gate-status', 'secrets-gate', 'pdf', 'buy-clearance', 'refer', 'mcp', 'ai-plan', 'doctor', 'upload', 'cache', 'team-metrics', 'update-cve-db', 'supercharge']);

let _cliDebugMode = false;

function resolvePolicyGateConfig() {
    const fingerprint = String(process.env.SIMPLEBEACON_POLICY_TRUST_FINGERPRINT || '').trim().toLowerCase();
    let publicKeyPem = String(process.env.SIMPLEBEACON_POLICY_PUBLIC_KEY || '').trim();

    const publicKeyPath = String(process.env.SIMPLEBEACON_POLICY_PUBLIC_KEY_PATH || '').trim();
    if (!publicKeyPem && publicKeyPath) {
        publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
    }

    return {
        trustStore: fingerprint && publicKeyPem ? new TrustStore({ [fingerprint]: publicKeyPem }) : null,
        orgPolicyPath: String(process.env.SIMPLEBEACON_ORG_POLICY_PATH || '').trim() || path.join(process.env.HOME || process.env.USERPROFILE || process.cwd(), '.simplebeacon', 'org.policy.json'),
        repoPolicyPath: String(process.env.SIMPLEBEACON_REPO_POLICY_PATH || '').trim() || path.join(process.cwd(), 'simplebeacon.policy.json')
    };
}

function runPolicyGate() {
    const bypassRequested = ['1', 'true', 'yes', 'on'].includes(String(process.env.SIMPLEBEACON_DISABLE_POLICY_GATE || '').trim().toLowerCase());
    const isLocalDevMode = process.env.NODE_ENV === 'development' && bypassRequested;
    if (bypassRequested || isLocalDevMode) {
        console.warn('[TRUST BYPASS] Policy gate skipped by local override');
        return null;
    }

    if (!orchestratePolicyPipeline || !TrustStore) {
        // Policy module not available — skip gate (local dev / module not installed)
        return null;
    }

    const { trustStore, orgPolicyPath, repoPolicyPath } = resolvePolicyGateConfig();

    if (!trustStore) {
        console.error('[AUDIT FAILURE] Policy gate requires SIMPLEBEACON_POLICY_TRUST_FINGERPRINT and SIMPLEBEACON_POLICY_PUBLIC_KEY or SIMPLEBEACON_POLICY_PUBLIC_KEY_PATH');
        process.exit(78);
    }

    const repoPath = repoPolicyPath && fs.existsSync(repoPolicyPath) ? repoPolicyPath : null;
    return orchestratePolicyPipeline(orgPolicyPath, repoPath, trustStore);
}

function writeStdoutLine(message = '') {
    process.stdout.write(`${message == null ? '' : String(message)}\n`);
}

/**
 * Read and parse a JSON file with descriptive error handling.
 * @param {string} filePath
 * @param {string} [label] - Used in error messages
 * @returns {any}
 */
function readJsonFile(filePath, label = 'JSON file') {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        throw new Error(`Cannot read ${label}: ${filePath} (${err.message})`);
    }
    try {
        return JSON.parse(content);
    } catch (err) {
        throw new Error(`Invalid JSON in ${label} at ${filePath}: ${err.message}`);
    }
}

/**
 * Suggest the closest matching command for unknown input.
 * @param {string} input
 * @param {Set<string>} candidates
 * @returns {string|undefined}
 */
function suggestCommand(input, candidates) {
    if (!input || typeof input !== 'string') return undefined;
    const inputLower = input.toLowerCase();
    let best = undefined;
    let bestScore = Infinity;
    for (const cmd of candidates) {
        const cmdLower = cmd.toLowerCase();
        // Exact prefix match
        if (cmdLower.startsWith(inputLower) || inputLower.startsWith(cmdLower)) {
            return cmd;
        }
        // Levenshtein distance (simplified: just count differing chars for short strings)
        const dist = levenshteinDistance(inputLower, cmdLower);
        if (dist < bestScore && dist <= 3) {
            bestScore = dist;
            best = cmd;
        }
    }
    return best;
}

function levenshteinDistance(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const matrix = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        let prev = matrix[0];
        matrix[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = matrix[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j] = Math.min(matrix[j] + 1, matrix[j - 1] + 1, prev + cost);
            prev = temp;
        }
    }
    return matrix[n];
}

function createDefaultOptions(command) {
    return {
        command,
        path: process.cwd(),
        config: null,
        format: 'text',
        gate: false,
        output: null,
        failOn: null,
        withJest: false,
        report: null,
        issueNumber: null,
        repo: null,
        profile: null,
        verbose: false,
        quiet: false,
        help: false,
        company: null,
        client: null,
        branch: null,
        assessor: null,
        assessment: null,
        printOnly: false,
        apiToken: null,
        upload: null,
        hookType: 'pre-commit',
        preferHusky: false,
        offline: false,
        noTrustBanner: false,
        noReferralNudge: false,
        dryRun: false,
        force: false,
        enhance: false,
        enhanceModel: null,
        scanner: null,
        checklist: null,
        withMcp: false,
        mcpMode: 'npx-local',
        withCi: false,
        starter: false,
        agent: false,
        hosts: null,
        smoke: false,
        withHooks: false,
        anonymize: false,
        fix: false,
        fixProvider: null,
        fixDryRun: false,
        maxFixes: 10,
        withAnalyzerSuite: false,
        version: false,
        complete: false,
        watch: false,
        exclude: null,
        deepScan: false,
        includeDeps: false,
        minConfidence: 0.5,
        fullDirectoryScan: false,
        server: null,
        pollSeconds: 5,
        maxPolls: 60,
        email: null,
        from: null,
        message: null,
        link: false,
        sendEmail: false,
        jsonOutput: false,
        tier: null,
        forceNpmAudit: false,
        debug: false,
        diff: false,
        baseRef: null,
        headRef: null,
        inviteeEmail: null,
        message: null,
        sendEmail: false,
        secretsOnly: false,
        certify: false,
        certifyUrl: null,
        handoffExport: null,
        includeRedactedSnippets: false
    };
}

/**
 * Declarative flag map. Each entry:
 *   aliases: string[] — accepted flag names
 *   key: string — options property to set
 *   type: 'string' | 'boolean' | 'number' | 'comma-list' | 'positive-number'
 *   fallback?: any — default when parsing yields invalid value
 *   extra?: (options) => void — custom side-effect handler
 */
const FLAG_MAP = [
    { aliases: ['--path', '-p'], key: 'path', type: 'string' },
    { aliases: ['--config', '-c'], key: 'config', type: 'string' },
    { aliases: ['--format', '-f'], key: 'format', type: 'string' },
    { aliases: ['--output', '-o'], key: 'output', type: 'string' },
    { aliases: ['--input', '-i'], key: 'input', type: 'string' },
    { aliases: ['--report', '-r'], key: 'report', type: 'string' },
    { aliases: ['--issue-number'], key: 'issueNumber', type: 'string' },
    { aliases: ['--repo'], key: 'repo', type: 'string' },
    { aliases: ['--profile'], key: 'profile', type: 'string' },
    { aliases: ['--fail-on'], key: 'failOn', type: 'comma-list' },
    { aliases: ['--gate'], key: 'gate', type: 'boolean' },
    { aliases: ['--with-jest'], key: 'withJest', type: 'boolean' },
    { aliases: ['--verbose', '-v'], key: 'verbose', type: 'boolean' },
    { aliases: ['--quiet', '-q'], key: 'quiet', type: 'boolean' },
    { aliases: ['--help', '-h'], key: 'help', type: 'boolean' },
    { aliases: ['--version', '-V'], key: 'version', type: 'boolean' },
    { aliases: ['--company'], key: 'company', type: 'string' },
    { aliases: ['--assessor'], key: 'assessor', type: 'string' },
    { aliases: ['--client'], key: 'client', type: 'string' },
    { aliases: ['--branch'], key: 'branch', type: 'string' },
    { aliases: ['--assessment'], key: 'assessment', type: 'string' },
    { aliases: ['--print-only'], key: 'printOnly', type: 'boolean' },
    { aliases: ['--api-token'], key: 'apiToken', type: 'string' },
    { aliases: ['--upload'], key: 'upload', type: 'string' },
    { aliases: ['--api-url'], key: 'apiUrl', type: 'string' },
    { aliases: ['--type'], key: 'hookType', type: 'string' },
    { aliases: ['--husky'], key: 'preferHusky', type: 'boolean' },
    { aliases: ['--secrets-only'], key: 'secretsOnly', type: 'boolean' },
    { aliases: ['--certify'], key: 'certify', type: 'boolean' },
    { aliases: ['--certify-url'], key: 'certifyUrl', type: 'string' },
    { aliases: ['--handoff-export'], key: 'handoffExport', type: 'string' },
    { aliases: ['--include-redacted-snippets'], key: 'includeRedactedSnippets', type: 'boolean' },
    { aliases: ['--offline'], key: 'offline', type: 'boolean' },
    { aliases: ['--air-gapped'], key: 'airGapped', type: 'boolean' },
    { aliases: ['--strict-license'], key: 'strictLicense', type: 'boolean' },
    { aliases: ['--recursive'], key: 'recursive', type: 'boolean' },
    { aliases: ['--anonymous'], key: 'anonymous', type: 'boolean' },
    { aliases: ['--no-trust-banner'], key: 'noTrustBanner', type: 'boolean' },
    { aliases: ['--no-referral-nudge'], key: 'noReferralNudge', type: 'boolean' },
    { aliases: ['--dry-run'], key: 'dryRun', type: 'boolean' },
    { aliases: ['--force'], key: 'force', type: 'boolean' },
    { aliases: ['--enhance'], key: 'enhance', type: 'boolean' },
    { aliases: ['--enhance-model'], key: 'enhanceModel', type: 'string' },
    { aliases: ['--scanner'], key: 'scanner', type: 'string' },
    { aliases: ['--checklist'], key: 'checklist', type: 'string' },
    { aliases: ['--with-mcp'], key: 'withMcp', type: 'boolean' },
    { aliases: ['--with-ci'], key: 'withCi', type: 'boolean' },
    { aliases: ['--ci-platform'], key: 'ciPlatform', type: 'string' },
    { aliases: ['--starter'], key: 'starter', type: 'boolean', extra: (o) => {
        o.agent = true;
        o.withMcp = true;
        o.withCi = true;
        o.withHooks = true;
        o.hosts = o.hosts || 'all';
    } },
    { aliases: ['--agent'], key: 'agent', type: 'boolean', extra: (o) => {
        o.withMcp = true;
        o.withCi = true;
        o.withHooks = true;
        o.hosts = o.hosts || 'all';
    } },
    { aliases: ['--hosts'], key: 'hosts', type: 'string' },
    { aliases: ['--with-hooks'], key: 'withHooks', type: 'boolean' },
    { aliases: ['--smoke'], key: 'smoke', type: 'boolean' },
    { aliases: ['--anonymize'], key: 'anonymize', type: 'boolean' },
    { aliases: ['--fix'], key: 'fix', type: 'boolean' },
    { aliases: ['--fix-provider'], key: 'fixProvider', type: 'string' },
    { aliases: ['--fix-dry-run'], key: 'fixDryRun', type: 'boolean' },
    { aliases: ['--fix-engine'], key: 'fixEngine', type: 'string' },
    { aliases: ['--with-analyzer-suite'], key: 'withAnalyzerSuite', type: 'boolean' },
    { aliases: ['--fullDirectoryScan', '--full'], key: 'fullDirectoryScan', type: 'boolean' },
    { aliases: ['--complete'], key: 'complete', type: 'boolean' },
    { aliases: ['--watch'], key: 'watch', type: 'boolean' },
    { aliases: ['--tier'], key: 'tier', type: 'string' },
    { aliases: ['--exclude'], key: 'exclude', type: 'comma-list' },
    { aliases: ['--deep-scan'], key: 'deepScan', type: 'boolean' },
    { aliases: ['--log'], key: 'gzdoomLog', type: 'string' },
    { aliases: ['--gzdoom-norun'], key: 'gzdoomNorun', type: 'boolean' },
    { aliases: ['--gzdoom-exe'], key: 'gzdoomExe', type: 'string' },
    { aliases: ['--iwad'], key: 'iwad', type: 'string' },
    { aliases: ['--gzdoom-norun-dry-run'], key: 'gzdoomNorunDryRun', type: 'boolean' },
    { aliases: ['--no-gzdoom-norun'], key: 'noGzdoomNorun', type: 'boolean', extra: (o) => { o.gzdoomNorun = false; } },
    { aliases: ['--include-deps'], key: 'includeDeps', type: 'boolean' },
    { aliases: ['--min-confidence'], key: 'minConfidence', type: 'number', fallback: 0.5 },
    { aliases: ['--tier-limits'], key: 'tierLimits', type: 'string' },
    { aliases: ['--force-npm-audit'], key: 'forceNpmAudit', type: 'boolean' },
    { aliases: ['--email'], key: 'email', type: 'string' },
    { aliases: ['--from'], key: 'from', type: 'string' },
    { aliases: ['--message', '-m'], key: 'message', type: 'string' },
    { aliases: ['--link'], key: 'link', type: 'boolean' },
    { aliases: ['--send-email'], key: 'sendEmail', type: 'boolean' },
    { aliases: ['--server'], key: 'server', type: 'string' },
    { aliases: ['--poll-seconds'], key: 'pollSeconds', type: 'positive-number', fallback: 5 },
    { aliases: ['--max-polls'], key: 'maxPolls', type: 'positive-number', fallback: 60 },
    { aliases: ['--max-fixes'], key: 'maxFixes', type: 'number', fallback: 10 },
    { aliases: ['--mcp-mode'], key: 'mcpMode', type: 'string' },
    { aliases: ['--debug'], key: 'debug', type: 'boolean' },
    { aliases: ['--slop-cop'], key: 'slopCop', type: 'boolean' },
    { aliases: ['--diff'], key: 'diff', type: 'boolean' },
    { aliases: ['--base-ref'], key: 'baseRef', type: 'string' },
    { aliases: ['--head-ref'], key: 'headRef', type: 'string' },
    { aliases: ['--json'], key: 'jsonOutput', type: 'boolean', extra: (o) => { o.format = 'json'; } },
    { aliases: ['--invitee-email', '--to'], key: 'inviteeEmail', type: 'string' },
    { aliases: ['--task'], key: 'task', type: 'string' },
    { aliases: ['--write-disk'], key: 'writeDisk', type: 'boolean' },
    { aliases: ['--watch-artifacts'], key: 'watchArtifacts', type: 'boolean' }
];

// Auto-derive knownFlags from FLAG_MAP so it never drifts
const knownFlags = new Set(FLAG_MAP.flatMap((f) => f.aliases));

function parseArgs(argv) {
    if (!Array.isArray(argv)) argv = [];
    const args = argv.slice(2);
    let command = args[0] || 'scan';
    let flagStart = 1;

    // If first arg is a flag (starts with -), default to 'scan' command
    if (command.startsWith('-')) {
        command = 'scan';
        flagStart = 0;
    }

    if (command === 'baseline' && args[1] === 'sync') {
        command = 'baseline-sync';
        flagStart = 2;
    }

    if (command === 'hook' && args[1] === 'install') {
        command = 'hook-install';
        flagStart = 2;
    }

    if (command === 'gate' && args[1] === 'status') {
        command = 'gate-status';
        flagStart = 2;
    }

    if (command === 'ai-plan') {
        command = 'ai-plan';
        flagStart = 1;
    }

    const options = createDefaultOptions(command);

    // Collect positional args for subcommands that need them (e.g., cache export/import, team-metrics)
    if (command === 'cache' || command === 'team-metrics') {
        options._positional = [];
        for (let i = flagStart; i < args.length; i += 1) {
            if (!args[i].startsWith('-')) {
                options._positional.push(args[i]);
            }
        }
    }

    if (command === 'fix' && args[flagStart] && !args[flagStart].startsWith('-')) {
        options.path = args[flagStart];
        flagStart += 1;
    }

    if (command === 'supercharge' && args[flagStart] && !args[flagStart].startsWith('-')) {
        options.path = args[flagStart];
        flagStart += 1;
    }

    for (let i = flagStart; i < args.length; i += 1) {
        let arg = args[i];

        // Support --flag=value and -f=value syntax
        let value = null;
        if ((arg.startsWith('--') || /^-[a-zA-Z]=/.test(arg)) && arg.includes('=')) {
            const idx = arg.indexOf('=');
            value = arg.slice(idx + 1);
            arg = arg.slice(0, idx);
        }

        // Validate unknown flags
        if (arg.startsWith('-') && !knownFlags.has(arg)) {
            throw new ConfigError(`Unknown argument: ${args[i]}. Run with --help for usage.`, { arg: args[i] });
        }

        const next = () => {
            if (value !== null) return value;
            if (args[i + 1] && !args[i + 1].startsWith('-')) {
                i += 1;
                return args[i];
            }
            return null;
        };

        const requireNext = (flagName) => {
            const v = next();
            if (v === null) throw new ConfigError(`${flagName} requires a value`, { flag: flagName });
            return v;
        };

        const flagDef = FLAG_MAP.find((f) => f.aliases.includes(arg));
        if (!flagDef) continue;

        if (flagDef.type === 'boolean') {
            options[flagDef.key] = true;
            if (flagDef.extra) flagDef.extra(options);
        } else if (flagDef.type === 'string') {
            options[flagDef.key] = requireNext(arg);
        } else if (flagDef.type === 'comma-list') {
            const val = requireNext(arg);
            options[flagDef.key] = val.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (flagDef.type === 'number') {
            const n = Number(requireNext(arg));
            options[flagDef.key] = Number.isFinite(n) ? n : (flagDef.fallback ?? 0);
        } else if (flagDef.type === 'positive-number') {
            const n = Number(requireNext(arg));
            options[flagDef.key] = (Number.isFinite(n) && n > 0) ? n : (flagDef.fallback ?? 1);
        }
    }

    return options;
}

function applyCliPathSafety(options) {
    if (!options || typeof options !== 'object') options = {};
    const sanitized = sanitizeCliPathOptions(options);
    Object.assign(options, sanitized);

    const pathRequiredCommands = new Set([
        'scan',
        'fix',
        'init',
        'baseline-sync',
        'assess',
        'compliance',
        'report',
        'hook-install',
        'secrets-gate'
    ]);

    if (pathRequiredCommands.has(options.command)) {
        options.path = resolveCliProjectRoot(options.path, {
            mustExist: true,
            mustBeDirectory: options.command !== 'fix',
            label: 'Project path'
        });
    }

    return options;
}

function formatCliError(error) {
    if (error == null) return String(error);
    if (_cliDebugMode && error.stack) {
        return error.stack;
    }
    if (error instanceof SimplebeaconError && error.code) {
        return `[${error.code}] ${error.message}`;
    }
    return error.message || String(error);
}

function printHelp() {
    writeStdoutLine(`Simplebeacon — catch AI code debt that traditional linting misses
  52 deterministic engines · zero LLM dependency · no upload required
  simplebeacon --version          Show version number

Usage:
  simplebeacon scan [options]     Scan project and report findings
  simplebeacon fix [path] [options]  Run structural auto-remediation (markdown, slop, tokens)
  simplebeacon init [options]     Create .simplebeacon/config.json and baseline.json
  simplebeacon mcp [options]      Start MCP stdio server for Cursor / Claude Desktop
  simplebeacon comment [options]  Post GitHub PR comment from JSON report
  simplebeacon assess [options]   Build customer assessment JSON from scan report
  simplebeacon compliance [opts]  Evaluate corporate safety checklist from report
  simplebeacon report [options]   Build client-facing markdown audit from scan JSON
  simplebeacon baseline sync      Run Jest and update .simplebeacon/baseline.json
  simplebeacon hook install         Install pre-commit or pre-push git hook
  simplebeacon secrets-gate [opts]  Block commits when staged files contain secrets
  simplebeacon gate status            Print gate pass/fail from .simplebeacon/report.json
  simplebeacon reduce [options]     Analyze repo for file-reduction opportunities (dry-run)
  simplebeacon pdf [options]        Generate Executive Risk Certificate (requires license token)
  simplebeacon buy-clearance        Purchase executive clearance and receive license token
  simplebeacon refer [options]      Generate a local-only referral token and share link
  simplebeacon ai-plan [options]   Generate AI-friendly remediation plan from scan results
  simplebeacon doctor              Runs integrity diagnostics, applies auto-fixes, and generates triage packages
  simplebeacon team-metrics [opts]  Aggregate anonymous compliance metrics across local scan reports

buy-clearance options:
  --email <addr>      Email address for checkout (required)
  --server <url>    Simplebeacon server URL (default: https://simplebeacon.ai)
  --poll-seconds <n> Seconds between poll attempts (default: 5)
  --max-polls <n>   Maximum poll attempts (default: 60)

refer options:
  --email <addr>      Target colleague email (required)
  --server <url>      Base URL for generated referral link (default: https://simplebeacon.ai)
  --json              Machine-readable output
  --format json       Machine-readable output (alias)

PDF options:
  --report <file>     Scan report JSON (default: .simplebeacon/report.json)
  --output <file>     Output HTML path (default: simplebeacon-executive-risk-certificate.html)
  Requires SIMPLEBEACON_LICENSE_TOKEN env var or ~/.simplebeacon/license.jwt

Init options:
  --path <dir>        Project root (default: cwd)
  --profile <name>    Force profile: minimal, standard, cascade, gamedev, eu-ai-act (auto-detected by default)
  --dry-run           Preview init changes without writing files
  --force             Overwrite existing config/baseline (backup created first)
  --with-mcp          Write MCP config + agent instructions (Cursor by default)
  --with-ci           Write CI pipeline workflow (auto-detects platform)
  --ci-platform <p>   Force CI platform: github-actions | gitlab-ci | bitbucket-pipelines
  --starter           Universal agent bootstrap (all hosts + hooks + CI)
  --agent             Same as --starter
  --hosts <list>      Host adapters: all | auto | cursor,windsurf,continue,claude,universal
  --with-hooks        Install Cursor preToolUse hook (default with --starter)
  --smoke             Run gate scan after init and refresh agent brief
  --mcp-mode MODE     npx-local (default) | npx-github | monorepo

Scan options:
  --path, -p <dir>    Project root (default: cwd)
  --config, -c <f>    Config path (default: .simplebeacon/config.json)
  --format, -f fmt    Output format: text | json | markdown (default: text)
  --output, -o <file> Write report to file
  --report, -r <file> Use existing scan report JSON
  --gate              Exit 1 when gate severities are found
  --fail-on a,b,c     Override gate fail severities (default: high)
  --with-jest         Run npm test and compare to baseline (slow)
  --verbose, -v       Print config warnings and scan paths
  --anonymize         Strip all file paths, descriptions, and code snippets from JSON output
                        Output contains only abstract error codes and compliance metrics.
  --fix               Run remediation against blocking findings (deterministic first, then LLM)
  --fix-engine <e>    Remediation engine: auto (default) | deterministic | llm
  --fix-provider <p>  Override remediation LLM: ollama (default) | openai | anthropic
  --fix-dry-run       Show diffs without applying patches
  --max-fixes <n>     Limit number of auto-fix attempts (default: 10)
  --complete          Run all 52 deterministic engines (gate + consolidation + mock data + roadmap + codebase + file reduction + data quality + cleanup + npm audit + compliance + EU AI Act)
  --full              Walk entire repo tree instead of scanPaths only (alias: --fullDirectoryScan)
  --watch             Watch project files and re-run scan on changes (ctrl+c to stop)
  --deep-scan         Deep Scan mode: bypass docs/vendor/cache filters (only .simplebeaconignore + 500MB limit applies)
  --include-deps      Include node_modules and .git in scan (slower, more noise)
  --min-confidence n  Minimum rule confidence threshold 0.0–1.0 (default: 0.5)
  --offline           Fail if any outbound network activity occurs during scan
  --air-gapped        Enterprise air-gapped mode: implies --offline, skips remote license
                      validation and telemetry, uses only local cache for registry lookups
  --strict-license    Fail-closed on expired or invalid license tokens (default: fail-open
                      to community mode with warning, so pipelines are not blocked)
  --no-trust-banner   Suppress read-only / local-only trust confirmation lines
  --no-referral-nudge Suppress post-scan referral share banner (also SIMPLEBEACON_REFERRAL_NUDGE=false)
  --slop-cop          Run AI Slop Cop (LLM residue / mock-data detection) during scan
  --api-token <tok>   Paid tier API token (required with --upload)
  --upload <url>      POST JSON report to Simplebeacon cloud (paid tier)
  --certify           Request an edge-signed compliance certificate (.sbcert) after scan (requires --output)
  --certify-url <url> Override the certificate signing endpoint URL
  --handoff-export <f> Write cross-domain handoff bundle (paths/snippets redacted)
  --include-redacted-snippets  Keep snippet text in handoff export with inline redaction

GZDoom options:
  --log <file>        GZDoom runtime log to correlate with scan findings
  --gzdoom-norun      Enable gzdoom.exe -norun authoritative syntax gate (default: on for gzdoom engine)
  --no-gzdoom-norun   Disable the -norun gate
  --gzdoom-exe <path> Path to gzdoom.exe (overrides env GZDOOM_EXE and auto-detect)
  --iwad <path>       Path to IWAD file (overrides auto-detect)
  --gzdoom-norun-dry-run  Run gate in dry-run mode (report command without executing)

Comment options:
  --report <file>     JSON report path (default: .simplebeacon/report.json)
  --issue-number N    Pull request number (or GITHUB_EVENT_PULL_REQUEST_NUMBER)
  --repo owner/repo   Repository slug (or GITHUB_REPOSITORY)
  --print-only        Print comment markdown only (for GITHUB_STEP_SUMMARY)

Assess options:
  --path <dir>        Project root (default: cwd)
  --report <file>     Existing scan report (default: run scan first)
  --output <file>     Write assessment JSON (default: .simplebeacon/assessment.json)
  --company <name>    Customer / repo name for report title
  --assessor <name>   Your name on the deliverable
  --checklist <id>    Checklist profile: default | eu-ai-act (default: default)
  --with-analyzer-suite  Run 48-analyzer AI risk assessment and export JSON

Report options:
  --path <dir>        Project root (default: cwd)
  --report <file>     Scan report JSON (default: .simplebeacon/report.json)
  --assessment <file> Assessment JSON (default: .simplebeacon/assessment.json if present)
  --output <file>     Write markdown audit (default: AUDIT_REPORT.md)
  --company <name>    Prepared-for name on cover line
  --client <name>     Target project name (default: repo folder name)
  --branch <name>     Optional branch label on cover line
  --assessor <name>   Assessor name on cover line
  --enhance           Rewrite executive summary via OpenAI (requires assessment.json + OPENAI_API_KEY)
  --enhance-model <m> OpenAI model for --enhance (default: gpt-4o-mini or OPENAI_MODEL)

Hook install options:
  --path <dir>        Project root (default: cwd)
  --type pre-commit|pre-push   Hook to install (default: pre-commit)
  --dry-run           Preview hook install without writing files
  --fail-on a,b,c     Gate severities (default: high)
  --with-jest         Include Jest baseline in hook scan
  --husky             Prefer .husky/ even when not present yet
  --fix               Run fix dry-run instead of a scan gate in the hook

Reduce options:
  --path <dir>        Project root (default: cwd)
  --format text|json  Output format (default: text)
  --output <file>     Write report to file (default: .simplebeacon/file-reduction.md)
  --scanner <id>      Run one scanner: build-artifacts, asset-consolidation, unused-files,
                      config-management, dependency-health, environment-variables,
                      data-freshness, data-access-patterns, data-privacy, data-lineage, data-consistency
  --verbose, -v       Print scanner summaries

Profiles:
  minimal    credentials + production-leak only
  standard   all rules with generic defaults
  cascade    ai-platform dashboard preset
  eu-ai-act  standard + EU AI Act pattern scan (August 2026 readiness)

Compliance options:
  --checklist <id>    Checklist profile: default | eu-ai-act

AI Plan options:
  --path, -p <dir>    Project root (default: cwd)
  --config, -c <f>    Config path (default: .simplebeacon/config.json)
  --output, -o <file> Write AI plan to file
  --complete          Run all 52 deterministic engines for comprehensive analysis

Global options:
  --debug             Print full stack traces on errors and disable spinner

Cache options (air-gapped support):
  simplebeacon cache prewarm          Pre-populate registry cache from npm (run before air-gap)
  simplebeacon cache export <file>    Export cache to JSON for USB transfer to air-gapped env
  simplebeacon cache import <file>    Import cache from JSON (air-gapped env)
  simplebeacon cache stats            Show cache entry count, freshness, and file path
  simplebeacon cache clear            Delete the local registry cache

Team metrics options (organizational compliance aggregation):
  simplebeacon team-metrics report              Show aggregated team compliance metrics
  simplebeacon team-metrics ingest              Ingest latest scan from .simplebeacon/history.json
  simplebeacon team-metrics export <file>       Export anonymized metrics to JSON
  simplebeacon team-metrics register [name]     Register current project with a friendly name
  simplebeacon team-metrics set-team <id>       Set the team identifier
  simplebeacon team-metrics clear               Delete all team metrics data

Examples:
  npx simplebeacon init
  npx simplebeacon init --profile minimal
  npx simplebeacon init --starter --profile gamedev
  npx simplebeacon scan --gate
  npx simplebeacon scan --offline --gate
  npx simplebeacon scan --air-gapped --gate
  npx simplebeacon scan --format json --output .simplebeacon/report.json --gate
  npx simplebeacon scan --format markdown --output .simplebeacon/audit-report.md --gate
  npx simplebeacon scan --gate --complete
  npx simplebeacon scan --format json --api-token sb_xxx --upload https://simplebeacon.ai/api/simplebeacon/cloud-scan
  npx simplebeacon scan --format json --output .simplebeacon/report.json --gate --certify
  npx simplebeacon cache prewarm
  npx simplebeacon cache export /tmp/sb-cache.json
  npx simplebeacon cache import /tmp/sb-cache.json
  npx simplebeacon cache stats
  npx simplebeacon team-metrics ingest
  npx simplebeacon team-metrics report
  npx simplebeacon team-metrics export /tmp/team-metrics.json
  npx simplebeacon team-metrics --format json
  npx simplebeacon team-metrics --recursive --output .simplebeacon/team-metrics.json
  npx simplebeacon assess --company "Acme" --assessor "Jane" --checklist eu-ai-act
  npx simplebeacon report --company "Acme LLC" --client "Acme Dashboard" --assessor "Jane"
  npx simplebeacon report --company "Acme LLC" --client "Acme Dashboard" --enhance
  npx simplebeacon compliance --checklist eu-ai-act --format json --output .simplebeacon/compliance.json
  npx simplebeacon init --profile eu-ai-act
  npx simplebeacon baseline sync
  npx simplebeacon hook install
  npx simplebeacon reduce
  npx simplebeacon reduce --format json --output .simplebeacon/file-reduction.json
  npx simplebeacon ai-plan --output .simplebeacon/ai-remediation-plan.md
  npx simplebeacon ai-plan --complete --output .simplebeacon/comprehensive-ai-plan.md
`);
}

function printScanHelp() {
    writeStdoutLine(`Simplebeacon scan — local release-hygiene gate (52 rule engines, zero upload)

Audit page workflow (https://simplebeacon.ai/audit):
  1. Scan + write report.json
  2. Add --certify for a signed .sbcert (requires network; needs --output)
  3. Import report.json or drop .sbcert on the audit page

Recommended:
  npx simplebeacon scan . --gate --format json --output .simplebeacon/report.json --certify

Common variants:
  npx simplebeacon scan . --gate --format json --output .simplebeacon/report.json
  npx simplebeacon scan . --gate --offline --format json --output .simplebeacon/report.json
  npx simplebeacon scan . --full --gate --format json --output .simplebeacon/report.json
  npx simplebeacon gate status --report .simplebeacon/report.json

Scan options:
  --path, -p <dir>       Project root (default: cwd)
  --config, -c <file>    Config path (default: .simplebeacon/config.json)
  --format, -f <fmt>     text | json | markdown (default: text)
  --output, -o <file>    Write report to file (required for --certify)
  --gate                 Exit 1 when blocking severities are found
  --fail-on a,b,c        Gate severities (default: high)
  --full                 Walk entire repo tree (not just scanPaths)
  --complete             Enable all 52 engines + full directory scan
  --offline              Fail on outbound network (skips --certify)
  --air-gapped           Offline + skip remote license checks
  --deep-scan            Bypass docs/vendor/cache filters
  --include-deps         Include node_modules and .git
  --exclude <paths>      Comma-separated path exclusions
  --certify              Request edge-signed .sbcert next to --output file
  --certify-url <url>    Override signing endpoint
  --handoff-export <f>   Redacted cross-domain bundle
  --verbose, -v          Config warnings and scan paths
  --quiet, -q            Suppress non-error output

Run simplebeacon --help for all commands.
`);
}

function printConfigWarnings(config, verbose) {
    if (!config || typeof config !== 'object') return;
    if (!verbose || !config.configWarnings?.length) return;
    for (const warning of config.configWarnings) {
        console.error(paint(`Warning: ${warning}`, 'yellow'));
    }
}

async function uploadReportToCloud(uploadUrl, apiToken, report) {
    if (typeof uploadUrl !== 'string' || !uploadUrl) {
        throw new ConfigError('uploadUrl must be a non-empty string', { uploadUrl });
    }
    if (typeof apiToken !== 'string' || !apiToken) {
        throw new ConfigError('--api-token is required when using --upload', { uploadUrl });
    }
    if (!report || typeof report !== 'object') {
        throw new ConfigError('report must be an object', { report });
    }

    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), 60000);
    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Simplebeacon-Token': apiToken
            },
            body: JSON.stringify({ report: sanitizeReportForCloudUpload(report) }),
            signal: abortController.signal
        });

        /** @type {Record<string, any>} */
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || data.error || `Cloud upload failed (${response.status})`);
        }

        return data;
    } finally {
        clearTimeout(timer);
    }
}

function createScanSpinner(label) {
    const text = label == null ? '' : String(label);
    if (_cliDebugMode || !process.stderr.isTTY) return { start() {}, stop() {} };
    const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let timer = null;
    return {
        start() {
            process.stderr.write(`\r${paint(chars[0], 'cyan')} ${text}...`);
            timer = setInterval(() => {
                i = (i + 1) % chars.length;
                process.stderr.write(`\r${paint(chars[i], 'cyan')} ${text}...`);
            }, 80);
        },
        stop() {
            if (timer) { clearInterval(timer); timer = null; }
            process.stderr.write(' '.repeat(text.length + 10) + '\r');
        }
    };
}

async function executeOneScan(options, networkGuard) {
    if (!options || typeof options !== 'object') throw new TypeError('executeOneScan requires an options object');
    const scanRoot = options.path;
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const configPath = options.config ? path.resolve(scanRoot, options.config) : options.config;
    const config = loadSimplebeaconConfig(platformRoot, configPath);
    if (options.complete || options.fullDirectoryScan) {
        config.fullDirectoryScan = true;
        if (options.verbose) console.error('[scan] --complete enabled: full directory scan + all 52 deterministic engines');
    }
    if (options.failOn) {
        config.gate = { ...config.gate, failOn: options.failOn };
    }

    printConfigWarnings(config, options.verbose);
    if (options.verbose) {
        console.error(`Scan paths: ${config.scanPaths?.join(', ') || '(none)'}`);
        console.error(`Production paths: ${config.productionPaths?.join(', ') || '(none)'}`);
        console.error(`Profile: ${config.profile || 'standard'}`);
    }

    validateFormat(options.format);

    const spinner = createScanSpinner('Scanning');
    spinner.start();
    try {
        const sanitizedScanRoot = sanitizePath(scanRoot);
        if (options.diff) {
            const diffFiles = collectGitDiffFiles(sanitizedScanRoot, {
                baseRef: options.baseRef,
                headRef: options.headRef
            });
            if (diffFiles && diffFiles.length) {
                options.diffFiles = diffFiles;
                if (options.verbose) {
                    console.error(`[scan] Diff-only mode: ${diffFiles.length} changed file(s)`);
                }
            } else if (!options.quiet) {
                console.error('[scan] --diff enabled but no changed files detected; scanning full configured scope.');
            }
        }
        // Deep scan: bypass docs/vendor/cache filters (but still respect .simplebeaconignore)
        if (options.deepScan) {
            config.fullDirectoryScan = true;
            config.scanAllFiles = true;
        }
        // Include deps: remove node_modules/.git from exclusions
        if (options.includeDeps && Array.isArray(options.exclude)) {
            options.exclude = options.exclude.filter((p) => p !== 'node_modules' && p !== '.git');
        }
        const report = await runScan(sanitizedScanRoot, {
            config,
            configPath: options.config,
            withJest: options.withJest,
            fullDirectoryScan: options.fullDirectoryScan || options.deepScan,
            ci: options.withCi || Boolean(process.env.CI || process.env.GITHUB_ACTIONS),
            tier: options.tier || 'developer',
            tierLimits: options.tierLimits || undefined,
            paidLicense: options.paidLicense,
            sandboxMode: options.sandboxMode,
            active: options.active,
            upgradeUrl: options.upgradeUrl,
            exclude: options.exclude,
            deepScan: options.deepScan,
            includeDeps: options.includeDeps,
            minConfidence: options.minConfidence,
            slopCop: options.slopCop,
            diffFiles: options.diffFiles,
            gzdoomLog: options.gzdoomLog,
            gzdoomNorun: options.gzdoomNorun !== undefined ? options.gzdoomNorun : undefined,
            gzdoomExe: options.gzdoomExe,
            iwad: options.iwad,
            gzdoomNorunDryRun: options.gzdoomNorunDryRun
        });
        networkGuard.assertOfflineClean();
        printTrustCompletion({
            quiet: options.noTrustBanner,
            offline: options.offline,
            networkEventCount: networkGuard.events.length
        }, paint);

        const gateResult = evaluateGate(report, config.gate);
        const jsonReport = formatJsonReport(report, gateResult);
        const airGapped = options.airGapped === true;
        spinner.stop();

        let outputFormat = options.format;
        if (options.anonymize) {
            outputFormat = 'json';
        }
        if (options.fix && outputFormat !== 'json') {
            outputFormat = 'text';
        }

        if (options.upload) {
            const uploadResult = await uploadReportToCloud(options.upload, options.apiToken, jsonReport);
            /** @type {string|undefined} */
            const scanId = uploadResult.scanId;
            console.error(`Cloud upload complete${scanId ? `: ${scanId}` : ''}`);
        }

        let payload;
        if (options.anonymize) {
            const anon = buildAnonymizedExport(report);
            const signed = signAnonymizedExport(anon);
            payload = JSON.stringify(signed, null, 2);
        } else {
            payload = selectPayload(report, gateResult, jsonReport, outputFormat);
        }

        if (options.output) {
            writeManagedFileSync(path.resolve(options.output), `${payload}\n`, {
                force: true,
                validators: options.format === 'json' ? [validateJSON, validateNotEmpty] : [validateNotEmpty]
            });
            console.error(`Report written to ${options.output}`);
            if (options.format === 'json') {
                appendScanHistory(platformRoot, jsonReport);
            }

            if (options.handoffExport) {
                const handoffPath = path.resolve(options.handoffExport);
                const handoffPayload = sanitizeHandoffExport(jsonReport, {
                    includeRedactedSnippets: options.includeRedactedSnippets === true
                });
                writeManagedFileSync(handoffPath, `${JSON.stringify(handoffPayload, null, 2)}\n`, {
                    force: true,
                    validators: [validateJSON, validateNotEmpty]
                });
                console.error(`Handoff export written to ${options.handoffExport}`);
            }

            // --certify: request an edge-signed compliance certificate for the report
            if (options.certify && options.format === 'json' && !options.offline && !airGapped) {
                try {
                    const { certifyReport } = require('../src/lib/certify-client');
                    const reportPath = path.resolve(options.output);
                    const certResult = await certifyReport(reportPath, {
                        certifyUrl: options.certifyUrl || undefined
                    });
                    console.error(`${paint('✓', 'green')} Compliance certificate issued: ${certResult.certPath}`);
                    console.error(`  Signature: ${certResult.signature.slice(0, 16)}...${certResult.signature.slice(-8)}`);
                    console.error(`  Issued at: ${certResult.issuedAt}`);
                    console.error(`  Next: verify at https://simplebeacon.ai/audit — drop ${certResult.certPath}`);
                } catch (certErr) {
                    console.error(`${paint('⚠', 'yellow')} Certification failed: ${certErr.message}`);
                    // Non-blocking — the scan itself succeeded
                }
            } else if (options.certify && (options.offline || airGapped)) {
                console.error(`${paint('⚠', 'yellow')} --certify requires network access — skipped in offline/air-gapped mode`);
            } else if (options.certify && options.format !== 'json') {
                console.error(`${paint('⚠', 'yellow')} --certify requires --format json — skipped for ${options.format} output`);
            }
        } else {
            writeStdoutLine(payload);
            if (options.certify) {
                console.error(`${paint('⚠', 'yellow')} --certify requires --output <file> — certificate is written next to the report path`);
            }
        }

        if (options.handoffExport && !options.output) {
            const handoffPath = path.resolve(options.handoffExport);
            const handoffPayload = sanitizeHandoffExport(jsonReport, {
                includeRedactedSnippets: options.includeRedactedSnippets === true
            });
            writeManagedFileSync(handoffPath, `${JSON.stringify(handoffPayload, null, 2)}\n`, {
                force: true,
                validators: [validateJSON, validateNotEmpty]
            });
            console.error(`Handoff export written to ${options.handoffExport}`);
        }

        if (options.paidLicense && !airGapped && !options.offline) {
            try {
                const { postTeamTelemetry } = require('../src/lib/ci-telemetry');
                const telemetryResult = await postTeamTelemetry(jsonReport, {
                    paid: true,
                    tier: options.tier || 'developer'
                }, {
                    airGapped,
                    offline: options.offline,
                    scanSource: 'ci',
                    context: { projectRoot: sanitizedScanRoot, scanSource: 'ci' }
                });
                if (!telemetryResult.skipped && !options.quiet) {
                    if (telemetryResult.ok) {
                        console.error('[simplebeacon] Team telemetry recorded.');
                    } else {
                        const detail = telemetryResult.networkError
                            ? 'endpoint unreachable'
                            : `POST failed (${telemetryResult.status || 'error'})`;
                        console.error(`[simplebeacon] Warning: Team telemetry ${detail}.`);
                    }
                }
            } catch {
                /* non-blocking */
            }
        }

        let remediation = null;

        if (options.fix) {
            const fixEngine = options.fixEngine || 'auto'; // auto | deterministic | llm
            const fixableIssues = gateResult.blockingIssues?.length > 0
                ? gateResult.blockingIssues
                : (report.rawIssues || []).filter((i) => i.severity === 'high' || i.severity === 'critical');
            if (fixableIssues.length > 0) {
                const remainingIssues = [...fixableIssues];

                // Phase 1: Deterministic fixes (no network, no LLM)
                if (fixEngine === 'deterministic' || fixEngine === 'auto') {
                    const supportedPatterns = new Set(getSupportedPatterns());
                    const deterministicIssues = remainingIssues.filter(
                        (i) => supportedPatterns.has(i.pattern) || supportedPatterns.has(i.metadata?.patternId)
                    );
                    if (deterministicIssues.length > 0) {
                        console.error(`\n🔧 [Deterministic Remediation] Attempting ${deterministicIssues.length} deterministic fix(es)...`);
                        const detResult = runDeterministicRemediation(deterministicIssues, {
                            dryRun: options.fixDryRun,
                            maxFixes: options.maxFixes,
                        });
                        console.error(`   Applied: ${detResult.applied} | Failed: ${detResult.failed} | Total: ${detResult.total}`);
                        for (const r of detResult.results) {
                            const icon = r.applied ? '✅' : '❌';
                            console.error(`   ${icon} ${r.issue}${r.diff ? '\n      ' + r.diff.split('\n').slice(0, 3).join('\n      ') : ''}`);
                        }
                        if (!remediation) {
                            remediation = { total: 0, applied: 0, failed: 0, results: [] };
                        }
                        remediation.total += detResult.total;
                        remediation.applied += detResult.applied;
                        remediation.failed += detResult.failed;
                        remediation.results.push(...detResult.results);

                        // Remove fixed issues from remaining
                        const fixedPatterns = new Set(
                            detResult.results.filter((r) => r.applied).map((r) => r.patternId)
                        );
                        remainingIssues = remainingIssues.filter(
                            (i) => !fixedPatterns.has(i.pattern) && !fixedPatterns.has(i.metadata?.patternId)
                        );
                    }
                }

                // Phase 2: LLM-based fixes (fallback for remaining issues)
                if ((fixEngine === 'llm' || fixEngine === 'auto') && remainingIssues.length > 0) {
                    console.error(`\n🔧 [LLM Remediation] Running local agent on ${remainingIssues.length} remaining finding(s)...`);
                    const llmResult = await runLocalRemediation(remainingIssues, {
                        dryRun: options.fixDryRun,
                        maxFixes: options.maxFixes,
                        model: options.fixProvider === 'ollama' || !options.fixProvider
                            ? process.env.SIMPLEBEACON_FIX_MODEL || 'llama3.2:latest'
                            : null
                    });
                    console.error(`   Applied: ${llmResult.applied} | Failed: ${llmResult.failed} | Total: ${llmResult.total}`);
                    for (const r of llmResult.results) {
                        const icon = r.applied ? '✅' : '❌';
                        console.error(`   ${icon} ${r.issue}${r.diff ? '\n      ' + r.diff.split('\n').slice(0, 3).join('\n      ') : ''}`);
                    }
                    if (!remediation) {
                        remediation = { total: 0, applied: 0, failed: 0, results: [] };
                    }
                    remediation.total += llmResult.total;
                    remediation.applied += llmResult.applied;
                    remediation.failed += llmResult.failed;
                    remediation.results.push(...llmResult.results);
                }
            } else {
                console.error('🔧 [Remediation] No high-severity findings to fix.');
            }
        }

        if (options.gate && !gateResult.pass) {
            console.error(paint(`Gate failed: ${gateResult.blockingIssues.length} blocking issue(s)`, 'red'));
            return 1;
        }

        if (options.fixDryRun && remediation && remediation.total > 0) {
            console.error(paint(remediation.total + ' fixable issue(s) found in dry-run; run without --dry-run to apply.', 'red'));
            return 1;
        }

        try {
            const { runReferralNudge } = require('../src/lib/referral-cli');
            await runReferralNudge(options, gateResult);
        } catch {
            /* non-blocking */
        }

        return 0;
    } catch (err) {
        spinner.stop();
        throw err;
    }
}

/**
 * Execute a scan command (with optional watch mode).
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function runScanCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runScanCommand requires an options object');
    // --air-gapped implies --offline and skips all remote calls
    const airGapped = options.airGapped === true;
    if (airGapped) {
        options.offline = true;
        if (options.upload) {
            console.error('[simplebeacon] --air-gapped cannot be used with --upload (contradictory)');
            return 1;
        }
    }
    // --offline + --upload is contradictory — fail fast before scanning
    if (options.offline && options.upload) {
        console.error('Offline mode blocked: --offline cannot be used with --upload');
        return 1;
    }
    const networkGuard = createNetworkGuard({ offline: options.offline });
    printTrustBanner({ quiet: options.noTrustBanner, offline: options.offline }, paint);
    if (airGapped && !options.noTrustBanner) {
        console.error(`${paint('✓', 'green')} Air-gapped mode — remote license validation and telemetry disabled`);
    }

    const license = await resolveCiLicense({ failOpenOnNetwork: true, failOpenOnExpired: !options.strictLicense, allowRemote: !airGapped, airGapped });
    if (!license.ok) {
        console.error(`[simplebeacon] ${license.message || 'Invalid SIMPLEBEACON_LICENSE_TOKEN'}`);
        return 1;
    }
    if (license.warning && !options.quiet) {
        console.error(`[simplebeacon] ${license.warning}`);
    }
    options.tier = license.tier;
    options.tierLimits = license.limits;
    options.paidLicense = license.paid;
    options.sandboxMode = license.sandbox;
    options.active = license.active;
    options.upgradeUrl = license.upgradeUrl;

    try {
        if (options.watch) {
            const scanRoot = options.path;
            const watchedPaths = [scanRoot];
            let debounceTimer = null;
            let isScanning = false;
            console.error(paint('[watch] Monitoring project for changes. Press Ctrl+C to stop.', 'cyan'));

            const run = async () => {
                if (isScanning) return;
                isScanning = true;
                try {
                    await executeOneScan(options, networkGuard);
                } catch (err) {
                    console.error(paint(`[watch] Scan error: ${err.message}`, 'red'));
                } finally {
                    isScanning = false;
                }
            };

            await run();

            const watchers = watchedPaths.map((p) => {
                try {
                    return fs.watch(p, { recursive: true }, (eventType, filename) => {
                        if (!filename || /node_modules|\.git|\.simplebeacon\/report/.test(filename)) return;
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            console.error(paint(`[watch] Change detected: ${filename}`, 'yellow'));
                            run();
                        }, 500);
                    });
                } catch (err) {
                    console.error(paint(`[watch] Failed to watch ${p}: ${err.message}`, 'yellow'));
                    return null;
                }
            }).filter(Boolean);

            // Keep alive until Ctrl+C
            let watchResolve;
            const keepAlive = new Promise((resolve) => { watchResolve = resolve; });
            process.once('SIGINT', () => {
                if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
                for (const w of watchers) w?.close?.();
                watchResolve(0);
            });
            return keepAlive;
        }

        const exitCode = await executeOneScan(options, networkGuard);
        return exitCode;
    } finally {
        networkGuard.dispose();
    }
}

/**
 * Upload a scan report to the SimpleBeacon dashboard.
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function runUploadCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runUploadCommand requires an options object');
    if (!options.apiToken) {
        throw new ConfigError('--api-token is required for upload', { command: 'upload' });
    }
    if (!options.report && !options.path) {
        throw new ConfigError('Provide --path to scan or --report to upload an existing report', { command: 'upload' });
    }

    let report;
    if (options.report) {
        report = readJsonFile(path.resolve(options.report), 'report');
    } else {
        const networkGuard = createNetworkGuard({ offline: options.offline });
        printTrustBanner({ quiet: options.noTrustBanner, offline: options.offline }, paint);
        try {
            const scanRoot = sanitizePath(options.path);
            const { platformRoot } = resolvePlatformRoot(scanRoot);
            const config = loadSimplebeaconConfig(platformRoot, options.config);
            if (options.complete || options.fullDirectoryScan) config.fullDirectoryScan = true;
            const rawReport = await runScan(scanRoot, {
                config,
                configPath: options.config,
                withJest: options.withJest,
                fullDirectoryScan: options.fullDirectoryScan || options.deepScan,
                ci: options.withCi,
                tier: options.tier || 'developer',
                tierLimits: options.tierLimits || undefined,
                exclude: options.exclude,
                deepScan: options.deepScan,
                includeDeps: options.includeDeps,
                minConfidence: options.minConfidence,
                slopCop: options.slopCop,
                gzdoomLog: options.gzdoomLog,
                gzdoomNorun: options.gzdoomNorun !== undefined ? options.gzdoomNorun : undefined,
                gzdoomExe: options.gzdoomExe,
                iwad: options.iwad,
                gzdoomNorunDryRun: options.gzdoomNorunDryRun
            });
            networkGuard.assertOfflineClean();
            const gateResult = evaluateGate(rawReport, config.gate);
            report = formatJsonReport(rawReport, gateResult);
        } finally {
            networkGuard.dispose();
        }
    }

    await uploadReportToDashboard(report, options);
    return 0;
}

async function uploadReportToDashboard(report, options) {
    const apiUrl = (options.apiUrl || process.env.SIMPLEBEACON_API_URL || 'https://simplebeacon.ai').replace(/\/$/, '');
    const token = options.apiToken;
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), 60000);
    try {
        const response = await fetch(`${apiUrl}/api/simplebeacon/upload-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                report: sanitizeReportForCloudUpload(report),
                scannedPath: report.projectPath || report.projectRoot || options.path || options.report || ''
            }),
            signal: abortController.signal
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Upload failed (${response.status})`);
        }
        writeStdoutLine(`✅ Upload complete: ${data.reportId}`);
        writeStdoutLine(`👉 View dashboard: ${apiUrl}/dashboard/analyze?cliReport=${data.reportId}`);
        return data;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Sync Jest baseline.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runBaselineSyncCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runBaselineSyncCommand requires an options object');
    const root = sanitizePath(options.path);
    if (options.dryRun) {
        writeStdoutLine('DRY RUN — baseline sync requires a test run; use without --dry-run to execute.');
        return;
    }
    const { summary, baselinePath, baseline } = await syncJestBaseline(root, { config: options.config });

    writeStdoutLine(`Baseline synced: ${baselinePath}`);
    writeStdoutLine(`  Jest: ${baseline.jestTestsLabel} (${summary.suitesPassed} suites)`);
}

/**
 * Post GitHub PR comment from JSON report.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runCommentCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runCommentCommand requires an options object');
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    if (!fs.existsSync(reportPath)) {
        throw new Error(`Report not found: ${reportPath}`);
    }

    const report = readJsonFile(reportPath, 'report');

    const body = formatGithubComment(report, report.gate || null);

    if (options.printOnly) {
        writeStdoutLine(body);
        return;
    }

    if (!process.env.GITHUB_TOKEN) {
        writeStdoutLine(body);
        console.error('\n(dry-run — set GITHUB_TOKEN to post to GitHub)');
        return;
    }

    /** @type {Record<string, any>} */
    const result = await postGithubComment(reportPath, {
        token: process.env.GITHUB_TOKEN,
        repo: options.repo,
        issueNumber: options.issueNumber
    });

    /** @type {string|undefined} */
    const commentUrl = result.html_url || result.url;
    writeStdoutLine(`Posted comment: ${commentUrl || 'ok'}`);
}

async function loadOrRunReport(options) {
    if (!options || typeof options !== 'object') throw new TypeError('loadOrRunReport requires an options object');
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    if (options.report && !fs.existsSync(reportPath)) {
        throw new Error(`Report not found: ${reportPath}`);
    }
    if (fs.existsSync(reportPath)) {
        return readJsonFile(reportPath, 'report');
    }

    const scanRoot = sanitizePath(options.path);
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const config = loadSimplebeaconConfig(platformRoot, options.config);
    const report = await runScan(scanRoot, { config, configPath: options.config });
    const gateResult = evaluateGate(report, config.gate);
    return formatJsonReport(report, gateResult);
}

/**
 * Build customer assessment JSON from scan report.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runAssessCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runAssessCommand requires an options object');
    const root = sanitizePath(options.path);
    const report = await loadOrRunReport(options);
    const assessment = buildAssessmentReport(report, {
        company: options.company || path.basename(root),
        assessor: options.assessor || '',
        projectRoot: report.projectRoot || root,
        checklistProfile: options.checklist || undefined,
        commandsRun: [
            'npx simplebeacon scan --format json --output .simplebeacon/report.json --gate',
            `npx simplebeacon assess --company "${options.company || path.basename(root)}"${options.assessor ? ` --assessor "${options.assessor}"` : ''}${options.checklist ? ` --checklist ${options.checklist}` : ''}`
        ]
    });

    const outputPath = path.resolve(options.output || '.simplebeacon/assessment.json');
    writeManagedFileSync(outputPath, `${JSON.stringify(assessment, null, 2)}\n`, {
        force: true,
        validators: [validateJSON, validateNotEmpty]
    });

    writeStdoutLine(`Assessment written to ${outputPath}`);
    const execSummary = assessment?.executiveSummary ?? {};
    const complianceSummary = assessment?.complianceChecklist?.summary ?? {};
    writeStdoutLine(`Gate: ${execSummary.gateResult ?? '—'}`);
    writeStdoutLine(`Compliance: ${complianceSummary.passed ?? 0}/${(complianceSummary.passed ?? 0) + (complianceSummary.failed ?? 0)} rules pass (score ${execSummary.complianceScore ?? '—'})`);
    writeStdoutLine(`Headline: ${execSummary.headline ?? '—'}`);

    if (options.withAnalyzerSuite) {
        const { buildAiSystemsIssueAnalysis } = require('../src/lib/ai-problem-analyzer-suite');
        const { getCachedAnalysis, setCachedAnalysis } = require('../src/lib/ai-problem-analyzer-cache');
        const { sanitizeAiProblemAnalyzerExport } = require('../src/lib/ai-problem-analyzer-export-sanitize');

        const cached = getCachedAnalysis(root, report);
        let analysisResult;
        if (cached) {
            analysisResult = cached;
            writeStdoutLine('[Analyzer Suite] Using cached analysis (report unchanged).');
        } else {
            const allIssueIds = Array.from({ length: 48 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`);
            analysisResult = buildAiSystemsIssueAnalysis(allIssueIds, { context: { scanReport: report } });
            setCachedAnalysis(root, report, analysisResult);
        }

        const exportPayload = sanitizeAiProblemAnalyzerExport(analysisResult, { projectPath: root, context: { healthScore: report.qualityScore } });
        const suitePath = path.resolve(options.output ? options.output.replace(/\.json$/, '-analyzer-suite.json') : '.simplebeacon/analyzer-suite.json');
        writeManagedFileSync(suitePath, `${JSON.stringify(exportPayload, null, 2)}\n`, {
            force: true,
            validators: [validateJSON, validateNotEmpty]
        });
        writeStdoutLine(`Analyzer suite written to ${suitePath}`);
        writeStdoutLine(`Measured: ${analysisResult.riskSummary.executionStatus.measured} | Insufficient Data: ${analysisResult.riskSummary.executionStatus.insufficientData} | Stubs: ${analysisResult.riskSummary.executionStatus.stub}`);
        writeStdoutLine(`Overall Risk Level: ${analysisResult.riskSummary.overallRiskLevel}`);
    }
}

/**
 * Build client-facing markdown audit from scan JSON.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runReportCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runReportCommand requires an options object');
    const root = sanitizePath(options.path);
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    if (!fs.existsSync(reportPath)) {
        throw new Error(`Report not found: ${reportPath}. Run: npx simplebeacon scan --format json --output .simplebeacon/report.json --gate`);
    }

    const report = readJsonFile(reportPath, 'report');

    let assessment = null;
    const assessmentPath = path.resolve(options.assessment || '.simplebeacon/assessment.json');
    if (options.enhance) {
        if (!fs.existsSync(assessmentPath)) {
            throw new Error(`Assessment required for --enhance: ${assessmentPath}. Run: npx simplebeacon assess`);
        }
    } else if (options.assessment || fs.existsSync(assessmentPath)) {
        if (!fs.existsSync(assessmentPath)) {
            throw new Error(`Assessment not found: ${assessmentPath}`);
        }
    }

    if (fs.existsSync(assessmentPath)) {
        assessment = readJsonFile(assessmentPath, 'assessment');
    }

    const reportOptions = {
        client: options.client || path.basename(root),
        company: options.company || options.client || path.basename(root),
        assessor: options.assessor || 'Simplebeacon Security Audit Service',
        branch: options.branch || null,
        assessment,
        projectRoot: report.projectRoot || root
    };

    let markdown = compileAuditReportMarkdown(report, reportOptions);

    if (options.enhance) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is required for --enhance');
        }

        try {
            markdown = await enhanceExecutiveSummary(markdown, report, assessment, {
                ...reportOptions,
                model: options.enhanceModel || undefined
            });
            writeStdoutLine('Executive summary enhanced via OpenAI');
        } catch (error) {
            console.error(paint(`Warning: AI enhancement failed — using deterministic executive summary (${error.message})`, 'yellow'));
        }
    }

    const outputPath = path.resolve(options.output || 'AUDIT_REPORT.md');
    writeManagedFileSync(outputPath, `${markdown}\n`, {
        force: true,
        validators: [validateNotEmpty]
    });

    writeStdoutLine(`Audit report written to ${outputPath}`);
    writeStdoutLine(`Gate: ${report.gate?.pass ? 'PASS' : 'FAIL'}`);
    if (assessment?.executiveSummary?.headline) {
        writeStdoutLine(`Headline: ${assessment.executiveSummary.headline}`);
    }
}

/**
 * Evaluate corporate safety checklist from report.
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function runComplianceCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runComplianceCommand requires an options object');
    const root = sanitizePath(options.path);
    const report = await loadOrRunReport(options);
    let npmAudit = null;
    try {
        const { runNpmAudit } = require(path.join(root, 'server/lib/npm-audit-runner'));
        npmAudit = runNpmAudit(root, { force: options.forceNpmAudit === true });
    } catch (auditErr) {
        if (!options.quiet) {
            console.error(`[compliance] npm audit unavailable: ${auditErr.message}`);
        }
        npmAudit = null;
    }
    const checklist = evaluateComplianceChecklist(report, {
        projectRoot: report.projectRoot || root,
        npmAudit,
        checklistProfile: options.checklist || undefined
    });
    const outputPath = path.resolve(options.output || '.simplebeacon/compliance-result.json');

    if (options.format === 'json' || options.output) {
        writeManagedFileSync(outputPath, `${JSON.stringify(checklist, null, 2)}\n`, {
            force: true,
            validators: [validateJSON, validateNotEmpty]
        });
        writeStdoutLine(`Compliance checklist written to ${outputPath}`);
    }

    /** @type {Record<string, any>} */
    const summary = checklist?.summary ?? {};
    writeStdoutLine(`${summary.headline ?? 'Compliance check complete'}`);
    for (const rule of checklist?.rules ?? []) {
        const icon = rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '○';
        writeStdoutLine(`  ${icon} ${rule.id ?? '—'} ${rule.title ?? '—'} — ${rule.evidence ?? ''}`);
    }

    if (options.gate && (summary.failed ?? 0) > 0) {
        return 1;
    }
    return 0;
}

/**
 * Create .simplebeacon/config.json and baseline.json.
 * @param {Object} options
 * @returns {Promise<number|void>}
 */
async function runInitCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runInitCommand requires an options object');
    const root = sanitizePath(options.path);
    const created = initSimplebeacon(root, {
        profile: options.profile,
        dryRun: options.dryRun,
        force: options.force
    });
    const detected = created.detected || detectProjectProfile(root);

    const onboarding = options.withMcp || options.withCi || options.starter || options.agent;
    let stack = null;
    if (onboarding) {
        stack = installAgentStack(root, {
            mode: options.mcpMode,
            force: options.force,
            dryRun: options.dryRun,
            agent: options.agent || options.starter,
            starter: options.starter || options.agent,
            withMcp: options.withMcp || options.starter || options.agent,
            withCi: options.withCi || options.starter || options.agent,
            withHooks: options.withHooks || options.starter || options.agent,
            hosts: options.hosts,
            platform: options.ciPlatform,
            paidTier: Boolean(process.env.SIMPLEBEACON_LICENSE_TOKEN)
        });
    }

    if (created.dryRun) {
        writeStdoutLine('DRY RUN — no files were modified');
        writeStdoutLine('');
        for (const action of created.plannedActions || []) {
            writeStdoutLine(`Would ${action.action}: ${action.path}`);
        }
        if (stack) {
            for (const host of stack.hosts || []) {
                if (host.mcp?.dryRun) {
                    writeStdoutLine(`Would write MCP [${host.host}]: ${host.mcp.configPath}`);
                } else if (host.mcp?.created || host.mcp?.merged) {
                    writeStdoutLine(`Would write MCP [${host.host}]: ${host.mcp.configPath}`);
                }
                if (host.instructions?.dryRun) {
                    writeStdoutLine(`Would write instructions [${host.host}]: ${host.instructions.path}`);
                }
            }
            if (stack.ciWorkflow?.dryRun) {
                writeStdoutLine(`Would create: ${stack.ciWorkflow.path} (${stack.ciWorkflow.platformLabel})`);
            } else if (stack.ciWorkflow?.skipped) {
                writeStdoutLine(`Would skip: ${stack.ciWorkflow.path} (${stack.ciWorkflow.platformLabel})`);
            }
        }
        writeStdoutLine('');
        writeStdoutLine(`Profile: ${created.profile}`);
        return;
    }

    if (created.configCreated) {
        writeStdoutLine(`Created ${created.configPath}`);
    } else {
        writeStdoutLine(`Skipped existing ${created.configPath}`);
    }
    if (created.baselineCreated) {
        writeStdoutLine(`Created ${created.baselinePath}`);
    } else {
        writeStdoutLine(`Skipped existing ${created.baselinePath}`);
    }

    writeStdoutLine('');
    writeStdoutLine(`Profile: ${created.profile}`);
    writeStdoutLine(`Detected package manager: ${detected.packageManager}`);
    writeStdoutLine(`Scan paths: ${detected.scanPaths.join(', ')}`);
    writeStdoutLine(`Production paths: ${detected.productionPaths.join(', ')}`);
    writeStdoutLine('');
    writeStdoutLine('Next steps:');
    writeStdoutLine('  npx simplebeacon scan --gate');
    writeStdoutLine('  npx simplebeacon-mcp --smoke-test');
    writeStdoutLine('  Reload your AI editor MCP settings → enable simplebeacon');

    if (stack) {
        writeStdoutLine('');
        writeStdoutLine('Agent bootstrap:');
        for (const host of stack.hosts || []) {
            const mcp = host.mcp;
            const instr = host.instructions;
            if (mcp?.created || mcp?.merged) {
                writeStdoutLine(`  MCP [${host.label}]: ${mcp.configPath} (${mcp.mode || 'configured'})`);
            } else if (mcp?.skipped && !mcp?.unchanged) {
                writeStdoutLine(`  MCP [${host.label}]: skipped — ${mcp.reason || mcp.message || 'exists'}`);
            } else if (mcp?.unchanged) {
                writeStdoutLine(`  MCP [${host.label}]: unchanged`);
            }
            if (instr?.created || instr?.merged) {
                writeStdoutLine(`  Instructions [${host.label}]: ${instr.path}`);
            } else if (instr?.skipped && instr?.unchanged) {
                writeStdoutLine(`  Instructions [${host.label}]: unchanged (${instr.path})`);
            }
        }
        if (stack.cursorHooks?.created) {
            writeStdoutLine(`  Cursor pre-apply hook: ${stack.cursorHooks.hooksJsonPath}`);
        }
        if (stack.gitHook?.hookPath) {
            writeStdoutLine(`  Git pre-commit hook: ${stack.gitHook.hookPath}`);
        }
        if (stack.ciWorkflow?.created) {
            writeStdoutLine(`  CI workflow: ${stack.ciWorkflow.path} (${stack.ciWorkflow.platformLabel})`);
        } else if (stack.ciWorkflow?.skipped) {
            writeStdoutLine(`  CI workflow: skipped existing ${stack.ciWorkflow.path}`);
        }
        if (stack.claudeDesktopHint) {
            writeStdoutLine('');
            writeStdoutLine(stack.claudeDesktopHint.message);
            writeStdoutLine(JSON.stringify(stack.claudeDesktopHint.configSnippet, null, 2));
        }
        if (stack.artifacts?.brief?.path) {
            writeStdoutLine(`  Agent brief: ${stack.artifacts.brief.path}`);
        }
    }

    if (options.smoke && !options.dryRun) {
        writeStdoutLine('');
        writeStdoutLine('Running smoke scan...');
        const smoke = await runSmokeScan(root, options);
        if (smoke.ok) {
            refreshArtifacts(root, smoke.report, { task: 'hygiene' });
            writeStdoutLine(`Smoke scan complete — gate ${smoke.gatePass ? 'PASS' : 'FAIL'}`);
        } else {
            writeStdoutLine(`Smoke scan skipped: ${smoke.error || 'unknown error'}`);
        }
    }
}

function runHookInstallCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runHookInstallCommand requires an options object');
    const result = installSimplebeaconHook(sanitizePath(options.path), {
        type: options.hookType,
        failOn: options.failOn || 'high',
        withJest: options.withJest,
        preferHusky: options.preferHusky,
        fix: options.fix,
        secretsOnly: options.secretsOnly,
        dryRun: options.dryRun
    });

    if (result.dryRun) {
        writeStdoutLine('DRY RUN — no files were modified');
        writeStdoutLine('');
        for (const action of result.plannedActions || []) {
            writeStdoutLine(`Would ${action.action}: ${action.path}`);
        }
        writeStdoutLine(`Hook type: ${result.type} (${result.kind})`);
        return;
    }

    writeStdoutLine(`Installed ${result.type} hook (${result.kind}): ${result.hookPath}`);
    if (result.manual) {
        writeStdoutLine('');
        writeStdoutLine('Not a Git repo — copy the script into .husky/ or .git/hooks/ and chmod +x.');
    } else if (result.kind === 'husky') {
        writeStdoutLine('Ensure Husky is enabled: npm install -D husky && npx husky init');
    }
}

/**
 * Analyze repo for file-reduction opportunities.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runReduceCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runReduceCommand requires an options object');
    const root = sanitizePath(options.path);
    const FILE_REDUCTION_SCANNER_IDS = [
        'build-artifacts', 'asset-consolidation', 'unused-files', 'directory-bloat', 'dead-code'
    ];
    const scannerFilter = options.scanner;
    const scannerOptions = scannerFilter
        ? {
            [scannerFilter]: { enabled: true },
            ...(Object.fromEntries(
                [...FILE_REDUCTION_SCANNER_IDS, 'config-management', 'dependency-health', 'environment-variables', 'data-freshness', 'data-access-patterns', 'data-privacy', 'data-lineage', 'data-consistency']
                    .filter((id) => id !== scannerFilter)
                    .map((id) => [id, { enabled: false }])
            ))
        }
        : Object.fromEntries(FILE_REDUCTION_SCANNER_IDS.map((id) => [id, { enabled: true }]));

    const report = await runFileReductionScan(root, {
        dryRun: true,
        scanners: scannerOptions
    });
    report.scanProfile = 'file-reduction';
    const { enrichCleanupReport } = require('../src/lib/enrich-cleanup-report');
    const { writeFileReductionArtifacts } = require('../src/lib/file-reduction-ai-notes');
    const enriched = enrichCleanupReport(report, { profile: 'file-reduction' });
    const aiArtifacts = writeFileReductionArtifacts(root, enriched, { profile: 'file-reduction' });

    const outputPath = options.output
        || (options.format === 'json'
            ? path.join(root, '.simplebeacon', 'file-reduction.json')
            : path.join(root, '.simplebeacon', 'file-reduction.md'));
    const rendered = generateFileReductionReport(enriched, { format: options.format });

    writeManagedFileSync(outputPath, options.format === 'json' ? `${rendered}\n` : rendered, {
        force: true,
        validators: options.format === 'json' ? [validateJSON, validateNotEmpty] : [validateNotEmpty]
    });

    writeStdoutLine(`File reduction report written to ${outputPath}`);
    if (aiArtifacts?.markdownPath) {
        writeStdoutLine(`AI cleanup notes: ${aiArtifacts.markdownPath}`);
        writeStdoutLine(`Structured JSON: ${aiArtifacts.notesPath}`);
    }
    writeStdoutLine(`Findings: ${enriched.summary.totalFindings} | Reclaimable: ${enriched.summary.reclaimableBytes} bytes`);
    if (options.verbose) {
        for (const [scannerId, summary] of Object.entries(report.scanners || {})) {
            writeStdoutLine(`  ${scannerId}: ${JSON.stringify(summary)}`);
        }
    }
    if (options.format === 'text') {
        writeStdoutLine('');
        writeStdoutLine(rendered.split('\n').slice(0, 18).join('\n'));
        if (rendered.split('\n').length > 18) {
            writeStdoutLine('…');
        }
    }
}

function runSecretsGateCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runSecretsGateCommand requires an options object');
    const { scanTextContent } = require('../src/lib/credential-pattern-scanner');
    const root = resolveCliProjectRoot(options.path, {
        mustExist: true,
        mustBeDirectory: true,
        label: 'Project path'
    });
    // runStagedSecretsGate is not exported — use scanTextContent as fallback
    const { execSync } = require('child_process');
    let stagedFiles = [];
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: root, encoding: 'utf8' });
        stagedFiles = output.trim().split('\n').filter(Boolean);
    } catch { /* not a git repo or no staged files */ }

    const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '.simplebeacon']);
    const allFindings = [];
    let scannedFiles = 0, skippedFiles = 0;
    for (const file of stagedFiles) {
        const fullPath = path.resolve(root, file);
        if (!fs.existsSync(fullPath)) continue;
        if (file.split('/').some(p => SKIP_DIRS.has(p))) { skippedFiles++; continue; }
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            allFindings.push(...scanTextContent(content, fullPath));
            scannedFiles++;
        } catch { skippedFiles++; }
    }
    const result = {
        pass: allFindings.length === 0,
        blockingCount: allFindings.length,
        scannedFiles, skippedFiles,
        findings: allFindings,
        message: allFindings.length === 0 ? 'No secrets detected in staged files' : `${allFindings.length} secret(s) detected`
    };
    const asJson = options.format === 'json' || options.jsonOutput;

    if (asJson) {
        writeStdoutLine(JSON.stringify({
            pass: result.pass,
            blockingCount: result.blockingCount,
            scannedFiles: result.scannedFiles,
            skippedFiles: result.skippedFiles,
            message: result.message,
            findings: (result.findings || []).map((finding) => ({
                file: finding.filePath || finding.file,
                line: finding.line,
                pattern: finding.pattern,
                severityBand: finding.severityBand,
                redactedPreview: finding.metadata?.redactedPreview || '[REDACTED]',
                recommendation: finding.recommendation
            }))
        }, null, 2));
    } else if (!options.quiet) {
        writeStdoutLine(result.message || (result.pass ? 'Staged secrets gate passed' : 'Staged secrets gate failed'));
        if (result.findings?.length) {
            console.error('');
            console.error('[SimpleBeacon] COMMIT BLOCKED — staged secret detected');
            for (const finding of result.findings) {
                const file = finding.filePath || finding.file;
                const preview = finding.metadata?.redactedPreview || '****';
                console.error(`  ${file}:${finding.line}  ${finding.pattern}  (${preview})`);
                console.error(`    ${finding.recommendation}`);
            }
            console.error('');
            console.error('Run: npx simplebeacon secrets-gate --path .');
        }
    }

    if (result.pass) {
        return 0;
    }
    return 1;
}

function runSuperchargeCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runSuperchargeCommand requires an options object');
    const root = resolveCliProjectRoot(options.path || '.');
    const {
        buildAgentSupercharge,
        writeAgentSupercharge,
        formatSuperchargeMarkdown
    } = require('../src/lib/agent-supercharge');
    const { readReport } = require('../src/lib/agent-context-pack');
    const { resolveAgentTier } = require('../src/lib/agent-tier-capabilities');

    if (options.watchArtifacts) {
        const { watchAgentArtifacts } = require('../src/lib/agent-artifact-watcher');
        writeStdoutLine(`Watching ${path.join(root, '.simplebeacon', 'report.json')} for artifact refresh…`);
        watchAgentArtifacts(root, {
            task: options.task || 'hygiene',
            paid: resolveAgentTier().paid,
            onRefresh(result) {
                writeStdoutLine(result.ok ? `Refreshed ${result.path}` : `Refresh failed: ${result.error}`);
            }
        });
        return 0;
    }

    const report = readReport(root);
    const tierCtx = resolveAgentTier();
    if (options.writeDisk !== false) {
        writeAgentSupercharge(root, {
            task: options.task,
            report,
            paid: tierCtx.paid,
            tierCtx
        });
    }
    const bundle = buildAgentSupercharge(root, {
        task: options.task,
        report,
        paid: tierCtx.paid,
        tierCtx,
        workspaceRoot: process.env.SIMPLEBEACON_PROJECT_ROOT || undefined
    });

    if (options.format === 'markdown') {
        writeStdoutLine(formatSuperchargeMarkdown(bundle));
    } else {
        writeStdoutLine(JSON.stringify(bundle, null, 2));
    }
    return bundle.mission?.handoffReady ? 0 : 1;
}

function runGateStatusCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runGateStatusCommand requires an options object');
    const root = resolveCliProjectRoot(options.path);
    const status = readGateStatus(root, {
        reportPath: options.report ? path.relative(root, path.resolve(root, options.report)) : undefined
    });

    if (options.format === 'json') {
        writeStdoutLine(JSON.stringify(status, null, 2));
        return status.ok && status.gatePass ? 0 : 1;
    }

    if (!status.ok) {
        writeStdoutLine(status.error);
        writeStdoutLine(`Report path: ${status.reportPath}`);
        return 1;
    }

    writeStdoutLine(`Gate: ${status.gatePass ? 'PASS' : 'REVIEW'}`);
    writeStdoutLine(`Report: ${status.reportPath} (${status.generatedAt || 'unknown time'})`);
    writeStdoutLine(`Blocking: ${status.blockingCount} · Warnings: ${status.warningCount} · Fail on: ${status.failOn.join(', ')}`);
    if (status.hint) writeStdoutLine(status.hint);
    if (status.topBlocking.length) {
        writeStdoutLine('');
        writeStdoutLine('Top blocking:');
        for (const issue of status.topBlocking) {
            writeStdoutLine(`  [${issue.severity}] ${issue.type}: ${issue.description}`);
        }
    }
    return status.gatePass ? 0 : 1;
}

/**
 * Generate Executive Risk Certificate PDF.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runPdfCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runPdfCommand requires an options object');
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    const outputPath = options.output || 'simplebeacon-executive-risk-certificate.html';
    const result = await generateExecutivePdf(reportPath, outputPath);
    if (!result.ok) {
        throw new Error(result.error);
    }
    writeStdoutLine(result.message);
}

async function runBuyClearanceCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runBuyClearanceCommand requires an options object');
    const email = options.email;
    if (!email) {
        throw new Error('--email is required for buy-clearance');
    }
    const server = options.server || 'https://simplebeacon.ai';
    const checkoutUrl = `${server}/api/simplebeacon/billing/checkout`;

    console.error('[buy-clearance] Initiating checkout...');
    const checkoutController = new AbortController();
    const checkoutTimer = setTimeout(() => checkoutController.abort(), 30000);
    let response;
    try {
        response = await fetch(checkoutUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, product: 'executive_clearance' }),
            signal: checkoutController.signal
        });
    } finally {
        clearTimeout(checkoutTimer);
    }
    /** @type {Record<string, any>} */
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || data.error || `Checkout failed (${response.status})`);
    }
    if (!data.url) {
        throw new Error('Checkout URL not returned from server');
    }
    if (!/^https?:\/\//i.test(String(data.url))) {
        throw new Error('Invalid checkout URL received from server');
    }

    console.error(`[buy-clearance] Opening browser: ${data.url}`);
    const { execFile } = require('child_process');
    const platform = process.platform;
    const url = String(data.url);
    const [cmd, cmdArgs] = platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : platform === 'darwin'
            ? ['open', [url]]
            : ['xdg-open', [url]];
    execFile(cmd, cmdArgs, (err) => {
        if (err) console.error('[buy-clearance] Could not open browser automatically. Please open the URL manually.');
    });

    const sessionUrl = `${server}/api/simplebeacon/billing/session?session_id=${data.sessionId}`;
    const pollSeconds = Number.isFinite(options.pollSeconds) && options.pollSeconds > 0 ? options.pollSeconds : 5;
    const maxPolls = Number.isFinite(options.maxPolls) && options.maxPolls > 0 ? options.maxPolls : 60;

    console.error(`[buy-clearance] Polling for payment completion (max ${maxPolls} attempts, ${pollSeconds}s interval)...`);
    const os = require('os');
    for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, pollSeconds * 1000));
        try {
            const poll = await fetch(sessionUrl);
            /** @type {Record<string, any>} */
            const pollData = await poll.json().catch(() => ({}));
            if (pollData.paymentStatus === 'paid') {
                if (pollData.licenseToken) {
                    const licenseDir = path.join(os.homedir(), '.simplebeacon');
                    try {
                        fs.mkdirSync(licenseDir, { recursive: true });
                    } catch (mkdirErr) {
                        throw new Error(`Cannot create license directory ${licenseDir}: ${mkdirErr.message}`);
                    }
                    const licensePath = path.join(licenseDir, 'license.jwt');
                    try {
                        fs.writeFileSync(licensePath, `${pollData.licenseToken}\n`, 'utf8');
                    } catch (writeErr) {
                        throw new Error(`Cannot write license token to ${licensePath}: ${writeErr.message}`);
                    }
                    console.error('[buy-clearance] License token saved');
                    writeStdoutLine(JSON.stringify({ success: true, licensePath, email: pollData.email }, null, 2));
                    return;
                }
                console.error('[buy-clearance] Payment confirmed but license token not yet available. Retrying...');
            }
        } catch (err) {
            console.error(`[buy-clearance] Poll error: ${err.message}`);
        }
    }

    throw new Error('Payment confirmation timed out. Run `npx simplebeacon buy-clearance --email <addr>` again to retry, or check your email for the license token.');
}

async function runReferCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runReferCommand requires an options object');
    const { runReferCommand: runRefer } = require('../src/lib/referral-cli');
    return runRefer(options, {
        writeOut: writeStdoutLine,
        writeErr: (...args) => console.error(...args)
    });
}

/** Validate command-specific required flags before dispatch. */
function validateCommandOptions(options) {
    if (!options || typeof options !== 'object') return;
    const cmd = options.command;
    if (cmd === 'buy-clearance' && !options.email) {
        throw new ConfigError('--email is required for buy-clearance', { command: cmd });
    }
    if (cmd === 'refer' && !options.from && !process.env.SIMPLEBEACON_REFERRER_EMAIL && !process.env.SIMPLEBEACON_EMAIL && !process.env.SIMPLEBEACON_LICENSE_TOKEN) {
        const licensePath = path.join(require('os').homedir(), '.simplebeacon', 'license.jwt');
        if (!fs.existsSync(licensePath)) {
            throw new ConfigError('--from is required for refer (or set SIMPLEBEACON_REFERRER_EMAIL / save ~/.simplebeacon/license.jwt)', { command: cmd });
        }
    }
    if (cmd === 'pdf' && options.report && !fs.existsSync(path.resolve(options.report))) {
        throw new ConfigError(`Report not found: ${options.report}`, { command: cmd });
    }
    if (cmd === 'comment' && !options.printOnly && !options.issueNumber) {
        throw new ConfigError('--issue-number is required (or use --print-only)', { command: cmd });
    }
}

/**
 * Execute a cache management command for air-gapped support.
 * Subcommands: prewarm, export, import, stats, clear
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function runCacheCommand(options) {
    const {
        prewarmCache,
        exportCache,
        importCache,
        getCacheStats,
        clearCache
    } = require('../src/lib/offline-resolver');

    const subcommand = options._positional?.[0] || 'stats';

    switch (subcommand) {
        case 'stats': {
            const stats = getCacheStats();
            console.error(`Cache file:     ${stats.cacheFile}`);
            console.error(`Total entries:  ${stats.totalEntries}`);
            console.error(`Fresh entries:  ${stats.fresh}`);
            console.error(`Stale entries:  ${stats.stale}`);
            if (stats.cacheAge !== null) {
                const ageDays = Math.floor(stats.cacheAge / (24 * 60 * 60 * 1000));
                console.error(`Cache age:      ${ageDays} day(s)`);
            }
            return 0;
        }
        case 'prewarm': {
            console.error('[simplebeacon] Pre-warming registry cache (this requires network access)...');
            const results = await prewarmCache([], { onProgress: (name, exists) => {
                if (exists === true) console.error(`  ✓ ${name}`);
                else if (exists === false) console.error(`  ✗ ${name} (not found)`);
            }});
            console.error(`\nDone. Cached: ${results.cached}, Failed: ${results.failed}`);
            return 0;
        }
        case 'export': {
            const outputPath = options._positional?.[1] || options.output;
            if (!outputPath) {
                console.error('[simplebeacon] Usage: simplebeacon cache export <output-file>');
                return 1;
            }
            const data = exportCache(outputPath);
            console.error(`Exported ${data.entryCount} cache entries to ${outputPath}`);
            console.error(`  Known-good packages: ${data.knownGoodPackages.length}`);
            console.error(`  Known-hallucinated packages: ${data.knownHallucinatedPackages.length}`);
            return 0;
        }
        case 'import': {
            const inputPath = options._positional?.[1] || options.input;
            if (!inputPath) {
                console.error('[simplebeacon] Usage: simplebeacon cache import <input-file>');
                return 1;
            }
            try {
                const result = importCache(inputPath);
                console.error(`Imported ${result.imported} cache entries from ${inputPath}`);
                return 0;
            } catch (err) {
                console.error(`[simplebeacon] Import failed: ${err.message}`);
                return 1;
            }
        }
        case 'clear': {
            const cleared = clearCache();
            if (cleared) {
                console.error('[simplebeacon] Registry cache cleared.');
            } else {
                console.error('[simplebeacon] No cache file to clear (already empty).');
            }
            return 0;
        }
        default:
            console.error(`[simplebeacon] Unknown cache subcommand: ${subcommand}`);
            console.error('Available: prewarm, export, import, stats, clear');
            return 1;
    }
}

/**
 * Execute a team metrics command for organizational compliance aggregation.
 * Subcommands: report, ingest, export, register, clear
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function runTeamMetricsCommand(options) {
    const {
        ingestScanHistory,
        getTeamMetricsReport,
        exportAnonymizedReport,
        clearTeamMetrics,
        registerProject,
        setTeamId
    } = require('../src/lib/team-metrics');

    const subcommand = options._positional?.[0] || 'report';

    switch (subcommand) {
        case 'report': {
            const report = getTeamMetricsReport();
            const stats = report.aggregatedStats;
            console.error('=== Team Compliance Metrics ===');
            console.error(`Snapshots:      ${report.snapshotCount}`);
            console.error(`Projects:       ${stats.uniqueProjects}`);
            console.error(`Total scans:    ${stats.totalScans}`);
            console.error(`Avg quality:    ${stats.averageQualityScore}/100`);
            console.error(`Gate pass rate: ${stats.averageGatePassRate}%`);
            console.error(`Total issues:   ${stats.totalIssues} (${stats.totalBlocking} blocking, ${stats.totalWarnings} warnings)`);
            console.error(`Files scanned:  ${stats.totalFilesScanned}`);
            console.error(`Fiction found:  ${stats.totalFictionPatterns}`);
            console.error('');
            console.error('Severity breakdown:');
            console.error(`  Critical: ${stats.severityBreakdown.critical}`);
            console.error(`  High:     ${stats.severityBreakdown.high}`);
            console.error(`  Medium:   ${stats.severityBreakdown.medium}`);
            console.error(`  Low:      ${stats.severityBreakdown.low}`);
            console.error('');
            console.error('Project breakdown:');
            for (const proj of report.projectBreakdown) {
                const gate = proj.latestGatePass ? 'PASS' : 'FAIL';
                console.error(`  ${proj.friendlyName}: score=${proj.latestScore} avg=${proj.averageScore} gate=${gate} scans=${proj.scanCount}`);
            }
            return 0;
        }
        case 'ingest': {
            const root = path.resolve(options.projectRoot || process.cwd());
            const historyPath = path.join(root, '.simplebeacon', 'history.json');
            if (!fs.existsSync(historyPath)) {
                console.error(`[simplebeacon] No scan history found at ${historyPath}`);
                console.error('Run a scan first: simplebeacon scan');
                return 1;
            }
            let history;
            try {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            } catch {
                console.error('[simplebeacon] Failed to parse history.json');
                return 1;
            }
            const result = ingestScanHistory(root, history, { salt: options.salt || '' });
            console.error(`[simplebeacon] Ingested ${result.ingested} scan(s) into team metrics (${result.total} total snapshots)`);
            if (result.duplicate) {
                console.error('  (latest scan was already ingested — use --force to override)');
            }
            return 0;
        }
        case 'export': {
            const outputPath = options._positional?.[1] || options.output;
            if (!outputPath) {
                console.error('[simplebeacon] Usage: simplebeacon team-metrics export <output-file>');
                return 1;
            }
            const data = exportAnonymizedReport(outputPath);
            console.error(`[simplebeacon] Exported anonymized team metrics to ${outputPath}`);
            console.error(`  Projects: ${data.projectBreakdown.length}`);
            console.error(`  Snapshots: ${data.snapshotCount}`);
            console.error(`  Avg score: ${data.aggregatedStats.averageQualityScore}/100`);
            return 0;
        }
        case 'register': {
            const root = path.resolve(options.projectRoot || process.cwd());
            const name = options._positional?.[1] || options.name || path.basename(root);
            const result = registerProject(root, name, options.salt || '');
            console.error(`[simplebeacon] Registered project '${name}' (ID: ${result.id})`);
            return 0;
        }
        case 'set-team': {
            const teamId = options._positional?.[1] || options.teamId;
            if (!teamId) {
                console.error('[simplebeacon] Usage: simplebeacon team-metrics set-team <team-id>');
                return 1;
            }
            setTeamId(teamId);
            console.error(`[simplebeacon] Team ID set to: ${teamId}`);
            return 0;
        }
        case 'clear': {
            const cleared = clearTeamMetrics();
            if (cleared) {
                console.error('[simplebeacon] Team metrics cleared.');
            } else {
                console.error('[simplebeacon] No team metrics file to clear.');
            }
            return 0;
        }
        default:
            console.error(`[simplebeacon] Unknown team-metrics subcommand: ${subcommand}`);
            console.error('Available: report, ingest, export, register, set-team, clear');
            return 1;
    }
}

function runFixCommand(options) {
    if (!RemediationEngine || !STRUCTURAL_RULES) {
        console.error('[simplebeacon] Fix engine unavailable — policy module failed to load.');
        return 1;
    }
    const targetPath = path.resolve(sanitizePath(options.path || '.'));
    const dryRun = !!options.fixDryRun;
    const engine = new RemediationEngine(STRUCTURAL_RULES);
    const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '.simplebeacon']);
    const TEXT_EXTENSIONS = /\.(js|jsx|ts|tsx|mjs|cjs|json|md|py|rb|go|rs|java|c|cpp|h|hpp|css|scss|html|vue|svelte)$/;
    const files = [];
    const envVariablesToExport = [];
    const stats = { filesScanned: 0, filesChanged: 0 };

    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir);
        } catch (e) {
            console.error('[!] Cannot read directory: ' + dir + ' — ' + e.message);
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch {
                continue;
            }
            if (stat.isDirectory()) {
                if (!SKIP_DIRS.has(entry) && !entry.startsWith('.')) {
                    walk(fullPath);
                }
            } else if (stat.isFile() && TEXT_EXTENSIONS.test(entry)) {
                files.push(fullPath);
            }
        }
    }

    if (!fs.existsSync(targetPath)) {
        console.error('Target path does not exist: ' + targetPath);
        return 1;
    }
    if (fs.statSync(targetPath).isDirectory()) {
        walk(targetPath);
    } else {
        files.push(targetPath);
    }

    for (const filePath of files) {
        stats.filesScanned++;
        let result;
        try {
            result = engine.processFile(filePath, { dryRun });
        } catch (e) {
            console.error('[!] Cannot process file: ' + filePath + ' — ' + e.message);
            continue;
        }
        if (!result.changed) continue;
        stats.filesChanged++;
        envVariablesToExport.push(...result.quarantine);
        writeStdoutLine('--- ' + path.relative(process.cwd(), filePath));
        for (const ruleId of result.rulesApplied) {
            writeStdoutLine('  ' + ruleId + ': ' + (result.matchCounts[ruleId] || 0) + ' match(es)');
        }
        if (result.diff && (dryRun || options.diff)) {
            writeStdoutLine(result.diff);
        }
    }

    if (envVariablesToExport.length > 0 && !dryRun) {
        const envPath = path.join(process.cwd(), '.env');
        const envPayload = '\\n# --- SimpleBeacon Safety Token Quarantine ---\\n# WARNING: These are REAL secrets extracted from your code.\\n# Do NOT commit this file to version control.\\n# Verify .gitignore includes .env before proceeding.\\n' + envVariablesToExport.join('\\n') + '\\n';
        fs.appendFileSync(envPath, envPayload, 'utf8');
        console.error('[OK] Appended ' + envVariablesToExport.length + ' quarantine definitions to .env');
    } else if (envVariablesToExport.length > 0 && dryRun) {
        console.error('[!] ' + envVariablesToExport.length + ' tokens would be extracted to .env on write:');
        for (const v of envVariablesToExport) {
            console.error('  ' + v);
        }
    }

    writeStdoutLine('\\nStructural Remediation:');
    writeStdoutLine('  Files processed: ' + stats.filesScanned);
    writeStdoutLine('  Files changed:   ' + stats.filesChanged);
    writeStdoutLine('  Tokens quarantined: ' + envVariablesToExport.length);

    if (dryRun && stats.filesChanged > 0) {
        console.error('No modifications written to disk. Re-run without --dry-run to apply.');
        return 1;
    }

    return 0;
}

/**
 * Execute the update-cve-db command — downloads NVD feeds and builds a local CVE database.
 * @param {Object} options
 * @returns {Promise<number>}
 */
async function runUpdateCveDbCommand(options) {
    const { updateCveDb } = require('../scripts/update-cve-db.cjs');
    const dryRun = options.dryRun === true;
    const years = options.year ? [parseInt(options.year, 10)] : undefined;

    try {
        const result = await updateCveDb({ dryRun, years });
        console.log(`\nCVE database ${dryRun ? 'preview' : 'update'} complete:`);
        console.log(`  Packages: ${result.packages}`);
        console.log(`  CVEs:     ${result.cves}`);
        if (result.outputPath) {
            console.log(`  Output:   ${result.outputPath}`);
        }
        return 0;
    } catch (err) {
        console.error('Failed to update CVE database:', err.message);
        return 1;
    }
}

const COMMAND_REGISTRY = {
    init: runInitCommand,
    comment: runCommentCommand,
    'baseline-sync': runBaselineSyncCommand,
    assess: runAssessCommand,
    compliance: runComplianceCommand,
    report: runReportCommand,
    'hook-install': runHookInstallCommand,
    'secrets-gate': runSecretsGateCommand,
    reduce: runReduceCommand,
    'gate-status': runGateStatusCommand,
    supercharge: runSuperchargeCommand,
    mcp: (opts) => {
        const { createMcpStdioServer } = require('../src/mcp/stdio-server');
        const server = createMcpStdioServer({ offline: opts.offline });
        server.start();
    },
    'ai-plan': runAiPlanCommand,
    scan: runScanCommand,
    fix: (options) => {
        if (options.dryRun) options.fixDryRun = true;
        return runFixCommand(options);
    },
    upload: runUploadCommand,
    pdf: runPdfCommand,
    'buy-clearance': runBuyClearanceCommand,
    refer: runReferCommand,
    doctor: runDoctorCommand,
    cache: runCacheCommand,
    'team-metrics': runTeamMetricsCommand,
    'update-cve-db': runUpdateCveDbCommand
};

async function main() {
    const argvCommand = process.argv[2];
    const skipPolicyGate = argvCommand === 'secrets-gate' || argvCommand === 'fix';
    const activeCompliancePolicy = skipPolicyGate ? null : runPolicyGate();
    if (activeCompliancePolicy) {
        global.__SIMPLEBEACON_ACTIVE_POLICY__ = activeCompliancePolicy;
    }
    const options = parseArgs(process.argv);

    if (options.version) {
        try {
            const pkg = readJsonFile(path.join(__dirname, '..', 'package.json'), 'package.json');
            writeStdoutLine(`simplebeacon ${pkg.version}`);
        } catch {
            writeStdoutLine('simplebeacon (version unknown)');
        }
        return 0;
    }

    if (options.help) {
        if (options.command === 'scan') {
            printScanHelp();
        } else {
            printHelp();
        }
        return 0;
    }

    if (!VALID_COMMANDS.has(options.command)) {
        const suggestion = suggestCommand(options.command, VALID_COMMANDS);
        console.error(`Unknown command: ${options.command}`);
        if (suggestion) {
            console.error(`Did you mean: ${suggestion}?`);
        }
        printHelp();
        return 2;
    }

    applyCliPathSafety(options);

    if (options.debug) {
        _cliDebugMode = true;
        options.verbose = true;
    }

    validateCommandOptions(options);

    // Non-blocking update check (skipped for --offline, --air-gapped, --quiet)
    // Runs in the background — never delays scan execution
    try {
        const { checkForUpdates } = require('../src/lib/update-check');
        checkForUpdates({
            offline: options.offline,
            airGapped: options.airGapped,
            quiet: options.quiet
        }).catch(() => { /* non-blocking */ });
    } catch {
        /* update-check module not available — skip silently */
    }

    const commandHandler = COMMAND_REGISTRY[options.command];
    if (!commandHandler) {
        console.error(`Command "${options.command}" is not yet implemented.`);
        return 2;
    }

    const commandResult = await commandHandler(options);
    return typeof commandResult === 'number' ? commandResult : 0;
}

/**
 * Run integrity diagnostics and auto-fixes.
 * @returns {void}
 */
function runDoctorCommand() {
    const { runDoctor } = require('../src/doctor');
    runDoctor();
}

/**
 * Generate AI-friendly remediation plan from scan results.
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runAiPlanCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runAiPlanCommand requires an options object');
    const root = sanitizePath(options.path);
    const { platformRoot } = resolvePlatformRoot(root);
    const config = loadSimplebeaconConfig(platformRoot, options.config);
    
    writeStdoutLine('🤖 SimpleBeacon AI Plan Generator');
    writeStdoutLine('=====================================');
    writeStdoutLine(`Root: ${root}`);
    writeStdoutLine(`Profile: ${config.profile || 'standard'}`);
    writeStdoutLine('');

    // Run a scan to get current issues
    writeStdoutLine('🔍 Analyzing current codebase for AI issues...');
    const report = await runScan(root, {
        config,
        configPath: options.config,
        withJest: options.withJest,
        fullDirectoryScan: options.complete || false,
        exclude: options.exclude
    });

    if (!report || !report.rawIssues || report.rawIssues.length === 0) {
        writeStdoutLine('✅ No issues found. Codebase is clean!');
        return;
    }

    writeStdoutLine(`📊 Analysis Complete:`);
    writeStdoutLine(`   Total Issues: ${report.rawIssues.length}`);
    writeStdoutLine(`   Quality Score: ${report.qualityScore}/100`);
    writeStdoutLine(`   Gate Status: ${report.gate?.pass ? 'PASS' : 'FAIL'}`);
    writeStdoutLine('');

    // Generate AI-friendly issue list
    const aiIssueList = generateAIIssueList(report);
    writeStdoutLine('');
    writeStdoutLine('📋 AI Plan Generated:');
    writeStdoutLine('=====================================');
    writeStdoutLine(aiIssueList);
    
    // Save to file if output specified
    if (options.output) {
        const outputPath = path.resolve(options.output);
        writeManagedFileSync(outputPath, `${aiIssueList}\n`, {
            force: true,
            validators: [validateNotEmpty]
        });
        writeStdoutLine(`📄 AI plan saved to: ${outputPath}`);
    }
}

function generateAIIssueList(report) {
    if (!report || typeof report !== 'object') return '';
    const issues = Array.isArray(report.rawIssues) ? report.rawIssues : [];

    // Group issues by category and severity
    const groupedIssues = issues.reduce((acc, issue) => {
        const category = issue.type || 'General';
        const severity = issue.severity || 'medium';
        
        if (!acc[category]) acc[category] = { high: [], medium: [], low: [], critical: [] };
        if (!acc[category][severity]) acc[category][severity] = [];

        acc[category][severity].push(issue);
        return acc;
    }, {});

    let plan = '# AI Remediation Plan\n\n';
    plan += `## Summary\n`;
    plan += `- **Total Issues**: ${issues.length}\n`;
    plan += `- **Quality Score**: ${report.qualityScore}/100\n`;
    plan += `- **Gate Status**: ${report.gate?.pass ? 'PASS' : 'FAIL'}\n`;
    plan += `- **Generated**: ${new Date().toISOString()}\n\n`;

    plan += '## Prioritized Issues\n\n';
    
    // Sort categories by severity and issue count
    const sortedCategories = Object.entries(groupedIssues).sort((a, b) => {
        const aHighCount = (a[1]?.high || []).length;
        const bHighCount = (b[1]?.high || []).length;
        const aTotalCount = Object.values(a[1]).reduce((sum, arr) => sum + arr.length, 0);
        const bTotalCount = Object.values(b[1]).reduce((sum, arr) => sum + arr.length, 0);
        
        // Sort by high severity count first, then by total count
        if (aHighCount !== bHighCount) return bHighCount - aHighCount;
        if (aTotalCount !== bTotalCount) return bTotalCount - aTotalCount;
        return a[0].localeCompare(b[0]);
    });

    for (const [category, severityGroups] of sortedCategories) {
        plan += `### ${category}\n\n`;
        
        // Sort issues by severity within each category
        const allIssues = [
            ...(severityGroups.critical || []),
            ...(severityGroups.high || []),
            ...(severityGroups.medium || []),
            ...(severityGroups.low || [])
        ].sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const aOrder = severityOrder[a.severity] ?? 4;
            const bOrder = severityOrder[b.severity] ?? 4;
            return aOrder - bOrder;
        });

        for (const issue of allIssues) {
            const fileName = issue.file || issue.path || 'Unknown';
            const lineNumber = issue.line || 1;
            const description = issue.description || issue.message || issue.type || 'No description';
            const recommendation = generateRecommendation(issue);
            const severity = issue.severity || 'medium';
            
            plan += `#### ${severity.toUpperCase()}: ${description}\n`;
            plan += `   **File**: \`${fileName}:${lineNumber}\`\n`;
            plan += `   **Recommendation**: ${recommendation}\n`;
            plan += `   **Context**: ${issue.context || 'No context available'}\n\n`;
        }
    }

    plan += '## Implementation Priority\n\n';
    plan += '1. **High Priority Issues** (Critical/High severity)\n';
    plan += '2. **Medium Priority Issues** (Medium severity)\n';
    plan += '3. **Low Priority Issues** (Low severity)\n\n';

    // Add specific remediation steps
    plan += '## Suggested Implementation Steps\n\n';
    plan += '1. **Review High Priority Issues First** - Address blocking issues that prevent gate passage\n';
    plan += '2. **Implement Medium Priority Issues** - Improve code quality and maintainability\n';
    plan += '3. **Address Low Priority Issues** - Clean up and optimize\n';
    plan += '4. **Re-run Scan** - Verify fixes and update quality score\n\n';

    plan += '## Additional Notes\n\n';
    plan += '- Use the `simplebeacon scan --complete` flag to run all 52 deterministic engines\n';
    plan += '- Consider integrating with CI/CD pipelines for automated checks\n';
    plan += '- Review and update SimpleBeacon configuration as needed\n';

    return plan;
}

const RECOMMENDATIONS = Object.freeze({
    'missing-env-key': 'Add the missing environment variable to your configuration',
    'unused-file': 'Remove unused files or add proper usage documentation',
    'invalid-json': 'Fix JSON syntax errors in the file',
    'git-sensitive-file': 'Remove sensitive files from git or add to .gitignore',
    'build-artifact': 'Move build artifacts to a build directory or .gitignore',
    'orphaned-export': 'Remove unused exports or add proper usage documentation',
    'dead-export': 'Update or remove dead exports',
    'duplicate-config-type': 'Consolidate duplicate configuration entries',
    'credential-pattern': 'Remove or secure the credential pattern',
    'production-leak': 'Remove or secure production credentials',
    'ai-fiction': 'Remove AI-generated fiction KPIs and mock data',
    'complexity': 'Refactor complex code for better maintainability'
});

function generateRecommendation(issue) {
    if (!issue || typeof issue !== 'object') return 'Review and address this issue according to best practices';
    const type = issue.type || 'unknown';
    return RECOMMENDATIONS[type] || 'Review and address this issue according to best practices';
}

main().then((code) => {
    if (typeof code === 'number') process.exitCode = code;
}).catch((error) => {
    console.error(paint(formatCliError(error), 'red'));
    process.exit(2);
});
