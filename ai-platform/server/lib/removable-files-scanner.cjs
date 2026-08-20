// simplebeacon-ignore test-coverage
/**
 * Removable Files Scanner — identifies files and directories that can be safely deleted.
 *
 * Targets: node_modules, build artifacts, caches, logs, temp files, OS metadata.
 */

const fs = require("fs");
const path = require("path");

const REMOVABLE_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  "target",
  ".cache",
  ".turbo",
  ".parcel-cache",
  "cache",
  "logs",
  "tmp",
  "temp",
  ".vscode",
  ".idea",
  ".gradle",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".tox",
  "coverage",
  ".nyc_output",
  "storybook-static",
  ".serverless",
  ".fusebox",
  ".docusaurus",
  ".vuepress",
  ".svelte-kit",
  ".vercel",
  ".netlify",
]);

const REMOVABLE_FILE_PATTERNS = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^desktop\.ini$/,
  /^\.eslintcache$/,
  /^\.stylelintcache$/,
  /^\.prettiercache$/,
  /^npm-debug\.log.*$/,
  /^yarn-debug\.log.*$/,
  /^yarn-error\.log.*$/,
  /^\.npm$/,
  /^\.yarn$/,
  /^\.pnpm-debug\.log.*$/,
  /^.*\.tmp$/,
  /^.*\.temp$/,
  /^.*\.log$/,
  /^.*\.swp$/,
  /^.*\.swo$/,
  /^\.#.*$/,
  /^#.*#$/,
  /^~.*$/,
  /^.*\.bak$/,
  /^.*\.orig$/,
  /^.*\.rej$/,
];

const REMOVABLE_DIR_PATTERNS = [/^\.[a-z]+-cache$/i];

const SKIP_DIRS = new Set([
  ".git",
  ".vscode-test",
  ".simplebeacon",
  "github-cache",
  "deliverables",
  "java-ai-vulnerable",
  "data-central",
  "security-reports",
  "archive",
]);

/**
 * Is removable file.
 * @param {string} fileName
 * @returns {any}
 */
function isRemovableFile(fileName) {
  return REMOVABLE_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

/**
 * Is removable dir.
 * @param {string} dirName
 * @returns {any}
 */
function isRemovableDir(dirName) {
  if (REMOVABLE_DIR_NAMES.has(dirName)) return true;
  return REMOVABLE_DIR_PATTERNS.some((pattern) => pattern.test(dirName));
}

/**
 * Format bytes.
 * @param {Array} bytes
 * @returns {any}
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log2(bytes) / 10);
  return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}

/**
 * Walk dir.
 * @param {string} dirPath
 * @param {string} basePath
 * @param {Array} results
 * @param {Object} options
 * @returns {any}
 */
async function walkDir(dirPath, basePath, results, options = {}) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      if (isRemovableDir(entry.name)) {
        // Compute directory size
        let dirSize = 0;
        let fileCount = 0;
        let subDirCount = 0;
        try {
          const stack = [fullPath];
          while (stack.length) {
            const current = stack.pop();
            const items = await fs.promises.readdir(current, {
              withFileTypes: true,
            });
            for (const item of items) {
              const itemPath = path.join(current, item.name);
              if (item.isDirectory()) {
                subDirCount++;
                stack.push(itemPath);
              } else {
                try {
                  const stat = await fs.promises.stat(itemPath);
                  dirSize += stat.size;
                  fileCount++;
                } catch {
                  /* ignore permission errors */
                }
              }
            }
          }
        } catch {
          /* ignore */
        }

        results.categories.push({
          category: entry.name,
          label: getCategoryLabel(entry.name),
          count: 1,
          bytes: dirSize,
          sizeLabel: formatBytes(dirSize),
          examples: [relativePath],
          action: getRecommendedAction(entry.name),
          fileCount,
          subDirCount,
        });

        results.totalRemovable += dirSize;
        results.totalFiles += fileCount;
      } else {
        await walkDir(fullPath, basePath, results, options);
      }
    } else if (entry.isFile() && isRemovableFile(entry.name)) {
      try {
        const stat = await fs.promises.stat(fullPath);
        results.categories.push({
          category: path.extname(entry.name) || "os-metadata",
          label: getCategoryLabel(entry.name),
          count: 1,
          bytes: stat.size,
          sizeLabel: formatBytes(stat.size),
          examples: [relativePath],
          action: getRecommendedAction(entry.name),
          fileCount: 1,
          subDirCount: 0,
        });
        results.totalRemovable += stat.size;
        results.totalFiles += 1;
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Get category label.
 * @param {string} name
 * @returns {any}
 */
function getCategoryLabel(name) {
  const labels = {
    node_modules: "Dependency cache (npm/yarn/pnpm)",
    dist: "Build output (dist)",
    build: "Build output (build)",
    ".next": "Next.js build output",
    out: "Static export output",
    target: "Maven/Gradle build output",
    ".cache": "Application cache",
    ".turbo": "Turborepo cache",
    ".parcel-cache": "Parcel cache",
    cache: "Cache directory",
    logs: "Log files directory",
    tmp: "Temporary files",
    temp: "Temporary files",
    ".vscode": "VS Code workspace settings",
    ".idea": "IntelliJ workspace settings",
    ".gradle": "Gradle cache",
    __pycache__: "Python bytecode cache",
    ".pytest_cache": "Pytest cache",
    ".mypy_cache": "MyPy cache",
    ".tox": "Tox environments",
    coverage: "Test coverage output",
    ".nyc_output": "NYC coverage output",
    "storybook-static": "Storybook static build",
    ".serverless": "Serverless build artifacts",
    ".fusebox": "FuseBox cache",
    ".docusaurus": "Docusaurus build output",
    ".vuepress": "VuePress build output",
    ".svelte-kit": "SvelteKit build output",
    ".vercel": "Vercel deployment cache",
    ".netlify": "Netlify deployment cache",
    ".DS_Store": "macOS metadata",
    "Thumbs.db": "Windows thumbnail cache",
    "desktop.ini": "Windows folder config",
    ".eslintcache": "ESLint cache",
    ".stylelintcache": "Stylelint cache",
    ".prettiercache": "Prettier cache",
  };
  return labels[name] || "Removable file";
}

/**
 * Get recommended action.
 * @param {string} name
 * @returns {any}
 */
function getRecommendedAction(name) {
  const actions = {
    node_modules: "Run npm install / yarn / pnpm to regenerate after deletion",
    dist: "Regenerates on next build",
    build: "Regenerates on next build",
    ".next": "Regenerates on next build",
    out: "Regenerates on next export",
    target: "Regenerates on next mvn/gradle build",
    ".cache": "Safe to delete — regenerates on demand",
    ".turbo": "Safe to delete — regenerates on next run",
    ".parcel-cache": "Safe to delete — regenerates on next build",
    cache: "Safe to delete — regenerates on demand",
    logs: "Archive if needed, then delete",
    tmp: "Safe to delete",
    temp: "Safe to delete",
    ".vscode": "Keep only shared settings; delete personal workspaces",
    ".idea": "Keep only shared settings; delete personal workspaces",
    __pycache__: "Safe to delete — regenerates on next Python run",
    ".pytest_cache": "Safe to delete — regenerates on next test run",
    ".mypy_cache": "Safe to delete — regenerates on next type check",
    ".tox": "Safe to delete — regenerates on next tox run",
    coverage: "Safe to delete — regenerates on next test run",
    ".nyc_output": "Safe to delete — regenerates on next coverage run",
    ".DS_Store": "Safe to delete — add to .gitignore",
    "Thumbs.db": "Safe to delete — add to .gitignore",
    "desktop.ini": "Safe to delete — add to .gitignore",
    ".eslintcache": "Safe to delete — regenerates on next lint",
    ".stylelintcache": "Safe to delete — regenerates on next lint",
    ".prettiercache": "Safe to delete — regenerates on next format",
  };
  return actions[name] || "Review before deleting";
}

/**
 * Scan removable files.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
async function scanRemovableFiles(projectPath, options = {}) {
  const resolvedBase = path.resolve(projectPath);
  const results = {
    type: "removable-files-report",
    reportVersion: 1,
    title: "Removable Files Scan",
    generatedAt: new Date().toISOString(),
    projectRoot: resolvedBase,
    totalFiles: 0,
    totalRemovable: 0,
    totalRemovableFormatted: "0 B",
    categories: [],
    summary: "",
  };

  await walkDir(resolvedBase, resolvedBase, results, options);

  // Aggregate categories by name
  const aggregated = new Map();
  for (const cat of results.categories) {
    const existing = aggregated.get(cat.category);
    if (existing) {
      existing.count += cat.count;
      existing.bytes += cat.bytes;
      existing.fileCount += cat.fileCount;
      existing.subDirCount += cat.subDirCount;
      if (existing.examples.length < 5)
        existing.examples.push(
          ...cat.examples.slice(0, 5 - existing.examples.length),
        );
    } else {
      aggregated.set(cat.category, { ...cat });
    }
  }
  results.categories = [...aggregated.values()]
    .sort((a, b) => b.bytes - a.bytes)
    .map((c) => ({
      category: c.category,
      label: c.label,
      count: c.count,
      bytes: c.bytes,
      sizeLabel: formatBytes(c.bytes),
      examples: c.examples.slice(0, 5),
      action: c.action,
    }));

  results.totalRemovableFormatted = formatBytes(results.totalRemovable);
  results.summary =
    results.totalRemovable > 0
      ? `Found ${results.categories.length} removable categories totaling ${results.totalRemovableFormatted} across ${results.totalFiles} files.`
      : "No removable files detected.";

  return results;
}

module.exports = { scanRemovableFiles };
