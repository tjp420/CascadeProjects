# SimpleBeacon Sales Kit

A ready-to-use set of sales assets for SimpleBeacon, the AI code debt scanner.

---

## Assets

| File | Purpose | Audience |
|---|---|---|
| `one-pager.md` | Single-page sales sheet covering product overview, pricing, differentiators, and target customers | Prospects, partners, internal reference |
| `demo-script.md` | Timed 2-minute live demo script with opening hook, scan walkthrough, and close | Sales reps running live demos |
| `slide-deck-outline.md` | 10-slide pitch deck outline with talking points per slide | Founders and reps presenting to investors or buyers |
| `outreach-email-templates.md` | Three email templates: cold outbound, follow-up, and demo confirmation | Sales reps doing outbound prospecting |

---

## Usage Instructions

### One-Pager
- Send as a follow-up after a first conversation or demo
- Attach as a PDF when emailing prospects who asked for "something in writing"
- Print for in-person meetings or trade show handouts

### Demo Script
- Review before any live demo or sales call
- Pre-seed a sample repository with at least one hardcoded secret, one fabricated KPI, and one placeholder TODO so findings are guaranteed
- Practice the timing: 30 seconds hook, 60 seconds demo, 30 seconds close
- Keep terminal font size large for shared screens

### Slide Deck Outline
- Use as the structure for a pitch deck built in Google Slides, Keynote, or PowerPoint
- Each slide includes a headline and talking points — expand visuals around the talking points
- Fill in traction metrics and team details before presenting
- Have backup slides ready for the Q&A slide (analyzer list, CI integration, competitive landscape)

### Outreach Email Templates
- Personalize the `[First Name]`, `[DAY]`, `[TIME]`, and `[Your Name]` placeholders before sending
- For compliance officer prospects, adjust the opening pain point to reference EU AI Act documentation requirements
- The `npx simplebeacon scan` call-to-action is intentionally frictionless — keep it in every email
- Send the follow-up template 4-5 business days after the initial cold outbound if there is no response

---

## Quick Reference

- **Product:** SimpleBeacon — AI code debt scanner (fictional KPIs, mock paths, credentials, LLM placeholder slop)
- **Website:** https://simplebeacon.ai
- **Instant scan:** `npx simplebeacon scan`
- **CI gate:** `npx simplebeacon scan --gate`
- **Pricing:** Developer $49/mo, Team Pro $149/mo (5 seats), Enterprise (custom)
- **Key differentiators:** 48 analyzers, 25 scan engines, zero LLM dependency, local-only (no source upload), CI/CD gate, EU AI Act compliance
- **Compatible AI tools:** Cursor, VS Code Copilot, GitHub Copilot, Claude, Windsurf, Cline, Aider
