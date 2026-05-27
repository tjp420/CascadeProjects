# Simplebeacon Cold Email Kit

Send-ready templates for funded CTOs, VP Engineering, and security leads. Language aligns with `packages/simplebeacon-cli/docs/MARKETING.md`.

**Positioning:** Complements Snyk/GHAS/SonarQube — does not replace them. Pattern gate on mock samples + production paths, with optional consultant triage.

**Offer:** Complimentary discovery scan on **one repo** → 15-minute findings walkthrough → optional paid implementation.

**Trust signals (use in every outbound):**

- **Read-only:** "Simplebeacon is a 100% read-only static analysis engine with zero file-write capabilities on your application source."
- **Reporting-first:** "We start in non-blocking mode to tune configuration before ever freezing merges."
- **On-premises:** "Can be deployed locally in your private cloud (AWS/GCP/Azure) — your code never leaves your infrastructure."
- **Proof:** Zero-mutation verified in `tests/integration/scanner.test.js` — cite if security asks.

**Pain pillars (use in copy — map to real findings):**

| Pillar | Buyer pain | What Simplebeacon actually catches |
|--------|------------|-----------------------------------|
| **Compliance friction** | Vendor reviews / audits ask about mock data & AI dev practices | Credential patterns, sample paths in prod dirs, fiction KPIs in `*-sample.json` |
| **Operational chaos** | Senior eng time hunting “where did this sample path come from?” | Production-leak hits, schema drift, duplicate mock files |
| **Technical debt** | Dashboard fixtures diverge from CI reality | Fiction KPIs, cross-sample drift, stale baseline metrics |

Do **not** cite Gartner “80%” or invent ROI unless you have **their** numbers from the scan.

---

## Claims guardrails (read before sending)

| Say | Don't say |
|-----|-----------|
| Fiction KPIs in `*-sample.json` mock files | "All AI-generated fiction in your codebase" |
| Complementary credential **pattern** scan | "Finds secrets your tools miss" (GHAS/Snyk exist) |
| Hardcoded sample/mock paths in `server/`, `src/`, etc. | "Comprehensive security scanner" |
| Evidence pack for SOC 2 / vendor diligence | "SOC 2 certification" or "HIPAA compliant tool" |
| I review findings and filter false positives | "Zero false positives" |
| Read-only scan; optional on-prem in your VPC | "We need your code in our cloud" |
| Reporting-only CI first, then `--gate` after sign-off | "We block merges on day one" |

---

## Subject lines (A/B test)

**Risk / gap**
- `What Snyk doesn't scan: mock-data fiction in repos`
- `Quick question about AI-assisted dev at {{company}}`

**Curiosity**
- `Copilot metrics that look real but aren't measured`
- `Sample paths in production code — worth a 15-min check?`

**Revenue / enterprise**
- `Vendor security reviews: one gap Series B teams miss`
- `Before your next enterprise security questionnaire`

**Compliance / ops (v2 — test against v1)**
- `Mock-data gaps that slow vendor security reviews`
- `AI-assisted repos: sample paths your CI scanner may pass`

**Avoid:** "ONLY tool", "guaranteed", "100x ROI", unsourced Gartner stats, fake CLI flags (`--detect-fiction`, `--confidence-gate`).

---

## Primary email (≤150 words)

**Subject:** What Snyk doesn't scan: mock-data fiction in repos

```
Hi {{first_name}},

{{personalization_line}}

Teams using Copilot/Cursor ship faster — but CVE scanners don't check for:
• Inflated KPIs in *-sample.json mock files (e.g. "74.17% complete", "47 features")
• Hardcoded sample/mock paths under server/ or src/
• Credential-like patterns in config and mock JSON

I built Simplebeacon for that gap: a deterministic **read-only** scan + human triage, not another black-box SAST tool. Your source is never modified — we start in reporting-only mode before any merge gate.

I'm offering a complimentary scan on one repo (read-only, ~15 min on my side). On-premises deployment in your VPC is available if required. You get a short findings summary — what flagged, what's likely noise, and what I'd fix first.

Open to a 15-minute call this week to walk through results?

Best,
{{your_name}}
Founder, Simplebeacon
simplebeacon.ai | {{phone}}
```

**Personalization lines (pick one):**
- `Congrats on the {{round}} — scaling eng usually means more AI-assisted code in the repo.`
- `Saw {{company}} hiring for {{role}} — guessed mock data and dashboard samples may be piling up.`
- `Noticed {{company}} on {{customer_segment}} — enterprise buyers ask about AI dev practices in vendor reviews.`

---

## Primary email — v2 (pain pillars, still ≤180 words)

**Subject:** Mock-data gaps that slow vendor security reviews

```
Hi {{first_name}},

{{personalization_line}}

Three issues I see on funded teams using Copilot/Cursor — usually **after** Snyk/GHAS are green:

1. **Compliance friction** — placeholder credential patterns or unverifiable KPIs in repo files that show up in vendor diligence
2. **Operational chaos** — sample/mock paths referenced under server/ or src/; senior eng time burned tracing them
3. **Technical debt** — dashboard *-sample.json* drifting from what CI actually measures

Simplebeacon is a deterministic **read-only** gate on those patterns (plus consultant triage for false positives). Not a replacement for CVE scanning. We deploy reporting-only first — no `--gate` on your main branch until your Engineering Lead signs off on allowlists.

I'll run a complimentary read-only scan on one repo and send a 1-page summary before a 15-minute walkthrough: confirmed vs noise vs allowlist. Can run in your private cloud if you prefer.

Open this week?

Best,
{{your_name}}
Founder, Simplebeacon
simplebeacon.ai | {{phone}}
```

---

## Follow-up sequence

### Follow-up #1 — Day 3

**Subject:** Re: mock-data scan offer

```
Hi {{first_name}},

Quick bump on the complimentary repo scan.

Typical first pass on a funded startup repo surfaces things like:
• sample JSON referenced from production paths
• dashboard mock files with KPIs that aren't tied to CI/tests
• placeholder credential patterns in config (often docs/examples — we sort real vs noise)

No pitch deck — just findings you can hand to your lead or auditor.

Worth 15 minutes?

{{your_name}}
```

### Follow-up #2 — Day 7

**Subject:** One question

```
Hi {{first_name}},

One question: if an investor or enterprise buyer asked "how do you know your dashboard metrics are real," could your team answer in one slide?

If that's fuzzy, the scan usually clarifies it in one pass.

Still happy to run the complimentary scan — reply with a repo URL or "not now."

{{your_name}}
```

### Follow-up #3 — Day 14 (break-up)

**Subject:** Closing the loop

```
Hi {{first_name}},

I'll stop following up after this.

If mock-data hygiene ever becomes a priority (fundraise diligence, SOC 2 prep, enterprise security review), the offer stands: one repo, complimentary scan, 15-minute debrief.

Good luck with {{company_specific_goal}}.

{{your_name}}
```

---

## Toronto local outreach (trust-enhanced)

**Local opening (add after {{personalization_line}}):**

> As a Toronto-based infrastructure engineer, I understand the unique challenges of scaling into the US market under SOC 2 Type II and HIPAA requirements. I'm available for face-to-face deployment reviews or an on-site read-only assessment at your Toronto office if that helps your security review.

**Discovery call offer (Toronto):**

> If you prefer, I can conduct the initial assessment on-site at your Toronto office to address any in-person security concerns. Otherwise a read-only GitHub clone works — your code never leaves your infrastructure if we use on-prem CI.

### Toronto targets (customize {{company}} / {{first_name}})

| Company | Angle |
|---------|--------|
| **Wealthsimple** | FinTech vendor diligence; mock KPIs in dashboard samples |
| **Clearco** | Series-stage eng velocity + investor technical questions |
| **League** | HealthTech sample-data hygiene before compliance reviews |
| **BlueDot** | Enterprise buyers + evidence for AI-assisted dev governance |
| **Connected** | Platform eng; production-path leak checks alongside GHAS |

**Subject (Toronto):** `Toronto eng — read-only mock-data scan before your next vendor review`

```
Hi {{first_name}},

{{personalization_line}}

As a Toronto-based infrastructure engineer, I help funded teams pass vendor security reviews without blocking merges on day one.

Simplebeacon is a **100% read-only** static analysis engine — zero writes to your application source. We start in **reporting-only** CI (no `--gate`) until your team signs off on allowlists. Deploy in your AWS/GCP VPC if required.

It complements Snyk/GHAS: fiction KPIs in *-sample.json*, sample paths under server/, credential-like patterns in config — scoped for SOC 2 / HIPAA diligence conversations, not a replacement for your AppSec stack.

Complimentary read-only scan on one repo + 15-minute debrief. Open to meeting at your Toronto office or over Zoom this week.

Best,
{{your_name}}
Founder, Simplebeacon
simplebeacon.ai | {{phone}}
```

---

## Industry variants

### SaaS / enterprise sales motion

**Subject:** Vendor security reviews — mock-data question buyers ask

```
Hi {{first_name}},

As {{company}} moves upmarket, security questionnaires often ask how you govern AI-assisted development — not just whether you run Snyk.

Simplebeacon checks a blind spot: mock/sample data and fiction KPIs in repo files, plus sample paths referenced from production directories. I run the scan; I triage false positives before you see the report.

Complimentary scan on one repo + 15-min debrief. Interested?

{{your_name}}
```

### FinTech (compliance framing — no overclaim)

**Subject:** SOC 2 evidence gap — mock data & sample paths

```
Hi {{first_name}},

FinTech teams usually have dependency scanning covered. Less common: evidence that dashboard/sample JSON and production code don't reference mock fixtures or unverifiable KPIs — auditors and bank partners notice.

Simplebeacon produces an audit-friendly findings summary (pattern hits + consultant notes). Complements your existing stack; doesn't replace secret scanning.

Happy to run a complimentary scan on one repo if useful for your next audit cycle.

{{your_name}}
```

### HealthTech (honest scope)

**Subject:** Sample data hygiene before your next compliance review

```
Hi {{first_name}},

HealthTech repos often accumulate sample JSON, demo configs, and AI-generated placeholder metrics. Simplebeacon flags fiction patterns in sample files and sample-path references in production code — scoped pattern matching, not PHI discovery.

Useful as **one input** into HIPAA/security reviews, not a substitute for a full risk assessment.

Complimentary 15-minute discovery scan on one repo if you'd find that helpful.

{{your_name}}
```

### PE / M&A / operating partner

**Subject:** 48-hour technical diligence on mock-data risk

```
Hi {{first_name}},

For portfolio diligence we clone a repo, run Simplebeacon's gate (credentials, production-path leaks, fiction KPIs in samples), and deliver a consultant-reviewed memo — candidates flagged, false positives filtered.

Works well as a narrow slice alongside your existing code scan vendors.

Open to a 15-minute call on how we'd scope one target repo?

{{your_name}}
```

---

## LinkedIn connection note (300 chars)

```
Hi {{first_name}} — I help funded eng teams catch mock-data/fiction KPI issues that Snyk/GHAS don't scope. Offering complimentary 15-min repo scans. Worth connecting?
```

---

## Discovery call → scan handoff (after they reply yes)

```
Great — send a GitHub URL (or zip) for one repo and I'll run a read-only Simplebeacon pass.

Trust note: the scan engine does not modify your source files. Week 1 delivery uses reporting-only CI (no --gate) until we jointly sign off on allowlists. On-premises in your VPC is available — see our on-prem doc if InfoSec asks.

Before the call I'll send a 1-page summary: critical / review / likely false positive.

Call agenda (15 min) — see docs/simplebeacon-demo-framework.md:
1. Security & read-only architecture (2 min)
2. Top 3 findings (3 min)
3. What your current stack already covers (3 min)
4. Allowlist vs fix (5 min)
5. Optional: pilot scope + on-prem preference (2 min)

Does {{day}} {{time}} work?
```

---

## Objection handling ($500/hr consultant frame)

Use when they push back on price, false positives, or "we already have Snyk."

### "We already use Snyk / GHAS / SonarQube."

**Response:** "Good — keep them. They own CVEs and known secret formats. Simplebeacon owns mock-data hygiene: fiction KPIs in sample JSON, sample paths under `server/`, schema drift in dashboard fixtures. Different layer. The scan takes minutes; the value is knowing what's in scope for your next vendor review."

### "This sounds like false positives."

**Response:** "Pattern matchers always surface candidates. That's why I don't sell self-serve gate-only to enterprises — I triage before you see the report. False positives become allowlist entries; real hits become remediation tickets. You're paying for judgment on top of the tool."

### "$15k/month is expensive."

**Response:** "Compare to one week of senior eng time during an audit fire drill, or one lost enterprise deal stuck in security review. The pilot is $2,500 fixed: one repo, configured gate, executive summary, no retainer. If it doesn't surface anything useful, we stop. If it does, we scope Silver or Gold from evidence, not slides."

### "Can't we just run the CLI ourselves?"

**Response:** "Absolutely — Cloud Teams is $49/mo on simplebeacon.ai for teams that want the hosted gate. Consulting is for config, allowlists, CI integration, and someone who reads every finding in context of your stack. Same read-only tool; different time-to-confidence. We still start reporting-only before blocking merges."

### "Will this break our CI or modify our code?"

**Response:** "No. The scan command is read-only on your source tree — we verify that in automated tests before every enterprise delivery. Week 1 runs without `--gate` so nothing fails your pipeline until your Engineering Lead and I sign off on allowlists. We never auto-fix your application code."

### "We need everything on-premises."

**Response:** "Supported. CLI-only in your GitHub runners, or full dashboard in Docker inside your VPC. I'll send our on-premises deployment outline — your proprietary code never has to touch our SaaS."

### "We're too early / too small."

**Response:** "Then start with the complimentary scan or Pro self-serve. The consulting tiers matter when you're answering enterprise security questionnaires or investor technical diligence — usually Series B+ or first big regulated customer."

### "Send me more info."

**Response:** "I'll send the 1-pager after the scan — findings beat PDFs. Reply with one repo URL and I'll schedule the 15-minute debrief."

---

## Trust-building checklist (pre-outreach)

### Before first discovery call
- [ ] Run `npm test -- tests/integration/scanner.test.js` (zero-mutation proof)
- [ ] Review `docs/simplebeacon-on-premises-deployment.md`
- [ ] Review `docs/simplebeacon-demo-framework.md` (trust opening)
- [ ] MSA Exhibit C + read-only language ready to send if InfoSec asks

### During discovery call
- [ ] Start with trust statement (demo framework §0)
- [ ] Explain read-only architecture; offer on-prem
- [ ] Frame SOC 2 / HIPAA as evidence, not certification
- [ ] Use honey-pot demo if no repo access yet

### In SOW / MSA
- [ ] Read-only commitment (Section 1)
- [ ] Client control + revoke access (Section 3)
- [ ] No writes to source (Section 5)
- [ ] Reporting-only Week 1 (Exhibit A + C)
- [ ] On-premises option (Exhibit C)

---

## Personalization checklist (5 min per prospect)

- [ ] Funding stage / recent round (Crunchbase, press)
- [ ] Hiring: security, platform, VP Eng
- [ ] Public tech blog mentions Copilot/Cursor/AI coding
- [ ] Selling to enterprise / regulated customers
- [ ] Recent product launch or SOC 2 announcement

**Do not** claim you reviewed their codebase before the scan.

---

## A/B testing (simple spreadsheet)

Track per variant: sent, opens (if available), replies, meetings booked, pilots sold.

| Variant | Subject | Segment | Sent | Replies | Meetings |
|---------|---------|---------|------|---------|----------|
| A | Snyk gap | SaaS CTO | | | |
| B | Copilot metrics | Series B | | | |
| C | Vendor review | FinTech | | | |

**Targets (cold, funded CTO list):** replies >5%, meetings >2% of sent.

---

## How we begin (post-reply)

| Step | You deliver | They provide |
|------|-------------|--------------|
| 1 | Ack + calendar link | Repo URL or zip |
| 2 | Simplebeacon scan (`minimal` or `standard` profile) | — |
| 3 | 1-page exec summary (see `simplebeacon-exec-summary-template.md`) | — |
| 4 | 15-min debrief call | Eng or security lead |
| 5 | Optional: Pilot SOW ($2,500) | Signature |

---

## Related docs

- Approved claims: `packages/simplebeacon-cli/docs/MARKETING.md`
- Discovery demo script: `docs/simplebeacon-demo-framework.md`
- On-premises: `docs/simplebeacon-on-premises-deployment.md`
- Post-scan deliverable: `docs/simplebeacon-exec-summary-template.md`
- Pricing: `docs/simplebeacon-pricing-page-copy.md`
- MSA draft: `docs/simplebeacon-enterprise-msa-template.md`
- Safe-fail tests: `tests/integration/scanner.test.js`
