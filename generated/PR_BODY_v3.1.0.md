## v3.1.0 Feature Rollout
This pull request brings together the core backend and telemetry features for the v3.1.0 release wave, supported by a 103/103 parallel verification run.

### 🚀 Key Improvements
- **RFC 8785 JCS Canonicalization**: Switches ad-hoc string serialization to deterministic lexicographical sorting for zero-knowledge verifications.
- **Context Trace Propagation**: Injects distributed tracking via `x-track112-trace-id` down to background processing worker loops.
- **Durable Disk Ingestion & Purger**: Migrates streaming partitions to disk under tenant-isolated paths backed by an automated 24-hour background TTL garbage collection sweep.
- **Forensic Observation Logs**: Appends structured validation failures with full trace correlation directly to `.simplebeacon/forensic-events.log`.
