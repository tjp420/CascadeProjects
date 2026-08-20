"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert");
const os = require("os");
const path = require("path");
const fs = require("fs");

// Isolate token-db to a temp file so issueToken() calls don't pollute
// the production server/db/token-registry.json.
if (!process.env.SIMPLEBEACON_TOKEN_DB_PATH) {
  const _testDbDir = path.join(os.tmpdir(), "sb-replicator-test-" + Date.now());
  fs.mkdirSync(_testDbDir, { recursive: true });
  process.env.SIMPLEBEACON_TOKEN_DB_PATH = path.join(
    _testDbDir,
    "token-registry.json",
  );
}

const replicator = require("../session-token-replicator.cjs");

function makeSocket(tenantId = "tenant-1") {
  return { tenantId, write: () => true, destroy: () => {} };
}

describe("session-token-replicator", () => {
  it("sets and increments per-tenant token sequences", () => {
    const s1 = replicator._nextSequence("tenant-1");
    const s2 = replicator._nextSequence("tenant-1");
    const s3 = replicator._nextSequence("tenant-2");
    assert.strictEqual(s1, 1);
    assert.strictEqual(s2, 2);
    assert.strictEqual(s3, 1);
  });

  it("builds a state delta above a sequence threshold", async () => {
    replicator.setBroadcast(() => {});
    await replicator.issueToken({
      tokenHash: "hash-a",
      accountId: "acc-1",
      tenantId: "tenant-delta",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    await replicator.issueToken({
      tokenHash: "hash-b",
      accountId: "acc-1",
      tenantId: "tenant-delta",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const delta = await replicator.buildStateDelta("tenant-delta", 0);
    assert.ok(delta.length >= 2);
    assert.ok(delta.every((t) => (t.token_sequence || 0) > 0));
  });

  it("rejects cross-tenant SESSION_TOKEN_ISSUE", () => {
    const socket = makeSocket("tenant-1");
    const msg = {
      type: "SESSION_TOKEN_ISSUE",
      from: "node-2",
      tokenHash: "hash-x",
      accountId: "acc-1",
      tenantId: "tenant-2",
      epoch: 1,
      tokenSequence: 1,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    assert.rejects(
      async () => replicator.handleSessionTokenMessage(msg, socket),
      /CROSS_TENANT_SESSION_INJECTION_REJECTED/,
    );
  });

  it("accepts same-tenant SESSION_TOKEN_ISSUE and writes to token-db", async () => {
    const socket = makeSocket("tenant-1");
    const msg = {
      type: "SESSION_TOKEN_ISSUE",
      from: "node-2",
      tokenHash: "hash-same-" + Date.now(),
      accountId: "acc-1",
      tenantId: "tenant-1",
      epoch: 1,
      tokenSequence: 5,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const result = await replicator.handleSessionTokenMessage(msg, socket);
    assert.strictEqual(result.accepted, true);
  });

  it("processes SESSION_STATE_RESPONSE batch and records rejected items", async () => {
    const socket = makeSocket("tenant-1");
    const tokens = [
      {
        token_hash: "resp-1",
        account_id: "acc-1",
        tenant_id: "tenant-1",
        token_sequence: 1,
        epoch: 1,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      {
        token_hash: "resp-2",
        account_id: "acc-1",
        tenant_id: "tenant-1",
        token_sequence: 0,
        epoch: 0,
      }, // missing expires_at but not required by sync
    ];
    const msg = {
      type: "SESSION_STATE_RESPONSE",
      from: "node-2",
      tenantId: "tenant-1",
      tokens,
    };
    const result = await replicator.handleSessionTokenMessage(msg, socket);
    assert.strictEqual(result.accepted, true);
    assert.strictEqual(Array.isArray(result.results), true);
  });

  it("broadcasts a state response when handling SESSION_STATE_REQUEST", async () => {
    const calls = [];
    replicator.setBroadcast((msg) => calls.push(msg));
    const socket = makeSocket("tenant-1");
    await replicator.handleSessionTokenMessage(
      {
        type: "SESSION_STATE_REQUEST",
        from: "node-2",
        tenantId: "tenant-1",
        lastKnownSequence: 0,
      },
      socket,
    );
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].type, "SESSION_STATE_RESPONSE");
    assert.ok(Array.isArray(calls[0].tokens));
  });
});
