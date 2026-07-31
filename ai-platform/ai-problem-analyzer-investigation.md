# AI Problem Analyzer Suite Investigation Report

**Project:** CascadeProjects  
**Export Version:** 1.3.0  
**Generated:** 2026-06-10T22:47:19Z  
**Analyzed:** 48 analyzers | Measured: 20 | Insufficient Data: 28

---

## 1. Critical/High Severity Root Cause Analysis

### Severity Thresholds

| Risk Score Range | Severity | Risk Band |
| ---------------- | -------- | --------- |
| >= 75            | critical | High      |
| 55 – 74.99       | high     | Elevated  |
| 35 – 54.99       | medium   | Moderate  |
| < 35             | low      | Low       |

**Risk Score Formula:**

- `higher_better` metrics: `riskScore = 100 - metricScore`
- `lower_better` metrics: `riskScore = metricScore`

### Top Priority Issues

#### A-02 — Bias Detection Analyzer (`critical`, riskScore 100)

- **metricScore:** 0 / 100 (higher_better)
- **Root cause:** Zero subgroup parity across 8 demographic segments. Max disparity gap = 100 points.
- **Why critical:** A metricScore of 0 on a higher_better metric maps directly to riskScore 100, which exceeds the 75 critical threshold.
- **Evidence:** "Subgroup parity gap is 100 points. Compared 8 subgroup(s)."

#### A-16 — Digital Divide Analyzer (`critical`, riskScore 82.5)

- **metricScore:** 17.5 / 100 (higher_better)
- **Root cause:** Severe access inequality. Access equality score = 0, segment disparity index = 100 across 8 segments.
- **Why critical:** `100 - 17.5 = 82.5` riskScore. The 100-point disparity drives the metricScore down to 17.5.
- **Evidence:** "Access disparity of 100 points across segments."

#### A-46 — Error Handling Analyzer (`high`, riskScore 76.5)

- **metricScore:** 23.5 / 100 (lower_better)
- **Root cause:** Error message clarity 20%, recovery success 0%, remediation coverage 40%. Only 2 error cases supplied.
- **Why high:** For lower_better, the analyzer's own priorityScore = 76.5 (likely computed from findings severity, not raw metricScore). The analyzer downgraded from critical to high due to `limited_data` (only 2 cases, needs >= 3).
- **Evidence:** "Error messages are frequently non-actionable. Recovery success rate is below target. Remediation guidance coverage is below target."

#### A-04 — Data Quality Analyzer (`high`, riskScore 61.5)

- **metricScore:** 38.5 / 100 (higher_better)
- **Root cause:** Label consistency 40%, class balance 40%, freshness 35% across 20 samples.
- **Why high:** `100 - 38.5 = 61.5` riskScore. Multiple simultaneous quality deficits drive the composite metricScore down.
- **Evidence:** "Label consistency signals are weak. Class balance concerns detected. Data freshness markers are missing or stale."

### Summary

The critical/high severities are driven by **extremely poor metric scores** on core dimensions:

- **Bias & Digital Divide:** 0-17.5% performance → riskScore 82.5-100
- **Data Quality:** 38.5% performance → riskScore 61.5
- **Error Handling:** 23.5% performance + multiple warning-level findings → priorityScore 76.5 (bumped by finding severity)

---

## 2. healthScore: 28 — Computation Trace

### Source

The `healthScore: 28` is **not** computed by the analyzer suite. It is inherited from the Simplebeacon gate scan that served as input context:

```js
// ai-problem-analyzer-export.browser.js:312
const healthScore =
  options.context?.healthScore ??
  options.context?.report?.qualityScore ??
  sanitized.healthScore ??
  null;
```

### How It Is Computed

The score comes from `computeHealthScore()` in `server/lib/codebase-analyzer.cjs`:

```js
function computeHealthScore(findings, codeFilesAnalyzed) {
  if (!codeFilesAnalyzed) return null;
  const uniqueFindings = dedupeFindings(findings);
  const byTier = { production: [], documentation: [], general: [] };
  // ... classify by file path tier

  function tierDeduction(tierFindings, weight, maxDeduction) {
    const weights = { high: 8, medium: 3, low: 1 };
    const severityInCap = tierFindings.reduce(
      (acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
    const penalty =
      (severityInCap.high * 8 + severityInCap.medium * 3 + severityInCap.low * 1) * weight;
    const normalized = Math.min(100, Math.round((penalty / codeFilesAnalyzed) * 120));
    return Math.min(maxDeduction, normalized);
  }

  const deduction =
    tierDeduction(production, 1.0, 70) +
    tierDeduction(documentation, 0.35, 20) +
    tierDeduction(general, 0.15, 10);
  return Math.max(0, 100 - deduction);
}
```

**For healthScore = 28, total deduction = 72 points.**

This implies the scan that fed this analyzer suite had:

- Many findings across production, documentation, and general tiers
- Sufficient high/medium severity findings to generate a 72-point deduction
- The scan was likely a **codebase deep scan** with broad rule coverage, not the gate scan with `qualityScore: 100`

**Note:** `healthScore` and `riskScore` are intentionally decoupled:

- `healthScore` = codebase hygiene (Simplebeacon gate)
- `riskScore` = AI model behavioral risk (analyzer suite)

---

## 3. Missing Input Fields — 28 Insufficient Data Analyzers

### Core Problem

28 of 48 analyzers (58%) could not run because the input context was a **codebase scan report**, not an **AI system operational dataset**. The analyzers need runtime model signals that do not exist in source code.

### Missing Inputs by Category

| Analyzer                      | ID   | Missing Input                            | What Would Satisfy                                                   |
| ----------------------------- | ---- | ---------------------------------------- | -------------------------------------------------------------------- |
| Interpretability              | A-03 | `traces`                                 | Decision traces with inputs, outputs, confidence for model decisions |
| Catastrophic Forgetting       | A-07 | `taskSequenceScores`                     | At least two task-sequence score checkpoints                         |
| Job Displacement              | A-09 | `roleTasks`, `responseText`              | Workforce task inventory + automation exposure signals               |
| Copyright                     | A-11 | `sourceLicenses`, `similaritySignatures` | SPDX identifiers + similarity checks against licensed corpora        |
| Deepfake                      | A-13 | `mediaMetadata`                          | C2PA/content-credentials metadata for media assets                   |
| Autonomous Weapon             | A-14 | `overrideControls`, `failureModeTests`   | Safety controls + failure-mode test results                          |
| Surveillance                  | A-15 | `responseText`, `logs`                   | Surveillance deployment domain signals                               |
| Market Monopolization         | A-17 | `marketShares`                           | Provider concentration + dependency metrics                          |
| Environmental Impact          | A-18 | `metrics` / energy telemetry             | Energy-per-request + carbon footprint data                           |
| Regulatory Compliance         | A-19 | `complianceControls`                     | Mapped AI regulation controls + audit evidence                       |
| Liability                     | A-20 | `responseText`, `logs`                   | Liability/escalation documentation                                   |
| Response Consistency          | A-23 | `responses`                              | Multiple comparable response samples for same prompt                 |
| Prompt Engineering Difficulty | A-28 | `promptAttempts`                         | Attempts-to-success logs by prompt variant                           |
| Response Latency              | A-29 | `latencySamples`                         | p50/p95 latency timing samples                                       |
| Cost Barrier                  | A-30 | `pricingTiers`                           | Transparent tier pricing + cost-per-outcome data                     |
| Usage Limits                  | A-31 | `limitHitEvents`                         | Rate-limit/quota hit frequency logs                                  |
| Language Limitation           | A-34 | `localeEvaluations`                      | Multilingual benchmark results per locale                            |
| Domain Knowledge              | A-35 | `domainTasks`                            | Domain Q&A benchmarks with expert labels                             |
| Output Consistency            | A-36 | `structuredOutputs`                      | Schema-validated structured output samples                           |
| Session Management            | A-37 | `sessionTransitions`                     | Session state transition logs                                        |
| Privacy Concern               | A-38 | `privacyPolicy`, `responseText`          | Privacy policy clarity + behavior alignment signals                  |
| Content Filtering             | A-40 | `moderationDecisions`                    | Moderation decision records by policy category                       |
| Transparency                  | A-41 | `rationale`                              | Decision rationale + limitation disclosure text                      |
| Dependence Risk               | A-42 | `usageTraces`                            | AI dependency ratio + fallback governance signals                    |
| API Complexity                | A-43 | `codeText`                               | API integration code surface + SDK usage                             |
| Compatibility                 | A-44 | `compatibilityMatrix`                    | Supported platform/version matrix                                    |
| Customization Limit           | A-47 | `customizationOptions`                   | Fine-tuning pathway + adaptation success records                     |

### Why They Cannot Be Fixed by Codebase Scan Alone

These analyzers require **runtime operational data** from the AI system:

- Model inference traces (interpretability)
- Request logs with latency (response latency)
- Moderation decision logs (content filtering)
- Energy/carbon telemetry (environmental)
- User interaction data (prompt difficulty, cost barrier)

A codebase scan only provides:

- Source code patterns
- File structure
- Dependency audit
- Static security signals

**Recommendation:** To increase measured analyzer count, feed the suite with:

1. **Model inference logs** (for interpretability, latency, consistency)
2. **Evaluation benchmarks** (for language, domain knowledge, reasoning)
3. **Operational telemetry** (for energy, cost, usage limits)
4. **Policy documentation** (for privacy, liability, regulatory)

---

## 4. Analyzer Suite Summary Export

### Risk Summary

| Metric             | Value         |
| ------------------ | ------------- |
| Total Risk Score   | 528.25        |
| Average Risk Score | 26.41         |
| Overall Risk Level | Low (average) |
| Peak Severity      | critical      |
| Measured Analyzers | 20 / 48       |
| Insufficient Data  | 28 / 48       |
| Stub Analyzers     | 0             |

### Severity Distribution

| Severity | Count |
| -------- | ----- |
| critical | 2     |
| high     | 2     |
| medium   | 3     |
| low      | 13    |

### Top Priority Issues (Action Required)

| #   | Analyzer       | Severity | Risk Score | Key Finding                                      |
| --- | -------------- | -------- | ---------- | ------------------------------------------------ |
| 1   | Bias Detection | critical | 100        | 100-point parity gap across 8 subgroups          |
| 2   | Digital Divide | critical | 82.5       | 100-point access disparity across segments       |
| 3   | Error Handling | high     | 76.5       | 20% error clarity, 0% recovery rate              |
| 4   | Data Quality   | high     | 61.5       | Label inconsistency, class imbalance, stale data |
| 5   | Hallucination  | medium   | 46.67      | 66.67% hallucination rate, 6 unsupported claims  |

### Coverage Gaps (8 Prioritized)

1. **Interpretability** — No decision traces provided
2. **Catastrophic Forgetting** — No sequential task scores
3. **Job Displacement** — No workforce task signals
4. **Copyright** — No licensing domain signals
5. **Deepfake** — No synthetic media metadata
6. **Autonomous Weapon** — No lethal-autonomy markers
7. **Surveillance** — No surveillance deployment signals
8. **Market Monopolization** — No market concentration data

### Mitigation Themes

- Use deterministic evaluation fixtures and regression tests.
- Track category-specific metrics in release gates.
- Escalate high-risk findings with clear remediation owners.

### Health Score Context

- **healthScore:** 28 (Simplebeacon gate scan quality)
- **qualityScore:** Not directly comparable to analyzer risk scores
- **Note:** Gate healthScore does not override analyzer peakSeverity. They measure different dimensions.

---

_Report generated from AI Problem Analyzer Suite export v1.3.0._
