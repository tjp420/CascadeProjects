/**
 * Build artifact scanner helpers.
 */

function normalizeRelativePath(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/');
}

function isUnderArtifactRoot(relativePath, artifactRoots = []) {
    const normalized = normalizeRelativePath(relativePath);
    return artifactRoots.some((root) =>
        normalized === root || normalized.startsWith(`${root}/`)
    );
}

function selectTopLevelArtifactDirectories(directories, inventory, patterns) {
    const candidates = [];

    for (const dir of directories) {
        if (patterns.ignorePaths.includes(dir.name)) continue;
        if (!patterns.directories.includes(dir.name)) continue;

        const relativePath = normalizeRelativePath(dir.relativePath);
        const filesInDir = inventory.files.filter((file) => {
            const filePath = normalizeRelativePath(file.relativePath);
            return filePath === relativePath || filePath.startsWith(`${relativePath}/`);
        });
        candidates.push({
            dir,
            relativePath,
            sizeBytes: filesInDir.reduce((sum, file) => sum + file.size, 0),
            fileCount: filesInDir.length
        });
    }

    candidates.sort((left, right) => left.relativePath.length - right.relativePath.length);

    const artifactRoots = [];
    const findings = [];

    for (const candidate of candidates) {
        if (isUnderArtifactRoot(candidate.relativePath, artifactRoots)) continue;
        artifactRoots.push(candidate.relativePath);
        findings.push({
            type: 'build-artifact',
            kind: 'directory',
            path: candidate.relativePath,
            reason: `${candidate.dir.name} directory`,
            sizeBytes: candidate.sizeBytes,
            fileCount: candidate.fileCount,
            confidence: 'high',
            action: 'safe-to-delete',
            severity: 'low',
            category: candidate.dir.name
        });
    }

    return { findings, artifactRoots };
}

module.exports = {
    normalizeRelativePath,
    isUnderArtifactRoot,
    selectTopLevelArtifactDirectories
};
