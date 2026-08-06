// Test helper: send signed webhook events with new 3-tier payloads to local SimpleBeacon billing webhook.
// Usage:
//   node tools/send-test-webhook-3tier.cjs                          # sends all 4 payloads
//   node tools/send-test-webhook-3tier.cjs developer_monthly        # sends one specific payload
//
// Environment:
//   STRIPE_WEBHOOK_SECRET  (default: whsec_test_local)
//   SB_WEBHOOK_TARGET      (default: http://127.0.0.1:58000/api/simplebeacon/billing/webhook)

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_local';
const TARGET_URL = process.env.SB_WEBHOOK_TARGET || 'http://127.0.0.1:58000/api/simplebeacon/billing/webhook';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures', 'stripe');

const PAYLOADS = [
  'checkout_developer_monthly.json',
  'checkout_developer_annual.json',
  'checkout_team_pro_monthly.json',
  'checkout_team_pro_annual.json'
];

function makeSignedHeader(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function sendEvent(eventJson) {
  const body = JSON.stringify(eventJson);
  const header = makeSignedHeader(body, WEBHOOK_SECRET);
  const url = new URL(TARGET_URL);

  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': header,
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c.toString('utf8'); });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const filter = process.argv[2];
  const files = filter
    ? PAYLOADS.filter((f) => f.includes(filter))
    : PAYLOADS;

  if (files.length === 0) {
    console.error('No matching payloads. Available:', PAYLOADS.join(', '));
    process.exitCode = 1;
    return;
  }

  console.log('Target:', TARGET_URL);
  console.log('Webhook secret:', WEBHOOK_SECRET);
  console.log('Sending', files.length, 'payload(s)...\n');

  for (const file of files) {
    const fixturePath = path.join(FIXTURES_DIR, file);
    if (!fs.existsSync(fixturePath)) {
      console.error('  MISSING:', fixturePath);
      continue;
    }
    const event = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const tier = event.data?.object?.metadata?.tier || 'unknown';
    const priceId = event.data?.object?.metadata?.price_id || 'unknown';
    const email = event.data?.object?.customer_email || 'unknown';

    try {
      const res = await sendEvent(event);
      console.log(`  ${file}`);
      console.log(`    tier=${tier}  priceId=${priceId}  email=${email}`);
      console.log(`    -> HTTP ${res.status}: ${res.body.substring(0, 200)}\n`);
    } catch (err) {
      console.error(`  ${file}: ERROR - ${err.message}\n`);
    }
  }
}

run();
