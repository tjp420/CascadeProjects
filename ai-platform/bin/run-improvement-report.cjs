#!/usr/bin/env node
/**
 * SimpleBeacon Internal Improvement Report CLI
 *
 * Generates a privacy-safe cross-org aggregate report from CI telemetry.
 * Contains NO user-identifiable information — only aggregate counts and
 * hashed fingerprints with k-anonymity enforcement.
 *
 * Usage:
 *   node ai-platform/bin/run-improvement-report.cjs              # generate + email
 *   node ai-platform/bin/run-improvement-report.cjs --dry-run    # print to stdout
 *   node ai-platform/bin/run-improvement-report.cjs --days 90    # custom window
 *
 * Cron (monthly):
 *   0 8 1 * * /usr/bin/node /var/www/simplebeacon/ai-platform/bin/run-improvement-report.cjs >> /var/log/simplebeacon/cron-improvement.log 2>&1
 *
 * Exit codes:
 *   0 = report generated successfully
 *   1 = configuration error
 *   2 = runtime error
 */

'use strict';

const path = require('path');

// Load .env from the ai-platform root
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_e) {
  // dotenv not installed — env vars must be set by the environment
}

const { executeImprovementReportJob } = require('../server/cron/internal-improvement-report.cjs');

function parseArgs(argv) {
  const args = { dryRun: false, days: 30 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') {
      args.dryRun = true;
    } else if (arg === '--days' || arg === '-d') {
      const val = Number(argv[++i]);
      if (Number.isFinite(val) && val > 0) args.days = Math.min(val, 365);
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node run-improvement-report.cjs [--dry-run] [--days N]');
      console.log('');
      console.log('Options:');
      console.log('  --dry-run, -n   Print report to stdout, do not email');
      console.log('  --days N, -d N  Time window in days (default: 30, max: 365)');
      console.log('  --help, -h      Show this help message');
      process.exit(0);
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv);
  const timestamp = new Date().toISOString();
  console.log('[' + timestamp + '] Initializing internal improvement report...');
  console.log('[ImprovementReportCLI] Mode: ' + (args.dryRun ? 'DRY RUN' : 'EMAIL'));
  console.log('[ImprovementReportCLI] Window: ' + args.days + ' days');

  const result = await executeImprovementReportJob({
    days: args.days,
    dryRun: args.dryRun
  });

  if (args.dryRun) {
    console.log('\n' + '='.repeat(60) + '\n');
    console.log(result.markdown);
    console.log('\n' + '='.repeat(60));
  }

  console.log('[ImprovementReportCLI] Done. Emailed: ' + result.emailed);
  process.exit(0);
}

run().catch(function (err) {
  console.error('[ImprovementReportCLI] Unhandled error: ' + (err && err.message ? err.message : err));
  process.exit(2);
});
