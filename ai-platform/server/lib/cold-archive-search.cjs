"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");
const logger = require("./app-logger.cjs");

const ARCHIVE_DIR =
  process.env.COLD_ARCHIVE_DIR ||
  path.resolve(process.cwd(), ".simplebeacon", "archive");
const MAX_LIMIT = parseInt(process.env.COLD_ARCHIVE_MAX_LIMIT, 10) || 1000;

function _log(level, message, extra = {}) {
  if (!logger || !logger[level]) return;
  logger[level](message, { sub: "cold-archive-search", ...extra });
}

function _listArchiveFiles() {
  try {
    const entries = fs.readdirSync(ARCHIVE_DIR, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          (e.name.endsWith(".json.gz") || e.name.endsWith(".ndjson.gz")),
      )
      .map((e) => path.join(ARCHIVE_DIR, e.name))
      .sort();
  } catch (err) {
    _log("warn", "Cannot read archive directory", {
      dir: ARCHIVE_DIR,
      error: err.message,
    });
    return [];
  }
}

function _parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function _matches(entry, filters) {
  if (!entry || typeof entry !== "object") return false;

  if (filters.startDate || filters.endDate) {
    const ts = entry.timestamp ? new Date(entry.timestamp) : null;
    if (!ts || Number.isNaN(ts.getTime())) return false;
    if (filters.startDate && ts < filters.startDate) return false;
    if (filters.endDate && ts > filters.endDate) return false;
  }

  if (filters.action && entry.action !== filters.action) return false;
  if (filters.orgId && entry.orgId !== filters.orgId) return false;

  return true;
}

async function _searchFile(filePath, filters, offset, targetCount) {
  const stream = fs.createReadStream(filePath);
  const unzip = stream.pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: unzip, crlfDelay: Infinity });

  const collected = [];
  let seen = 0;
  let hasMore = false;

  unzip.on("error", (err) => {
    _log("warn", "Gzip decode error; skipping file", {
      file: filePath,
      error: err.message,
    });
    rl.close();
  });
  stream.on("error", (err) => {
    _log("warn", "Archive read error", { file: filePath, error: err.message });
    rl.close();
  });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (err) {
        _log("debug", "Skipping invalid JSON line", {
          file: filePath,
          error: err.message,
        });
        continue;
      }

      if (!_matches(entry, filters)) continue;

      seen++;
      if (seen <= offset) continue;

      if (collected.length < targetCount) {
        collected.push(entry);
      } else {
        hasMore = true;
        break;
      }
    }
  } catch (err) {
    _log("warn", "Error scanning archive file", {
      file: filePath,
      error: err.message,
    });
  }

  return { collected, newOffset: offset + seen, hasMore };
}

async function search(options = {}) {
  const limit = Math.min(parseInt(options.limit, 10) || 100, MAX_LIMIT);
  const offset = Math.max(0, parseInt(options.offset, 10) || 0);
  const startDate = _parseDate(options.startDate);
  const endDate = _parseDate(options.endDate);

  if (options.startDate && !startDate) {
    throw Object.assign(new Error("invalid_start_date"), { statusCode: 400 });
  }
  if (options.endDate && !endDate) {
    throw Object.assign(new Error("invalid_end_date"), { statusCode: 400 });
  }
  if (startDate && endDate && startDate > endDate) {
    throw Object.assign(new Error("start_after_end"), { statusCode: 400 });
  }

  const filters = {
    startDate,
    endDate,
    action: options.action || null,
    orgId: options.orgId || null,
  };

  const files = _listArchiveFiles();
  const entries = [];
  let currentOffset = offset;
  let targetCount = limit;

  for (const file of files) {
    if (entries.length >= limit) break;
    const { collected, newOffset, hasMore } = await _searchFile(
      file,
      filters,
      currentOffset,
      targetCount,
    );
    currentOffset = newOffset;
    targetCount = limit - entries.length;
    if (collected.length > targetCount) {
      entries.push(...collected.slice(0, targetCount));
      break;
    }
    entries.push(...collected);
    if (hasMore) break;
  }

  return {
    entries,
    nextOffset: offset + entries.length,
    hasMore: entries.length === limit, // conservative
  };
}

module.exports = {
  search,
  ARCHIVE_DIR,
};
