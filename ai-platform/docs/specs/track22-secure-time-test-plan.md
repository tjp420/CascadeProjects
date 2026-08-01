# test_plan.md — Track 22: Tamper-Evident Distributed Oracles & Secure Time Anchoring

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 22: Tamper-Evident Distributed Oracles & Secure Time Anchoring |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track22-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/time-anchor-engine.cjs` (new — distributed oracle time consensus)
- `ai-platform/server/lib/hsm-adapter/epoch-frame.cjs` (new — linked, signed epoch structures)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (time policy validation)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (time policy schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (optional `currentEpoch()` / `verifyTemporalGuard` hooks)
- `ai-platform/server/lib/hsm-adapter/__tests__/secure-time.test.cjs` (new)
- `ai-platform/docs/specs/track22-secure-time-test-plan.md` (this file)

### APIs / interfaces

- `TimeAnchorEngine({ oracles, minQuorum, maxDriftMs })`
- `TimeAnchorEngine.submitPulse(oracleId, timestamp, signature, publicKey)`
- `TimeAnchorEngine.consensusTimestamp()`
- `TimeAnchorEngine.currentEpoch()`
- `EpochFrame(epochNumber, previousHash, consensusTimestamp, driftMs)`
- `EpochFrame.sign(privateKey)`
- `EpochFrame.verify(publicKey, signature)`
- `BaseHsmAdapter.currentEpoch()`
- `BaseHsmAdapter.verifyTemporalGuard(expectedTimestamp, toleranceMs)`
- `CryptoPolicyEngine.validate(tenantId, 'time', { maxDriftMs, minQuorum })`
- `HsmAdapterError` codes: `TEMPORAL_DRIFT_BLOCKED`, `ORACLE_QUORUM_FAILED`, `EPOCH_SIGNATURE_INVALID`, `MONOTONIC_TIME_VIOLATION`

---

## Design decisions

- **Secure time anchoring:**
  - N independent oracles each provide signed `(timestamp, epochNumber, oracleId)` pulses.
  - Each pulse is verified with an ECDSA or Ed25519 signature using the oracle's public key.
  - After collecting pulses, the engine computes the median timestamp and filters out any pulse more than `maxDriftMs` away from the median (Byzantine fault tolerance).
  - A consensus is reached only if at least `minQuorum` valid pulses remain.
- **Epoch frames:**
  - Each epoch is a signed structure: `{ epochNumber, previousHash, consensusTimestamp, driftMs, signature }`.
  - `previousHash` links the frame to the prior epoch, forming an immutable chain.
  - Frames are signed by the HSM adapter's ephemeral identity key.
  - Verification checks signature and hash continuity.
- **Time-drift guards:**
  - `BaseHsmAdapter.verifyTemporalGuard(localTimestamp, toleranceMs)` compares `localTimestamp` against `TimeAnchorEngine.consensusTimestamp()`.
  - If the absolute drift exceeds `toleranceMs`, throw `TEMPORAL_DRIFT_BLOCKED`.
  - Every key lifecycle, wrap/unwrap, and policy enforcement can call this guard.
- **Policy enforcement:**
  - `CryptoPolicyEngine` gains `time: { maxDriftMs: 60000, minQuorum: 3, requireEpochChain: true }`.
  - `validate(tenantId, 'time', config)` checks `maxDriftMs` and `minQuorum`.
- **Audit events:** `TIME_CONSENSUS_REACHED`, `EPOCH_FRAME_SIGNED`, and `TEMPORAL_DRIFT_BLOCKED` are emitted through `BaseHsmAdapter._audit`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Secure time tests pass | `cd ai-platform && npx jest --config jest.config.cjs secure-time` | [ ] |
| L1-03 | Crypto policy tests still pass | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine` | [ ] |
| L1-04 | Full `ai-platform` test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Reach consensus from multiple oracles | `submitPulse` 5 oracles; `consensusTimestamp` | Returns median timestamp | [ ] |
| L2-02 | Reject rogue oracle outside drift window | `submitPulse` with 1 outlier; consensus | Outlier excluded, consensus reached | [ ] |
| L2-03 | Fail quorum when too few valid pulses | `submitPulse` 1 pulse only | Throws `ORACLE_QUORUM_FAILED` | [ ] |
| L2-04 | Sign and verify an epoch frame | `new EpochFrame(...).sign().verify()` | Returns `true` | [ ] |
| L2-05 | Temporal guard blocks drift | `verifyTemporalGuard(local, 1000)` with 5s drift | Throws `TEMPORAL_DRIFT_BLOCKED` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Monotonic time violation: new epoch older than previous | Throws `MONOTONIC_TIME_VIOLATION` | [ ] |
| L3-02 | Epoch chain tampering: invalid `previousHash` | `verify` returns `false` | [ ] |
| L3-03 | Existing Tracks 10–21 tests still pass | No regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Oracle public keys are not stored with pulses | [ ] |
| S-02 | Epoch chain hash links are tamper-evident | [ ] |
| S-03 | Median calculation is robust to `floor((N-1)/2)` rogue oracles | [ ] |
| S-04 | No operation accepts a local timestamp without guard validation | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
