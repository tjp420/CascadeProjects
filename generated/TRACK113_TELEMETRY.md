## Track 113 — Telemetry & Observability

**Scope:** Ratchet rotation counters, handshake latency histograms, forensic events.

**Tasks:**

- Instrument ratchet rotations with low-cardinality counters
- Add histograms for handshake latencies (p50/p95/p99)
- Emit sparse forensic events on signature/handshake failures linked to trace ids
- Dashboard panels and alerts for growth/latency regressions

**Acceptance:** Metrics and forensic events available; dashboard shows rotation and latency graphs.

Related: Master issue #404
