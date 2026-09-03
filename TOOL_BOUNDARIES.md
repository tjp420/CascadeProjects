# SimpleBeacon: Scope & Boundaries

## 🎯 What We Do Best

SimpleBeacon is a **static architectural governance engine** designed for software engineers and architects building at the start of the development cycle.

### Core Strengths

- **Pre-commit & pre-merge gating** — catch issues before code lands
- **Circular dependency isolation** — prevent modular decay in large codebases
- **AI drift detection** — flag code patterns that indicate AI-generated slop, hallucinations, or test-data leakage
- **EU AI Act compliance tracking** — map your codebase against regulatory requirements
- **Deterministic rule engines** — repeatable, cacheable analysis (no false positives from runtime variance)
- **Developer-loop integration** — fast feedback in your IDE, CI/CD pipeline, or pre-commit hook

### Use Cases We Solve

✅ Engineering teams building enterprise applications  
✅ Architecture review workflows (code audits, pre-merge gates)  
✅ Regulatory compliance programs (EU AI Act, SOC 2, board certifications)  
✅ AI/LLM governance (preventing AI-generated code defects before deployment)  
✅ Monorepo dependency management (scaling codebases without decay)  

---

## ❌ What We Do NOT Do

SimpleBeacon is **not** a security operations platform, penetration testing tool, or vulnerability scanner. We focus on **static source analysis**, not dynamic exploitation or runtime attacks.

### Out of Scope

| Service | Why Not SimpleBeacon | Better Alternatives |
|---------|----------------------|---------------------|
| **Penetration Testing / Pentest** | We don't execute code, invoke APIs, or test runtime behavior. Pentesting requires dynamic exploitation on live infrastructure. | Bug bounty platforms (HackerOne, Bugcrowd), dedicated pentest firms, OWASP ZAP, Burp Suite |
| **Vulnerability Disclosure Programs (VDP)** | VDP platforms manage submissions, rewards, and remediation workflows. SimpleBeacon is a tool, not a program. | HackerOne, Intigriti, Bugcrowd, Synack |
| **Bug Bounty Programs (BBP)** | BBP platforms handle bounty tiers, dispute resolution, and payments. SimpleBeacon is engineering-focused, not a marketplace. | HackerOne, Bugcrowd, Synack, YesWeHack |
| **Capture the Flag (CTF)** | CTF competitions are tactical hacking exercises. SimpleBeacon is architectural governance, not a game. | CTFTime, Hack The Box, TryHackMe, CtfShow |
| **Dynamic Penetration Tests (Pentesting)** | Pentests require runtime access, exploitation chains, and adversarial scenarios. We do static analysis only. | Pentera, Rapid7 Nexpose, Qualys, AWS GuardDuty |
| **External Reconnaissance / Asset Discovery** | We don't scan the internet, DNS records, or external infrastructure. Recon is network-level; we analyze source code. | Shodan, Certificate Transparency logs, DNS enumeration tools, Nmap, SpiderFoot |
| **Timed Security Challenges** | Security competitions require dynamic orchestration and live scoring. We're a code analyzer. | Hack The Box, TryHackMe, PentesterLab, CREST |
| **Code Audit (Partial)** | We catch some code quality and security issues statically. True audits require dynamic testing, threat modeling, and expert review. | Professional code audit firms, OWASP guidelines, security consultants |

---

## 🎓 Design Philosophy

### Why Static, Not Dynamic?

**SimpleBeacon operates on source code, not runtime behavior.**

- **Shift-left advantage** — catch issues at commit time, not in production
- **Deterministic results** — same code = same findings (no environment variance)
- **Zero infrastructure overhead** — no test harness, no API calls, no staging environment needed
- **Integration into developer loops** — works pre-commit, in IDE, in CI/CD pipelines

**For problems that require dynamic testing** (runtime vulnerabilities, API security, infrastructure misconfiguration), SimpleBeacon is not the right tool. Use DAST (Dynamic Application Security Testing) tools alongside SimpleBeacon.

### The Boundary in Practice

```
                  Developer Commits Code
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
        SimpleBeacon (Static)   External Systems (Dynamic)
        ─────────────────────   ──────────────────────────
        ✅ Pre-commit gate      ❌ Runtime testing
        ✅ Architecture rules   ❌ API security scanning
        ✅ AI code detection    ❌ Penetration testing
        ✅ Compliance mapping   ❌ Infrastructure scanning
        ✅ Dependency cycles    ❌ Behavioral analysis
```

---

## 🛠️ Integration Recommendations

### What to Pair SimpleBeacon With

**For comprehensive security coverage, combine SimpleBeacon with:**

| Goal | SimpleBeacon Role | Complementary Tools |
|------|-------------------|----------------------|
| Prevent architectural debt | Primary | SonarQube, ESLint, TSLint |
| Catch security issues | Secondary | Snyk, OWASP ZAP, Burp Suite, Aqua Trivy |
| Compliance tracking | Primary | Grype, Cyclonedx BOM, OWASP Dependency Check |
| Runtime monitoring | Not applicable | Datadog, New Relic, Splunk, AWS CloudTrail |
| Threat modeling | Secondary | Microsoft Threat Modeling Tool, TM4J |
| Infrastructure as Code scanning | Secondary | Terraform Cloud, CloudFormation Guard, Checkov |

---

## 📋 FAQ: Is SimpleBeacon Right for Me?

### ✅ Yes, if you need to:
- Gate code merges on architectural compliance
- Prevent circular dependencies in large monorepos
- Flag AI-generated code defects before production
- Map code to regulatory frameworks (EU AI Act, etc.)
- Shift security left into the development loop

### ❌ No, if you need to:
- Run penetration tests or red-team exercises
- Discover vulnerabilities in live applications
- Manage bug bounty submissions or security events
- Automate security competitions or CTF platforms
- Scan external infrastructure or DNS records

---

## 📞 Getting Help

**For SimpleBeacon issues:**
- GitHub Issues: [simplebeacon-cli](https://github.com/cascadeprojects/simplebeacon)
- Documentation: [docs.simplebeacon.ai](https://docs.simplebeacon.ai)
- Contact: [support@simplebeacon.ai](mailto:support@simplebeacon.ai)

**For security services outside our scope:**
- Penetration testing: Contact a professional pentest firm (OWASP, NIST recommendations)
- Bug bounties: Join platforms like HackerOne or Bugcrowd
- Vulnerability disclosure: Use coordinated disclosure best practices
- Runtime security: Consult SOC/SIEM and threat intelligence services

---

**Last updated:** 2026-09-03  
**Maintained by:** SimpleBeacon Engineering Team  
**Version:** 1.0
