# AI Analyzer Evaluation Fixtures (Phase 1.2 MVP)

Deterministic JSON fixtures under `tests/fixtures/ai-analyzer-eval/` validate the 10 implemented analyzers with non-empty input and `data_analyzed > 0`.

## Layout

| Category folder | Analyzers |
|---|---|
| `technical-ai-issues/` | A-01, A-02, A-03, A-04, A-05, A-06 |
| `everyday-reliability/` | A-23, A-48 |
| `everyday-trust-safety/` | A-39 |
| `everyday-integration/` | A-46 |

`manifest.json` lists all fixture files for `test.each` in `tests/unit/ai-systems-issue-analyzer.test.js`.

## Running

```bash
npm test -- tests/unit/ai-systems-issue-analyzer.test.js --forceExit
```

## Adding a fixture

1. Add `tests/fixtures/ai-analyzer-eval/<category>/a-XX-<slug>.json` with `{ issueId, category, context }`.
2. Register the file in `manifest.json`.
3. Ensure the fixture context includes the fields expected by `collectAnalyzerInputs()` for that analyzer.

## Data pipeline notes

- `collectAnalyzerInputs()` maps shared `responseText`, `codeText`, and `logs` to every implemented analyzer.
- `buildAiSystemsIssueAnalysis()` always merges flat or nested `context` before per-analyzer overrides.
- `runAllAnalyzers(context)` runs all implemented issue IDs with the same shared context.
