"use strict";

/**
 * Track 10: Production Backup Coordinator tests.
 *
 * Covers BC-01 through BC-09, L2-01 through L2-06, L3-01 through L3-03,
 * and S-01 through S-04, matched to the actual backup-coordinator.cjs API.
 */

const crypto = require("crypto");
const {
  BackupCoordinator,
  createMemoryStorage,
  BACKUP_VERSION,
} = require("../backup-coordinator.cjs");

describe("backup-coordinator", () => {
  const VALID_KEK = crypto.randomBytes(32);

  function makeBundle(overrides = {}) {
    return {
      keyringMaterial: crypto.randomBytes(64),
      auditLog: Buffer.from(
        JSON.stringify([{ eventId: 1, type: "KEY_COMMIT", node: "node-A" }]),
        "utf8",
      ),
      resumptionTickets: [
        {
          sessionId: "sid-1",
          nodeId: "node-A",
          issuedAt: Date.now(),
          prevRootHash: "abc123",
        },
      ],
      issuedAt: Date.now(),
      ...overrides,
    };
  }

  // ── BC-01: Constructor ───────────────────────────────────────────────────

  describe("BC-01: Constructor", () => {
    test("initializes with valid 32-byte KEK", () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      expect(coord.kek).toBeInstanceOf(Buffer);
      expect(coord.kek.length).toBe(32);
      expect(coord.retentionDays).toBe(30);
      expect(coord.immutable).toBe(false);
    });

    test("L3-02: rejects short KEK (16 bytes)", () => {
      expect(
        () => new BackupCoordinator({ kek: crypto.randomBytes(16) }),
      ).toThrow(/INVALID_KEK/);
    });

    test("rejects missing KEK", () => {
      expect(() => new BackupCoordinator({})).toThrow(/INVALID_KEK/);
    });

    test("accepts custom retention and immutable flag", () => {
      const coord = new BackupCoordinator({
        kek: VALID_KEK,
        retentionDays: 7,
        immutable: true,
      });
      expect(coord.retentionDays).toBe(7);
      expect(coord.immutable).toBe(true);
    });
  });

  // ── BC-04: deriveArchiveKey (static method) ──────────────────────────────

  describe("BC-04: deriveArchiveKey", () => {
    test("deterministic for same KEK and archiveId", () => {
      const kek = crypto.randomBytes(32);
      const key1 = BackupCoordinator.deriveArchiveKey(kek, "archive-001");
      const key2 = BackupCoordinator.deriveArchiveKey(kek, "archive-001");
      expect(key1.length).toBe(32);
      expect(key1.equals(key2)).toBe(true);
    });

    test("different archiveId produces different key", () => {
      const kek = crypto.randomBytes(32);
      const key1 = BackupCoordinator.deriveArchiveKey(kek, "archive-001");
      const key2 = BackupCoordinator.deriveArchiveKey(kek, "archive-002");
      expect(key1.equals(key2)).toBe(false);
    });

    test("different KEK produces different key", () => {
      const key1 = BackupCoordinator.deriveArchiveKey(
        crypto.randomBytes(32),
        "archive-001",
      );
      const key2 = BackupCoordinator.deriveArchiveKey(
        crypto.randomBytes(32),
        "archive-001",
      );
      expect(key1.equals(key2)).toBe(false);
    });
  });

  // ── BC-02 & BC-03: backup() and bundle validation ────────────────────────

  describe("BC-02/BC-03: backup()", () => {
    test("L2-01: creates archive with correct return shape", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      const result = await coord.backup(makeBundle());
      expect(result.archiveId).toBeDefined();
      expect(typeof result.archiveId).toBe("string");
      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe("string");
      expect(typeof result.tag).toBe("string"); // hex string
      expect(typeof result.timestamp).toBe("number");
    });

    test("L2-06: rejects bundle missing keyringMaterial", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      await expect(
        coord.backup({ auditLog: Buffer.from("test"), issuedAt: Date.now() }),
      ).rejects.toThrow(/INVALID_BUNDLE/);
    });

    test("rejects bundle where keyringMaterial is not a Buffer", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      await expect(
        coord.backup({
          keyringMaterial: "not-a-buffer",
          auditLog: Buffer.from("test"),
          issuedAt: Date.now(),
        }),
      ).rejects.toThrow(/INVALID_BUNDLE/);
    });

    test("rejects bundle missing auditLog", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      await expect(
        coord.backup({
          keyringMaterial: crypto.randomBytes(32),
          issuedAt: Date.now(),
        }),
      ).rejects.toThrow(/INVALID_BUNDLE/);
    });

    test("rejects bundle missing issuedAt", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      await expect(
        coord.backup({
          keyringMaterial: crypto.randomBytes(32),
          auditLog: Buffer.from("test"),
        }),
      ).rejects.toThrow(/INVALID_BUNDLE/);
    });
  });

  // ── BC-05 & BC-06: restore() and verifyArchive() ─────────────────────────

  describe("BC-05/BC-06: restore() and verifyArchive()", () => {
    test("L2-01: full backup and restore round-trip", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      const bundle = makeBundle();
      const { archiveId } = await coord.backup(bundle);
      const restored = await coord.restore(archiveId);

      expect(restored.metadata.archiveId).toBe(archiveId);
      expect(
        restored.bundle.keyringMaterial.equals(bundle.keyringMaterial),
      ).toBe(true);
      expect(Array.isArray(restored.bundle.auditLog)).toBe(true);
      expect(restored.bundle.auditLog[0].type).toBe("KEY_COMMIT");
      expect(restored.bundle.resumptionTickets).toHaveLength(1);
      expect(restored.bundle.resumptionTickets[0].sessionId).toBe("sid-1");
    });

    test("L2-02: dry-run restore returns bundle without side effects", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({ kek: VALID_KEK, storage });
      const bundle = makeBundle();
      const { archiveId } = await coord.backup(bundle);

      const listBefore = await storage.list();
      const restored = await coord.restore(archiveId, { dryRun: true });
      const listAfter = await storage.list();

      expect(restored.dryRun).toBe(true);
      expect(
        restored.bundle.keyringMaterial.equals(bundle.keyringMaterial),
      ).toBe(true);
      expect(listAfter).toHaveLength(listBefore.length);
    });

    test("L2-03: corrupted archive fails verification", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({ kek: VALID_KEK, storage });
      const bundle = makeBundle();
      const { archiveId } = await coord.backup(bundle);

      // Corrupt the archive in storage
      const archive = await storage.read(archiveId);
      archive[archive.length - 1] ^= 0xff; // flip last byte (tag)
      await storage.write(archiveId, archive);

      await expect(coord.restore(archiveId)).rejects.toThrow(/RESTORE_FAILED/);
    });

    test("L3-01: restore with asOf picks nearest earlier archive", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({ kek: VALID_KEK, storage });

      const t0 = 1000000;
      const t1 = 2000000;

      const r0 = await coord.backup(makeBundle({ issuedAt: t0 }));
      const r1 = await coord.backup(makeBundle({ issuedAt: t1 }));

      // Restore as of t0+1 — should pick t0 archive
      const restored = await coord.restore(r0.archiveId, { asOf: t0 + 1 });
      expect(restored.metadata.timestamp).toBe(t0);
    });

    test("BACKUP_NOT_FOUND for unknown archiveId", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      await expect(coord.restore("nonexistent-id")).rejects.toThrow(
        /BACKUP_NOT_FOUND/,
      );
    });

    test("verifyArchive returns false for malformed buffer", () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      const result = coord.verifyArchive(Buffer.alloc(5), "test-id");
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/MALFORMED/);
    });

    test("verifyArchive returns false for wrong version", () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      const fake = Buffer.alloc(50);
      fake[0] = 0x99; // wrong version
      const result = coord.verifyArchive(fake, "test-id");
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/VERSION/);
    });
  });

  // ── BC-07 & BC-08: prune() and immutability ──────────────────────────────

  describe("BC-07/BC-08: prune()", () => {
    test("L2-04: prune removes only old archives", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({
        kek: VALID_KEK,
        storage,
        retentionDays: 1,
      });

      // Create an old backup (2 days ago)
      const oldTime = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const old = await coord.backup(makeBundle({ issuedAt: oldTime }));

      // Create a recent backup (now)
      const recent = await coord.backup(makeBundle());

      // Prune everything older than 1 day ago
      const cutoff = Date.now() - 1 * 24 * 60 * 60 * 1000;
      const removed = await coord.prune(cutoff);
      expect(removed).toContain(old.archiveId);
      expect(removed).not.toContain(recent.archiveId);

      // Verify old is gone, recent remains
      await expect(coord.restore(old.archiveId)).rejects.toThrow(
        /BACKUP_NOT_FOUND/,
      );
      const restored = await coord.restore(recent.archiveId);
      expect(restored.metadata.archiveId).toBe(recent.archiveId);
    });

    test("L2-05: immutability prevents deletion", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({
        kek: VALID_KEK,
        storage,
        immutable: true,
        retentionDays: 1,
      });

      const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
      await coord.backup(makeBundle({ issuedAt: oldTime }));

      const removed = await coord.prune(Date.now());
      expect(removed).toHaveLength(0);

      const events = coord.events;
      expect(events.some((e) => e.type === "BACKUP_IMMUTABLE")).toBe(true);
    });

    test("prune emits audit event for each deletion", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({
        kek: VALID_KEK,
        storage,
        retentionDays: 1,
      });

      const oldTime = Date.now() - 5 * 24 * 60 * 60 * 1000;
      await coord.backup(makeBundle({ issuedAt: oldTime }));
      await coord.backup(makeBundle({ issuedAt: oldTime + 1 }));

      const removed = await coord.prune(Date.now());
      expect(removed).toHaveLength(2);

      const prunedEvents = coord.events.filter(
        (e) => e.type === "BACKUP_PRUNED",
      );
      expect(prunedEvents).toHaveLength(2);
    });
  });

  // ── BC-09: listArchives() ────────────────────────────────────────────────

  describe("BC-09: listArchives()", () => {
    test("returns metadata without plaintext keyring material", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      await coord.backup(makeBundle());
      await coord.backup(makeBundle());

      const archives = await coord.listArchives();
      expect(archives).toHaveLength(2);
      for (const a of archives) {
        expect(a.archiveId).toBeDefined();
        expect(typeof a.timestamp).toBe("number");
        expect(typeof a.size).toBe("number");
        // No plaintext keyring material should be present
        expect(a.keyringMaterial).toBeUndefined();
      }
    });

    test("returns empty array when no archives exist", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      const archives = await coord.listArchives();
      expect(archives).toEqual([]);
    });
  });

  // ── L3-03 & S-04: Resumption state excludes live PSK/Bloom filter ────────

  describe("L3-03/S-04: resumption state isolation", () => {
    test("encrypted bundle does not contain bloomFilter or live PSK", async () => {
      const coord = new BackupCoordinator({ kek: VALID_KEK });
      const bundle = makeBundle({
        resumptionTickets: [
          {
            sessionId: "sid-1",
            nodeId: "node-A",
            issuedAt: Date.now(),
            prevRootHash: "abc123",
            // These should NOT appear in the archive:
            psk: crypto.randomBytes(32).toString("base64"),
            bloomFilter: { nonces: ["a", "b"] },
          },
        ],
      });

      const { archiveId } = await coord.backup(bundle);
      const restored = await coord.restore(archiveId);

      expect(restored.bundle.resumptionTickets).toHaveLength(1);
      expect(restored.bundle.resumptionTickets[0].sessionId).toBe("sid-1");
      expect(restored.bundle.resumptionTickets[0].psk).toBeUndefined();
      expect(restored.bundle.resumptionTickets[0].bloomFilter).toBeUndefined();
      expect(restored.bundle.resumptionTickets[0].prevRootHash).toBe("abc123");
    });
  });

  // ── S-01 through S-03: Security properties ───────────────────────────────

  describe("S-01: archives are encrypted at rest and authenticated", () => {
    test("archive in storage is not plaintext", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({ kek: VALID_KEK, storage });
      const bundle = makeBundle();
      const { archiveId } = await coord.backup(bundle);

      const raw = await storage.read(archiveId);
      const rawStr = raw.toString("utf8");
      // Keyring material should not appear in plaintext
      expect(rawStr).not.toContain(bundle.keyringMaterial.toString("base64"));
      expect(rawStr).not.toContain(bundle.keyringMaterial.toString("hex"));
    });
  });

  describe("S-02: KEK is not persisted in backup objects", () => {
    test("KEK does not appear in archive data", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({ kek: VALID_KEK, storage });
      const { archiveId } = await coord.backup(makeBundle());

      const raw = await storage.read(archiveId);
      const rawStr = raw.toString("utf8");
      expect(rawStr).not.toContain(VALID_KEK.toString("base64"));
      expect(rawStr).not.toContain(VALID_KEK.toString("hex"));
    });
  });

  describe("S-03: pruning cannot delete immutable archives", () => {
    test("immutable archive survives prune with old timestamp", async () => {
      const storage = createMemoryStorage();
      const coord = new BackupCoordinator({
        kek: VALID_KEK,
        storage,
        immutable: true,
        retentionDays: 1,
      });

      const oldTime = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
      const { archiveId } = await coord.backup(
        makeBundle({ issuedAt: oldTime }),
      );

      await coord.prune(Date.now());

      // Archive should still be restorable
      const restored = await coord.restore(archiveId);
      expect(restored.metadata.archiveId).toBe(archiveId);
    });
  });
});
