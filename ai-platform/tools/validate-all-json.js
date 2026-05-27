#!/usr/bin/env node
/**
 * Validate JSON syntax across ai-platform repository.
 * Writes summary output to .simplebeacon/json-validation.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.simplebeacon');
const OUT_FILE = path.join(OUT_DIR, 'json-validation.json');

const SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'coverage',
    'htmlcov',
    'dist',
    'build',
    '.next'
]);

function walk(dir, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(full, acc);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.json')) {
            acc.push({ full, rel });
        }
    }
    return acc;
}

function main() {
    const files = walk(ROOT);
    const invalid = [];

    for (const file of files) {
        try {
            JSON.parse(fs.readFileSync(file.full, 'utf8'));
        } catch (error) {
            invalid.push({
                file: file.rel,
                message: error.message
            });
        }
    }

    const result = {
        generatedAt: new Date().toISOString(),
        totalJsonFiles: files.length,
        invalidCount: invalid.length,
        validCount: files.length - invalid.length,
        invalid
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    console.log(`JSON files checked: ${result.totalJsonFiles}`);
    console.log(`Invalid JSON files: ${result.invalidCount}`);
    console.log(`Report: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);

    if (invalid.length > 0) {
        process.exit(1);
    }
}

main();
