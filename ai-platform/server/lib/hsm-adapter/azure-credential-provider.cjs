'use strict';

/**
 * Azure credential provider for the Key Vault HSM adapter.
 *
 * Lazily loads @azure/identity and returns a DefaultAzureCredential.
 * In test environments, the `createCredential` export can be patched
 * to return a mock credential.
 *
 * @module hsm-adapter/azure-credential-provider
 */

let _cachedCredential = null;

/**
 * Create or return a cached Azure credential.
 * @returns {Promise<object>} Azure TokenCredential
 */
async function createCredential() {
  if (_cachedCredential) {
    return _cachedCredential;
  }
  let identity;
  try {
    identity = await import('@azure/identity');
  } catch (e) {
    throw new Error(
      `@azure/identity is not installed. Install it with: npm install @azure/identity. Original error: ${e.message}`
    );
  }
  _cachedCredential = new identity.DefaultAzureCredential();
  return _cachedCredential;
}

/**
 * Reset the cached credential (for testing).
 */
function resetCredentialCache() {
  _cachedCredential = null;
}

module.exports = { createCredential, resetCredentialCache };
