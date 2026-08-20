# Release Verification Checklist — v3.0.494

Release: v3.0.494
Tag: `v3.0.494` (commit dec915963a9d56fb7a3165570a8b8171f7b07527)
Release URL: https://github.com/tjp420/CascadeProjects/releases/tag/v3.0.494

Purpose: acceptance and operational-verification checklist for the Enclave State Persistence
milestone (AES-256-GCM envelope encryption, KEK rotation + migration, EnclaveWorker scheduler,
Prometheus alerts, Alertmanager routing, Kubernetes PV examples).

How to use

- Run the checks in order. Mark items DONE and add notes for anything unexpected.
- If a blocking item fails, follow the Rollback / Mitigation steps at the end.

1. CI / Release Sanity

- [ ] Confirm GitHub Release exists and tag points to expected SHA:
  - `git ls-remote --tags origin | Select-String v3.0.494` (PowerShell)
- [ ] Verify CI run triggered for branch/tag and completed successfully:
  - `gh run list --repo tjp420/CascadeProjects --branch feature/track47-persistence`
  - `gh run watch <RUN_ID> --repo tjp420/CascadeProjects`

2. Artifact & Manifest Verification

- [ ] Confirm `deploy/k8s/pv/persistent-volume.yaml` exists in repo and contains expected StorageClass/PVC/StatefulSet snippet.
- [ ] Confirm `deploy/alertmanager/alertmanager-routing.yml` is present and integrated into production Alertmanager config or orchestration overlay.

3. Kubernetes PV + StatefulSet Smoke Tests

- Preconditions: cluster kubeconfig with appropriate RBAC access.
- [ ] Apply PV/StorageClass/PVC to staging namespace (dry-run first):
  - `kubectl apply -f deploy/k8s/pv/persistent-volume.yaml --dry-run=client -n staging`
- [ ] Create a namespaced test StatefulSet using the provided volumeMount snippet; wait for Ready:
  - `kubectl apply -f deploy/k8s/pv/examples/test-statefulset.yaml -n staging`
  - `kubectl rollout status sts/test-persistence -n staging --timeout=2m`
- [ ] Exec into pod and verify mount perms and UID/GID (should match `securityContext`):
  - `kubectl exec -it pod/test-persistence-0 -n staging -- ls -ld /data/enclave`
  - `kubectl exec -it pod/test-persistence-0 -n staging -- stat -c "%u:%g %a" /data/enclave`
  - Expected: owner `1000:1000` and permissions `0600`/`0700` as configured

4. Enclave State Persistence Sanity

- [ ] Start application pointing at staging PV and perform a persistent-write roundtrip.
  - Use the app's debug endpoint to `persistState()` and then `loadState()`.
- [ ] Validate envelope decryption: ensure dataKey unwrap via HSM adapter succeeds in logs.
  - Check `ai-platform` service logs for `unwrapKey` and `persistState` success traces.

5. KEK Rotation & Migration Checkpoint

- [ ] Trigger a dry-run of `rotateKek()` in staging (non-production):
  - Use the admin API (if available) or run a controlled invocation in a dev shell.
- [ ] Verify migration checkpoint file is created and updated during KEK rotation.
  - Check for `.simplebeacon/migration-checkpoint.json` or configured checkpoint path.
- [ ] Confirm `wrapKey`/`unwrapKey` calls succeed for both old and new KEK material.

6. EnclaveWorker Scheduler & Replication Flush

- [ ] Verify `EnclaveWorker` starts successfully and schedules `flushPendingReplications()` and `rotateKek()`.
  - Confirm scheduler logs: `scheduling flushPendingReplications` and `scheduling rotateKek` with jitter values
- [ ] Verify `flushPendingReplications()` completes without errors; check replication queue metrics.

7. Prometheus Metrics & Alerting

- [ ] Confirm metrics present in Prometheus (staging scraping):
  - `hsm_enclave_rotations_total` > 0 (after triggering a rotation)
  - `hsm_enclave_derivation_latency_seconds` histogram present
  - `enclave_worker_flush_last_timestamp_seconds` updated after flush
- [ ] Fire a test alert (non-critical) to validate Alertmanager routing, or use `amtool`:
  - `amtool check-config /etc/alertmanager/alertmanager.yml` (on Alertmanager host)
  - `amtool silence add --match='severity=warning' --duration=1h` (example checks)

8. Alertmanager Routing Verification

- [ ] Confirm `hsm-critical-security-pager` and `hsm-warning-ops-triage` receivers are configured with valid integrations.
- [ ] Trigger a simulated alert with labels `tier=hardware-security,severity=warning` and observe routing to ops triage.

9. Security & Zeroization

- [ ] Confirm intermediate unencrypted material is zeroized in memory where applicable (code audit + logs review).
- [ ] Check HSM adapter integration uses wrapping functions only; ensure no raw keys are logged.

10. Observability & Runbook Handoff

- [ ] Publish this checklist to `docs/runbooks/RELEASE-v3.0.494-CHECKLIST.md` (this file).
- [ ] Notify on-call and include links: Release URL, CI run IDs, Alertmanager config path, and SRE runbook.

Rollback / Mitigation (Blocking Failure)

- If any blocking failure occurs (encryption unwrap errors, persistent corruption, or mass alerts):
  1. Immediately create an incident and page `hsm-critical-security-pager`.
  2. Disable automated `rotateKek()` scheduling: set `ENCLAVE_WORKER_ENABLED=false` or stop the service.
  3. If corruption is suspected, restore persisted state from last known-good backup (S3/R2 or filesystem snapshot).
  4. If KEK rotation started and failed mid-migration, consult `migration-checkpoint.json` and resume or roll back using documented admin utilities.

Contacts

- Primary on-call (SRE): ops@example.com
- Crypto lead: crypto-lead@example.com
- HSM owner: hsm-admin@example.com

Notes

- Keep post-release verification notes and timestamps in the release issue or PR comment for auditability.
- If you need a runnable checklist (scripted verification), I can prepare a small `scripts/release-verify.sh` runner.

Done.
