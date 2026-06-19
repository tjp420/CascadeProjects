# AI Risk Assessment — SimpleBeacon Platform

| Field | Value |
|-------|-------|
| **System Name** | SimpleBeacon Platform |
| **Version** | 1.3.0 |
| **Assessment Date** | 2026-06-07 |
| **Assessor** | Platform Team |
| **Status** | Draft |

---

## 1. System Description

SimpleBeacon is a local-first AI code scanning and compliance platform. It performs static analysis on source code repositories to detect:
- Credential leaks and hardcoded secrets
- Debug artifacts and production residue
- AI SDK usage and EU AI Act applicability indicators
- Code quality metrics (complexity, type safety, documentation coverage)
- Security posture (headers, dependencies, governance files)

**Key characteristic:** All scans run client-side in the user's browser or local Node.js process. No source code is uploaded to servers.

---

## 2. AI System Role

| Aspect | Detail |
|--------|--------|
| **AI involvement** | The platform itself is a deterministic static analyzer. It does not use machine learning for decision-making. |
| **AI SDK detection** | The scanner detects imports of AI SDKs (OpenAI, Anthropic, LangChain, etc.) in **user code** to flag EU AI Act applicability. |
| **No AI inference** | SimpleBeacon does not call LLM APIs, perform biometric analysis, or make automated decisions about individuals. |
| **Human oversight** | All scan results require human review. The tool provides recommendations, not autonomous actions. |

---

## 3. Risk Classification (Annex III)

| Criterion | Assessment | Rationale |
|-----------|------------|-----------|
| Biometric identification | **No** | No face, fingerprint, or iris detection |
| Social scoring | **No** | No individual ranking or profiling |
| Critical infrastructure | **No** | Not managing transport, energy, or water |
| Education/employment | **No** | Not used for admissions or hiring decisions |
| Law enforcement | **No** | Not used by police or judiciary |
| Migration/asylum | **No** | Not used for visa or border control |
| Democratic processes | **No** | Not used for elections or voting |
| Healthcare | **No** | Not used for diagnosis or treatment |
| Credit/insurance | **No** | Not used for underwriting or scoring |

**Conclusion:** SimpleBeacon is **not a high-risk AI system** under Annex III.

---

## 4. Risk Management Measures

| Risk | Likelihood | Severity | Mitigation | Residual Risk |
|------|------------|----------|------------|---------------|
| False positive in credential detection | Medium | Low | Manual review required; redaction applied | Low |
| Test fixture flagged as real secret | High | Low | `selfReferenceFilter` excludes test files | Low |
| User uploads actual secrets to scanner | Low | Medium | Client-side scanning; no network upload | Low |
| EU AI Act false positive (generic AI SDK) | Medium | Low | Pattern-based detection with domain filters | Low |
| Outdated compliance rules | Medium | Medium | Regular scanner rule updates; semver releases | Low |

---

## 5. Data Governance

| Field | Detail |
|-------|--------|
| **Data processed** | User source code (local only) |
| **Data retention** | None — code never leaves user's machine |
| **Training data** | N/A — deterministic rule engine, no ML training |
| **Bias sources** | N/A — regex and AST pattern matching |
| **Quality assurance** | Unit tests for each analyzer; sample repo validation |

---

## 6. Human Oversight

| Measure | Implementation |
|---------|-----------------|
| **Override mechanism** | Users can dismiss any finding in the UI |
| **Review checkpoints** | All certificates require explicit "Generate" click |
| **Operator training** | README and in-tool remediation guides |
| **Audit trail** | Scan reports saved locally as JSON; no central logging |

---

## 7. Transparency Measures

| Requirement | Status |
|-------------|--------|
| AI disclosure to users | ✅ Platform UI clearly states it is a scanning tool |
| Synthetic content labeling | N/A — does not generate media |
| Deepfake detection | N/A — not in scope |

---

## 8. Conclusion

SimpleBeacon is a **low-risk** static analysis tool under the EU AI Act. It does not perform any prohibited practices under Article 5, nor does it fall under any Annex III high-risk category. The primary compliance obligation is transparency (Article 50) — ensuring users understand the tool's AI detection capabilities.

**Next Review Date:** 2026-12-07
