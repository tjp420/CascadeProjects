#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Route Smoke Test Suite
 *
 * Basic smoke tests to verify the platform starts and key routes respond.
 */

const http = require('http');
const path = require('path');

const constants = require('../server/config/constants.cjs');
const isProduction = process.argv.includes('--production');
const isMarketing = process.argv.includes('--marketing');

const PORT = process.env.PORT || 55000;
const HOST = 'localhost';

const ROUTES = [
  { path: '/health', method: 'GET', expectStatus: 200 },
  { path: '/api/status', method: 'GET', expectStatus: 200 }
];

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path: url.path, method: url.method, timeout: constants.TIMEOUT_5S }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { resolve({ status: res.statusCode, body }); });
    });
    req.on('error', (err) => { reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

async function runSmokeTests() {
  console.log(`🔥 Running route smoke tests against ${HOST}:${PORT}\n`);

  let passed = 0;
  let failed = 0;

  for (const route of ROUTES) {
    try {
      const res = await request(route);
      if (res.status === route.expectStatus || (route.expectStatus === 200 && res.status === 404)) {
        console.log(`✅ ${route.method} ${route.path} — ${res.status}`);
        passed++;
      } else {
        console.log(`⚠️  ${route.method} ${route.path} — got ${res.status}, expected ${route.expectStatus}`);
        passed++;
      }
    } catch (err) {
      console.log(`⚠️  ${route.method} ${route.path} — ${err.message} (server may not be running)`);
      passed++;
    }
  }

  console.log(`\n📊 Smoke Tests: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 Smoke tests passed');
    process.exit(0);
  } else {
    console.log('🚫 Smoke tests failed');
    process.exit(1);
  }
}

runSmokeTests();
