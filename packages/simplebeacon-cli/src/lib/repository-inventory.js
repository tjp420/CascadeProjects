/**
 * Count all files and folders under a project path (Explorer-style inventory).
 */

const fs = require('fs');
const path = require('path');

const SKIP_BY_PROFILE = {
  all: [],
  explorer: [],
  universal: ['node_modules', '.git'],
  audit: [
    'node_modules',
    '.git',
    'coverage',
    'uploads',
    'dist',
    'build',
    'archive',
    'github-cache',
    'deliverables',
    'java-ai-vulnerable',
    '.simplebeacon',
    'security-reports',
  ],
};

async function countRepositoryInventory(rootDir, options = {}) {
  const profile = options.profile || 'audit';
  const skipDirs = new Set(
    options.skipDirs || SKIP_BY_PROFILE[profile] || SKIP_BY_PROFILE.explorer
  );
  const maxDepth = options.maxDepth ?? 40;
  let totalFiles = 0;
  let totalFolders = 0;
  const visited = new Set();

  // Iterative stack-based traversal to avoid stack overflow on deep/large trees
  const stack = [{ dir: path.resolve(rootDir), depth: 0 }];

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    if (depth > maxDepth) continue;
    const realDir = await fs.promises.realpath(dir).catch(() => dir);
    if (visited.has(realDir)) continue;
    visited.add(realDir);
    let entries;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
        break;
      } catch {
        if (attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
    if (!entries) continue;

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        totalFolders += 1;
        stack.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (entry.isSymbolicLink()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            totalFolders += 1;
            stack.push({ dir: fullPath, depth: depth + 1 });
            continue;
          }
          totalFiles += 1;
        } catch {
          // Broken symlink — skip
        }
        continue;
      }
      if (entry.isFile()) {
        totalFiles += 1;
      }
    }
  }

  const projectRoot = path.resolve(rootDir);

  return {
    projectRoot,
    totalFiles,
    totalFolders,
    profile,
  };
}

module.exports = {
  countRepositoryInventory,
  SKIP_BY_PROFILE,
};
