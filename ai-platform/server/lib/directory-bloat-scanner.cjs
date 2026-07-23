/**
 * Directory bloat scanner — finds node_modules, build artifacts, stale logs,
 * empty directories, and large package-lock.json files.
 */

const fs = require('fs').promises;
const path = require('path');

const constants = require('../config/constants.cjs');
const BUILD_ARTIFACT_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  '.tmp',
  'tmp',
  '.cache',
  'cache',
  '__pycache__'
]);

const LOG_EXTENSIONS = new Set(['.log', '.logs']);

/**
 * Should skip dir.
 * @param {string} name
 * @returns {any}
 */
function shouldSkipDir(name) {
  return name === '.git'
    || name === '.cursor'
    || name === '.vscode'
    || name === '.vscode-test'
    || name === '.simplebeacon'
    || name === 'github-cache'
    || name === 'deliverables'
    || name === 'java-ai-vulnerable'
    || name === 'data-central'
    || name === 'security-reports'
    || name === 'archive';
}

/**
 * Get dir size.
 * @param {string} dirPath
 * @returns {any}
 */
async function getDirSize(dirPath) {
  let total = 0;
  let fileCount = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = await getDirSize(full);
        total += sub.size;
        fileCount += sub.fileCount;
      } else if (entry.isFile()) {
        try {
          const s = await fs.stat(full);
          total += s.size;
          fileCount += 1;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  return { size: total, fileCount };
}

/**
 * Scan directory bloat.
 * @param {string} projectPath
 * @returns {any}
 */
async function scanDirectoryBloat(projectPath) {
  const findings = {
    nodeModules: [],
    buildArtifacts: [],
    largePackageLocks: [],
    largeLogs: [],
    emptyDirs: [],
    staleDirs: []
  };

  const now = Date.now();
  const STALE_THRESHOLD_MS = 90 * 24 * 60 * constants.ONE_MINUTE_MS; // 90 days
  const LARGE_PACKAGE_LOCK_BYTES = 100 * constants.BYTES_PER_KB; // 100 KB
  const LARGE_LOG_BYTES = constants.BYTES_PER_KB * constants.BYTES_PER_KB; // 1 MB

/**
 * Walk.
 * @param {string} dirPath
 * @param {string} relativePath
 * @returns {any}
 */
  async function walk(dirPath, relativePath) {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    const dirs = entries.filter((e) => e.isDirectory());
    const files = entries.filter((e) => e.isFile());

    // Empty directory check (excluding hidden dirs and root-level skips)
    if (dirs.length === 0 && files.length === 0 && !shouldSkipDir(path.basename(dirPath))) {
      findings.emptyDirs.push({
        path: relativePath,
        kind: 'directory',
        category: 'Empty directory',
        action: 'safe-to-delete',
        severity: 'low'
      });
    }

    for (const entry of files) {
      const full = path.join(dirPath, entry.name);
      const rel = path.join(relativePath, entry.name).replace(/\\/g, '/');
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }

      if (entry.name === 'package-lock.json' && stat.size > LARGE_PACKAGE_LOCK_BYTES) {
        findings.largePackageLocks.push({
          path: rel,
          kind: 'file',
          category: 'Large package-lock.json',
          action: 'review-before-delete',
          severity: stat.size > constants.BYTES_PER_KB * constants.BYTES_PER_KB ? 'high' : 'medium',
          sizeBytes: stat.size,
          reason: `Generated lock file (${(stat.size / 1024).toFixed(1)} KB) — safe to regenerate with npm install`
        });
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (LOG_EXTENSIONS.has(ext) && stat.size > LARGE_LOG_BYTES) {
        findings.largeLogs.push({
          path: rel,
          kind: 'file',
          category: 'Large log file',
          action: 'safe-to-delete',
          severity: 'medium',
          sizeBytes: stat.size,
          reason: `Log file (${(stat.size / 1024 / 1024).toFixed(1)} MB) — likely safe to truncate or archive`
        });
      }
    }

    for (const entry of dirs) {
      if (shouldSkipDir(entry.name)) continue;

      const full = path.join(dirPath, entry.name);
      const rel = path.join(relativePath, entry.name).replace(/\\/g, '/');
      const base = entry.name;

      if (base === 'node_modules') {
        const { size, fileCount } = await getDirSize(full);
        findings.nodeModules.push({
          path: rel,
          kind: 'directory',
          category: 'node_modules',
          action: 'safe-to-delete',
          severity: fileCount > constants.TIMEOUT_5S ? 'high' : fileCount > 1000 ? 'medium' : 'low',
          sizeBytes: size,
          fileCount,
          reason: `Dependency directory — regenerate with npm install/ci (${fileCount.toLocaleString()} files)`
        });
        // Do NOT recurse into node_modules
        continue;
      }

      if (BUILD_ARTIFACT_DIRS.has(base)) {
        const { size, fileCount } = await getDirSize(full);
        findings.buildArtifacts.push({
          path: rel,
          kind: 'directory',
          category: 'Build artifact directory',
          action: 'safe-to-delete',
          severity: fileCount > constants.DEFAULT_RANDOM_MAX ? 'medium' : 'low',
          sizeBytes: size,
          fileCount,
          reason: `Build output — rebuilds automatically (${fileCount.toLocaleString()} files)`
        });
        // Do NOT recurse into build artifacts
        continue;
      }

      // Stale directory check (only top-level dirs relative to project)
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (!relativePath.includes('/') && now - stat.mtimeMs > STALE_THRESHOLD_MS) {
        const { size, fileCount } = await getDirSize(full);
        findings.staleDirs.push({
          path: rel,
          kind: 'directory',
          category: 'Potentially stale project directory',
          action: 'review-before-delete',
          severity: 'medium',
          sizeBytes: size,
          fileCount,
          reason: `No changes in ${Math.round((now - stat.mtimeMs) / (24 * 60 * constants.ONE_MINUTE_MS))} days`
        });
      }

      await walk(full, rel);
    }
  }

  await walk(projectPath, '');

  const allFindings = [
    ...findings.nodeModules,
    ...findings.buildArtifacts,
    ...findings.largePackageLocks,
    ...findings.largeLogs,
    ...findings.emptyDirs,
    ...findings.staleDirs
  ];

  const totalReclaimable = allFindings.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);

  return {
    findings: {
      directoryBloat: allFindings
    },
    summary: {
      directoryBloatFindings: allFindings.length,
      directoryBloatReclaimableBytes: totalReclaimable,
      nodeModulesCount: findings.nodeModules.length,
      buildArtifactDirCount: findings.buildArtifacts.length,
      largePackageLockCount: findings.largePackageLocks.length,
      largeLogCount: findings.largeLogs.length,
      emptyDirCount: findings.emptyDirs.length,
      staleDirCount: findings.staleDirs.length
    }
  };
}

module.exports = { scanDirectoryBloat };
