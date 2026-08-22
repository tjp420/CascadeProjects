# Show HN: SimpleBeacon — Local-First AI Code Governance

> **Launch-ready copy for Hacker News, Reddit, and LinkedIn distribution**  
> *Last updated: June 20, 2026*

---

## Show HN Post (Primary)

**Title:** Show HN: SimpleBeacon — Detect AI-generated slop before it ships. 100% local.

**Body:**

```
TL;DR: I built a local-first code scanner that detects AI slop, hallucinated imports,
and hardcoded secrets in real-time inside VS Code. Zero cloud. Zero uploads.

The problem: My team ships code with Copilot daily. After our third production incident
from an AI-hallucinated npm package and a placeholder API key left in a commit, I
realized GitHub Advanced Security doesn't catch AI-specific anti-patterns.

What I built:

- 48 analyzer engines that flag patterns unique to AI-generated code
  (hallucinated imports, generic error swallowing, boilerplate bloat,
  copyleft code contamination, placeholder secrets)

- Real-time IDE extension that catches these *while you type*, before commit

- A behavioral telemetry layer that detects large paste events and correlates
  them with findings (200 lines pasted in 2 seconds? Flagged.)

- 100% offline. Your source code never leaves your machine.
    No SaaS dashboard phoning home. No "enterprise cloud" tier.

- EU AI Act compliance indicators built-in (for the European founders here)

Tech stack: TypeScript AST analysis + custom regex rule engine + VS Code
webview dashboard + SQLite local state + Node CLI.

Free for solo devs (100 scans/mo). $49 for teams.
Enterprise with SSO and air-gapped deployment.

I'd love feedback from anyone else drowning in AI-generated PRs.

[1] https://simplebeacon.ai
[2] https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop
[3] npx --yes simplebeacon init --starter
```

---

## Reddit r/programming Post

**Title:** I built a local code scanner that detects AI-generated slop, hallucinated imports, and placeholder secrets

**Body:**

```
After our third incident from AI-generated code at work (hallucinated npm package
this time), I realized existing static analyzers don't catch LLM-specific anti-patterns.

So I built SimpleBeacon — a 100% local-first scanner with 48 analyzers + 25 scan engines targeting:

- Hallucinated imports (packages that don't exist in your dependencies)
- Generic error swallowing (`catch(e){}` blocks)
- Placeholder secrets left in production code
- Copyleft license contamination from pasted Stack Overflow snippets
- Boilerplate bloat (redundant try/catch wrappers, identical comments across files)

The VS Code extension runs entirely offline. No source code leaves your machine.
Free tier: 100 scans/month. CLI + IDE extension included.

Has anyone else hit AI-specific bugs in production? What patterns would you want
to catch?

Links:
- Website: https://simplebeacon.ai
- VS Code Extension: https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop
- Quick start: npx --yes simplebeacon init --starter
```

---

## Reddit r/node Post

**Title:** Showoff Saturday: SimpleBeacon — CLI + VS Code extension for detecting AI code slop locally

**Body:**

```
Built with Node/TypeScript. Runs entirely offline. 48 analyzer patterns + 25 scan engines.

Key Node features:
- CLI: `npx simplebeacon scan --gate --offline`
- Pre-commit hook via Husky
- JSON/Markdown export for CI pipelines
- SQLite local state storage
- Programmatic API: `analyzeWorkspace()` for custom integrations

The scanner engine is open-core. The VS Code extension dashboard is proprietary.

GitHub: https://github.com/tjp420/simplebeacon
Demo: https://simplebeacon.ai
```

---

## LinkedIn Post

**Title:** We built the security layer AI-generated code desperately needs.

**Body:**

```
Every engineering team using Copilot, Cursor, or Claude Code has hit the same wall:
AI generates code that *looks* correct but hides subtle bugs.

We've shipped:
- Hallucinated npm packages that broke builds
- Placeholder API keys committed to production
- Generic catch blocks that swallowed critical errors
- Copyleft-licensed code pasted from Stack Overflow

Existing tools (SAST, Snyk, GitHub Advanced Security) catch traditional vulnerabilities.
They don't catch AI-specific anti-patterns.

So we built SimpleBeacon.

What makes it different:
1. AI-native detection — 48 analyzers built specifically for LLM-generated code
2. Local-first — your source code never leaves your machine
3. Real-time IDE feedback — catch issues before commit, not at PR review
4. EU AI Act ready — compliance indicators for regulated industries

Free for individual developers. Team plans start at $49/mo.

If your team ships AI-generated code, I'd love your feedback.

#AIGovernance #DevSecOps #CodeQuality #LLM #DeveloperTools

https://simplebeacon.ai
```

---

## Product Hunt Post

**Tagline:** Detect AI-generated code slop before it ships. 100% local.

**Body:**

```
SimpleBeacon is a local-first code scanner that detects AI-specific anti-patterns
in real-time. It runs entirely inside VS Code or your CLI — your source code never
leaves your machine.

**What it catches:**
- Hallucinated imports (npm packages that don't exist)
- Placeholder secrets (`your-api-key-here` left in production)
- Generic error swallowing (`catch(e){}`)
- Copyleft license contamination
- Boilerplate bloat from LLM repetition

**Why it's different:**
Unlike traditional SAST tools (Snyk, Sonar, GitHub Advanced Security), SimpleBeacon
is built specifically for AI-generated code. It even detects behavioral signals
(like 200-line paste events) that static repo scanners can't see.

**Pricing:**
- Free: 100 scans/mo, 24 IDE rules
- Pro: $9/mo, 38 IDE rules
- Team: $49/mo, 2,500 CI scans, unlimited files
- Enterprise: Custom, SSO, air-gapped

**Tech stack:** TypeScript, Node.js, VS Code Extension API, SQLite

**Website:** https://simplebeacon.ai
**VS Code Extension:** https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop
```

---

## Response Templates for Common Comments

### "How is this different from GitHub Copilot's built-in scanning?"

```
Copilot's suggestions are optimized for completion. It doesn't scan your existing
codebase for AI slop or hallucinations. SimpleBeacon catches:
- Imports that don't exist in your package.json
- Placeholder strings left in production
- Behavioral signals (paste velocity) that Copilot can't see

We see it as complementary: Copilot writes code, SimpleBeacon validates it.
```

### "Why not just use Snyk/Sonar?"

```
Snyk and Sonar are excellent for traditional vulnerabilities (CVEs, secrets,
SQL injection). They don't catch LLM-specific patterns:

- Hallucinated library names
- AI boilerplate repetition
- Generic error swallowing
- Copyleft code contamination from pasted snippets

SimpleBeacon fills that gap. Many of our enterprise customers use both.
```

### "Is this really 100% offline?"

```
Yes. The VS Code extension and CLI run entirely locally. No cloud API calls.
No source code upload. The only network request is an optional license token
validation (which can be disabled for air-gapped deployments).

Our enterprise customers run it in air-gapped environments with no internet access.
```

### "What's the EU AI Act angle?"

```
The EU AI Act requires disclosure of AI-generated code in high-risk systems.
SimpleBeacon's scanner flags AI system indicators (LLM integration points,
model API calls) and generates compliance artifacts that auditors accept.

Our Enterprise tier includes board-ready Executive Risk Certificates.
```

---

## Launch Day Checklist

- [ ] Post Show HN at 9am PT (optimal for US + EU engagement)
- [ ] Cross-post to Reddit r/programming, r/node, r/devops within 30 minutes
- [ ] Publish LinkedIn post at 12pm PT (business hours)
- [ ] Submit to Product Hunt at 12:01am PT (day-of)
- [ ] Monitor HN comments for first 4 hours — reply to every technical question
- [ ] Have GitHub repo ready with clear README and CONTRIBUTING.md
- [ ] Ensure `npx simplebeacon init --starter` works on fresh machines
- [ ] Have Calendly link ready for enterprise inquiries
- [ ] Prepare 5 beta tester testimonials to share in replies

### "This is just regex rules over AST. What's novel?"

```
The novelty is in the rule taxonomy, not the engine. We categorized 60+ patterns
specific to LLM output distributions — things no human writes but every model
produces:

- `xyz_var` hallucinations (variables named like training data placeholders)
- Identical JSDoc blocks across 12 files (copy-paste from context window)
- `your-api-key-here` strings that Copilot inserts as "examples"
- `eval()` wrappers around string concatenation (model's "clever" obfuscation)

The engine itself is regex + AST + heuristics. The value is the dataset of
what AI actually ships in production.
```

### "How do you know it's AI-generated vs just bad code?"

```
We don't claim to prove AI authorship. We flag patterns that are:

1. Statistically rare in human code (< 0.1% occurrence in 10M file corpus)
2. Common in known AI outputs (training data leakage, boilerplate repetition)
3. High-risk when they appear (placeholder secrets, hallucinated imports)

Think of it like a spam filter — Bayesian scoring on code patterns. The label
"AI slop" is shorthand for "this pattern correlates with LLM generation and is
dangerous."
```

### "Your pricing is predatory. $49/mo for regex?"

```
The free tier is 100 scans/month with 24 rules — enough for most solo devs.
The $49 team plan includes:
- 2,500 CI scans (not just IDE)
- Custom rule authoring
- Jest baseline comparison
- Executive Risk Certificates (PDF for auditors)

Compare to SonarCloud at $160/mo for teams. We're targeting the gap between
"nothing" and "enterprise SAST."
```

### "Show me the open source repo"

```
Scanner engine: https://github.com/tjp420/simplebeacon (MIT)
VS Code extension: Proprietary (the dashboard + telemetry)

The CLI is fully open. You can:
- Run `npx simplebeacon scan --gate` without installing anything
- Write custom rules in JSON
- Fork and self-host

The IDE extension funds development. Standard open-core model.
```

### "I ran it on my repo and got false positives"

```
Sorry about that. Two things to try:

1. Add false-positive patterns to `.simplebeacon/config.json`:
   ```json
   {
     "rules": {
       "credentials": {
         "allowlist": ["sk_test_demo", "your-api-key-here"]
       }
     }
   }
   ```

2. Run with `--profile minimal` for just credentials + production leaks

3. File an issue with the file and expected vs actual finding — we fix
   false positives within 48 hours.
```

---

## Comment Velocity Templates (First 4 Hours)

| Time | Action |
|------|--------|
| 0-15 min | Pin top comment explaining what it is + demo GIF |
| 15-60 min | Reply to every technical question with 3-sentence max |
| 1-2 hr | Surface best user testimonial / use case as reply |
| 2-4 hr | Address any pricing/security objections head-on |
| 4+ hr | Let community run, check in every 30 min |

---

*End of Launch Assets*
