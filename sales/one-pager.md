# SimpleBeacon

### The AI Code Debt Scanner That Catches What Linters Miss

---

## What is SimpleBeacon?

SimpleBeacon is a local-first static analysis tool that detects **AI-generated code slop** — the fictional KPIs, mock paths, hardcoded credentials, and LLM placeholder text that ship into production when teams accept AI-generated code without review.

Traditional linters catch syntax errors and style violations. SimpleBeacon catches the subtle defects that AI assistants introduce: fabricated metrics in dashboards, `your-api-key-here` strings left in config, `TODO: implement` blocks merged into main, and sample data paths that work in dev and break in prod.

It runs entirely on your machine. No source code is ever uploaded.

---

## Key Differentiators

| Feature              | Detail                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| 48 analyzers         | Coverage across secrets, placeholders, mock paths, fabricated logic, and config drift |
| 25 scan engines      | Layered detection combining pattern, AST, and dataflow analysis                       |
| Zero LLM dependency  | Deterministic results — no hallucinated findings, no API costs, no model drift        |
| Local-only scanning  | Source code never leaves your environment; no upload required                         |
| CI/CD gate           | Blocks merges on high-severity findings; configurable thresholds                      |
| EU AI Act compliance | Documentation and evidence trails for Article 9-16 transparency requirements          |

---

## Pricing

| Tier           | Price             | Best For                                                                                           |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| **Developer**  | $49/mo            | Individual engineers — unlimited scans, CI gate, all 48 analyzers                                  |
| **Team Pro**   | $149/mo (5 seats) | Teams shipping AI-assisted code — EU AI Act + SOC 2 readiness, board-ready compliance certificates |
| **Enterprise** | Custom            | Large orgs — air-gapped deployment, SSO/SAML, dedicated security analyst, custom analyzers         |

All plans include the full analyzer set. Higher tiers add compliance tooling, team management, and deployment flexibility.

---

## Who Uses SimpleBeacon

- **Engineering teams** shipping AI-generated code from Cursor, Copilot, Claude, Windsurf, Cline, or Aider
- **Compliance officers** who need evidence that AI-assisted code meets regulatory standards
- **CTOs and VPs of Engineering** accountable for production reliability and security posture

---

## Works With Your Stack

Cursor, VS Code Copilot, GitHub Copilot, Claude, Windsurf, Cline, Aider — SimpleBeacon scans output from any AI coding assistant, regardless of which tool generated it.

---

## Get Started

No account required to scan. No source upload. No LLM calls.

```
npx simplebeacon scan
```

Start scanning in 5 minutes.

Visit **https://simplebeacon.ai** to learn more.
