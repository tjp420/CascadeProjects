// simplebeacon-ignore memory-leak
import { scanService } from './services/scanService.js';

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
    const report = scanService.report;
    if (report) {
      return {
        issues: report.rawIssues || report.detectedIssues || [],
        projectPath: report.projectRoot || null,
        timestamp: report.timestamp || null,
        gateFailed: report.gateFailed || false,
      };
    }
    // Try fetching the report from the server if none cached
    try {
      await scanService.fetchReport();
      return {
        issues: scanService.report?.rawIssues || scanService.report?.detectedIssues || [],
        projectPath: scanService.report?.projectRoot || null,
        timestamp: scanService.report?.timestamp || null,
        gateFailed: scanService.report?.gateFailed || false,
      };
    } catch {
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
  },
};
