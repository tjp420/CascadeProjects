/**
 * Purge expired assessment artifacts (cloned repos + JSON) from assessments/.
 */

const logger = require('../lib/app-logger');

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

function parseAssessmentCreatedAt(assessmentDir) {
    try {
        const raw = fs.readFileSync(path.join(assessmentDir, 'assessment.json'), 'utf8');
        const data = JSON.parse(raw);
        const created = data?.metadata?.createdAt;
        if (created) {
            const ts = Date.parse(created);
            if (Number.isFinite(ts)) return ts;
        }
    } catch {
        /* fall through to mtime */
    }
    try {
        return fs.statSync(assessmentDir).mtimeMs;
    } catch {
        return null;
    }
}

async function purgeExpiredAssessments(assessmentsDir, options = {}) {
    const maxAgeMs = options.maxAgeMs ?? DEFAULT_TTL_MS;
    const now = Date.now();
    const removed = [];

    if (!fs.existsSync(assessmentsDir)) {
        return { removed, skipped: 0 };
    }

    const entries = await fsp.readdir(assessmentsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('assessment_')) continue;

        const dirPath = path.join(assessmentsDir, entry.name);
        const createdAt = parseAssessmentCreatedAt(dirPath);
        if (createdAt == null) continue;
        if (now - createdAt <= maxAgeMs) continue;

        await fsp.rm(dirPath, { recursive: true, force: true });
        removed.push(entry.name);
    }

    return { removed, skipped: entries.length - removed.length };
}

function resolveAssessmentTtlMs() {
    const hours = parseFloat(process.env.ASSESSMENT_TTL_HOURS || '24', 10);
    if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_TTL_MS;
    return Math.round(hours * 60 * 60 * 1000);
}

function startAssessmentRetentionJob(options = {}) {
    const assessmentsDir = options.assessmentsDir;
    if (!assessmentsDir) {
        throw new Error('assessmentsDir is required');
    }

    const maxAgeMs = options.maxAgeMs ?? resolveAssessmentTtlMs();
    const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

    const run = async () => {
        try {
            const result = await purgeExpiredAssessments(assessmentsDir, { maxAgeMs });
            if (result.removed.length) {
                logger.debug(`[Assessment] Purged ${result.removed.length} expired assessment(s)`);
            }
        } catch (error) {
            logger.warn('[Assessment] Retention purge failed:', error.message);
        }
    };

    run();
    const timer = setInterval(run, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();

    return { run, timer, maxAgeMs, intervalMs };
}

module.exports = {
    purgeExpiredAssessments,
    startAssessmentRetentionJob,
    resolveAssessmentTtlMs,
    DEFAULT_TTL_MS
};
