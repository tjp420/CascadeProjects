#!/usr/bin/env node
/**
 * Build an auditable map/count report for explicitly rejected fiction patterns.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const scanRoots = ['web/data', 'data/roadmap', 'src/data', 'data/mock', 'data-central/ai-tools/mock-data'];

const targetValues = {
    completionRate: ['74.17', '87', '94.3', '66', '62'],
    totalFeatures: ['47', '100', '156', '8', '9'],
    aiConfidence: ['98.5', '94.3']
};

const completionKeys = new Set(['completionRate', 'previousCompletionRate', 'currentCompletion', 'resolvedPct']);
const featureKeys = new Set(['totalFeatures', 'previousTotalFeatures', 'featuresTracked', 'aiOptimizationsApplied']);
const aiKeys = new Set(['aiConfidence', 'previousConfidence', 'confidence']);

function normalizeValue(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str.endsWith('%') ? str.slice(0, -1) : str;
}

function walkJsonFiles(relDir, results) {
    const absDir = path.join(ROOT, relDir);
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        const absPath = path.join(absDir, entry.name);
        const relPath = path.relative(ROOT, absPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            walkJsonFiles(relPath, results);
        } else if (entry.isFile() && relPath.endsWith('.json')) {
            results.push(relPath);
        }
    }
}

function visitNode(node, filePath, state) {
    if (Array.isArray(node)) {
        for (const item of node) visitNode(item, filePath, state);
        return;
    }
    if (!node || typeof node !== 'object') return;

    for (const [key, value] of Object.entries(node)) {
        let group = null;
        if (completionKeys.has(key)) group = 'completionRate';
        if (featureKeys.has(key)) group = 'totalFeatures';
        if (aiKeys.has(key)) group = 'aiConfidence';

        if (group) {
            const normalized = normalizeValue(value);
            if (normalized && targetValues[group].includes(normalized)) {
                const patternId = `${group}:${normalized}`;
                state.byPattern[patternId] = (state.byPattern[patternId] || 0) + 1;
                if (!state.byFile[filePath]) state.byFile[filePath] = [];
                state.byFile[filePath].push({
                    field: key,
                    value,
                    pattern: patternId
                });
            }
        }

        visitNode(value, filePath, state);
    }
}

function main() {
    const args = process.argv.slice(2);
    const outArgIndex = args.indexOf('--out');
    const outPath = outArgIndex >= 0 && args[outArgIndex + 1]
        ? args[outArgIndex + 1]
        : '.simplebeacon/fiction-pattern-remediation-map.json';

    const files = [];
    for (const relRoot of scanRoots) walkJsonFiles(relRoot, files);

    const state = { byPattern: {}, byFile: {} };
    for (const [group, values] of Object.entries(targetValues)) {
        for (const value of values) state.byPattern[`${group}:${value}`] = 0;
    }

    for (const relFile of files) {
        try {
            const payload = JSON.parse(fs.readFileSync(path.join(ROOT, relFile), 'utf8'));
            visitNode(payload, relFile, state);
        } catch {
            // Keep scanner resilient on malformed files.
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        scanRoots,
        scannedJsonFiles: files.length,
        byPattern: state.byPattern,
        byFile: Object.fromEntries(Object.entries(state.byFile).sort((a, b) => a[0].localeCompare(b[0])))
    };

    const absOut = path.join(ROOT, outPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`[fiction-pattern-remediation-map] wrote ${outPath}`);
}

main();
