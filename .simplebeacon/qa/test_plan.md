# test_plan.md — Track 43B: Cross-Region State Reconstruction using real ClusterKeyReconciliationEngine digests

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Refactor CrossRegionStateReconstructor to consume Track 35 `reconciliationDigest` payloads instead of mock `shareFragments` |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track43b-state-reconstruction-realism` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/cross-region-state-reconstructor.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/disaster-recovery.test.cjs`
- `ai-platform/server/lib/hsm-adapter/cluster-key-reconciliation-engine.cjs` *(read-only, for interface reference)*

### APIs / routes

- `CrossRegionStateReconstructor.reconstruct(survivingRegions, standbyNodes, reconciliationDigest, standbyAttestations)`
- New constructor option `clusterReconciler` for live digest retrieval by `keyId`

### UI / IDE surfaces

- [ ] Not applicable

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c <file>` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npx jest disaster-recovery` | [ ] |
| L1-03 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Reconstruct with valid digest | `reconstruct(['us-east','eu-west'], ['standby-1'], digest, attestations)` | returns `reconstructed: true` and `keyRing` based on `majorityFingerprint` and `quorumEpoch` | [ ] |
| L2-02 | Missing attestation | standby present without attestation when `requireStandbyAttestation: true` | throws `DR_STANDBY_ATTESTATION_MISSING` | [ ] |
| L2-03 | Unattested standby | attestation verification fails | throws `DR_STANDBY_UNATTESTED` | [ ] |
| L2-04 | Insufficient surviving regions | only one region with `minSurvivingRegions: 2` | throws `DR_SURVIVING_REGIONS_INSUFFICIENT` | [ ] |
| L2-05 | Critical divergence | `reconciliationDigest.severity === 'critical'` | throws `DR_DIVERGENCE_CRITICAL` | [ ] |
| L2-06 | Quorum below minQuorumNodes | `majorityCount < minQuorumNodes` | throws `DR_QUORUM_INSUFFICIENT` | [ ] |
| L2-07 | State too old | `reconciliationDigest.ageSeconds` > `maxStateReconstructionAgeSeconds` | throws `DR_STATE_TOO_OLD` | [ ] |
| L2-08 | Live reconciler integration | pass `ClusterKeyReconciliationEngine` as `clusterReconciler` and a `keyId` | digest pulled from engine and reconstruct succeeds | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Backward-compatible `shareFragments` | method still accepts legacy array for existing tests | succeeds or warns | [ ] |
| L3-02 | Empty `divergentNodes` | `severity === 'none'`, `majorityCount` matches cluster size | succeeds | [ ] |
| L3-03 | Missing `reconciliationDigest.majorityFingerprint` | throws `DR_DIGEST_INVALID` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Attestation still required before reconstructing key ring | [ ] |

---

## Approval

- [x] User approved this plan (prior message)
