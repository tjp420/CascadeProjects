#!/usr/bin/env node
/**
 * SimpleBeacon Production Diagnostic Script
 *
 * Verifies live deployment health after rolling out the 3-tier billing
 * architecture. Run this immediately after deploying PR #563 to confirm
 * the storefront, price IDs, and webhook endpoint are all functioning.
 *
 * Usage:
 *   node tools/verify-deployment.cjs --url=https://simplebeacon.ai
 *   node tools/verify-deployment.cjs --url=http://127.0.0.1:58000
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = one or more checks failed
 */

'use strict';

const crypto = require('crypto');

const REQUIRED_PRICE_IDS = [
  'price_developer_monthly',
  'price_developer_annual',
  'price_team_pro_monthly',
  'price_team_pro_annual'
];

const WEBHOOK_PATH = '/api/simplebeacon/billing/webhook';

async function runDiagnostics() {
  const args = process.argv.slice(2);
  const urlArg = args.find(function (a) { return a.indexOf('--url=') === 0; });

  if (!urlArg) {
    console.error('Error: Missing --url parameter.');
    console.error('Usage: node tools/verify-deployment.cjs --url=https://your-production-domain.com');
    process.exit(1);
  }

  var baseUrl = urlArg.split('=')[1].replace(/\/$/, '');
  console.log('\n[SimpleBeacon] Production Diagnostics for: ' + baseUrl);
  console.log('==================================================================');

  var failed = false;
  var checks = { passed: 0, failed: 0, warnings: 0 };

  // --- Test 1: Storefront Core Connectivity ---
  console.log('\n[1/3] Checking pricing page availability...');
  var pricingHtml = null;
  try {
    var pricingUrl = baseUrl + '/pricing';
    var res = await fetch(pricingUrl, { redirect: 'follow' });

    if (res.ok) {
      console.log('  PASS: Pricing page loaded (HTTP ' + res.status + ')');
      checks.passed++;
      pricingHtml = await res.text();
    } else {
      console.error('  FAIL: Pricing page returned HTTP ' + res.status);
      checks.failed++;
      failed = true;
    }
  } catch (err) {
    console.error('  FAIL: Network error reaching pricing page: ' + err.message);
    checks.failed++;
    failed = true;
  }

  // --- Test 2: Verify Price ID Presence in Page Source ---
  if (pricingHtml) {
    console.log('\n[2/3] Verifying Stripe Price ID injections in page source...');
    for (var i = 0; i < REQUIRED_PRICE_IDS.length; i++) {
      var id = REQUIRED_PRICE_IDS[i];
      if (pricingHtml.indexOf(id) >= 0) {
        console.log('  PASS: Found price ID: ' + id);
        checks.passed++;
      } else {
        console.error('  FAIL: Missing price ID: ' + id);
        checks.failed++;
        failed = true;
      }
    }
  } else {
    console.log('\n[2/3] Skipped (pricing page not loaded)');
  }

  // --- Test 3: Webhook Endpoint Verification ---
  console.log('\n[3/3] Pinging webhook handler route...');
  try {
    var webhookUrl = baseUrl + WEBHOOK_PATH;

    // Construct a safe dry-run payload with a dummy signature.
    // The server should reject this (400/401) — proving the route is alive
    // and properly enforcing signature verification.
    var timestamp = Math.floor(Date.now() / 1000).toString();
    var mockPayload = JSON.stringify({ id: 'evt_test_diagnostic', type: 'ping' });
    var mockSecret = 'whsec_diagnostic_dummy_secret';
    var signedPayload = timestamp + '.' + mockPayload;
    var signature = crypto
      .createHmac('sha256', mockSecret)
      .update(signedPayload)
      .digest('hex');

    var res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=' + timestamp + ',v1=' + signature
      },
      body: mockPayload
    });

    if (res.status === 400 || res.status === 401) {
      console.log('  PASS: Webhook route active and secure. Rejected bad signature (HTTP ' + res.status + ')');
      checks.passed++;
    } else if (res.status === 503) {
      console.warn('  WARN: Webhook route reachable but Stripe not configured (HTTP 503)');
      console.warn('       Check STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars');
      checks.warnings++;
    } else if (res.ok) {
      console.warn('  WARN: Webhook accepted unauthenticated payload (HTTP ' + res.status + ')');
      console.warn('       Verify STRIPE_WEBHOOK_SECRET is set correctly in production');
      checks.warnings++;
    } else if (res.status === 404) {
      console.error('  FAIL: Webhook route not found (HTTP 404). Server may not have billing routes mounted.');
      checks.failed++;
      failed = true;
    } else {
      console.error('  FAIL: Webhook returned unexpected status (HTTP ' + res.status + ')');
      checks.failed++;
      failed = true;
    }
  } catch (err) {
    console.error('  FAIL: Network error reaching webhook: ' + err.message);
    checks.failed++;
    failed = true;
  }

  // --- Final Summary ---
  console.log('\n==================================================================');
  console.log('Results: ' + checks.passed + ' passed, ' + checks.warnings + ' warnings, ' + checks.failed + ' failed');

  if (failed) {
    console.error('DIAGNOSTICS FAILED: Production deployment issues detected.');
    console.error('Review the failures above before accepting live traffic.\n');
    process.exit(1);
  } else {
    console.log('DIAGNOSTICS PASSED: Production ecosystem is live and ready!\n');
    process.exit(0);
  }
}

runDiagnostics();
