'use strict';

/**
 * ZK Tenant Governance Wrapper
 *
 * Provides tenant isolation for ZK claim validators by wrapping existing
 * validators with per-tenant policy resolution from CryptoPolicyEngine
 * and standardized metrics tracking.
 *
 * @module hsm-adapter/zk-tenant-governance
 */

const { incrementCounter } = require('./hsm-metrics.cjs');

const TENANT_ID_PATTERN = /^[a-zA-Z0-9-_]+$/;
const DEFAULT_TENANT = 'default';

function validateTenantId(tenantId) {
  return typeof tenantId === 'string' && TENANT_ID_PATTERN.test(tenantId) && tenantId.length > 0 && tenantId.length <= 128;
}

function resolvePolicy(engine, tenantId, domainName) {
  if (!engine || typeof engine.getPolicy !== 'function') {
    throw new Error('ZK_TENANT_GOVERNANCE: invalid policy engine');
  }
  if (!validateTenantId(tenantId)) {
    incrementCounter('hsm_zk_tenant_isolation_violation_total');
    throw new Error('ZK_TENANT_GOVERNANCE: invalid tenant ID: ' + String(tenantId));
  }
  const policy = engine.getPolicy(tenantId);
  if (!policy[domainName]) {
    const defaultPolicy = engine.getPolicy(DEFAULT_TENANT);
    if (!defaultPolicy[domainName]) {
      throw new Error('ZK_TENANT_GOVERNANCE: unknown domain: ' + domainName);
    }
    return defaultPolicy[domainName];
  }
  return policy[domainName];
}

function trackVerification(domainName, tenantId, outcome) {
  const counterName = 'hsm_zk_' + domainName + '_claim_' + (outcome === 'verified' ? 'verified' : 'failed') + '_total';
  incrementCounter(counterName);
  if (outcome === 'verified') {
    incrementCounter('hsm_zk_tenant_context_validated_total');
  }
}

function wrapWithTenantGovernance(validator, engine, domainName, verifyMethod, metricDomain) {
  if (!validator || typeof validator !== 'object') {
    throw new Error('ZK_TENANT_GOVERNANCE: invalid validator');
  }
  if (typeof validator[verifyMethod] !== 'function') {
    throw new Error('ZK_TENANT_GOVERNANCE: validator missing method: ' + verifyMethod);
  }

  const originalVerify = validator[verifyMethod].bind(validator);

  validator.validateTenant = function(tenantId, request) {
    const domainPolicy = resolvePolicy(engine, tenantId, domainName);
    const savedPolicy = this.policy;
    this.policy = domainPolicy;
    try {
      const result = originalVerify(request);
      trackVerification(metricDomain, tenantId, 'verified');
      return result;
    } catch (err) {
      trackVerification(metricDomain, tenantId, 'failed');
      throw err;
    } finally {
      this.policy = savedPolicy;
    }
  };

  validator.validate = validator.validateTenant;
  return validator;
}

module.exports = {
  validateTenantId,
  resolvePolicy,
  trackVerification,
  wrapWithTenantGovernance,
  DEFAULT_TENANT,
};
