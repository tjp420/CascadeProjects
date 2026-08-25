"use strict";

const crypto = require("crypto");
const providers = require("./hsm-providers.cjs");
const clusterSync = require("./cluster-keyring-sync.cjs");

const DEFAULT_KEY_ID = "sb-master-key";
const DEFAULT_REGION = "us-east-1";
const SANDBOX_PREFIX = "enc:sb:";
const _hsmVersions = [];

async function deriveOrgKeyViaHsm(orgId, options = {}) {
  if (!orgId || typeof orgId !== "string") {
    throw new TypeError(
      "HSM key derivation requires a valid organization identifier string",
    );
  }
  if (options.actorOrgId && options.actorOrgId !== orgId) {
    if (clusterSync && clusterSync._recordEvent) {
      clusterSync._recordEvent(
        clusterSync.EVENT_TYPES.ISOLATION_VIOLATION,
        null,
        {
          targetOrg: orgId,
          actorOrg: options.actorOrgId,
          keyId: options.keyId || process.env.HSM_KEY_ID || DEFAULT_KEY_ID,
          region: options.region || process.env.HSM_REGION || DEFAULT_REGION,
        },
      );
    }
    throw isolationViolationError(orgId, options.actorOrgId);
  }
  const provider = providers.createProvider(options);
  recordHsmVersion(provider.keyId, provider.region);
  return withHsmTimeout(provider.derive(orgId), {
    orgId,
    keyId: provider.keyId,
    region: provider.region,
  });
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

function getHsmTimeoutMs() {
  const raw = process.env.HSM_TIMEOUT_MS || process.env.HSM_TIMEOUT;
  if (!raw) return 5000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function hsmTimeoutError() {
  const err = new Error("HSM operation timed out and was aborted");
  err.name = "HsmTimeoutError";
  err.code = "hsm_timeout";
  err.statusCode = 503;
  err.hsmTimeout = true;
  return err;
}

function isolationViolationError(targetOrg, actorOrg) {
  const err = new Error(
    `Tenant isolation violation: actor ${actorOrg} attempted access to ${targetOrg}`,
  );
  err.name = "IsolationViolationError";
  err.code = "isolation_violation";
  err.statusCode = 403;
  err.targetOrg = targetOrg;
  err.actorOrg = actorOrg;
  return err;
}

function withHsmTimeout(promise, details) {
  const ms = getHsmTimeoutMs();
  if (!ms) return promise;
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      if (clusterSync && clusterSync._recordEvent) {
        clusterSync._recordEvent(clusterSync.EVENT_TYPES.HSM_TIMEOUT, null, {
          ...(details || {}),
        });
      }
      reject(hsmTimeoutError());
    }, ms);
    if (t.unref) t.unref();
  });
  const guarded = Promise.resolve(promise).catch((err) => {
    // record HSM operation errors to cluster timeline where available
    try {
      if (clusterSync && clusterSync._recordEvent) {
        clusterSync._recordEvent(
          clusterSync.EVENT_TYPES && clusterSync.EVENT_TYPES.HSM_OPERATION_ERROR
            ? clusterSync.EVENT_TYPES.HSM_OPERATION_ERROR
            : "hsm_operation_error",
          null,
          { ...(details || {}), error: err.message },
        );
      }
    } catch (e) {
      console.error("hsm-vault.cjs error:", e);
      // best-effort
    }
    throw err;
  });
  return Promise.race([guarded, timeout]).finally(() => clearTimeout(t));
}

async function hsmHandshake(provider, keyId, region) {
  const p = providers.createProvider({ provider, keyId, region });
  recordHsmVersion(p.keyId, p.region);
  return withHsmTimeout(Promise.resolve(p.handshake()), {
    keyId: p.keyId,
    region: p.region,
  });
}

async function deriveWithFailover(orgId, options = {}) {
  const regions = [
    process.env.HSM_REGION || DEFAULT_REGION,
    ...(process.env.HSM_FAILOVER_REGIONS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const errors = [];
  for (const region of regions) {
    try {
      return await deriveOrgKeyViaHsm(orgId, { ...options, region });
    } catch (err) {
      if (err.code === "hsm_timeout" || err.code === "isolation_violation")
        throw err;
      errors.push(`${region}: ${err.message}`);
    }
  }
  throw new Error(`HSM unavailable in all regions: ${errors.join("; ")}`);
}

async function hsmRotate(newKeyId, newRegion) {
  const keyId = newKeyId || process.env.HSM_KEY_ID || DEFAULT_KEY_ID;
  const region = newRegion || process.env.HSM_REGION || DEFAULT_REGION;
  recordHsmVersion(keyId, region);
  const p = providers.createProvider({ keyId, region });
  const handshake = await withHsmTimeout(Promise.resolve(p.handshake()), {
    keyId,
    region,
  });
  return {
    success: true,
    ...handshake,
    previousVersions: getHsmVersions().slice(1),
  };
}

function parseSandboxPayload(stored) {
  if (!stored || typeof stored !== "string") return null;
  if (!stored.startsWith(SANDBOX_PREFIX)) return null;
  const payload = stored.slice(SANDBOX_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  return parts;
}

async function decryptWithHsm(orgId, stored, options = {}) {
  const parts = parseSandboxPayload(stored);
  if (!parts) return "";

  const versions = [null, ...getHsmVersions().slice(1)];
  for (const version of versions) {
    try {
      const opts = version
        ? { ...options, keyId: version.keyId, region: version.region }
        : options;
      const key = await deriveOrgKeyViaHsm(orgId, opts);
      const iv = Buffer.from(parts[0], "hex");
      const tag = Buffer.from(parts[1], "hex");
      const encrypted = Buffer.from(parts[2], "hex");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted, null, "utf8") + decipher.final("utf8");
    } catch (err) {
      if (err.code === "hsm_timeout" || err.code === "isolation_violation")
        throw err;
      // try older version
    }
  }
  return "";
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
