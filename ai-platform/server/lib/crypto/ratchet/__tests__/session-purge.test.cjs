"use strict";

const fs = require("fs");
const path = require("path");
const SessionStore = require("../session-store.cjs");
const Purger = require("../../../storage/purger.cjs");

const BASE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  ".data",
  "ratchet-sessions",
);

beforeAll(() => {
  // Stop the auto-started purger so it doesn't interfere with the fast-forward test
  SessionStore.stopPurger();
});

afterAll(() => {
  SessionStore.stopPurger();
});

function sessionFile(tenant, sid) {
  return path.join(BASE_DIR, tenant, `${sid}.json`);
}

describe("SessionStore purger", () => {
  test("fast-forward zero-TTL purge cycle deletes expired session record", () => {
    const tenant = `purge-tenant-${Date.now()}`;
    const sid = `purge-session-${Date.now()}`;

    SessionStore.create({
      sessionId: sid,
      tenantId: tenant,
      root: Buffer.from("test-root"),
    });

    const fp = sessionFile(tenant, sid);
    expect(fs.existsSync(fp)).toBe(true);

    // Simulate a stale, unrotated session by rewinding updatedAt
    const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
    raw.updatedAt = Date.now() - 1000;
    fs.writeFileSync(fp, JSON.stringify(raw, null, 2));

    // Zero-TTL run should purge every file whose timestamp is not in the future
    const purged = Purger.purgeExpiredSessions(BASE_DIR, 0);
    expect(purged.length).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(fp)).toBe(false);
  });
});
