"use strict";

/**
 * Track 15: Volatile eviction engine and adapter integration tests.
 */
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { VolatileEvictionEngine } = require("../volatile-eviction-engine.cjs");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("VolatileEvictionEngine", () => {
  test("evicts an idle key after inactivity interval", async () => {
    const policy = new CryptoPolicyEngine({
      default: {
        eviction: {
          inactivityEvictionSeconds: 0.2,
          zeroizeStrategy: "zeros",
          auditOnEvict: true,
        },
      },
    });
    const engine = new VolatileEvictionEngine(policy, { intervalMs: 50 });
    const callback = jest.fn();
    engine.register("t1", "kek-1", callback);
    await wait(250);
    engine.stop();
    expect(callback).toHaveBeenCalledWith("kek-1", "inactivity");
  });

  test("touching a key delays eviction", async () => {
    const policy = new CryptoPolicyEngine({
      default: {
        eviction: { inactivityEvictionSeconds: 0.2, zeroizeStrategy: "zeros" },
      },
    });
    const engine = new VolatileEvictionEngine(policy, { intervalMs: 50 });
    const callback = jest.fn();
    engine.register("t1", "kek-1", callback);
    await wait(150);
    engine.touch("t1", "kek-1");
    await wait(150);
    engine.stop();
    expect(callback).not.toHaveBeenCalled();
  });

  test("evictAll triggers callback for all registered keys", async () => {
    const policy = new CryptoPolicyEngine({
      default: { eviction: { inactivityEvictionSeconds: 0 } },
    });
    const engine = new VolatileEvictionEngine(policy, { intervalMs: 0 });
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    engine.register("t1", "kek-1", cb1);
    engine.register("t2", "kek-2", cb2);
    await engine.evictAll("manual");
    expect(cb1).toHaveBeenCalledWith("kek-1", "manual");
    expect(cb2).toHaveBeenCalledWith("kek-2", "manual");
  });

  test("throws for invalid zeroize callback", () => {
    const policy = new CryptoPolicyEngine();
    const engine = new VolatileEvictionEngine(policy);
    expect(() => engine.register("t1", "kek-1", "not-a-function")).toThrow(
      HsmAdapterError,
    );
  });
});

describe("SoftwareHsmAdapter volatile eviction", () => {
  test("automatically zeroizes idle KEK and emits audit event", async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const policy = new CryptoPolicyEngine({
      default: {
        eviction: {
          inactivityEvictionSeconds: 0.2,
          zeroizeStrategy: "zeros",
          auditOnEvict: true,
        },
      },
    });
    const adapter = new SoftwareHsmAdapter({
      policyEngine: policy,
      logger,
      evictionIntervalMs: 50,
    });
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");

    expect((await adapter.listKEKs("t1")).length).toBe(1);
    await wait(300);
    expect((await adapter.listKEKs("t1")).length).toBe(0);

    expect(logger.info).toHaveBeenCalledWith(
      "KEY_ZEROIZED",
      expect.objectContaining({ kekId, tenantId: "t1", reason: "inactivity" }),
    );
  });

  test("touch on wrap/unwrap keeps key alive", async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const policy = new CryptoPolicyEngine({
      default: {
        eviction: { inactivityEvictionSeconds: 0.2, zeroizeStrategy: "zeros" },
      },
    });
    const adapter = new SoftwareHsmAdapter({
      policyEngine: policy,
      logger,
      evictionIntervalMs: 50,
    });
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const plaintext = Buffer.alloc(16, 0xab);

    for (let i = 0; i < 5; i++) {
      await adapter.wrap("t1", kekId, plaintext);
      await wait(100);
    }

    expect((await adapter.listKEKs("t1")).length).toBe(1);
    await wait(300);
    expect((await adapter.listKEKs("t1")).length).toBe(0);
  });

  test("explicit zeroize removes key and logs event", async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    await adapter.zeroize("t1", kekId, "explicit");
    expect((await adapter.listKEKs("t1")).length).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      "KEY_ZEROIZED",
      expect.objectContaining({ kekId, tenantId: "t1", reason: "explicit" }),
    );
  });

  test("evictInactive purges all idle keys", async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const policy = new CryptoPolicyEngine({
      default: { eviction: { inactivityEvictionSeconds: 0 } },
    });
    const adapter = new SoftwareHsmAdapter({ policyEngine: policy, logger });
    await adapter.initialize();
    const kekId1 = await adapter.createKEK("t1");
    await adapter.createKEK("t1");
    expect((await adapter.listKEKs("t1")).length).toBe(2);
    await adapter.evictInactive("manual");
    expect((await adapter.listKEKs("t1")).length).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      "KEY_EVICTED",
      expect.objectContaining({ reason: "manual" }),
    );
  });
});
