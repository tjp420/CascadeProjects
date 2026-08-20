"use strict";

/**
 * Daily Operations Report Generator
 *
 * Reads the webhook event log and generates a summary report of billing
 * operations, including payment failures, disputes, trial warnings,
 * successful payments, and subscription lifecycle events.
 *
 * The report is emailed to the configured recipient via the email service.
 *
 * Env:
 *   OPS_REPORT_EMAIL — recipient email for daily ops reports (default: ops@simplebeacon.ai)
 *   OPS_REPORT_HOUR — hour (0-23) to send the daily report (default: 8)
 *   OPS_REPORT_ENABLED — set to 'true' to enable the automatic scheduler
 */

const logger = require("./app-logger.cjs");
const { getRecentEvents, getStats } = require("./webhook-event-log.cjs");
const { sendEmail } = require("./email-service.cjs");
const {
  renderSubscriptionActivated,
  renderSubscriptionCanceled,
  renderSubscriptionReactivated,
  renderPaymentFailed,
  renderTrialEnding,
  renderDisputeAlert,
} = require("./billing-email-templates.cjs");

const REPORT_EMAIL = () =>
  process.env.OPS_REPORT_EMAIL || "ops@simplebeacon.ai";
const CHECK_INTERVAL_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let _schedulerInterval = null;
let _lastReportDate = null;

/**
 * Gather events from the last 24 hours.
 * @returns {{events:Array, stats:Object, summary:Object}}
 */
function gatherDailyData() {
  const allEvents = getRecentEvents({ limit: 500 });
  const cutoff = Date.now() - ONE_DAY_MS;
  const recentEvents = allEvents.filter(
    (e) => new Date(e.timestamp).getTime() > cutoff,
  );

  const stats = getStats();

  const summary = {
    total: recentEvents.length,
    byType: {},
    byStatus: {},
    paymentFailures: [],
    disputes: [],
    trialWarnings: [],
    successfulPayments: [],
    cancellations: [],
    errors: [],
  };

  for (const evt of recentEvents) {
    summary.byType[evt.eventType] = (summary.byType[evt.eventType] || 0) + 1;
    summary.byStatus[evt.status] = (summary.byStatus[evt.status] || 0) + 1;

    if (evt.eventType === "invoice.payment_failed")
      summary.paymentFailures.push(evt);
    else if (evt.eventType === "charge.dispute.created")
      summary.disputes.push(evt);
    else if (evt.eventType === "customer.subscription.trial_will_end")
      summary.trialWarnings.push(evt);
    else if (
      evt.eventType === "invoice.paid" ||
      evt.eventType === "checkout.session.completed"
    )
      summary.successfulPayments.push(evt);
    else if (evt.eventType === "customer.subscription.deleted")
      summary.cancellations.push(evt);
    if (evt.status === "error") summary.errors.push(evt);
  }

  return { events: recentEvents, stats, summary };
}

/**
 * Generate the plain-text report body.
 * @param {Object} summary - Summary object from gatherDailyData
 * @param {string} reportDate - Formatted date string
 * @returns {string}
 */
function generateTextReport(summary, reportDate) {
  const lines = [];
  lines.push(`SimpleBeacon Daily Operations Report — ${reportDate}`);
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(`Total webhook events (24h): ${summary.total}`);
  lines.push("");

  lines.push("Events by Type:");
  for (const [type, count] of Object.entries(summary.byType).sort()) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push("");

  lines.push("Events by Status:");
  for (const [status, count] of Object.entries(summary.byStatus).sort()) {
    lines.push(`  ${status}: ${count}`);
  }
  lines.push("");

  if (summary.paymentFailures.length > 0) {
    lines.push(`Payment Failures (${summary.paymentFailures.length}):`);
    for (const f of summary.paymentFailures) {
      lines.push(
        `  - ${f.customerEmail || "unknown"} | ${f.reason || "N/A"} | ${f.timestamp}`,
      );
    }
    lines.push("");
  }

  if (summary.disputes.length > 0) {
    lines.push(`Disputes (${summary.disputes.length}):`);
    for (const d of summary.disputes) {
      lines.push(
        `  - ${d.reason || "unknown"} | ${d.amount || "N/A"} | ${d.timestamp}`,
      );
    }
    lines.push("");
  }

  if (summary.trialWarnings.length > 0) {
    lines.push(`Trial Ending Warnings (${summary.trialWarnings.length}):`);
    for (const t of summary.trialWarnings) {
      lines.push(`  - ${t.customerEmail || "unknown"} | ${t.timestamp}`);
    }
    lines.push("");
  }

  if (summary.cancellations.length > 0) {
    lines.push(`Cancellations (${summary.cancellations.length}):`);
    for (const c of summary.cancellations) {
      lines.push(`  - ${c.customerEmail || "unknown"} | ${c.timestamp}`);
    }
    lines.push("");
  }

  if (summary.errors.length > 0) {
    lines.push(`Processing Errors (${summary.errors.length}):`);
    for (const e of summary.errors) {
      lines.push(`  - ${e.eventType} | ${e.detail || "N/A"} | ${e.timestamp}`);
    }
    lines.push("");
  }

  if (summary.successfulPayments.length > 0) {
    lines.push(`Successful Payments (${summary.successfulPayments.length}):`);
    for (const p of summary.successfulPayments) {
      lines.push(
        `  - ${p.eventType} | ${p.customerEmail || "unknown"} | ${p.amount || "N/A"} | ${p.timestamp}`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("Generated by SimpleBeacon Operations");
  return lines.join("\n");
}

/**
 * Generate the HTML report body.
 * @param {Object} summary - Summary object from gatherDailyData
 * @param {string} reportDate - Formatted date string
 * @returns {string}
 */
function generateHtmlReport(summary, reportDate) {
  const typeRows = Object.entries(summary.byType)
    .sort()
    .map(
      ([type, count]) =>
        `<tr><td style="padding:4px 12px;font-family:monospace;font-size:13px">${type}</td><td style="padding:4px 12px;text-align:right;font-weight:600">${count}</td></tr>`,
    )
    .join("");

  const statusRows = Object.entries(summary.byStatus)
    .sort()
    .map(([status, count]) => {
      const color =
        status === "error"
          ? "#ef4444"
          : status === "processed"
            ? "#10b981"
            : status === "duplicate"
              ? "#f59e0b"
              : "#6b7280";
      return `<tr><td style="padding:4px 12px;text-transform:capitalize;color:${color}">${status}</td><td style="padding:4px 12px;text-align:right;font-weight:600">${count}</td></tr>`;
    })
    .join("");

  function eventTable(events, label) {
    if (events.length === 0)
      return `<p style="color:#10b981;font-size:13px;margin:8px 0">No ${label} in the last 24h.</p>`;
    const rows = events
      .map(
        (e) => `<tr>
      <td style="padding:4px 12px;font-size:13px">${e.customerEmail || "—"}</td>
      <td style="padding:4px 12px;font-size:13px">${e.reason || e.detail || "—"}</td>
      <td style="padding:4px 12px;font-size:13px">${e.amount || "—"}</td>
      <td style="padding:4px 12px;font-size:12px;color:#6b7280">${new Date(e.timestamp).toLocaleString()}</td>
    </tr>`,
      )
      .join("");
    return `<table style="width:100%;border-collapse:collapse;margin:8px 0">
      <thead><tr style="border-bottom:1px solid #e5e7eb">
        <th style="padding:4px 12px;text-align:left;font-size:12px;color:#6b7280">Customer</th>
        <th style="padding:4px 12px;text-align:left;font-size:12px;color:#6b7280">Reason/Detail</th>
        <th style="padding:4px 12px;text-align:left;font-size:12px;color:#6b7280">Amount</th>
        <th style="padding:4px 12px;text-align:left;font-size:12px;color:#6b7280">Time</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f4f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .container { max-width:680px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; }
    .header { background:linear-gradient(135deg,#1e293b 0%,#334155 100%); padding:24px 32px; }
    .header h1 { color:#fff; font-size:20px; margin:0; font-weight:600; }
    .header .sub { color:#94a3b8; font-size:13px; margin-top:4px; }
    .body { padding:32px; }
    .body p { color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px; }
    .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:16px 0; }
    .stat-card { background:#f9fafb; border-radius:8px; padding:16px; text-align:center; }
    .stat-card .num { font-size:28px; font-weight:700; color:#111827; }
    .stat-card .label { font-size:11px; color:#6b7280; text-transform:uppercase; margin-top:4px; }
    .stat-card.warn .num { color:#ef4444; }
    .stat-card.ok .num { color:#10b981; }
    .stat-card.info .num { color:#3b82f6; }
    table.summary { width:100%; border-collapse:collapse; margin:12px 0; }
    table.summary th { text-align:left; padding:6px 12px; font-size:12px; color:#6b7280; border-bottom:1px solid #e5e7eb; }
    .section-title { font-size:14px; font-weight:600; color:#111827; margin:20px 0 8px; padding-top:12px; border-top:1px solid #f3f4f6; }
    .footer { padding:24px 32px; background:#f9fafb; }
    .footer p { color:#9ca3af; font-size:12px; margin:0; text-align:center; }
  </style></head><body>
  <div class="container">
    <div class="header">
      <h1>Daily Operations Report</h1>
      <div class="sub">SimpleBeacon — ${reportDate}</div>
    </div>
    <div class="body">
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${summary.total}</div><div class="label">Total Events</div></div>
        <div class="stat-card warn"><div class="num">${summary.paymentFailures.length}</div><div class="label">Payment Failures</div></div>
        <div class="stat-card warn"><div class="num">${summary.disputes.length}</div><div class="label">Disputes</div></div>
        <div class="stat-card ok"><div class="num">${summary.successfulPayments.length}</div><div class="label">Successful</div></div>
      </div>

      <div class="section-title">Events by Type</div>
      <table class="summary"><tbody>${typeRows}</tbody></table>

      <div class="section-title">Events by Status</div>
      <table class="summary"><tbody>${statusRows}</tbody></table>

      <div class="section-title">Payment Failures (${summary.paymentFailures.length})</div>
      ${eventTable(summary.paymentFailures, "payment failures")}

      <div class="section-title">Disputes (${summary.disputes.length})</div>
      ${eventTable(summary.disputes, "disputes")}

      <div class="section-title">Trial Ending Warnings (${summary.trialWarnings.length})</div>
      ${eventTable(summary.trialWarnings, "trial warnings")}

      <div class="section-title">Cancellations (${summary.cancellations.length})</div>
      ${eventTable(summary.cancellations, "cancellations")}

      <div class="section-title">Processing Errors (${summary.errors.length})</div>
      ${eventTable(summary.errors, "processing errors")}

      <div class="section-title">Successful Payments (${summary.successfulPayments.length})</div>
      ${eventTable(summary.successfulPayments, "successful payments")}
    </div>
    <div class="footer">
      <p>Generated by SimpleBeacon Operations &middot; <a href="https://simplebeacon.ai">simplebeacon.ai</a></p>
    </div>
  </div></body></html>`;
}

/**
 * Generate and send the daily ops report.
 * @param {Object} [opts] - Options
 * @param {string} [opts.to] - Override recipient email
 * @returns {Promise<{sent:boolean, queued:boolean, error?:string}>}
 */
async function sendDailyReport(opts = {}) {
  const to = opts.to || REPORT_EMAIL();
  const { summary } = gatherDailyData();
  const reportDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `SimpleBeacon Daily Ops Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const text = generateTextReport(summary, reportDate);
  const html = generateHtmlReport(summary, reportDate);

  logger.info(
    "[DailyOpsReport] Sending report to",
    to,
    "— events:",
    summary.total,
    "failures:",
    summary.paymentFailures.length,
    "disputes:",
    summary.disputes.length,
  );

  try {
    const result = await sendEmail({ to, subject, text, html });
    logger.info(
      "[DailyOpsReport] Report",
      result.sent ? "sent" : "queued",
      "to",
      to,
    );
    return result;
  } catch (err) {
    logger.error("[DailyOpsReport] Failed to send:", err.message);
    return { sent: false, queued: false, error: err.message };
  }
}

/**
 * Check if the daily report should be sent now based on configured hour.
 * @returns {boolean}
 */
function shouldSendNow() {
  const targetHour = parseInt(process.env.OPS_REPORT_HOUR || "8", 10);
  const now = new Date();
  if (now.getHours() !== targetHour) return false;
  const today = now.toDateString();
  if (_lastReportDate === today) return false;
  _lastReportDate = today;
  return true;
}

/**
 * Start the automatic scheduler. Checks every minute if it's time to send.
 */
function startScheduler() {
  if (_schedulerInterval) return;
  if (process.env.OPS_REPORT_ENABLED !== "true") {
    logger.info(
      "[DailyOpsReport] Auto-scheduler disabled (set OPS_REPORT_ENABLED=true to enable)",
    );
    return;
  }
  logger.info(
    "[DailyOpsReport] Starting auto-scheduler, target hour:",
    process.env.OPS_REPORT_HOUR || "8",
    "recipient:",
    REPORT_EMAIL(),
  );
  _schedulerInterval = setInterval(async () => {
    try {
      if (shouldSendNow()) {
        logger.info(
          "[DailyOpsReport] Scheduled time reached — generating report",
        );
        await sendDailyReport();
      }
    } catch (err) {
      logger.error("[DailyOpsReport] Scheduler error:", err.message);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the automatic scheduler.
 */
function stopScheduler() {
  if (_schedulerInterval) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
    logger.info("[DailyOpsReport] Scheduler stopped");
  }
}

module.exports = {
  sendDailyReport,
  gatherDailyData,
  generateTextReport,
  generateHtmlReport,
  startScheduler,
  stopScheduler,
  shouldSendNow,
  REPORT_EMAIL,
};
