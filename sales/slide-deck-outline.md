# SimpleBeacon — Pitch Deck Outline (10 Slides)

---

## Slide 1: Problem

**Headline:** AI is writing your code. Who is checking it?

**Talking points:**

- AI coding assistants now generate a significant percentage of new code in many engineering orgs
- Traditional linters and SAST tools were designed for human-written code — they catch syntax, style, and known vulnerability patterns
- They do not catch AI-specific defects: fabricated KPIs, mock paths leaked into production, hardcoded credentials, placeholder text
- These defects pass code review because they look plausible — that is what LLMs are good at
- The result is a new category of technical debt: AI code debt, and it is accumulating fast

---

## Slide 2: Solution

**Headline:** SimpleBeacon — the scanner built for AI-generated code

**Talking points:**

- Local-first static analysis tool that detects AI code slop: fictional metrics, mock/sample paths, hardcoded secrets, LLM placeholder text
- 48 analyzers across 25 scan engines — pattern matching, AST analysis, and dataflow tracking
- Zero LLM dependency: deterministic results, no hallucinated findings, no API costs, no model drift
- No source upload — runs entirely on your machine or in your CI pipeline
- Drops in as a CI/CD gate to block merges on high-severity findings

---

## Slide 3: Demo

**Headline:** See it catch what your linter misses

**Talking points:**

- Run `npx simplebeacon scan --gate` on a sample repo live
- Show the gate failing on high-severity findings
- Walk through 2-3 findings: a hardcoded credential, a fabricated KPI, a placeholder TODO
- Emphasize speed (seconds), determinism (same results every run), and locality (no upload)
- Reference the full demo script in the sales kit for the timed flow

---

## Slide 4: Market

**Headline:** Every engineering team shipping AI-generated code needs this

**Talking points:**

- AI coding assistant adoption is near-ubiquitous among professional developers
- Works regardless of which assistant generated the code: Cursor, VS Code Copilot, GitHub Copilot, Claude, Windsurf, Cline, Aider
- Three buyer personas: engineering teams (pain: shipping broken code), compliance officers (pain: AI Act / SOC 2 evidence), CTOs (pain: production reliability and accountability)
- Regulatory tailwind: EU AI Act transparency requirements create demand for auditable AI code quality tooling
- The market is not "AI coding tools" — it is "governance and quality for AI-assisted output," which is underserved

---

## Slide 5: Pricing

**Headline:** Three tiers, land-and-expand

**Talking points:**

- Developer: $49/mo — unlimited scans, CI gate, all 48 analyzers. Individual engineer land
- Team Pro: $149/mo for 5 seats — adds EU AI Act and SOC 2 readiness, board-ready compliance certificates. Expand into teams
- Enterprise: custom — air-gapped deployment, SSO/SAML, dedicated security analyst, custom analyzers. Strategic accounts
- All tiers include the full analyzer set — upsell is driven by compliance and deployment needs, not feature gating
- Low friction entry: `npx simplebeacon scan` requires no account

---

## Slide 6: Traction

**Headline:** Adoption and signal

**Talking points:**

- (Insert current metrics: number of scans run, repos scanned, GitHub stars, npm downloads, design partners, pilot conversions)
- Highlight any named customers or design partners in the target personas
- Share qualitative signal: specific examples of critical findings SimpleBeacon caught before production
- If early stage, emphasize the problem validation: every engineering leader recognizes the pain immediately

---

## Slide 7: Team

**Headline:** Built by people who have shipped and broken production code

**Talking points:**

- (Insert founder backgrounds: relevant engineering, security, and compliance experience)
- Why this team: firsthand experience with AI-generated code shipping defects to production
- Domain expertise in static analysis, CI/CD tooling, and regulatory compliance
- (Insert advisors or notable prior companies if applicable)

---

## Slide 8: Ask

**Headline:** What we need

**Talking points:**

- (State the raise amount if fundraising, or the partnership / pilot ask if not)
- Use of funds: analyzer expansion, enterprise sales, compliance certifications
- Specific asks from the audience: design partners, intros to compliance officers at regulated companies, feedback on enterprise feature priorities
- Timeline and milestones tied to the ask

---

## Slide 9: Roadmap

**Headline:** What is next

**Talking points:**

- Near term: additional analyzers for emerging AI slop patterns, deeper CI platform integrations
- Mid term: compliance framework expansions beyond EU AI Act and SOC 2 (ISO 42001, NIST AI RMF)
- Long term: custom analyzer SDK for enterprise, org-wide policy enforcement, historical AI code debt auditing
- Principle: stay local-first and LLM-free — determinism and privacy are core to the value proposition

---

## Slide 10: Q&A

**Headline:** Questions

**Talking points:**

- Open the floor
- Have backup slides ready for common questions: detailed analyzer list, CI integration examples, enterprise deployment architecture, competitive landscape vs. SAST tools and AI code review tools
- Close with the CTA: "Run your first scan now — `npx simplebeacon scan`. Ship AI code with confidence."
- Direct to https://simplebeacon.ai for follow-up
