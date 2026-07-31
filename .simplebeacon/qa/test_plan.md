# Test Plan: Real-Time Token-Throttling Backpressure Mesh

> A reactive gateway queue that tracks per-provider, per-organization token-per-minute (TPM) and request-per-minute (RPM) consumption, smoothing or delaying requests when external LLM providers would be rate-limited.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Real-Time Token-Throttling Backpressure Mesh |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform |

## Scope

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/server/lib/token-throttle-mesh.cjs` | Core backpressure store: tracks per (orgId, provider) TPM/RPM windows, queues blocked requests, exposes `throttleRequest` |
| `ai-platform/server/lib/token-throttle-mesh.test.cjs` | Jest tests for rate-limit detection, queueing, delay, and configuration |
| `ai-platform/server/routes/token-throttle-routes.cjs` | REST endpoints for status and configuration |
| `ai-platform/server/index.cjs` | Mount `/api/token-throttle` router |
| `ai-platform/server/services/cloud-inference-service.cjs` | Integrate `tokenThrottle.throttleRequest` before external provider calls |

### APIs / routes

- `GET /api/token-throttle/status?orgId=<orgId>&provider=<provider>` — returns current window usage, limits, queue depth, and next available slot
- `POST /api/token-throttle/configure` — body `{ orgId, provider, rpm, tpm }` to set or update limits; `0` disables throttling
- `POST /api/token-throttle/reset` — body `{ orgId, provider }` to clear window and queue

### Throttling model

- Sliding 60-second windows per `(orgId, provider)`.
- `rpm` and `tpm` limits default to environment variables `DEFAULT_LLM_RPM` and `DEFAULT_LLM_TPM` or `0` (disabled).
- A request with `estimatedTokens` is allowed if `currentRpm < rpm` and `currentTpm + estimatedTokens <= tpm`.
- If disallowed, the request is queued and delayed until the next window slot, up to `MAX_BACKPRESSURE_MS` (default 30s) after which it is rejected with `429`.
- `cloud-inference-service.cjs` calls `throttleRequest` before issuing the actual provider request; after success it records actual tokens via existing `tokenBudget.recordUsage`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new `.cjs` files | `node -c ai-platform/server/lib/token-throttle-mesh.cjs`, `node -c ai-platform/server/routes/token-throttle-routes.cjs`, `node -c ai-platform/server/index.cjs` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | npm audit (no package.json changes expected) | `npm audit` in touched package roots | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Request under RPM/TPM limit | `throttleRequest({ orgId: 'org-a', provider: 'openai', estimatedTokens: 100 }, fn)` with limits 10 rpm / 1000 tpm | `fn` is called immediately and resolves | [ ] |
| L2-02 | RPM limit blocks subsequent requests | Issue 11 requests at 10 rpm | 11th is delayed or queued | [ ] |
| L2-03 | TPM limit blocks oversized request | `estimatedTokens` 900 with limit 1000 after 200 tokens consumed | Request is delayed | [ ] |
| L2-04 | Status endpoint reflects live windows | `GET /api/token-throttle/status?orgId=org-a&provider=openai` after a request | Returns `currentRpm`, `currentTpm`, `limitRpm`, `limitTpm` | [ ] |
| L2-05 | Configure endpoint updates limits | `POST .../configure` then check status | Limits updated | [ ] |

---

## Level 3 — Edge cases & security

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Throttling disabled (limits 0) | All requests pass through | [ ] |
| L3-02 | Timeout > MAX_BACKPRESSURE_MS | Rejected with `retryAfterMs` | [ ] |
| L3-03 | Different orgs/providers isolated | Limits of `org-a/openai` do not affect `org-b/openai` or `org-a/anthropic` | [ ] |
| L3-04 | Concurrent requests race | Window counts are consistent with sequential ordering | [ ] |
| L3-05 | Reset clears state | `POST /reset` zeroes windows and queue | [ ] |
| L3-06 | `estimatedTokens` missing or negative | Treated as 1 token, not rejected | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw request content stored in the throttle queue | [ ] |
| S-02 | Configure endpoint requires admin permission | [ ] |
| S-03 | Status endpoint only exposes counts, not content | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
