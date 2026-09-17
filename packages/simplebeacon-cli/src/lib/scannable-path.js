/**
 * Cheap path gate for MCP snippet/file scans.
 * Unscannable types must not be read into tool results.
 */

const fs = require("fs");
const path = require("path");

const SCANNABLE_EXT = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".py",
  ".pyw",
  ".yml",
  ".yaml",
  ".json",
  ".env",
]);

const SKIP_EXT = new Set([
  ".zs",
  ".zsc",
  ".zc",
  ".md2",
  ".md3",
  ".iqm",
  ".obj",
  ".fbx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tga",
  ".bmp",
  ".dds",
  ".wad",
  ".pk3",
  ".pk7",
  ".zip",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".wasm",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp3",
  ".ogg",
  ".wav",
  ".flac",
  ".lock",
  ".map",
  ".bin",
  ".dat",
]);

const SKIP_BASENAMES = new Set([
  "modeldef",
  "decorate",
  "textures",
  "animdefs",
  "gldefs",
  "keyconf",
  "cvarinfo",
  "mapinfo",
  "sndinfo",
  "terrain",
  "menudef",
  "zscript",
  "gameinfo",
  "sbarinfo",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "bun.lock",
  "bun.lockb",
]);

const UNPUBLISHED_DEFAULTS = new Set(["", "snippet.txt", "snippet.js"]);

function posixBase(filePath) {
  return path.posix.basename(String(filePath || "").replace(/\\/g, "/"));
}

function isEnvFile(base) {
  const lower = String(base || "").toLowerCase();
  return lower === ".env" || lower.startsWith(".env.");
}

function evaluateScannablePath(filePath) {
  const raw = String(filePath || "").trim();
  const base = posixBase(raw).toLowerCase();

  if (UNPUBLISHED_DEFAULTS.has(base)) {
    return { scannable: true, reason: "unpublished-snippet" };
  }

  if (isEnvFile(base)) {
    return { scannable: true, reason: "env" };
  }

  if (SKIP_BASENAMES.has(base)) {
    return { scannable: false, reason: "unscannable-basename" };
  }

  if (base.endsWith(".min.js") || base.endsWith(".min.cjs") || base.endsWith(".min.mjs")) {
    return { scannable: false, reason: "minified-bundle" };
  }

  const ext = path.posix.extname(base).toLowerCase();
  if (SKIP_EXT.has(ext)) {
    return { scannable: false, reason: "unscannable-extension" };
  }

  if (SCANNABLE_EXT.has(ext)) {
    return { scannable: true, reason: "scannable-extension" };
  }

  return { scannable: false, reason: "unknown-extension" };
}

function skippedScanResult(filePath, extra = {}) {
  const gate = evaluateScannablePath(filePath);
  return {
    skipped: true,
    reason: extra.reason || gate.reason,
    filePath: String(filePath || "").replace(/\\/g, "/"),
    findingCount: 0,
    blockingCount: 0,
    findings: [],
    ...extra,
  };
}

function bufferLooksBinary(buf) {
  const n = Math.min(buf.length, 512);
  for (let i = 0; i < n; i += 1) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/** Compact finding rows for MCP — same keys every time, no match snippets. */
function slimScanFindings(findings, limit = 12) {
  return (Array.isArray(findings) ? findings : []).slice(0, limit).map((f) => {
    const file = String(f.file || f.filePath || f.path || "").replace(/\\/g, "/") || null;
    return {
      file,
      line: f.line == null ? null : Number(f.line),
      rule: String(f.rule || f.pattern || f.id || "unknown"),
      severity: String(f.severity || "medium"),
      fix: String(
        f.fix || f.recommendedAction || f.recommendation || f.description || "",
      ),
    };
  });
}

function nextScanAction(result, findings) {
  if (result && result.error) return "stop";
  if (result && (result.skipped || result.cached)) return "do_not_rescan";
  const blocking = Number(result && result.blockingCount) || 0;
  const high = findings.some(
    (f) => f.severity === "high" || f.severity === "critical",
  );
  if (blocking > 0 || high) return "fix_then_rescan_once";
  return "done";
}

function slimScanResult(result) {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      skipped: false,
      cached: false,
      reason: "invalid",
      file: null,
      filePath: null,
      findingCount: 0,
      blockingCount: 0,
      findings: [],
      next: "stop",
    };
  }
  const file = String(result.file || result.filePath || "").replace(/\\/g, "/") || null;
  const findings = slimScanFindings(result.findings);
  return {
    ok: !result.error,
    skipped: Boolean(result.skipped),
    cached: Boolean(result.cached),
    reason: result.reason || result.error || null,
    file,
    filePath: file,
    findingCount: result.findingCount ?? findings.length,
    blockingCount: result.blockingCount ?? 0,
    findings,
    next: nextScanAction(result, findings),
  };
}

const CODEMAP_MAX_BYTES = 256 * 1024;
const CODEMAP_MAX_ENTRY_POINTS = 24;
const CODEMAP_MAX_PATH_CHARS = 80;

function readCodeMapHint(projectRoot) {
  if (!projectRoot) {
    return null;
  }
  const mapPath = path.join(projectRoot, ".simplebeacon", "codemap.json");
  try {
    const stat = fs.statSync(mapPath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > CODEMAP_MAX_BYTES) {
      return null;
    }
    const codeMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    if (!codeMap || typeof codeMap !== "object") {
      return null;
    }
    const fileCount = Array.isArray(codeMap.files) ? codeMap.files.length : 0;
    const entryPoints = Array.isArray(codeMap.entryPoints)
      ? codeMap.entryPoints
          .filter((p) => typeof p === "string" && p.length > 0)
          .slice(0, CODEMAP_MAX_ENTRY_POINTS)
          .map((p) =>
            p.length > CODEMAP_MAX_PATH_CHARS
              ? `${p.slice(0, CODEMAP_MAX_PATH_CHARS)}…`
              : p,
          )
      : [];
    return { fileCount, entryPoints };
  } catch {
    return null;
  }
}

module.exports = {
  evaluateScannablePath,
  skippedScanResult,
  bufferLooksBinary,
  slimScanFindings,
  slimScanResult,
  readCodeMapHint,
  SCANNABLE_EXT,
};
