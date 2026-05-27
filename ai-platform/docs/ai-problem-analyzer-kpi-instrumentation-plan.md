# AI Problem Analyzer Suite — KPI Instrumentation Plan

## Scope

Map business-case KPIs to existing platform metrics and APIs, then identify instrumentation gaps needed for decision-grade weekly reviews.

## Existing Metrics Already in Repo

| KPI / Signal | Exists? | Current Source | Cadence | Owner | Confidence |
|---|---|---|---|---|---|
| Test pass baseline (Jest pass ratio) | Yes | `web/data/analytics-sample.json` + `/api/analytics` | Per CI run | `<owner>` | High |
| Sample/schema pass rate | Yes | `web/data/analytics-sample.json` + `/api/analytics` | Per scan | `<owner>` | High |
| Scan quality score | Yes | `web/data/analytics-sample.json` + `/api/analytics` | Per scan | `<owner>` | Medium-High |
| Security overview summary | Yes | `/api/security/overview` | Daily/On demand | `<owner>` | Medium |
| npm audit vulnerabilities | Yes | `/api/security/npm-audit` and `npm run security:scan` | On demand + weekly | `<owner>` | High |
| Coverage overview | Yes | `/api/coverage-reports/overview` | Per CI run | `<owner>` | High |
| Quality overview | Yes | `/api/quality/overview` | Daily/On demand | `<owner>` | Medium |
| Technical debt aggregate | Yes | `reports/technical-debt/raw/metrics-summary.json` | Manual/periodic | `<owner>` | Medium |

## Missing Metrics Required for Finance Decisions

| Missing KPI | Why Needed | Data Source to Add | Cadence | Owner | Confidence (current) |
|---|---|---|---|---|---|
| Paying customers (count) | Revenue reality vs scenario | Billing DB or Stripe export (daily snapshot) | Weekly rollup | `<owner>` | Low |
| MRR/ARR actual | Compare against scenario assumptions | Billing pipeline + finance ledger | Weekly | `<owner>` | Low |
| Trial-to-paid conversion | Early product-market signal | signup/trial events + billing activation event | Weekly | `<owner>` | Low |
| Customer churn (logo + revenue) | Primary ROI sensitivity | subscription state changes in billing system | Weekly | `<owner>` | Low |
| CAC (fully loaded) | Unit economics and go/no-go quality | marketing spend + attributed new customers | Weekly | `<owner>` | Low |
| Analyzer adoption depth | Link product use to retention | Analyzer run events by account/workspace | Weekly | `<owner>` | Medium-Low |
| Value realization proxy | Business-case validation | issue-prevention/remediation time saved model | Bi-weekly | `<owner>` | Low |

## Instrumentation Actions (Practical 8-Week Plan)

1. Add a normalized weekly KPI artifact (JSON) under `reports/business/weekly-kpi.json`.
2. Implement minimal ETL script in `tools/` to merge:
   - platform quality metrics (`/api/analytics`, `/api/security/npm-audit`, `/api/coverage-reports/overview`),
   - finance inputs (billing export),
   - acquisition inputs (campaign spend export).
3. Keep source-of-truth split explicit:
   - engineering health from existing APIs,
   - revenue and acquisition from finance/billing feeds.
4. Track confidence flag per KPI (`high|medium|low`) until automated source is stable.

## Metrics Dictionary (Initial)

| Metric Key | Definition | Formula | Source |
|---|---|---|---|
| `jest_pass_ratio` | Passing tests / total tests | `passed / total` | `/api/analytics` |
| `schema_pass_rate` | Passing sample/schema checks | `pass / total * 100` | `/api/analytics` |
| `security_vuln_total` | npm audit vulnerabilities (all severities) | `info + low + moderate + high + critical` | `/api/security/npm-audit` |
| `weekly_paying_customers` | Active paying customers at week end | count distinct active subscriptions | billing export |
| `weekly_mrr` | Monthly recurring revenue snapshot | sum active subscription MRR | billing export |
| `weekly_churn_rate` | Lost customers in week / starting customers | `lost / start` | billing export |
| `trial_to_paid_rate` | Paid activations / trial starts | `paid / trial` | product + billing events |
| `weekly_cac` | Spend / net new paying customers | `marketing_spend / new_customers` | spend + billing |

## Weekly Review Usage

- Review both tracks together: engineering risk reduction + commercial traction.
- Update confidence per metric each week; decisions must not rely on low-confidence numbers alone.
- Reconcile KPI deltas against `docs/ai-problem-analyzer-finance-model.json` assumptions before changing scenario probabilities.
