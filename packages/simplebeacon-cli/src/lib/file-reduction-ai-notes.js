/**
 * File-reduction AI notes — structured cleanup intelligence for agents.
 * Writes .simplebeacon/file-reduction-ai-notes.md + cleanup-ai-notes.json
 */

const fs = require('fs');
const path = require('path');
const { isStaleFileReductionScan } = require('./normalize-file-reduction-report');
const { buildCleanupAssistantBrief } = require('./cleanup-assistant-brief');
const { formatTrimSuggestionsMarkdown } = require('./trim-suggestions');

const REPORT_JSON = 'file-reduction-report.json';
const NOTES_JSON = 'cleanup-ai-notes.json';
const NOTES_MD = 'file-reduction-ai-notes.md';
const BRIEF_JSON = 'cleanup-brief.json';

function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Fail fast when a file-reduction payload is empty or stale.
 * @param {object} scan
 */
function assertFileReductionScanFresh(scan) {
    if (!scan || typeof scan !== 'object') {
        throw new Error('File reduction scan returned no payload');
    }
    const scope = scan.scanScope || {};
    if (scope.rescanRecommended === true || scope.reportHealth === 'stale-full-tree-scan') {
        const hint = (scope.limitations || []).find(Boolean)
            || 'Re-run file reduction after updating SimpleBeacon (github-cache/ may have polluted inventory).';
        throw new Error(`File reduction scan is stale — ${hint}`);
    }
    if (isStaleFileReductionScan(scan)) {
        throw new Error('File reduction scan used a full-repo walk with benchmark-cache pollution — re-run file reduction.');
    }
    const plan = scan.fileReductionPlan || {};
    const totals = plan.totals || {};
    const hasSignal = totals.safeToDeleteBytes != null
        || (plan.safeToDelete?.topDirectories || []).length > 0
        || scan.scanners?.['build-artifacts']?.safeToDeleteBytes != null
        || (scan.summary?.totalFindings || 0) > 0;
    if (!hasSignal) {
        throw new Error('File reduction scan returned no findings — restart the SimpleBeacon server and retry.');
    }
}

/**
 * Read cached file-reduction report from .simplebeacon/
 * @param {string} projectRoot
 * @returns {object|null}
 */
function readFileReductionReport(projectRoot) {
    const reportPath = path.join(path.resolve(projectRoot), '.simplebeacon', REPORT_JSON);
    try {
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * Read cleanup AI notes JSON from .simplebeacon/
 * @param {string} projectRoot
 * @returns {object|null}
 */
function readCleanupAiNotes(projectRoot) {
    const notesPath = path.join(path.resolve(projectRoot), '.simplebeacon', NOTES_JSON);
    try {
        return JSON.parse(fs.readFileSync(notesPath, 'utf8'));
    } catch {
        return null;
    }
}

function pickTopDirectories(plan, limit = 8) {
    return (plan?.safeToDelete?.topDirectories || []).slice(0, limit).map((entry) => ({
        path: entry.path,
        bytes: entry.bytes || 0,
        bytesLabel: formatBytes(entry.bytes || 0),
        files: entry.files || 0,
        category: entry.category || null
    }));
}

function pickDuplicateGroups(plan, limit = 5) {
    return (plan?.duplicateAssets?.topGroups || []).slice(0, limit).map((group) => ({
        hash: group.hash || null,
        keeper: group.keeper || group.canonicalPath || null,
        duplicateCount: group.duplicates?.length ?? group.duplicateCount ?? 0,
        reclaimableBytes: group.reclaimableBytes || group.bytes || 0,
        reclaimableLabel: formatBytes(group.reclaimableBytes || group.bytes || 0)
    }));
}

/**
 * Build structured AI notes from a data-cleanup / file-reduction report.
 * @param {object} report
 * @param {object} [options]
 * @returns {object}
 */
function buildFileReductionAiNotes(report, options = {}) {
    if (!report || typeof report !== 'object') {
        return null;
    }
    const plan = report.fileReductionPlan || {};
    const trim = report.trimSuggestions || plan.trimSuggestions || null;
    const totals = plan.totals || {};
    const summary = report.summary || {};
    const scope = report.scanScope || {};
    const inventory = report.inventory || {};
    const scanners = report.scanners || {};

    const notes = {
        schemaVersion: '1.0',
        generatedAt: report.generatedAt || new Date().toISOString(),
        projectRoot: options.projectRoot || report.projectRoot || null,
        scanProfile: report.scanProfile || 'file-reduction',
        reportHealth: scope.reportHealth || 'unknown',
        rescanRecommended: scope.rescanRecommended === true,
        limitations: scope.limitations || [],
        inventory: {
            totalFiles: inventory.totalFiles ?? null,
            totalDirectories: inventory.totalDirectories ?? inventory.totalFolders ?? null
        },
        reclaim: {
            safeToDeleteBytes: totals.safeToDeleteBytes ?? scanners['build-artifacts']?.safeToDeleteBytes ?? null,
            safeToDeleteLabel: formatBytes(totals.safeToDeleteBytes ?? scanners['build-artifacts']?.safeToDeleteBytes ?? 0),
            reviewBeforeDeleteBytes: totals.reviewBeforeDeleteBytes ?? scanners['build-artifacts']?.reviewBeforeDeleteBytes ?? null,
            duplicateAssetBytes: totals.duplicateAssetBytes ?? scanners['asset-consolidation']?.reclaimableBytes ?? null,
            unusedFileCandidates: plan.unusedFiles?.candidates ?? summary.unusedFileCandidates ?? scanners['unused-files']?.unusedCandidates ?? null,
            deadExportCandidates: plan.deadCode?.deadExports ?? summary.deadCodeFindings ?? scanners['dead-code']?.deadExports ?? null,
            estimatedReductionPct: summary.estimatedReductionPct ?? null,
            totalFindings: summary.totalFindings ?? null
        },
        safeDirectories: pickTopDirectories(plan),
        duplicateGroups: pickDuplicateGroups(plan),
        scannerSummary: {
            buildArtifacts: {
                safeToDeleteBytes: scanners['build-artifacts']?.safeToDeleteBytes ?? null,
                reviewBeforeDeleteBytes: scanners['build-artifacts']?.reviewBeforeDeleteBytes ?? null
            },
            assetConsolidation: {
                duplicateGroups: scanners['asset-consolidation']?.duplicateGroups ?? summary.duplicateAssetGroups ?? null,
                reclaimableBytes: scanners['asset-consolidation']?.reclaimableBytes ?? null
            },
            unusedFiles: {
                unusedCandidates: scanners['unused-files']?.unusedCandidates ?? summary.unusedFileCandidates ?? null
            },
            deadCode: {
                filesAnalyzed: scanners['dead-code']?.filesAnalyzed ?? null,
                deadExports: scanners['dead-code']?.deadExports ?? plan.deadCode?.deadExports ?? null,
                orphanedExports: scanners['dead-code']?.orphanedExports ?? plan.deadCode?.orphanedExports ?? null
            },
            directoryBloat: {
                findings: summary.directoryBloatFindings ?? null,
                reclaimableBytes: summary.directoryBloatReclaimableBytes ?? null
            }
        },
        agentGuidance: [
            'Dry-run only — confirm each path before deleting.',
            'Execute phase 1 (safe directories) before review or investigate tiers.',
            'Apply code trims (dead exports) only after tests pass on a branch.',
            'Never delete .simplebeacon/, web/data, or production config without explicit approval.',
            'Pair with gate scan (report.json) before claiming repo is clean.'
        ]
    };

    if (trim) {
        notes.trimSuggestions = {
            topActions: (trim.topActions || []).slice(0, 12),
            phases: trim.phases || {},
            agentPrompt: trim.agentPrompt || null
        };
    }

    if (options.includeBrief !== false && (plan.totals || summary.totalFindings)) {
        try {
            const brief = buildCleanupAssistantBrief({
                projectPath: notes.projectRoot || '.',
                fileReduction: report,
                dataQuality: report.executiveSummary ? { executiveSummary: report.executiveSummary } : null,
                repositoryInventory: inventory
            });
            notes.cleanupBrief = {
                type: brief.type,
                version: brief.version,
                estimatedReduction: brief.estimatedReduction,
                projectedInventory: brief.projectedInventory,
                tiers: {
                    safeNow: {
                        directories: (brief.tiers?.safeNow?.directories || []).slice(0, 8),
                        files: brief.tiers?.safeNow?.files ?? 0,
                        bytes: brief.tiers?.safeNow?.bytes ?? 0
                    },
                    reviewFirst: {
                        count: (brief.tiers?.reviewFirst?.items || []).length,
                        bytes: brief.tiers?.reviewFirst?.bytes ?? 0
                    },
                    investigate: {
                        files: brief.tiers?.investigate?.files ?? 0
                    }
                },
                agentPrompt: brief.agentPrompt,
                agentInstructions: (brief.agentInstructions || []).slice(0, 6)
            };
        } catch {
            /* brief is optional enrichment */
        }
    }

    return notes;
}

/**
 * @param {object} notes
 * @returns {string}
 */
function formatFileReductionAiNotesMarkdown(notes) {
    if (!notes || typeof notes !== 'object') {
        return '';
    }
    const r = notes.reclaim || {};
    const lines = [
        '# SimpleBeacon file-reduction AI notes',
        '',
        `- **Updated:** ${notes.generatedAt || '—'}`,
        `- **Profile:** ${notes.scanProfile || 'file-reduction'}`,
        `- **Report health:** ${notes.reportHealth || 'unknown'}`,
        ...(notes.rescanRecommended ? ['- **Rescan recommended:** yes — do not treat totals as authoritative'] : []),
        '',
        '## Reclaim summary',
        '',
        `- **Safe to delete:** ${r.safeToDeleteLabel || formatBytes(r.safeToDeleteBytes || 0)}`,
        `- **Review before delete:** ${formatBytes(r.reviewBeforeDeleteBytes || 0)}`,
        `- **Duplicate assets:** ${formatBytes(r.duplicateAssetBytes || 0)}`,
        `- **Unused file candidates:** ${r.unusedFileCandidates ?? '—'}`,
        `- **Dead export candidates:** ${r.deadExportCandidates ?? '—'}`,
        `- **Inventory:** ${notes.inventory?.totalFiles ?? '—'} files`,
        ''
    ];

    if ((notes.limitations || []).length) {
        lines.push('## Limitations');
        lines.push('');
        for (const line of notes.limitations) lines.push(`- ${line}`);
        lines.push('');
    }

    if ((notes.safeDirectories || []).length) {
        lines.push('## Safe-delete directories (phase 1)');
        lines.push('');
        for (const dir of notes.safeDirectories) {
            lines.push(`- \`${dir.path}\` — ${dir.bytesLabel}, ${dir.files} files${dir.category ? ` (${dir.category})` : ''}`);
        }
        lines.push('');
    }

    if ((notes.duplicateGroups || []).length) {
        lines.push('## Duplicate asset groups');
        lines.push('');
        for (const group of notes.duplicateGroups) {
            lines.push(`- keeper \`${group.keeper || '—'}\` — ${group.duplicateCount} dupes, ${group.reclaimableLabel}`);
        }
        lines.push('');
    }

    if (notes.trimSuggestions?.topActions?.length) {
        lines.push(formatTrimSuggestionsMarkdown({
            ...notes.trimSuggestions,
            analysisNote: 'Prioritized trim actions from static analysis (logs, dupes, dead exports).',
            generatedAt: notes.generatedAt
        }).trim());
        lines.push('');
    }

    if (notes.cleanupBrief?.agentPrompt) {
        lines.push('## Agent prompt');
        lines.push('');
        lines.push(notes.cleanupBrief.agentPrompt);
        lines.push('');
    }

    if ((notes.agentGuidance || []).length) {
        lines.push('## Rules for agents');
        lines.push('');
        for (const rule of notes.agentGuidance) lines.push(`- ${rule}`);
        lines.push('');
    }

    lines.push('Mention `@.simplebeacon/file-reduction-ai-notes.md` or `@.simplebeacon/cleanup-ai-notes.json` in chat.');
    return lines.join('\n');
}

/**
 * Persist file-reduction artifacts for AI assistants.
 * @param {string} projectRoot
 * @param {object} report
 * @param {object} [options]
 * @returns {{ dir: string, reportPath: string, notesPath: string, markdownPath: string, briefPath?: string }|null}
 */
function writeFileReductionArtifacts(projectRoot, report, options = {}) {
    if (!projectRoot || !report || typeof report !== 'object') {
        return null;
    }
    const root = path.resolve(projectRoot);
    const dir = path.join(root, '.simplebeacon');
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch {
        return null;
    }

    const notes = buildFileReductionAiNotes(report, { ...options, projectRoot: root });
    if (!notes) return null;

    const reportPath = path.join(dir, REPORT_JSON);
    const notesPath = path.join(dir, NOTES_JSON);
    const markdownPath = path.join(dir, NOTES_MD);

    const reportPayload = {
        ...report,
        aiNotesGeneratedAt: notes.generatedAt
    };
    fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2), 'utf8');
    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2), 'utf8');
    fs.writeFileSync(markdownPath, formatFileReductionAiNotesMarkdown(notes), 'utf8');

    let briefPath;
    if (notes.cleanupBrief) {
        briefPath = path.join(dir, BRIEF_JSON);
        fs.writeFileSync(briefPath, JSON.stringify({
            ...notes.cleanupBrief,
            generatedAt: notes.generatedAt,
            projectRoot: root
        }, null, 2), 'utf8');
    }

    return { dir, reportPath, notesPath, markdownPath, briefPath };
}

module.exports = {
    REPORT_JSON,
    NOTES_JSON,
    NOTES_MD,
    BRIEF_JSON,
    assertFileReductionScanFresh,
    readFileReductionReport,
    readCleanupAiNotes,
    buildFileReductionAiNotes,
    formatFileReductionAiNotesMarkdown,
    writeFileReductionArtifacts
};
