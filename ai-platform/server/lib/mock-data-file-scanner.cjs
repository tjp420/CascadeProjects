const fs = require("fs");
const path = require("path");
const {
  analyzeFileContent,
  ALLOWED_EXTENSIONS,
} = require("./mock-data-helpers.cjs");

/**
 * Recursively scan a directory for mock data files.
 * Returns { files: Array, issues: Array }
 */
async function scanForMockFiles(dirPath, baseDir = null) {
  const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const files = [];
  const issues = [];

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      const nested = await scanForMockFiles(itemPath, baseDir);
      files.push(...nested.files);
      issues.push(...nested.issues);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.test(item.name)) continue;

    try {
      const content = await fs.promises.readFile(itemPath, "utf8");
      const analysis = analyzeFileContent(content, item.name);

      files.push({
        path: path.relative(baseDir || dirPath, itemPath),
        name: item.name,
        size: item.size,
        analysis,
        ...(analysis.needsValidation ? { content } : {}),
      });

      if (analysis.issues.length > 0) {
        issues.push(...analysis.issues);
      }
    } catch (error) {
      issues.push({
        file: item.name,
        error: error.message,
        type: "read_error",
      });
    }
  }

  return { files, issues };
}

module.exports = { scanForMockFiles };
