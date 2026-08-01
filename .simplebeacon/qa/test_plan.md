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

- [x] User approved Track 5 plan

---

# test_plan.md — Track 6: Quantum-Resistant KEM Hybrid Handshake

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 6: Quantum-Resistant KEM Hybrid Handshake for cluster sync |
| Author (Builder) | Devin |
| Date | 2026-07-31 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/vendor/mlkem.cjs` (new — pure-JS ML-KEM-768 primitive)
- `ai-platform/server/lib/hybrid-kem-handshake.cjs` (new — hybrid handshake state machine + HKDF combiner)
- `ai-platform/server/lib/cluster-keyring-sync.cjs` (inject hybrid wrapping before keyring replication)
- `ai-platform/server/lib/__tests__/hybrid-kem-handshake.test.cjs` (new)

### APIs / routes

- Cluster sync TLS transport between nodes
- `POST /api/cluster/keyring/...` replication endpoints (protected by hybrid-secured sockets)

## Design decisions

- **Cryptographic primitive:** ML-KEM-768 (NIST FIPS 203).
- **Fallback:** Pure-JS/Uint8Array implementation via `mlkem` package, vendored through `vendor/mlkem.cjs` until native Node crypto support stabilizes.
- **Secret combination:** `PRK = HKDF-Extract(salt="simplebeacon:hybrid:v1", IKM = ECDH_Secret || ML-KEM_Secret)`, then `SessionKeyRing = HKDF-Expand(PRK, info="session:keyring", length=32)`.
- **Downgrade protection:** Fail-closed by default. Legacy nodes that omit `EK_pq` are rejected and emit `quantum_downgrade_rejected`. `QUANTUM_DEGRADE_ALLOWED=1` permits classic-only with a `quantum_downgrade` audit event.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Hybrid KEM unit tests pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-handshake` | [ ] |
| L1-03 | Existing cluster keyring tests still pass | `cd ai-platform && npx jest --config jest.config.cjs cluster-keyring-sync` | [ ] |
| L1-04 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | ML-KEM-768 fallback executes on Node 22+ without quantum flags | Run `hybrid-kem-handshake` tests on a clean Node 22 environment | `keygen`, `encapsulate`, and `decapsulate` complete with deterministic 32-byte shared secret | [ ] |
| L2-02 | HKDF-SHA256 combiner outputs uniform 32-byte keyrings | Derive `SessionKeyRing` from random ECDH and ML-KEM secrets | Output is exactly 32 bytes and uniform across repeated runs | [ ] |
| L2-03 | Full handshake simulation over a mock TLS stream | Create client/server sockets, exchange length-prefixed JSON `EK_pq` and `C_pq`, derive shared keyring | Both sides derive identical keyring and handshake completes without hang | [ ] |
| L2-04 | Corrupted `C_pq` drops the connection | Inject malformed/corrupt ciphertext into server-side decapsulation | `decapsulate` rejects with error; peer connection is dropped | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Strict fail-closed on legacy node omission | Client omits `EK_pq` | Server terminates connection and records `quantum_downgrade_rejected` | [ ] |
| L3-02 | Permissive override allows classic-only | Set `QUANTUM_DEGRADE_ALLOWED=1`; client omits `EK_pq` | Connection stabilizes with classic-only profile and logs `quantum_downgrade` | [ ] |
| L3-03 | Hybrid handshake does not break existing cluster sync with flag disabled | Run `cluster-keyring-sync` tests without `CLUSTER_QUANTUM_HYBRID=1` | All existing tests pass | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Both classic and post-quantum shared secrets contribute to the final keyring (hybrid security) | [ ] |
| S-02 | Fail-closed by default — no silent downgrade to classic-only | [ ] |
| S-03 | Corrupted KEM material does not leak shared secret or crash the process | [ ] |
| S-04 | Audit timeline records `quantum_downgrade` and `quantum_downgrade_rejected` events | [ ] |

---

## Approval

- [x] User approved Track 6 plan

---

# test_plan.md — Track 7: Automated MitM Penetration Testing

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 7: Automated MitM penetration testing for the hybrid KEM handshake |
| Author (Builder) | Devin |
| Date | 2026-07-31 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/__tests__/hybrid-kem-mitm.test.cjs` (new)
- `ai-platform/server/lib/hybrid-kem-handshake.cjs` (read-only target of tests)
- `ai-platform/server/lib/cluster-keyring-sync.cjs` (audit event verification)

### APIs / routes

- `hybrid-kem-handshake.cjs` `createClientHandshaker` / `createServerHandshaker`
- `cluster-keyring-sync.cjs` `_recordEvent` / `queryEvents` / `EVENT_TYPES`

## Design decisions

- **Interception harness:** A mocked `EventEmitter` socket pair with a byte-level man-in-the-middle shim. The shim supports `clientToServer` and `serverToClient` mutation callbacks.
- **Fault vectors:** Public key bit-flip, ciphertext truncation, ciphertext substitution/replay, length-prefix fuzzing, full-handshake replay, forced downgrade strip, and classic-secret desync.
- **Audit verification:** Rejected/failed attacks record `quantum_downgrade_rejected` via `cluster-keyring-sync._recordEvent`; successful downgrade under `QUANTUM_DEGRADE_ALLOWED` records `quantum_downgrade`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | MitM penetration tests pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-mitm` | [ ] |
| L1-03 | Existing hybrid KEM tests still pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-handshake` | [ ] |
| L1-04 | Existing cluster keyring tests still pass | `cd ai-platform && npx jest --config jest.config.cjs cluster-keyring-sync` | [ ] |
| L1-05 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate` | [ ] |
| L1-06 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Public key bit-flip | MITM flips one byte of `clientHello.publicKey` before the server receives it | Server and client derive different `SessionKeyRing`s, or handshake rejects | [ ] |
| L2-02 | Ciphertext truncation | MITM truncates `serverResponse.cipherText` before the client receives it | Client decapsulation rejects and the handshake fails | [ ] |
| L2-03 | Ciphertext substitution | MITM replaces `serverResponse.cipherText` with a valid ciphertext from a different keypair | Client and server derive different `SessionKeyRing`s | [ ] |
| L2-04 | Length-prefix fuzzing | MITM sends a 4-byte length of zero, a huge value, or a non-JSON payload | The receiving side rejects cleanly and closes the socket without hanging | [ ] |
| L2-05 | Full-handshake replay | MITM records a valid `clientHello`+`serverResponse` and replays the `serverResponse` to a new client | New client rejects or derives a different `SessionKeyRing` | [ ] |
| L2-06 | Forced downgrade strip | MITM strips `publicKey` from `clientHello` and sets `quantumCapable: false` | Server rejects and `quantum_downgrade_rejected` is recorded | [ ] |
| L2-07 | Classic-secret desync | Client and server are given different `classicSecret` values | Both sides derive different 32-byte `SessionKeyRing`s | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Replay does not allow key reuse | A recorded `serverResponse` with the original `C_pq` cannot be used to derive the same `SessionKeyRing` on a new client | Handshake rejects or keyring mismatch | [ ] |
| L3-02 | Downgrade is not silently accepted | Even when MITM strips KEM material, `QUANTUM_DEGRADE_ALLOWED=0` means the connection fails | `quantum_downgrade_rejected` logged | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | MITM cannot force a shared keyring without controlling both KEM and classic secrets | [ ] |
| S-02 | Corrupted or replayed frames terminate the handshake and do not leak shared material | [ ] |
| S-03 | All attack rejections are visible in the `cluster-keyring-sync` audit timeline | [ ] |

---

## Approval

- [x] User approved Track 7 plan
