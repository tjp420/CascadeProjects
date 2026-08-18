/**
 * MCP agent verification handlers — verify_before_write, verify_completion
 *
 * These tools give AI coding agents a deterministic pre-write gate and
 * a task-completion verifier, addressing the top two failure patterns
 * from the Columbia DAPLab 2025 study:
 *   1. Exception & error handling (swallowed exceptions)
 *   2. Fabricated success reports (claiming done when not done)
 */

const path = require('path');
const fs = require('fs');
const { scanSnippetContent } = require('../../lib/snippet-scanner');
const { scanSwallowedExceptions, scanContent: scanSwallowed } = require('../../rules/swallowed-exception-scanner');
const { scanPhantomApiCalls, scanContent: scanPhantom } = require('../../rules/phantom-api-scanner');
const { resolveAgentTier } = require('../../lib/agent-tier-capabilities');
const { appendFailure } = require('../../lib/failure-log');
const { rebuildSignals } = require('../../lib/improvement-signals');

function createAgentVerifyHandlers({ withGuard, resolveProjectRoot, formatToolResult }) {
    return {
        verify_before_write: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (!args.content) throw new Error('Missing required argument: content');
            if (!args.filePath) throw new Error('Missing required argument: filePath');

            const filePath = String(args.filePath);
            const content = String(args.content);
            const ext = path.extname(filePath).toLowerCase();
            const projectRoot = resolveProjectRoot(args.projectRoot);
            const skipGateCheck = args.skipGateCheck === true;

            // ── Pre-edit gate check ──
            // "Don't keep building on junk" — if the project gate is failing,
            // block writes to files that are NOT the source of the blocking issues.
            // The agent is allowed to fix gate-blocking files, but not to add new
            // code on top of a broken gate.
            let gateStatus = null;
            let gateBlockingFiles = [];
            let gateBlocked = false;
            if (!skipGateCheck) {
                try {
                    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');
                    if (fs.existsSync(reportPath)) {
                        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                        const reportBlocking = report.blockingCount ||
                            (report.issues || []).filter(i => i.severity === 'critical' || i.severity === 'high').length;
                        const gatePass = report.gatePass === true || report.gate === 'pass';
                        gateStatus = { pass: gatePass, blockingCount: reportBlocking };

                        if (!gatePass && reportBlocking > 0) {
                            // Collect file paths from blocking issues
                            gateBlockingFiles = (report.issues || [])
                                .filter(i => i.severity === 'critical' || i.severity === 'high')
                                .map(i => i.filePath || i.file || i.path)
                                .filter(Boolean);

                            // Normalize the target file path for comparison
                            const normalizedTarget = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

                            // Check if the target file is one of the gate-blocking files
                            const isFixingBlockingFile = gateBlockingFiles.some(f => {
                                const normalized = String(f).replace(/\\/g, '/').replace(/^\.\//, '');
                                return normalized === normalizedTarget ||
                                    normalized.endsWith('/' + normalizedTarget) ||
                                    normalizedTarget.endsWith('/' + normalized);
                            });

                            if (!isFixingBlockingFile) {
                                gateBlocked = true;
                            }
                        }
                    }
                } catch {
                    // Gate check is best-effort — don't block if report can't be read
                }
            }

            // Run all agent-failure scanners on the proposed content
            const swallowedFindings = scanSwallowed(content, filePath);
            const phantomFindings = scanPhantom(content, filePath);

            // Also run the standard snippet scanner for AI slop, credentials, etc.
            let snippetResult;
            try {
                snippetResult = scanSnippetContent(content, {
                    filePath,
                    projectRoot
                });
            } catch {
                snippetResult = { findings: [], blockingCount: 0 };
            }

            // Merge all findings
            const allFindings = [
                ...swallowedFindings,
                ...phantomFindings,
                ...(snippetResult.findings || [])
            ];

            const blockingCount = allFindings.filter(f =>
                f.severity === 'critical' || f.severity === 'high'
            ).length;

            const warningCount = allFindings.filter(f =>
                f.severity === 'medium' || f.severity === 'low'
            ).length;

            // Determine recommended action
            let recommendedAction;
            if (gateBlocked) {
                recommendedAction = 'fix-gate-first';
            } else if (blockingCount > 0) {
                recommendedAction = 'fix-and-retry';
            } else if (warningCount > 3) {
                recommendedAction = 'consult-user';
            } else {
                recommendedAction = 'ok-to-write';
            }

            const tierCtx = resolveAgentTier();

            // Log blocked writes to failure log for improvement tracking
            if (blockingCount > 0) {
                try {
                    for (const finding of allFindings.filter(f => f.severity === 'critical' || f.severity === 'high')) {
                        appendFailure(projectRoot, {
                            category: 'scan',
                            source: 'simplebeacon',
                            filePath,
                            errorType: finding.ruleId || finding.pattern || finding.type || 'unknown',
                            message: finding.message || finding.description || 'Blocked by verify_before_write',
                            severity: finding.severity,
                            context: { ruleId: finding.ruleId, line: finding.line }
                        });
                    }
                    rebuildSignals(projectRoot);
                } catch {
                    // Failure logging is best-effort — don't break the gate
                }
            }

            // Log gate-blocked writes as a separate failure category
            if (gateBlocked) {
                try {
                    appendFailure(projectRoot, {
                        category: 'gate',
                        source: 'simplebeacon',
                        filePath,
                        errorType: 'gate_blocking_edit_refused',
                        message: `Write blocked — project gate is failing with ${gateStatus.blockingCount} blocking issue(s). Fix gate-blocking files first: ${gateBlockingFiles.slice(0, 5).join(', ')}`,
                        severity: 'high',
                        context: { gateBlockingCount: gateStatus.blockingCount, gateBlockingFiles: gateBlockingFiles.slice(0, 10) }
                    });
                    rebuildSignals(projectRoot);
                } catch {
                    // Best-effort logging
                }
            }

            return formatToolResult({
                passed: blockingCount === 0 && !gateBlocked,
                recommendedAction,
                blockingCount,
                warningCount,
                findings: allFindings.slice(0, 20),
                filePath,
                gateStatus,
                gateBlocked,
                gateBlockingFiles: gateBlockingFiles.slice(0, 10),
                localOnly: true,
                tier: tierCtx.tier,
                methodology: 'Deterministic regex + pattern database — not LLM semantic review'
            });
        }),

        verify_completion: withGuard(async (args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            const projectRoot = resolveProjectRoot(args.projectRoot);
            const checkTests = args.checkTests !== false;
            const checkBuild = args.checkBuild === true;

            const evidence = [];
            let canClaimComplete = true;

            // 1. Check gate status from last scan report
            let gatePass = null;
            let gateBlockingCount = null;
            try {
                const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');
                if (fs.existsSync(reportPath)) {
                    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                    gatePass = report.gatePass === true || report.gate === 'pass';
                    gateBlockingCount = report.blockingCount || (report.issues || []).filter(
                        i => i.severity === 'critical' || i.severity === 'high'
                    ).length;
                    evidence.push({
                        check: 'gate',
                        passed: gatePass,
                        blockingCount: gateBlockingCount,
                        source: '.simplebeacon/report.json'
                    });
                    if (!gatePass) canClaimComplete = false;
                } else {
                    evidence.push({
                        check: 'gate',
                        passed: null,
                        note: 'No scan report found. Run: npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json'
                    });
                    canClaimComplete = false;
                }
            } catch (e) {
                evidence.push({ check: 'gate', passed: null, error: e.message });
                canClaimComplete = false;
            }

            // 2. Check test suite
            if (checkTests) {
                try {
                    const testCmd = args.testCommand || detectTestCommand(projectRoot);
                    if (testCmd) {
                        const { execSync } = require('child_process');
                        const testResult = execSync(testCmd, {
                            cwd: projectRoot,
                            timeout: 120000,
                            encoding: 'utf8',
                            stdio: 'pipe',
                            env: { ...process.env, SKIP_REDIS_INTEGRATION: '1', CI: 'true' }
                        });
                        const testPassed = !testResult.includes('failed') ||
                            (testResult.includes('passed') && !testResult.match(/(\d+)\s+failed/));
                        evidence.push({
                            check: 'tests',
                            passed: testPassed,
                            command: testCmd,
                            output: testResult.slice(-500)
                        });
                        if (!testPassed) canClaimComplete = false;
                    } else {
                        evidence.push({
                            check: 'tests',
                            passed: null,
                            note: 'No test command detected. Set checkTests=false or provide testCommand.'
                        });
                    }
                } catch (e) {
                    const output = (e.stdout || e.stderr || e.message || '').slice(-500);
                    evidence.push({
                        check: 'tests',
                        passed: false,
                        error: output
                    });
                    canClaimComplete = false;
                }
            }

            // 3. Check build
            if (checkBuild) {
                try {
                    const buildCmd = args.buildCommand || detectBuildCommand(projectRoot);
                    if (buildCmd) {
                        const { execSync } = require('child_process');
                        execSync(buildCmd, {
                            cwd: projectRoot,
                            timeout: 180000,
                            encoding: 'utf8',
                            stdio: 'pipe',
                            env: { ...process.env }
                        });
                        evidence.push({
                            check: 'build',
                            passed: true,
                            command: buildCmd
                        });
                    } else {
                        evidence.push({
                            check: 'build',
                            passed: null,
                            note: 'No build command detected.'
                        });
                    }
                } catch (e) {
                    const output = (e.stdout || e.stderr || e.message || '').slice(-500);
                    evidence.push({
                        check: 'build',
                        passed: false,
                        error: output
                    });
                    canClaimComplete = false;
                }
            }

            // 4. Check for uncommitted changes
            try {
                const { execSync } = require('child_process');
                const status = execSync('git status --porcelain', {
                    cwd: projectRoot,
                    encoding: 'utf8',
                    timeout: 5000,
                    stdio: 'pipe'
                }).trim();
                const hasUncommitted = status.length > 0;
                evidence.push({
                    check: 'git-clean',
                    passed: !hasUncommitted,
                    uncommittedFiles: hasUncommitted ? status.split('\n').length : 0
                });
            } catch (e) {
                evidence.push({ check: 'git-clean', passed: null, note: 'Not a git repo or git unavailable' });
            }

            const tierCtx = resolveAgentTier();

            // Log this verification run for improvement tracking
            try {
                const { logValidationRun } = require('../../lib/validation-runs');
                const failingChecks = evidence.filter((e) => e.passed === false).length;
                const passingChecks = evidence.filter((e) => e.passed === true).length;
                logValidationRun(projectRoot, {
                    runType: 'gate',
                    pass: passingChecks,
                    failures: failingChecks,
                    notes: canClaimComplete ? 'All checks passed' : 'Failing checks must be resolved'
                });
            } catch {
                // Best-effort logging — don't break verify_completion
            }

            return formatToolResult({
                canClaimComplete,
                evidence,
                gatePass,
                gateBlockingCount,
                tier: tierCtx.tier,
                recommendation: canClaimComplete
                    ? 'Task may be claimed complete — all checks passed.'
                    : 'Do NOT claim task complete — failing checks must be resolved first.',
                localOnly: true
            });
        })
    };
}

function detectTestCommand(projectRoot) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
            return 'npm test --silent';
        }
    } catch {}
    return null;
}

function detectBuildCommand(projectRoot) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        if (pkg.scripts && pkg.scripts.build) {
            return 'npm run build --silent';
        }
    } catch {}
    return null;
}

module.exports = { createAgentVerifyHandlers };
