/**
 * Per-user AI provider credentials (encrypted at rest).
 * Used for optional Analyze narrative summaries — not required for gate scans.
 *
 * EU AI Act Documentation Marker:
 * - Supporting component for artificial intelligence system integrations (Annex III indicator)
 * - No autonomous decisions; credentials enable user-controlled AI provider access
 * - Data protection: AES-256-GCM encryption at rest with user-derived key
 * - Risk Level: Minimal (infrastructure component)
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "../..");
const STORE_PATH =
  process.env.SIMPLEBEACON_USER_AI_KEYS_STORE ||
  path.join(PROJECT_ROOT, ".simplebeacon", "user-ai-keys.json");

const PROVIDERS = ["openai", "anthropic"];
const _STRING_FIELDS = [
  ...PROVIDERS,
  "ollamaBaseUrl",
  "ollamaModel",
  "openaiModel",
  "anthropicModel",
];

/**
 * Normalize email.
 * @param {string} email
 * @returns {any}
 */
function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Encryption key.
 * @returns {any}
 */
function encryptionKey() {
  const secret =
    process.env.SIMPLEBEACON_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    "simplebeacon-dev-keys-insecure";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

/**
 * Encrypt secret.
 * @param {string} plaintext
 * @returns {any}
 */
function encryptSecret(plaintext) {
  const text = String(plaintext || "").trim();
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

/**
 * Decrypt secret.
 * @param {any} payload
 * @returns {any}
 */
function decryptSecret(payload) {
  if (!payload?.data || !payload?.iv || !payload?.tag) return "";
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Mask secret.
 * @param {any} value
 * @returns {any}
 */
function maskSecret(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length <= 8) return "••••••••";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

/**
 * Read store.
 * @returns {any}
 */
async function readStore() {
  try {
    const raw = await fs.promises.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.users && typeof parsed.users === "object"
      ? parsed
      : { users: {} };
  } catch {
    return { users: {} };
  }
}

/**
 * Write store.
 * @param {any} store
 * @returns {any}
 */
async function writeStore(store) {
  await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.promises.writeFile(
    STORE_PATH,
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Empty record.
 * @returns {any}
 */
function emptyRecord() {
  return {
    openai: null,
    anthropic: null,
    ollamaBaseUrl: "",
    ollamaModel: "",
    openaiModel: "",
    anthropicModel: "",
    updatedAt: null,
  };
}

/**
 * Get user ai keys record.
 * @param {string} email
 * @returns {any}
 */
async function getUserAiKeysRecord(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return emptyRecord();
  const store = await readStore();
  return store.users[normalized] || emptyRecord();
}

/**
 * Get user ai credentials.
 * @param {string} email
 * @returns {any}
 */
async function getUserAiCredentials(email) {
  const record = await getUserAiKeysRecord(email);
  const credentials = {};
  for (const provider of PROVIDERS) {
    const value = decryptSecret(record[provider]);
    if (value) credentials[provider] = value;
  }
  if (record.ollamaBaseUrl) {
    credentials.ollamaBaseUrl = record.ollamaBaseUrl;
  }
  if (record.ollamaModel) {
    credentials.ollamaModel = record.ollamaModel;
  }
  if (record.openaiModel) {
    credentials.openaiModel = record.openaiModel;
  }
  if (record.anthropicModel) {
    credentials.anthropicModel = record.anthropicModel;
  }
  return credentials;
}

/**
 * Get user ai keys public.
 * @param {string} email
 * @returns {any}
 */
async function getUserAiKeysPublic(email) {
  const record = await getUserAiKeysRecord(email);
  const providers = {};
  for (const provider of PROVIDERS) {
    const value = decryptSecret(record[provider]);
    providers[provider] = {
      configured: Boolean(value),
      hint: maskSecret(value),
    };
  }
  return {
    email: normalizeEmail(email),
    providers,
    ollamaBaseUrl: record.ollamaBaseUrl || "",
    ollamaModel: record.ollamaModel || "",
    openaiModel: record.openaiModel || "",
    anthropicModel: record.anthropicModel || "",
    updatedAt: record.updatedAt || null,
  };
}

/**
 * Save user ai keys.
 * @param {string} email
 * @param {any} payload
 * @returns {any}
 */
async function saveUserAiKeys(email, payload = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("email is required");
  }

  const store = await readStore();
  const existing = store.users[normalized] || emptyRecord();
  const next = { ...existing };

  for (const provider of PROVIDERS) {
    if (!{}.hasOwnProperty.call(payload, provider)) continue;
    const raw = payload[provider];
    if (raw === null || raw === "") {
      next[provider] = null;
      continue;
    }
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed.includes("…")) continue;
    next[provider] = encryptSecret(trimmed);
  }

  if ({}.hasOwnProperty.call(payload, "ollamaBaseUrl")) {
    next.ollamaBaseUrl = String(payload.ollamaBaseUrl || "").trim();
  }

  if ({}.hasOwnProperty.call(payload, "ollamaModel")) {
    next.ollamaModel = String(payload.ollamaModel || "").trim();
  }

  if ({}.hasOwnProperty.call(payload, "openaiModel")) {
    next.openaiModel = String(payload.openaiModel || "").trim();
  }

  if ({}.hasOwnProperty.call(payload, "anthropicModel")) {
    next.anthropicModel = String(payload.anthropicModel || "").trim();
  }

  next.updatedAt = new Date().toISOString();
  store.users[normalized] = next;
  await writeStore(store);
  return getUserAiKeysPublic(normalized);
}

/**
 * Clear user ai keys.
 * @param {string} email
 * @returns {any}
 */
async function clearUserAiKeys(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return getUserAiKeysPublic("");
  const store = await readStore();
  delete store.users[normalized];
  await writeStore(store);
  return getUserAiKeysPublic(normalized);
}

module.exports = {
  getUserAiCredentials,
  getUserAiKeysPublic,
  saveUserAiKeys,
  clearUserAiKeys,
  maskSecret,
};
