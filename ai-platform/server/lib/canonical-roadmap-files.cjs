/**
 * Canonical roadmap JSON baselines — intentionally separate page samples;
 * must not be flagged as merge/fuzzy duplicate candidates.
 */

const DISTINCT_CANONICAL_ROADMAP_FILES = new Set([
    'data/roadmap/ai-roadmap-report.json'
]);

function normalizeRelativePath(relativePath) {
    const rel = String(relativePath || '').replace(/\\/g, '/');
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    if (idx >= 0) return rel.slice(idx + marker.length);
    return rel;
}

function isDistinctCanonicalRoadmapPair(fileA, fileB) {
    const relA = normalizeRelativePath(
        typeof fileA === 'string' ? fileA : (fileA.relativePath || fileA.path || fileA)
    );
    const relB = normalizeRelativePath(
        typeof fileB === 'string' ? fileB : (fileB.relativePath || fileB.path || fileB)
    );
    return DISTINCT_CANONICAL_ROADMAP_FILES.has(relA) && DISTINCT_CANONICAL_ROADMAP_FILES.has(relB);
}

module.exports = {
    DISTINCT_CANONICAL_ROADMAP_FILES,
    normalizeRelativePath,
    isDistinctCanonicalRoadmapPair
};
