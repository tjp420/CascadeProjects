"use strict";

jest.mock("../outreach-mail.cjs", () => ({
  loadSentLog: jest.fn().mockResolvedValue([]),
  writeSentLog: jest.fn(),
}));

const {
  WEBHOOK_PATH,
  emptyEngagement,
  verifySvixWebhook,
  processResendWebhookEvent,
  applyEngagementPatch,
  findSentRowIndex,
  setupOutreachResendWebhook,
} = require("../outreach-resend-webhook.cjs");

describe("outreach-resend-webhook", () => {
  test("exports expected functions and constants", () => {
    expect(typeof WEBHOOK_PATH).toBe("string");
    expect(WEBHOOK_PATH).toContain("/webhooks/resend");
    expect(typeof emptyEngagement).toBe("function");
    expect(typeof verifySvixWebhook).toBe("function");
    expect(typeof processResendWebhookEvent).toBe("function");
    expect(typeof applyEngagementPatch).toBe("function");
    expect(typeof findSentRowIndex).toBe("function");
    expect(typeof setupOutreachResendWebhook).toBe("function");
  });

  test("emptyEngagement returns object with null fields", () => {
    const result = emptyEngagement();
    expect(result.sentAt).toBeNull();
    expect(result.deliveredAt).toBeNull();
    expect(result.openedAt).toBeNull();
    expect(result.clickedAt).toBeNull();
    expect(result.bouncedAt).toBeNull();
    expect(result.complainedAt).toBeNull();
    expect(result.lastEventAt).toBeNull();
    expect(result.lastEventType).toBeNull();
  });

  test("applyEngagementPatch updates fields from event", () => {
    const engagement = emptyEngagement();
    const event = {
      type: "email.delivered",
      created_at: "2024-01-01T00:00:00Z",
    };
    const result = applyEngagementPatch(engagement, event);
    expect(result.engagement.deliveredAt).toBe("2024-01-01T00:00:00Z");
    expect(result.engagement.lastEventType).toBe("email.delivered");
  });

  test("applyEngagementPatch handles open event", () => {
    const engagement = emptyEngagement();
    const event = { type: "email.opened", created_at: "2024-01-02T00:00:00Z" };
    const result = applyEngagementPatch(engagement, event);
    expect(result.engagement.openedAt).toBe("2024-01-02T00:00:00Z");
  });

  test("applyEngagementPatch handles click event", () => {
    const engagement = emptyEngagement();
    const event = { type: "email.clicked", created_at: "2024-01-03T00:00:00Z" };
    const result = applyEngagementPatch(engagement, event);
    expect(result.engagement.clickedAt).toBe("2024-01-03T00:00:00Z");
  });

  test("applyEngagementPatch handles bounce event", () => {
    const engagement = emptyEngagement();
    const event = { type: "email.bounced", created_at: "2024-01-04T00:00:00Z" };
    const result = applyEngagementPatch(engagement, event);
    expect(result.engagement.bouncedAt).toBe("2024-01-04T00:00:00Z");
  });

  test("applyEngagementPatch handles complaint event", () => {
    const engagement = emptyEngagement();
    const event = {
      type: "email.complained",
      created_at: "2024-01-05T00:00:00Z",
    };
    const result = applyEngagementPatch(engagement, event);
    expect(result.engagement.complainedAt).toBe("2024-01-05T00:00:00Z");
  });

  test("findSentRowIndex returns -1 for empty rows", () => {
    expect(findSentRowIndex([], { data: {} })).toBe(-1);
  });

  test("verifySvixWebhook returns null for missing secret", async () => {
    const result = await verifySvixWebhook(null, {}, "");
    expect(result).toBeNull();
  });
});
