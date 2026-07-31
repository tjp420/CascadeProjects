'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:';

function resolveKey() {
  const envKey =
    process.env.SIMPLEBEACON_ENCRYPTION_KEY ||
    process.env.SIMPLEBEACON_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    null;

  if (envKey) {
    return crypto.createHash('sha256').update(String(envKey)).digest();
  }

  const keyPath = path.join(process.cwd(), '.simplebeacon', '.encryption-key');
  try {
    if (fs.existsSync(keyPath)) {
      return Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'hex');
    }
  } catch {
    // fall through to generate
  }
  const key = crypto.randomBytes(32);
  const dir = path.dirname(keyPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  return key;
}

let ENCRYPTION_KEY = resolveKey();

// ΓöÇΓöÇ Multi-key decryption support ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// After key rotation, data encrypted with the old key must still be decryptable.
// We try the active key first, then fall back to retired keys from the key rotation store.

let _decryptionKeys = null;

function getDecryptionKeys() {
  if (_decryptionKeys) return _decryptionKeys;
  try {
    const keyRotationStore = require('./key-rotation-store.cjs');
    const versions = keyRotationStore.getDecryptionKeys();
    _decryptionKeys = versions.map((v) => Buffer.from(v.keyHex, 'hex'));
  } catch {
    // key-rotation-store not available ΓÇö just use the current key
    _decryptionKeys = [];
  }
  return _decryptionKeys;
}

function refreshDecryptionKeys() {
  _decryptionKeys = null;
  getDecryptionKeys();
}

function refreshActiveKey() {
  try {
    const keyRotationStore = require('./key-rotation-store.cjs');
    const active = keyRotationStore.getActiveKeyBuffer();
    if (active) {
      ENCRYPTION_KEY = active;
      refreshDecryptionKeys();
    }
  } catch {
    // key-rotation-store not available ΓÇö keep current key
  }
}

function encrypt(plaintext) {
  if (!plaintext) return '';
  if (typeof plaintext !== 'string') plaintext = String(plaintext);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(stored) {
  if (!stored) return '';
  if (typeof stored !== 'string') return '';
  if (!stored.startsWith(PREFIX)) return stored;
  const parts = stored.split(':');
  if (parts.length !== 4) return '';

  const tryDecrypt = (key) => {
    try {
      const iv = Buffer.from(parts[1], 'hex');
      const tag = Buffer.from(parts[2], 'hex');
      const encrypted = Buffer.from(parts[3], 'hex');
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
    } catch {
      return null;
    }
  };

  // Try active key first
  const result = tryDecrypt(ENCRYPTION_KEY);
  if (result !== null) return result;

  // Fall back to retired keys for legacy data
  for (const oldKey of getDecryptionKeys()) {
    if (oldKey.equals(ENCRYPTION_KEY)) continue;
    const legacyResult = tryDecrypt(oldKey);
    if (legacyResult !== null) return legacyResult;
  }

  return '';
}

const SANDBOX_PREFIX = 'enc:sb:';

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function deriveOrgKey(orgId) {
  if (!orgId || typeof orgId !== 'string') {
    throw new TypeError('orgId must be a non-empty string');
  }

  if (process.env.HSM_PROVIDER) {
    try {
      const hsm = require('./hsm-vault.cjs');
      return hsm.deriveOrgKeyViaHsm(orgId);
    } catch {
      // HSM unavailable; fall through to local key
    }
  }

  const salt = Buffer.from(`sb:org:${orgId}`, 'utf8');
  return crypto.createHmac('sha256', ENCRYPTION_KEY).update(salt).digest();
}

function isOrgEncrypted(value) {
  return typeof value === 'string' && value.startsWith(SANDBOX_PREFIX);
}

function encryptForOrg(plaintext, orgId) {
  if (!plaintext) return '';
  if (typeof plaintext !== 'string') plaintext = String(plaintext);
  const key = deriveOrgKey(orgId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SANDBOX_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptForOrg(stored, orgId) {
  if (!stored || typeof stored !== 'string') return '';
  if (!stored.startsWith(SANDBOX_PREFIX)) return '';
  const payload = stored.slice(SANDBOX_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) return '';

  const tryDecrypt = (key) => {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
    } catch {
      return null;
    }
  };

  const key = deriveOrgKey(orgId);
  const result = tryDecrypt(key);
  return result !== null ? result : '';
}

function encryptObject(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null && !isEncrypted(result[field])) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

function decryptObject(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null && isEncrypted(result[field])) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}

function maskSecret(value) {
  if (!value) return '****';
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + 'ΓÇóΓÇóΓÇóΓÇó' + value.slice(-4);
}

// ── Deterministic Canonical Request Serializer ──────────────────────────────
//
// Produces a deterministic serialization of a JSON request payload by:
//   1. Recursively sorting object keys alphabetically
//   2. Normalizing whitespace (no pretty-printing)
//   3. Computing a SHA-256 fingerprint of the canonical string
//
// This enables:
//   - Request deduplication (same payload → same fingerprint)
//   - Replay detection (track seen fingerprints per org)
//   - Audit log integrity (log fingerprint alongside audit entry)
//   - Idempotency keys for agentic orchestration operations
//
// Usage:
//   const { canonical, fingerprint } = canonicalizeRequest(payload);
//   // canonical === '{"a":1,"b":{"c":2}}'
//   // fingerprint === 'sha256:abc123...'

/**
 * Recursively sort object keys alphabetically.
 * Arrays are preserved in order (not sorted), but their elements are
 * recursively canonicalized.
 * @param {*} value — Any JSON-serializable value
 * @returns {*} — Deep clone with sorted keys
 */
function _canonicalizeValue(value) {
  if (value === null) return null;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(_canonicalizeValue);
  }

  const sortedKeys = Object.keys(value).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = _canonicalizeValue(value[key]);
  }
  return result;
}

/**
 * Serialize a request payload into a deterministic canonical form and
 * compute its SHA-256 fingerprint.
 *
 * @param {object|*} payload — Any JSON-serializable value
 * @returns {{ canonical: string, fingerprint: string, hash: string }}
 *   - canonical: deterministic JSON string (sorted keys, no whitespace)
 *   - fingerprint: 'sha256:<hex>' prefix for easy identification
 *   - hash: raw hex digest (without prefix)
 */
function canonicalizeRequest(payload) {
  const canonicalized = _canonicalizeValue(payload);
  const canonical = JSON.stringify(canonicalized);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return {
    canonical,
    fingerprint: `sha256:${hash}`,
    hash,
  };
}

/**
 * In-memory replay detection store. Tracks seen fingerprints per org.
 * Uses a Map of orgId → Set of fingerprints. Auto-expires entries after
 * a configurable TTL to prevent unbounded growth.
 *
 * @param {object} [options]
 * @param {number} [options.ttlMs=300000] — TTL for fingerprint entries (5min default)
 * @param {number} [options.maxPerOrg=1000] — Max fingerprints per org
 * @returns {{ check, mark, clear, getStats }}
 */
function createReplayDetector(options = {}) {
  const ttlMs = options.ttlMs || 5 * 60 * 1000;
  const maxPerOrg = options.maxPerOrg || 1000;

  // Map of orgId → Map of fingerprint → timestamp
  const _store = new Map();
  let _totalChecked = 0;
  let _totalReplays = 0;
  let _totalExpired = 0;

  /**
   * Check if a fingerprint has been seen before for the given org.
   * Does NOT mark it — call mark() after successful processing.
   * @param {string} orgId
   * @param {string} fingerprint
   * @returns {{ isReplay: boolean, firstSeen: number|null }}
   */
  function check(orgId, fingerprint) {
    _totalChecked++;
    _cleanupOrg(orgId);

    const orgMap = _store.get(orgId);
    if (!orgMap) return { isReplay: false, firstSeen: null };

    const timestamp = orgMap.get(fingerprint);
    if (timestamp) {
      _totalReplays++;
      return { isReplay: true, firstSeen: timestamp };
    }
    return { isReplay: false, firstSeen: null };
  }

  /**
   * Mark a fingerprint as seen for the given org.
   * @param {string} orgId
   * @param {string} fingerprint
   */
  function mark(orgId, fingerprint) {
    if (!_store.has(orgId)) _store.set(orgId, new Map());
    const orgMap = _store.get(orgId);

    // Enforce max per org — evict oldest entries
    if (orgMap.size >= maxPerOrg) {
      const oldestKey = orgMap.keys().next().value;
      orgMap.delete(oldestKey);
      _totalExpired++;
    }

    orgMap.set(fingerprint, Date.now());
  }

  /**
   * Check and mark in one call. Returns isReplay status.
   * @param {string} orgId
   * @param {string} fingerprint
   * @returns {{ isReplay: boolean, firstSeen: number|null }}
   */
  function checkAndMark(orgId, fingerprint) {
    const result = check(orgId, fingerprint);
    if (!result.isReplay) {
      mark(orgId, fingerprint);
    }
    return result;
  }

  /**
   * Remove expired entries for a specific org.
   * @param {string} orgId
   * @returns {number} Number of expired entries removed
   */
  function _cleanupOrg(orgId) {
    const orgMap = _store.get(orgId);
    if (!orgMap) return 0;

    const now = Date.now();
    let expired = 0;
    for (const [fp, timestamp] of orgMap) {
      if (now - timestamp > ttlMs) {
        orgMap.delete(fp);
        expired++;
      }
    }

    if (orgMap.size === 0) {
      _store.delete(orgId);
    }

    _totalExpired += expired;
    return expired;
  }

  /**
   * Clear all fingerprints for an org (or all orgs if orgId omitted).
   * @param {string} [orgId]
   */
  function clear(orgId) {
    if (orgId) {
      _store.delete(orgId);
    } else {
      _store.clear();
    }
  }

  /**
   * Get replay detector stats.
   * @returns {{ orgCount: number, totalFingerprints: number, totalChecked: number, totalReplays: number, totalExpired: number, ttlMs: number, maxPerOrg: number }}
   */
  function getStats() {
    let totalFingerprints = 0;
    for (const orgMap of _store.values()) {
      totalFingerprints += orgMap.size;
    }
    return {
      orgCount: _store.size,
      totalFingerprints,
      totalChecked: _totalChecked,
      totalReplays: _totalReplays,
      totalExpired: _totalExpired,
      ttlMs,
      maxPerOrg,
    };
  }

  return { check, mark, checkAndMark, clear, getStats };
}

// ── Per-Directory Sandbox Isolation Keys ────────────────────────────────────

const DIRECTORY_PREFIX = 'enc:sb:dir:';

function isDirectoryEncrypted(value) {
  return typeof value === 'string' && value.startsWith(DIRECTORY_PREFIX);
}

function deriveDirectoryKey(orgId, directory) {
  if (!orgId || typeof orgId !== 'string') {
    throw new TypeError('orgId must be a non-empty string');
  }
  if (!directory || typeof directory !== 'string') {
    throw new TypeError('directory must be a non-empty string');
  }
  const salt = Buffer.from(`sb:dir:${orgId}:${directory}`, 'utf8');
  return crypto.createHmac('sha256', ENCRYPTION_KEY).update(salt).digest();
}

function directoryKeyFingerprint(orgId, directory) {
  const key = deriveDirectoryKey(orgId, directory);
  return crypto.createHash('sha256').update(key).digest('hex');
}

function encryptForDirectory(plaintext, orgId, directory) {
  if (!plaintext) return '';
  if (typeof plaintext !== 'string') plaintext = String(plaintext);
  const key = deriveDirectoryKey(orgId, directory);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${DIRECTORY_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptForDirectory(stored, orgId, directory) {
  if (!stored || typeof stored !== 'string') return '';
  if (!stored.startsWith(DIRECTORY_PREFIX)) return '';
  const payload = stored.slice(DIRECTORY_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) return '';

  const tryDecrypt = (key) => {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
    } catch {
      return null;
    }
  };

  const key = deriveDirectoryKey(orgId, directory);
  const result = tryDecrypt(key);
  return result !== null ? result : '';
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  deriveOrgKey,
  isOrgEncrypted,
  encryptForOrg,
  decryptForOrg,
  encryptObject,
  decryptObject,
  maskSecret,
  refreshActiveKey,
  refreshDecryptionKeys,
  canonicalizeRequest,
  createReplayDetector,
  deriveDirectoryKey,
  directoryKeyFingerprint,
  isDirectoryEncrypted,
  encryptForDirectory,
  decryptForDirectory,
  ALGO,
};
