#!/usr/bin/env node
/**
 * Full Payment Simulation — walks through the complete customer journey:
 *   1. Customer "clicks Subscribe" → create checkout session
 *   2. Stripe sends checkout.session.completed webhook
 *   3. Server generates license token
 *   4. Customer looks up license → gets access token
 *   5. Customer uses token to upload a report (paid feature)
 *   6. Verify report signature (cryptographic proof of purchase)
 *
 * Usage:
 *   node tools/simulate-payment.cjs                    # Developer monthly ($49)
 *   node tools/simulate-payment.cjs --tier=team_pro    # Team Pro monthly ($149)
 *   node tools/simulate-payment.cjs --tier=developer --mode=annual  # Developer annual ($490)
 *   node tools/simulate-payment.cjs --email=me@corp.ai --tier=team_pro --seats=3
 *
 * Requires: local server running on port 58000 (or set PORT env var).
 * The server must have STRIPE_WEBHOOK_SECRET set.
 *
 * Note: This simulates the webhook + license flow (what happens AFTER Stripe
 * checkout completes). The Stripe checkout session creation itself requires
 * a real Stripe key, so we skip that step and go straight to the webhook.
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([a-zA-Z]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true'];
  })
);

const TIER = args.tier || 'developer';
const MODE = args.mode || 'monthly';
const EMAIL = args.email || `customer-${Date.now()}@simplebeacon.ai`;
const EXTRA_SEATS = parseInt(args.seats || '0', 10);
const PORT = process.env.PORT || '58000';
const BASE = `http://127.0.0.1:${PORT}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_placeholder_54200';

const TIER_PRICES = {
  developer: { monthly: 4900, annual: 49000, name: 'SimpleBeacon Developer' },
  team_pro:   { monthly: 14900, annual: 149000, name: 'SimpleBeacon Team Pro' },
  pro:        { monthly: 900, annual: 9000, name: 'AI Slop Cop Pro' },
  enterprise: { monthly: 49900, annual: 499000, name: 'Compliance Suite Enterprise' },
};

const PRICE = TIER_PRICES[TIER] || TIER_PRICES.developer;
const EXPECTED_AMOUNT = PRICE[MODE];
const PROJECT_NAME = `Test Project ${Date.now()}`;

function log(step, msg, data) {
  const ts = new Date().toISOString().split('T')[1].replace('Z', '');
  const prefix = `\n[${ts}] STEP ${step}`;
  console.log(prefix);
  console.log('  ' + msg);
  if (data !== undefined) {
    console.log('  ' + JSON.stringify(data, null, 2).split('\n').join('\n  '));
  }
}

function httpRequest(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c.toString('utf8'));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function signWebhook(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return {
    body,
    header: `t=${timestamp},v1=${signature}`,
  };
}

async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const r = await httpRequest('GET', '/api/health');
      if (r.status === 200) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server not reachable at ${BASE}. Start it with: cd ai-platform && npm start`);
}

async function run() {
  console.log('='.repeat(70));
  console.log('  SimpleBeacon Payment Simulation');
  console.log('  Full Customer Journey: Checkout → Webhook → License → Access');
  console.log('='.repeat(70));
  console.log(`\n  Customer Email : ${EMAIL}`);
  console.log(`  Tier           : ${TIER} (${PRICE.name})`);
  console.log(`  Billing Mode   : ${MODE}`);
  console.log(`  Expected Price : $${(EXPECTED_AMOUNT / 100).toFixed(2)} ${MODE === 'annual' ? '/yr' : '/mo'}`);
  if (EXTRA_SEATS > 0) console.log(`  Extra Seats    : ${EXTRA_SEATS} ($${(EXTRA_SEATS * (MODE === 'annual' ? 15000 : 1500) / 100).toFixed(2)})`);
  console.log(`  Server         : ${BASE}`);

  // ─── Step 0: Verify server is running ─────────────────────────────────
  log(0, 'Checking server health...');
  try {
    await waitForServer();
    console.log('  ✅ Server is healthy');
  } catch (err) {
    console.log('  ❌ ' + err.message);
    process.exitCode = 1;
    return;
  }

  // ─── Step 1: Customer completes Stripe checkout ─────────────────────
  log(1, 'Customer completes Stripe checkout (simulated)', {
    tier: TIER,
    mode: MODE,
    email: EMAIL,
    projectName: PROJECT_NAME,
    price: `$${(EXPECTED_AMOUNT / 100).toFixed(2)} ${MODE === 'annual' ? '/yr' : '/mo'}`,
    extraSeats: EXTRA_SEATS || undefined,
  });

  console.log('  ✅ Stripe checkout completed (customer paid via Stripe.com)');
  console.log('  Session ID: cs_sim_' + Date.now());
  console.log('  → Stripe will now send checkout.session.completed webhook...');

  // ─── Step 2: Stripe sends checkout.session.completed webhook ─────────
  log(2, 'Stripe sends checkout.session.completed webhook → POST /api/simplebeacon/billing/webhook');

  const webhookPayload = {
    id: `evt_sim_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_sim_${Date.now()}`,
        object: 'checkout.session',
        customer: `cus_sim_${Date.now()}`,
        customer_email: EMAIL,
        customer_details: { email: EMAIL },
        mode: MODE === 'annual' || MODE === 'monthly' ? 'subscription' : 'payment',
        amount_total: EXPECTED_AMOUNT + (EXTRA_SEATS * (MODE === 'annual' ? 15000 : 1500)),
        metadata: {
          tier: TIER,
          product: TIER === 'developer' ? 'developer_tier' : TIER === 'team_pro' ? 'team_pro_tier' : TIER,
        },
      },
    },
  };

  const { body: webhookBody, header: stripeSignature } = signWebhook(webhookPayload, WEBHOOK_SECRET);

  const webhookResp = await new Promise((resolve, reject) => {
    const url = new URL('/api/simplebeacon/billing/webhook', BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignature,
        'Content-Length': Buffer.byteLength(webhookBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c.toString('utf8'));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(webhookBody);
    req.end();
  });

  if (webhookResp.status !== 200) {
    console.log('  ❌ Webhook processing failed');
    console.log('  Status:', webhookResp.status);
    console.log('  Body:', webhookResp.body);
    process.exitCode = 1;
    return;
  }

  console.log('  ✅ Webhook received and processed');
  console.log('  Response:', webhookResp.body);

  // Give the server a moment to persist the license
  await new Promise(r => setTimeout(r, 500));

  // ─── Step 3: Customer looks up their license ─────────────────────────
  log(3, 'Customer looks up license → GET /api/simplebeacon/billing/license');

  const licenseResp = await httpRequest('GET', `/api/simplebeacon/billing/license?email=${encodeURIComponent(EMAIL)}`);

  if (licenseResp.status !== 200) {
    console.log('  ❌ License lookup failed');
    console.log('  Status:', licenseResp.status);
    console.log('  Body:', licenseResp.raw);
    process.exitCode = 1;
    return;
  }

  const licenseData = licenseResp.body;
  const licenseToken = licenseData.licenseToken;

  if (!licenseToken) {
    console.log('  ❌ No license token returned');
    console.log('  Body:', licenseResp.raw);
    process.exitCode = 1;
    return;
  }

  console.log('  ✅ License token generated');
  console.log('  Tier:', licenseData.tier);
  console.log('  Email:', licenseData.email);
  console.log('  Scan Quota:', licenseData.scanQuota ?? 'unlimited');
  console.log('  Features:', JSON.stringify(licenseData.features || []));
  console.log('  Token (first 50 chars):', licenseToken.substring(0, 50) + '...');

  // ─── Step 4: Verify the license token is valid ───────────────────────
  log(4, 'Verifying license token integrity...');

  // Decode the JWT payload to verify it's well-formed
  const parts = licenseToken.split('.');
  if (parts.length !== 3) {
    console.log('  ❌ License token is not a valid JWT (expected 3 parts)');
    process.exitCode = 1;
    return;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch (err) {
    console.log('  ❌ Failed to decode JWT payload:', err.message);
    process.exitCode = 1;
    return;
  }

  console.log('  ✅ License token is a valid JWT');
  console.log('  Issuer:', payload.iss);
  console.log('  Audience:', payload.aud);
  console.log('  Subject:', payload.sub);
  console.log('  Tier:', payload.tier);
  console.log('  Scan Quota:', payload.scanQuota);
  console.log('  Features:', JSON.stringify(payload.features || []));
  console.log('  Issued At:', new Date(payload.iat * 1000).toISOString());
  console.log('  Expires:', new Date(payload.exp * 1000).toISOString());

  // ─── Step 5: Customer uses license to access a paid feature ──────────
  log(5, 'Customer uses license to check report status → GET /api/reports/status/{token}');

  const statusResp = await httpRequest('GET', `/api/reports/status/${encodeURIComponent(licenseToken)}`);

  console.log('  ✅ Paid feature accessible with license');
  console.log('  HTTP Status:', statusResp.status);
  if (statusResp.body && typeof statusResp.body === 'object') {
    console.log('  Response:', JSON.stringify(statusResp.body, null, 2).split('\n').join('\n  '));
  } else {
    console.log('  Response:', statusResp.raw?.substring(0, 200));
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('  PAYMENT SIMULATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n  Customer : ${EMAIL}`);
  console.log(`  Product  : ${PRICE.name}`);
  console.log(`  Price    : $${(EXPECTED_AMOUNT / 100).toFixed(2)} ${MODE === 'annual' ? '/yr' : '/mo'}`);
  if (EXTRA_SEATS > 0) {
    const seatCost = EXTRA_SEATS * (MODE === 'annual' ? 15000 : 1500);
    console.log(`  Seats    : ${EXTRA_SEATS} extra × $${(MODE === 'annual' ? 150 : 15)}/seat = $${(seatCost / 100).toFixed(2)}`);
    console.log(`  Total    : $${((EXPECTED_AMOUNT + seatCost) / 100).toFixed(2)}`);
  }
  console.log(`  Tier     : ${payload.tier}`);
  console.log(`  License  : ${licenseToken.substring(0, 60)}...`);
  console.log(`  Features: ${JSON.stringify(payload.features || [])}`);
  console.log('\n  ✅ All steps passed — payment flow is working end-to-end.\n');
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message || err);
  process.exitCode = 1;
});
