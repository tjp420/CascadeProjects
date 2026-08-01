# test_plan.md

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 5: Advanced Defense Automation — IP/Subnet Throttling for Cluster Admin Endpoints |
| Author (Builder) | Devin |
| Date | 2026-07-31 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/admin-throttle.cjs` (new — token-bucket + Redis backend)
- `ai-platform/server/middleware/admin-throttle.cjs` (new — Express middleware)
- `ai-platform/server/lib/cluster-keyring-sync.cjs` (emit/advertise 423 / isolation / hsm_timeout events)
- `ai-platform/server/lib/hsm-vault.cjs` (emit throttling-relevant events)
- `ai-platform/server/routes/audit-routes.cjs` and `ai-platform/server/routes/hsm-vault-routes.cjs` (attach throttle)
- `ai-platform/server/lib/__tests__/admin-throttle.test.cjs` (new)
- `ai-platform/docs/ARCHITECTURE.md` (Track 5 ledger update)

### APIs / routes

- `PUT /api/audit/partition-config`
- `POST /api/audit/rotate`
- `POST /api/vault/rotate`
- `POST /api/vault/failover`
- Any other `admin:all` cluster/HSM routes identified during implementation

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **Token bucket defaults:** Capacity 20 tokens, leak rate 5 tokens/second. This allows a short burst of admin clicks/retries then caps at a safe 5 req/s. Configurable via `ADMIN_THROTTLE_CAPACITY` and `ADMIN_THROTTLE_LEAK_RATE`.
- **Redis fallback on connection failure:** Inherit the current token count; do not reset to a full bucket. If Redis is unavailable, the in-memory fallback takes over with the last known count. If the count cannot be determined (cold start without Redis), it starts from a reduced safety reserve (25% of capacity) to avoid opening the floodgates. This keeps the throttle fail-closed.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Admin throttle tests pass | `cd ai-platform && npx jest --config jest.config.cjs admin-throttle` | [ ] |
| L1-03 | Existing cluster / HSM tests still pass | `cd ai-platform && npx jest --config jest.config.cjs cluster-keyring-sync && npx jest --config jest.config.cjs hsm-vault` | [ ] |
| L1-04 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Repeated `423 Locked` rejections from one IP trigger a throttle | Simulate 10 `423` responses from a single IP in one second | IP is added to the throttle list; subsequent admin requests from that IP return `429` with code `admin_throttled` | [ ] |
| L2-02 | Request volume spike triggers a throttle | Simulate more than 20 admin requests per second from one IP | `429` returned and a `throttle_triggered` event recorded | [ ] |
| L2-03 | Repeated `isolation_violation` / `hsm_timeout` events trigger a throttle | Simulate 10 such events from one IP | Admin requests from that IP return `429` with code `admin_throttled` | [ ] |
| L2-04 | Token bucket allows steady traffic under limit | Send 5 req/s from a new IP | All requests succeed (return their normal status, not `429`) | [ ] |
| L2-05 | Redis failure falls back to in-memory with inherited count | Run a bucket with Redis; cut Redis; request again | In-memory fallback uses the last known token count, not a full bucket | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Throttled IP still has access to non-admin routes | Request a public or non-admin route from a throttled IP | Request succeeds | [ ] |
| L3-02 | Throttle recovers when Redis returns | Restart Redis after a failure | Token bucket syncs and resumes accurate limits | [ ] |
| L3-03 | Subnet throttling works for IPv4 /24 | Spikes from multiple IPs in the same /24 | Whole /24 is throttled | [ ] |
| L3-04 | IPv6 /64 throttling is stable | Spikes from multiple hosts in the same /64 | Whole /64 is throttled consistently | [ ] |
| L3-05 | Default capacity and leak rate are applied | Do not set `ADMIN_THROTTLE_CAPACITY` or `ADMIN_THROTTLE_LEAK_RATE` | Bucket uses capacity 20, leak 5 tokens/second | [ ] |
| L3-06 | Redis failure does not grant a full bucket | Kill Redis on a near-empty bucket | Fallback starts from inherited count (or 25% reserve if unknown), not full capacity | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Throttle decisions never leak internal state (e.g., exact token counts) | [ ] |
| S-02 | Redis failure does not reset the bucket to full (fail-closed) | [ ] |
| S-03 | Throttle events do not persist raw client IPs (use hash/subnet prefix only) | [ ] |
| S-04 | Admin endpoints still require authentication before the throttle is evaluated | [ ] |

---

## Approval

- [ ] User approved via question selections or "implement the plan"
