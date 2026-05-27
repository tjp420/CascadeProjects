# Simplebeacon feature truth matrix

Use on discovery calls, pricing, and sales copy. Distinguish **software (shipped)**, **hosted (SaaS gate)**, and **service (consulting delivery)**.

Last verified against `ai-platform` dashboard + CLI — not aspirational roadmap items.

---

## Legend

| Tag | Meaning |
|-----|---------|
| **Software** | In repo today — CLI and/or dashboard |
| **Hosted** | Requires dashboard server + Cloud Teams subscription when monetization is on |
| **Service** | Consultant deliverable (SOW), not an automated product feature |

---

## Confirmed software (shipped)

| Capability | Community (CLI) | Cloud Teams (hosted) | Evidence |
|------------|-----------------|----------------------|----------|
| Local scans | ✓ | ✓ | `packages/simplebeacon-cli` · [npm simplebeacon@1.0.0](https://www.npmjs.com/package/simplebeacon) |
| CI gate `--gate` | ✓ | ✓ | CLI + GitHub Action docs |
| JSON + text reports | ✓ | ✓ | `--format json` / text reporter |
| Dashboard + scan history | — | ✓ Hosted | `simplebeacon-api.js`, SPA views |
| Results / export | CLI file | ✓ Hosted | `scanService.exportReport` |
| Compliance Audit **dashboard** | — | ✓ Software | `AuditView.js` → `/api/simplebeacon/audit` |
| Analyze **dashboard** modes | — | ✓ Software | `AnalyzeView.js`, flexible-analyze API |
| CLI `assess` / `compliance` | ✓ | ✓ | `simplebeacon assess`, `simplebeacon compliance` |
| Assessment **workflow UI** | — | ✓ Software | `AssessmentView.js`, assessment API |
| Settings / config editor | Manual JSON | ✓ Software | `SettingsView.js`, PUT config |
| API quota on mutations | — | ✓ when billing on | `simplebeacon-subscription.js`, `consumeApiCall` |
| Read-only scan guarantee | ✓ | ✓ | `tests/integration/scanner.test.js` |

---

## Partially true (clarify in sales)

| Claim | Reality |
|-------|---------|
| **Analyze (all modes)** | Dashboard: simplebeacon, consolidation, roadmap, optional AI summary. CLI: scan/assess/compliance — not identical UX. |
| **Compliance Audit layers** | Dashboard aggregates scan layers (credentials, fiction, schema, leaks, Jest, gate) — not a separate audit product. |
| **Assessment Portal** | Self-serve UI exists; **white-glove** = consultant-reviewed deliverable (Enterprise service). |
| **Allowlist tuning** | Software: edit `.simplebeacon/config.json`. **Consultant-led** = Enterprise service. |

---

## Service only (Enterprise / SOW — not automated)

| Deliverable | Notes |
|-------------|-------|
| Human triage of findings | Consultant reviews gate output before client sees exec summary |
| Executive memo / PDF narrative | Authored deliverable, not generated solely by dashboard |
| CI/CD deployment + handoff | Consultant wires GitHub Actions + reporting-only phase |
| Ongoing allowlist curation | Retainer scope |

---

## Comparison table (honest — use on pricing page)

| Feature | Community | Cloud Teams | Enterprise |
|---------|-----------|-------------|------------|
| Local CLI + `--gate` | Software ✓ | Software ✓ | Software ✓ |
| Hosted dashboard + history | — | Software ✓ | Software ✓ |
| Compliance Audit dashboard | — | Software ✓ | Software ✓ |
| Analyze dashboard | — | Software ✓ | Software ✓ |
| Assessment workflow UI | — | Software ✓ | Software ✓ + Service review |
| JSON export | CLI ✓ | Software ✓ | Software ✓ |
| API quota (scan/assess mutations) | — | Hosted ✓ | Hosted ✓ |
| Config / allowlists | Manual file | Self-serve UI | Software + Service |
| Human triage + exec memo | — | — | **Service** |
| CI deploy + handoff | Docs | Self-serve | **Service** |

---

## Sales talk track

**Software:** “The CLI and hosted dashboard are real today — gate, audit view, assessments, exports.”

**Hosted:** “Cloud Teams unlocks the dashboard and API when billing is enabled; Community stays CLI-only.”

**Service:** “Enterprise is us deploying, tuning allowlists, triaging noise, and delivering an exec-ready memo — on top of the same engine.”

Do **not** claim: SOC 2 certification, zero false positives, full-repo semantic AI review, or features marked **Service** as self-serve software.
