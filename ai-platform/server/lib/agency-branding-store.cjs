/**
 * Agency co-branding for certificate export — stored in .simplebeacon/agency-branding.json
 */

const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache.cjs');

function brandingStorePath(projectRoot) {
    return path.join(projectRoot, '.simplebeacon', 'agency-branding.json');
}

function normalizeBrandingRecord(record = {}) {
    return {
        agency_name: String(record.agency_name || record.agencyName || '').trim(),
        logo_url: String(record.logo_url || record.logoUrl || '').trim(),
        accent_color: String(record.accent_color || record.accentColor || '').trim(),
        updatedAt: record.updatedAt || null
    };
}

function loadAgencyBrandingStore(projectRoot) {
    const storePath = brandingStorePath(projectRoot);
    const raw = readJsonFileCached(storePath);
    if (!raw || typeof raw !== 'object') return {};
    if (raw.branding && typeof raw.branding === 'object') {
        return { default: normalizeBrandingRecord(raw.branding) };
    }
    const out = {};
    for (const [orgId, record] of Object.entries(raw)) {
        if (record && typeof record === 'object') {
            out[orgId] = normalizeBrandingRecord(record);
        }
    }
    return out;
}

function loadAgencyBranding(projectRoot, orgId = 'default') {
    const store = loadAgencyBrandingStore(projectRoot);
    const key = String(orgId || 'default').trim() || 'default';
    return store[key] || store.default || normalizeBrandingRecord({});
}

function saveAgencyBranding(projectRoot, orgId, branding) {
    const storePath = brandingStorePath(projectRoot);
    const key = String(orgId || 'default').trim() || 'default';
    const store = loadAgencyBrandingStore(projectRoot);
    store[key] = {
        ...normalizeBrandingRecord(branding),
        updatedAt: new Date().toISOString()
    };
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    return store[key];
}

module.exports = {
    loadAgencyBranding,
    saveAgencyBranding,
    loadAgencyBrandingStore,
    brandingStorePath
};
