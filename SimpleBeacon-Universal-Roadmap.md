# SimpleBeacon Universal Coverage — Implementation Plan

> Phase-based roadmap to expand from JS/Node specialist to universal code quality platform
> Guiding principle: The Broom Strategy — fix code inline, no new modules unless essential

---

## Phase 1: Foundation (Weeks 1–2)
**Goal:** Make the existing JS scanner robust enough to serve as the architecture template

### 1.1 Refactor scanner-engine.js for extensibility
- [ ] Extract `extractMatches()` into a standalone utility with language-specific context
- [ ] Create a `LANGUAGE_PROFILES` registry (map of file extensions → analyzer configs)
- [ ] Move all regex patterns into a `PATTERN_REGISTRY` object keyed by language/framework
- [ ] Add `detectProjectRoot()` with support for multi-ecosystem marker files

### 1.2 Root detection expansion
Add detection for:
- Python: `pyproject.toml`, `setup.py`, `requirements.txt`
- Java: `pom.xml`, `build.gradle`
- Go: `go.mod`
- Rust: `Cargo.toml`
- PHP: `composer.json`
- Ruby: `Gemfile`
- .NET: `*.csproj`, `*.sln`

### 1.3 Build readiness expansion
Extend `buildReadiness` checks to recognize:
- Python: `requirements.txt`, `setup.py`, `tox.ini`, `pytest.ini`
- Java: `pom.xml`, `build.gradle`, `gradlew`
- Go: `go.mod`, `go.sum`, `Makefile`
- Rust: `Cargo.toml`, `Cargo.lock`, `rustfmt.toml`

### Deliverable
JS/Node scanner still works identically, but internal structure supports plugin architecture.

---

## Phase 2: Language Plugins — Python & Java (Weeks 3–4)
**Goal:** Prove the plugin model with two major backend languages

### 2.1 Python analyzer module
- [ ] `PYTHON_PATTERNS` in registry:
  - Debug: `print(`, `pprint(`, `logging.debug(`, `breakpoint()`
  - Credentials: `os.environ.get(`, `config.get(`, `.env` file patterns
  - Framework: Django `DEBUG = True`, Flask `app.run(debug=True)`
  - Dependencies: `requirements.txt` audit, `pip` vulnerability check planned
- [ ] File extension mapping: `.py`, `.pyw`, `.pyi`
- [ ] Root detection: `pyproject.toml`, `setup.py`, `requirements.txt`

### 2.2 Java analyzer module
- [ ] `JAVA_PATTERNS` in registry:
  - Debug: `System.out.print`, `System.err.print`, `e.printStackTrace()`
  - Credentials: hardcoded DB connection strings, `password = "..."`
  - Framework: Spring Boot `application.properties` secrets, `log4j` CVE patterns
  - Dependencies: `pom.xml` dependency count, `build.gradle` plugin audit
- [ ] File extension mapping: `.java`, `.kt`, `.scala`, `.groovy`
- [ ] Root detection: `pom.xml`, `build.gradle`

### 2.3 Web Worker update
- [ ] Worker receives `language` parameter alongside file list
- [ ] Routes files to correct analyzer based on extension
- [ ] Returns unified result format regardless of source language

### Deliverable
Users can scan Python and Java repos with the same UI. Roadmap phases adapt language in descriptions.

---

## Phase 3: Go, Rust, C/C++ Systems Languages (Weeks 5–6)
**Goal:** Cover compiled languages with memory/security focus

### 3.1 Go analyzer
- [ ] Patterns: `fmt.Println(`, `log.Print(`, `panic(`, hardcoded `http.Client` configs
- [ ] `go.mod` dependency audit planned
- [ ] File extensions: `.go`

### 3.2 Rust analyzer
- [ ] Patterns: `println!(`, `eprintln!(`, `dbg!(`, `unsafe {` block detection
- [ ] `Cargo.toml` audit, `clippy` disable flags
- [ ] File extensions: `.rs`

### 3.3 C/C++ analyzer
- [ ] Patterns: `printf(`, `fprintf(`, `malloc(`, `strcpy(`, `gets(` (unsafe)
- [ ] Buffer overflow risk markers
- [ ] File extensions: `.c`, `.cpp`, `.h`, `.hpp`, `.cc`

### 3.4 Security-focused rule upgrade
- [ ] Add buffer overflow, use-after-free, null dereference patterns
- [ ] Flag `strcpy`, `strcat`, `sprintf`, `gets` as high severity
- [ ] Memory allocation without NULL check

### Deliverable
Systems-language projects get relevant findings. Security scanner gains actual depth beyond credential regex.

---

## Phase 4: Mobile & Web Frontend (Weeks 7–8)
**Goal:** Cover the other half of the software industry

### 4.1 iOS (Swift/Obj-C)
- [ ] Patterns: `print(`, `NSLog(`, hardcoded API keys in `Info.plist`
- [ ] `Podfile` / `Package.swift` audit
- [ ] File extensions: `.swift`, `.m`, `.mm`

### 4.2 Android (Kotlin/Java)
- [ ] Patterns: `Log.d(`, `Log.e(`, `System.out.print`, hardcoded Firebase configs
- [ ] `build.gradle` dependency audit
- [ ] File extensions: `.kt`, `.java`

### 4.3 Flutter (Dart)
- [ ] Patterns: `print(`, `debugPrint(`, hardcoded `baseUrl` in Dart code
- [ ] `pubspec.yaml` audit
- [ ] File extensions: `.dart`

### 4.4 Frontend framework awareness
- [ ] React: `dangerouslySetInnerHTML`, missing `key` prop, `eval()` usage
- [ ] Vue: `v-html` usage, `$refs` manipulation
- [ ] Angular: `bypassSecurityTrustHtml`, `innerHTML`
- [ ] Svelte: reactive statement complexity

### Deliverable
Mobile and modern frontend teams can use SimpleBeacon. Framework-specific rules reduce false positives.

---

## Phase 5: Infrastructure & DevOps (Weeks 9–10)
**Goal:** Scan the code that deploys the code

### 5.1 Docker
- [ ] Dockerfile best practices:
  - `FROM` using `latest` tag
  - Running as root (`USER` missing)
  - Secrets in `ENV` or `ARG`
  - `ADD` vs `COPY` usage
  - Missing `.dockerignore`

### 5.2 Kubernetes
- [ ] YAML patterns:
  - `securityContext` missing
  - `resources` limits missing
  - Secrets in plain YAML (`stringData:`)
  - `hostPath` volumes
  - `privileged: true`

### 5.3 Terraform
- [ ] `.tf` file patterns:
  - Hardcoded credentials in provider blocks
  - `s3_bucket_acl = "public-read"`
  - `password = "..."`
  - State file not in remote backend

### 5.4 CI/CD pipeline analysis
- [ ] GitHub Actions: secret leakage in workflow files
- [ ] `.gitlab-ci.yml`: hardcoded tokens
- [ ] Jenkins: credential exposure in `Jenkinsfile`

### Deliverable
DevOps teams get actionable infrastructure security findings.

---

## Phase 6: Compliance Frameworks (Weeks 11–14)
**Goal:** Expand beyond EU AI Act to major global standards

### 6.1 HIPAA (US Healthcare)
- [ ] PHI pattern detection:
  - SSN: `\b\d{3}-\d{2}-\d{4}\b`
  - Phone: `\b\d{3}-\d{3}-\d{4}\b`
  - Email in source code
  - Medical record number patterns
- [ ] Encryption check markers
- [ ] Audit log requirement verification

### 6.2 PCI-DSS (Payment Processing)
- [ ] PAN detection: `\b(?:\d[ -]*?){13,16}\b`
- [ ] CVV patterns: `\b\d{3,4}\b` near `cvv`/`security_code`
- [ ] TLS version checks in config files
- [ ] Hardcoded payment gateway keys

### 6.3 GDPR (EU Data Privacy)
- [ ] PII detection (email, phone, IP, name patterns)
- [ ] Data retention policy documentation check
- [ ] Cookie consent mechanism markers
- [ ] Right-to-erasure implementation evidence

### 6.4 SOC 2 Type II
- [ ] Access control documentation
- [ ] Change management artifacts
- [ ] Monitoring/logging configuration evidence
- [ ] Incident response plan presence

### Deliverable
Compliance dashboard shows framework selection (EU AI Act, HIPAA, PCI-DSS, GDPR, SOC 2). Roadmap phases adapt to selected framework.

---

## Phase 7: IDE & CI/CD Integration (Weeks 15–18)
**Goal:** Meet developers where they already work

### 7.1 VS Code Extension
- [ ] Real-time file scanning on save
- [ ] Sidebar panel showing current file findings
- [ ] One-click fix suggestions
- [ ] Status bar quality score

### 7.2 Pre-commit Hook (native)
- [ ] `simplebeacon-pre-commit` npm package
- [ ] Staged-file scanning (fast path)
- [ ] Block commit on credential detection
- [ ] Configurable severity threshold

### 7.3 GitHub Action
- [ ] `simplebeacon/action` official action
- [ ] SARIF output for GitHub Advanced Security
- [ ] PR comment with findings
- [ ] Badge generation for README

### 7.4 GitLab CI Template
- [ ] `.gitlab-ci.yml` template
- [ ] MR comment integration
- [ ] Pipeline fail on gate failure

### Deliverable
SimpleBeacon runs in developer workflow, not as a separate tool. Scanning happens automatically.

---

## Phase 8: Auto-Remediation (Weeks 19–22)
**Goal:** Convert findings into fixes automatically

### 8.1 Safe auto-fixes
- [ ] Remove `console.log` / `print()` / `System.out.print()` (with backup)
- [ ] Add missing `.gitignore` entries
- [ ] Generate `eslint.config.js` / `pyproject.toml` / equivalent config
- [ ] Delete confirmed bloat files
- [ ] Update `package.json` / `requirements.txt` scripts

### 8.2 PR generation
- [ ] Create fix branch: `simplebeacon/fix-<timestamp>`
- [ ] Commit with standardized message: `chore(simplebeacon): remove debug artifacts`
- [ ] Open PR/MR with finding summary
- [ ] Link to compliance framework requirements

### 8.3 One-click fixes in UI
- [ ] Dashboard shows "Fix" button per finding
- [ ] Preview diff before applying
- [ ] Batch fix multiple similar findings

### Deliverable
Developers can resolve findings without manual editing. Compliance teams get evidence of remediation.

---

## Phase 9: Enterprise & Scale (Weeks 23–26)
**Goal:** Make SimpleBeacon viable for Fortune 500 deployment

### 9.1 Authentication & Authorization
- [ ] SSO via SAML 2.0 / OIDC
- [ ] RBAC: Admin, Manager, Developer, Auditor, Viewer
- [ ] Team-based project isolation
- [ ] API key management

### 9.2 Audit & Evidence
- [ ] Complete audit log: who scanned what, when, with what results
- [ ] Export compliance evidence packages
- [ ] Immutable scan history
- [ ] Digital signature on certificates

### 9.3 Performance at Scale
- [ ] Incremental scanning (only changed files)
- [ ] Distributed scan workers
- [ ] Caching layer for dependency audits
- [ ] Parallel analyzer execution

### 9.4 Custom Rule Engine
- [ ] YAML-based rule definition:
  ```yaml
  rules:
    - id: no-hardcoded-secrets
      languages: [js, py, java]
      patterns:
        - regex: 'api[_-]?key\s*=\s*["\'][^"\']{12,}["\']'
      severity: critical
      message: "Hardcoded API key detected"
  ```
- [ ] Community rule marketplace
- [ ] Rule testing framework

### Deliverable
Enterprise sales ready. Custom rules allow vertical-specific expansion (healthcare, finance, government).

---

## Phase 10: Accessibility & Universal UX (Weeks 27–28)
**Goal:** Anyone can use it, regardless of technical background

### 10.1 Non-technical Dashboard
- [ ] Business-friendly language toggle
- [ ] Risk scoring in legal/financial terms
- [ ] One-click compliance report (PDF)
- [ ] Executive summary auto-generation

### 10.2 Localization
- [ ] UI translations: Spanish, French, German, Japanese, Chinese, Portuguese
- [ ] Finding descriptions in local language
- [ ] Compliance framework regional variants

### 10.3 Accessibility
- [ ] WCAG 2.1 AA audit
- [ ] Screen reader compatibility
- [ ] Keyboard-only navigation
- [ ] Color-blind safe severity indicators

### Deliverable
SimpleBeacon is usable by compliance officers, project managers, and executives without engineering support.

---

## Cost & Resource Estimate

| Phase | Duration | Dev Effort | Blockers |
|-------|----------|------------|----------|
| 1. Foundation | 2 weeks | 1 senior dev | None |
| 2. Python + Java | 2 weeks | 1 senior dev | Phase 1 |
| 3. Go/Rust/C++ | 2 weeks | 1 senior dev | Phase 1 |
| 4. Mobile + Frontend | 2 weeks | 1 senior dev | Phase 1 |
| 5. Infrastructure | 2 weeks | 1 senior dev | Phase 1 |
| 6. Compliance | 4 weeks | 1 senior + 1 compliance advisor | Phases 1–5 |
| 7. IDE/CI | 4 weeks | 1 senior dev | Phase 1 |
| 8. Auto-fix | 4 weeks | 1 senior dev | Phases 1–5 |
| 9. Enterprise | 4 weeks | 1 senior + 1 DevOps | Phases 1–8 |
| 10. UX/Accessibility | 2 weeks | 1 UX + 1 frontend dev | Phases 1–9 |
| **Total** | **28 weeks** | **~2 FTE sustained** | Sequential |

---

## Recommended MVP Scope (First 8 Weeks)

If shipping to customers ASAP, prioritize:

1. **Phase 1** (Foundation) — mandatory refactor
2. **Phase 2** (Python + Java) — cover 60% of backend market
3. **Phase 4** (Mobile) — iOS + Android (huge market)
4. **Phase 6** (GDPR + PCI-DSS) — most requested compliance frameworks
5. **Phase 7** (GitHub Action) — maximum developer adoption

**Cut for later:** Rust/C++ depth, Terraform, SOC 2, VS Code extension, auto-remediation, SSO, localization.

---

## Success Metrics

| Metric | Current | 6-Month Target | 12-Month Target |
|--------|---------|----------------|-----------------|
| Supported languages | 1 (JS/Node) | 5 (JS, Python, Java, Go, Swift) | 12+ |
| Compliance frameworks | 1 (EU AI Act) | 4 (+ HIPAA, PCI-DSS, GDPR) | 8+ |
| CI/CD integrations | 0 | 2 (GitHub Actions, GitLab) | 5+ |
| Auto-fix coverage | 0% | 20% of findings | 50% of findings |
| Supported file extensions | ~15 | ~40 | ~80 |
| Time to scan (10k files) | ~30s | ~20s | ~10s |
| False positive rate | Unknown | <15% | <5% |

---

*Plan created 2026-06-07 — adjust based on customer feedback and resource availability*
