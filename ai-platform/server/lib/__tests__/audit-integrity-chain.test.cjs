"use strict";

/**
 * Tests for audit log integrity hash chain in audit-logger.cjs
 *
 * Tests chain construction (prevHash + hash on every entry), tamper
 * detection (modified fields, broken links), verifyChain() behavior,
 * and the GET /api/audit/verify-integrity E2E endpoint.
 */

const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// Set env vars before requiring modules
const _tempLogPath = path.join(os.tmpdir(), "sb-audit-chain-test-log.json");
process.env.AUDIT_LOG_PATH = _tempLogPath;

// Write empty store
fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");

const auditLogger = require("../audit-logger.cjs");

// E2E test setup
const request = require("supertest");
const express = require("express");

// Mock authenticate for E2E
jest.mock("../../middleware/auth.cjs", () => ({
  authenticate: function mockAuthenticate(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({
      success: false,
      error: "authentication_required",
      message: "Authentication required",
    });
  },
}));

const ADMIN_USER = {
  id: "admin@org-a.com",
  email: "admin@org-a.com",
  role: "admin",
  permissions: ["admin:all"],
};

const REGULAR_USER = {
  id: "user@org-a.com",
  email: "user@org-a.com",
  role: "developer",
};

function createTestApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (user) req.user = user;
    next();
  });
  const auditRoutes = require("../../routes/audit-routes.cjs");
  app.use("/api/audit", auditRoutes);
  return app;
}

function resetStore() {
  fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");
}

describe("Audit Log Integrity Hash Chain", () => {
  beforeEach(() => {
    resetStore();
  });

  after(() => {
    try {
      if (fs.existsSync(_tempLogPath)) fs.unlinkSync(_tempLogPath);
    } catch {}
  });

  // ── Chain Construction ─────────────────────────────────────────────────────

  describe("chain construction", () => {
    it("should add prevHash and hash fields to every log entry", () => {
      const entry = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test_entity",
        entityId: "ent-1",
      });

      assert.ok(entry.prevHash, "Entry should have prevHash");
      assert.ok(entry.hash, "Entry should have hash");
      assert.strictEqual(entry.prevHash, auditLogger.GENESIS_HASH);
      assert.strictEqual(entry.hash.length, 64); // SHA-256 hex
    });

    it("should link second entry to first entry via prevHash", () => {
      const e1 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test_entity",
        entityId: "ent-1",
      });

      const e2 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "UPDATE",
        entity: "test_entity",
        entityId: "ent-1",
      });

      assert.strictEqual(e2.prevHash, e1.hash);
    });

    it("should use genesis hash for first entry in a new org", () => {
      const entry = auditLogger.log({
        orgId: "org-new",
        actorId: "user1",
        actorEmail: "user1@org-new.com",
        action: "CREATE",
        entity: "test_entity",
        entityId: "ent-1",
      });

      assert.strictEqual(entry.prevHash, auditLogger.GENESIS_HASH);
      assert.strictEqual(entry.prevHash, "0".repeat(64));
    });

    it("should maintain independent chains per org", () => {
      const e1a = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });

      const e1b = auditLogger.log({
        orgId: "org-b",
        actorId: "user2",
        actorEmail: "user2@org-b.com",
        action: "CREATE",
        entity: "test",
        entityId: "2",
      });

      // Both should start from genesis
      assert.strictEqual(e1a.prevHash, auditLogger.GENESIS_HASH);
      assert.strictEqual(e1b.prevHash, auditLogger.GENESIS_HASH);

      // Second entry in org-a should link to e1a, not e1b
      const e2a = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "UPDATE",
        entity: "test",
        entityId: "1",
      });

      assert.strictEqual(e2a.prevHash, e1a.hash);
    });

    it("should produce deterministic hashes for identical entries", () => {
      // Same input should produce same hash (given same prevHash)
      const prevHash = auditLogger.GENESIS_HASH;
      const entry1 = {
        id: "test-id",
        orgId: "org-a",
        timestamp: "2026-01-01T00:00:00.000Z",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
        changes: [],
        metadata: null,
      };

      const hash1 = auditLogger.computeEntryHash(entry1, prevHash);
      const hash2 = auditLogger.computeEntryHash({ ...entry1 }, prevHash);
      assert.strictEqual(hash1, hash2);
    });
  });

  // ── verifyChain ────────────────────────────────────────────────────────────

  describe("verifyChain", () => {
    it("should return valid=true for an untampered chain", () => {
      auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });
      auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "UPDATE",
        entity: "test",
        entityId: "1",
      });

      const result = auditLogger.verifyChain("org-a");
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.totalEntries, 2);
      assert.strictEqual(result.verifiedEntries, 2);
      assert.strictEqual(result.brokenLinks.length, 0);
      assert.strictEqual(result.tamperedEntries.length, 0);
    });

    it("should return valid=true for empty org", () => {
      const result = auditLogger.verifyChain("org-empty");
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.totalEntries, 0);
      assert.strictEqual(result.verifiedEntries, 0);
    });

    it("should detect tampered entry (modified action field)", () => {
      const e1 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });

      // Tamper: modify the action field directly in the store
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const key = `org-a::${e1.id}`;
      store.entries[key].action = "DELETE"; // tampered!
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      const result = auditLogger.verifyChain("org-a");
      assert.strictEqual(result.valid, false);
      assert.ok(result.tamperedEntries.length > 0);
      assert.strictEqual(result.tamperedEntries[0].id, e1.id);
    });

    it("should detect broken hash link (modified prevHash)", () => {
      const e1 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });
      const e2 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "UPDATE",
        entity: "test",
        entityId: "1",
      });

      // Tamper: break the prevHash link on e2
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      store.entries[`org-a::${e2.id}`].prevHash = "f".repeat(64); // wrong hash
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      const result = auditLogger.verifyChain("org-a");
      assert.strictEqual(result.valid, false);
      assert.ok(result.brokenLinks.length > 0);
      assert.strictEqual(result.brokenLinks[0].id, e2.id);
    });

    it("should detect tampered metadata field", () => {
      const e1 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
        metadata: { ip: "127.0.0.1", route: "/api/test" },
      });

      // Tamper: modify metadata
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      store.entries[`org-a::${e1.id}`].metadata = {
        ip: "192.168.1.1",
        route: "/api/hack",
      };
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      const result = auditLogger.verifyChain("org-a");
      assert.strictEqual(result.valid, false);
      assert.ok(result.tamperedEntries.length > 0);
    });

    it("should detect tampered timestamp", () => {
      const e1 = auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });

      // Tamper: modify timestamp
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      store.entries[`org-a::${e1.id}`].timestamp = "2020-01-01T00:00:00.000Z";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      const result = auditLogger.verifyChain("org-a");
      assert.strictEqual(result.valid, false);
      assert.ok(result.tamperedEntries.length > 0);
    });

    it("should verify only the specified org (not cross-contaminate)", () => {
      // Create entries in org-a and org-b
      auditLogger.log({
        orgId: "org-a",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });
      auditLogger.log({
        orgId: "org-b",
        actorId: "user2",
        actorEmail: "user2@org-b.com",
        action: "CREATE",
        entity: "test",
        entityId: "2",
      });

      // Tamper with org-b's entry
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const orgBKey = Object.keys(store.entries).find(
        (k) => store.entries[k].orgId === "org-b",
      );
      store.entries[orgBKey].action = "DELETE";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      // org-a should still be valid
      const resultA = auditLogger.verifyChain("org-a");
      assert.strictEqual(resultA.valid, true);

      // org-b should be invalid
      const resultB = auditLogger.verifyChain("org-b");
      assert.strictEqual(resultB.valid, false);
    });

    it("should handle multi-entry chain with tamper in the middle", () => {
      // Create 5 entries
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(
          auditLogger.log({
            orgId: "org-a",
            actorId: "user1",
            actorEmail: "user1@org-a.com",
            action: "CREATE",
            entity: "test",
            entityId: String(i),
          }),
        );
      }

      // Tamper with entry 3 (middle)
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const key = `org-a::${entries[2].id}`;
      store.entries[key].actorEmail = "hacker@evil.com";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      const result = auditLogger.verifyChain("org-a");
      assert.strictEqual(result.valid, false);
      assert.ok(result.tamperedEntries.length >= 1);
      // The tampered entry should be detected
      assert.ok(result.tamperedEntries.some((t) => t.id === entries[2].id));
    });
  });

  // ── computeEntryHash ───────────────────────────────────────────────────────

  describe("computeEntryHash", () => {
    it("should produce a 64-char hex string", () => {
      const entry = {
        id: "test",
        orgId: "org-a",
        timestamp: "2026-01-01T00:00:00.000Z",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
        changes: [],
        metadata: null,
      };
      const hash = auditLogger.computeEntryHash(
        entry,
        auditLogger.GENESIS_HASH,
      );
      assert.strictEqual(hash.length, 64);
      assert.ok(/^[0-9a-f]+$/.test(hash));
    });

    it("should produce different hashes for different prevHash values", () => {
      const entry = {
        id: "test",
        orgId: "org-a",
        timestamp: "2026-01-01T00:00:00.000Z",
        actorId: "user1",
        actorEmail: "user1@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
        changes: [],
        metadata: null,
      };
      const hash1 = auditLogger.computeEntryHash(
        entry,
        auditLogger.GENESIS_HASH,
      );
      const hash2 = auditLogger.computeEntryHash(entry, "a".repeat(64));
      assert.notStrictEqual(hash1, hash2);
    });
  });

  // ── E2E: GET /api/audit/verify-integrity ──────────────────────────────────

  describe("E2E: GET /api/audit/verify-integrity", () => {
    let adminApp;
    let regularApp;
    let noAuthApp;

    before(() => {
      adminApp = createTestApp(ADMIN_USER);
      regularApp = createTestApp(REGULAR_USER);
      noAuthApp = createTestApp(null);
    });

    beforeEach(() => {
      resetStore();
    });

    it("should return 200 with valid chain for admin user", async () => {
      // Log an entry first
      auditLogger.log({
        orgId: "admin@org-a.com",
        actorId: "admin@org-a.com",
        actorEmail: "admin@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });

      const res = await request(adminApp).get("/api/audit/verify-integrity");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.valid, true);
      assert.ok(typeof res.body.totalEntries === "number");
      assert.ok(typeof res.body.verifiedEntries === "number");
      assert.ok(Array.isArray(res.body.brokenLinks));
      assert.ok(Array.isArray(res.body.tamperedEntries));
    });

    it("should return valid=true for empty org", async () => {
      const res = await request(adminApp).get("/api/audit/verify-integrity");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.valid, true);
      assert.strictEqual(res.body.totalEntries, 0);
    });

    it("should detect tampering via API", async () => {
      // Log an entry
      const entry = auditLogger.log({
        orgId: "admin@org-a.com",
        actorId: "admin@org-a.com",
        actorEmail: "admin@org-a.com",
        action: "CREATE",
        entity: "test",
        entityId: "1",
      });

      // Tamper
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      store.entries[`admin@org-a.com::${entry.id}`].action = "DELETE";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      const res = await request(adminApp).get("/api/audit/verify-integrity");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.valid, false);
      assert.ok(res.body.tamperedEntries.length > 0);
    });

    it("should reject non-admin user with 403", async () => {
      const res = await request(regularApp).get("/api/audit/verify-integrity");
      assert.strictEqual(res.status, 403);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(noAuthApp).get("/api/audit/verify-integrity");
      assert.strictEqual(res.status, 401);
    });
  });
});
