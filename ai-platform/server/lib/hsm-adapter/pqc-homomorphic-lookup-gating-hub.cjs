"use strict";

/**
 * Track 31: PQC Homomorphic Database Lookup Gating Hub.
 *
 * Finite-state machine that governs the lifecycle of a multi-party
 * homomorphic database lookup and drives the associated telemetry.
 *
 * Track 125: validator is wrapped with tenant governance when a
 * CryptoPolicyEngine is supplied (or created by default).
 *
 * @module hsm-adapter/pqc-homomorphic-lookup-gating-hub
 */

const { HsmAdapterError } = require("./base-adapter.cjs");
const { incrementCounter } = require("./hsm-metrics.cjs");
const { ZkLookupClaimValidator } = require("./zk-lookup-claim-validator.cjs");
const {
  createGovernedClaimValidator,
  DEFAULT_TENANT,
} = require("./zk-tenant-governance.cjs");

const STATES = Object.freeze({
  OPEN: "OPEN",
  QUERY_BLINDED: "QUERY_BLINDED",
  PROOF_VALIDATED: "PROOF_VALIDATED",
  ACCREDITED: "ACCREDITED",
});

const VALID_TRANSITIONS = Object.freeze({
  OPEN: ["QUERY_BLINDED"],
  QUERY_BLINDED: ["PROOF_VALIDATED"],
  PROOF_VALIDATED: ["ACCREDITED"],
  ACCREDITED: [],
});

class PqcHomomorphicDatabaseLookupGatingHub {
  constructor(options = {}) {
    this.poolId = options.poolId || `lookup-pool-${Date.now()}`;
    this.policy = options.policy || {};
    this._tenantId = options.tenantId || DEFAULT_TENANT;
    this._policyEngine = options.policyEngine || null;

    if (options.skipTenantGovernance === true) {
      this.validator = new ZkLookupClaimValidator(this.policy);
    } else {
      this.validator = createGovernedClaimValidator("lookup", {
        engine: this._policyEngine || undefined,
        policy: this.policy,
      });
    }

    this._state = STATES.OPEN;
    this._createdAt = Date.now();
    incrementCounter("hsm_lookupgate_pool_initialized_total");
  }

  get state() {
    return this._state;
  }

  _assertState(expected, label) {
    if (this._state !== expected) {
      throw new HsmAdapterError(
        "LOOKUPGATE_INVALID_STATE",
        `${label} requires state ${expected}, current: ${this._state}`,
      );
    }
  }

  _transition(to) {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed.includes(to)) {
      throw new HsmAdapterError(
        "LOOKUPGATE_INVALID_STATE",
        `cannot transition from ${this._state} to ${to}`,
      );
    }
    this._state = to;
  }

  /**
   * Submit a blinded query into the pool.
   * @param {{encryptedQuery: object, attestation: boolean}} query
   */
  submitQuery(query) {
    this._assertState(STATES.OPEN, "submitQuery");
    if (!query || typeof query !== "object") {
      throw new HsmAdapterError(
        "LOOKUPGATE_INVALID_INPUT",
        "query must be an object",
      );
    }
    this._query = query;
    this._transition(STATES.QUERY_BLINDED);
    return this._state;
  }

  /**
   * Validate the ZK lookup claim under tenant governance.
   * @param {{voters: string[], queryTree: object, digest: string}} claim
   * @param {string} [tenantId] — defaults to hub tenantId / DEFAULT_TENANT
   */
  validateProof(claim, tenantId) {
    this._assertState(STATES.QUERY_BLINDED, "validateProof");
    const tid = tenantId || this._tenantId || DEFAULT_TENANT;
    if (typeof this.validator.validateTenant === "function") {
      // Governance wrapper already increments hsm_zk_lookup_claim_* counters.
      this.validator.validateTenant(tid, claim);
    } else {
      this.validator.validate(claim);
      incrementCounter("hsm_zk_lookup_claim_verified_total");
    }
    this._transition(STATES.PROOF_VALIDATED);
    return this._state;
  }

  /**
   * Finalize accreditation of the lookup result.
   */
  accredit() {
    this._assertState(STATES.PROOF_VALIDATED, "accredit");
    this._transition(STATES.ACCREDITED);
    incrementCounter("hsm_lookup_accreditation_completed_total");
    return this._state;
  }
}

module.exports = { PqcHomomorphicDatabaseLookupGatingHub, STATES };
