# Fiction Pattern Remediation Tranche (2026-05-25)

Scope: Practical remediation tranche for known high-risk KPI fiction values in high-signal artifacts (customer-facing sample payloads, trust/compliance narratives, and prevention tooling).

## Inventory

| File | Field / Context | Current Value | Replacement Strategy | Source / Provenance |
| --- | --- | --- | --- | --- |
| `web/api/mock-backend-static-data.js` | `modelInfo.confidence` | `98.5` | Neutralized to `null`; retained explanatory provenance block | No deterministic source artifact in fixture; value treated as historical mock |
| `web/api/mock-backend-static-data.js` | `analysisOverview.issuesDetected` | `156` | Neutralized to `null`; retained explanatory provenance block | No deterministic source artifact in fixture; value treated as historical mock |
| `web/data/ai-analysis-sample.json` | `deprecatedNarrative.previousConfidence` | `98.5` | Neutralized to `null` and warning text strengthened | Measured baseline file already uses `modelInfo.confidence: null`; keep consistent with repository-audit posture |
| `web/data/cascade-roadmap-sample.json` | `rejectedFiction.claims` narrative | `87%` and `47 / 74.17` literals | Converted to non-numeric anti-fiction wording | Narrative/documentation-only context; no authoritative measurement source attached |
| `web/data/cascade-roadmap-sample.json` | `deprecatedNarrative.previousTotalFeatures` / `previousCompletionRate` | `8` / `62` | Neutralized to `null`; warning adjusted to explain unverifiable historical defaults | Existing measured fields in same file (`totalFeatures: 5`, `completionRate: 80`) are preserved as current source-backed snapshot |
| `server/lib/code-roadmap-generator.js` | `rejectedFiction.claims` + `deprecatedNarrative.previous*` | `94.3`, `47`, `74.17` | Converted to generalized anti-fiction text and `null` placeholders | Generator warning context only; defaults intentionally removed to prevent re-seeding |

## Additional likely fictional KPI patterns observed

- Broad hardcoded KPI defaults exist in legacy dashboard/mock files under `web/dashboard.html` and `web/api/mock-backend.js` (for example repeated `87.x`, `98.5`, `156`, `47`, `66`, `62` values).
- This tranche intentionally avoids broad refactors there; prevention controls now flag these values for follow-up remediation.

## Still requiring external authoritative data

- `web/api/mock-backend-static-data.js` confidence and issue-count metrics require a reproducible data source (for example, generated report artifact and timestamped evaluation run) before numeric values can be reintroduced.
- Any dashboard KPI literals that are not derived from `repository-audit` / simplebeacon outputs remain candidates for future measured replacement.
