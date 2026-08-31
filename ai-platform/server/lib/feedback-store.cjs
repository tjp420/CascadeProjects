"use strict";

/**
 * Feedback Store — file-based store for customer feedback and feature requests.
 *
 * Captures incoming feedback from launch traffic (Reddit, HN, contact form,
 * direct email) and categorizes it by type and status for admin triage.
 *
 * Categories: bug, feature, pricing, praise, question, other
 * Statuses: new, triaged, in_progress, resolved, wont_fix
 * Sources: reddit, hackernews, contact_form, email, dashboard, other
 *
 * @module feedback-store
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("./app-logger.cjs");

const STORE_PATH =
  process.env.FEEDBACK_STORE_PATH ||
  path.join(process.cwd(), ".simplebeacon", "feedback.json");

const VALID_CATEGORIES = [
  "bug",
  "feature",
  "pricing",
  "praise",
  "question",
  "other",
];
const VALID_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "wont_fix",
];
const VALID_SOURCES = [
  "reddit",
  "hackernews",
  "contact_form",
  "email",
  "dashboard",
  "other",
];

let _cache = null;
let _cacheDirty = false;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    if (!fs.existsSync(STORE_PATH)) {
      _cache = { entries: [], nextId: 1 };
      return _cache;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    _cache = JSON.parse(raw);
    if (!_cache.entries) _cache.entries = [];
    if (!_cache.nextId) _cache.nextId = _cache.entries.length + 1;
    _cacheDirty = false;
    return _cache;
  } catch (err) {
    logger.warn("[FeedbackStore] Failed to read store:", err?.message || err);
    _cache = { entries: [], nextId: 1 };
    return _cache;
  }
}

function writeStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = STORE_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(_cache, null, 2));
    fs.renameSync(tmp, STORE_PATH);
    _cacheDirty = false;
  } catch (err) {
    logger.error("[FeedbackStore] Failed to write store:", err?.message || err);
  }
}

function sanitize(value, maxLen = 5000) {
  return String(value || "")
    .trim()
    .slice(0, maxLen);
}

function validateCategory(cat) {
  return VALID_CATEGORIES.includes(cat) ? cat : "other";
}

function validateStatus(status) {
  return VALID_STATUSES.includes(status) ? status : "new";
}

function validateSource(source) {
  return VALID_SOURCES.includes(source) ? source : "other";
}

/**
 * Add a new feedback entry.
 * @param {Object} opts
 * @param {string} opts.name - Submitter name (optional)
 * @param {string} [opts.email] - Submitter email (optional)
 * @param {string} opts.message - Feedback content
 * @param {string} [opts.category] - One of VALID_CATEGORIES
 * @param {string} [opts.source] - One of VALID_SOURCES
 * @param {string} [opts.tier] - Subscriber tier if known
 * @returns {{ id: number, success: boolean }}
 */
function addFeedback(opts = {}) {
  const message = sanitize(opts.message);
  if (!message) {
    return { id: 0, success: false, error: "message_required" };
  }

  const store = readStore();
  const id = store.nextId++;
  const entry = {
    id,
    name: sanitize(opts.name, 200),
    email: sanitize(opts.email, 200),
    message,
    category: validateCategory(opts.category),
    status: "new",
    source: validateSource(opts.source),
    tier: sanitize(opts.tier, 50),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    adminNotes: "",
  };

  store.entries.push(entry);
  _cacheDirty = true;
  writeStore();

  logger.info(`[FeedbackStore] Added feedback #${id} (${entry.category} from ${entry.source})`);
  return { id, success: true };
}

/**
 * List feedback entries with optional filtering.
 * @param {Object} [filters]
 * @param {string} [filters.category]
 * @param {string} [filters.status]
 * @param {string} [filters.source]
 * @param {number} [filters.limit=100]
 * @param {number} [filters.offset=0]
 * @returns {{ entries: Array, total: number, stats: Object }}
 */
function listFeedback(filters = {}) {
  const store = readStore();
  let entries = store.entries;

  if (filters.category) {
    entries = entries.filter((e) => e.category === filters.category);
  }
  if (filters.status) {
    entries = entries.filter((e) => e.status === filters.status);
  }
  if (filters.source) {
    entries = entries.filter((e) => e.source === filters.source);
  }

  // Sort newest first
  entries = [...entries].sort((a, b) => b.id - a.id);

  const total = entries.length;
  const limit = Math.min(filters.limit || 100, 500);
  const offset = filters.offset || 0;
  const paginated = entries.slice(offset, offset + limit);

  // Compute category/status breakdown stats
  const allEntries = store.entries;
  const stats = {
    byCategory: {},
    byStatus: {},
    bySource: {},
    total: allEntries.length,
  };
  for (const cat of VALID_CATEGORIES) {
    stats.byCategory[cat] = allEntries.filter((e) => e.category === cat).length;
  }
  for (const status of VALID_STATUSES) {
    stats.byStatus[status] = allEntries.filter((e) => e.status === status).length;
  }
  for (const source of VALID_SOURCES) {
    stats.bySource[source] = allEntries.filter((e) => e.source === source).length;
  }

  return { entries: paginated, total, stats };
}

/**
 * Update a feedback entry's status and/or admin notes.
 * @param {number} id - Feedback entry ID
 * @param {Object} updates
 * @param {string} [updates.status] - New status
 * @param {string} [updates.adminNotes] - Admin notes
 * @param {string} [updates.category] - Recategorize
 * @returns {{ success: boolean, error?: string }}
 */
function updateFeedback(id, updates = {}) {
  const store = readStore();
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) {
    return { success: false, error: "not_found" };
  }

  if (updates.status) {
    entry.status = validateStatus(updates.status);
  }
  if (updates.category) {
    entry.category = validateCategory(updates.category);
  }
  if (typeof updates.adminNotes === "string") {
    entry.adminNotes = sanitize(updates.adminNotes, 5000);
  }
  entry.updatedAt = new Date().toISOString();

  _cacheDirty = true;
  writeStore();

  logger.info(`[FeedbackStore] Updated feedback #${id} (status: ${entry.status})`);
  return { success: true };
}

/**
 * Delete a feedback entry.
 * @param {number} id - Feedback entry ID
 * @returns {{ success: boolean, error?: string }}
 */
function deleteFeedback(id) {
  const store = readStore();
  const idx = store.entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    return { success: false, error: "not_found" };
  }
  store.entries.splice(idx, 1);
  _cacheDirty = true;
  writeStore();
  logger.info(`[FeedbackStore] Deleted feedback #${id}`);
  return { success: true };
}

module.exports = {
  addFeedback,
  listFeedback,
  updateFeedback,
  deleteFeedback,
  VALID_CATEGORIES,
  VALID_STATUSES,
  VALID_SOURCES,
};
