/**
 * Walk project files for file-reduction analyzers.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_SKIP_DIRS = new Set([
  ".git",
  ".simplebeacon",
  "node_modules",
  "github-cache",
  "deliverables",
  "java-ai-vulnerable",
  "coverage",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "out",
  ".cache",
  "uploads",
  "archive",
  "data-central",
  "security-reports",
  "__pycache__",
  ".venv",
  "htmlcov",
  ".vscode-test",
  ".nyc_output",
  ".parcel-cache",
  ".turbo",
  ".serverless",
  ".fusebox",
  ".docusaurus",
  ".vuepress",
  ".svelte-kit",
  ".vercel",
  ".netlify",
  ".pnpm-store",
  ".yarn",
  ".npm",
]);

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function matchesGlobPattern(name, pattern) {
  if (pattern.startsWith("*.")) {
    return name.endsWith(pattern.slice(1));
  }
  if (pattern.includes("*")) {
    const regex = new RegExp(
      `^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
      "i",
    );
    return regex.test(name);
  }
  return name === pattern;
}

async function walkProjectFiles(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const skipDirs = new Set([...(options.skipDirs || []), ...DEFAULT_SKIP_DIRS]);
  const maxDepth = options.maxDepth ?? 24;
  const files = [];
  const directories = [];

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const subDirs = [];
    const fileEntries = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) {
          directories.push({
            path: path.join(dir, entry.name),
            relativePath: normalizeRel(root, path.join(dir, entry.name)),
            name: entry.name,
            skipped: true,
          });
          continue;
        }
        directories.push({
          path: path.join(dir, entry.name),
          relativePath: normalizeRel(root, path.join(dir, entry.name)),
          name: entry.name,
        });
        subDirs.push(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      fileEntries.push(entry);
    }

    if (fileEntries.length > 0) {
      const statPromises = fileEntries.map((entry) => {
        const fullPath = path.join(dir, entry.name);
        return fs.promises
          .stat(fullPath)
          .then((stat) => ({
            fullPath,
            name: entry.name,
            ext: path.extname(entry.name).toLowerCase(),
            size: stat.size,
          }))
          .catch(() => null);
      });
      const stats = await Promise.all(statPromises);
      for (const s of stats) {
        if (!s) continue;
        files.push({
          path: s.fullPath,
          relativePath: normalizeRel(root, s.fullPath),
          name: s.name,
          ext: s.ext,
          size: s.size,
        });
      }
    }

    await Promise.all(subDirs.map((subDir) => walk(subDir, depth + 1)));
  }

  if (fs.existsSync(root)) {
    await walk(root, 0);
  }

  return { root, files, directories };
}

module.exports = {
  walkProjectFiles,
  normalizeRel,
  matchesGlobPattern,
  DEFAULT_SKIP_DIRS,
};
