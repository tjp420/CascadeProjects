"use strict";

/**
 * Webhook Signing Store — Asymmetric cryptographic signing engine for outbound
 * alert notifications and webhook deliveries.
 *
 * Provides:
 *   - RSA (RSA-SHA256) and ECDSA (ECDSA-SHA256) key pair generation and management
 *   - Payload signing with X-Beacon-Signature-256 header injection
 *   - Per-org key management with key rotation and grace windows
 *   - Delivery tracking with retry-backoff (exponential + jitter)
 *   - Signature verification for inbound webhook receipt confirmation
 *   - Delivery attempt history with status codes and latency
 *
 * @module webhook-signing-store
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("./app-logger.cjs");

const SIMPLEBEACON_DIR = path.join(process.cwd(), ".simplebeacon");
const STORE_PATH = path.join(SIMPLEBEACON_DIR, "webhook-signing.json");
const KEY_DIR = path.join(SIMPLEBEACON_DIR, "webhook-keys");

const DEFAULT_CONFIG = {
  enabled: true,
  defaultAlgorithm: "rsa-sha256",
  headerName: "X-Beacon-Signature-256",
  timestampHeader: "X-Beacon-Signature-Timestamp",
  keyIdHeader: "X-Beacon-Key-Id",
  maxRetries: 3,
  baseBackoffMs: 500,
  maxBackoffMs: 10000,
  jitterMs: 250,
  retryOnStatus: [408, 429, 500, 502, 503, 504],
  keyRotationGraceHours: 24,
};

const SUPPORTED_ALGORITHMS = ["rsa-sha256", "ecdsa-sha256"];

let _config = null;
let _cacheDirty = true;

const keyCache = new Map();
const deliveryHistory = [];
const MAX_DELIVERY_HISTORY = 500;

function readConfig() {
  if (!_cacheDirty) return _config;
  try {
    if (fs.existsSync(STORE_PATH)) {
      _config = {
        ...DEFAULT_CONFIG,
        ...JSON.parse(fs.readFileSync(STORE_PATH, "utf8")),
      };
    } else {
      _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  } catch {
    _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  _cacheDirty = false;
  return _config;
}

function writeConfig() {
  if (!fs.existsSync(SIMPLEBEACON_DIR))
    fs.mkdirSync(SIMPLEBEACON_DIR, { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(_config, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

function getConfig() {
  return readConfig();
}

function updateConfig(updates) {
  var config = readConfig();
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.defaultAlgorithm !== undefined) {
    if (!SUPPORTED_ALGORITHMS.includes(updates.defaultAlgorithm)) {
      throw new Error("Unsupported algorithm: " + updates.defaultAlgorithm);
    }
    config.defaultAlgorithm = updates.defaultAlgorithm;
  }
  if (updates.headerName !== undefined) config.headerName = updates.headerName;
  if (updates.maxRetries !== undefined) config.maxRetries = updates.maxRetries;
  if (updates.baseBackoffMs !== undefined)
    config.baseBackoffMs = updates.baseBackoffMs;
  if (updates.maxBackoffMs !== undefined)
    config.maxBackoffMs = updates.maxBackoffMs;
  if (updates.jitterMs !== undefined) config.jitterMs = updates.jitterMs;
  if (updates.retryOnStatus !== undefined)
    config.retryOnStatus = updates.retryOnStatus;
  if (updates.keyRotationGraceHours !== undefined)
    config.keyRotationGraceHours = updates.keyRotationGraceHours;
  writeConfig();
  return { success: true, config: config };
}

function resetConfig() {
  _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  writeConfig();
  return { success: true, config: _config };
}

function ensureKeyDir() {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true });
}

function keyFilePath(keyId) {
  return path.join(KEY_DIR, keyId + ".pem");
}

function generateKeyPair(keyId, algorithm, orgId) {
  var config = readConfig();
  var alg = algorithm || config.defaultAlgorithm;
  if (!SUPPORTED_ALGORITHMS.includes(alg))
    throw new Error("Unsupported algorithm: " + alg);
  if (!keyId) keyId = "key-" + crypto.randomBytes(6).toString("hex");
  ensureKeyDir();

  var keyType = alg.startsWith("rsa") ? "rsa" : "ec";
  var keyOptions;
  if (keyType === "rsa") {
    keyOptions = {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    };
  } else {
    keyOptions = {
      namedCurve: "prime256v1",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    };
  }
  var keyPair = crypto.generateKeyPairSync(keyType, keyOptions);

  var privKeyPath = keyFilePath(keyId);
  fs.writeFileSync(privKeyPath, keyPair.privateKey, { mode: 0o600 });

  var meta = {
    keyId: keyId,
    algorithm: alg,
    orgId: orgId || null,
    publicKeyPem: keyPair.publicKey,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(privKeyPath + ".meta.json", JSON.stringify(meta, null, 2));

  keyCache.set(keyId, {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    algorithm: alg,
    orgId: orgId || null,
    createdAt: meta.createdAt,
  });
  logger.info("[WebhookSigning] Generated " + alg + " key pair: " + keyId);
  return {
    keyId: keyId,
    algorithm: alg,
    publicKeyPem: keyPair.publicKey,
    createdAt: meta.createdAt,
  };
}

function loadKey(keyId) {
  if (keyCache.has(keyId)) return keyCache.get(keyId);
  var privKeyPath = keyFilePath(keyId);
  var metaPath = privKeyPath + ".meta.json";
  if (!fs.existsSync(privKeyPath) || !fs.existsSync(metaPath)) return null;
  try {
    var privateKey = fs.readFileSync(privKeyPath, "utf8");
    var meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    keyCache.set(keyId, {
      publicKey: meta.publicKeyPem,
      privateKey: privateKey,
      algorithm: meta.algorithm,
      orgId: meta.orgId,
      createdAt: meta.createdAt,
    });
    return keyCache.get(keyId);
  } catch (err) {
    logger.warn(
      "[WebhookSigning] Failed to load key " + keyId + ": " + err.message,
    );
    return null;
  }
}

function listKeys() {
  ensureKeyDir();
  var keys = [];
  try {
    var files = fs.readdirSync(KEY_DIR);
    for (var i = 0; i < files.length; i++) {
      if (files[i].endsWith(".meta.json")) {
        try {
          var meta = JSON.parse(
            fs.readFileSync(path.join(KEY_DIR, files[i]), "utf8"),
          );
          keys.push({
            keyId: meta.keyId,
            algorithm: meta.algorithm,
            orgId: meta.orgId,
            publicKeyPem: meta.publicKeyPem,
            createdAt: meta.createdAt,
          });
        } catch {}
      }
    }
  } catch {}
  return keys;
}

function deleteKey(keyId) {
  var privKeyPath = keyFilePath(keyId);
  var metaPath = privKeyPath + ".meta.json";
  var deleted = false;
  try {
    if (fs.existsSync(privKeyPath)) {
      fs.unlinkSync(privKeyPath);
      deleted = true;
    }
  } catch {}
  try {
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      deleted = true;
    }
  } catch {}
  keyCache.delete(keyId);
  return { success: true, deleted: deleted };
}

function getOrCreateOrgKey(orgId) {
  var keys = listKeys();
  var orgKey = keys.find(function (k) {
    return k.orgId === orgId;
  });
  if (orgKey) return loadKey(orgKey.keyId);
  var keyId = "org-" + orgId + "-" + crypto.randomBytes(4).toString("hex");
  generateKeyPair(keyId, readConfig().defaultAlgorithm, orgId);
  return loadKey(keyId);
}

function signPayload(payload, keyId) {
  var key = loadKey(keyId);
  if (!key) throw new Error("Key not found: " + keyId);
  var payloadBuf =
    typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
  var timestamp = Date.now();
  var sign = crypto.createSign(
    key.algorithm === "ecdsa-sha256" ? "SHA256" : "RSA-SHA256",
  );
  sign.update(payloadBuf);
  var signature = sign.sign(key.privateKey, "base64");
  return {
    signature: signature,
    algorithm: key.algorithm,
    keyId: keyId,
    timestamp: timestamp,
  };
}

function buildSignatureHeaders(payload, orgId, keyId) {
  var config = readConfig();
  if (!config.enabled) return {};

  var key = null;
  var actualKeyId = keyId;
  if (keyId) {
    key = loadKey(keyId);
  } else if (orgId) {
    key = getOrCreateOrgKey(orgId);
    for (var entry of keyCache.entries()) {
      if (entry[1] === key) {
        actualKeyId = entry[0];
        break;
      }
    }
  }

  if (!key) {
    logger.warn(
      "[WebhookSigning] No key available for signing (orgId=" +
        orgId +
        ", keyId=" +
        keyId +
        ")",
    );
    return {};
  }

  var payloadStr =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  var signResult = signPayload(payloadStr, actualKeyId);

  var headers = {};
  headers[config.headerName] = signResult.signature;
  headers[config.timestampHeader] = String(signResult.timestamp);
  headers[config.keyIdHeader] = actualKeyId;
  headers["X-Beacon-Signature-Algorithm"] = signResult.algorithm;
  return headers;
}

function verifySignature(payload, signature, keyId) {
  var key = loadKey(keyId);
  if (!key)
    return { valid: false, error: "Key not found: " + keyId, algorithm: null };
  var payloadBuf =
    typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
  var sigBuf = Buffer.from(signature, "base64");
  var verify = crypto.createVerify(
    key.algorithm === "ecdsa-sha256" ? "SHA256" : "RSA-SHA256",
  );
  verify.update(payloadBuf);
  var valid = verify.verify(key.publicKey, sigBuf);
  return {
    valid: valid,
    algorithm: key.algorithm,
    error: valid ? null : "Signature mismatch",
  };
}

function calculateBackoff(attempt) {
  var config = readConfig();
  var base = config.baseBackoffMs || 500;
  var max = config.maxBackoffMs || 10000;
  var jitter = config.jitterMs || 250;
  var exponential = Math.min(base * Math.pow(2, attempt), max);
  var jitterVal = Math.floor(Math.random() * jitter);
  return exponential + jitterVal;
}

function shouldRetry(statusCode) {
  var config = readConfig();
  return (config.retryOnStatus || []).includes(statusCode);
}

function recordDelivery(delivery) {
  var entry = {
    id: "del-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    url: delivery.url,
    orgId: delivery.orgId || null,
    event: delivery.event || null,
    keyId: delivery.keyId || null,
    signed: delivery.signed || false,
    attempt: delivery.attempt || 0,
    status: delivery.status,
    statusCode: delivery.statusCode || null,
    latencyMs: delivery.latencyMs || 0,
    error: delivery.error || null,
    retried: delivery.retried || false,
  };
  deliveryHistory.push(entry);
  if (deliveryHistory.length > MAX_DELIVERY_HISTORY) deliveryHistory.shift();
  return entry;
}

function getDeliveryHistory(limit) {
  limit = limit || 50;
  return deliveryHistory.slice().reverse().slice(0, limit);
}

function clearDeliveryHistory() {
  var count = deliveryHistory.length;
  deliveryHistory.length = 0;
  return { success: true, cleared: count };
}

function getStats() {
  var config = readConfig();
  var totalDeliveries = deliveryHistory.length;
  var successful = 0,
    failed = 0,
    retried = 0,
    signed = 0;
  var byStatus = {},
    byOrg = {};
  for (var i = 0; i < deliveryHistory.length; i++) {
    var d = deliveryHistory[i];
    if (d.status === "success") successful++;
    if (d.status === "failed") failed++;
    if (d.retried) retried++;
    if (d.signed) signed++;
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    if (d.orgId) byOrg[d.orgId] = (byOrg[d.orgId] || 0) + 1;
  }
  var keys = listKeys();
  var byAlgorithm = {};
  for (var j = 0; j < keys.length; j++) {
    byAlgorithm[keys[j].algorithm] = (byAlgorithm[keys[j].algorithm] || 0) + 1;
  }
  return {
    enabled: config.enabled,
    defaultAlgorithm: config.defaultAlgorithm,
    headerName: config.headerName,
    totalDeliveries: totalDeliveries,
    successful: successful,
    failed: failed,
    retried: retried,
    signed: signed,
    unsigned: totalDeliveries - signed,
    signRate: totalDeliveries > 0 ? signed / totalDeliveries : 0,
    successRate: totalDeliveries > 0 ? successful / totalDeliveries : 0,
    byStatus: byStatus,
    byOrg: byOrg,
    keyCount: keys.length,
    byAlgorithm: byAlgorithm,
    maxRetries: config.maxRetries,
    retryOnStatus: config.retryOnStatus,
  };
}

function testSign(payload, keyId) {
  if (!keyId) {
    var keys = listKeys();
    if (keys.length === 0) {
      var gen = generateKeyPair(
        "test-key-" + crypto.randomBytes(4).toString("hex"),
        readConfig().defaultAlgorithm,
        null,
      );
      keyId = gen.keyId;
    } else {
      keyId = keys[0].keyId;
    }
  }
  var payloadStr =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  var signResult = signPayload(payloadStr, keyId);
  var verifyResult = verifySignature(payloadStr, signResult.signature, keyId);
  return {
    keyId: keyId,
    algorithm: signResult.algorithm,
    signature: signResult.signature,
    timestamp: signResult.timestamp,
    verified: verifyResult.valid,
    signatureLength: signResult.signature.length,
  };
}

module.exports = {
  SUPPORTED_ALGORITHMS: SUPPORTED_ALGORITHMS,
  getConfig: getConfig,
  updateConfig: updateConfig,
  resetConfig: resetConfig,
  generateKeyPair: generateKeyPair,
  loadKey: loadKey,
  listKeys: listKeys,
  deleteKey: deleteKey,
  getOrCreateOrgKey: getOrCreateOrgKey,
  signPayload: signPayload,
  buildSignatureHeaders: buildSignatureHeaders,
  verifySignature: verifySignature,
  calculateBackoff: calculateBackoff,
  shouldRetry: shouldRetry,
  recordDelivery: recordDelivery,
  getDeliveryHistory: getDeliveryHistory,
  clearDeliveryHistory: clearDeliveryHistory,
  getStats: getStats,
  testSign: testSign,
};
