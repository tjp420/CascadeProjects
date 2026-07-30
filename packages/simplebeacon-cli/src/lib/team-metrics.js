/**
 * Team telemetry aggregation — collects anonymized compliance metrics across
 * workspace projects without transmitting source code, file paths, or issue details.
 *
 * Data flow:
 *   scan-history.json (per-project) → aggregate-team-metrics.js → team-metrics.json
 *
 * Privacy guarantees:
 *   - No file paths, file names, or issue descriptions are stored
 *   - Only aggregate counts, scores, and trend data are persisted
 *   - Project names are hashed with a configurable salt for anonymization
 *   - All data stays local unless explicitly exported
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const METRICS_DIR = path.join(os.homedir(), '.simplebeacon', 'team-metrics');
const METRICS_FILE = path.join(METRICS_DIR, 'team-metrics.json');
const PROJECT_REGISTRY = path.join(METRICS_DIR, 'projects.json');
const MAX_HISTORY_ENTRIES = 90; // 3 months of daily snapshots

/**
 * Generate an anonymized project ID from a project path.
 * Uses SHA-256 with a configurable salt so the same project maps to the same ID
 * across scans, but the original path cannot be recovered without the salt.
 */
function anonymizeProjectId(projectPath, salt = '') {
    const normalized = path.resolve(projectPath).toLowerCase().replace(/\\/g, '/');
    return crypto.createHash('sha256').update(salt + normalized).digest('hex').substring(0, 16);
}

/**
 * Load the team metrics file.
 */
function loadTeamMetrics() {
    try {
        const raw = fs.readFileSync(METRICS_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
            return data;
        }
    } catch {
        /* no metrics file yet */
    }
    return {
        teamId: null,
        projectName: null,
        snapshots: [],
        aggregatedStats: null,
        updatedAt: null,
    };
}

/**
 * Save team metrics to disk.
 */
function saveTeamMetrics(metrics) {
    try {
        fs.mkdirSync(METRICS_DIR, { recursive: true });
        fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2) + '\n', 'utf8');
    } catch {
        /* read-only filesystem — best effort */
    }
}

/**
 * Load the project registry (maps anonymized IDs to friendly names).
 * This file is optional and only exists if the user explicitly registers projects.
 */
function loadProjectRegistry() {
    try {
        const raw = fs.readFileSync(PROJECT_REGISTRY, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { projects: {} };
    }
}

/**
 * Register a project with a friendly name for display purposes.
 * The mapping is stored locally and never transmitted.
 */
function registerProject(projectPath, friendlyName, salt = '') {
    const registry = loadProjectRegistry();
    const id = anonymizeProjectId(projectPath, salt);
    registry.projects[id] = {
        friendlyName,
        registeredAt: new Date().toISOString(),
        path: projectPath,
    };
    try {
        fs.mkdirSync(METRICS_DIR, { recursive: true });
        fs.writeFileSync(PROJECT_REGISTRY, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    } catch {
        /* best effort */
    }
    return { id, ...registry.projects[id] };
}

/**
 * Build an anonymized snapshot from a scan history entry.
 * Strips all identifying information, keeping only aggregate metrics.
 */
function buildSnapshot(historyEntry, projectPath, salt = '') {
    const projectId = anonymizeProjectId(projectPath, salt);
    const sev = historyEntry.severityCounts || {};

    return {
        projectId,
        scanId: historyEntry.scanId || null,
        date: historyEntry.date || new Date().toISOString(),
        qualityScore: historyEntry.qualityScore ?? 0,
        gatePass: historyEntry.gatePass ?? false,
        issueCount: historyEntry.issueCount ?? 0,
        blockingCount: historyEntry.blockingCount ?? 0,
        warningCount: historyEntry.warningCount ?? 0,
        severityCounts: {
            critical: sev.critical ?? 0,
            high: sev.high ?? 0,
            medium: sev.medium ?? 0,
            low: sev.low ?? 0,
        },
        totalFilesScanned: historyEntry.totalFilesScanned ?? 0,
        fictionPatternsFound: historyEntry.fictionPatternsFound ?? 0,
    };
}

/**
 * Ingest scan history from a project into the team metrics store.
 * Only the latest entry is added (deduplication by scanId + date).
 */
function ingestScanHistory(projectPath, history, options = {}) {
    const salt = options.salt || '';
    const metrics = loadTeamMetrics();

    if (!Array.isArray(history) || history.length === 0) {
        return { ingested: 0, total: metrics.snapshots.length };
    }

    // Take only the latest entry to avoid duplicates
    const latest = history[history.length - 1];
    const snapshot = buildSnapshot(latest, projectPath, salt);

    // Deduplicate: skip if we already have this scanId
    const exists = metrics.snapshots.some(
        (s) => s.scanId === snapshot.scanId && s.projectId === snapshot.projectId
    );
    if (exists && !options.force) {
        return { ingested: 0, total: metrics.snapshots.length, duplicate: true };
    }

    // Remove any previous snapshot for the same project+scanId, then add
    metrics.snapshots = metrics.snapshots.filter(
        (s) => !(s.scanId === snapshot.scanId && s.projectId === snapshot.projectId)
    );
    metrics.snapshots.push(snapshot);

    // Trim to max entries (keep most recent)
    if (metrics.snapshots.length > MAX_HISTORY_ENTRIES) {
        metrics.snapshots.sort((a, b) => new Date(a.date) - new Date(b.date));
        metrics.snapshots = metrics.snapshots.slice(-MAX_HISTORY_ENTRIES);
    }

    // Recompute aggregated stats
    metrics.aggregatedStats = computeAggregatedStats(metrics.snapshots);
    metrics.updatedAt = new Date().toISOString();

    saveTeamMetrics(metrics);

    return { ingested: 1, total: metrics.snapshots.length };
}

/**
 * Compute team-level aggregated statistics from all snapshots.
 */
function computeAggregatedStats(snapshots) {
    if (!snapshots.length) {
        return {
            totalScans: 0,
            uniqueProjects: 0,
            averageQualityScore: 0,
            averageGatePassRate: 0,
            totalIssues: 0,
            totalBlocking: 0,
            totalWarnings: 0,
            totalFilesScanned: 0,
            totalFictionPatterns: 0,
            severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
            trend: { qualityScore: [], gatePassRate: [], issueCount: [] },
        };
    }

    const projectIds = new Set(snapshots.map((s) => s.projectId));
    const totalScans = snapshots.length;
    const qualityScores = snapshots.map((s) => s.qualityScore ?? 0);
    const gatePasses = snapshots.filter((s) => s.gatePass).length;
    const totalIssues = snapshots.reduce((sum, s) => sum + (s.issueCount ?? 0), 0);
    const totalBlocking = snapshots.reduce((sum, s) => sum + (s.blockingCount ?? 0), 0);
    const totalWarnings = snapshots.reduce((sum, s) => sum + (s.warningCount ?? 0), 0);
    const totalFiles = snapshots.reduce((sum, s) => sum + (s.totalFilesScanned ?? 0), 0);
    const totalFiction = snapshots.reduce((sum, s) => sum + (s.fictionPatternsFound ?? 0), 0);

    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const s of snapshots) {
        const sev = s.severityCounts || {};
        severityBreakdown.critical += sev.critical ?? 0;
        severityBreakdown.high += sev.high ?? 0;
        severityBreakdown.medium += sev.medium ?? 0;
        severityBreakdown.low += sev.low ?? 0;
    }

    // Build trend series (last 10 snapshots, chronologically)
    const sorted = [...snapshots].sort((a, b) => new Date(a.date) - new Date(b.date));
    const recent = sorted.slice(-10);
    const trend = {
        qualityScore: recent.map((s) => ({ date: s.date, value: s.qualityScore ?? 0 })),
        gatePassRate: recent.map((s) => ({ date: s.date, value: s.gatePass ? 1 : 0 })),
        issueCount: recent.map((s) => ({ date: s.date, value: s.issueCount ?? 0 })),
    };

    return {
        totalScans,
        uniqueProjects: projectIds.size,
        averageQualityScore: Math.round(qualityScores.reduce((a, b) => a + b, 0) / totalScans),
        averageGatePassRate: Math.round((gatePasses / totalScans) * 100),
        totalIssues,
        totalBlocking,
        totalWarnings,
        totalFilesScanned: totalFiles,
        totalFictionPatterns: totalFiction,
        severityBreakdown,
        trend,
    };
}

/**
 * Get per-project breakdown from snapshots.
 */
function getProjectBreakdown(snapshots, registry = null) {
    const byProject = {};
    for (const s of snapshots) {
        if (!byProject[s.projectId]) {
            byProject[s.projectId] = {
                projectId: s.projectId,
                friendlyName: registry?.projects?.[s.projectId]?.friendlyName || `Project ${s.projectId.substring(0, 8)}`,
                scans: [],
                latestScore: 0,
                latestGatePass: false,
                averageScore: 0,
                gatePassRate: 0,
            };
        }
        byProject[s.projectId].scans.push(s);
    }

    for (const proj of Object.values(byProject)) {
        const scores = proj.scans.map((s) => s.qualityScore ?? 0);
        const passes = proj.scans.filter((s) => s.gatePass).length;
        proj.averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        proj.gatePassRate = scores.length ? Math.round((passes / scores.length) * 100) : 0;
        const latest = proj.scans[proj.scans.length - 1];
        proj.latestScore = latest?.qualityScore ?? 0;
        proj.latestGatePass = latest?.gatePass ?? false;
        proj.scanCount = proj.scans.length;
        delete proj.scans; // Don't expose raw scan data in breakdown
    }

    return Object.values(byProject);
}

/**
 * Get the full team metrics report.
 */
function getTeamMetricsReport() {
    const metrics = loadTeamMetrics();
    const registry = loadProjectRegistry();
    const projectBreakdown = getProjectBreakdown(metrics.snapshots, registry);

    return {
        teamId: metrics.teamId,
        updatedAt: metrics.updatedAt,
        aggregatedStats: metrics.aggregatedStats || computeAggregatedStats(metrics.snapshots),
        projectBreakdown,
        snapshotCount: metrics.snapshots.length,
    };
}

/**
 * Export an anonymized metrics bundle for sharing with team dashboards.
 * This strips all project paths and scan IDs, keeping only aggregate data.
 */
function exportAnonymizedReport(outputPath) {
    const metrics = loadTeamMetrics();
    const registry = loadProjectRegistry();
    const report = getTeamMetricsReport();

    // Strip any potentially identifying info
    const anonymized = {
        exportedAt: new Date().toISOString(),
        aggregatedStats: report.aggregatedStats,
        projectBreakdown: report.projectBreakdown.map((p) => ({
            friendlyName: p.friendlyName,
            scanCount: p.scanCount,
            latestScore: p.latestScore,
            latestGatePass: p.latestGatePass,
            averageScore: p.averageScore,
            gatePassRate: p.gatePassRate,
        })),
        snapshotCount: report.snapshotCount,
    };

    if (outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(anonymized, null, 2) + '\n', 'utf8');
    }

    return anonymized;
}

/**
 * Clear all team metrics.
 */
function clearTeamMetrics() {
    try {
        fs.unlinkSync(METRICS_FILE);
        return true;
    } catch {
        return false;
    }
}

/**
 * Set the team identifier for this workspace.
 */
function setTeamId(teamId) {
    const metrics = loadTeamMetrics();
    metrics.teamId = teamId;
    metrics.updatedAt = new Date().toISOString();
    saveTeamMetrics(metrics);
    return metrics;
}

module.exports = {
    anonymizeProjectId,
    ingestScanHistory,
    buildSnapshot,
    computeAggregatedStats,
    getProjectBreakdown,
    getTeamMetricsReport,
    exportAnonymizedReport,
    clearTeamMetrics,
    setTeamId,
    registerProject,
    loadTeamMetrics,
    loadProjectRegistry,
    METRICS_DIR,
    METRICS_FILE,
};
