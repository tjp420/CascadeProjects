"use strict";

/**
 * ZK Tenant Governance Wrapper
 *
 * Provides tenant isolation for ZK claim validators by wrapping existing
 * validators with per-tenant policy resolution from CryptoPolicyEngine
 * and standardized metrics tracking.
 *
 * Concurrent safety: validateTenant uses a per-call Proxy facade so
 * this.policy is never mutated on the shared validator instance.
 *
 * @module hsm-adapter/zk-tenant-governance
 */

const { incrementCounter } = require("./hsm-metrics.cjs");

const TENANT_ID_PATTERN = /^[a-zA-Z0-9-_]+$/;
const DEFAULT_TENANT = "default";

/** Optional SiemSecurityBroker; stdout JSON fallback when unset. */
let _siemBroker = null;

const TRACK125_VALIDATOR_SPECS = Object.freeze([
  {
    key: "energy",
    modulePath: "./zk-energy-claim-validator.cjs",
    exportName: "ZkEnergyClaimValidator",
    method: "verifyEnergyClaim",
    domain: "energyGating",
    metric: "energy",
  },
  {
    key: "biometric",
    modulePath: "./zk-biometric-claim-validator.cjs",
    exportName: "ZkBiometricClaimValidator",
    method: "verifyBiometricClaim",
    domain: "biometricGating",
    metric: "biometric",
  },
  {
    key: "neural",
    modulePath: "./zk-neural-claim-validator.cjs",
    exportName: "ZkNeuralClaimValidator",
    method: "verifyNeuralClaim",
    domain: "neuralGating",
    metric: "neural",
  },
  {
    key: "lookup",
    modulePath: "./zk-lookup-claim-validator.cjs",
    exportName: "ZkLookupClaimValidator",
    method: "validate",
    domain: "lookupGating",
    metric: "lookup",
    ctorStyle: "policyArg",
  },
  {
    key: "storage",
    modulePath: "./zk-storage-claim-validator.cjs",
    exportName: "ZkStorageClaimValidator",
    method: "validateClaim",
    domain: "storageGating",
    metric: "storage",
  },
  {
    key: "authentication",
    modulePath: "./zk-authentication-claim-validator.cjs",
    exportName: "ZkAuthenticationClaimValidator",
    method: "verifyAuthenticationClaim",
    domain: "authenticationGating",
    metric: "authentication",
  },
  {
    key: "drone",
    modulePath: "./zk-drone-claim-validator.cjs",
    exportName: "ZkDroneClaimValidator",
    method: "validateClaim",
    domain: "droneGating",
    metric: "drone",
  },
  {
    key: "genomic",
    modulePath: "./zk-genomic-claim-validator.cjs",
    exportName: "ZkGenomicClaimValidator",
    method: "verifyGenomicClaim",
    domain: "genomicGating",
    metric: "genomic",
  },
  {
    key: "insurance",
    modulePath: "./zk-insurance-claim-validator.cjs",
    exportName: "ZkInsuranceClaimValidator",
    method: "verifyClaimAudit",
    domain: "insuranceGating",
    metric: "insurance",
  },
  {
    key: "quantum",
    modulePath: "./zk-quantum-claim-validator.cjs",
    exportName: "ZkQuantumClaimValidator",
    method: "verifyQuantumClaim",
    domain: "quantumGating",
    metric: "quantum",
  },
]);

function setZkGovernanceSiemBroker(broker) {
  _siemBroker = broker || null;
}

function getZkGovernanceSiemBroker() {
  return _siemBroker;
}

function validateTenantId(tenantId) {
  return (
    typeof tenantId === "string" &&
    TENANT_ID_PATTERN.test(tenantId) &&
    tenantId.length > 0 &&
    tenantId.length <= 128
  );
}

/**
 * Emit zk_isolation_violation via SIEM broker (preferred) or structured stdout.
 * @param {unknown} tenantId
 * @param {string} reason
 */
function emitZkIsolationViolation(tenantId, reason) {
  incrementCounter("hsm_zk_tenant_isolation_violation_total");
  const payload = {
    siemSeverity: "CRITICAL",
    siemCategory: "zk_isolation_violation",
    siemSource: "zk-tenant-governance",
    context: {
      tenantId: tenantId == null ? null : String(tenantId),
      reason: reason || "invalid_tenant_id",
    },
  };
  try {
    if (_siemBroker && typeof _siemBroker.logEvent === "function") {
      _siemBroker.logEvent(payload);
    } else {
      console.error(
        JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (_siemErr) {
    /* fail-silent SIEM path — counter already incremented */
  }
}

function resolvePolicy(engine, tenantId, domainName) {
  if (!engine || typeof engine.getPolicy !== "function") {
    throw new Error("ZK_TENANT_GOVERNANCE: invalid policy engine");
  }
  if (!validateTenantId(tenantId)) {
    emitZkIsolationViolation(tenantId, "invalid_tenant_id_format");
    throw new Error(
      "zk_isolation_violation: invalid tenant ID: " + String(tenantId),
    );
  }
  const policy = engine.getPolicy(tenantId);
  if (!policy[domainName]) {
    const defaultPolicy = engine.getPolicy(DEFAULT_TENANT);
    if (!defaultPolicy[domainName]) {
      throw new Error("ZK_TENANT_GOVERNANCE: unknown domain: " + domainName);
    }
    return defaultPolicy[domainName];
  }
  return policy[domainName];
}

function trackVerification(domainName, tenantId, outcome) {
  const counterName =
    "hsm_zk_" +
    domainName +
    "_claim_" +
    (outcome === "verified" ? "verified" : "failed") +
    "_total";
  incrementCounter(counterName);
  if (outcome === "verified") {
    incrementCounter("hsm_zk_tenant_context_validated_total");
  }
}

/**
 * Per-call facade: reads of `policy` return the tenant domain policy without
 * mutating the shared validator instance (safe under concurrent validateTenant).
 * @param {object} validator
 * @param {object} domainPolicy
 * @returns {object}
 */
function createPolicyFacade(validator, domainPolicy) {
  return new Proxy(validator, {
    get(target, prop, receiver) {
      if (prop === "policy") {
        return domainPolicy;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return function policyFacadeBound(...args) {
          return Reflect.apply(value, receiver, args);
        };
      }
      return value;
    },
  });
}

/**
 * Lookup validator bakes policy into private fields at construction.
 * Run verification on an ephemeral instance so concurrent tenants do not race.
 * @param {object} validator
 * @param {object} domainPolicy
 * @param {unknown} request
 * @returns {unknown}
 */
function runLookupWithIsolatedPolicy(validator, domainPolicy, request) {
  const Ctor = validator.constructor;
  if (typeof Ctor !== "function") {
    throw new Error(
      "ZK_TENANT_GOVERNANCE: lookup validator missing constructor",
    );
  }
  const ephemeral = new Ctor(domainPolicy);
  return ephemeral.validate(request);
}

function wrapWithTenantGovernance(
  validator,
  engine,
  domainName,
  verifyMethod,
  metricDomain,
) {
  if (!validator || typeof validator !== "object") {
    throw new Error("ZK_TENANT_GOVERNANCE: invalid validator");
  }
  if (typeof validator[verifyMethod] !== "function") {
    throw new Error(
      "ZK_TENANT_GOVERNANCE: validator missing method: " + verifyMethod,
    );
  }

  const originalVerify = validator[verifyMethod];
  const hadValidate =
    typeof validator.validate === "function" &&
    validator.validate !== validator.validateTenant;

  validator.validateTenant = function validateTenant(tenantId, request) {
    const domainPolicy = resolvePolicy(engine, tenantId, domainName);
    try {
      let result;
      if (
        domainName === "lookupGating" &&
        verifyMethod === "validate" &&
        typeof validator.constructor === "function"
      ) {
        result = runLookupWithIsolatedPolicy(validator, domainPolicy, request);
      } else {
        const facade = createPolicyFacade(validator, domainPolicy);
        result = Reflect.apply(originalVerify, facade, [request]);
      }
      trackVerification(metricDomain, tenantId, "verified");
      return result;
    } catch (err) {
      trackVerification(metricDomain, tenantId, "failed");
      throw err;
    }
  };

  // Do not clobber an existing validate(claim) API (e.g. lookup / ring).
  if (!hadValidate) {
    validator.validate = validator.validateTenant;
  }
  return validator;
}

/**
 * Construct and wrap a Track 125 claim validator for production hubs/routes.
 * @param {string} key — one of TRACK125_VALIDATOR_SPECS[].key
 * @param {object} [options]
 * @param {object} [options.engine] — CryptoPolicyEngine instance
 * @param {object} [options.validatorOptions] — forwarded to validator constructor
 * @param {object} [options.policy] — initial policy (lookup ctor / options.policy)
 * @returns {object} governed validator with validateTenant()
 */
function createGovernedClaimValidator(key, options = {}) {
  const spec = TRACK125_VALIDATOR_SPECS.find((s) => s.key === key);
  if (!spec) {
    throw new Error(
      "ZK_TENANT_GOVERNANCE: unknown validator key: " + String(key),
    );
  }
  let engine = options.engine;
  if (!engine) {
    const { CryptoPolicyEngine } = require("./crypto-policy-engine.cjs");
    engine = new CryptoPolicyEngine();
  }
  const mod = require(spec.modulePath);
  const ValidatorClass = mod[spec.exportName];
  if (typeof ValidatorClass !== "function") {
    throw new Error("ZK_TENANT_GOVERNANCE: missing export " + spec.exportName);
  }

  let instance;
  if (spec.ctorStyle === "policyArg") {
    instance = new ValidatorClass(
      options.policy || options.validatorOptions || {},
    );
  } else {
    const ctorOpts = Object.assign({}, options.validatorOptions || {});
    if (options.policy && ctorOpts.policy == null) {
      ctorOpts.policy = options.policy;
    }
    instance = new ValidatorClass(ctorOpts);
  }

  return wrapWithTenantGovernance(
    instance,
    engine,
    spec.domain,
    spec.method,
    spec.metric,
  );
}

module.exports = {
  validateTenantId,
  resolvePolicy,
  trackVerification,
  wrapWithTenantGovernance,
  createGovernedClaimValidator,
  setZkGovernanceSiemBroker,
  getZkGovernanceSiemBroker,
  emitZkIsolationViolation,
  TRACK125_VALIDATOR_SPECS,
  DEFAULT_TENANT,
};
