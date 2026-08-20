"use strict";

const EventEmitter = require("events");
const { RepairWorker } = require("../repair-worker.cjs");
const hsmMetrics = require("../../hsm-adapter/hsm-metrics.cjs");

describe("Track 123: Secure Shard Repair Worker", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("L2-01: duplicate repair is skipped and counter increments", (done) => {
    const emitter = new EventEmitter();
    const worker = new RepairWorker({
      emitter,
      repairJitterMs: 0,
      processingTimeMs: 0,
    });

    const payload = {
      tenantId: "t1",
      shardId: "sh1",
      rotatedAt: 1000,
      fromSeq: 1,
      toSeq: 1,
    };
    emitter.emit("shard:reconciler:reconcile_requested", payload);
    emitter.emit("shard:reconciler:reconcile_requested", payload);

    worker.on("repair:completed", () => {
      setTimeout(() => {
        expect(worker.processed.length).toBe(1);
        expect(worker.scheduledDelays.length).toBe(1);
        expect(
          hsmMetrics.getMetrics().hsm_shard_reconciler_repair_skipped_total,
        ).toBe(1);
        done();
      }, 100);
    });
  });

  test("L2-02: jitter produces zero delay when configured to 0", (done) => {
    const worker = new RepairWorker({ repairJitterMs: 0 });
    worker.handle({
      tenantId: "t1",
      shardId: "sh2",
      rotatedAt: 1,
      fromSeq: 1,
      toSeq: 1,
    });
    setTimeout(() => {
      expect(worker.scheduledDelays[0]).toBe(0);
      done();
    }, 100);
  });

  test("L2-03: counters emit on success and skip", (done) => {
    const emitter = new EventEmitter();
    const worker = new RepairWorker({
      emitter,
      repairJitterMs: 0,
      processingTimeMs: 0,
    });
    const payload = {
      tenantId: "t1",
      shardId: "sh3",
      rotatedAt: 2,
      fromSeq: 1,
      toSeq: 1,
    };
    emitter.emit("shard:reconciler:reconcile_requested", payload);
    emitter.emit("shard:reconciler:reconcile_requested", payload);

    worker.on("repair:completed", () => {
      setTimeout(() => {
        expect(hsmMetrics.getMetrics().hsm_repair_worker_started_total).toBe(1);
        expect(hsmMetrics.getMetrics().hsm_repair_worker_completed_total).toBe(
          1,
        );
        done();
      }, 100);
    });
  });

  test("L2-04: monotonic sequence validation rejects out-of-order range", async () => {
    const store = {
      async fetchState({ shardId }) {
        return { lastSeq: 5 };
      },
      async applyEntries() {},
    };
    const worker = new RepairWorker({
      repairJitterMs: 0,
      processingTimeMs: 0,
      store,
    });
    const payload = {
      tenantId: "t1",
      shardId: "sh4",
      rotatedAt: 1,
      fromSeq: 7,
      toSeq: 7,
    };
    await expect(worker.executeRepair(payload)).rejects.toThrow(
      "TRACK123_NON_MONOTONIC_SEQ",
    );
    expect(
      hsmMetrics.getMetrics().hsm_shard_reconciler_repair_seq_rejected_total,
    ).toBe(1);
  });

  test("L2-05: sequential range is accepted and applied", async () => {
    const applied = [];
    const store = {
      async fetchState({ shardId }) {
        return { lastSeq: 2 };
      },
      async applyEntries(ctx, entries) {
        applied.push({ ctx, entries });
      },
    };
    const worker = new RepairWorker({
      repairJitterMs: 0,
      processingTimeMs: 0,
      store,
    });
    const payload = {
      tenantId: "t1",
      shardId: "sh5",
      rotatedAt: 1,
      fromSeq: 3,
      toSeq: 5,
    };
    const result = await worker.executeRepair(payload);
    expect(result.applied).toBe(3);
    expect(applied[0].entries.length).toBe(3);
    expect(
      hsmMetrics.getMetrics().hsm_shard_reconciler_repair_seq_validated_total,
    ).toBe(1);
  });

  test("L3-01: re-entrant handle during processing stays idempotent", (done) => {
    const worker = new RepairWorker({ repairJitterMs: 0, processingTimeMs: 0 });
    worker.handle({
      tenantId: "t1",
      shardId: "sh6",
      rotatedAt: 1,
      fromSeq: 1,
      toSeq: 1,
    });
    worker.handle({
      tenantId: "t1",
      shardId: "sh6",
      rotatedAt: 1,
      fromSeq: 1,
      toSeq: 1,
    });
    worker.on("repair:completed", () => {
      setTimeout(() => {
        expect(worker.activeRepairs.size).toBe(0);
        done();
      }, 100);
    });
  });

  test("L3-02: missing tenantId is rejected", (done) => {
    const worker = new RepairWorker({ repairJitterMs: 0 });
    worker.on("error", (err) => {
      expect(err.message).toMatch(/TRACK123_INVALID/);
      done();
    });
    worker.handle({ shardId: "sh7" });
  });

  test("S-01: encrypted chunk missing authTag is rejected", (done) => {
    const worker = new RepairWorker({ repairJitterMs: 0 });
    worker.on("error", (err) => {
      expect(err.message).toMatch(/TRACK123/);
      done();
    });
    worker.handle({
      tenantId: "t1",
      shardId: "sh8",
      rotatedAt: 1,
      encrypted: true,
      cipher: "x",
      iv: "x",
    });
  });

  test("S-02: encrypted chunk with valid iv and authTag is accepted", (done) => {
    const worker = new RepairWorker({ repairJitterMs: 0 });
    const payload = {
      tenantId: "t1",
      shardId: "sh9",
      rotatedAt: 1,
      fromSeq: 1,
      toSeq: 1,
      encrypted: true,
      cipher: "c",
      iv: Buffer.alloc(12).toString("base64"),
      authTag: Buffer.alloc(16).toString("base64"),
    };
    worker.on("repair:started", () => {
      expect(
        hsmMetrics.getMetrics().hsm_shard_reconciler_envelope_validated_total,
      ).toBe(1);
      done();
    });
    worker.handle(payload);
  });
});
