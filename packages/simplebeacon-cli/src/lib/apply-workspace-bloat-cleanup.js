/**
 * Apply workspace bloat cleanup (dry-run by default).
 */

const fs = require('fs');
const path = require('path');
const { WorkspaceBloatScanner } = require('../analyzers/file-reduction/workspace-bloat-scanner');

async function listWorkspaceBloatTargets(projectRoot, options = {}) {
    const scanner = new WorkspaceBloatScanner(options.patterns || {});
    const result = await scanner.scan(projectRoot, options);
    const includeReview = options.includeReview === true;
    const targets = result.findings.filter((finding) =>
        finding.action === 'safe-to-delete'
        || (includeReview && finding.action === 'review-before-delete')
    );
    return {
        projectRoot: path.resolve(projectRoot),
        findings: result.findings,
        targets,
        summary: result.summary
    };
}

function deleteDirectorySafe(fullPath) {
    fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
}

async function applyWorkspaceBloatCleanup(projectRoot, options = {}) {
    const dryRun = options.dryRun !== false;
    const includeReview = options.includeReview === true;
    const listed = await listWorkspaceBloatTargets(projectRoot, options);
    const deleted = [];
    const skipped = [];
    const errors = [];

    for (const finding of listed.targets) {
        const fullPath = path.join(listed.projectRoot, finding.path);
        if (finding.action === 'review-before-delete' && !includeReview) {
            skipped.push({ path: finding.path, reason: 'review-before-delete' });
            continue;
        }
        if (dryRun) {
            deleted.push({ path: finding.path, dryRun: true, bytes: finding.sizeBytes || 0 });
            continue;
        }
        try {
            deleteDirectorySafe(fullPath);
            deleted.push({ path: finding.path, dryRun: false, bytes: finding.sizeBytes || 0 });
        } catch (error) {
            errors.push({ path: finding.path, error: error.message || String(error) });
        }
    }

    return {
        dryRun,
        projectRoot: listed.projectRoot,
        summary: listed.summary,
        deleted,
        skipped,
        errors
    };
}

module.exports = {
    listWorkspaceBloatTargets,
    applyWorkspaceBloatCleanup
};
