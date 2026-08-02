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
  // Track 40: Distributed Consensus Coordinator counters
  hsm_consensus_coord_groups_created_total: 0,
  hsm_consensus_coord_groups_destroyed_total: 0,
  hsm_consensus_coord_proposals_routed_total: 0,
  hsm_consensus_coord_proposals_rejected_total: 0,
  hsm_consensus_coord_faults_detected_total: 0,
  hsm_consensus_coord_view_change_started_total: 0,
  hsm_consensus_coord_view_change_completed_total: 0,
  hsm_consensus_coord_view_change_aborted_total: 0,
  hsm_consensus_coord_quorum_verified_total: 0,
  hsm_consensus_coord_quorum_denied_total: 0,
  // Track 41: Hardware Enclave Isolation counters
  hsm_enclave_bootstrap_total: 0,
  hsm_enclave_bootstrap_failed_total: 0,
  hsm_enclave_seal_total: 0,
  hsm_enclave_unseal_total: 0,
  hsm_enclave_unseal_failed_total: 0,
  hsm_enclave_key_provisioned_total: 0,
  hsm_enclave_key_provision_blocked_total: 0,
  hsm_enclave_attestation_verified_total: 0,
  hsm_enclave_attestation_rejected_total: 0,
  hsm_enclave_active: 0,
  // Track 42: Enclave Secret-Sealing and Attestation Policy counters
  hsm_sealing_policy_validated_total: 0,
  hsm_sealing_policy_blocked_total: 0,
  hsm_unseal_policy_validated_total: 0,
  hsm_unseal_policy_blocked_total: 0,
  hsm_attestation_challenge_issued_total: 0,
  hsm_attestation_policy_validated_total: 0,
  hsm_attestation_replay_detected_total: 0,
  hsm_attestation_expired_total: 0,
  hsm_key_provisioning_validated_total: 0,
  hsm_key_provisioning_blocked_total: 0,
  hsm_sealed_keys_tracked: 0,
  // Track 43: Multiparty Auditing and Remote Attestation Logs counters
  hsm_audit_entry_appended_total: 0,
  hsm_audit_entry_committed_total: 0,
  hsm_audit_entry_pending: 0,
  hsm_audit_signature_added_total: 0,
  hsm_audit_verification_timeout_total: 0,
  hsm_audit_duplicate_signature_total: 0,
  hsm_audit_chain_verified_total: 0,
  hsm_audit_chain_broken_total: 0,
  hsm_audit_verifier_registered_total: 0,
  hsm_audit_event_type_blocked_total: 0,
  hsm_audit_committed_entries: 0,
  // Track 44: Distributed Sharding and Cross-Enclave State Sync counters
  hsm_cross_enclave_registered_total: 0,
  hsm_cross_enclave_unregistered_total: 0,
  hsm_cross_enclave_stale_detected_total: 0,
  hsm_cross_enclave_active: 0,
  hsm_cross_enclave_shard_created_total: 0,
  hsm_cross_enclave_shard_reassigned_total: 0,
  hsm_cross_enclave_state_written_total: 0,
  hsm_cross_enclave_state_conflict_total: 0,
  hsm_cross_enclave_state_too_large_total: 0,
  hsm_cross_enclave_sync_total: 0,
  hsm_cross_enclave_sync_merged_total: 0,
  hsm_cross_enclave_sync_skipped_total: 0,
  hsm_cross_enclave_shards: 0,
  // Track 45: Enclave Key Rotation and Cryptographic Heartbeats counters
  hsm_key_rotation_total: 0,
  hsm_key_rotation_blocked_total: 0,
  hsm_key_rotation_skipped_total: 0,
  hsm_key_revoked_total: 0,
  hsm_key_quarantined_total: 0,
  hsm_key_recovered_total: 0,
  hsm_heartbeat_issued_total: 0,
  hsm_heartbeat_verified_total: 0,
  hsm_heartbeat_expired_total: 0,
  hsm_heartbeat_response_invalid_total: 0,
  hsm_heartbeat_active_keys: 0,
  hsm_heartbeat_quarantined_keys: 0,
  hsm_heartbeat_pending_challenges: 0,
  // Track 46: Zero-Knowledge Inter-Enclave MPC Handshakes counters
  hsm_mpc_handshake_initiated_total: 0,
  hsm_mpc_handshake_committed_total: 0,
  hsm_mpc_handshake_proven_total: 0,
  hsm_mpc_handshake_verified_total: 0,
  hsm_mpc_handshake_finalized_total: 0,
  hsm_mpc_handshake_aborted_total: 0,
  hsm_mpc_handshake_expired_total: 0,
  hsm_mpc_proof_valid_total: 0,
  hsm_mpc_proof_invalid_total: 0,
  hsm_mpc_handshake_active: 0,
  // Track 47: Post-Quantum Cryptographic Enclave Migrations counters
  hsm_pqc_migration_registered_total: 0,
  hsm_pqc_migration_planned_total: 0,
  hsm_pqc_hybrid_activated_total: 0,
  hsm_pqc_fully_activated_total: 0,
  hsm_pqc_migration_completed_total: 0,
  hsm_pqc_migration_rollback_total: 0,
  hsm_pqc_migration_failed_total: 0,
  hsm_pqc_signature_constraint_satisfied_total: 0,
  hsm_pqc_signature_constraint_violated_total: 0,
  hsm_pqc_classical_enclaves: 0,
  hsm_pqc_hybrid_enclaves: 0,
  hsm_pqc_pqc_enclaves: 0,
  // Track 48: Enclave Fault Injection and Byzantine Chaos Testing counters
  hsm_fault_injected_total: 0,
  hsm_fault_resolved_total: 0,
  hsm_fault_expired_total: 0,
  hsm_fault_cancelled_total: 0,
  hsm_fault_byzantine_total: 0,
  hsm_fault_network_partition_total: 0,
  hsm_fault_crash_total: 0,
  hsm_fault_key_corruption_total: 0,
  hsm_fault_timing_attack_total: 0,
  hsm_fault_active: 0,
  hsm_fault_scenario_completed_total: 0,
  hsm_fault_scenario_failed_total: 0,
  // Track 49: Dynamic Enclave Rescaling and Predictive Load Balancing counters
  hsm_rescaling_scale_up_total: 0,
  hsm_rescaling_scale_down_total: 0,
  hsm_rescaling_rebalance_total: 0,
  hsm_rescaling_failed_total: 0,
  hsm_rescaling_chaos_triggered_total: 0,
  hsm_rescaling_active_enclaves: 0,
  hsm_rescaling_average_load: 0,
  hsm_rescaling_predicted_load: 0,
  hsm_rescaling_imbalance: 0,
  // Track 50: Confidential Federated Learning and ZK Model Aggregation counters
  hsm_fl_rounds_initiated_total: 0,
  hsm_fl_rounds_completed_total: 0,
  hsm_fl_rounds_failed_total: 0,
  hsm_fl_rounds_expired_total: 0,
  hsm_fl_gradients_submitted_total: 0,
  hsm_fl_gradients_verified_total: 0,
  hsm_fl_gradients_rejected_total: 0,
  hsm_fl_active_rounds: 0,
  hsm_fl_global_model_version: 0,
  hsm_fl_participants_total: 0,
  // Track 51: Homomorphic Encryption Over Mesh Topologies counters
  hsm_he_mesh_nodes_total: 0,
  hsm_he_mesh_edges_total: 0,
  hsm_he_mesh_active_nodes: 0,
  hsm_he_mesh_queries_created_total: 0,
  hsm_he_mesh_queries_completed_total: 0,
  hsm_he_mesh_queries_failed_total: 0,
  hsm_he_mesh_queries_expired_total: 0,
  hsm_he_mesh_hops_executed_total: 0,
  hsm_he_mesh_active_queries: 0,
  // Track 52: Secure Multi-Party Inner Product and Encrypted Search Indexes counters
  hsm_sip_indexes_built_total: 0,
  hsm_sip_indexes_active: 0,
  hsm_sip_queries_total: 0,
  hsm_sip_queries_completed_total: 0,
  hsm_sip_queries_failed_total: 0,
  hsm_sip_parties_total: 0,
  hsm_sip_parties_active: 0,
  hsm_sip_documents_indexed_total: 0,
  hsm_sip_search_results_total: 0,
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
  // Track 36: ZK Proof-of-Assets counters
  hsm_poa_asset_registered_total: 0,
  hsm_poa_proof_created_total: 0,
  hsm_poa_proof_verified_total: 0,
  hsm_poa_proof_invalid_total: 0,
  hsm_poa_double_count_blocked_total: 0,
  hsm_poa_quorum_signatures_total: 0,
  hsm_poa_active_proofs: 0,
  // Track 37: Multiparty Re-Keying counters
  hsm_rekey_proposed_total: 0,
  hsm_rekey_resharing_submitted_total: 0,
  hsm_rekey_verified_total: 0,
  hsm_rekey_committed_total: 0,
  hsm_rekey_aborted_total: 0,
  hsm_rekey_rollback_blocked_total: 0,
  hsm_rekey_active: 0,
  // Track 38: Encrypted P2P Routing counters
  hsm_p2p_route_discovered_total: 0,
  hsm_p2p_message_encrypted_total: 0,
  hsm_p2p_message_relayed_total: 0,
  hsm_p2p_message_delivered_total: 0,
  hsm_p2p_route_revoked_total: 0,
  hsm_p2p_replay_blocked_total: 0,
  hsm_p2p_active_routes: 0,
  // Track 39: Threshold Account Recovery counters
  hsm_recovery_requested_total: 0,
  hsm_recovery_approved_total: 0,
  hsm_recovery_executed_total: 0,
  hsm_recovery_rejected_total: 0,
  hsm_recovery_replay_blocked_total: 0,
  hsm_recovery_time_lock_blocked_total: 0,
  hsm_recovery_active: 0,
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
  // Track 40: Distributed Consensus Coordinator
  hsm_consensus_coord_groups_created_total: { help: 'Total consensus groups created by the coordinator.', type: 'counter' },
  hsm_consensus_coord_groups_destroyed_total: { help: 'Total consensus groups destroyed by the coordinator.', type: 'counter' },
  hsm_consensus_coord_proposals_routed_total: { help: 'Total proposals successfully routed to a consensus group.', type: 'counter' },
  hsm_consensus_coord_proposals_rejected_total: { help: 'Total proposals rejected (group not found, not active, no routing key, etc.).', type: 'counter' },
  hsm_consensus_coord_faults_detected_total: { help: 'Total node faults detected by the fault detector.', type: 'counter' },
  hsm_consensus_coord_view_change_started_total: { help: 'Total view change procedures initiated.', type: 'counter' },
  hsm_consensus_coord_view_change_completed_total: { help: 'Total view change procedures completed successfully.', type: 'counter' },
  hsm_consensus_coord_view_change_aborted_total: { help: 'Total view change procedures aborted (timeout, conflict, etc.).', type: 'counter' },
  hsm_consensus_coord_quorum_verified_total: { help: 'Total proposals that passed cross-group quorum verification.', type: 'counter' },
  hsm_consensus_coord_quorum_denied_total: { help: 'Total proposals denied due to insufficient quorum.', type: 'counter' },
  // Track 41: Hardware Enclave Isolation
  hsm_enclave_bootstrap_total: { help: 'Total enclave bootstrap (initialize) operations.', type: 'counter' },
  hsm_enclave_bootstrap_failed_total: { help: 'Total enclave bootstrap operations that failed.', type: 'counter' },
  hsm_enclave_seal_total: { help: 'Total seal operations inside the enclave boundary.', type: 'counter' },
  hsm_enclave_unseal_total: { help: 'Total unseal operations inside the enclave boundary.', type: 'counter' },
  hsm_enclave_unseal_failed_total: { help: 'Total unseal operations that failed (tamper or auth tag mismatch).', type: 'counter' },
  hsm_enclave_key_provisioned_total: { help: 'Total keys provisioned into the enclave after attestation.', type: 'counter' },
  hsm_enclave_key_provision_blocked_total: { help: 'Total key provisioning attempts blocked (no attestation, untrusted measurement).', type: 'counter' },
  hsm_enclave_attestation_verified_total: { help: 'Total attestation documents that passed verification.', type: 'counter' },
  hsm_enclave_attestation_rejected_total: { help: 'Total attestation documents rejected (bad authority, measurement, expired, bad signature).', type: 'counter' },
  hsm_enclave_active: { help: 'Number of currently active (initialized) enclaves.', type: 'gauge' },
  // Track 42: Enclave Secret-Sealing and Attestation Policy
  hsm_sealing_policy_validated_total: { help: 'Total seal operations that passed policy validation.', type: 'counter' },
  hsm_sealing_policy_blocked_total: { help: 'Total seal operations blocked by policy (bad cipher, key too small, data too large, key expired).', type: 'counter' },
  hsm_unseal_policy_validated_total: { help: 'Total unseal operations that passed policy validation.', type: 'counter' },
  hsm_unseal_policy_blocked_total: { help: 'Total unseal operations blocked by policy (outside enclave boundary).', type: 'counter' },
  hsm_attestation_challenge_issued_total: { help: 'Total attestation challenge nonces issued.', type: 'counter' },
  hsm_attestation_policy_validated_total: { help: 'Total attestation responses that passed policy validation.', type: 'counter' },
  hsm_attestation_replay_detected_total: { help: 'Total attestation responses rejected as replay attacks.', type: 'counter' },
  hsm_attestation_expired_total: { help: 'Total attestation responses rejected as expired.', type: 'counter' },
  hsm_key_provisioning_validated_total: { help: 'Total key provisioning operations that passed policy validation.', type: 'counter' },
  hsm_key_provisioning_blocked_total: { help: 'Total key provisioning operations blocked by policy (no attestation, bad key type, too many keys).', type: 'counter' },
  hsm_sealed_keys_tracked: { help: 'Number of currently tracked sealed keys.', type: 'gauge' },
  // Track 43: Multiparty Auditing and Remote Attestation Logs
  hsm_audit_entry_appended_total: { help: 'Total audit entries appended to the multiparty log.', type: 'counter' },
  hsm_audit_entry_committed_total: { help: 'Total audit entries committed (reached min verifier signatures).', type: 'counter' },
  hsm_audit_entry_pending: { help: 'Number of audit entries currently pending verification.', type: 'gauge' },
  hsm_audit_signature_added_total: { help: 'Total verifier signatures added to audit entries.', type: 'counter' },
  hsm_audit_verification_timeout_total: { help: 'Total audit entries that timed out before reaching quorum.', type: 'counter' },
  hsm_audit_duplicate_signature_total: { help: 'Total duplicate verifier signature attempts rejected.', type: 'counter' },
  hsm_audit_chain_verified_total: { help: 'Total successful full-chain integrity verifications.', type: 'counter' },
  hsm_audit_chain_broken_total: { help: 'Total chain integrity verification failures (tamper detected).', type: 'counter' },
  hsm_audit_verifier_registered_total: { help: 'Total verifiers registered to the audit log.', type: 'counter' },
  hsm_audit_event_type_blocked_total: { help: 'Total audit events rejected due to disallowed event type.', type: 'counter' },
  hsm_audit_committed_entries: { help: 'Number of committed entries in the audit log.', type: 'gauge' },
  // Track 44: Distributed Sharding and Cross-Enclave State Sync
  hsm_cross_enclave_registered_total: { help: 'Total enclaves registered to the cross-enclave sync cluster.', type: 'counter' },
  hsm_cross_enclave_unregistered_total: { help: 'Total enclaves unregistered from the cluster.', type: 'counter' },
  hsm_cross_enclave_stale_detected_total: { help: 'Total enclaves detected as stale and marked offline.', type: 'counter' },
  hsm_cross_enclave_active: { help: 'Number of currently active enclaves in the cluster.', type: 'gauge' },
  hsm_cross_enclave_shard_created_total: { help: 'Total shards created in the cross-enclave sync engine.', type: 'counter' },
  hsm_cross_enclave_shard_reassigned_total: { help: 'Total shard reassignments (after enclave removal or failure).', type: 'counter' },
  hsm_cross_enclave_state_written_total: { help: 'Total state writes across all shards.', type: 'counter' },
  hsm_cross_enclave_state_conflict_total: { help: 'Total state write conflicts detected.', type: 'counter' },
  hsm_cross_enclave_state_too_large_total: { help: 'Total state writes rejected for exceeding size limit.', type: 'counter' },
  hsm_cross_enclave_sync_total: { help: 'Total cross-enclave sync operations.', type: 'counter' },
  hsm_cross_enclave_sync_merged_total: { help: 'Total state entries merged during sync operations.', type: 'counter' },
  hsm_cross_enclave_sync_skipped_total: { help: 'Total state entries skipped during sync (local newer).', type: 'counter' },
  hsm_cross_enclave_shards: { help: 'Number of active shards in the cross-enclave sync engine.', type: 'gauge' },
  // Track 45: Enclave Key Rotation and Cryptographic Heartbeats
  hsm_key_rotation_total: { help: 'Total key rotations performed across all enclaves.', type: 'counter' },
  hsm_key_rotation_blocked_total: { help: 'Total key rotations blocked (quarantined or max epochs reached).', type: 'counter' },
  hsm_key_rotation_skipped_total: { help: 'Total scheduled rotations skipped due to errors.', type: 'counter' },
  hsm_key_revoked_total: { help: 'Total enclave keys revoked.', type: 'counter' },
  hsm_key_quarantined_total: { help: 'Total enclave keys quarantined due to missed heartbeats.', type: 'counter' },
  hsm_key_recovered_total: { help: 'Total enclaves recovered from quarantine via key rotation.', type: 'counter' },
  hsm_heartbeat_issued_total: { help: 'Total heartbeat challenges issued.', type: 'counter' },
  hsm_heartbeat_verified_total: { help: 'Total heartbeat responses successfully verified.', type: 'counter' },
  hsm_heartbeat_expired_total: { help: 'Total heartbeat challenges that expired without response.', type: 'counter' },
  hsm_heartbeat_response_invalid_total: { help: 'Total heartbeat responses that failed HMAC verification.', type: 'counter' },
  hsm_heartbeat_active_keys: { help: 'Number of enclaves with active key status.', type: 'gauge' },
  hsm_heartbeat_quarantined_keys: { help: 'Number of enclaves with quarantined key status.', type: 'gauge' },
  hsm_heartbeat_pending_challenges: { help: 'Number of pending heartbeat challenges awaiting response.', type: 'gauge' },
  // Track 46: Zero-Knowledge Inter-Enclave MPC Handshakes
  hsm_mpc_handshake_initiated_total: { help: 'Total MPC handshakes initiated.', type: 'counter' },
  hsm_mpc_handshake_committed_total: { help: 'Total MPC handshake commitment phases completed (all participants committed).', type: 'counter' },
  hsm_mpc_handshake_proven_total: { help: 'Total MPC handshake proof phases completed (all proofs submitted).', type: 'counter' },
  hsm_mpc_handshake_verified_total: { help: 'Total MPC handshakes where all proofs verified successfully.', type: 'counter' },
  hsm_mpc_handshake_finalized_total: { help: 'Total MPC handshakes finalized with combined public key.', type: 'counter' },
  hsm_mpc_handshake_aborted_total: { help: 'Total MPC handshakes aborted (failed verification or manual abort).', type: 'counter' },
  hsm_mpc_handshake_expired_total: { help: 'Total MPC handshakes that expired before completion.', type: 'counter' },
  hsm_mpc_proof_valid_total: { help: 'Total ZK proofs that passed verification.', type: 'counter' },
  hsm_mpc_proof_invalid_total: { help: 'Total ZK proofs that failed verification.', type: 'counter' },
  hsm_mpc_handshake_active: { help: 'Number of currently active (in-progress) MPC handshakes.', type: 'gauge' },
  // Track 47: Post-Quantum Cryptographic Enclave Migrations
  hsm_pqc_migration_registered_total: { help: 'Total enclaves registered for PQC migration.', type: 'counter' },
  hsm_pqc_migration_planned_total: { help: 'Total PQC migrations planned.', type: 'counter' },
  hsm_pqc_hybrid_activated_total: { help: 'Total enclaves activated in hybrid (classical+PQC) mode.', type: 'counter' },
  hsm_pqc_fully_activated_total: { help: 'Total enclaves fully activated in PQC-only mode.', type: 'counter' },
  hsm_pqc_migration_completed_total: { help: 'Total PQC migrations completed successfully.', type: 'counter' },
  hsm_pqc_migration_rollback_total: { help: 'Total PQC migration rollbacks.', type: 'counter' },
  hsm_pqc_migration_failed_total: { help: 'Total PQC migrations that failed (max attempts reached).', type: 'counter' },
  hsm_pqc_signature_constraint_satisfied_total: { help: 'Total lattice signature constraints satisfied.', type: 'counter' },
  hsm_pqc_signature_constraint_violated_total: { help: 'Total lattice signature constraints violated.', type: 'counter' },
  hsm_pqc_classical_enclaves: { help: 'Number of enclaves still using classical cryptography.', type: 'gauge' },
  hsm_pqc_hybrid_enclaves: { help: 'Number of enclaves in hybrid (classical+PQC) transition mode.', type: 'gauge' },
  hsm_pqc_pqc_enclaves: { help: 'Number of enclaves fully migrated to post-quantum cryptography.', type: 'gauge' },
  // Track 48: Enclave Fault Injection and Byzantine Chaos Testing
  hsm_fault_injected_total: { help: 'Total faults injected into enclaves.', type: 'counter' },
  hsm_fault_resolved_total: { help: 'Total faults resolved (manually or via recovery).', type: 'counter' },
  hsm_fault_expired_total: { help: 'Total faults that expired (duration elapsed).', type: 'counter' },
  hsm_fault_cancelled_total: { help: 'Total faults cancelled manually.', type: 'counter' },
  hsm_fault_byzantine_total: { help: 'Total byzantine faults injected (equivocation, omission, divergence).', type: 'counter' },
  hsm_fault_network_partition_total: { help: 'Total network partition faults injected.', type: 'counter' },
  hsm_fault_crash_total: { help: 'Total enclave crash faults injected.', type: 'counter' },
  hsm_fault_key_corruption_total: { help: 'Total key corruption faults injected.', type: 'counter' },
  hsm_fault_timing_attack_total: { help: 'Total timing attack faults injected.', type: 'counter' },
  hsm_fault_active: { help: 'Number of currently active faults.', type: 'gauge' },
  hsm_fault_scenario_completed_total: { help: 'Total fault scenarios completed successfully.', type: 'counter' },
  hsm_fault_scenario_failed_total: { help: 'Total fault scenarios that failed.', type: 'counter' },
  // Track 49: Dynamic Enclave Rescaling and Predictive Load Balancing
  hsm_rescaling_scale_up_total: { help: 'Total scale-up actions executed.', type: 'counter' },
  hsm_rescaling_scale_down_total: { help: 'Total scale-down actions executed.', type: 'counter' },
  hsm_rescaling_rebalance_total: { help: 'Total shard rebalance actions executed.', type: 'counter' },
  hsm_rescaling_failed_total: { help: 'Total rescaling actions that failed.', type: 'counter' },
  hsm_rescaling_chaos_triggered_total: { help: 'Total rescaling actions triggered by chaos events.', type: 'counter' },
  hsm_rescaling_active_enclaves: { help: 'Number of currently active enclaves in the rescaling cluster.', type: 'gauge' },
  hsm_rescaling_average_load: { help: 'Current average load across all active enclaves (0.0-1.0).', type: 'gauge' },
  hsm_rescaling_predicted_load: { help: 'Predicted average load based on forecasting algorithm (0.0-1.0).', type: 'gauge' },
  hsm_rescaling_imbalance: { help: 'Current load imbalance ratio across enclaves (0.0 = balanced).', type: 'gauge' },
  // Track 50: Confidential Federated Learning and ZK Model Aggregation
  hsm_fl_rounds_initiated_total: { help: 'Total federated learning rounds initiated.', type: 'counter' },
  hsm_fl_rounds_completed_total: { help: 'Total federated learning rounds completed successfully.', type: 'counter' },
  hsm_fl_rounds_failed_total: { help: 'Total federated learning rounds that failed.', type: 'counter' },
  hsm_fl_rounds_expired_total: { help: 'Total federated learning rounds that expired (timeout).', type: 'counter' },
  hsm_fl_gradients_submitted_total: { help: 'Total gradient updates submitted by participants.', type: 'counter' },
  hsm_fl_gradients_verified_total: { help: 'Total gradient updates that passed ZK proof verification.', type: 'counter' },
  hsm_fl_gradients_rejected_total: { help: 'Total gradient updates that failed ZK proof verification.', type: 'counter' },
  hsm_fl_active_rounds: { help: 'Number of currently active federated learning rounds.', type: 'gauge' },
  hsm_fl_global_model_version: { help: 'Current global model version (incremented per completed round).', type: 'gauge' },
  hsm_fl_participants_total: { help: 'Total participant enclaves across all rounds.', type: 'counter' },
  // Track 51: Homomorphic Encryption Over Mesh Topologies
  hsm_he_mesh_nodes_total: { help: 'Total nodes registered in the HE mesh topology.', type: 'gauge' },
  hsm_he_mesh_edges_total: { help: 'Total edges (links) in the HE mesh topology.', type: 'gauge' },
  hsm_he_mesh_active_nodes: { help: 'Number of active nodes in the HE mesh.', type: 'gauge' },
  hsm_he_mesh_queries_created_total: { help: 'Total HE mesh queries created.', type: 'counter' },
  hsm_he_mesh_queries_completed_total: { help: 'Total HE mesh queries completed successfully.', type: 'counter' },
  hsm_he_mesh_queries_failed_total: { help: 'Total HE mesh queries that failed.', type: 'counter' },
  hsm_he_mesh_queries_expired_total: { help: 'Total HE mesh queries that expired (timeout).', type: 'counter' },
  hsm_he_mesh_hops_executed_total: { help: 'Total HE mesh hops executed across all queries.', type: 'counter' },
  hsm_he_mesh_active_queries: { help: 'Number of currently active HE mesh queries.', type: 'gauge' },
  // Track 52: Secure Multi-Party Inner Product and Encrypted Search Indexes
  hsm_sip_indexes_built_total: { help: 'Total blind search indexes built.', type: 'counter' },
  hsm_sip_indexes_active: { help: 'Number of currently active search indexes.', type: 'gauge' },
  hsm_sip_queries_total: { help: 'Total secure inner-product search queries initiated.', type: 'counter' },
  hsm_sip_queries_completed_total: { help: 'Total search queries completed successfully.', type: 'counter' },
  hsm_sip_queries_failed_total: { help: 'Total search queries that failed.', type: 'counter' },
  hsm_sip_parties_total: { help: 'Total parties registered in the secure search cluster.', type: 'gauge' },
  hsm_sip_parties_active: { help: 'Number of currently active parties.', type: 'gauge' },
  hsm_sip_documents_indexed_total: { help: 'Total documents indexed across all indexes.', type: 'counter' },
  hsm_sip_search_results_total: { help: 'Total search results returned across all queries.', type: 'counter' },
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
  hsm_poa_asset_registered_total: { help: 'Total assets registered for proof-of-assets.', type: 'counter' },
  hsm_poa_proof_created_total: { help: 'Total ZK proof-of-assets drafts created.', type: 'counter' },
  hsm_poa_proof_verified_total: { help: 'Total ZK proof-of-assets successfully verified.', type: 'counter' },
  hsm_poa_proof_invalid_total: { help: 'Total ZK proof-of-assets marked invalid.', type: 'counter' },
  hsm_poa_double_count_blocked_total: { help: 'Total asset double-counting attempts blocked.', type: 'counter' },
  hsm_poa_quorum_signatures_total: { help: 'Total quorum signatures collected on proofs.', type: 'counter' },
  hsm_poa_active_proofs: { help: 'Current number of active (non-terminal) proofs.', type: 'gauge' },
  hsm_rekey_proposed_total: { help: 'Total re-keying rounds proposed.', type: 'counter' },
  hsm_rekey_resharing_submitted_total: { help: 'Total shareholder resharings submitted.', type: 'counter' },
  hsm_rekey_verified_total: { help: 'Total re-keying rounds verified.', type: 'counter' },
  hsm_rekey_committed_total: { help: 'Total re-keying rounds committed via quorum.', type: 'counter' },
  hsm_rekey_aborted_total: { help: 'Total re-keying rounds aborted.', type: 'counter' },
  hsm_rekey_rollback_blocked_total: { help: 'Total re-keying epoch rollback attempts blocked.', type: 'counter' },
  hsm_rekey_active: { help: 'Current number of active (in-progress) re-keying rounds.', type: 'gauge' },
  hsm_p2p_route_discovered_total: { help: 'Total P2P routes discovered via BFS.', type: 'counter' },
  hsm_p2p_message_encrypted_total: { help: 'Total P2P messages encrypted with onion layers.', type: 'counter' },
  hsm_p2p_message_relayed_total: { help: 'Total P2P messages relayed through hops.', type: 'counter' },
  hsm_p2p_message_delivered_total: { help: 'Total P2P messages successfully delivered.', type: 'counter' },
  hsm_p2p_route_revoked_total: { help: 'Total P2P routes revoked.', type: 'counter' },
  hsm_p2p_replay_blocked_total: { help: 'Total P2P replay attacks blocked.', type: 'counter' },
  hsm_p2p_active_routes: { help: 'Current number of active P2P routes.', type: 'gauge' },
  hsm_recovery_requested_total: { help: 'Total account recovery requests initiated.', type: 'counter' },
  hsm_recovery_approved_total: { help: 'Total guardian approvals submitted.', type: 'counter' },
  hsm_recovery_executed_total: { help: 'Total account recoveries successfully executed.', type: 'counter' },
  hsm_recovery_rejected_total: { help: 'Total account recovery requests rejected.', type: 'counter' },
  hsm_recovery_replay_blocked_total: { help: 'Total replay attacks blocked during recovery.', type: 'counter' },
  hsm_recovery_time_lock_blocked_total: { help: 'Total recovery attempts blocked by time-lock.', type: 'counter' },
  hsm_recovery_active: { help: 'Current number of active (in-progress) account recoveries.', type: 'gauge' },
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
