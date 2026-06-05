# Simplebeacon Development Notes

## AI Agent Rules — The Broom Strategy (Quick Reference)

> Read this first. It takes 10 seconds and prevents 90% of AI hallucinations.

### Core Directives

1. **No Castles**: Do not invent new modules, workflows, or infrastructure. Fix code inline within existing files whenever possible.
2. **No Ghosts**: Do not reference or edit template files (e.g., `config.js`, `data.js`, `ai.js`). Work exclusively with the validated CommonJS (`.cjs`) backend and Vanilla JS frontend.
3. **No Hallucinated Flaws**: "AI-hallucinated paths" is an invalid technical concept. Do not flag math operations (`Math.random()`, `Math.pow()`) or standard test data directories as security risks.

### Strict Verification Checklist

- [ ] Every modified file must pass `node -c path/to/file.js` locally.
- [ ] Target actual API paths (like `/api/simplebeacon/scan/progress`), never generic guesses.
- [ ] Read raw terminal logs first before making code adjustments on a failing test suite.
- [ ] Relevant tests pass (`node --test`).
- [ ] No ghost files are referenced in the summary.
- [ ] The fix is in the smallest number of files possible.
- [ ] You can explain every changed line without hand-waving.

---

## Full-Coverage Scanning

By default, the Simplebeacon gate scan walks only `productionPaths` and `scanPaths` (e.g., `server/`, `src/`, `web/data`). This leaves many files as "metadata-only" — they are counted in inventory but not content-scanned by rule engines.

### Achieving 100% File Coverage

Use the `--full` CLI flag to enable `fullDirectoryScan`:

```bash
npx simplebeacon scan --full --gate --format json
```

This walks the entire repository tree (excluding `node_modules`, `.git`, `github-cache/`) and content-scans every text file. Binary files (images, executables, etc.) are still hashed for inventory but skipped from text-rule scanning — this is expected and correct.

### Before vs After

| Metric | Default Scan | `--full` Scan |
|--------|-------------|---------------|
| Total files | 576 | 692 |
| Content-scanned | 294 (51%) | 685 (99.1%) |
| Metadata-only skipped | 282 (49%) | 0 |
| Binary files | unknown | 4 |

### Enabling All Rule Engines

Some rule engines are opt-in and disabled by default:
- `token-bleed-patterns`
- `architecture-drift-patterns`
- `python-ast-patterns`
- `javascript-ast-patterns`

To run all engines on all files, use the full-coverage config:

```bash
npx simplebeacon scan --config .simplebeacon/config-full-coverage.json --full --gate
```

Or set `fullDirectoryScan: true` and enable the desired rules in your `.simplebeacon/config.json`.

### Key Config Fields

- `fullDirectoryScan: true` — walk entire tree instead of selective paths
- `fullDirectoryScanMaxFiles: 100000` — raise limit if you have large repos
- `scanPaths: ["."]` — scan everything (when not using fullDirectoryScan)
- `productionPaths` — rule engines filter to these paths unless configured otherwise

### Bugs Fixed

- `eu-ai-act-patterns.js` was missing `isExcludedPath` and `buildEuAiActSummaryFromScan` exports, causing `fullDirectoryScan: true` to crash. Added both exports.
- Added `simplebeacon-rule-tests`, `simplebeacon-frameworkless`, and `marketing-content-test` exclusions to all scanner rules (`eu-ai-act-patterns.js`, `ai-runtime-scan-common.js`, `enterprise-guardrail-patterns.js`, `benchmark-cache-paths.js`, `full-directory-scanner.js`, and `config-full-coverage.json`).
- Fixed missing `async` keyword on `walkSourceFiles` in `eu-ai-act-patterns.js` (caused `await is only valid in async functions` syntax error).
- Fixed duplicate `const normalized` declaration in `fiction-kpi-patterns.js` (caused `Identifier 'normalized' has already been declared` syntax error).
- Added `allowedAnalysisRoots` to `.simplebeacon/config.json` to support scans outside the default `CascadeProjects` root (e.g., `CascadeProjects_BACKUP_20260521`).

## AI Agent Control

Simplebeacon exposes multiple interfaces for AI assistants to trigger scans, read results, and apply fixes.

### 1. MCP Server (Model Context Protocol)

Simplebeacon includes a built-in MCP stdio server compatible with Cursor, AI assistant clients, and Windsurf.

**Tools exposed:**

| Tool | Purpose |
|------|---------|
| `scan_snippet` | Scan pasted code for leaks, credentials, fiction KPIs |
| `scan_file` | Scan a single file on disk |
| `scan_project` | Run a full project scan with gate evaluation |
| `gate_status` | Read latest gate pass/fail from `.simplebeacon/report.json` |
| `suggest_fixes` | Get prioritized remediation steps from scan results |
| `explain_finding` | Look up deterministic rule metadata for any pattern ID |

**Start the MCP server:**

```bash
node packages/simplebeacon-cli/src/mcp/stdio-server.js
# Or via the bin entry:
npx simplebeacon-mcp --offline
```

**Programmatic MCP setup:**

```javascript
const { createMcpStdioServer } = require('simplebeacon/src/mcp/stdio-server');
const server = createMcpStdioServer({ offline: true });
server.start();
```

### 2. AI Agent Controller (Programmatic API)

For deeper integration, use the `AiAgentController` class:

```javascript
const { AiAgentController } = require('simplebeacon/src/lib/ai-agent-controller');

const controller = new AiAgentController('/path/to/project', { offline: true });

// Run a full scan
const report = await controller.scan({ fullDirectoryScan: true, gate: true });

// Get structured summary
const summary = controller.getSummary();
console.log(summary.gatePass, summary.qualityScore, summary.topIssues);

// Check if project is ready for handoff
const readiness = controller.checkHandoffReadiness();

// Get prioritized fix suggestions
const fixes = controller.suggestFixes();

// Export report
controller.exportReport('/path/to/export.json');

// Generate marketing content from scan results
const blog = controller.generateMarketing('blog');
```

**Available methods:**

| Method | Description |
|--------|-------------|
| `scan(options)` | Run full scan, returns normalized report |
| `getGateStatus()` | Read gate pass/fail, blocking counts |
| `getSummary()` | Structured summary for AI consumption |
| `suggestFixes()` | Prioritized list of remediation actions |
| `checkHandoffReadiness()` | Is the project ready for delivery? |
| `generateMarketing(channel)` | Create blog/twitter/linkedin content |
| `exportReport(path)` | Write report to JSON file |
| `watchAndScan(options)` | Watch files and auto-scan on change |

### 3. Server REST API

The dashboard server exposes endpoints for remote AI control:

```bash
# Run flexible analysis
curl -X POST http://localhost:54355/api/analyze/flexible \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/repo", "analysisType": "codebase"}'

# Get compliance checklist
curl -X POST http://localhost:54355/api/analyze/compliance-checklist \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/repo"}'

# Get simplebeacon report
curl "http://localhost:54355/api/simplebeacon/report?projectPath=/path/to/repo"
```

### 4. Direct Programmatic API

For the lowest-level control, import from `scan.js` directly:

```javascript
const { runScan, scanMockDataDirectories } = require('simplebeacon/src/scan');

const report = await runScan('/path/to/project', {
    offline: true,
    gate: true,
    fullDirectoryScan: true
});
```

### 5. CLI (Shell Invocation)

AI agents can invoke Simplebeacon via shell:

```bash
# Standard gate scan
npx simplebeacon scan --gate --format json --output .simplebeacon/report.json

# Full coverage scan
npx simplebeacon scan --full --gate --format json

# EU AI Act assessment
npx simplebeacon scan --config .simplebeacon/config-full-coverage.json --full

# Generate marketing content
node bin/generate-marketing-content.js --report .simplebeacon/report.json --all
```

### Integration Pattern for AI Agents

Recommended workflow for an AI assistant controlling Simplebeacon:

```javascript
const { AiAgentController } = require('simplebeacon/src/lib/ai-agent-controller');

async function aiSimplebeaconWorkflow(projectRoot) {
    const ctrl = new AiAgentController(projectRoot, { offline: true });
    
    // 1. Scan
    const report = await ctrl.scan({ gate: true });
    
    // 2. Assess
    const summary = ctrl.getSummary();
    if (!summary.gatePass) {
        const fixes = ctrl.suggestFixes();
        console.log(`${fixes.total} fixes needed:`, fixes.all.slice(0, 5));
        return { status: 'needs-fixes', fixes };
    }
    
    // 3. Handoff check
    const readiness = ctrl.checkHandoffReadiness();
    if (readiness.ready) {
        ctrl.exportReport('.simplebeacon/handoff-report.json');
        return { status: 'ready-for-handoff', report };
    }
    
    return { status: 'unknown', summary };
}
```

---

## AI Agent Rules — The Broom Strategy

These rules exist to keep the AI focused on practical, grounded engineering instead of generating over-engineered architectures. Follow them strictly.

### 1. Start with the Code, Not the Architecture
**Wrong:** *"Let's design a microservices event bus with Kafka..."*
**Right:** *"Show me the exact file that handles the webhook already."*

**Action:** Use `grep` to find existing patterns, read actual files, then extend what's there. Never build a new system before understanding the current one.

### 2. The "One-File Rule"
Before creating any new file, ask: *"Can I add this to an existing file instead?"*

**Examples from this codebase:**
- Needed a scan lock? Added `let isScanRunning` to existing `simplebeacon-api.cjs` — no new module.
- Needed dashboard polling? Added methods to existing `main.js` — no new component.
- Needed dynamic project path? Added one line to existing webhook handler — no new service.

**Result:** 5 files touched, 0 new modules created, 0 dependencies added.

### 3. Verify Before You Believe
Every change gets a syntax check immediately:
```bash
node -c path/to/file.js
```

Every assumption gets tested against reality:
- AI claims a file exists? `ls` or `Test-Path` to confirm.
- AI claims an API endpoint works? Read the route handler.
- AI claims a test passes? Run `node --test` and see.

### 4. The "Ghost File" Trap
The AI will reference files that do not exist, especially from:
- `.simplebeacon/config.json` at the repo root (gitignored — may or may not exist)
- `src/main.js` (generic template — check if it actually exists)
- `test-login.json` (likely never existed)
- Any file with a generic name that sounds plausible

**Defense:** Before editing, confirm the file path exists. If the AI quotes code from a file you haven't read, read it yourself.

### 5. When the AI Hallucinates, Call It Out
If the AI:
- Invents a vulnerability in a non-existent file
- Proposes a 12-step enterprise architecture for a 2-line fix
- Recommends adding Redis/Kafka/queues for a file-based system
- Starts generating boilerplate "modules" you didn't ask for

**Stop.** Ask: *"What file currently handles this? Show me the actual code."*

### 6. The Checklist for "Done"
Before ending a session:
- [ ] All modified files pass `node -c` syntax check
- [ ] Relevant tests pass (`node --test`)
- [ ] No ghost files are referenced in the summary
- [ ] The fix is in the smallest number of files possible
- [ ] You can explain every changed line without hand-waving

### 7. Castle vs. Broom Comparison

| Task | Castle (Wrong) | Broom (Right) |
|------|---------------|---------------|
| Stripe webhook → scan | Build message queue + worker + Docker | Fire-and-forget `child_process.exec` in existing handler |
| Concurrent scan safety | Redis distributed locks | Module-level `let isScanRunning = false` |
| Dashboard sees new results | WebSockets, server-sent events | `setInterval` polling for 2 min max |
| Test fixture false positives | Rewrite rule engine | Add exclusion paths to existing config |
| Export a report module | New npm package with 3 files | Use existing exports, import from real code |

### Bottom Line

The best fix is the one that uses the existing patterns, the existing imports, and the existing test infrastructure. The codebase already has the answers. The AI's job is to help find them, not to build a parallel universe.
