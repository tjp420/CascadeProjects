# Contributing to SimpleBeacon

Thanks for your interest in improving SimpleBeacon!

---

## Development Setup

### Prerequisites

- Node.js 16+ (LTS recommended)
- npm 8+

### Install

```bash
git clone https://github.com/tjp420/simplebeacon.git
cd simplebeacon/packages/simplebeacon-cli
npm install
```

### Verify Setup

```bash
npm test          # Run all tests
node -c src/scan.js  # Syntax check main scanner
```

---

## Project Structure

```
packages/simplebeacon-cli/
├── src/
│   ├── scan.js                  # Main scan orchestrator
│   ├── config.js                # Config loading and rule enablement
│   ├── gate.js                  # Gate evaluation logic
│   ├── index.js                 # Public API exports
│   ├── lib/                     # Shared utilities
│   ├── rules/                   # Scanner rule modules
│   └── reporters/               # Report formatters
├── tests/                       # Regression tests
├── docs/                        # Documentation
├── bin/                         # CLI entry points
└── package.json
```

---

## Workflow

1. **Create a branch** from `main`
2. **Make your change** — keep it focused
3. **Add or update tests** in `tests/`
4. **Run tests locally** with `npm test`
5. **Submit a PR** with a clear description

---

## Testing

### Run All Tests

```bash
npm test
```

### Run a Specific Test File

```bash
node --test tests/credential-pattern-scanner.test.js
```

### Run Benchmark

```bash
node scripts/benchmark-scan.js /path/to/project
```

---

## Adding a New Scanner Rule

See [RULE-AUTHORING.md](RULE-AUTHORING.md) for the full guide.

Quick checklist:

- [ ] Rule file in `src/rules/<name>-scanner.js`
- [ ] Wired into `src/scan.js` (import, scan orchestrator, result aggregation, report metrics)
- [ ] Suppression comment support (`// simplebeacon-ignore <rule-name>`)
- [ ] Test file in `tests/<name>.test.js`
- [ ] Skip dirs/files for `node_modules`, `.git`, tests
- [ ] Capped severity at `medium` for new rules (gate-safe default)

---

## Code Style

- Use CommonJS (`require` / `module.exports`)
- Prefer `async/await` over callbacks
- Add suppression comments for intentional patterns:
  ```javascript
  // simplebeacon-ignore: reason why this is safe
  ```

---

## PR Checklist

Before submitting:

- [ ] All tests pass (`npm test`)
- [ ] Syntax check passes (`node -c` on edited files)
- [ ] No new hardcoded secrets or tokens
- [ ] New rules include suppression support
- [ ] Documentation updated if needed

---

## Questions?

Open an issue on GitHub or reach out in discussions.

_Last updated: June 2026_
