# EU Declaration of Conformity — SimpleBeacon Sovereign Engine

**Manufacturer:** SimpleBeacon Development Team  
**Product:** SimpleBeacon Sovereign Engine v1.3.0  
**Declaration Date:** 2026-06-07  
**Applicable Regulation:** Regulation (EU) 2024/1689 (Artificial Intelligence Act)

---

## 1. Product Identification

| Attribute                | Value                                             |
| ------------------------ | ------------------------------------------------- |
| Product Name             | SimpleBeacon Sovereign Engine                     |
| Version                  | 1.3.0                                             |
| Type                     | Static code analysis and compliance scanning tool |
| AI System Classification | Minimal-risk AI system (Article 6, not Annex III) |
| Operating Modes          | Browser Sandbox, CLI (Node.js)                    |

## 2. Applicable Requirements

The following EU AI Act articles have been assessed and satisfied:

| Article | Requirement                 | Status    | Evidence                                                                  |
| ------- | --------------------------- | --------- | ------------------------------------------------------------------------- |
| Art. 5  | Prohibited AI Practices     | Compliant | No prohibited practices implemented                                       |
| Art. 6  | Classification as high-risk | Compliant | Not classified as high-risk; Annex III assessment in `risk-assessment.md` |
| Art. 9  | Risk management system      | Compliant | `risk-assessment.md` — continuous risk monitoring established             |
| Art. 10 | Data governance             | Compliant | Local processing by default; `--anonymize` flag available                 |
| Art. 50 | Transparency obligations    | Compliant | Disclosure markers in UI; confidence scores provided                      |

## 3. Standards & Specifications Applied

| Standard          | Application                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| ISO/IEC 27001     | Information security management (local processing, encryption at rest) |
| OWASP Top 10      | Security scanning aligned with web application security risks          |
| SPDX License List | Open-source license identification and compatibility checking          |

## 4. Technical Documentation

The following documents support this declaration:

1. `risk-assessment.md` — Risk management system (Article 9)
2. `model-card.md` — Model description and intended use
3. `technical-documentation.md` — System architecture and data flow
4. `AI-SYSTEM.md` — AI system classification and transparency measures

## 5. Conformity Assessment

**Assessment Type:** Internal production control (Module A)  
**Assessment Body:** Internal development team  
**Assessment Date:** 2026-06-07

The manufacturer declares that the product described above satisfies all applicable requirements of Regulation (EU) 2024/1689.

---

**Signed on behalf of the manufacturer:**

SimpleBeacon Development Team  
Date: 2026-06-07

---

_This declaration is issued under the sole responsibility of the manufacturer._
