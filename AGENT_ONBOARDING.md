# 🤖 AI Agent & MCP Server Onboarding Guide

SimpleBeacon features native support for the **Model Context Protocol (MCP)** via a local stdio-based tool server. This allows AI assistants (such as Cursor, Claude Desktop, VS Code Copilot, or local agent runners) to query, audit, and analyze repository dependency graphs and code security rules seamlessly in real-time.

---

## ⚡ Quick-Start Launch Wrappers

To make environment onboarding as seamless as possible across different operating systems, pre-configured execution wrappers are located in the `scripts/` directory.

### 🔷 For Windows Developers (PowerShell)

Launch the local tool engine through your terminal:

```powershell
.\scripts\start-mcp.ps1
```

_This script automatically validates your `npx` path variables, checks for corrupt Microsoft App stubs, and spins up the server process._

### 🔷 For macOS & Linux Developers (Bash)

Assign execution permissions once, then launch the process:

```bash
chmod +x scripts/start-mcp.sh
./scripts/start-mcp.sh
```

---

## ⚙️ Automated Integration Hooks

### 1. VS Code Task Automation

The repository includes a pre-configured `.vscode/tasks.json` configuration.

- **Behavior:** When you open this workspace in VS Code, the editor will automatically attempt to spawn `npx simplebeacon-mcp --offline` as a background task.
- **Benefit:** Your editor-linked AI assistants can immediately discover and bind to the tool protocol without manual terminal configuration.

### 2. Editor Client Setup (Cursor / Claude Desktop)

To manually expose SimpleBeacon's dual-engine analyzer directly to your AI agent chat tools, add the server connection configuration to your client schema (e.g., `mcp.json` or your Cursor settings):

```json
{
  "mcpServers": {
    "simplebeacon-compliance": {
      "command": "npx",
      "args": ["simplebeacon-mcp", "--offline"]
    }
  }
}
```

---

## 🛠️ Verification & Sandbox Execution

When the server boots successfully, it will actively listen for incoming JSON-RPC 2.0 frames over standard input/output (`stdin`/`stdout`).

- **Security Guardrail:** The enforced `--offline` flag guarantees that the engine remains strictly local. No dependency metrics, file handles, or internal code trees are ever transmitted to an external cloud instance during assistant validation passes.

---

## 📦 SimpleBeacon Ecosystem is Fully Locked and Loaded!

Your development repository is officially a production-grade asset. Let's look at the complete infrastructure footprint you have built out:

- The Scanner Engines: Unified SCA (`node_license_analyzer.py`) and SAST AST-Token (`ast_secret_scanner.py`) engines that return non-zero exit codes to fail insecure CI pipelines.
- The Visualization Dashboard: A gorgeous dark-mode HTML ledger dashboard layout tailored for venture capital and procurement board reviews.
- The Sales Engine: A full pipeline suite (`leads_manager.py`) built with duplication defense layers and cumulative logs (`--append`) to handle outreach automatically.
- The Assistant Bridge (MCP): Auto-starting VS Code tasks, cross-platform wrappers, and complete documentation mapping out how AI coding assistants can leverage SimpleBeacon internally.

Now that the absolute entirety of your application, sales tooling, and AI integration layers are complete, are you ready to test your launch playbook text live on Product Hunt or Hacker News, or do you want to start scouring the Y Combinator directory for your first 5 leads? Let me know your final play!
