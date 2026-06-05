/**
 * Consolidation export path exclusion helpers.
 */

function normalizeRelativePath(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/');
}

function isEphemeralConsolidationPath(filePath) {
  const rel = normalizeRelativePath(filePath);
  const base = rel.split('/').pop() || '';
  if (/^\.tmp[-.]/i.test(base)) return true;
  if (base === '.tmp-vault-cookies.txt') return true;
  if (base === 'cookies.txt') {
    if (!rel.includes('/')) return true;
    if (/\/\.?tmp/i.test(rel) || /\/vault\//i.test(rel)) return true;
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    if (dir.split('/').some((seg) => /^\.tmp/i.test(seg))) return true;
  }
  return false;
}

function isMonorepoPlatformAliasPair(pathA, pathB, platformDirName = 'ai-platform') {
  const a = normalizeRelativePath(pathA);
  const b = normalizeRelativePath(pathB);
  if (a === b) return false;
  const prefix = `${platformDirName}/`;
  const stripPrefix = (p) => (p.startsWith(prefix) ? p.slice(prefix.length) : p);
  return (a.startsWith(prefix) && b === stripPrefix(a)) || (b.startsWith(prefix) && a === stripPrefix(b));
}

function isBrowserBuildMirrorPair(pathA, pathB) {
  const a = normalizeRelativePath(pathA);
  const b = normalizeRelativePath(pathB);
  const browserRe = /\.browser\.(js|mjs|cjs|ts|tsx)$/i;
  if (!browserRe.test(a) && !browserRe.test(b)) return false;
  const toSource = (p) => p.replace(/\.browser\.(js|mjs|cjs|ts|tsx)$/i, '.$1');
  return toSource(a) === b || toSource(b) === a;
}

function isIntentionalMcpExamplePair(pathA, pathB) {
  const a = normalizeRelativePath(pathA);
  const b = normalizeRelativePath(pathB);
  const isMcpConfig = (p) => p.endsWith('mcp.json') || /\/examples\/mcp\//.test(p);
  return isMcpConfig(a) && isMcpConfig(b);
}

function isConsolidationExcludedPair(pathA, pathB) {
  if (isEphemeralConsolidationPath(pathA) || isEphemeralConsolidationPath(pathB)) return true;
  if (isMonorepoPlatformAliasPair(pathA, pathB)) return true;
  if (isBrowserBuildMirrorPair(pathA, pathB)) return true;
  if (isIntentionalMcpExamplePair(pathA, pathB)) return true;
  return false;
}

function filterFuzzyPairs(pairs = []) {
  return pairs.filter((pair) => !isConsolidationExcludedPair(pair.fileA, pair.fileB));
}

function countExcludedFuzzyPairs(pairs = []) {
  let browserMirrorPairsExcluded = 0;
  let mcpExamplePairsExcluded = 0;
  let monorepoAliasPairsExcluded = 0;
  let ephemeralPathsExcluded = 0;
  let fuzzyPairsExcluded = 0;
  for (const pair of pairs) {
    const pathA = pair?.fileA;
    const pathB = pair?.fileB;
    if (!pathA || !pathB) continue;
    if (!isConsolidationExcludedPair(pathA, pathB)) continue;
    fuzzyPairsExcluded += 1;
    if (isEphemeralConsolidationPath(pathA) || isEphemeralConsolidationPath(pathB)) {
      ephemeralPathsExcluded += 1;
    } else if (isBrowserBuildMirrorPair(pathA, pathB)) {
      browserMirrorPairsExcluded += 1;
    } else if (isIntentionalMcpExamplePair(pathA, pathB)) {
      mcpExamplePairsExcluded += 1;
    } else if (isMonorepoPlatformAliasPair(pathA, pathB)) {
      monorepoAliasPairsExcluded += 1;
    }
  }
  return {
    browserMirrorPairsExcluded,
    mcpExamplePairsExcluded,
    monorepoAliasPairsExcluded,
    ephemeralPathsExcluded,
    fuzzyPairsExcluded,
    intentionalPairsExcluded: browserMirrorPairsExcluded + mcpExamplePairsExcluded
      + monorepoAliasPairsExcluded + ephemeralPathsExcluded
  };
}

function consolidationCandidateTouchesExcluded(candidate) {
  const paths = (candidate?.files || []).map((file) =>
    file.path || file.relativePath || file.name).filter(Boolean);
  if (paths.length === 2 && isConsolidationExcludedPair(paths[0], paths[1])) return true;
  return paths.some((p) => isEphemeralConsolidationPath(p));
}

function countIntentionalPairExclusions(candidates = []) {
  let browserMirrorPairsExcluded = 0;
  let mcpExamplePairsExcluded = 0;
  let monorepoAliasPairsExcluded = 0;
  let ephemeralPathsExcluded = 0;
  for (const candidate of candidates) {
    const paths = (candidate?.files || []).map((file) =>
      file.path || file.relativePath || file.name).filter(Boolean);
    if (paths.some(isEphemeralConsolidationPath)) {
      ephemeralPathsExcluded += 1;
      continue;
    }
    if (paths.length !== 2) continue;
    if (isBrowserBuildMirrorPair(paths[0], paths[1])) {
      browserMirrorPairsExcluded += 1;
    } else if (isIntentionalMcpExamplePair(paths[0], paths[1])) {
      mcpExamplePairsExcluded += 1;
    } else if (isMonorepoPlatformAliasPair(paths[0], paths[1])) {
      monorepoAliasPairsExcluded += 1;
    }
  }
  return {
    browserMirrorPairsExcluded,
    mcpExamplePairsExcluded,
    monorepoAliasPairsExcluded,
    ephemeralPathsExcluded,
    intentionalPairsExcluded: browserMirrorPairsExcluded + mcpExamplePairsExcluded
      + monorepoAliasPairsExcluded + ephemeralPathsExcluded
  };
}

module.exports = {
  isEphemeralConsolidationPath,
  isConsolidationExcludedPair,
  consolidationCandidateTouchesExcluded,
  countIntentionalPairExclusions,
  filterFuzzyPairs,
  countExcludedFuzzyPairs,
  isBrowserBuildMirrorPair,
  isIntentionalMcpExamplePair,
  isMonorepoPlatformAliasPair
};
