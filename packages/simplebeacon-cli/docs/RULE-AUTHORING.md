# Rule Authoring Guide

This guide explains how to add new scanner rules to SimpleBeacon.

---

## Rule Types

SimpleBeacon supports two rule engines:

1. **Regex-based rules** — Fast pattern matching for text patterns
2. **AST-based rules** — Structural analysis using `@babel/parser`

---

## 1. Regex-Based Rule

Create a new file in `src/rules/<name>-scanner.js`:

```javascript
const fs = require("fs");
const path = require("path");

const SCANNABLE_EXTENSIONS = new Set([".js", ".ts", ".tsx"]);
const MAX_SCAN_BYTES = 512000;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

const RULES = [
  {
    id: "SB-CUSTOM-001",
    name: "My Custom Pattern",
    regex: /pattern-to-match/g,
    severity: "medium",
    description: "What this pattern detects and why it matters",
    skipPatterns: [
      /\/\/\s*simplebeacon-ignore\s+custom-rule/i, // suppression comment
    ],
  },
];

async function scanMyRule(baseDir, options = {}) {
  // Walk files, apply rules, return findings
  // See existing scanners for full walkFiles + scanFile boilerplate
}

module.exports = { scanMyRule, RULES };
```

### Required Rule Fields

| Field         | Type                                        | Description                        |
| ------------- | ------------------------------------------- | ---------------------------------- |
| `id`          | `string`                                    | Unique rule ID (prefix with `SB-`) |
| `name`        | `string`                                    | Human-readable rule name           |
| `regex`       | `RegExp`                                    | Detection pattern                  |
| `severity`    | `'critical' \| 'high' \| 'medium' \| 'low'` | Default severity                   |
| `description` | `string`                                    | What the rule detects              |

### Optional Fields

| Field          | Type       | Description                          |
| -------------- | ---------- | ------------------------------------ |
| `skipPatterns` | `RegExp[]` | Patterns that disqualify a match     |
| `pathRegex`    | `RegExp`   | Only run on files matching this path |

### Suppression Comments

Always support `// simplebeacon-ignore <rule-name>` on the same line:

```javascript
const snippet = content.substring(match.index - 40, match.index + match[0].length + 40);
if (/\/\/\s*simplebeacon-ignore\s+my-rule/i.test(snippet)) continue;
```

---

## 2. AST-Based Rule

For structural patterns (function complexity, duplicate code, etc.), use the AST scanner:

```javascript
const { scanAstStructural } = require("./ast-structural-scanner");

// Or add a new analysis function to ast-structural-scanner.js
```

AST rules require `@babel/parser` and `@babel/traverse`:

```javascript
function analyzeMyPattern(ast, relativePath) {
  if (!ast || !babelTraverse) return [];
  const findings = [];

  babelTraverse(ast, {
    FunctionDeclaration(path) {
      const node = path.node;
      if (node.body && node.body.body && node.body.body.length > 50) {
        findings.push({
          ruleId: "SB-QUAL-006",
          ruleName: "Excessively Long Function",
          severity: "low",
          line: node.loc ? node.loc.start.line : 0,
          match: node.id ? node.id.name : "anonymous",
          snippet: `Function has ${node.body.body.length} statements`,
        });
      }
    },
  });

  return findings;
}
```

---

## 3. Wiring into scan.js

After creating your scanner, register it in `src/scan.js`:

### 3a. Import

```javascript
const { scanMyRule } = require("./rules/my-rule-scanner");
```

### 3b. Add to scan orchestrator

Find the `scanPromises` block and add:

```javascript
if (isRuleEnabled(config, "my-rule")) {
  const myOpts = getRuleOptions(config, "my-rule");
  scanPromises.push(
    scanMyRule(root, {
      sourcePaths: myOpts.sourcePaths || config.sourceCodeScanPaths,
      productionPaths: myOpts.productionPaths || config.productionPaths,
      ignoreGlobs: myOpts.ignoreGlobs || config.ignore,
    }),
  );
  scanKeys.push("my-rule");
}
```

### 3c. Add result aggregation

After `const resultMap = ...`, add:

```javascript
let myRuleScan = resultMap.get("my-rule") || {
  scanned: 0,
  findings: 0,
  issues: [],
  results: [],
};
```

Add to the issues push block:

```javascript
if (myRuleScan.results?.length) {
  for (const r of myRuleScan.results) {
    for (const f of r.findings || []) {
      issues.push({
        id: f.ruleId || "SB-CUSTOM-001",
        severity:
          f.severity === "critical" || f.severity === "high"
            ? "medium"
            : f.severity || "medium",
        type: "My Rule Name",
        filePath: r.filePath,
        line: f.line,
        count: 1,
        description: f.snippet || f.description || "Custom rule finding",
        match: f.match,
      });
    }
  }
}
```

### 3d. Add report metrics

In the `draftReport` object, add:

```javascript
myRuleFilesScanned: myRuleScan.scanned || (myRuleScan.results ? myRuleScan.results.length : 0),
myRuleFindings: myRuleScan.findings || (myRuleScan.count || 0),
```

---

## 4. Testing

Create a test file in `tests/my-rule.test.js`:

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert");
const { scanMyRule } = require("../src/rules/my-rule-scanner");

describe("My rule", () => {
  it("flags the pattern", async () => {
    // Create temp file, scan it, assert findings
  });

  it("respects suppression comments", async () => {
    // Verify // simplebeacon-ignore my-rule suppresses the finding
  });
});
```

Run tests:

```bash
node --test tests/my-rule.test.js
```

---

## 5. Best Practices

- **Keep regexes focused** — Broad regexes cause false positives
- **Always add suppression support** — Developers need escape hatches
- **Use `low` or `medium` severity for new rules** — Avoid gate failures until rule is battle-tested
- **Skip test files and node_modules** — Use `SKIP_DIRS` and `SKIP_FILES`
- **Add skipPatterns** for common false positives
- **Cap `MAX_SCAN_BYTES`** — Don't scan multi-megabyte files
- **Write a test** before submitting

---

_Last updated: June 2026_
