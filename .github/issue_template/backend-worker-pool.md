---
name: "⚙️ Backend: Multi-Threaded Worker Pool"
about: Implement a Node.js worker thread pool to parallelize directory walks and parsing loops.
title: "[BACKEND-OPT] Scaffold Multi-Threaded File Traversal Architecture"
labels: ["backend", "performance", "sprint-4"]
assignees: []
---

## 🎯 Objective

Replace the legacy synchronous/single-threaded directory tree walker with an asynchronous, multi-threaded worker pool using native Node.js `worker_threads` to scale throughput on multi-core runner environments.

## 🛠️ Technical Specifications

- **Orchestrator Node**: Dynamically samples system topology using `os.cpus().length` and boots `N-1` background workers.
- **Task Queues**: Implements a branch distributor that feeds path subarrays to idle worker threads (breadth-first or depth-first selectable at runtime).
- **Buffer Communication**: Utilizes `SharedArrayBuffer` or transferable `ArrayBuffer` vectors to minimize JSON serialization across thread boundaries.
- **I/O Backpressure**: Centralized token-bucket or semaphore to limit concurrent open file descriptors and reduce `EMFILE` errors.
- **Error Trapping**: Defensive try/catch to gracefully isolate unreadable folders (permissions, symlink loops) without crashing the pool.

## 📈 Acceptance Criteria

- [ ] Code compiles cleanly and integrates into the existing backend server pipeline.
- [ ] Automated integration tests verify that a full scan on 50,000 files executes without memory leakage or thread starvation.
- [ ] Scanning a local directory does not encounter `EMFILE: too many open files` thresholds under high concurrency.

## 📝 Performance Benchmarks

Please attach local execution times using `console.time()` outputs below:

- Baseline Single-Threaded Time: ______ ms
- Multi-Threaded Pool (4 Cores): ______ ms

## 🔬 Implementation Notes & Hints

- Prefer re-usable worker modules (each worker receives a path list and returns a compact binary-encoded payload of findings).
- Use `worker.postMessage()` with transferable `ArrayBuffer` for large batched results to avoid copy overhead.
- Expose a feature-flagged rollout path so teams can A/B test pool size vs. throughput on CI agents.
