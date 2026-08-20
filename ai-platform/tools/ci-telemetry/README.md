CI Telemetry - Jest Results Parser

This small utility parses Jest JSON output (use `--json --outputFile=...`) and emits:

- `ci-test-summary.json` — structured summary with test counts and per-file runtimes
- `ci-test-metrics.prom` — Prometheus text exposition with basic gauges for total tests, passed/failed, run time, and per-file runtime

Usage (example in CI):

```bash
# Run Jest and output JSON
npx jest --json --outputFile=ai-platform/test-results/jest-results.json --config=ai-platform/jest.cjs --runInBand --rootDir=ai-platform

# Parse results
node ai-platform/tools/ci-telemetry/parse-jest-results.cjs ai-platform/test-results/jest-results.json ai-platform/test-results/

# Upload artifact or push metrics to your telemetry endpoint
# e.g., upload ci-test-metrics.prom as an artifact or ship to a Prometheus pushgateway
```

Integration guidance:

- Add a step after your test run in the relevant workflow (e.g., `ai-platform/.github/workflows/health-tests.yml`) to run this parser.
- Upload the generated files with `actions/upload-artifact@v4` or post to an internal telemetry endpoint.
