# Technical Documentation — SimpleBeacon AI System

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Input Layer                             │
│  Browser Sandbox (drag/drop)  │  CLI (local filesystem)   │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────────────────┐
│              Analysis Pipeline                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Gate     │ │ Analyzer │ │ Language │ │ Build      │  │
│  │ Scanner  │ │ Registry │ │ Detector │ │ Readiness  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└──────────────────┬────────────────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────────────────┐
│              Report Builder                                │
│  EU AI Act  │  Gate Report  │  Remediation  │  Certificate │
└────────────────────────────────────────────────────────────┘
```

## 2. Core Components

### 2.1 Pattern Registry (`scanner-engine.js`)

32 analyzer modules mapped to regex patterns:

| Module ID | Name               | Detection Method                            |
| --------- | ------------------ | ------------------------------------------- |
| 1         | Gate Scan          | Credential regex + AI SDK import patterns   |
| 2         | Consolidation      | Content hashing for duplicate detection     |
| 3         | Mock Data          | Filename pattern matching                   |
| 4         | Roadmap            | TODO/FIXME/HACK comment regex               |
| 5-32      | Extended Analyzers | Language-specific AST-like pattern matching |

### 2.2 Exclusion Engine

Files are filtered through `EXCLUSION_RULES` profiles:

- `aiIndicators` — excludes node_modules, test files, scanner artifacts
- `noArtifacts` — excludes build output, samples, TypeScript defs
- `sourceCodeOnly` — limits to actual source code files

### 2.3 Category Collectors

Findings are routed to appropriate counters:

- `aiIndicators` → `aiHits[]`, `aiFindings[]`
- `credentials` → `credentialHits`, `credentialFindings[]`
- `debugArtifacts` → `debugHits[]`, `debugFindings[]`
- etc.

### 2.4 Report Section Builder

`buildAnalyzerSections()` generates uniform output from `REPORT_SECTION_SCHEMA`:

```javascript
{
  sectionHits: Number,
  sectionFindings: [{ file, type, matches: [{ line, snippet }] }],
  summary: String
}
```

## 3. Data Flow

1. **File Input** — `webkitRelativePath` normalized to forward slashes
2. **Pre-filtering** — `node_modules`, `.git`, build artifacts excluded
3. **Text Extraction** — First 10,000 chars per file for pattern matching
4. **Pattern Matching** — Each enabled analyzer runs regex against file content
5. **Exclusion Check** — `EXCLUSION_RULES` filters false positives
6. **Collection** — `CATEGORY_COLLECTORS` increment counters and store findings
7. **Report Assembly** — `buildAnalyzerSections()` + manual sections → final report
8. **Certificate Generation** — `generateSovereignCertificate()` builds ZIP from report

## 4. Quality & Governance

| Aspect            | Implementation                                               |
| ----------------- | ------------------------------------------------------------ |
| Confidence Scores | 0.70-0.98 per finding type                                   |
| Human Review      | All gate failures require explicit approval                  |
| Audit Trail       | Local scan logs + optional `--anonymize` export              |
| Bias Mitigation   | Pattern-based detection (no ML training on proprietary code) |
| Versioning        | Report schema version 2, semantic versioning for engine      |

## 5. Deployment Modes

### Browser Sandbox

- **Runtime:** Client browser (Chrome, Firefox, Edge)
- **Scope:** Single folder upload
- **Limitations:** No npm audit CVE data, file size limits

### CLI Tool

- **Runtime:** Node.js 18+
- **Scope:** Full repository + npm audit integration
- **Output:** JSON reports, markdown, HTML certificates

## 6. Maintenance Procedures

| Procedure                  | Command / Action                               | Frequency   |
| -------------------------- | ---------------------------------------------- | ----------- |
| Update pattern registry    | Edit `PATTERN_REGISTRY` in `scanner-engine.js` | Quarterly   |
| Run test suite             | `node --test tests/dashboard.test.js`          | Per release |
| EU AI Act compliance check | Review `risk-assessment.md` + `AI-SYSTEM.md`   | Quarterly   |
| Dependency audit           | `npm audit`                                    | Weekly      |

---

_Document satisfies EU AI Act Annex IV technical documentation requirements._
