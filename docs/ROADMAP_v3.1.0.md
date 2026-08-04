# v3.1.0 Roadmap

This document sketches the planned v3.1.0 milestone and links to starter issues created for each feature.

Milestone: **v3.1.0** — https://github.com/tjp420/CascadeProjects/milestone/1

Core goals:

- **Canonicalization (security)** — Implement RFC 8785 JCS canonicalizer and harden fraud-proof canonicalization.
  - Issue: https://github.com/tjp420/CascadeProjects/issues/394

- **Track112 telemetry & endpoints** — Expand telemetry counters, request tracing, and integration tests.
  - Issue: https://github.com/tjp420/CascadeProjects/issues/395

- **Multipart upload durability** — Disk-backed session storage, incremental Merkle reassembly, and atomic commits.
  - Issue: https://github.com/tjp420/CascadeProjects/issues/396

- **WorkerPool & IngestQueue** — Non-blocking worker pool, bounded ingest queue, and concurrency benchmarks.
  - Issue: https://github.com/tjp420/CascadeProjects/issues/397

Suggested next steps:

1. Triage each issue to assign owners and estimate story points.
2. Add CI acceptance tests for canonicalization vectors and telemetry counters.
3. Schedule a 2-week spike for multipart upload durability benchmarking.
