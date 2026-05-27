# Simplebeacon Enterprise MSA Template (Draft)

**Not legal advice.** Have counsel review before signing. Customize bracketed fields.

---

## SIMPLEBEACON ENTERPRISE SERVICES AGREEMENT

**Effective Date:** [Date]

**Client:** [Company Name], [Address] ("Client")

**Provider:** [Your Legal Entity Name], [Address] ("Provider")

---

### 1. Services

Provider delivers Simplebeacon-related professional services as described in **Exhibit A** (scope, tier, timeline). Services may include: installation and configuration, CI integration, allowlist tuning, scan execution, finding triage, and executive reporting.

**Read-only tool commitment:** Simplebeacon is a **read-only static analysis engine** used to perform Services. It contains **no file-write capabilities on Client application source code**, no data-deletion routines on Client repositories, and **no transmission of proprietary source code** to Provider systems when Client selects on-premises or client-hosted CI deployment (see Exhibit C).

**Selected tier (check one):**
- [ ] Pilot — $2,500 fixed (2 weeks, 1–2 repos)
- [ ] Silver — $7,500 setup + $1,500/month
- [ ] Gold — $15,000 setup + $5,000/month
- [ ] Custom — $[setup] + $[monthly]/month

Software access (CLI/dashboard) is included only as needed to perform Services. Client retains ownership of Client code; Provider retains Simplebeacon IP.

---

### 2. Fees and payment

- **Setup fee:** $[Amount], due on signing
- **Retainer:** $[Amount]/month, due on the [1st] of each month
- **Additional consulting:** $[175–500]/hour unless included in tier
- **Invoices:** Net [15/30] days; late fee [1.5%]/month after [15] days notice

---

### 3. Client responsibilities

- Read-only repo access (or agreed clone method) for scoped repositories
- Primary contact for findings review within [5] business days
- Accurate description of production paths and compliance context
- Client remains responsible for remediation in Client systems
- **Client maintains full control over their codebase at all times.** Provider has read-only access for analysis purposes only. Client may revoke access at any time.

---

### 4. Provider responsibilities

- Perform Services professionally using Simplebeacon tooling
- Triage automated findings before executive delivery where tier includes triage
- Redact secrets in deliverables; do not retain cloned repos beyond [24–168] hours unless agreed
- Primary consultant: [Name]

---

### 5. Confidentiality and data

Each party protects the other's confidential information. Provider will not store full source trees longer than necessary for delivery. Credential-like strings in reports are redacted or summarized. Provider may use anonymized aggregate metrics to improve detection rules.

**Provider agrees not to write to Client's application source code.** All automated analysis is read-only on Client repositories. Provider will implement `.simplebeacon/` configuration changes only when explicitly authorized by Client in writing (email sufficient).

---

### 6. Disclaimers (critical)

**SIMPLEBEACON USES PATTERN MATCHING.** Findings are candidates for review, not guarantees of vulnerability or compliance.

**PROVIDER DOES NOT WARRANT** that Services will detect all security issues or that Client will pass any audit.

**CLIENT ACKNOWLEDGES** that Client is solely responsible for codebase security and compliance decisions.

EXCEPT AS STATED, SERVICES ARE PROVIDED "AS IS." PROVIDER DISCLAIMS IMPLIED WARRANTIES.

---

### 7. Limitation of liability

Provider's total liability shall not exceed fees paid by Client in the **[12]** months before the claim. Neither party is liable for indirect, consequential, or punitive damages. Provider is not liable for security incidents in Client's environment whether or not detected by Simplebeacon.

**Client acknowledges** that Simplebeacon is a read-only analysis tool and does not modify Client's application source code. **Provider is not liable for code quality, security, or compliance issues that existed prior to engagement** or that arise from Client's remediation decisions after delivery of findings.

---

### 8. Term

Initial term: **[3/12]** months from Effective Date, then month-to-month unless terminated with **[30]** days written notice. Either party may terminate for uncured material breach after **[15]** days notice.

---

### 9. General

- **Governing law:** [State/Country]
- **Disputes:** Good faith negotiation, then binding arbitration in [City]
- **Entire agreement:** This Agreement + Exhibit A
- **Notices:** [emails/addresses]

---

**Provider:** _________________________ Date: _________

**Client:** _________________________ Date: _________

---

## EXHIBIT A — Scope (example: Gold tier)

**Repositories in scope:** [list agreed at kickoff]

**Implementation (weeks 1–3):**
- **Week 1:** Deploy Simplebeacon in **read-only, reporting-only mode** — configure profiles; initial GitHub Actions workflow runs **without** `--gate` to generate baseline reports only
- Discovery, `.simplebeacon/config.json`, baseline sync (writes only `.simplebeacon/` metadata — Client-approved)
- **After allowlist sign-off:** Enable CI gate (`--fail-on high`), allowlist v1
- Team training (2 hours)

**Week 1 client communication (Provider sends):**

> I've completed the initial read-only analysis of your codebase. Simplebeacon ran silently in the background and generated baseline reports. No application source code was modified or blocked. Next I'll work with your team to tune the configuration based on these findings before we enable any blocking gates.

**Deployment options (check one):**
- [ ] Client-hosted CI (CLI-only, recommended Week 1)
- [ ] On-premises dashboard (Docker in Client VPC — see `docs/simplebeacon-on-premises-deployment.md`)
- [ ] Provider-hosted assessment clone (deleted per retention in Section 5)

**Ongoing (monthly):**
- [4] consultant-reviewed scan passes
- [1] executive summary (PDF or markdown)
- Allowlist updates within [48] business hours of request
- Support SLA: [4] hr critical / [24] hr standard

**Out of scope:** Penetration testing, CVE remediation, formal SOC 2 audit, 24/7 SOC unless Platinum SOW.

---

## EXHIBIT C — Safe-fail deployment & liability

**Non-blocking integration phase:** Consultant will initially deploy all automated continuous integration pipeline tools in **reporting-only mode** for a minimum of **five (5) business days**. The tool will not enforce a blocking gate on active development branches until both the Consultant and the Client's Engineering Lead have explicitly signed off on the current codebase allowlist configuration.

**Read-only operation:** Simplebeacon operates strictly as a static, read-only diagnostic analysis framework on Client application source. It does not modify, edit, or delete Client source files. Scan output is written only to agreed report paths (e.g. `.simplebeacon/report.json` or CI artifacts).

**On-premises option:** Client may require CLI-only or full dashboard deployment inside Client's private cloud (AWS/GCP/Azure). Provider will not require transmission of source code to Provider SaaS when Client selects client-hosted deployment.

**Limitation of liability:** In no event shall the Consultant be liable to the Client for any indirect, incidental, special, or consequential damages (including lost profits, pipeline downtime, or data corruption) arising out of the deployment of this tool, even if advised of the possibility of such damages.

**Verification:** Provider maintains automated integration tests (`tests/integration/scanner.test.js`) against isolated toxic fixtures proving true-positive detection, allowlist safety, and zero-mutation behavior before each enterprise delivery.

---

## EXHIBIT B — Pricing

| Item | Amount |
|------|--------|
| Setup | $[Amount] |
| Monthly retainer | $[Amount] |
| Pilot credit (if applicable) | -$[Amount] |
