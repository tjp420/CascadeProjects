/**
 * Token Rotation Service
 *
 * Phase 3 Enterprise: JWT access token rotation with opaque refresh tokens.
 * Features:
 *   - Short-lived access tokens (15m default)
 *   - Opaque refresh tokens stored in DB or in-memory fallback
 *   - Automatic reuse detection with family revocation
 *   - Access token blocklisting for explicit logout
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('./app-logger.cjs');
const { jwtConfig, refreshConfig } = require('../middleware/auth.cjs');

// In-memory fallback stores (used when PostgreSQL is unavailable)
const _refreshStore = new Map();      // tokenHash -> tokenRecord
const _blacklistStore = new Map();    // tokenHash -> expiryTimestamp
const _familyStore = new Map();       // familyId -> { userId, revoked }

const USE_DB = process.env.ENABLE_DATABASE === 'true' || process.env.DATABASE_URL;

// Token hashing helper
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate opaque refresh token (256-bit random)
function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate access token (JWT)
function generateAccessToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    expiresIn: jwtConfig.expiresIn
  });
}

// Verify access token (JWT)
function verifyAccessToken(token) {
  return jwt.verify(token, jwtConfig.secret, {
    algorithms: [jwtConfig.algorithm],
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  });
}

// Verify refresh token (JWT wrapper for refresh tokens)
function verifyRefreshToken(token) {
  return jwt.verify(token, refreshConfig.secret, {
    algorithms: [refreshConfig.algorithm],
    issuer: refreshConfig.issuer,
    audience: refreshConfig.audience
  });
}

/**
 * Issue a new refresh token and store it.
 * @param {string} userId
 * @param {Object} options
 * @returns {Promise<Object>} { refreshToken, tokenHash, expiresAt }
 */
async function issueRefreshToken(userId, options = {}) {
  const family = options.family || crypto.randomUUID();
  const parentId = options.parentId || null;
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ms(refreshConfig.expiresIn));

  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      await query(
        `INSERT INTO refresh_tokens
         (user_id, token_hash, token_family, parent_token_id, device_fingerprint, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, tokenHash, family, parentId, options.deviceFingerprint || null, options.ipAddress || null, expiresAt]
      );
    } catch (err) {
      logger.warn('[token-service] DB insert failed, falling back to memory:', err.message);
      _refreshStore.set(tokenHash, {
        userId, tokenHash, tokenFamily: family, parentTokenId: parentId,
        deviceFingerprint: options.deviceFingerprint, ipAddress: options.ipAddress,
        expiresAt, consumedAt: null, revoked: false, createdAt: new Date()
      });
    }
  } else {
    _refreshStore.set(tokenHash, {
      userId, tokenHash, tokenFamily: family, parentTokenId: parentId,
      deviceFingerprint: options.deviceFingerprint, ipAddress: options.ipAddress,
      expiresAt, consumedAt: null, revoked: false, createdAt: new Date()
    });
  }

  return { refreshToken: token, tokenHash, expiresAt, family };
}

/**
 * Rotate a refresh token (consume old, issue new).
 * Detects reuse attacks and revokes the entire family if a consumed token is reused.
 * @param {string} refreshToken
 * @param {Object} options
 * @returns {Promise<Object>} { newRefreshToken, newAccessToken, family } or throws
 */
async function rotateRefreshToken(refreshToken, options = {}) {
  const tokenHash = hashToken(refreshToken);

  let record;
  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      const result = await query(
        `SELECT id, user_id, token_family, parent_token_id, consumed_at, revoked, expires_at
         FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash]
      );
      record = result.rows[0] || null;
    } catch (err) {
      logger.warn('[token-service] DB lookup failed, falling back to memory:', err.message);
      record = _refreshStore.get(tokenHash) || null;
    }
  } else {
    record = _refreshStore.get(tokenHash) || null;
  }

  if (!record) {
    throw Object.assign(new Error('Refresh token not found'), { statusCode: 401, code: 'TOKEN_NOT_FOUND' });
  }

  const now = new Date();
  const expiresAt = new Date(record.expires_at || record.expiresAt);
  if (expiresAt < now) {
    throw Object.assign(new Error('Refresh token expired'), { statusCode: 401, code: 'TOKEN_EXPIRED' });
  }
  if (record.revoked) {
    throw Object.assign(new Error('Refresh token revoked'), { statusCode: 401, code: 'TOKEN_REVOKED' });
  }

  const family = record.token_family || record.tokenFamily;

  // Reuse detection: if already consumed, revoke entire family
  if (record.consumed_at || record.consumedAt) {
    logger.warn('[token-service] Reuse detected — revoking entire family', { family, userId: record.user_id || record.userId });
    await revokeTokenFamily(family, 'reuse_detected');
    throw Object.assign(new Error('Token reuse detected — session terminated'), { statusCode: 401, code: 'TOKEN_REUSE' });
  }

  // Mark current token as consumed
  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      await query(
        `UPDATE refresh_tokens SET consumed_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );
    } catch (err) {
      logger.warn('[token-service] DB consume failed, updating memory:', err.message);
      const mem = _refreshStore.get(tokenHash);
      if (mem) mem.consumedAt = now;
    }
  } else {
    const mem = _refreshStore.get(tokenHash);
    if (mem) mem.consumedAt = now;
  }

  // Issue new tokens
  const userId = record.user_id || record.userId;
  const newRefresh = await issueRefreshToken(userId, {
    family,
    parentId: record.id || null,
    deviceFingerprint: options.deviceFingerprint,
    ipAddress: options.ipAddress
  });

  const accessPayload = { userId, ...options.accessPayload };
  const newAccess = generateAccessToken(accessPayload);

  return {
    newRefreshToken: newRefresh.refreshToken,
    newAccessToken: newAccess,
    family,
    expiresAt: newRefresh.expiresAt
  };
}

/**
 * Revoke an entire token family (used on reuse detection or global logout).
 * @param {string} family
 * @param {string} reason
 */
async function revokeTokenFamily(family, reason = 'manual_revoke') {
  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      await query(
        `UPDATE refresh_tokens SET revoked = TRUE, revoked_reason = $2, revoked_at = NOW()
         WHERE token_family = $1 AND revoked = FALSE`,
        [family, reason]
      );
    } catch (err) {
      logger.warn('[token-service] DB family revoke failed, updating memory:', err.message);
      for (const [, rec] of _refreshStore) {
        if (rec.tokenFamily === family) { rec.revoked = true; rec.revokedReason = reason; }
      }
    }
  } else {
    for (const [, rec] of _refreshStore) {
      if (rec.tokenFamily === family) { rec.revoked = true; rec.revokedReason = reason; }
    }
  }
}

/**
 * Revoke a single refresh token.
 * @param {string} tokenHash
 * @param {string} reason
 */
async function revokeRefreshToken(tokenHash, reason = 'logout') {
  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      await query(
        `UPDATE refresh_tokens SET revoked = TRUE, revoked_reason = $2, revoked_at = NOW()
         WHERE token_hash = $1`,
        [tokenHash, reason]
      );
    } catch (err) {
      logger.warn('[token-service] DB single revoke failed, updating memory:', err.message);
      const mem = _refreshStore.get(tokenHash);
      if (mem) { mem.revoked = true; mem.revokedReason = reason; }
    }
  } else {
    const mem = _refreshStore.get(tokenHash);
    if (mem) { mem.revoked = true; mem.revokedReason = reason; }
  }
}

/**
 * Blacklist an access token (used on logout).
 * Stores until the token's natural expiry.
 * @param {string} accessToken
 * @param {string} reason
 */
async function blacklistAccessToken(accessToken, reason = 'logout') {
  let decoded;
  try {
    decoded = jwt.decode(accessToken);
  } catch {
    return;
  }
  if (!decoded || !decoded.exp) return;

  const tokenHash = hashToken(accessToken);
  const expiresAt = new Date(decoded.exp * 1000);

  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      await query(
        `INSERT INTO blacklisted_tokens (token_hash, token_jti, user_id, expires_at, reason)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, decoded.jti || null, decoded.userId || decoded.sub || null, expiresAt, reason]
      );
    } catch (err) {
      logger.warn('[token-service] DB blacklist failed, updating memory:', err.message);
      _blacklistStore.set(tokenHash, expiresAt);
    }
  } else {
    _blacklistStore.set(tokenHash, expiresAt);
  }
}

/**
 * Check if an access token is blacklisted.
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
async function isAccessTokenBlacklisted(accessToken) {
  const tokenHash = hashToken(accessToken);

  if (USE_DB) {
    try {
      const { query } = require('./database-adapter.cjs');
      const result = await query(
        `SELECT 1 FROM blacklisted_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash]
      );
      return result.rows.length > 0;
    } catch (err) {
      logger.warn('[token-service] DB blacklist check failed, checking memory:', err.message);
      return _blacklistStore.has(tokenHash);
    }
  }
  return _blacklistStore.has(tokenHash);
}

// Cleanup expired entries from memory (run periodically)
function cleanupMemoryStores() {
  const now = Date.now();
  for (const [hash, rec] of _refreshStore) {
    if (new Date(rec.expiresAt).getTime() < now - 86400000) _refreshStore.delete(hash);
  }
  for (const [hash, expiry] of _blacklistStore) {
    if (expiry.getTime() < now) _blacklistStore.delete(hash);
  }
}

// Helper: convert human-readable duration to ms
function ms(val) {
  if (typeof val === 'number') return val;
  const m = String(val).match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || 'ms').toLowerCase();
  const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, y: 31536000000 };
  return n * (mult[u] || 1);
}

// Schedule periodic memory cleanup
setInterval(cleanupMemoryStores, 600000); // every 10 minutes

module.exports = {
  hashToken,
  generateOpaqueToken,
  generateAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeRefreshToken,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
  cleanupMemoryStores
};
