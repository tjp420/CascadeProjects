# Parallelized Batch Worker Pool — Technical Specification Blueprint

> test_plan.md — Phase 1 Spec. No feature code until user approval.
> Per QA framework: Builder drafts spec → User approves → Builder implements → Validator grades.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Parallelized batch worker pool for track evaluation loops |
| Author (Builder) | Devin |
| Date | 2025-01-22 |
| Branch | (to be created on approval) |
| Packages touched | ai-platform |

## 1. Problem Statement

The current `run-all-tracks.cjs` runner executes 97 test suites **sequentially**
via `child_process.execSync`. Each suite spawns a separate Jest process, waits
for it to complete, then moves to the next. With 97 suites, total runtime is
the **sum of all suite times** — leaving CPU cores idle during I/O-bound waits.

**The gap:** No parallelization infrastructure exists. The codebase has
`Promise.all()` batching patterns (codebase-analyzer.cjs, concurrency=24) but
no true multi-process worker pool for the test runner. Node 22+ supports
`worker_threads` natively, and `child_process.fork` is available for
process-based parallelism.

**Goal:** Transition the track evaluation loop from sequential to parallelized
batch execution, maximizing throughput during dense epoch-based key rotations
while maintaining the exact same 97/97 pass/fail semantics.

## 2. Existing Infrastructure (Grounding)

### Files already in the codebase

| File | Role | Reuse potential |
|------|------|-----------------|
| `server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` | Current sequential runner (97 suites via execSync) | **Extend** — add parallel mode |
| `server/lib/codebase-analyzer.cjs` | Batch processing with `Promise.all()` concurrency=24 | **Pattern reference** — batching model |
| `server/lib/hsm-adapter/cluster-consensus-engine.cjs` | `Promise.all()` for parallel vote collection | **Pattern reference** — async concurrency |
| `ai-platform/package.json` | Node 22+ required, no worker pool deps | **Extend** — add script entry |

### Current sequential pattern (run-all-tracks.cjs)
```javascript
function runSuite(pattern) {
  const target = resolveBaseTestFile(pattern);
  try {
    const output = execSync(`npx jest ${target} --silent --coverage=false`, { ... });
    return { pattern, status: 'PASS', output };
  } catch (err) {
    return { pattern, status: 'FAIL', output: err.stdout || err.message };
  }
}
const results = SUITES.map((pattern) => runSuite(pattern)); // SEQUENTIAL
```

### codebase-analyzer.cjs batching pattern (the model)
```javascript
async function analyzeFilesInBatches(files, rootDir, options = {}) {
  const concurrency = Math.max(1, options.concurrency || 24);
  for (let offset = 0; offset < files.length; offset += concurrency) {
    const batch = files.slice(offset, offset + concurrency);
    const results = await Promise.all(batch.map((f) => analyzeFileContent(f, ...)));
    if ((offset / concurrency) % 4 === 0 && offset > 0) {
      await new Promise((resolve) => setImmediate(resolve)); // yield
    }
  }
}
```

## 3. Proposed Design (Broom Strategy — minimal new files)

### Approach: Process-based worker pool using `child_process.fork`

**Why `fork` over `worker_threads`:**
- Each suite already spawns a Jest process via `execSync` — `fork` is the
  natural parallelization of this existing pattern
- Jest processes are I/O-bound and CPU-bound; `fork` gives true process
  isolation (no shared memory concerns)
- `worker_threads` would require loading Jest inside a worker, which is
  more complex and less tested
- `fork` is already used by Jest internally for its own worker pool

**Why not a third-party library (workerpool/piscina):**
- The Broom Strategy says: no new dependencies when the built-in can do the job
- `child_process.fork` is built into Node 22+ with no installation needed
- The batching pattern from `codebase-analyzer.cjs` provides the blueprint

### 3a. New file: `server/lib/hsm-adapter/__tests__/parallel-track-runner.cjs`

**Justification for new file:** The parallel runner is a distinct concern from
the test suite list (SUITES). It manages worker processes, collects results
out-of-order, and reports progress. Keeping it separate from `run-all-tracks.cjs`
allows backward compatibility (sequential mode remains the default) and
clean separation of concerns.

**Exports:**
```javascript
module.exports = { runSuitesParallel, runSuiteInWorker };
```

**Key functions:**

```javascript
/**
 * Run test suites in parallel using a process-based worker pool.
 * @param {string[]} suites - Array of suite patterns
 * @param {object} options
 * @param {number} [options.concurrency] - Max parallel workers (default: CPU count - 1)
 * @param {boolean} [options.progress] - Print progress as suites complete
 * @param {number} [options.timeoutMs] - Per-suite timeout (default: 120000)
 * @returns {Promise<{ results: Array, totalMs: number, passed: number, failed: number }>}
 */
async function runSuitesParallel(suites, options = {}) {
  // 1. Determine concurrency (default: os.cpus().length - 1, min 2, max 16)
  // 2. Process suites in batches using Promise.all() pattern
  // 3. For each suite, fork a worker process that runs Jest
  // 4. Collect results as they complete (out-of-order)
  // 5. Print progress if enabled
  // 6. Track timing: per-suite duration, total time, throughput
  // 7. Return aggregated results
}

/**
 * Run a single suite in a forked worker process.
 * @param {string} pattern - Suite pattern
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{ pattern, status, output, durationMs }>}
 */
function runSuiteInWorker(pattern, timeoutMs) {
  // 1. Fork a child process that runs Jest for this suite
  // 2. Set up timeout handler
  // 3. Collect stdout/stderr
  // 4. Resolve with result when process exits
}
```

### 3b. New file: `server/lib/hsm-adapter/__tests__/track-worker.cjs`

**Justification:** The worker entry point for `child_process.fork`. This is
the script that the forked process executes — it receives a suite pattern,
runs Jest, and sends the result back via `process.send`.

**Structure:**
```javascript
'use strict';
const { execSync } = require('child_process');

// Worker entry point — receives { pattern, cwd } via IPC
process.on('message', (msg) => {
  const { pattern, cwd } = msg;
  const target = resolveBaseTestFile(pattern);
  const start = Date.now();
  try {
    const output = execSync(`npx jest ${target} --silent --coverage=false`, {
      cwd, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8',
      timeout: 120000,
    });
    process.send({ pattern, status: 'PASS', output, durationMs: Date.now() - start });
  } catch (err) {
    process.send({ pattern, status: 'FAIL', output: err.stdout || err.message, durationMs: Date.now() - start });
  }
  process.exit(0);
});
```

### 3c. Extend `run-all-tracks.cjs` — add parallel mode

**Changes:**
- Add `--parallel` CLI flag detection
- When `--parallel` is passed, call `runSuitesParallel()` instead of `SUITES.map()`
- Keep sequential mode as default (backward compatibility)
- Add timing output for both modes

```javascript
// Add at top
const { runSuitesParallel } = require('./parallel-track-runner.cjs');

// Add after SUITES array
const useParallel = process.argv.includes('--parallel');

if (useParallel) {
  runSuitesParallel(SUITES, { progress: true }).then(({ results, totalMs, passed, failed }) => {
    // Print results with timing
    // Exit with code 1 if any failures
  });
} else {
  // Existing sequential code
  const results = SUITES.map((pattern) => runSuite(pattern));
  // Existing summary
}
```

### 3d. Extend `package.json` — add script entry

```json
"test:parallel": "node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs --parallel"
```

### 3e. New test file: `__tests__/parallel-track-runner.test.cjs`

10 tests covering:
1. Parallel execution completes all suites
2. Results count matches input count
3. Pass/fail status correctly propagated
4. Timing metrics collected (durationMs per suite)
5. Concurrency limit respected (no more than N workers active)
6. Progress reporting works
7. Timeout handling for hung suites
8. Out-of-order result collection
9. Sequential mode still works (backward compat)
10. Throughput improvement (parallel faster than sequential)

## 4. Parallel Execution Flow

```
run-all-tracks.cjs --parallel
  │
  ├─ Parse SUITES array (97 patterns)
  ├─ Determine concurrency (default: os.cpus().length - 1)
  │
  ↓
parallel-track-runner.cjs :: runSuitesParallel(suites, { concurrency })
  │
  ├─ Batch 1: suites[0..N-1] → fork N workers
  │   ├─ Worker 1: track-worker.cjs → jest suite-1 → { PASS, 523ms }
  │   ├─ Worker 2: track-worker.cjs → jest suite-2 → { PASS, 412ms }
  │   ├─ ...
  │   └─ Worker N: track-worker.cjs → jest suite-N → { PASS, 689ms }
  │
  ├─ Promise.all(batch) → collect results as they complete
  ├─ Print progress: "Completed 16/97 suites (16 PASS, 0 FAIL)..."
  │
  ├─ Batch 2: suites[N..2N-1] → fork N workers
  ├─ ...
  │
  └─ All batches complete → aggregate results
      │
      ├─ Print summary: "Total: 97 | Passed: 97 | Failed: 0 | Time: 12.3s"
      ├─ Print throughput: "7.9 suites/second"
      └─ Exit with code 0 (or 1 if any failures)
```

## 5. Concurrency Model

### Default concurrency
```javascript
const os = require('os');
const DEFAULT_CONCURRENCY = Math.max(2, Math.min(16, os.cpus().length - 1));
```

### Configurable via environment variable
```javascript
const concurrency = parseInt(process.env.TRACK_WORKER_CONCURRENCY, 10) || DEFAULT_CONCURRENCY;
```

### Batching strategy
- Process suites in batches of `concurrency` size
- Use `Promise.all()` per batch (same as codebase-analyzer.cjs)
- Yield to event loop between batches via `setImmediate`
- Fork workers via `child_process.fork` (not `execSync`)

### Resource bounds
- Max concurrency: 16 (prevents resource exhaustion)
- Min concurrency: 2 (always parallel)
- Per-suite timeout: 120000ms (2 minutes)
- Max worker memory: inherited from parent (Node default)

## 6. Files in scope

### New files (3)
- `server/lib/hsm-adapter/__tests__/parallel-track-runner.cjs` — worker pool orchestrator
- `server/lib/hsm-adapter/__tests__/track-worker.cjs` — worker entry point
- `server/lib/hsm-adapter/__tests__/parallel-track-runner.test.cjs` — 10-test spec

### Extended files (2)
- `server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` — add `--parallel` flag
- `ai-platform/package.json` — add `test:parallel` script

### NOT touched
- All 97 test suite files (unchanged)
- All primitive gate files (unchanged)
- All cluster sync files (unchanged)
- No new dependencies added

## 7. APIs / routes

No REST API changes. The parallel runner is invoked via:
```bash
# Parallel mode
node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs --parallel

# Sequential mode (default, backward compatible)
node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs

# Via npm script
npm run test:parallel

# With custom concurrency
TRACK_WORKER_CONCURRENCY=8 node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs --parallel
```

## 8. UI / IDE surfaces

- [ ] Not applicable — CLI-only tool

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new .cjs files | `node -c` on parallel-track-runner.cjs, track-worker.cjs | [ ] |
| L1-02 | Syntax on new test file | `node -c parallel-track-runner.test.cjs` | [ ] |
| L1-03 | Syntax on extended run-all-tracks.cjs | `node -c run-all-tracks.cjs` | [ ] |
| L1-04 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-07 | Sequential mode still works | `node run-all-tracks.cjs` (no --parallel flag) | [ ] |
| L1-08 | Parallel mode works | `node run-all-tracks.cjs --parallel` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Parallel execution completes all suites | Run `--parallel` with 97 suites | All 97 results returned, 0 failures | [ ] |
| L2-02 | Pass/fail status correctly propagated | Run with known-passing suites | All status='PASS' | [ ] |
| L2-03 | Timing metrics collected | Check result objects | Each has `durationMs > 0` | [ ] |
| L2-04 | Progress reporting works | Run with `progress: true` | Progress lines printed during execution | [ ] |
| L2-05 | Sequential mode backward compat | Run without `--parallel` | Same behavior as before (97/97 pass) | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Concurrency limit respected | Monitor active workers | Never exceeds configured concurrency | [ ] |
| L3-02 | Timeout on hung suite | Set timeoutMs=1000, run a slow suite | Status='FAIL' with timeout error | [ ] |
| L3-03 | Out-of-order completion | Suites complete in different order than input | Results collected correctly regardless of order | [ ] |
| L3-04 | Custom concurrency via env var | `TRACK_WORKER_CONCURRENCY=4` | Uses 4 workers | [ ] |
| L3-05 | Empty suites array | Pass `[]` to runSuitesParallel | Returns empty results, no crash | [ ] |
| L3-06 | Single suite | Pass 1-element array | Completes without error | [ ] |
| L3-07 | Throughput improvement | Compare parallel vs sequential time | Parallel is faster (suites/sec higher) | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Worker processes inherit parent's environment (no secret injection) | [ ] |
| S-03 | Worker processes exit after completing (no zombie processes) | [ ] |

---

## Error Codes

| Code | Meaning |
|------|---------|
| WORKER_TIMEOUT | Worker process exceeded timeoutMs |
| WORKER_CRASHED | Worker process exited with non-zero code (not from Jest) |
| WORKER_SPAWN_FAILED | Failed to fork worker process |
| SUITE_NOT_FOUND | resolveBaseTestFile returned null for pattern |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________

---

## Implementation Notes (for Builder phase)

1. **Follow the Broom Strategy:** 3 new files + 2 extended files. No new
   dependencies. Use only Node built-ins (`child_process.fork`, `os`, `crypto`).
2. **Model after codebase-analyzer.cjs:** Use the same `Promise.all()` batching
   pattern with `setImmediate` yields between batches.
3. **Backward compatibility first:** The default mode (no `--parallel` flag)
   must remain sequential. Parallel is opt-in.
4. **Process isolation:** Each worker runs in its own process via `fork`.
   No shared memory. Results sent via IPC (`process.send`).
5. **Clean shutdown:** Workers must exit after completing. Parent must
   handle `SIGINT`/`SIGTERM` to kill all active workers.
6. **Verify after each step:** `node -c` after every file change.
