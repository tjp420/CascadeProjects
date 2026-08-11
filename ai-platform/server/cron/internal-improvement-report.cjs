'use strict';

/**
 * SimpleBeacon Internal Program Improvement Report Generator
 *
 * Aggregates privacy-safe telemetry across all organizations to produce
 * an internal product improvement report. Contains NO user-identifiable
 * information — only aggregate counts, severity distributions, type code
 * frequencies, and hashed fingerprint counts.
 *
 * Privacy guarantees:
 *   - No emails, file paths, repo paths, or issue descriptions
 *   - k-anonymity floor enforced (min 3 workspaces before breakdowns shown)
 *   - Only aggregate metrics and hashed fingerprints
 *
 * Exports:
 *   generateImprovementReportMarkdown(summary) — builds markdown report
 *   executeImprovementReportJob(options) — generates + emails the report
 */

const { summarizeAllTelemetry } = require('../lib/ci-telemetry-store.cjs');

let _emailService = null;

function getEmailService() {
  if (_emailService) return _emailService;
  _emailService = require('../lib/email-service.cjs');
  return _emailService;
}

function setEmailServiceForTests(es) {
  _emailService = es;
}

/**
 * Maps a severity totals object to a sorted array of [severity, count] pairs.
 * @param {Object} severityTotals
 * @returns {Array<[string, number]>}
 */
function sortSeverityTotals(severityTotals) {
  const order = ['critical', 'high', 'medium', 'low'];
  return order
    .map((sev) => [sev, Number(severityTotals[sev] || 0)])
    .filter(([, count]) => count > 0);
}

/**
 * Maps a category totals object to a sorted array of [category, count] pairs.
 * @param {Object} categoryTotals
 * @returns {Array<[string, number]>}
 */
function sortCategoryTotals(categoryTotals) {
  return Object.entries(categoryTotals || {})
    .map(([cat, count]) => [cat, Number(count || 0)])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

/**
 * Formats a quality distribution object into a readable string.
 * @param {Object} dist
 * @returns {string}
 */
function formatQualityDistribution(dist) {
  if (!dist || !dist.sampleSize || dist.sampleSize === 0) {
    return 'No quality score data available.';
  }
  return [
    `p10: ${dist.p10 != null ? dist.p10 : 'N/A'}`,
    `p25: ${dist.p25 != null ? dist.p25 : 'N/A'}`,
    `p50: ${dist.p50 != null ? dist.p50 : 'N/A'}`,
    `p75: ${dist.p75 != null ? dist.p75 : 'N/A'}`,
    `p90: ${dist.p90 != null ? dist.p90 : 'N/A'}`,
    `sample size: ${dist.sampleSize}`
  ].join(' · ');
}

/**
 * Builds a markdown report from a telemetry summary.
 * @param {Object} summary — Output from summarizeAllTelemetry()
 * @returns {string} Markdown report
 */
function generateImprovementReportMarkdown(summary) {
  if (!summary || typeof summary !== 'object') {
    return '# SimpleBeacon Internal Improvement Report\n\nNo telemetry data available.\n';
  }

  const generatedAt = new Date().toISOString();
  const periodDays = summary.periodDays || 30;
  const kAnonStatus = summary.k_anonymity_met
    ? `MET (min ${summary.k_anonymity_min} workspaces, ${summary.distinct_workspaces} contributing)`
    : `NOT MET (need ${summary.k_anonymity_min} workspaces, only ${summary.distinct_workspaces} contributing — breakdowns suppressed)`;

  const severityLines = sortSeverityTotals(summary.severity_totals || {});
  const severitySection = severityLines.length > 0
    ? severityLines.map(([sev, count]) => `- **${sev}**: ${count}`).join('\n')
    : '- No severity data available.';

  const categoryLines = sortCategoryTotals(summary.category_totals || {});
  const categorySection = categoryLines.length > 0
    ? categoryLines.map(([cat, count]) => `- **${cat}**: ${count}`).join('\n')
    : '- No category data available.';

  const scanSources = summary.scan_sources || { ci: 0, ide: 0, dashboard: 0 };
  const sourcesSection = [
    `- **CI**: ${scanSources.ci || 0}`,
    `- **IDE**: ${scanSources.ide || 0}`,
    `- **Dashboard**: ${scanSources.dashboard || 0}`
  ].join('\n');

  const workspaceSection = summary.k_anonymity_met && summary.workspace_breakdown
    ? summary.workspace_breakdown.map((ws) =>
        `- ${ws.workspace_fingerprint.substring(0, 8)}...: ${ws.scan_count} scans`
      ).join('\n')
    : '_Suppressed — k-anonymity floor not met._';

  const gatePassPct = summary.total_scans > 0
    ? Math.round(summary.gate_pass_rate * 100)
    : 0;

  return [
    `# SimpleBeacon Internal Program Improvement Report`,
    ``,
    `**Generated**: ${generatedAt}`,
    `**Period**: Last ${periodDays} days`,
    ``,
    `## Executive Summary`,
    ``,
    `- **Total scans**: ${summary.total_scans || 0}`,
    `- **Distinct workspaces**: ${summary.distinct_workspaces || 0}`,
    `- **Distinct organizations**: ${summary.distinct_orgs || 0}`,
    `- **Gate pass rate**: ${gatePassPct}% (${summary.gate_pass_rate || 0})`,
    `- **Gates tripped**: ${summary.gates_tripped || 0}`,
    `- **Criticals blocked**: ${summary.criticals_blocked || 0}`,
    `- **k-anonymity**: ${kAnonStatus}`,
    ``,
    `## Severity Distribution`,
    ``,
    severitySection,
    ``,
    `## Issue Category Frequency`,
    ``,
    categorySection,
    ``,
    `## Quality Score Distribution`,
    ``,
    formatQualityDistribution(summary.quality_distribution),
    ``,
    `## Scan Source Adoption`,
    ``,
    sourcesSection,
    ``,
    `## Workspace Breakdown`,
    ``,
    workspaceSection,
    ``,
    `## Privacy Status`,
    ``,
    `- k-anonymity floor: ${summary.k_anonymity_min} workspaces minimum`,
    `- Current contributing workspaces: ${summary.distinct_workspaces}`,
    `- Status: ${summary.k_anonymity_met ? 'AGGREGATE STATS VISIBLE' : 'BREAKDOWNS SUPPRESSED'}`,
    `- No emails, file paths, source code, or issue descriptions in this report.`,
    `- All workspace identifiers are SHA-256 hashed fingerprints.`,
    ``
  ].join('\n');
}

/**
 * Generates and optionally emails the internal improvement report.
 * @param {{ days?: number, dryRun?: boolean, notifyEmail?: string }} [options]
 * @returns {Promise<{markdown: string, summary: Object, emailed: boolean}>}
 */
async function executeImprovementReportJob(options = {}) {
  const days = Number(options.days) || 30;
  const dryRun = options.dryRun === true;
  const notifyEmail = String(options.notifyEmail || process.env.ADMIN_NOTIFY_EMAIL || 'admin@simplebeacon.ai').trim();

  const summary = summarizeAllTelemetry({ days });
  const markdown = generateImprovementReportMarkdown(summary);

  console.log('[ImprovementReport] Generated report for last ' + days + ' days:');
  console.log('[ImprovementReport]   Total scans: ' + summary.total_scans);
  console.log('[ImprovementReport]   Distinct workspaces: ' + summary.distinct_workspaces);
  console.log('[ImprovementReport]   k-anonymity met: ' + summary.k_anonymity_met);

  let emailed = false;
  if (!dryRun && summary.total_scans > 0) {
    try {
      const emailService = getEmailService();
      await emailService.sendEmail({
        to: notifyEmail,
        subject: `SimpleBeacon Internal Improvement Report (${summary.total_scans} scans, ${summary.distinct_workspaces} workspaces)`,
        text: markdown,
        html: `<pre style="font-family: monospace; white-space: pre-wrap; padding: 16px;">${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
      });
      emailed = true;
      console.log('[ImprovementReport] Report emailed to ' + notifyEmail);
    } catch (err) {
      console.error('[ImprovementReport] Failed to email report: ' + (err && err.message ? err.message : err));
    }
  } else if (dryRun) {
    console.log('[ImprovementReport] Dry run — report not emailed.');
  } else {
    console.log('[ImprovementReport] No telemetry data — report not emailed.');
  }

  return { markdown, summary, emailed };
}

module.exports = {
  generateImprovementReportMarkdown,
  executeImprovementReportJob,
  setEmailServiceForTests,
  sortSeverityTotals,
  sortCategoryTotals,
  formatQualityDistribution
};
