# SimpleBeacon — 2-Minute Demo Script

**Total time:** 2 minutes
**Setup:** Terminal open, sample repo ready, SimpleBeacon installed or available via npx

---

## Opening Hook (30 seconds)

> "Your AI assistant just wrote 500 lines of code. How many of those lines contain fake metrics, hardcoded secrets, or placeholder TODOs that will ship to production?
>
> Traditional linters won't tell you. They check syntax and style — not whether a KPI is fabricated or a credential is real. SimpleBeacon does. Let me show you."

---

## Live Demo (60 seconds)

### Step 1: Run the scan with gate enforcement (20 sec)

```
npx simplebeacon scan --gate
```

**Say while it runs:**

> "This runs locally — no source code leaves the machine. The `--gate` flag means the scan will fail if it finds high-severity issues, which is how you'd wire it into CI."

### Step 2: Show the gate result (10 sec)

Point to the exit status and summary output.

**If FAIL (preferred for demo):**

> "The gate failed. SimpleBeacon found high-severity findings and blocked the merge. Let's look at what it caught."

**If PASS:**

> "The gate passed — but let's look at the lower-severity findings it still surfaced, because these are the ones that become incidents later."

### Step 3: Walk through top findings (30 sec)

Highlight 2-3 findings from the output. Good examples to call out:

1. **Hardcoded credential** — "This is a real-looking API key committed to source. A linter skips it. SimpleBeacon flags it as critical."
2. **Fabricated KPI** — "This dashboard metric returns a hardcoded number. An AI assistant invented it. It will display in production and no one will question it."
3. **Placeholder text** — "A `TODO: implement` block that got merged. The AI wrote it as a stub and it slipped through review."

**Say:**

> "Each finding includes the file, line, severity, and a recommended fix. 48 analyzers ran in seconds — no LLM calls, no API costs, deterministic every time."

---

## Close (30 seconds)

> "SimpleBeacon starts at $49 per month for individual developers, $149 for teams of five with EU AI Act and SOC 2 compliance reporting, and custom pricing for enterprise with air-gapped deployment and SSO.
>
> You can run your first scan right now — no account, no upload:
>
> `npx simplebeacon scan`
>
> Ship AI code with confidence."

---

## Demo Tips

- Pre-seed the sample repo with at least one hardcoded secret, one fabricated KPI, and one TODO placeholder so the demo always produces compelling findings.
- If the audience asks about a specific AI tool (Cursor, Copilot, Claude), mention that SimpleBeacon works with all of them — it scans the code, not the assistant.
- Keep the terminal font large enough to read on a shared screen.
- Have the pricing one-pager ready as a follow-up handout.
