'use strict';

/**
 * Stage 3: HSM adapter metrics registry.
 *
 * In-memory counters and histograms for HSM operations, exposed in
 * Prometheus exposition format. Follows the pattern established by
 * siem-exporter.cjs (in-memory counters) and the /api/agentic/metrics
 * endpoint (text/plain; version=0.0.4).
 *
 * @module hsm-adapter/hsm-metrics
 */

// ── Counters ────────────────────────────────────────────────────
const counters = {
  hsm_wrap_total: 0,
  hsm_wrap_failures_total: 0,
  hsm_unwrap_total: 0,
  hsm_unwrap_failures_total: 0,
  hsm_create_kek_total: 0,
  hsm_create_kek_failures_total: 0,
  hsm_rotate_kek_total: 0,
  hsm_zeroize_total: 0,
  hsm_circuit_opened_total: 0,
  hsm_circuit_closed_total: 0,
  hsm_circuit_half_open_total: 0,
  // Track 33: Recovery sync counters
  hsm_recovery_started_total: 0,
  hsm_recovery_synced_total: 0,
  hsm_recovery_failures_total: 0,
  hsm_recovery_catchup_batches_total: 0,
  // Track 34: Consensus counters
  hsm_consensus_leader_elections_total: 0,
  hsm_consensus_leader_elections_won_total: 0,
  hsm_consensus_quorum_lost_total: 0,
  hsm_consensus_log_replicated_total: 0,
  hsm_consensus_log_committed_total: 0,
  hsm_consensus_heartbeats_sent_total: 0,
  // Track 34 Stage 3: Byzantine hardening counters
  hsm_consensus_rpc_signed_total: 0,
  hsm_consensus_rpc_verified_total: 0,
  hsm_consensus_signature_invalid_total: 0,
  hsm_consensus_peer_key_unknown_total: 0,
  // Track 34 Phase 4: Replay protection counters
  hsm_consensus_replay_detected_total: 0,
  hsm_consensus_nonce_stale_total: 0,
  hsm_consensus_timestamp_expired_total: 0,
  // Track 34 Phase 5: Peer key rotation counters
  hsm_consensus_peer_key_added_total: 0,
  hsm_consensus_peer_key_revoked_total: 0,
  hsm_consensus_peer_key_rotation_blocked_total: 0,
  // Track 34 Phase 6: Snapshot/compaction counters
  hsm_consensus_snapshot_created_total: 0,
  hsm_consensus_snapshot_installed_total: 0,
  hsm_consensus_snapshot_rejected_total: 0,
  // Track 34 Phase 7: Implicit outbound signing counters
  hsm_consensus_outbound_signed_total: 0,
  hsm_consensus_outbound_sign_failed_total: 0,
  // Track 26: DKG & zk-SNARKs counters
  hsm_dkg_rounds_started_total: 0,
  hsm_dkg_rounds_completed_total: 0,
  hsm_dkg_shares_verified_total: 0,
  hsm_dkg_shares_rejected_total: 0,
  hsm_dkg_complaints_filed_total: 0,
  hsm_dkg_nodes_disqualified_total: 0,
  hsm_dkg_zk_proofs_generated_total: 0,
  hsm_dkg_zk_proofs_invalid_total: 0,
  // Track 27: PQC Threshold Signatures counters
  hsm_pqc_threshold_sign_total: 0,
  hsm_pqc_threshold_sign_failures_total: 0,
  hsm_pqc_threshold_partial_sign_total: 0,
  hsm_pqc_threshold_partial_verified_total: 0,
  hsm_pqc_threshold_partial_rejected_total: 0,
  hsm_pqc_threshold_verify_total: 0,
  hsm_pqc_threshold_verify_failures_total: 0,
  // Track 28: Confidential Computing Sandboxing counters
  hsm_sandbox_created_total: 0,
  hsm_sandbox_destroyed_total: 0,
  hsm_sandbox_attested_total: 0,
  hsm_sandbox_attestation_failed_total: 0,
  hsm_sandbox_execute_total: 0,
  hsm_sandbox_execute_failures_total: 0,
  hsm_sandbox_zeroized_total: 0,
  hsm_sandbox_active: 0,
  // Track 32: BFT Shard Sync counters
  hsm_shard_append_total: 0,
  hsm_shard_ack_total: 0,
  hsm_shard_commit_total: 0,
  hsm_shard_catchup_batch_total: 0,
  hsm_shard_byzantine_detected_total: 0,
  hsm_shard_lagging_nodes: 0,
  hsm_shard_active: 0,
  // Track 34: Cross-Cluster Migration counters
  hsm_migration_initiated_total: 0,
  hsm_migration_attested_total: 0,
  hsm_migration_committed_total: 0,
  hsm_migration_rolled_back_total: 0,
  hsm_migration_ack_total: 0,
  hsm_migration_verification_failed_total: 0,
  hsm_migration_active: 0,
  // Track 35: Cluster Key Reconciliation counters
  hsm_reconciliation_scans_total: 0,
  hsm_reconciliation_divergence_detected_total: 0,
  hsm_reconciliation_promoted_total: 0,
  hsm_reconciliation_quarantined_total: 0,
  hsm_reconciliation_rollback_blocked_total: 0,
  hsm_reconciliation_promotion_votes_total: 0,
  hsm_reconciliation_divergent_keys: 0,
};

// ── Histograms (bucketed) ───────────────────────────────────────
// Latency histograms with buckets in milliseconds.
// Bucket boundaries chosen for HSM operations (typically 10-500ms).
const LATENCY_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

const histograms = {
  hsm_wrap_duration_ms: { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length + 1).fill(0), sum: 0, count: 0 },
  hsm_unwrap_duration_ms: { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length + 1).fill(0), sum: 0, count: 0 },
  hsm_create_kek_duration_ms: { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length + 1).fill(0), sum: 0, count: 0 },
};

// Metadata for Prometheus exposition
const META = {
  hsm_wrap_total: { help: 'Total HSM wrapKey operations initiated.', type: 'counter' },
  hsm_wrap_failures_total: { help: 'Total HSM wrapKey operations that failed.', type: 'counter' },
  hsm_unwrap_total: { help: 'Total HSM unwrapKey operations initiated.', type: 'counter' },
  hsm_unwrap_failures_total: { help: 'Total HSM unwrapKey operations that failed.', type: 'counter' },
  hsm_create_kek_total: { help: 'Total KEK creation operations initiated.', type: 'counter' },
  hsm_create_kek_failures_total: { help: 'Total KEK creation operations that failed.', type: 'counter' },
  hsm_rotate_kek_total: { help: 'Total KEK rotation operations initiated.', type: 'counter' },
  hsm_zeroize_total: { help: 'Total KEK zeroization operations completed.', type: 'counter' },
  hsm_circuit_opened_total: { help: 'Total times the HSM circuit breaker transitioned to OPEN state.', type: 'counter' },
  hsm_circuit_closed_total: { help: 'Total times the HSM circuit breaker transitioned to CLOSED state.', type: 'counter' },
  hsm_circuit_half_open_total: { help: 'Total times the HSM circuit breaker transitioned to HALF-OPEN state.', type: 'counter' },
  hsm_recovery_started_total: { help: 'Total cluster node recovery sessions started.', type: 'counter' },
  hsm_recovery_synced_total: { help: 'Total cluster node recovery sessions that reached synced state.', type: 'counter' },
  hsm_recovery_failures_total: { help: 'Total cluster node recovery sessions that failed.', type: 'counter' },
  hsm_recovery_catchup_batches_total: { help: 'Total catch-up batches applied during recovery sync.', type: 'counter' },
  hsm_consensus_leader_elections_total: { help: 'Total leader election cycles started.', type: 'counter' },
  hsm_consensus_leader_elections_won_total: { help: 'Total leader elections won by this node.', type: 'counter' },
  hsm_consensus_quorum_lost_total: { help: 'Total times quorum was lost during consensus operations.', type: 'counter' },
  hsm_consensus_log_replicated_total: { help: 'Total log entries replicated to followers.', type: 'counter' },
  hsm_consensus_log_committed_total: { help: 'Total log entries committed via quorum.', type: 'counter' },
  hsm_consensus_heartbeats_sent_total: { help: 'Total leader heartbeats sent to followers.', type: 'counter' },
  hsm_consensus_rpc_signed_total: { help: 'Total outbound RPC frames signed with Ed25519.', type: 'counter' },
  hsm_consensus_rpc_verified_total: { help: 'Total inbound RPC frames successfully verified.', type: 'counter' },
  hsm_consensus_signature_invalid_total: { help: 'Total inbound RPC frames with invalid signatures.', type: 'counter' },
  hsm_consensus_peer_key_unknown_total: { help: 'Total inbound RPC frames from peers with no registered public key.', type: 'counter' },
  hsm_consensus_replay_detected_total: { help: 'Total RPC frames rejected as replayed (stale nonce or expired timestamp).', type: 'counter' },
  hsm_consensus_nonce_stale_total: { help: 'Total RPC frames rejected with stale nonce (non-monotonic).', type: 'counter' },
  hsm_consensus_timestamp_expired_total: { help: 'Total RPC frames rejected due to expired timestamp.', type: 'counter' },
  hsm_consensus_peer_key_added_total: { help: 'Total peer public keys added via quorum-gated rotation.', type: 'counter' },
  hsm_consensus_peer_key_revoked_total: { help: 'Total peer public keys revoked via quorum-gated rotation.', type: 'counter' },
  hsm_consensus_peer_key_rotation_blocked_total: { help: 'Total peer key rotation attempts blocked (not leader, key not found, etc.).', type: 'counter' },
  hsm_consensus_snapshot_created_total: { help: 'Total log compaction snapshots created by this node.', type: 'counter' },
  hsm_consensus_snapshot_installed_total: { help: 'Total snapshots installed from a leader on this node.', type: 'counter' },
  hsm_consensus_snapshot_rejected_total: { help: 'Total snapshots rejected (stale, invalid signature, etc.).', type: 'counter' },
  hsm_consensus_outbound_signed_total: { help: 'Total outbound RPC frames auto-signed by the engine.', type: 'counter' },
  hsm_consensus_outbound_sign_failed_total: { help: 'Total outbound RPC frames that failed auto-signing.', type: 'counter' },
  hsm_dkg_rounds_started_total: { help: 'Total DKG protocol rounds initiated.', type: 'counter' },
  hsm_dkg_rounds_completed_total: { help: 'Total DKG protocol rounds that completed successfully.', type: 'counter' },
  hsm_dkg_shares_verified_total: { help: 'Total DKG shares that passed commitment verification.', type: 'counter' },
  hsm_dkg_shares_rejected_total: { help: 'Total DKG shares that failed commitment verification.', type: 'counter' },
  hsm_dkg_complaints_filed_total: { help: 'Total DKG complaints filed by nodes against peers.', type: 'counter' },
  hsm_dkg_nodes_disqualified_total: { help: 'Total DKG nodes disqualified due to verified complaints.', type: 'counter' },
  hsm_dkg_zk_proofs_generated_total: { help: 'Total zk-SNARK validation parameters generated.', type: 'counter' },
  hsm_dkg_zk_proofs_invalid_total: { help: 'Total zk-SNARK validation parameters rejected as invalid or forged.', type: 'counter' },
  hsm_pqc_threshold_sign_total: { help: 'Total PQC threshold signature aggregation operations.', type: 'counter' },
  hsm_pqc_threshold_sign_failures_total: { help: 'Total PQC threshold signature aggregations that failed.', type: 'counter' },
  hsm_pqc_threshold_partial_sign_total: { help: 'Total PQC partial signature generation operations.', type: 'counter' },
  hsm_pqc_threshold_partial_verified_total: { help: 'Total PQC partial signatures that passed verification.', type: 'counter' },
  hsm_pqc_threshold_partial_rejected_total: { help: 'Total PQC partial signatures that failed verification.', type: 'counter' },
  hsm_pqc_threshold_verify_total: { help: 'Total PQC threshold signature verification operations.', type: 'counter' },
  hsm_pqc_threshold_verify_failures_total: { help: 'Total PQC threshold signature verifications that failed.', type: 'counter' },
  hsm_sandbox_created_total: { help: 'Total confidential sandboxes created.', type: 'counter' },
  hsm_sandbox_destroyed_total: { help: 'Total confidential sandboxes destroyed.', type: 'counter' },
  hsm_sandbox_attested_total: { help: 'Total sandbox attestations that passed.', type: 'counter' },
  hsm_sandbox_attestation_failed_total: { help: 'Total sandbox attestations that failed.', type: 'counter' },
  hsm_sandbox_execute_total: { help: 'Total sandbox execute operations.', type: 'counter' },
  hsm_sandbox_execute_failures_total: { help: 'Total sandbox execute operations that failed.', type: 'counter' },
  hsm_sandbox_zeroized_total: { help: 'Total sandbox zeroization operations.', type: 'counter' },
  hsm_sandbox_active: { help: 'Current number of active sandboxes.', type: 'gauge' },
  hsm_shard_append_total: { help: 'Total shard entries appended.', type: 'counter' },
  hsm_shard_ack_total: { help: 'Total shard entry acknowledgments received.', type: 'counter' },
  hsm_shard_commit_total: { help: 'Total shard entries committed via quorum.', type: 'counter' },
  hsm_shard_catchup_batch_total: { help: 'Total catch-up batches streamed to lagging nodes.', type: 'counter' },
  hsm_shard_byzantine_detected_total: { help: 'Total nodes flagged as byzantine due to divergence.', type: 'counter' },
  hsm_shard_lagging_nodes: { help: 'Current number of lagging nodes across all shards.', type: 'gauge' },
  hsm_shard_active: { help: 'Current number of active shards being tracked.', type: 'gauge' },
  hsm_migration_initiated_total: { help: 'Total cross-cluster migrations initiated.', type: 'counter' },
  hsm_migration_attested_total: { help: 'Total cross-cluster migrations attested.', type: 'counter' },
  hsm_migration_committed_total: { help: 'Total cross-cluster migrations committed via quorum.', type: 'counter' },
  hsm_migration_rolled_back_total: { help: 'Total cross-cluster migrations rolled back.', type: 'counter' },
  hsm_migration_ack_total: { help: 'Total migration acknowledgments received from destination nodes.', type: 'counter' },
  hsm_migration_verification_failed_total: { help: 'Total migrations that failed verification.', type: 'counter' },
  hsm_migration_active: { help: 'Current number of active (in-progress) migrations.', type: 'gauge' },
  hsm_reconciliation_scans_total: { help: 'Total key reconciliation scans performed.', type: 'counter' },
  hsm_reconciliation_divergence_detected_total: { help: 'Total key divergences detected across scans.', type: 'counter' },
  hsm_reconciliation_promoted_total: { help: 'Total key epochs promoted via quorum.', type: 'counter' },
  hsm_reconciliation_quarantined_total: { help: 'Total keys quarantined due to unrecoverable divergence.', type: 'counter' },
  hsm_reconciliation_rollback_blocked_total: { help: 'Total key epoch rollback attempts blocked.', type: 'counter' },
  hsm_reconciliation_promotion_votes_total: { help: 'Total promotion votes cast by healthy nodes.', type: 'counter' },
  hsm_reconciliation_divergent_keys: { help: 'Current number of keys with unresolved divergence.', type: 'gauge' },
  hsm_wrap_duration_ms: { help: 'Latency of HSM wrapKey operations in milliseconds.', type: 'histogram' },
  hsm_unwrap_duration_ms: { help: 'Latency of HSM unwrapKey operations in milliseconds.', type: 'histogram' },
  hsm_create_kek_duration_ms: { help: 'Latency of KEK creation operations in milliseconds.', type: 'histogram' },
};

/**
 * Increment a counter.
 * @param {string} name - counter name
 * @param {number} [value=1] - increment amount
 */
function incrementCounter(name, value = 1) {
  if (counters[name] !== undefined) {
    counters[name] += value;
  }
}

/**
 * Observe a latency value in a histogram.
 * @param {string} name - histogram name
 * @param {number} durationMs - observed duration in milliseconds
 */
function observeHistogram(name, durationMs) {
  const h = histograms[name];
  if (!h) return;
  h.sum += durationMs;
  h.count++;
  for (let i = 0; i < h.buckets.length; i++) {
    if (durationMs <= h.buckets[i]) {
      h.counts[i]++;
      return;
    }
  }
  // Overflow bucket (+Inf)
  h.counts[h.counts.length - 1]++;
}

/**
 * Reset all metrics to zero. Primarily for testing.
 */
function reset() {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
  for (const key of Object.keys(histograms)) {
    histograms[key].counts.fill(0);
    histograms[key].sum = 0;
    histograms[key].count = 0;
  }
}

/**
 * Get all metrics as a flat object (for programmatic access).
 * @returns {object} metric name -> value
 */
function getMetrics() {
  const result = { ...counters };
  for (const [name, h] of Object.entries(histograms)) {
    result[`${name}_count`] = h.count;
    result[`${name}_sum`] = h.sum;
    for (let i = 0; i < h.buckets.length; i++) {
      result[`${name}_bucket{le="${h.buckets[i]}"}`] = h.counts[i];
    }
    result[`${name}_bucket{le="+Inf"}`] = h.count;
  }
  return result;
}

/**
 * Render metrics in Prometheus exposition format.
 * @returns {string} Prometheus text format
 */
function renderPrometheus() {
  const lines = [];

  // Counters
  for (const [name, value] of Object.entries(counters)) {
    const meta = META[name];
    if (!meta) continue;
    lines.push(`# HELP ${name} ${meta.help}`);
    lines.push(`# TYPE ${name} ${meta.type}`);
    lines.push(`${name} ${value}`);
  }

  // Histograms
  for (const [name, h] of Object.entries(histograms)) {
    const meta = META[name];
    if (!meta) continue;
    lines.push(`# HELP ${name} ${meta.help}`);
    lines.push(`# TYPE ${name} ${meta.type}`);
    // Cumulative bucket counts
    let cumulative = 0;
    for (let i = 0; i < h.buckets.length; i++) {
      cumulative += h.counts[i];
      lines.push(`${name}_bucket{le="${h.buckets[i]}"} ${cumulative}`);
    }
    cumulative += h.counts[h.counts.length - 1];
    lines.push(`${name}_bucket{le="+Inf"} ${cumulative}`);
    lines.push(`${name}_sum ${h.sum}`);
    lines.push(`${name}_count ${h.count}`);
  }

  return lines.join('\n') + '\n';
}

module.exports = {
  incrementCounter,
  observeHistogram,
  reset,
  getMetrics,
  renderPrometheus,
  counters,
  histograms,
};

// TEST APPEND
