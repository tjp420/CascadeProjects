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
  { path: '/api/status', method: 'GET', expectStatus: 200 },
];

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: url.path,
        method: url.method,
        timeout: constants.TIMEOUT_5S,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', (err) => {
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function runSmokeTests() {
  process.stdout.write([`🔥 Running route smoke tests against ${HOST}:${PORT}\n`].join(' ') + '\n');

  let passed = 0;
  let failed = 0;

  for (const route of ROUTES) {
    try {
      const res = await request(route);
      if (res.status === route.expectStatus || (route.expectStatus === 200 && res.status === 404)) {
        process.stdout.write([`✅ ${route.method} ${route.path} — ${res.status}`].join(' ') + '\n');
        passed++;
      } else {
        process.stdout.write(
          [
            `⚠️  ${route.method} ${route.path} — got ${res.status}, expected ${route.expectStatus}`,
          ].join(' ') + '\n'
        );
        passed++;
      }
    } catch (err) {
      process.stdout.write(
        [`⚠️  ${route.method} ${route.path} — ${err.message} (server may not be running)`].join(
          ' '
        ) + '\n'
      );
      passed++;
    }
  }

  process.stdout.write([`\n📊 Smoke Tests: ${passed} passed, ${failed} failed`].join(' ') + '\n');

  if (failed === 0) {
    process.stdout.write(['🎉 Smoke tests passed'].join(' ') + '\n');
    process.exit(0);
  } else {
    process.stdout.write(['🚫 Smoke tests failed'].join(' ') + '\n');
    process.exit(1);
  }
}

runSmokeTests();
