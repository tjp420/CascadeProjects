# Simplebeacon Pre-Launch Audit — Outreach (Closed Vault)

**Product:** $499 flat · read-only repo · PDF report in 48h · proprietary engine · no public software.

**Public proof (use in every email):**

- Paywall: https://simplebeacon.ai  
- Sample deliverable layout: https://simplebeacon.ai/sample-report  
- Business inbox: **audit@simplebeacon.ai** (forwards to your personal inbox via Cloudflare Email Routing)  
- Payment: `[YOUR STRIPE PAYMENT LINK]` — paste when live

Do **not** link to GitHub, CLI installs, or free scans.

---

## How scanning actually works (domain = billboard only)

**simplebeacon.ai does not run client scans.** It collects payment and sets expectations. All compute happens on local hardware.

| | Method A — ZIP drop (**active, public offer**) | Method B — client runs CLI (**not public yet**) |
|---|---|---|
| Who scans | You, on your PC | Client, on their PC |
| Client gets | PDF only | Pass/fail locally; pays you for executive PDF |
| Your IP | Stays private | Would require public npm/GitHub |
| Site today | ✅ Paywall + audit@simplebeacon.ai | ❌ Disabled (closed vault) |

**Method A workflow:** Pay $499 → zip to audit@simplebeacon.ai → you unzip to `AuditSandbox` → private CLI → PDF → delete folder.

---

## Cloudflare Email Routing (audit@simplebeacon.ai → your inbox)

Free forwarding — no paid mail host. Do this once in the Cloudflare dashboard:

1. **Domain** → simplebeacon.ai → **Email** → **Email Routing**
2. **Destination addresses** → Add `trevor_punt@live.com` → verify the link Cloudflare sends to Live.com
3. **Routing rules** → Create address:
   - Custom address: `audit` → `audit@simplebeacon.ai`
   - Action: Forward to → `trevor_punt@live.com`
4. Click **Add records and enable** when prompted (MX + SPF auto-injected)

**Optional aliases** (same destination): `billing@`, `legal@`, `privacy@` — match addresses on `/refund`, `/terms`, `/privacy`.

**Test:** From another account, email `audit@simplebeacon.ai`. Message should land in `trevor_punt@live.com` within ~10 seconds.

When verified, type: **"The email pipeline is verified."**

---

## One-line pitch

> I run a $499 private pre-launch repo audit — credentials, mock paths in production code, and fiction KPIs in sample JSON — PDF deliverable in 48 hours, read-only, pay upfront.

---

## Paid audit email (copy-paste — send 5 today)

**Subject options (pick one):**

- Pre-launch leak check before [Client name] goes live?
- $499 repo audit — mock data & credential scan (48h)
- Quick question before you hand off [Project] to the client

**Body:**

Hi [First name],

I run **private pre-launch code audits** for dev agencies shipping AI-assisted builds.

Before handoff or launch, I scan read-only for what review often misses:

- API keys and token-shaped strings in source  
- Mock/sample paths (`*-sample.json`, `data/mock/`) referenced from production code  
- Template KPIs and demo metrics still in committed JSON  
- Sample files that drift from your page/API specs  

**How it works:** Pay $499 upfront via Stripe. Send a secure zip or GitHub read-only access to one branch. I run the scan on my machine — nothing goes to a third-party cloud. You get a client-ready PDF with severities and fix-first priorities within **48 hours**.

**Flat fee: $499** · No subscription · No software download

**Sample report layout:** https://simplebeacon.ai/sample-report  
**Book & pay:** https://simplebeacon.ai (or `[YOUR STRIPE PAYMENT LINK]` when live)

If [Client project / their agency name] is shipping in the next few weeks, reply with repo scope (branch name is fine) after payment and I'll confirm your 48-hour delivery window.

Trevor
audit@simplebeacon.ai

---

**Follow-up (3 days, no reply):**

Subject: Re: pre-launch leak check

Hi [First name] — quick bump. The usual miss before client handoff: `-sample.json` and `data/mock/` still referenced from `server/` or `src/`. Scan takes minutes; fixing after launch is expensive. One slot left this week if useful.

[Trevor]

---

## SOW line (invoice / reply to "yes")

> Read-only scan of one Git repository (default branch or named release branch). Deliverable: written assessment covering credential pattern matches, production-path mock/sample references, fiction KPI patterns in configured sample paths, JSON schema drift, and CI gate recommendation. Opinion-based audit — not a guarantee of security or legal compliance. Turnaround: 2 business days after access granted. Fee: $499 USD, due on acceptance.

---

## Reply template: “Yes, send SOW”

**Subject:** Re: Pre-launch audit — SOW & next steps ($499)

Hi [First name],

Great — here’s the scope for the pre-launch repo audit.

### Statement of Work

**Service:** Simplebeacon Pre-Launch Code Audit (read-only static analysis)

**Scope:** One Git repository — branch `[branch name or default]` — or one zip export of the same.

**Method:** Local scan using proprietary SimpleBeacon analysis (read-only). Your source is not uploaded to a third-party cloud for processing.

**Deliverable (within 2 business days after access):**

- Client-ready PDF audit report with findings by severity  
- Credential pattern matches (e.g. AWS keys, API token shapes)  
- Production-path mock/sample references (`*-sample.json`, `data/mock/`, etc.)  
- Fiction KPI / placeholder metrics in sample JSON where applicable  
- JSON schema drift vs configured page/sample specs  
- Executive PASS/FAIL gate sign-off + developer remediation action plan  
- Fix-first remediation notes (priority order)

**Out of scope:** Penetration testing, legal/compliance certification, live runtime monitoring, SaaS dashboard access, or ongoing support unless agreed separately.

**Fee:** **$499 USD** flat — due before work starts (Stripe: `[YOUR STRIPE PAYMENT LINK]` or https://simplebeacon.ai).

**Payment:** [Stripe link / PayPal / invoice PDF — pick one]

**Disclaimer:** This is an opinion-based technical review of the files provided at the time of scan. It does not constitute a warranty, insurance, or guarantee that the repository is secure or compliant with any regulation.

### What I need from you

1. **Repo access:** GitHub read-only invite to **tjp420** **or** a zip of the repo at the target branch  
2. **Confirm:** Repository URL, branch name, and billing contact email  
3. **Payment:** Reply “accepted” and complete payment via [link] (or confirm PO if you use one)

Sample deliverable format: https://github.com/tjp420/simplebeacon/blob/main/docs/SAMPLE_REPORT.md

Once payment clears and access is granted, I’ll confirm start time and delivery by [date].

Thanks,  
Trevor  
[your email]

---

## Where to find 5 targets (30 min)

1. **Clutch.co** → filter Web Developers, 10–49 employees, US/UK  
2. Open **Portfolio** → pick agencies shipping dashboards / SaaS / client portals  
3. Contact: **Founder, CTO, or Technical Director** (not generic info@ unless that's all you have)  
4. Personalize one line: client industry or "saw you ship React/Node builds"

**Good fit:** ships client code, uses AI tools, has fixtures/mock/data folders.  
**Skip:** wants SOC 2 attestation, 24/7 SLA, or live chat DLP.

---

## Local audit workflow (your desk only)

```
[ Client pays $499 ] → [ ZIP or read-only GitHub ] → [ Unzip to sandbox ] → [ Private CLI ] → [ PDF email ] → [ Delete folder ]
```

No client servers. No web scans. No software installed on their machines. Your engine never leaves your hard drive.

### Step 1 — Client sends code (after payment)

Secure zip, private Drive link, or temporary GitHub read-only on one branch.

### Step 2 — Drop into sandbox (Windows)

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\Trevor\AuditSandbox"
Expand-Archive -Path "C:\Users\Trevor\Downloads\client-repo.zip" -DestinationPath "C:\Users\Trevor\AuditSandbox\client-project" -Force
```

### Step 3 — Scan locally (under 2 seconds on typical repos)

```powershell
cd C:\Users\Trevor\AuditSandbox\client-project
npx simplebeacon scan --path . --format json --output .simplebeacon\client-report.json --gate
npx simplebeacon assess --company "Client Company Name" --assessor "Trevor"
```

Or absolute path without `cd`:

```powershell
npx simplebeacon scan --path "C:\Users\Trevor\AuditSandbox\client-project" --format json --output "C:\Users\Trevor\AuditSandbox\client-project\.simplebeacon\client-report.json" --gate
```

### Step 4 — Build PDF deliverable

From repo root (`CascadeProjects`):

```powershell
cd C:\Users\Trevor\CascadeProjects\ai-platform\packages\simplebeacon-cli
node src\reporters\build-report.js "Client Company Name" "Trevor" "C:\Users\Trevor\AuditSandbox\client-project\.simplebeacon\client-report.json" "C:\Users\Trevor\AuditSandbox\client-project\AUDIT_REPORT.md"
cd C:\Users\Trevor\AuditSandbox\client-project
npx md-to-pdf AUDIT_REPORT.md
```

One-liner alternative (from inside client folder after scan):

```powershell
npx simplebeacon report --company "Client Company Name" --client "Client Company Name" --assessor "Trevor" --output AUDIT_REPORT.md
npx md-to-pdf AUDIT_REPORT.md
```

### Step 5 — Deliver and erase

1. Email `AUDIT_REPORT.pdf` to the agency owner.
2. Revoke GitHub read access if used.
3. Delete the sandbox:

```powershell
Remove-Item -Recurse -Force "C:\Users\Trevor\AuditSandbox\client-project"
```

---

## When they pay — quick command block

```powershell
cd C:\Users\Trevor\AuditSandbox\client-project
npx simplebeacon scan --path . --format json --output .simplebeacon\client-report.json --gate
npx simplebeacon assess --company "Paying Client LLC" --assessor "Trevor"
node C:\Users\Trevor\CascadeProjects\ai-platform\packages\simplebeacon-cli\src\reporters\build-report.js "Paying Client LLC" "Trevor" .simplebeacon\client-report.json AUDIT_REPORT.md
npx md-to-pdf AUDIT_REPORT.md
```

Email `AUDIT_REPORT.pdf`. Revoke GitHub access. Delete sandbox folder. Engine stays on your machine.

Alternative (same output):

```powershell
npx simplebeacon report --company "Paying Client LLC" --client "Paying Client LLC" --assessor "Trevor" --output AUDIT_REPORT.md
npx md-to-pdf AUDIT_REPORT.md
```

---

## Legacy: free discovery email (optional — use after paid path is moving)

**Subject:** Free scan — mock data & fiction KPIs in [Company] repo?

Hi [Name],

Teams using Copilot/Cursor often end up with `*-sample.json` in production imports, inflated KPIs in committed JSON, and demo credentials that look real.

I built **Simplebeacon** (https://github.com/tjp420/simplebeacon) — a CLI that catches these in CI (`simplebeacon scan --gate`).

**Offer:** I'll run a free read-only scan and send a short report. If it's useful, we can talk about a full pre-launch audit ($499) before your next client handoff.

[Your name]

---

## Call script (15 minutes)

### 1. Open (2 min)

- "What AI tools does your team use for code generation?"
- "Do you have dashboard JSON, fixtures, or mock data directories?"
- "Have you ever shipped demo metrics or sample paths by accident?"

### 2. Run scan live (5 min)

```bash
npx simplebeacon init --profile standard
npx simplebeacon scan --format text
npx simplebeacon scan --gate   # show what would fail CI
npx simplebeacon assess --company "[Company]" --assessor "[Your name]" --output assessments/[company].json
```

Walk through the report sections in order: **credentials → fiction KPIs → production leaks → schema**.

Send the assessment JSON (see [examples/outreach-tracker.md](./examples/outreach-tracker.md)).

### 3. Interpret results (5 min)

| Finding | What it means | Typical fix |
|---------|---------------|-------------|
| Fictional KPI | Sample JSON still has template metrics | Replace with measured baseline |
| Production Leak | Prod code references `-sample.json` | Route through API/scanner, centralize seeds |
| Credential Pattern | Possible secret in repo | Rotate + move to env vars |
| Schema Violation | Sample missing required page keys | Align with page spec |

### 4. Close (3 min)

- "Would blocking these on PR merge be worth $[X]/year to your team?"
- "Can I help you add `simplebeacon scan --gate` to GitHub Actions this week?" ([GITHUB-ACTION-QUICKSTART.md](./GITHUB-ACTION-QUICKSTART.md))
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
→ "Snyk finds CVEs. Simplebeacon finds mock paths and fiction KPIs in sample JSON — run both."

**"We don't commit sample data."**  
→ "Then production-leak and credential rules still apply; fiction KPI rule won't trigger."

**"Isn't this just linting?"**  
→ "It's domain-specific: known fiction patterns from real AI-assisted repos, plus hardcoded sample path detection."

---

## Success criteria (Phase 1)

- 10 assessments delivered  
- 3 teams add `simplebeacon scan --gate` to CI  
- 1 team commits to paid pilot ($2K+/year or equivalent)

See [examples/assessment-report-template.json](./examples/assessment-report-template.json) for the deliverable format and [examples/outreach-tracker.md](./examples/outreach-tracker.md) to track 10 assessments.

Generate deliverables automatically:

```bash
npx simplebeacon scan --format json --output .simplebeacon/report.json --gate
npx simplebeacon assess --company "Acme Corp" --assessor "Your Name"
npx simplebeacon report --company "Acme Corp" --client "Acme Dashboard" --assessor "Your Name" --output AUDIT_REPORT.md
```

---

## Objection handling
