const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { setupEnterpriseOnboardingRoutes } = require('../enterprise-onboarding.cjs');
// Note: test environment path to server libs
const subscriptionStore = require('../../../server/lib/simplebeacon-subscription-store.cjs');

let RUN_TEST = (typeof test === 'function') ? test : null;
if (!RUN_TEST) {
  try { RUN_TEST = require('node:test').test; } catch (e) { RUN_TEST = global.test; }
}

RUN_TEST('onboard rate limit enforces 429', async () => {
  const tmpStore = path.join(os.tmpdir(), 'enterprise-store-test-' + Date.now() + '.json');
  process.env.ENTERPRISE_STORE_PATH = tmpStore;
  process.env.ONBOARD_RATE_LIMIT_MAX = '5';
  process.env.ONBOARD_RATE_WINDOW_MS = '1000';

  const app = express();
  app.use(express.json());
  setupEnterpriseOnboardingRoutes(app);

  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const address = server.address();
  const port = address.port;

  const commonAdmin = 'admin@example.com';

  function sendOnboard(i) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ companyName: 'TestCo' + i, adminEmail: commonAdmin });
      const opts = {
        hostname: '127.0.0.1',
        port,
        path: '/api/enterprise/onboard',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      const req = http.request(opts, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  try {
    const results = [];
    for (let i = 0; i < 8; i++) {
      results.push(await sendOnboard(i));
    }

    const statusCounts = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

    assert.ok((statusCounts[201] || 0) >= 5, 'expected at least 5 successes');
    assert.ok((statusCounts[429] || 0) >= 1, 'expected some 429 responses');
  } finally {
    await new Promise((res) => server.close(res));
    try { fs.unlinkSync(tmpStore); } catch (e) { /* ignore */ }
  }
});
