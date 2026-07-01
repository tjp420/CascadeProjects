/**
 * False-positive audit runner.
 * Scans historic human-written repos (lodash, express) using only the two
 * engines under test: llm-slop-patterns and token-bleed-patterns.
 */

const fs = require('fs');
const path = require('path');
const { scanLlmSlopPatterns } = require('../packages/simplebeacon-cli/src/rules/llm-slop-patterns');
const { scanTokenBleedPatterns } = require('../packages/simplebeacon-cli/src/rules/token-bleed-patterns');

const AUDIT_ROOT = __dirname;
const OUTPUT_FILE = path.join(AUDIT_ROOT, 'audit-results.json');

const TARGETS = [
    {
        name: 'lodash',
        dir: path.join(AUDIT_ROOT, 'lodash'),
        sourcePaths: ['src', 'lib', 'test'],
        productionPaths: ['src', 'lib', 'test']
    },
    {
        name: 'express',
        dir: path.join(AUDIT_ROOT, 'express'),
        sourcePaths: ['.', 'lib', 'test'],
        productionPaths: ['.', 'lib', 'test']
    },
    {
        name: 'ai-generated',
        dir: path.join(AUDIT_ROOT, 'ai-generated'),
        sourcePaths: ['src'],
        productionPaths: ['src']
    }
];

async function runEngine(name, fn, target) {
    console.log(`\n[${target.name}] Running ${name}...`);
    const result = await fn(target.dir, {
        sourcePaths: target.sourcePaths,
        productionPaths: target.productionPaths,
        registryCheck: false
    });
    console.log(`  Scanned: ${result.scanned} files`);
    console.log(`  Findings: ${result.findings}`);
    return result;
}

async function main() {
    const summary = {
        generatedAt: new Date().toISOString(),
        targets: []
    };

    for (const target of TARGETS) {
        if (!fs.existsSync(target.dir)) {
            console.error(`Missing target directory: ${target.dir}`);
            continue;
        }

        const llmResult = await runEngine('llm-slop-patterns', scanLlmSlopPatterns, target);
        const tbResult = await runEngine('token-bleed-patterns', scanTokenBleedPatterns, target);

        summary.targets.push({
            name: target.name,
            dir: target.dir,
            llmSlop: {
                scanned: llmResult.scanned,
                findings: llmResult.findings,
                issues: llmResult.issues.map((issue) => ({
                    id: issue.id,
                    pattern: issue.pattern,
                    severity: issue.severity,
                    file: issue.file,
                    line: issue.line,
                    match: issue.metadata?.match || issue.description
                }))
            },
            tokenBleed: {
                scanned: tbResult.scanned,
                findings: tbResult.findings,
                issues: tbResult.issues.map((issue) => ({
                    id: issue.id,
                    pattern: issue.pattern,
                    severity: issue.severity,
                    file: issue.file,
                    line: issue.line,
                    match: issue.metadata?.match || issue.description
                }))
            }
        });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));
    console.log(`\nWrote detailed results to ${OUTPUT_FILE}`);

    // Print a concise table
    console.log('\n--- SUMMARY ---');
    for (const t of summary.targets) {
        console.log(`${t.name}:`);
        console.log(`  llm-slop-patterns : ${t.llmSlop.findings} hits across ${t.llmSlop.scanned} files`);
        console.log(`  token-bleed-patterns: ${t.tokenBleed.findings} hits across ${t.tokenBleed.scanned} files`);
        if (t.llmSlop.findings > 0) {
            const byPattern = {};
            for (const issue of t.llmSlop.issues) { byPattern[issue.pattern] = (byPattern[issue.pattern] || 0) + 1; }
            console.log(`  llm-slop by pattern: ${JSON.stringify(byPattern)}`);
        }
        if (t.tokenBleed.findings > 0) {
            const byPattern = {};
            for (const issue of t.tokenBleed.issues) { byPattern[issue.pattern] = (byPattern[issue.pattern] || 0) + 1; }
            console.log(`  token-bleed by pattern: ${JSON.stringify(byPattern)}`);
        }
    }
}

main().catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
});
