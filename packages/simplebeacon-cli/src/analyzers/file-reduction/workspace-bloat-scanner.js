/**
 * Detect workspace bloat directories (benchmark caches, audit sandboxes, deploy mirrors)
 * without walking their contents — uses shallow metrics on skipped trees.
 */

const fs = require('fs');
const path = require('path');
const defaultPatterns = require('./config/workspace-bloat-patterns.json');
const { matchesGlobPattern } = require('./utils/project-walker');
const { estimateSkippedDirectoryMetrics } = require('./utils/artifact-path-utils');

function normalizeRelativePath(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

class WorkspaceBloatScanner {
    constructor(config = {}) {
        this.patterns = {
            relativePaths: {
                safeToDelete: config.relativePaths?.safeToDelete
                    || defaultPatterns.relativePaths?.safeToDelete
                    || [],
                reviewBeforeDelete: config.relativePaths?.reviewBeforeDelete
                    || defaultPatterns.relativePaths?.reviewBeforeDelete
                    || []
            },
            topLevelNamePatterns: {
                safeToDelete: config.topLevelNamePatterns?.safeToDelete
                    || defaultPatterns.topLevelNamePatterns?.safeToDelete
                    || []
            }
        };
    }

    async scan(projectRoot, options = {}) {
        const root = path.resolve(projectRoot);
        const findings = [];
        const seenPaths = new Set();

        const pushFinding = (spec, relativePath, action) => {
            const normalized = normalizeRelativePath(relativePath);
            if (!normalized || seenPaths.has(normalized)) return;
            seenPaths.add(normalized);

            const fullPath = path.join(root, normalized);
            if (!fs.existsSync(fullPath)) return;
            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch {
                return;
            }
            if (!stat.isDirectory()) return;

            const metrics = estimateSkippedDirectoryMetrics(
                { path: fullPath, relativePath: normalized, name: path.basename(normalized) },
                { maxFiles: options.maxEstimateFiles ?? 8000 }
            );
            if (metrics.empty && stat.size === 0) return;

            findings.push({
                type: 'workspace-bloat',
                kind: 'directory',
                path: normalized,
                reason: spec.reason,
                sizeBytes: metrics.sizeBytes,
                fileCount: metrics.fileCount,
                confidence: action === 'safe-to-delete' ? 'high' : 'medium',
                action,
                severity: action === 'safe-to-delete' ? 'low' : 'medium',
                category: spec.category || 'workspace-bloat',
                metricsTruncated: Boolean(metrics.truncated)
            });
        };

        for (const spec of this.patterns.relativePaths.safeToDelete) {
            pushFinding(spec, spec.path, 'safe-to-delete');
        }
        for (const spec of this.patterns.relativePaths.reviewBeforeDelete) {
            pushFinding(spec, spec.path, 'review-before-delete');
        }

        let topLevelEntries = [];
        try {
            topLevelEntries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            topLevelEntries = [];
        }

        for (const entry of topLevelEntries) {
            if (!entry.isDirectory()) continue;
            for (const spec of this.patterns.topLevelNamePatterns.safeToDelete) {
                if (!matchesGlobPattern(entry.name, spec.pattern)) continue;
                pushFinding(spec, entry.name, 'safe-to-delete');
            }
        }

        const safeFindings = findings.filter((finding) => finding.action === 'safe-to-delete');
        const reviewFindings = findings.filter((finding) => finding.action === 'review-before-delete');

        return {
            scanner: 'workspace-bloat',
            findings,
            summary: {
                bloatDirectories: findings.length,
                safeToDeleteDirectories: safeFindings.length,
                reviewBeforeDeleteDirectories: reviewFindings.length,
                reclaimableBytes: findings.reduce((sum, finding) => sum + (finding.sizeBytes || 0), 0),
                safeToDeleteBytes: safeFindings.reduce((sum, finding) => sum + (finding.sizeBytes || 0), 0),
                reviewBeforeDeleteBytes: reviewFindings.reduce((sum, finding) => sum + (finding.sizeBytes || 0), 0)
            }
        };
    }
}

module.exports = {
    WorkspaceBloatScanner
};
