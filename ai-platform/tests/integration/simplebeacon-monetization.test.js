const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function withMonetizedServer(fn, { subscribedEmail } = {}) {
  const priorEnabled = process.env.SIMPLEBEACON_MONETIZATION_ENABLED;
  const priorStore = process.env.SIMPLEBEACON_SUBSCRIPTION_STORE;

  process.env.SIMPLEBEACON_MONETIZATION_ENABLED = 'true';

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sub-'));
  const storePath = path.join(tempDir, 'subscriptions.json');
  process.env.SIMPLEBEACON_SUBSCRIPTION_STORE = storePath;

  jest.resetModules();
  const { setSubscriptionActive } = require('../../server/lib/simplebeacon-subscription-store');
  const setupSimplebeaconAPI = require('../../src/api/simplebeacon-api');
  const { setupSimplebeaconBillingRoutes } = require('../../src/api/simplebeacon-billing-api');

  if (subscribedEmail) {
    await setSubscriptionActive(subscribedEmail, true, {
      stripeCustomerId: 'cus_test',
      subscriptionId: 'sub_test'
    });
  }

  const app = express();
  app.use(express.json());
  setupSimplebeaconBillingRoutes(app);
  setupSimplebeaconAPI(app);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await fn(baseUrl);
  } finally {
    process.env.SIMPLEBEACON_MONETIZATION_ENABLED = priorEnabled;
    if (priorStore == null) {
      delete process.env.SIMPLEBEACON_SUBSCRIPTION_STORE;
    } else {
      process.env.SIMPLEBEACON_SUBSCRIPTION_STORE = priorStore;
    }
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.resetModules();
  }
}

describe('simplebeacon monetization', () => {
  test('paid routes return 403 without subscription', async () => {
    await withMonetizedServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/simplebeacon/dashboard`);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('subscription_required');
    });
  });

  test('baseline stays public when monetization is enabled', async () => {
    await withMonetizedServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/simplebeacon/baseline`);
      expect(res.status).toBe(200);
    });
  });

  test('subscribed email unlocks dashboard', async () => {
    await withMonetizedServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/simplebeacon/dashboard`, {
        headers: { 'X-Simplebeacon-Email': 'paid@example.com' }
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe('simplebeacon-dashboard');
    }, { subscribedEmail: 'paid@example.com' });
  });

  test('billing plan endpoint is always public', async () => {
    await withMonetizedServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/simplebeacon/billing/plan`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tiers.community).toBeDefined();
      expect(body.tiers.cloudTeams).toBeDefined();
      expect(body.tiers.enterprise).toBeDefined();
      expect(body.priceLabel).toMatch(/\$49/);
    });
  });
});
