# Track 10+ Engineering Roadmap

## Feature Request: Thread-Safety and Concurrency Control for `BaseHsmAdapter`

### Problem Statement

The current `SoftwareHsmAdapter` implements state management via an un-synchronized, in-memory `Map` (`this._keks`). While sufficient for the current single-threaded, sequential test suites in Track 10, this architecture introduces race conditions, state corruption, and key-overwrite risks under concurrent execution environments (e.g., highly available API workers or parallel test runners).

### Proposed Scope & Solutions

To ensure concurrency-safety in future sprints, we should evaluate two paths:

1. **In-Memory Locking (Short-term / Monolithic):** Implement an asynchronous locking mechanism (such as `async-lock` or a `Promise`-based queue) wrapper around the critical sections of `this._keks` updates during rotation and retrieval.
2. **External Atomic Store (Long-term / Distributed):** Abstract state management out of volatile memory and shift to a persistent, atomic external store (e.g., Redis with distributed locks or a cloud KMS/HSM provider).

### Definition of Done

- `BaseHsmAdapter` and its implementations are documented and verified as concurrency-safe.
- Concurrent rotation and payload encryption integration tests added to the test suite.
