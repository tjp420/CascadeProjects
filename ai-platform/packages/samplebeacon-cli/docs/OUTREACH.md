# Free Samplebeacon Assessment — Outreach Script

Use this for Phase 1 customer discovery. **Do not oversell** — the scan covers sample JSON fiction, production-path leaks, credentials, and schema drift. It does not scan arbitrary AI hallucinations in source files.

---

## One-line pitch

> We run a CI gate that catches mock JSON in production code paths, fiction KPIs in sample files, and credential patterns — in under a minute. Want a free scan of your repo?

---

## Email / DM template

**Subject:** Free scan — mock data & fiction KPIs in [Company] repo?

Hi [Name],

Teams using Copilot/Cursor often end up with:

- `*-sample.json` or `/mock/` paths referenced from production code
- Inflated dashboard KPIs (`62% completion`, `47 features`) in committed JSON
- Demo credentials that look real

I built **Samplebeacon** — a CLI that scans for these in CI (`samplebeacon scan --gate`).

**Offer:** I'll run a free scan on your repo (read-only, no code changes) and send a short report:

1. Fiction KPIs in sample/mock JSON  
2. Production-path leaks (sample references in `server/` / `src/`)  
3. Credential pattern matches  
4. JSON schema drift vs your page specs  

Takes ~30 seconds. If it's useful, would you consider adding the gate to PRs?

[Your name]

---

## Call script (15 minutes)

### 1. Open (2 min)

- "What AI tools does your team use for code generation?"
- "Do you have dashboard JSON, fixtures, or mock data directories?"
- "Have you ever shipped demo metrics or sample paths by accident?"

### 2. Run scan live (5 min)

```bash
npx samplebeacon init --profile standard
npx samplebeacon scan --format text
npx samplebeacon scan --gate   # show what would fail CI
```

Walk through the report sections in order: **credentials → fiction KPIs → production leaks → schema**.

### 3. Interpret results (5 min)

| Finding | What it means | Typical fix |
|---------|---------------|-------------|
| Fictional KPI | Sample JSON still has template metrics | Replace with measured baseline |
| Production Leak | Prod code references `-sample.json` | Route through API/scanner, centralize seeds |
| Credential Pattern | Possible secret in repo | Rotate + move to env vars |
| Schema Violation | Sample missing required page keys | Align with page spec |

### 4. Close (3 min)

- "Would blocking these on PR merge be worth $[X]/year to your team?"
- "Can I help you add `samplebeacon scan --gate` to GitHub Actions this week?"
- If no: "What would you pay for instead?"

---

## Qualification checklist

**Good fit:**
- [ ] Uses AI coding assistants regularly
- [ ] Has `web/data`, `fixtures/`, or `mock/` directories
- [ ] Internal dashboards fed by JSON samples
- [ ] No dedicated AppSec tooling for mock/fiction drift

**Poor fit:**
- [ ] No sample/mock JSON in repo
- [ ] Expects full SAST/secret scanning replacement (position as complementary)
- [ ] Expects AI hallucination detection in all `.js` files (not shipped yet)

---

## Objection handling

**"We already use Snyk."**  
→ "Snyk finds CVEs. Samplebeacon finds mock paths and fiction KPIs in sample JSON — run both."

**"We don't commit sample data."**  
→ "Then production-leak and credential rules still apply; fiction KPI rule won't trigger."

**"Isn't this just linting?"**  
→ "It's domain-specific: known fiction patterns from real AI-assisted repos, plus hardcoded sample path detection."

---

## Success criteria (Phase 1)

- 10 assessments delivered  
- 3 teams add `samplebeacon scan --gate` to CI  
- 1 team commits to paid pilot ($2K+/year or equivalent)

See [examples/assessment-report-template.json](./examples/assessment-report-template.json) for the deliverable format.
