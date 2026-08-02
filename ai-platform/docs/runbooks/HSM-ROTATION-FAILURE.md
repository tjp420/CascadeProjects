# Runbook: HSM Enclave Root Rotation & Key Derivation Failures

## 🚨 EnclaveRootRotationFailed (Critical)

1. Impact: The hardware-root key rotation cycle failed to conclude or satisfy multi-node threshold constraints, threatening epoch-drift blocks.
2. Immediate Actions:

- Inspect application trace logs for explicit engine errors:

  ```bash
  kubectl logs -l app=ai-platform --since=1h | grep -E "ERR_ROTATION_FAILED|ERR_THRESHOLD_UNMET"
  ```

- Check connection states to external Key Vault / HSM adapters to ensure API endpoints or physical cards are answering network probes.
  - `kubectl get endpoints` / verify service IPs and health checks.
- Verify target epoch signatures against current committee policy constraints.
  - Pull the rotation proposal JSON and validate signatures locally.

---

## ⚠️ EnclaveKeyDerivationLatencyHigh (Warning)

1. Impact: `crypto.hkdfSync` execution bounds are exceeding nominal SLA constraints, which can delay token generation workflows.
2. Immediate Actions:

- Check core container resource consumption to identify CPU starvation or throttling:

  ```bash
  kubectl top pods -l app=ai-platform
  kubectl describe pod <pod-name>
  ```

- Review Node diagnostic allocation profiles to ensure high-frequency GC sweeps are not blocking the event loop.
  - Capture `clinic doctor` or `clinic flame` traces for the affected pod/container if needed.

- Short-term mitigation: scale up CPU requests/limits for the affected deployment or increase replica count to spread cryptographic load.

---

## Escalation & Recovery

- If rotations continue to fail and quorum constraints cannot be met:
  1. Pause automatic rotation jobs (if enabled) and open an incident.
  2. Run a manual out-of-band rotation using an approved operator workflow.
  3. Notify security and SRE teams immediately; provide the rotation proposal, logs, and attestation artifacts.

---

## Notes

- Keep this runbook up to date with any platform changes to the HSM adapter, attestation client, or committee policy. Ensure on-call runbooks reference the latest `hsm_enclave_rotations_total` and `hsm_enclave_derivation_latency_seconds` metrics.
