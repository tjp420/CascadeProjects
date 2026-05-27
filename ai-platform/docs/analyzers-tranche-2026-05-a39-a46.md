# AI Problem Analyzer Tranche Note (A-39, A-46)

This tranche hardens two implemented analyzers while preserving the existing response schema and dashboard compatibility.

## Rubric updates

- Risk/severity coherence:
  - `score` remains analyzer-native quality score (0-100).
  - `riskScore` is derived by `normalize(score, scoringDirection)`.
  - `severity` and `riskBand` are derived from `riskScore` after evidence moderation.
- Evidence moderation:
  - Adds deterministic evidence state handling through findings (`INSUFFICIENT_DATA`, `LIMITED_DATA`).
  - Prevents extreme labels on zero/low evidence to avoid overconfident critical outputs.

## A-39 Security Risk Analyzer hardening

- Expanded deterministic signatures for:
  - prompt injection and jailbreak phrasing,
  - instruction hierarchy bypass attempts,
  - common secret/credential leakage patterns.
- Scoring now treats output as `security_posture_score` (`higher_better`), aligning with analyzer contract.
- Zero-input cases emit `INSUFFICIENT_DATA` and settle to moderate baseline severity.

## A-46 Error Handling Analyzer hardening

- Deterministic rubric improves signal for:
  - error clarity/actionability (including error-code and remediation-hint coverage),
  - recovery success,
  - time-to-resolution via fixed scoring tiers.
- Adds actionable findings and recommendations for low clarity, low recovery, and slow resolution.
- Low sample sizes (under 3 cases) produce `LIMITED_DATA` and suppress critical classification.

## Next analyzers queued (next tranche)

1. A-08 Adversarial Vulnerability Analyzer - align exploitability metrics with evidence-aware severity.
2. A-22 Response Consistency Analyzer - add low-sample confidence damping for pairwise similarity.
3. A-10 Privacy Violation Analyzer - add deterministic PII confidence bands and minimum-evidence gates.
