'use strict';

/**
 * Tenant Network Isolation Middleware
 *
 * Enforces tenant network boundaries at the Express ingress layer, before
 * route handlers are reached. This middleware:
 *
 *   1. Extracts tenantId from the request (header, query, body, JWT org claim)
 *   2. Validates tenantId against a configurable tenant registry (allowlist)
 *   3. Rejects requests with missing or unknown tenantId with 403
 *      TENANT_NETWORK_ISOLATION_VIOLATION
 *   4. Attaches req.tenantId and req.tenantNetworkScope for downstream use
 *   5. Logs isolation violations to SIEM with tenant context
 *   6. Enforces per-tenant request rate limiting (separate from global limit)
 *
 * Security invariants:
 *   - Fail-closed: missing tenantId → 403 (not 'default')
 *   - Admin bypass: users with admin:all permission can cross tenant boundaries
 *   - Health endpoints and public routes are exempt via bypass list
 *   - Per-tenant rate limits are independent — noisy tenants cannot exhaust
 *     the rate limit for other tenants
 *
 * @module server/middleware/tenant-network-isolation
 */

const DEFAULT_BYPASS_PATHS = new Set([
  '/health',
  '/api/health',
  '/api/status',
  '/favicon.ico',
  '/',
  '/dashboard',
  '/simplebeacon-dashboard',
]);

const DEFAULT_TENANT_RATE_LIMIT = 100; // requests per window
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Create a tenant network isolation middleware.
 *
 * @param {object} options
 * @param {Set<string>|string[]} [options.allowedTenants] — Tenant allowlist. If not provided, all non-empty tenantIds are allowed.
 * @param {Set<string>|string[]} [options.bypassPaths] — Paths that skip tenant validation
 * @param {number} [options.tenantRateLimit] — Max requests per tenant per window (default 100)
 * @param {number} [options.rateLimitWindowMs] — Rate limit window in ms (default 60000)
 * @param {function} [options.siemHook] — Callback for SIEM event logging (event) => void
 * @param {function} [options.adminCheck] — Callback to check admin permission (req) => boolean
 * @returns {function} Express middleware
 */
function createTenantNetworkIsolation(options = {}) {
  const allowedTenants = options.allowedTenants
    ? new Set(Array.isArray(options.allowedTenants) ? options.allowedTenants : [...options.allowedTenants])
    : null; // null = allow all non-empty
  const bypassPaths = options.bypassPaths
    ? new Set(Array.isArray(options.bypassPaths) ? options.bypassPaths : [...options.bypassPaths])
    : DEFAULT_BYPASS_PATHS;
  const tenantRateLimit = options.tenantRateLimit || DEFAULT_TENANT_RATE_LIMIT;
  const rateLimitWindowMs = options.rateLimitWindowMs || DEFAULT_RATE_LIMIT_WINDOW_MS;
  const siemHook = typeof options.siemHook === 'function' ? options.siemHook : null;
  const adminCheck = typeof options.adminCheck === 'function' ? options.adminCheck : null;

  // Per-tenant rate limit state: tenantId -> { count, windowStart }
  const _tenantRateBuckets = new Map();

  function _checkTenantRateLimit(tenantId) {
    const now = Date.now();
    let bucket = _tenantRateBuckets.get(tenantId);
    if (!bucket || now - bucket.windowStart >= rateLimitWindowMs) {
      bucket = { count: 0, windowStart: now };
      _tenantRateBuckets.set(tenantId, bucket);
    }
    bucket.count += 1;
    return bucket.count <= tenantRateLimit;
  }

  function _logViolation(violation) {
    if (siemHook) {
      try {
        siemHook({
          siemSeverity: 'HIGH',
          siemCategory: 'TENANT_NETWORK_ISOLATION_VIOLATION',
          siemSource: 'tenant-network-isolation-middleware',
          context: violation,
        });
      } catch { /* fail-silent */ }
    }
  }

  function _extractTenantId(req) {
    // Priority: header > query > body > JWT org claim > resolvedOrgId
    return (
      req.headers['x-tenant-id'] ||
      req.headers['x-org-id'] ||
      req.query?.orgId ||
      req.query?.tenantId ||
      req.body?.orgId ||
      req.body?.tenantId ||
      req.user?.orgId ||
      req.user?.workspaceId ||
      req.resolvedOrgId ||
      null
    );
  }

  return function tenantNetworkIsolationMiddleware(req, res, next) {
    // Bypass for health and public routes
    if (bypassPaths.has(req.path)) {
      return next();
    }

    const tenantId = _extractTenantId(req);

    // Fail-closed: missing tenantId
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      const violation = {
        reason: 'missing_tenant_id',
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket?.remoteAddress,
        timestamp: new Date().toISOString(),
      };
      _logViolation(violation);
      return res.status(403).json({
        success: false,
        error: 'TENANT_NETWORK_ISOLATION_VIOLATION',
        message: 'Tenant identifier required for network access',
      });
    }

    const normalizedTenantId = tenantId.trim();

    // Validate against allowlist if configured
    if (allowedTenants && !allowedTenants.has(normalizedTenantId)) {
      const violation = {
        reason: 'unknown_tenant',
        tenantId: normalizedTenantId,
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket?.remoteAddress,
        timestamp: new Date().toISOString(),
      };
      _logViolation(violation);
      return res.status(403).json({
        success: false,
        error: 'TENANT_NETWORK_ISOLATION_VIOLATION',
        message: 'Tenant not authorized for network access',
      });
    }

    // Admin bypass — skip per-tenant rate limit but still attach tenantId
    if (adminCheck && adminCheck(req)) {
      req.tenantId = normalizedTenantId;
      req.tenantNetworkScope = 'admin';
      return next();
    }

    // Per-tenant rate limiting
    if (!_checkTenantRateLimit(normalizedTenantId)) {
      const violation = {
        reason: 'tenant_rate_limit_exceeded',
        tenantId: normalizedTenantId,
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket?.remoteAddress,
        timestamp: new Date().toISOString(),
      };
      _logViolation(violation);
      return res.status(429).json({
        success: false,
        error: 'TENANT_RATE_LIMIT_EXCEEDED',
        message: 'Tenant network rate limit exceeded',
        tenantId: normalizedTenantId,
      });
    }

    req.tenantId = normalizedTenantId;
    req.tenantNetworkScope = 'tenant';
    next();
  };
}

module.exports = {
  createTenantNetworkIsolation,
  DEFAULT_BYPASS_PATHS,
  DEFAULT_TENANT_RATE_LIMIT,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
};
