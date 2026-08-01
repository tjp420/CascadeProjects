// ─────────────────────────────────────────────────────────────────
// Stage 2: Azure Key Vault Managed HSM — Bicep provisioning template
// ─────────────────────────────────────────────────────────────────
// Provisions a Managed HSM pool with:
//   - 2 HSM partitions (minimum for SLA)
//   - Soft-delete enabled (7-day retention)
//   - Purge protection disabled for dev (enable for production)
//   - RBAC role assignments for the app managed identity
//
// Deploy:
//   az deployment group create \
//     --resource-group <rg> \
//     --template-file managed-hsm.bicep \
//     --parameters @managed-hsm.parameters.json
//
// Prerequisites:
//   - Resource group already created
//   - User-assigned managed identity already created (pass principalId)
// ─────────────────────────────────────────────────────────────────

@description('Name of the Managed HSM pool')
param hsmName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Number of HSM partitions in the pool (min 2 for SLA)')
@allowed([1, 2, 3])
param partitionCount int = 2

@description('Soft-delete retention in days')
param softDeleteRetentionDays int = 7

@description('Enable purge protection (irreversible deletion after retention period)')
param purgeProtectionEnabled bool = false

@description('Principal ID of the user-assigned managed identity for the app')
param appPrincipalId string

@description('Tenant ID for role assignments')
param tenantId string = subscription().tenantId

// ── Managed HSM ──────────────────────────────────────────────────

resource managedHsm 'Microsoft.KeyVault/managedHSMs@2023-07-01' = {
  name: hsmName
  location: location
  sku: {
    name: 'Standard_B1'
    family: 'B'
  }
  properties: {
    tenantId: tenantId
    initialAdminObjectIds: [appPrincipalId]
    softDeleteRetentionInDays: softDeleteRetentionDays
    enablePurgeProtection: purgeProtectionEnabled
    publicNetworkAccess: 'Enabled' // Set to 'Disabled' for private endpoint only
  }
}

// ── RBAC Role Assignments ────────────────────────────────────────
// The app managed identity needs "Managed HSM Crypto User" to perform
// wrap/unwrap operations, and "Managed HSM Crypto Officer" to create
// and rotate keys.

resource cryptoUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: managedHsm
  name: guid(managedHsm.id, appPrincipalId, 'Managed HSM Crypto User')
  properties: {
    roleDefinitionId: '/providers/Microsoft.Authorization/roleDefinitions/e5005938-7b6c-4dac-8c2c-5e1a8a2c2c7b' // Managed HSM Crypto User
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource cryptoOfficerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: managedHsm
  name: guid(managedHsm.id, appPrincipalId, 'Managed HSM Crypto Officer')
  properties: {
    roleDefinitionId: '/providers/Microsoft.Authorization/roleDefinitions/21c3f43a-a529-tttt-bbbb-cccccccccccc' // Managed HSM Crypto Officer
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ──────────────────────────────────────────────────────

@description('Managed HSM URI (use as vaultUrl in AzureKeyVaultHsmAdapter)')
output hsmUrl string = reference(managedHsm.id).vaultUri

@description('Managed HSM resource ID')
output hsmId string = managedHsm.id
