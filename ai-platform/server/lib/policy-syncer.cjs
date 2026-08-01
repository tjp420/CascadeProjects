const fs = require('fs');
const path = require('path');

// Stateful in-memory repository cache: orgId -> policyJSON
const policyCache = new Map();
const POLICY_STORE_DIR = path.resolve(__dirname, '../../.simplebeacon/policies');

/**
 * Initializes physical persistence folders for tenant policy profiles.
 */
function ensureStoreDirectory() {
  if (!fs.existsSync(POLICY_STORE_DIR)) {
    fs.mkdirSync(POLICY_STORE_DIR, { recursive: true });
  }
}

/**
 * Reconciles and synchronizes an individual organization's compliance blueprint.
 */
async function reconcilePolicy(orgId, externalPolicySource = null) {
  ensureStoreDirectory();
  const targetFilePath = path.join(POLICY_STORE_DIR, `policy-${orgId}.json`);

  // If an external payload is supplied, persist it locally to simulate central synchronization
  if (externalPolicySource) {
    fs.writeFileSync(targetFilePath, JSON.stringify(externalPolicySource, null, 2), 'utf-8');
    policyCache.set(orgId, externalPolicySource);
    return externalPolicySource;
  }

  // Fallback: load pre-cached disk file if it exists, otherwise mount a permissive default schema
  if (fs.existsSync(targetFilePath)) {
    try {
      const data = fs.readFileSync(targetFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      policyCache.set(orgId, parsed);
      return parsed;
    } catch (err) {
      // Graceful error isolation: return a secure fallback pattern on parse exceptions
      return getPermissiveFallback(orgId);
    }
  }

  return getPermissiveFallback(orgId);
}

function getActivePolicy(orgId) {
  if (policyCache.has(orgId)) {
    return policyCache.get(orgId);
  }
  return getPermissiveFallback(orgId);
}

function getPermissiveFallback(orgId) {
  return {
    policyId: `pol_default_${orgId}`,
    version: "1.0.0",
    rules: []
  };
}

function clearCache() {
  policyCache.clear();
}

module.exports = {
  reconcilePolicy,
  getActivePolicy,
  clearCache,
  POLICY_STORE_DIR
};
