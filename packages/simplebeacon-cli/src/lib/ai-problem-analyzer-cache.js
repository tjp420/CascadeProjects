/**
 * Analyzer result cache — keyed by file content hash to avoid re-running
 * deterministic analyzers on unchanged scan reports.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_CACHE_DIR = ".simplebeacon";
const CACHE_FILE_NAME = "analyzer-cache.json";
const MAX_CACHE_ENTRIES = 256;

function hashReport(report) {
  const canon = JSON.stringify(report || {});
  return crypto.createHash("sha256").update(canon).digest("hex").slice(0, 24);
}

function resolveCachePath(projectRoot) {
  return path.join(projectRoot, DEFAULT_CACHE_DIR, CACHE_FILE_NAME);
}

function readCache(projectRoot) {
  const cachePath = resolveCachePath(projectRoot);
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    // ignore missing or corrupted cache
  }
  return {};
}

function writeCache(projectRoot, cache) {
  const cachePath = resolveCachePath(projectRoot);
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const entries = Object.entries(cache).sort(
      (a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0),
    );
    const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
    fs.writeFileSync(
      cachePath,
      `${JSON.stringify(trimmed, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // ignore write failures
  }
}

function getCachedAnalysis(projectRoot, report) {
  const cache = readCache(projectRoot);
  const key = hashReport(report);
  const entry = cache[key];
  if (!entry) return null;
  // Validate cache entry has expected shape
  if (!entry.analysis || !entry.analysis.analyzerResults) return null;
  return entry.analysis;
}

function setCachedAnalysis(projectRoot, report, analysis) {
  const cache = readCache(projectRoot);
  const key = hashReport(report);
  cache[key] = { timestamp: Date.now(), analysis };
  writeCache(projectRoot, cache);
}

function clearCache(projectRoot) {
  const cachePath = resolveCachePath(projectRoot);
  try {
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  } catch {
    // ignore
  }
}

module.exports = {
  hashReport,
  getCachedAnalysis,
  setCachedAnalysis,
  clearCache,
  resolveCachePath,
};
