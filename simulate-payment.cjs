// Simulate a successful $49/mo Developer subscription checkout completion webhook
const crypto = require('crypto');
const https = require('https');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

if (!WEBHOOK_SECRET || !WEBHOOK_URL) {
  console.error('Error: STRIPE_WEBHOOK_SECRET and WEBHOOK_URL environment variables are required.');
  console.error('Example: set STRIPE_WEBHOOK_SECRET to your whsec value,');
  console.error('        set WEBHOOK_URL to your billing webhook endpoint,');
  console.error('        then run: node simulate-payment.cjs');
  process.exit(1);
}
const TEST_EMAIL = 'trevor_punt@live.com';
const SESSION_ID = 'cs_test_sim_' + Date.now();
const SUB_ID = 'sub_test_sim_' + Date.now();
const CUSTOMER_ID = 'cus_test_sim_' + Date.now();

// Construct a checkout.session.completed event for a $49/mo developer subscription
const event = {
  id: 'evt_test_sim_' + Date.now(),
  object: 'event',
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  data: {
    object: {
      id: SESSION_ID,
      object: 'checkout.session',
      mode: 'subscription',
      status: 'complete',
      payment_status: 'paid',
      customer: CUSTOMER_ID,
      customer_email: TEST_EMAIL,
      customer_details: {
        email: TEST_EMAIL,
        name: 'Test Developer'
      },
      subscription: SUB_ID,
      amount_total: 4900,
      currency: 'usd',
      metadata: {
        email: TEST_EMAIL,
        product: 'developer_monthly',
        projectName: 'test-project',
        certClientName: 'Test Developer'
      }
    }
  }
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(signedPayload)
  .digest('hex');

const sigHeader = `t=${timestamp},v1=${signature}`;

const url = new URL(WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': sigHeader,
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('Sending simulated checkout.session.completed webhook...');
console.log('  Endpoint:', WEBHOOK_URL);
console.log('  Email:', TEST_EMAIL);
console.log('  Product: developer_monthly ($49/mo)');
console.log('  Session ID:', SESSION_ID);
console.log('  Signature: t=' + timestamp + ',v1=' + signature.substring(0, 16) + '...');
console.log('');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response Body:', body);
    if (res.statusCode === 200) {
      console.log('\n✓ Webhook accepted! Simulated payment of $49.00/mo was processed.');
      console.log('  Check the subscription status:');
      console.log('  curl "https://cascadeprojects-yzzd.onrender.com/api/simplebeacon/billing/status?email=' + TEST_EMAIL + '"');
    } else {
      console.log('\n✗ Webhook rejected. Check the error above.');
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
});

req.write(payload);
req.end();
