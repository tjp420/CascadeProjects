"use strict";

const ratchet = require("../../crypto/ratchet/index.cjs");

test("ratchet bootstrap stub returns publicMetadata and sessionId", () => {
  const res = ratchet.bootstrapSession({ tenant: "t1" });
  expect(res).toHaveProperty("sessionId");
  expect(res).toHaveProperty("publicMetadata");
});

test("exportPublicMetadata returns object", () => {
  const meta = ratchet.exportPublicMetadata("no-session");
  expect(meta).toHaveProperty("version");
});
