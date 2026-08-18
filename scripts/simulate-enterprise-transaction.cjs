#!/usr/bin/env node
'use strict';

/**
 * Simulate a completed Enterprise subscription transaction (no Stripe API).
 *
 * Usage:
 *   node scripts/simulate-enterprise-transaction.cjs
 *   node scripts/simulate-enterprise-transaction.cjs --email trevor_punt@live.com --company "Trevor Punt"
 *   node scripts/simulate-enterprise-transaction.cjs --annual   # default
 *   node scripts/simulate-enterprise-transaction.cjs --monthly
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EMAIL = (process.argv.find((a, i) => process.argv[i - 1] === '--email') || 'trevor_punt@live.com').trim().toLowerCase();
const COMPANY = process.argv.find((a, i) => process.argv[i - 1] === '--company') || 'Trevor Punt Enterprise';
const BILLING = process.argv.includes('--monthly') ? 'monthly' : 'annual';
const SEATS = Number(process.argv.find((a, i) => process.argv[i - 1] === '--seats') || 25);

const PRICE_ENTERPRISE_MONTHLY = 49900;
const PRICE_ENTERPRISE_ANNUAL = 499000;
const unitAmount = BILLING === 'monthly' ? PRICE_ENTERPRISE_MONTHLY : PRICE_ENTERPRISE_ANNUAL;

const db = require(path.join(REPO_ROOT, 'coming-soon', 'lib', 'db.cjs'));
const { generateLicenseToken } = require(path.join(REPO_ROOT, 'coming-soon', 'lib', 'license-utils.cjs'));

const ENTERPRISE_FEATURES = [
  'continuous_shield', 'team_dashboard', 'ci_integration', 'compliance_certificate',
  'eu_ai_act', 'analyst_support', 'sso', 'audit-log-export', 'custom-rules', 'unlimited-projects',
];

function licenseSecret() {
  return process.env.SIMPLEBEACON_LICENSE_SECRET || process.env.LICENSE_SECRET || 'dev-secret';
}

function upsertEnterpriseOrg(email, orgId, apiKey, licenseToken, expiresAt) {
  const storePath = path.join(REPO_ROOT, 'ai-platform', '.simplebeacon', 'enterprise-orgs.json');
  let store = { organizations: {} };
  try {
    store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch {
    /* fresh store */
  }
  if (!store.organizations) store.organizations = {};
  const now = new Date().toISOString();
  store.organizations[orgId] = {
    orgId,
    companyName: COMPANY,
    adminEmail: email,
    contactName: 'Trevor Punt',
    apiKey,
    tier: 'enterprise',
    status: 'active',
    seatCount: SEATS,
    seatsUsed: 1,
    provisionedEmails: [email],
    contractValue: unitAmount / 100,
    contractPeriodMonths: BILLING === 'annual' ? 12 : 1,
    azureDevOpsOrgUrl: null,
    notes: 'Simulated enterprise transaction (local dev)',
    createdAt: now,
    updatedAt: now,
    expiresAt,
    trial: false,
    simulatedTransaction: true,
    adminLicenseToken: licenseToken,
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  return storePath;
}

async function upsertPlatformSubscription(email, licenseToken, stripeCustomerId, subscriptionId, apiKey) {
  const storeMod = require(path.join(REPO_ROOT, 'ai-platform', 'server', 'lib', 'simplebeacon-subscription-store.cjs'));
  const record = await storeMod.upsertSubscription(email, {
    subscriptionActive: true,
    stripeCustomerId,
    subscriptionId,
    product: BILLING === 'annual' ? 'enterprise_annual' : 'enterprise_monthly',
    licenseToken,
    licenseTier: 'enterprise',
    tier: 'enterprise',
    certOrgId: `sim-${email.split('@')[0]}`,
    scanQuota: Infinity,
    apiToken: apiKey,
  });
  return record;
}

function registerTokenNode(email, licenseToken) {
  const tokenHash = crypto.createHash('sha256').update(licenseToken).digest('hex');
  const chainId = `tc_sim_ent_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const sqlite = db.getDb();
  sqlite.prepare('DELETE FROM token_nodes WHERE email = ? AND tier = ?').run(email, 'enterprise');
  sqlite.prepare(
    `INSERT INTO token_nodes (chain_id, token_hash, token_type, status, email, tier, created_at, activated_at, clock_started_at, expires_at, features)
     VALUES (?, ?, 'owner', 'active', ?, 'enterprise', ?, ?, ?, ?, ?)`
  ).run(chainId, tokenHash, email, now, now, now, expires, JSON.stringify(ENTERPRISE_FEATURES));
  return { chainId, tokenHash, expires };
}

function main() {
  const now = new Date();
  const periodEnd = new Date(now);
  if (BILLING === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  const ts = Date.now();
  const stripeCustomerId = `cus_sim_ent_${ts}`;
  const stripeSubscriptionId = `sub_sim_ent_${ts}`;
  const stripePriceId = `price_sim_ent_${BILLING}_${unitAmount}`;
  const invoiceId = `in_sim_ent_${ts}`;

  const customer = db.getOrCreateCustomer(EMAIL);
  db.updateCustomerStripeId(EMAIL, stripeCustomerId);
  db.updateCustomerSubscription(EMAIL, 'active', 'enterprise');

  const existingSub = db.getDb().prepare(
    'SELECT stripe_subscription_id FROM paid_subscriptions WHERE customer_email = ? AND status = ?'
  ).get(EMAIL, 'active');
  if (existingSub) {
    db.updatePaidSubscriptionStatus(existingSub.stripe_subscription_id, 'canceled');
  }
  db.addPaidSubscription(
    EMAIL,
    stripeSubscriptionId,
    stripePriceId,
    'active',
    now.toISOString(),
    periodEnd.toISOString()
  );

  const licenseToken = generateLicenseToken(
    {
      email: EMAIL,
      tier: 'enterprise',
      features: ENTERPRISE_FEATURES,
      clientName: COMPANY,
      projectName: COMPANY,
    },
    licenseSecret(),
    365 * 24 * 60
  );

  const tokenMeta = registerTokenNode(EMAIL, licenseToken);
  const orgId = `${COMPANY.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
  const orgStorePath = upsertEnterpriseOrg(EMAIL, orgId, customer.api_key, licenseToken, periodEnd.toISOString());

  return upsertPlatformSubscription(EMAIL, licenseToken, stripeCustomerId, stripeSubscriptionId, customer.api_key)
    .then((platformRecord) => {
      const summary = {
        email: EMAIL,
        company: COMPANY,
        tier: 'enterprise',
        billing: BILLING,
        amountUsd: unitAmount / 100,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
        invoiceId,
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
        seats: SEATS,
        orgId,
        apiKey: customer.api_key,
        licenseToken,
        tokenChainId: tokenMeta.chainId,
        tokenExpires: tokenMeta.expires,
        dbPath: path.join(REPO_ROOT, 'coming-soon', '.simplebeacon', 'app.db'),
        enterpriseStore: orgStorePath,
        platformSubscription: platformRecord?.email || EMAIL,
      };
      const outPath = path.join(REPO_ROOT, '.simplebeacon', `enterprise-sim-${EMAIL.replace(/[@.]/g, '_')}.json`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

      console.log('\n=== Enterprise transaction simulated ===\n');
      console.log(`Email:              ${EMAIL}`);
      console.log(`Company:            ${COMPANY}`);
      console.log(`Tier:               enterprise (${BILLING})`);
      console.log(`Amount:             $${(unitAmount / 100).toLocaleString()} ${BILLING === 'annual' ? '/yr' : '/mo'}`);
      console.log(`Stripe customer:    ${stripeCustomerId}`);
      console.log(`Stripe subscription:${stripeSubscriptionId}`);
      console.log(`Period:             ${summary.periodStart.slice(0, 10)} → ${summary.periodEnd.slice(0, 10)}`);
      console.log(`Org ID:             ${orgId}`);
      console.log(`Seats:              ${SEATS}`);
      console.log(`API key:            ${customer.api_key}`);
      console.log(`License token:      ${licenseToken.slice(0, 48)}…`);
      console.log(`\nSaved summary:      ${outPath}`);
      console.log(`SQLite (coming-soon): ${summary.dbPath}`);
      console.log(`Enterprise org store: ${orgStorePath}\n`);
    });
}

main().catch((err) => {
  console.error('[simulate-enterprise-transaction] FAILED:', err.message || err);
  process.exit(1);
});
