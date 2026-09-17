import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExecutiveCheckoutBody,
  buildExecutiveCertificateSvg,
  isValidCheckoutEmail,
  parseCheckoutReturnParams,
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

describe("parseCheckoutReturnParams", () => {
  it("reads session_id from search or hash", () => {
    assert.equal(
      parseCheckoutReturnParams("?session_id=cs_test_123", "#/results")
        .sessionId,
      "cs_test_123",
    );
    assert.equal(
      parseCheckoutReturnParams("", "#/results?session_id=cs_hash&checkout=success")
        .sessionId,
      "cs_hash",
    );
    assert.equal(
      parseCheckoutReturnParams("?checkout=success", "").checkoutSuccess,
      true,
    );
  });
});

describe("buildExecutiveCertificateSvg", () => {
  it("embeds project name and avoids attestation language", () => {
    const svg = buildExecutiveCertificateSvg({
      projectName: "CascadeProjects",
      issuedAt: "2026-09-16",
    });
    assert.match(svg, /CascadeProjects/);
    assert.match(svg, /Executive Risk Certificate/);
    assert.match(svg, /Not a security attestation/);
  });
});
