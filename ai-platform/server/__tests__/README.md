Test notes for `server` suites
-------------------------------

Some tests in this directory run code that performs an in-process memory check using
`process.memoryUsage()` (see `server/routes/lib/flexible-analyze-roadmap.cjs`). When
running under Jest the runner and worker infrastructure add measurable RSS and heap
overhead which can cause the module-level guard to trigger during test startup.

To avoid false-positive memory-abort errors when running tests locally or in CI,
we expose the memory ceiling via the `ROADMAP_MEMORY_LIMIT_MB` environment variable.
By default the module falls back to `350` MB in production, but test runs can raise
this temporary floor to accommodate Jest's overhead.

Recommended usage (example):

```
$env:ROADMAP_MEMORY_LIMIT_MB='1024'   # PowerShell / Windows
ROADMAP_MEMORY_LIMIT_MB=1024 npm test -- --testPathPattern=flexible-analyze-roadmap
```

Notes:

- This change does NOT remove the guardrail; it only makes it configurable so tests
  can set an appropriate buffer. Keep the guard in place for production safety.
- Prefer narrowing Jest runs with `--testPathPattern` when debugging memory-sensitive
  suites to avoid global runner noise.
