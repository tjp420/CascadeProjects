'use strict';

const crypto = require('crypto');

const _HSM_ROOT_KEY = process.env.HSM_MOCK_ROOT_KEY
  ? Buffer.from(process.env.HSM_MOCK_ROOT_KEY, 'hex')
  : crypto.randomBytes(32);

const DEFAULT_KEY_ID = 'sb-master-key';
const DEFAULT_REGION = 'us-east-1';
const SANDBOX_PREFIX = 'enc:sb:';
const _hsmVersions = [];

function deriveKey(orgId, context) {
  if (!orgId || typeof orgId !== 'string') {
    throw new TypeError('HSM key derivation requires a valid organization identifier string');
  }
  return crypto.createHmac('sha256', _HSM_ROOT_KEY)
    .update(`${orgId}::${context || 'default'}`)
    .digest();
}

function deriveOrgKeyViaHsm(orgId) {
  return deriveKey(orgId, 'org-key');
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

function hsmHandshake(provider, keyId, region) {
  const id = keyId || process.env.HSM_KEY_ID || DEFAULT_KEY_ID;
  const r = region || process.env.HSM_REGION || DEFAULT_REGION;
  const p = provider || process.env.HSM_PROVIDER || 'mockhsm';
  const handle = `${p}:${id}@${r}`;
  const fingerprint = crypto.createHash('sha256').update(`${handle}:${_HSM_ROOT_KEY.toString('hex').slice(0, 16)}`).digest('hex');
  recordHsmVersion(id, r);
  return {
    provider: p,
    keyId: id,
    region: r,
    handle,
    fingerprint,
    handshakeAt: new Date().toISOString(),
    healthy: true,
  };
}

async function deriveWithFailover(orgId) {
  const regions = [process.env.HSM_REGION || DEFAULT_REGION, ...(process.env.HSM_FAILOVER_REGIONS || '').split(',').map((s) => s.trim()).filter(Boolean)];
  const errors = [];
  for (const region of regions) {
    try {
      return deriveOrgKeyViaHsm(orgId);
    } catch (err) {
      errors.push(`${region}: ${err.message}`);
    }
  }
  throw new Error(`HSM unavailable in all regions: ${errors.join('; ')}`);
}

function hsmRotate(newKeyId, newRegion) {
  const keyId = newKeyId || process.env.HSM_KEY_ID || DEFAULT_KEY_ID;
  const region = newRegion || process.env.HSM_REGION || DEFAULT_REGION;
  recordHsmVersion(keyId, region);
  const p = process.env.HSM_PROVIDER || 'mockhsm';
  const handle = `${p}:${keyId}@${region}`;
  const fingerprint = crypto.createHash('sha256').update(`${handle}:${_HSM_ROOT_KEY.toString('hex').slice(0, 16)}`).digest('hex');
  return {
    success: true,
    provider: p,
    keyId,
    region,
    handle,
    fingerprint,
    handshakeAt: new Date().toISOString(),
    healthy: true,
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

function decryptWithHsm(orgId, stored) {
  const parts = parseSandboxPayload(stored);
  if (!parts) return '';
  const key = deriveOrgKeyViaHsm(orgId);
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
  } catch {
    return '';
  }
}

module.exports = {
  deriveKey,
  deriveOrgKeyViaHsm,
  deriveWithFailover,
  hsmHandshake,
  hsmRotate,
  getHsmVersions,
  _resetHsmVersions,
  decryptWithHsm,
};
