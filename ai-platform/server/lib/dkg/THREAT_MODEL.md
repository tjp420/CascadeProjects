**DKG Proactive Refresh — Threat Model Configuration**

Scope & Objectives
- Protect: long-term master private key, per-node secret shares, ephemeral refresh randomness, and epoch transcripts used for audit.
- Maintain: confidentiality, integrity, availability (liveness) and non-repudiation of epoch operations.

Assets
- `s_i` — node-private share at epoch t.
- `r_i(x)` — ephemeral re-sharing polynomial coefficients.
- `commitments` — polynomial commitments used to verify shares.
- `epoch_transcript` — signed summary of a completed epoch.

Trust boundaries
- Trusted: Node-local protected memory/HSM, local storage of commitments and logs (protected by OS-level access controls), operator consoles.
- Untrusted: network overlay (inter-node), any external observer, potentially compromised peer nodes.

Adversary capabilities
- Capability class A — Mobile Byzantine (up to f < k comp):
  - May fully control a compromised node (read memory, respond arbitrarily, inject invalid shares, withhold messages).
  - Can escalate to break liveness by selective message drops.
- Capability class B — Network attacker:
  - Passive eavesdropping, message replay, modification, MITM unless mutualTLS is enforced.
- Capability class C — Insider/Operator misconfiguration:
  - Mis-signed audit logs, clock skew, or misconfigured epoch windows.

Threats & Mitigations
- Threat: Share leakage via memory dump of an offline node.
  - Mitigation: Proactive refresh invalidates old shares; require f < k compromised within epoch.
  - Mitigation: Enforce HSM protections; zeroize ephemeral polynomials after use.

- Threat: Malicious share injection (bad polynomial commitments).
  - Mitigation: VSS commitment checks on every received share; if verification fails, generate signed accusation and exclude node from epoch.
  - Mitigation: Multi-round complaint protocol: accused node either provides opening/proof or is evicted after threshold of peers sign the accusation.

- Threat: Replay and MITM of REFRESH messages.
  - Mitigation: Per-message epoch-nonce, sequence numbers, and mutualTLS + AEAD. Require signatures on encrypted payload headers.

- Threat: Denial-of-Service by selective withholding.
  - Mitigation: Timeouts, progressive backoff, and fallback quorum: if more than `max_faults` are detected, pause epoch and alert operators; optionally proceed with reconfiguration excluding repeatedly faulty nodes using a reconfiguration vote (requires careful social process).

Fault handling policies (options)
1. Conservative (Default): Immediate accusation and operator alert. Do not evict automatically; require operator-assisted reconfiguration. Pros: safest against false eviction. Cons: manual overhead, slower recovery.
2. Semi-Automated: Automatic multi-round reconciliation: on first verification failure, broadcast ACCUSATION and request evidence; if accused fails to respond or provides invalid proof within two sub-rounds, peers sign an eviction transcript and the node is removed from the epoch (but not from cluster membership). Pros: faster recovery. Cons: risk of false-positive eviction due to network partition.
3. Aggressive Auto-Evict: Immediately exclude any node that fails VSS checks (fast but risky in flakey networks). Use only in tightly-controlled datacenter deployments.

Logging & Forensics
- Maintain append-only epoch transcripts with signatures and timestamps.
- Persist accusations with evidence in secure audit store; rotate access keys and require dual-signer retrieval for forensic export.

Testing & CI
- Unit tests: polynomial arithmetic, commitment verification, serialization.
- Integration: simulated n-node networks with Byzantine behaviour and network partitions; verify confidentiality and liveness invariants under f < k compromises.
- Fuzz: deterministic DRBG seeded tests to reproduce failures.

Deployment notes
- Use operator-configurable parameters: `epoch_window_seconds`, `max_retries`, `complaint_rounds`, `eviction_threshold`.
- Integrate with `hsm-adapter` when present; otherwise ensure secure in-memory key handling and immediate zeroization.

Appendix — Quick checklist for reviewers
- Confirm VSS scheme choice (Pedersen vs Feldman) and pairing requirement (BLS).
- Confirm HSM integration plan and key zeroization guarantees.
- Decide fault-handling policy default (Conservative/Semi-Auto/Aggressive).
- Add Prometheus metrics and epoch transcript retention policy.
