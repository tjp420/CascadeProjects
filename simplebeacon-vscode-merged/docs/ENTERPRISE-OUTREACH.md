# Enterprise Outreach Sequences

> **Personalized outreach templates for engineering leaders**  
> _Last updated: June 20, 2026_

---

## Segment 1: VP Engineering / CTO at Series B+ Startups

### Cold Email (Short)

**Subject:** Your team ships AI-generated code. Who validates it?

```
Hi {{first_name}},

Quick question: does your team run Copilot, Cursor, or Claude Code?

If so, you've probably hit the same wall we did — AI writes code that looks
perfect but breaks in production. We caught:
- Hallucinated npm packages in a customer-facing build
- Placeholder API keys committed to prod (3 times)
- Generic catch{} blocks that swallowed a $40K billing error

GitHub Advanced Security and Snyk catch traditional vulnerabilities.
They don't catch AI-specific anti-patterns.

I built SimpleBeacon to fill that gap:
→ 60+ rules targeting LLM-generated code issues
→ 100% local (no source code leaves your machine)
→ EU AI Act compliance indicators built-in

Free to try: `npx simplebeacon init --starter`

Worth a 15-minute call to see if it fits your stack?

Best,
{{sender_name}}
```

### Follow-up (3 days later)

**Subject:** Re: AI code governance — quick teardown?

```
Hi {{first_name}},

Wanted to follow up on SimpleBeacon.

If your team's AI-generated PRs are growing, here's what I'd check today:

1. Run `npx simplebeacon scan --gate` on your repo (takes 30 seconds)
2. Look for "hallucinated imports" and "placeholder secrets"
3. Check if your current SAST even flags these

Most teams discover 3-5 issues in their first scan.

Happy to walk through results on a 15-min call.

{{sender_name}}
```

---

## Segment 2: Head of AppSec / Security Engineering

### Cold Email (Technical)

**Subject:** AI code slop — a new attack surface your SAST misses

```
Hi {{first_name}},

Your SAST catches SQL injection, hardcoded secrets, and CVEs.

But does it catch:
- `import { nonExistentLib } from 'npm-ghost-package'`
- `const API_KEY = 'your-api-key-here'` (yes, Copilot writes this)
- Identical error-handling blocks pasted across 20 files
- `eval()` wrappers around user input (model's "clever" workaround)

These are AI-specific anti-patterns that traditional scanners ignore.

SimpleBeacon is a local-first scanner with 60+ AI-native rules.
Runs entirely offline. Integrates with your CI pipeline.

Compliance note: generates EU AI Act artifacts + Executive Risk Certificates
for board audits.

I can send you a sample scan report from a production repo (sanitized) to
show what it catches that Snyk/Sonar misses.

Worth a look?

{{sender_name}}
```

### Follow-up (5 days later)

**Subject:** Sample scan: what Snyk missed in a production repo

```
Hi {{first_name}},

Attaching a sanitized scan from a real production repo (Node/TS, ~40K files).

Findings breakdown:
- Snyk: 12 issues (CVEs, known vulnerabilities)
- SimpleBeacon: 47 issues (AI slop, hallucinated deps, placeholder secrets,
  boilerplate repetition)

Zero overlap. These are different problem classes.

The repo was already passing GitHub Advanced Security checks.

Want me to run it against one of your repos? (Local scan, no code upload.)

{{sender_name}}
```

---

## Segment 3: Engineering Managers (Team Leads)

### Cold Email (Pain-focused)

**Subject:** Are your juniors shipping AI code without review?

```
Hi {{first_name}},

If your junior devs use Copilot, they're shipping code they don't fully
understand.

We've seen it across 12 teams:
- 200-line paste events from ChatGPT
- Placeholder values left in production
- Identical JSDoc blocks across files (context window repetition)
- Generic error handling that masks real bugs

Code review catches some of it. But reviewers miss patterns they've never
seen before.

SimpleBeacon is an IDE plugin that flags these in real-time — before commit.
Like a senior engineer looking over your shoulder.

Free for teams under 5. $49/mo after that.

Worth a 10-minute demo?

{{sender_name}}
```

---

## Segment 4: Compliance / Risk Officers (EU AI Act)

### Cold Email (Regulation-focused)

**Subject:** EU AI Act Article 53 — are your AI code practices auditable?

```
Hi {{first_name}},

The EU AI Act requires documentation of AI-generated code in high-risk systems.

Most engineering teams have no process for this. They don't even know which
files were AI-generated.

SimpleBeacon automatically:
1. Flags AI system indicators (LLM integration points, model API calls)
2. Generates compliance artifacts auditors accept
3. Produces board-ready Executive Risk Certificates

It runs 100% locally — no source code leaves your environment.

If you're preparing for EU AI Act audits, I'd be happy to walk through the
compliance checklist we built with legal teams.

{{sender_name}}
```

---

## LinkedIn Connection Request Templates

### Version 1: Mutual Connection

```
Hi {{first_name}}, saw your post on {{topic}}. We're building tools to help
engineering teams manage AI-generated code quality. Would love to connect.
```

### Version 2: Direct Value

```
Hi {{first_name}}, I noticed {{company}} ships fast — curious if your team
has run into issues with AI-generated code (Copilot/Cursor). Built something
that might help. Connection request, no pitch unless you're interested.
```

---

## LinkedIn InMail / Message Templates

### Post-Connection

```
Thanks for connecting, {{first_name}}. Quick question: does your team use
Copilot, Cursor, or Claude Code? If so, I'd love to send you a 2-minute
screencast of how we're helping teams catch AI-specific bugs before they ship.
No pressure if not relevant.
```

---

## Multi-touch Sequence (30-Day)

| Day | Channel  | Action                        |
| --- | -------- | ----------------------------- |
| 1   | Email    | Cold email (value-first)      |
| 3   | LinkedIn | Connection request with note  |
| 5   | Email    | Follow-up with social proof   |
| 7   | LinkedIn | Share relevant post, tag them |
| 10  | Email    | Case study / teardown offer   |
| 14  | LinkedIn | Comment on their post         |
| 17  | Email    | "Worth a quick call?"         |
| 21  | LinkedIn | Share product update          |
| 25  | Email    | Final attempt + unsubscribe   |
| 30  | —        | Move to nurture sequence      |

---

## Objection Handling Cheat Sheet

| Objection                    | Response                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "We already have Snyk/Sonar" | "They catch CVEs. We catch AI slop. Zero overlap. Most teams use both."                                                      |
| "We don't allow AI tools"    | "Then you're ahead of most. This catches the AI code that slips in anyway (contractors, Stack Overflow, legacy)."            |
| "Too expensive"              | "Free tier covers most solo devs. Team plan is $49/mo vs SonarCloud at $160."                                                |
| "Not a priority"             | "Fair. Bookmark this for your next incident from AI-generated code. Most teams reach out within 90 days."                    |
| "Need SOC 2"                 | "We're SOC 2 Type II in progress. Air-gapped deployment available now for Enterprise."                                       |
| "Show me the ROI"            | "One placeholder secret in prod = $40K+ incident. One hallucinated dep = build outage. Tool pays for itself on first catch." |

---

## Tracking & Metrics

Track these in your CRM:

- Open rate by segment
- Reply rate by template variant
- Meeting booking rate
- Pipeline created from outbound
- Time-to-close (enterprise vs startup)

Target benchmarks:

- Cold email open rate: > 45%
- Reply rate: > 8%
- Meeting booking: > 2%
- Pipeline creation: > 0.5% of contacts

---

_End of Enterprise Outreach Templates_
