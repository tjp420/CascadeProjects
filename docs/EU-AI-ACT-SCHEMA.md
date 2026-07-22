# EU AI Act - Compliance Schema Mapping (Draft)

This document defines a proposed mapping from SimpleBeacon findings to an EU AI Act assessment schema.

Summary of fields:
- `assessmentId`: unique id for this EU AI Act assessment
- `generatedAt`: timestamp
- `project`: project metadata (name, path)
- `moduleAssessments`: array of module-level results (e.g., data governance, transparency)
- `rules`: mapped rule findings with severity and article references
- `score`: normalized compliance score

Example mapping rules:
- `data_governance`: map findings related to secrets, PII exposures, dataset manifests
- `transparency`: map findings that indicate missing documentation or model cards
- `risk_management`: map insecure code patterns, unvalidated inputs, unsafe dependencies

Use this as a baseline; teams should adapt thresholds/weights per organizational risk tolerance.
