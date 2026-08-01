#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Stage 2: Deploy Azure Key Vault Managed HSM
# ─────────────────────────────────────────────────────────────────
# Usage:
#   AZURE_SUBSCRIPTION_ID=<sub-id> \
#   RESOURCE_GROUP=<rg-name> \
#   APP_PRINCIPAL_ID=<managed-identity-principal-id> \
#   HSM_NAME=<hsm-name> \
#   ./deploy-managed-hsm.sh
#
# Prerequisites:
#   - Azure CLI (az) installed and logged in
#   - Contributor + Role Based Access Control Administrator on the RG
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

: "${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"
: "${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
: "${APP_PRINCIPAL_ID:?APP_PRINCIPAL_ID is required}"
: "${HSM_NAME:=cascade-hsm-dev}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Setting Azure subscription to ${AZURE_SUBSCRIPTION_ID}"
az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

echo "==> Deploying Managed HSM '${HSM_NAME}' to RG '${RESOURCE_GROUP}'"
DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "${RESOURCE_GROUP}" \
  --template-file "${SCRIPT_DIR}/managed-hsm.bicep" \
  --parameters \
    hsmName="${HSM_NAME}" \
    appPrincipalId="${APP_PRINCIPAL_ID}" \
  --query 'properties.outputs' --output json)

HSM_URL=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.hsmUrl.value')
HSM_ID=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.hsmId.value')

echo ""
echo "==> Managed HSM deployed successfully"
echo "    HSM URL:  ${HSM_URL}"
echo "    HSM ID:   ${HSM_ID}"
echo ""
echo "==> Set these environment variables for the adapter:"
echo "    AZURE_MANAGED_HSM_URL=${HSM_URL}"
echo ""
echo "==> Next: activate the HSM security domain"
echo "    See: https://learn.microsoft.com/azure/key-vault/managed-hsm/quick-create-cli#activate-your-managed-hsm"
