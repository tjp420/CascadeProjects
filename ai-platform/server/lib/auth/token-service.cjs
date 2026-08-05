// simplebeacon-ignore memory-leak
'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const createError = require('http-errors');
const { jwtConfig } = require('../jwt-config.cjs');
const constants = require('../../config/constants.cjs');
const { trustLevels } = require('./trust-levels.cjs');
const { isAccessTokenBlacklisted } = require('../token-service.cjs');
const logger = require('../app-logger.cjs');
const { withZeroizedBuffer } = require('../crypto/zeroize.cjs');

const TOKEN_LIFETIME_MS = 24 * 60 * constants.ONE_MINUTE_MS;

// Token first-use tracking — expiry counts from first validation, not creation
const tokenFirstUse = new Map();

function recordTokenFirstUse(jti) {
  if (jti == null) return Date.now();
  if (!tokenFirstUse.has(jti)) {
    tokenFirstUse.set(jti, Date.now());
  }
  return tokenFirstUse.get(jti);
}

function isTokenExpiredByFirstUse(jti) {
  if (jti == null) return false;
  const firstUsed = tokenFirstUse.get(jti);
  if (!firstUsed) return false;
  return Date.now() - firstUsed > TOKEN_LIFETIME_MS;
}

function invalidateToken(jti) {
  if (jti == null) return;
  tokenFirstUse.delete(jti);
}

// Periodic cleanup of stale first-use records (every hour)
setInterval(() => {
  const cutoff = Date.now() - TOKEN_LIFETIME_MS;
  for (const [jti, firstUsed] of tokenFirstUse) {
    if (firstUsed < cutoff) {
      tokenFirstUse.delete(jti);
    }
  }
}, 60 * constants.ONE_MINUTE_MS).unref();

// Generate JWT token
function generateToken(user, options = {}) {
  if (!user || typeof user !== 'object') {
    throw new TypeError('generateToken requires a valid user object');
  }
  const levelKey = user.trustLevel || 'bronze';
  const levelConfig = trustLevels[levelKey] || trustLevels.bronze;
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    trustLevel: levelKey,
    permissions: levelConfig.permissions,
    role: user.role || '',
    features: Array.isArray(user.features) ? user.features : [],
    tier: user.tier || user.plan || '',
    iat: Math.floor(Date.now() / constants.MS_PER_SECOND),
    jti: (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'))
  };

  return jwt.sign(payload, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    expiresIn: options.expiresIn || jwtConfig.expiresIn
  });
}

// Verify JWT token. Always enforces issuer and audience claims.
// Token buffer is zeroized after verification (even on error).
async function verifyToken(token) {
  // Create a buffer copy of the token for zeroization after use.
  // jwt.verify() requires a string, so we pass the original but track
  // a buffer copy for scrubbing.
  const tokenBuf = Buffer.from(String(token), 'utf8');
  try {
    const blacklisted = await isAccessTokenBlacklisted(token);
    if (blacklisted) {
      throw createError(401, 'Token has been revoked');
    }
    return jwt.verify(token, jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });
  } catch (err) {
    if (err.status) throw err;
    throw createError(401, 'Invalid or expired token');
  } finally {
    // Zeroize the token buffer copy immediately after verification
    tokenBuf.fill(0);
  }
}

if (process.env.NODE_ENV !== 'test') {
  const secretFromEnv = Boolean(process.env.JWT_SECRET);
  logger.info('[token-service] JWT configuration loaded:', {
    algorithm: jwtConfig.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    expiresIn: jwtConfig.expiresIn,
    hasSecret: Boolean(jwtConfig.secret),
    secretSource: secretFromEnv ? 'env' : (jwtConfig.secret ? 'ephemeral' : 'none'),
    secretLength: jwtConfig.secret ? jwtConfig.secret.length : 0,
    secretFromEnv
  });
}

module.exports = {
  generateToken,
  verifyToken,
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken,
  TOKEN_LIFETIME_MS
};
