Subject: Your AI agents are burning 75% of your tokens on rework. Here's the fix.

---

Hi {{first_name}},

If you're using AI coding agents (Cursor, Claude, Copilot, Aider), you're probably burning $50-100 per session on tokens — and most of that is rework.

**The math:**
- A typical agent session = 30-40 tool calls
- 8-12 of those are rework calls (agent writes bad code, gets an error, tries again)
- Each rework call sends your entire context window to a premium LLM
- 60-75% of your token spend is on mistakes deterministic rules could prevent

**The fix isn't scanning after the fact.** Verification-only tools actually *increase* token consumption by 20-30% because they add scan calls on top of the same broken workflow.

**The fix is prevention.**

## SimpleBeacon: 48 MCP tools that make agents police themselves

SimpleBeacon is a local MCP server that AI agents call natively. It wraps every edit and commit with pre-scan verification — the agent gets structured JSON feedback (safe/blocked/warning + fix hints) before writing code to disk.

**What it catches before code is written:**
- Hallucinated dependencies (npm packages that don't exist)
- Fiction KPIs (fabricated metrics with no data source)
- Mock paths in production code
- Credential bleed (hardcoded API keys)
- LLM placeholder slop ("TODO: implement this")

**The Semantic Lighthouse: 94.88% token reduction**

Instead of reading a 10,000-token file to find one bug, the agent scans a 200-token beacon index (classes, functions, TODOs, signatures with line numbers), finds the exact `file:line`, then deep-reads only the 20-line window.

**Compliance evidence from the same scans:**
- EU AI Act mapping (Article 5 prohibited practices)
- SOC 2 evidence
- Board-ready compliance certificates
- CI/CD gate enforcement

**The results:**
- 75% reduction in tool calls per session (38-52 → 10-12)
- 94.88% reduction in code navigation tokens
- $50-100/session → $12-25/session
- All local, all offline, no source upload

## Get started in 60 seconds

```bash
npx simplebeacon init --starter
npx simplebeacon scan --gate
npx simplebeacon beacon --path .
```

**Pricing**: Free tier forever. Developer $49/mo. Team Pro $149/mo.

→ [https://simplebeacon.ai](https://simplebeacon.ai)

Best,
The SimpleBeacon Team

---

*P.S. Already using an agent? Run `npx simplebeacon init --starter --with-mcp` to install MCP config + CI gate in one command.*
