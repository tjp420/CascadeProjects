#!/usr/bin/env node
/**
 * Track 2 gate — critical-path Jest coverage must meet thresholds in jest.critical-path.config.js.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SUMMARY_PATH = path.join(ROOT, 'coverage', 'dashboard', 'coverage-summary.json');
const THRESHOLDS = {
    lines: 70,
    statements: 70,
    functions: 70,
    branches: 60
};

function main() {
    console.log('Running critical-path coverage suite...');
    execSync('npm run test:coverage:critical-path', {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env
    });

    if (!fs.existsSync(SUMMARY_PATH)) {
        console.error(`Missing coverage summary: ${SUMMARY_PATH}`);
        process.exit(1);
    }

    const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
    const total = summary.total || {};
    let failed = false;

    console.log('\n=== Critical-path coverage summary ===');
    for (const [metric, min] of Object.entries(THRESHOLDS)) {
        const pct = total[metric]?.pct;
        const ok = typeof pct === 'number' && pct >= min;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${metric}: ${pct ?? 'n/a'}% (min ${min}%)`);
        if (!ok) failed = true;
    }

    console.log('\nScoped files:');
    for (const [file, metrics] of Object.entries(summary)) {
        if (file === 'total') continue;
        const linePct = metrics.lines?.pct ?? 0;
        const flag = linePct >= THRESHOLDS.lines ? '✓' : '✗';
        console.log(`  ${flag} ${file}: lines ${linePct}%`);
    }

    if (failed) {
        console.error('\nDecision: NO-GO — critical-path coverage below threshold');
        process.exit(1);
    }

    console.log('\nDecision: GO — critical-path coverage meets Track 2 thresholds');
}

main();
