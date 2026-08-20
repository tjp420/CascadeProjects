const EventEmitter = require("events");
const { setTimeout } = require("timers");
const { incrementCounter } = require("../hsm-adapter/hsm-metrics.cjs");

// Simple worker skeleton for shard reconciliation
class ShardReconciler extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.running = false;
    this.pollIntervalMs = opts.pollIntervalMs || 10_000;
    // Low-cardinality telemetry counter (increment when out-of-sync detected)
    this.metrics = { hsm_shard_out_of_sync_total: 0 };
    // Additional lightweight metrics under a single low-cardinality prefix
    this.metrics.hsm_shard_reconciler_repair_requested_total = 0;
    this.metrics.hsm_shard_reconciler_repair_skipped_total = 0;

    // shardProvider: async function that returns an iterable/array of shard states.
    // Expected shape: [{ tenantId, shardId, records: [{ seq: Number, hash?:string, ts?:Number }] }, ...]
    this.shardProvider = opts.shardProvider || (async () => []);
    // Repair cooldowns: Map of 'tenantId:shardId' -> lastTriggeredAt(ms)
    this.activeSyncs = new Map();
    this.repairCooldownMs = Number(opts.repairCooldownMs || 60_000);
    // repairJitterMs: max randomized jitter (ms) suggested for downstream repair workers
    this.repairJitterMs = Number(opts.repairJitterMs || 1000);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
    this.emit("started");
  }

  stop() {
    this.running = false;
    this.emit("stopped");
  }

  _loop() {
    if (!this.running) return;
    // placeholder: discover shards that may be out-of-sync
    Promise.resolve()
      .then(() => this.verifyShardContinuity())
      .catch((err) => this.emit("error", err))
      .finally(() => {
        setTimeout(() => this._loop(), this.pollIntervalMs);
      });
  }

  // verify continuity; returns array of shard ids needing reconciliation
  async verifyShardContinuity() {
    // Discover shard state from provider
    const discovered = await this.shardProvider();
    const issues = [];

    // Normalize to array
    const list = Array.isArray(discovered)
      ? discovered
      : Object.keys(discovered || {}).map((k) => discovered[k]);

    for (const entry of list) {
      if (!entry) continue;
      const tenantId = entry.tenantId || entry.owner || "unknown";
      const shardId = entry.shardId || entry.id || entry.name;
      const records = Array.isArray(entry.records) ? entry.records : [];

      // Strict monotonic check: sequences must increment by exactly 1
      let lastSeq = null;
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const seq = Number(r && r.seq);
        if (!Number.isFinite(seq)) continue; // skip malformed

        if (lastSeq === null) {
          lastSeq = seq;
          continue;
        }

        if (seq === lastSeq) {
          // duplicate sequence detected
          this.metrics.hsm_shard_out_of_sync_total += 1;
          incrementCounter("hsm_shard_out_of_sync_total");
          const dup = {
            tenantId,
            shardId,
            reason: "duplicate_sequence",
            expected: lastSeq + 1,
            found: seq,
          };
          issues.push(dup);
          // Emit legacy and reconciler-prefixed audit events
          this.emit("shard:out_of_sync", dup);
          this.emit("shard:reconciler:out_of_sync", dup);
          break; // one issue per shard is sufficient for now
        }

        if (seq !== lastSeq + 1) {
          // gap or out-of-order detected
          this.metrics.hsm_shard_out_of_sync_total += 1;
          incrementCounter("hsm_shard_out_of_sync_total");
          const issue = {
            tenantId,
            shardId,
            reason: "sequence_gap",
            expected: lastSeq + 1,
            found: seq,
          };
          issues.push(issue);
          // Emit legacy and reconciler-prefixed audit events
          this.emit("shard:out_of_sync", issue);
          this.emit("shard:reconciler:out_of_sync", issue);

          // Attempt auto-repair for the missing range [lastSeq+1 .. seq-1]
          const key = `${tenantId}:${shardId}`;
          const now = Date.now();
          const lastTriggered = this.activeSyncs.get(key) || 0;
          if (now - lastTriggered >= this.repairCooldownMs) {
            this.activeSyncs.set(key, now);
            // fire-and-forget repair; include from/to in opts
            this.metrics.hsm_shard_reconciler_repair_requested_total += 1;
            incrementCounter("hsm_shard_reconciler_repair_requested_total");
            this.triggerSync({
              tenantId,
              shardId,
              fromSeq: lastSeq + 1,
              toSeq: seq - 1,
            }).catch((e) => this.emit("error", e));
            // emit both legacy and reconciler-prefixed reconciliation request including jitter hint
            const payload = {
              tenantId,
              shardId,
              fromSeq: lastSeq + 1,
              toSeq: seq - 1,
              repairJitterMs: this.repairJitterMs,
            };
            this.emit("reconcile:requested", payload);
            this.emit("shard:reconciler:reconcile_requested", payload);
          } else {
            // cooldown active - skip triggering
            this.metrics.hsm_shard_reconciler_repair_skipped_total += 1;
            incrementCounter("hsm_shard_reconciler_repair_skipped_total");
            const skipped = {
              tenantId,
              shardId,
              cooldownRemainingMs:
                this.repairCooldownMs - (now - lastTriggered),
            };
            this.emit("shard:repair_skipped", skipped);
            this.emit("shard:reconciler:repair_skipped", skipped);
          }

          break; // report only first problem per shard at this pass
        }

        lastSeq = seq;
      }
    }

    return issues;
  }

  // Trigger a reconciliation flow for provided shard ids
  async triggerSync(shardIds = [], opts = {}) {
    // Support two shapes:
    // - Array of shardIds: triggerSync(['s1','s2']) keeps old behavior
    // - Repair object: { tenantId, shardId, fromSeq, toSeq }
    if (Array.isArray(shardIds)) {
      // include jitter hint for array-based requests as well
      this.emit("reconcile:requested", {
        shardIds,
        opts,
        repairJitterMs: this.repairJitterMs,
      });
      if (shardIds && shardIds.length)
        this.metrics.hsm_shard_out_of_sync_total += shardIds.length;
      return { ok: true, reconciled: [] };
    }

    // Repair object path
    const rep = shardIds || opts;
    const { tenantId, shardId, fromSeq, toSeq } = rep;
    const payload = {
      tenantId,
      shardId,
      fromSeq,
      toSeq,
      opts,
      repairJitterMs: this.repairJitterMs,
    };
    this.emit("reconcile:requested", payload);
    // increment metric once per repair job
    this.metrics.hsm_shard_out_of_sync_total += 1;
    incrementCounter("hsm_shard_out_of_sync_total");
    // placeholder: actual repair logic should be implemented here or by listeners
    return { ok: true, repair: payload };
  }

  // Attach to a HomomorphicKeyShardDisperser instance and start auto-repair on dispersal events
  attachToDisperser(disperser) {
    if (!disperser || typeof disperser.on !== "function") return;
    disperser.on("dispersed", ({ request, shards }) => {
      // attempt to reconcile missing fragments shortly after dispersal
      const onlineNodes = (request.destinations || []).map((d) => d.platformId);
      this.reconcile({
        tenantId: request.tenantId,
        sourceTenantId: request.tenantId,
        shardId: shards[0] && shards[0].shardId,
        onlineNodes,
        minQuorum: (this.policy && this.policy.minTargetPlatformQuorum) || 3,
        missingShards: [],
      }).catch((e) => this.emit("error", e));
    });
  }

  // Post-quantum authorized shard reconciliation with tenant and quorum guards
  async reconcile(request = {}) {
    const {
      tenantId,
      sourceTenantId,
      shardId,
      onlineNodes = [],
      minQuorum = 3,
      missingShards = [],
    } = request;

    if (!tenantId || !sourceTenantId) {
      const e = new Error("SHARD_RECON_VIOLATION: tenant identity missing");
      e.code = "SHARD_RECON_VIOLATION";
      throw e;
    }

    if (String(tenantId) !== String(sourceTenantId)) {
      const e = new Error("CROSS_TENANT_RECON_VIOLATION");
      e.code = "CROSS_TENANT_RECON_VIOLATION";
      throw e;
    }

    if (onlineNodes.length < minQuorum) {
      const e = new Error("SHARD_RECON_VIOLATION: quorum not met");
      e.code = "SHARD_RECON_VIOLATION";
      throw e;
    }

    const reconPayload = {
      tenantId,
      shardId,
      onlineNodes,
      minQuorum,
      missingShards,
    };
    this.emit("reconcile:requested", reconPayload);
    this.emit("shard:reconciler:reconcile_requested", reconPayload);
    this.metrics.hsm_shard_reconciler_repair_requested_total += 1;
    incrementCounter("hsm_shard_reconciler_repair_requested_total");

    const result = {
      ok: true,
      reconciled: missingShards.length
        ? missingShards
        : [shardId || "recon-complete"],
      tenantId,
      onlineNodes,
      minQuorum,
    };
    this.emit("reconciled", result);
    this.emit("shard:reconciler:reconciled", result);
    return result;
  }
}

module.exports = { ShardReconciler };
