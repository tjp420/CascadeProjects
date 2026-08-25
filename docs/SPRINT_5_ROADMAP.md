# ⚙️ Sprint 5 Backend Optimization Roadmap: High-Velocity Scaling

Building upon the 462ms/10k files memory-mapped worker pool prototype validated in Sprint 4, this milestone details how we will scale the core directory walker engine to handle 100,000+ files with sub-second latency.

## 🧠 Core Pillar 1: Zero-Copy Shared Memory Expansion

Passing strings or JSON across thread boundaries introduces heavy memory allocation and garbage collection overhead during massive tree walks.

- **Path ID Interning Table**: Implement an integer-indexed lookup map. Filenames and paths are registered once into a shared string-pool index, allowing worker threads to pass lightweight integers instead of raw path strings.
- **Bit-Packed Finding Vectors**: Encode security scan metadata (Severity, Category, Line Number) into fixed-width bit patterns inside a shared `Int32Array` buffer. The main orchestrator thread reads finding counts atomically without string decoding costs.

## 🌊 Core Pillar 2: Dynamic Backpressure & I/O Guards

When scraping heavy or deep file trees, concurrent thread execution can hit system file-descriptor limits or starve slower disks.

- **Sliding-Window Batch Allocator**: Implement an adaptive task-slicing engine that measures disk seek times. The orchestrator will dynamically scale task batch sizes up for fast local NVMe drives and down for slow network-attached mounts.
- **EMFILE Token Bucket Queue**: Wrap disk read boundaries (`fs.statSync`, `fs.readFileSync`) in an atomic token-bucket semaphore to actively prevent `EMFILE: too many open files` errors under maximum core utilization.

## 📊 Core Pillar 3: Scale Benchmarking Automation

- **100k-Node Scheduled Scale Shootout**: Expand our current `backend-bench.yml` framework into a nightly cron-job that tests the worker pool against heavy, synthetic file arrays (100k+ files).
- **V8 Performance Artifacts**: Save precise V8 heap allocations and cpu-profile logs straight into workflow run artifacts on regression breaks for immediate developer visibility.

## 🧪 Release Criteria

- End-to-end worker pool processes 100k synthetic files in under 1s on target hardware (16vCPU, NVMe).
- No `EMFILE` or file-descriptor exhaustion under sustained load.
- Memory overhead per worker stays within 128MB allocated heap.
- CI benchmark artifacts and V8 profiles produced for each regression run.

## 🚀 Implementation Phases (2-week sprints)

1. Prototype: Implement `Path ID Interning Table` and `Bit-Packed Finding Vectors`. Add unit tests for correct encoding/decoding.
2. Backpressure: Implement `Sliding-Window Batch Allocator` + `EMFILE Token Bucket Queue` and validate on mixed storage (local + NFS).
3. Benchmarks: Create `backend-bench.yml` nightly job and artifact upload for V8 traces.
4. Hardening: Fail-safe fallbacks for slow mounts, metrics, and observability dashboards.

## ✅ Quick Start Checklist for Engineers

- [ ] Add `shared-string-pool` module and expose safe register/lookup APIs.
- [ ] Replace inter-thread path passing with integer IDs in the worker task payloads.
- [ ] Implement and test bit-packed finding arrays with atomic counters.
- [ ] Add benchmark harness for synthetic 100k node runs and configure as a GitHub Action.

---

Keep this roadmap as the canonical Sprint 5 document; iterate with small PRs and attach benchmark artifacts to PRs for visibility.
