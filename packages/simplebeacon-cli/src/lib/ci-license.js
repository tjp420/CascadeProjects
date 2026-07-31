/**
 * CI license resolution: cryptographically validate when possible;
 * optional remote registry check; fail-closed on bad tokens, fail-open on network outage.
 */
const { validateLicenseToken, resolveLicenseToken } = require('./license-token');
const { resolveTier, isPaidTier, getTierLimits } = require('./tier-constants');
const { isPipelineScan } = require('./scan-usage-tracker');

const DEFAULT_VALIDATE_URL =
  process.env.SIMPLEBEACON_LICENSE_VALIDATE_URL || 'https://simplebeacon.ai/api/license/validate';
const VALIDATE_TIMEOUT_MS = Number(process.env.SIMPLEBEACON_LICENSE_VALIDATE_TIMEOUT_MS) || 4500;

function verificationSecrets() {
  const secrets = [];
  if (process.env.SIMPLEBEACON_LICENSE_SECRET) {
    secrets.push(process.env.SIMPLEBEACON_LICENSE_SECRET);
  }
  return secrets;
}

const DEFAULT_UPGRADE_URL =
  process.env.SIMPLEBEACON_UPGRADE_URL || 'https://simplebeacon.ai/pricing';

function tierFromClaims(claims) {
  const raw = String(claims?.tier || claims?.product || 'developer').toLowerCase();
  const tier = resolveTier(raw);
  return {
    tier,
    paid: isPaidTier(tier),
    limits: getTierLimits(tier),
    claims,
  };
}

function tryLocalValidation(token) {
  for (const secret of verificationSecrets()) {
    const result = validateLicenseToken(token, secret);
    if (result.valid) {
      return { ok: true, ...tierFromClaims(result.claims), mode: 'local-signature' };
    }
  }
  return { ok: false };
}

async function tryRemoteValidation(token) {
  if (typeof globalThis.fetch !== 'function') {
    return { ok: false, networkError: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const response = await globalThis.fetch(DEFAULT_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, httpStatus: response.status };
    }
    const data = /** @type {any} */ (await response.json());
    if (data && (data.active === true || data.registered === true || data.valid === true)) {
      const tier = resolveTier(data.tier || 'pro');
      const active =
        data.active === true ||
        (data.hasActiveSubscription === true && data.valid === true) ||
        (data.active === undefined && data.registered === true);
      const sandbox = data.sandbox === true || !active;
      return {
        ok: true,
        tier,
        paid: isPaidTier(tier),
        limits: getTierLimits(tier),
        active,
        sandbox,
        upgradeUrl: data.upgradeUrl || DEFAULT_UPGRADE_URL,
        features: Array.isArray(data.features) ? data.features : [],
        mode: 'remote-registry',
      };
    }
    return { ok: false, reason: 'not_registered' };
  } catch (err) {
    return { ok: false, networkError: true, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve license for CI runs.
 * @param {{ failOpenOnNetwork?: boolean, allowRemote?: boolean }} [options]
 * @returns {Promise<Object>}
 */
async function resolveCiLicense(options = {}) {
  const failOpenOnNetwork = options.failOpenOnNetwork !== false;
  const airGapped = options.airGapped === true;
  const token = process.env.SIMPLEBEACON_LICENSE_TOKEN || resolveLicenseToken();
  const isPipeline = isPipelineScan();
  const inPipeline = isPipeline || Boolean(token);

  if (!token) {
    return {
      ok: true,
      tier: 'developer',
      paid: false,
      limits: getTierLimits('developer'),
      active: false,
      sandbox: isPipeline,
      upgradeUrl: DEFAULT_UPGRADE_URL,
      mode: airGapped ? 'air-gapped-community' : 'community',
    };
  }

  const local = /** @type {any} */ (tryLocalValidation(token));
  if (local.ok) {
    const active = local.paid === true;
    const tier = active ? local.tier : 'developer';
    const paid = active && isPaidTier(tier);
    return {
      ok: true,
      tier,
      paid,
      limits: getTierLimits(tier),
      active,
      sandbox: !active && isPipeline,
      upgradeUrl: paid ? undefined : DEFAULT_UPGRADE_URL,
      mode: local.mode,
      claims: local.claims,
    };
  }

  // Air-gapped mode: never attempt remote validation
  if (airGapped) {
    return {
      ok: true,
      tier: 'developer',
      paid: false,
      limits: getTierLimits('developer'),
      active: false,
      sandbox: isPipeline,
      upgradeUrl: DEFAULT_UPGRADE_URL,
      mode: 'air-gapped-fallback',
      warning:
        'Air-gapped mode — license token could not be validated locally. Running community gate (scan not blocked).',
    };
  }

  if (inPipeline || options.allowRemote) {
    const remote = await tryRemoteValidation(token);
    if (remote.ok) {
      const active = remote.active === true;
      const tier = active ? remote.tier : 'developer';
      const paid = active && isPaidTier(tier);
      return {
        ok: true,
        tier,
        paid,
        limits: getTierLimits(tier),
        active,
        sandbox: !active && isPipeline,
        upgradeUrl: paid ? undefined : DEFAULT_UPGRADE_URL,
        features: remote.features,
        mode: remote.mode,
      };
    }
    if (remote.networkError && failOpenOnNetwork) {
      return {
        ok: true,
        tier: 'developer',
        paid: false,
        limits: getTierLimits('developer'),
        active: false,
        sandbox: isPipeline,
        upgradeUrl: DEFAULT_UPGRADE_URL,
        mode: 'offline-fallback',
        warning: 'License server unreachable — running community gate (scan not blocked).',
      };
    }
    return {
      ok: false,
      error: 'invalid_token',
      message:
        'SIMPLEBEACON_LICENSE_TOKEN is present but invalid or expired. Fix the secret or remove it for community mode.',
    };
  }

  return {
    ok: true,
    tier: 'developer',
    paid: false,
    limits: getTierLimits('developer'),
    active: false,
    sandbox: isPipeline,
    upgradeUrl: DEFAULT_UPGRADE_URL,
    mode: 'unverified-token',
    warning:
      'License token could not be verified locally (set SIMPLEBEACON_LICENSE_SECRET for offline validation).',
  };
}

module.exports = {
  resolveCiLicense,
  tryLocalValidation,
  tryRemoteValidation,
  verificationSecrets,
};
