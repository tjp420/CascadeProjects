// simplebeacon-ignore memory-leak
import { scanService } from './services/scanService.js?v=20260716cachefix1';
/**
 * Global scan utility wrapper for non-module consumers and quick scripting.
 * Delegates to the canonical ScanService so behaviour stays consistent.
 */
window.ScanUtils = {
    /**
     * Trigger a scan and return enriched results.
     * @param {string} [projectPath]
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async runScan(projectPath, options = {}) {
        return scanService.runScan(projectPath, options);
    },
    /**
     * Return the current report issues (or empty array if none loaded).
     * @returns {Promise<Object>}
     */
    async getResults() {
        var _a, _b, _c, _d, _e;
        const report = scanService.report;
        if (report) {
            return {
                issues: report.rawIssues || report.detectedIssues || [],
                projectPath: report.projectRoot || null,
                timestamp: report.timestamp || null,
                gateFailed: report.gateFailed || false
            };
        }
        // Try fetching the report from the server if none cached
        try {
            await scanService.fetchReport();
            return {
                issues:
                    ((_a = scanService.report) === null || _a === void 0 ? void 0 : _a.rawIssues) ||
                    ((_b = scanService.report) === null || _b === void 0 ? void 0 : _b.detectedIssues) ||
                    [],
                projectPath: ((_c = scanService.report) === null || _c === void 0 ? void 0 : _c.projectRoot) || null,
                timestamp: ((_d = scanService.report) === null || _d === void 0 ? void 0 : _d.timestamp) || null,
                gateFailed: ((_e = scanService.report) === null || _e === void 0 ? void 0 : _e.gateFailed) || false
            };
        } catch (_f) {
            return { issues: [] };
        }
    },
    /**
     * Fetch scan progress for a given project.
     * @param {string} projectPath
     * @returns {Promise<Object>}
     */
    async getProgress(projectPath) {
        return scanService.fetchScanProgress(projectPath);
    },
    /**
     * Export the current report as JSON.
     */
    exportReport() {
        scanService.exportReport();
    },
    /**
     * Return issue categories derived from the current report.
     * @returns {Array<Object>}
     */
    getIssueCategories() {
        return scanService.getIssueCategories();
    }
};
