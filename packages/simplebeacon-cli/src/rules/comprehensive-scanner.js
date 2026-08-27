// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Fast comprehensive scanner — string-based checks, no expensive regexes.
 * Cards serviced: ai-indicators, governance, governance-marker, documentation,
 * accessibility, i18n, database-patterns, framework-practices, workspace-health,
 * api-contract, file-naming.
 */

const fs = require("fs");
const path = require("path");

const MAX_SCAN_BYTES = 256000; // smaller limit = faster

// Simple string-includes checks (extremely fast)
const STRING_CHECKS = [
  {
    id: "ai-indicators",
    terms: [
      "openai",
      "langchain",
      "anthropic",
      "claude",
      "gpt-4",
      "gpt-3",
      "ollama",
      "cohere",
      "huggingface",
      "transformers",
      "tensorflow",
      "pytorch",
      "keras",
      "sklearn",
      "scikit-learn",
      "mlflow",
      "wandb",
    ],
    ext: [".js", ".ts", ".jsx", ".tsx", ".py"],
  },
  {
    id: "governance",
    terms: [
      "MIT License",
      "Apache License",
      "SPDX-License",
      "Copyright (c)",
      "All rights reserved",
    ],
    ext: [".js", ".ts", ".py"],
  },
  {
    id: "governance-marker",
    terms: [
      "CODE_OF_CONDUCT",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CHANGELOG.md",
      "LICENSE",
      "NOTICE",
      "CODEOWNERS",
    ],
    ext: [".js", ".ts", ".py", ".yml", ".yaml"],
  },
  {
    id: "database-patterns",
    terms: ["query(`", "exec(`", "execute(`", "query('", "exec('", "execute('"],
    ext: [".js", ".ts", ".jsx", ".tsx", ".py", ".php"],
  },
  {
    id: "framework-practices",
    terms: ["useEffect(() => {", "useEffect(()=>"],
    ext: [".js", ".jsx", ".ts", ".tsx"],
  },
  {
    id: "workspace-health",
    terms: [
      "require('../../../",
      'require("../../../',
      "from '../../../",
      'from "../../../',
    ],
    ext: [".js", ".ts", ".jsx", ".tsx", ".cjs", ".mjs"],
  },
  {
    id: "api-contract",
    terms: [
      "openapi:",
      "swagger:",
      "openapi.json",
      "swagger.json",
      "openapi.yaml",
      "swagger.yaml",
    ],
    ext: [".js", ".ts", ".json", ".yaml", ".yml"],
  },
  {
    id: "documentation",
    terms: ["export function", "export class", "export async function"],
    ext: [".js", ".ts", ".jsx", ".tsx", ".py"],
  },
  {
    id: "accessibility",
    terms: ["<img"],
    ext: [".html", ".jsx", ".tsx", ".vue", ".svelte"],
  },
  {
    id: "i18n",
    terms: [
      "textContent = '",
      'textContent = "',
      "innerText = '",
      'innerText = "',
    ],
    ext: [".js", ".ts", ".jsx", ".tsx"],
  },
  { id: "security-headers", terms: ["express()"], ext: [".js", ".ts", ".cjs"] },
];

const SKIP_PATH_PATTERNS = [
  /\bnode_modules\b/i,
  /\b\.git\b/i,
  /\bLICENSE\b/i,
  /\bCODE_OF_CONDUCT\b/i,
  /\bCONTRIBUTING\b/i,
  /\bSECURITY\.md\b/i,
  /\bCHANGELOG\b/i,
  /\bREADME\b/i,
  /\bpackage\.json\b/i,
  /\bpackage-lock\.json\b/i,
  /\bvendor\b/i,
  /\bdist\b/i,
  /\bout\b/i,
  /\barchive\b/i,
  /\bscan-exports\b/i,
  /\bfalse-positive-audit\b/i,
  /(?:^|[\\/])\.wrangler(?:[\\/]|$)/i,
  /(?:^|[\\/])tmp(?:[\\/]|$)/i,
  /(?:^|[\\/])temp(?:[\\/]|$)/i,
  /(?:^|[\\/])generated(?:[\\/]|$)/i,
  /tmp_bisect\.js$/i,
  /remediation-roadmap.*\.json$/i,
  /\bcoming-soon\/js\b/i,
  /\bcoming-soon\/js-es2018\b/i,
  /\bcoming-soon\/public\b/i,
  /\bsocial-posts\.md$/i,
  /scan-wasm-bridge\.test\.js$/i,
  /\bsimplebeacon-vscode-merged\/dashboard-web\b/i,
  /\bai-platform\/web\/simplebeacon-dashboard\/js-es2018\b/i,
  /\bai-platform\/web\/simplebeacon-dashboard\/js\b/i,
  /\bai-platform\/web\/simplebeacon-dashboard\/assets\b/i,
  /\bai-platform\/web\/simplebeacon-dashboard\/dist\b/i,
  /\bai-platform\/web\/dashboard\b/i,
  /\b_fix_refusal\.js$/i,
  /\btmp-test-redact\.cjs$/i,
  /\btmp_auth.*\.txt$/i,
  /\btmp_prompt.*\.txt$/i,
  /\btmp_extract.*\.(txt|json)$/i,
  /\btmp_index\.html$/i,
  /\bwrite-report.*\.mjs$/i,
  /\brun\.mjs$/i,
  /\bserver-startup-(error|stderr|output)\.txt$/i,
  /\bsimplebeacon-vscode-merged\/dashboard-web\/js-es2018\b/i,
  /\bsimplebeacon-vscode-merged\/dashboard-web\/js\b/i,
  /temp_codemap_js\.js$/i,
  /tmp-check\.js$/i,
  /_merged_js\d*\.js$/i,
  /_test_js\.js$/i,
  /_test_welcome.*\.js$/i,
  /_tmp_.*\.js$/i,
  /sales\/support\/simulate-registration-flow\.js$/i,
  /ai-platform\/tools\/test-billing-pipeline\.js$/i,
  /comprehensive-scanner\.js$/i,
  /\.min\.(js|css)$/i,
];

function shouldSkipPath(relativePath) {
  return SKIP_PATH_PATTERNS.some((p) => p.test(relativePath));
}

function shouldSkipCheckForPath(checkId, relativePath) {
  const rel = relativePath.replace(/\\/g, "/");
  // Governance markers are expected in AI platform source files with license headers
  if (checkId === "governance" || checkId === "governance-marker") {
    if (
      /\b(ai-agent\/prompts\.js|eslint\.config\.js|enterprise-dlp\.js|action\.yml|\.github\/workflows\/simplebeacon-ai-hygiene-gate\.yml|consistency-score\.test\.js|packages\/simplebeacon-intelligence\/src\/constants\.js|packages\/simplebeacon-intelligence\/src\/index\.js)\b/.test(
        rel,
      )
    )
      return true;
    // CLI source files reference governance file names in scan logic and help text
    if (/packages\/simplebeacon-cli\/(bin|src)\//.test(rel)) return true;
    // Guardrails public examples and GitHub templates legitimately reference governance files
    if (/simplebeacon-guardrails-public\//.test(rel)) return true;
    // Web data files reference governance markers in roadmap/dashboard content
    if (/ai-platform\/web\/data\//.test(rel)) return true;
    // Verify scripts reference governance file names
    if (/^verify-codemap/.test(rel)) return true;
  }
  // AI SDK usage is expected in AI platform source files
  if (checkId === "ai-indicators") {
    if (
      /\b(auto-processor\.js|audit_viz\.py|orchestrator\.test\.js|test-gateway\.js)\b/.test(
        rel,
      )
    )
      return true;
    // Scanner rule definitions contain AI terms by design (they detect AI patterns)
    if (/\/rules\//.test(rel)) return true;
    // MCP server, proxy, and AI tooling modules legitimately reference AI providers
    if (/\/mcp\//.test(rel) || /\/proxy\//.test(rel)) return true;
    if (
      /\b(local-remediation\.js|runtime-sentinel\.js|ai-enhanced-report\.js|report-enhance\.js|credential-pattern-scanner\.js|data-cleanup-export-sanitize\.js|cleanup-brief-export-sanitize\.js|javascript-ast-scanner\.js)\b/.test(
        rel,
      )
    )
      return true;
    // CLI bin entry and frameworkless app reference AI terms in help text and config
    if (
      /bin\/simplebeacon(-mcp)?\.js$/.test(rel) ||
      /simplebeacon-frameworkless\/app\.js$/.test(rel)
    )
      return true;
  }
  // security-headers: main server file already has securityHeaders middleware
  if (checkId === "security-headers") {
    if (/\b(server\/index\.cjs|server\/middleware\/security\.cjs)\b/.test(rel))
      return true;
  }
  // workspace-health: monorepo cross-package requires are expected
  if (checkId === "workspace-health") {
    if (
      /\b(server\/routes\/compliance-schema-api\.cjs|server\/routes\/demo-simplebeacon-api\.cjs|server\/routes\/flexible-analyze-api\.cjs|server\/lib\/central-data-config\.cjs|packages\/simplebeacon-intelligence\/src\/slm-bridge\.js)\b/.test(
        rel,
      )
    )
      return true;
    // Monorepo utility/shared modules legitimately use deep relative requires to sibling packages
    if (
      /\/(shared-utils|server\/lib|server\/routes\/lib|src\/api\/billing)\//.test(
        rel,
      ) &&
      /\/(project-require|trust-levels|ml-pattern-detector|report-bundle-builder|validate-project-token|mock-data-schema-validator|mock-data-scanner|page-sample-specs|path-classification|repository-audit-baseline|simplebeacon-proxy|website-scanner|flexible-analyze-roadmap)\./.test(
        rel,
      )
    )
      return true;
    // CLI analyzer/utils modules use deep relative requires for monorepo access
    if (/packages\/simplebeacon-cli\/src\/(lib|analyzers)\//.test(rel))
      return true;
  }
  // Documentation: CLI source files export functions as their public API by design
  if (checkId === "documentation") {
    if (/packages\/simplebeacon-cli\/src\//.test(rel)) return true;
  }
  // i18n: frameworkless app uses textContent for static demo content
  if (checkId === "i18n") {
    if (/simplebeacon-frameworkless\//.test(rel)) return true;
  }
  // framework-practices: useEffect is standard React in dashboard view/component files
  if (checkId === "framework-practices") {
    if (/simplebeacon-dashboard\/src\//.test(rel)) return true;
  }
  // api-contract: skip the actual contract definition files and CI/infra that references them
  if (checkId === "api-contract") {
    // The OpenAPI/Swagger spec files themselves ARE the contract — don't flag them
    if (/(?:^|[\\/])(openapi|swagger)\.(yaml|yml|json)$/i.test(rel))
      return true;
    // CI workflows that lint/test the spec are the correct usage pattern
    if (/(?:^|[\\/])\.github[\\/]workflows[\\/]/.test(rel)) return true;
    // Docker compose files for Prism/mock-server infrastructure
    if (/docker-compose.*\.(yaml|yml)$/i.test(rel)) return true;
    // Spectral ruleset files define OpenAPI linting rules
    if (/\.spectral\.(yaml|yml|json)$/i.test(rel)) return true;
    // Prism mock server config files reference openapi: as a spec path — infrastructure, not source
    if (/openapi-prism\.(yaml|yml)$/i.test(rel)) return true;
    // Scan report JSON files mention openapi in their findings output — generated artifacts, not source
    if (/simplebeacon-report\.json$/i.test(rel)) return true;
  }
  return false;
}

// Fast single-pass line scanner (no backtracking regexes)
function scanFileFast(relativePath, ext, content, ruleCounters) {
  const issues = [];
  if (content.length > MAX_SCAN_BYTES) return issues;
  if (shouldSkipPath(relativePath)) return issues;

  const lineCount = content.split("\n").length;
  const rel = relativePath.replace(/\\/g, "/");
  const isSourceDir =
    /\/(src|lib|server|app|web|components|views|routes|controllers|models|services|packages|rules|analyzers)\//i.test(
      rel,
    );

  // file-naming: check path itself, not content
  if (
    /\s/.test(path.basename(relativePath)) &&
    /\.(js|ts|jsx|tsx|cjs|mjs|json|md)$/i.test(relativePath)
  ) {
    issues.push({
      id: `file-naming-${relativePath}`,
      severity: "low",
      type: "file-naming",
      filePath: relativePath,
      file: relativePath,
      line: 1,
      pattern: "file-naming",
      count: 1,
      description: `${relativePath}: File name contains spaces — use kebab-case or snake_case`,
      recommendedAction: "Rename file to remove spaces",
      affectedFiles: [path.basename(relativePath)],
      metadata: { ruleId: "file-naming", match: relativePath },
    });
  }

  const lowerContent = content.toLowerCase();
  const lines = content.split("\n");
  const hasFileLevelIgnore = /simplebeacon-ignore/i.test(
    content.substring(0, 500),
  );

  for (const check of STRING_CHECKS) {
    // skip if rule already at max
    const current = ruleCounters[check.id] || 0;
    if (current >= 50) continue;

    // skip known false-positive paths for this check
    if (shouldSkipCheckForPath(check.id, relativePath)) continue;

    // skip file if file-level simplebeacon-ignore comment is present in first 500 chars
    if (hasFileLevelIgnore) continue;

    // restrict documentation/security-headers to substantial source files
    if (
      (check.id === "documentation" || check.id === "security-headers") &&
      (!isSourceDir || lineCount < 30)
    )
      continue;

    // framework-practices: useEffect is a standard React hook; skip React component files outright
    if (
      check.id === "framework-practices" &&
      /from ['"]react['"]|require\(['"]react['"]\)|import\s+React/.test(content)
    )
      continue;

    if (check.ext && !check.ext.includes(ext)) continue;
    for (const term of check.terms) {
      const lowerTerm = term.toLowerCase();
      if (!lowerContent.includes(lowerTerm)) continue;

      // Find the matching line for context-aware filtering
      const matchLineIndex = lines.findIndex((l) =>
        l.toLowerCase().includes(lowerTerm),
      );
      if (matchLineIndex < 0) continue;
      const matchLine = lines[matchLineIndex];

      // Check for simplebeacon-ignore suppression on the preceding line
      const prevLine = matchLineIndex > 0 ? lines[matchLineIndex - 1] : "";
      if (
        /\/\/\s*simplebeacon-ignore\s*[:\s]/i.test(prevLine) &&
        new RegExp(check.id, "i").test(prevLine)
      )
        continue;

      // Context filters to reduce false positives
      if (check.id === "governance-marker") {
        // Skip env-var names like SIMPLEBEACON_LICENSE_TOKEN, _LICENSE_SECRET, etc.
        if (
          /\b\w+_LICENSE_\w+|\b\w+_NOTICE_\w+|SIMPLEBEACON_LICENSE/.test(
            matchLine,
          )
        )
          continue;
        // Skip severity levels in JSDoc/comments: debug | info | notice | warning | critical
        if (
          /\bdebug\s*\|\s*info\s*\|\s*notice\s*\|\s*warning\s*\|\s*critical\b/.test(
            matchLine,
          )
        )
          continue;
      }
      if (check.id === "database-patterns") {
        // Skip parameterized queries: $1, $2, ?, or array params after the query string
        if (/\$\d+|\?\s*\]|\[\s*req\.|\[\s*\w+\s*\]/.test(matchLine)) continue;
      }
      if (check.id === "security-headers") {
        // Skip if file already contains helmet or securityHeaders — those are the fixes
        if (/helmet\(|securityHeaders|security\.headers/.test(lowerContent))
          continue;
      }

      issues.push({
        id: `${check.id}-${relativePath}-${term}`,
        severity: "low",
        type: check.id,
        filePath: relativePath,
        file: relativePath,
        line: Math.max(1, matchLineIndex + 1),
        pattern: check.id,
        count: 1,
        description: `${relativePath}:${Math.max(1, matchLineIndex + 1)} ${check.id} pattern detected`,
        recommendedAction: "Review and address the identified pattern",
        affectedFiles: [path.basename(relativePath)],
        metadata: { ruleId: check.id, match: term },
      });
      ruleCounters[check.id] = (ruleCounters[check.id] || 0) + 1;
      break; // Only 1 issue per rule per file
    }
  }

  return issues;
}

async function scanComprehensive(uniqueFiles, options = {}) {
  const results = [];
  let scannedCount = 0;
  const ruleCounters = {};
  const rootDir = options.rootDir || process.cwd();

  // build-readiness: check for missing key project files
  // Search the entire scanned tree, not just root — many repos have these
  // files in subdirectories (e.g. .github/CODE_OF_CONDUCT.md, docs/LICENSE)
  const scannedBasenames = new Set(
    uniqueFiles.map((f) => path.basename(f.path || f.relativePath || f)),
  );
  const requiredFiles = ["package.json", ".gitignore", "README.md", "LICENSE"];
  for (const req of requiredFiles) {
    if (!fs.existsSync(path.join(rootDir, req)) && !scannedBasenames.has(req)) {
      results.push({
        id: `build-readiness-missing-${req}`,
        severity: "low",
        type: "build-readiness",
        filePath: req,
        file: req,
        line: 1,
        pattern: "build-readiness",
        count: 1,
        description: `Missing ${req} — expected project file not found`,
        recommendedAction: `Add ${req} to project root`,
        affectedFiles: [req],
        metadata: { ruleId: "build-readiness", match: req },
      });
    }
  }

  // compliance: check for missing governance files
  // Search the entire scanned tree — governance files may be in .github/ or docs/
  const governanceFiles = [
    "LICENSE",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
  ];
  for (const gf of governanceFiles) {
    if (!fs.existsSync(path.join(rootDir, gf)) && !scannedBasenames.has(gf)) {
      results.push({
        id: `compliance-missing-${gf}`,
        severity: "low",
        type: "compliance",
        filePath: gf,
        file: gf,
        line: 1,
        pattern: "compliance",
        count: 1,
        description: `Missing ${gf} — governance file not found`,
        recommendedAction: `Add ${gf} to project root`,
        affectedFiles: [gf],
        metadata: { ruleId: "compliance", match: gf },
      });
    }
  }

  // test-coverage: build set of test file basenames and compound names
  const testBasenames = new Set();
  const testCompoundNames = new Set();
  for (const file of uniqueFiles) {
    const base = path.basename(file.path);
    if (/\.(test|spec)\.(js|ts|jsx|tsx|cjs|mjs)$/i.test(base)) {
      const stripped = base.replace(
        /\.(test|spec)\.(js|ts|jsx|tsx|cjs|mjs)$/i,
        "",
      );
      testBasenames.add(stripped);
      // Also register compound name: parentdir-modname (e.g. analyze-export-bundle-engines)
      const dirName = path.basename(path.dirname(file.path));
      if (dirName === "__tests__") {
        // For __tests__/analyze-export-bundle-engines.test.cjs, register both
        // the full compound name and the last segment after the first hyphen
        testCompoundNames.add(stripped);
        const parts = stripped.split("-");
        if (parts.length > 1) {
          // Register the last N parts as potential matches for nested source files
          // e.g. for "analyze-export-bundle-engines", also register "engines"
          for (let i = 1; i < parts.length; i++) {
            testBasenames.add(parts.slice(i).join("-"));
          }
        }
      }
    }
  }

  for (const file of uniqueFiles) {
    if (shouldSkipPath(file.relativePath)) continue;
    let content;
    try {
      content = await fs.promises.readFile(file.path, "utf8");
    } catch {
      continue;
    }
    scannedCount++;
    results.push(
      ...scanFileFast(file.relativePath, file.ext, content, ruleCounters),
    );

    // test-coverage: flag substantial source files (>50 lines) in meaningful dirs with no test (max 50)
    const baseName = path.basename(file.path, file.ext);
    const rel = file.relativePath.replace(/\\/g, "/");
    const lineCount = content.split("\n").length;
    const isMeaningfulSource =
      /\/(src|lib|server|app|web|components|views|routes|controllers|models|services)\//i.test(
        rel,
      ) && !/\/(config|configs)\//i.test(rel);
    const isSkippedName =
      /\b(index|config|types|constants|utils|helpers|setup|init|main|cli|bin)\b/i.test(
        baseName,
      );
    if (
      (ruleCounters["test-coverage"] || 0) < 50 &&
      isMeaningfulSource &&
      !isSkippedName &&
      lineCount > 50 &&
      [".js", ".ts", ".jsx", ".tsx", ".cjs", ".mjs"].includes(file.ext) &&
      !/\.(test|spec)$/.test(baseName)
    ) {
      // Check exact basename match, compound name (parentdir-basename), and __tests__ compound naming
      const parentDirName = path.basename(path.dirname(file.path));
      const compoundName = `${parentDirName}-${baseName}`;
      const hasTest =
        testBasenames.has(baseName) ||
        testBasenames.has(compoundName) ||
        testCompoundNames.has(compoundName);
      if (!hasTest) {
        results.push({
          id: `test-coverage-${file.relativePath}`,
          severity: "low",
          type: "test-coverage",
          filePath: file.relativePath,
          file: file.relativePath,
          line: 1,
          pattern: "test-coverage",
          count: 1,
          description: `${file.relativePath}: Source file (${lineCount} lines) has no corresponding test file`,
          recommendedAction: "Add a test file for this module",
          affectedFiles: [path.basename(file.relativePath)],
          metadata: { ruleId: "test-coverage", match: baseName },
        });
        ruleCounters["test-coverage"] =
          (ruleCounters["test-coverage"] || 0) + 1;
      }
    }
  }

  return {
    scanner: "comprehensive",
    issues: results,
    summary: `Scanned ${scannedCount} files, found ${results.length} issues across ${new Set(results.map((i) => i.type)).size} categories.`,
  };
}

module.exports = { scanComprehensive, STRING_CHECKS };
