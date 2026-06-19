/**
 * Canonical file locations — key paths that should remain stable across scans.
 *
 * Roadmap JSON baselines — intentionally separate page samples;
 * must not be flagged as merge/fuzzy duplicate candidates.
 *
 * @license MIT
 *
 * Config:
 *   .simplebeacon/config.json          — Gate scan config
 *   .simplebeacon/config-full-coverage.json — Full-tree scan config
 *   .env / .env.production / .env.v1-internal — Environment profiles
 *
 * Scan artifacts:
 *   .simplebeacon/report.json           — Latest gate scan result
 *   .simplebeacon/eu-ai-act-report.json — EU AI Act sprint artifacts
 *   .simplebeacon/eu-ai-act-assessment.json
 *   .simplebeacon/eu-ai-act-compliance.json
 *   .simplebeacon/consolidation-report.json
 *   .simplebeacon/file-reduction.json
 *
 * Sample data:
 *   web/data/                           — Dashboard page sample JSON
 *   data/roadmap/                        — Roadmap baseline JSON
 */

const DISTINCT_CANONICAL_ROADMAP_FILES = new Set([
    'data/roadmap/ai-roadmap-report.json'
]);

/**
 * Normalize relative path.
 * @param {string} relativePath
 * @returns {any}
 */
function normalizeRelativePath(relativePath) {
    const rel = String(relativePath || '').replace(/\\/g, '/');
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    if (idx >= 0) return rel.slice(idx + marker.length);
    return rel;
}

/**
 * Is distinct canonical roadmap pair.
 * @param {string} fileA
 * @param {string} fileB
 * @returns {any}
 */
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
