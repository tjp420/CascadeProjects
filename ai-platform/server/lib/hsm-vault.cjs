'use strict';

const crypto = require('crypto');
const providers = require('./hsm-providers.cjs');

const DEFAULT_KEY_ID = 'sb-master-key';
const DEFAULT_REGION = 'us-east-1';
const SANDBOX_PREFIX = 'enc:sb:';
const _hsmVersions = [];

async function deriveOrgKeyViaHsm(orgId, options = {}) {
  if (!orgId || typeof orgId !== 'string') {
    throw new TypeError('HSM key derivation requires a valid organization identifier string');
  }
  const provider = providers.createProvider(options);
  recordHsmVersion(provider.keyId, provider.region);
  return provider.derive(orgId);
}

function recordHsmVersion(keyId, region) {
  const handle = `${keyId}@${region}`;
  if (_hsmVersions.length > 0 && _hsmVersions[0].handle === handle) return;
  _hsmVersions.unshift({ keyId, region, handle, recordedAt: Date.now() });
  while (_hsmVersions.length > 8) _hsmVersions.pop();
}

function getHsmVersions() {
  return _hsmVersions.map((v) => ({ ...v }));
}

function _resetHsmVersions() {
  _hsmVersions.length = 0;
}

async function hsmHandshake(provider, keyId, region) {
  const p = providers.createProvider({ provider, keyId, region });
  recordHsmVersion(p.keyId, p.region);
  return p.handshake();
}

async function deriveWithFailover(orgId) {
  const regions = [process.env.HSM_REGION || DEFAULT_REGION, ...(process.env.HSM_FAILOVER_REGIONS || '').split(',').map((s) => s.trim()).filter(Boolean)];
  const errors = [];
  for (const region of regions) {
    try {
      return await deriveOrgKeyViaHsm(orgId, { region });
    } catch (err) {
      errors.push(`${region}: ${err.message}`);
    }
  }
  throw new Error(`HSM unavailable in all regions: ${errors.join('; ')}`);
}

async function hsmRotate(newKeyId, newRegion) {
  const keyId = newKeyId || process.env.HSM_KEY_ID || DEFAULT_KEY_ID;
  const region = newRegion || process.env.HSM_REGION || DEFAULT_REGION;
  recordHsmVersion(keyId, region);
  const p = providers.createProvider({ keyId, region });
  return {
    success: true,
    ...p.handshake(),
    previousVersions: getHsmVersions().slice(1),
  };
}

function parseSandboxPayload(stored) {
  if (!stored || typeof stored !== 'string') return null;
  if (!stored.startsWith(SANDBOX_PREFIX)) return null;
  const payload = stored.slice(SANDBOX_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  return parts;
}

async function decryptWithHsm(orgId, stored, options = {}) {
  const parts = parseSandboxPayload(stored);
  if (!parts) return '';

  const versions = [null, ...getHsmVersions().slice(1)];
  for (const version of versions) {
    try {
      const opts = version
        ? { ...options, keyId: version.keyId, region: version.region }
        : options;
      const key = await deriveOrgKeyViaHsm(orgId, opts);
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
    } catch {
      // try older version
    }
  }
  return '';
}

module.exports = {
  deriveOrgKeyViaHsm,
  deriveWithFailover,
  hsmHandshake,
  hsmRotate,
  getHsmVersions,
  _resetHsmVersions,
  decryptWithHsm,
};
