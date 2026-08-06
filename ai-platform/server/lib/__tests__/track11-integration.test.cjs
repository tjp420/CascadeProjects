'use strict';

const crypto = require('crypto');
const clusterSync = require('../cluster-keyring-sync.cjs');
const resumption = require('../hybrid-kem-resumption.cjs');
const rollout = require('../quantum-hybrid-rollout.cjs');
const { BackupCoordinator, createMemoryStorage } = require('../backup-coordinator.cjs');

describe('Track 11: Core Systems Integration', () => {
  beforeEach(() => {
    clusterSync._resetEvents();
    clusterSync._resetStek();
    rollout.setTelemetryRecorder(null);
  });

  afterAll(() => {
    clusterSync.stopStekRotation();
  });

  test('L2-01: recordTelemetry pipes subsystem events into queryEvents', () => {
    clusterSync.recordTelemetry('BACKUP_PRUNED', 'node-1', { archiveId: 'a1' });
    const result = clusterSync.queryEvents({ eventType: 'BACKUP_PRUNED' });
    expect(result.total).toBe(1);
    expect(result.events[0].details.archiveId).toBe('a1');
  });

  test('L2-05: rotateStek keeps old STEK in retired window and emits event', () => {
    const first = clusterSync.rotateStek();
    expect(first.stek.length).toBe(32);
    expect(first.stekId.length).toBe(16);

    const second = clusterSync.rotateStek();
    expect(second.stekId.toString('hex')).not.toBe(first.stekId.toString('hex'));
    expect(clusterSync.getStek().stekId.toString('hex')).toBe(second.stekId.toString('hex'));

    const retired = clusterSync.getStekForValidation(first.stekId);
    expect(retired).toEqual(first.stek);

    const events = clusterSync.queryEvents({ eventType: 'STEK_ROTATED' });
    expect(events.total).toBe(2);
  });

  test('L2-02: resumption ticket validates through getStekForValidation map', async () => {
    const stek = clusterSync.rotateStek();
    const prevRoot = crypto.randomBytes(32);
    const { ticket } = resumption.createTicket(
      { sessionId: 's1', nodeId: 'n1', prevRoot },
      stek.stek,
      stek.stekId,
      600000,
    );

    const bloom = resumption.createInMemoryBloomFilter();
    const stekById = (sid) => clusterSync.getStekForValidation(sid);
    const validated = await resumption.validateTicket(ticket, stekById, bloom);
    expect(validated.valid).toBe(true);
    expect(validated.sessionId).toBe('s1');
  });

  test('L3-01: retired STEK validates old tickets within the rotation window', async () => {
    const oldStek = clusterSync.rotateStek();
    const prevRoot = crypto.randomBytes(32);
    const { ticket } = resumption.createTicket(
      { sessionId: 's2', nodeId: 'n1', prevRoot },
      oldStek.stek,
      oldStek.stekId,
      600000,
    );

    clusterSync.rotateStek(); // active changes
    const bloom = resumption.createInMemoryBloomFilter();
    const validated = await resumption.validateTicket(
      ticket,
      (sid) => clusterSync.getStekForValidation(sid),
      bloom,
    );
    expect(validated.valid).toBe(true);
  });

  test('L2-03: rollout checkRollback pipes quantum_hybrid_rollback into timeline', () => {
    rollout.setTelemetryRecorder((type, node, details) => {
      clusterSync.recordTelemetry(type, node, details);
    });
    const result = rollout.checkRollback({
      connectionDropRatePct: 100,
      baselineConnectionDropRatePct: 0,
    });
    expect(result.shouldRollback).toBe(true);

    const events = clusterSync.queryEvents({ eventType: 'quantum_hybrid_rollback' });
    expect(events.total).toBe(1);
    expect(events.events[0].details.reasons.length).toBeGreaterThan(0);
  });

  test('L2-04: backup coordinator onEvent pipes lifecycle events into timeline', async () => {
    const kek = crypto.randomBytes(32);
    const storage = createMemoryStorage();
    const onEvent = (type, details) => clusterSync.recordTelemetry(type, 'node-1', details);
    const coord = new BackupCoordinator({ kek, storage, onEvent });
    const bundle = {
      keyringMaterial: crypto.randomBytes(32),
      auditLog: [],
      resumptionTickets: [],
      issuedAt: Date.now(),
    };
    const { archiveId } = await coord.backup(bundle);
    expect(archiveId).toMatch(/^bkp-/);

    const created = clusterSync.queryEvents({ eventType: 'BACKUP_CREATED' });
    expect(created.total).toBe(1);

    await coord.prune(Date.now() + 1);
    const pruned = clusterSync.queryEvents({ eventType: 'BACKUP_PRUNED' });
    expect(pruned.total).toBe(1);
  });

  test('L2-06: queryEvents caps unbounded requests and defaults to 24h window', () => {
    // Fill timeline with more than max rows
    for (let i = 0; i < 1005; i++) {
      clusterSync._recordEvent('node_join', 'node-1', { i });
    }
    const result = clusterSync.queryEvents({});
    expect(result.limit).toBe(1000);
    expect(result.events.length).toBeLessThanOrEqual(1000);

    // A broad window query returns up to the cap
    const all = clusterSync.queryEvents({ startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() });
    expect(all.events.length).toBeLessThanOrEqual(1000);
  });

  test('S-03: queryEvents requires explicit eventType or time window', () => {
    const before = new Date(Date.now() - 2000).toISOString();
    const now = new Date().toISOString();
    clusterSync._recordEvent('leader_elected', 'node-1', {});
    // No filter: should still run, but default to 24h window
    const unbounded = clusterSync.queryEvents({});
    expect(unbounded.events.length).toBeGreaterThan(0);
    // eventType filter explicitly supplied
    const typed = clusterSync.queryEvents({ eventType: 'leader_elected' });
    expect(typed.total).toBe(1);
    // explicit date range before the event was recorded should return 0
    const ranged = clusterSync.queryEvents({ startDate: before, endDate: now });
    expect(ranged.events.length).toBe(0);
  });

  test('S-04: getStekState never leaks raw STEK bytes', () => {
    clusterSync.rotateStek();
    const state = clusterSync.getStekState();
    expect(state.activeStekId).toMatch(/^[0-9a-f]{32}$/);
    expect(state.retiredCount).toBe(0);
    expect(state).not.toHaveProperty('stek');
  });
});
