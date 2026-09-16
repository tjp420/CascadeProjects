import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGuestFunnelPayload,
  isGuestFunnelEvent,
  scanSizeBucket,
  trackGuestFunnelEvent,
} from "./guest-funnel-telemetry.ts";

describe("scanSizeBucket", () => {
  it("maps counts to coarse buckets without exposing exact inventory", () => {
    assert.equal(scanSizeBucket(0), "0");
    assert.equal(scanSizeBucket(40), "1-100");
    assert.equal(scanSizeBucket(23000), "10000+");
    assert.equal(scanSizeBucket("nope"), "unknown");
  });
});

describe("buildGuestFunnelPayload", () => {
  it("keeps only allowlisted conversion fields", () => {
    const payload = buildGuestFunnelPayload(
      "upgrade_cta_clicked",
      {
        scan_size_bucket: "10000+",
        surface: "remediation",
        filePath: "server/secrets.py",
        findings: [{ rule: "leak" }],
        email: "buyer@example.com",
        projectName: "CascadeProjects",
      },
      { sessionId: "sid-1", page: "/dashboard/#/remediation", now: "2026-09-16T00:00:00.000Z" },
    );
    assert.ok(payload);
    assert.equal(payload.event, "upgrade_cta_clicked");
    assert.equal(payload.sessionId, "sid-1");
    assert.deepEqual(payload.data, {
      scan_size_bucket: "10000+",
      surface: "remediation",
    });
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes("secrets.py"), false);
    assert.equal(serialized.includes("buyer@example.com"), false);
    assert.equal(serialized.includes("CascadeProjects"), false);
  });

  it("rejects unknown event names", () => {
    assert.equal(isGuestFunnelEvent("upgrade_cta_clicked"), true);
    assert.equal(buildGuestFunnelPayload("not_a_funnel_event"), null);
  });
});

describe("trackGuestFunnelEvent", () => {
  it("emits one POST per click and swallows transport failures", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      throw new Error("network down");
    };
    try {
      const first = await trackGuestFunnelEvent("upgrade_cta_clicked", {
        surface: "analyze",
      });
      const second = await trackGuestFunnelEvent("upgrade_cta_clicked", {
        surface: "analyze",
      });
      assert.equal(first, true);
      assert.equal(second, true);
      assert.equal(calls.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
