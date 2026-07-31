'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cryptoUtils = require('./crypto-utils.cjs');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'webhook-configs.json');
const KEY_PATH = path.join(process.cwd(), '.simplebeacon', '.webhook-key');
const ALGO = 'aes-256-gcm';

function getEncryptionKey() {
  try {
    if (fs.existsSync(KEY_PATH)) {
      return Buffer.from(fs.readFileSync(KEY_PATH, 'utf8'), 'hex');
    }
  } catch {
    // fall through to generate new key
  }
  const key = crypto.randomBytes(32);
  const dir = path.dirname(KEY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
}

const ENCRYPTION_KEY = getEncryptionKey();

function encryptToken(plaintext) {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(stored) {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored;
  const parts = stored.split(':');
  if (parts.length !== 4) return '';
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    const decipher = crypto.createDecipheriv(ALGO, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

function decryptWithFallback(stored, orgId) {
  if (!stored) return '';
  if (cryptoUtils.isOrgEncrypted(stored)) {
    return cryptoUtils.decryptForOrg(stored, orgId) || '';
  }
  return decryptToken(stored);
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { configs: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { configs: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeConfigKey(orgId, target) {
  return orgId ? `${orgId}::${target}` : target;
}

function getConfig(target, orgId) {
  const store = readStore();
  const key = makeConfigKey(orgId, target);
  const config = store.configs[key];
  if (!config) return null;
  return { ...config, authToken: decryptWithFallback(config.authToken, config.orgId) };
}

function getAllConfigs(orgId) {
  const store = readStore();
  const configs = {};
  for (const [key, val] of Object.entries(store.configs)) {
    if (orgId && val.orgId !== orgId) continue;
    const targetKey = val.target || key;
    configs[targetKey] = { ...val, authToken: decryptWithFallback(val.authToken, val.orgId) };
  }
  return configs;
}

function setConfig(target, config, orgId) {
  const store = readStore();
  const key = makeConfigKey(orgId, target);
  const effectiveOrgId = orgId || 'default';
  store.configs[key] = {
    orgId: effectiveOrgId,
    target,
    apiUrl: config.apiUrl || '',
    authToken: cryptoUtils.encryptForOrg(config.authToken || '', effectiveOrgId),
    projectKey: config.projectKey || '',
    teamId: config.teamId || '',
    repoOwner: config.repoOwner || '',
    repoName: config.repoName || '',
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return { ...store.configs[key], authToken: config.authToken || '' };
}

function deleteConfig(target, orgId) {
  const store = readStore();
  const key = makeConfigKey(orgId, target);
  delete store.configs[key];
  writeStore(store);
}

module.exports = {
  getConfig,
  getAllConfigs,
  setConfig,
  deleteConfig,
};
