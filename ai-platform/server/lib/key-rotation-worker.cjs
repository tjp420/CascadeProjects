'use strict';

/**
 * Key Rotation Worker — Performs the actual re-encryption of store data
 * when a key rotation is triggered. Generates a new key, re-encrypts all
 * encrypted fields in all stores, and updates the active key — all without
 * breaking live data reads.
 *
 * The rotation process:
 *   1. Generate new key and add it to the key rotation store as active
 *   2. Mark the old key as retired (still available for decryption)
 *   3. For each store, load all records, decrypt with old key, re-encrypt with new key
 *   4. Write re-encrypted data back to store files
 *   5. Refresh crypto-utils active key and decryption key cache
 *
 * During rotation, live reads continue to work because the decrypt function
 * tries the active key first, then falls back to retired keys.
 *
 * @module key-rotation-worker
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');
const keyRotationStore = require('./key-rotation-store.cjs');
const cryptoUtils = require('./crypto-utils.cjs');

// ── Store registry ──────────────────────────────────────────────────────────
// Each entry describes a store that has encrypted data and how to re-encrypt it.

const STORE_REGISTRY = [
  {
    name: 'alert-rules',
    path: () => path.join(process.cwd(), '.simplebeacon', 'alert-rules.json'),
    encryptFields: ['webhookUrl'],
    destinationFields: ['url', 'secret', 'routingKey', 'email', 'to', 'webhookUrl'],
  },
  {
    name: 'sso-configs',
    path: () => path.join(process.cwd(), '.simplebeacon', 'sso-configs.json'),
    customHandler: reencryptSsoConfigs,
  },
];

/**
 * Re-encrypt SSO configs (uses a different encryption format than crypto-utils).
 */
function reencryptSsoConfigs(filePath, oldKey, newKey) {
  if (!fs.existsSync(filePath)) return { name: 'sso-configs', records: 0, reencrypted: 0 };

  const raw = fs.readFileSync(filePath, 'utf8');
  const store = JSON.parse(raw);
  let reencrypted = 0;

  for (const config of store.configs || []) {
    if (config.oidc && config.oidc.clientSecret) {
      const secret = config.oidc.clientSecret;
      // SSO uses base64 format (not enc: prefix) — try to decrypt with old key
      const plaintext = tryDecryptSsoSecret(secret, oldKey);
      if (plaintext !== null) {
        config.oidc.clientSecret = encryptSsoSecret(plaintext, newKey);
        reencrypted++;
      }
    }
  }

  if (reencrypted > 0) {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  return { name: 'sso-configs', records: (store.configs || []).length, reencrypted };
}

function encryptSsoSecret(plaintext, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function tryDecryptSsoSecret(encoded, keyBuffer) {
  try {
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Re-encrypt a standard crypto-utils store (uses enc: prefix format).
 */
function reencryptStandardStore(entry, oldKey, newKey) {
  const filePath = entry.path();
  if (!fs.existsSync(filePath)) {
    return { name: entry.name, records: 0, reencrypted: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const store = JSON.parse(raw);
  let records = 0;
  let reencrypted = 0;

  // Determine the array of records
  let recordsArr = null;
  if (Array.isArray(store.rules)) recordsArr = store.rules;
  else if (Array.isArray(store.configs)) recordsArr = store.configs;
  else if (Array.isArray(store.policies)) recordsArr = store.policies;
  else if (Array.isArray(store.entries)) recordsArr = store.entries;

  if (!recordsArr) {
    return { name: entry.name, records: 0, reencrypted: 0 };
  }

  for (const record of recordsArr) {
    records++;
    let modified = false;

    // Re-encrypt top-level fields
    if (entry.encryptFields) {
      for (const field of entry.encryptFields) {
        if (record[field] && cryptoUtils.isEncrypted(record[field])) {
          const plaintext = tryDecryptWithKey(record[field], oldKey);
          if (plaintext !== null) {
            record[field] = encryptWithKey(plaintext, newKey);
            modified = true;
          }
        }
      }
    }

    // Re-encrypt destination sub-object fields
    if (entry.destinationFields && record.destination) {
      for (const field of entry.destinationFields) {
        if (record.destination[field] && cryptoUtils.isEncrypted(record.destination[field])) {
          const plaintext = tryDecryptWithKey(record.destination[field], oldKey);
          if (plaintext !== null) {
            record.destination[field] = encryptWithKey(plaintext, newKey);
            modified = true;
          }
        }
      }
    }

    if (modified) reencrypted++;
  }

  if (reencrypted > 0) {
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  return { name: entry.name, records, reencrypted };
}

function encryptWithKey(plaintext, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function tryDecryptWithKey(stored, keyBuffer) {
  if (!stored || typeof stored !== 'string') return null;
  if (!stored.startsWith('enc:')) return null;
  const parts = stored.split(':');
  if (parts.length !== 4) return null;
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

/**
 * Perform a full key rotation.
 *
 * Steps:
 *   1. Get the current active key (old key)
 *   2. Trigger rotation in key-rotation-store (generates new key, marks old as retired)
 *   3. Re-encrypt all registered stores
 *   4. Refresh crypto-utils to use the new active key
 *
 * @param {string} rotatedBy — Admin email/ID
 * @returns {{ success: boolean, results?: Array, newVersion?: object, error?: string }}
 */
function performRotation(rotatedBy) {
  try {
    // Get current active key (before rotation)
    const oldActive = keyRotationStore.getActiveKey();
    if (!oldActive) {
      return { success: false, error: 'No active encryption key found' };
    }
    const oldKeyBuffer = Buffer.from(oldActive.keyHex, 'hex');

    // Perform rotation in the store (generates new key, retires old)
    const rotationResult = keyRotationStore.rotateKey(rotatedBy);
    if (!rotationResult.success) {
      return { success: false, error: rotationResult.error || 'Rotation failed' };
    }

    const newKeyBuffer = Buffer.from(rotationResult.newVersion.keyHex, 'hex');

    logger.info(
      `[KeyRotation] Starting re-encryption: v${oldActive.version} → v${rotationResult.newVersion.version}`
    );

    // Re-encrypt all stores
    const results = [];
    for (const entry of STORE_REGISTRY) {
      try {
        if (entry.customHandler) {
          const result = entry.customHandler(entry.path(), oldKeyBuffer, newKeyBuffer);
          results.push(result);
          logger.info(
            `[KeyRotation] ${result.name}: ${result.reencrypted}/${result.records} records re-encrypted`
          );
        } else {
          const result = reencryptStandardStore(entry, oldKeyBuffer, newKeyBuffer);
          results.push(result);
          logger.info(
            `[KeyRotation] ${result.name}: ${result.reencrypted}/${result.records} records re-encrypted`
          );
        }
      } catch (err) {
        logger.warn(`[KeyRotation] Failed to re-encrypt ${entry.name}: ${err.message}`);
        results.push({ name: entry.name, records: 0, reencrypted: 0, error: err.message });
      }
    }

    // Refresh crypto-utils to use the new active key
    cryptoUtils.refreshActiveKey();

    logger.info(
      `[KeyRotation] Complete: key v${rotationResult.newVersion.version} is now active`
    );

    return {
      success: true,
      results,
      newVersion: {
        version: rotationResult.newVersion.version,
        keyHash: rotationResult.newVersion.keyHash,
        createdAt: rotationResult.newVersion.createdAt,
      },
    };
  } catch (err) {
    logger.error(`[KeyRotation] Failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  performRotation,
  STORE_REGISTRY,
};
