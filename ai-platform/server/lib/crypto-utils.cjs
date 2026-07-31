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

const ENCRYPTION_KEY = resolveKey();

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
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv(ALGO, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
  } catch {
    return '';
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
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
  return value.slice(0, 4) + '••••' + value.slice(-4);
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  encryptObject,
  decryptObject,
  maskSecret,
  ALGO,
};
