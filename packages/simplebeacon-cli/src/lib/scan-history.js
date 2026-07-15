/**
 * Append scan summaries to .simplebeacon/history.json (shared by CLI and dashboard API).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { countFictionIssues } = require('../rules/ai-fiction-detection');
const constants = require('./constants');

function repairHistoryEntry(entry = {}) {
    if (!entry || typeof entry !== 'object') return entry;

    const sev = entry.severityCounts || {};
    const high = sev.high ?? 0;
    const critical = sev.critical ?? 0;
    const gatePass = entry.gatePass === true;
    const warnings = entry.warningCount ?? sev.medium ?? 0;
    let repaired = { ...entry };

    if (gatePass && critical === 0 && high === 0 && (repaired.qualityScore ?? 100) <= 20) {
        repaired.qualityScore = 100;
    }

    if (repaired.warningCount != null || repaired.blockingCount != null) {
        repaired.issueCount = (repaired.blockingCount ?? 0) + (repaired.warningCount ?? 0);
    } else if (gatePass && critical === 0 && high === 0 && (repaired.issueCount ?? 0) > 20) {
        repaired.issueCount = warnings || repaired.issueCount;
    }

    if (gatePass && critical === 0 && high === 0 && (sev.medium ?? 0) > (repaired.issueCount ?? 0)) {
        repaired.severityCounts = {
            ...sev,
            medium: repaired.issueCount ?? sev.medium
        };
    }

    return repaired;
}

function repairHistoryEntries(history = []) {
    return (Array.isArray(history) ? history : []).map(repairHistoryEntry);
}

function resolveHistoryEntryForReport(history = [], report = {}) {
    const entries = Array.isArray(history) ? history : [];
    if (!entries.length) {
        return report?.generatedAt ? buildHistoryEntry(report) : null;
    }

    const reportAt = report?.generatedAt;
    if (reportAt) {
        const exact = entries.find((entry) => entry.date === reportAt);
        if (exact) return exact;

        const reportMs = Date.parse(reportAt);
        if (!Number.isNaN(reportMs)) {
            const closeMatches = entries.filter((entry) => {
                const entryMs = Date.parse(entry.date);
                return !Number.isNaN(entryMs) && Math.abs(entryMs - reportMs) <= constants.TIMEOUT_5S;
            });
            if (closeMatches.length) return closeMatches[closeMatches.length - 1];
        }
    }

    return entries[entries.length - 1];
}

function buildHistoryEntry(report = {}) {
    const gate = report.gate || {};
    const blockingCount = gate.blockingCount ?? 0;
    const warningCount = gate.warningCount ?? 0;
    return {
        scanId: crypto.randomUUID(),
        date: report.generatedAt || new Date().toISOString(),
        issueCount: (blockingCount + warningCount) || (report.issueCount ?? 0),
        warningCount,
        blockingCount,
        qualityScore: report.qualityScore ?? 0,
        gatePass: gate.pass ?? false,
        severityCounts: report.severityCounts || {},
        fictionPatternsFound: countFictionIssues(report),
        totalFilesScanned: report.filesAnalyzed ?? report.repositoryFilesTotal ?? report.totalFiles ?? 0
    };
}

function appendScanHistory(platformRoot, report, options = {}) {
    const historyPath = path.join(platformRoot, '.simplebeacon', 'history.json');
    const entry = buildHistoryEntry(report);

    let history = [];
    try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        if (!Array.isArray(history)) history = [];
    } catch {
        history = [];
    }

    const last = history[history.length - 1];
    if (last && last.date === entry.date && last.issueCount === entry.issueCount && last.qualityScore === entry.qualityScore) {
        return { history, entry: last, appended: false };
    }

    history.push(entry);
    if (history.length > 30) {
        history = history.slice(-30);
    }

    if (!options.dryRun) {
        fs.mkdirSync(path.dirname(historyPath), { recursive: true });
        fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    }

    return { history, entry, appended: true };
}

module.exports = {
    buildHistoryEntry,
    appendScanHistory,
    repairHistoryEntry,
    repairHistoryEntries,
    resolveHistoryEntryForReport
};
