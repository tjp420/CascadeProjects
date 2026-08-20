"use strict";

/**
 * Fine-Tuning Telemetry Store
 *
 * Collects, labels, filters, and exports multi-turn conversation telemetry
 * for local small-model training datasets.
 *
 * @module fine-tuning-telemetry-store
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("./app-logger.cjs");
const { formatRow } = require("./fine-tuning-formatter.cjs");

const STORE_DIR = path.join(process.cwd(), ".simplebeacon");
const TELEMETRY_PATH = path.join(STORE_DIR, "fine-tuning-telemetry.json");
const DATASET_DIR = path.join(STORE_DIR, "telemetry-datasets");

function ensureStore() {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.mkdirSync(DATASET_DIR, { recursive: true });
  } catch {}
  if (!fs.existsSync(TELEMETRY_PATH)) {
    fs.writeFileSync(TELEMETRY_PATH, JSON.stringify({ entries: [] }), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(TELEMETRY_PATH, "utf8");
    const store = JSON.parse(raw);
    if (!Array.isArray(store.entries)) store.entries = [];
    return store;
  } catch (err) {
    logger.warn("[FineTuningTelemetry] Failed to read store:", err.message);
    return { entries: [] };
  }
}

function writeStore(store) {
  fs.writeFileSync(TELEMETRY_PATH, JSON.stringify(store, null, 2), "utf8");
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_RE =
  /\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|bearer\s+[a-zA-Z0-9]{20,})\b/gi;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function scrub(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(TOKEN_RE, "[TOKEN]")
    .replace(IP_RE, "[IP]");
}

function scoreEntry(entry) {
  let score = 0;
  const input = (entry.input || "").toLowerCase();
  const output = (entry.output || "").toLowerCase();

  // Multi-turn sessions score higher
  if ((entry.turns || 0) >= 2) score += 2;
  if ((entry.turns || 0) >= 3) score += 1;

  // User-provided rating
  if (entry.rating) score += Math.max(0, Math.min(5, Number(entry.rating)));

  // Length heuristics
  if (input.length > 40 && output.length > 40) score += 1;
  if (output.length > 200) score += 1;

  // Question / instruction signal
  if (
    input.includes("?") ||
    input.includes("how") ||
    input.includes("explain") ||
    input.includes("write")
  )
    score += 1;

  return Math.min(10, score);
}

function recordTelemetry({
  orgId,
  userId,
  operation,
  model,
  input,
  output,
  metadata,
}) {
  const store = readStore();
  const entry = {
    eventId: "ft-" + crypto.randomBytes(8).toString("hex"),
    orgId: orgId || "default",
    userId: userId || null,
    operation: operation || "inference",
    model: model || "unknown",
    input: scrub(input || ""),
    output: scrub(output || ""),
    timestamp: new Date().toISOString(),
    label: "pending",
    score: 0,
    turns: 1,
    rating: (metadata && Number(metadata.rating)) || 0,
    metadata: metadata || {},
  };
  entry.score = scoreEntry(entry);

  // Merge with a prior pending turn from the same user within 5 minutes to build multi-turn sessions
  const windowMs = 5 * 60 * 1000;
  const lastIdx = store.entries.findLastIndex(function (e) {
    return (
      e.orgId === entry.orgId &&
      e.userId === entry.userId &&
      e.label !== "exclude" &&
      new Date(entry.timestamp).getTime() - new Date(e.timestamp).getTime() <=
        windowMs
    );
  });

  if (lastIdx !== -1) {
    const last = store.entries[lastIdx];
    if ((last.turns || 1) < 5) {
      // Bump the prior entry with this new turn and rewrite as a single conversation
      last.turns = (last.turns || 1) + 1;
      last.output = scrub(output || "");
      last.metadata = { ...last.metadata, mergedAt: entry.timestamp };
      last.score = scoreEntry(last);
      writeStore(store);
      return { recorded: true, merged: true, eventId: last.eventId };
    }
  }

  store.entries.push(entry);
  writeStore(store);
  return { recorded: true, merged: false, eventId: entry.eventId };
}

function listEntries(orgId, filters) {
  const store = readStore();
  const f = filters || {};
  const minRating = Number(f.minRating) || 0;
  const minTurns = Number(f.minTurns) || 1;
  const label = f.label || null;
  const operation = f.operation || null;
  const excludeExcluded = label !== "exclude";
  const startDate = f.startDate ? new Date(f.startDate) : null;
  const endDate = f.endDate ? new Date(f.endDate) : null;
  const q = (f.q || "").trim().toLowerCase();
  const page = Number.isFinite(f.page) && f.page > 0 ? f.page : null;
  const limit = Number.isFinite(f.limit) && f.limit > 0 ? f.limit : null;

  let filtered = store.entries
    .filter(function (e) {
      return e.orgId === (orgId || "default");
    })
    .filter(function (e) {
      return !excludeExcluded || e.label !== "exclude";
    })
    .filter(function (e) {
      return (e.score || 0) >= minRating;
    })
    .filter(function (e) {
      return (e.turns || 1) >= minTurns;
    })
    .filter(function (e) {
      return !label || e.label === label;
    })
    .filter(function (e) {
      return !operation || e.operation === operation;
    })
    .filter(function (e) {
      const t = new Date(e.timestamp);
      if (startDate && t < startDate) return false;
      if (endDate && t > endDate) return false;
      return true;
    });

  if (q) {
    filtered = filtered.filter(function (e) {
      return (
        (e.input || "").toLowerCase().includes(q) ||
        (e.output || "").toLowerCase().includes(q) ||
        (e.model || "").toLowerCase().includes(q) ||
        (e.userId || "").toLowerCase().includes(q) ||
        (e.eventId || "").toLowerCase().includes(q)
      );
    });
  }

  filtered.sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });

  if (page === null || limit === null) {
    return filtered;
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const pageEntries = filtered.slice(start, start + limit);
  return { entries: pageEntries, total, page, limit };
}

function labelEntry(eventId, label) {
  const store = readStore();
  const entry = store.entries.find(function (e) {
    return e.eventId === eventId;
  });
  if (!entry) return { success: false, error: "not_found" };
  entry.label = label;
  writeStore(store);
  return { success: true, eventId, label };
}

function exportDataset(orgId, format, filters) {
  const entries = listEntries(orgId, filters);
  const lines = entries.map(function (e) {
    return formatRow(e, format);
  });
  const data = lines.join("\n") + (lines.length ? "\n" : "");
  const hash = crypto.createHash("sha256").update(data, "utf8").digest("hex");
  const filename = `${orgId || "default"}-${format}-${hash.slice(0, 12)}.jsonl`;
  const outPath = path.join(DATASET_DIR, filename);
  fs.writeFileSync(outPath, data, "utf8");
  return {
    success: true,
    filename,
    path: outPath,
    rowCount: lines.length,
    sha256: hash,
  };
}

function listDatasets(orgId) {
  ensureStore();
  const prefix = (orgId || "default") + "-";
  return fs
    .readdirSync(DATASET_DIR)
    .filter(function (f) {
      return f.startsWith(prefix);
    })
    .map(function (f) {
      const stat = fs.statSync(path.join(DATASET_DIR, f));
      return {
        filename: f,
        createdAt: stat.birthtime.toISOString(),
        sizeBytes: stat.size,
      };
    })
    .sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

module.exports = {
  recordTelemetry,
  listEntries,
  labelEntry,
  exportDataset,
  listDatasets,
};
