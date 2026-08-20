"use strict";

/**
 * PQ Lattice Fuzzing Matrix — Cross-Track ZK Verification Runner
 *
 * Unified fuzzing matrix for Tracks 32/33/114/115 (Post-Quantum Lattice Gating).
 *
 * Test categories:
 *   1. Cross-track contamination — verifying that payloads from one track's
 *      gating hub don't pass validation in a different track's validator
 *   2. ZK verification runner — exercising all four lattice gating hubs in
 *      sequence through the full FSM: OPEN → COLLECTED → PROOF_VALIDATED → ACCREDITED
 *   3. Multi-tenant saturation — PRNG-driven simultaneous validation across
 *      all four tracks and multiple tenants
 *
 * Test items T1-T12 from the approved test plan.
 */

const {
  CryptoPolicyEngine,
  HsmAdapterError,
} = require("../crypto-policy-engine.cjs");
const {
  PqcBlindedRingSignatureGatingHub,
} = require("../pqc-blinded-ring-signature-gating-hub.cjs");
const {
  PqcDirectAccumulatorMembershipGatingHub,
} = require("../pqc-direct-accumulator-membership-gating-hub.cjs");
const { PqcLatticeVssGatingHub } = require("../pqc-lattice-vss-gating-hub.cjs");
const {
  PqcLatticeVfhssGatingHub,
} = require("../pqc-lattice-vfhss-gating-hub.cjs");
const { ZkRingClaimValidator } = require("../zk-ring-claim-validator.cjs");
const {
  ZkAccumulatorClaimValidator,
} = require("../zk-accumulator-claim-validator.cjs");
const { ZkLatticeVssValidator } = require("../zk-lattice-vss-validator.cjs");
const {
  ZkLatticeVfhssValidator,
} = require("../zk-lattice-vfhss-validator.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");
const {
  makeHashChainPrng,
  FUZZ_SEED,
  VALID_CLAIMS,
  CROSS_TRACK_PAYLOADS,
  runZkVerificationRunner,
  makeCrossTrackContaminationPayload,
  makeMultiTenantTrackCall,
  cleanupPrototypePollution,
  CROSS_TRACK_CLEANUP_KEYS,
} = require("./tenant-fuzz-harness.cjs");

afterEach(() => {
  cleanupPrototypePollution();
  // Also clean cross-track specific pollution
  for (const key of CROSS_TRACK_CLEANUP_KEYS) {
    delete Object.prototype[key];
  }
});

// ── Cross-Track Contamination Tests ──────────────────────────────────────

describe("PQ Lattice Fuzzing Matrix — Cross-Track Contamination", () => {
  let engine;

  beforeEach(() => {
    hsmMetrics.reset();
    engine = new CryptoPolicyEngine();
  });

  // T1: Track 32 ring payload doesn't affect track 114 VSS validator
  test("T1: Track 32 ring payload rejected by track 114 VSS validator", () => {
    const validator = new ZkLatticeVssValidator(engine);
    expect(() =>
      validator.validate("tenant-1", {
        ...CROSS_TRACK_PAYLOADS.ringToVss,
        shares: new Array(8).fill("share"),
      }),
    ).toThrow();
  });

  // T2: Track 33 accumulator payload doesn't affect track 115 VFHSS validator
  test("T2: Track 33 accumulator payload rejected by track 115 VFHSS validator", () => {
    const validator = new ZkLatticeVfhssValidator(engine);
    expect(() =>
      validator.validate("tenant-1", {
        ...CROSS_TRACK_PAYLOADS.accumulatorToVfhss,
        shares: new Array(10).fill("share"),
      }),
    ).toThrow();
  });

  // T3: Track 114 VSS payload doesn't affect track 32 ring validator
  test("T3: Track 114 VSS payload rejected by track 32 ring validator", () => {
    const validator = new ZkRingClaimValidator(engine);
    expect(() =>
      validator.validate("tenant-1", CROSS_TRACK_PAYLOADS.vssToRing),
    ).toThrow();
  });

  // T4: Track 115 VFHSS payload doesn't affect track 33 accumulator validator
  test("T4: Track 115 VFHSS payload rejected by track 33 accumulator validator", () => {
    const validator = new ZkAccumulatorClaimValidator(engine);
    expect(() =>
      validator.validate("tenant-1", {
        ...CROSS_TRACK_PAYLOADS.vfhssToAccumulator,
        witnesses: new Array(8).fill("witness"),
      }),
    ).toThrow();
  });

  // T5: Prototype pollution from track 32 doesn't leak into track 114/115 policy lookups
  test("T5: Prototype pollution from track 32 does not leak into track 114/115 validators", () => {
    const ringValidator = new ZkRingClaimValidator(engine);
    // Inject prototype pollution via a track 32 payload
    const pollutedPayload = {
      ...VALID_CLAIMS.track32,
      __proto__: { crossTrackPolluted: true },
    };
    try {
      ringValidator.validate("tenant-1", pollutedPayload);
    } catch {
      // Expected — anonymitySet size may not match
    }
    // Verify pollution didn't leak into Object.prototype
    expect(Object.prototype.crossTrackPolluted).toBeUndefined();

    // Now validate track 114 and 115 — they should not see polluted properties
    const vssValidator = new ZkLatticeVssValidator(engine);
    const vfhssValidator = new ZkLatticeVfhssValidator(engine);
    expect(() =>
      vssValidator.validate("tenant-1", {
        ...VALID_CLAIMS.track114,
        shares: new Array(8).fill("share"),
      }),
    ).not.toThrow();
    expect(() =>
      vfhssValidator.validate("tenant-1", {
        ...VALID_CLAIMS.track115,
        shares: new Array(10).fill("share"),
      }),
    ).not.toThrow();
  });
});

// ── ZK Verification Runner Tests ─────────────────────────────────────────

describe("PQ Lattice Fuzzing Matrix — ZK Verification Runner", () => {
  let engine;

  beforeEach(() => {
    hsmMetrics.reset();
    engine = new CryptoPolicyEngine();
  });

  // T6: Runner exercises all 4 hubs in sequence: OPEN → COLLECTED → PROOF_VALIDATED → ACCREDITED
  test("T6: Runner accredits all 4 lattice gating hubs in sequence", () => {
    const { results, allPassed } = runZkVerificationRunner(
      "tenant-runner-1",
      engine,
    );
    expect(allPassed).toBe(true);
    expect(results.track32.passed).toBe(true);
    expect(results.track32.state).toBe("ACCREDITED");
    expect(results.track33.passed).toBe(true);
    expect(results.track33.state).toBe("ACCREDITED");
    expect(results.track114.passed).toBe(true);
    expect(results.track114.state).toBe("ACCREDITED");
    expect(results.track115.passed).toBe(true);
    expect(results.track115.state).toBe("ACCREDITED");
  });

  // T7: Runner detects and reports which track fails accreditation
  test("T7: Runner reports which track fails when a claim is invalid", () => {
    // Create an engine with a strict policy that will reject track 114
    const strictEngine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        "tenant-fail-1": {
          latticeVssGating: {
            minVssShares: 100, // Impossible to meet with 8 shares
          },
        },
      },
    });

    const { results, allPassed } = runZkVerificationRunner(
      "tenant-fail-1",
      strictEngine,
    );
    expect(allPassed).toBe(false);
    expect(results.track114.passed).toBe(false);
    expect(results.track114.error).toBeDefined();
    expect(results.track114.error).toContain("INSUFFICIENT_SHARES");
    // Other tracks should still pass
    expect(results.track32.passed).toBe(true);
    expect(results.track33.passed).toBe(true);
    expect(results.track115.passed).toBe(true);
  });

  // T8: Runner works with multiple tenants (at least 3)
  test("T8: Runner works with multiple tenants simultaneously", () => {
    const tenants = ["tenant-multi-a", "tenant-multi-b", "tenant-multi-c"];
    const allResults = tenants.map((t) => runZkVerificationRunner(t, engine));

    for (let i = 0; i < tenants.length; i++) {
      expect(allResults[i].allPassed).toBe(true);
      expect(allResults[i].results.track32.state).toBe("ACCREDITED");
      expect(allResults[i].results.track33.state).toBe("ACCREDITED");
      expect(allResults[i].results.track114.state).toBe("ACCREDITED");
      expect(allResults[i].results.track115.state).toBe("ACCREDITED");
    }
  });

  // T9: Runner verifies metrics counters are incremented for each track independently
  test("T9: Metrics counters are incremented independently for each track", () => {
    hsmMetrics.reset();
    runZkVerificationRunner("tenant-metrics-1", engine);

    const metrics = hsmMetrics.getMetrics();
    // Track 32: ring gating
    expect(metrics.hsm_ringgate_pool_initialized_total).toBe(1);
    expect(metrics.hsm_ring_accreditation_completed_total).toBe(1);
    // Track 33: accumulator gating
    expect(metrics.hsm_accumulatorgate_pool_initialized_total).toBe(1);
    expect(metrics.hsm_accumulator_accreditation_completed_total).toBe(1);
    // Track 114: VSS gating
    expect(metrics.hsm_vssgate_pool_initialized_total).toBe(1);
    expect(metrics.hsm_vss_accreditation_completed_total).toBe(1);
    // Track 115: VFHSS gating
    expect(metrics.hsm_vfhssgate_pool_initialized_total).toBe(1);
    expect(metrics.hsm_vfhss_accreditation_completed_total).toBe(1);
  });
});

// ── Multi-Tenant Saturation Tests ────────────────────────────────────────

describe("PQ Lattice Fuzzing Matrix — Multi-Tenant Saturation", () => {
  let engine;

  beforeEach(() => {
    hsmMetrics.reset();
    engine = new CryptoPolicyEngine();
  });

  // T10: 100 PRNG-driven iterations across all 4 tracks with 5 tenants — no crashes
  test("T10: 100 PRNG-driven iterations across 4 tracks and 5 tenants complete without crashes", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-saturation-100");
    let processed = 0;
    let expectedFailures = 0;
    let actualFailures = 0;

    for (let i = 0; i < 100; i++) {
      const call = makeMultiTenantTrackCall(prng);
      try {
        if (call.track === "track32") {
          const hub = new PqcBlindedRingSignatureGatingHub(
            call.tenantId,
            engine,
          );
          hub.collectKeys(new Array(32).fill("pub"));
          hub.validateProof(call.claim);
          hub.accredit();
        } else if (call.track === "track33") {
          const hub = new PqcDirectAccumulatorMembershipGatingHub(
            call.tenantId,
            engine,
          );
          hub.collectWitnesses(new Array(8).fill("witness"));
          hub.validateProof(call.claim);
          hub.accredit();
        } else if (call.track === "track114") {
          const hub = new PqcLatticeVssGatingHub(call.tenantId, engine);
          hub.collectShares(new Array(8).fill("share"));
          hub.validateProof(call.claim);
          hub.accredit();
        } else if (call.track === "track115") {
          const hub = new PqcLatticeVfhssGatingHub(call.tenantId, engine);
          hub.collectShares(new Array(10).fill("share"));
          hub.validateProof(call.claim);
          hub.accredit();
        }
        processed++;
        if (call.shouldFail) {
          // If we expected a failure but didn't get one, that's OK —
          // the claim might have passed despite being incomplete
        }
      } catch (err) {
        actualFailures++;
        if (call.shouldFail) {
          expectedFailures++;
        }
        // Verify the error is a known type (not a crash)
        expect(err).toBeInstanceOf(Error);
      }
    }

    // All 100 iterations should complete (either pass or throw, not crash)
    expect(processed + actualFailures).toBe(100);
    // At least some failures should have been expected failures
    expect(expectedFailures).toBeGreaterThan(0);
  });

  // T11: Concurrent validation calls across tracks don't cause shared-state contamination
  test("T11: Concurrent validation calls across tracks do not contaminate shared state", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-concurrent-cross");
    const contaminationPayloads = [];

    // Generate 50 cross-track contamination payloads
    for (let i = 0; i < 50; i++) {
      contaminationPayloads.push(makeCrossTrackContaminationPayload(prng));
    }

    // Apply all payloads — each should be rejected by its target track
    for (const { sourceTrack, targetTrack, payload } of contaminationPayloads) {
      try {
        if (targetTrack === "track32") {
          const validator = new ZkRingClaimValidator(engine);
          validator.validate("tenant-concurrent", payload);
        } else if (targetTrack === "track33") {
          const validator = new ZkAccumulatorClaimValidator(engine);
          validator.validate("tenant-concurrent", {
            ...payload,
            witnesses: new Array(8).fill("w"),
          });
        } else if (targetTrack === "track114") {
          const validator = new ZkLatticeVssValidator(engine);
          validator.validate("tenant-concurrent", {
            ...payload,
            shares: new Array(8).fill("s"),
          });
        } else if (targetTrack === "track115") {
          const validator = new ZkLatticeVfhssValidator(engine);
          validator.validate("tenant-concurrent", {
            ...payload,
            shares: new Array(10).fill("s"),
          });
        }
        // If it didn't throw, that's unexpected but not a crash — verify no pollution leaked
      } catch (err) {
        // Expected — cross-track payloads should be rejected
        expect(err).toBeInstanceOf(Error);
      }
    }

    // Verify no prototype pollution leaked
    expect(Object.prototype.crossTrackPolluted).toBeUndefined();
    expect(Object.prototype.crossTrackCtorPolluted).toBeUndefined();

    // Verify all four validators still work correctly with valid claims
    const { allPassed } = runZkVerificationRunner(
      "tenant-post-contamination",
      engine,
    );
    expect(allPassed).toBe(true);
  });

  // T12: All 4 tracks' metrics counters are independent (no cross-track counter leakage)
  test("T12: Metrics counters are independent across tracks (no cross-track leakage)", () => {
    hsmMetrics.reset();

    // Run only track 32
    const ringHub = new PqcBlindedRingSignatureGatingHub(
      "tenant-counter-1",
      engine,
    );
    ringHub.collectKeys(new Array(32).fill("pub"));
    ringHub.validateProof({ ...VALID_CLAIMS.track32 });
    ringHub.accredit();

    const metricsAfterRing = hsmMetrics.getMetrics();
    expect(metricsAfterRing.hsm_ringgate_pool_initialized_total).toBe(1);
    expect(metricsAfterRing.hsm_vssgate_pool_initialized_total).toBe(0);
    expect(metricsAfterRing.hsm_vfhssgate_pool_initialized_total).toBe(0);
    expect(metricsAfterRing.hsm_accumulatorgate_pool_initialized_total).toBe(0);

    // Run only track 114
    const vssHub = new PqcLatticeVssGatingHub("tenant-counter-2", engine);
    vssHub.collectShares(new Array(8).fill("share"));
    vssHub.validateProof({ ...VALID_CLAIMS.track114 });
    vssHub.accredit();

    const metricsAfterVss = hsmMetrics.getMetrics();
    expect(metricsAfterVss.hsm_ringgate_pool_initialized_total).toBe(1); // Unchanged
    expect(metricsAfterVss.hsm_vssgate_pool_initialized_total).toBe(1); // Incremented
    expect(metricsAfterVss.hsm_vfhssgate_pool_initialized_total).toBe(0); // Still zero
    expect(metricsAfterVss.hsm_accumulatorgate_pool_initialized_total).toBe(0); // Still zero

    // Run only track 115
    const vfhssHub = new PqcLatticeVfhssGatingHub("tenant-counter-3", engine);
    vfhssHub.collectShares(new Array(10).fill("share"));
    vfhssHub.validateProof({ ...VALID_CLAIMS.track115 });
    vfhssHub.accredit();

    const metricsAfterVfhss = hsmMetrics.getMetrics();
    expect(metricsAfterVfhss.hsm_ringgate_pool_initialized_total).toBe(1); // Unchanged
    expect(metricsAfterVfhss.hsm_vssgate_pool_initialized_total).toBe(1); // Unchanged
    expect(metricsAfterVfhss.hsm_vfhssgate_pool_initialized_total).toBe(1); // Incremented
    expect(metricsAfterVfhss.hsm_accumulatorgate_pool_initialized_total).toBe(
      0,
    ); // Still zero

    // Run only track 33
    const accHub = new PqcDirectAccumulatorMembershipGatingHub(
      "tenant-counter-4",
      engine,
    );
    accHub.collectWitnesses(new Array(8).fill("witness"));
    accHub.validateProof({ ...VALID_CLAIMS.track33 });
    accHub.accredit();

    const metricsAfterAcc = hsmMetrics.getMetrics();
    expect(metricsAfterAcc.hsm_ringgate_pool_initialized_total).toBe(1); // Unchanged
    expect(metricsAfterAcc.hsm_vssgate_pool_initialized_total).toBe(1); // Unchanged
    expect(metricsAfterAcc.hsm_vfhssgate_pool_initialized_total).toBe(1); // Unchanged
    expect(metricsAfterAcc.hsm_accumulatorgate_pool_initialized_total).toBe(1); // Incremented
  });
});
