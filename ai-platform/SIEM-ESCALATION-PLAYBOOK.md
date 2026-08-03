# SIEM Escalation Playbook

**Scope:** Step-by-step triage guide for engineers responding to CRITICAL and HIGH alerts from the cryptographic and consensus layers.

**Last updated:** 2026-08-03
**Trunk baseline:** Tracks 26–115 (100% Jest pass, SimpleBeacon gate PASS)

---

## Alert Severity Matrix

| Event Code | Severity | Source Module | Layer |
|------------|----------|---------------|-------|
| `PROOF_HASH_MISMATCH` | CRITICAL | `zk-proof-of-assets-engine.cjs` | ZK proof verification |
| `audit_log_tampering` | CRITICAL | `middleware/audit.cjs` | Audit chain integrity |
| `DKG_PERSISTENCE_REJECT` | HIGH | `dkg-snark-engine.cjs` | DKG contribution persistence |
| `NUMERIC_OVERSIZE` | HIGH | `dkg-snark-engine.cjs` | Polynomial/commitment validation |
| `KEY_REJECT` | HIGH | `cluster-keyring-sync.cjs` | Cluster keyring commit |
| `ISOLATION_VIOLATION` | HIGH | `cluster-keyring-sync.cjs` | Cluster peer authentication |
| `ATTESTATION_EXPIRED` | HIGH | `confidential-sandbox-engine.cjs` | Enclave attestation |
| `ATTESTATION_REJECTED` | HIGH | `confidential-sandbox-engine.cjs` | Enclave attestation |
| `SPLIT_BRAIN_DETECTED` | HIGH | `cluster-keyring-sync.cjs` | Cluster quorum |
| `QUANTUM_DEGRADE_REJECTED` | MEDIUM | `cluster-keyring-sync.cjs` | Hybrid KEM handshake |

---

## CRITICAL: `PROOF_HASH_MISMATCH`

**Meaning:** A zero-knowledge proof of assets bundle was submitted whose computed hash does not match the declared `proofHash`. This indicates either data corruption in transit or deliberate tampering with the proof bundle.

**Source:** `zk-proof-of-assets-engine.cjs:360` — `throw new HsmAdapterError('PROOF_HASH_MISMATCH', 'proof hash does not match — tampering detected')`

### Triage Steps

1. **Identify the submission source.** Query the audit timeline for the `PROOF_HASH_MISMATCH` event to extract the submitting node ID and proof bundle identifier.
   ```
   GET /api/audit/events?eventType=PROOF_HASH_MISMATCH
   ```

2. **Isolate the submitting node.** If the node is part of the cluster, remove it from `CLUSTER_NODES` and restart the keyring sync service on the leader. This prevents the node from submitting further proof bundles.

3. **Verify proof bundle integrity.** Retrieve the original proof bundle from the submitting node's local storage and recompute the hash:
   ```bash
   node -e "const crypto=require('crypto'); const fs=require('fs'); const b=fs.readFileSync('path/to/proof.json'); console.log(crypto.createHash('sha256').update(b).digest('hex'));"
   ```
   If the recomputed hash matches `proofHash`, the tampering occurred in transit — investigate network integrity. If it does not match, the node's proof generation pipeline is compromised.

4. **Check for correlated events.** Query for `DKG_PERSISTENCE_REJECT` or `NUMERIC_OVERSIZE` events from the same node within the same time window. Multiple alert types from one node indicate systemic compromise.

5. **Rotate keys if compromise is confirmed.** If the node is confirmed compromised, trigger an emergency key rotation from the leader:
   ```
   POST /api/cluster/rotate
   Authorization: Bearer <admin:all token>
   ```

6. **File an incident report.** Record the event in the SIEM with the node ID, proof bundle ID, hash comparison, and isolation actions taken.

---

## CRITICAL: `audit_log_tampering`

**Meaning:** The audit log chain integrity verification detected a broken hash link or a tampered entry. The audit log is tamper-evident by design (each entry's hash includes the previous entry's hash), so a broken link means someone modified or deleted an entry after it was written.

**Source:** `middleware/audit.cjs:73` — pattern match for `modify.*audit.*log`. Chain verification in `audit-logger.cjs:373-419`.

### Triage Steps

1. **Run chain verification immediately.**
   ```
   GET /api/audit/verify-chain
   ```
   Examine `brokenLinks` and `tamperedEntries` in the response. Each entry includes the entry ID and the expected vs actual hash.

2. **Quarantine tampered entries.** The self-healing system (`AUDIT_HEAL_ENABLED=true`) automatically moves tampered entries to `AUDIT_LOG_QUARANTINE_PATH` and re-links the chain. Verify quarantine succeeded:
   ```
   GET /api/audit/heal-status
   ```

3. **Identify the modification window.** Compare the tampered entry's timestamp with the previous and next valid entries. The modification occurred between the entry's original write time and the next entry's write time.

4. **Check access logs.** Cross-reference `AUDIT_AUTH_LOGS` for any authentication events or admin actions during the modification window. Look for direct database access, file system writes to `AUDIT_LOG_PATH`, or process-level manipulation.

5. **Preserve forensic evidence.** Do not delete the quarantine file. Copy `AUDIT_LOG_QUARANTINE_PATH` to a secure, append-only backup for forensic analysis.

6. **Escalate to security team.** Audit log tampering is a direct indicator of an insider threat or compromised admin credentials. Rotate all admin credentials and revoke active sessions.

---

## HIGH: `DKG_PERSISTENCE_REJECT`

**Meaning:** A DKG (Distributed Key Generation) contribution failed validation at the persistence boundary. The contribution's polynomial coefficients or group commitments are out of bounds, preventing safe storage.

**Source:** `dkg-snark-engine.cjs:372` — `this._auditHook({ action: 'DKG_PERSISTENCE_REJECT', entity: 'dkg_contribution', entityId: nodeId, reason: e.message })`

### Triage Steps

1. **Extract the rejection reason.** Query the audit hook output for the `reason` field. The reason will be one of:
   - `NUMERIC_OVERSIZE: polynomial coefficient exceeds <maxBits> bits` — a polynomial coefficient is larger than the field allows
   - `NUMERIC_OVERSIZE: commitments[i] out of group range` — a commitment is not a valid group element in `[1, p-1]`
   - `NUMERIC_PARSE_ERROR` — the contribution contains non-numeric or malformed data

2. **Identify the contributing node.** The `entityId` field contains the `nodeId` of the rejected contribution.

3. **Check node configuration.** Verify the node's `commitmentGroup` and `defaultBitLength` settings match the cluster's configured group. A mismatch (e.g., a 256-bit node joining a 521-bit cluster) will produce oversize coefficients.

4. **Reject the contribution.** The engine already throws and does not store the invalid contribution. Confirm the contribution was not persisted:
   ```bash
   node -e "const e=require('./server/lib/hsm-adapter/dkg-snark-engine.cjs'); /* check state */"
   ```

5. **Re-initiate DKG for the affected node.** Once the node's configuration is corrected, trigger a new DKG round:
   ```
   POST /api/cluster/dkg/initiate
   { "nodeId": "<affected-node-id>" }
   ```

6. **Monitor for recurrence.** If the same node repeatedly produces `DKG_PERSISTENCE_REJECT` events, remove it from the cluster and investigate for Byzantine behavior or software version mismatch.

---

## HIGH: `KEY_REJECT`

**Meaning:** A `KEY_COMMIT` message was rejected by the cluster keyring sync layer. The rejection reason is recorded in the event details.

**Source:** `cluster-keyring-sync.cjs:429-448` — `_recordEvent(EVENT_TYPES.KEY_REJECT, ...)` with reason field.

### Triage Steps by Reason

| Reason | Cause | Action |
|--------|-------|--------|
| `duplicate_commit` | KEY_COMMIT with same `rotatedAt` as already-applied commit | Normal idempotency guard. No action needed. |
| `stale_commit` | KEY_COMMIT with older `rotatedAt` than current watermark | Check for network partition or lagging leader. Verify leader election with `getStatus()`. |
| `missing_or_invalid_rotatedAt` | KEY_COMMIT missing timestamp | Bug in leader's `proposeRotate`. Check leader node logs. |
| `not_leader` | KEY_COMMIT from non-leader node | Possible split-brain or rogue node. Check `CLUSTER_NODES` whitelist and `SPLIT_BRAIN_DETECTED` events. |
| `invalid_hex_format` | `activeHex` or `previousHex` not strictly lowercase `[0-9a-f]` or wrong length | JCS canonicalization violation. Check key serialization in leader's `proposeRotate`. |

### For `not_leader` and `invalid_hex_format` (security-relevant)

1. **Identify the unauthorized sender.** Query the event for the `from` field (node ID of the sender).
2. **Check if the sender is in `CLUSTER_NODES`.** If not, an external actor is attempting key injection — escalate immediately.
3. **Verify leader election state.** Call `getStatus()` on all cluster nodes to confirm they agree on the current leader.
4. **If split-brain is detected**, follow the `SPLIT_BRAIN_DETECTED` playbook below.
5. **Rotate keys after resolution** to invalidate any partially-applied state.

---

## HIGH: `ISOLATION_VIOLATION`

**Meaning:** A message was received from a peer that is not in the `CLUSTER_NODES` whitelist. The socket was destroyed and the event was recorded.

**Source:** `cluster-keyring-sync.cjs` — `_recordEvent(EVENT_TYPES.ISOLATION_VIOLATION, NODE_ID, { peer, reason: 'unknown_cluster_peer', msgType })`

### Triage Steps

1. **Identify the peer address.** The event details contain `peer` (the `host:port` of the unknown peer) and `msgType` (the message type attempted).

2. **Determine if the peer should be allowed.** Check the deployment's expected cluster topology. If the peer is a legitimate new node, add it to `CLUSTER_NODES` and restart the keyring sync service.

3. **If the peer is not authorized**, investigate network access:
   - Check firewall rules for `CLUSTER_KEYRING_PORT` (default 7000)
   - Verify VPC/overlay network isolation
   - Check for port scanning or reconnaissance activity in SIEM logs

4. **Escalate if repeated.** Multiple `ISOLATION_VIOLATION` events from the same peer indicate active intrusion attempts. Block the peer IP at the network level and escalate to the security team.

---

## HIGH: `ATTESTATION_EXPIRED`

**Meaning:** An enclave attestation was rejected because its age exceeds the maximum allowed window.

**Source:** `confidential-sandbox-engine.cjs:222` — `throw new HsmAdapterError('ATTESTATION_EXPIRED', 'attestation age ${attestationAgeSeconds}s exceeds maximum ${maxAgeSec}s')`

### Triage Steps

1. **Check the attestation timestamp.** The error message includes `attestationAgeSeconds` and `maxAgeSec` (default 60s). If the attestation is only slightly expired, it may be clock skew.

2. **Verify node clock synchronization.** Check NTP status on the node that generated the attestation:
   ```bash
   ntpstat || chronyc tracking
   ```
   Clock drift > 5s should be corrected immediately.

3. **Re-attest the enclave.** Trigger a new attestation cycle for the affected enclave:
   ```
   POST /api/sandbox/attest
   { "enclaveId": "<enclave-id>" }
   ```

4. **Check enclave health.** If the attestation consistently expires immediately after generation, the enclave's secure clock may be malfunctioning. Restart the enclave process and verify hardware timestamp sources.

---

## HIGH: `ATTESTATION_REJECTED`

**Meaning:** An enclave attestation failed verification. The attestation client returned `verified: false`.

**Source:** `confidential-sandbox-engine.cjs:229` — `throw new HsmAdapterError('ATTESTATION_REJECTED', 'attestation verification failed')`

### Triage Steps

1. **Check the attestation measurement.** Compare the attestation's `measurement` and `mrenclave` fields against the expected values for the deployed enclave image. A mismatch indicates the enclave binary has been modified.

2. **Verify the attestation authority.** Check that the `authority` field is in the `allowedAttestationAuthorities` policy list. An unlisted authority means the attestation was generated by an untrusted verifier.

3. **Check the attestation signature.** Verify the signature was produced by the expected hardware key. A signature failure indicates either a compromised hardware key or a forged attestation.

4. **If the enclave image changed unexpectedly**, halt all sandbox operations for that enclave and investigate the deployment pipeline. A modified enclave image without a planned deployment is a critical security event.

5. **Re-deploy the enclave** from a known-good image after investigation:
   ```
   POST /api/sandbox/redeploy
   { "enclaveId": "<enclave-id>", "imageHash": "<expected-hash>" }
   ```

---

## HIGH: `SPLIT_BRAIN_DETECTED`

**Meaning:** The cluster lost quorum — the number of alive peers fell below the majority threshold (`floor(total/2) + 1`). The current leader stepped down.

**Source:** `cluster-keyring-sync.cjs:384` — `_recordEvent(EVENT_TYPES.SPLIT_BRAIN_DETECTED, ...)` with `reachableCount`, `required`, `totalSize`.

### Triage Steps

1. **Check cluster network connectivity.** From each node, verify connectivity to all peers:
   ```bash
   nc -zv <peer-host> 7000
   ```

2. **Review heartbeat timeout.** If network latency is high, increase `CLUSTER_HEARTBEAT_TIMEOUT_MS` (default 15000ms). It should be ≥ 3× `CLUSTER_HEARTBEAT_MS`.

3. **Check peer status.** Call `getStatus()` on each node to see which peers are marked unreachable:
   ```
   GET /api/cluster/status
   ```

4. **Wait for automatic recovery.** The election watch (`_startElectionWatch`) will automatically re-elect a leader once quorum is restored. Monitor for `LEADER_ELECTED` events.

5. **If the partition persists**, investigate network infrastructure: VPC routing, security groups, overlay network health, or DNS resolution for peer hostnames.

6. **After recovery**, verify all nodes have the same active key fingerprint:
   ```
   GET /api/cluster/status
   ```
   If fingerprints diverge, the stale nodes will reject the leader's next `KEY_COMMIT` as `stale_commit` and sync to the leader's state.

---

## MEDIUM: `QUANTUM_DEGRADE_REJECTED`

**Meaning:** A hybrid KEM (ML-KEM-768 + X25519) handshake failed, and the system rejected fallback to classical-only key exchange. The connection was destroyed.

**Source:** `cluster-keyring-sync.cjs:520` — `_recordEvent(EVENT_TYPES.QUANTUM_DEGRADE_REJECTED, NODE_ID, { peer, error })`

### Triage Steps

1. **Check the error message.** Common causes:
   - Peer does not support ML-KEM-768 (software version mismatch)
   - Handshake timeout (network latency > 15s)
   - Invalid KEM public key (corrupted or malformed)

2. **Verify peer software version.** Both nodes must have `CLUSTER_QUANTUM_HYBRID=1` and support the same KEM algorithm. Upgrade lagging nodes.

3. **If `QUANTUM_DEGRADE_ALLOWED=1` is set**, the system would have fallen back to classical-only. This is **not recommended** in production as it defeats post-quantum security. Verify this env var is unset or `0`.

4. **Retry the connection.** The election watch will automatically attempt reconnection on the next cycle. If the handshake continues to fail, investigate the peer's KEM key generation pipeline.

---

## Escalation Contacts

| Severity | Response Time | Escalate To |
|----------|--------------|-------------|
| CRITICAL | Immediate | On-call security engineer + engineering lead |
| HIGH | 15 minutes | On-call engineer |
| MEDIUM | 1 hour | On-call engineer (business hours) |

---

## Post-Incident Checklist

- [ ] Incident timestamp and duration recorded
- [ ] Affected nodes/enclaves identified
- [ ] Root cause determined
- [ ] Containment actions documented
- [ ] Keys rotated (if compromise confirmed)
- [ ] Audit log chain integrity verified post-resolution
- [ ] SIEM event correlation analysis completed
- [ ] Incident report filed in tracking system
- [ ] Post-mortem scheduled within 48 hours
