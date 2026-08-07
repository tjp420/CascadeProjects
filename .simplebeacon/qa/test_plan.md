# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add targeted request body logging for analyze/flexible timeout failures |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | fix/analyze-flexible-timeout-logging |
| Packages touched | ai-platform (server) |

## Scope

### Problem

When `POST /api/analyze/flexible` returns a 400 after a 30s timeout, the existing logging captures `rawPath` but does not:
1. Log the request body type (website URL vs GitHub URL vs local path)
2. Log whether the timeout was a website fetch timeout vs other failure
3. Log the analysis type and AI provider being used
4. Log anything at all in the general catch block (line 888) — errors are silently returned as 400

This makes it impossible to identify which domains or request patterns are consistently causing timeouts in production.

### Files in scope

- `ai-platform/server/routes/flexible-analyze-api.cjs` — add targeted logging at both catch blocks

### APIs / routes

- `POST /api/analyze/flexible` — enhanced error logging (no API shape change)

### UI / IDE surfaces

- N/A — backend-only logging change

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on flexible-analyze-api.cjs | `node -c ai-platform/server/routes/flexible-analyze-api.cjs` | [ ] |
| L1-02 | SimpleBeacon gate (staged files) | Pre-commit hook | [ ] |
| L1-03 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Timeout error logs request context | Trigger a website fetch timeout, inspect server logs | Log entry includes: rawPath, isWebsite flag, error message, timeout duration | [ ] |
| L2-02 | General catch block logs errors | Trigger a non-timeout error in the analysis flow, inspect logs | Log entry includes: error message, analysisType, aiProvider, rawPath | [ ] |
| L2-03 | No PII in logs | Check log output for any email, API key, or token | Only rawPath (URL/path) and metadata — no auth headers or PII | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Local path scan still works | Run analyze/flexible with a local directory | No timeout, no error logging, normal 200 response | [ ] |
| L3-02 | GitHub URL scan still works | Run analyze/flexible with a GitHub repo URL | No timeout, no error logging, normal 200 response | [ ] |
| L3-03 | Existing path validation logging preserved | Trigger a path validation error | Existing logger.warn at line 434 still fires with rawPath and allowedRoots | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs (auth headers, API keys, emails) | [ ] |
| S-02 | rawPath is the only user input logged — no full request body | [ ] |
| S-03 | No new env vars or config changes | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
