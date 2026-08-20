const {
  generateWithProvider,
} = require("../services/cloud-inference-service.cjs");

describe("cloud-inference-service retry wrapper", () => {
  const origFetch = global.fetch;
  beforeAll(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
  });
  afterAll(() => {
    global.fetch = origFetch;
  });

  test("recovers from a transient abort and succeeds on retry", async () => {
    let callCount = 0;
    global.fetch = jest.fn(async (url, opts) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        throw err;
      }
      // second call: return ok-like response
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "ok response" } }],
          usage: { total_tokens: 10 },
        }),
      };
    });

    const res = await generateWithProvider("openai", "hello world", {
      timeoutMs: 5000,
    });
    expect(res).toBeDefined();
    expect(res.text).toContain("ok response");
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
