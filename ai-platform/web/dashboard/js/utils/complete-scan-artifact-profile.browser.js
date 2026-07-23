/**
 * Browser ESM mirror — keep in sync with
 * packages/simplebeacon-cli/src/lib/complete-scan-artifact-profile.js (CJS).
 */

/**
 * Is benchmark cache path.
 * @param {string} filePath
 * @returns {any}
 */
function isBenchmarkCachePath(filePath) {
  const rel = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  return rel.includes('/github-cache/') || rel.startsWith('github-cache/')
    || rel.includes('/java-ai-vulnerable/') || rel.startsWith('java-ai-vulnerable/');
}

/**
 * Filter platform artifact paths.
 * @param {Array} entries
 * @returns {any}
 */
export function filterPlatformArtifactPaths(entries = []) {
  return entries.filter((entry) => !isBenchmarkCachePath(entry.path || entry));
}

/**
 * Partition artifact directory entries.
 * @param {Array} entries
 * @returns {any}
 */
export function partitionArtifactDirectoryEntries(entries = []) {
  const filtered = filterPlatformArtifactPaths(entries);
  const measurable = filtered.filter(
    (entry) => (Number(entry.bytes) || 0) > 0 || (Number(entry.files) || 0) > 0
  );
  const skippedShells = filtered.filter(
    (entry) => (Number(entry.bytes) || 0) === 0 && (Number(entry.files) || 0) === 0
  );
  return { measurable, skippedShells };
}

const REGENERABLE_CATEGORIES = new Set([
  'node_modules',
  'coverage',
  '__pycache__',
  'dist',
  'build'
]);

const REGENERABLE_PATH_SUFFIXES = [
  '/node_modules',
  '/coverage',
  '/__pycache__',
  '/dist',
  '/build'
];

/**
 * Is regenerable directory entry.
 * @param {any} entry
 * @returns {any}
 */
function isRegenerableDirectoryEntry(entry = {}) {
  const category = String(entry.category || '').toLowerCase();
  if (category && REGENERABLE_CATEGORIES.has(category)) return true;
  const normalizedPath = String(entry.path || '').replace(/\\/g, '/').toLowerCase();
  return REGENERABLE_PATH_SUFFIXES.some((suffix) => (
    normalizedPath.endsWith(suffix) || normalizedPath.includes(`${suffix}/`)
  ));
}

/**
 * Classify regenerable artifacts.
 * @param {Array} analysis
 * @returns {any}
 */
export function classifyRegenerableArtifacts(analysis = {}) {
  const fr = analysis.fileReduction || {};
  const safeBytes = Number(fr.safeToDeleteBytes) || 0;
  const reviewBytes = Number(fr.reviewBeforeDeleteBytes) || 0;
  const unusedCandidates = Number(fr.unusedFileCandidates) || 0;
  const dupBytes = Number(fr.duplicateAssetBytes) || Number(fr.immediateSavingsBytes) || 0;
  const topDirs = filterPlatformArtifactPaths(fr.topSafeDirectories || []);
  const priorityN = (analysis.priorityActions || []).length;

  if (reviewBytes > 0 || unusedCandidates > 0 || dupBytes > 0 || priorityN > 0) {
    if (safeBytes <= 0 && topDirs.length === 0) {
      return 'mixed-no-safe-delete';
    }
    return 'mixed';
  }

  if (safeBytes <= 0 && topDirs.length === 0) {
    return 'empty';
  }

  if (topDirs.length > 0 && topDirs.every(isRegenerableDirectoryEntry)) {
    return 'regenerableOnly';
  }

  return 'mixed';
}

/**
 * Soften priority actions.
 * @param {Array} actions
 * @param {string} artifactProfile
 * @returns {any}
 */
export function softenPriorityActions(actions = [], artifactProfile = 'mixed') {
  if (artifactProfile !== 'regenerableOnly') return actions;
  return actions.map((action) => {
    const title = String(action?.title || '');
    if (!/reclaim build artifact space/i.test(title)) return action;
    return {
      ...action,
      title: 'Optional disk hygiene',
      detail: 'Regenerable artifacts only (for example node_modules). Delete when you need space, then run npm install to restore.'
    };
  });
}

export { isRegenerableDirectoryEntry, isBenchmarkCachePath };
