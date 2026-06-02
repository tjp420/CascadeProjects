/**
 * Merge plan preview — simulation only until explicit confirmation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashFileContent } = require('./mock-data-schema-validator.cjs');
const { readJsonIfExists } = require('./repository-health-payload.cjs');

const PREVIEW_TTL_MS = 60 * 60 * 1000;
const CONFIRMATION_PHRASE = 'QUARANTINE_DUPLICATES';

function resolveProjectFile(projectRoot, relativePath) {
    const root = path.resolve(projectRoot);
    const abs = path.resolve(root, String(relativePath || '').replace(/\\/g, '/'));
    if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) {
        throw new Error(`Path escapes project root: ${relativePath}`);
    }
    return abs;
}

function pickCanonicalFile(files, keepFile) {
    if (keepFile) {
        return files.find((file) => file.path === keepFile || file.name === keepFile) || files[0];
    }
    return [...files].sort((a, b) => String(a.path || '').length - String(b.path || '').length)[0];
}

async function readFileSnapshot(absPath) {
    if (!fs.existsSync(absPath)) {
        return { exists: false, absPath };
    }
    const stat = await fs.promises.stat(absPath);
    const raw = await fs.promises.readFile(absPath, 'utf8');
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = null;
    }
    return {
        exists: true,
        absPath,
        sizeBytes: stat.size,
        contentHash: hashFileContent(raw),
        validJson: parsed !== null,
        preview: raw.length > 1200 ? `${raw.slice(0, 1200)}\n…` : raw
    };
}

function previewDir(projectRoot) {
    return path.join(path.resolve(projectRoot), '.simplebeacon', 'merge-previews');
}

function savePreview(projectRoot, preview) {
    const dir = previewDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${preview.previewId}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
    return filePath;
}

function loadPreview(projectRoot, previewId) {
    const filePath = path.join(previewDir(projectRoot), `${previewId}.json`);
    const preview = readJsonIfExists(filePath);
    if (!preview) return null;
    if (Date.now() - Date.parse(preview.generatedAt || 0) > PREVIEW_TTL_MS) {
        return { ...preview, expired: true };
    }
    return preview;
}

function assessMergeRisk(candidate, snapshots, conflicts) {
    const factors = [];
    let level = candidate?.risk || 'medium';

    if (conflicts.length) {
        level = 'high';
        factors.push(`${conflicts.length} conflict(s) detected`);
    }
    if (candidate?.mergeType === 'exact-duplicate') {
        level = conflicts.length ? 'high' : 'low';
        factors.push('Byte-identical duplicate group');
    } else if (candidate?.mergeType === 'fuzzy-near-duplicate') {
        level = (candidate.similarity || 0) >= 0.95 ? 'medium' : 'medium-high';
        factors.push(`Fuzzy similarity ${Math.round((candidate.similarity || 0) * 100)}% — not byte-identical`);
    } else if (candidate?.mergeType === 'structure-based') {
        level = 'medium';
        factors.push('Shared JSON schema — content may differ');
    }

    const missingCount = snapshots.filter((snap) => !snap.exists).length;
    if (missingCount) {
        level = 'high';
        factors.push(`${missingCount} file(s) missing on disk`);
    }

    const invalidJson = snapshots.filter((snap) => snap.exists && snap.validJson === false).length;
    if (invalidJson) {
        level = level === 'high' ? 'high' : 'medium-high';
        factors.push(`${invalidJson} invalid JSON file(s)`);
    }

    return {
        level,
        autoMergeAllowed: false,
        requiresConfirmation: true,
        factors,
        quarantineOnly: true
    };
}

async function buildMergePreview(options = {}) {
    const projectRoot = path.resolve(options.projectRoot);
    const candidate = options.candidate;
    const strategy = options.strategy || candidate?.mergeStrategy || 'keep-one-delete-others';
    const files = candidate?.files || options.files || [];

    if (!files.length) {
        throw new Error('merge candidate must include at least one file');
    }

    const conflicts = [];
    const snapshots = [];
    for (const file of files) {
        try {
            const absPath = resolveProjectFile(projectRoot, file.path || file.name);
            snapshots.push({ ...file, ...(await readFileSnapshot(absPath)) });
        } catch (error) {
            conflicts.push({ file: file.path || file.name, reason: error.message });
        }
    }

    const missing = snapshots.filter((snap) => !snap.exists);
    missing.forEach((snap) => {
        conflicts.push({ file: snap.path || snap.name, reason: 'File not found' });
    });

    const canonical = pickCanonicalFile(files, options.keepFile);
    const redundant = files.filter((file) => file.path !== canonical.path && file.name !== canonical.name);

    if (candidate?.mergeType === 'exact-duplicate' && snapshots.length > 1) {
        const hashes = new Set(snapshots.filter((s) => s.exists).map((s) => s.contentHash));
        if (hashes.size > 1) {
            conflicts.push({ reason: 'Files are not byte-identical — exact-duplicate merge blocked' });
        }
        const invalid = snapshots.filter((s) => s.exists && !s.validJson);
        invalid.forEach((snap) => {
            conflicts.push({ file: snap.path || snap.name, reason: 'Invalid JSON' });
        });
    }

    const previewId = crypto.randomUUID();
    const riskAssessment = assessMergeRisk(candidate, snapshots, conflicts);
    const preview = {
        type: 'simplebeacon-merge-preview',
        previewId,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
        projectRoot,
        strategy,
        mergeType: candidate?.mergeType || 'manual',
        candidateId: candidate?.id || null,
        keepFile: canonical.path || canonical.name,
        removeFiles: redundant.map((file) => file.path || file.name),
        affectedFiles: files.map((file) => file.path || file.name),
        conflicts,
        safeToExecute: conflicts.length === 0 && redundant.length > 0 && riskAssessment.level !== 'high',
        requiresConfirmation: true,
        riskAssessment,
        confirmationPhrase: CONFIRMATION_PHRASE,
        gracePeriodHours: 24,
        executionMode: 'quarantine-not-delete',
        rollbackPlan: {
            method: 'restore-from-quarantine-or-backup',
            backupDir: '.simplebeacon/merge-backups',
            quarantineDir: '.simplebeacon/merge-quarantine',
            instructions: [
                'Duplicates are moved to merge-quarantine — not permanently deleted.',
                'Backups are written before any move.',
                `Grace window: 24 hours before manual purge (no auto-delete in v1).`
            ]
        },
        savingsBytes: candidate?.savingsBytes ?? redundant.reduce((sum, file) => sum + (file.sizeBytes || 0), 0),
        snapshots: snapshots.map((snap) => ({
            path: snap.path || snap.name,
            exists: snap.exists,
            validJson: snap.validJson,
            sizeBytes: snap.sizeBytes,
            preview: snap.preview
        }))
    };

    savePreview(projectRoot, preview);
    return preview;
}

module.exports = {
    buildMergePreview,
    loadPreview,
    savePreview,
    resolveProjectFile,
    assessMergeRisk,
    CONFIRMATION_PHRASE,
    PREVIEW_TTL_MS
};
