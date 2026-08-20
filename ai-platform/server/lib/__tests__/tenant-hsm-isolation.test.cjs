"use strict";

process.env.HSM_MOCK_ROOT_KEY =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

const crypto = require("crypto");
const keyRotationStore = require("../key-rotation-store.cjs");
const hsm = require("../hsm-vault.cjs");
const clusterSync = require("../cluster-keyring-sync.cjs");
const providers = require("../hsm-providers.cjs");

describe("tenant HSM isolation", () => {
  let originalMockDerive;

  beforeEach(() => {
    originalMockDerive = providers.MockHsmProvider.prototype.derive;
    keyRotationStore._reset(crypto.randomBytes(32));
    hsm._resetHsmVersions();
    clusterSync._resetEvents();
    delete process.env.HSM_PROVIDER;
    delete process.env.HSM_KEY_ID;
    delete process.env.HSM_REGION;
    delete process.env.HSM_FAILOVER_REGIONS;
    delete process.env.HSM_ACCESS_TOKEN;
    delete process.env.HSM_TIMEOUT;
    delete process.env.HSM_TIMEOUT_MS;
  });

  afterEach(() => {
    delete process.env.HSM_TIMEOUT;
    delete process.env.HSM_TIMEOUT_MS;
    providers.MockHsmProvider.prototype.derive = originalMockDerive;
  });

  test("L2-01: same master key, different orgIds produce different tenant keys", () => {
    const a = keyRotationStore.deriveTenantKeyHex("org-a");
    const b = keyRotationStore.deriveTenantKeyHex("org-b");
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "hex").length).toBe(32);
  });

  test("L2-02: tenant key is deterministic and stable", () => {
    const a = keyRotationStore.deriveTenantKeyHex("org-a");
    const b = keyRotationStore.deriveTenantKeyHex("org-a");
    expect(a).toBe(b);
  });

  test("L3-01: empty orgId throws missing_org_id", () => {
    expect(() => keyRotationStore.deriveTenantKey("")).toThrow(
      /missing_org_id|valid orgId/,
    );
  });

  test("L3-02: orgId with special characters normalizes to a stable key", () => {
    const a = keyRotationStore.deriveTenantKeyHex("  ORG-A!@#  ");
    const b = keyRotationStore.deriveTenantKeyHex("org-a!@#");
    expect(a).toBe(b);
  });

  test("L2-03: HSM timeout fails closed with hsm_timeout", async () => {
    process.env.HSM_TIMEOUT = "1";
    providers.MockHsmProvider.prototype.derive = async () => {
      await new Promise((r) => setTimeout(r, 100));
      return crypto.randomBytes(32);
    };
    await expect(hsm.deriveOrgKeyViaHsm("org-a")).rejects.toMatchObject({
      code: "hsm_timeout",
    });
    const events = clusterSync.queryEvents({
      eventType: clusterSync.EVENT_TYPES.HSM_TIMEOUT,
    });
    expect(events.events.length).toBeGreaterThan(0);
  });

  test("L2-04: isolation violation is recorded when actor accesses wrong org key", async () => {
    await expect(
      hsm.deriveOrgKeyViaHsm("org-b", { actorOrgId: "org-a" }),
    ).rejects.toMatchObject({ code: "isolation_violation" });
    const events = clusterSync.queryEvents({
      eventType: clusterSync.EVENT_TYPES.ISOLATION_VIOLATION,
    });
    expect(events.events.length).toBeGreaterThan(0);
  });

  test("S-04: cluster event for violation does not include raw key material", async () => {
    await expect(
      hsm.deriveOrgKeyViaHsm("org-b", { actorOrgId: "org-a" }),
    ).rejects.toBeDefined();
    const events = clusterSync.queryEvents({
      eventType: clusterSync.EVENT_TYPES.ISOLATION_VIOLATION,
    });
    expect(events.events.length).toBeGreaterThan(0);
    const details = JSON.stringify(events.events[0].details);
    expect(details).not.toMatch(/[0-9a-f]{64}/i);
  });

  test("L3-03: HSM unavailable does not fall back to a local random key", async () => {
    process.env.HSM_PROVIDER = "cloudkms";
    process.env.HSM_ACCESS_TOKEN = "fake-token";
    process.env.HSM_KEY_ID = "projects/p/locations/l/keyRings/r/cryptoKeys/k";
    process.env.HSM_REGION = "us-central1";
    providers.CloudKmsProvider.prototype._request = async () => {
      throw new Error("network");
    };
    await expect(hsm.deriveOrgKeyViaHsm("org-a")).rejects.toThrow();
  });

  test("L3-05: existing key-rotation defaults keep working", () => {
    const keys = keyRotationStore.getDecryptionKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });
});
