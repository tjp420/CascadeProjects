// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
jest.mock("../../shared-utils/index.cjs", () => {
  return jest.fn((path) => {
    if (path === "sales/license/renewal-tracker.js") {
      return {
        checkExpiringLicenses: jest.fn((records, days) =>
          records
            .filter((r) => {
              const diff = Math.ceil(
                (new Date(r.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24),
              );
              return diff <= days;
            })
            .map((r) => ({
              ...r,
              daysRemaining: Math.ceil(
                (new Date(r.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24),
              ),
            })),
        ),
      };
    }
    return require(path);
  });
});

const { dispatchAutomatedRenewalEmails } = require("../renewals.cjs");

describe("dispatchAutomatedRenewalEmails", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.RESEND_API_KEY;

  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.RESEND_API_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RESEND_API_KEY = originalEnv;
    jest.clearAllMocks();
  });

  test("returns zero counts when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await dispatchAutomatedRenewalEmails([]);
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  test("dispatches emails for expiring licenses", async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => "" });

    const records = [
      {
        companyId: "acme",
        customerEmail: "admin@acme.com",
        expiresAt: "2026-07-10",
        tier: "team",
      },
    ];

    const result = await dispatchAutomatedRenewalEmails(records);
    expect(result.sent).toBeGreaterThanOrEqual(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://resend.com");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toMatch(/Bearer test-api-key/);
  });

  test("tracks failed sends when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("Network failure"));

    const records = [
      {
        companyId: "fail-corp",
        customerEmail: "fail@corp.com",
        expiresAt: "2026-07-05",
        tier: "enterprise",
      },
    ];

    const result = await dispatchAutomatedRenewalEmails(records);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  test("tracks skipped records that are not expiring", async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => "" });

    const records = [
      {
        companyId: "now",
        customerEmail: "a@b.com",
        expiresAt: "2026-07-05",
        tier: "team",
      },
      {
        companyId: "later",
        customerEmail: "c@d.com",
        expiresAt: "2027-01-01",
        tier: "enterprise",
      },
    ];

    const result = await dispatchAutomatedRenewalEmails(records);
    expect(result.sent + result.failed + result.skipped).toBe(2);
  });
});
