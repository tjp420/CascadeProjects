# Stage 2: Azure Key Vault Managed HSM Infrastructure

## Overview

Bicep templates and deployment scripts for provisioning an Azure Key Vault
Managed HSM pool (FIPS 140-2 Level 3) for use with `AzureKeyVaultHsmAdapter`.

## Files

| File | Purpose |
|------|---------|
| `managed-hsm.bicep` | Bicep template: HSM pool + RBAC role assignments |
| `managed-hsm.parameters.json` | Deployment parameters (fill in before deploy) |
| `deploy-managed-hsm.sh` | Bash deployment script using Azure CLI |

## Architecture

```
┌─────────────────────────────────────────────┐
│           Resource Group                     │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │     Managed HSM Pool (B1)            │   │
│  │                                      │   │
│  │  Partition 1  Partition 2            │   │
│  │  ┌─────────┐  ┌─────────┐           │   │
│  │  │ AES-256 │  │ AES-256 │           │   │
│  │  │ KEKs    │  │ KEKs    │           │   │
│  │  └─────────┘  └─────────┘           │   │
│  └──────────────────────────────────────┘   │
│          ▲                                   │
│          │ RBAC                               │
│  ┌───────┴──────────────────────────────┐   │
│  │  User-Assigned Managed Identity       │   │
│  │  Roles:                               │   │
│  │    - Managed HSM Crypto User          │   │
│  │    - Managed HSM Crypto Officer       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Deployment

### Prerequisites

1. Azure CLI (`az`) installed
2. Logged in: `az login`
3. Contributor + RBAC Administrator on the target resource group
4. A user-assigned managed identity already created

### Deploy via script

```bash
AZURE_SUBSCRIPTION_ID=<sub-id> \
RESOURCE_GROUP=<rg-name> \
APP_PRINCIPAL_ID=<managed-identity-principal-id> \
HSM_NAME=cascade-hsm-prod \
./deploy-managed-hsm.sh
```

### Deploy via Azure CLI directly

```bash
az deployment group create \
  --resource-group <rg> \
  --template-file managed-hsm.bicep \
  --parameters @managed-hsm.parameters.json
```

### Post-deployment: Activate HSM security domain

Managed HSM requires a security domain activation step before keys can be
created. Follow the [official activation guide](https://learn.microsoft.com/azure/key-vault/managed-hsm/quick-create-cli#activate-your-managed-hsm).

### Post-deployment: Configure the adapter

Set the HSM URL environment variable:

```bash
export AZURE_MANAGED_HSM_URL="https://<hsm-name>.managedhsm.azure.net"
```

## RBAC Role Definitions

| Role | ID | Purpose |
|------|----|---------|
| Managed HSM Crypto User | `e5005938-7b6c-4dac-8c2c-5e1a8a2c2c7b` | wrap/unwrap operations |
| Managed HSM Crypto Officer | `21c3f43a-a529-tttt-bbbb-cccccccccccc` | create/rotate/delete keys |

> **Note**: The Crypto Officer role ID above is a placeholder. Verify the
> actual role definition ID in your Azure tenant via:
> ```bash
> az role definition list --name "Managed HSM Crypto Officer" --query [].id -o tsv
> ```

## Security Considerations

- **Purge protection**: Set `purgeProtectionEnabled: true` for production.
  Once enabled, deleted keys cannot be purged until the retention period
  expires. This is irreversible — the HSM cannot be deleted until all
  retained keys expire.
- **Public network access**: Set `publicNetworkAccess: 'Disabled'` and use
  private endpoints for production deployments.
- **Soft-delete retention**: Minimum 7 days. Increase to 30 for production.
- **HSM activation**: The HSM security domain must be activated with at
  least 3 RSA key pairs (threshold of 2) from independent custodians.

## Cost

Managed HSM Standard_B1: ~$3.50/hour per partition (~$2,520/month per
partition at 730h/month). With 2 partitions: ~$5,040/month.

Use 1 partition for dev/test (no SLA). Use 2+ for production SLA.
