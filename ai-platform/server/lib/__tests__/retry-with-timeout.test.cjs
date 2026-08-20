const path = require("path");
const { retryWithTimeout } = require(
  path.resolve(__dirname, "..", "retry-with-timeout.cjs"),
);

describe("retryWithTimeout", () => {
  test("resolves immediately when operation succeeds", async () => {
    const result = await retryWithTimeout(() => Promise.resolve(42), {
      retries: 0,
      timeoutMs: 100,
    });
    expect(result).toBe(42);
  });

  test("rejects with timeout error after retries exhausted for hanging operation", async () => {
    const hang = () => new Promise(() => {});
    await expect(
      retryWithTimeout(hang, {
        retries: 1,
        timeoutMs: 20,
        baseDelayMs: 5,
        maxDelayMs: 10,
        jitter: 0,
      }),
    ).rejects.toThrow(/ERR_EXECUTION_TIMEOUT/);
  });

  test("retries on rejection and eventually succeeds", async () => {
    let calls = 0;
    const flaky = () => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("transient"));
      return Promise.resolve("ok");
    };

    const result = await retryWithTimeout(flaky, {
      retries: 2,
      timeoutMs: 100,
    });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  test("times out on first attempt then succeeds on second attempt", async () => {
    let calls = 0;
    const op = () => {
      calls += 1;
      if (calls === 1) return new Promise(() => {});
      return new Promise((resolve) => setTimeout(() => resolve("later"), 20));
    };

    const result = await retryWithTimeout(op, {
      retries: 2,
      timeoutMs: 30,
      baseDelayMs: 5,
      maxDelayMs: 10,
      jitter: 0,
    });
    expect(result).toBe("later");
    expect(calls).toBe(2);
  });
});
