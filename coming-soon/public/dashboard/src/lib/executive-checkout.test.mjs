import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExecutiveCheckoutBody,
  isValidCheckoutEmail,
  remainingLockedRows,
} from "./executive-checkout.ts";

describe("remainingLockedRows", () => {
  it("locks 47 of a 50-row capped list after a 3-row preview", () => {
    assert.equal(remainingLockedRows(50, 3), 47);
  });

  it("does not go negative when the list is shorter than the preview", () => {
    assert.equal(remainingLockedRows(2, 3), 0);
  });
});

describe("buildExecutiveCheckoutBody", () => {
  it("posts executive_clearance metadata for Stripe session create", () => {
    const body = buildExecutiveCheckoutBody({
      email: "buyer@example.com",
      projectName: "CascadeProjects",
    });
    assert.equal(body.product, "executive_clearance");
    assert.equal(body.total, 499);
    assert.deepEqual(body.scans, ["executive_clearance"]);
    assert.equal(body.email, "buyer@example.com");
    assert.equal(body.projectName, "CascadeProjects");
    assert.equal(body.clientName, "buyer@example.com");
  });
});

describe("isValidCheckoutEmail", () => {
  it("rejects empty and malformed addresses", () => {
    assert.equal(isValidCheckoutEmail(""), false);
    assert.equal(isValidCheckoutEmail("not-an-email"), false);
    assert.equal(isValidCheckoutEmail("buyer@example.com"), true);
  });
});
