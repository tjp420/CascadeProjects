# test_plan.md — Track 50: Confidential Federated Learning & ZK Model Aggregation

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 50: Confidential Federated Learning and ZK Model Aggregation |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feature/track50-confidential-federated-learning` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/confidential-federated-learning.cjs` (existing — `ConfidentialFederatedLearning`)
- `ai-platform/server/lib/hsm-adapter/__tests__/confidential-federated-learning.test.cjs` (existing — 35 tests)
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` (registered at line 88)
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` (Track 50 counters at lines 180-190)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (existing `confidentialFederatedLearning` policy block)

### APIs / routes

- `ConfidentialFederatedLearning.initiateRound(config)`
- `ConfidentialFederatedLearning.submitGradient(roundId, participantId, gradient)`
- `ConfidentialFederatedLearning.verifyGradients(roundId)`
- `ConfidentialFederatedLearning.aggregateGradients(roundId)`
- `ConfidentialFederatedLearning.checkExpiredRounds()`
- `ConfidentialFederatedLearning.getGlobalModel()`
- `ConfidentialFederatedLearning.getStats()`

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## 1. Core Cryptographic Parameters

- **Gradient Shape**: Memory-isolated single-dimensional arrays bounded explicitly at `maxGradientSize = 65536` positions.
- **Participant Topology**: Enforcing dynamic execution constraints restricted between `minParticipants = 2` and `maxParticipants = 32` verified enclaves per iteration.
- **Averaging Routines**: Native `fedavg` execution pipelines backed by optional proxies (`fedprox`, `fedsgd`).
- **Privacy Controls**: Differentially private Gaussian noise mapping coupled with local gradient parameter clipping.

## 2. Validation Suite Execution Plan

### FL-01: Round Lifecycle and Phase Rotation

- Assert successful multi-round initiation with valid participant counts.
- Verify automatic round number increment across consecutive rounds.
- Assert rejection of insufficient participants (`< minParticipants`).
- Assert rejection of excess participants (`> maxParticipants`).
- Assert rejection of duplicate participant IDs.
- Verify phase rotation: `INITIATED` -> `COLLECTING` -> `AGGREGATING` -> `COMPLETED`.
- Assert automatic epoch expiration blocks via `checkExpiredRounds()` with short timeout.

### FL-02: Gradient Submission and ZK Proof Verification

- Verify proof-required gradient submission loops accept valid hex proofs.
- Detect malformed weights (empty gradient arrays, oversized gradients beyond `maxGradientSize`).
- Detect signature mismatches (non-hex ZK proof characters flagged as invalid).
- Assert rejection of duplicate submissions from the same participant.
- Assert rejection of unknown participant IDs.
- Assert rejection of unknown round IDs.
- Verify attestation-gated mode rejects submissions without verified attestation.
- Verify no-ZK-proof mode allows submission when `requireZkProof = false`.

### FL-03: Secure Aggregation and Privacy Noise

- Validate secure aggregation produces weighted average of verified gradients.
- Ensure Gaussian privacy noise adheres to configured `noiseScale` target bounds.
- Verify aggregation rejects calls before verification phase.
- Assert global model version increments after successful aggregation.
- Verify aggregated weights match expected weighted average output.
- Assert `getGlobalModel()` returns updated weights post-aggregation.

## 3. Test Inventory

| Test ID | Describe Block | Test Name | Assertions |
|---------|---------------|-----------|------------|
| FL-01a | initiateRound | initiates a round with valid participants | roundId, roundNumber, phase, participantIds |
| FL-01b | initiateRound | rejects insufficient participants | HsmAdapterError |
| FL-01c | initiateRound | rejects too many participants | HsmAdapterError |
| FL-01d | initiateRound | rejects duplicate participants | HsmAdapterError |
| FL-01e | initiateRound | rejects null config | HsmAdapterError |
| FL-01f | initiateRound | auto-increments round number | r2.roundNumber = r1.roundNumber + 1 |
| FL-02a | submitGradient | submits a valid gradient | submitted, totalSubmissions |
| FL-02b | submitGradient | rejects unknown participant | HsmAdapterError |
| FL-02c | submitGradient | rejects duplicate submission | HsmAdapterError |
| FL-02d | submitGradient | rejects empty gradient | HsmAdapterError |
| FL-02e | submitGradient | rejects missing ZK proof when required | HsmAdapterError |
| FL-02f | submitGradient | rejects short ZK proof | HsmAdapterError |
| FL-02g | submitGradient | rejects gradient too large | HsmAdapterError |
| FL-02h | submitGradient | rejects unknown round | HsmAdapterError |
| FL-02i | submitGradient | rejects attestation requirement when enabled | HsmAdapterError |
| FL-02j | submitGradient | accepts submission with attestation | submitted = true |
| FL-03a | verifyGradients | verifies all valid gradients | verifiedCount, phase = AGGREGATING |
| FL-03b | verifyGradients | rejects verification before all submissions | HsmAdapterError |
| FL-03c | verifyGradients | rejects verification in wrong phase | HsmAdapterError |
| FL-03d | verifyGradients | fails on invalid proof | verifiedCount = 1, phase = FAILED |
| FL-03e | aggregateGradients | aggregates verified gradients into new model | phase = COMPLETED, aggregatedWeights, participantCount |
| FL-03f | aggregateGradients | rejects aggregation before verification | HsmAdapterError |
| FL-03g | aggregateGradients | updates global model version | model.version = roundNumber |
| FL-03h | full training round | complete initiate -> submit -> verify -> aggregate flow | verifiedCount = 3, phase = COMPLETED |
| FL-03i | getRound | returns active round state | round not null, roundId matches |
| FL-03j | getRound | returns completed round from history | round not null, roundNumber matches |
| FL-03k | getRound | returns null for unknown round | null |
| FL-03l | getActiveRounds | returns all active rounds | length = 2 |
| FL-03m | getCompletedRounds | returns completed rounds history | length = 1 |
| FL-01g | checkExpiredRounds | expires rounds past timeout | expired length = 1, roundId matches |
| FL-03n | getStats | returns summary statistics | activeRounds, completedRounds, aggregationAlgorithm |
| FL-03o | getGlobalModel | returns initial model state | version = 0, weights = null |
| FL-03p | getGlobalModel | returns updated model after aggregation | version = 1, weights length = 2 |
| FL-03q | reset | clears all state | activeRounds = 0, completedRounds = 0, version = 0 |
| FL-02k | no ZK proof mode | allows submission without ZK proof | submitted = true |

## 4. Level 1 Gates

- [ ] `node -c server/lib/hsm-adapter/confidential-federated-learning.cjs`
- [ ] `npx jest server/lib/hsm-adapter/__tests__/confidential-federated-learning.test.cjs --verbose`
- [ ] `node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` (71 tracks, 0 failures)
- [ ] `npx simplebeacon scan --gate --fail-on high`

## 5. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Timer-based expiration test flaky under load | Uses 50ms timeout with 100ms wait — generous margin |
| ZK proof validation assumes hex encoding | Test uses `pid.charCodeAt(0).toString(16)` for valid hex generation |
| Gradient size boundary edge cases | Explicit `maxGradientSize: 10` test with 20-element array |
| Attestation-gated mode bypass | Separate `requireAttestation: true` instance with attestation object check |
