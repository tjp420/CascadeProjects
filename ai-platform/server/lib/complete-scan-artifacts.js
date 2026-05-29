/**
 * Persist complete-scan exports: full payload archived, slim summary at latest path.
 */

const fs = require('fs');
const path = require('path');

function buildCompleteScanSummary(payload) {
    return {
        type: 'simplebeacon-complete-scan-summary',
        version: payload.version,
        generatedAt: payload.generatedAt,
        projectPath: payload.projectPath,
        scanDurationMs: payload.scanDurationMs,
        errors: payload.errors || [],
        summary: payload.summary,
        archivePath: '.simplebeacon/archive/complete-scan-latest.json',
        note: 'Full step payloads archived — regenerate with tools/generate-complete-scan-export.js if needed.'
    };
}

function writeCompleteScanOutput(outputPath, payload) {
    const normalized = path.normalize(outputPath);
    const base = path.basename(normalized);
    const parentDir = path.basename(path.dirname(normalized));
    const isLatest = base === 'complete-scan-latest.json' && parentDir !== 'archive';

    fs.mkdirSync(path.dirname(normalized), { recursive: true });

    if (!isLatest) {
        fs.writeFileSync(normalized, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        return { outputPath: normalized, archivePath: null, summaryPath: null };
    }

    const archivePath = path.join(path.dirname(normalized), 'archive', 'complete-scan-latest.json');
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.writeFileSync(archivePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const summaryPath = normalized;
    const summary = buildCompleteScanSummary(payload);
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    return { outputPath: summaryPath, archivePath, summaryPath };
}

module.exports = {
    buildCompleteScanSummary,
    writeCompleteScanOutput
};
