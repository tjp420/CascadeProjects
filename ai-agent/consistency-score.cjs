// simplebeacon-ignore: debugArtifacts
// SPDX-License-Identifier: MIT
/**
 * Consistency Score Module
 * Computes cross-reference, naming, and metadata consistency
 * from a SimpleBeacon scan report.
 */

const fs = require('fs');
const path = require('path');

/**
 * Read and parse a JSON report file.
 */
function loadReport(reportPath) {
    const absPath = path.resolve(reportPath);
    if (!fs.existsSync(absPath)) { // simplebeacon-ignore sync-io — existence check before read
        throw new Error(`Report not found: ${absPath}`);
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Check that every file referenced in issues/rawIssues actually exists.
 */
function computeCrossReferenceConsistency(report, projectRoot) {
    const root = projectRoot || report.projectRoot || process.cwd();
    const issues = report.detectedIssues || report.rawIssues || [];
    let checked = 0;
    let passed = 0;

    for (const issue of issues) {
        const files = issue.affectedFiles || issue.filePaths || (issue.file ? [issue.file] : []);
        for (const file of files) {
            checked++;
            const fullPath = path.isAbsolute(file) ? file : path.resolve(root, file);
            if (fs.existsSync(fullPath)) {
                passed++;
            }
        }
    }

    const score = checked === 0 ? 100 : Math.round((passed / checked) * 100);
    return { checked, passed, score, label: 'cross-reference' };
}

/**
 * Check env key consistency: keys referenced in code but missing from .env.
 */
function computeEnvKeyConsistency(report) {
    const issues = report.rawIssues || report.detectedIssues || [];
    const envIssues = issues.filter(i => i.type === 'missing-env-key');
    const total = envIssues.length;
    // All missing-env-key issues are failures by definition
    const score = total === 0 ? 100 : 0;
    return { checked: total, passed: 0, score, label: 'env-key' };
}

/**
 * Check that report metadata is internally consistent.
 * e.g. totalFiles in summary matches actual filesAnalyzed.
 */
function computeMetadataConsistency(report) {
    const checks = [];

    const summaryFiles = report.summary?.totalFiles ?? null;
    const analyzedFiles = report.filesAnalyzed ?? null;
    if (summaryFiles !== null && analyzedFiles !== null) {
        checks.push({
            name: 'summary-files-vs-analyzed',
            ok: summaryFiles === analyzedFiles,
            expected: analyzedFiles,
            actual: summaryFiles
        });
    }

    const summaryLines = report.summary?.totalLines ?? null;
    const codebaseLines = report.codebase?.totalLines ?? null;
    if (summaryLines !== null && codebaseLines !== null) {
        checks.push({
            name: 'summary-lines-vs-codebase',
            ok: summaryLines === codebaseLines,
            expected: codebaseLines,
            actual: summaryLines
        });
    }

    const totalFiles = report.totalFiles ?? null;
    if (totalFiles !== null && analyzedFiles !== null) {
        checks.push({
            name: 'root-totalFiles-vs-analyzed',
            ok: totalFiles === analyzedFiles,
            expected: analyzedFiles,
            actual: totalFiles
        });
    }

    const passed = checks.filter(c => c.ok).length;
    const score = checks.length === 0 ? 100 : Math.round((passed / checks.length) * 100);
    return { checked: checks.length, passed, score, label: 'metadata', details: checks };
}

/**
 * Compute naming consistency based on file extensions and conventions.
 */
function computeNamingConsistency(report, projectRoot) {
    const root = projectRoot || report.projectRoot || process.cwd();
    const sampleFiles = report.sampleFiles || []; // simplebeacon-ignore production-leak — reads sampleFiles from report object, not a mock path
    let checked = 0;
    let passed = 0;

    // Simple heuristic: mixed extensions in same dir are a smell.
    const dirMap = new Map();
    for (const file of sampleFiles) {
        const dir = path.dirname(file);
        const ext = path.extname(file);
        if (!dirMap.has(dir)) dirMap.set(dir, new Set());
        dirMap.get(dir).add(ext);
    }

    for (const [dir, exts] of dirMap) {
        checked++;
        // Allow up to 2 distinct extensions per directory
        if (exts.size <= 2) passed++;
    }

    const score = checked === 0 ? 100 : Math.round((passed / checked) * 100);
    return { checked, passed, score, label: 'naming' };
}

/**
 * Aggregate all consistency dimensions into a single score.
 */
function computeConsistencyScore(report, projectRoot) {
    const dimensions = [
        computeCrossReferenceConsistency(report, projectRoot),
        computeEnvKeyConsistency(report),
        computeMetadataConsistency(report),
        computeNamingConsistency(report, projectRoot)
    ];

    const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
    const overallScore = Math.round(totalScore / dimensions.length);

    return {
        moduleId: 'mod-consistency-score',
        moduleLabel: 'Consistency Score',
        overallScore,
        totalFiles: report.totalFiles ?? report.filesAnalyzed ?? 0,
        totalLines: report.codebase?.totalLines ?? report.summary?.totalLines ?? 0,
        dimensions,
        generatedAt: new Date().toISOString()
    };
}

/**
 * CLI entry point.
 */
function main() {
    const reportPath = process.argv[2];
    if (!reportPath) {
        console.error('Usage: node consistency-score.cjs <path-to-report.json>'); // simplebeacon-ignore debug-artifact — CLI usage message
        process.exit(1);
    }

    const report = loadReport(reportPath);
    const result = computeConsistencyScore(report);

    console.log(JSON.stringify(result, null, 2)); // simplebeacon-ignore debug-artifact — CLI output
}

if (require.main === module) {
    main();
}

module.exports = {
    loadReport,
    computeCrossReferenceConsistency,
    computeEnvKeyConsistency,
    computeMetadataConsistency,
    computeNamingConsistency,
    computeConsistencyScore
};
