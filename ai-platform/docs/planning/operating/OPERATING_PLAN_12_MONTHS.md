# Operating Plan (12 Months, Execution First)

## Objective and framing

- Objective: execute toward a plausible `$10M-$25M` valuation range in 6-12 months by proving production reliability, revenue traction, retention, and enterprise readiness.
- Caveat: valuation is market-dependent and not guaranteed; this plan is an operating discipline artifact, not a financing commitment.
- Review owner: `<CEO/GM>`
- Weekly operating review cadence: every Monday, 60 minutes, using `business-execution-tracker.json` and this document.

## Repo-tied current state (as of 2026-05-25)

### Completed evidence in repo

- Production predeploy gate and release decision flow exists: `npm run verify:predeploy` (`docs/production-operator-predeploy-checklist.md`).
- Production profile hardening is materially complete for Docker + CI and in progress for auth governance (`docs/production-profile-verification-status.md`).
- Trust verification tooling and runbook exist: `npm run trust:validate-env`, `npm run trust:publish`, `npm run trust:history` (`docs/trust-verification-publish-runbook.md`).
- Analyzer catalog and tranche tracker exist with active critical analyzers A-39 and A-46 (`docs/planning/ai-problem-analyzer-suite/analyzer-tracker.json`).

### Pending external/org sign-offs (not code-only)

- Branch protection required-check enforcement (Repo Admin).
- Production secret rotation/approval and public route policy sign-off (Security + Product).
- Host backup/restore drill evidence and runbook sign-off (SRE/Operations).
- First contracted logos and enterprise legal/security review completion (GTM + Legal).

## Month-by-month milestones and go/no-go gates

> Owner placeholders intentionally left generic for assignment in weekly review.

| Month | Milestone focus | Go/No-Go gate (decision at end of month) | Owner |
|---|---|---|---|
| 1 | Production-live readiness and first external pilot users | GO only if `verify:predeploy` is green twice in separate weeks, smoke tests pass, and all P0 blockers have named owners + due dates | `<Eng Lead>` |
| 2 | First paying customers and onboarding reliability | GO only if 3+ paying customers, onboarding < 2 business days, and no unresolved Sev-1 incidents older than 7 days | `<GTM Lead>` |
| 3 | Baseline retention and trust transparency | GO only if gross monthly retention >= 92%, trust artifacts published weekly, and analyzer critical lane burn-down is on track | `<Product Lead>` |
| 4 | Repeatable pipeline and referral loop | GO only if qualified pipeline is >= 3x next-quarter target MRR and CAC tracking is live and auditable | `<Sales Lead>` |
| 5 | Analyzer expansion tied to conversion outcomes | GO only if at least 12 analyzers are production-usable and expansion correlates with conversion/retention movement | `<Analyzer Lead>` |
| 6 | Midyear financing readiness checkpoint | GO only if MRR and retention trendline supports scenario plan, plus top-5 risk mitigations are demonstrably active | `<CEO/Finance>` |
| 7 | Enterprise security package and procurement readiness | GO only if enterprise security package is current and 2+ enterprise evaluations are active | `<Security Lead>` |
| 8 | First enterprise deal target window | GO only if one enterprise deal reaches legal/procurement stage and support/on-call model is staffed | `<Enterprise AE>` |
| 9 | Expansion motion and reliability scale | GO only if uptime objective holds and customer expansion revenue is measurable | `<CS Lead>` |
| 10 | Breakeven trajectory confirmation | GO only if burn multiple and MRR progression align with moderate scenario breakeven curve | `<Finance Lead>` |
| 11 | Financing narrative finalization | GO only if KPI history is consistent for prior 90 days and diligence artifacts are complete | `<CEO/Finance>` |
| 12 | Valuation process readiness | GO only if scenario model + KPI tracker + customer evidence support target range assumptions | `<CEO>` |

## Critical path tracker (must stay green)

| Critical path item | Current status | Target month | Dependency | Owner | Gate criteria |
|---|---|---|---|---|---|
| Production deployment reliability | In progress (tooling ready; approvals pending) | M1 | Security + Ops sign-off | `<Eng/SRE>` | 2 consecutive successful predeploy checks + production smoke |
| First paying customers | Pending | M2 | Live billing + onboarding process | `<GTM>` | 3+ paying logos and first 30-day renewals in motion |
| MRR milestones (early traction) | Pending | M3/M6/M9/M12 | Acquisition + retention execution | `<Finance/GTM>` | Hit monthly MRR targets in tracker (or approved recovery plan) |
| Enterprise deal progression | Pending | M8-M12 | Security package + procurement support | `<Enterprise Sales>` | 1 enterprise deal reaches legal/procurement, then closes |

## Weekly review operating cadence (Monday)

1. **Data refresh (before meeting)**  
   Update `business-execution-tracker.json` statuses, blockers, and previous-week actuals.
2. **Gate check (first 15 min)**  
   Review current month go/no-go criteria: green/yellow/red with evidence links.
3. **Critical path decisions (next 20 min)**  
   Resolve one decision per at-risk path (owner, deadline, unblock action).
4. **Top blockers and dependencies (next 15 min)**  
   Escalate blockers that need cross-functional intervention.
5. **Commitments (last 10 min)**  
   Lock 5-7 next actions and assign DRI + due date for each.

## Practical owner placeholders

- `<CEO/GM>`: final gate decisions and resource reallocation.
- `<Eng Lead>`: production deploy reliability and quality gates.
- `<SRE/Ops>`: host security, backups, and incident reliability.
- `<GTM Lead>`: customer acquisition and CAC discipline.
- `<Finance Lead>`: runway tracking, scenario updates, and breakeven monitoring.
- `<Security Lead>`: trust and enterprise security posture completion.
