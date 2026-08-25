// simplebeacon-ignore: debugArtifacts,euAiAct,hardcodedIp — scanner service diagnostics and pattern definitions are false positives
import { showToast } from "../utils.js";
import {
  canUseDirectoryPicker,
  isLikelyWebkitDirectoryFileCap,
  browserFolderCapMessage,
  isEmbeddedDashboardFrame,
  browserLocalScanCapMessage,
} from "../utils-lib/dom.js?v=20260804largefolder1";
import { normalizeSimplebeaconReport } from "./analyzeService.js?v=20260726sevfix1";
import {
  createIgnoreContext,
  extractIgnorePatternsFromLegacyFiles,
  filterQueueByIgnore,
  getBrowserBuiltinIgnorePatterns,
  isIgnoredVirtualPath,
  loadIgnorePatternsFromDirHandle,
} from "../utils-lib/simplebeaconignore.browser.js?v=20260726ignorefix1";
// Vite base `/dashboard/` rewrites `new URL('../workers/scan-worker.js', import.meta.url)`
// to `/dashboard/scan-worker.js`, which Pages SPA-falls-back as text/html. Resolve at
// runtime under the active mount so /app and /dashboard both hit assets/scan-worker.js.
const WORKER_ASSET_VERSION = "20260804worker1";
function resolveScanWorkerUrl() {
  const v = WORKER_ASSET_VERSION;
  try {
    if (typeof location !== "undefined" && location.origin) {
      const path = String(location.pathname || "");
      const mount = path.startsWith("/dashboard")
        ? "/dashboard"
        : path.startsWith("/app")
          ? "/app"
          : null;
      if (mount) {
        return new URL(
          `${mount}/assets/scan-worker.js?v=${v}`,
          location.origin,
        );
      }
    }
  } catch (_locErr) {
    /* fall through */
  }
  try {
    // Dev module graph: worker lives beside services under ../workers/
    const base =
      typeof import.meta !== "undefined" && import.meta.url
        ? import.meta.url
        : "";
    if (base.includes("/assets/")) {
      return new URL(`./scan-worker.js?v=${v}`, base);
    }
    if (base) {
      return new URL(`../workers/scan-worker.js?v=${v}`, base);
    }
  } catch (_metaErr) {
    /* fall through */
  }
  return `/app/assets/scan-worker.js?v=${v}`;
}
const MAX_FILES = 999999999; // No cap — scan all files (matches legacy /audit page)
const MIN_FILES_FOR_PASS = 3; // Below this, gate cannot PASS — likely incomplete folder drop
const SCAN_BATCH_SIZE = 400;
const BATCH_TIMEOUT_MS = 10 * 60 * 1000;
const WORKER_START_TIMEOUT_MS = 15000;
const SKIP_DIRS =
  /(^|[\\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo[\\/]registry|\.cargo[\\/]git)([\\/]|$)/i;
const SCANABLE_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".txt",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".yml",
  ".yaml",
  ".xml",
  ".css",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".py",
  ".pyw",
  ".pyi",
  ".cs",
  ".vb",
  ".java",
  ".kt",
  ".scala",
  ".groovy",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".hpp",
  ".cxx",
  ".hxx",
  ".swift",
  ".dart",
  ".lua",
  ".r",
  ".pl",
  ".pm",
  ".tcl",
  ".asm",
  ".s",
  ".tf",
  ".sql",
  ".vue",
  ".svelte",
  ".html",
  ".htm",
  ".md",
  ".rst",
  ".toml",
  ".properties",
  ".gradle",
  ".sbt",
  ".dockerfile",
  ".makefile",
  ".cmake",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".babelrc",
  ".eslintrc",
  ".prettierrc",
  ".npmrc",
  ".nvmrc",
  ".lock",
  ".feature",
  ".story",
]);
/**
 * Ensure the directory handle has read permission before iterating entries.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<boolean>}
 */
async function ensureReadPermission(dirHandle) {
  if (!dirHandle || typeof dirHandle.requestPermission !== "function")
    return true;
  try {
    const perm = await dirHandle.requestPermission({ mode: "read" });
    if (perm !== "granted") {
      console.warn("[collectFiles] requestPermission returned:", perm);
      return false;
    }
  } catch (err) {
    console.warn("[collectFiles] requestPermission threw:", err);
    return false;
  }
  return true;
}

/**
 * Recursively collect FileSystemFileHandle entries from a directory handle.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} pathPrefix
 * @param {Array<{path:string, handle:FileSystemFileHandle}>} files
 * @returns {Promise<Array<{path:string, handle:FileSystemFileHandle}>>}
 */
async function collectFiles(
  dirHandle,
  pathPrefix = "",
  files = [],
  ignoreCtx = null,
  onCollectProgress = null,
) {
  if (files.length >= MAX_FILES) return files;
  if (
    ignoreCtx &&
    pathPrefix &&
    isIgnoredVirtualPath(pathPrefix, ignoreCtx.scanRootName, ignoreCtx.patterns)
  ) {
    return files;
  }
  if (!pathPrefix) {
    await ensureReadPermission(dirHandle);
  }
  let entryCount = 0;
  let ignoredCount = 0;
  let skippedDirCount = 0;
  let firstEntries = [];
  let lastProgressAt = 0;
  for await (const [name, handle] of dirHandle.entries()) {
    if (entryCount < 5 && !pathPrefix) {
      firstEntries.push(`${name} (${handle.kind})`);
    }
    const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (
      ignoreCtx &&
      isIgnoredVirtualPath(fullPath, ignoreCtx.scanRootName, ignoreCtx.patterns)
    ) {
      ignoredCount++;
      continue;
    }
    if (SKIP_DIRS.test(fullPath)) {
      skippedDirCount++;
      continue;
    }
    if (handle.kind === "directory") {
      try {
        const subDirHandle = await dirHandle.getDirectoryHandle(name);
        if (await ensureReadPermission(subDirHandle)) {
          await collectFiles(
            subDirHandle,
            fullPath,
            files,
            ignoreCtx,
            onCollectProgress,
          );
        }
      } catch (dirErr) {
        console.warn(
          "[collectFiles] Could not traverse directory:",
          fullPath,
          dirErr,
        );
      }
    } else if (handle.kind === "file") {
      if (name === ".simplebeaconignore") continue;
      const dotIdx = name.lastIndexOf(".");
      const ext = dotIdx >= 0 ? name.substring(dotIdx).toLowerCase() : "";
      if (ext && !SCANABLE_EXTENSIONS.has(ext)) continue;
      files.push({ path: fullPath, handle });
    }
    if (files.length >= MAX_FILES) break;
    entryCount += 1;
    if (onCollectProgress && files.length - lastProgressAt >= 100) {
      lastProgressAt = files.length;
      onCollectProgress(files.length, pathPrefix || dirHandle.name);
    }
    if (entryCount % 500 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  if (!pathPrefix) {
    console.warn(
      "[collectFiles] Root dir:",
      dirHandle.name,
      "| entries seen:",
      entryCount,
      "| files collected:",
      files.length,
      "| ignored:",
      ignoredCount,
      "| skipped dirs:",
      skippedDirCount,
      "| first entries:",
      firstEntries.join(", "),
    );
  }
  return files;
}
/**
 * Build a Simplebeacon-compatible report from worker findings.
 * @param {string} projectName
 * @param {Array<Object>} findings
 * @param {number} totalFiles
 * @param {number} analyzedFiles
 * @param {Object} [meta]
 * @returns {Object}
 */
function countFoldersFromPaths(paths) {
  const folders = new Set();
  for (const p of paths || []) {
    const normalized = String(p).replace(/\\/g, "/");
    const parts = normalized.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      if (acc) folders.add(acc);
    }
  }
  return folders.size;
}
function buildReport(
  projectName,
  findings,
  totalFiles,
  analyzedFiles,
  meta = {},
) {
  const categories = {};
  const findingsList = [];
  const rawIssues = [];
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const totalFolders = meta.folderCount || 0;
  if (totalFiles === 0) {
    findingsList.push({
      category: "scan-empty",
      file: "",
      line: 0,
      severity: "high",
      message:
        "No files were discovered. The folder may be empty, permission was denied, or all entries were excluded.",
    });
    severityCounts.high += 1;
    categories["scan-empty"] = {
      severity: "high",
      findings: [findingsList[0]],
    };
  }
  for (const f of findings || []) {
    const rule = f.rule || f.analyzer || "finding";
    const severity = String(f.severity || "medium").toLowerCase();
    const count = Number(f.count) || 1;
    if (severityCounts[severity] !== undefined)
      severityCounts[severity] += count;
    if (!categories[rule]) categories[rule] = { severity, findings: [] };
    const entry = {
      file: f.filePath,
      line: f.line || 1,
      message: f.impact || `${rule} finding`,
      severity,
      count,
    };
    categories[rule].findings.push(entry);
    findingsList.push({
      category: rule,
      file: f.filePath,
      line: f.line || 1,
      severity,
      message: f.impact || `${rule} finding`,
      count,
    });
    rawIssues.push({
      type: rule,
      filePath: f.filePath || "",
      line: f.line || 1,
      severity,
      description: f.impact || `${rule} finding`,
      count,
    });
  }
  const totalFindings = rawIssues.reduce((sum, i) => sum + (i.count || 1), 0);
  const issueCount = totalFindings;
  const blockingCount = rawIssues
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .reduce((sum, i) => sum + (Number(i.count) || 1), 0);
  const incompleteDrop = totalFiles > 0 && totalFiles < MIN_FILES_FOR_PASS;
  // Incomplete drops must not score 100 — that produced false "Windows PASS" UX
  const gateScore =
    blockingCount === 0 && totalFiles >= MIN_FILES_FOR_PASS ? 100 : 0;
  const mockSampleFiles = (meta.filePaths || []).filter((p) =>
    /sample|mock|fixture|test.*data/i.test(String(p)),
  ).length;
  const capped = false; // No cap — MAX_FILES is 999M (matches legacy /audit page)
  // === File inventory breakdown (ported from legacy scanner-engine.js) ===
  const filePaths = meta.filePaths || [];
  const fileInventory = {
    sourceCode: filePaths.filter((p) =>
      /\.(js|cjs|mjs|ts|tsx|jsx|py|java|kt|go|rs|php|rb|cs|vb|c|cpp|h|hpp|swift|scala|groovy)$/i.test(
        p,
      ),
    ).length,
    markup: filePaths.filter((p) =>
      /\.(html|htm|xml|svg|vue|svelte|astro)$/i.test(p),
    ).length,
    config: filePaths.filter((p) =>
      /\.(json|yaml|yml|toml|ini|cfg|conf|env|properties)$/i.test(p),
    ).length,
    docs: filePaths.filter((p) => /\.(md|markdown|mdx|txt|rst|adoc)$/i.test(p))
      .length,
    buildArtifacts: filePaths.filter((p) =>
      /\.(map|min\.js|bundle\.js|pack\.js|wasm|rlib|rmeta)$/i.test(p),
    ).length,
    testFixtures: filePaths.filter(
      (p) =>
        /(?:^|\/)(__tests__|tests?|fixtures?|mocks?|spec)/i.test(p) ||
        /\.(test|spec)\.[a-z0-9]+$/i.test(p),
    ).length,
    other: 0,
  };
  fileInventory.other = Math.max(
    0,
    totalFiles -
      fileInventory.sourceCode -
      fileInventory.markup -
      fileInventory.config -
      fileInventory.docs -
      fileInventory.buildArtifacts -
      fileInventory.testFixtures,
  );
  // === Removable files detection (ported from legacy scanner-engine.js) ===
  const removableFiles = filePaths
    .filter(
      (p) =>
        /(^|\/)(node_modules|\.git|dist|build|out|coverage|\.next|target|\.wrangler|\.cargo|logs?|cache|\.cache|tmp|temp|backups)(\/|$)/i.test(
          p,
        ) ||
        /\.(log|tmp|bak|swp|cache|pyc|class|jar|war|wasm|rlib|o|a|so|dylib|dll|exe)$/i.test(
          p,
        ),
    )
    .map((p) => ({
      path: p,
      reason: "Build artifact, cache, or generated file",
    }));
  // === Diagnostic report (ported from legacy scanner-engine.js) ===
  const diagnosticReport = {
    rawFiles: totalFiles,
    filteredFiles: totalFiles,
    scannedFiles: analyzedFiles,
    readErrors: meta.telemetry?.textErrors || 0,
    largeFileSkips: meta.telemetry?.binarySkipped || 0,
    fileErrors: meta.telemetry?.fileErrors || 0,
    ignoredDirs: meta.telemetry?.ignoredDir || 0,
    heavyVendor: meta.telemetry?.heavyVendor || 0,
    ignoredByPattern: meta.telemetry?.ignoredByPattern || 0,
    unaccounted: Math.max(
      0,
      totalFiles -
        analyzedFiles -
        (meta.telemetry?.binarySkipped || 0) -
        (meta.telemetry?.textErrors || 0),
    ),
  };
  // === Quality scorecard (6 dimensions, ported from legacy scanner-engine.js) ===
  const qualityScorecard = {
    accuracy: blockingCount === 0 ? 100 : Math.max(0, 100 - blockingCount * 10),
    completeness:
      totalFiles >= MIN_FILES_FOR_PASS
        ? 100
        : Math.round((totalFiles / MIN_FILES_FOR_PASS) * 100),
    consistency:
      rawIssues.filter((i) => i.severity === "medium").length === 0
        ? 100
        : Math.max(
            0,
            100 - rawIssues.filter((i) => i.severity === "medium").length * 5,
          ),
    timeliness: 100, // No staleness check in browser scan
    validity: gateScore,
    integrity:
      mockSampleFiles === 0 ? 100 : Math.max(0, 100 - mockSampleFiles * 10),
  };
  const scanLimitNote = meta.issuesTruncated
    ? `Findings capped at ${rawIssues.length.toLocaleString()} for browser memory. Download JSON or use the CLI for the full list.`
    : capped
      ? `Browser local scan inventory capped at ${MAX_FILES.toLocaleString()} files. Run: npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json`
      : null;
  const incompleteDropNote = incompleteDrop
    ? `Only ${totalFiles} file${totalFiles === 1 ? "" : "s"} discovered — this is likely an incomplete folder drop (common for OS/system directories). No full-repo PASS was recorded. Use Select Folder on a project tree, or run: npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json`
    : null;
  const limitations = [
    `Repository inventory: ${totalFiles} files, ${totalFolders} folders — gate rules checked ${analyzedFiles} files.`,
    "Pattern matching on file contents — not LLM semantic review.",
    "Jest not executed during scan — use npm test separately.",
  ];
  if (scanLimitNote) limitations.unshift(scanLimitNote);
  if (incompleteDropNote) limitations.unshift(incompleteDropNote);
  return {
    type: "simplebeacon-report",
    version: "1.0.0",
    reportVersion: 2,
    generatedAt: new Date().toISOString(),
    scanSource: "browser-local",
    projectPath: projectName,
    projectRoot: projectName,
    summary: {
      totalFiles,
      codeFilesAnalyzed: analyzedFiles,
      codeFilesDiscovered: totalFiles,
      totalFindings,
      severityCounts,
    },
    categories,
    findings: findingsList,
    rawIssues,
    detectedIssues: rawIssues,
    issueCount,
    severityCounts,
    repositoryFilesTotal: totalFiles,
    ruleScopedFilesAnalyzed: analyzedFiles,
    mockSampleFiles,
    qualityScore: gateScore,
    consistencyScore: gateScore,
    inventory: { totalFiles, totalFolders, scannedFiles: analyzedFiles },
    repositoryInventory: { totalFiles, totalFolders, projectRoot: projectName },
    repositoryFoldersTotal: totalFolders,
    scanScope: {
      profile: "standard",
      rulesEnabled: [
        "credential-patterns",
        "production-leak-patterns",
        "sensitive-data",
        "config-drift",
        "security-vulnerabilities",
        "ai-residue",
        "llm-slop",
        "fiction-kpi",
        "code-quality",
        "maintainability",
      ],
      gatePolicy: { failOn: ["critical", "high"], warnOn: ["medium", "low"] },
      mockSampleFilesInScanPaths: mockSampleFiles,
      productionDirsScanned: null,
      productionPaths: [],
      ruleScopedFilesAnalyzed: analyzedFiles,
      repositoryFilesTotal: totalFiles,
      repositoryFoldersTotal: totalFolders,
      fictionJsonFilesScanned: null,
      fictionSampleFilesScanned: null,
      fictionScope: "repository-json",
      jestExecutedDuringScan: false,
      pageSpecCatalogSize: null,
      pageSpecsValidated: null,
      pageSpecsFromScanPaths: 0,
      pageSpecsFromAliasPaths: 0,
      fullDirectoryScan: !capped,
      limitations,
    },
    ignoreMeta: meta.ignoreMeta || null,
    telemetry: meta.telemetry || null,
    gate: {
      pass: blockingCount === 0 && totalFiles >= MIN_FILES_FOR_PASS,
      blockingCount,
      warningCount: totalFindings - blockingCount,
      score: gateScore,
      incompleteDrop,
    },
    issuesTruncated: Boolean(meta.issuesTruncated),
    scanLimitNote,
    incompleteDropNote,
    fileInventory,
    removableFiles: removableFiles.slice(0, 100), // Cap at 100 for UI
    removableFilesTotal: removableFiles.length,
    diagnosticReport,
    qualityScorecard,
  };
}
/**
 * Run batched scan through the worker to avoid postMessage limits on large repos.
 * @param {Worker} worker
 * @param {Array} workerFiles
 * @param {Object} options
 * @returns {Promise<Object>}
 */
function runBatchedWorkerScan(worker, workerFiles, options = {}) {
  const scanId = crypto.randomUUID();
  const totalFiles = workerFiles.length;
  const ignoreCtx = options.ignoreCtx || null;
  const deepScan = options.deepScan !== false; // Default to true (scan all files)
  let fileErrors = 0;
  const fileErrorExamples = [];
  const SCAN_OVERALL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes overall safeguard
  return new Promise((resolve, reject) => {
    let settled = false;
    let workerStarted = false;
    let workerStartTimer = null;
    let overallTimer = null;
    const cleanup = (terminate = true) => {
      if (settled) return;
      settled = true;
      if (workerStartTimer) clearTimeout(workerStartTimer);
      if (overallTimer) clearTimeout(overallTimer);
      if (terminate) worker.terminate();
    };
    worker.onerror = (err) => {
      cleanup();
      const detail = err.message || (err.error && err.error.message) || "";
      const loc = err.filename
        ? ` at ${err.filename}:${err.lineno || 0}:${err.colno || 0}`
        : "";
      const workerUrl = String(
        (() => {
          const u = resolveScanWorkerUrl();
          return u && u.href ? u.href : u;
        })(),
      );
      // Provide a more actionable error when the worker script fails to load (CSP, 404, network).
      // This commonly happens on hosted dashboards when the worker URL resolves to the wrong path.
      if (!detail) {
        reject(
          new Error(
            `Local scan worker failed to load from ${workerUrl}${loc}. Check your browser console for network/CSP errors.`,
          ),
        );
      } else {
        reject(
          new Error(`Worker error: ${detail}${loc} (worker: ${workerUrl})`),
        );
      }
    };
    worker.onmessage = async (e) => {
      const {
        type,
        processed,
        total,
        issues,
        error,
        issuesTruncated,
        totalFiles: completeTotal,
        currentFile,
        binarySkipped,
        textErrors,
        ignoredDir,
        heavyVendor,
        ignoredByPattern,
      } = e.data;
      if (type === "started") {
        workerStarted = true;
        if (workerStartTimer) clearTimeout(workerStartTimer);
        try {
          window["console"]["warn"](
            `[localScan] Worker started for ${totalFiles.toLocaleString()} files (scanId=${scanId})`,
          );
        } catch (_startLogErr) {}
        if (options.onProgress) {
          options.onProgress(0, totalFiles, {
            currentFile: "Scanner worker initialized",
          });
        }
        return;
      }
      if (e.data && e.data.type === "file-error") {
        try {
          fileErrors += 1;
          if (fileErrorExamples.length < 20) {
            fileErrorExamples.push({
              file: e.data.file,
              name: e.data.name,
              message: e.data.message,
            });
          }
          if (options.onFileError) {
            try {
              options.onFileError(e.data.file, {
                name: e.data.name,
                message: e.data.message,
                stack: e.data.stack,
              });
            } catch (_a) {}
          }
        } catch (_b) {}
        // continue processing other message types
      }
      if (type === "batch-started") {
        const batchNum =
          Math.floor((e.data.batchOffset || 0) / SCAN_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalFiles / SCAN_BATCH_SIZE);
        try {
          window["console"]["warn"](
            `[localScan] Batch ${batchNum}/${totalBatches} started (offset=${e.data.batchOffset}, size=${e.data.batchSize}, processed=${e.data.processed}/${e.data.total})`,
          );
        } catch (_batchLogErr) {}
        if (options.onProgress) {
          options.onProgress(e.data.processed, e.data.total, {
            currentFile: `Batch ${batchNum}/${totalBatches} processing...`,
          });
        }
      }
      if (type === "progress" && options.onProgress) {
        options.onProgress(processed, total, {
          currentFile,
          ignoredDir,
          heavyVendor,
          ignoredByPattern,
        });
      }
      if (type === "batch-complete" && options.onProgress) {
        options.onProgress(processed, total, {
          currentFile:
            currentFile ||
            `Batch ${Math.floor((e.data.batchOffset || 0) / SCAN_BATCH_SIZE) + 1} complete`,
          ignoredDir: e.data.ignoredDir,
          heavyVendor: e.data.heavyVendor,
          ignoredByPattern: e.data.ignoredByPattern,
        });
      }
      if (type === "error") {
        cleanup();
        reject(new Error(error || "Local scan failed"));
      }
      if (type === "complete") {
        cleanup();
        const resolvedTotal = completeTotal || totalFiles;
        const analyzedFiles = Math.max(
          0,
          (processed || 0) - (binarySkipped || 0) - (textErrors || 0),
        );
        const folderCount = countFoldersFromPaths(
          workerFiles.map((f) => f.path),
        );
        const filePaths = workerFiles.map((f) => f.path);
        resolve(
          buildReport(
            options.projectName || "local-project",
            issues,
            resolvedTotal,
            analyzedFiles,
            {
              issuesTruncated,
              capped: false,
              folderCount,
              filePaths,
              ignoreMeta: options.ignoreCtx
                ? {
                    source: options.ignoreCtx.source || "builtin",
                    patternCount: options.ignoreCtx.patterns?.length || 0,
                    scanRootName: options.ignoreCtx.scanRootName || "",
                  }
                : null,
              telemetry: {
                ignoredDir: ignoredDir || 0,
                heavyVendor: heavyVendor || 0,
                ignoredByPattern: ignoredByPattern || 0,
                binarySkipped: binarySkipped || 0,
                textErrors: textErrors || 0,
                fileErrors: fileErrors || 0,
                fileErrorExamples: fileErrorExamples.length
                  ? fileErrorExamples
                  : undefined,
              },
            },
          ),
        );
      }
    };
    worker.postMessage({
      type: "scan-start",
      scanId,
      totalFiles,
      deepScan,
      ignoreCtx: ignoreCtx
        ? { scanRootName: ignoreCtx.scanRootName, patterns: ignoreCtx.patterns }
        : null,
    });
    workerStartTimer = setTimeout(() => {
      if (workerStarted || settled) return;
      cleanup();
      reject(
        new Error(
          "Local scan worker did not initialize in time. This is often caused by blocked worker module imports in hosted/embedded mode. Reload and try again, or run via the Local Agent/CLI.",
        ),
      );
    }, WORKER_START_TIMEOUT_MS);
    overallTimer = setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(
        new Error(
          `Local scan exceeded overall timeout of ${Math.round(SCAN_OVERALL_TIMEOUT_MS / 60000)} minutes. The project may be too large for browser scanning — use the CLI for unlimited coverage.`,
        ),
      );
    }, SCAN_OVERALL_TIMEOUT_MS);
    (async () => {
      try {
        for (
          let offset = 0;
          offset < workerFiles.length;
          offset += SCAN_BATCH_SIZE
        ) {
          const batch = workerFiles.slice(offset, offset + SCAN_BATCH_SIZE);
          await new Promise((batchResolve, batchReject) => {
            let batchTimer = null;
            const finishBatch = (fn) => {
              if (batchTimer) clearTimeout(batchTimer);
              worker.removeEventListener("message", onBatch);
              fn();
            };
            const onBatch = (ev) => {
              if (ev.data.scanId !== scanId) return;
              if (
                ev.data.type === "batch-complete" &&
                ev.data.batchOffset === offset
              ) {
                finishBatch(() => batchResolve());
              }
              if (ev.data.type === "error") {
                finishBatch(() =>
                  batchReject(new Error(ev.data.error || "Batch scan failed")),
                );
              }
            };
            worker.addEventListener("message", onBatch);
            batchTimer = setTimeout(() => {
              finishBatch(() => {
                window["console"]["warn"](
                  `[localScan] Batch at offset ${offset} timed out — skipping ${batch.length} files and continuing`,
                );
                batchResolve();
              });
            }, BATCH_TIMEOUT_MS);
            worker.postMessage({
              type: "scan-batch",
              scanId,
              batchOffset: offset,
              files: batch,
              deepScan,
            });
          });
        }
        worker.postMessage({ type: "scan-finish", scanId });
      } catch (err) {
        cleanup();
        reject(err);
      }
    })();
  });
}
/**
 * Run a local browser-based scan against a directory selected by the user.
 * No file contents are ever sent to the server.
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @param {(processed:number, total:number) => void} [options.onProgress]
 * @param {(file:string, err:any) => void} [options.onFileError] Optional callback invoked for per-file access errors (e.g. NotFoundError)
 * @param {(processed:number, total:number, label:string) => void} [options.onFilePrepProgress] Optional callback invoked during file preparation (filtering, dedup) before the worker scan starts.
 * @param {FileSystemDirectoryHandle} [options.dirHandle] Optional directory handle from drag-and-drop.
 * @param {FileList|File[]} [options.files] Optional dropped files (legacy directory entry) to scan locally.
 * @param {string} [options.projectPath] Optional display path/label to use as projectPath in the report.
 * @param {boolean} [options.deepScan=true] When true, bypass vendor/docs/build filters to scan all files.
 * @returns {Promise<Object>}
 */
export async function runLocalScan(options = {}) {
  if (!options.files && !options.dirHandle && !canUseDirectoryPicker()) {
    throw new Error(
      "Your browser does not support the local directory picker. Use Chrome/Edge or run the server locally.",
    );
  }
  const onFilePrepProgress =
    typeof options.onFilePrepProgress === "function"
      ? options.onFilePrepProgress
      : null;
  let projectName = options.projectPath || "local-project";
  let files = [];
  let ignoreCtx = null;
  if (options.files && options.files.length) {
    const fileArray = Array.from(options.files);
    if (onFilePrepProgress)
      onFilePrepProgress(0, fileArray.length, "Reading file list...");
    const firstRel =
      fileArray[0]._virtualPath ||
      fileArray[0].webkitRelativePath ||
      fileArray[0].name ||
      "";
    // Prefer the root directory name from the actual FileList over any caller-supplied label;
    // this ensures ignore-pattern root-stripping matches the selected folder.
    projectName =
      firstRel.split("/")[0] || options.projectPath || "local-project";
    if (onFilePrepProgress)
      onFilePrepProgress(0, fileArray.length, "Loading ignore patterns...");
    const ignoreLoad = await extractIgnorePatternsFromLegacyFiles(fileArray);
    ignoreCtx = createIgnoreContext(
      ignoreLoad.patterns,
      projectName,
      ignoreLoad.source,
    );
    console.warn(
      "[localScan] fileInput",
      fileArray.length,
      "files; projectName=",
      projectName,
      "firstRel=",
      firstRel,
      "ignoreSource=",
      ignoreCtx.source,
      "ignorePatterns=",
      ignoreCtx.patterns.length,
    );
    if (onFilePrepProgress)
      onFilePrepProgress(0, fileArray.length, "Filtering files...");
    // Async filter to yield to UI every 5000 files (prevents freezing on large lists)
    files = [];
    for (let i = 0; i < fileArray.length; i++) {
      const f = fileArray[i];
      if (onFilePrepProgress && i % 5000 === 0)
        onFilePrepProgress(i, fileArray.length, "Filtering files...");
      const path = f._virtualPath || f.webkitRelativePath || f.name;
      if (
        !isIgnoredVirtualPath(path, ignoreCtx.scanRootName, ignoreCtx.patterns)
      ) {
        files.push({ path, handle: f });
      }
      if (i % 5000 === 0 && i > 0) await new Promise((r) => setTimeout(r, 0));
    }
    // Deduplicate by normalized path — Windows symlinks/junctions (pnpm node_modules)
    // cause the same file to appear multiple times during recursive directory traversal.
    if (onFilePrepProgress)
      onFilePrepProgress(
        files.length,
        fileArray.length,
        "Deduplicating paths...",
      );
    const _seen = new Set();
    const deduped = [];
    for (let i = 0; i < files.length; i++) {
      if (onFilePrepProgress && i % 5000 === 0)
        onFilePrepProgress(i, files.length, "Deduplicating paths...");
      const key = String(files[i].path).replace(/\\/g, "/").toLowerCase();
      if (!_seen.has(key)) {
        _seen.add(key);
        deduped.push(files[i]);
      }
      if (i % 5000 === 0 && i > 0) await new Promise((r) => setTimeout(r, 0));
    }
    files = deduped;
    // If the user's .simplebeaconignore filtered out every file, fall back to built-in
    // exclusions so a misconfigured catch-all doesn't silently block the scan.
    if (files.length === 0 && fileArray.length > 0) {
      console.warn(
        "[localScan] All",
        fileArray.length,
        "files were excluded by",
        ignoreCtx.source,
        "rules. Falling back to built-in ignore patterns.",
      );
      ignoreCtx = createIgnoreContext(
        getBrowserBuiltinIgnorePatterns(ignoreLoad.isSimplebeaconMonorepo),
        projectName,
        "builtin",
      );
      files = fileArray
        .filter((f) => {
          const path = f._virtualPath || f.webkitRelativePath || f.name;
          return !isIgnoredVirtualPath(
            path,
            ignoreCtx.scanRootName,
            ignoreCtx.patterns,
          );
        })
        .map((f) => ({
          path: f._virtualPath || f.webkitRelativePath || f.name,
          handle: f,
        }));
      const seen = new Set();
      files = files.filter((f) => {
        const key = String(f.path).replace(/\\/g, "/").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (files.length > 0) {
        showToast(
          `Your .simplebeaconignore excluded all files; scanned with built-in exclusions instead.`,
          "warning",
          { duration: 7000 },
        );
      }
    }
  } else {
    const dirHandle = options.dirHandle;
    if (!dirHandle) {
      if (isEmbeddedDashboardFrame() || !canUseDirectoryPicker()) {
        throw new Error(
          "Folder picker is blocked in this embed. Use drag-and-drop, the legacy Browse dialog, or scan via the Local Agent with a typed path.",
        );
      }
      const picked = await window.showDirectoryPicker();
      projectName = options.projectPath || picked.name || "local-project";
      if (picked.requestPermission) {
        const perm = await picked.requestPermission({ mode: "read" });
        if (perm !== "granted") {
          throw new Error(
            `Read permission was not granted for "${projectName}". Browser returned: ${perm}`,
          );
        }
      }
      const ignoreLoad = await loadIgnorePatternsFromDirHandle(picked);
      ignoreCtx = createIgnoreContext(
        ignoreLoad.patterns,
        projectName,
        ignoreLoad.source,
      );
      if (onFilePrepProgress) onFilePrepProgress(0, 0, "Discovering files...");
      files = await collectFiles(
        picked,
        "",
        [],
        ignoreCtx,
        (count, currentDir) => {
          if (onFilePrepProgress)
            onFilePrepProgress(
              count,
              0,
              `Discovering files... ${count.toLocaleString()} found in ${currentDir}`,
            );
        },
      );
    } else {
      projectName = options.projectPath || dirHandle.name || "local-project";
      if (dirHandle.requestPermission) {
        const perm = await dirHandle.requestPermission({ mode: "read" });
        if (perm !== "granted") {
          throw new Error(
            `Read permission was not granted for "${projectName}". Browser returned: ${perm}`,
          );
        }
      }
      const ignoreLoad = await loadIgnorePatternsFromDirHandle(dirHandle);
      ignoreCtx = createIgnoreContext(
        ignoreLoad.patterns,
        projectName,
        ignoreLoad.source,
      );
      if (onFilePrepProgress) onFilePrepProgress(0, 0, "Discovering files...");
      files = await collectFiles(
        dirHandle,
        "",
        [],
        ignoreCtx,
        (count, currentDir) => {
          if (onFilePrepProgress)
            onFilePrepProgress(
              count,
              0,
              `Discovering files... ${count.toLocaleString()} found in ${currentDir}`,
            );
        },
      );
    }
  }
  const beforeIgnoreCount = files.length;
  files = filterQueueByIgnore(
    files.map((f) => ({ ...f, virtualPath: f.path })),
    ignoreCtx,
  ).map((f) => ({ path: f.path || f.virtualPath, handle: f.handle }));
  if (ignoreCtx && files.length < beforeIgnoreCount) {
    showToast(
      `Excluded ${beforeIgnoreCount - files.length} paths via ${ignoreCtx.source || "ignore"} rules.`,
      "info",
      { duration: 5000 },
    );
  }
  if (files.length === 0) {
    const excluded = Math.max(0, beforeIgnoreCount - files.length);
    throw new Error(
      `No files were found in "${projectName}" (collected ${beforeIgnoreCount} before exclusions; ${excluded} excluded${ignoreCtx?.source ? ` via ${ignoreCtx.source}` : ""}). The folder may be empty, permission was denied, or all files were excluded. Try selecting the folder again or use the local agent.`,
    );
  }
  if (options.files && isLikelyWebkitDirectoryFileCap(files.length)) {
    showToast(
      browserFolderCapMessage(files.length).replace(/\*\*/g, ""),
      "warning",
      { duration: 14000 },
    );
  }
  if (files.length > 3000) {
    showToast(
      `Scanning ${files.length.toLocaleString()} files locally — this may take a few minutes.`,
      "info",
      { duration: 6000 },
    );
  }
  if (onFilePrepProgress)
    onFilePrepProgress(
      files.length,
      files.length,
      `Starting scan of ${files.length.toLocaleString()} files...`,
    );
  const workerFiles = files.map((f) => ({ path: f.path, fileObj: f.handle }));
  if (options.onProgress) {
    options.onProgress(0, workerFiles.length, {
      currentFile: "Initializing scanner worker...",
    });
  }
  let worker;
  let blobUrlForWorker = null;
  try {
    const resolvedWorkerUrl = resolveScanWorkerUrl();
    const workerUrlStr = String(
      resolvedWorkerUrl && resolvedWorkerUrl.href
        ? resolvedWorkerUrl.href
        : resolvedWorkerUrl,
    );
    console.warn("[localScan] Creating module worker from:", workerUrlStr);
    // Firefox has issues with query parameters in module worker URLs — strip them as a fallback
    let workerUrlForCreation = resolvedWorkerUrl;
    try {
      const parsed = new URL(workerUrlStr);
      if (
        parsed.search &&
        navigator.userAgent.toLowerCase().includes("firefox")
      ) {
        parsed.search = "";
        const cleanUrl = parsed.href;
        console.warn(
          "[localScan] Firefox detected — stripping query param from worker URL:",
          cleanUrl,
        );
        workerUrlForCreation = cleanUrl;
      }
    } catch (_e) {
      /* ignore URL parse errors */
    }

    try {
      // Try normal worker construction first
      worker = new Worker(workerUrlForCreation, { type: "module" });
    } catch (ctorErr) {
      console.error("localScanService.js error:", ctorErr);
      // If construction fails (CORS, Firefox module query issues, or other), attempt a fetch+blob fallback
      try {
        console.warn(
          "[localScan] Worker construction failed, attempting fetch+blob fallback:",
          ctorErr?.message || ctorErr,
        );
        const resp = await fetch(String(workerUrlForCreation));
        if (!resp.ok)
          throw new Error(`Fetch failed with status ${resp.status}`);
        const ct = String(resp.headers.get("content-type") || "").toLowerCase();
        const scriptText = await resp.text();
        if (ct.includes("text/html") || /^\s*</.test(scriptText)) {
          throw new Error(
            `Worker URL returned HTML instead of JavaScript (${workerUrlStr})`,
          );
        }
        const blob = new Blob([scriptText], { type: "application/javascript" });
        blobUrlForWorker = URL.createObjectURL(blob);
        console.warn(
          "[localScan] Created blob URL for worker; will keep alive until worker confirms start",
        );
        worker = new Worker(blobUrlForWorker, { type: "module" });
      } catch (fbErr) {
        console.error("[localScan] fetch+blob fallback failed:", fbErr);
        throw ctorErr; // rethrow original constructor error to surface the root cause
      }
    }
  } catch (workerCtorErr) {
    const resolvedWorkerUrl = resolveScanWorkerUrl();
    const workerUrlStr = String(
      resolvedWorkerUrl && resolvedWorkerUrl.href
        ? resolvedWorkerUrl.href
        : resolvedWorkerUrl,
    );
    console.error("[localScan] new Worker() constructor threw:", workerCtorErr);
    throw new Error(
      `Failed to create module worker from ${workerUrlStr}: ${workerCtorErr?.message || workerCtorErr}. Your browser may not support module workers. Try Chrome/Edge, or run the scan via the CLI.`,
    );
  }

  // If we created a blob URL for the worker script, keep it alive until the worker posts its first message or errors.
  if (blobUrlForWorker) {
    const cleanupBlobUrl = () => {
      try {
        URL.revokeObjectURL(blobUrlForWorker);
        console.warn("[localScan] Revoked blob URL used for worker");
      } catch (e) {
        console.warn("[localScan] Failed to revoke worker blob URL:", e);
      }
    };
    const onFirst = () => {
      cleanupBlobUrl();
      worker.removeEventListener("message", onFirst);
      worker.removeEventListener("error", onFirst);
    };
    worker.addEventListener("message", onFirst, { once: true });
    worker.addEventListener("error", onFirst, { once: true });
    // As a safety, revoke after an extended timeout if the worker never responds
    setTimeout(() => {
      try {
        cleanupBlobUrl();
      } catch (_) {}
    }, 60_000);
  }
  if (options.signal) {
    options.signal.addEventListener("abort", () => worker.terminate(), {
      once: true,
    });
  }
  const report = await runBatchedWorkerScan(worker, workerFiles, {
    onProgress: options.onProgress,
    projectName,
    ignoreCtx,
    deepScan: options.deepScan !== false, // Default to true (scan all files)
  });
  return normalizeSimplebeaconReport(report);
}
/**
 * Local scan service compatible with the dashboard's ScanService API.
 */
export class LocalScanService {
  constructor() {
    this.report = null;
  }
  async runScan(options) {
    this.report = await runLocalScan(options);
    return this.report;
  }
  async fetchReport() {
    return this.report;
  }
  async fetchRepositoryInventory() {
    return this.report ? this.report.inventory : null;
  }
  async fetchHistory() {
    return [];
  }
  async fetchBaseline() {
    return null;
  }
  async fetchConfig() {
    return null;
  }
}
