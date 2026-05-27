#!/usr/bin/env node
/**
 * Inventory oversized files for safe reduction planning.
 * Default threshold: 250KB.
 * Outputs:
 *  - .simplebeacon/oversized-files-report.json
 *  - .simplebeacon/oversized-files-report.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.simplebeacon');
const OUT_JSON = path.join(OUT_DIR, 'oversized-files-report.json');
const OUT_MD = path.join(OUT_DIR, 'oversized-files-report.md');

const thresholdArg = process.argv.find((arg) => arg.startsWith('--threshold-kb='));
const thresholdKb = thresholdArg ? Number(thresholdArg.split('=')[1]) : 250;
const thresholdBytes = Number.isFinite(thresholdKb) && thresholdKb > 0 ? thresholdKb * 1024 : 250 * 1024;

const SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'coverage',
    'htmlcov',
    '.next',
    'dist',
    'build',
    '.simplebeacon',
    'archive',
    '.venv',
    '__pycache__'
]);

function walk(dir, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(full, acc);
            continue;
        }
        if (!entry.isFile()) continue;
        const stat = fs.statSync(full);
        // Guard against anomalous/sparse size metadata that can skew totals.
        if (!Number.isFinite(stat.size) || stat.size <= 0 || stat.size > 50 * 1024 * 1024) continue;
        if (stat.size <= thresholdBytes) continue;
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        acc.push({
            file: rel,
            sizeBytes: stat.size,
            sizeKB: Number((stat.size / 1024).toFixed(1)),
            sizeMB: Number((stat.size / (1024 * 1024)).toFixed(3))
        });
    }
    return acc;
}

function groupByDir(files) {
    const grouped = {};
    for (const file of files) {
        const dir = path.posix.dirname(file.file);
        grouped[dir] = (grouped[dir] || 0) + 1;
    }
    return Object.fromEntries(
        Object.entries(grouped).sort((a, b) => b[1] - a[1])
    );
}

function estimateSavings(files) {
    // Conservative planning heuristic: 85% recoverable for oversized source/report files.
    const total = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    const recoverable = Math.round(total * 0.85);
    return {
        totalBytes: total,
        totalMB: Number((total / (1024 * 1024)).toFixed(3)),
        estimatedRecoverableBytes: recoverable,
        estimatedRecoverableMB: Number((recoverable / (1024 * 1024)).toFixed(3))
    };
}

function main() {
    const oversized = walk(ROOT).sort((a, b) => b.sizeBytes - a.sizeBytes);
    const byDir = groupByDir(oversized);
    const savings = estimateSavings(oversized);

    const actionable = oversized.filter((f) =>
        !f.file.includes('/.venv/') &&
        !f.file.includes('/__pycache__/')
    );
    const actionableSavings = estimateSavings(actionable);

    const report = {
        generatedAt: new Date().toISOString(),
        thresholdKB: thresholdKb,
        oversizedCount: oversized.length,
        savings,
        actionableOversizedCount: actionable.length,
        actionableSavings,
        byDirectory: byDir,
        files: oversized
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const lines = [];
    lines.push('# Oversized Files Report');
    lines.push('');
    lines.push(`- Generated: ${report.generatedAt}`);
    lines.push(`- Threshold: ${report.thresholdKB}KB`);
    lines.push(`- Oversized files: ${report.oversizedCount}`);
    lines.push(`- Total oversized size: ${report.savings.totalMB}MB`);
    lines.push(`- Estimated recoverable: ${report.savings.estimatedRecoverableMB}MB`);
    lines.push(`- Actionable oversized files: ${report.actionableOversizedCount}`);
    lines.push(`- Actionable recoverable: ${report.actionableSavings.estimatedRecoverableMB}MB`);
    lines.push('');
    lines.push('## Top Files');
    lines.push('');
    for (const file of report.files.slice(0, 25)) {
        lines.push(`- \`${file.file}\` — ${file.sizeKB}KB`);
    }
    lines.push('');
    lines.push('## By Directory');
    lines.push('');
    for (const [dir, count] of Object.entries(report.byDirectory)) {
        lines.push(`- \`${dir}\`: ${count}`);
    }
    lines.push('');

    fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`, 'utf8');

    console.log(`Oversized files: ${report.oversizedCount}`);
    console.log(`Total oversized size: ${report.savings.totalMB}MB`);
    console.log(`Estimated recoverable: ${report.savings.estimatedRecoverableMB}MB`);
    console.log(`Report: ${path.relative(ROOT, OUT_JSON).replace(/\\/g, '/')}`);
}

main();
