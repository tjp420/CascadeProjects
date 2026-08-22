# Developer Launch Plan — Show HN + Product Hunt

**Created:** August 22, 2026
**Launch window:** September 2026 (after B2B outreach batch 1 starts)

---

## Launch Order

**Show HN first, Product Hunt 1 week later.**

Rationale: HN drives technical credibility and early adopters. Product Hunt drives broader visibility but converts better when there's already social proof from HN.

---

## Part 1: Show HN Launch

### Timing
- **Day:** Tuesday or Wednesday (highest quality traffic, less noise than Monday)
- **Time:** 8:00 AM ET / 5:00 AM PT (catch East Coast morning + West Coast wake-up)
- **Window:** September 2 or 3, 2026 (after B2B batch 1 is live — social proof)

### Pre-Launch Checklist (T-7 days)
- [ ] **CRITICAL: Make GitHub repo public** — currently private at github.com/tjp420/CascadeProjects (returns 404). Must be public before HN post.
- [ ] Verify `npx simplebeacon scan --gate --offline` works on a clean machine
- [ ] Verify VS Code extension installs from marketplace (search "SimpleBeacon")
- [ ] Verify GitHub repo URL in HN post matches actual repo: https://github.com/tjp420/CascadeProjects
- [ ] Verify README.md is accurate, has install instructions, no inflated claims
- [ ] Verify website is live: https://simplebeacon.ai
- [ ] Prepare 3-5 demo repos with real findings for screenshots
- [ ] Take screenshots: terminal output (with "48 analyzers + 25 scan engines" banner), VS Code extension, GitHub Action PR comment
- [ ] Record 30-second GIF of scan running (for HN comments if asked)
- [ ] Test the HN post title — must fit in 80 chars, no clickbait
- [ ] Prepare answers for top 8 likely questions (see below)

### The Post

**Title:** Show HN: SimpleBeacon – 100% offline scanner that catches AI slop and credential leaks in codebases

**Body:** See `marketing/outreach/hn-show-post.md` (verified, accurate)

### First-Hour Engagement Strategy (0–60 min)

| Time | Action |
|------|--------|
| 0 min | Post to HN |
| 5 min | Share on Twitter/X: "Just launched on Show HN: [link]" |
| 10 min | Post in 2-3 relevant Discord/Slack communities (dev tools, security) |
| 15 min | Email warm contacts: "We just launched on HN, would appreciate an upvote if you find it interesting: [link]" |
| 30 min | Check for first comments — respond within 15 min to each |
| 45 min | If on front page, post a "thank you + technical deep dive" comment |

### Comment Response Rules
- **Respond to every comment within 15 minutes** for the first 4 hours
- Be technical, not promotional — HN downvotes marketing speak
- When criticized, acknowledge valid points and explain the tradeoff
- When asked for benchmarks, share the verified numbers (6,000 files in 89s)
- When asked about pricing, be transparent about the free tier limits
- When someone finds a bug, thank them and fix it immediately if possible

### Top 5 Anticipated Questions

1. **"How is this different from SonarQube/Snyk/CodeQL?"**
   → "Those are SAST tools that scan for known security vulnerabilities (CVEs, SQL injection, XSS). SimpleBeacon targets AI-specific patterns — hallucinated imports, fake KPIs, placeholder code, mock paths in production routes. They're complementary, not competitive. Run Snyk for dependency vulnerabilities, SimpleBeacon for AI code hygiene. And SimpleBeacon runs locally by default — no source upload."

2. **"Why not just use grep/ripgrep?"**
   → "You could catch some of this with grep. The value is in the curated rule set — 48 analyzers across 8 categories, backed by 50 JSON rule definitions that you can inspect in `src/rules/`. The rules map to EU AI Act articles and SOC 2 criteria. Plus you get the CI gate (blocks PRs with blocking findings), VS Code extension (real-time diagnostics), and compliance certificate generation. For JS/TS, there's also an optional @babel/parser AST layer that catches structural patterns regex can't — like functions returning only null/undefined (AI stubs) or LLM calls missing max_tokens."

3. **"Is the source code open?"**
   → "The CLI rules and analyzers are inspectable — 50 JSON rule definitions in `src/rules/` and 48 analyzer definitions in `ai-problem-analyzer-suite.js`. The backend (license signing, Stripe webhooks) is closed source. The VS Code extension is published to the marketplace. We're evaluating opening more of the CLI under a source-available license — happy to hear what the community wants here."

4. **"67 files/sec seems slow"**
   → "It's a deterministic regex + AST scan that runs locally with zero network overhead. The bottleneck is file I/O, not CPU. On local hardware, we scan 6,000 tracked files (600,000+ lines of handwritten source) in 89 seconds. For CI in large repos, the `--diff-only` flag scans only changed files, which brings it down to seconds. The tradeoff: no cloud round-trip, no source upload, no vendor data custody. If you want faster, scan a subset — but 67 files/sec is sustained local I/O, not a network-limited API call."

5. **"EU AI Act compliance claims — are you a lawyer?"**
   → "No, and we say that explicitly in our docs, DPA, and every certificate we generate. SimpleBeacon produces technical attestation evidence — it maps findings to EU AI Act articles (Article 13 documentation, Annex III high-risk requirements) and generates a structured report. It's a technical attestation, not a legal certification. For full legal conformity, engage a qualified EU legal firm. We provide the evidence; they provide the sign-off. Anyone selling you 'EU AI Act compliance in a box' without a lawyer involved is lying."

### Bonus Questions (have answers ready)

6. **"What's the free tier actually give you?"**
   → "9,999 scans per period, 50 files per scan, 5 findings shown per scan. No credit card, no time limit. The quality score is hidden on free tier (shows 'upgrade to view') — that's the main upsell. Paid tiers ($49/mo Developer) unlock unlimited files, all findings, quality score, CI gate, and exportable reports. We hate artificial usage limits — the free tier is genuinely usable for small projects."

7. **"Do you have SSO/SAML/Docker/air-gapped deployment?"**
   → "SSO/SAML is on the enterprise roadmap — not yet implemented, but we can scope it as Phase 1 for enterprise contracts. No Docker image currently, but the CLI is a Node.js package with no external runtime dependencies — straightforward to containerize, and we provide one during enterprise onboarding. Air-gapped mode works today: install from local npm registry, validate license locally (JWT HS256), zero internet required after installation."

8. **"What happens if your backend goes down?"**
   → "The CLI has no runtime dependency on our backend. Scanning, CI gate, and VS Code extension all work offline. The only things that need our backend: initial license activation (one-time), Stripe checkout (payment), certificate signing (sends only a SHA-256 hash), and optional CI telemetry (opt-in, paid only). If we go completely offline, your developers keep scanning. Existing license tokens are valid for 1 year, validated locally."

### Bonus Questions: AST Parser Deep-Dive (have ready for technical threads)

9. **"What AST parser do you use? Tree-sitter?"**
   → "No, we use @babel/parser for JavaScript and TypeScript AST analysis. It's an optional enhancement layer — if @babel/parser isn't installed, the scanner falls back to regex-only mode. The AST scanner has 4 structural rules: hardcoded mock-path strings (SB-JS-FICTION-001), functions that return only null/undefined as AI stubs (SB-JS-FICTION-002), LLM calls without max_tokens (SB-JS-TB-001), and EU AI Act Annex III high-risk identifier matching (SB-JS-EU-001). We chose Babel because it's the most mature JS/TS parser and already installed in most Node.js projects. Tree-sitter is great for multi-language parsing but overkill for our current JS/TS-only AST scope."

10. **"Can the AST scanner catch X pattern?"**
    → "Depends on the pattern. The 4 current AST rules catch structural patterns that regex can't — like a function that returns only null/undefined (an AI stub), or an LLM call missing max_tokens. For anything else, we use the 50 JSON regex rules. If you have a structural pattern you want detected, file an issue with an example and we'll evaluate adding it as an AST rule. The rule catalog is in `src/lib/javascript-ast-scanner.js`."

11. **"Does the AST scanner work on Python/Go/Rust?"**
    → "No. The AST scanner is JavaScript/TypeScript-only via @babel/parser with jsx and typescript plugins. For other languages, we use the 50 language-agnostic regex rules. Multi-language AST support (Python via tree-sitter, Go via go/ast) is on the Q4 2026 roadmap. The regex rules still catch the most common AI slop patterns across all languages — the AST layer is for structural patterns that require call-graph awareness."

### Post-Launch (Day 1–7)
- [ ] Monitor HN comments for 48 hours
- [ ] Track traffic via analytics (Google Analytics or Plausible)
- [ ] Monitor `npx simplebeacon` install counts
- [ ] Monitor VS Code extension install counts
- [ ] Monitor GitHub repo stars/forks
- [ ] Collect feedback and log issues
- [ ] If front page: write a blog post "What we learned from launching on HN"

---

## Part 2: Product Hunt Launch (T+7 days)

### Timing
- **Day:** Tuesday or Wednesday (avoid Monday rush and Friday drop-off)
- **Time:** 12:01 AM PT (Product Hunt's day starts at midnight Pacific)
- **Date:** September 9 or 10, 2026

### Pre-Launch Checklist (T-3 days)
- [ ] Create Product Hunt account (if not exists)
- [ ] Add product: name, tagline, description (see `marketing/outreach/product-hunt-launch.md`)
- [ ] Upload media: 5 screenshots + 1 GIF + thumbnail (240×240)
- [ ] Set maker badge
- [ ] Recruit 5-10 "hunters" (friends, beta users) to upvote and comment at launch
- [ ] Prepare maker comment (see product-hunt-launch.md)
- [ ] Schedule launch-day social media posts
- [ ] Prepare email to warm contacts: "We're on Product Hunt today"

### Launch Day Strategy

| Time (PT) | Action |
|-----------|--------|
| 12:01 AM | Product goes live |
| 6:00 AM | Email warm contacts with direct PH link |
| 7:00 AM | Post on Twitter/X: "We're live on Product Hunt today! [link]" |
| 8:00 AM | Share in 3-4 relevant communities (dev tools, AI, security) |
| 9:00 AM | Maker comment posted (tell the story, be authentic) |
| 10:00 AM | Respond to every comment within 1 hour |
| 12:00 PM | Mid-day check — adjust position, thank commenters |
| 6:00 PM | Final push — share results so far on social |
| 11:59 PM | Day ends — screenshot final position for marketing |

### Media Requirements

| Asset | Size | Content |
|-------|------|---------|
| Screenshot 1 | 1280×800 | Terminal scan output with findings |
| Screenshot 2 | 1280×800 | VS Code extension sidebar with diagnostics |
| Screenshot 3 | 1280×800 | GitHub Action PR comment (blocking finding) |
| Screenshot 4 | 1280×800 | Compliance certificate PDF (sample) |
| Screenshot 5 | 1280×800 | Dashboard with scan history |
| GIF | 1270×760 | 30-second scan demo (install → scan → results) |
| Thumbnail | 240×240 | SimpleBeacon logo on dark background |

### Topics/Tags
Developer Tools, Security, Artificial Intelligence, Code Quality, Compliance

---

## Part 3: Cross-Platform Amplification

### Reddit (T+1 day after HN)
- **Subreddits:** r/programming, r/webdev, r/coding, r/devops, r/security
- **Post type:** Text post (not link) — tell the story, link in comments
- **Title:** "I built a 100% offline code scanner that catches AI-generated slop and credential leaks"
- **See:** `marketing/reddit-launch.md` (update verified numbers before posting)

### Twitter/X (ongoing)
- Thread at launch: "After 4 months of building, today we're launching SimpleBeacon on Show HN..."
- 5-tweet thread: problem → solution → demo → pricing → CTA
- Pin tweet for 48 hours
- Engage with anyone who quotes/retweets

### Dev.to / Hashnode (T+2 days)
- Cross-post the technical blog post: `marketing/blog-posts/physics-of-ai-slop.md`
- Add install instructions and screenshots
- Link to HN discussion for social proof

### Hacker News Follow-up (T+7 days)
- If the launch went well, post a follow-up: "SimpleBeacon update: [X] downloads, [Y] GitHub stars, [Z] enterprise demos booked"
- Share what was learned from the community feedback

---

## Success Metrics

| Metric | Show HN Target | Product Hunt Target |
|--------|---------------|---------------------|
| Front page | Yes (top 30) | Top 5 of the day |
| Points | 50+ | 100+ |
| Comments | 30+ | 20+ |
| GitHub stars | +50 | +100 |
| CLI installs | +200 | +500 |
| VS Code installs | +50 | +150 |
| Website traffic | +2,000 visits | +5,000 visits |
| Demo requests | +5 | +10 |
| Paid conversions | +2 | +5 |

---

## Contingency Plans

| Scenario | Response |
|----------|---------|
| HN post gets flagged/buried | Don't repost. Share on Twitter and Reddit instead. |
| Negative comment dominates | Engage honestly, fix the issue, don't get defensive. |
| Site goes down | Have Cloudflare cache as fallback. Monitor uptime. |
| Someone finds a real security issue | Acknowledge publicly, fix immediately, publish a security advisory. |
| Install fails for users | Pin the working version, publish fix within 2 hours. |
