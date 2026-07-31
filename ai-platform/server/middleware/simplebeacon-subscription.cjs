/**
 * Feature gating for Simplebeacon Cloud Teams tier (off unless SIMPLEBEACON_MONETIZATION_ENABLED=true).
 */

const {
  isMonetizationEnabled,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  consumeApiCall,
  publicSubscriptionStatus,
  normalizeEmail,
} = require('../lib/simplebeacon-subscription-store.cjs');
const { verifyLicenseToken } = require('../../packages/simplebeacon-cli/src/lib/license-token.cjs');

const PAID_VIEWS = new Set([
  'dashboard',
  'audit',
  'results',
  'analyze',
  'tools',
  'platform',
  'quality',
  'settings',
]);

const FREE_TIERS = new Set(['community', 'developer', 'sandbox', 'instant', 'free', '']);

/**
 * Extract api token.
 * @param {any} req
 * @returns {any}
 */
function extractApiToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return req.headers['x-simplebeacon-token'] || req.query.apiToken || null;
}

/**
 * Extract email.
 * @param {any} req
 * @returns {any}
 */
function extractEmail(req) {
  if (req.user?.email) return req.user.email;
  const headerEmail = req.headers['x-simplebeacon-email'];
  if (headerEmail) return headerEmail;
  if (req.query.email) return req.query.email;
  if (req.body?.email) return req.body.email;
  return null;
}

/**
 * Env flag.
 * @param {string} name
 * @returns {any}
 */
function envFlag(name) {
  return (
    String(process.env[name] || '')
      .trim()
      .toLowerCase() === 'true'
  );
}

/**
 * Resolve license secret.
 * Fails closed in production when the secret is not configured.
 * @returns {string|null}
 */
function resolveLicenseSecret() {
  const secret = String(process.env.SIMPLEBEACON_LICENSE_SECRET || '').trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: SIMPLEBEACON_LICENSE_SECRET environment variable is missing in production.'
    );
  }
  return null;
}

/**
 * Is internal dashboard mode.
 * @returns {any}
 */
function isInternalDashboardMode() {
  return envFlag('SIMPLEBEACON_INTERNAL_DASHBOARD') || process.env.NODE_ENV === 'development';
}

/**
 * Upgrade payload.
 * @param {any} extra
 * @returns {any}
 */
function upgradePayload(extra = {}) {
  return {
    error: 'subscription_required',
    message: 'Upgrade to Cloud Teams for dashboard and API access.',
    upgradeUrl: '/#/pricing',
    pricing: {
      free: ['CLI local scanning', 'Text/JSON reports', 'No hosted dashboard'],
      paid: [
        'Dashboard + scan history',
        'Compliance Audit + Analyze UI',
        'Assessment workflow',
        'JSON exports',
        'API quota when billing enabled',
      ],
    },
    ...extra,
  };
}

/**
 * Create require subscription.
 * @param {Object} options
 * @returns {any}
 */
function createRequireSubscription(options = {}) {
  const { consumeQuota = false, allowFree = false } = options;

  return async function requireSubscription(req, res, next) {
    const bypassEmail = normalizeEmail(process.env.SIMPLEBEACON_BYPASS_EMAIL);
    const email = normalizeEmail(extractEmail(req));

    if (bypassEmail && email === bypassEmail) {
      req.simplebeaconSubscription = { tier: 'paid', subscriptionActive: true, bypass: true };
      return next();
    }

    if (isInternalDashboardMode()) {
      req.simplebeaconSubscription = { tier: 'paid', subscriptionActive: true, internal: true };
      return next();
    }

    if (!isMonetizationEnabled()) {
      req.simplebeaconSubscription = {
        tier: 'community',
        subscriptionActive: false,
        community: true,
      };
      return next();
    }

    const token = extractApiToken(req);

    // --- Paid subscription check first ---
    if (token) {
      const byToken = await getSubscriptionByApiToken(token);
      if (byToken?.subscriptionActive) {
        if (consumeQuota) {
          const usage = await consumeApiCall(token);
          if (!usage.allowed) {
            return res.status(429).json(
              upgradePayload({
                error:
                  usage.reason === 'rate_limit' ? 'rate_limit_exceeded' : 'subscription_required',
                message:
                  usage.reason === 'rate_limit'
                    ? `API limit reached (${usage.limit}/month). Resets ${usage.periodStart}.`
                    : upgradePayload().message,
                limit: usage.limit,
                remaining: usage.remaining ?? 0,
              })
            );
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

    // --- Free tier read-only fallback ---
    if (allowFree && token) {
      const secret = resolveLicenseSecret();
      if (!secret) {
        return res
          .status(503)
          .json({
            error: 'license_secret_unconfigured',
            message: 'License validation is not configured.',
          });
      }
      const payload = verifyLicenseToken(token, secret);
      if (payload) {
        const tier = String(payload.tier || payload.product || 'community').toLowerCase();
        if (FREE_TIERS.has(tier)) {
          req.simplebeaconSubscription = {
            tier,
            subscriptionActive: false,
            readOnly: true,
            freeToken: true,
            scansRemaining: 0,
            apiRemaining: 0,
          };
          return next();
        }
      }
    }

    return res.status(403).json(upgradePayload({ email: email || null }));
  };
}

/**
 * Is paid dashboard view.
 * @param {any} view
 * @returns {any}
 */
function isPaidDashboardView(view) {
  return PAID_VIEWS.has(view);
}

module.exports = {
  createRequireSubscription,
  extractApiToken,
  extractEmail,
  isPaidDashboardView,
  upgradePayload,
};
