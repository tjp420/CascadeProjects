#!/usr/bin/env node
/**
 * Emit machine-readable Jest pass/fail evidence for quality workflows.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');

const jestResultPath = path.join(ROOT, '.simplebeacon', 'jest-result.json');
const outPath = path.join(ROOT, '.simplebeacon', 'jest-quality-evidence.json');

let source = null;
if (fs.existsSync(jestResultPath)) {
    try {
        source = JSON.parse(fs.readFileSync(jestResultPath, 'utf8'));
    } catch {
        source = null;
    }
}

const payload = {
    generatedAt: new Date().toISOString(),
    source: 'jest-quality-evidence',
    strict,
    hasJestResult: Boolean(source),
    success: source ? Boolean(source.success) : null,
    numTotalTests: source?.numTotalTests ?? null,
    numPassedTests: source?.numPassedTests ?? null,
    numFailedTests: source?.numFailedTests ?? null,
    numTotalTestSuites: source?.numTotalTestSuites ?? null,
    numPassedTestSuites: source?.numPassedTestSuites ?? null,
    numFailedTestSuites: source?.numFailedTestSuites ?? null
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`[jest-quality-evidence] wrote ${path.relative(ROOT, outPath).replace(/\\/g, '/')}`);

if (strict && payload.hasJestResult && payload.success === false) {
    process.exit(1);
}
