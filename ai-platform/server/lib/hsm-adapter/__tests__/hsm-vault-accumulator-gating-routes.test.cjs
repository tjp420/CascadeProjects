"use strict";

const request = require("supertest");
const express = require("express");

jest.mock("../../../middleware/authorize.cjs", () => ({
  authorize: () => (req, res, next) => next(),
}));

jest.mock("../../../lib/admin-throttle.cjs", () => ({
  middleware: (req, res, next) => next(),
}));

jest.mock("../../../lib/hsm-vault.cjs", () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: "ok" }),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith("/server/routes/hsm-vault-routes.cjs")) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require("../../../routes/hsm-vault-routes.cjs");
  app.use("/api/vault", vaultRoutes);
  return app;
}

describe("Track 33 accumulator-gating REST route integration", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test("ROUTE33-L2-01: full happy path OPEN -> WITNESSES_COLLECTED -> PROOF_VALIDATED -> ACCREDITED", async () => {
    const init = await request(app)
      .post("/api/vault/accumulator-gating/pool")
      .send({})
      .expect(201);
    expect(init.body.success).toBe(true);
    expect(init.body.poolId).toBeDefined();
    expect(init.body.status).toBe("OPEN");
    const poolId = init.body.poolId;

    const witnesses = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/witnesses`)
      .send({ witnesses: new Array(8).fill("witness-sig") })
      .expect(200);
    expect(witnesses.body.status).toBe("WITNESSES_COLLECTED");
    expect(witnesses.body.witnessCount).toBe(8);

    const validate = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/validate`)
      .send({
        claim: {
          enclaveMembershipAttestation: true,
          attestationAuthority: "mock-authority",
          accumulatorType: "rsa-accumulator",
          canonicalPayloadLayout: true,
        },
        manifest: { accumulatorSize: 1024 },
      })
      .expect(200);
    expect(validate.body.status).toBe("PROOF_VALIDATED");

    const accredit = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/accredit`)
      .expect(200);
    expect(accredit.body.status).toBe("ACCREDITED");
  });

  test("ROUTE33-L2-02: out-of-order accredit returns 400 with ACCUMULATORGATE_INVALID_TRANSITION", async () => {
    const init = await request(app)
      .post("/api/vault/accumulator-gating/pool")
      .expect(201);
    const poolId = init.body.poolId;

    const res = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/accredit`)
      .expect(400);
    expect(res.body.error).toMatch(/ACCUMULATORGATE_INVALID_TRANSITION/);
  });

  test("ROUTE33-L2-03: insufficient witness quorum returns 400 with ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM", async () => {
    const init = await request(app)
      .post("/api/vault/accumulator-gating/pool")
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/witnesses`)
      .send({ witnesses: new Array(4).fill("witness-sig") })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/validate`)
      .send({
        claim: {
          enclaveMembershipAttestation: true,
          attestationAuthority: "mock-authority",
          accumulatorType: "rsa-accumulator",
          canonicalPayloadLayout: true,
        },
        manifest: { accumulatorSize: 1024 },
      })
      .expect(400);
    expect(res.body.error).toMatch(
      /ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM/,
    );
  });

  test("ROUTE33-L2-04: tree size exceeded returns 400 with ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED", async () => {
    const init = await request(app)
      .post("/api/vault/accumulator-gating/pool")
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/witnesses`)
      .send({ witnesses: new Array(8).fill("witness-sig") })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/validate`)
      .send({
        claim: {
          enclaveMembershipAttestation: true,
          attestationAuthority: "mock-authority",
          accumulatorType: "rsa-accumulator",
          canonicalPayloadLayout: true,
        },
        manifest: { accumulatorSize: 100000 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED/);
  });

  test("ROUTE33-L2-05: missing enclave attestation returns 400 with ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP", async () => {
    const init = await request(app)
      .post("/api/vault/accumulator-gating/pool")
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/witnesses`)
      .send({ witnesses: new Array(8).fill("witness-sig") })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/validate`)
      .send({
        claim: {
          enclaveMembershipAttestation: false,
          attestationAuthority: "mock-authority",
          accumulatorType: "rsa-accumulator",
          canonicalPayloadLayout: true,
        },
        manifest: { accumulatorSize: 1024 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP/);
  });

  test("ROUTE33-L2-06: telemetry endpoint never emits raw witness tokens or digests", async () => {
    const init = await request(app)
      .post("/api/vault/accumulator-gating/pool")
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/accumulator-gating/${poolId}/witnesses`)
      .send({ witnesses: new Array(8).fill("secret-witness-token") })
      .expect(200);

    const res = await request(app)
      .get("/api/vault/accumulator-gating/telemetry")
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    expect(
      res.body.telemetry.hsm_accumulatorgate_pool_initialized_total,
    ).toBeGreaterThanOrEqual(1);
    // No raw witness material should appear in telemetry
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("secret-witness-token");
  });

  test("ROUTE33-L3-01: unknown poolId on /witnesses returns 404", async () => {
    const res = await request(app)
      .post("/api/vault/accumulator-gating/nonexistent/witnesses")
      .send({ witnesses: [] })
      .expect(404);
    expect(res.body.error).toMatch(/accumulator_pool_not_found/);
  });

  test("ROUTE33-L3-02: unknown poolId on /accredit returns 404", async () => {
    const res = await request(app)
      .post("/api/vault/accumulator-gating/nonexistent/accredit")
      .expect(404);
    expect(res.body.error).toMatch(/accumulator_pool_not_found/);
  });
});
