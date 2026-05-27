const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache');

const DEFAULT_HISTORY_LIMIT = 180;

function toInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTrustHistoryPath(platformRoot, customPath) {
    if (customPath) return path.resolve(customPath);
    return path.join(path.resolve(platformRoot), '.simplebeacon', 'trust-history.json');
}

function readJsonIfExists(filePath) {
    return readJsonFileCached(filePath);
}

function readTrustHistory(historyPath) {
    const payload = readJsonIfExists(historyPath);
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return {
        type: 'simplebeacon-trust-history',
        version: 1,
        generatedAt: payload?.generatedAt || null,
        historyPath,
        entries
    };
}

function writeTrustHistory(historyPath, entries) {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(
        historyPath,
        `${JSON.stringify({
            type: 'simplebeacon-trust-history',
            version: 1,
            generatedAt: new Date().toISOString(),
            entries
        }, null, 2)}\n`,
        'utf8'
    );
}

function buildHistoryEntry(payload, source = 'trust:publish') {
    const headline = payload?.headline || {};
    return {
        recordedAt: new Date().toISOString(),
        generatedAt: payload?.generatedAt || null,
        verificationId: payload?.verificationId || null,
        verificationMethod: payload?.verificationMethod || null,
        source,
        headlineSource: payload?.headlineSource || null,
        gatePass: headline.gatePass ?? null,
        qualityScore: headline.qualityScore ?? null,
        issues: headline.issueCount ?? null,
        schemaCompliance: headline.schemaCompliance ?? null,
        repositoryFilesTotal: headline.repositoryFilesTotal ?? null,
        ruleScopedFilesAnalyzed: headline.ruleScopedFilesAnalyzed ?? null,
        platform: payload?.platform
            ? {
                issueCount: payload.platform.issueCount ?? null,
                gatePass: payload.platform.gatePass ?? null,
                generatedAt: payload.platform.generatedAt || null
            }
            : null,
        monorepo: payload?.monorepo
            ? {
                issueCount: payload.monorepo.issueCount ?? null,
                gatePass: payload.monorepo.gatePass ?? null,
                generatedAt: payload.monorepo.generatedAt || null
            }
            : null
    };
}

function appendTrustSnapshot({
    payload,
    historyPath,
    maxEntries = DEFAULT_HISTORY_LIMIT,
    source = 'trust:publish'
}) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('appendTrustSnapshot requires a trust payload object');
    }
    const current = readTrustHistory(historyPath);
    const existing = current.entries || [];
    const nextEntry = buildHistoryEntry(payload, source);
    const dedupeKey = nextEntry.verificationId || `${nextEntry.generatedAt}|${nextEntry.issues}|${nextEntry.qualityScore}`;
    const filtered = existing.filter((entry) => {
        const key = entry.verificationId || `${entry.generatedAt}|${entry.issues}|${entry.qualityScore}`;
        return key !== dedupeKey;
    });
    const cap = toInteger(maxEntries, DEFAULT_HISTORY_LIMIT);
    const nextEntries = [nextEntry, ...filtered].slice(0, cap);
    writeTrustHistory(historyPath, nextEntries);
    return {
        historyPath,
        entry: nextEntry,
        count: nextEntries.length
    };
}

function numeric(value) {
    return Number.isFinite(value) ? value : Number(value);
}

function buildTrustTrend(entries, windowSize = 30) {
    const limit = toInteger(windowSize, 30);
    const scoped = Array.isArray(entries) ? entries.slice(0, limit) : [];
    const scored = scoped.filter((entry) => Number.isFinite(numeric(entry.qualityScore)));
    const issueEntries = scoped.filter((entry) => Number.isFinite(numeric(entry.issues)));
    const passCount = scoped.filter((entry) => entry.gatePass === true).length;
    const newest = scoped[0] || null;
    const oldest = scoped[scoped.length - 1] || null;
    const avgQuality = scored.length
        ? Number((scored.reduce((sum, entry) => sum + numeric(entry.qualityScore), 0) / scored.length).toFixed(2))
        : null;
    const avgIssues = issueEntries.length
        ? Number((issueEntries.reduce((sum, entry) => sum + numeric(entry.issues), 0) / issueEntries.length).toFixed(2))
        : null;
    const issueDelta = newest && oldest
        && Number.isFinite(numeric(newest.issues))
        && Number.isFinite(numeric(oldest.issues))
        ? numeric(newest.issues) - numeric(oldest.issues)
        : null;

    return {
        window: limit,
        snapshots: scoped.length,
        passRatePercent: scoped.length ? Number(((passCount / scoped.length) * 100).toFixed(1)) : null,
        avgQualityScore: avgQuality,
        avgIssues,
        issueDelta,
        qualityDelta: newest && oldest
            && Number.isFinite(numeric(newest.qualityScore))
            && Number.isFinite(numeric(oldest.qualityScore))
            ? Number((numeric(newest.qualityScore) - numeric(oldest.qualityScore)).toFixed(2))
            : null,
        latest: newest
            ? {
                verificationId: newest.verificationId || null,
                generatedAt: newest.generatedAt || newest.recordedAt || null,
                gatePass: newest.gatePass ?? null,
                qualityScore: newest.qualityScore ?? null,
                issues: newest.issues ?? null
            }
            : null
    };
}

module.exports = {
    DEFAULT_HISTORY_LIMIT,
    resolveTrustHistoryPath,
    readTrustHistory,
    appendTrustSnapshot,
    buildTrustTrend
};
