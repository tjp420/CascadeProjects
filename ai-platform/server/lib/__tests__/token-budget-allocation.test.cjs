"use strict";

const fs = require("fs");
const path = require("path");

jest.mock("../webhook-engine.cjs", () => ({
  dispatchEvent: jest.fn().mockResolvedValue({}),
}));

const tokenBudget = require("../token-budget-allocation-store.cjs");
const webhookEngine = require("../webhook-engine.cjs");

const STORE_PATH = path.join(
  process.cwd(),
  ".simplebeacon",
  "token-budgets.json",
);

beforeAll(() => {
  try {
    fs.unlinkSync(STORE_PATH);
  } catch {}
});

afterAll(() => {
  try {
    fs.unlinkSync(STORE_PATH);
  } catch {}
});

afterEach(() => {
  webhookEngine.dispatchEvent.mockClear();
});

describe("token-budget-allocation-store", () => {
  test("creates and retrieves a budget", () => {
    const res = tokenBudget.createBudget("org-a", {
      limitUSD: 100,
      period: "monthly",
    });
    expect(res.success).toBe(true);
    expect(res.budget.orgId).toBe("org-a");

    const got = tokenBudget.getBudget("org-a", "org");
    expect(got.limitUSD).toBe(100);
    expect(got.spentUSD).toBe(0);
  });

  test("records usage and updates spend", () => {
    const res = tokenBudget.recordUsage("org-a", {
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 1000,
      userId: "u1",
    });
    expect(res.recorded).toBe(true);
    expect(res.costUSD).toBeGreaterThan(0);
    expect(res.percentUsed).toBeGreaterThan(0);
  });

  test("fires custom alert intervals and dispatches webhook events", () => {
    tokenBudget.updateBudget("org-a", {
      config: {
        alertIntervals: [50, 80, 100],
        alertCooldownMinutes: 0,
        webhookAlertsEnabled: true,
      },
    });

    // Cross the 50% custom interval
    const r1 = tokenBudget.recordUsage("org-a", {
      model: "gpt-4",
      inputTokens: 2000000,
      outputTokens: 0,
      userId: "u1",
    });
    expect(r1.thresholdCrossed).toBeTruthy();
    expect(r1.thresholdCrossed.type).toBe("interval");
    expect(r1.thresholdCrossed.crossed).toBe(50);

    // Cross the 80% soft-cap boundary
    const r2 = tokenBudget.recordUsage("org-a", {
      model: "gpt-4",
      inputTokens: 1000000,
      outputTokens: 0,
      userId: "u1",
    });
    expect(r2.thresholdCrossed.type).toBe("soft_cap");
    expect(r2.thresholdCrossed.crossed).toBe(80);

    // Cross the 100% hard-stop boundary
    const r3 = tokenBudget.recordUsage("org-a", {
      model: "gpt-4",
      inputTokens: 1000000,
      outputTokens: 0,
      userId: "u1",
    });
    expect(r3.thresholdCrossed.type).toBe("hard_stop");
    expect(r3.thresholdCrossed.crossed).toBe(100);

    expect(webhookEngine.dispatchEvent).toHaveBeenCalled();
    const lastCall =
      webhookEngine.dispatchEvent.mock.calls[
        webhookEngine.dispatchEvent.mock.calls.length - 1
      ];
    expect(lastCall[0]).toBe("budget_threshold_exceeded");
    expect(lastCall[1].thresholdType).toBe("hard_stop");
    expect(lastCall[1].severity).toBe("critical");
  });

  test("enforces hard stop via checkHardStop", () => {
    const hard = tokenBudget.checkHardStop("org-a");
    expect(hard.blocked).toBe(true);
    expect(hard.reason).toBe("budget_hard_stop_exceeded");
    expect(hard.pct).toBeGreaterThan(100);
  });

  test("auto-resets a budget when periodEnd has passed", () => {
    const create = tokenBudget.createBudget("org-roll", {
      limitUSD: 50,
      period: "monthly",
      config: { autoResetEnabled: true },
    });
    expect(create.success).toBe(true);

    const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    store.budgets["org-roll::org"].periodEnd = "2020-01-01T00:00:00.000Z";
    store.budgets["org-roll::org"].spentUSD = 99;
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));

    const res = tokenBudget.recordUsage("org-roll", {
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 0,
    });
    expect(res.recorded).toBe(true);

    const got = tokenBudget.getBudget("org-roll", "org");
    expect(got.spentUSD).toBeLessThan(1);
    expect(new Date(got.periodEnd).getTime()).toBeGreaterThan(Date.now());
    expect(got.alerts).toEqual([]);
  });

  test("does not record against a disabled budget", () => {
    tokenBudget.createBudget("org-disabled", { limitUSD: 10, enabled: false });
    const res = tokenBudget.recordUsage("org-disabled", {
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 0,
    });
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("no_budget");
  });
});
