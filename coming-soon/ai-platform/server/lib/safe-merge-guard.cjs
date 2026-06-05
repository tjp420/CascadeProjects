/**
 * Safe merge execution — confirmation required; quarantine instead of delete.
 */

const fs = require('fs');
const path = require('path');
const { loadPreview, CONFIRMATION_PHRASE, resolveProjectFile } = require('./merge-preview.cjs');

function mergeAuditPath(projectRoot) {
    return path.join(path.resolve(projectRoot), '.simplebeacon', 'merge-audit.jsonl');
}

function backupDir(projectRoot, previewId) {
    return path.join(path.resolve(projectRoot), '.simplebeacon', 'merge-backups', previewId);
}

function quarantineDir(projectRoot, previewId) {
    return path.join(path.resolve(projectRoot), '.simplebeacon', 'merge-quarantine', previewId);
}

function assertConfirmation(options = {}) {
    if (options.confirmed !== true) {
        throw new Error('Confirmation required — set confirmed: true after reviewing preview');
    }
    if (String(options.confirmationPhrase || '') !== CONFIRMATION_PHRASE) {
        throw new Error(`Invalid confirmation phrase — expected "${CONFIRMATION_PHRASE}"`);
    }
}

async function appendMergeAudit(projectRoot, entry) {
    const filePath = mergeAuditPath(projectRoot);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function createBackup(absPath, backupRoot) {
    await fs.promises.mkdir(backupRoot, { recursive: true });
    const baseName = path.basename(absPath);
    const backupPath = path.join(backupRoot, baseName);
    await fs.promises.copyFile(absPath, backupPath);
    return backupPath;
}

async function quarantineFile(absPath, quarantineRoot) {
    await fs.promises.mkdir(quarantineRoot, { recursive: true });
    const target = path.join(quarantineRoot, path.basename(absPath));
    await fs.promises.rename(absPath, target);
    return target;
}

async function executeSafeMerge(options = {}) {
    const projectRoot = path.resolve(options.projectRoot);
    const previewId = options.previewId;
    if (!previewId) {
        throw new Error('previewId is required');
    }

    const preview = loadPreview(projectRoot, previewId);
    if (!preview) {
        throw new Error('Merge preview not found');
    }
    if (preview.expired) {
        throw new Error('Merge preview expired — generate a new preview');
    }
    if (!preview.safeToExecute) {
        throw new Error('Preview has conflicts — resolve before executing');
    }

    assertConfirmation(options);

    const backups = [];
    const quarantined = [];
    const errors = [];
    const backupRoot = backupDir(projectRoot, previewId);
    const quarantineRoot = quarantineDir(projectRoot, previewId);
    const deleteAfter = new Date(Date.now() + (preview.gracePeriodHours || 24) * 60 * 60 * 1000).toISOString();

    for (const relativePath of preview.removeFiles || []) {
        try {
            const absPath = resolveProjectFile(projectRoot, relativePath);
            if (!fs.existsSync(absPath)) {
                errors.push({ file: relativePath, reason: 'File not found at execution time' });
                continue;
            }
            const backupPath = await createBackup(absPath, backupRoot);
            backups.push({ file: relativePath, backupPath });
            const quarantinePath = await quarantineFile(absPath, quarantineRoot);
            quarantined.push({ file: relativePath, quarantinePath, deleteAfter });
        } catch (error) {
            errors.push({ file: relativePath, reason: error.message });
        }
    }

    const result = {
        type: 'simplebeacon-merge-execution',
        previewId,
        executedAt: new Date().toISOString(),
        projectRoot,
        keepFile: preview.keepFile,
        backups,
        quarantined,
        errors,
        gracePeriodHours: preview.gracePeriodHours || 24,
        deleteAfter,
        rollbackPlan: preview.rollbackPlan,
        auditIssue: {
            type: 'duplicate-resolution',
            status: errors.length ? 'partial' : 'completed',
            priority: 'medium',
            files: preview.affectedFiles
        }
    };

    await appendMergeAudit(projectRoot, result);
    return result;
}

async function rollbackMerge(projectRoot, previewId) {
    const auditPath = mergeAuditPath(projectRoot);
    if (!fs.existsSync(auditPath)) {
        throw new Error('No merge audit log found');
    }
    const lines = (await fs.promises.readFile(auditPath, 'utf8')).trim().split('\n').filter(Boolean);
    const entry = [...lines].reverse().map((line) => JSON.parse(line)).find((row) => row.previewId === previewId);
    if (!entry) {
        throw new Error('Merge execution not found in audit log');
    }

    const restored = [];
    for (const backup of entry.backups || []) {
        const absTarget = resolveProjectFile(projectRoot, backup.file);
        await fs.promises.mkdir(path.dirname(absTarget), { recursive: true });
        await fs.promises.copyFile(backup.backupPath, absTarget);
        restored.push(backup.file);
    }

    await appendMergeAudit(projectRoot, {
        type: 'simplebeacon-merge-rollback',
        previewId,
        rolledBackAt: new Date().toISOString(),
        restored
    });

    return { previewId, restored };
}

module.exports = {
    executeSafeMerge,
    rollbackMerge,
    assertConfirmation,
    CONFIRMATION_PHRASE
};
