'use strict';

/**
 * Rate-Limit Quota Middleware — Express middleware that enforces
 * token bucket quotas by user, organization, and model tier.
 *
 * @module rate-limit-quota-middleware
 */

const quotaStore = require('../lib/rate-limit-quota-store.cjs');
const logger = require('../lib/app-logger.cjs');

/**
 * Create a rate-limit quota middleware.
 * @param {object} options
 * @param {string} options.scope — 'user', 'org', or 'tier' (default: 'user')
 * @param {number} options.cost — token cost per request (default: 1)
 * @param {function} [options.keyResolver] — function(req) => key string
 * @param {boolean} [options.checkAll] — check user + org + tier together
 * @returns {function} Express middleware
 */
function createQuotaMiddleware(options = {}) {
  const scope = options.scope || 'user';
  const cost = options.cost || 1;
  const keyResolver = options.keyResolver || ((req) => {
    if (scope === 'user') return req.user?.email || req.ip || 'anonymous';
    if (scope === 'org') return req.user?.orgId || 'default';
    return 'default';
  });
  const checkAll = options.checkAll || false;

  return async (req, res, next) => {
    try {
      if (checkAll) {
        const contexts = {};
        if (req.user?.email) contexts.user = req.user.email;
        if (req.user?.orgId) contexts.org = req.user.orgId;
        if (req.body?.tierId || req.routingDecision?.tier?.id) {
          contexts.tier = req.body.tierId || req.routingDecision?.tier?.id;
        }

        if (Object.keys(contexts).length === 0) {
          // No context to check — allow
          return next();
        }

        const result = quotaStore.checkQuotas(contexts, cost);
        if (!result.allowed) {
          const detail = result.details[0];
          res.setHeader('X-RateLimit-Scope', detail.scope);
          res.setHeader('X-RateLimit-Key', detail.key);
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', String(detail.resetInMs));
          return res.status(429).json({
            success: false,
            error: 'quota_exceeded',
            message: result.reason,
            retryAfterMs: detail.resetInMs,
          });
        }

        // Add quota info to response headers
        for (const d of result.details) {
          res.setHeader(`X-RateLimit-${d.scope}-Remaining`, String(d.remaining));
        }
        res.setHeader('X-RateLimit-Cost', String(result.cost));
        return next();
      }

      const key = keyResolver(req);
      const result = quotaStore.checkQuota(scope, key, cost);

      res.setHeader('X-RateLimit-Scope', scope);
      res.setHeader('X-RateLimit-Key', key);
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetInMs));

      if (!result.allowed) {
        logger.info(`[Quota] Blocked ${scope}:${key} — remaining: ${result.remaining}`);
        return res.status(429).json({
          success: false,
          error: 'quota_exceeded',
          message: `Rate limit exceeded for ${scope}:${key}`,
          retryAfterMs: result.resetInMs,
        });
      }

      next();
    } catch (err) {
      logger.warn('[Quota] Middleware error:', err.message);
      // Never block on quota errors
      next();
    }
  };
}

module.exports = { createQuotaMiddleware };
