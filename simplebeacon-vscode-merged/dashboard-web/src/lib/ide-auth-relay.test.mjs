import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildIdeAuthRelayHref,
  isIdeAuthRelayUri,
  isEmbeddedIdeSurface,
  shouldAssignIdeAuthRelayLocation,
} from "./ide-auth-relay.ts";

describe("ide-auth-relay", () => {
  test("accepts Cursor and VS Code relay URIs", () => {
    assert.equal(
      isIdeAuthRelayUri("cursor://simplebeacon.simplebeacon-vscode/relay/auth"),
      true,
    );
    assert.equal(
      isIdeAuthRelayUri("vscode://simplebeacon.simplebeacon-vscode/relay/auth"),
      true,
    );
    assert.equal(
      isIdeAuthRelayUri("https://simplebeacon.ai/dashboard/signin"),
      false,
    );
  });

  test("builds relay href with token query", () => {
    const href = buildIdeAuthRelayHref(
      "cursor://simplebeacon.simplebeacon-vscode/relay/auth",
      "tok.en",
      { tier: "developer", isAdmin: false },
    );
    assert.match(href, /^cursor:\/\/simplebeacon\.simplebeacon-vscode\/relay\/auth\?/);
    assert.match(href, /signedIn=true/);
    assert.match(href, /token=tok\.en/);
  });

  test("allows cursor:// assign only outside an IDE iframe", () => {
    assert.equal(isEmbeddedIdeSurface(), false);
    assert.equal(
      shouldAssignIdeAuthRelayLocation(
        "cursor://simplebeacon.simplebeacon-vscode/relay/auth",
      ),
      true,
    );
    assert.equal(shouldAssignIdeAuthRelayLocation("https://example.com"), false);
  });
});
