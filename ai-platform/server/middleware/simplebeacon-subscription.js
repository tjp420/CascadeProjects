/**
 * Feature gating for Simplebeacon Cloud Teams tier (off unless SIMPLEBEACON_MONETIZATION_ENABLED=true).
 */

const {
  isMonetizationEnabled,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  consumeApiCall,
  publicSubscriptionStatus,
  normalizeEmail
} = require('../lib/simplebeacon-subscription-store');

const PAID_VIEWS = new Set([
  'dashboard',
  'audit',
  'results',
  'analyze',
  'tools',
  'platform',
  'quality',
  'settings'
]);

function extractApiToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return req.headers['x-simplebeacon-token'] || req.query.apiToken || null;
}

function extractEmail(req) {
  if (req.user?.email) return req.user.email;
  const headerEmail = req.headers['x-simplebeacon-email'];
  if (headerEmail) return headerEmail;
  if (req.query.email) return req.query.email;
  if (req.body?.email) return req.body.email;
  return null;
}

function upgradePayload(extra = {}) {
  return {
    error: 'subscription_required',
    message: 'Upgrade to Cloud Teams for dashboard and API access.',
    upgradeUrl: '/#/pricing',
    pricing: {
      free: ['CLI local scanning', 'Text/JSON reports', 'No hosted dashboard'],
      paid: ['Dashboard + scan history', 'Compliance Audit + Analyze UI', 'Assessment workflow', 'JSON exports', 'API quota when billing enabled']
    },
    ...extra
  };
}

function createRequireSubscription(options = {}) {
  const { consumeQuota = false } = options;

  return async function requireSubscription(req, res, next) {
    const bypassEmail = normalizeEmail(process.env.SIMPLEBEACON_BYPASS_EMAIL);
    const email = normalizeEmail(extractEmail(req));

    if (bypassEmail && email === bypassEmail) {
      req.simplebeaconSubscription = { tier: 'paid', subscriptionActive: true, bypass: true };
      return next();
    }

    if (!isMonetizationEnabled()) {
      if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true') {
        return next();
      }
      return res.status(403).json(upgradePayload({
        email: email || null,
        message: 'Cloud Teams requires a subscription. Community tier is CLI-only (local scans).'
      }));
    }

    const token = extractApiToken(req);
    if (token) {
      const byToken = await getSubscriptionByApiToken(token);
      if (byToken?.subscriptionActive) {
        if (consumeQuota) {
          const usage = await consumeApiCall(token);
          if (!usage.allowed) {
            return res.status(429).json(upgradePayload({
              error: usage.reason === 'rate_limit' ? 'rate_limit_exceeded' : 'subscription_required',
              message: usage.reason === 'rate_limit'
                ? `API limit reached (${usage.limit}/month). Resets ${usage.periodStart}.`
                : upgradePayload().message,
              limit: usage.limit,
              remaining: usage.remaining ?? 0
            }));
          }
          req.simplebeaconUsage = usage;
        }
        req.simplebeaconSubscription = publicSubscriptionStatus(byToken);
        return next();
      }
    }

    if (email) {
      const byEmail = await getSubscriptionByEmail(email);
      if (byEmail?.subscriptionActive) {
        req.simplebeaconSubscription = publicSubscriptionStatus(byEmail);
        return next();
      }
    }

    return res.status(403).json(upgradePayload({ email: email || null }));
  };
}

function isPaidDashboardView(view) {
  return PAID_VIEWS.has(view);
}

module.exports = {
  createRequireSubscription,
  extractApiToken,
  extractEmail,
  isPaidDashboardView,
  upgradePayload
};
