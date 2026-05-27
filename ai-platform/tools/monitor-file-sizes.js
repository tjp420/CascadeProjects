#!/usr/bin/env node
/**
 * Monitor file sizes against .simplebeacon/config.json thresholds.
 * Usage: node tools/monitor-file-sizes.js [--json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, '.simplebeacon', 'config.json');
const DEFAULT_THRESHOLDS = {
    default: 256000,
    json: 512000,
    js: 256000,
    mjs: 256000,
    cjs: 256000,
    ts: 256000,
    txt: 256000,
    html: 256000,
    css: 256000,
    md: 256000
};

const SKIP_DIRS = new Set([
    '.git', 'node_modules', 'coverage', 'htmlcov', '.venv', '__pycache__',
    'dist', 'build', 'archive', '.simplebeacon/archive'
]);

function loadThresholds() {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return { ...DEFAULT_THRESHOLDS, ...(config.fileSizeThresholds || {}) };
    } catch {
        return DEFAULT_THRESHOLDS;
    }
}

function thresholdFor(ext, thresholds) {
    const key = ext.replace(/^\./, '').toLowerCase();
    return thresholds[key] ?? thresholds.default ?? 256000;
}

function walk(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const rel = path.relative(ROOT, full).replace(/\\/g, '/');
            if (SKIP_DIRS.has(entry.name) || rel.includes('/.simplebeacon/archive/')) continue;
            walk(full, acc);
            continue;
        }
        if (!entry.isFile()) continue;
        const stat = fs.statSync(full);
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        const ext = path.extname(entry.name).toLowerCase();
        const limit = thresholdFor(ext, loadThresholds());
        if (stat.size > limit) {
            acc.push({ file: rel, sizeBytes: stat.size, thresholdBytes: limit, ext: ext || '(none)' });
        }
    }
    return acc;
}

function main() {
    const thresholds = loadThresholds();
    const violations = walk(ROOT).sort((a, b) => b.sizeBytes - a.sizeBytes);
    const payload = {
        generatedAt: new Date().toISOString(),
        thresholds,
        violationCount: violations.length,
        violations: violations.slice(0, 50)
    };

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    console.log(`File size monitor — ${violations.length} files exceed thresholds`);
    for (const row of payload.violations.slice(0, 15)) {
        console.log(`  ${row.file} — ${Math.round(row.sizeBytes / 1024)}KB (limit ${Math.round(row.thresholdBytes / 1024)}KB)`);
    }
}

main();
