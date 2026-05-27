#!/usr/bin/env node
/**
 * Archive vendored dependency docs, legacy roadmap data, duplicate report snapshots,
 * and numbered doc fragments from pattern-consolidation scan.
 * Moves files — does not delete. Writes manifest to docs/archive/data-cleanup-manifest.json
 *
 * Usage: node tools/archive-data-cleanup.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const ARCHIVE_ROOT = path.join(ROOT, 'docs', 'archive');
const DEPENDENCY_DOCS = path.join(ARCHIVE_ROOT, 'dependency-docs');
const ROADMAP_LEGACY = path.join(ARCHIVE_ROOT, 'roadmap-legacy');
const ROADMAP_REPORT_SNAPSHOTS = path.join(ARCHIVE_ROOT, 'roadmap-report-snapshots');
const NUMBERED_DOCS = path.join(ARCHIVE_ROOT, 'numbered-docs');
const SESSION_DOCS = path.join(ARCHIVE_ROOT, 'session-docs');
const EXPORT_SNAPSHOTS = path.join(ARCHIVE_ROOT, 'export-snapshots');
const BACKUP_SNAPSHOTS = path.join(ARCHIVE_ROOT, 'backup-snapshots');

/** Numbered / session doc fragments flagged by pattern-consolidation scan */
const PATTERN_DOC_RULES = [
    { test: /^(HISTORY|History)_\d+\.md$/i, dest: NUMBERED_DOCS, label: 'numbered-history-doc' },
    { test: /^(HISTORY|History)_1_/i, dest: NUMBERED_DOCS, label: 'compound-history-doc' },
    { test: /^[Cc]hangelog_\d+\.md$/, dest: NUMBERED_DOCS, label: 'numbered-changelog-doc' },
    { test: /^ULTIMATE_AI_OS_CLEANUP_SESSION_\d+\.md$/, dest: SESSION_DOCS, label: 'cleanup-session-doc' },
    { test: /^improvement_report_\d{8}_\d+\.md$/, dest: NUMBERED_DOCS, label: 'improvement-report-snapshot' },
    { test: /^dashboard_complete_export_\d{8}_\d+\.json$/, dest: EXPORT_SNAPSHOTS, label: 'dashboard-export-snapshot' },
    { test: /^security_assessment_\d{8}_\d+\.md$/, dest: NUMBERED_DOCS, label: 'analysis-report-snapshot' },
    { test: /^trend_analysis_\d{8}_\d+\.md$/, dest: NUMBERED_DOCS, label: 'analysis-report-snapshot' },
    { test: /^technical_details_\d{8}_\d+\.md$/, dest: NUMBERED_DOCS, label: 'analysis-report-snapshot' },
    { test: /^executive_summary_\d{8}_\d+\.md$/, dest: NUMBERED_DOCS, label: 'analysis-report-snapshot' },
    { test: /^top_level(_\d+)?\.txt$/, dest: DEPENDENCY_DOCS, label: 'vendored-top-level-txt' },
    { test: /^post_optimization_backup_\d{8}_\d+\.txt$/, dest: BACKUP_SNAPSHOTS, label: 'post-optimization-backup-snapshot' }
];

const ROADMAP_REPORTS_DIR = path.join(ROOT, 'docs', 'roadmap-reports');
const ROADMAP_REPORT_KEEP = new Set([
    'ai-powered-roadmap-report-2026-05-22-000306.json',
    'gguf-roadmap-report-2026-05-21.json',
    'roadmap-archive-index.json'
]);

const VENDored_DOC = /^(README|readme|Readme)_(\d+|[\d_]+)\.md$|^(CHANGELOG|CHANGES)_(\d+|[\d_]+)\.md$|^LICENSE_(\d+|[\d_]+)\.(md|txt)$/;

function ensureDir(dir) {
    if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
}

function moveFile(from, toDir, manifest, label) {
    if (!fs.existsSync(from)) return;
    ensureDir(toDir);
    const base = path.basename(from);
    const to = path.join(toDir, base);
    const stat = fs.statSync(from);
    if (DRY_RUN) {
        manifest.push({ action: 'would-archive', label, from: rel(from), to: rel(to), bytes: stat.size });
        return;
    }
    if (fs.existsSync(to)) {
        const stamped = `${path.parse(base).name}.${Date.now()}${path.extname(base)}`;
        fs.renameSync(from, path.join(toDir, stamped));
        manifest.push({ action: 'archived-stamped', label, from: rel(from), to: rel(path.join(toDir, stamped)), bytes: stat.size });
    } else {
        fs.renameSync(from, to);
        manifest.push({ action: 'archived', label, from: rel(from), to: rel(to), bytes: stat.size });
    }
}

function rel(p) {
    return path.relative(ROOT, p).replace(/\\/g, '/');
}

function archiveVendoredDocs(manifest) {
    const docsDir = path.join(ROOT, 'docs');
    for (const name of fs.readdirSync(docsDir)) {
        if (!VENDored_DOC.test(name)) continue;
        moveFile(path.join(docsDir, name), DEPENDENCY_DOCS, manifest, 'vendored-dependency-doc');
    }
}

function archiveRoadmapLegacy(manifest) {
    const legacyDir = path.join(ROOT, 'data', 'roadmap', 'archive');
    if (!fs.existsSync(legacyDir)) return;
    for (const name of fs.readdirSync(legacyDir)) {
        moveFile(path.join(legacyDir, name), ROADMAP_LEGACY, manifest, 'roadmap-legacy-data');
    }
}

function archiveRoadmapReportSnapshots(manifest) {
    if (!fs.existsSync(ROADMAP_REPORTS_DIR)) return;
    for (const name of fs.readdirSync(ROADMAP_REPORTS_DIR)) {
        if (!name.endsWith('.json')) continue;
        if (ROADMAP_REPORT_KEEP.has(name)) continue;
        moveFile(path.join(ROADMAP_REPORTS_DIR, name), ROADMAP_REPORT_SNAPSHOTS, manifest, 'roadmap-report-snapshot');
    }
}

function archivePatternDocs(manifest) {
    const docsDir = path.join(ROOT, 'docs');
    for (const name of fs.readdirSync(docsDir)) {
        const filePath = path.join(docsDir, name);
        if (!fs.statSync(filePath).isFile()) continue;
        const rule = PATTERN_DOC_RULES.find((r) => r.test.test(name));
        if (!rule) continue;
        moveFile(filePath, rule.dest, manifest, rule.label);
    }
}

function inventoryArchivedFiles() {
    const entries = [];
    const archiveDirs = [
        { dir: DEPENDENCY_DOCS, label: 'vendored-dependency-doc' },
        { dir: ROADMAP_LEGACY, label: 'roadmap-legacy-data' },
        { dir: ROADMAP_REPORT_SNAPSHOTS, label: 'roadmap-report-snapshot' },
        { dir: NUMBERED_DOCS, label: 'numbered-doc' },
        { dir: SESSION_DOCS, label: 'session-doc' },
        { dir: EXPORT_SNAPSHOTS, label: 'export-snapshot' },
        { dir: BACKUP_SNAPSHOTS, label: 'backup-snapshot' }
    ];

    for (const { dir, label } of archiveDirs) {
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            const filePath = path.join(dir, name);
            if (!fs.statSync(filePath).isFile()) continue;
            entries.push({
                action: 'archived',
                label,
                from: null,
                to: rel(filePath),
                bytes: fs.statSync(filePath).size
            });
        }
    }

    return entries;
}

function mergeManifestEntries(existingEntries, newEntries) {
    const seen = new Set((existingEntries || []).map((e) => e.to));
    const merged = [...(existingEntries || [])];
    for (const entry of newEntries) {
        if (seen.has(entry.to)) continue;
        seen.add(entry.to);
        merged.push(entry);
    }
    return merged;
}

function writeManifest(manifest) {
    const manifestPath = path.join(ARCHIVE_ROOT, 'data-cleanup-manifest.json');
    let entries = manifest;

    if (!DRY_RUN && entries.length === 0) {
        const onDisk = inventoryArchivedFiles();
        if (onDisk.length > 0) {
            entries = onDisk;
            console.log(`Rebuilt manifest from ${onDisk.length} archived file(s) on disk`);
        }
    } else if (!DRY_RUN && entries.length > 0 && fs.existsSync(manifestPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            entries = mergeManifestEntries(existing.entries, entries);
        } catch (_) {
            /* keep new entries only */
        }
    }

    const payload = {
        archivedAt: new Date().toISOString(),
        dryRun: DRY_RUN,
        fileCount: entries.length,
        bytesArchived: entries.reduce((sum, e) => sum + (e.bytes || 0), 0),
        entries
    };

    if (!DRY_RUN) {
        ensureDir(ARCHIVE_ROOT);
        fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
    return manifestPath;
}

function main() {
    const manifest = [];
    archiveVendoredDocs(manifest);
    archiveRoadmapLegacy(manifest);
    archiveRoadmapReportSnapshots(manifest);
    archivePatternDocs(manifest);
    const manifestPath = writeManifest(manifest);
    const bytes = manifest.reduce((sum, e) => sum + (e.bytes || 0), 0);
    console.log(`${DRY_RUN ? 'Dry run' : 'Archive'} complete: ${manifest.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    if (!DRY_RUN) console.log(`Manifest: ${rel(manifestPath)}`);
}

main();
