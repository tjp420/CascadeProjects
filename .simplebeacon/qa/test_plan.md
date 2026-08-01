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

---

# test_plan.md — Track 8: Ephemeral Session Perfect Forward Secrecy (PFS)

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 8: Mid-stream re-keying and PFS for hybrid KEM handshake |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hybrid-kem-handshake.cjs` (enhance)
- `ai-platform/server/lib/__tests__/hybrid-kem-pfs.test.cjs` (new)
- `ai-platform/server/lib/__tests__/hybrid-kem-mitm.test.cjs` (regression)

### APIs / interfaces

- `createClientHandshaker` / `createServerHandshaker` — initial handshake with key-confirmation MAC
- `deriveRekeyRoot(prevRoot, newECDHSecret, newMLKEMSecret)` — HKDF ratchet helper
- `HybridSession` — state machine and re-key primitives

## Design decisions

- **Rotation Trigger:** Time-based interval (`REKEY_INTERVAL_SEC`, default 3600s) with optional in-band `REKEY_FORCE` administrative signal.
- **Pipeline:** In-band `REKEY_INIT` / `REKEY_RESP` / `REKEY_ACK` control frames over the existing length-prefixed JSON stream. A brief `REKEYING` suspension state queues outbound data frames and buffers/drops inbound data frames until the new key is confirmed.
- **Ratchet:** `newRoot = HKDF-Extract(salt="simplebeacon:pfs:v1", IKM = prevRoot || newECDHSecret || newMLKEMSecret)`, then `SessionKeyRing = HKDF-Expand(newRoot, info="pfs:root", L=32)`.
- **Transcript MAC:** Each handshake and re-key exchange finishes with a key-confirmation MAC (HMAC-SHA256 over the JSON transcript) to detect tampering.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Existing MitM tests still pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-mitm` | [ ] |
| L1-03 | New PFS unit tests pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-pfs` | [ ] |
| L1-04 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Initial handshake with key-confirmation MAC | Run `hybrid-kem-mitm` tests | Any bit-flip or substitution causes client to reject with MAC mismatch | [ ] |
| L2-02 | Re-key HKDF ratchet | Call `deriveRekeyRoot(prevRoot, ecdh, mlkem)` | Output is 32 bytes and deterministic; different inputs produce different outputs | [ ] |
| L2-03 | PFS re-key handshake | Initiate `REKEY_INIT`/`REKEY_RESP`/`REKEY_ACK` over mock sockets | Both sides derive the same new `sessionKey` and update `state` to `ACTIVE` | [ ] |
| L2-04 | Suspension state | Begin re-key and attempt a data write during `REKEYING` | Outbound data is queued, not sent | [ ] |
| L2-05 | MAC mismatch in `REKEY_ACK` | Tamper with `REKEY_RESP` before it reaches the initiator | Initiator rejects and tears down the connection | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Replay of a recorded `REKEY_INIT` | Re-inject a recorded `REKEY_INIT` frame into an active session | Session rejects with MAC or state error | [ ] |
| L3-02 | Forward Secrecy: leaked single ephemeral | Reveal one `ecdhSecret` or `mlkemSecret` | Prior `prevRoot` cannot be recovered from the leaked secret and transcript | [ ] |
| L3-03 | Break-in recovery from a compromised root | Compromise `prevRoot`, then perform a clean re-key with fresh secrets | New `newRoot` and `sessionKey` are independent of the compromised `prevRoot` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | A MITM cannot force the same session key by replaying old re-key frames | [ ] |
| S-02 | Compromise of a past session root does not compromise future roots | [ ] |
| S-03 | Re-keying produces an independent, 32-byte ratcheted key | [ ] |

---

## Approval

- [x] User approved Track 8 plan

---

# test_plan.md — Milestone 4: Production Rollout & Canary Verification

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Milestone 4: Promote `CLUSTER_QUANTUM_HYBRID` to default via canary rollout |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/config/quantum-hybrid-canary.json` (new)
- `ai-platform/server/lib/quantum-hybrid-rollout.cjs` (new)
- `ai-platform/server/lib/__tests__/quantum-hybrid-rollout.test.cjs` (new)
- `ai-platform/server/lib/cluster-keyring-sync.cjs` (read-only consumer)
- `.simplebeacon/qa/test_plan.md` (this section)

### APIs / interfaces

- `shouldEnableHybrid(nodeId, config)` — deterministic canary allocation
- `checkRollback(metrics, thresholds)` — circuit-breaker decision
- `resolveDeprecationState(rolloutStartTime, deprecationWindowDays)` — `QUANTUM_DEGRADE_ALLOWED` logic

## Design decisions

- **Canary Selection:** Deterministic `MurmurHash3(NODE_ID + salt) % 100` percentage allocation, plus an explicit allowlist override.
- **Dual-Boot:** `QUANTUM_DEGRADE_ALLOWED=1` during the 14-day deprecation window; after that, `QUANTUM_DEGRADE_ALLOWED=0` for the canary stage.
- **Rollback:** Automated rollback resets `CLUSTER_QUANTUM_HYBRID_PERCENT` to `0` and emits `quantum_hybrid_rollback` when any threshold is breached.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Rollout unit tests pass | `cd ai-platform && npx jest --config jest.config.cjs quantum-hybrid-rollout` | [ ] |
| L1-03 | Existing hybrid KEM suites still pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-pfs hybrid-kem-mitm hybrid-kem-handshake` | [ ] |
| L1-04 | Existing cluster keyring tests still pass | `cd ai-platform && npx jest --config jest.config.cjs cluster-keyring-sync` | [ ] |
| L1-05 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate` | [ ] |
| L1-06 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Hash allocation determinism | Call `shouldEnableHybrid` with same `NODE_ID` twice | Same boolean result across calls | [ ] |
| L2-02 | Allowlist override | Set `CLUSTER_QUANTUM_HYBRID_NODE_LIST` to include a node | Node is enrolled regardless of percent | [ ] |
| L2-03 | JSON config parsing | Load `quantum-hybrid-canary.json` | All fields parse and defaults are sane | [ ] |
| L2-04 | Connection drop spike rollback | Feed `metrics` with 6% drop spike | `checkRollback` returns `shouldRollback: true` | [ ] |
| L2-05 | Handshake failure rollback | Feed 12% handshake failure rate | `checkRollback` resets allocation to 0 | [ ] |
| L2-06 | Rollback audit event | Trigger rollback | `quantum_hybrid_rollback` event is recorded | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Deprecation window is active | `resolveDeprecationState` before `rolloutStartTime + 14 days` | Returns `QUANTUM_DEGRADE_ALLOWED=1` | [ ] |
| L3-02 | Deprecation window expired | `resolveDeprecationState` after `rolloutStartTime + 14 days` | Returns `QUANTUM_DEGRADE_ALLOWED=0` | [ ] |
| L3-03 | Zero percent disables canary | `CLUSTER_QUANTUM_HYBRID_PERCENT=0` with no allowlist | `shouldEnableHybrid` returns `false` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | A canary node cannot coerce the cluster into a non-hybrid path after deprecation expires | [ ] |
| S-02 | Rollback cannot be triggered by a single noisy node unless it exceeds the 50% per-node threshold | [ ] |
| S-03 | Allocation hashing is deterministic and not gameable by choosing `NODE_ID` | [ ] |

---

## Approval

- [x] User approved Milestone 4 plan

---

# test_plan.md — Milestone 5: Secure Session Resumption (Track 9)

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 9: post-quantum 0-RTT session resumption tickets |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hybrid-kem-resumption.cjs` (new)
- `ai-platform/server/lib/hybrid-kem-handshake.cjs` (resumption hook + ticket issue)
- `ai-platform/server/lib/__tests__/hybrid-kem-resumption.test.cjs` (new)
- `.simplebeacon/qa/test_plan.md` (this section)

### APIs / interfaces

- `createTicket({ sessionId, nodeId, prevRoot }, stek, stekId, ttlMs)` — AES-GCM ticket envelope
- `validateTicket(ticketBuffer, stek, stekId, redis, ttlMs)` — decrypt + replay check
- `deriveResumptionPsk(prevRoot, nodeId, sessionId)` — HKDF-SHA256 PSK
- `markTicketNonce(redis, nonce, ttlMs)` / `isTicketNonceUsed(redis, nonce)`

## Design decisions

- Tickets are AES-256-GCM envelopes encrypted by an STEK; plaintext contains `sessionId`, `nodeId`, `issuedAt`, and a PSK derived from the previous hybrid root.
- PSK = `HKDF-SHA256(prevRoot, 'resumption:psk', nodeId || sessionId)`.
- Anti-replay uses a Redis-backed bloom-filter-like probabilistic set tracking ticket nonces; on Redis failure the evaluator fails closed to full handshake.
- Ticket lifetime default is 10 minutes (600,000 ms).

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Resumption unit tests pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-resumption` | [ ] |
| L1-03 | Existing hybrid KEM suites still pass | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem-pfs hybrid-kem-mitm hybrid-kem-handshake` | [ ] |
| L1-04 | Full ai-platform test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | STEK encrypt/decrypt round-trip | `createTicket` then `validateTicket` | Payload recovered, PSK length 32 bytes | [ ] |
| L2-02 | PSK derivation uses prevRoot | Derive with same `prevRoot` vs. different | Same inputs produce same PSK; different inputs differ | [ ] |
| L2-03 | Expired ticket rejected | Create ticket, wait until TTL + 1, validate | Throws / returns `EXPIRED` and falls back to full handshake | [ ] |
| L2-04 | Replay blocked by Redis bloom filter | Submit same ticket twice | First accepted, second rejected as `REPLAY` | [ ] |
| L2-05 | Corrupted envelope rejected | Flip a byte in the ciphertext/tag | MAC failure and socket cleanup | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | 0-RTT resumption bypasses ML-KEM/ECDH | `validateTicket` returns `psk` | No `rekeyAsInitiator`/`rekeyAsResponder` called | [ ] |
| L3-02 | Redis disconnection fails closed | Mock Redis unavailable | All tickets rejected, full handshake required | [ ] |
| L3-03 | STEK rotation window | Validate ticket with old and new STEK | Old STEK accepted within a bounded rotation window | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | A valid ticket cannot be replayed more than once | [ ] |
| S-02 | A ticket cannot be used after its TTL | [ ] |
| S-03 | Ticket encryption is authenticated (AES-GCM) | [ ] |
| S-04 | PSK is quantum-resistant because it is rooted in the hybrid ML-KEM+ECDH root | [ ] |

---

## Approval

- [x] User approved Milestone 5 plan

---

# test_plan.md — Milestone 6: Production Backup Rules

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 10: production backup and restore coordinator for cluster keyring, audit, and resumption state |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/backup-coordinator.cjs` (new)
- `ai-platform/server/lib/__tests__/backup-coordinator.test.cjs` (new)
- `.simplebeacon/qa/test_plan.md` (this section)

### Functional requirements for `backup-coordinator.cjs`

| ID | Function | Contract | Behavior |
|----|----------|----------|----------|
| BC-01 | `coordinator = new BackupCoordinator({ kek, retentionDays, immutable, storage })` | Constructor accepts a Key-Encrypting Key (KEK) Buffer, retention window, immutability flag, and pluggable storage adapter. | Initializes internal state and validates KEK length (32 bytes). |
| BC-02 | `coordinator.backup(stateBundle)` | Accepts `{ keyringMaterial, auditLog, resumptionTickets, issuedAt }`. | Returns `{ archiveId, checksum, tag, timestamp }` after AES-256-GCM envelope encryption and write to `storage`. |
| BC-03 | `stateBundle` validation | `backup()` rejects bundles missing `keyringMaterial` or `auditLog`. | Throws `INVALID_BUNDLE` for missing / non-Buffer critical fields. |
| BC-04 | `deriveArchiveKey(kek, archiveId, salt)` | HKDF-SHA256 derivation: `archiveKey = HKDF-SHA256(kek, salt="backup:archive:v1", info=archiveId, L=32)`. | Deterministic per `archiveId` and KEK. |
| BC-05 | `coordinator.restore(archiveId, { dryRun, asOf })` | Optional `dryRun` validates without applying; `asOf` selects the latest archive at or before a timestamp. | Returns verified bundle or throws `RESTORE_FAILED` / `BACKUP_NOT_FOUND`. |
| BC-06 | `verifyArchive(archiveBuffer, archiveId)` | Checks AES-GCM auth tag, SHA-256 checksum, and JSON schema version. | Returns `true` / `false` and a `reason` string. |
| BC-07 | `coordinator.prune(beforeTimestamp)` | Removes backups older than the retention window unless `immutable` is enabled. | Returns list of removed `archiveId`s; does not delete immutable archives. |
| BC-08 | `immutability guard` | When `immutable === true`, `prune()` returns empty and writes a `BACKUP_IMMUTABLE` event. | Prevents accidental or malicious deletion. |
| BC-09 | `listArchives()` | Returns metadata for all stored archives: `{ archiveId, timestamp, size, checksum }`. | No plaintext keyring material is returned. |

## Backup targets & state isolation

- **Cluster Keyring Material**: encrypted `rootKey` and epoch metadata; only the active generation is backed up to avoid rollback confusion.
- **Audit State / Sync Timeline**: monotonic `eventId` sequence stored as JSONL; the backup stores the last-committed `eventId`.
- **Resumption Context**: serialized `sessionId`, `issuedAt`, `nodeId`, and `prevRoot` hash (not live PSK or Bloom filter state) to prevent post-restore replay vectors.

## Cryptographic hardening

- Envelope encryption: AES-256-GCM with a 96-bit nonce and 16-byte tag.
- KEK is never stored in the archive; each archive gets a unique data-encryption key derived from the KEK and `archiveId`.
- Archives include a SHA-256 content checksum in the plaintext metadata before encryption.

## Retention & lifecycle

- Default retention: 30 days (configurable via `retentionDays`).
- `prune()` respects `immutable` flag and emits an audit event for every deletion attempt.
- Restoration validation continuously runs `dryRun` before applying state to detect split-brain or tampering.

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Backup coordinator unit tests | `cd ai-platform && npx jest --config jest.config.cjs backup-coordinator` | [ ] |
| L1-03 | Existing KEM/resumption suites still green | `cd ai-platform && npx jest --config jest.config.cjs hybrid-kem` | [ ] |
| L1-04 | Full test suite | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate` | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Full backup and restore round-trip | `backup()` then `restore(archiveId)` | Decrypted bundle equals original | [ ] |
| L2-02 | Dry-run restore does not mutate | `restore(id, { dryRun: true })` | Returns bundle, storage unchanged | [ ] |
| L2-03 | Corrupted archive fails verification | Flip a byte in the archive buffer, call `verifyArchive` | Returns `false` with `reason` | [ ] |
| L2-04 | Prune removes only old archives | Create 3 backups, set retention to 1 day, prune | Only archives older than 1 day removed | [ ] |
| L2-05 | Immutability prevents deletion | `immutable=true`, call `prune()` | Returns empty, emits `BACKUP_IMMUTABLE` | [ ] |
| L2-06 | Missing bundle fields rejected | Call `backup()` without `keyringMaterial` | Throws `INVALID_BUNDLE` | [ ] |

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | `restore` with `asOf` picks the nearest earlier archive | Create backups at t0 and t1, restore asOf=t0+1 | Returns t0 archive | [ ] |
| L3-02 | KEK length validation rejects short keys | Construct with 16-byte KEK | Throws `INVALID_KEK` | [ ] |
| L3-03 | Resumption state excludes live PSK/Bloom filter | Inspect encrypted bundle for `bloomFilter` keys | Not present; only hashed context stored | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Archives are encrypted at rest and authenticated | [ ] |
| S-02 | KEK is not persisted in backup objects | [ ] |
| S-03 | Pruning cannot delete immutable archives | [ ] |
| S-04 | Restored resumption state cannot be replayed | [ ] |

## Approval

- [x] User approved Milestone 6 plan
