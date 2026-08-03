VDF Time-Lock Module - Architecture

Design goals
- Provide verifiable delay functions (VDFs) to produce time-locked proofs for epoch-based operations (e.g., DKG refresh anchors, sequential randomness).
- Use a Wesolowski-style VDF for short proof sizes and fast verification.
- Run sequential squaring (or repeated group exponentiation) inside an async worker thread pool; fallback to synchronous loop when worker threads unavailable.
- Expose a simple API: `generateTimeLock(options)`, `verifyTimeLock(proof, params)` and `submitTask(payload)` for background scheduling.

Components
- `protocol.cjs` — high-level API and parameter validation.
- `worker.cjs` — worker-thread harness to run sequential iterations and produce proofs.
- `utils.cjs` — helpers for big-integer math, hashing, and parameter derivation (HKDF seeding).
- `transport.cjs` — optional broadcast / storage helpers for publishing proofs to peers or audit logs.
- `__tests__` — unit tests for generation and verification (fast, low-L iterations for CI).

Security notes
- Use strong prime groups (P-256/BN or class groups) when available. This initial scaffold uses modular exponentiation in a safe prime group as a placeholder; replace with a dedicated VDF library (e.g., `vdf-wesolowski` or native C bindings) for production.
- Never reuse the same `seed`+`difficulty` pair for different tasks; include epoch/context in seeding.
- Keep worker tasks idempotent and record `taskId` in persistent store when used across restarts.

Operational notes
- Default to `useWorkers: true` and `threadPoolSize: Math.max(1, require('os').cpus().length - 1)`.
- For CI/tests use small `difficulty` values (e.g., 100..1000) so runs are fast.