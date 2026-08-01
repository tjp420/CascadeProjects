'use strict';

const logger = require('./app-logger.cjs');
const fs = require('fs');
const path = require('path');
const reportScheduleStore = require('./report-schedule-store.cjs');
const { sendReportEmail, ensureReportsDir, REPORTS_DIR } = require('./report-mailer.cjs');

let schedulerInterval = null;
let analyticsStoreRef = null;
const CHECK_INTERVAL_MS = 60 * 1000;

function setAnalyticsStore(store) {
  analyticsStoreRef = store;
}

function shouldRunNow(schedule) {
  if (!schedule.enabled) return false;
  const now = new Date();
  const lastRun = schedule.lastRunAt ? new Date(schedule.lastRunAt) : null;

  if (schedule.frequency === 'daily') {
    if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
    if (lastRun && isSameDay(lastRun, now)) return false;
    return true;
  }

  if (schedule.frequency === 'weekly') {
    if (now.getDay() !== schedule.dayOfWeek) return false;
    if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
    if (lastRun && isSameDay(lastRun, now)) return false;
    return true;
  }

  if (schedule.frequency === 'monthly') {
    if (now.getDate() !== schedule.dayOfMonth) return false;
    if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
    if (lastRun && lastRun.getMonth() === now.getMonth() && lastRun.getFullYear() === now.getFullYear()) return false;
    return true;
  }

  return false;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function escapeCsv(val) {
  let s = String(val ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function generateReport(schedule, orgId) {
  if (!analyticsStoreRef) throw new Error('Analytics store not initialized');

  const filters = schedule.filters || {};
  const result = analyticsStoreRef.getScans({ orgId, limit: 100000, offset: 0 });
  let scans = result.scans || [];

  if (filters.repository) scans = scans.filter(s => s.repository === filters.repository);
  if (filters.branch) scans = scans.filter(s => s.branch === filters.branch);

  const REMEDIATION_GUIDANCE = {
    'insecure-transport': { strategy: 'TLS Enforcement', priority: 'critical', description: 'Replace all HTTP URLs with HTTPS equivalents.', steps: ['Audit all URL constants', 'Replace http:// with https://', 'Add CSP upgrade-insecure-requests directive'] },
    'missing-security-headers': { strategy: 'Header Injection', priority: 'high', description: 'Add standard security headers to all responses.', steps: ['Add X-Content-Type-Options: nosniff', 'Add X-Frame-Options: DENY', 'Add Strict-Transport-Security header'] },
    'hardcoded-secrets': { strategy: 'Vault Migration', priority: 'critical', description: 'Move secrets to environment variables or vault.', steps: ['Identify all hardcoded credentials', 'Move to env vars or secrets manager', 'Rotate exposed credentials'] },
    'debug-artifacts': { strategy: 'Production Stripping', priority: 'medium', description: 'Remove debug code from production builds.', steps: ['Remove console.log statements', 'Remove debugger statements', 'Enable production build stripping'] },
    'outdated-dependencies': { strategy: 'Dependency Upgrade', priority: 'high', description: 'Update packages with known vulnerabilities.', steps: ['Run npm audit', 'Update vulnerable packages', 'Run full test suite'] },
    'missing-rate-limit': { strategy: 'Rate Limiting', priority: 'high', description: 'Add rate limiting to API endpoints.', steps: ['Install express-rate-limit', 'Configure per-route limits', 'Add 429 response handling'] },
    'prototype-pollution': { strategy: 'Object Freeze', priority: 'high', description: 'Prevent prototype pollution attacks.', steps: ['Use Object.create(null)', 'Sanitize recursive merge functions', 'Add Object.freeze to prototypes'] },
    'eval-usage': { strategy: 'Eval Removal', priority: 'high', description: 'Replace dynamic code execution with safer, explicit parsing or structured alternatives.', steps: ['Identify dynamic-code execution sites', 'Replace with explicit parsers (e.g., JSON.parse) or validated templates', 'Add CSP restrictions where appropriate'] },
    'insecure-random': { strategy: 'CSPRNG Migration', priority: 'medium', description: 'Replace non-cryptographic RNG usage with a CSPRNG for security-sensitive contexts.', steps: ['Identify security-sensitive random usage', 'Replace with crypto.randomBytes', 'Test entropy quality'] },
    'config-drift': { strategy: 'Config Reconciliation', priority: 'low', description: 'Align configuration across environments.', steps: ['Audit environment configs', 'Create config templates', 'Deploy config validation CI check'] },
    _default: { strategy: 'Manual Review', priority: 'medium', description: 'Review and remediate findings manually.', steps: ['Review the findings', 'Determine appropriate fix', 'Apply and test the fix'] },
  };

  const SLA_THRESHOLDS = { critical: 2, high: 7, medium: 30, low: 60 };
  const ticketStatusStore = require('./ticket-status-store.cjs');
  const ticketStatuses = ticketStatusStore.getAllTicketStatuses(orgId);

  let violations = [];
  for (const scan of scans) {
    const cc = scan.categoryCounts || {};
    for (const [category, count] of Object.entries(cc)) {
      if (count === 0) continue;
      const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
      const status = ticketStatuses[ticketStatusStore.buildTicketKey(orgId, scan.scanId, category)];
      const ticketed = !!status;
      const ticketRef = status?.ticketRef || '';
      const ticketTarget = status?.ticketTarget || '';
      const ticketMarkedAt = status?.markedAt || '';
      const scanDate = new Date(scan.timestamp);
      const daysOpen = Math.floor((Date.now() - scanDate.getTime()) / 86400000);
      const slaLimit = SLA_THRESHOLDS[guidance.priority] || 30;
      const slaBreached = daysOpen > slaLimit;
      const slaDaysOver = slaBreached ? daysOpen - slaLimit : 0;
      violations.push({
        scanId: scan.scanId, timestamp: scan.timestamp, repository: scan.repository,
        branch: scan.branch, commitSha: scan.commitSha, triggeredBy: scan.triggeredBy,
        category, count, postureScore: scan.postureScore, gateStatus: scan.gateStatus,
        priority: guidance.priority, remediationStrategy: guidance.strategy,
        remediationDescription: guidance.description,
        remediationSteps: (guidance.steps || []).join('; '),
        ticketed, ticketRef, ticketTarget, ticketMarkedAt,
        daysOpen, slaLimit, slaBreached, slaDaysOver,
      });
    }
  }

  if (filters.ticketStatus === 'ticketed') violations = violations.filter(v => v.ticketed);
  else if (filters.ticketStatus === 'unticketed') violations = violations.filter(v => !v.ticketed);
  if (filters.slaBreached === 'true' || filters.slaBreached === true) violations = violations.filter(v => v.slaBreached);

  ensureReportsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const format = schedule.format || 'csv';
  const filename = `compliance-ledger-${timestamp}.${format}`;
  const filePath = path.join(REPORTS_DIR, filename);

  if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), schedule: schedule.name, totalViolations: violations.length, violations }, null, 2));
  } else {
    const headers = ['Scan ID', 'Timestamp', 'Repository', 'Branch', 'Commit SHA', 'Triggered By', 'Category', 'Findings Count', 'Posture Score', 'Gate Status', 'Priority', 'Remediation Strategy', 'Remediation Description', 'Remediation Steps', 'Ticketed', 'Ticket Ref', 'Ticket Target', 'Ticket Marked At', 'Days Open', 'SLA Limit (days)', 'SLA Breached', 'SLA Days Over'];
    const rows = violations.map(v => [v.scanId, v.timestamp, v.repository, v.branch, v.commitSha, v.triggeredBy, v.category, v.count, v.postureScore, v.gateStatus, v.priority, v.remediationStrategy, v.remediationDescription, v.remediationSteps, v.ticketed, v.ticketRef, v.ticketTarget, v.ticketMarkedAt, v.daysOpen, v.slaLimit, v.slaBreached, v.slaDaysOver]);
    const csv = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
    fs.writeFileSync(filePath, csv);
  }

  return { filePath, filename, format, totalViolations: violations.length };
}

async function runSchedule(schedule, orgId) {
  const id = schedule.id;
  try {
    logger.info(`[ReportScheduler] Running schedule "${schedule.name}" (${id})`);
    const report = await generateReport(schedule, orgId);
    const subject = `[Simplebeacon] Compliance Report — ${schedule.name} — ${new Date().toISOString().slice(0, 10)}`;
    const body = [
      `Compliance Report: ${schedule.name}`,
      `Generated: ${new Date().toISOString()}`,
      `Total Violations: ${report.totalViolations}`,
      `Format: ${report.format}`,
      ``,
      `The full compliance ledger is attached to this email.`,
      ``,
      `— Simplebeacon Compliance Engine`,
    ].join('\n');
    const emailResult = await sendReportEmail({
      recipients: schedule.recipients,
      subject,
      body,
      attachmentPath: report.filePath,
      attachmentName: report.filename,
    });
    reportScheduleStore.updateScheduleRunResult(id, emailResult.success ? 'success' : 'partial', emailResult.error, orgId);
    logger.info(`[ReportScheduler] Schedule "${schedule.name}" completed: ${emailResult.method}`);
    return { success: true, report, emailResult };
  } catch (err) {
    logger.error(`[ReportScheduler] Schedule "${schedule.name}" failed:`, err.message);
    reportScheduleStore.updateScheduleRunResult(id, 'failed', err.message, orgId);
    return { success: false, error: err.message };
  }
}

async function checkAndRun() {
  try {
    const schedules = reportScheduleStore.getAllSchedules();
    for (const [id, schedule] of Object.entries(schedules)) {
      if (shouldRunNow(schedule)) {
        await runSchedule(schedule, schedule.orgId);
      }
    }
  } catch (err) {
    logger.error('[ReportScheduler] Check cycle failed:', err.message);
  }
}

function startScheduler() {
  if (schedulerInterval) return;
  logger.info('[ReportScheduler] Background scheduler started (60s check interval)');
  schedulerInterval = setInterval(checkAndRun, CHECK_INTERVAL_MS);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[ReportScheduler] Background scheduler stopped');
  }
}

module.exports = { startScheduler, stopScheduler, setAnalyticsStore, runSchedule, generateReport, checkAndRun };
