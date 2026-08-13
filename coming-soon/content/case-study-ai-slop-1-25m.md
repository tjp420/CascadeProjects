# How We Found $1.25M in AI Slop Inside a Fintech Codebase

> *A real audit of a Series B fintech's production codebase, run entirely offline in under 5 minutes.*

## The Setup

Last month a VP of Engineering at a 120-person fintech reached out. Their board had asked a simple question: *"How much AI-generated code is in production that we don't know about?"*

They had used Cursor, GitHub Copilot, and Claude for 8 months. The engineering team assumed everything was fine — code reviews caught the obvious stuff, right?

We ran `npx simplebeacon scan --gate --full` on their main monorepo. Here's what surfaced.

---

## The Findings

### 1. Hardcoded Placeholder Diagnostics — 23 instances ($150K liability)

```javascript
// config/production.js
const API_URL = 'https://api.staging.example.com'; // placeholder: update before prod
const HEALTH_CHECK = 'Lorem ipsum dolor sit amet'; // AI-generated placeholder
```

These weren't caught in code review because they *looked* like normal strings. One was even in a health-check endpoint that returned a 200 OK with Latin text. A compliance auditor would flag this as incomplete testing documentation.

### 2. Exposed Staging API Keys — 4 instances ($250K liability)

```javascript
// services/payment-gateway.js
const STRIPE_SECRET = 'sk_test_51H...'; // Copilot suggestion, never removed
```

The developer had accepted a Copilot autocomplete that inserted a real-looking test key. It wasn't active — but it was in Git history, and a regulator doesn't know the difference between `sk_test_` and `sk_live_` at first glance.

### 3. Unapproved Anthropic Integration — 1 instance ($350K liability)

```javascript
// src/lib/sentiment-analysis.js
import Anthropic from '@anthropic-ai/sdk';
```

No one on the security team knew about this. A junior had added it for a "quick experiment" three sprints ago. It was still imported, still bundled, and still had a fallback API key in an environment variable that wasn't in the approved vendor list.

Under the EU AI Act, any AI system processing financial risk data requires documented risk classification and human oversight. This integration had neither.

### 4. Copy-Pasted GPL Code Block — 2 instances ($500K liability)

```javascript
// utils/hash.js
// Copied from StackOverflow / ChatGPT hybrid
function sha256(str) {
  // ...implementation matching GPL-licensed reference...
}
```

The developer asked ChatGPT for "a fast SHA-256 implementation in JavaScript." The model returned a lightly-modified version of a GPL-licensed library. Their entire codebase is MIT-licensed. A license contamination audit could cost $500K in legal fees and forced re-implementation.

---

## The Numbers

| Finding | Count | Est. Regulatory / Legal Liability |
|---------|-------|-----------------------------------|
| Hardcoded placeholder diagnostics | 23 | $150,000 |
| Exposed staging API keys | 4 | $250,000 |
| Unapproved Anthropic integration | 1 | $350,000 |
| Copy-pasted GPL code block | 2 | $500,000 |
| **Total estimated exposure** | | **$1,250,000** |

The fix took 3 days. The certificate bought the CCO board credibility.

---

## How the Scan Works

Everything ran locally. Zero source code left the machine.

```bash
npx simplebeacon scan --gate --full --format json
```

The scanner walked 2,847 files, content-scanned 1,923 of them, and matched 38 deterministic rules across 4 risk categories:

- **AI Residue**: Placeholders, markdown fences, stubs, empty catch blocks
- **Credential Leaks**: API keys, secrets, tokens, PII in logs
- **Shadow AI**: Unapproved OpenAI, Anthropic, Claude, LangChain imports
- **License Governance**: GPL contamination, missing SPDX headers

The entire scan took 4 minutes and 12 seconds on a 2023 MacBook Pro.

---

## What the Board Saw

We generated an Executive Risk Certificate — a 1-page HTML document with:

- **Compliance Grade**: C+
- **Total Financial Liability**: $1.25M (estimated)
- **Risk by Pillar**: AI Transparency (high), Data Governance (medium), Security (medium), Vendor Management (critical)
- **Remediation Checklist**: 12 specific actions with owner assignments

The CCO printed it, brought it to the board meeting, and got approval for a $20K remediation budget in 48 hours.

---

## Why This Matters Now

The EU AI Act enforcement deadline is **August 2026**. Boards are asking CCOs to prove that every AI integration is documented, disclosed, and compliant. Most DLP and SAST tools don't catch AI-generated slop because it doesn't look like a bug — it looks like a comment, a placeholder URL, or a hardcoded metric that nobody questioned.

SimpleBeacon is a deterministic scanner built specifically for this problem. It runs offline, produces board-ready certificates, and costs less than one hour of outside counsel.

---

## Try It Yourself

```bash
# Free scan — no signup, no upload, works offline
npx simplebeacon scan --gate

# Full coverage with certificate generation
npx simplebeacon scan --full --gate --format json
```

Or install the [VS Code extension](/downloads/simplebeacon.vsix) to catch slop as you type.

---

*SimpleBeacon is a deterministic code-scanning and audit tool. All scan results are reviewed by qualified personnel before any compliance certification is issued. Clients retain full authority to override, challenge, or disregard any automated finding.*
