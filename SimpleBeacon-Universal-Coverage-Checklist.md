# SimpleBeacon Universal Coverage Checklist

> Based on codebase analysis of `coming-soon/js/dashboard/scanner-engine.js` and `js/scan-worker.js`

---

## Critical Gaps (Blocking Universal Adoption)

- [ ] **Multi-language root detection**
  - Current: Only detects `package.json`, `.simplebeacon/`, `server.cjs`
  - Missing: `pyproject.toml`, `pom.xml`, `go.mod`, `Cargo.toml`, `composer.json`, `Gemfile`, `build.gradle`, `CMakeLists.txt`

- [ ] **Language-agnostic debug artifact detection**
  - Current: `console.log`, `debugger`, `alert()` (JavaScript only)
  - Missing: `print()`, `printf()`, `System.out.println()`, `fmt.Println()`, `println!`, `echo`, `var_dump()`, `console.WriteLine()`

- [ ] **Multi-ecosystem build readiness**
  - Current: npm-specific checks (`package-lock.json`, `yarn.lock`, `vite.config`, `webpack`, `husky`, `.npmignore`)
  - Missing: Maven/Gradle, pip/virtualenv, cargo, composer, bundler, cocoapods, nuget

- [ ] **Credential pattern expansion**
  - Current: Regex for `password=`, `api_key=`, `secret_key=`, `AWS_ACCESS_KEY_ID`
  - Missing: YAML/JSON config secrets, `.env` file analysis, Kubernetes secrets, Terraform state, OAuth flows, JWT hardcoding

---

## Compliance Frameworks (Currently EU AI Act Only)

- [ ] **HIPAA** (US healthcare)
  - PHI detection patterns
  - Audit log verification
  - Encryption-at-rest checks
- [ ] **PCI-DSS** (payment processing)
  - PAN (Primary Account Number) patterns
  - CVV/credit card regex
  - TLS/SSL config verification
- [ ] **SOC 2 Type II**
  - Access control evidence
  - Change management artifacts
  - Monitoring/logging requirements
- [ ] **FedRAMP** (US government)
  - NIST control mapping
  - FIPS 140-2 references
  - Boundary documentation
- [ ] **GDPR** (data privacy)
  - PII detection (email, phone, SSN, IP)
  - Data retention policy markers
  - Consent mechanism checks
- [ ] **CCPA/CPRA** (California privacy)
  - Consumer rights documentation
  - Opt-out mechanism verification

---

## Language-Specific Analyzers

### Backend Languages

- [ ] **Python**
  - `pylint`/`flake8` integration
  - `requirements.txt` / `pyproject.toml` audit
  - Django/Flask security patterns
- [ ] **Java**
  - `pom.xml` dependency audit
  - Spring Boot config analysis
  - `log4j` / known CVE patterns
- [ ] **Go**
  - `go.mod` vulnerability scan
  - `gosec` pattern integration
  - Goroutine leak detection
- [ ] **Rust**
  - `Cargo.toml` audit
  - `clippy` pattern detection
  - Unsafe block analysis
- [ ] **C/C++**
  - Buffer overflow patterns
  - Memory leak markers
  - `valgrind` output parsing
- [ ] **C# / .NET**
  - `*.csproj` package audit
  - `appsettings.json` secrets
  - Entity Framework migration checks
- [ ] **PHP**
  - `composer.json` audit
  - `php.ini` security settings
  - SQL injection patterns
- [ ] **Ruby**
  - `Gemfile` audit
  - Rails security patterns
  - ERB template injection

### Mobile & Embedded

- [ ] **Swift / Objective-C** (iOS)
  - `Podfile` / `Package.swift` audit
  - Keychain usage patterns
  - ATS (App Transport Security) config
- [ ] **Kotlin / Java** (Android)
  - `build.gradle` dependency audit
  - ProGuard/R8 rules
  - Manifest permission bloat
- [ ] **Dart** (Flutter)
  - `pubspec.yaml` audit
  - Platform channel security
- [ ] **C#** (Unity)
  - Asset bundle security
  - IL2CPP configuration
- [ ] **Embedded C**
  - Stack overflow patterns
  - MISRA C compliance
  - RTOS config checks

---

## Framework & Platform Awareness

- [ ] **Frontend frameworks**
  - React: `useEffect` cleanup, prop-types, XSS via `dangerouslySetInnerHTML`
  - Vue: `v-html` usage, mixin patterns
  - Angular: `bypassSecurityTrustHtml`, AOT compilation checks
  - Svelte: store patterns, reactive statements

- [ ] **Backend frameworks**
  - Express.js: middleware ordering, helmet.js presence
  - Django: `DEBUG=True`, CSRF config
  - Spring Boot: actuator endpoints, security config
  - Rails: strong parameters, mass assignment
  - Laravel: `.env` exposure, debug mode

- [ ] **Infrastructure**
  - Docker: `Dockerfile` best practices (no `latest`, multi-stage, non-root)
  - Kubernetes: resource limits, security contexts, secret mounting
  - Terraform: state file exposure, hardcoded credentials
  - AWS: IAM policy analysis, S3 bucket public access
  - Azure: ARM template secrets, RBAC config
  - GCP: service account key exposure

---

## IDE & CI/CD Integration

- [ ] **IDE Plugins**
  - [ ] VS Code extension (real-time scanning)
  - [ ] JetBrains plugin (IntelliJ, PyCharm, GoLand)
  - [ ] Vim/Neovim plugin
  - [ ] Emacs mode

- [ ] **CI/CD Integration**
  - [ ] GitHub Actions (official action)
  - [ ] GitLab CI/CD template
  - [ ] Jenkins plugin
  - [ ] CircleCI orb
  - [ ] Azure DevOps task
  - [ ] Bitbucket Pipes

- [ ] **Pre-commit hooks**
  - [ ] Native `simplebeacon-pre-commit` package
  - [ ] `lint-staged` integration
  - [ ] Husky v9+ compatibility

---

## Automatic Remediation (Currently Read-Only)

- [ ] **Auto-fix capabilities**
  - [ ] Remove `console.log` / `debugger` automatically
  - [ ] Add `.env` to `.gitignore` if missing
  - [ ] Generate `eslint.config.js` with recommended rules
  - [ ] Update `package.json` scripts with scan commands
  - [ ] Delete detected bloat files (with approval)
  - [ ] Generate `Dockerfile` from project type detection

- [ ] **PR generation**
  - [ ] GitHub PR with fixes
  - [ ] GitLab MR with fixes
  - [ ] Branch naming convention
  - [ ] Commit message templates

---

## Enterprise Features

- [ ] **SSO / SAML / OIDC authentication**
- [ ] **Role-based access control (RBAC)**
  - Admin, Manager, Developer, Viewer roles
  - Team-based project isolation
- [ ] **Audit logging**
  - Who ran what scan when
  - Export compliance evidence
- [ ] **SARIF output**
  - GitHub Advanced Security compatible
  - Azure DevOps Security tab compatible
- [ ] **Custom rule engine**
  - YAML/JSON rule definition
  - Regex + AST-based rules
  - Community rule marketplace

---

## UX & Accessibility

- [ ] **Non-technical dashboard**
  - Business-friendly language (replace "debug artifacts" with "development-only code")
  - Risk scoring in dollars/legal terms
  - One-click compliance report generation
- [ ] **Multi-language UI**
  - Spanish, French, German, Japanese, Chinese
- [ ] **Accessibility audit**
  - WCAG 2.1 AA compliance
  - Screen reader testing
  - Keyboard navigation

---

## Progress Tracker

| Phase                            | Status      | Completion |
| -------------------------------- | ----------- | ---------- |
| JS/Node.js core                  | Complete    | 100%       |
| Multi-language support           | Not started | 0%         |
| Additional compliance frameworks | Not started | 0%         |
| IDE/CI integration               | Partial     | 15%        |
| Auto-remediation                 | Not started | 0%         |
| Enterprise features              | Not started | 0%         |
| Universal UX                     | Not started | 0%         |

---

_Generated from codebase analysis on 2026-06-07_
