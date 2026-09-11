// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Full-tree analysis — every file under the selected directory is processed.
 * Each file: SHA-256 hash + stat (always). Text files: all gate pattern passes.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { buildFictionPatterns } = require("./full-tree-rule-pass");
const {
  runTextRulePassesParallel,
  resolveWorkerCount,
} = require("./full-tree-scan-pool");
const { preflightOrThrow, sampleAndThrow } = require("./resource-guard");
const {
  detectDocumentationArtifacts,
  filterDocumentedAiInventoryIssues,
} = require("../rules/eu-ai-act-patterns");
const { isExcludedPath } = require("../rules/ai-runtime-scan-common");
const { globMatch } = require("../rules/production-leak");
const constants = require("./constants");

const DEFAULT_SKIP_DIRS = new Set([]);
function resolveDefaultMaxFilesFromEnv() {
  const env = process.env.SIMPLEBEACON_FULL_SCAN_MAX_FILES;
  if (env == null || String(env).trim() === "") return 2_000_000;
  const n = Number(env);
  if (!Number.isFinite(n)) return 2_000_000;
  return n <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, n);
}

const DEFAULT_MAX_FILES = resolveDefaultMaxFilesFromEnv();
const BATCH_LOG_EVERY =
  Number(process.env.SIMPLEBEACON_FULL_SCAN_LOG_EVERY) || constants.TIMEOUT_5S;
const RESOURCE_SAMPLE_EVERY =
  Number(process.env.SIMPLEBEACON_RESOURCE_SAMPLE_EVERY_FILES) || 1000;

function resolveMaxContentBytes(options = {}) {
  if (options.maxContentBytes != null) {
    const n = Number(options.maxContentBytes);
    if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
    return n;
  }
  const env = process.env.SIMPLEBEACON_FULL_SCAN_MAX_BYTES;
  if (env != null && String(env).trim() !== "") {
    const n = Number(env);
    if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
    return n;
  }
  return Number.POSITIVE_INFINITY;
}

function resolveMaxFiles(options = {}) {
  if (options.maxFiles != null && Number.isFinite(Number(options.maxFiles))) {
    const n = Number(options.maxFiles);
    return n <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, n);
  }
  return DEFAULT_MAX_FILES;
}

function categoryForExt(ext) {
  if (!ext) return "Other Files";
  const lower = ext.toLowerCase();
  // Use constants when available for rich categorization
  if (constants && constants.getExtensionCategory) {
    const cat = constants.getExtensionCategory(lower);
    if (cat) return cat;
  }
  const map = {
    ".json": "JSON Files",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".py": "Python",
    ".md": "Documentation",
  };
  return map[lower] || "Other Files";
}

function normalizeSkipDirs(skipDirs) {
  if (skipDirs instanceof Set) return skipDirs;
  if (Array.isArray(skipDirs)) return new Set(skipDirs);
  return DEFAULT_SKIP_DIRS;
}

function isIgnoredRelativePath(relativePath, ignoreGlobs = []) {
  const rel = String(relativePath || "").replace(/\\/g, "/");
  for (const pattern of ignoreGlobs) {
    if (globMatch(rel, pattern)) return true;
  }
  return false;
}

async function walkAllFiles(rootDir, options = {}) {
  const projectRoot = path.resolve(rootDir);
  const skipDirs = normalizeSkipDirs(options.skipDirs);
  const maxDepth = options.maxDepth ?? 64;
  const maxFiles = resolveMaxFiles(options);
  const files = [];
  let totalFolders = 0;
  let truncated = false;

  async function walk(dir, depth) {
    if (truncated || depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const subDirs = [];
    const fileEntries = [];

    for (const entry of entries) {
      if (truncated) break;
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        totalFolders += 1;
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
        if (!s || truncated) continue;
        files.push({
          path: s.fullPath,
          name: s.name,
          ext: s.ext,
          size: s.size,
          relativePath: path
            .relative(projectRoot, s.fullPath)
            .replace(/\\/g, "/"),
        });
        if (files.length >= maxFiles) {
          truncated = true;
          break;
        }
      }
    }

    if (truncated) return;

    await Promise.all(subDirs.map((subDir) => walk(subDir, depth + 1)));
  }

  if (fs.existsSync(projectRoot)) {
    await walk(projectRoot, 0);
  }

  return {
    projectRoot,
    files,
    totalFiles: files.length,
    totalFolders,
    truncated,
    maxFiles: Number.isFinite(maxFiles) ? maxFiles : null,
  };
}

function isBinaryBuffer(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function hashBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function hashFileStream(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/** Default in-flight hash/reads. Cap 64 to stay under typical EMFILE limits. */
const DEFAULT_HASH_CONCURRENCY = 32;
const HASH_CONCURRENCY_CAP = 64;

function resolveHashConcurrency(fileCount) {
  const env = Number(process.env.SIMPLEBEACON_HASH_CONCURRENCY);
  const requested = Number.isFinite(env) && env > 0 ? env : DEFAULT_HASH_CONCURRENCY;
  const n = Math.max(1, Math.min(HASH_CONCURRENCY_CAP, requested));
  if (!fileCount) return 1;
  return Math.min(n, fileCount);
}

/**
 * I/O only: stream-hash oversized files, otherwise read into a buffer.
 * Does not run regex (text jobs are queued after this returns).
 */
async function hashAndReadFile(file, maxContentBytes) {
  if (file.size === 0) return { kind: "empty" };
  try {
    if (Number.isFinite(maxContentBytes) && file.size > maxContentBytes) {
      const fileHash = await hashFileStream(file.path);
      return { kind: "large", fileHash };
    }
    const buf = await fs.promises.readFile(file.path);
    return { kind: "buffer", buf };
  } catch {
    return { kind: "unreadable" };
  }
}

async function analyzeFullDirectory(rootDir, options = {}) {
  const isUniversal = options.universal === true;
  const maxContentBytes = resolveMaxContentBytes(options);
  const maxFilesFromOptions = resolveMaxFiles(options);
  if (!Number.isFinite(maxFilesFromOptions)) {
    console.error(
      "UNLIMITED SCAN WARNING: full-directory scan configured with no file limit. This may consume large amounts of memory and CPU. Consider setting SIMPLEBEACON_FULL_SCAN_MAX_FILES to a positive integer or run on a machine with sufficient resources.",
    );
  }
  // Pre-flight resource check: abort early if host is low on free memory
  try {
    preflightOrThrow();
  } catch (err) {
    console.error(err.message);
    throw err;
  }
  const walkResult = await walkAllFiles(rootDir, options);
  const issues = [];
  const ruleHitTotals = {
    credentials: 0,
    productionLeak: 0,
    llmSlop: 0,
    agencyHandoff: 0,
    fictionKpi: 0,
    euAiAct: 0,
    tokenBleed: 0,
    architectureDrift: 0,
    fileNaming: 0,
    security: 0,
  };
  let euHighRiskHits = 0;
  let euAiSystemHits = 0;
  let euTransparencyGaps = 0;
  let emptyFiles = 0;
  let unreadableFiles = 0;
  let filesHashed = 0;
  let filesContentScanned = 0;
  let filesBinaryHashed = 0;
  let filesLargeHashed = 0;
  let jsonInvalid = 0;
  let jsonValid = 0;
  const categories = new Map();
  const config = options.config || {};
  const rules = options.rules || {};
  const fictionPatterns = buildFictionPatterns(config, rules.fiction !== false);
  const leakOpts = options.productionLeakOptions || {};
  const textRuleJobs = [];
  const files = walkResult.files;
  const textRuleJobOptions = {
    productionLeak: rules.productionLeak !== false,
    agencyHandoff: rules.agencyHandoff !== false,
    euAiAct: rules.euAiAct !== false,
    tokenBleed: rules.tokenBleed !== false,
    architectureDrift: rules.architectureDrift !== false,
    fileNaming: rules.fileNaming !== false,
    security: rules.security !== false,
    euAiActSeverity: options.euAiActSeverity || "medium",
    productionPathsOnly: !isUniversal,
    productionPaths: config.productionPaths || [
      "server/",
      "src/",
      "app/",
      "lib/",
    ],
    productionLeakOptions: {
      ignoreGlobs:
        leakOpts.ignoreGlobs ||
        config.rules?.["production-leak"]?.ignoreGlobs ||
        config.ignore ||
        [],
      allowlistFiles:
        leakOpts.allowlistFiles ||
        config.rules?.["production-leak"]?.allowlistFiles ||
        [],
      scannerMetaFiles: leakOpts.scannerMetaFiles || [],
      severity: leakOpts.severity || "high",
      intentClassification: leakOpts.intentClassification !== false,
      plainSampleJson: leakOpts.plainSampleJson === true,
    },
    fictionPatterns,
  };
  const prodLeakIgnore = config.rules?.["production-leak"]?.ignoreGlobs || [];

  function applyFileInventory(file, io) {
    const bucket = categories.get(categoryForExt(file.ext)) || {
      category: categoryForExt(file.ext),
      fileCount: 0,
      totalSize: 0,
      issues: 0,
    };
    bucket.fileCount += 1;
    bucket.totalSize += file.size;
    categories.set(categoryForExt(file.ext), bucket);

    if (io.kind === "empty") {
      emptyFiles += 1;
      const baseName = path.basename(file.relativePath);
      const isIntentionallyEmpty =
        baseName === ".gitkeep" || baseName === "__init__.py";
      if (
        !isIntentionallyEmpty &&
        !isIgnoredRelativePath(file.relativePath, config.ignore || [])
      ) {
        bucket.issues += 1;
        issues.push({
          id: `empty-file-${file.relativePath}`,
          severity: "low",
          type: "Empty File",
          filePath: file.path,
          count: 1,
          description: `${file.relativePath}: empty file`,
          recommendedAction: "Remove or populate empty files",
          affectedFiles: [file.relativePath],
        });
      }
      return;
    }

    if (io.kind === "unreadable") {
      unreadableFiles += 1;
      return;
    }

    if (io.kind === "large") {
      filesLargeHashed += 1;
      filesHashed += 1;
      return;
    }

    const buf = io.buf;
    filesHashed += 1;
    const fileHash = hashBuffer(buf);

    if (isBinaryBuffer(buf)) {
      filesBinaryHashed += 1;
      file.hash = fileHash;
      return;
    }

    const content = buf.toString("utf8");
    filesContentScanned += 1;
    file.hash = fileHash;

    if (isIgnoredRelativePath(file.relativePath, config.ignore || [])) {
      return;
    }
    if (
      prodLeakIgnore.length &&
      isIgnoredRelativePath(file.relativePath, prodLeakIgnore)
    ) {
      return;
    }
    if (isExcludedPath(file.relativePath, { universal: isUniversal })) {
      return;
    }

    textRuleJobs.push({
      relativePath: file.relativePath,
      content,
      ext: file.ext,
      options: textRuleJobOptions,
    });

    if (file.ext === ".json" || file.name.endsWith(".json")) {
      const isNodeModules = file.relativePath.includes("node_modules");
      const isStdoutCapture =
        /-stdout\.json$/i.test(file.name) ||
        /report-stdout\.json$/i.test(file.name);
      if (!isNodeModules && !isStdoutCapture) {
        try {
          JSON.parse(content);
          jsonValid += 1;
        } catch (error) {
          jsonInvalid += 1;
          bucket.issues += 1;
          issues.push({
            id: `invalid-json-${file.relativePath}`,
            severity: "high",
            type: "Invalid JSON",
            filePath: file.path,
            count: 1,
            description: `${file.relativePath}: ${error?.message || String(error)}`,
            recommendedAction: "Fix JSON syntax errors",
            affectedFiles: [file.relativePath],
          });
        }
      }
    }
  }

  let cursor = 0;
  let processed = 0;
  let stop = false;
  let stopError = null;

  async function hashWorker() {
    while (!stop) {
      const index = cursor;
      cursor += 1;
      if (index >= files.length) return;
      const file = files[index];
      const io = await hashAndReadFile(file, maxContentBytes);
      if (stop) return;
      applyFileInventory(file, io);
      processed += 1;
      if (options.onProgress) {
        options.onProgress({
          processed,
          total: files.length,
          currentFile: file.relativePath,
        });
      }
      if (process.env.SIMPLEBEACON_LIVE_FILE_LOG === "1") {
        process.stderr.write(
          `[${processed}/${files.length}] ${file.relativePath}\n`,
        );
      } else if (
        !options.onProgress &&
        processed > 0 &&
        processed % BATCH_LOG_EVERY === 0
      ) {
        /* legacy batch log hook */
      }
      if (processed > 0 && processed % RESOURCE_SAMPLE_EVERY === 0) {
        try {
          sampleAndThrow({ filesFound: processed, phase: "walk" });
        } catch (err) {
          stop = true;
          stopError = err;
          console.error(err.message);
          throw err;
        }
      }
    }
  }

  const poolSize = resolveHashConcurrency(files.length);
  await Promise.all(
    Array.from({ length: poolSize }, () => hashWorker()),
  );
  if (stopError) throw stopError;

  const parallelWorkers = resolveWorkerCount(textRuleJobs.length, options);
  const passResults = await runTextRulePassesParallel(textRuleJobs, options);
  for (const passes of passResults) {
    if (!passes?.ok && !passes?.issues) continue;
    for (const issue of passes.issues || []) {
      issues.push(issue);
    }
    const counts = passes.counts || {};
    ruleHitTotals.credentials += counts.credentials || 0;
    ruleHitTotals.productionLeak += counts.productionLeak || 0;
    ruleHitTotals.llmSlop += counts.llmSlop || 0;
    ruleHitTotals.agencyHandoff += counts.agencyHandoff || 0;
    ruleHitTotals.fictionKpi += counts.fictionKpi || 0;
    ruleHitTotals.euAiAct += counts.euAiAct || 0;
    ruleHitTotals.tokenBleed += counts.tokenBleed || 0;
    ruleHitTotals.architectureDrift += counts.architectureDrift || 0;
    ruleHitTotals.fileNaming += counts.fileNaming || 0;
    ruleHitTotals.security += counts.security || 0;
    if (passes.euStats) {
      euHighRiskHits += passes.euStats.highRiskHits;
      euAiSystemHits += passes.euStats.aiSystemHits;
      euTransparencyGaps += passes.euStats.transparencyGaps;
    }
  }

  const filesAnalyzed = walkResult.files.length;
  let finalIssues = issues;
  if (rules.euAiAct !== false) {
    const documentation = detectDocumentationArtifacts(walkResult.projectRoot);
    finalIssues = filterDocumentedAiInventoryIssues(issues, documentation, {
      highRiskIndicators: euHighRiskHits,
      transparencyGaps: euTransparencyGaps,
    });
  }

  return {
    files: walkResult.files,
    inventory: {
      projectRoot: walkResult.projectRoot,
      totalFiles: walkResult.totalFiles,
      totalFolders: walkResult.totalFolders,
      profile: "full-tree",
    },
    stats: {
      filesAnalyzed,
      filesHashed,
      filesContentScanned,
      filesBinaryHashed,
      filesLargeHashed,
      metadataOnlyFiles: Math.max(
        0,
        filesAnalyzed -
          filesContentScanned -
          filesBinaryHashed -
          filesLargeHashed -
          emptyFiles -
          unreadableFiles,
      ),
      emptyFiles,
      unreadableFiles,
      jsonValid,
      jsonInvalid,
      truncated: walkResult.truncated,
      maxFiles: walkResult.maxFiles,
      maxContentBytes,
      ruleHitTotals,
      parallelTextRuleWorkers: parallelWorkers,
      hashConcurrency: poolSize,
      textRuleJobs: textRuleJobs.length,
    },
    issues: finalIssues,
    categories: [...categories.values()],
    euActStats: {
      highRiskHits: euHighRiskHits,
      aiSystemHits: euAiSystemHits,
      transparencyGaps: euTransparencyGaps,
    },
  };
}

module.exports = {
  analyzeFullDirectory,
  walkAllFiles,
  resolveMaxFiles,
  resolveMaxContentBytes,
  resolveHashConcurrency,
  DEFAULT_SKIP_DIRS,
};
