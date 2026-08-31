"use strict";

/**
 * Onboarding Drip Store — tracks which onboarding emails have been sent to each subscriber.
 *
 * Stores a JSON map of email → { activatedAt, sentSteps: [], updatedAt }.
 * The cron job reads this store, finds users who are due for their next drip email,
 * and marks the step as sent after successful delivery.
 *
 * Storage: file-based JSON (sufficient for single-instance Render deployment).
 */

const fs = require("fs");
const path = require("path");
const logger = require("./app-logger.cjs");

const STORE_PATH =
  process.env.ONBOARDING_DRIP_STORE ||
  path.join(process.cwd(), ".simplebeacon", "onboarding-drip.json");

let _cache = null;
let _cacheDirty = false;

/**
 * Read the drip store from disk.
 * @returns {Object} The store object.
 */
function readDripStore() {
  if (_cache) return _cache;
  try {
    if (!fs.existsSync(STORE_PATH)) {
      _cache = { users: {} };
      return _cache;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    _cache = JSON.parse(raw);
    if (!_cache.users) _cache.users = {};
    return _cache;
  } catch (err) {
    logger.warn("[OnboardingDrip] Failed to read store:", err?.message || err);
    _cache = { users: {} };
    return _cache;
  }
}

/**
 * Write the drip store to disk.
 */
function writeDripStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(_cache, null, 2));
    _cacheDirty = false;
  } catch (err) {
    logger.error("[OnboardingDrip] Failed to write store:", err?.message || err);
  }
}

/**
 * Register a new activation in the drip store.
 * Called from the Stripe webhook when a subscription is activated.
 * @param {string} email - Customer email.
 * @param {string} tier - Subscription tier.
 * @returns {void}
 */
function registerActivation(email, tier) {
  if (!email) return;
  const normalized = String(email).trim().toLowerCase();
  const store = readDripStore();
  const existing = store.users[normalized];
  store.users[normalized] = {
    email: normalized,
    tier: tier || "developer",
    activatedAt: existing?.activatedAt || new Date().toISOString(),
    sentSteps: existing?.sentSteps || [],
    updatedAt: new Date().toISOString(),
  };
  _cacheDirty = true;
  writeDripStore();
  logger.info(
    `[OnboardingDrip] Registered activation for ${normalized} (tier: ${tier})`,
  );
}

/**
 * Find users who are due for a specific drip step.
 * @param {number} stepNumber - 1, 2, or 3 (day 1, day 3, day 7).
 * @param {number} minHours - Minimum hours since activation.
 * @returns {Array<Object>} Array of { email, tier, activatedAt, stepNumber }.
 */
function findDueUsers(stepNumber, minHours) {
  const store = readDripStore();
  const now = Date.now();
  const minMs = minHours * 60 * 60 * 1000;
  const stepKey = `step${stepNumber}`;
  const due = [];

  for (const [email, record] of Object.entries(store.users)) {
    if (!record.activatedAt) continue;
    if (record.sentSteps?.includes(stepKey)) continue;
    const elapsed = now - new Date(record.activatedAt).getTime();
    if (elapsed >= minMs) {
      due.push({
        email,
        tier: record.tier || "developer",
        activatedAt: record.activatedAt,
        stepNumber,
      });
    }
  }

  return due;
}

/**
 * Mark a drip step as sent for a user.
 * @param {string} email - Customer email.
 * @param {number} stepNumber - Step number (1, 2, or 3).
 * @returns {void}
 */
function markStepSent(email, stepNumber) {
  if (!email) return;
  const normalized = String(email).trim().toLowerCase();
  const stepKey = `step${stepNumber}`;
  const store = readDripStore();
  const record = store.users[normalized];
  if (!record) return;
  if (!record.sentSteps) record.sentSteps = [];
  if (!record.sentSteps.includes(stepKey)) {
    record.sentSteps.push(stepKey);
  }
  record.updatedAt = new Date().toISOString();
  _cacheDirty = true;
  writeDripStore();
}

/**
 * Remove a user from the drip store (e.g., after cancellation).
 * @param {string} email - Customer email.
 * @returns {void}
 */
function removeUser(email) {
  if (!email) return;
  const normalized = String(email).trim().toLowerCase();
  const store = readDripStore();
  if (store.users[normalized]) {
    delete store.users[normalized];
    _cacheDirty = true;
    writeDripStore();
  }
}

/**
 * List all users in the drip store with their progress.
 * @returns {Array<Object>} Array of { email, tier, activatedAt, sentSteps, updatedAt }
 */
function listAllUsers() {
  const store = readDripStore();
  return Object.values(store.users).map((record) => ({
    email: record.email,
    tier: record.tier || "developer",
    activatedAt: record.activatedAt,
    sentSteps: record.sentSteps || [],
    updatedAt: record.updatedAt,
  }));
}

/**
 * Reset a specific drip step for a user (allows re-sending).
 * @param {string} email - Customer email.
 * @param {number} stepNumber - Step to reset (1, 2, or 3).
 * @returns {{ success: boolean, error?: string }}
 */
function resetStep(email, stepNumber) {
  if (!email) return { success: false, error: "email_required" };
  const normalized = String(email).trim().toLowerCase();
  const stepKey = `step${stepNumber}`;
  const store = readDripStore();
  const record = store.users[normalized];
  if (!record) return { success: false, error: "not_found" };
  if (!record.sentSteps) record.sentSteps = [];
  record.sentSteps = record.sentSteps.filter((s) => s !== stepKey);
  record.updatedAt = new Date().toISOString();
  _cacheDirty = true;
  writeDripStore();
  logger.info(`[OnboardingDrip] Reset step ${stepNumber} for ${normalized}`);
  return { success: true };
}

/**
 * Skip a specific drip step for a user (marks as sent without sending).
 * @param {string} email - Customer email.
 * @param {number} stepNumber - Step to skip.
 * @returns {{ success: boolean, error?: string }}
 */
function skipStep(email, stepNumber) {
  if (!email) return { success: false, error: "email_required" };
  const normalized = String(email).trim().toLowerCase();
  const stepKey = `step${stepNumber}`;
  const store = readDripStore();
  const record = store.users[normalized];
  if (!record) return { success: false, error: "not_found" };
  if (!record.sentSteps) record.sentSteps = [];
  if (!record.sentSteps.includes(stepKey)) {
    record.sentSteps.push(stepKey);
  }
  record.updatedAt = new Date().toISOString();
  _cacheDirty = true;
  writeDripStore();
  logger.info(`[OnboardingDrip] Skipped step ${stepNumber} for ${normalized}`);
  return { success: true };
}

module.exports = {
  registerActivation,
  findDueUsers,
  markStepSent,
  removeUser,
  readDripStore,
  listAllUsers,
  resetStep,
  skipStep,
};
