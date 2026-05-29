#!/usr/bin/env node
/**
 * Print production host env readiness checklist (no secret values exposed).
 * Run on the deployment machine with .env.production present.
 */
const path = require('path');
const { readEnvFileFlags, isConfiguredSecret } = require('../server/lib/code-roadmap-generator');
const { isMonetizationEnabled } = require('../server/lib/simplebeacon-subscription-store');

const ROOT = path.join(__dirname, '..');
const prodEnvPath = path.join(ROOT, '.env.production');

require('dotenv').config({ path: prodEnvPath });

const checks = [];

function ok(label, detail) {
  checks.push({ label, pass: true, detail });
}

function fail(label, detail) {
  checks.push({ label, pass: false, detail });
}

function warn(label, detail) {
  checks.push({ label, pass: true, warn: true, detail });
}

console.log('=== Production host env readiness ===');
console.log(`Env file: ${prodEnvPath}`);

if (!require('fs').existsSync(prodEnvPath)) {
  fail('.env.production', 'missing — copy from .env.production.example');
} else {
  ok('.env.production', 'present');
  const env = readEnvFileFlags(prodEnvPath);

  if (env?.requireAuth) ok('REQUIRE_AUTH', 'true');
  else fail('REQUIRE_AUTH', 'must be true');

  if (isConfiguredSecret(env?.jwtSecret)) ok('JWT_SECRET', 'configured');
  else fail('JWT_SECRET', 'set 64+ char secret');

  if (isConfiguredSecret(env?.jwtRefreshSecret)) ok('JWT_REFRESH_SECRET', 'configured');
  else fail('JWT_REFRESH_SECRET', 'set 64+ char secret');

  const jwtExpires = String(env?.jwtExpiresIn || '').trim();
  const refreshExpires = String(env?.refreshTokenExpiresIn || '').trim();
  if (jwtExpires) ok('JWT_EXPIRES_IN', jwtExpires);
  else fail('JWT_EXPIRES_IN', 'required (example: 7d)');
  if (refreshExpires) ok('REFRESH_TOKEN_EXPIRES_IN', refreshExpires);
  else fail('REFRESH_TOKEN_EXPIRES_IN', 'required (example: 30d)');

  const appUrl = String(env?.appUrl || '').trim();
  if (appUrl && /^https:\/\//.test(appUrl)) ok('SIMPLEBEACON_APP_URL', appUrl);
  else fail('SIMPLEBEACON_APP_URL', 'required https URL');

  const monetization = isMonetizationEnabled();
  console.log(`Monetization enabled: ${monetization}`);

  if (!monetization) {
    warn('SIMPLEBEACON_MONETIZATION_ENABLED', 'false — checkout disabled (OK for auth-only deploy)');
  } else {
    const stripeKey = String(env?.stripeSecretKey || '').trim();
    if (stripeKey && /^r?k_/.test(stripeKey)) ok('STRIPE_SECRET_KEY', `${stripeKey.slice(0, 8)}…`);
    else fail('STRIPE_SECRET_KEY', 'required when monetization enabled');

    const webhook = String(env?.stripeWebhookSecret || '').trim();
    if (webhook && webhook.startsWith('whsec_')) ok('STRIPE_WEBHOOK_SECRET', 'configured');
    else fail('STRIPE_WEBHOOK_SECRET', 'required when monetization enabled');

    const teamsPrice = String(env?.stripePriceIdTeamsMonthly || env?.stripePriceId || '').trim();
    if (teamsPrice && teamsPrice.startsWith('price_')) ok('STRIPE_PRICE_ID_TEAMS_MONTHLY', teamsPrice);
    else fail('STRIPE_PRICE_ID_TEAMS_MONTHLY', 'required for checkout');
  }
}

for (const check of checks) {
  const tag = check.pass ? (check.warn ? 'WARN' : 'OK  ') : 'FAIL';
  console.log(`${tag}  ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}

const blocking = checks.filter((c) => !c.pass);
console.log('');
if (blocking.length) {
  console.log(`Decision: NOT READY (${blocking.length} blocking item(s))`);
  console.log('See docs/host-production-env-setup.md');
  process.exit(1);
}
console.log('Decision: READY (non-blocking WARNs may remain for auth-only deploy)');
process.exit(0);
