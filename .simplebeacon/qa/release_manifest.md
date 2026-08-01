# Unified Production Release Configuration — Track 11 + Staging mTLS

## Merge Order

1. **PR #96 — `feature/staging-mtls`** (Staging mTLS orchestration key generator)
   - Smaller, isolated surface; no runtime impact until keys are generated.
   - Provides the certificate tooling needed before the cluster mesh can be activated.

2. **PR #95 — `feature/hybrid-kem-resumption`** (Track 11: Core Systems Integration)
   - Contains the cryptographic handshake, resumption, telemetry, and backup integration.
   - Must merge second so the mTLS toolkit is already available for cluster deployment.

## Pre-Deploy Gates

For each PR, the Validator must report:

- [ ] `node -c` on every changed `.cjs` file — PASS
- [ ] `npm test` in `ai-platform/` — all suites green
- [ ] `npx simplebeacon scan --full --gate` — PASS with 0 critical / 0 high / 0 medium
- [ ] No unresolved `software_health_report.md` defects
- [ ] PR branch rebased on latest `main` and merge conflicts resolved

## Certificate Provisioning Steps

1. After PR #96 lands, check out `main` and pull.
2. Generate staging certificates:
   ```bash
   cd ai-platform
   node scripts/gen-staging-mtls.cjs node-1 node-2 node-3
   ```
3. Distribute `ca/ca.crt` + per-node `*.p12` bundles to the secure secret store.
4. Mount `ca/ca.crt` and the matching node bundle on each cluster host under `/etc/sb-certs/` (or container equivalent).
5. Set environment variables:
   - `SB_MTLS_CA_PATH=/etc/sb-certs/ca.crt`
   - `SB_MTLS_P12_PATH=/etc/sb-certs/<node>.p12`

## Cluster Rollout Steps

1. Start Redis/Valkey with or without RedisBloom, depending on environment.
2. Start cluster nodes with `CLUSTER_NODES` and `NODE_ID` set.
3. Verify `cluster-keyring-sync.getStatus()` returns:
   - `stek.activeStekId` present
   - `members` reachable
   - `health.circuitPosition` = `closed`
4. Trigger a sample `BackupCoordinator` backup and confirm `BACKUP_CREATED` event in `queryEvents`.
5. Run `quantum-hybrid-rollout.checkRollback()` with synthetic metrics and confirm `quantum_hybrid_rollback` is emitted on threshold breach.

## RedisBloom Adversarial Checks

Execute the exact matrix appended to PR #95:
1. Native `BF.INFO` auto-detection
2. Plain-Redis set-fallback with `AUDIT_PERSISTENCE_FAILURE`
3. 600-second TTL boundary eviction

## Rollback Triggers

- `health.circuitPosition` flips to `open`
- `quantum_hybrid_rollback` event fires
- `queryEvents` shows `BACKUP_IMMUTABLE` where mutability was expected
- Any critical/high finding from SimpleBeacon gate scan post-merge

## Post-Deploy Smoke

- Full `npm test` on the merged `main` branch
- `node scripts/gen-staging-mtls.cjs smoke-node` and verify `openssl x509 -in staging/mtls/nodes/smoke-node/smoke-node.crt -text -noout` shows `Extended Key Usage: TLS Web Server Authentication` and `TLS Web Client Authentication` on the respective certs.
