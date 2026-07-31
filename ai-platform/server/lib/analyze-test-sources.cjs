/**
 * Preset analysis paths for the dashboard Analyze view (quick-path chips).
 */

const fs = require('fs');
const path = require('path');

/**
 * List github cache clones.
 * @param {any} platformRoot
 * @returns {any}
 */
function listGithubCacheClones(platformRoot) {
  const cacheDir = path.join(platformRoot, 'github-cache');
  if (!fs.existsSync(cacheDir)) return [];

  const entries = [];
  for (const entry of fs.readdirSync(cacheDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const clonePath = path.join(cacheDir, entry.name);
    entries.push({
      value: clonePath,
      label: `github-cache / ${entry.name}`,
      kind: 'cached',
      hint: 'OSS benchmark clone — hygiene comparison only',
    });
  }
  return entries.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * List analyze test sources.
 * @param {string} baseDir
 * @param {Array} allowedRoots
 * @returns {any}
 */
function listAnalyzeTestSources(baseDir, allowedRoots = []) {
  const platformRoot = path.resolve(baseDir);
  const sources = [];
  const seen = new Set();

  /**
   * Push source.
   * @param {any} source
   * @returns {any}
   */
  function pushSource(source) {
    const resolved = path.resolve(String(source.value || ''));
    const key = resolved.replace(/\\/g, '/').toLowerCase();
    if (!resolved || seen.has(key)) return;
    if (!fs.existsSync(resolved)) return;
    seen.add(key);
    sources.push({ ...source, value: resolved });
  }

  pushSource({
    value: platformRoot,
    label: `${path.basename(platformRoot)} (product root)`,
    kind: 'local',
    primary: true,
    hint: 'Default complete-scan target',
  });

  for (const clone of listGithubCacheClones(platformRoot)) {
    pushSource(clone);
  }

  for (const root of allowedRoots) {
    const resolved = path.resolve(root);
    if (resolved === platformRoot) continue;
    pushSource({
      value: resolved,
      label: path.basename(resolved) || resolved,
      kind: 'local',
      hint: 'Allowed analysis root',
    });
  }

  return sources;
}

module.exports = {
  listAnalyzeTestSources,
  listGithubCacheClones,
};
