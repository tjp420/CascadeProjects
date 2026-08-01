'use strict';

// Key Rotation Store — Zero-Downtime Master Key Rotation
//
// Manages a dual-key validation window during master key rotations:
//   - active: the current encryption key (used for all new encrypt() calls)
//   - previous: the retired key (kept for decryption fallback during grace window)
//   - rotatedAt: timestamp of the last rotation (for grace window enforcement)
//
// The existing decrypt() in crypto-utils.cjs already tries the active key
// first, then falls back to getDecryptionKeys(). This store populates that
// fallback set with the previous key during the grace window.
//
// Configuration:
//   KEY_ROTATION_GRACE_MS — grace window in ms (default: 172800000 = 48h)
//   KEY_ROTATION_STORE_PATH — path to persist rotation state (optional)

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GRACE_MS = parseInt(process.env.KEY_ROTATION_GRACE_MS, 10) || 48 * 60 * 60 * 1000;
const STORE_PATH = process.env.KEY_ROTATION_STORE_PATH || null;

// Stateful key ring — tracks active and previous master keys
let _keyRing = {
  active: null,    // Buffer (32 bytes)
  previous: null,  // Buffer (32 bytes) or null
  rotatedAt: null, // number (Date.now()) or null
};

/**
 * Initialize the key ring from the current ENCRYPTION_KEY.
 * Called lazily on first access if active key is not set.
 * @param {Buffer} currentKey — The current ENCRYPTION_KEY buffer
 */
function initKeyRing(currentKey) {
  if (!_keyRing.active && currentKey) {
    _keyRing.active = currentKey;
  }
}

/**
 * Get the active key as a Buffer.
 * @returns {Buffer|null} 32-byte active key, or null if not initialized
 */
function getActiveKeyBuffer() {
  return _keyRing.active;
}

/**
 * Get all keys valid for decryption (active + previous if within grace).
 * @returns {Array<{ keyHex: string }>} Array of key version objects
 */
function getDecryptionKeys() {
  const keys = [];
  if (_keyRing.active) {
    keys.push({ keyHex: _keyRing.active.toString('hex') });
  }
  // Include previous key only if within the grace window
  if (_keyRing.previous && _keyRing.rotatedAt) {
    const elapsed = Date.now() - _keyRing.rotatedAt;
    if (elapsed < GRACE_MS) {
      keys.push({ keyHex: _keyRing.previous.toString('hex') });
    }
  }
  return keys;
}

/**
 * Rotate the master key. The current active key becomes the previous key,
 * and the new key becomes active. The grace window starts from this moment.
 * @param {string|Buffer} newKeyRaw — High-entropy master key (string or Buffer)
 * @param {number} [graceMs] — Override grace window for this rotation
 * @throws {TypeError} if newKeyRaw is missing or too short
 */
function rotateKey(newKeyRaw, graceMs) {
  if (!newKeyRaw) {
    throw new TypeError('Key rotation requires a high-entropy master key');
  }

  // Convert string input to a 32-byte key via SHA-256
  let newKey;
  if (Buffer.isBuffer(newKeyRaw)) {
    if (newKeyRaw.length < 32) {
      throw new TypeError('Key rotation requires at least 32 bytes of entropy');
    }
    newKey = crypto.createHash('sha256').update(newKeyRaw).digest();
  } else if (typeof newKeyRaw === 'string') {
    if (newKeyRaw.length < 32) {
      throw new TypeError('Key rotation requires at least 32 characters of entropy');
    }
    newKey = crypto.createHash('sha256').update(newKeyRaw).digest();
  } else {
    throw new TypeError('Key rotation requires a string or Buffer key');
  }

  // Transition keys down the ring
  _keyRing.previous = _keyRing.active;
  _keyRing.active = newKey;
  _keyRing.rotatedAt = Date.now();

  // Override grace window if specified for this rotation
  if (graceMs && Number.isFinite(graceMs)) {
    _keyRing._graceOverride = graceMs;
  }

  persistState();
}

/**
 * Check if the grace window has expired and the previous key should be dropped.
 * @param {boolean} [force] — If true, purge regardless of grace window
 * @returns {boolean} true if previous key was purged
 */
function purgeExpiredKeys(force) {
  if (!_keyRing.previous || !_keyRing.rotatedAt) return false;
  if (!force) {
    const grace = _keyRing._graceOverride || GRACE_MS;
    const elapsed = Date.now() - _keyRing.rotatedAt;
    if (elapsed < grace) return false;
  }
  _keyRing.previous = null;
  _keyRing.rotatedAt = null;
  _keyRing._graceOverride = null;
  persistState();
  return true;
}

/**
 * Get the current rotation status for administrative monitoring.
 * Does NOT expose raw key material — only fingerprints.
 * @returns {{ hasActive: boolean, hasPrevious: boolean, rotatedAt: number|null, graceMs: number, graceExpired: boolean, activeFingerprint: string|null, previousFingerprint: string|null }}
 */
function getRotationStatus() {
  const grace = _keyRing._graceOverride || GRACE_MS;
  const graceExpired = _keyRing.previous && _keyRing.rotatedAt
    ? (Date.now() - _keyRing.rotatedAt >= grace)
    : false;

  return {
    hasActive: !!_keyRing.active,
    hasPrevious: !!_keyRing.previous,
    rotatedAt: _keyRing.rotatedAt,
    graceMs: grace,
    graceExpired,
    activeFingerprint: _keyRing.active
      ? crypto.createHash('sha256').update(_keyRing.active).digest('hex').slice(0, 16)
      : null,
    previousFingerprint: _keyRing.previous
      ? crypto.createHash('sha256').update(_keyRing.previous).digest('hex').slice(0, 16)
      : null,
  };
}

/**
 * Re-key a single encrypted value from the previous key to the active key.
 * Uses crypto-utils decrypt/encrypt for the actual crypto operations.
 * @param {string} encryptedValue — Value encrypted with the old key
 * @param {function} decryptFn — decrypt function from crypto-utils
 * @param {function} encryptFn — encrypt function from crypto-utils
 * @returns {{ migrated: boolean, newValue: string|null }}
 */
function reKeyValue(encryptedValue, decryptFn, encryptFn) {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    return { migrated: false, newValue: null };
  }
  // Try to decrypt with current key first (already migrated)
  const decrypted = decryptFn(encryptedValue);
  if (!decrypted) {
    // Cannot decrypt — data may be corrupted or key is outside grace window
    return { migrated: false, newValue: null };
  }
  // Re-encrypt with the active key
  const reEncrypted = encryptFn(decrypted);
  return { migrated: true, newValue: reEncrypted };
}

/**
 * Re-key an entire store object: iterate all values, decrypt with fallback,
 * re-encrypt with active key. Returns the updated store.
 * @param {object} store — Object with entries to re-key
 * @param {function} decryptFn — decrypt function
 * @param {function} encryptFn — encrypt function
 * @param {function} [valueExtractor] — function(entry) → returns encrypted string or null
 * @param {function} [valueSetter] — function(entry, newValue) → sets encrypted string on entry
 * @returns {{ migrated: number, skipped: number, failed: number }}
 */
function reKeyStore(store, decryptFn, encryptFn, valueExtractor, valueSetter) {
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  if (!store || typeof store !== 'object') {
    return { migrated, skipped, failed };
  }

  const entries = Array.isArray(store) ? store : Object.values(store);
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      skipped++;
      continue;
    }
    const encryptedValue = valueExtractor ? valueExtractor(entry) : null;
    if (!encryptedValue) {
      skipped++;
      continue;
    }
    const result = reKeyValue(encryptedValue, decryptFn, encryptFn);
    if (result.migrated && result.newValue) {
      if (valueSetter) {
        valueSetter(entry, result.newValue);
      }
      migrated++;
    } else {
      failed++;
    }
  }

  return { migrated, skipped, failed };
}

/**
 * Persist rotation state to disk (if STORE_PATH is configured).
 * Only saves fingerprints and metadata — never the raw key material.
 */
function persistState() {
  if (!STORE_PATH) return;
  try {
    const state = {
      rotatedAt: _keyRing.rotatedAt,
      graceOverride: _keyRing._graceOverride || null,
      activeFingerprint: _keyRing.active
        ? crypto.createHash('sha256').update(_keyRing.active).digest('hex')
        : null,
    };
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Persistence is best-effort — don't block rotation on disk errors
  }
}

/**
 * Reset the key ring to a clean state (for testing).
 * @param {Buffer} [activeKey] — Optional key to set as active
 */
function _reset(activeKey) {
  _keyRing = {
    active: activeKey || null,
    previous: null,
    rotatedAt: null,
    _graceOverride: null,
  };
}

module.exports = {
  initKeyRing,
  getActiveKeyBuffer,
  getDecryptionKeys,
  rotateKey,
  purgeExpiredKeys,
  getRotationStatus,
  reKeyValue,
  reKeyStore,
  _reset,
};
