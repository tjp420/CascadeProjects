'use strict';

/**
 * Stage 2: Azure Key Vault credential provider.
 *
 * Factory for DefaultAzureCredential chains targeting Managed HSM pools.
 * Supports managed identities, service principals, Azure CLI, and
 * interactive browser fallback for local development.
 *
 * @module hsm-adapter/azure-credential-provider
 */

/**
 * Create an Azure credential using DefaultAzureCredential.
 *
 * The credential chain tries (in order):
 *   1. ManagedIdentityCredential (production: VM / App Service / Container Apps)
 *   2. EnvironmentCredential (service principal via AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET)
 *   3. AzureCliCredential (local development)
 *   4. InteractiveBrowserCredential (last-resort local dev)
 *
 * For Managed HSM, the credential must have the "Managed HSM Crypto User"
 * or "Managed HSM Crypto Officer" role assignment on the target pool.
 *
 * @param {object} [options]
 * @param {string} [options.tenantId] - override for multi-tenant SP auth
 * @param {string} [options.managedIdentityClientId] - user-assigned MI client ID
 * @returns {Promise<object>} Azure credential instance
 */
async function createCredential(options = {}) {
  const { DefaultAzureCredential } = await import('@azure/identity');
  return new DefaultAzureCredential({
    tenantId: options.tenantId,
    managedIdentityClientId: options.managedIdentityClientId,
  });
}

module.exports = { createCredential };
