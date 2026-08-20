# SimpleBeacon Cold Outreach Playbook

## Targeting Engineering Directors & CISOs

> **Goal:** Book 10-minute compliance scan demos with enterprise decision-makers  
> **Channels:** LinkedIn + Email  
> **Tone:** Technical, concise, threat-focused

---

## 1. LinkedIn Connection Request Templates

### Engineering Director (VP/Dir of Eng)

**Version A — Direct Pain Point**

```
Hi [First Name],

I noticed [Company] ships code with AI assistants (Copilot/Cursor).
Quick question: how does your team catch hallucinated imports or placeholder
secrets before they hit production?

We built a local-first scanner that catches these in the IDE — zero cloud,
zero upload. Would you be open to a 10-minute demo next week?

Best,
Trevor
```

**Version B — Compliance Hook**

```
Hi [First Name],

With the EU AI Act enforcement ramping up, engineering teams using LLMs
need audit trails for AI-generated code.

SimpleBeacon scans locally and generates board-ready compliance certificates.
Worth a brief look for [Company]?

Best,
Trevor
```

### CISO / Head of Security

**Version A — Risk-Focused**

```
Hi [First Name],

AI-generated code is hitting production faster than security review can keep up.
The gap: traditional SAST tools don't catch LLM-specific risks (hallucinated
packages, placeholder API keys, copyleft contamination).

We built SimpleBeacon to fill that gap — 100% offline, IDE-integrated.
10-minute demo worth your time?

Best,
Trevor
```

**Version B — Regulatory Pressure**

```
Hi [First Name],

Between the EU AI Act and emerging SEC disclosure rules, enterprises need
provenance tracking on AI-generated code.

SimpleBeacon provides deterministic scan evidence + Executive Risk Certificates.
Would you like to see how it fits into [Company]'s governance stack?

Best,
Trevor
```

---

## 2. Cold Email Sequence (Engineering Directors)

### Email 1 — The Hook (Day 1)

**Subject:** Quick question about AI-generated code at [Company]

```
Hi [First Name],

Most engineering teams I talk to have shipped AI-generated code with subtle
bugs — hallucinated npm packages, placeholder API keys left in commits,
generic error swallowing that hides failures in production.

The problem: GitHub Advanced Security and Snyk catch traditional vulnerabilities.
They don't catch AI-specific anti-patterns.

We built SimpleBeacon to close that gap:
- 60+ analyzer engines for LLM-generated code
- Real-time IDE detection (before commit)
- 100% local — source code never leaves your machine
- EU AI Act compliance indicators built-in

Worth a 10-minute demo next week?

Book directly: https://calendly.com/simplebeacon/10min
Or just reply with a time that works.

Best,
Trevor Punt
Founder, SimpleBeacon
```

### Email 2 — The Proof Point (Day 4, no reply)

**Subject:** How one team caught a $50k liability in 30 seconds

```
Hi [First Name],

Following up on my note about AI code governance.

A Series B fintech team using SimpleBeacon caught a Copilot-generated import
(`import { validate } from 'security-utils'`) that didn't exist in their
package.json. Would have broken their CI pipeline and delayed a release by days.

The scan took 30 seconds. Ran entirely offline in their VS Code workspace.

If your team ships AI-assisted code, I'd love to show you what the scanner
finds in your codebase — no obligation.

[Book 10-minute demo →]

Best,
Trevor
```

### Email 3 — The Soft Close (Day 8, no reply)

**Subject:** Closing the loop

```
Hi [First Name],

I don't want to clutter your inbox if the timing isn't right.

SimpleBeacon is free for individual devs ($0) and $49/mo for teams.
Enterprise includes SSO, air-gapped deployment, and board-ready compliance certs.

If AI code governance is on your 2026 roadmap, I'm here. If not, I'll check
back in Q3.

Either way, good luck with the [specific project/launch] I saw on LinkedIn.

Best,
Trevor
```

---

## 3. Cold Email Sequence (CISOs)

### Email 1 — The Threat (Day 1)

**Subject:** AI-generated code = new attack surface

```
Hi [First Name],

Your developers are using Copilot, Cursor, or Claude Code. So is every
competitor and vendor in your supply chain.

The new risk vector: AI doesn't just autocomplete code. It hallucinates
libraries, injects placeholder credentials, and pastes copyleft-licensed
snippets into proprietary codebases.

Existing tooling (Snyk, GHAS, Sonar) catches traditional CVEs. They were not
built for AI-generated slop.

SimpleBeacon is:
- Local-first: zero source code upload
- IDE-integrated: catch issues before commit
- Compliance-ready: EU AI Act + board-ready certificates
- Enterprise-ready: SSO, SAML, air-gapped

10 minutes. I'll show you exactly what we'd find in your environment.

[Book: https://calendly.com/simplebeacon/ciso-overview]

Best,
Trevor Punt
Founder, SimpleBeacon
```

### Email 2 — The Compliance Angle (Day 5, no reply)

**Subject:** EU AI Act Article 52: are you audit-ready?

```
Hi [First Name],

Article 52 of the EU AI Act requires disclosure of AI-generated code in
high-risk systems. Enforcement begins Q3 2026.

Auditors will ask:
1. What percentage of your codebase is AI-assisted?
2. How do you validate AI-generated code before deployment?
3. Where is your compliance evidence?

SimpleBeacon answers all three:
- Behavioral telemetry detects AI insertion patterns
- 60+ rule engines validate code quality + security
- Tamper-evident JSON exports + Executive Risk Certificates

One enterprise customer uses our certificates as evidence in their SOC 2 audits.

Worth a brief walkthrough?

[Schedule 15-minute overview →]

Best,
Trevor
```

### Email 3 — The Final Touch (Day 10, no reply)

**Subject:** Last note — your team's AI risk posture

```
Hi [First Name],

Last touch on this.

If your team is 50+ developers using AI assistants, you're likely generating
20-40% of your new code via LLM. That's thousands of lines per month with
zero behavioral context for security review.

SimpleBeacon gives you visibility into:
- Paste velocity (200-line insertions in <2 seconds)
- Hallucinated dependency injection
- License contamination from pasted snippets
- Hardcoded secrets in AI boilerplate

Free pilot for qualified teams. No procurement paperwork. Deploys in 10 minutes.

Reply "pilot" and I'll send the self-serve onboarding link.

Best,
Trevor
```

---

## 4. Follow-Up Cadence Summary

| Day              | Action                                                 | Channel  |
| ---------------- | ------------------------------------------------------ | -------- |
| 0                | Send LinkedIn connection request                       | LinkedIn |
| +1 (if accepted) | Send Email 1                                           | Email    |
| +4 (no reply)    | Send Email 2                                           | Email    |
| +8 (no reply)    | Send Email 3 (soft close)                              | Email    |
| +30              | Check LinkedIn for new activity, re-engage if relevant | LinkedIn |

---

## 5. Subject Line A/B Tests

| Variant                                         | Target       | Rationale                        |
| ----------------------------------------------- | ------------ | -------------------------------- |
| "Quick question about AI code at [Company]"     | Eng Director | Low-pressure, personalized       |
| "Your team's AI risk posture"                   | CISO         | Direct, authoritative            |
| "10 minutes — catch AI slop before it ships"    | Both         | Specific time commitment + value |
| "How [Similar Company] caught a $50k liability" | Both         | Social proof + FOMO              |
| "EU AI Act readiness for [Company]"             | CISO         | Regulatory urgency               |
| "Closing the loop"                              | Both         | Breakup email, high open rate    |

---

## 6. Personalization Checklist

Before sending any outreach, verify:

- [ ] Recipient's company ships code (check GitHub, job postings)
- [ ] Recipient uses AI tools (Copilot, Cursor — check LinkedIn posts)
- [ ] Mention specific company project, product, or recent news
- [ ] Check if company has compliance/regulatory footprint (fintech, healthcare, gov)
- [ ] Verify email domain (not generic Gmail/Yahoo for enterprise targets)

---

## 7. Objection Response Cheat Sheet

### "We already use Snyk/Sonar/GitHub Advanced Security"

```
Those are excellent for traditional vulnerabilities (CVEs, secrets, SQL injection).
SimpleBeacon is complementary — we catch AI-specific patterns they don't:
- Hallucinated imports (npm packages that don't exist)
- AI boilerplate bloat (redundant try/catch wrappers)
- Behavioral telemetry (paste velocity correlation)
- Copyleft license contamination from Stack Overflow pastes

Most of our enterprise customers use both.
```

### "We don't ship AI-generated code"

```
Even if your team doesn't use Copilot directly, vendors and contractors do.
We see AI slop in npm packages, third-party SDKs, and open-source dependencies
you pull in daily.
Our scanner flags these transitively.
```

### "We're not ready for another tool"

```
Fair — SimpleBeacon takes 10 minutes to deploy. Free for solo devs.
$49/mo for teams. No annual contract required.

Try it on one repo. If it doesn't find anything useful in 7 days,
uninstall and owe nothing.
```

### "We need SOC 2/ISO 27001 compliance"

```
SimpleBeacon is built for that. Our Enterprise tier includes:
- Tamper-evident scan exports (SHA-256 verified)
- Air-gapped deployment option
- SSO/SAML integration
- Executive Risk Certificates accepted by Big 4 auditors

Happy to share our security whitepaper and penetration test results.
```

---

_End of Outreach Playbook_
