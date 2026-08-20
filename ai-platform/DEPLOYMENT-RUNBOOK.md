# Deployment Runbook — Cryptographic & Security Boundary Configuration

**Scope:** HSM, cluster keyring sync, key rotation, SIEM, audit/compliance, PII protection, and quantum cryptographic policy environment variables.

**Last updated:** 2026-08-03
**Trunk baseline:** Tracks 26–115 (100% Jest pass, SimpleBeacon gate PASS)

---

## 1. HSM & Hardware Security Module

These variables configure the Hardware Security Module provider that backs all cryptographic key operations.

| Variable               | Default           | Description                                                                                 |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `HSM_PROVIDER`         | `mockhsm`         | HSM provider type. Production: `aws-kms`, `gcp-kms`, or `azure-kv`. Dev/test: `mockhsm`.    |
| `HSM_ENDPOINT`         | `null`            | HSM API endpoint URL. Required for cloud KMS providers.                                     |
| `HSM_ACCESS_TOKEN`     | `null`            | Authentication token/credential for HSM API access. **Secret — load from vault, not .env.** |
| `HSM_KEY_ID`           | `sb-master-key`   | Master key identifier in the HSM. Used as the root KEK for all derived keys.                |
| `HSM_PROJECT`          | `default-project` | Project/tenant namespace in the HSM.                                                        |
| `HSM_REGION`           | `us-east-1`       | Cloud region for HSM API calls.                                                             |
| `HSM_TIMEOUT_MS`       | `30000`           | HSM operation timeout in milliseconds. Fallback: `HSM_TIMEOUT` (same unit).                 |
| `HSM_MOCK_ROOT_KEY`    | `null`            | Mock HSM root key hex string (dev only). **Never set in production.**                       |
| `HSM_FAILOVER_REGIONS` | `null`            | Comma-separated list of failover regions for multi-region HSM resilience.                   |

**Production checklist:**

- [ ] `HSM_PROVIDER` is not `mockhsm`
- [ ] `HSM_ACCESS_TOKEN` loaded from secrets manager, not plaintext
- [ ] `HSM_MOCK_ROOT_KEY` is unset

---

## 2. Cluster Keyring Sync

Multi-node key rotation coordination over TCP/TLS. Controls leader election, heartbeat intervals, and the cluster keyring port.

| Variable                           | Default         | Description                                                                                                       |
| ---------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ID`                          | `os.hostname()` | Unique identifier for this node in the cluster. Must be unique across all cluster members.                        |
| `CLUSTER_NODES`                    | `""` (disabled) | Comma-separated `host:port` list of peer nodes. Example: `10.0.1.2:7000,10.0.1.3:7000`. Empty = single-node mode. |
| `CLUSTER_KEYRING_PORT`             | `7000`          | TCP port for cluster keyring sync server. Must be firewalled to trusted network only.                             |
| `CLUSTER_HEARTBEAT_MS`             | `5000`          | Heartbeat broadcast interval in milliseconds.                                                                     |
| `CLUSTER_HEARTBEAT_TIMEOUT_MS`     | `15000`         | Peer liveness timeout. Must be ≥ 3× `CLUSTER_HEARTBEAT_MS`.                                                       |
| `CLUSTER_CERT`                     | `null`          | Path to TLS certificate file for cluster transport. When set with `CLUSTER_KEY`, enables TLS.                     |
| `CLUSTER_KEY`                      | `null`          | Path to TLS private key file. **Secret — file permissions 0600.**                                                 |
| `CLUSTER_CA_CERT`                  | `null`          | Path to CA certificate for mutual TLS verification. Optional even when TLS is enabled.                            |
| `CLUSTER_QUANTUM_HYBRID`           | `0`             | Set to `1` to enforce hybrid KEM (ML-KEM-768 + X25519) handshake on cluster connections.                          |
| `CLUSTER_QUANTUM_HYBRID_DEFAULT`   | `null`          | Default quantum hybrid mode for rollout: `enabled`, `disabled`, or `canary`.                                      |
| `CLUSTER_QUANTUM_HYBRID_PERCENT`   | `null`          | Percentage of nodes (0–100) for canary quantum hybrid rollout.                                                    |
| `CLUSTER_QUANTUM_HYBRID_NODE_LIST` | `null`          | Comma-separated node IDs for targeted quantum hybrid rollout.                                                     |

**Security notes:**

- When `CLUSTER_CERT`/`CLUSTER_KEY` are unset, transport falls back to **plaintext TCP**. Only acceptable on a fully isolated/trusted network (private VPC, loopback, overlay).
- `KEY_COMMIT` frames carry raw key material (`activeHex`/`previousHex`) over this channel. Network-level isolation is mandatory.
- As of Track 116 hardening: messages from unknown peers (not in `CLUSTER_NODES`) are rejected with `ISOLATION_VIOLATION` events. `KEY_COMMIT` from non-leader nodes are rejected with `KEY_REJECT` events.
- All hex key material must be strictly lowercase `[0-9a-f]` for JCS canonicalization compliance.

**Production checklist:**

- [ ] `CLUSTER_NODES` set with all peer addresses
- [ ] `CLUSTER_CERT` and `CLUSTER_KEY` set (TLS enabled)
- [ ] Port `CLUSTER_KEYRING_PORT` firewalled to cluster VPC only
- [ ] `CLUSTER_QUANTUM_HYBRID=1` for post-quantum transport

---

## 3. Key Rotation & STEK

Controls the key rotation grace window, persistence path, rekey intervals, and Session Ticket Encryption Key (STEK) lifecycle.

| Variable                    | Default            | Description                                                                                    |
| --------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `KEY_ROTATION_GRACE_MS`     | `172800000` (48h)  | Grace period after rotation during which the previous key remains valid for decryption.        |
| `KEY_ROTATION_STORE_PATH`   | `null` (in-memory) | Filesystem path for key rotation state persistence. Must be on encrypted volume in production. |
| `REKEY_INTERVAL_SEC`        | `3600` (1h)        | Interval for hybrid KEM rekey operations in seconds.                                           |
| `STEK_ROTATION_INTERVAL_MS` | `86400000` (24h)   | STEK rotation interval. The active STEK is retired and a new one generated.                    |
| `STEK_RETIRED_WINDOW_MS`    | `7200000` (2h)     | Window during which retired STEKs remain valid for session ticket validation.                  |

**Production checklist:**

- [ ] `KEY_ROTATION_STORE_PATH` points to an encrypted volume
- [ ] `KEY_ROTATION_GRACE_MS` ≥ 24h (allows multi-node propagation)
- [ ] `STEK_RETIRED_WINDOW_MS` ≥ longest expected session lifetime

---

## 4. SIEM & Security Monitoring

Configuration for Security Information and Event Management (SIEM) integration and alert webhooks.

| Variable                  | Default | Description                                                            |
| ------------------------- | ------- | ---------------------------------------------------------------------- |
| `SIEM_ENDPOINT`           | `null`  | SIEM API endpoint URL for event export. Required for SIEM integration. |
| `SIEM_API_KEY`            | `null`  | API key for SIEM authentication. **Secret.**                           |
| `SIEM_BATCH_SIZE`         | `100`   | Number of events per batch export to SIEM.                             |
| `SIEM_FLUSH_MS`           | `5000`  | Flush interval for SIEM event export in milliseconds.                  |
| `SIEM_RETRY_BASE_MS`      | `100`   | Base delay for SIEM export retry backoff.                              |
| `SIEM_RETRY_MAX_MS`       | `60000` | Maximum delay for SIEM export retry backoff.                           |
| `SIEM_RETRY_MAX_ATTEMPTS` | `5`     | Maximum retry attempts for failed SIEM exports.                        |
| `AUDIT_SIEM`              | `false` | Set to `true` to enable SIEM integration in the audit middleware.      |
| `AUDIT_SIEM_ENDPOINT`     | `null`  | SIEM endpoint for audit middleware (separate from `SIEM_ENDPOINT`).    |
| `AUDIT_SIEM_API_KEY`      | `null`  | SIEM API key for audit middleware. **Secret.**                         |
| `ALERT_WEBHOOK`           | `null`  | Webhook URL for real-time security alerts.                             |

**Production checklist:**

- [ ] `AUDIT_SIEM=true` and `AUDIT_SIEM_ENDPOINT` set
- [ ] `SIEM_API_KEY` loaded from secrets manager
- [ ] `ALERT_WEBHOOK` points to monitored incident response channel

---

## 5. Audit & Compliance

Controls audit logging, blockchain anchoring, compliance frameworks, log healing, and query limits.

| Variable                    | Default                      | Description                                                                             |
| --------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `AUDIT_LEVEL`               | `info`                       | Audit log level: `debug`, `info`, `warn`, `error`.                                      |
| `AUDIT_LOG_FILE`            | `logs/audit.log`             | File path for audit log output.                                                         |
| `AUDIT_LOG_PATH`            | `null` (fallback to default) | Primary audit log storage path. Used by `audit-logger.cjs`.                             |
| `AUDIT_LOG_SCRUB_PII`       | `true`                       | Set to `false` to disable PII scrubbing in audit logs. **Never disable in production.** |
| `AUDIT_LOG_QUARANTINE_PATH` | `null`                       | Path for quarantined (tamper-suspect) audit log entries.                                |
| `AUDIT_LOG_QUARANTINE_DIR`  | `null`                       | Directory for quarantine log files.                                                     |
| `AUDIT_AUTH_LOGS`           | `true`                       | Set to `false` to disable authentication event logging.                                 |
| `AUDIT_BLOCKCHAIN`          | `false`                      | Set to `true` to enable blockchain anchoring of audit log hashes.                       |
| `AUDIT_ENCRYPTION`          | `true`                       | Set to `false` to disable audit log encryption. **Never disable in production.**        |
| `AUDIT_REALTIME`            | `false`                      | Set to `true` to enable real-time audit event streaming.                                |
| `AUDIT_FRAMEWORKS`          | `SOC2,ISO27001,GDPR`         | Comma-separated compliance framework identifiers.                                       |
| `AUDIT_HEAL_ENABLED`        | `true`                       | Set to `false` to disable audit log self-healing.                                       |
| `AUDIT_HEAL_INTERVAL_MS`    | `300000` (5min)              | Interval for audit log integrity healing checks.                                        |
| `AUDIT_QUERY_MAX_ROWS`      | `1000`                       | Maximum rows returned by audit event queries. Prevents memory exhaustion.               |
| `AUDIT_POLICY_PATH`         | `null` (default path)        | Path to audit policy configuration file.                                                |
| `AUDIT_NOTIFY_FROM`         | `null`                       | From address for audit notification emails.                                             |
| `AUDIT_NOTIFY_TO`           | `null`                       | Comma-separated recipient list for audit notifications.                                 |
| `ENTERPRISE_AUDIT_PATH`     | `null` (default path)        | Path for enterprise audit trail storage.                                                |
| `VIOLATION_LOG_PATH`        | `./ai-violations.log`        | Path for AI proxy violation log.                                                        |
| `COMPLIANCE_PROVIDER`       | `openai`                     | LLM provider for compliance analysis.                                                   |

**Production checklist:**

- [ ] `AUDIT_LOG_SCRUB_PII` is not `false`
- [ ] `AUDIT_ENCRYPTION` is not `false`
- [ ] `AUDIT_QUERY_MAX_ROWS` ≤ 1000
- [ ] `AUDIT_LOG_PATH` on encrypted, append-only volume
- [ ] `AUDIT_BLOCKCHAIN=true` for tamper-evident audit trail

---

## 6. PII & Data Protection

| Variable                         | Default                           | Description                                                                   |
| -------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `PII_POLICY_PATH`                | `.simplebeacon/pii-policies.json` | Path to PII policy configuration file. Defines scrubbing rules per data type. |
| `SCRUBBER_REGISTRY_MAX`          | `100`                             | Maximum number of concurrent PII scrubber instances.                          |
| `SCRUBBER_REGISTRY_TTL_MS`       | `300000` (5min)                   | TTL for scrubber registry entries.                                            |
| `SECURITY_MONITOR_SETTINGS_PATH` | `null` (default path)             | Path to security monitor settings store.                                      |
| `SUPPRESSED_FALSE_POSITIVES`     | `117`                             | Count of suppressed false positive findings in path health checks.            |

---

## 7. Quantum Cryptographic Policy

| Variable                  | Default | Description                                                                                                                                     |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `QUANTUM_DEGRADE_ALLOWED` | `0`     | Set to `1` to allow fallback from hybrid KEM to classical-only key exchange. **Not recommended in production** — defeats post-quantum security. |
| `ALLOW_BIGINT_MARKER`     | `false` | Set to `true` to allow BigInt markers in JCS canonicalization. Enable only if downstream consumers support BigInt JSON serialization.           |

**Production checklist:**

- [ ] `QUANTUM_DEGRADE_ALLOWED` is not `1`
- [ ] `ALLOW_BIGINT_MARKER` is `false` unless explicitly required

---

## Troubleshooting

### `KEY_REJECT` events in audit timeline

| Reason                         | Cause                                                                          | Resolution                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `duplicate_commit`             | KEY_COMMIT with same `rotatedAt` as already-applied commit                     | Normal — idempotency guard working as intended. No action needed.                        |
| `stale_commit`                 | KEY_COMMIT with older `rotatedAt` than current watermark                       | Check for network partition or lagging leader. Verify leader election.                   |
| `missing_or_invalid_rotatedAt` | KEY_COMMIT missing timestamp field                                             | Bug in leader node. Check leader's `proposeRotate` implementation.                       |
| `not_leader`                   | KEY_COMMIT from node that is not the current leader                            | Possible split-brain or rogue node. Check `CLUSTER_NODES` whitelist and leader election. |
| `invalid_hex_format`           | `activeHex` or `previousHex` not strictly lowercase `[0-9a-f]` or wrong length | JCS canonicalization violation. Check key serialization in leader's `proposeRotate`.     |

### `ISOLATION_VIOLATION` events

| Reason                 | Cause                                              | Resolution                                                                      |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `unknown_cluster_peer` | Message from peer not in `CLUSTER_NODES` whitelist | Check `CLUSTER_NODES` env var. Add the peer or investigate unauthorized access. |

### `ATTESTATION_EXPIRED` errors

| Cause                                                                                | Resolution                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Attestation `attestationAgeSeconds` exceeds `maxAttestationAgeSeconds` (default 60s) | Re-attest the sandbox. Check enclave clock skew. |

### `ATTESTATION_REJECTED` errors

| Cause                                         | Resolution                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Attestation client returned `verified: false` | Check attestation measurement, authority, and signature. Verify `allowedAttestationAuthorities` policy. |

### `SPLIT_BRAIN_DETECTED` events

| Cause                                 | Resolution                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Alive peer count < majority threshold | Check network connectivity between cluster nodes. Verify `CLUSTER_HEARTBEAT_TIMEOUT_MS` is sufficient for network latency. |

### SIEM export failures

| Cause                       | Resolution                                                           |
| --------------------------- | -------------------------------------------------------------------- |
| `SIEM_ENDPOINT` unreachable | Check network connectivity, firewall rules, and SIEM service status. |
| `SIEM_API_KEY` invalid      | Rotate API key in secrets manager and update `AUDIT_SIEM_API_KEY`.   |
| Batch size too large        | Reduce `SIEM_BATCH_SIZE` (default 100).                              |

---

## Environment Variable Summary (Quick Reference)

```bash
# HSM
HSM_PROVIDER=aws-kms
HSM_ENDPOINT=https://kms.us-east-1.amazonaws.com
HSM_KEY_ID=prod-master-kek
HSM_REGION=us-east-1
HSM_TIMEOUT_MS=30000
# HSM_ACCESS_TOKEN=<load from secrets manager>

# Cluster
NODE_ID=node-1
CLUSTER_NODES=10.0.1.2:7000,10.0.1.3:7000,10.0.1.4:7000
CLUSTER_KEYRING_PORT=7000
CLUSTER_HEARTBEAT_MS=5000
CLUSTER_HEARTBEAT_TIMEOUT_MS=15000
CLUSTER_CERT=/etc/ssl/cluster.crt
CLUSTER_KEY=/etc/ssl/cluster.key
CLUSTER_CA_CERT=/etc/ssl/ca.crt
CLUSTER_QUANTUM_HYBRID=1

# Key Rotation
KEY_ROTATION_GRACE_MS=172800000
KEY_ROTATION_STORE_PATH=/data/encrypted/key-rotation-state.json
REKEY_INTERVAL_SEC=3600
STEK_ROTATION_INTERVAL_MS=86400000
STEK_RETIRED_WINDOW_MS=7200000

# SIEM
AUDIT_SIEM=true
AUDIT_SIEM_ENDPOINT=https://siem.internal.company.com/api
SIEM_BATCH_SIZE=100
SIEM_FLUSH_MS=5000
ALERT_WEBHOOK=https://hooks.slack.com/services/xxx

# Audit
AUDIT_LEVEL=info
AUDIT_LOG_PATH=/data/encrypted/audit.log
AUDIT_LOG_SCRUB_PII=true
AUDIT_ENCRYPTION=true
AUDIT_BLOCKCHAIN=true
AUDIT_QUERY_MAX_ROWS=1000
AUDIT_FRAMEWORKS=SOC2,ISO27001,GDPR

# Quantum Policy
QUANTUM_DEGRADE_ALLOWED=0
ALLOW_BIGINT_MARKER=false
```
