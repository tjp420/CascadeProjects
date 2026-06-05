#!/usr/bin/env node
/**
 * Simplebeacon CLI
 *
 * Thin entry point — delegates to command handlers in ../src/commands.js
 */

const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');
const {
    runScanCommand,
    runBaselineSyncCommand,
    runCommentCommand,
    runAssessCommand,
    runReportCommand,
    runComplianceCommand,
    runInitCommand,
    runHookInstallCommand,
    runReduceCommand,
    runAccuracyCommand,
    runGateStatusCommand
} = require('../src/commands');
const {
    SimplebeaconError,
    ConfigError
} = require('../src/lib/errors');
const {
    resolveCliProjectRoot,
    sanitizeCliPathOptions
} = require('../src/lib/path-utils');

const VALID_COMMANDS = new Set([
    'scan', 'init', 'comment', 'baseline-sync', 'assess', 'compliance',
    'report', 'hook-install', 'reduce', 'gate-status', 'accuracy'
]);

function writeStdoutLine(message = '') {
    process.stdout.write(`${message}\n`);
}

function parseArgs(argv) {
    const args = argv.slice(2);
    let command = args[0] || 'scan';
    let flagStart = 1;

    if (!command || command.startsWith('-')) {
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
        help: false,
        version: false,
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
        withCi: false,
        fullDirectoryScan: null,
        universal: false
    };

    for (let i = flagStart; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--path' && args[i + 1]) {
            options.path = args[++i];
        } else if (arg === '--config' && args[i + 1]) {
            options.config = args[++i];
        } else if (arg === '--format' && args[i + 1]) {
            options.format = args[++i];
        } else if (arg === '--output' && args[i + 1]) {
            options.output = args[++i];
        } else if (arg === '--report' && args[i + 1]) {
            options.report = args[++i];
        } else if (arg === '--issue-number' && args[i + 1]) {
            options.issueNumber = args[++i];
        } else if (arg === '--repo' && args[i + 1]) {
            options.repo = args[++i];
        } else if (arg === '--profile' && args[i + 1]) {
            options.profile = args[++i];
        } else if (arg === '--fail-on' && args[i + 1]) {
            options.failOn = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
        } else if (arg === '--gate') {
            options.gate = true;
        } else if (arg === '--with-jest') {
            options.withJest = true;
        } else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        } else if (arg === '--company' && args[i + 1]) {
            options.company = args[++i];
        } else if (arg === '--assessor' && args[i + 1]) {
            options.assessor = args[++i];
        } else if (arg === '--client' && args[i + 1]) {
            options.client = args[++i];
        } else if (arg === '--branch' && args[i + 1]) {
            options.branch = args[++i];
        } else if (arg === '--assessment' && args[i + 1]) {
            options.assessment = args[++i];
        } else if (arg === '--print-only') {
            options.printOnly = true;
        } else if (arg === '--api-token' && args[i + 1]) {
            options.apiToken = args[++i];
        } else if (arg === '--upload' && args[i + 1]) {
            options.upload = args[++i];
        } else if (arg === '--type' && args[i + 1]) {
            options.hookType = args[++i];
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
        } else if (arg === '--enhance-model' && args[i + 1]) {
            options.enhanceModel = args[++i];
        } else if (arg === '--scanner' && args[i + 1]) {
            options.scanner = args[++i];
        } else if (arg === '--checklist' && args[i + 1]) {
            options.checklist = args[++i];
        } else if (arg === '--with-ci') {
            options.withCi = true;
        } else if (arg === '--full') {
            options.fullDirectoryScan = true;
        } else if (arg === '--universal') {
            options.universal = true;
            options.fullDirectoryScan = true;
        } else if (arg === '--mcp-mode' && args[i + 1]) {
            options.mcpMode = args[++i];
        } else if (arg === '--version' || arg === '-V') {
            options.version = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function validateUploadUrl(options) {
    if (!options.upload) return;
    const url = options.upload;
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw new ConfigError(`Invalid --upload URL: ${url}`);
    }
    if (parsed.protocol !== 'https:') {
        throw new ConfigError(`--upload must use HTTPS scheme (got ${parsed.protocol})`);
    }
}

function applyCliPathSafety(options) {
    const sanitized = sanitizeCliPathOptions(options);
    Object.assign(options, sanitized);

    const pathRequiredCommands = new Set([
        'scan', 'init', 'baseline-sync', 'assess', 'compliance',
        'report', 'hook-install', 'accuracy'
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
    if (error instanceof SimplebeaconError && error.code) {
        return `[${error.code}] ${error.message}`;
    }
    return error.message || String(error);
}

function printHelp() {
    writeStdoutLine(`Simplebeacon — detect mock data, fiction KPIs, and credential leaks

Usage:
  simplebeacon scan [options]     Scan project and report findings
  simplebeacon init [options]     Create .simplebeacon/config.json and baseline.json
  simplebeacon comment [options]  Post GitHub PR comment from JSON report
  simplebeacon assess [options]   Build customer assessment JSON from scan report
  simplebeacon compliance [opts]  Evaluate corporate safety checklist from report
  simplebeacon report [options]   Build client-facing markdown audit from scan JSON
  simplebeacon baseline sync      Run Jest and update .simplebeacon/baseline.json
  simplebeacon hook install         Install pre-commit or pre-push git hook
  simplebeacon gate status            Print gate pass/fail from .simplebeacon/report.json
  simplebeacon reduce [options]     Analyze repo for file-reduction opportunities (dry-run)
  simplebeacon accuracy [options]   Run scanner accuracy tracker against golden corpus

Init options:
  --path <dir>        Project root (default: cwd)
  --profile <name>    Force profile: minimal, standard, cascade (auto-detected by default)
  --dry-run           Preview init changes without writing files
  --force             Overwrite existing config/baseline (backup created first)
  --with-ci           Write .github/workflows/simplebeacon.yml

Scan options:
  --path <dir>        Project root (default: cwd)
  --config <file>     Config path (default: .simplebeacon/config.json)
  --format text|json  Output format (default: text)
  --output <file>     Write report to file
  --gate              Exit 1 when gate severities are found
  --fail-on a,b,c     Override gate fail severities (default: high)
  --with-jest         Run npm test and compare to baseline (slow)
  --verbose, -v       Print config warnings and scan paths
  --offline           Fail if any outbound network activity occurs during scan
  --full              Full directory scan — walk entire repo, not just production paths
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

Examples:
  npx simplebeacon init
  npx simplebeacon init --profile minimal
  npx simplebeacon scan --gate
  npx simplebeacon scan --offline --gate
  npx simplebeacon scan --format json --output .simplebeacon/report.json --gate
  npx simplebeacon scan --full --format json --output .simplebeacon/full-report.json --gate
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
`);
}

async function main() {
    const options = parseArgs(process.argv);

    if (options.version) {
        writeStdoutLine(version);
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
    validateUploadUrl(options);

    switch (options.command) {
        case 'init':
            runInitCommand(options);
            return;
        case 'comment':
            await runCommentCommand(options);
            return;
        case 'baseline-sync':
            await runBaselineSyncCommand(options);
            return;
        case 'assess':
            await runAssessCommand(options);
            return;
        case 'compliance':
            await runComplianceCommand(options);
            return;
        case 'report':
            await runReportCommand(options);
            return;
        case 'hook-install':
            runHookInstallCommand(options);
            return;
        case 'reduce':
            await runReduceCommand(options);
            return;
        case 'gate-status':
            runGateStatusCommand(options);
            return;
        case 'accuracy':
            await runAccuracyCommand(options);
            return;
        case 'scan':
            await runScanCommand(options);
            return;
        default:
            console.error(`Unhandled command: ${options.command}`);
            process.exit(2);
    }
}

main().catch((error) => {
    console.error(formatCliError(error));
    process.exit(2);
});
