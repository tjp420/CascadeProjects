ORAM + Mixnet Integration (Scaffold)
==================================

This directory contains a minimal scaffold for integration testing between the Mixnet
batching layer and the Path ORAM block retrieval layer.

Goals
- Verify that Mixnet-shuffled packets can be transformed into fixed-size ORAM fetch
  batches (batch size = 16) with deterministic dummy padding.
- Provide a test harness to iterate on the concurrent ORAM path traversal implementation.

Files
- `oram_mixnet_system.test.cjs` — Jest scaffolded integration tests (simple assertions).
- `../../server/lib/oram/interop.cjs` — Interop module skeleton with `processMixnetBatch`,
  `quantizeQueue`, and `executeCoordinatedFetch` functions.

How to run locally
-------------------

Install dependencies and run the integration test:

```bash
npm ci
npx jest ai-platform/tests/integration/oram_mixnet_system.test.cjs --runInBand
```

Next steps
- Replace `executeCoordinatedFetch` stub with real `PathORAM` batch traversal APIs.
- Add concurrent bucket locking and a verification test for concurrent reads/writes.
