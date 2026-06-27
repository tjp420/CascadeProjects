/**
 * Layer 5 — human expert review persistence (local JSONL store).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Resolve store path.
 * @param {any} platformRoot
 * @returns {any}
 */
function resolveStorePath(platformRoot) {
    return path.join(platformRoot, '.simplebeacon', 'expert-reviews.jsonl');
}

/**
 * Append expert review.
 * @param {any} platformRoot
 * @param {any} review
 * @returns {any}
 */
async function appendExpertReview(platformRoot, review) {
    const storePath = resolveStorePath(platformRoot);
    await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
    const entry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...review
    };
    await fs.promises.appendFile(storePath, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
}

/**
 * Load expert reviews.
 * @param {any} platformRoot
 * @param {any} filter
 * @returns {any}
 */
async function loadExpertReviews(platformRoot, filter = {}) {
    const storePath = resolveStorePath(platformRoot);
    if (!fs.existsSync(storePath)) return []; // simplebeacon-ignore sync-io — existence check before async read

    const raw = await fs.promises.readFile(storePath, 'utf8');
    const rows = raw.split('\n').filter(Boolean).map((line) => {
        try {
            return JSON.parse(line);
        } catch {
            return null;
        }
    }).filter(Boolean);

    return rows.filter((row) => {
        if (filter.filePath && row.filePath !== filter.filePath) return false;
        if (filter.projectPath && row.projectPath !== filter.projectPath) return false;
        if (filter.domain && row.domain !== filter.domain) return false;
        return true;
    });
}

/**
 * Summarize expert consensus.
 * @param {Array} reviews
 * @returns {any}
 */
async function summarizeExpertConsensus(reviews) {
    if (!reviews.length) {
        return { count: 0, consensus: null, confidence: 0 };
    }

    const validations = reviews.filter((r) => r.validation).map((r) => r.validation);
    const agree = validations.filter((v) => v === 'agree' || v === 'confirmed').length;
    const disagree = validations.filter((v) => v === 'disagree' || v === 'reject').length;

    return {
        count: reviews.length,
        agree,
        disagree,
        consensus: agree >= disagree ? 'mostly-agree' : 'mixed',
        confidence: Math.min(0.95, 0.4 + agree * 0.15),
        latestNote: reviews[reviews.length - 1]?.note || null
    };
}

module.exports = {
    appendExpertReview,
    loadExpertReviews,
    summarizeExpertConsensus,
    resolveStorePath
};
