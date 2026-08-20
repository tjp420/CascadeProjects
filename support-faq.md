# SimpleBeacon Support & FAQ
**Initial Launch Support Documentation**
*Effective: August 2026*

---

## Top 20 Customer FAQ

### 1. **What is SimpleBeacon?**
SimpleBeacon is an AI-powered security intelligence platform that scans websites and applications for vulnerabilities, compliance gaps, and AI content detection. It provides real-time monitoring, automated remediation suggestions, and enterprise-grade reporting.

### 2. **How long does a security scan take?**
Typical scans complete in 2-15 minutes depending on site complexity. Enterprise scans with deep analysis may take 30-45 minutes. Real-time monitoring processes changes continuously in background.

### 3. **What vulnerabilities does SimpleBeacon detect?**
We detect OWASP Top 10 vulnerabilities, CVSS-rated exposures, misconfigurations, compliance violations (GDPR, HIPAA, PCI-DSS), SSL/TLS issues, dependency vulnerabilities, and AI-generated content markers.

### 4. **Is my data safe with SimpleBeacon?**
Yes. All scans use encrypted channels (TLS 1.3+). Data is retained per your plan (7-90 days) then deleted. We maintain SOC 2 Type II compliance. No data is sold or shared with third parties. Enterprise plans support private deployments.

### 5. **Can I integrate SimpleBeacon with my CI/CD pipeline?**
Yes. We provide GitHub Actions, GitLab CI, Jenkins, and REST API integrations. Reference our CI/CD integration guide or contact support for custom integrations.

### 6. **What's included in the free trial?**
14-day free trial includes: 5 full scans, basic vulnerability detection, 1 dashboard user, email support, and access to remediation suggestions.

### 7. **How do I set up real-time monitoring?**
Install the SimpleBeacon agent (JavaScript snippet, npm package, or container). It monitors file changes, API endpoints, and infrastructure in real-time. Setup takes 5-10 minutes via dashboard wizard.

### 8. **Do you support on-premise/private deployment?**
Yes. Enterprise customers can deploy via Docker, Kubernetes, or private cloud. Contact sales for enterprise licensing and deployment assistance.

### 9. **What's the SLA for scan results?**
Standard: 99.5% uptime, results delivered within 5 min. Enterprise: 99.9% uptime, priority scanning queue, 2-min delivery. Emergency escalations handled within 1 hour.

### 10. **Can I exclude files or folders from scans?**
Yes. Configure exclusion patterns in dashboard Settings > Scan Configuration. Common exclusions: vendor directories, node_modules, build artifacts, auto-generated code.

### 11. **How do I fix vulnerabilities found by SimpleBeacon?**
Use our Remediation Hub (dashboard > Fixes tab). Each finding includes severity, code snippet, fix steps, and suggested patches. Enterprise customers get priority remediation support.

### 12. **Does SimpleBeacon support my framework/language?**
We support 25+ languages and frameworks: Node.js, Python, Java, Go, C#/.NET, PHP, Ruby, Rust, TypeScript, React, Vue, Angular, Django, Flask, Spring, .NET Core, Laravel, and more. Check compatibility matrix in docs.

### 13. **How do I manage user access and permissions?**
Dashboard > Team Settings allows role-based access control (Admin, Editor, Viewer, Analyst). SSO/SAML support available on Pro+ plans. MFA required for all accounts.

### 14. **What reporting features are available?**
PDF/HTML reports (monthly, quarterly, annual), vulnerability trends, compliance dashboards (SOC 2, HIPAA, PCI-DSS), executive summaries, and custom reports. API access for programmatic reporting.

### 15. **Can I schedule automated scans?**
Yes. Configure daily, weekly, or monthly scans on dashboard > Automation. Trigger scans on git commits, deployments, or manual execution. Set notifications for critical findings.

### 16. **How do I interpret the SimpleBeacon severity score?**
Scores 9-10 (Critical): Immediate action required. 7-8 (High): Fix within 48 hours. 5-6 (Medium): Address within 1 week. 3-4 (Low): Plan remediation. 1-2 (Info): Best practices.

### 17. **Is there an API for programmatic access?**
Yes. REST API v2 provides endpoints for scans, findings, remediation, users, and reports. Full OpenAPI specification available. Rate limits: 1000 requests/hour (standard), unlimited (enterprise).

### 18. **How do I cancel or modify my subscription?**
Subscriptions can be paused or cancelled any time in Account > Billing. Prorated refunds issued for annual plans. Contact support to discuss plan downgrades or feature adjustments.

### 19. **Does SimpleBeacon comply with GDPR and data residency?**
Yes. GDPR-compliant data processing, DPA signed, data residency in EU/US/APAC on request. Audit logs retained for compliance. Annual SOC 2 Type II audits. Privacy policy at www.simplebeacon.io/privacy.

### 20. **What is the process for reporting a security issue with SimpleBeacon itself?**
Use our responsible disclosure program. Email security@simplebeacon.io with details. Do NOT post publicly. We respond within 48 hours. Critical issues are addressed within 7 days. Reporters credited (with permission).

---

## Support Contact Routing

| Issue Type | Channel | SLA | Assigned Team |
|---|---|---|---|
| **Technical Issues** (scan errors, integration) | chat.simplebeacon.io / support@simplebeacon.io | 4 hours (standard) / 1 hour (enterprise) | Technical Support |
| **Account & Billing** | billing@simplebeacon.io | 8 hours | Account Management |
| **Security/Compliance** | security@simplebeacon.io (confidential) | 2 hours | Security Team |
| **Enterprise Deployments** | enterprise@simplebeacon.io | 1 hour | Enterprise Solutions |
| **Feature Requests** | product@simplebeacon.io | 24 hours (review) | Product Team |
| **Performance Issues** | support@simplebeacon.io (mark URGENT) | 2 hours | Platform Operations |
| **Abuse/Compliance** | compliance@simplebeacon.io | 4 hours | Compliance Team |

**Support Hours:** 
- Standard: Monday-Friday 9 AM - 6 PM UTC (email 24/7)
- Enterprise: 24/7/365 with dedicated account manager
- Chat support: 9 AM - 9 PM UTC weekdays

---

## Escalation Steps

### Tier 1: First Contact (Technical Support)
- **Timeline:** Respond within SLA
- **Actions:** 
  - Acknowledge issue, log ticket
  - Gather environment/log details
  - Attempt standard troubleshooting
  - Provide workarounds if available
- **Escalation Trigger:** Issue unresolved after 2 hours OR technical complexity requires engineering

### Tier 2: Technical Investigation (Senior Engineer)
- **Timeline:** 30-60 min after Tier 1 escalation
- **Actions:**
  - Deep diagnostic analysis
  - Access customer environment (with permission)
  - Root cause analysis
  - Develop fix or workaround
- **Escalation Trigger:** Requires code changes, platform updates, or executive involvement

### Tier 3: Engineering/Product (Critical)
- **Timeline:** Immediate for critical severity
- **Actions:**
  - Assign dedicated engineer
  - Implement hotfix if needed
  - Plan permanent solution
  - Daily status updates
- **Escalation Trigger:** Platform outage, data loss, security breach, customer business impact

### Tier 4: Executive Escalation (Enterprise)
- **Timeline:** Same-day response
- **Actions:**
  - VP of Operations engaged
  - Executive steering
  - Custom resource allocation
  - Post-incident review
- **Escalation Trigger:** Multi-customer impact, contractual SLA breach, reputational risk

---

## SLA Expectations for Initial Launch

### Service Level Agreement (SLA)

#### Standard Plan
- **Uptime:** 99.5% (max 3.6 hours/month downtime)
- **Initial Response Time:** 
  - Critical: 4 hours
  - High: 8 hours
  - Medium: 24 hours
  - Low: 48 hours
- **Resolution Target:**
  - Critical: 24 hours
  - High: 48 hours
  - Medium: 5 business days
  - Low: 10 business days
- **Scan Availability:** 95% scan success rate

#### Professional Plan
- **Uptime:** 99.7% (max 2.16 hours/month downtime)
- **Initial Response Time:** 
  - Critical: 2 hours
  - High: 4 hours
  - Medium: 12 hours
  - Low: 24 hours
- **Resolution Target:**
  - Critical: 12 hours
  - High: 24 hours
  - Medium: 3 business days
  - Low: 5 business days
- **Scan Availability:** 97% scan success rate
- **Dedicated Support:** Email + Chat priority queue

#### Enterprise Plan
- **Uptime:** 99.9% (max 43 minutes/month downtime)
- **Initial Response Time:** All severities 1 hour (24/7)
- **Resolution Target:**
  - Critical: 4 hours (24/7 response)
  - High: 8 hours
  - Medium: 24 hours
  - Low: 48 hours
- **Scan Availability:** 99% scan success rate
- **Dedicated Account Manager:** Yes
- **Priority Escalation Path:** Direct to engineering
- **Custom SLA Negotiation:** Available

### Issue Severity Definitions

| Severity | Definition | Example |
|---|---|---|
| **Critical** | Complete service outage or major data loss | Platform unavailable, scan data lost, security breach |
| **High** | Significant functionality degraded | Scans failing 50%+ of time, reporting errors |
| **Medium** | Minor functionality impacted | UI lag, some features slow, partial data missing |
| **Low** | Cosmetic or minor convenience issue | Documentation typos, UI alignment, feature request |

### Launch Support Commitments

**August-September 2026 (First 60 Days)**
- Dedicated launch support team active 9 AM - 9 PM UTC daily
- Direct escalation to product engineering
- Daily status reports for enterprise customers
- 24-hour response to critical issues (all plans)
- Complimentary onboarding calls for all new customers
- Rapid hotfixes for launch-critical bugs (same-day if needed)

**September-October 2026 (60-120 Days)**
- Transition to standard SLA schedules
- Support team available 9 AM - 6 PM UTC + emergency on-call
- Enterprise customers remain on 24/7 schedule
- Post-launch optimization period continues

### SLA Exclusions
- Issues caused by customer's infrastructure/configuration
- Issues caused by third-party integrations (GitHub, AWS, etc.)
- Scheduled maintenance (announced 7 days in advance)
- Issues during beta/unstable features
- Customer-caused security incidents

### Credits & Remedies
- SLA breach (excluding exclusions): 10% monthly credit
- Recurring SLA breach (3+ instances/month): 25% credit
- Extended outage (>4 hours): 50% credit + escalation
- Credits applied to next invoice automatically

---

## Launch Support Team Contacts

**Support Hub:** https://support.simplebeacon.io  
**Email:** support@simplebeacon.io  
**Chat:** Integrated in dashboard (login required)  
**Emergency Hotline:** +1-844-SCAN-911 (Enterprise only)  
**Status Page:** https://status.simplebeacon.io  

**Dedicated Launch Manager (Aug-Sep 2026)**  
Name: [TBD - Assign before launch]  
Email: launch@simplebeacon.io  
Slack: #support-launch-channel (Enterprise customers)

---

**Document Version:** 1.0  
**Last Updated:** August 19, 2026  
**Next Review:** October 1, 2026  
**Owner:** Support & Operations Team
