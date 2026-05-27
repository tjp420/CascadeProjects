# Simplebeacon Technical Executive Summary (Post-Scan Template)

Fill after a complimentary or paid discovery scan. Export from assessment portal or `.simplebeacon/report.json` + manual triage notes.

**Classification:** Confidential — {{company_name}}  
**Version:** 2.0

---

## Document header

| Field | Value |
|-------|-------|
| **Prepared for** | {{company_name}} |
| **Assessment date** | {{date}} |
| **Repository** | {{repo_name_or_url}} |
| **Scan profile** | minimal / standard / cascade |
| **Prepared by** | {{your_name}}, Simplebeacon |
| **Contact** | {{email}} \| {{phone}} |

---

## Executive summary (1 page max)

### Overview

Simplebeacon completed a **pattern-based** scan of {{repo_name}} focused on mock/sample data hygiene and production-path references. This is **not** a full penetration test or CVE audit.

**Scan scope:**
- Sample/mock paths: {{scan_paths_list}}
- Production directories: {{production_paths_list}}
- Files analyzed: {{total_files}}

### Findings summary (after consultant triage)

| Severity | Count (raw) | Count (confirmed) | Notes |
|----------|-------------|-------------------|-------|
| High | {{high_raw}} | {{high_confirmed}} | {{high_note}} |
| Medium | {{med_raw}} | {{med_confirmed}} | {{med_note}} |
| Low | {{low_raw}} | {{low_confirmed}} | {{low_note}} |

**Gate status (if `--gate` enabled):** PASS / FAIL on configured severities

**Immediate action recommended:** Yes / No — {{one_sentence_why}}

### Business context (honest)

- **Vendor diligence / enterprise sales:** Findings may appear in security questionnaires if mock metrics or sample paths are exposed.
- **Audit prep:** Report is **evidence for** SOC 2 / ISO programs — not certification.
- **What this does not assess:** Dependency CVEs, runtime auth, infrastructure, PHI/PCI scope (unless separately engaged).

### Pain pillar assessment (qualitative — fill from triage)

| Pillar | Level (H/M/L) | Evidence from this scan |
|--------|---------------|-------------------------|
| **Compliance friction** | | e.g. confirmed credential pattern in prod path; fiction KPIs in samples cited in dashboards |
| **Operational chaos** | | e.g. N production-leak hits; eng hours to trace (ask client or estimate) |
| **Technical debt** | | e.g. schema drift, duplicate mocks, anchor sample mismatch |

### Conservative ROI worksheet (optional — use client numbers only)

**Do not invent million-dollar figures.** Fill only what the buyer validates:

| Cost driver | Client estimate | Notes |
|-------------|-----------------|-------|
| Delayed enterprise deal (weeks slip) | $ | Their ACV × probability × delay |
| Senior eng hours on mock/path cleanup | $ | Hours × loaded rate |
| Audit / vendor-review prep (contractor or internal) | $ | One cycle estimate |
| **Total cost of status quo (annualized)** | $ | |

| Investment | Amount |
|--------------|--------|
| Recommended tier (Pilot / Silver / Gold) | $ |
| **Simple payback** | months = investment ÷ (monthly savings) |

If you cannot fill the worksheet with the client, **omit ROI** and lead with confirmed findings + remediation hours.

### Top 3 priorities

1. **{{priority_1_title}}** — {{priority_1_action}} (Est. {{effort_1}})
2. **{{priority_2_title}}** — {{priority_2_action}} (Est. {{effort_2}})
3. **{{priority_3_title}}** — {{priority_3_action}} (Est. {{effort_3}})

---

## Findings detail (repeat per confirmed issue)

### {{issue_id}}: {{issue_title}}

| | |
|--|--|
| **Severity** | high / medium / low |
| **Confidence** | confirmed / likely / false positive (allowlisted) |
| **Category** | Fiction KPI / Credential pattern / Production leak / Schema / Consistency |
| **Location** | `{{file_path}}` |
| **Rule** | {{rule_id}} |

**Description:**  
{{what_was_detected}}

**Pain pillar:** Compliance friction / Operational chaos / Technical debt (pick one)

**Why it matters:**  
{{business_impact_in_plain_language — tie to pillar, not generic "AI compliance"}}

**Recommended action:**  
{{remediation_steps}}

**Consultant note:**  
{{triage_rationale — especially if downgraded from high}}

---

## Category rollups

### Fiction / KPI patterns (*-sample.json only)

| Pattern | Raw hits | Confirmed | Example files |
|---------|----------|-----------|---------------|
| Completion rates | | | |
| Feature counts | | | |
| AI confidence scores | | | |

**Note:** Does not scan arbitrary application runtime metrics outside configured sample files.

### Credential patterns

| Type | Raw | Confirmed | Notes |
|------|-----|-----------|-------|
| AWS / GitHub / JWT / Stripe / generic | | | |

**Note:** Complements GitHub secret scanning; pattern-based only.

### Production path leaks

| Pattern | Raw | Confirmed | Notes |
|---------|-----|-----------|-------|
| `-sample.json` references | | | |
| `/mock/` or `/fixtures/` paths | | | |

### Schema / consistency (if enabled)

| Check | Pass | Fail |
|-------|------|------|
| Page sample specs | | |
| Anchor sample drift | | |

---

## Compliance checklist (from scan)

Map to Simplebeacon's 8-item checklist (`npx simplebeacon compliance`):

| Rule | Status | Evidence |
|------|--------|----------|
| GATE | pass/fail/warn | |
| CRED | | |
| LEAK | | |
| DATA | | |
| SUPPLY | | |
| AUTH | | |

---

## Remediation roadmap

### Week 1 — Critical / confirmed high
- [ ] {{action}}
- [ ] {{action}}

### Month 1 — Medium + allowlist hygiene
- [ ] {{action}}
- [ ] Update `.simplebeacon/config.json` allowlists

### Quarter 1 — Process
- [ ] Add Simplebeacon gate to CI **after allowlist sign-off:** `npx simplebeacon scan --gate --fail-on high`
- [ ] Quarterly rescan + consultant review (if retained)

---

## Week 1 delivery (paid engagement — trust process)

**Provider actions (read-only first):**

1. Deploy Simplebeacon CLI in client CI **without** `--gate` (reporting-only)
2. Generate baseline `.simplebeacon/report.json` artifacts
3. Triage findings; deliver exec summary — no source modifications
4. Joint allowlist workshop with Client Engineering Lead
5. Enable `--gate` only after written sign-off

**Email to send after Week 1 baseline (copy-paste):**

```
Subject: Simplebeacon Week 1 — read-only baseline complete

Hi {{first_name}},

I've completed the initial read-only analysis of your codebase. Simplebeacon ran in reporting-only mode in CI and generated baseline reports. No application source files were modified or blocked.

Next step: I'll work with your team to tune allowlists based on these findings. We will not enable blocking gates until you and your Engineering Lead sign off on the configuration.

Attached: baseline summary + recommended allowlist changes.

{{your_name}}
```

---

## Engagement options (if continuing)

| Option | Price | Best for |
|--------|-------|----------|
| **Pilot** | $2,500 fixed | Prove value on 1–2 repos, 2 weeks |
| **Silver** | $7,500 setup + $1,500/mo | Growth stage, bi-weekly triage |
| **Gold** | $15,000 setup + $5,000/mo | Enterprise questionnaires, weekly triage |
| **Cloud Teams (self-serve)** | $49/mo or $390/yr | Team runs hosted dashboard + gate; no consultant |

**Recommended for {{company_name}}:** {{tier}} — {{one_line_rationale}}

---

## Methodology appendix

**Tool:** Simplebeacon CLI {{version}}  
**Profile:** {{profile}}  
**Rules enabled:** {{rules_list}}  
**False positive handling:** Manual review by {{your_name}}; allowlist updates documented  
**Retention:** {{e.g. clone deleted after 24h if assessment API used}}

### Disclaimer

This assessment reflects automated pattern matching plus consultant triage at a point in time. It does not guarantee absence of security issues. Findings should be integrated with your existing AppSec program, dependency scanning, and penetration testing.

---

## Copy-paste executive blurb (email body after scan)

```
Hi {{first_name}},

Attached is the Simplebeacon discovery summary for {{repo_name}}.

Headline: {{one_sentence_headline}}

Confirmed items needing attention: {{n_confirmed_high}} high, {{n_confirmed_med}} medium.
Likely false positives (allowlisted or docs): {{n_fp}} — detailed in the report.

Suggest a 15-minute call to walk through priorities 1–3 and whether a pilot makes sense.

{{your_name}}
```

---

## Rejected enhancements (do not paste into client docs)

| Draft claim | Why skip |
|-------------|----------|
| "Gartner: 80% of AI security incidents…" | Unsourced — challenged in procurement |
| `--detect-fiction --confidence-gate=98.5` | Flags do not exist; use `npx simplebeacon scan --gate --fail-on high` |
| "PHI exposure scanning" | Out of product scope |
| "$2M compliance savings" without client inputs | Destroys diligence credibility |
| "White-glove assessment portal" as separate product | Assessment **UI** is software; white-glove = Enterprise **service** |
