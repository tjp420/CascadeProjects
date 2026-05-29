#!/usr/bin/env node
/**
 * Track 2 production readiness — combines critical-path coverage, compliance, and launch verifiers.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, '.simplebeacon', 'track2-readiness-summary.json');

const CHECKS = [
    { id: 'critical-path-coverage', title: 'Critical-path coverage ≥70%', command: 'npm run verify:critical-path-coverage' },
    { id: 'tests', title: 'Full Jest suite', command: 'npm test -- --no-coverage' },
    { id: 'compliance', title: 'Compliance gate', command: 'npm run compliance:check' },
    { id: 'predeploy', title: 'Predeploy sequence', command: 'npm run verify:predeploy' },
    { id: 'launch-readiness', title: 'Launch readiness', command: 'npm run verify:launch-readiness' },
    { id: 'production-deploy', title: 'Production deploy profile', command: 'npm run verify:production-deploy' }
];

function runCheck(check) {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    try {
        const stdout = execSync(check.command, {
            cwd: ROOT,
            env: process.env,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return {
            id: check.id,
            title: check.title,
            command: check.command,
            startedAt,
            elapsedMs: Date.now() - started,
            ok: true,
            exitCode: 0,
            stdoutTail: String(stdout || '').trim().split(/\r?\n/).slice(-8),
            stderrTail: []
        };
    } catch (error) {
        return {
            id: check.id,
            title: check.title,
            command: check.command,
            startedAt,
            elapsedMs: Date.now() - started,
            ok: false,
            exitCode: Number.isInteger(error.status) ? error.status : 1,
            stdoutTail: String(error.stdout || '').trim().split(/\r?\n/).slice(-8),
            stderrTail: String(error.stderr || '').trim().split(/\r?\n/).slice(-6)
        };
    }
}

function main() {
    console.log('Running Track 2 readiness framework...\n');
    const results = CHECKS.map(runCheck);

    for (const result of results) {
        console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ${result.title} (${result.elapsedMs}ms)`);
    }

    const failed = results.filter((r) => !r.ok);
    const summary = {
        type: 'simplebeacon-track2-readiness-summary',
        generatedAt: new Date().toISOString(),
        passed: results.length - failed.length,
        failed: failed.length,
        total: results.length,
        decision: failed.length === 0 ? 'GO' : 'NO-GO',
        checks: results,
        notes: [
            'Production live with monetization still requires host secrets (live Stripe, JWT) on the deploy machine.',
            'verify:production-deploy may WARN when SIMPLEBEACON_MONETIZATION_ENABLED=false — expected until checkout is enabled.'
        ]
    };

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(`\nDecision: ${summary.decision}`);
    console.log(`Artifact: ${OUT_PATH}`);

    if (summary.decision !== 'GO') {
        process.exit(1);
    }
}

main();
