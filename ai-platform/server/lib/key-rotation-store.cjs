'use strict';

/**
 * Key Rotation Store — Manages encryption key versions, rotation history,
 * and active key tracking for the platform's AES-256-GCM encryption system.
 *
 * Key versions are stored in .simplebeacon/key-rotation.json with each
 * version containing: version number, key hash (for identification), key
 * material (hex), creation timestamp, and status (active|retired|revoked).
 *
 * The crypto-utils module is updated to try the active key first, then
 * fall back to retired keys for decryption of legacy data, ensuring
 * zero-downtime rotation.
 *
 * @module key-rotation-store
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_ROTATION_PATH =
  process.env.KEY_ROTATION_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'key-rotation.json');

const KEY_FILE_PATH =
  process.env.ENCRYPTION_KEY_FILE_PATH ||
  path.join(process.cwd(), '.simplebeacon', '.encryption-key');

let _cache = null;
let _cacheDirty = true;

/**
 * @typedef {object} KeyVersion
 * @property {number} version      — Sequential version number
 * @property {string} keyHash      — SHA-256 hash of key (for identification)
 * @property {string} keyHex       — Key material in hex (32 bytes = 64 hex chars)
 * @property {string} createdAt    — ISO timestamp
 * @property {string} status       — 'active' | 'retired' | 'revoked'
 * @property {string} [retiredAt]  — When key was retired
 * @property {string} [rotatedBy]  — Who triggered the rotation
 */

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(KEY_ROTATION_PATH, 'utf8');
    _cache = JSON.parse(raw);
    if (!_cache.versions || !Array.isArray(_cache.versions)) {
      _cache = { versions: [], lastRotation: null };
    }
  } catch {
    _cache = { versions: [], lastRotation: null };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(KEY_ROTATION_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = KEY_ROTATION_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, KEY_ROTATION_PATH);
  _cache = store;
  _cacheDirty = false;
}

function generateKey() {
  return crypto.randomBytes(32);
}

function keyHash(keyBuffer) {
  return crypto.createHash('sha256').update(keyBuffer).digest('hex').slice(0, 16);
}

/**
 * Get the current active key version.
 * If no rotation history exists, derive the key from the current environment
 * or key file (matching crypto-utils.cjs resolveKey logic).
 * @returns {KeyVersion|null}
 */
function getActiveKey() {
  const store = readStore();
  const active = store.versions.find((v) => v.status === 'active');
  if (active) return active;

  // No active key in store — derive from current environment
  const envKey =
    process.env.SIMPLEBEACON_ENCRYPTION_KEY ||
    process.env.SIMPLEBEACON_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    null;

  let keyBuffer;
  if (envKey) {
    keyBuffer = crypto.createHash('sha256').update(String(envKey)).digest();
  } else {
    try {
      if (fs.existsSync(KEY_FILE_PATH)) {
        keyBuffer = Buffer.from(fs.readFileSync(KEY_FILE_PATH, 'utf8'), 'hex');
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  return {
    version: 0,
    keyHash: keyHash(keyBuffer),
    keyHex: keyBuffer.toString('hex'),
    createdAt: '1970-01-01T00:00:00.000Z',
    status: 'active',
  };
}

/**
 * Get all key versions that can be used for decryption (active + retired).
 * Revoked keys are excluded — data encrypted with revoked keys is unrecoverable.
 * @returns {KeyVersion[]}
 */
function getDecryptionKeys() {
  const store = readStore();
  return store.versions.filter((v) => v.status === 'active' || v.status === 'retired');
}

/**
 * Get all key versions (including revoked).
 * @returns {KeyVersion[]}
 */
function getAllVersions() {
  const store = readStore();
  return [...store.versions].sort((a, b) => b.version - a.version);
}

/**
 * Get rotation history (metadata only, no key material).
 * @returns {Array}
 */
function getHistory() {
  const versions = getAllVersions();
  return versions.map((v) => ({
    version: v.version,
    keyHash: v.keyHash,
    status: v.status,
    createdAt: v.createdAt,
    retiredAt: v.retiredAt || null,
    rotatedBy: v.rotatedBy || null,
  }));
}

/**
 * Get the active key buffer for encryption.
 * @returns {Buffer|null}
 */
function getActiveKeyBuffer() {
  const active = getActiveKey();
  if (!active) return null;
  return Buffer.from(active.keyHex, 'hex');
}

/**
 * Perform a key rotation: generate a new key, mark the current active key
 * as retired, and set the new key as active.
 *
 * @param {string} rotatedBy — Email/ID of the admin triggering rotation
 * @returns {{ success: boolean, newVersion?: KeyVersion, error?: string }}
 */
function rotateKey(rotatedBy) {
  const store = readStore();

  // Find current active key
  const currentActive = store.versions.find((v) => v.status === 'active');
  const nextVersion = currentActive ? currentActive.version + 1 : 1;

  // Generate new key
  const newKey = generateKey();
  const now = new Date().toISOString();

  // Retire current active key
  if (currentActive) {
    currentActive.status = 'retired';
    currentActive.retiredAt = now;
  }

  // Create new active key version
  const newKeyVersion = {
    version: nextVersion,
    keyHash: keyHash(newKey),
    keyHex: newKey.toString('hex'),
    createdAt: now,
    status: 'active',
    rotatedBy: rotatedBy || 'system',
  };

  store.versions.push(newKeyVersion);
  store.lastRotation = now;

  writeStore(store);

  // Update the key file so crypto-utils picks up the new key on restart
  const dir = path.dirname(KEY_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEY_FILE_PATH, newKey.toString('hex'), { mode: 0o600 });

  return { success: true, newVersion: newKeyVersion };
}

/**
 * Revoke a key version. Revoked keys cannot decrypt data.
 * The active key cannot be revoked.
 * @param {number} version
 * @returns {{ success: boolean, error?: string }}
 */
function revokeKey(version) {
  const store = readStore();
  const keyVersion = store.versions.find((v) => v.version === version);
  if (!keyVersion) return { success: false, error: 'Key version not found' };
  if (keyVersion.status === 'active') {
    return { success: false, error: 'Cannot revoke the active key' };
  }
  if (keyVersion.status === 'revoked') {
    return { success: false, error: 'Key is already revoked' };
  }
  keyVersion.status = 'revoked';
  writeStore(store);
  return { success: true };
}

/**
 * Get rotation status for dashboard.
 * @returns {{ activeVersion: number|null, totalVersions: number, lastRotation: string|null, keyHash: string|null }}
 */
function getStatus() {
  const active = getActiveKey();
  const store = readStore();
  return {
    activeVersion: active ? active.version : null,
    totalVersions: store.versions.length,
    lastRotation: store.lastRotation || null,
    keyHash: active ? active.keyHash : null,
    algorithm: 'AES-256-GCM',
  };
}

/**
 * Initialize the key rotation store with the current key if empty.
 * Called on server startup to ensure the store has a record of the
 * current encryption key.
 */
function initialize() {
  const store = readStore();
  if (store.versions.length > 0) return;

  // No versions — record the current key as version 0
  const active = getActiveKey();
  if (active && active.version === 0) {
    store.versions.push({
      ...active,
      rotatedBy: 'system-init',
    });
    store.lastRotation = active.createdAt;
    writeStore(store);
  }
}

module.exports = {
  initialize,
  rotateKey,
  revokeKey,
  getActiveKey,
  getActiveKeyBuffer,
  getDecryptionKeys,
  getAllVersions,
  getHistory,
  getStatus,
  KEY_ROTATION_PATH,
};
