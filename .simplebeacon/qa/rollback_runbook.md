# Emergency Rollback Runbook — Track 11 / Staging mTLS

## When to Run

- `quantum_hybrid_rollback` event fires in `cluster-keyring-sync.queryEvents()`
- `getStatus().health.circuitPosition` flips to `open`
- SimpleBeacon gate scan returns a **critical** or **high** finding post-merge
- Backup restore validation fails after a `BackupCoordinator` operation
- Any sustained spike in `connectionDropRatePct`, `handshakeFailureRatePct`, or single-node handshake failures

## 1. Immediate Triage

1. Identify the scope:
   - Check `cluster-keyring-sync.getStatus()` on the leader node:
     - `health.circuitPosition`
     - `health.downgradeRejectedCount`
     - `health.unreachableMembers`
   - Query the unified timeline:
     ```javascript
     const events = clusterSync.queryEvents({
       eventType: 'quantum_hybrid_rollback',
       startDate: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
     });
     ```
   - If the event rate is rising, proceed to step 2.

## 2. Stop the Quantum-Hybrid Handshake

1. Disable hybrid enrollment at runtime by clearing `ENABLE_QUANTUM_HYBRID`:
   ```bash
   unset ENABLE_QUANTUM_HYBRID
   ```
2. If a feature flag exists, disable the flag.
3. Restart the affected node(s) so `quantum-hybrid-rollout.shouldEnableHybrid()` reads the updated environment.
4. Verify via `getStatus()` that `health.circuitPosition` returns to `closed` and the `quantum_hybrid_rollback` event rate drops.

## 3. Rotate the STEK / KEM Keys

1. Force a STEK rotation to invalidate any tickets issued during the incident window:
   ```javascript
   const { rotateStek } = require('./cluster-keyring-sync.cjs');
   rotateStek();
   ```
2. If the root KEM key is suspect, use the established key-rotation flow to propose a new key via `cluster-keyring-sync.proposeRotate(newKeyRaw, graceMs)`.
3. Confirm the new `stek.activeStekId` is present and the retired window covers the previous STEK.

## 4. Clear Session Resumption State

1. If Redis is available, flush the ticket nonce set:
   ```bash
   redis-cli DEL hybrid:ticket-nonces
   ```
2. If using in-memory bloom filters, restart the process to clear process-local state.
3. Validate that `validateTicket()` rejects any pre-rotation tickets.

## 5. Restore Cluster State from Backup

1. List available archives:
   ```javascript
   const { BackupCoordinator } = require('./backup-coordinator.cjs');
   const archives = await coord.listArchives();
   ```
2. Select a known-good archive and perform a dry-run restore:
   ```javascript
   const restored = await coord.restore(archiveId, { dryRun: true });
   ```
3. If the dry-run verifies, restore for real:
   ```javascript
   const restored = await coord.restore(archiveId);
   ```
4. Confirm `restored.bundle` matches expected key material and the archive checksum is valid.

## 6. Roll Back mTLS Certificates (if mTLS was the trigger)

1. Stop cluster services.
2. Restore the previous `ca/ca.crt` and per-node P12 bundles from the secure secret store.
3. Regenerate if the previous set is unavailable:
   ```bash
   node scripts/gen-staging-mtls.cjs <nodeId>
   ```
4. Restart the cluster and run the OpenSSL EKU smoke check:
   ```bash
   openssl x509 -in staging/mtls/nodes/<nodeId>/<nodeId>.crt -text -noout | grep -A1 "Extended Key Usage"
   ```

## 7. Verify Rollback

1. Full `npm test` on the rollback target.
2. `npx simplebeacon scan --full --gate` — must PASS.
3. Confirm `quantum-hybrid-rollout.checkRollback()` with current metrics returns `shouldRollback: false`.
4. Confirm `cluster-keyring-sync.getStatus()` reports all `members` as reachable and `circuitPosition: 'closed'`.
5. Smoke a fresh `BackupCoordinator.backup()` / `restore()` round-trip.

## 8. Post-Incident Documentation

1. Capture the PR or commit that introduced the issue.
2. Append the finding to `.simplebeacon/qa/software_health_report.md` (Validator artifact).
3. Do not re-deploy until the Validator signs off on the corrected branch.
