# Test Plan: AST Remediator Engine

## Objective
Build a deterministic (non-LLM) AST remediator engine that generates safe rewrite diffs for Python and Go structural slop patterns detected by the existing AST scanners. The engine runs as a first-pass before the LLM-based `local-remediation.js` fallback, enabling instant fixes without network calls or model dependencies.

## Scope

### In Scope
- New module: `src/lib/ast-remediator.js`
- Deterministic fix generators for patterns:
  - **SB-PY-FICTION-002** / **SB-GO-FICTION-002**: Stub functions → add `raise NotImplementedError("Implement: <funcname>")` / `panic("implement: <funcname>")`
  - **SB-PY-TB-001** / **SB-JS-TB-001**: LLM calls without token limits → inject `max_tokens=4096` kwarg
  - **SB-PY-REDUNDANCY-002**: Redundant try/except wrappers → unwrap single-statement try/except
  - **SB-GO-REDUNDANCY-002**: Repeated error handling → suggest centralized handler
  - **SB-JS-FICTION-002**: JS stub functions → add `throw new Error('Implement: <funcname>')`
  - **SB-JS-SQL-001**: SQL injection via template literal → convert to parameterized query
- CLI flag: `--fix-engine deterministic|llm|auto` (default: `auto` = deterministic first, then LLM)
- Integration with existing `--fix` and `--fix-dry-run` flags

### Out of Scope
- Python runtime AST rewriting (we generate search/replace text patches, not AST transforms)
- Go toolchain-based parsing (we use text-based pattern matching aligned with the existing Go scanner)
- Multi-file refactors (single-file patches only)

## Test Matrix

| ID | Description | Command | Expected | Level |
|----|-------------|---------|----------|-------|
| L1-01 | Module loads without error | `node -c src/lib/ast-remediator.js` | Exit 0 | L1 |
| L1-02 | CLI syntax check | `node -c bin/simplebeacon.js` | Exit 0 | L1 |
| L1-03 | Gate scan regression | `npx simplebeacon scan --full --gate` | Gate PASS | L1 |
| L1-04 | Fix engine: stub function (Python) | Create temp .py file with stub, run `scan --fix --fix-engine deterministic --fix-dry-run` | Diff shown with NotImplementedError | L1 |
| L1-05 | Fix engine: stub function (JS) | Create temp .js file with stub, run `scan --fix --fix-engine deterministic --fix-dry-run` | Diff shown with throw Error | L1 |
| L1-06 | Fix engine: token bleed (JS) | Create temp .js with LLM call missing max_tokens, run dry-run fix | Diff shown with max_tokens added | L1 |
| L1-07 | Fix engine: auto mode | Run `scan --fix --fix-dry-run` without --fix-engine | Deterministic fixes attempted first | L1 |
| L1-08 | Fix engine: llm-only mode | Run `scan --fix --fix-engine llm --fix-dry-run` | Only LLM remediation runs | L1 |
| L1-09 | Fix engine: unknown pattern | Finding with no deterministic fix generator | Falls through to LLM or skips | L1 |
| L1-10 | Help text shows --fix-engine | `simplebeacon scan --help` | Shows --fix-engine flag | L1 |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/ast-remediator.js` | Create | Deterministic fix generators |
| `bin/simplebeacon.js` | Modify | Add --fix-engine flag, wire deterministic engine |
| `.simplebeacon/qa/test_plan.md` | Create | This file |
