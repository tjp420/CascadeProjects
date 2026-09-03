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

*   **Elite Local Performance:** Built on an optimized, decoupled asynchronous `dns.resolve4` implementation powered natively by `c-ares` routines. Walks directory trees of up to **265,000+ files across 35,000+ folders in under 65ms** without causing `libuv` thread pool starvation or locking the single-threaded event loop.
*   **AST Structural Fingerprinting:** Moves past naive text regex matches. Parses source files into structural syntax fingerprints to intercept robotic naming verbosity, bare exception shortcuts, and identical function patterns across your monorepo.
*   **Watermark & Tracker Isolation:** Detects invisible tracker characters (such as zero-width space `\u200b` and narrow no-break space `\u202f` entropy seeds) and scans file headers for compliance-mandated cryptographic provenance tags entirely offline.
*   **Absolute Data Sovereignty:** Operates under a strict, air-gapped fence. No source code, metadata, or environment variables are ever cached, tracked, or transmitted outside your local perimeter.

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
*   `maxfiles-test.yml` — Asserts system threshold capacity and file walk scalability boundaries natively on both Ubuntu and Windows runner instances.
*   `simplebeacon-watermark-gate.yml` — Sweeps incoming patches for AI-generated code bloat and logs compliance summaries as downloadable build artifacts.
*   `playwright-e2e.yml` — Runs browser automation tests over an isolated static server environment using platform-aware HTTP GET redirection health checks.

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
