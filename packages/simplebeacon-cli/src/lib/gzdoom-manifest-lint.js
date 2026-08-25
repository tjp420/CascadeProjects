/**
 * ZScript manifest lint — missing #includes and disabled includes without tracking notes.
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("../rules/production-leak");
const { collectGzdoomFiles } = require("./gzdoom-symbol-graph");
const {
  extractIncludes,
  resolveIncludePath,
  resolveReachableGzdoomFiles,
} = require("./gzdoom-include-resolver");

const DISABLED_INCLUDE_RE = /^\s*\/\/\s*#include\s+["']([^"']+)["']/gm;
const TRACKING_NOTE_RE =
  /\b(?:TODO|FIXME|TRACK|ISSUE|DISABLED|HACK|TEMP|WIP|BUG-\d+|#\d+)\b/i;

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function findMissingIncludes(baseDir, allFiles) {
  const sourceFiles = allFiles.filter((f) => f.kind === "source");
  const missing = [];
  const reported = new Set();

  for (const file of sourceFiles) {
    if (
      !/\.(zs|zscript)$/i.test(file.relativePath) &&
      file.name.toLowerCase() !== "zscript"
    )
      continue;
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }

    for (const inc of extractIncludes(content)) {
      const resolved = resolveIncludePath(baseDir, file.path, inc);
      if (resolved) continue;
      const key = `${file.relativePath}:${inc}`;
      if (reported.has(key)) continue;
      reported.add(key);
      missing.push({
        include: inc,
        fromFile: file.relativePath,
        line: lineOfInclude(content, inc),
      });
    }
  }
  return missing;
}

function lineOfInclude(content, includeRef) {
  const lines = String(content || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes(`"${includeRef}"`) ||
      lines[i].includes(`'${includeRef}'`)
    )
      return i + 1;
  }
  return 1;
}

function findDisabledIncludesWithoutNotes(baseDir, ignoreGlobs = []) {
  const hits = [];
  const scanRoots = [path.join(baseDir, "zscript"), baseDir];
  function walkFile(full, rel) {
    if (
      !/\.(zs|zscript)$/i.test(path.basename(full)) &&
      path.basename(full).toLowerCase() !== "zscript"
    )
      return;
    if (!/manifest|ZSCRIPT|zscript/i.test(rel)) return;
    let content;
    try {
      const stat = fs.statSync(full);
      if (stat.size > 512 * 1024) return;
      content = fs.readFileSync(full, "utf8");
    } catch {
      return;
    }
    const lines = content.split("\n");
    DISABLED_INCLUDE_RE.lastIndex = 0;
    let match;
    while ((match = DISABLED_INCLUDE_RE.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      const prev = lines[lineNum - 2] || "";
      const same = lines[lineNum - 1] || "";
      if (TRACKING_NOTE_RE.test(prev) || TRACKING_NOTE_RE.test(same)) continue;
      hits.push({ include: match[1], filePath: rel, line: lineNum });
      if (hits.length >= 100) return;
    }
  }
  function walk(dir, depth) {
    if (depth > 8 || hits.length >= 100) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = normalizeRel(baseDir, full);
      if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
      if (entry.isDirectory()) {
        if (
          /node_modules|\.git|tools|Docs|build_temp|Backup$/i.test(entry.name)
        )
          continue;
        walk(full, depth + 1);
        continue;
      }
      walkFile(full, rel);
    }
  }
  for (const root of scanRoots) {
    if (fs.existsSync(root)) walk(root, 0);
  }
  return hits;
}

/**
 * @param {string} modPath
 * @param {{ignoreGlobs?:string[],severity?:string,missingSeverity?:string,disabledSeverity?:string}} [options]
 */
async function lintGzdoomManifest(modPath, options = {}) {
  const opts = options || {};
  const missingSeverity = opts.missingSeverity || opts.severity || "high";
  const disabledSeverity = opts.disabledSeverity || "medium";
  const ignoreGlobs = opts.ignoreGlobs || [];
  const root = path.resolve(modPath);

  const allFiles = await collectGzdoomFiles(root, { ignoreGlobs });
  const reachable = resolveReachableGzdoomFiles(root, allFiles);
  const missing = findMissingIncludes(root, allFiles);
  const disabled = findDisabledIncludesWithoutNotes(root, ignoreGlobs);

  const issues = [];
  for (const m of missing) {
    issues.push({
      type: "gzdoom-include-missing",
      severity: missingSeverity,
      filePath: m.fromFile,
      line: m.line,
      count: 1,
      description: `#include "${m.include}" references a file not found on disk`,
      recommendedAction:
        "Fix the include path, add the missing .zs file, or remove the include",
      affectedFiles: [m.fromFile],
      metadata: { engine: "gzdoom-manifest-lint", include: m.include },
    });
  }

  for (const d of disabled) {
    issues.push({
      type: "gzdoom-include-disabled-untracked",
      severity: disabledSeverity,
      filePath: d.filePath,
      line: d.line,
      count: 1,
      description: `Commented-out #include "${d.include}" has no TODO/FIXME/DISABLED tracking note`,
      recommendedAction:
        "Add a TODO comment explaining why the include is disabled and when to re-enable",
      affectedFiles: [d.filePath],
      metadata: { engine: "gzdoom-manifest-lint", include: d.include },
    });
  }

  return {
    reachableFiles: reachable.reachable.size,
    orphanFiles: reachable.orphans.length,
    missingIncludes: missing.length,
    disabledUntracked: disabled.length,
    findings: issues.length,
    issues,
  };
}

module.exports = {
  lintGzdoomManifest,
  findMissingIncludes,
  findDisabledIncludesWithoutNotes,
};
