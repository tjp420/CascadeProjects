/**
 * Purge expired assessment artifacts (cloned repos + JSON) from assessments/.
 */

const logger = require("../lib/app-logger.cjs");

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const {
  readJsonFileSyncOrNull,
  statMtimeMsOrNull,
} = require("./recoverable-io.cjs");
const constants = require("../config/constants.cjs");

const DEFAULT_TTL_MS =
  constants.HOURS_PER_DAY *
  constants.MINUTES_PER_HOUR *
  constants.SECONDS_PER_MINUTE *
  constants.MS_PER_SECOND;
const DEFAULT_INTERVAL_MS =
  constants.MINUTES_PER_HOUR *
  constants.SECONDS_PER_MINUTE *
  constants.MS_PER_SECOND;

/**
 * Parse assessment created at.
 * @param {string} assessmentDir
 * @returns {any}
 */
function parseAssessmentCreatedAt(assessmentDir) {
  const assessmentMetaPath = path.join(assessmentDir, "assessment.json");
  const assessmentMeta = readJsonFileSyncOrNull(
    assessmentMetaPath,
    assessmentMetaPath,
  );
  const createdAtIso = assessmentMeta?.metadata?.createdAt;
  if (createdAtIso) {
    const createdAtMs = Date.parse(createdAtIso);
    if (Number.isFinite(createdAtMs)) return createdAtMs;
  }
  return statMtimeMsOrNull(assessmentDir, assessmentDir);
}

/**
 * Purge expired assessments.
 * @param {string} assessmentsDir
 * @param {Object} options
 * @returns {any}
 */
async function purgeExpiredAssessments(assessmentsDir, options = {}) {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  const removed = [];

  if (!fs.existsSync(assessmentsDir)) {
    // simplebeacon-ignore sync-io — existence check before async directory iteration
    return { removed, skipped: 0 };
  }

  const entries = await fsp.readdir(assessmentsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("assessment_")) continue;

    const dirPath = path.join(assessmentsDir, entry.name);
    const createdAt = parseAssessmentCreatedAt(dirPath);
    if (createdAt == null) continue;
    if (now - createdAt <= maxAgeMs) continue;

    await fsp.rm(dirPath, { recursive: true, force: true });
    removed.push(entry.name);
  }

  return { removed, skipped: entries.length - removed.length };
}

/**
 * Resolve assessment ttl ms.
 * @returns {any}
 */
function resolveAssessmentTtlMs() {
  const hours = parseFloat(process.env.ASSESSMENT_TTL_HOURS || "24", 10);
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_TTL_MS;
  return Math.round(hours * 60 * constants.ONE_MINUTE_MS);
}

/**
 * Start assessment retention job.
 * @param {Object} options
 * @returns {any}
 */
function startAssessmentRetentionJob(options = {}) {
  const assessmentsDir = options.assessmentsDir;
  if (!assessmentsDir) {
    throw new Error("assessmentsDir is required");
  }

  const maxAgeMs = options.maxAgeMs ?? resolveAssessmentTtlMs();
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  /**
   * Run.
   * @returns {any}
   */
  const run = async () => {
    try {
      const result = await purgeExpiredAssessments(assessmentsDir, {
        maxAgeMs,
      });
      if (result.removed.length) {
        logger.debug(
          `[Assessment] Purged ${result.removed.length} expired assessment(s)`,
        );
      }
    } catch (error) {
      logger.warn("[Assessment] Retention purge failed:", error.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  process.on("SIGINT", () => {
    clearInterval(timer);
  });
  process.on("SIGTERM", () => {
    clearInterval(timer);
  });
  if (typeof timer.unref === "function") timer.unref();

  return { run, timer, maxAgeMs, intervalMs };
}

module.exports = {
  purgeExpiredAssessments,
  startAssessmentRetentionJob,
  resolveAssessmentTtlMs,
  DEFAULT_TTL_MS,
};
