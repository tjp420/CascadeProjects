# SimpleBeacon — Outreach Email Templates

---

## 1. Cold Outbound to Engineering Managers

**Subject:** The AI code debt you cannot see

**Body:**

Hi [First Name],

Your team is shipping code from Cursor and Copilot. Your linter checks syntax and style — but it does not catch the things AI assistants get wrong: fabricated KPIs in dashboards, mock paths that break in production, hardcoded secrets, and placeholder TODOs that slip through review.

These defects look plausible. That is the problem. They pass review because LLMs are good at sounding right.

SimpleBeacon scans for exactly this. It runs locally — no source upload — and drops into your CI as a gate. 48 analyzers, zero LLM dependency, deterministic results.

You can run it right now without an account:

`npx simplebeacon scan`

Worth 5 minutes to see what is hiding in your last AI-assisted PR. Open to a quick look?

[Your Name]
https://simplebeacon.ai

---

## 2. Follow-Up After No Response

**Subject:** Re: The AI code debt you cannot see

**Body:**

Hi [First Name],

Following up on my last note. I know inboxes are loud.

One concrete way to evaluate this without a meeting: run `npx simplebeacon scan` on a repo where your team used an AI assistant heavily. If it comes back clean, you have confidence. If it flags something, you caught it before production.

Either way it takes under 5 minutes and nothing leaves your machine.

Happy to walk through the findings if anything surfaces. Or if this is not a priority right now, just let me know.

[Your Name]
https://simplebeacon.ai

---

## 3. Demo Confirmation / Scheduling

**Subject:** SimpleBeacon demo confirmed — what to expect

**Body:**

Hi [First Name],

Thanks for agreeing to take a look. Here is what I will cover in our [DAY, TIME] call:

- A live scan on a sample repo showing the CI gate in action
- The specific AI code defects SimpleBeacon catches that linters miss
- How it fits into your existing pipeline (no source upload, no LLM calls)

The demo is 15 minutes. I will leave time for questions about your stack and deployment.

If you want to try a scan beforehand, run `npx simplebeacon scan` on any repo — no account needed. Bring the output and I will walk through it with you.

Talk to you [DAY].

[Your Name]
https://simplebeacon.ai

---

## Usage Notes

- Replace `[First Name]`, `[DAY]`, `[TIME]`, and `[Your Name]` before sending
- Keep emails under 150 words — the pain (AI code debt) leads, the tool follows
- The `npx simplebeacon scan` call-to-action is frictionless and works as a soft ask in every email
- For compliance officer personas, swap the opening pain point to reference EU AI Act documentation requirements instead of production defects
