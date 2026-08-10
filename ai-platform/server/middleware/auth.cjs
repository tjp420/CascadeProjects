/**
 * Authentication and Authorization Middleware
 *
 * REFACTORED: Previously 883 lines. Now a thin facade over lib/auth/ sub-modules:
 *   - trust-levels.js    — trust level config, authorization middleware
 *   - token-service.js   — JWT generation, verification, first-use expiry
 *   - sandbox-service.js — sandbox token detection and rate limiting
 *   - mfa-service.js     — MFA secret generation and verification
 *   - device-service.js  — device fingerprinting and trust
 *   - audit-service.js   — auth audit logging
 *   - password-service.js — bcrypt hashing/verification
 *   - vault-operator.js  — vault operator session helpers
 *   - login-service.js   — login and token refresh handlers
 *
 * Backward compatible: all previous exports are re-exported.
 */

const { toClientError } = require('../../shared-utils/index.cjs');
const createError = require('http-errors');
const { jwtConfig } = require('../lib/jwt-config.cjs');
const { recordActivity } = require('../lib/session-activity.cjs');

const {
  trustLevels,
  getTrustLevelRateLimit,
  evaluateTrustLevel,
  authorize,
  requireTrustLevel,
  canAccessDashboardWrite,
  requireOwnership,
  requirePrivateAnalysis
} = require('../lib/auth/trust-levels.cjs');

const {
  generateToken,
  verifyToken,
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken
} = require('../lib/auth/token-service.cjs');

const {
  isSandboxToken,
  recordSandboxRequest,
  getSandboxLimitHeaders
} = require('../lib/auth/sandbox-service.cjs');

const {
  verifyMFA,
  generateMFASecret,
  verifyMFAToken
} = require('../lib/auth/mfa-service.cjs');

const {
  generateDeviceFingerprint,
  trustDevice,
  verifyDeviceTrust
} = require('../lib/auth/device-service.cjs');

const {
  isAuthDebugEnabled,
  authLog,
  authWarn,
  shouldWriteAuditEvents,
  auditAuth
} = require('../lib/auth/audit-service.cjs');

const {
  hashPassword,
  verifyPassword
} = require('../lib/auth/password-service.cjs');

const {
  applyVaultOperatorUser,
  vaultOperatorSessionActive
} = require('../lib/auth/vault-operator.cjs');

const {
  handleLogin,
  handleTokenRefresh
} = require('../lib/auth/login-service.cjs');

/**
 * Resolve authentication for a request.
 * Handles dev bypass, vault operator, Bearer extraction, token verification,
 * first-use expiry, sandbox rate-limiting, and req.user construction.
 * @returns {{ user?: object, error?: Error, sandbox?: boolean }}
 */
function parseCookieHeader(req) {
  if (req.cookies && typeof req.cookies === 'object') {
    return req.cookies;
  }
  const raw = req.headers?.cookie;
  if (!raw || typeof raw !== 'string') return {};
  const cookies = {};
  for (const pair of raw.split(';')) {
    const [rawName, ...rawValue] = pair.split('=');
    if (!rawName) continue;
    const name = decodeURIComponent(rawName.trim());
    const value = rawValue.length > 0 ? decodeURIComponent(rawValue.join('=').trim()) : '';
    cookies[name] = value;
  }
  return cookies;
}

function extractTokenFromCookies(req) {
  const cookies = parseCookieHeader(req);
  const rawCookie = cookies.cascadeAuthToken;
  if (rawCookie && typeof rawCookie === 'string') return rawCookie;
  const accessTokenCookie = cookies.access_token;
  if (accessTokenCookie && typeof accessTokenCookie === 'string') {
    try {
      const decoded = decodeURIComponent(accessTokenCookie);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.token === 'string') return parsed.token;
    } catch {
      // ignore malformed cookie
    }
  }
  return null;
}

async function tryToken(token, res) {
  if (!token) {
    return { error: createError(401, 'Token required') };
  }
  const decoded = await verifyToken(token);

  recordTokenFirstUse(decoded.jti);
  if (isTokenExpiredByFirstUse(decoded.jti)) {
    invalidateToken(decoded.jti);
    return { error: createError(401, 'Token expired') };
  }

  const sandbox = isSandboxToken(decoded);
  if (sandbox) {
    const { allowed } = recordSandboxRequest(decoded.jti);
    const headers = getSandboxLimitHeaders(decoded.jti);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    if (!allowed) {
      return { error: createError(429, 'Sandbox daily limit reached') };
    }
  }

  const user = {
    id: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    trustLevel: decoded.trustLevel,
    permissions: decoded.permissions,
    role: decoded.role || '',
    features: Array.isArray(decoded.features) ? decoded.features : [],
    tokenId: decoded.jti,
    sessionId: decoded.sessionId,
    isSandbox: sandbox,
    tier: decoded.tier || decoded.plan || ''
  };

  return { user, sandbox };
}

async function resolveAuth(req, res) {
  if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === '1') {
    return {
      user: {
        id: 'dev-user-01',
        email: 'dev@localhost',
        name: 'Local Developer',
        role: 'admin',
        trustLevel: 'platinum',
        permissions: ['read:all', 'write:all', 'admin:all']
      }
    };
  }

  if (vaultOperatorSessionActive(req)) {
    applyVaultOperatorUser(req);
    return { user: req.user };
  }

  const headerToken = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
    ? req.headers.authorization.substring(7)
    : '';
  const cookieToken = extractTokenFromCookies(req);

  const attempts = [];
  if (headerToken) attempts.push({ label: 'bearer', token: headerToken });
  if (cookieToken) attempts.push({ label: 'cookie', token: cookieToken });

  const errors = [];
  for (const { label, token } of attempts) {
    try {
      const result = await tryToken(token, res);
      if (!result.error) return result;
      errors.push(`${label}: ${result.error.message}`);
    } catch (err) {
      errors.push(`${label}: ${err.message || 'token error'}`);
    }
  }

  if (attempts.length === 0) {
    return { error: createError(401, 'Authorization required') };
  }
  return { error: createError(401, errors.join('; ') || 'Invalid or expired token') };
}

// Primary authentication middleware — kept in the middleware layer
const authenticate = async (req, res, next) => {
  try {
    const { user, error } = await resolveAuth(req, res);
    if (error) throw error;

    req.user = user;
    recordActivity(user.id, user.email, user.name);
    authLog('[AUTH] User authenticated');
    next();
  } catch (error) {
    authWarn(`[AUTH] Authentication failed - ${req.method} ${req.originalUrl}`);
    next(error);
  }
};

/**
 * Middleware factory that requires the authenticated user to have write-heavy
 * dashboard privileges (team/paid tier, admin, or team_dashboard feature).
 * Use this on endpoints that trigger scans, mutate settings, exports, or billing.
 * Read-only audit/roadmap endpoints should use optionalAuthenticate instead.
 */
function requireDashboardWrite(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  if (!canAccessDashboardWrite(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Paid or team dashboard access required',
      requiredTier: 'silver',
      current: req.user.tier || req.user.plan || req.user.trustLevel || 'community'
    });
  }
  next();
}

const optionalAuthenticate = async (req, res, next) => {
  try {
    const { user, error } = await resolveAuth(req, res);
    if (!error) {
      req.user = user;
      recordActivity(user.id, user.email, user.name);
    } else {
      req.authError = error;
      authWarn(`[AUTH] Optional auth failed - ${req.method} ${req.originalUrl}: ${error.message}`);
    }
  } catch (error) {
    req.authError = error;
    authWarn(`[AUTH] Optional auth failed - ${req.method} ${req.originalUrl}: ${error.message}`);
  }
  return next();
};

module.exports = Object.freeze({
  generateToken,
  verifyToken,
  authenticate,
  optionalAuthenticate,
  requireDashboardWrite,
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken,
  authorize,
  requireTrustLevel,
  canAccessDashboardWrite,
  requireOwnership,
  requirePrivateAnalysis,
  getTrustLevelRateLimit,
  evaluateTrustLevel,
  auditAuth,
  handleLogin,
  handleTokenRefresh,
  verifyMFA,
  verifyDeviceTrust,
  generateDeviceFingerprint,
  trustDevice,
  generateMFASecret,
  verifyMFAToken,
  hashPassword,
  verifyPassword,
  trustLevels,
  jwtConfig,
  isSandboxToken,
  recordSandboxRequest,
  getSandboxLimitHeaders
});
