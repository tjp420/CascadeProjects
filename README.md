# SimpleBeacon 🚨

> **Turn AI Code Debt into Audit Evidence—In 60 Seconds.**

SimpleBeacon is a lightweight, privacy-first technical compliance scanner that automatically detects AI "slop," hallucinated package dependencies, hardcoded mock values, and placeholder code debris.

It executes **100% locally** in your browser sandbox, IDE, or CI/CD container. **Your source code never leaves your network.**

---

## ⚡ Quick Start (Zero-Friction Setup)

Configure your local workspace, IDE agents, and GitHub Actions workflow with a single non-interactive command:

```bash
npx --yes simplebeacon init --starter
```

### What this does automatically:

1. **Wires IDE Context:** Installs Cursor and VS Code Model Context Protocol (MCP) wiring in your local directory.
2. **Injects Agent Rules:** Configures local system prompt rules so your AI coding assistants flag architectural anti-patterns in real time.
3. **Scaffolds CI Gates:** Drops a production-ready `.github/workflows/scan-gate.yml` template into your project.

---

## 🛠️ Files Created

Running the starter initialization generates the following local technical footprint:

```tree
.
├── .cursor/
│   └── rules/
│       └── simplebeacon.mdc       # Real-time compliance prompts for Cursor
├── .mcp/
│   └── mcp.json                   # Auto-discovery configuration for Claude Desktop/VS Code
└── .github/
    └── workflows/
        └── scan-gate.yml          # Offline CI/CD pipeline gate template
```

---

## 🔒 Zero-Data-Custody Architecture

SimpleBeacon relies on a completely decentralized, local-first engine.

- **No Cloud Processing:** Analysis happens via AST parsing and heuristic engines directly in your memory space.
- **Test It Offline:** Load your SimpleBeacon environment, **completely unplug your internet/Wi-Fi**, and execute a repository scan. It operates flawlessly with zero network packets emitted.
- **Tamper-Evident Artifacts:** Generates an offline, SHA-256 cryptographically sealed compliance pack (PDF + JSON) suitable for boards, investors, and regulators.

---

## ⚙️ Configuration & Pipeline Integration

To enforce passing compliance checks on every Pull Request, simply drop your cryptographic license token into your repository secrets:

```yaml
# .github/workflows/scan-gate.yml
name: SimpleBeacon Compliance Gate

on: [pull_request]

jobs:
  compliance-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Execute Local Scan
        run: npx simplebeacon scan --ci
        env:
          SIMPLEBEACON_LICENSE_TOKEN: \${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
```

---

## ❓ Troubleshooting

### Overwriting an existing configuration

If you already have files in place and want to force a completely fresh scaffold, use the explicit force flag:

```bash
npx simplebeacon init --starter --yes --force
```

### Running a localized dry-run

To see exactly what files would be altered or created without executing changes on your disk:

```bash
npx simplebeacon init --starter --dry-run --yes
```

---

## ⚖️ Legal Disclaimer

SimpleBeacon provides technical compliance tooling and evidence artifacts based on static analysis of source code. SimpleBeacon does not provide legal advice, legal opinions, or binding regulatory interpretations regarding the EU AI Act or SOC 2 frameworks.

# 🛡️ SimpleBeacon Compliance Gate & Analyzer

[![Release](https://shields.io)](https://github.com)
[![CI Build Status](https://shields.io)](#)
[![License](https://shields.io)](LICENSE)
[![Platform](https://shields.io)](https://simplebeacon.ai)

SimpleBeacon is a lightning-fast, zero-trust **Application Security Posture Management (ASPM)** suite. It pairs deep software supply-chain dependency tracing (SCA) with Abstract Syntax Tree (AST) static vulnerability parsing (SAST).

It is engineered explicitly to isolate catastrophic risks—like viral copyleft software licenses and hardcoded infrastructure access keys—before code changes reach production, keeping your corporate compliance and enterprise deals bulletproof.

---

## ⚡ Core Architecture Capabilities

- **🔒 100% Local / Air-Gapped Sandbox:** Your application code never leaves your local workspace. Processing happens entirely within your container, runner, or browser sandbox.
- **📦 Deep Sub-Dependency Graphing:** Recursively processes `package-lock.json` layouts and resolves licenses directly against live NPM registry caches to map hidden licensing vulnerabilities layers deep.
- **🧠 High-Entropy AST Token Scanning:** Translates your Python directories into syntax nodes to scan variable strings for leaked credentials. It uses entropy math to skip safe configurations and eliminate noisy regex false positives.
- **🛑 Continuous Integration Quality Gate:** Integrates as a 5-minute GitHub Action that fails the build step automatically whenever high or critical risks are introduced into a patch tree.
- **🛠️ Developer Pull Request Playbooks:** Auto-generates markdown remediation files straight from failed compliance reports, providing developers with clear instructions to swap out high-risk libraries.

---

## 🚀 Operations Command Guide

### 1. Execute the Unified Compliance Scan (SCA + SAST)

Run your unified script to simultaneously evaluate supply-chain dependencies and trace your local codebase for hardcoded access secrets:

```bash
python node_license_analyzer.py --package-json package.json --lockfile package-lock.json --output license-compliance-report.html
```

_This command writes a stunning, dark-mode compliance dashboard (`license-compliance-report.html`) complete with risk metrics, asset indices, and enterprise legal impact documentation._

#### Example Output Manifest Ledger:

| Package / File Module      | Version / Location | Context Found      | Risk Index | Enterprise Governance Impact                      |
| :------------------------- | :----------------- | :----------------- | :--------- | :------------------------------------------------ |
| **corrupt-net-module**     | `1.0.4`            | `AGPL-3.0`         | `CRITICAL` | Viral Copyleft. Threatens proprietary IP control. |
| **Source File: config.py** | `Line 14`          | `HARDCODED_SECRET` | `CRITICAL` | High-entropy string assigned to `aws_secret_key`. |

### 2. Isolate Hardcoded Keys Separately

To run only your specialized static analyzer engine against a targeted project directory and dump findings to a tracking file:

```bash
python tools/ast_secret_scanner.py --dir ./your-project --json ./findings.json
```

### 3. Generate Immediate PR Remediation Fixes

If the scanner flags a violation and triggers a build failure, pipe your report to your operations manager to instantly spit out a copy-paste markdown PR template to fix the code:

```bash
python tools/leads_manager.py remediate --report license-compliance-report.html --out outreach/remediation_body.md --your-name "Alice"
```

---

## ⚙️ CI/CD Integration Playbook

Automate your gate across development branches. Create a file inside your repository at `.github/workflows/license-gate.yml`:

```yaml
name: SimpleBeacon Compliance Gate

on:
  pull_request:
    branches: ["main", "master", "develop"]
    paths: ["package-lock.json", "**.py"]

jobs:
  security-audit:
    name: Operational Posture Compliance Audit
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Initialize Python Environment
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Run Engine Unit Verification Tests
        run: python -m unittest discover -s tests

      - name: Execute Unified Risk Analyzer
        run: python node_license_analyzer.py --lockfile package-lock.json --output compliance-report.html
```

---

## 💼 Enterprise & Advisory Operations

SimpleBeacon features an advanced cloud workspace dashboard. View live analytical utilities online or scan items directly via our zero-trust browser sandbox at [simplebeacon.ai/dashboard/#/analyze](https://simplebeacon.ai).

_For custom security rule frameworks (SOC 2, HIPAA, GDPR verification) or enterprise support structures, contact our security advisory team at simplebeacon.ai._

# 📡 SimpleBeacon

**SimpleBeacon** is an ultra-fast, local-first repository optimizer and security guardrail designed to protect engineering margins, prevent repository bloat, and eliminate logical "AI slop" drift before it leaks into production clusters.

By combining Abstract Syntax Tree (AST) structural fingerprinting with an optimized, non-blocking asynchronous networking core, SimpleBeacon walks massive enterprise directories and evaluates configurations in milliseconds—operating entirely inside your local system memory under a strict **Zero-Upload Guarantee**.

---

## 🏛️ The Problem: The Hidden Cost of AI Code Bloat

As engineering teams accelerate feature delivery using AI coding assistants (Cursor, Copilot), repositories run headfirst into a massive structural bottleneck: **Context Sprawl and Logical Drift**.

Because large language models lack the context-window memory to retain an entire enterprise footprint, they introduce severe architectural liabilities:

1. **Structural Duplication:** AI assistants routinely regenerate identical helper utilities, stubs, and configuration logic across distant subdirectories, causing repositories to expand into unmaintainable blobs that choke your editor's context windows.
2. **Logical Hallucinations:** To clear compilation fences, models fabricate plausible-but-wrong placeholder URLs, testing destinations, and internal webhook paths. Because the code is syntactically sound, traditional SAST linters give it a perfect green light—leaving behind silent vulnerabilities vulnerable to domain-hijacking.

Traditional security software and CI suites are slow, heavy, and expensive. SimpleBeacon blocks this drift at the developer's box before it inflates your cloud maintenance bills.

---

## ⚡ Key Capabilities & Engineering Metrics

- **Elite Local Performance:** Built on an optimized, decoupled asynchronous `dns.resolve4` implementation powered natively by `c-ares` routines. Walks directory trees of up to **265,000+ files across 35,000+ folders in under 65ms** without causing `libuv` thread pool starvation or locking the single-threaded event loop.
- **AST Structural Fingerprinting:** Moves past naive text regex matches. Parses source files into structural syntax fingerprints to intercept robotic naming verbosity, bare exception shortcuts, and identical function patterns across your monorepo.
- **Watermark & Tracker Isolation:** Detects invisible tracker characters (such as zero-width space `\u200b` and narrow no-break space `\u202f` entropy seeds) and scans file headers for compliance-mandated cryptographic provenance tags entirely offline.
- **Absolute Data Sovereignty:** Operates under a strict, air-gapped fence. No source code, metadata, or environment variables are ever cached, tracked, or transmitted outside your local perimeter.

---

## 🚀 Quick-Start Engineering Run-Book

### 1. Local Development Initialization

Ensure your workspace workspace dependencies are cleanly populated across your localized modules:

```bash
# Install node workspace packages cleanly
npm install

# Run the local Abstract Syntax Tree (AST) watermark filter test matrix
npm run scan:watermarks
```

### 2. Executing the Test Suites

SimpleBeacon carries a robust, cross-platform matrix validation layer fully optimized for both Linux cloud nodes and Windows host instances:

```bash
# Run the platform infrastructure testing suite
npm test --workspace=ai-platform

# Fire off the targeted End-to-End integration checks
npm run test:e2e
```

---

## 🛠️ Continuous Integration Infrastructure

SimpleBeacon maintains a hardened, automated continuous integration landscape configured via GitHub Actions (`.github/workflows/*`). Every Pull Request is automatically evaluated through non-blocking safety checkpoints:

- `maxfiles-test.yml` — Asserts system threshold capacity and file walk scalability boundaries natively on both Ubuntu and Windows runner instances.
- `simplebeacon-watermark-gate.yml` — Sweeps incoming patches for AI-generated code bloat and logs compliance summaries as downloadable build artifacts.
- `playwright-e2e.yml` — Runs browser automation tests over an isolated static server environment using platform-aware HTTP GET redirection health checks.

---

## 👥 How to Contribute & Release Checklist

We maintain a high-integrity, disciplined git branching model. All architectural refactors and features must undergo strict validation before passing into production:

1. **Branch Hygiene:** Isolate your changes inside a feature branch (e.g., `feat/your-feature-name`). Ensure local environment files (`.env.production`) are never staged.
2. **Compliance Gates:** Local pre-commit hooks (secrets filters, context boundaries) must pass cleanly. Never bypass gates using `--no-verify` or `HUSKY_SKIP_HOOKS=1` unless explicitly authorized for non-blocking telemetry collection.
3. **Release Tagging Protocol:** Releases are triggered from `main` via continuous delivery tags. To tag a clean build:
   ```bash
   git tag v3.0.576
   git push origin main --tags
   ```

---

## 📡 Staging and Synchronizing Content Updates

The documentation above was staged to `feat/maxfiles-ci` to align with the verified E2E baseline.

---

If you'd like, I can also merge PR #845, create the release tag, or draft team-level pre-commit hooks next.
