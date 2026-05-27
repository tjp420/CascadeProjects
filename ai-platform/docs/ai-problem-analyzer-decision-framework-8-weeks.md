# AI Problem Analyzer Suite — 8-Week Decision Framework

## Objective

Provide clear go/no-go gates with minimum thresholds, stop conditions, and rollback posture from a business perspective.

## Gate Timeline

### Week 2 Gate — Instrumentation Ready

**Go if all true:**
- Weekly KPI artifact is published with no missing required fields.
- Existing engineering metrics ingest is stable from real endpoints (`/api/analytics`, `/api/security/npm-audit`, `/api/coverage-reports/overview`).
- Billing/revenue feed is connected (even if partial) with confidence tagging.

**No-Go / Hold if any true:**
- Revenue KPIs are still manual and unverifiable.
- More than 30% of required KPIs remain low-confidence with no owner.

### Week 4 Gate — Early Traction Signal

**Go if all true:**
- Week-over-week paying-customer trend is non-negative.
- Trial-to-paid conversion is measurable and not deteriorating by >20% vs first measured week.
- Security and quality baseline does not regress (no new high/critical npm vulnerabilities).

**No-Go / Hold if any true:**
- Conversion signal remains unknown.
- Delivery cost is tracking >20% above moderate scenario plan.

### Week 6 Gate — Unit Economics Health

**Go if all true:**
- Expected payback projection is <= 6 months.
- Churn trend is stable or improving.
- Weekly expected value remains positive after updated actuals.

**No-Go / Hold if any true:**
- Expected payback projection > 8 months for 2 consecutive weeks.
- Churn exceeds conservative assumption without mitigation plan.

### Week 8 Gate — Scale or Pause Decision

**Scale (Go) if all true:**
- Probability-weighted expected ROI remains > 100%.
- At least 2 of 3 traction metrics improve over 4-week window: paying customers, conversion, churn.
- Cost variance is within +15% of moderate plan.

**Pause / Re-scope (No-Go) if any true:**
- Expected value turns negative.
- Cost variance exceeds +25% with flat revenue.
- KPI confidence remains too low to support investment decision.

## Minimum Success Thresholds

- Expected payback <= 6 months by week 8.
- Expected ROI >= 100% by week 8.
- Weekly KPI completeness >= 90%.
- No unresolved high/critical security regressions in weekly operational baseline.

## Stop Conditions

Stop incremental investment and enter stabilization mode when:

1. Two consecutive weekly reviews show negative expected net value.
2. Conversion and paying-customer metrics remain flat/declining for 4 weeks while cost rises.
3. Decision-critical metrics remain low confidence after week 4.

## Rollback Strategy (Business)

If stop conditions trigger:

1. **Freeze expansion spend** (new feature scope and GTM scale-up).
2. **Revert to core reliability scope** focused on implemented analyzers and quality/security reporting value.
3. **Run 2-week corrective sprint** on highest ROI lever (usually conversion instrumentation or churn reduction).
4. **Re-baseline scenarios** in `docs/ai-problem-analyzer-finance-model.json` with updated probabilities and costs.
5. **Re-open go/no-go review** only after confidence on core KPIs reaches medium or higher.

## Weekly Review Ritual (30 minutes)

1. Review KPI dashboard and confidence changes.
2. Update finance model inputs with actuals.
3. Recompute expected value and payback.
4. Decide: continue / hold / rollback against gate criteria.
