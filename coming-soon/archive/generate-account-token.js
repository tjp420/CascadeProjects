/**
 * CLI — generate root-down account + time tokens.
 * Usage:
 *   node generate-account-token.js <account-type> [period] [email]
 *
 * Examples:
 *   node generate-account-token.js starter
 *   node generate-account-token.js pro monthly
 *   node generate-account-token.js enterprise annual admin@company.com
 *   node generate-account-token.js trial
 */

'use strict';

const { generateTimeToken, decodeTimeToken } = require('./lib/time-tokens.cjs');

const accountType = process.argv[2] || 'starter';
const period = process.argv[3] || null;
const email = process.argv[4] || null;

const validTypes = ['starter', 'pro', 'enterprise', 'trial'];
const validPeriods = ['trial', 'monthly', 'quarterly', 'annual', 'lifetime'];

if (!validTypes.includes(accountType)) {
  console.error(`Invalid account type: "${accountType}"`);
  console.error(`Valid types: ${validTypes.join(', ')}`);
  process.exit(1);
}

if (period && !validPeriods.includes(period)) {
  console.error(`Invalid period: "${period}"`);
  console.error(`Valid periods: ${validPeriods.join(', ')}`);
  process.exit(1);
}

(async function () {
  try {
    // Step 1: Root creates account + time token (account controls time token)
    const result = generateTimeToken(accountType, { period, email });

    console.log('\n=== Root-Down Account + Time Token ===');
    console.log('Account Type :', result.meta.accountType);
    console.log('Tag          :', result.meta.tag);
    console.log('Period       :', result.meta.period);
    console.log('TTL (days)   :', result.meta.ttlDays);
    console.log('Issued       :', result.meta.issuedAt);
    console.log('Expires      :', result.meta.expiresAt);
    console.log('\n--- Time Token JWT (subordinate to account) ---\n<redacted>\n');

    // Step 2: Validate the token with CLI context (purges stale, checks concurrent use)
    const validation = decodeTimeToken(result.token, { ip: '127.0.0.1', userAgent: 'simplebeacon-cli/1.0' });
    console.log('Validation   :', validation.valid ? 'PASS' : 'FAIL');
    if (validation.valid) {
      console.log('Live Tier    :', validation.account.tier);
      console.log('Live Features:', validation.account.features.length, 'modules');
      console.log('Stale Purged :', validation.stalePurged, 'expired tokens removed');
    }

    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    const outFile = path.join(os.tmpdir(), `token-${accountType}${period ? '-' + period : ''}.txt`);
    await fs.writeFile(outFile, result.token + '\n', 'utf8');
    console.log('\nSaved to:', outFile);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
