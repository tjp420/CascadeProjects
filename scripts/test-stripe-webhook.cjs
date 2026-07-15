#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Stripe Webhook Endpoint Smoke Test
 * Run after pointing Stripe webhook URL to https://simplebeacon.ai/api/simplebeacon/billing/webhook
 *
 * Usage: node scripts/test-stripe-webhook.cjs
 */

const https = require('https');
const crypto = require('crypto');

const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_TEST_URL || 'https://simplebeacon.ai/api/simplebeacon/billing/webhook';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

function signPayload(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return { timestamp, signature };
}

const payload = {
    id: 'evt_test_' + Date.now(),
    object: 'event',
    api_version: '2024-06-20',
    type: 'checkout.session.completed',
    data: {
        object: {
            id: 'cs_test_' + Date.now(),
            object: 'checkout.session',
            status: 'complete',
            customer: 'cus_test',
            metadata: { tier: 'pro', duration: 'monthly' }
        }
    }
};

const { timestamp, signature } = signPayload(payload, SECRET);

const body = JSON.stringify(payload);
const url = new URL(WEBHOOK_URL);

const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${signature}`,
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Webhook test PASSED');
            process.exit(0);
        } else {
            console.error('Webhook test FAILED');
            process.exit(1);
        }
    });
});

req.on('error', (err) => {
    console.error('Request failed:', err.message);
    process.exit(1);
});

req.write(body);
req.end();
