# SimpleBeacon — Executive One-Pager

## Stop your AI agents from burning tokens on hallucination loops

**48 MCP tools. 94.88% token reduction. Deterministic compliance evidence. All local.**

---

### The problem

AI coding agents (Cursor, Claude, Copilot, Aider) burn $50-100 per session in LLM tokens. 60-75% of that spend is rework — the agent writes bad code, gets an error, and tries again. Verification-only tools make it worse: they add scan calls on top of the same broken workflow, increasing token consumption by 20-30%.

### The solution

SimpleBeacon is a local MCP server that AI agents call natively. It wraps every edit and commit with pre-scan verification, giving the agent structured JSON feedback (safe/blocked/warning + fix hints) **before** code is written to disk. The agent auto-corrects in its next thought cycle. No human intervention needed.

### Three integrated layers

| Layer | What it does | Outcome |
|---|---|---|
| **Agent guardrails** | 48 MCP tools. Pre-edit scanning, commit guards, error diagnosis, session handoff | Prevents bad code before it's written |
| **Token efficiency** | Semantic Lighthouse indexes codebase into lightweight beacons. Offline TF-IDF search. Per-file summaries | 94.88% token reduction in code navigation |
| **Compliance & audit** | EU AI Act mapping, SOC 2 evidence, board-ready certificates, CI/CD gate enforcement | Audit trail from the same scans that guard agents |

### Measured results

| Metric | Without SimpleBeacon | With SimpleBeacon |
|---|---|---|
| Tool calls per session | 38-52 | 10-12 |
| Rework calls per session | 8-12 | 0-2 |
| Code navigation tokens | 836,681 | 42,873 |
| Token cost per session | $50-100 | $12-25 |
| Source code uploaded | Often | Never |

### Agent-specific rules

Catches the mistakes agents make — not humans:
- Hallucinated dependencies (npm packages that don't exist)
- Fiction KPIs (fabricated metrics with no data source)
- Mock paths in production code
- Credential bleed (hardcoded API keys)
- LLM placeholder slop ("TODO: implement this")

### Supported agents

Cursor, Windsurf, Continue, Claude, Cline, GitHub Copilot, Aider, Universal (AGENTS.md)

### Pricing

| Tier | Price | Best for |
|---|---|---|
| Free | $0 | Solo devs, local scans, forever |
| Developer | $49/mo | Unlimited scans, CI gate, 48 analyzers |
| Team Pro | $149/mo | EU AI Act, SOC 2, board-ready certs, 5 seats |
| Enterprise | Custom | Air-gapped, SSO/SAML, dedicated analyst |

### Get started

```bash
npx simplebeacon init --starter
npx simplebeacon scan --gate
npx simplebeacon beacon --path .
```

→ [simplebeacon.ai](https://simplebeacon.ai)

---

*SimpleBeacon: 48 MCP tools, 94.88% token reduction, deterministic compliance evidence — all local, all offline, no source upload.*
