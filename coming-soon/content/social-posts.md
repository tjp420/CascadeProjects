# Social Media Launch Posts — AI Slop Cop / SimpleBeacon

---

## Hacker News (Show HN)

**Title:** Show HN: A VS Code extension that detects AI-generated slop in real time

**Body:**

After 8 months of building with Cursor and Copilot, I realized my production code was full of AI-generated placeholders, markdown fences that leaked into source files, and hardcoded "99.99% uptime" metrics that looked real but weren't.

Existing linters don't catch this because it's not a syntax error — it's _slop_. Commented-out placeholders that say "AI: implement this later." Empty catch blocks the AI suggested to "handle errors gracefully." Copy-pasted GPL code blocks from StackOverflow hybrids.

So I built AI Slop Cop — a VS Code extension with 53 deterministic rules that catch this stuff as you type:

- 15 free rules: placeholders, markdown fences, stubs, empty catch blocks
- 24 Team rules: credential leaks, mock-path references, debug artifacts
- 14 Enterprise rules: AI SDK imports, accessibility gaps, i18n issues, missing tests

Everything runs offline. Zero network calls. Zero source code upload.

The free tier is actually free — install from the VS Code Marketplace, scan 50 files, and decide if it's worth $49/mo for the full rule set.

Demo GIF: [Upload to GitHub releases or CDN and replace this line]
Marketplace: /downloads/simplebeacon.vsix
GitHub: https://github.com/tjp420/simplebeacon

Happy to answer questions.

---

## Dev.to

**Title:** I Built a Linter That Detects AI Hallucinations in Code

**Tags:** `#vscode` `#ai` `#developer-tools` `#productivity` `#showdev`

**Body:**

## The Problem

AI coding assistants are fast. They're also sloppy.

In the last 6 months I've found:

- A `// placeholder: AI implement this` comment that made it to production
- A markdown code fence (```) that Copilot inserted into a .js file
- A hardcoded `confidence: 0.95` that was supposed to be dynamic
- An empty catch block that swallowed a payment processing error

None of these are bugs that `eslint` catches. They're not syntax errors. They're _slop_ — the residue of an AI assistant that generates plausible-looking garbage.

## The Solution

AI Slop Cop is a VS Code extension with 53 deterministic regex rules that catch this in real time:

**Free tier (15 rules):**

- AI placeholder comments (`// placeholder: AI`, `// FIXME: implement`)
- Markdown fences leaked into source (`^```javascript$`)
- Empty stubs (`function foo() {}`)
- Empty catch blocks (`catch(e) {}`)
- Hardcoded fiction KPIs (`99.99% Uptime`, `Lorem Ipsum`)

**Team tier ($49/mo, 24 more rules):**

- Credential patterns (`api_key = "..."`, `password = "..."`)
- Mock/fixture paths in production code
- Debug artifacts (`console.log`, `debugger`)
- Hardcoded confidence scores and completion rates

**Enterprise tier ($499/mo, 14 more rules):**

- AI SDK imports (OpenAI, Anthropic, LangChain — EU AI Act compliance)
- Missing accessibility labels (`<img>` without `alt`)
- Hardcoded UI strings not wrapped for i18n
- Missing JSDoc on exported functions
- Skipped/placeholder tests

## How It Works

````typescript
// One of the 53 rules
{ id: 'markdown-fence-leak',
  pattern: /^```\w*$/m,
  severity: 'Warning',
  message: 'Markdown code fence leaked into source file',
  fixSuggestion: 'Remove markdown fence lines',
  autoFixable: true,
  tier: 'free' }
````

Rules are tiered. No token = free rules only. Paste a license token = Team/Enterprise rules unlock instantly.

## Try It

```bash
# Install from VS Code Marketplace
# Search: "AI Slop Cop"
```

Or run the CLI version (also free):

```bash
npx simplebeacon scan --gate
```

Runs entirely offline. Your code never leaves your machine.

## The Bigger Picture

This isn't just about code quality. The EU AI Act enforcement deadline is August 2026. Boards are asking CCOs to prove every AI integration is documented and disclosed.

We also built SimpleBeacon — a deep scanner that produces board-ready compliance certificates with A–F grades and estimated financial liability. One fintech client found $1.25M in exposure from AI slop, exposed keys, and unapproved model integrations.

[Read the full case study](https://simplebeacon.ai/blog/case-study-ai-slop-1-25m)

---

_Full disclosure: I built this. The free tier is actually free — no signup, no credit card, no code upload. Upgrade only if the 15 free rules save you time._

---

## Reddit — r/vscode

**Title:** I made a VS Code extension that detects AI-generated slop (placeholders, leaked markdown fences, empty catch blocks) in real time

**Body:**

Hey r/vscode — after 8 months of using Cursor/Copilot, I kept shipping AI-generated garbage to production:

- `// placeholder: AI implement this later` — in a customer-facing API route
- ` ```javascript ` — Copilot leaked a markdown fence into my .ts file
- `catch(e) {}` — "handle errors gracefully" according to the AI
- `99.99% Uptime` — hardcoded metric in a landing page component

ESLint doesn't catch these. Neither does TypeScript. They're not syntax errors — they're _slop_.

So I built AI Slop Cop: 53 deterministic rules that flag this stuff as you type.

**Free tier (no signup, actually free):**

- 15 rules: placeholders, markdown fences, stubs, empty catches, hardcoded KPIs
- 50 files per workspace scan
- Works entirely offline

**Team ($49/mo):** +35 IDE patterns for credential leaks, mock-path references, debug artifacts

**Enterprise ($499/mo):** +14 rules for AI SDK governance, a11y, i18n, missing tests

Marketplace: /downloads/simplebeacon.vsix

GIF demo: [Upload to GitHub releases or CDN and replace this line]

Happy to take feature requests or answer questions.

---

## Reddit — r/webdev

**Title:** EU AI Act is coming (August 2026). I built a tool to find AI-generated slop in production code before auditors do.

**Body:**

The EU AI Act enforcement deadline is 6 months away. Boards are now asking CCOs: _"How much AI-generated code is in production that we don't know about?"_

Most DLP and SAST tools don't catch AI slop because it doesn't look like a bug. It looks like:

- A placeholder comment (`// placeholder: implement`)
- A hardcoded metric (`confidence: 0.95`)
- An unapproved AI SDK import (`import Anthropic from '@anthropic-ai/sdk'`)
- A leaked markdown fence (` ```javascript `)

I built two tools:

1. **AI Slop Cop** (VS Code Extension) — catches this in real time as you code. 15 free rules, 53 total. Install from the Marketplace.

2. **SimpleBeacon** (CLI + Dashboard) — deep deterministic scanner that produces board-ready compliance certificates with A–F grades and estimated financial liability. We ran it on a fintech codebase and found $1.25M in exposure.

Everything runs offline. Zero source code upload.

- Extension: /downloads/simplebeacon.vsix
- CLI: `npx simplebeacon scan --gate`
- Case study: https://simplebeacon.ai/blog/case-study-ai-slop-1-25m

Questions welcome.

---

## LinkedIn (Founder Post)

**Text:**

Last year my team shipped AI-generated placeholder text to production. Three times.

Not because we were careless. Because AI slop doesn't look like a bug.

It looks like a `// placeholder: implement` comment that Copilot inserted and we accepted.
It looks like a `99.99% Uptime` metric that sounded impressive.
It looks like an empty `catch(e) {}` block that the AI suggested to "handle errors gracefully."

None of these are caught by ESLint. None are TypeScript errors. They're _slop_ — the residue of AI-assisted coding that slips through every review process.

So I built AI Slop Cop.

53 deterministic rules. Real-time detection in VS Code. Runs entirely offline.

Free tier: 15 rules, 50 files, zero signup.
Team: $49/mo for credential leaks, debug artifacts, mock-path detection.
Enterprise: $499/mo for EU AI Act compliance, AI SDK governance, a11y/i18n.

We also built SimpleBeacon for deep compliance scanning. One fintech client found $1.25M in regulatory exposure from AI slop, exposed API keys, and unapproved model integrations.

August 2026 is closer than it looks.

Install free → /downloads/simplebeacon.vsix

#AI #CodeQuality #EUAiAct #DevTools #Startup

---

## Twitter/X Thread

**Tweet 1/5:**
Your AI coding assistant just suggested `// placeholder: AI implement this later` in a production file.

You accepted it. It shipped.

This is AI slop — and existing linters don't catch it.

I built something that does.

🧵

**Tweet 2/5:**
AI Slop Cop is a VS Code extension with 53 deterministic rules that catch AI residue in real time:

- Placeholder comments & stubs
- Leaked markdown fences (```)
- Empty catch blocks
- Hardcoded fiction KPIs
- Credential leaks
- Unapproved AI SDK imports

**Tweet 3/5:**
Free tier is actually free. No signup, no credit card, no code upload.

15 rules. 50 files per scan. Offline only.

If it saves you from shipping one `Lorem Ipsum` to production, it's worth it.

**Tweet 4/5:**
We also built SimpleBeacon for deep compliance scanning.

One fintech found $1.25M in exposure:

- 23 placeholder diagnostics
- 4 exposed staging keys
- 1 unapproved Anthropic integration
- 2 copy-pasted GPL blocks

Board-ready certificates. A–F grades.

**Tweet 5/5:**
EU AI Act deadline: August 2026.

CCOs are asking: "How much AI-generated code is in production that we don't know about?"

Install AI Slop Cop free → /downloads/simplebeacon.vsix

Run deep scan → `npx simplebeacon scan --gate`

Case study → https://simplebeacon.ai/blog/case-study-ai-slop-1-25m
