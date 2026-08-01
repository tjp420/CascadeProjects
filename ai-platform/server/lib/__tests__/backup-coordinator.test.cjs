'use strict';

const crypto = require('crypto');
const { BackupCoordinator, createMemoryStorage } = require('../backup-coordinator.cjs');

describe('backup-coordinator', () => {
  const kek = crypto.randomBytes(32);
  const badKek = crypto.randomBytes(16);
  const bundle = {
    keyringMaterial: crypto.randomBytes(32),
    auditLog: [{ eventId: 1, type: 'KEY_COMMIT' }],
    resumptionTickets: [{ sessionId: 's1', issuedAt: Date.now() }],
    issuedAt: Date.now(),
  };

  test('L1: constructor rejects short KEK', () => {
    expect(() => new BackupCoordinator({ kek: badKek, storage: createMemoryStorage() }))
      .toThrow('INVALID_KEK');
  });

  test('L1: deriveArchiveKey is deterministic per archiveId', () => {
    const k1 = BackupCoordinator.deriveArchiveKey(kek, 'id-1');
    const k2 = BackupCoordinator.deriveArchiveKey(kek, 'id-1');
    const k3 = BackupCoordinator.deriveArchiveKey(kek, 'id-2');
    expect(k1.equals(k2)).toBe(true);
    expect(k1.equals(k3)).toBe(false);
  });

  test('L2: full backup and restore round-trip', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    const info = await coord.backup(bundle);
    expect(info.archiveId).toMatch(/^bkp-/);
    expect(info.checksum.length).toBe(64);

    const restored = await coord.restore(info.archiveId);
    expect(restored.bundle.keyringMaterial.equals(bundle.keyringMaterial)).toBe(true);
    expect(restored.bundle.auditLog).toEqual(bundle.auditLog);
  });

  test('L2: dry-run restore does not mutate', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    const { archiveId } = await coord.backup(bundle);
    const restored = await coord.restore(archiveId, { dryRun: true });
    expect(restored.dryRun).toBe(true);
    expect(restored.bundle.keyringMaterial.equals(bundle.keyringMaterial)).toBe(true);
    const list = await coord.listArchives();
    expect(list.length).toBe(1);
  });

  test('L2: corrupted archive fails verification', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    const { archiveId } = await coord.backup(bundle);
    const archive = await storage.read(archiveId);
    archive[archive.length - 1] ^= 0xff;
    await storage.write(archiveId, archive);
    const v = coord.verifyArchive(archive, archiveId);
    expect(v.valid).toBe(false);
    expect(v.reason).toBeDefined();
  });

  test('L2: prune removes only old archives', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, retentionDays: 1, storage });
    const now = Date.now();
    const oldBundle = { ...bundle, issuedAt: now - 2 * 24 * 60 * 60 * 1000 };
    const { archiveId: oldId } = await coord.backup(oldBundle);
    const { archiveId: newId } = await coord.backup(bundle);

    const removed = await coord.prune(now - 1 * 24 * 60 * 60 * 1000);
    expect(removed).toContain(oldId);
    expect(removed).not.toContain(newId);

    const list = await coord.listArchives();
    expect(list.map((a) => a.archiveId)).toContain(newId);
    expect(list.map((a) => a.archiveId)).not.toContain(oldId);
  });

  test('L2: immutability prevents deletion and records event', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, immutable: true, storage });
    const { archiveId } = await coord.backup(bundle);
    const removed = await coord.prune(Date.now() + 1);
    expect(removed).toEqual([]);
    expect(coord.events.length).toBeGreaterThan(0);
    expect(coord.events[0].type).toBe('BACKUP_IMMUTABLE');

    const list = await coord.listArchives();
    expect(list.map((a) => a.archiveId)).toContain(archiveId);
  });

  test('L2: missing keyringMaterial rejects backup', async () => {
    const coord = new BackupCoordinator({ kek, storage: createMemoryStorage() });
    await expect(coord.backup({
      auditLog: [],
      resumptionTickets: [],
      issuedAt: Date.now(),
    })).rejects.toMatchObject({ code: 'INVALID_BUNDLE' });
  });

  test('L3: restore asOf picks nearest earlier archive', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    const t0 = Date.now() - 100000;
    const t1 = Date.now();
    const bundle0 = { ...bundle, issuedAt: t0 };
    const bundle1 = { ...bundle, issuedAt: t1 };
    await coord.backup(bundle0);
    await coord.backup(bundle1);

    const restored = await coord.restore('n/a', { asOf: t1 - 500 });
    expect(restored.bundle.issuedAt).toBe(t0);
  });

  test('L3: asOf before all archives throws BACKUP_NOT_FOUND', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    await coord.backup(bundle);
    await expect(coord.restore('n/a', { asOf: Date.now() - 999999999 }))
      .rejects.toMatchObject({ code: 'BACKUP_NOT_FOUND' });
  });

  test('S-04: resumption bundle does not include live PSK or bloom filter', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    const bundleWithSecrets = {
      ...bundle,
      resumptionTickets: [{ sessionId: 's1', psk: 'live-psk', bloom: 'filter-state' }],
    };
    const { archiveId } = await coord.backup(bundleWithSecrets);
    const { bundle: restored } = await coord.restore(archiveId);
    expect(restored.resumptionTickets[0]).not.toHaveProperty('psk');
    expect(restored.resumptionTickets[0]).not.toHaveProperty('bloom');
  });

  test('S-01: archive encrypted and authenticated', async () => {
    const storage = createMemoryStorage();
    const coord = new BackupCoordinator({ kek, storage });
    const { archiveId } = await coord.backup(bundle);
    const archive = await storage.read(archiveId);
    const raw = archive.toString('utf8', 0, Math.min(archive.length, 50));
    expect(raw).not.toContain(bundle.keyringMaterial.toString('base64'));
    expect(archive.length).toBeGreaterThan(HEADER_LENGTH + TAG_LENGTH);
    const v = coord.verifyArchive(archive, archiveId);
    expect(v.valid).toBe(true);
  });
});

const HEADER_LENGTH = 1 + 12 + 4;
const TAG_LENGTH = 16;
