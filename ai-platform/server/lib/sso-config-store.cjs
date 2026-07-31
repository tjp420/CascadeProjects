/**
 * SSO Configuration Store — Persistent per-organization SSO provider configs.
 *
 * Supports both SAML 2.0 and OIDC providers (Okta, Azure AD, Ping Identity, etc.).
 * Configs are stored in a JSON file and cached in-memory with dirty-flag invalidation.
 *
 * @module sso-config-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SSO_CONFIG_PATH =
  process.env.SSO_CONFIG_PATH || path.join(__dirname, '../../.simplebeacon', 'sso-configs.json');

let _cache = null;
let _cacheDirty = true;

/**
 * @typedef {object} SsoProviderConfig
 * @property {string} providerId     — Unique identifier (e.g. 'okta', 'azuread')
 * @property {string} orgId          — Organization ID this config belongs to
 * @property {string} displayName    — Human-readable name (e.g. "Acme Okta")
 * @property {'saml'|'oidc'} method  — Authentication protocol
 * @property {'okta'|'azuread'|'ping'|'auth0'|'custom'} providerType — IdP type
 * @property {string} domain         — Email domain for auto-routing (e.g. 'acme.com')
 * @property {boolean} enabled       — Whether SSO is active for this org
 * @property {object} saml           — SAML-specific config (if method=saml)
 * @property {string} [saml.entryPoint]  — IdP SSO URL
 * @property {string} [saml.cert]        — IdP public certificate (PEM)
 * @property {string} [saml.issuer]      — SP entity ID
 * @property {object} oidc           — OIDC-specific config (if method=oidc)
 * @property {string} [oidc.clientId]     — OAuth client ID
 * @property {string} [oidc.clientSecret] — OAuth client secret (encrypted at rest)
 * @property {string} [oidc.issuer]       — IdP issuer URL
 * @property {string} [oidc.redirectUri]  — Callback URL
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(SSO_CONFIG_PATH, 'utf8');
    _cache = JSON.parse(raw);
    if (!_cache.configs || !Array.isArray(_cache.configs)) {
      _cache = { configs: [] };
    }
  } catch {
    _cache = { configs: [] };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(SSO_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = SSO_CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, SSO_CONFIG_PATH);
  _cache = store;
  _cacheDirty = false;
}

/**
 * Encrypt a secret value using AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} Encrypted payload as base64 string
 */
function encryptSecret(plaintext) {
  const secret = process.env.SSO_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-secret';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a secret value.
 * @param {string} encoded
 * @returns {string|null} Plaintext or null if decryption fails
 */
function decryptSecret(encoded) {
  try {
    const secret = process.env.SSO_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-secret';
    const key = crypto.createHash('sha256').update(secret).digest();
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Mask a client secret for display (show only first 4 and last 4 chars).
 * @param {string} secret
 * @returns {string}
 */
function maskSecret(secret) {
  if (!secret || secret.length < 12) return '****';
  return secret.slice(0, 4) + '••••' + secret.slice(-4);
}

/**
 * Get all SSO configs (secrets masked) for admin dashboard listing.
 * @returns {Array}
 */
function getAllConfigs() {
  const store = readStore();
  return store.configs.map((c) => ({
    ...c,
    oidc: c.oidc
      ? {
          ...c.oidc,
          clientSecret: c.oidc.clientSecret
            ? maskSecret(decryptSecret(c.oidc.clientSecret))
            : undefined,
        }
      : undefined,
  }));
}

/**
 * Get all SSO configs for an organization (secrets masked).
 * @param {string} orgId
 * @returns {Array}
 */
function getConfigsByOrg(orgId) {
  const store = readStore();
  return store.configs
    .filter((c) => c.orgId === orgId)
    .map((c) => ({
      ...c,
      oidc: c.oidc
        ? {
            ...c.oidc,
            clientSecret: c.oidc.clientSecret
              ? maskSecret(decryptSecret(c.oidc.clientSecret))
              : undefined,
          }
        : undefined,
    }));
}

/**
 * Get a specific SSO config by providerId (raw, secrets encrypted).
 * @param {string} providerId
 * @returns {object|null}
 */
function getConfig(providerId) {
  const store = readStore();
  return store.configs.find((c) => c.providerId === providerId) || null;
}

/**
 * Get a decrypted SSO config by providerId (for internal use in auth flow).
 * @param {string} providerId
 * @returns {object|null}
 */
function getConfigDecrypted(providerId) {
  const store = readStore();
  const config = store.configs.find((c) => c.providerId === providerId);
  if (!config) return null;
  if (config.oidc && config.oidc.clientSecret) {
    config.oidc._decryptedSecret = decryptSecret(config.oidc.clientSecret);
  }
  return config;
}

/**
 * Resolve SSO config by email domain.
 * @param {string} email
 * @returns {object|null}
 */
function resolveConfigByDomain(email) {
  const m = String(email).match(/@([^@]+)$/);
  if (!m) return null;
  const domain = m[1].toLowerCase();
  const store = readStore();
  return store.configs.find((c) => c.enabled && c.domain === domain) || null;
}

/**
 * Create a new SSO provider config.
 * @param {object} params
 * @returns {object}
 */
function createConfig(params) {
  const store = readStore();
  const now = new Date().toISOString();

  const config = {
    providerId: params.providerId || `sso-${crypto.randomBytes(4).toString('hex')}`,
    orgId: params.orgId,
    displayName: params.displayName || params.providerId,
    method: params.method || 'oidc',
    providerType: params.providerType || 'custom',
    domain: params.domain || '',
    enabled: params.enabled !== false,
    saml: params.saml || null,
    oidc: params.oidc
      ? {
          ...params.oidc,
          clientSecret: params.oidc.clientSecret
            ? encryptSecret(params.oidc.clientSecret)
            : undefined,
        }
      : null,
    createdAt: now,
    updatedAt: now,
  };

  store.configs.push(config);
  writeStore(store);
  return config;
}

/**
 * Update an existing SSO provider config.
 * @param {string} providerId
 * @param {object} updates
 * @returns {object|null}
 */
function updateConfig(providerId, updates) {
  const store = readStore();
  const idx = store.configs.findIndex((c) => c.providerId === providerId);
  if (idx === -1) return null;

  const config = store.configs[idx];
  const now = new Date().toISOString();

  const updated = {
    ...config,
    ...updates,
    updatedAt: now,
  };

  if (updates.oidc) {
    updated.oidc = { ...config.oidc, ...updates.oidc };
    if (updates.oidc.clientSecret) {
      updated.oidc.clientSecret = encryptSecret(updates.oidc.clientSecret);
    }
  }

  if (updates.saml) {
    updated.saml = { ...config.saml, ...updates.saml };
  }

  store.configs[idx] = updated;
  writeStore(store);
  return updated;
}

/**
 * Delete an SSO provider config.
 * @param {string} providerId
 * @returns {boolean}
 */
function deleteConfig(providerId) {
  const store = readStore();
  const idx = store.configs.findIndex((c) => c.providerId === providerId);
  if (idx === -1) return false;
  store.configs.splice(idx, 1);
  writeStore(store);
  return true;
}

/**
 * Get SSO stats for dashboard.
 * @returns {{ totalConfigs: number, enabledConfigs: number, byMethod: object, byProvider: object }}
 */
function getStats() {
  const store = readStore();
  const byMethod = {};
  const byProvider = {};
  let enabled = 0;

  for (const c of store.configs) {
    byMethod[c.method] = (byMethod[c.method] || 0) + 1;
    byProvider[c.providerType] = (byProvider[c.providerType] || 0) + 1;
    if (c.enabled) enabled++;
  }

  return {
    totalConfigs: store.configs.length,
    enabledConfigs: enabled,
    byMethod,
    byProvider,
  };
}

module.exports = {
  getAllConfigs,
  getConfigsByOrg,
  getConfig,
  getConfigDecrypted,
  resolveConfigByDomain,
  createConfig,
  updateConfig,
  deleteConfig,
  getStats,
  encryptSecret,
  decryptSecret,
  maskSecret,
  SSO_CONFIG_PATH,
};
