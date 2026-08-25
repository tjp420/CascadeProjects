# AI System Risk Assessment

## System Classification

**System Name**: SimpleBeacon AI Platform  
**Assessment Date**: 2026-06-14  
**Version**: 1.0.0  
**Last Reviewed**: 2026-06-14 (Phase 6 Quality Optimization)

## Annex III Classification Review

### High-Risk AI Indicators

This platform provides code analysis and compliance scanning capabilities. Based on Annex III of the EU AI Act:

**Status**: Not classified as high-risk AI system

**Rationale**:

- The platform is a developer tool for static code analysis and compliance checking
- It does not make automated decisions about individuals with legal or similarly significant effects
- It does not evaluate or classify individuals for employment, education, or essential services
- It does not control critical infrastructure or safety-critical systems
- It operates as a diagnostic and reporting tool for code quality and compliance

### Risk Category: Minimal Risk

The SimpleBeacon platform falls under the minimal risk category as it:

- Provides information and recommendations to developers
- Does not make binding decisions
- Requires human review and interpretation of findings
- Operates under explicit user control and direction

## Risk Register

| Risk ID | Identified Risk                                                          | Likelihood | Impact | Risk Level | Mitigation Measure                                                                                              | Residual Risk |
| ------- | ------------------------------------------------------------------------ | ---------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------- | ------------- |
| R01     | LLM hallucination in `--fix` suggestions causes incorrect code changes   | Medium     | High   | **High**   | Local diff preview requires explicit human approval before applying; gate failures never auto-merged            | Low           |
| R02     | AI proxy gateway fails to detect credential leak in outbound API request | Low        | High   | Medium     | Layered DLP screening + monitor-only mode + inference audit logging with trace IDs                              | Low           |
| R03     | Anonymized export misses sensitive data, leaking IP in CI pipeline       | Low        | Medium | Low        | Privacy-blind tokenization strips all file paths, descriptions, and snippets; audit of export samples           | Low           |
| R04     | Pattern-based scanner misses novel vulnerability (false negative)        | Medium     | Medium | Medium     | Monthly pattern updates + configurable sensitivity + seeded fixture validation suite                            | Low           |
| R05     | EU AI Act classification changes due to new product features             | Low        | High   | Medium     | Quarterly classification review + explicit feature gate for Annex III-style rules + legal review before release | Low           |

## Risk Matrix

|                        | Impact: Low | Impact: Medium | Impact: High |
| ---------------------- | ----------- | -------------- | ------------ |
| **Likelihood: High**   | Medium      | High           | High         |
| **Likelihood: Medium** | Low         | Medium         | High         |
| **Likelihood: Low**    | Low         | Low            | Medium       |

**Position:** Post-mitigation residual risk is predominantly **Low**.

## Risk Mitigation Measures

### Transparency

- All scan results are generated locally on user machines
- Clear documentation of scan scope and limitations
- User controls all scan parameters and targets
- Article 50 disclosure markers embedded in user-facing AI endpoints
- MCP `list_rulesets` tool exposes banned patterns to external agents

### Human Oversight

- Developers review and interpret all scan findings
- Platform provides recommendations, not mandatory actions
- Users maintain full control over code changes and deployments
- Local remediation (`--fix`) presents diff for explicit approval before applying
- Gate failures require human review; never auto-merged

### Data Protection

- No code is transmitted to external servers unless explicitly enabled
- Local-only scanning by default
- `--anonymize` flag strips all file paths, descriptions, and code snippets from exported reports
- Encrypted per-user AI provider credentials (AES-256-GCM at rest)
- AI proxy gateway screens outbound LLM API requests for credential leaks

### Residual Risk Acceptance Criteria

- Residual risk for all identified risks must be **Low** or **Medium** before release
- Any **High** residual risk triggers a mandatory legal review and engineering mitigation plan
- Risk register is reviewed quarterly or upon any change to AI system components

## Compliance Status

- **Article 50 Transparency**: Compliant — AI-assisted analysis disclosed in UI surfaces and API documentation
- **Documentation**: This file serves as the risk assessment documentation
- **Human Oversight**: Built into workflow — developers review all findings; `--fix` requires explicit approval
- **Logging**: Scan results are logged locally for audit trails; inference calls emit structured audit events
- **Privacy-Blind Architecture**: Compliant — anonymized export engine ensures zero IP leakage from CI pipelines

## Review Schedule

- **Last reviewed**: 2026-06-14 (Phase 6 Quality Optimization)
- **Next review**: 2026-12-01 or upon significant platform changes (e.g., new LLM provider integration, high-risk pattern rule addition)
