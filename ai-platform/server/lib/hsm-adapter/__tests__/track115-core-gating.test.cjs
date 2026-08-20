"use strict";

const {
  PqcLatticeVfhssGatingHub,
} = require("../pqc-lattice-vfhss-gating-hub.cjs");
const {
  ZkLatticeVfhssValidator,
} = require("../zk-lattice-vfhss-validator.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

describe("Track 115 core gating hub", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("FSM advances OPEN -> SHARES_COLLECTED -> PROOF_VALIDATED -> ACCREDITED", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    expect(hub.state).toBe("OPEN");

    hub.collectShares(new Array(8).fill("share"));
    expect(hub.state).toBe("SHARES_COLLECTED");

    hub.validateProof({
      homomorphicDepth: 4,
      enclaveEvaluationAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe("PROOF_VALIDATED");

    hub.accredit();
    expect(hub.state).toBe("ACCREDITED");

    expect(hsmMetrics.getMetrics().hsm_vfhssgate_pool_initialized_total).toBe(
      1,
    );
    expect(hsmMetrics.getMetrics().hsm_zk_vfhss_claim_verified_total).toBe(1);
    expect(
      hsmMetrics.getMetrics().hsm_vfhss_accreditation_completed_total,
    ).toBe(1);
  });

  test("out-of-order accredit throws invalid transition", () => {
    const hub = new PqcLatticeVfhssGatingHub("t1", new CryptoPolicyEngine());
    expect(() => hub.accredit()).toThrow(/VFHSSGATE_INVALID_TRANSITION/);
  });

  test("insufficient shares throws VFHSSCLAIM_INSUFFICIENT_SHARES", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(3).fill("share"));
    expect(() =>
      hub.validateProof({
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VFHSSCLAIM_INSUFFICIENT_SHARES/);
  });

  test("homomorphic depth exceeded throws VFHSSCLAIM_HOMOMORPHIC_DEPTH_EXCEEDED", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    expect(() =>
      hub.validateProof({
        homomorphicDepth: 16,
        enclaveEvaluationAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VFHSSCLAIM_HOMOMORPHIC_DEPTH_EXCEEDED/);
  });

  test("missing enclave evaluation attestation throws VFHSSCLAIM_UNATTESTED_EVALUATION", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    expect(() =>
      hub.validateProof({
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: false,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VFHSSCLAIM_UNATTESTED_EVALUATION/);
  });

  test("unsupported lattice scheme throws VFHSSGATE_POLICY_VIOLATION", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    try {
      hub.validateProof({
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "invalid-scheme",
        canonicalPayloadLayout: true,
      });
      throw new Error("expected validation to throw");
    } catch (e) {
      expect(e.code).toBe("VFHSSGATE_POLICY_VIOLATION");
    }
  });

  test("tenant override of minVfhssShares is respected", () => {
    const engine = new CryptoPolicyEngine({
      version: "0.0.0",
      default: {},
      tenants: {
        t1: { latticeVfhssGating: { minVfhssShares: 3 } },
      },
    });
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(3).fill("share"));
    hub.validateProof({
      homomorphicDepth: 4,
      enclaveEvaluationAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe("PROOF_VALIDATED");
  });

  test("tenant override of maxHomomorphicDepth is respected", () => {
    const engine = new CryptoPolicyEngine({
      version: "0.0.0",
      default: {},
      tenants: {
        t1: { latticeVfhssGating: { maxHomomorphicDepth: 16 } },
      },
    });
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    hub.validateProof({
      homomorphicDepth: 16,
      enclaveEvaluationAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe("PROOF_VALIDATED");
  });

  test("non-array shares to collectShares throws VFHSSGATE_INVALID_SHARES", () => {
    const hub = new PqcLatticeVfhssGatingHub("t1", new CryptoPolicyEngine());
    expect(() => hub.collectShares("not-an-array")).toThrow(
      /VFHSSGATE_INVALID_SHARES/,
    );
  });

  test("validateProof called twice throws VFHSSGATE_INVALID_TRANSITION", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    hub.validateProof({
      homomorphicDepth: 4,
      enclaveEvaluationAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(() =>
      hub.validateProof({
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VFHSSGATE_INVALID_TRANSITION/);
  });

  test("hub isolation across tenants — two hubs do not share state", () => {
    const engine = new CryptoPolicyEngine();
    const hubA = new PqcLatticeVfhssGatingHub("t1", engine);
    const hubB = new PqcLatticeVfhssGatingHub("t2", engine);
    expect(hubA.state).toBe("OPEN");
    expect(hubB.state).toBe("OPEN");
    hubA.collectShares(new Array(8).fill("s"));
    expect(hubA.state).toBe("SHARES_COLLECTED");
    expect(hubB.state).toBe("OPEN");
    expect(hubA.shares).not.toBe(hubB.shares);
  });

  test("share array is copied (external mutation does not affect hub)", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVfhssGatingHub("t1", engine);
    const external = new Array(8).fill("s");
    hub.collectShares(external);
    external.push("extra");
    expect(hub.shares.length).toBe(8);
  });
});
