'use strict';

/**
 * SimpleBeacon Automated Weekly Compliance Reporting Engine
 *
 * Executes automated chronographic telemetry aggregation and stakeholder
 * dispatch. Runs every Monday morning (or on-demand via CLI) to send
 * Team Pro and Enterprise subscribers a high-fidelity HTML email summary
 * of their compliance metrics over the past 7 days.
 *
 * Exports:
 *   fetchWeeklyOrganizationRecords(orgId) — mock data fetcher (swap for real store)
 *   compileWeeklyReportHTML(orgName, metrics) — builds responsive HTML email
 *   executeWeeklyReportingJob(activeSubscriptions) — main dispatch loop
 */

const { generateDashboardMetrics } = require('../lib/dashboard-analytics.cjs');
// Email service reference. In production this loads the real implementation.
let _emailService = null;

function getEmailService() {
  if (_emailService) return _emailService;
  _emailService = require('../lib/email-service.cjs');
  return _emailService;
}

// Test helper to override email service in tests
function setEmailServiceForTests(es) {
  _emailService = es;
}

/**
 * Isolates historical telemetry records for a targeted organization over
 * the past 7 days. In production, this queries your persistent storage
 * collection via date-range filters.
 * @param {string} orgId — Organization identifier
 * @returns {Promise<Array>} Raw scan records
 */
async function fetchWeeklyOrganizationRecords(orgId) {
  if (!orgId) return [];

  // Simulating localized document state retrieval
  return [
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      filesCount: 184,
      linesCount: 52000,
      remediationsCount: 42,
      complianceScore: 88,
      severities: { critical: 0, high: 1, medium: 4, low: 12 }
    }
  ];
}

/**
 * Builds a styled, high-impact HTML layout optimized for professional
 * enterprise mail clients.
 * @param {string} orgName — Organization display name
 * @param {Object} metrics — Output from generateDashboardMetrics()
 * @returns {string} HTML email content
 */
function compileWeeklyReportHTML(orgName, metrics) {
  var dashboardUrl = process.env.DASHBOARD_URL || 'https://simplebeacon.ai/dashboard';

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">',
    '<div style="border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:24px;">',
    '<h2 style="color:#0f172a;margin:0;">SimpleBeacon</h2>',
    '<p style="color:#64748b;font-size:14px;margin:4px 0 0 0;">Weekly AI Compliance &amp; Code Debt Assessment</p>',
    '</div>',
    '<p>Hello Team,</p>',
    '<p>Here is your automated engineering quality rollup for <strong>' + orgName + '</strong> over the past 7 days:</p>',
    '<div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #e2e8f0;">',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">',
    '<div style="padding:8px;">',
    '<span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;">Current Grade</span>',
    '<div style="font-size:32px;font-weight:700;color:#3b82f6;margin-top:4px;">' + metrics.currentGrade + '</div>',
    '</div>',
    '<div style="padding:8px;">',
    '<span style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;">Dev Hours Saved</span>',
    '<div style="font-size:32px;font-weight:700;color:#10b981;margin-top:4px;">' + metrics.developerHoursSaved + ' hrs</div>',
    '</div>',
    '</div>',
    '<div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:14px;color:#475569;">',
    '&bull; <strong>Total Scans Conducted:</strong> ' + metrics.totalScans + '<br />',
    '&bull; <strong>Files Analyzed:</strong> ' + metrics.totalFilesAnalyzed + '<br />',
    '&bull; <strong>AI Issues Remediated:</strong> ' + metrics.totalIssuesRemediated + '<br />',
    '&bull; <strong>Average Code Quality Score:</strong> ' + metrics.averageComplianceScore + '/100',
    '</div>',
    '</div>',
    '<div style="margin:24px 0;text-align:center;">',
    '<a href="' + dashboardUrl + '" style="background-color:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;display:inline-block;">Open Analytics Dashboard</a>',
    '</div>',
    '<p style="font-size:12px;color:#94a3b8;line-height:1.5;margin-top:40px;border-top:1px solid #edf2f7;padding-top:16px;">',
    'This is an automated intelligence summary sent securely via your active SimpleBeacon Team Pro subscription. All analysis executed locally on your infrastructure under zero-data custody parameters.',
    '</p>',
    '</div>'
  ].join('\n');
}

/**
 * Triggers the scanning loop across a series of active tenant nodes.
 * Only team_pro and enterprise tiers receive weekly reports.
 * @param {Array} activeSubscriptions — Array of subscription objects
 * @returns {Promise<{succeeded:number,skipped:number,failed:number}>}
 */
async function executeWeeklyReportingJob(activeSubscriptions) {
  if (!Array.isArray(activeSubscriptions)) activeSubscriptions = [];

  console.log('[WeeklyReporter] Starting weekly compliance reporting for ' + activeSubscriptions.length + ' tenants...');

  var results = { succeeded: 0, skipped: 0, failed: 0 };

  for (var i = 0; i < activeSubscriptions.length; i++) {
    var subscription = activeSubscriptions[i];
    try {
      // Guarding against non-team licenses or inactive accounts
      if (subscription.tier !== 'team_pro' && subscription.tier !== 'enterprise') {
        results.skipped++;
        continue;
      }

      var records = await fetchWeeklyOrganizationRecords(subscription.orgId);
      if (records.length === 0) {
        results.skipped++;
        continue;
      }

      var metrics = generateDashboardMetrics(records);
      var htmlContent = compileWeeklyReportHTML(subscription.orgName, metrics);

      // Use accessor so tests can override the email service
      var emailService = getEmailService();
      await emailService.sendEmail({
        to: subscription.adminEmail,
        subject: 'SimpleBeacon Weekly Compliance Report: Grade ' + metrics.currentGrade + ' for ' + subscription.orgName,
        html: htmlContent
      });

      results.succeeded++;
    } catch (error) {
      console.error('[WeeklyReporter] Failed for Org ' + (subscription.orgId || 'unknown') + ': ' + (error && error.message ? error.message : error));
      results.failed++;
    }
  }

  console.log('[WeeklyReporter] Done: ' + results.succeeded + ' succeeded, ' + results.skipped + ' skipped, ' + results.failed + ' failed');
  return results;
}

module.exports = {
  fetchWeeklyOrganizationRecords: fetchWeeklyOrganizationRecords,
  compileWeeklyReportHTML: compileWeeklyReportHTML,
  executeWeeklyReportingJob: executeWeeklyReportingJob
  , setEmailServiceForTests: setEmailServiceForTests
};
