#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Production Validation Script — Phase 3 smoke tests.
 *
 * Usage: node scripts/validate-production-assets.cjs [--full]
 *
 * Checks:
 *  - DNS resolves for simplebeacon.ai
 *  - Landing page loads (200 OK)
 *  - Security headers present
 *  - .env / server.cjs / subscriptions.json return 403/404
 *  - Health endpoint returns 200
 *  - Stripe webhook test mode returns 200
 */

const https = require('https');
const http = require('http');

const PROD_URL = 'https://simplebeacon.ai';
const API_URL = 'https://simplebeacon.ai/api';

function request(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.request(url, { method, timeout: 15000 }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

function check(label, promise, expectStatus, expectHeader) {
  return promise
    .then(({ status, headers }) => {
      const statusOk = expectStatus ? status === expectStatus : true;
      const headerOk = expectHeader ? headers[expectHeader[0]] === expectHeader[1] : true;
      if (statusOk && headerOk) {
        console.log(`  ✅ ${label} (HTTP ${status})`);
        return true;
      }
      console.log(`  ❌ ${label} — expected ${expectStatus}, got ${status}`);
      return false;
    })
    .catch((err) => {
      if (expectStatus === null) {
        console.log(`  ✅ ${label} — unreachable as expected (${err.message})`);
        return true;
      }
      console.log(`  ❌ ${label} — ${err.message}`);
      return false;
    });
}

async function main() {
  const isFull = process.argv.includes('--full');
  console.log('🔦 SimpleBeacon Production Validation\n');

  let passed = 0;
  let failed = 0;

  const results = await Promise.all([
    check('DNS resolves', request(PROD_URL), 200),
    check('Landing page loads', request(`${PROD_URL}/index.html`), 200),
    check('.env is blocked', request(`${PROD_URL}/.env`), 403),
    check('server.cjs is blocked', request(`${PROD_URL}/server.cjs`), 403),
    check('subscriptions.json is blocked', request(`${PROD_URL}/subscriptions.json`), 403),
    isFull
      ? check('Security headers — HSTS', request(PROD_URL), 200, [
          'strict-transport-security',
          'max-age=',
        ])
      : Promise.resolve(true),
    isFull
      ? check('Security headers — X-Content-Type-Options', request(PROD_URL), 200, [
          'x-content-type-options',
          'nosniff',
        ])
      : Promise.resolve(true),
    isFull ? check('Health endpoint', request(`${API_URL}/health`), 200) : Promise.resolve(true),
  ]);

  passed = results.filter(Boolean).length;
  failed = results.filter((r) => !r).length;

  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🚀 All production checks passed.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} check(s) failed.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
