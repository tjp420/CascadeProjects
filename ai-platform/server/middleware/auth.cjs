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

const { toClientError } = require('../lib/client-error.cjs');
const createError = require('http-errors');
const { jwtConfig } = require('../lib/jwt-config.cjs');

const {
  trustLevels,
  getTrustLevelRateLimit,
  evaluateTrustLevel,
  authorize,
  requireTrustLevel
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
async function resolveAuth(req, res) {
  if (process.env.NODE_ENV === 'development') {
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

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { error: createError(401, 'Authorization header required') };
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;
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
    tokenId: decoded.jti,
    sessionId: decoded.sessionId,
    isSandbox: sandbox,
    tier: decoded.tier || decoded.plan || ''
  };

  return { user, sandbox };
}

// Primary authentication middleware — kept in the middleware layer
const authenticate = async (req, res, next) => {
  try {
    const { user, error } = await resolveAuth(req, res);
    if (error) throw error;

    req.user = user;
    authLog('[AUTH] User authenticated');
    next();
  } catch (error) {
    authWarn(`[AUTH] Authentication failed - ${req.method} ${req.originalUrl}`);
    next(error);
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const { user, error } = await resolveAuth(req, res);
    if (!error) {
      req.user = user;
    }
  } catch (error) {
    authWarn(`[AUTH] Optional auth failed - ${req.method} ${req.originalUrl}: ${error.message}`);
  }
  return next();
};

module.exports = Object.freeze({
  generateToken,
  verifyToken,
  authenticate,
  optionalAuthenticate,
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken,
  authorize,
  requireTrustLevel,
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
