# SimpleBeacon API Reference

This document covers the programmatic APIs available for integrating SimpleBeacon into your own tools, CI pipelines, and IDE extensions.

---

## Table of Contents

1. [CLI Programmatic API](#cli-programmatic-api)
2. [AiAgentController](#aiagentcontroller)
3. [MCP Server Tools](#mcp-server-tools)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Scan Report Schema](#scan-report-schema)

---

## 1. CLI Programmatic API

Import directly from the `simplebeacon` package:

```javascript
const { scanMockDataDirectories } = require("simplebeacon/src/scan");
const { loadSimplebeaconConfig } = require("simplebeacon/src/config");
```

### `scanMockDataDirectories(baseDir, extraPaths?, options?)`

Runs a full scan on the given directory.

**Parameters:**

| Name         | Type       | Description                 |
| ------------ | ---------- | --------------------------- |
| `baseDir`    | `string`   | Root directory to scan      |
| `extraPaths` | `string[]` | Additional paths to include |
| `options`    | `object`   | Scan options                |

**Options:**

| Key                 | Type      | Default             | Description                                      |
| ------------------- | --------- | ------------------- | ------------------------------------------------ |
| `fullDirectoryScan` | `boolean` | `false`             | Scan entire repo tree instead of selective paths |
| `quiet`             | `boolean` | `false`             | Suppress progress output                         |
| `fictionScope`      | `string`  | `'repository-json'` | Scope for fiction detection                      |

**Returns:** `Promise<ScanReport>`

**Example:**

```javascript
const report = await scanMockDataDirectories("/path/to/project", [], {
  fullDirectoryScan: true,
  quiet: true,
});
console.log(report.gate.pass); // true | false
console.log(report.issueCount); // number
```

---

## 2. AiAgentController

High-level controller for AI assistants to scan, summarize, and suggest fixes.

```javascript
const {
  AiAgentController,
} = require("simplebeacon/src/lib/ai-agent-controller");

const controller = new AiAgentController("/path/to/project", { offline: true });
```

### Methods

| Method                       | Returns               | Description                             |
| ---------------------------- | --------------------- | --------------------------------------- |
| `scan(options)`              | `Promise<ScanReport>` | Run full scan                           |
| `getGateStatus()`            | `object`              | `{ pass, blockingCount, warningCount }` |
| `getSummary()`               | `object`              | Structured summary for AI consumption   |
| `suggestFixes()`             | `FixSuggestion[]`     | Prioritized remediation actions         |
| `checkHandoffReadiness()`    | `boolean`             | Is the project ready for delivery?      |
| `generateMarketing(channel)` | `string`              | Generate blog/twitter/linkedin content  |
| `exportReport(path)`         | `void`                | Write report to JSON file               |

**Example:**

```javascript
const report = await controller.scan({ fullDirectoryScan: true, gate: true });
const fixes = controller.suggestFixes();
for (const fix of fixes.slice(0, 5)) {
  console.log(fix.priority, fix.description);
}
```

---

## 3. MCP Server Tools

SimpleBeacon exposes an MCP (Model Context Protocol) server for AI assistant integration.

**Start the server:**

```bash
npx simplebeacon-mcp --offline
```

### Available Tools

| Tool              | Purpose                                                     |
| ----------------- | ----------------------------------------------------------- |
| `scan_snippet`    | Scan pasted code for leaks, credentials, fiction KPIs       |
| `scan_file`       | Scan a single file on disk                                  |
| `scan_project`    | Run a full project scan with gate evaluation                |
| `gate_status`     | Read latest gate pass/fail from `.simplebeacon/report.json` |
| `suggest_fixes`   | Get prioritized remediation steps from scan results         |
| `explain_finding` | Look up deterministic rule metadata for any pattern ID      |

---

## 4. REST API Endpoints

When the dashboard server is running (default port `54355`):

### `POST /api/analyze/flexible`

Run flexible analysis on any directory.

```bash
curl -X POST http://localhost:54355/api/analyze/flexible \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/repo", "analysisType": "codebase"}'
```

### `POST /api/analyze/compliance-checklist`

Get compliance checklist for a project.

```bash
curl -X POST http://localhost:54355/api/analyze/compliance-checklist \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/repo"}'
```

### `GET /api/simplebeacon/report`

Get the current scan report.

```bash
curl "http://localhost:54355/api/simplebeacon/report?projectPath=/path/to/repo"
```

---

## 5. Scan Report Schema

The top-level report object returned by all APIs:

```typescript
interface ScanReport {
  projectPath: string;
  scanDate: string;
  scannerVersion: string;
  totalFiles: number;
  filesAnalyzed: number;
  issueCount: number;
  qualityScore: number; // 0-100
  gate: {
    pass: boolean;
    failOn: string[];
    warnOn: string[];
    blockingCount: number;
    warningCount: number;
    blockingIssues: Issue[];
    warningIssues: Issue[];
  };
  severityCounts: Record<"critical" | "high" | "medium" | "low", number>;
  detectedIssues: Issue[]; // top 12 grouped
  rawIssues: Issue[]; // all issues
  sampleFiles: string[];
  repositoryInventory?: RepositoryInventory;
  // Scanner-specific metrics
  credentialScanned: number;
  credentialFindings: number;
  productionLeakScanned: number;
  productionLeakFindings: number;
  securityPatternFilesScanned: number;
  securityPatternFindings: number;
  hardcodedUrlFilesScanned: number;
  hardcodedUrlFindings: number;
  weakCryptoFilesScanned: number;
  weakCryptoFindings: number;
  secretInCommentsFilesScanned: number;
  secretInCommentsFindings: number;
  syncIoFilesScanned: number;
  syncIoFindings: number;
  envInGitFilesScanned: number;
  envInGitFindings: number;
  redosFilesScanned: number;
  redosFindings: number;
  piiLoggingFilesScanned: number;
  piiLoggingFindings: number;
  deadCodeFilesScanned: number;
  deadCodeFindings: number;
  memoryLeakFilesScanned: number;
  memoryLeakFindings: number;
  typeSafetyFilesScanned: number;
  typeSafetyFindings: number;
  hallucinatedImportFilesScanned: number;
  hallucinatedImportFindings: number;
  astStructuralFilesScanned: number;
  astStructuralFindings: number;
  astAvailable: boolean;
}

interface Issue {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  filePath: string;
  line: number;
  count: number;
  description: string;
  recommendedAction?: string;
  match?: string;
  metadata?: Record<string, unknown>;
}
```

---

_Last updated: June 2026_
