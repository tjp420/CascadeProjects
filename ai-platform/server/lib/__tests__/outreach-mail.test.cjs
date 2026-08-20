// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
"use strict";

const {
  getOutreachFrom,
  getOutreachReplyTo,
  isOutreachConfigured,
  loadSentLog,
  writeSentLog,
  sentEntryId,
  removeSentLogEntry,
  sendOutreachEmail,
  validateEmail,
} = require("../outreach-mail.cjs");

describe("outreach-mail", () => {
  test("exports expected functions", () => {
    expect(typeof getOutreachFrom).toBe("function");
    expect(typeof getOutreachReplyTo).toBe("function");
    expect(typeof isOutreachConfigured).toBe("function");
    expect(typeof loadSentLog).toBe("function");
    expect(typeof writeSentLog).toBe("function");
    expect(typeof sentEntryId).toBe("function");
    expect(typeof removeSentLogEntry).toBe("function");
    expect(typeof sendOutreachEmail).toBe("function");
    expect(typeof validateEmail).toBe("function");
  });

  test("getOutreachFrom returns default", () => {
    delete process.env.OUTREACH_FROM;
    expect(getOutreachFrom()).toBe("outreach@simplebeacon.ai");
  });

  test("getOutreachFrom respects env var", () => {
    process.env.OUTREACH_FROM = "custom@example.com";
    expect(getOutreachFrom()).toBe("custom@example.com");
    delete process.env.OUTREACH_FROM;
  });

  test("getOutreachReplyTo returns default", () => {
    delete process.env.OUTREACH_REPLY_TO;
    expect(getOutreachReplyTo()).toBe("outreach@simplebeacon.ai");
  });

  test("isOutreachConfigured returns false without RESEND_API_KEY", () => {
    delete process.env.RESEND_API_KEY;
    expect(isOutreachConfigured()).toBe(false);
  });

  test("isOutreachConfigured returns true with RESEND_API_KEY", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    expect(isOutreachConfigured()).toBe(true);
    delete process.env.RESEND_API_KEY;
  });

  test("validateEmail accepts valid email", () => {
    expect(validateEmail("test@example.com")).toBe(true);
  });

  test("validateEmail rejects invalid email", () => {
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("")).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail("a@b")).toBe(false);
  });

  test("sentEntryId uses row.id when present", () => {
    expect(sentEntryId({ id: "abc" }, 0)).toBe("abc");
  });

  test("sentEntryId generates fallback id", () => {
    const id = sentEntryId({ sentAt: "2024-01-01", to: "a@b.com" }, 2);
    expect(id).toBe("2024-01-01|a@b.com|2");
  });

  test("loadSentLog returns empty array for nonexistent file", async () => {
    const rows = await loadSentLog({ dataDir: "/nonexistent/path/xyz" });
    expect(rows).toEqual([]);
  });

  test("removeSentLogEntry throws on missing id", async () => {
    await expect(
      removeSentLogEntry("", { dataDir: "/nonexistent" }),
    ).rejects.toMatchObject({ code: "missing_id" });
  });

  test("removeSentLogEntry throws on not found", async () => {
    await expect(
      removeSentLogEntry("nonexistent-id", { dataDir: "/nonexistent" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  test("sendOutreachEmail throws on invalid email", async () => {
    await expect(
      sendOutreachEmail({
        to: "bad",
        subject: "Test subject",
        text: "This is a long enough message body.",
      }),
    ).rejects.toMatchObject({ code: "invalid_email" });
  });

  test("sendOutreachEmail throws on short subject", async () => {
    await expect(
      sendOutreachEmail({
        to: "test@example.com",
        subject: "x",
        text: "This is a long enough message body.",
      }),
    ).rejects.toMatchObject({ code: "subject_too_short" });
  });

  test("sendOutreachEmail throws on short message", async () => {
    await expect(
      sendOutreachEmail({
        to: "test@example.com",
        subject: "Test subject",
        text: "short",
      }),
    ).rejects.toMatchObject({ code: "message_too_short" });
  });
});
