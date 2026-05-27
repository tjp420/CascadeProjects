# AI Problem Analyzer Suite — Business Case (Decision Pack)

## Purpose

This document converts existing monetization and platform telemetry into a practical decision baseline for the next 8 weeks and year-1 value outlook.

Primary model file: `docs/ai-problem-analyzer-finance-model.json`.

## Baseline Assumptions

| Assumption | Baseline | Source | Confidence |
|---|---:|---|---|
| Price per customer/month | $79 | `docs/reports/MONETIZATION_PLAN.md` | Medium |
| Gross margin | 82% | internal operating assumption | Low-Medium |
| Conservative year-1 ARR | $50,000 | `docs/reports/MONETIZATION_PLAN.md` | Low |
| Moderate year-1 ARR | $150,000 | `docs/reports/MONETIZATION_PLAN.md` | Medium |
| Aggressive year-1 ARR | $300,000 | `docs/reports/MONETIZATION_PLAN.md` | Low |
| Scenario probabilities | 35% / 45% / 20% | leadership weighting for planning | Low-Medium |
| Conservative implementation cost | $28,000 | current build + ops estimate | Medium |
| Moderate implementation cost | $34,000 | current build + ops estimate | Medium |
| Aggressive implementation cost | $45,000 | scale + support estimate | Medium |

## Scenario View (12-Month)

| Scenario | Probability | ARR | Gross Profit (82%) | Cost | Net Value | ROI | Payback |
|---|---:|---:|---:|---:|---:|---:|---:|
| Conservative | 35% | $50,000 | $41,000 | $28,000 | $13,000 | 46.43% | 8.20 mo |
| Moderate | 45% | $150,000 | $123,000 | $34,000 | $89,000 | 261.76% | 3.32 mo |
| Aggressive | 20% | $300,000 | $246,000 | $45,000 | $201,000 | 446.67% | 2.20 mo |

## Probability-Weighted Expected Value

- Expected net value: **$84,800**
- Expected implementation cost: **$34,100**
- Expected ROI: **248.68%**
- Expected payback: **4.55 months**

Interpretation: the base case is attractive if the team can hold delivery cost near the moderate scenario and prove customer conversion signal by week 8.

## Key Sensitivities (Top 5 ROI Movers)

1. **Year-1 paying customers (ARR at fixed price)** - largest ROI lever.
2. **Monthly churn** - quickly erodes ARR and payback.
3. **ARPU ($79 baseline)** - impacts ARR linearly.
4. **Implementation cost discipline** - direct denominator effect on ROI.
5. **Gross margin** - second-order but still meaningful at this scale.

See numeric sensitivity deltas in `docs/ai-problem-analyzer-finance-model.json`.

## Caveats (Important)

- Revenue scenarios come from planning docs, not signed pipeline.
- Current dashboard telemetry is strong on engineering/quality but weak on direct revenue attribution.
- Analyzer Suite includes many planned analyzers; business value should be tied to implemented analyzer outcomes first.

## Weekly Review Use

- Recompute scenario line items weekly from latest conversion/churn/cost actuals.
- Keep probability weights explicit; do not hide uncertainty behind a single ROI number.
- If expected payback drifts above 6 months for 2 consecutive weeks, trigger decision-framework review.
