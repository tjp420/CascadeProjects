"use strict";

/**
 * Track 31: HSM Vault lookup-gating route tests.
 */

const request = require("supertest");
const express = require("express");

jest.mock("../../middleware/authorize.cjs", () => ({
  authorize: () => (req, res, next) => next(),
}));

jest.mock("../../lib/admin-throttle.cjs", () => ({
  middleware: (req, res, next) => next(),
}));

jest.mock("../../lib/hsm-vault.cjs", () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: "ok" }),
}));

const hsmMetrics = require("../../lib/hsm-adapter/hsm-metrics.cjs");

function createTestApp() {
  const app = express();
  app.use(express.json());
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith("/server/routes/hsm-vault-routes.cjs")) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require("../../routes/hsm-vault-routes.cjs");
  app.use("/api/vault", vaultRoutes);
  return app;
}

function validClaim() {
  const voters = Array.from({ length: 12 }, (_, i) => `voter-${i}`);
  return {
    voters,
    queryTree: { a: { b: "leaf" } },
    digest: "homomorphic-lookup-digest-001",
    attestation: true,
  };
}

describe("Track 31 lookup-gating vault routes", () => {
  let app;
  let poolId;

  beforeEach(() => {
    hsmMetrics.reset();
    app = createTestApp();
  });

  test("POST /api/vault/lookup-gating/pool creates a pool", async () => {
    const res = await request(app)
      .post("/api/vault/lookup-gating/pool")
      .send({ policy: {} })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.poolId).toBeDefined();
    expect(res.body.state).toBe("OPEN");
    poolId = res.body.poolId;
  });

  test("full round-trip: submit, validate, accredit", async () => {
    const create = await request(app)
      .post("/api/vault/lookup-gating/pool")
      .send({ policy: {} });
    const id = create.body.poolId;

    await request(app)
      .post(`/api/vault/lookup-gating/${id}/query`)
      .send({ query: { encryptedQuery: { table: "x" }, attestation: true } })
      .expect(200)
      .then((r) => expect(r.body.state).toBe("QUERY_BLINDED"));

    await request(app)
      .post(`/api/vault/lookup-gating/${id}/validate`)
      .send({ claim: validClaim() })
      .expect(200)
      .then((r) => expect(r.body.state).toBe("PROOF_VALIDATED"));

    await request(app)
      .post(`/api/vault/lookup-gating/${id}/accredit`)
      .send({})
      .expect(200)
      .then((r) => expect(r.body.state).toBe("ACCREDITED"));

    await request(app)
      .get(`/api/vault/lookup-gating/${id}`)
      .expect(200)
      .then((r) => expect(r.body.state).toBe("ACCREDITED"));
  });

  test("GET /api/vault/lookup-gating/telemetry exposes counters", async () => {
    const res = await request(app)
      .get("/api/vault/lookup-gating/telemetry")
      .expect(200);
    expect(res.body.telemetry).toHaveProperty(
      "hsm_lookupgate_pool_initialized_total",
    );
    expect(res.body.telemetry).toHaveProperty(
      "hsm_zk_lookup_claim_verified_total",
    );
    expect(res.body.telemetry).toHaveProperty(
      "hsm_lookup_accreditation_completed_total",
    );
  });

  test("accredit before validate is rejected", async () => {
    const create = await request(app)
      .post("/api/vault/lookup-gating/pool")
      .send({ policy: {} });
    const id = create.body.poolId;
    await request(app)
      .post(`/api/vault/lookup-gating/${id}/query`)
      .send({ query: { encryptedQuery: {}, attestation: true } });
    const res = await request(app)
      .post(`/api/vault/lookup-gating/${id}/accredit`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("unknown pool returns 404", async () => {
    const res = await request(app)
      .get("/api/vault/lookup-gating/unknown-pool-id")
      .expect(404);
    expect(res.body.success).toBe(false);
  });
});
