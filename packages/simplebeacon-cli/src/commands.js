/**
 * Simplebeacon CLI command handlers
 *
 * Extracted from bin/simplebeacon.js to keep the entry point thin.
 */

const fs = require('fs');
const path = require('path');
const {
    loadSimplebeaconConfig,
    initSimplebeacon,
    runScan,
    evaluateGate,
    formatTextReport,
    formatActionPlanReport,
    formatJsonReport,
    syncJestBaseline,
    detectProjectProfile,
    resolvePlatformRoot,
    writeManagedFileSync,
    compileAuditReportMarkdown
} = require('./index');
const { formatGithubComment, postGithubComment } = require('./reporters/github-comment');
const { buildAssessmentReport } = require('./assessment');
const { sanitizeReportForCloudUpload } = require('./lib/report-sanitizer');
const { evaluateComplianceChecklist } = require('./compliance-checklist');
const { installSimplebeaconHook } = require('./hook-install');
const { paint } = require('./reporters/text');
const {
    createNetworkGuard,
    printTrustCompletion
} = require('./lib/trust-guard');
const { validateJSON, validateNotEmpty } = require('./lib/file-validator');
const {
    SimplebeaconError,
    ConfigError
} = require('./lib/errors');
const {
    resolveCliProjectRoot,
    sanitizeCliPathOptions
} = require('./lib/path-utils');
const { sanitizePath } = require('./lib/path-sanitizer');

const { appendScanHistory } = require('./lib/scan-history');
const { enhanceExecutiveSummary } = require('./reporters/report-enhance');
const { runFileReductionScan } = require('./lib/file-reduction-orchestrator');
const { generateFileReductionReport } = require('./reporters/file-reduction-report');
const { readGateStatus } = require('./lib/snippet-scanner');
const { installDeveloperStack } = require('./lib/developer-onboarding');
const { runAndRecordAccuracyTracker } = require('./lib/scanner-accuracy-tracker');

function writeStdoutLine(message = '') {
    process.stdout.write(`${message}\n`);
}

function printConfigWarnings(config, verbose) {
    if (!verbose || !config.configWarnings?.length) return;
    for (const warning of config.configWarnings) {
        console.error(paint(`Warning: ${warning}`, 'yellow'));
    }
}

async function uploadReportToCloud(uploadUrl, apiToken, report) {
    if (!apiToken) {
        throw new ConfigError('--api-token is required when using --upload', { uploadUrl });
    }

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Simplebeacon-Token': apiToken
        },
        body: JSON.stringify({ report: sanitizeReportForCloudUpload(report) })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || data.error || `Cloud upload failed (${response.status})`);
    }

    return data;
}

async function runScanCommand(options) {
    const scanRoot = options.path;
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const config = loadSimplebeaconConfig(platformRoot, options.config);
    if (options.failOn) {
        config.gate.failOn = options.failOn;
    }

    printConfigWarnings(config, options.verbose);
    if (options.verbose) {
        console.error(`Scan paths: ${config.scanPaths?.join(', ') || '(none)'}`);
        console.error(`Production paths: ${config.productionPaths?.join(', ') || '(none)'}`);
        console.error(`Profile: ${config.profile || 'standard'}`);
    }

    if (options.format !== 'text' && options.format !== 'json' && options.format !== 'action-plan') {
        throw new Error(`Invalid --format "${options.format}" — use text, json, or action-plan`);
    }

    const networkGuard = createNetworkGuard({ offline: options.offline });
    try {
        const report = await runScan(scanRoot, {
            config,
            configPath: options.config,
            withJest: options.withJest,
            fullDirectoryScan: options.fullDirectoryScan
        });
        networkGuard.assertOfflineClean();
        printTrustCompletion({
            quiet: options.noTrustBanner,
            offline: options.offline,
            networkEventCount: networkGuard.events.length
        }, paint);

        const gateResult = evaluateGate(report, config.gate);
        const jsonReport = formatJsonReport(report, gateResult);

        if (options.upload) {
            const uploadResult = await uploadReportToCloud(options.upload, options.apiToken, jsonReport);
            console.error(`Cloud upload complete${uploadResult.scanId ? `: ${uploadResult.scanId}` : ''}`);
        }

        let payload;
        if (options.format === 'json') {
            payload = JSON.stringify(jsonReport, null, 2);
        } else if (options.format === 'action-plan') {
            payload = formatActionPlanReport(report, gateResult);
        } else {
            payload = formatTextReport(report, gateResult);
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

        if (options.gate && !gateResult.pass) {
            console.error(paint(`Gate failed: ${gateResult.blockingIssues.length} blocking issue(s)`, 'red'));
            process.exit(1);
        }
    } finally {
        networkGuard.dispose();
    }
}

async function runBaselineSyncCommand(options) {
    const root = sanitizePath(options.path);
    if (options.dryRun) {
        writeStdoutLine('DRY RUN — baseline sync requires a test run; use without --dry-run to execute.');
        return;
    }
    const { syncMeasuredBaseline } = require('./baseline-sync');
    const result = await syncMeasuredBaseline(root, { config: options.config });
    const { baselinePath, baseline, jestNote, pageSamplesLabel } = result;

    writeStdoutLine(`Baseline synced: ${baselinePath}`);
    if (pageSamplesLabel) {
        writeStdoutLine(`  Page samples: ${pageSamplesLabel}`);
    }
    if (baseline.jestTestsLabel) {
        writeStdoutLine(`  Jest: ${baseline.jestTestsLabel}${result.summary?.suitesPassed != null ? ` (${result.summary.suitesPassed} suites)` : ''}`);
    }
    if (jestNote) {
        writeStdoutLine(`  Note: ${jestNote}`);
    }
}

async function runCommentCommand(options) {
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

    const result = await postGithubComment(reportPath, {
        token: process.env.GITHUB_TOKEN,
        repo: options.repo,
        issueNumber: options.issueNumber
    });

    writeStdoutLine(`Posted comment: ${result.html_url || result.url || 'ok'}`);
}

async function loadOrRunReport(options) {
    const reportPath = path.resolve(options.report || '.simplebeacon/report.json');
    if (options.report) {
        if (!fs.existsSync(reportPath)) {
            throw new Error(`Report not found: ${reportPath}`);
        }
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
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
    writeStdoutLine(`Gate: ${assessment.executiveSummary.gateResult}`);
    writeStdoutLine(`Compliance: ${assessment.complianceChecklist.summary.passed}/${assessment.complianceChecklist.summary.passed + assessment.complianceChecklist.summary.failed} rules pass (score ${assessment.executiveSummary.complianceScore ?? '—'})`);
    writeStdoutLine(`Headline: ${assessment.executiveSummary.headline}`);
}

async function runReportCommand(options) {
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
            throw new Error(`Assessment required for --enhance: ${assessmentPath}. Run: npx simplebeacon assess --company "..." --assessor "..."`);
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

    writeStdoutLine(`${checklist.summary.headline}`);
    for (const rule of checklist.rules) {
        const icon = rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '○';
        writeStdoutLine(`  ${icon} ${rule.id} ${rule.title} — ${rule.evidence}`);
    }

    if (options.gate && checklist.summary.failed > 0) {
        process.exit(1);
    }
}

function runInitCommand(options) {
    const root = sanitizePath(options.path);
    const created = initSimplebeacon(root, {
        profile: options.profile,
        dryRun: options.dryRun,
        force: options.force
    });
    const detected = created.detected || detectProjectProfile(root);

    if (created.dryRun) {
        writeStdoutLine('DRY RUN — no files were modified');
        writeStdoutLine('');
        for (const action of created.plannedActions || []) {
            writeStdoutLine(`Would ${action.action}: ${action.path}`);
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

    if (options.withCi) {
        const stack = installDeveloperStack(root, {
            force: options.force,
            dryRun: options.dryRun,
            withCi: options.withCi
        });

        writeStdoutLine('');
        if (stack.ciWorkflow?.created) {
            writeStdoutLine(`Created ${stack.ciWorkflow.path}`);
        } else if (stack.ciWorkflow?.skipped) {
            writeStdoutLine(`Skipped existing ${stack.ciWorkflow.path}`);
        }
    }
}

function runHookInstallCommand(options) {
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

async function runAccuracyCommand(options) {
    const root = resolveCliProjectRoot(options.path);
    const { record, report, regression } = await runAndRecordAccuracyTracker(root, {
        corpusRoot: options.corpusRoot,
        dryRun: options.dryRun
    });

    if (options.format === 'json') {
        writeStdoutLine(JSON.stringify(record, null, 2));
        process.exit(regression ? 1 : 0);
    }

    writeStdoutLine(report);
    writeStdoutLine('');
    writeStdoutLine(`History: ${root}/.simplebeacon/scanner-accuracy.json`);
    process.exit(regression ? 1 : 0);
}

function runGateStatusCommand(options) {
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

module.exports = {
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
};
