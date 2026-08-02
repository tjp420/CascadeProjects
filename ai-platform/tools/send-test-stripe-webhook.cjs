// Test helper: send signed webhook events to local Simplebeacon billing webhook
// Usage: STRIPE_WEBHOOK_SECRET=whsec_test node tools/send-test-stripe-webhook.cjs

const http = require('http');
const Stripe = require('stripe');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_local';
const TARGET_URL = process.env.SB_WEBHOOK_TARGET || 'http://127.0.0.1:58000/api/simplebeacon/billing/webhook';

const stripe = Stripe(STRIPE_SECRET);

function sendEvent(eventType, payload) {
  const body = JSON.stringify({ id: `evt_${Date.now()}`, object: 'event', type: eventType, data: { object: payload } });
  const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET, timestamp: Math.floor(Date.now() / 1000) });

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
      res.on('data', c => data += c.toString('utf8'));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Target:', TARGET_URL);
  console.log('Using webhook secret:', WEBHOOK_SECRET);

  const checkoutSession = {
    id: 'cs_test_123',
    object: 'checkout.session',
    customer: 'cus_test_123',
    customer_email: 'test@example.com',
    mode: 'subscription'
  };

  const invoicePaid = {
    id: 'in_test_123',
    object: 'invoice',
    subscription: 'sub_test_123',
    customer_email: 'test@example.com'
  };

  try {
    console.log('Sending checkout.session.completed...');
    const r1 = await sendEvent('checkout.session.completed', checkoutSession);
    console.log('Response:', r1.status, r1.body);

    console.log('Sending invoice.paid...');
    const r2 = await sendEvent('invoice.paid', invoicePaid);
    console.log('Response:', r2.status, r2.body);
  } catch (err) {
    console.error('Error sending events:', err.message || err);
    process.exitCode = 2;
  }
}

if (require.main === module) run();
