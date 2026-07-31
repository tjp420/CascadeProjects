# Enterprise Service Level Agreement Addendum

## SimpleBeacon.ai — AI Risk Auditing & Compliance Platform

> **Document Type:** Schedule A — Service Level Agreement Addendum
> **Effective Date:** _______________
> **Customer:** _______________ ("Enterprise Customer")
> **Contract Reference:** _______________
> **Version:** 1.0 — July 2026

---

## 1. Service Description

SimpleBeacon.ai ("Provider") delivers a deterministic, locally-executed AI risk auditing platform that scans software codebases for AI-generated code quality issues, sensitive data leakage, shadow AI integrations, and open-source licensing violations. The platform produces cryptographically signed compliance artifacts aligned with EU AI Act (Regulation 2024/1689), GDPR, CCPA, and SOX requirements.

### 1.1 Included Services

| Service Component                             | Description                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| **SimpleBeacon CLI**                          | Deterministic scanning engine — runs 100% on customer infrastructure               |
| **Executive Risk Certificate**                | Cryptographically signed PDF with A–F risk grade and financial liability estimates |
| **EU AI Act Compliance Assessment**           | JSON report mapping findings to Article 11/12/14/19 obligations                    |
| **Azure DevOps / GitHub Actions Integration** | CI/CD pipeline gating with configurable failure thresholds                         |
| **Enterprise Admin Dashboard**                | Multi-tenant management with seat pooling, trial monitoring, and KPI overlays      |
| **Immutable Audit Ledger**                    | SHA-256 hash-chained append-only audit trail for all administrative actions        |
| **SSO Identity Federation**                   | SAML 2.0 / OIDC integration with Okta, Azure AD, Ping Identity, Auth0              |
| **Custom Rule Engine**                        | Regex and AST-walker rule authoring for organization-specific guardrails           |

### 1.2 Excluded Services

- Source code hosting or storage (scanning is ephemeral and local)
- Legal advice or regulatory interpretation (Provider supplies evidence artifacts, not legal opinions)
- Manual code remediation (Provider supplies automated fix suggestions; application is customer's responsibility)
- Third-party AI model training or fine-tuning

---

## 2. Service Level Agreements

### 2.1 Uptime & Availability

| Tier                          | Target                 | Measurement                                       | Exclusions                                                |
| ----------------------------- | ---------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| **Platform API**              | 99.9% monthly          | HTTP 200 responses to authenticated health checks | Scheduled maintenance windows (announced ≥72h in advance) |
| **Dashboard Web Application** | 99.9% monthly          | Successful page load with <5s TTFB                | CDN propagation delays outside Provider control           |
| **CLI Scanning Engine**       | 100% (local execution) | N/A — runs on customer infrastructure             | Dependent on customer hardware availability               |

### 2.2 Incident Response Times

| Severity             | Definition                                                           | Response Time | Resolution Target | Escalation                                 |
| -------------------- | -------------------------------------------------------------------- | ------------- | ----------------- | ------------------------------------------ |
| **SEV-1 (Critical)** | Platform API completely unavailable; data integrity breach suspected | 15 minutes    | 4 hours           | CTO + Account Manager notified immediately |
| **SEV-2 (High)**     | Core functionality degraded; scan reports failing to generate        | 30 minutes    | 8 hours           | Engineering Lead + Account Manager         |
| **SEV-3 (Medium)**   | Non-core feature broken; dashboard UI issues                         | 2 hours       | 24 hours          | Support Engineer                           |
| **SEV-4 (Low)**      | Cosmetic issues, documentation requests, feature questions           | 4 hours       | 5 business days   | Support Team                               |

### 2.3 Support Channels & Hours

| Plan                  | Hours                                                    | Channels                    |
| --------------------- | -------------------------------------------------------- | --------------------------- |
| **Enterprise Annual** | 24/7/365 for SEV-1/SEV-2; Business hours for SEV-3/SEV-4 | Email, phone, secure portal |
| **Enterprise Trial**  | Business hours (all severities)                          | Email, secure portal        |

### 2.4 Scan Performance Benchmarks

| Repository Size      | Target Scan Duration | Max Acceptable |
| -------------------- | -------------------- | -------------- |
| < 10,000 files       | < 30 seconds         | 60 seconds     |
| 10,000–50,000 files  | < 2 minutes          | 5 minutes      |
| 50,000–200,000 files | < 10 minutes         | 20 minutes     |
| > 200,000 files      | < 30 minutes         | 60 minutes     |

Performance measured on standard Azure DevOps `ubuntu-latest` runner (4 vCPU, 16GB RAM). Customer-specific hardware may vary.

### 2.5 Service Credits

If Provider fails to meet the 99.9% uptime target in any calendar month, Customer is entitled to service credits as follows:

| Monthly Uptime | Credit             |
| -------------- | ------------------ |
| 99.0% – 99.89% | 10% of monthly fee |
| 95.0% – 98.99% | 25% of monthly fee |
| Below 95.0%    | 50% of monthly fee |

Service credits are applied to the subsequent billing cycle and do not constitute a refund obligation. Credits must be requested within 30 days of the incident month.

---

## 3. Deployment Architecture

### 3.1 Supported Deployment Models

#### Model A: SaaS (Cloud-Hosted Dashboard + Local CLI)

```
┌─────────────────────────────────────────────────────────┐
│  Customer CI/CD Pipeline (Azure DevOps / GitHub Actions) │
│                                                          │
│  ┌──────────────┐     ┌──────────────────────────┐      │
│  │  Source Code  │────▶│  SimpleBeacon CLI Scan   │      │
│  │  Repository   │     │  (100% Local Execution)  │      │
│  └──────────────┘     └───────────┬──────────────┘      │
│                                    │                      │
│                    ┌───────────────▼──────────────┐      │
│                    │  JSON Report + Risk Grade    │      │
│                    │  (Generated Locally)         │      │
│                    └───────────────┬──────────────┘      │
│                                    │                      │
└────────────────────────────────────┼──────────────────────┘
                                     │ (API call with license token)
                                     ▼
┌─────────────────────────────────────────────────────────┐
│  SimpleBeacon Cloud Platform                             │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Enterprise   │  │  Audit Ledger│  │  SSO Identity │  │
│  │  Dashboard    │  │  (SHA-256)   │  │  Federation   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Seat Pool   │  │  PDF Cert    │  │  License      │  │
│  │  Management  │  │  Generator   │  │  Token Store  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Source code never leaves customer infrastructure**
- Only scan metadata, license tokens, and report hashes traverse the network
- Dashboard and admin APIs hosted by Provider

#### Model B: Air-Gapped (Fully On-Premises)

```
┌─────────────────────────────────────────────────────────┐
│  Customer Secure Environment (No External Network)       │
│                                                          │
│  ┌──────────────┐     ┌──────────────────────────┐      │
│  │  Source Code  │────▶│  SimpleBeacon CLI Scan   │      │
│  │  Repository   │     │  (Local Execution)       │      │
│  └──────────────┘     └───────────┬──────────────┘      │
│                                    │                      │
│                    ┌───────────────▼──────────────┐      │
│                    │  Local Report Storage        │      │
│                    │  + PDF Certificate Cache     │      │
│                    └──────────────────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │  SimpleBeacon Server (Self-Hosted)            │       │
│  │  • Dashboard (internal network only)          │       │
│  │  • Audit Ledger (local file store)            │       │
│  │  • SSO Config (local encrypted store)         │       │
│  │  • License validation (offline token)         │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

- **Zero outbound network traffic** during scanning
- Server runs on customer infrastructure with local license validation
- Audit ledger stored in customer-controlled file system
- SSO integrates with on-premises identity providers

### 3.2 Infrastructure Requirements

#### Minimum Requirements (CLI Only)

| Resource | Specification                                                                  |
| -------- | ------------------------------------------------------------------------------ |
| Runtime  | Node.js 20+                                                                    |
| OS       | Linux (Ubuntu 20.04+), macOS 12+, Windows 10+                                  |
| RAM      | 2GB free                                                                       |
| Disk     | 500MB for CLI + report cache                                                   |
| Network  | None required for scanning (license validation requires periodic connectivity) |

#### Recommended Requirements (Self-Hosted Server)

| Resource      | Specification                                    |
| ------------- | ------------------------------------------------ |
| Runtime       | Node.js 22+                                      |
| OS            | Ubuntu 22.04 LTS or equivalent                   |
| CPU           | 4 vCPU minimum, 8 vCPU recommended               |
| RAM           | 8GB minimum, 16GB recommended                    |
| Disk          | 20GB SSD (report cache + audit ledger + logs)    |
| Database      | PostgreSQL 14+ (optional, for multi-tenant RBAC) |
| Reverse Proxy | Nginx, Caddy, or Azure Application Gateway       |

### 3.3 CI/CD Integration Points

| Platform                | Integration Method                                   | Gate Enforcement                              |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------- |
| **Azure DevOps**        | Generated pipeline YAML (Provider-supplied template) | Configurable fail-on severity (high/critical) |
| **GitHub Actions**      | Pre-built action `simplebeacon-guardrails-public`    | Configurable gate + PR annotation             |
| **Bitbucket Pipelines** | CLI invocation with `--gate` flag                    | Configurable fail-on severity                 |
| **Jenkins**             | Shell step with `npx simplebeacon scan`              | Configurable gate + post-build report         |

### 3.4 Identity & Access Management

| Feature                | Specification                                                     |
| ---------------------- | ----------------------------------------------------------------- |
| **SSO Protocols**      | SAML 2.0, OpenID Connect 1.0                                      |
| **Supported IdPs**     | Okta, Azure Active Directory, Ping Identity, Auth0                |
| **Secret Encryption**  | AES-256-GCM at rest (client secrets encrypted before persistence) |
| **Domain Routing**     | Automatic email-domain → organization mapping                     |
| **Session Management** | JWT access tokens (15min) + refresh tokens (7 days)               |
| **MFA**                | WebAuthn passkey support (FIDO2-compliant)                        |

---

## 4. Security & Data Protection

### 4.1 Data Sovereignty Guarantee

| Principle                       | Implementation                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **No source code transmission** | CLI executes entirely on customer hardware; source files are never uploaded                                 |
| **No telemetry**                | Runtime socket verification scripts (`verify-isolation.js`) prove zero outbound connections during scanning |
| **Local report storage**        | Scan reports stored on customer infrastructure by default                                                   |
| **Encrypted secrets**           | SSO client secrets encrypted with AES-256-GCM before persistence                                            |
| **Immutable audit trail**       | SHA-256 hash-chained ledger — any tampering breaks the chain and is immediately detectable                  |

### 4.2 Compliance Alignment

| Regulation    | Article                              | SimpleBeacon Coverage                                                 |
| ------------- | ------------------------------------ | --------------------------------------------------------------------- |
| **EU AI Act** | Article 11 — Technical Documentation | Automated JSON compliance assessment with finding-to-article mapping  |
| **EU AI Act** | Article 12 — Record-Keeping          | Immutable audit ledger with cryptographic hash chaining               |
| **EU AI Act** | Article 14 — Human Oversight         | CI/CD gate enforcement requires human approval for flagged findings   |
| **EU AI Act** | Article 19 — Logging                 | Deterministic scan logs with timestamp, actor, and before/after state |
| **GDPR**      | Article 32 — Security of Processing  | Local execution model; no personal data transmitted                   |
| **CCPA**      | §1798.150 — Data Breach              | No customer data stored; no breach surface                            |
| **SOX**       | Section 404 — IT Controls            | Audit trail provides evidence of code review and risk assessment      |

### 4.3 Vulnerability Disclosure

- Provider maintains a coordinated vulnerability disclosure program
- Critical vulnerabilities (CVSS ≥ 9.0) patched within 72 hours of confirmation
- High vulnerabilities (CVSS 7.0–8.9) patched within 7 days
- Customer notified via secure portal within 24 hours of any vulnerability affecting their deployment

### 4.4 Penetration Testing

- Provider conducts annual third-party penetration tests
- Summary reports available to Enterprise Customers under NDA
- Customer may conduct independent penetration testing of their self-hosted deployment with 14 days' written notice

---

## 5. Audit & Reporting

### 5.1 Audit Ledger Specifications

| Property             | Specification                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Storage**          | Append-only JSON file (atomic writes via temp+rename)                                                                                                                         |
| **Integrity**        | SHA-256 hash chain — each entry embeds previous entry's hash                                                                                                                  |
| **Tamper Detection** | `verifyChain()` API validates entire chain in O(n) time                                                                                                                       |
| **Actions Tracked**  | `org_created`, `trial_started`, `seat_added`, `seat_removed`, `api_key_generated`, `azure_devops_generated`, `sso_config_created`, `sso_config_updated`, `sso_config_deleted` |
| **Entry Fields**     | eventId (UUID), timestamp, action, orgId, actor, actorIp, description, before/after state, metadata, previousHash, hash                                                       |
| **Retention**        | 365 days (configurable; longer retention available on request)                                                                                                                |

### 5.2 Customer Audit Rights

- Customer may request a full audit log export at any time via the `/api/enterprise/audit/export` endpoint
- Export includes chain verification status and all entries in JSON format
- Annual on-site audit available for Enterprise Annual customers (requires 30 days' notice)

### 5.3 Compliance Reporting Cadence

| Report                              | Frequency            | Delivery Method                                       |
| ----------------------------------- | -------------------- | ----------------------------------------------------- |
| **Executive Risk Certificate**      | Per scan (on-demand) | PDF download from dashboard                           |
| **EU AI Act Compliance Assessment** | Per scan (on-demand) | JSON download from dashboard                          |
| **Audit Trail Export**              | On-demand            | JSON download or API pull                             |
| **Chain Integrity Verification**    | On-demand            | API endpoint (`/api/enterprise/audit/verify`)         |
| **SSO Configuration Health**        | On-demand            | API endpoint (`/api/enterprise/sso/test/:providerId`) |

---

## 6. Service Credits & Remediation

### 6.1 Notification Requirements

Customer must notify Provider of any SLA breach within 5 business days of the incident. Notification must include:

- Incident timestamp (UTC)
- Affected service component
- Description of business impact
- Any error messages or logs (if available)

### 6.2 Remediation Process

1. **Acknowledgement** — Provider acknowledges receipt within the severity-appropriate response time
2. **Investigation** — Provider's engineering team investigates root cause
3. **Mitigation** — Provider implements immediate mitigation to restore service
4. **Post-Incident Review** — Provider delivers a written post-incident review within 5 business days of resolution, including:
   - Timeline of events
   - Root cause analysis
   - Corrective actions taken
   - Preventive measures implemented
5. **Service Credit Application** — If applicable, credit applied to next billing cycle

### 6.3 Limitations

- Service credits apply only to fees paid for the affected service component
- Maximum aggregate service credits in any 12-month period shall not exceed 50% of the annual contract value
- Credits are non-transferable and have no cash value
- Scheduled maintenance windows do not count against uptime calculations

---

## 7. Data Processing Addendum (DPA) Summary

### 7.1 Data Categories

| Data Category            | Collected     | Stored                                        | Retention                                  |
| ------------------------ | ------------- | --------------------------------------------- | ------------------------------------------ |
| **Source code**          | No            | No                                            | N/A — never leaves customer infrastructure |
| **Scan reports**         | Yes (locally) | Yes (locally by default; optionally in cloud) | Customer-controlled                        |
| **License tokens**       | Yes           | Yes (hashed)                                  | Contract term + 30 days                    |
| **Audit log entries**    | Yes           | Yes (encrypted at rest)                       | 365 days (configurable)                    |
| **SSO configuration**    | Yes           | Yes (AES-256-GCM encrypted)                   | Contract term                              |
| **User email addresses** | Yes           | Yes (for seat management)                     | Contract term + 30 days                    |
| **Personal data**        | Minimal       | Encrypted at rest                             | Per GDPR Article 5(1)(e)                   |

### 7.2 Sub-Processor List

| Sub-Processor  | Purpose               | Data Accessed                                  |
| -------------- | --------------------- | ---------------------------------------------- |
| **Stripe**     | Payment processing    | Billing email, payment metadata (no scan data) |
| **Cloudflare** | CDN / DDoS protection | HTTP request metadata (no scan data)           |

Customer will be notified 30 days in advance of any new sub-processor addition and may object on reasonable grounds.

### 7.3 International Data Transfers

- Primary hosting: United States (Azure / Cloudflare)
- EU customers: Data localization available via EU-hosted instances on request
- Standard Contractual Clauses (SCCs) available upon request
- No data transfers to jurisdictions outside of EU/US/UK without explicit Customer consent

---

## 8. Acceptance Criteria

### 8.1 Initial Onboarding Acceptance

The following criteria must be met within 30 days of contract execution:

1. ✅ Enterprise organization created in SimpleBeacon platform
2. ✅ Admin user provisioned with SSO authentication (if applicable)
3. ✅ First CI/CD pipeline integration completed (Azure DevOps or GitHub Actions)
4. ✅ First successful scan executed on a production codebase
5. ✅ Executive Risk Certificate generated and validated
6. ✅ Audit ledger initialized with `org_created` entry
7. ✅ Seat pool configured with correct user count
8. ✅ SSO configuration tested (if applicable) — all checks pass

### 8.2 Ongoing Acceptance

- Monthly scan execution on at least one production repository
- Quarterly audit trail verification (`/api/enterprise/audit/verify` returns `valid: true`)
- Annual review of SSO configuration health

---

## 9. Termination & Transition

### 9.1 Data Export on Termination

Upon contract termination, Customer may request:

- Full audit trail export (JSON format with chain verification)
- All scan reports (JSON + PDF)
- SSO configuration export (secrets removed)
- User seat roster export

All exports delivered within 10 business days of termination notice.

### 9.2 Data Deletion

- Provider deletes all Customer data within 30 days of contract termination
- Audit ledger entries retained for 90 days post-termination for regulatory compliance, then deleted
- Customer may request immediate deletion with written confirmation (waives retention period)

### 9.3 Transition Support

- Provider offers 30 days of transition support at no additional cost
- Includes knowledge transfer sessions, documentation handover, and final audit export
- Self-hosted deployments continue to function indefinitely with perpetual license

---

## 10. Signatures

| Role         | Name            | Signature       | Date            |
| ------------ | --------------- | --------------- | --------------- |
| **Provider** | _______________ | _______________ | _______________ |
| **Customer** | _______________ | _______________ | _______________ |

---

## Appendix A: Definitions

- **"Provider"** means SimpleBeacon.ai, the operator of the SimpleBeacon platform
- **"Customer"** means the enterprise organization purchasing services under this agreement
- **"SLA"** means Service Level Agreement as defined in Section 2
- **"SEV-1"** through **"SEV-4"** mean incident severity levels as defined in Section 2.2
- **"Audit Ledger"** means the immutable, SHA-256 hash-chained append-only log of administrative actions
- **"Executive Risk Certificate"** means the cryptographically signed PDF report with A–F risk grade
- **"Scan"** means a single execution of the SimpleBeacon CLI against a codebase
- **"Seat"** means a licensed user slot within an enterprise organization's seat pool
- **"SSO"** means Single Sign-On via SAML 2.0 or OpenID Connect protocols

## Appendix B: Related Documents

| Document                         | Location                                                       |
| -------------------------------- | -------------------------------------------------------------- |
| Enterprise Positioning Statement | `ai-platform/docs/enterprise-positioning.md`                   |
| B2B Sales Outreach Playbook      | `marketing/outreach/eu-ai-act-compliance-playbook.md`          |
| Landing Page Copy Variants       | `marketing/outreach/enterprise-landing-page-copy.md`           |
| Procurement Kit                  | `generated/simplebeacon-procurement-kit.zip` (rolling release) |
| Audit Ledger API                 | `/api/enterprise/audit` (see API documentation)                |
| SSO Configuration API            | `/api/enterprise/sso` (see API documentation)                  |

---

_This SLA Addendum is incorporated by reference into the Master Services Agreement between Provider and Customer. In the event of a conflict between this Addendum and the Master Services Agreement, this Addendum shall control with respect to service levels, availability, and support commitments._
