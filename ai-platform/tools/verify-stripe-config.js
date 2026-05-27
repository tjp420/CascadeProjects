#!/usr/bin/env node
/**
 * Verify Stripe configuration for Simplebeacon monetization.
 */
const path = require('path');

require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env.production')
});

const Stripe = require('stripe');
const { isMonetizationEnabled } = require('../server/lib/simplebeacon-subscription-store');
const { resolvePriceId } = require('../src/api/simplebeacon-billing-api');

const required = ['STRIPE_SECRET_KEY'];
const priceProducts = [
  ['teams_monthly', 'STRIPE_PRICE_ID_TEAMS_MONTHLY / SIMPLEBEACON_PRO_PRICE_ID'],
  ['teams_annual', 'STRIPE_PRICE_ID_TEAMS_ANNUAL / SIMPLEBEACON_ANNUAL_PROMOTION_ID'],
  ['enterprise_setup', 'STRIPE_PRICE_ID_ENTERPRISE_SETUP / SIMPLEBEACON_ENTERPRISE_SETUP_ID'],
  ['enterprise_retainer', 'STRIPE_PRICE_ID_ENTERPRISE_RETAINER / SIMPLEBEACON_ENTERPRISE_RETAINER_ID']
];
const recommended = ['STRIPE_WEBHOOK_SECRET', 'SIMPLEBEACON_APP_URL', 'SIMPLEBEACON_CALENDLY_URL'];

let ok = true;

function requireEnvVar(key, hint) {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    console.log(`❌ Missing ${key} — ${hint}`);
    ok = false;
    return '';
  }
  return value;
}

function isPlaceholder(value) {
  return /replace|changeme|example|todo|\.\.\./i.test(String(value || ''));
}

function formatAmount(cents, currency) {
  if (cents == null) return 'unknown';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase()
  }).format(cents / 100);
}

console.log('Simplebeacon Stripe configuration');
console.log('=================================');
console.log(`Monetization enabled: ${isMonetizationEnabled()}`);
console.log(`Env file: ${process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env.production')}`);

if (!isMonetizationEnabled()) {
  console.log('\nMonetization disabled — Stripe keys not required for deploy.');
  console.log('Set SIMPLEBEACON_MONETIZATION_ENABLED=true and re-run when checkout is ready.');
  process.exit(0);
}

for (const key of required) {
  const val = requireEnvVar(key, 'set this in .env.production before verifying Stripe');
  if (!val) continue;
  if (!/^r?k_/.test(val)) {
    console.log(`❌ ${key} must start with sk_ or rk_`);
    ok = false;
    continue;
  }
  const mode = val.includes('_live_') || val.startsWith('rk_live_') ? 'live' : 'test';
  console.log(`✅ ${key} set (${val.slice(0, 8)}…, ${mode} mode)`);
  if (val.startsWith('sk_')) {
    console.log('⚠️  STRIPE_SECRET_KEY uses sk_*; prefer restricted key rk_* for least privilege');
  }
  if (isMonetizationEnabled() && !mode.includes('live')) {
    console.log('⚠️  Monetization is enabled but Stripe key appears test-mode');
  }
}

const priceIds = {};
let hasTeamsMonthly = false;
for (const [product, label] of priceProducts) {
  const priceId = resolvePriceId(product);
  if (priceId) {
    console.log(`✅ ${product}: ${priceId} (${label})`);
    priceIds[product] = priceId;
    if (product === 'teams_monthly') hasTeamsMonthly = true;
  } else {
    console.log(`⚠️  ${product}: not configured (${label})`);
  }
}

if (!hasTeamsMonthly) {
  console.log('❌ At least Cloud Teams monthly price ID is required for self-serve checkout');
  console.log('   Set STRIPE_PRICE_ID_TEAMS_MONTHLY (or SIMPLEBEACON_PRO_PRICE_ID) in .env.production.');
  ok = false;
}

for (const key of recommended) {
  const val = process.env[key];
  console.log(val ? `✅ ${key} set` : `⚠️  ${key} not set (recommended)`);
}

if (isMonetizationEnabled()) {
  const webhook = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!webhook) {
    console.log('❌ STRIPE_WEBHOOK_SECRET is required when monetization is enabled');
    ok = false;
  } else if (!webhook.startsWith('whsec_') || isPlaceholder(webhook)) {
    console.log('❌ STRIPE_WEBHOOK_SECRET must be a real whsec_ value (not placeholder)');
    ok = false;
  } else {
    console.log('✅ STRIPE_WEBHOOK_SECRET format looks valid');
  }

  const appUrl = String(process.env.SIMPLEBEACON_APP_URL || '').trim();
  if (!appUrl) {
    console.log('❌ SIMPLEBEACON_APP_URL is required for Stripe checkout redirect URLs');
    ok = false;
  } else if (!/^https:\/\//i.test(appUrl)) {
    console.log(`❌ SIMPLEBEACON_APP_URL must use https:// (current: ${appUrl})`);
    ok = false;
  } else {
    console.log(`✅ SIMPLEBEACON_APP_URL: ${appUrl}`);
  }
}

if (process.env.SIMPLEBEACON_BYPASS_EMAIL) {
  console.log(`ℹ️  Bypass email: ${process.env.SIMPLEBEACON_BYPASS_EMAIL}`);
}

async function validatePrices(stripe) {
  console.log('\nStripe API price validation');
  console.log('-----------------------------');
  for (const [product, priceId] of Object.entries(priceIds)) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
      const recurring = price.recurring
        ? `${price.recurring.interval}${price.recurring.interval_count > 1 ? ` x${price.recurring.interval_count}` : ''}`
        : 'one_time';
      const productName =
        typeof price.product === 'object' && price.product?.name
          ? price.product.name
          : price.product;
      console.log(
        `✅ ${product}: ${formatAmount(price.unit_amount, price.currency)} · ${recurring} · ${productName} · livemode=${price.livemode}`
      );
    } catch (err) {
      console.log(`❌ ${product}: invalid price ${priceId} — ${err.message}`);
      ok = false;
    }
  }
}

async function main() {
  if (!ok) {
    console.log('\nCopy .env.production.example → .env.production and fill Stripe keys + Price IDs (price_...).');
    process.exit(1);
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  await validatePrices(stripe);

  const base = (process.env.SIMPLEBEACON_APP_URL || 'http://localhost:54355').replace(/\/$/, '');
  console.log('\nWebhook URL (Stripe Dashboard → Developers → Webhooks):');
  console.log('  ' + base + '/api/simplebeacon/billing/webhook');
  console.log('Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted');
  console.log('\nPricing page: ' + base + '/pricing');
  console.log('Dashboard billing: ' + base + '/app#/pricing');

  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Stripe verification failed:', err.message);
  process.exit(1);
});
