"use strict";

process.env.TOKEN_THROTTLE_WINDOW_MS = "1000";

const mesh = require("../token-throttle-mesh.cjs");

describe("token-throttle-mesh", () => {
  beforeEach(() => {
    mesh.reset("org-a", "openai");
    mesh.reset("org-b", "openai");
    mesh.reset("org-a", "anthropic");
  });

  test("allows requests under configured RPM and TPM", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 5, tpm: 500 });
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      estimatedTokens: 10,
      fn,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalled();
  });

  test("blocks request that exceeds RPM", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 1, tpm: 1000 });
    await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      estimatedTokens: 1,
      fn: () => Promise.resolve("first"),
    });
    await expect(
      mesh.throttleRequest({
        orgId: "org-a",
        provider: "openai",
        estimatedTokens: 1,
        timeoutMs: 100,
        fn: () => Promise.resolve("second"),
      }),
    ).rejects.toThrow(/Throttling/);
  });

  test("blocks request that exceeds TPM", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 100, tpm: 50 });
    await expect(
      mesh.throttleRequest({
        orgId: "org-a",
        provider: "openai",
        estimatedTokens: 100,
        timeoutMs: 100,
        fn: () => Promise.resolve("ok"),
      }),
    ).rejects.toThrow(/Throttling/);
  });

  test("isolates orgs and providers", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 1, tpm: 1000 });
    mesh.setLimits("org-b", "openai", { rpm: 1, tpm: 1000 });
    mesh.setLimits("org-a", "anthropic", { rpm: 1, tpm: 1000 });

    await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      fn: () => Promise.resolve(),
    });
    // org-b openai should still have capacity
    await expect(
      mesh.throttleRequest({
        orgId: "org-b",
        provider: "openai",
        timeoutMs: 100,
        fn: () => Promise.resolve(),
      }),
    ).resolves.toBeUndefined();
    // org-a anthropic should still have capacity
    await expect(
      mesh.throttleRequest({
        orgId: "org-a",
        provider: "anthropic",
        timeoutMs: 100,
        fn: () => Promise.resolve(),
      }),
    ).resolves.toBeUndefined();
  });

  test("status reflects live window counts", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 10, tpm: 1000 });
    await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      estimatedTokens: 25,
      fn: () => Promise.resolve("ok"),
    });
    const status = mesh.getStatus("org-a", "openai");
    expect(status.currentRpm).toBe(1);
    expect(status.currentTpm).toBe(25);
    expect(status.limitRpm).toBe(10);
    expect(status.limitTpm).toBe(1000);
    expect(status.throttlingEnabled).toBe(true);
  });

  test("reset clears windows and queues", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 1, tpm: 1000 });
    await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      fn: () => Promise.resolve(),
    });
    const before = mesh.getStatus("org-a", "openai");
    expect(before.currentRpm).toBe(1);

    mesh.reset("org-a", "openai");
    const after = mesh.getStatus("org-a", "openai");
    expect(after.currentRpm).toBe(0);
  });

  test("default limits disable throttling", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      estimatedTokens: 10000,
      fn,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalled();
  });

  test("handles missing or non-positive estimatedTokens as 1", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 10, tpm: 5 });
    // 5 tokens exactly at limit; with estimatedTokens invalid, it becomes 1 token
    await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      estimatedTokens: 0,
      fn: () => Promise.resolve("ok"),
    });
    const status = mesh.getStatus("org-a", "openai");
    expect(status.currentTpm).toBe(1);
  });

  test("delays a queued request until a window slot frees", async () => {
    mesh.setLimits("org-a", "openai", { rpm: 1, tpm: 1000 });
    await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      fn: () => Promise.resolve("first"),
    });
    const start = Date.now();
    const result = await mesh.throttleRequest({
      orgId: "org-a",
      provider: "openai",
      timeoutMs: 2000,
      fn: () => Promise.resolve("second"),
    });
    const elapsed = Date.now() - start;
    expect(result).toBe("second");
    expect(elapsed).toBeGreaterThanOrEqual(900);
  });
});
