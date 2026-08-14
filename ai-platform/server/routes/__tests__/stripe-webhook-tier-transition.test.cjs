'use strict';

/**
 * Stripe Webhook — Tier Transition Integration Tests
 *
 * Acceptance Criteria being verified:
 * 1. customer.subscription.updated with Developer price → user tier becomes `developer`
 * 2. customer.subscription.updated with Team Pro price → user tier becomes `team_pro`
 * 3. customer.subscription.deleted → user tier reverts to `free`
 * 4. customer.subscription.updated with status=past_due → user tier reverts to `free`
 * 5. Duplicate event delivery (same event id) → 200 { received: true } and does NOT double-process
 * 6. Unknown event type → 200 { received: true } without error
 * 7. Missing customer field → handles gracefully without crash
 * 8. Webhook signature verification — invalid signature returns 400
 *
 * Approach:
 * - Uses node:test (describe/it) + node:assert + supertest
 * - Mocks Stripe module, database/subscription store, and event store via Module._load interception
 * - Follows the same pattern as scan-counter-routes.test.cjs
 * - Constructs realistic Stripe event payloads and verifies tier transitions
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const express = require('express');
const request = require('supertest');
const Module = require('module');
const path = require('path');

const ROUTE_PATH = require.resolve('../stripe-webhook-routes.cjs');
const IS_JEST = typeof jest !== 'undefined' && typeof jest.doMock === 'function';

// ─── Price IDs from config/stripe.cjs (real Stripe Price IDs) ───────────────
const PRICE_DEVELOPER_MONTHLY = 'price_1U2flyAQ0e20kzI8Y8CYxUWt';
const PRICE_DEVELOPER_ANNUAL = 'price_1U2fmaAQ0e20kzI8YQImSRpQ';
const PRICE_TEAM_PRO_MONTHLY = 'price_1U2fn7AQ0e20kzI8lXYh295F';
const PRICE_TEAM_PRO_ANNUAL = 'price_1U2fnYAQ0e20kzI8EI2LjRQC';

const WEBHOOK_SECRET = 'whsec_test_secret_for_integration_tests';

// ─── Mock Factories ─────────────────────────────────────────────────────────

/**
 * Silent logger mock — swallows all log calls.
 */
function makeLogger() {
  return {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => makeLogger(),
    refreshLevel: () => {},
    setLevel: () => {},
    isLevelEnabled: () => false,
    getLevel: () => 'info',
  };
}

/**
 * In-memory subscription store mock.
 * Tracks all setSubscriptionActive calls for assertion.
 * @param {Object} initialSubscriptions - keyed by normalized email
 * @returns {Object} Mock store with spies
 */
function makeMockSubscriptionStore(initialSubscriptions = {}) {
  const subscriptions = {};
  for (const [email, record] of Object.entries(initialSubscriptions)) {
    subscriptions[email.toLowerCase().trim()] = { ...record };
  }

  const calls = [];

  const store = {
    subscriptions,
    byApiToken: {},
  };

  return {
    readStore: async () => store,

    getSubscriptionByEmail: async (email) => {
      const normalized = String(email || '').trim().toLowerCase();
      return subscriptions[normalized] || null;
    },

    setSubscriptionActive: async (email, active, stripeFields = {}) => {
      const normalized = String(email || '').trim().toLowerCase();
      const existing = subscriptions[normalized] || {
        email: normalized,
        tier: 'free',
        subscriptionActive: false,
        stripeCustomerId: null,
      };
      const updated = {
        ...existing,
        email: normalized,
        subscriptionActive: Boolean(active),
        ...stripeFields,
        updatedAt: new Date().toISOString(),
      };
      subscriptions[normalized] = updated;
      calls.push({ method: 'setSubscriptionActive', email: normalized, active: Boolean(active), stripeFields });
      return updated;
    },

    upsertSubscription: async (email, patch = {}) => {
      const normalized = String(email || '').trim().toLowerCase();
      const existing = subscriptions[normalized] || {
        email: normalized,
        tier: 'free',
        subscriptionActive: false,
        stripeCustomerId: null,
      };
      const updated = {
        ...existing,
        email: normalized,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      subscriptions[normalized] = updated;
      calls.push({ method: 'upsertSubscription', email: normalized, patch });
      return updated;
    },

    // Exposed for test assertions
    _calls: calls,
    _store: store,
  };
}

/**
 * In-memory event store mock for idempotency.
 * @param {string[]} preSeenEventIds - event IDs to pre-seed as already processed
 * @returns {Object} Mock event store
 */
function makeMockEventStore(preSeenEventIds = []) {
  const seen = new Set(preSeenEventIds);
  const calls = [];

  return {
    recordProcessedEvent: async (eventId) => {
      calls.push({ eventId });
      if (seen.has(eventId)) {
        return false;
      }
      seen.add(eventId);
      return true;
    },
    clearCache: () => {},
    getProcessedCount: async () => seen.size,
    _seen: seen,
    _calls: calls,
  };
}

/**
 * No-op email service mock.
 */
function makeMockEmailService() {
  const calls = [];
  return {
    sendEmail: async (opts) => {
      calls.push(opts);
      return { sent: true, queued: false };
    },
    _calls: calls,
  };
}

/**
 * No-op purchase alerts mock.
 */
function makeMockPurchaseAlerts() {
  const calls = [];
  return {
    sendPurchaseAlert: async (opts) => {
      calls.push(opts);
      return { sent: false };
    },
    _calls: calls,
  };
}

/**
 * No-op webhook event log mock.
 */
function makeMockWebhookEventLog() {
  const calls = [];
  return {
    logWebhookEvent: async (entry) => {
      calls.push(entry);
    },
    getRecentEvents: () => [],
    getStats: () => ({ total: 0, byType: {}, byStatus: {} }),
    clearCache: () => {},
    _calls: calls,
  };
}

/**
 * Mock billing email templates — returns minimal render objects.
 */
function makeMockBillingEmailTemplates() {
  const calls = [];
  const makeTemplate = (name) => () => {
    calls.push(name);
    return { subject: `Mock ${name}`, text: 'mock text', html: '<p>mock</p>' };
  };

  return {
    renderSubscriptionActivated: makeTemplate('activated'),
    renderSubscriptionCanceled: makeTemplate('canceled'),
    renderSubscriptionReactivated: makeTemplate('reactivated'),
    renderPaymentFailed: makeTemplate('payment_failed'),
    renderTrialEnding: makeTemplate('trial_ending'),
    renderDisputeAlert: makeTemplate('dispute_alert'),
    renderInvoiceUpcoming: makeTemplate('invoice_upcoming'),
    renderProrationNotice: makeTemplate('proration_notice'),
    renderSubscriptionPaused: makeTemplate('paused'),
    renderSubscriptionResumed: makeTemplate('resumed'),
    _calls: calls,
  };
}

/**
 * Mock proration calculator — returns dummy proration result.
 */
function makeMockProrationCalculator() {
  const calls = [];
  return {
    calculateProration: (opts) => {
      calls.push(opts);
      return {
        netAdjustmentCents: 0,
        netAdjustmentDisplay: '$0.00',
        isUpgrade: false,
        daysRemaining: 30,
      };
    },
    getTierMonthlyPrice: () => 0,
    getTierAnnualPrice: () => 0,
    tierDisplayName: (t) => t,
    _calls: calls,
  };
}

// ─── Module Loading via Module._load Interception ───────────────────────────

/**
 * Load the stripe-webhook-routes module with mocked dependencies.
 * @param {Object} stubs - Mock implementations keyed by short name.
 * @returns {Object} The loaded Express router.
 */
function loadWebhookModule(stubs) {
  const routeDir = path.dirname(ROUTE_PATH);
  const testDir = __dirname;
  const mockMap = {
    '../lib/app-logger.cjs': stubs.logger,
    '../lib/simplebeacon-subscription-store.cjs': stubs.subscriptionStore,
    '../lib/email-service.cjs': stubs.emailService,
    '../lib/purchase-alerts.cjs': stubs.purchaseAlerts,
    '../lib/stripe-event-store.cjs': stubs.eventStore,
    '../lib/webhook-event-log.cjs': stubs.webhookEventLog,
    '../lib/billing-email-templates.cjs': stubs.billingEmailTemplates,
    '../lib/proration-calculator.cjs': stubs.prorationCalculator,
    // Use real config/stripe.cjs for price→tier mapping (pure data, no side effects)
    // Use real response-helpers.cjs (pure logic, no side effects)
  };

  if (IS_JEST) {
    jest.resetModules();
    for (const [modPath, impl] of Object.entries(mockMap)) {
      if (impl) {
        const absPath = path.resolve(routeDir, modPath);
        const relPath = path.relative(testDir, absPath);
        jest.doMock(relPath, () => impl, { virtual: true });
      }
    }
    return require(ROUTE_PATH);
  }

  // Node --test: intercept Module._load
  const originalLoad = Module._load;
  Module._load = function (req, parent, isMain) {
    if (parent && parent.filename === ROUTE_PATH && mockMap[req]) {
      return mockMap[req];
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[ROUTE_PATH];
  const mod = require(ROUTE_PATH);
  Module._load = originalLoad;
  return mod;
}

// ─── Stripe Event Payload Helpers ───────────────────────────────────────────

/**
 * Generate a valid Stripe-Signature header for a given payload.
 * Replicates the HMAC-SHA256 verification used by the route handler.
 * @param {string|Buffer} payload - Raw request body (string or Buffer).
 * @param {string} secret - Webhook signing secret.
 * @returns {string} Stripe-Signature header value.
 */
function makeSignature(payload, secret) {
  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payloadStr}`;
  const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

/**
 * Build a realistic customer.subscription.updated event payload.
 * @param {Object} opts
 * @param {string} opts.eventId - Stripe event ID.
 * @param {string} opts.customerId - Stripe customer ID.
 * @param {string} opts.priceId - Stripe price ID.
 * @param {string} [opts.status='active'] - Subscription status.
 * @param {string} [opts.subscriptionId='sub_test123'] - Stripe subscription ID.
 * @returns {Object} Stripe event object.
 */
function makeSubscriptionUpdatedEvent(opts) {
  const {
    eventId,
    customerId,
    priceId,
    status = 'active',
    subscriptionId = 'sub_test123',
  } = opts;

  return {
    id: eventId,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: subscriptionId,
        customer: customerId,
        status,
        items: {
          data: [
            {
              price: { id: priceId },
            },
          ],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      },
    },
  };
}

/**
 * Build a realistic customer.subscription.deleted event payload.
 * @param {Object} opts
 * @param {string} opts.eventId - Stripe event ID.
 * @param {string} opts.customerId - Stripe customer ID.
 * @param {string} [opts.subscriptionId='sub_test123'] - Stripe subscription ID.
 * @returns {Object} Stripe event object.
 */
function makeSubscriptionDeletedEvent(opts) {
  const { eventId, customerId, subscriptionId = 'sub_test123' } = opts;

  return {
    id: eventId,
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: subscriptionId,
        customer: customerId,
        status: 'canceled',
      },
    },
  };
}

/**
 * Build an unknown event type payload.
 * @param {string} eventId - Stripe event ID.
 * @returns {Object} Stripe event object.
 */
function makeUnknownEvent(eventId) {
  return {
    id: eventId,
    type: 'some.unknown.event.type',
    data: {
      object: { id: 'obj_test' },
    },
  };
}

/**
 * Send a webhook request with a properly signed payload.
 * @param {express.Application} app - Express app instance.
 * @param {Object} event - Stripe event object.
 * @param {string} [signatureOverride] - Override signature (for invalid sig tests).
 * @returns {Promise<supertest.Response>}
 */
async function sendWebhook(app, event, signatureOverride) {
  const payloadStr = JSON.stringify(event);
  const signature = signatureOverride || makeSignature(payloadStr, WEBHOOK_SECRET);
  return request(app)
    .post('/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(payloadStr);
}

/**
 * Create a fresh set of default mocks for each test.
 * @param {Object} [overrides] - Override specific mocks.
 * @returns {Object} All mock instances.
 */
function makeDefaultMocks(overrides = {}) {
  return {
    logger: overrides.logger || makeLogger(),
    subscriptionStore: overrides.subscriptionStore || makeMockSubscriptionStore(),
    eventStore: overrides.eventStore || makeMockEventStore(),
    emailService: overrides.emailService || makeMockEmailService(),
    purchaseAlerts: overrides.purchaseAlerts || makeMockPurchaseAlerts(),
    webhookEventLog: overrides.webhookEventLog || makeMockWebhookEventLog(),
    billingEmailTemplates: overrides.billingEmailTemplates || makeMockBillingEmailTemplates(),
    prorationCalculator: overrides.prorationCalculator || makeMockProrationCalculator(),
  };
}

/**
 * Create an Express app with the webhook router mounted.
 * @param {Object} mocks - Mock instances.
 * @returns {express.Application}
 */
function makeApp(mocks) {
  const router = loadWebhookModule(mocks);
  const app = express();
  app.use('/stripe', router);
  return app;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Stripe Webhook — Tier Transition Integration Tests', () => {
  let originalWebhookSecret;

  beforeEach(() => {
    originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  // ─── AC1: subscription.updated → Developer tier ───────────────────────

  describe('AC1: customer.subscription.updated with Developer price', () => {
    it('sets user tier to "developer" for Developer monthly price', async () => {
      const customerId = 'cus_dev_monthly';
      const userEmail = 'devuser@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'free',
            subscriptionActive: false,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac1_dev_monthly',
        customerId,
        priceId: PRICE_DEVELOPER_MONTHLY,
        status: 'active',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record, 'subscription record should exist');
      assert.strictEqual(record.tier, 'developer');
      assert.strictEqual(record.subscriptionActive, true);
      assert.strictEqual(record.stripeCustomerId, customerId);
    });

    it('sets user tier to "developer" for Developer annual price', async () => {
      const customerId = 'cus_dev_annual';
      const userEmail = 'devannual@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'free',
            subscriptionActive: false,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac1_dev_annual',
        customerId,
        priceId: PRICE_DEVELOPER_ANNUAL,
        status: 'active',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      assert.strictEqual(record.tier, 'developer');
      assert.strictEqual(record.subscriptionActive, true);
    });
  });

  // ─── AC2: subscription.updated → Team Pro tier ────────────────────────

  describe('AC2: customer.subscription.updated with Team Pro price', () => {
    it('sets user tier to "team_pro" for Team Pro monthly price', async () => {
      const customerId = 'cus_team_monthly';
      const userEmail = 'teamuser@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'developer',
            subscriptionActive: true,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac2_team_monthly',
        customerId,
        priceId: PRICE_TEAM_PRO_MONTHLY,
        status: 'active',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      assert.strictEqual(record.tier, 'team_pro');
      assert.strictEqual(record.subscriptionActive, true);
      assert.strictEqual(record.stripeCustomerId, customerId);
    });

    it('sets user tier to "team_pro" for Team Pro annual price', async () => {
      const customerId = 'cus_team_annual';
      const userEmail = 'teamannual@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'developer',
            subscriptionActive: true,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac2_team_annual',
        customerId,
        priceId: PRICE_TEAM_PRO_ANNUAL,
        status: 'active',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      assert.strictEqual(record.tier, 'team_pro');
      assert.strictEqual(record.subscriptionActive, true);
    });
  });

  // ─── AC3: subscription.deleted → tier reverts to free ─────────────────

  describe('AC3: customer.subscription.deleted reverts tier to free', () => {
    it('deactivates subscription when deleted event is received', async () => {
      const customerId = 'cus_delete_test';
      const userEmail = 'deleteuser@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'developer',
            subscriptionActive: true,
            stripeCustomerId: customerId,
            stripeSubscriptionId: 'sub_test123',
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionDeletedEvent({
        eventId: 'evt_ac3_deleted',
        customerId,
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
      assert.strictEqual(res.body.type, 'customer.subscription.deleted');

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      // subscriptionActive=false means the effective tier is 'free'
      // (publicSubscriptionStatus returns 'free' when subscriptionActive is false)
      assert.strictEqual(record.subscriptionActive, false);
    });

    it('deactivates subscription when deleted event received for team_pro user', async () => {
      const customerId = 'cus_delete_team';
      const userEmail = 'deleteteam@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'team_pro',
            subscriptionActive: true,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionDeletedEvent({
        eventId: 'evt_ac3_deleted_team',
        customerId,
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      assert.strictEqual(record.subscriptionActive, false);
    });
  });

  // ─── AC4: subscription.updated with status=past_due → free ───────────

  describe('AC4: customer.subscription.updated with status=past_due reverts to free', () => {
    it('deactivates subscription when status is past_due (Developer price)', async () => {
      const customerId = 'cus_pastdue_dev';
      const userEmail = 'pastdue@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'developer',
            subscriptionActive: true,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac4_pastdue',
        customerId,
        priceId: PRICE_DEVELOPER_MONTHLY,
        status: 'past_due',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      // subscriptionActive=false means effective tier is 'free'
      assert.strictEqual(record.subscriptionActive, false);
    });

    it('deactivates subscription when status is past_due (Team Pro price)', async () => {
      const customerId = 'cus_pastdue_team';
      const userEmail = 'pastdueteam@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'team_pro',
            subscriptionActive: true,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac4_pastdue_team',
        customerId,
        priceId: PRICE_TEAM_PRO_MONTHLY,
        status: 'past_due',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.ok(record);
      assert.strictEqual(record.subscriptionActive, false);
    });
  });

  // ─── AC5: Duplicate event delivery ────────────────────────────────────

  describe('AC5: duplicate event delivery does not double-process', () => {
    it('returns 200 with received:true and does NOT reprocess duplicate event', async () => {
      const customerId = 'cus_dup_test';
      const userEmail = 'dupuser@test.com';
      const eventId = 'evt_ac5_duplicate';

      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'free',
            subscriptionActive: false,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId,
        customerId,
        priceId: PRICE_DEVELOPER_MONTHLY,
        status: 'active',
      });

      // First delivery — should process and set tier to developer
      const res1 = await sendWebhook(app, event);
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.received, true);

      const recordAfterFirst = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.strictEqual(recordAfterFirst.tier, 'developer');
      assert.strictEqual(recordAfterFirst.subscriptionActive, true);

      // Count setSubscriptionActive calls after first delivery
      const callsAfterFirst = mocks.subscriptionStore._calls.length;

      // Second delivery of the SAME event ID — should be detected as duplicate
      const res2 = await sendWebhook(app, event);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.received, true);
      // The handler returns status: 'duplicate_ignored' for duplicates
      assert.strictEqual(res2.body.status, 'duplicate_ignored');

      // Verify NO additional setSubscriptionActive calls were made
      const callsAfterSecond = mocks.subscriptionStore._calls.length;
      assert.strictEqual(callsAfterSecond, callsAfterFirst, 'setSubscriptionActive should NOT be called again for duplicate event');

      // Record should be unchanged from first delivery
      const recordAfterSecond = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.strictEqual(recordAfterSecond.tier, 'developer');
      assert.strictEqual(recordAfterSecond.subscriptionActive, true);
    });

    it('returns 200 for duplicate even when event store was pre-seeded', async () => {
      const customerId = 'cus_preseed';
      const userEmail = 'preseed@test.com';
      const eventId = 'evt_ac5_preseeded';

      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'free',
            subscriptionActive: false,
            stripeCustomerId: customerId,
          },
        }),
        eventStore: makeMockEventStore([eventId]), // pre-seed as already seen
      });
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId,
        customerId,
        priceId: PRICE_DEVELOPER_MONTHLY,
        status: 'active',
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
      assert.strictEqual(res.body.status, 'duplicate_ignored');

      // Verify tier was NOT changed
      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.strictEqual(record.tier, 'free');
      assert.strictEqual(record.subscriptionActive, false);
      assert.strictEqual(mocks.subscriptionStore._calls.length, 0, 'no store mutations should occur for duplicate');
    });
  });

  // ─── AC6: Unknown event type ──────────────────────────────────────────

  describe('AC6: unknown event type returns 200 without error', () => {
    it('returns 200 { received: true } for unrecognized event type', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeUnknownEvent('evt_ac6_unknown');

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
      // The handler returns { received: true, ignored: true, type: ... }
      assert.strictEqual(res.body.ignored, true);
      assert.strictEqual(res.body.type, 'some.unknown.event.type');
    });

    it('does not call setSubscriptionActive for unknown event type', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeUnknownEvent('evt_ac6_unknown_noop');

      await sendWebhook(app, event);

      assert.strictEqual(mocks.subscriptionStore._calls.length, 0, 'store should not be mutated for unknown event');
    });
  });

  // ─── AC7: Missing customer field ──────────────────────────────────────

  describe('AC7: missing customer field handled gracefully', () => {
    it('subscription.updated with missing customer does not crash', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = {
        id: 'evt_ac7_no_customer',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_no_customer',
            // customer field intentionally missing
            status: 'active',
            items: {
              data: [
                { price: { id: PRICE_DEVELOPER_MONTHLY } },
              ],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          },
        },
      };

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
      assert.strictEqual(res.body.type, 'customer.subscription.updated');
    });

    it('subscription.deleted with missing customer does not crash', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = {
        id: 'evt_ac7_no_customer_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_no_customer_del',
            // customer field intentionally missing
            status: 'canceled',
          },
        },
      };

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
      assert.strictEqual(res.body.type, 'customer.subscription.deleted');
    });

    it('subscription.updated with null customer does not crash', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = {
        id: 'evt_ac7_null_customer',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_null_customer',
            customer: null,
            status: 'active',
            items: {
              data: [
                { price: { id: PRICE_TEAM_PRO_MONTHLY } },
              ],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          },
        },
      };

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
    });
  });

  // ─── AC8: Invalid webhook signature ───────────────────────────────────

  describe('AC8: invalid webhook signature returns 400', () => {
    it('returns 400 for completely invalid signature', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac8_bad_sig',
        customerId: 'cus_bad_sig',
        priceId: PRICE_DEVELOPER_MONTHLY,
      });

      const res = await sendWebhook(app, event, 't=12345,v1=invalid_signature_hex');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error, 'invalid_signature');
    });

    it('returns 400 for signature with wrong secret', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac8_wrong_secret',
        customerId: 'cus_wrong_secret',
        priceId: PRICE_DEVELOPER_MONTHLY,
      });

      // Generate signature with a DIFFERENT secret than the webhook expects
      const payloadStr = JSON.stringify(event);
      const wrongSignature = makeSignature(payloadStr, 'whsec_wrong_secret');

      const res = await sendWebhook(app, event, wrongSignature);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'invalid_signature');
    });

    it('returns 400 for missing signature header', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac8_no_sig',
        customerId: 'cus_no_sig',
        priceId: PRICE_DEVELOPER_MONTHLY,
      });

      const payload = Buffer.from(JSON.stringify(event), 'utf8');
      const res = await request(app)
        .post('/stripe/webhook')
        .set('Content-Type', 'application/json')
        // No stripe-signature header
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'missing_signature');
    });

    it('returns 400 for malformed signature header', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac8_malformed',
        customerId: 'cus_malformed',
        priceId: PRICE_DEVELOPER_MONTHLY,
      });

      const res = await sendWebhook(app, event, 'not_a_valid_signature_format');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'invalid_signature');
    });

    it('does not process event when signature is invalid', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_ac8_no_process',
        customerId: 'cus_no_process',
        priceId: PRICE_DEVELOPER_MONTHLY,
      });

      await sendWebhook(app, event, 't=12345,v1=deadbeef');

      // Event store should NOT have been called (signature fails before idempotency check)
      assert.strictEqual(mocks.eventStore._calls.length, 0, 'event store should not be called when signature is invalid');
      // Subscription store should NOT have been called
      assert.strictEqual(mocks.subscriptionStore._calls.length, 0, 'subscription store should not be called when signature is invalid');
    });
  });

  // ─── Edge Cases: Missing webhook secret config ────────────────────────

  describe('Edge case: STRIPE_WEBHOOK_SECRET not configured', () => {
    it('returns 503 when webhook secret is not set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const event = makeSubscriptionUpdatedEvent({
        eventId: 'evt_no_secret_config',
        customerId: 'cus_no_secret',
        priceId: PRICE_DEVELOPER_MONTHLY,
      });

      const res = await sendWebhook(app, event);

      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.error, 'stripe_not_configured');
    });
  });

  // ─── Edge Cases: Missing body ─────────────────────────────────────────

  describe('Edge case: missing or empty body', () => {
    it('returns 400 for empty request body', async () => {
      const mocks = makeDefaultMocks();
      const app = makeApp(mocks);

      const res = await request(app)
        .post('/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', makeSignature('', WEBHOOK_SECRET))
        .send('');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'missing_body');
    });
  });

  // ─── Tier Transition Flow: Developer → Team Pro upgrade ───────────────

  describe('Tier transition flow: Developer → Team Pro upgrade', () => {
    it('upgrades user from developer to team_pro on subscription.updated', async () => {
      const customerId = 'cus_upgrade_flow';
      const userEmail = 'upgrade@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'developer',
            subscriptionActive: true,
            stripeCustomerId: customerId,
          },
        }),
      });
      const app = makeApp(mocks);

      // First event: Developer monthly
      const devEvent = makeSubscriptionUpdatedEvent({
        eventId: 'evt_upgrade_step1_dev',
        customerId,
        priceId: PRICE_DEVELOPER_MONTHLY,
        status: 'active',
      });

      const res1 = await sendWebhook(app, devEvent);
      assert.strictEqual(res1.status, 200);

      const record1 = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.strictEqual(record1.tier, 'developer');
      assert.strictEqual(record1.subscriptionActive, true);

      // Second event: Team Pro monthly (upgrade)
      const teamEvent = makeSubscriptionUpdatedEvent({
        eventId: 'evt_upgrade_step2_team',
        customerId,
        priceId: PRICE_TEAM_PRO_MONTHLY,
        status: 'active',
      });

      const res2 = await sendWebhook(app, teamEvent);
      assert.strictEqual(res2.status, 200);

      const record2 = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.strictEqual(record2.tier, 'team_pro');
      assert.strictEqual(record2.subscriptionActive, true);
    });
  });

  // ─── Tier Transition Flow: Team Pro → cancellation → free ─────────────

  describe('Tier transition flow: Team Pro → cancellation → free', () => {
    it('reverts to free when active team_pro subscription is deleted', async () => {
      const customerId = 'cus_cancel_flow';
      const userEmail = 'cancelflow@test.com';
      const mocks = makeDefaultMocks({
        subscriptionStore: makeMockSubscriptionStore({
          [userEmail]: {
            email: userEmail,
            tier: 'team_pro',
            subscriptionActive: true,
            stripeCustomerId: customerId,
            stripeSubscriptionId: 'sub_test123',
          },
        }),
      });
      const app = makeApp(mocks);

      // Simulate cancellation
      const deleteEvent = makeSubscriptionDeletedEvent({
        eventId: 'evt_cancel_flow_delete',
        customerId,
      });

      const res = await sendWebhook(app, deleteEvent);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);

      const record = mocks.subscriptionStore._store.subscriptions[userEmail];
      assert.strictEqual(record.subscriptionActive, false);
      // The stored tier remains 'team_pro' but effective tier is 'free'
      // because publicSubscriptionStatus returns 'free' when subscriptionActive=false
    });
  });
});
