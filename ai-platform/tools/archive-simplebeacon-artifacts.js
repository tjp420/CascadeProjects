#!/usr/bin/env node
/**
 * Archive oversized .simplebeacon artifacts (move, don't delete).
 * Usage: node tools/archive-simplebeacon-artifacts.js [--trim-quality=1000]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIMPLEBEACON = path.join(ROOT, '.simplebeacon');
const ARCHIVE_ROOT = path.join(SIMPLEBEACON, 'archive');
const TRIM_LINES = Number(process.argv.find((a) => a.startsWith('--trim-quality='))?.split('=')[1]) || 1000;

const ARCHIVE_DIRS = {
    jestResults: path.join(ARCHIVE_ROOT, 'jest-results'),
    qualityChecks: path.join(ARCHIVE_ROOT, 'quality-checks'),
    coverageReports: path.join(ARCHIVE_ROOT, 'coverage-reports'),
    largeSourceFiles: path.join(ARCHIVE_ROOT, 'large-source-files')
};

const JEST_RESULT_FILES = [
    'jest-results.json',
    'jest-results.after-fix.json',
    'jest-results.baseline-cmd.json',
    'jest-results.flaky-check.json',
    'jest-results.final-pass.json'
];

const QUALITY_CHECK_FILES = [
    'launch-quality-check.current.txt',
    'launch-remaining-quality-check.txt'
];

const COVERAGE_HTML_GLOB = /^z_.*_analysis_py\.html$/i;

function ensureDirs() {
    for (const dir of Object.values(ARCHIVE_DIRS)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function moveToArchive(sourceRelative, archiveDir, manifest) {
    const source = path.join(SIMPLEBEACON, sourceRelative);
    if (!fs.existsSync(source)) return false;
    const stat = fs.statSync(source);
    const target = path.join(archiveDir, path.basename(sourceRelative));
    if (fs.existsSync(target)) {
        const stamped = `${path.basename(sourceRelative, path.extname(sourceRelative))}.${Date.now()}${path.extname(sourceRelative)}`;
        fs.renameSync(source, path.join(archiveDir, stamped));
        manifest.push({ action: 'archived-stamped', from: sourceRelative, to: path.join(path.relative(ROOT, archiveDir), stamped).replace(/\\/g, '/'), bytes: stat.size });
    } else {
        fs.renameSync(source, target);
        manifest.push({ action: 'archived', from: sourceRelative, to: path.join(path.relative(ROOT, target)).replace(/\\/g, '/'), bytes: stat.size });
    }
    return true;
}

function trimQualityCheck(relativeName, manifest) {
    const filePath = path.join(SIMPLEBEACON, relativeName);
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    if (lines.length <= TRIM_LINES) return;
    const trimmed = [
        `# Trimmed to last ${TRIM_LINES} lines — full copy in .simplebeacon/archive/quality-checks/`,
        `# Original line count: ${lines.length}`,
        `# Trimmed at: ${new Date().toISOString()}`,
        ...lines.slice(-TRIM_LINES)
    ].join('\n');
    fs.writeFileSync(filePath, `${trimmed}\n`, 'utf8');
    manifest.push({ action: 'trimmed', file: relativeName, keptLines: TRIM_LINES, originalLines: lines.length });
}

function archiveCoverageHtml(manifest) {
    const searchRoots = [
        path.join(ROOT, 'coverage'),
        path.join(ROOT, 'htmlcov'),
        SIMPLEBEACON
    ];
    for (const dir of searchRoots) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir)) {
            if (!COVERAGE_HTML_GLOB.test(entry)) continue;
            const source = path.join(dir, entry);
            const target = path.join(ARCHIVE_DIRS.coverageReports, entry);
            if (fs.existsSync(target)) continue;
            const stat = fs.statSync(source);
            fs.renameSync(source, target);
            manifest.push({
                action: 'archived-coverage',
                from: path.relative(ROOT, source).replace(/\\/g, '/'),
                to: path.relative(ROOT, target).replace(/\\/g, '/'),
                bytes: stat.size
            });
        }
    }
}

function writeManifest(manifest) {
    const manifestPath = path.join(ARCHIVE_ROOT, 'archive-manifest.json');
    const payload = {
        archivedAt: new Date().toISOString(),
        trimQualityLines: TRIM_LINES,
        entries: manifest,
        bytesArchived: manifest.filter((e) => e.bytes).reduce((sum, e) => sum + e.bytes, 0)
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return manifestPath;
}

function main() {
    ensureDirs();
    const manifest = [];

    for (const name of JEST_RESULT_FILES) {
        moveToArchive(name, ARCHIVE_DIRS.jestResults, manifest);
    }

    for (const name of QUALITY_CHECK_FILES) {
        if (moveToArchive(name, ARCHIVE_DIRS.qualityChecks, manifest)) {
            const restored = path.join(ARCHIVE_DIRS.qualityChecks, name);
            if (fs.existsSync(restored)) {
                fs.copyFileSync(restored, path.join(SIMPLEBEACON, name));
                trimQualityCheck(name, manifest);
            }
        }
    }

    archiveCoverageHtml(manifest);

    const manifestPath = writeManifest(manifest);
    console.log(`Archive complete: ${manifest.length} actions`);
    console.log(`Manifest: ${path.relative(ROOT, manifestPath).replace(/\\/g, '/')}`);
    console.log(`Bytes archived: ${manifest.filter((e) => e.bytes).reduce((sum, e) => sum + e.bytes, 0)}`);
}

main();
