"use strict";

/**
 * Integration Configuration Store — Per-organization webhook and
 * notification channel configuration with AES-256-GCM encrypted secrets.
 *
 * Supports: Slack, Microsoft Teams, Jira, GitHub PR Comments
 *
 * @module integration-config-store
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("../lib/app-logger.cjs");
const cryptoUtils = require("./crypto-utils.cjs");

const STORE_PATH =
  process.env.INTEGRATION_STORE_PATH ||
  path.join(__dirname, "../../.simplebeacon", "integration-configs.json");

const ENCRYPTION_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  process.env.SIMPLEBEACON_LICENSE_SECRET ||
  "dev-integration-key-change-in-production";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey() {
  return crypto.createHash("sha256").update(String(ENCRYPTION_KEY)).digest();
}

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith("enc:")) return ciphertext;
  const parts = ciphertext.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted secret format");
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const encrypted = Buffer.from(parts[3], "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, null, "utf8") + decipher.final("utf8");
}

function maskSecret(ciphertext) {
  if (!ciphertext) return undefined;
  if (!ciphertext.startsWith("enc:"))
    return String(ciphertext).slice(0, 4) + "****";
  return "****";
}

function decryptClientSecret(ciphertext, orgId) {
  if (!ciphertext) return ciphertext;
  if (cryptoUtils.isOrgEncrypted(ciphertext)) {
    const v = cryptoUtils.decryptForOrg(ciphertext, orgId);
    return v || null;
  }
  return decryptSecret(ciphertext);
}

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    _cache = JSON.parse(raw);
  } catch {
    _cache = { configs: {} };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
  _cache = store;
  _cacheDirty = false;
}

const INTEGRATION_TYPES = {
  slack: {
    id: "slack",
    label: "Slack",
    requiredFields: ["webhookUrl"],
    secretFields: ["webhookUrl"],
    description:
      "Send compliance notifications to Slack channels via incoming webhooks",
  },
  teams: {
    id: "teams",
    label: "Microsoft Teams",
    requiredFields: ["webhookUrl"],
    secretFields: ["webhookUrl"],
    description:
      "Send compliance notifications to Teams channels via incoming webhooks",
  },
  jira: {
    id: "jira",
    label: "Jira",
    requiredFields: ["host", "email", "apiToken", "projectKey"],
    secretFields: ["apiToken"],
    description: "Create Jira issues for compliance violations automatically",
  },
  github: {
    id: "github",
    label: "GitHub PR Comments",
    requiredFields: ["token", "owner", "repo"],
    secretFields: ["token"],
    description: "Post compliance findings as inline PR review comments",
  },
};

const EVENT_TYPES = {
  scan_completed: "Scan Completed",
  scan_failed: "Scan Failed",
  quality_gate_failed: "Quality Gate Failed",
  quality_gate_passed: "Quality Gate Passed",
  high_severity_found: "High Severity Issue Found",
  critical_severity_found: "Critical Severity Issue Found",
  compliance_violation: "Compliance Violation Detected",
  report_generated: "Report Generated",
  trial_started: "Trial Started",
  trial_expiring: "Trial Expiring Soon",
  org_onboarded: "Organization Onboarded",
  budget_threshold_exceeded: "Budget Threshold Exceeded",
};

function maskConfig(config) {
  if (!config) return null;
  const type = INTEGRATION_TYPES[config.type];
  const maskedConfig = { ...config.config };
  if (type) {
    for (const field of type.secretFields) {
      if (maskedConfig[field])
        maskedConfig[field] = maskSecret(maskedConfig[field]);
    }
  }
  return { ...config, config: maskedConfig };
}

function getConfigsByOrg(orgId) {
  const store = readStore();
  return Object.values(store.configs)
    .filter((c) => c.orgId === orgId)
    .map(maskConfig);
}

function getAllConfigs() {
  const store = readStore();
  return Object.values(store.configs).map(maskConfig);
}

function getConfig(configId) {
  const store = readStore();
  return maskConfig(store.configs[configId] || null);
}

function getConfigDecrypted(configId) {
  const store = readStore();
  const config = store.configs[configId];
  if (!config) return null;
  const decrypted = { ...config.config };
  const type = INTEGRATION_TYPES[config.type];
  if (type) {
    for (const field of type.secretFields) {
      if (decrypted[field])
        decrypted[field] = decryptClientSecret(decrypted[field], config.orgId);
    }
  }
  return { ...config, config: decrypted };
}

function getConfigsByOrgDecrypted(orgId) {
  const store = readStore();
  return Object.values(store.configs)
    .filter((c) => c.orgId === orgId && c.enabled)
    .map((c) => {
      const decrypted = { ...c.config };
      const type = INTEGRATION_TYPES[c.type];
      if (type) {
        for (const field of type.secretFields) {
          if (decrypted[field])
            decrypted[field] = decryptClientSecret(decrypted[field], c.orgId);
        }
      }
      return { ...c, config: decrypted };
    });
}

function createConfig(params) {
  const store = readStore();
  const configId = `int-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();
  const type = INTEGRATION_TYPES[params.type];
  if (!type) throw new Error(`Unknown integration type: ${params.type}`);
  for (const field of type.requiredFields) {
    if (!params[field]) throw new Error(`Missing required field: ${field}`);
  }

  const config = {
    configId,
    orgId: params.orgId,
    type: params.type,
    name: params.name || `${type.label} — ${params.orgId || "default"}`,
    enabled: params.enabled !== false,
    events: params.events || Object.keys(EVENT_TYPES),
    config: {},
    createdAt: now,
    updatedAt: now,
  };

  for (const [key, value] of Object.entries(params)) {
    if (
      [
        "configId",
        "orgId",
        "type",
        "name",
        "enabled",
        "events",
        "createdAt",
        "updatedAt",
      ].includes(key)
    )
      continue;
    if (type.secretFields.includes(key)) {
      config.config[key] = cryptoUtils.encryptForOrg(
        String(value),
        params.orgId,
      );
    } else {
      config.config[key] = value;
    }
  }

  store.configs[configId] = config;
  writeStore(store);
  logger.info(
    `[Integrations] Created ${params.type} config ${configId} for org ${params.orgId}`,
  );
  return maskConfig(config);
}

function updateConfig(configId, updates) {
  const store = readStore();
  const config = store.configs[configId];
  if (!config) throw new Error(`Integration config not found: ${configId}`);
  const type = INTEGRATION_TYPES[config.type];

  if (updates.name !== undefined) config.name = updates.name;
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.events !== undefined) config.events = updates.events;
  if (updates.orgId !== undefined) config.orgId = updates.orgId;

  for (const [key, value] of Object.entries(updates)) {
    if (
      [
        "configId",
        "orgId",
        "type",
        "name",
        "enabled",
        "events",
        "createdAt",
        "updatedAt",
      ].includes(key)
    )
      continue;
    if (type.secretFields.includes(key)) {
      config.config[key] = cryptoUtils.encryptForOrg(
        String(value),
        config.orgId,
      );
    } else {
      config.config[key] = value;
    }
  }

  config.updatedAt = new Date().toISOString();
  store.configs[configId] = config;
  writeStore(store);
  return maskConfig(config);
}

function deleteConfig(configId) {
  const store = readStore();
  if (!store.configs[configId]) return false;
  delete store.configs[configId];
  writeStore(store);
  logger.info(`[Integrations] Deleted config ${configId}`);
  return true;
}

function getStats() {
  const store = readStore();
  const configs = Object.values(store.configs);
  return {
    total: configs.length,
    enabled: configs.filter((c) => c.enabled).length,
    byType: Object.keys(INTEGRATION_TYPES).reduce((acc, t) => {
      acc[t] = configs.filter((c) => c.type === t).length;
      return acc;
    }, {}),
  };
}

module.exports = {
  INTEGRATION_TYPES,
  EVENT_TYPES,
  getConfigsByOrg,
  getAllConfigs,
  getConfig,
  getConfigDecrypted,
  getConfigsByOrgDecrypted,
  createConfig,
  updateConfig,
  deleteConfig,
  getStats,
  maskConfig,
};
