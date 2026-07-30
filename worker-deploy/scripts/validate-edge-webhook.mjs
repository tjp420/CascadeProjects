#!/usr/bin/env node
import crypto from 'node:crypto';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function decodeJwtPayload(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (args.base || process.env.WORKER_BASE_URL || 'https://simplebeacon.ai').replace(/\/$/, '');
  const origin = args.origin || process.env.WORKER_ALLOWED_ORIGIN || 'https://simplebeacon.ai';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const negativeSignature = args['negative-signature'] === 'true' || args.mode === 'negative';

  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET in environment. Export it locally before running this test.');
  }

  const sessionId = args.session || `cs_test_${Date.now()}`;
  const email = args.email || `edge-test+${Date.now()}@example.com`;
  const priceId = args.price || process.env.PRICE_ID_AGENCY || 'price_agency_suite_99';
  const attempts = Number(args.attempts || 30);
  const intervalMs = Number(args.interval || 2000);

  const payload = {
    id: `evt_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        customer_email: email,
        customer_details: { email },
        metadata: {
          price_id: priceId
        }
      }
    }
  };

  const payloadText = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payloadText}`;
  const signature = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
  const tamperedSignature = signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0');
  const stripeHeader = `t=${timestamp},v1=${negativeSignature ? tamperedSignature : signature}`;
  const expectedStatus = Number(args['expect-status'] || (negativeSignature ? 400 : 200));

  const webhookUrl = `${baseUrl}/api/stripe-webhook`;
  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': stripeHeader
    },
    body: payloadText
  });

  let webhookJson = null;
  try {
    webhookJson = await webhookResponse.json();
  } catch {
    webhookJson = { raw: await webhookResponse.text() };
  }

  if (webhookResponse.status !== expectedStatus) {
    throw new Error(`Webhook request expected status ${expectedStatus} but got ${webhookResponse.status}: ${JSON.stringify(webhookJson)}`);
  }

  if (negativeSignature) {
    const summary = {
      ok: true,
      negativeSignature: true,
      baseUrl,
      sessionId,
      webhookStatus: webhookResponse.status,
      expectedStatus
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  if (!webhookResponse.ok) {
    throw new Error(`Webhook request failed (${webhookResponse.status}): ${JSON.stringify(webhookJson)}`);
  }

  const licenseUrl = `${baseUrl}/api/license?session_id=${encodeURIComponent(sessionId)}`;
  let licenseJson = null;

  for (let i = 1; i <= attempts; i++) {
    const response = await fetch(licenseUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Origin: origin
      }
    });

    if (response.status === 404) {
      await wait(intervalMs);
      continue;
    }

    const body = await response.json();
    if (!response.ok) {
      throw new Error(`License lookup failed (${response.status}): ${JSON.stringify(body)}`);
    }

    licenseJson = body;
    break;
  }

  if (!licenseJson || !licenseJson.license) {
    throw new Error(`License token was not available after ${attempts} attempts.`);
  }

  const decoded = decodeJwtPayload(licenseJson.license);
  const summary = {
    ok: true,
    baseUrl,
    sessionId,
    webhookStatus: webhookResponse.status,
    licenseStatus: licenseJson.status,
    tier: decoded?.tier || licenseJson.tier || 'unknown',
    capabilities: decoded?.capabilities || licenseJson.capabilities || []
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`[validate-edge-webhook] ${err.message}\n`);
  process.exit(1);
});
