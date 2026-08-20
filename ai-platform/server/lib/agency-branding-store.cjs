/**
 * Agency co-branding for certificate export — stored in .simplebeacon/agency-branding.json
 *
 * @license MIT
 */

const fs = require("fs");
const path = require("path");
const { readJsonFileCached } = require("./json-file-cache.cjs");

/**
 * Compute the absolute path to the agency branding store JSON file.
 * @param {string} projectRoot - Root directory of the project.
 * @returns {string}
 */
function brandingStorePath(projectRoot) {
  return path.join(projectRoot, ".simplebeacon", "agency-branding.json");
}

/**
 * Normalize a raw branding record into the canonical shape.
 * @param {Object} [record={}] - Raw branding record.
 * @returns {{agency_name:string,logo_url:string,accent_color:string,updatedAt:string|null}}
 */
function normalizeBrandingRecord(record = {}) {
  return {
    agency_name: String(record.agency_name || record.agencyName || "").trim(),
    logo_url: String(record.logo_url || record.logoUrl || "").trim(),
    accent_color: String(
      record.accent_color || record.accentColor || "",
    ).trim(),
    updatedAt: record.updatedAt || null,
  };
}

/**
 * Load and normalize the full agency branding store.
 * @param {string} projectRoot - Root directory of the project.
 * @returns {Object.<string, {agency_name:string,logo_url:string,accent_color:string,updatedAt:string|null}>}
 */
function loadAgencyBrandingStore(projectRoot) {
  const storePath = brandingStorePath(projectRoot);
  const raw = readJsonFileCached(storePath);
  if (!raw || typeof raw !== "object") return {};
  if (raw.branding && typeof raw.branding === "object") {
    return { default: normalizeBrandingRecord(raw.branding) };
  }
  const out = {};
  for (const [orgId, record] of Object.entries(raw)) {
    if (record && typeof record === "object") {
      out[orgId] = normalizeBrandingRecord(record);
    }
  }
  return out;
}

/**
 * Load agency branding.
 * @param {any} projectRoot
 * @param {string} orgId
 * @returns {any}
 */
function loadAgencyBranding(projectRoot, orgId = "default") {
  const store = loadAgencyBrandingStore(projectRoot);
  const key = String(orgId || "default").trim() || "default";
  return store[key] || store.default || normalizeBrandingRecord({});
}

/**
 * Save agency branding.
 * @param {any} projectRoot
 * @param {string} orgId
 * @param {any} branding
 * @returns {any}
 */
function saveAgencyBranding(projectRoot, orgId, branding) {
  const storePath = brandingStorePath(projectRoot);
  const key = String(orgId || "default").trim() || "default";
  const store = loadAgencyBrandingStore(projectRoot);
  store[key] = {
    ...normalizeBrandingRecord(branding),
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return store[key];
}

/**
 * Resolve logo src.
 * @param {any} branding
 * @returns {any}
 */
function resolveLogoSrc(branding = {}) {
  const url = branding.logo_url || branding.logoUrl || "";
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return url;
  return null;
}

module.exports = {
  loadAgencyBranding,
  saveAgencyBranding,
  loadAgencyBrandingStore,
  brandingStorePath,
  resolveLogoSrc,
};
