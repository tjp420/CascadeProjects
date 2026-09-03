# SimpleBeacon — Agents

Agents overview
- Agents are reusable persona or task definitions that drive automated workflows such as triage assistants, security reviewers, or CI bots.
- In this repo agents are documented as configuration and instruction bundles that pair with MCP servers and skills.

Where to store agents
- Recommended: docs/simplebeacon/agents/ for human-readable agent descriptions, and packages/agents/ for code-backed agents.

Agent components
- Persona: short description, role, and responsibilities
- Instructions: always-on behavior and constraints
- Skills: small scripts or utilities the agent may call
- Hooks: lifecycle triggers to run agent tasks on events (commits, PRs)

Examples
- security-review-agent: runs SimpleBeacon full-scan, aggregates SARIF, files triage issue for critical findings
- watermark-audit-agent: runs the watermark detector across changed files and reports high-confidence artifacts

Creating an agent
1. Create a folder under packages/agents/<agent-name> or add an entry in docs describing the agent intent.
2. Add an instructions file and required scripts.
3. Wire the agent to the MCP server or to a GitHub Action that runs it on PRs.

Best practices
- Keep agents minimal: one clear responsibility (triage, report, or remediation suggestion).
- Use environment isolation when agents run in CI (no secrets leaked in logs).
- Document the agent clearly in docs/simplebeacon/agents.md or per-agent README.
