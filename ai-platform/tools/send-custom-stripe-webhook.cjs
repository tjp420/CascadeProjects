// Send signed Stripe events with a custom customer email to local Simplebeacon billing webhook
// Usage: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars, then run this script

const http = require('http');
const Stripe = require('stripe');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const TARGET_URL = process.env.SB_WEBHOOK_TARGET || 'http://127.0.0.1:58000/api/simplebeacon/billing/webhook';
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || 'test-customer@simplebeacon.ai';

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
  if (!WEBHOOK_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET env var');
    process.exitCode = 2;
    return;
  }
  console.log('Webhook signing: configured');

  const checkoutSession = {
    id: `cs_test_${Date.now()}`,
    object: 'checkout.session',
    customer: 'cus_test_123',
    customer_email: CUSTOMER_EMAIL,
    customer_details: { email: CUSTOMER_EMAIL },
    mode: 'subscription',
    metadata: { product: 'executive_clearance' }
  };

  try {
    console.log('Sending checkout.session.completed for', CUSTOMER_EMAIL);
    const r1 = await sendEvent('checkout.session.completed', checkoutSession);
    console.log('Response:', r1.status, r1.body);
  } catch (err) {
    console.error('Error sending event:', err.message || err);
    process.exitCode = 2;
  }
}

if (require.main === module) run();
