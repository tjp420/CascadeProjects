"use strict";

/**
 * Track 45: Cross-tenant access auditor.
 *
 * Intercepts cross-boundary key use and blinded PIR queries, forces
 * both the requesting and resource-owning tenants to exchange signed
 * approvals, and verifies hardware attestation on both endpoints.
 *
 * @module hsm-adapter/cross-tenant-access-auditor
 */

const { HsmAdapterError } = require("./base-adapter.cjs");
const { AccessProofReceipt } = require("./access-proof-receipt.cjs");

class CrossTenantAccessAuditor {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
  }

  /**
   * Recognize and authorize a cross-tenant access.
   * @param {object} request
   * @returns {object}
   */
  recognize(request) {
    _validateRequestShape(this.policy, request);
    _validateAttestations(this.policy, this._attestationClient, request);
    _validateQuorums(this.policy, request);

    if (this._audit) {
      this._audit("CROSS_TENANT_ACCESS_RECOGNIZED", {
        requester: request.requestingTenant,
        owner: request.resourceOwnerTenant,
        operation: request.operation,
        resourceId: request.resourceId,
      });
    }
    const receipt = new AccessProofReceipt({
      requestingTenant: request.requestingTenant,
      resourceOwnerTenant: request.resourceOwnerTenant,
      operation: request.operation,
      resourceId: request.resourceId,
      requesterSignatures: request.requesterSignatures,
      ownerSignatures: request.ownerSignatures,
      timestamp: request.timestamp,
    });
    const serialized = receipt.serialize();
    if (this._audit) {
      this._audit("AUDIT_RECEIPT_CHAINED", {
        receiptHash: receipt.leafHash,
        requestingTenant: request.requestingTenant,
      });
    }
    return { recognized: true, receipt, serialized };
  }
}

function _validateRequestShape(policy, request) {
  if (
    typeof request.requestingTenant !== "string" ||
    !request.requestingTenant
  ) {
    throw new HsmAdapterError(
      "AUDIT_REQUESTER_MISSING",
      "requesting tenant is required",
    );
  }
  if (
    typeof request.resourceOwnerTenant !== "string" ||
    !request.resourceOwnerTenant
  ) {
    throw new HsmAdapterError(
      "AUDIT_OWNER_MISSING",
      "resource owner tenant is required",
    );
  }
  if (typeof request.resourceId !== "string" || !request.resourceId) {
    throw new HsmAdapterError(
      "AUDIT_RESOURCE_MISSING",
      "resource id is required",
    );
  }
  if (
    typeof request.operation !== "string" ||
    !policy.allowedOperations.includes(request.operation)
  ) {
    throw new HsmAdapterError(
      "AUDIT_OPERATION_BLOCKED",
      `operation ${request.operation} is not allowed`,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const window = now - (request.timestamp || now);
  if (window > policy.maxVerificationWindowSeconds) {
    throw new HsmAdapterError(
      "AUDIT_WINDOW_EXPIRED",
      `verification window ${window}s exceeds maximum ${policy.maxVerificationWindowSeconds}s`,
    );
  }
}

function _validateAttestations(policy, attestationClient, request) {
  if (!policy.requireAttestationForBothEndpoints) return;
  const endpoints = [request.requesterAttestation, request.ownerAttestation];
  for (const attestation of endpoints) {
    if (!attestation) {
      throw new HsmAdapterError(
        "AUDIT_ATTESTATION_MISSING",
        "attestation is required for both endpoints",
      );
    }
    if (attestationClient) {
      const result = attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError(
          "AUDIT_ATTESTATION_INVALID",
          "endpoint attestation is not valid",
        );
      }
    }
  }
}

function _validateQuorums(policy, request) {
  const min = policy.minSignatureQuorumPerTenant || 2;
  if ((request.requesterSignatures || []).length < min) {
    throw new HsmAdapterError(
      "AUDIT_REQUESTER_QUORUM_INSUFFICIENT",
      `requester signatures ${(request.requesterSignatures || []).length} below minimum ${min}`,
    );
  }
  if ((request.ownerSignatures || []).length < min) {
    throw new HsmAdapterError(
      "AUDIT_OWNER_QUORUM_INSUFFICIENT",
      `owner signatures ${(request.ownerSignatures || []).length} below minimum ${min}`,
    );
  }
}

module.exports = { CrossTenantAccessAuditor };
