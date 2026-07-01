#!/usr/bin/env node
/**
 * Simplebeacon CLI
 */

const fs = require('fs');
const path = require('path');
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
const { buildAssessmentReport } = require('../src/assessment');
const { sanitizeReportForCloudUpload } = require('../src/lib/report-sanitizer');
const { buildAnonymizedExport, signAnonymizedExport } = require('../src/lib/anonymized-export');
const { runLocalRemediation } = require('../src/lib/local-remediation');
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

const { appendScanHistory, buildHistoryEntry } = require('../src/lib/scan-history');
const { enhanceExecutiveSummary } = require('../src/reporters/report-enhance');
const { runFileReductionScan } = require('../src/lib/file-reduction-orchestrator');
const { generateFileReductionReport } = require('../src/reporters/file-reduction-report');
const { readGateStatus } = require('../src/lib/snippet-scanner');
const { installDeveloperStack } = require('../src/lib/developer-onboarding');
const VALID_COMMANDS = new Set(['scan', 'init', 'comment', 'baseline-sync', 'assess', 'compliance', 'report', 'hook-install', 'reduce', 'gate-status', 'pdf', 'buy-clearance', 'mcp', 'ai-plan', 'doctor']);

function writeStdoutLine(message = '') {
    process.stdout.write(`${message == null ? '' : String(message)}\n`);
}

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

    const options = {
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
        tier: null,
        forceNpmAudit: false
    };

    const knownFlags = new Set([
        '--path', '-p', '--config', '-c', '--format', '-f', '--output', '-o',
        '--report', '-r', '--issue-number', '--repo', '--profile', '--fail-on',
        '--gate', '--with-jest', '--verbose', '-v', '--quiet', '-q', '--company', '--assessor',
        '--client', '--branch', '--assessment', '--print-only', '--api-token',
        '--upload', '--type', '--husky', '--offline', '--no-trust-banner',
        '--dry-run', '--force', '--enhance', '--enhance-model', '--scanner',
        '--checklist', '--with-mcp', '--with-ci', '--starter', '--anonymize',
        '--fix', '--fix-provider', '--fix-dry-run', '--with-analyzer-suite',
        '--fullDirectoryScan', '--full', '--email', '--server', '--poll-seconds',
        '--max-polls', '--max-fixes', '--mcp-mode', '--help', '-h', '--version',
        '-V', '--complete', '--watch', '--tier', '--exclude', '--deep-scan', '--include-deps',
        '--min-confidence', '--tier-limits', '--force-npm-audit'
    ]);

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

        if (arg === '--path' || arg === '-p') {
            options.path = requireNext('--path');
        } else if (arg === '--config' || arg === '-c') {
            options.config = requireNext('--config');
        } else if (arg === '--format' || arg === '-f') {
            options.format = requireNext('--format');
        } else if (arg === '--output' || arg === '-o') {
            options.output = requireNext('--output');
        } else if (arg === '--report' || arg === '-r') {
            options.report = requireNext('--report');
        } else if (arg === '--issue-number') {
            options.issueNumber = requireNext('--issue-number');
        } else if (arg === '--repo') {
            options.repo = requireNext('--repo');
        } else if (arg === '--profile') {
            options.profile = requireNext('--profile');
        } else if (arg === '--fail-on') {
            const val = requireNext('--fail-on');
            options.failOn = val.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (arg === '--gate') {
            options.gate = true;
        } else if (arg === '--with-jest') {
            options.withJest = true;
        } else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        } else if (arg === '--quiet' || arg === '-q') {
            options.quiet = true;
        } else if (arg === '--company') {
            options.company = requireNext('--company');
        } else if (arg === '--assessor') {
            options.assessor = requireNext('--assessor');
        } else if (arg === '--client') {
            options.client = requireNext('--client');
        } else if (arg === '--branch') {
            options.branch = requireNext('--branch');
        } else if (arg === '--assessment') {
            options.assessment = requireNext('--assessment');
        } else if (arg === '--print-only') {
            options.printOnly = true;
        } else if (arg === '--api-token') {
            options.apiToken = requireNext('--api-token');
        } else if (arg === '--upload') {
            options.upload = requireNext('--upload');
        } else if (arg === '--type') {
            options.hookType = requireNext('--type');
        } else if (arg === '--husky') {
            options.preferHusky = true;
        } else if (arg === '--offline') {
            options.offline = true;
        } else if (arg === '--no-trust-banner') {
            options.noTrustBanner = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--force') {
            options.force = true;
        } else if (arg === '--enhance') {
            options.enhance = true;
        } else if (arg === '--enhance-model') {
            options.enhanceModel = requireNext('--enhance-model');
        } else if (arg === '--scanner') {
            options.scanner = requireNext('--scanner');
        } else if (arg === '--checklist') {
            options.checklist = requireNext('--checklist');
        } else if (arg === '--with-mcp') {
            options.withMcp = true;
        } else if (arg === '--with-ci') {
            options.withCi = true;
        } else if (arg === '--starter') {
            options.starter = true;
            options.withMcp = true;
            options.withCi = true;
        } else if (arg === '--anonymize') {
            options.anonymize = true;
        } else if (arg === '--fix') {
            options.fix = true;
        } else if (arg === '--fix-provider') {
            options.fixProvider = requireNext('--fix-provider');
        } else if (arg === '--fix-dry-run') {
            options.fixDryRun = true;
        } else if (arg === '--with-analyzer-suite') {
            options.withAnalyzerSuite = true;
        } else if (arg === '--fullDirectoryScan' || arg === '--full') {
            options.fullDirectoryScan = true;
        } else if (arg === '--email') {
            options.email = requireNext('--email');
        } else if (arg === '--server') {
            options.server = requireNext('--server');
        } else if (arg === '--poll-seconds') {
            const n = Number(requireNext('--poll-seconds'));
            options.pollSeconds = Number.isFinite(n) && n > 0 ? n : 5;
        } else if (arg === '--max-polls') {
            const n = Number(requireNext('--max-polls'));
            options.maxPolls = Number.isFinite(n) && n > 0 ? n : 60;
        } else if (arg === '--max-fixes') {
            options.maxFixes = Number(requireNext('--max-fixes')) || 10;
        } else if (arg === '--mcp-mode') {
            options.mcpMode = requireNext('--mcp-mode');
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--version' || arg === '-V') {
            options.version = true;
        } else if (arg === '--complete') {
            options.complete = true;
        } else if (arg === '--watch') {
            options.watch = true;
        } else if (arg === '--tier') {
            options.tier = requireNext('--tier');
        } else if (arg === '--exclude') {
            const val = requireNext('--exclude');
            options.exclude = val.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (arg === '--deep-scan') {
            options.deepScan = true;
        } else if (arg === '--include-deps') {
            options.includeDeps = true;
        } else if (arg === '--min-confidence') {
            options.minConfidence = Number(requireNext('--min-confidence')) || 0.5;
        } else if (arg === '--tier-limits') {
            options.tierLimits = requireNext('--tier-limits');
        } else if (arg === '--force-npm-audit') {
            options.forceNpmAudit = true;
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
        'init',
        'baseline-sync',
        'assess',
        'compliance',
        'report',
        'hook-install'
    ]);

    if (pathRequiredCommands.has(options.command)) {
        options.path = resolveCliProjectRoot(options.path, {
            mustExist: true,
            mustBeDirectory: true,
            label: 'Project path'
        });
    }

    return options;
}

function formatCliError(error) {
    if (error == null) return String(error);
    if (error instanceof SimplebeaconError && error.code) {
        return `[${error.code}] ${error.message}`;
    }
    return error.message || String(error);
}

function printHelp() {
    writeStdoutLine(`Simplebeacon — detect mock data, fiction KPIs, and credential leaks
  simplebeacon --version          Show version number

Usage:
  simplebeacon scan [options]     Scan project and report findings
  simplebeacon init [options]     Create .simplebeacon/config.json and baseline.json
  simplebeacon mcp [options]      Start MCP stdio server for Cursor / Claude Desktop
  simplebeacon comment [options]  Post GitHub PR comment from JSON report
  simplebeacon assess [options]   Build customer assessment JSON from scan report
  simplebeacon compliance [opts]  Evaluate corporate safety checklist from report
  simplebeacon report [options]   Build client-facing markdown audit from scan JSON
  simplebeacon baseline sync      Run Jest and update .simplebeacon/baseline.json
  simplebeacon hook install         Install pre-commit or pre-push git hook
  simplebeacon gate status            Print gate pass/fail from .simplebeacon/report.json
  simplebeacon reduce [options]     Analyze repo for file-reduction opportunities (dry-run)
  simplebeacon pdf [options]        Generate Executive Risk Certificate (requires license token)
  simplebeacon buy-clearance        Purchase executive clearance and receive license token
  simplebeacon ai-plan [options]   Generate AI-friendly remediation plan from scan results
  simplebeacon doctor              Runs integrity diagnostics, applies auto-fixes, and generates triage packages

buy-clearance options:
  --email <addr>      Email address for checkout (required)
  --server <url>    Simplebeacon server URL (default: https://simplebeacon.ai)
  --poll-seconds <n> Seconds between poll attempts (default: 5)
  --max-polls <n>   Maximum poll attempts (default: 60)

PDF options:
  --report <file>     Scan report JSON (default: .simplebeacon/report.json)
  --output <file>     Output HTML path (default: simplebeacon-executive-risk-certificate.html)
  Requires SIMPLEBEACON_LICENSE_TOKEN env var or ~/.simplebeacon/license.jwt

Init options:
  --path <dir>        Project root (default: cwd)
  --profile <name>    Force profile: minimal, standard, cascade (auto-detected by default)
  --dry-run           Preview init changes without writing files
  --force             Overwrite existing config/baseline (backup created first)
  --with-mcp          Write .cursor/mcp.json + agent rule for Cursor MCP
  --with-ci           Write .github/workflows/simplebeacon.yml
  --starter           Shorthand for --with-mcp --with-ci
  --mcp-mode MODE     npx-local (default) | npx-github | monorepo

Scan options:
  --path, -p <dir>    Project root (default: cwd)
  --config, -c <f>    Config path (default: .simplebeacon/config.json)
  --format, -f fmt    Output format: text | json (default: text)
  --output, -o <file> Write report to file
  --report, -r <file> Use existing scan report JSON
  --gate              Exit 1 when gate severities are found
  --fail-on a,b,c     Override gate fail severities (default: high)
  --with-jest         Run npm test and compare to baseline (slow)
  --verbose, -v       Print config warnings and scan paths
  --anonymize         Strip all file paths, descriptions, and code snippets from JSON output
                        Output contains only abstract error codes and compliance metrics.
  --fix               Run local remediation agent against blocking findings (requires Ollama)
  --fix-provider <p>  Override remediation LLM: ollama (default) | openai | anthropic
  --fix-dry-run       Show diffs without applying patches
  --max-fixes <n>     Limit number of auto-fix attempts (default: 10)
  --complete          Run all 11 analyzers (gate + consolidation + mock data + roadmap + codebase + file reduction + data quality + cleanup + npm audit + compliance + EU AI Act)
  --watch             Watch project files and re-run scan on changes (ctrl+c to stop)
  --deep-scan         Bypass docs/vendor/cache filters (only .simplebeaconignore + 500MB limit applies)
  --include-deps      Include node_modules and .git in scan (slower, more noise)
  --min-confidence n  Minimum rule confidence threshold 0.0–1.0 (default: 0.5)
  --offline           Fail if any outbound network activity occurs during scan
  --no-trust-banner   Suppress read-only / local-only trust confirmation lines
  --api-token <tok>   Paid tier API token (required with --upload)
  --upload <url>      POST JSON report to Simplebeacon cloud (paid tier)

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
  --complete          Run all 11 analyzers for comprehensive analysis

Examples:
  npx simplebeacon init
  npx simplebeacon init --profile minimal
  npx simplebeacon scan --gate
  npx simplebeacon scan --offline --gate
  npx simplebeacon scan --format json --output .simplebeacon/report.json --gate
  npx simplebeacon scan --gate --complete
  npx simplebeacon scan --format json --api-token sb_xxx --upload https://simplebeacon.ai/api/simplebeacon/cloud-scan
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Simplebeacon-Token': apiToken
            },
            body: JSON.stringify({ report: sanitizeReportForCloudUpload(report) }),
            signal: controller.signal
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
    if (!process.stderr.isTTY) return { start() {}, stop() {} };
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
    const config = loadSimplebeaconConfig(platformRoot, options.config);
    if (options.complete || options.fullDirectoryScan) {
        config.fullDirectoryScan = true;
        if (options.verbose) console.error('[scan] --complete enabled: full directory scan + all analyzers');
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
            ci: options.withCi,
            tier: options.tier || 'developer',
            tierLimits: options.tierLimits || undefined,
            exclude: options.exclude,
            deepScan: options.deepScan,
            includeDeps: options.includeDeps,
            minConfidence: options.minConfidence
        });
        networkGuard.assertOfflineClean();
        printTrustCompletion({
            quiet: options.noTrustBanner,
            offline: options.offline,
            networkEventCount: networkGuard.events.length
        }, paint);

        const gateResult = evaluateGate(report, config.gate);
        const jsonReport = formatJsonReport(report, gateResult);
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
        } else {
            writeStdoutLine(payload);
        }

        if (options.fix) {
            const fixableIssues = gateResult.blockingIssues?.length > 0
                ? gateResult.blockingIssues
                : (report.rawIssues || []).filter((i) => i.severity === 'high' || i.severity === 'critical');
            if (fixableIssues.length > 0) {
                console.error(`\n🔧 [Local Remediation] Running local agent on ${fixableIssues.length} finding(s)...`);
                const remediation = await runLocalRemediation(fixableIssues, {
                    dryRun: options.fixDryRun,
                    maxFixes: options.maxFixes,
                    model: options.fixProvider === 'ollama' || !options.fixProvider
                        ? process.env.SIMPLEBEACON_FIX_MODEL || 'llama3.2:latest'
                        : null
                });
                console.error(`   Applied: ${remediation.applied} | Failed: ${remediation.failed} | Total: ${remediation.total}`);
                for (const r of remediation.results) {
                    const icon = r.applied ? '✅' : '❌';
                    console.error(`   ${icon} ${r.issue}${r.diff ? '\n      ' + r.diff.split('\n').slice(0, 3).join('\n      ') : ''}`);
                }
            } else {
                console.error('🔧 [Local Remediation] No high-severity findings to fix.');
            }
        }

        if (options.gate && !gateResult.pass) {
            console.error(paint(`Gate failed: ${gateResult.blockingIssues.length} blocking issue(s)`, 'red'));
            return 1;
        }
        return 0;
    } catch (err) {
        spinner.stop();
        throw err;
    }
}

async function runScanCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runScanCommand requires an options object');
    const networkGuard = createNetworkGuard({ offline: options.offline });
    printTrustBanner({ quiet: options.noTrustBanner, offline: options.offline }, paint);

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

async function runCommentCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runCommentCommand requires an options object');
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    if (!fs.existsSync(reportPath)) {
        throw new Error(`Report not found: ${reportPath}`);
    }

    let report;
    try {
        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
        throw new Error(`Invalid JSON report at ${reportPath}: ${error.message}`);
    }

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
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    }

    const scanRoot = sanitizePath(options.path);
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const config = loadSimplebeaconConfig(platformRoot, options.config);
    const report = await runScan(scanRoot, { config, configPath: options.config });
    const gateResult = evaluateGate(report, config.gate);
    return formatJsonReport(report, gateResult);
}

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

async function runReportCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runReportCommand requires an options object');
    const root = sanitizePath(options.path);
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    if (!fs.existsSync(reportPath)) {
        throw new Error(`Report not found: ${reportPath}. Run: npx simplebeacon scan --format json --output .simplebeacon/report.json --gate`);
    }

    let report;
    try {
        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
        throw new Error(`Invalid JSON report at ${reportPath}: ${error.message}`);
    }

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
        try {
            assessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf8'));
        } catch (error) {
            throw new Error(`Invalid JSON assessment at ${assessmentPath}: ${error.message}`);
        }
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

async function runComplianceCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runComplianceCommand requires an options object');
    const root = sanitizePath(options.path);
    const report = await loadOrRunReport(options);
    let npmAudit = null;
    try {
        const { runNpmAudit } = require(path.join(root, 'server/lib/npm-audit-runner'));
        npmAudit = runNpmAudit(root, { force: options.forceNpmAudit === true });
    } catch {
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

function runInitCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runInitCommand requires an options object');
    const root = sanitizePath(options.path);
    const created = initSimplebeacon(root, {
        profile: options.profile,
        dryRun: options.dryRun,
        force: options.force
    });
    const detected = created.detected || detectProjectProfile(root);

    const onboarding = options.withMcp || options.withCi || options.starter;
    let stack = null;
    if (onboarding) {
        stack = installDeveloperStack(root, {
            mode: options.mcpMode,
            force: options.force,
            dryRun: options.dryRun,
            withMcp: options.withMcp || options.starter,
            withCursorRule: options.withMcp || options.starter,
            withCi: options.withCi || options.starter
        });
    }

    if (created.dryRun) {
        writeStdoutLine('DRY RUN — no files were modified');
        writeStdoutLine('');
        for (const action of created.plannedActions || []) {
            writeStdoutLine(`Would ${action.action}: ${action.path}`);
        }
        if (stack) {
            if (stack.mcp?.dryRun) {
                writeStdoutLine(`Would create: ${stack.mcp.configPath}`);
            } else if (stack.mcp?.skipped) {
                writeStdoutLine(`Would skip: ${stack.mcp.configPath}`);
            }
            if (stack.cursorRule?.dryRun) {
                writeStdoutLine(`Would create: ${stack.cursorRule.path}`);
            } else if (stack.cursorRule?.skipped) {
                writeStdoutLine(`Would skip: ${stack.cursorRule.path}`);
            }
            if (stack.ciWorkflow?.dryRun) {
                writeStdoutLine(`Would create: ${stack.ciWorkflow.path}`);
            } else if (stack.ciWorkflow?.skipped) {
                writeStdoutLine(`Would skip: ${stack.ciWorkflow.path}`);
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
    writeStdoutLine('  npx simplebeacon scan');
    writeStdoutLine('  npx simplebeacon scan --gate');
    writeStdoutLine('  npx simplebeacon hook install');
    writeStdoutLine('  npx simplebeacon baseline sync   # after a green test run');

    if (stack) {
        writeStdoutLine('');
        if (stack.mcp?.created) {
            writeStdoutLine(`Created ${stack.mcp.configPath} (MCP mode: ${stack.mcp.mode})`);
        } else if (stack.mcp?.skipped) {
            writeStdoutLine(stack.mcp.message);
        }
        if (stack.cursorRule?.created) {
            writeStdoutLine(`Created ${stack.cursorRule.path}`);
        } else if (stack.cursorRule?.skipped) {
            writeStdoutLine(`Skipped existing ${stack.cursorRule.path}`);
        }
        if (stack.ciWorkflow?.created) {
            writeStdoutLine(`Created ${stack.ciWorkflow.path}`);
        } else if (stack.ciWorkflow?.skipped) {
            writeStdoutLine(`Skipped existing ${stack.ciWorkflow.path}`);
        }
        if (options.withMcp || options.starter) {
            writeStdoutLine('Reload Cursor → Settings → MCP → enable simplebeacon');
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

async function runReduceCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runReduceCommand requires an options object');
    const root = sanitizePath(options.path);
    const scannerFilter = options.scanner;
    const scannerOptions = scannerFilter
        ? {
            [scannerFilter]: { enabled: true },
            ...(Object.fromEntries(
                ['build-artifacts', 'asset-consolidation', 'unused-files', 'config-management', 'dependency-health', 'environment-variables', 'data-freshness', 'data-access-patterns', 'data-privacy', 'data-lineage', 'data-consistency']
                    .filter((id) => id !== scannerFilter)
                    .map((id) => [id, { enabled: false }])
            ))
        }
        : {};

    const report = await runFileReductionScan(root, {
        dryRun: true,
        scanners: scannerOptions
    });
    const outputPath = options.output
        || (options.format === 'json'
            ? path.join(root, '.simplebeacon', 'file-reduction.json')
            : path.join(root, '.simplebeacon', 'file-reduction.md'));
    const rendered = generateFileReductionReport(report, { format: options.format });

    writeManagedFileSync(outputPath, options.format === 'json' ? `${rendered}\n` : rendered, {
        force: true,
        validators: options.format === 'json' ? [validateJSON, validateNotEmpty] : [validateNotEmpty]
    });

    writeStdoutLine(`File reduction report written to ${outputPath}`);
    writeStdoutLine(`Findings: ${report.summary.totalFindings} | Reclaimable: ${report.summary.reclaimableBytes} bytes`);
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

function runGateStatusCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runGateStatusCommand requires an options object');
    const root = resolveCliProjectRoot(options.path);
    const status = readGateStatus(root, {
        reportPath: options.report ? path.relative(root, path.resolve(root, options.report)) : undefined
    });

    if (options.format === 'json') {
        writeStdoutLine(JSON.stringify(status, null, 2));
        process.exit(status.ok && status.gatePass ? 0 : 1);
    }

    if (!status.ok) {
        writeStdoutLine(status.error);
        writeStdoutLine(`Report path: ${status.reportPath}`);
        process.exit(1);
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
    process.exit(status.gatePass ? 0 : 1);
}

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

async function main() {
    const options = parseArgs(process.argv);

    if (options.version) {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            writeStdoutLine(`simplebeacon ${pkg.version}`);
        } catch {
            writeStdoutLine('simplebeacon (version unknown)');
        }
        process.exit(0);
    }

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    if (!VALID_COMMANDS.has(options.command)) {
        console.error(`Unknown command: ${options.command}`);
        printHelp();
        process.exit(2);
    }

    applyCliPathSafety(options);

    if (options.command === 'init') {
        runInitCommand(options);
        return;
    }

    if (options.command === 'comment') {
        await runCommentCommand(options);
        return;
    }

    if (options.command === 'baseline-sync') {
        await runBaselineSyncCommand(options);
        return;
    }

    if (options.command === 'assess') {
        await runAssessCommand(options);
        return;
    }

    if (options.command === 'compliance') {
        await runComplianceCommand(options);
        return;
    }

    if (options.command === 'report') {
        await runReportCommand(options);
        return;
    }

    if (options.command === 'hook-install') {
        runHookInstallCommand(options);
        return;
    }

    if (options.command === 'reduce') {
        await runReduceCommand(options);
        return;
    }

    if (options.command === 'gate-status') {
        runGateStatusCommand(options);
        return;
    }

    if (options.command === 'mcp') {
        const { createMcpStdioServer } = require('../src/mcp/stdio-server');
        const server = createMcpStdioServer({ offline: options.offline });
        server.start();
        return;
    }

    if (options.command === 'ai-plan') {
        await runAiPlanCommand(options);
        return;
    }

    if (options.command === 'scan') {
        await runScanCommand(options);
        return;
    }

    if (options.command === 'pdf') {
        await runPdfCommand(options);
        return;
    }

    if (options.command === 'buy-clearance') {
        await runBuyClearanceCommand(options);
        return;
    }

    if (options.command === 'doctor') {
        runDoctorCommand();
        return;
    }

    console.error(`Command "${options.command}" is not yet implemented.`);
    process.exit(2);
}

function runDoctorCommand() {
    const { runDoctor } = require('../src/doctor');
    runDoctor();
}

async function runAiPlanCommand(options) {
    if (!options || typeof options !== 'object') throw new TypeError('runAiPlanCommand requires an options object');
    const root = sanitizePath(options.path);
    const config = loadSimplebeaconConfig(root, options.config);
    
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
    plan += '- Use the `simplebeacon scan --complete` flag for comprehensive analysis\n';
    plan += '- Consider integrating with CI/CD pipelines for automated checks\n';
    plan += '- Review and update SimpleBeacon configuration as needed\n';

    return plan;
}

function generateRecommendation(issue) {
    if (!issue || typeof issue !== 'object') return 'Review and address this issue according to best practices';
    const type = issue.type || 'unknown';
    const description = issue.description || issue.message || 'No description available';
    
    const recommendations = {
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
    };

    return recommendations[type] || 'Review and address this issue according to best practices';
}

main().catch((error) => {
    console.error(paint(formatCliError(error), 'red'));
    process.exit(2);
});
