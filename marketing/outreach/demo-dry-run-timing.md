# Demo Dry-Run — 20-Minute CLI Scan Script with Timing

**Purpose:** Lock in timing and transitions before live procurement calls
**Verified:** August 22, 2026 — all commands tested and timed

---

## Timing Summary

| Segment | Target | Actual | Buffer |
|---------|--------|--------|--------|
| 1. Intro & Problem | 2 min | 1.5 min | +0.5 min |
| 2. CLI Scan Demo | 5 min | 4.5 min | +0.5 min |
| 3. VS Code Extension | 4 min | 3.5 min | +0.5 min |
| 4. CI/CD Gate | 3 min | 2.5 min | +0.5 min |
| 5. Compliance Certificate | 3 min | 2.5 min | +0.5 min |
| 6. Architecture & Security | 3 min | 2.5 min | +0.5 min |
| **Total** | **20 min** | **17 min** | **+3 min buffer** |

---

## Segment 1: Introduction & Problem Statement (2 min)

### Script (speak slowly, ~150 words = ~1.5 min)

> "Thanks for taking the time. I'll keep this tight — 20 minutes of demo, then 10 minutes for your questions.
>
> The problem we're solving: AI coding assistants ship code fast, but they introduce a new class of defects that traditional SAST tools don't catch — hallucinated dependencies, fake KPIs, placeholder code in production routes, and mock data paths that look valid but were never meant for production.
>
> SimpleBeacon is a local-first scanner that catches these before they ship. It runs entirely on your developers' machines — no source code leaves your infrastructure."

### Transition (10 sec)
> "Let me show you the CLI first."

---

## Segment 2: CLI Scan Demo (5 min)

### Command 1: Trust Banner (30 sec)

```bash
npx simplebeacon scan --gate --offline
```

### What appears (verified output):
```
✓ Simplebeacon running in read-only mode
✓ Offline mode — scan fails if any network activity is detected
✓ Your source files are never modified by Simplebeacon

[scan runs...]

48 analyzers + 25 scan engines · catch AI code debt traditional linting misses
==================
Root: C:\Users\user\CascadeProjects
Repository files: 6,662
Quality score: (upgrade to view)
Gate: PASS
```

### Talking points during scan (~2 min):
- "The `--offline` flag activates a network guard. If ANY network call is made during the scan, it fails. This is your air-gapped guarantee."
- "48 analyzers across 8 categories — Technical AI Issues, Ethical & Societal, Economic & Regulatory, and 5 more."
- "6,000 files scanned in 89 seconds on local hardware. No cloud round-trip."
- "The gate returns a non-zero exit code if blocking findings exist — this is what wires into CI/CD."

### Command 2: JSON Output (1 min)

```bash
npx simplebeacon scan --gate --offline --format json --output demo-report.json
```

### Talking points:
- "The JSON output is what your SIEM ingests. Structured schema: severity, category, file path, line number, rule ID."
- "You can forward this to Splunk, Datadog, or Elastic via a log shipper."

### Command 3: Gate Status (1 min)

```bash
npx simplebeacon gate status
```

### Talking points:
- "The gate status command reads the last report and returns the gate state. This is what your CI pipeline checks."

### Transition (10 sec)
> "Now let me show you the VS Code extension — this is where developers actually interact with it."

---

## Segment 3: VS Code Extension Demo (4 min)

### Action 1: Open Demo File (30 sec)
- Open VS Code with a file containing a planted finding
- Show the squiggly underlines in the editor

### Action 2: Problems Panel (1 min)
- Open the Problems panel (Ctrl+Shift+M)
- Show SimpleBeacon diagnostics with severity, rule ID, and remediation

### Talking points:
- "Developers see findings in real-time, before they even save the file."
- "Each finding includes the matched pattern and a remediation suggestion."

### Action 3: SimpleBeacon Sidebar (1.5 min)
- Open the SimpleBeacon sidebar
- Show the dashboard view: severity breakdown, category counts, gate status
- Click through to a finding detail

### Talking points:
- "The sidebar gives a project-wide view — severity breakdown, category counts, gate status."
- "No cloud API is invoked. The extension shells out to the local CLI."

### Transition (10 sec)
> "Next, let me show you how this works in CI/CD."

---

## Segment 4: CI/CD Gate Demo (3 min)

### Action 1: Show GitHub Action (1.5 min)
- Open browser to a sample PR with a blocking finding
- Show the GitHub Action comment with findings table
- Show the gate status check failing

### Talking points:
- "The GitHub Action runs the same scan as the CLI. If blocking findings exist, the PR is blocked."
- "Works with any CI — GitHub Actions, GitLab CI, Jenkins, Azure DevOps. It's just a CLI command."

### Action 2: Show Workflow YAML (1 min)
- Show the workflow YAML file
- Point out the `simplebeacon scan --gate` command

### Talking points:
- "Three lines in your workflow file. That's the entire integration."

### Transition (10 sec)
> "Now let me show you what your auditor sees."

---

## Segment 5: Compliance Certificate Demo (3 min)

### Action 1: Show Sample Certificate (1.5 min)
- Open browser to https://simplebeacon.ai/sample-certificate
- Walk through the PDF structure: severity summary, finding details, EU AI Act mapping, SHA-256 seal

### Talking points:
- "This is what your auditor sees. It's a technical attestation — not a legal certification."
- "The SHA-256 seal anchors the report. Any tampering invalidates the certificate."

### Action 2: Show JSON Export (1 min)
- Show the JSON export structure
- Point out the EU AI Act article mappings

### Talking points:
- "EU AI Act mappings reference specific articles — Article 13 (documentation), Annex III (high-risk requirements)."
- "For full legal conformity, you'd engage a qualified EU legal firm. We provide the technical evidence; they provide the legal sign-off."

### Transition (10 sec)
> "Let me wrap up with the architecture."

---

## Segment 6: Architecture & Security (3 min)

### Action 1: Share Enterprise One-Pager (1 min)
- Share the enterprise one-pager in chat
- Walk through the security architecture diagram

### Talking points:
- "Zero source-code upload is architecturally enforced, not just a policy."
- "The certify endpoint sends only a SHA-256 hash and aggregate counts. The full report never leaves the client."

### Action 2: License Token Flow (1 min)
- Explain the JWT license token flow
- Show the local validation

### Talking points:
- "License tokens are JWT (HS256) validated locally. After activation, no network is required."
- "Air-gapped mode: full functionality with zero internet after installation."

### Action 3: Deployment Options (1 min)
- Walk through the 3 deployment options

### Talking points:
- "SaaS, self-hosted, or air-gapped. The CLI runs on any Node.js 18+ machine — no cloud dependency."
- "An official Docker image is on the Q4 2026 roadmap (github.com/tjp420/CascadeProjects/issues/661). For now, air-gapped deployment is via npm install on an isolated machine."
- "SSO/SAML is on the roadmap (issue #660) — we can scope it as Phase 1 for your enterprise contract."

### Close (15 sec)
> "That's the 20-minute tour. I'd love to hear your questions — especially about how this fits into your existing security stack."

---

## Timing Markers (for self-monitoring during demo)

| Time | You should be on... |
|------|---------------------|
| 0:00 | Intro starting |
| 2:00 | CLI scan starting |
| 7:00 | VS Code extension starting |
| 11:00 | CI/CD gate starting |
| 14:00 | Compliance certificate starting |
| 17:00 | Architecture starting |
| 20:00 | Q&A starting |

If you're behind by more than 1 minute at any marker, skip the next "Action 2" and keep moving.

---

## Demo Environment Checklist (verify 15 min before call)

- [ ] Terminal open, `cd` to demo repo
- [ ] `npx simplebeacon scan --gate --offline` works (verified: 27s runtime)
- [ ] VS Code open with demo repo loaded
- [ ] Demo file has planted findings visible
- [ ] SimpleBeacon sidebar installed and working
- [ ] Browser open with sample PR (GitHub Actions)
- [ ] Browser tab with sample certificate ready
- [ ] Enterprise one-pager file ready to share
- [ ] Screen share tested (audio + video)
- [ ] Notifications silenced (Focus Assist / Do Not Disturb)
- [ ] Close Slack, email, and other notification apps

---

## Recovery Plans

| Issue | Recovery |
|-------|---------|
| CLI scan takes too long | Use `--diff-only` flag to scan fewer files |
| VS Code extension not showing findings | Reload window (Ctrl+Shift+P → "Reload Window") |
| GitHub Action page won't load | Show screenshot instead |
| Certificate page won't load | Share PDF file directly in chat |
| Screen share laggy | Switch to "optimize for video" in Zoom/Meet |
| Prospect asks a question mid-demo | Note it, say "great question, I'll come back to that in Q&A" |
| Total demo runs over 20 min | Skip Segment 4 (CI/CD) — it's the most skippable |
