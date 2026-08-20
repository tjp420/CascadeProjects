/**
 * SimpleBeacon Enterprise API Keys — Generation, prefix extraction, hash verification.
 *
 * Key format: sb_live_<random-24-char-base58>  (production)
 *             sb_test_<random-24-char-base58>  (sandbox)
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("./db.cjs");

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const KEY_PREFIX_LENGTH = 12; // sb_live_abc...

function randomBase58(length) {
  let result = "";
  const bytes = crypto.randomBytes(length * 2);
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    const idx = bytes[i] % BASE58_ALPHABET.length;
    result += BASE58_ALPHABET[idx];
  }
  return result;
}

/**
 * Generate a new API key pair: { prefix, fullKey, keyHash }.
 * The caller must persist keyHash; fullKey is shown once.
 * @param {string} env  'live' | 'test'
 * @returns {{prefix:string, fullKey:string, keyHash:string}}
 */
async function generateApiKey(env = "live") {
  const prefix = `sb_${env}_`;
  const random = randomBase58(24);
  const fullKey = prefix + random;
  const keyHash = await bcrypt.hash(fullKey, 12);
  return { prefix: fullKey.slice(0, KEY_PREFIX_LENGTH), fullKey, keyHash };
}

/**
 * Verify an API key against the database.
 * @param {string} fullKey
 * @returns {Promise<{valid:boolean, keyRecord?:object}>}
 */
async function verifyApiKey(fullKey) {
  if (!fullKey || !fullKey.startsWith("sb_")) {
    return { valid: false };
  }
  const prefix = fullKey.slice(0, KEY_PREFIX_LENGTH);

  // Lookup by prefix (fast), then verify hash (slow)
  const rows = await db.query(
    `SELECT id, workspace_id, key_hash, role_id, scopes, rate_limit_per_minute,
                expires_at, revoked_at, last_used_at
         FROM api_keys
         WHERE key_prefix = $1`,
    [prefix],
  );

  for (const row of rows) {
    if (row.revoked_at) continue;
    if (row.expires_at && new Date(row.expires_at) < new Date()) continue;

    const match = await bcrypt.compare(fullKey, row.key_hash);
    if (match) {
      // Update last_used_at
      await db.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [
        row.id,
      ]);
      return { valid: true, keyRecord: row };
    }
  }
  return { valid: false };
}

/**
 * Express middleware: verify API key from `Authorization: Bearer sb_live_...` header.
 * Falls back to JWT auth if no API key format detected.
 * Attaches `req.apiKey = { keyRecord }` or `req.auth = { userId, role, workspaceId }`.
 */
async function requireApiKeyOrAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(sb_(live|test)_[a-zA-Z0-9]+)$/i);

  if (match) {
    const { valid, keyRecord } = await verifyApiKey(match[1]);
    if (!valid) {
      return res.status(401).json({ error: "Invalid or revoked API key" });
    }
    req.apiKey = { keyRecord };
    req.auth = {
      userId: null, // Service account — no user
      role: keyRecord.role_id
        ? (
            await db.get("SELECT name FROM roles WHERE id = $1", [
              keyRecord.role_id,
            ])
          )?.name
        : "viewer",
      workspaceId: keyRecord.workspace_id,
    };
    return next();
  }

  // Fall through to JWT auth
  const { requireAuth } = require("./auth.js");
  requireAuth(req, res, next);
}

module.exports = {
  generateApiKey,
  verifyApiKey,
  requireApiKeyOrAuth,
  KEY_PREFIX_LENGTH,
};
