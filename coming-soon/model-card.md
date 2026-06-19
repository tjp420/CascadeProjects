# Model Card — SimpleBeacon Sovereign Engine

## Model Details

- **Developer:** SimpleBeacon Development Team
- **Model Type:** Static code analysis engine (heuristic + rule-based)
- **Version:** 1.3.0
- **Release Date:** 2026-06-07
- **Intended Use:** Security, compliance, and quality scanning of source code repositories

## Intended Users

- Software developers reviewing code before deployment
- DevOps engineers configuring CI/CD pipelines
- Compliance officers assessing open-source license compatibility
- Security teams auditing credential exposure

## Out-of-Scope Uses

- Not for real-time production monitoring
- Not for automated code deployment without human review
- Not for evaluating individuals (hiring, credit, etc.)
- Not for medical, legal, or safety-critical decision-making

## System Architecture

| Component | Technology | Purpose |
|---|---|---|
| Pattern Matcher | RegEx engine | Detect security/compliance markers |
| File Analyzer | Static AST-like parsing | Language detection, line counting |
| Heuristic Scorer | Weighted formula | Quality score from findings |
| Report Builder | Template engine | Markdown/HTML certificate generation |

## Performance Characteristics

| Metric | Value |
|---|---|
| Supported Languages | JavaScript, TypeScript, Python, Java, Go, Rust |
| Average Scan Speed | ~1,000 files / 30 seconds (browser) |
| False Positive Rate | ~15% (confidence scores guide triage) |
| Coverage | 32 analyzer modules |

## Limitations & Risks

- Heuristic detection is pattern-based; novel obfuscation may evade detection
- Confidence scores (78-98%) indicate reliability; low-confidence findings require manual review
- Browser mode is limited to local files; CLI mode required for full npm audit CVE data

## Ethical Considerations

- Local-only processing by default ensures user code privacy
- `--anonymize` flag strips identifying information from exports
- No training on proprietary code; all patterns are manually curated

## Maintenance

| Activity | Frequency |
|---|---|
| Pattern registry update | Quarterly |
| Language support review | Bi-annually |
| EU AI Act compliance check | Quarterly |

---

*Generated for EU AI Act Annex IV technical documentation requirements.*
