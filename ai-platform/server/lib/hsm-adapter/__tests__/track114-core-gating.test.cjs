"use strict";

const { PqcLatticeVssGatingHub } = require("../pqc-lattice-vss-gating-hub.cjs");
const { ZkLatticeVssValidator } = require("../zk-lattice-vss-validator.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

describe("Track 114 core gating hub", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("FSM advances OPEN -> SHARES_COLLECTED -> PROOF_VALIDATED -> ACCREDITED", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    expect(hub.state).toBe("OPEN");

    hub.collectShares(new Array(8).fill("share"));
    expect(hub.state).toBe("SHARES_COLLECTED");

    hub.validateProof({
      degreeBound: 8,
      enclaveBindingAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe("PROOF_VALIDATED");

    hub.accredit();
    expect(hub.state).toBe("ACCREDITED");

    expect(hsmMetrics.getMetrics().hsm_vssgate_pool_initialized_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_zk_vss_claim_verified_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_vss_accreditation_completed_total).toBe(
      1,
    );
  });

  test("out-of-order accredit throws invalid transition", () => {
    const hub = new PqcLatticeVssGatingHub("t1", new CryptoPolicyEngine());
    expect(() => hub.accredit()).toThrow(/VSSGATE_INVALID_TRANSITION/);
  });

  test("insufficient shares throws VSSCLAIM_INSUFFICIENT_SHARES", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    hub.collectShares(new Array(3).fill("share"));
    expect(() =>
      hub.validateProof({
        degreeBound: 8,
        enclaveBindingAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VSSCLAIM_INSUFFICIENT_SHARES/);
  });

  test("degree bound exceeded throws VSSCLAIM_DEGREE_BOUND_EXCEEDED", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    expect(() =>
      hub.validateProof({
        degreeBound: 32,
        enclaveBindingAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VSSCLAIM_DEGREE_BOUND_EXCEEDED/);
  });

  test("missing enclave binding attestation throws VSSCLAIM_UNATTESTED_BINDING", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    expect(() =>
      hub.validateProof({
        degreeBound: 8,
        enclaveBindingAttestation: false,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VSSCLAIM_UNATTESTED_BINDING/);
  });

  test("unsupported lattice scheme throws VSSGATE_POLICY_VIOLATION", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    try {
      hub.validateProof({
        degreeBound: 8,
        enclaveBindingAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "invalid-scheme",
        canonicalPayloadLayout: true,
      });
      throw new Error("expected validation to throw");
    } catch (e) {
      expect(e.code).toBe("VSSGATE_POLICY_VIOLATION");
    }
  });

  test("tenant override of minVssShares is respected", () => {
    const engine = new CryptoPolicyEngine({
      version: "0.0.0",
      default: {},
      tenants: {
        t1: { latticeVssGating: { minVssShares: 3 } },
      },
    });
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    hub.collectShares(new Array(3).fill("share"));
    hub.validateProof({
      degreeBound: 8,
      enclaveBindingAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe("PROOF_VALIDATED");
  });

  test("non-array shares to collectShares throws VSSGATE_INVALID_SHARES", () => {
    const hub = new PqcLatticeVssGatingHub("t1", new CryptoPolicyEngine());
    expect(() => hub.collectShares("not-an-array")).toThrow(
      /VSSGATE_INVALID_SHARES/,
    );
  });

  test("validateProof called twice throws VSSGATE_INVALID_TRANSITION", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    hub.collectShares(new Array(8).fill("share"));
    hub.validateProof({
      degreeBound: 8,
      enclaveBindingAttestation: true,
      attestationAuthority: "mock-authority",
      latticeScheme: "module-lwr",
      canonicalPayloadLayout: true,
    });
    expect(() =>
      hub.validateProof({
        degreeBound: 8,
        enclaveBindingAttestation: true,
        attestationAuthority: "mock-authority",
        latticeScheme: "module-lwr",
        canonicalPayloadLayout: true,
      }),
    ).toThrow(/VSSGATE_INVALID_TRANSITION/);
  });

  test("hub isolation across tenants — two hubs do not share state", () => {
    const engine = new CryptoPolicyEngine();
    const hubA = new PqcLatticeVssGatingHub("t1", engine);
    const hubB = new PqcLatticeVssGatingHub("t2", engine);
    expect(hubA.state).toBe("OPEN");
    expect(hubB.state).toBe("OPEN");
    hubA.collectShares(new Array(8).fill("s"));
    expect(hubA.state).toBe("SHARES_COLLECTED");
    expect(hubB.state).toBe("OPEN");
    expect(hubA.shares).not.toBe(hubB.shares);
  });

  test("share array is copied (external mutation does not affect hub)", () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcLatticeVssGatingHub("t1", engine);
    const external = new Array(8).fill("s");
    hub.collectShares(external);
    external.push("extra");
    expect(hub.shares.length).toBe(8);
  });
});
