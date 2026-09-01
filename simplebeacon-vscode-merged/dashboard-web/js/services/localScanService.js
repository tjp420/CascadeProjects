// simplebeacon-ignore documentation
import { showToast } from "../utils.js";
import {
  canUseDirectoryPicker,
  filePickerBlockedMessage,
  browserLocalScanCapMessage,
} from "../utils-lib/dom.js";

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
const SKIP_DIRS =
  /(^|[\\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp)([\\/]|$)/i;

/**
 * Recursively collect FileSystemFileHandle entries from a directory handle.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} pathPrefix
 * @param {Array<{path:string, handle:FileSystemFileHandle}>} files
 * @returns {Promise<Array<{path:string, handle:FileSystemFileHandle}>>}
 */
async function collectFiles(dirHandle, pathPrefix = "", files = []) {
  if (files.length >= MAX_FILES) return files;
  for await (const [name, handle] of dirHandle.entries()) {
    const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (SKIP_DIRS.test(fullPath)) continue;
    if (handle.kind === "directory") {
      await collectFiles(handle, fullPath, files);
    } else if (handle.kind === "file") {
      files.push({ path: fullPath, handle });
    }
    if (files.length >= MAX_FILES) break;
  }
  return files;
}

/**
 * Build a Simplebeacon-compatible report from worker findings.
 * @param {string} projectName
 * @param {Array<Object>} findings
 * @param {number} totalFiles
 * @param {number} analyzedFiles
 * @returns {Object}
 */
function buildReport(
  projectName,
  findings,
  totalFiles,
  analyzedFiles,
  filePaths = [],
  meta = {},
) {
  const categories = {};
  const findingsList = [];
  const rawIssues = [];
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const f of findings || []) {
    const rule = f.rule || f.analyzer || "finding";
    const severity = f.severity || "medium";
    const count = Number(f.count) || 1;
    if (severityCounts[severity] !== undefined)
      severityCounts[severity] += count;
    if (!categories[rule]) categories[rule] = { severity, findings: [] };
    const message = f.impact || `${rule} finding`;
    const file = f.filePath || "";
    const line = f.line || 1;
    categories[rule].findings.push({ file, line, message, severity, count });
    findingsList.push({ category: rule, file, line, severity, message, count });
    rawIssues.push({
      type: rule,
      filePath: file,
      line,
      severity,
      description: message,
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
  const mockSampleFiles = filePaths.filter((p) =>
    /sample|mock|fixture|test.*data/i.test(String(p)),
  ).length;
  const folderSet = new Set();
  for (const p of filePaths) {
    const parts = String(p).replace(/\\/g, "/").split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      if (acc) folderSet.add(acc);
    }
  }
  const totalFolders = folderSet.size;
  const capped = false; // No cap — MAX_FILES is 999M (matches legacy /audit page)
  const scanLimitNote = null;
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
      rulesEnabled: ["credential-patterns", "production-leak-patterns"],
      gatePolicy: { failOn: ["high"], warnOn: ["medium", "low"] },
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
    gate: {
      pass: blockingCount === 0 && totalFiles >= MIN_FILES_FOR_PASS,
      blockingCount,
      warningCount: totalFindings - blockingCount,
      score: gateScore,
      incompleteDrop,
    },
    issuesTruncated: false,
    scanLimitNote,
    incompleteDropNote,
  };
}

/**
 * Run a local browser-based scan against a directory selected by the user.
 * No file contents are ever sent to the server.
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @param {(progress:number, total:number) => void} [options.onProgress]
 * @returns {Promise<Object>}
 */
export async function runLocalScan(options = {}) {
  if (!canUseDirectoryPicker()) {
    throw new Error(filePickerBlockedMessage());
  }
  const dirHandle = await window.showDirectoryPicker();
  const projectName = dirHandle.name || "local-project";
  const files = await collectFiles(dirHandle);
  if (files.length === 0) {
    throw new Error(
      `No files were found in "${projectName}". The folder may be empty, permission was denied, or all files were excluded. Try selecting the folder again or use the local agent.`,
    );
  }
  const workerFiles = files.map((f) => ({ path: f.path, fileObj: f.handle }));

  return new Promise((resolve, reject) => {
    const worker = new Worker(resolveScanWorkerUrl(), { type: "module" });
    const signal = options.signal;
    let settled = false;

    function cleanup() {
      if (!settled) {
        settled = true;
        worker.terminate();
      }
    }

    if (signal) {
      signal.addEventListener("abort", () => {
        cleanup();
        reject(new Error("Local scan cancelled."));
      });
    }

    worker.onmessage = (e) => {
      const { type, scanId, processed, total, findings, issues, error } =
        e.data;
      if (type === "progress" && options.onProgress) {
        options.onProgress(processed, total);
      }
      if (type === "complete") {
        cleanup();
        const analyzedFiles = files.filter((f) =>
          /\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|php|rb|cs|vb)$/i.test(f.path),
        ).length;
        resolve(
          buildReport(
            projectName,
            issues,
            total,
            analyzedFiles,
            files.map((f) => f.path),
            { capped: false },
          ),
        );
      }
      if (type === "error") {
        cleanup();
        reject(new Error(error || "Local scan failed"));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || "Local scan worker failed"));
    };

    worker.postMessage({
      type: "scan",
      files: workerFiles,
      deepScan: false,
      scanId: crypto.randomUUID(),
    });
  });
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
