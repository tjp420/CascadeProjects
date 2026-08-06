#!/usr/bin/env node
/**
 * SimpleBeacon Automated Weekly Reporting Bootstrapper
 *
 * Executed via system crontab every Monday morning at 8:00 AM:
 *   0 8 * * 1 /usr/bin/node /var/www/simplebeacon/ai-platform/bin/run-weekly-reports.cjs >> /var/log/simplebeacon/cron-weekly.log 2>&1
 *
 * Loads environment variables, fetches active Team Pro and Enterprise
 * subscriptions from the store, and dispatches weekly compliance email
 * summaries via the weekly-reporter worker.
 *
 * Exit codes:
 *   0 = job completed successfully
 *   1 = configuration error (missing env vars)
 *   2 = runtime error during dispatch
 */

'use strict';

const path = require('path');

// Load .env from the ai-platform root
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_e) {
  // dotenv not installed — env vars must be set by the environment
}

const { executeWeeklyReportingJob } = require('../server/cron/weekly-reporter.cjs');
const { readStore } = require('../server/lib/simplebeacon-subscription-store.cjs');

/**
 * Fetches active team_pro and enterprise subscriptions from the store.
 * @returns {Promise<Array>} Array of subscription objects with orgId, orgName, adminEmail, tier
 */
async function fetchActiveSubscriptions() {
  try {
    const store = await readStore();
    const subscriptions = store.subscriptions || {};
    const active = [];

    for (const email of Object.keys(subscriptions)) {
      const sub = subscriptions[email];
      if (!sub || !sub.active) continue;
      if (sub.tier !== 'team_pro' && sub.tier !== 'enterprise') continue;

      active.push({
        orgId: sub.orgId || sub.customerId || email,
        orgName: sub.orgName || sub.companyName || email.split('@')[0],
        adminEmail: email,
        tier: sub.tier
      });
    }

    return active;
  } catch (err) {
    console.error('[WeeklyReports] Failed to read subscription store: ' + (err && err.message ? err.message : err));
    return [];
  }
}

async function run() {
  var timestamp = new Date().toISOString();
  console.log('[' + timestamp + '] Initializing scheduled weekly reporting task...');

  // Guard: verify required infrastructure credentials are present
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[WeeklyReports] Aborted: Missing STRIPE_SECRET_KEY environment variable.');
    process.exit(1);
  }

  // Fetch active subscriptions from the persistent store
  var activeSubscriptions = await fetchActiveSubscriptions();

  if (activeSubscriptions.length === 0) {
    console.log('[WeeklyReports] No active team_pro/enterprise subscriptions found. Nothing to send.');
    process.exit(0);
  }

  console.log('[WeeklyReports] Found ' + activeSubscriptions.length + ' eligible subscription(s).');

  // Execute the weekly reporting job
  var summary = await executeWeeklyReportingJob(activeSubscriptions);

  console.log('[WeeklyReports] Job complete: ' + summary.succeeded + ' dispatched, ' +
    summary.skipped + ' skipped, ' + summary.failed + ' failed.');

  // Exit with error code if any dispatch failed
  if (summary.failed > 0) {
    process.exit(2);
  }

  process.exit(0);
}

run().catch(function (err) {
  console.error('[WeeklyReports] Unhandled error: ' + (err && err.message ? err.message : err));
  process.exit(2);
});
