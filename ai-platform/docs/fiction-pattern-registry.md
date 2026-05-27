# Fiction Pattern Registry (MVP)

Catalog of KPI/fiction patterns Simplebeacon rejects. Values come from `.simplebeacon/baseline.json` → `rejectedFiction` and are enforced in JSON samples plus source-code scanning.

## Severity bands

| Severity | Scope | Gate impact |
|----------|-------|-------------|
| **high** | Active KPI fields in JSON (`Fictional KPI`) | Fails gate |
| **medium** | Source-code hardcoded rejected values (`Source Fiction KPI Pattern`) | Warning only |
| **low** | Release/model drift across anchor samples | Warning only |

## Rejected completion rates

| Value | Pattern type | Example context |
|-------|--------------|-----------------|
| 74.17% | `completion_rate` | Legacy roadmap “overall completion” |
| 87% | `completion_rate` | Inflated phase progress |
| 94.3% | `completion_rate` | Demo roadmap export |
| 66% | `completion_rate` | Stale analyzer output |
| 62% | `completion_rate` | Stale analyzer output |

**Source detection:** `\b74.17%\b`, `\b87%\b`, etc. in `.js`/`.ts`/`.py` strings (excluding documentation of rejected values).

## Rejected AI confidence scores

| Value | Pattern type | Example context |
|-------|--------------|-----------------|
| 98.5% | `ai_confidence` | “Unbreakable oracle” demo branding |
| 94.3% | `ai_confidence` | Legacy export confidence |
| 87% | `ai_confidence` | Inflated model confidence |

**Source detection:** `aiConfidence: 98.5`, `confidence: 94.3`, etc.

## Rejected feature counts

| Value | Pattern type | Example context |
|-------|--------------|-----------------|
| 47 | `feature_count` | Fictional “totalFeatures” in mock generators |
| 100 | `feature_count` | Round-number backlog fiction |
| 156 | `feature_count` | Inflated issue/feature totals |
| 8, 9 | `feature_count` | Legacy demo counts |

**Source detection:** `totalFeatures: 47`, `featuresTracked: 156`, etc.

## Rejected open-issue counts

| Value | Pattern type |
|-------|--------------|
| 156 | `open_issues` |
| 999 | `open_issues` |

## Rejected model names

| Name | Pattern type |
|------|--------------|
| `unbreakable-oracle` | `model_name` |
| `gpt-5-oracle` | `model_name` |
| `demo-oracle` | `model_name` |

Allowed when documented as removed/rejected (e.g. `fictionRemoved`, `fictionVsReality.rejected`).

## Rejected throughput claims

| Claim | Pattern type |
|-------|--------------|
| 1559 files/s | `throughput_claim` |
| 9999 files/s | `throughput_claim` |

## Exclusions (source scan)

- `tests/**`, `**/*.test.js`, `**/*.spec.js`, `fixtures/**`
- Pattern catalog files (`fiction-kpi-patterns.js`, `scan-source-kpi-patterns.js`)
- Lines documenting rejection (`fictionRemoved`, `legacy demo`, `not model output`, `*_example_only_placeholder`)

## Maintenance

1. Add new rejected values to `.simplebeacon/baseline.json` → `rejectedFiction`.
2. Document narrative-only references in `documentedExceptions` (max ~5 well-scoped entries; review quarterly).
3. Re-run `npm run simplebeacon:report` — JSON fiction should stay at 0 on clean samples; source fiction hits target 0.
4. Run `npm run scan:kpi:source:code` for ad-hoc source audits (broader patterns including TODO/TBD).
5. Integrated rule: `rules.fiction-kpi-patterns` in `.simplebeacon/config.json` (medium severity).

## Remediation report

See [rejected-fiction-patterns-remediation-2026-05-25.md](./reports/rejected-fiction-patterns-remediation-2026-05-25.md) for the 2026-05-25 tranche: 24-pattern categorization, 14 source hits neutralized, baseline documented exceptions.

## Related tooling

```bash
npm run simplebeacon:report          # JSON + source fiction (gate-safe)
npm run scan:kpi:source:code           # Standalone source KPI scan
npm run scan:fiction-remediation-map   # JSON remediation map
npm run guard:fiction-kpi:ci           # CI guard on staged paths
```
