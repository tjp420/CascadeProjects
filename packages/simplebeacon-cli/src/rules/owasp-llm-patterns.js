// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * OWASP Top 10 for LLM Applications (2025) — static pattern detection.
 *
 * Detects code patterns matching the OWASP LLM Top 10 categories:
 *   LLM01 Prompt Injection
 *   LLM02 Sensitive Information Disclosure
 *   LLM03 Supply Chain
 *   LLM04 Data and Model Poisoning
 *   LLM05 Improper Output Handling
 *   LLM06 Excessive Agency
 *   LLM07 System Prompt Leakage
 *   LLM08 Vector and Embedding Weaknesses
 *   LLM09 Misinformation
 *   LLM10 Unbounded Consumption
 *
 * Static pattern scan only — not a substitute for penetration testing.
 */

const fs = require("fs");
const path = require("path");
const { globMatch, walkProductionFiles } = require("./production-leak");

const DEFAULT_SOURCE_PATHS = [
  "server",
  "src",
  "web",
  "lib",
  "packages",
  "app",
  "api",
  "config",
];
const DEFAULT_PRODUCTION_PATHS = [
  "server/",
  "src/",
  "app/",
  "lib/",
  "api/",
  "web/",
];
const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".html",
  ".vue",
  ".svelte",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
  "archive",
  ".simplebeacon",
  "tests",
  "test",
  "__tests__",
  "fixtures",
  "examples",
  "docs",
  "coming-soon",
  "reports",
  "security-reports",
  "templates",
  "data-central",
  "deployments",
  "public",
  "functions",
  "cloudflare-deploy",
  "temp",
  "tests-legacy",
  ".github-sync",
  ".cursor",
  ".vscode",
  "downloads",
  "findings",
  "simplebeacon-rule-tests",
  "simplebeacon-toxic-fixtures",
]);
const MAX_SCAN_BYTES = 512000;

// --- OWASP LLM Top 10 Rule Catalog ---

const RULE_CATALOG = [
  {
    id: "OWASP-LLM01-001",
    owaspId: "LLM01:2025",
    category: "prompt-injection",
    type: "OWASP LLM — Prompt Injection",
    regex:
      /(?:prompt|messages|content|userMessage|inputText)\s*(?:\+?=|\.\s*push\s*\()\s*.*(?:req\.(?:body|query|params)|userInput|user_input|input_text|request\.(?:body|query))/gi,
    severity: "high",
    description: "User input concatenated into LLM prompt without sanitization",
    fixTemplate:
      "Sanitize and validate user input before incorporating it into LLM prompts. Use a delimiter-based prompt structure (e.g., XML tags) to separate instructions from user content. Implement input validation and reject prompts containing override instructions.",
  },
  {
    id: "OWASP-LLM02-001",
    owaspId: "LLM02:2025",
    category: "sensitive-info",
    type: "OWASP LLM — Sensitive Information Disclosure",
    regex:
      /(?:openai|anthropic|claude|gpt|llm|chat|completion|embeddings?)\s*(?:\.\s*\w+)*\s*\.\s*(?:create|complete|generate|chat)\s*\(.*(?:email|ssn|password|secret|token|api_?key|credit_?card|phone|address|passport)/gi,
    severity: "high",
    description: "PII or secrets passed to LLM API calls",
    fixTemplate:
      "Never pass PII or secrets to LLM APIs. Strip sensitive fields before sending data to external AI services. Use a data classification layer to redact PII. Log what data is sent (not the data itself) for audit purposes.",
  },
  {
    id: "OWASP-LLM03-001",
    owaspId: "LLM03:2025",
    category: "supply-chain",
    type: "OWASP LLM — Supply Chain",
    regex:
      /(?:require|import)\s*\(?\s*['"](?:openai|anthropic|@anthropic-ai\/sdk|langchain|@langchain\/core|llamaindex|huggingface|transformers|@huggingface\/inference)['"]\s*\)?/gi,
    severity: "medium",
    description:
      "LLM/AI package imported without version pinning or integrity verification",
    fixTemplate:
      "Pin LLM package versions in package.json with exact versions (not ^ or ~). Verify package integrity using npm config set integrity true. Review the package lockfile for unexpected transitive dependencies. Consider using npm audit signatures.",
  },
  {
    id: "OWASP-LLM04-001",
    owaspId: "LLM04:2025",
    category: "data-poisoning",
    type: "OWASP LLM — Data and Model Poisoning",
    regex:
      /(?:fetch|axios|http\.get|requests\.get)\s*\(\s*['"](?:https?:)?\/\/[^'"]*(?:scrape|crawl|dataset|training|corpus|raw\.githubusercontent)/gi,
    severity: "medium",
    description: "Training or fine-tuning data sourced from unvalidated URLs",
    fixTemplate:
      "Validate all training data sources. Use checksums or hashes to verify data integrity. Implement data provenance tracking. Avoid scraping untrusted URLs for training data. Run data poisoning detection (e.g., spectral signature analysis) before training.",
  },
  {
    id: "OWASP-LLM05-001",
    owaspId: "LLM05:2025",
    category: "output-handling",
    type: "OWASP LLM — Improper Output Handling",
    regex:
      /(?:innerHTML|outerHTML|document\.write|dangerouslySetInnerHTML|eval\s*\(|new\s+Function\s*\()\s*(?:=|\()\s*(?:aiResponse|llmOutput|completion|response\.text|result\.content|model\.output|chatResponse)/gi,
    severity: "high",
    description:
      "LLM output rendered into DOM or executed without sanitization",
    fixTemplate:
      "Treat all LLM output as untrusted. Sanitize with DOMPurify before rendering. Never pass LLM output to eval() or new Function(). Use textContent instead of innerHTML where possible. Validate LLM output against a schema before use.",
  },
  {
    id: "OWASP-LLM06-001",
    owaspId: "LLM06:2025",
    category: "excessive-agency",
    type: "OWASP LLM — Excessive Agency",
    regex:
      /(?:exec|spawn|execSync|child_process|fetch|axios\.(?:get|post|put|delete)|db\.(?:query|execute|run)|database\.(?:query|execute)|sql\.)\s*\(\s*(?:aiCommand|llmResult|aiGenerated|model\.output|completion\.text|chatResponse\.content|llmOutput)/gi,
    severity: "high",
    description:
      "LLM output directly driving code execution, HTTP requests, or database queries",
    fixTemplate:
      "Never allow LLM output to directly execute commands or queries. Implement an allowlist of permitted actions. Require human approval before executing LLM-suggested operations. Validate all LLM-generated SQL/commands against a strict schema before execution.",
  },
  {
    id: "OWASP-LLM07-001",
    owaspId: "LLM07:2025",
    category: "system-prompt-leak",
    type: "OWASP LLM — System Prompt Leakage",
    regex:
      /(?:role|type)\s*:\s*['"]system['"]\s*,?\s*(?:content|text|prompt)\s*:\s*.*(?:api[_-]?key|secret|password|token|credential|private[_-]?key|BEGIN\s+(?:RSA|EC|OPENSSH))/gi,
    severity: "medium",
    description: "Secrets or credentials embedded in system prompts",
    fixTemplate:
      "Never include secrets in system prompts — they can be extracted via prompt injection. Load secrets from environment variables at runtime, not in prompt text. Treat system prompts as potentially visible to end users.",
  },
  {
    id: "OWASP-LLM08-001",
    owaspId: "LLM08:2025",
    category: "vector-embedding",
    type: "OWASP LLM — Vector and Embedding Weaknesses",
    regex:
      /(?:embeddings?|vector|pinecone|weaviate|chroma|qdrant|pgvector)\s*\.\s*(?:create|upsert|insert|query|search)\s*\(.*(?:req\.(?:body|query)|userInput|untrusted)/gi,
    severity: "medium",
    description:
      "Embedding or vector search using unvalidated user input without access control",
    fixTemplate:
      "Implement tenant isolation in vector databases. Validate and sanitize all inputs before generating embeddings. Enforce per-user or per-tenant access control on vector search results. Rate-limit embedding API calls to prevent vector database poisoning.",
  },
  {
    id: "OWASP-LLM09-001",
    owaspId: "LLM09:2025",
    category: "misinformation",
    type: "OWASP LLM — Misinformation",
    regex:
      /(?:return|res\.(?:json|send|render)|response\.(?:json|send|render))\s*\(?\s*(?:aiResponse|llmOutput|completion|model\.output|chatResponse)/gi,
    severity: "low",
    description:
      "LLM output returned to users without fact-checking or hallucination disclaimer",
    fixTemplate:
      "Add a visible disclaimer that output is AI-generated and may contain errors. Implement fact-checking or grounding against a verified knowledge base. Log AI-generated responses for audit. Consider confidence scoring before presenting output as factual.",
  },
  {
    id: "OWASP-LLM10-001",
    owaspId: "LLM10:2025",
    category: "unbounded-consumption",
    type: "OWASP LLM — Unbounded Consumption",
    regex:
      /max_?tokens\s*:\s*(?:\d{6,}|999999|Infinity|undefined|null|0x[fF]+)|while\s*\(\s*(?:true|!done|running)\s*\)\s*\{[^}]*(?:openai|anthropic|llm|chat|completion)\s*\./gi,
    severity: "high",
    description: "LLM API calls without token caps, rate limits, or timeouts",
    fixTemplate:
      "Set reasonable max_tokens limits (e.g., 4096). Implement rate limiting per user and per API key. Add timeouts to all LLM API calls. Monitor and alert on token consumption. Implement circuit breakers for cascading LLM failures.",
  },
];

const OWASP_CATEGORIES = [
  { id: "LLM01", name: "Prompt Injection", severity: "high" },
  { id: "LLM02", name: "Sensitive Information Disclosure", severity: "high" },
  { id: "LLM03", name: "Supply Chain", severity: "medium" },
  { id: "LLM04", name: "Data and Model Poisoning", severity: "medium" },
  { id: "LLM05", name: "Improper Output Handling", severity: "high" },
  { id: "LLM06", name: "Excessive Agency", severity: "high" },
  { id: "LLM07", name: "System Prompt Leakage", severity: "medium" },
  { id: "LLM08", name: "Vector and Embedding Weaknesses", severity: "medium" },
  { id: "LLM09", name: "Misinformation", severity: "low" },
  { id: "LLM10", name: "Unbounded Consumption", severity: "high" },
];

// --- Utility functions (mirrors eu-ai-act-patterns.js) ---

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function extractLineAt(content, index) {
  const lines = content.split("\n");
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (index >= pos && index < pos + line.length + 1) {
      return { line: i + 1, text: line.trim(), start: pos };
    }
    pos += line.length + 1;
  }
  return {
    line: content.slice(0, Math.max(0, index)).split("\n").length,
    text: "",
    start: 0,
  };
}

function isExcludedPath(relativePath) {
  const normalized = String(relativePath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  if (
    /(?:^|\/)src\/(?:rules|reporters|analyzers|proxy)(?:\/|$)/.test(normalized)
  )
    return true;
  if (
    /\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|proxy|lib)\//.test(
      normalized,
    )
  )
    return true;
  if (/(?:^|\/)coming-soon\//.test(normalized)) return true;
  if (/(?:^|\/)reports\//.test(normalized)) return true;
  if (/(?:^|\/)security-reports\//.test(normalized)) return true;
  if (/(?:^|\/)templates\//.test(normalized)) return true;
  if (/(?:^|\/)data-central\//.test(normalized)) return true;
  if (/(?:^|\/)deployments\//.test(normalized)) return true;
  if (/(?:^|\/)public\//.test(normalized)) return true;
  if (/(?:^|\/)functions\//.test(normalized)) return true;
  if (/(?:^|\/)cloudflare-deploy\//.test(normalized)) return true;
  if (/(?:^|\/)archive\//.test(normalized)) return true;
  if (/(?:^|\/)temp\//.test(normalized)) return true;
  if (/(?:^|\/)tests-legacy\//.test(normalized)) return true;
  if (/(?:^|\/)downloads\//.test(normalized)) return true;
  if (/(?:^|\/)web\/(?:data|findings|simplebeacon-findings)\//.test(normalized))
    return true;
  if (
    /(?:^|\/)web\/simplebeacon-dashboard\/js\/(?:views\/|utils\/|utils\.js$)/.test(
      normalized,
    )
  )
    return true;
  if (/(?:^|\/)server\/test-gateway\.js$/.test(normalized)) return true;
  if (/(?:^|\/)simplebeacon-frameworkless\//.test(normalized)) return true;
  if (/\.(?:env|env\.example)$/.test(normalized)) return true;
  if (/(?:^|\/)docs\//.test(normalized)) return true;
  if (/(?:^|\/)server\/(?:routes|services|lib)\//.test(normalized)) return true;
  if (/(?:^|\/)ai-agent\//.test(normalized)) return true;
  if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
  if (/(?:^|\/)simplebeacon-toxic-fixtures\//.test(normalized)) return true;
  if (/(?:^|\/)\.github-sync\//.test(normalized)) return true;
  if (/(?:^|\/)tests\//.test(normalized)) return true;
  if (/(?:^|\/)test\//.test(normalized)) return true;
  if (/\.test\.js$/i.test(normalized)) return true;
  return false;
}

async function walkSourceFiles(baseDir, sourcePaths, results = []) {
  if (!Array.isArray(sourcePaths)) return results;
  for (const rel of sourcePaths) {
    const abs = path.join(
      baseDir,
      ...String(rel).replace(/\/$/, "").split("/"),
    );
    const stat = await fs.promises.stat(abs).catch(() => null);
    if (!stat) continue;
    if (stat.isFile()) {
      const ext = path.extname(abs).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext)) {
        results.push({ path: abs, ext });
      }
      continue;
    }
    await walkDir(abs, results);
  }
  return results;
}

async function walkDir(dir, results) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext)) {
        results.push({ path: fullPath, ext });
      }
    }
  }
}

function scanCatalogPatterns(relativePath, content, catalog, severityDefault) {
  const issues = [];
  for (const rule of catalog) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = regex.exec(content)) !== null) {
      const loc = extractLineAt(content, m.index);
      const snippet = loc.text.slice(0, 120) || m[0].slice(0, 120);
      // Check for suppression comment on the same line
      if (/\/\/\s*simplebeacon-ignore\s+owasp-llm/i.test(snippet)) continue;
      issues.push({
        id: `${rule.id}-${relativePath}`,
        severity: rule.severity || severityDefault,
        type: rule.type,
        filePath: relativePath,
        lineNumber: loc.line,
        count: 1,
        description: rule.description,
        recommendedAction: rule.fixTemplate,
        evidence: `Matched "${rule.id}" (${rule.owaspId}) in code: "${snippet}" — ${rule.description}`,
        affectedFiles: [relativePath],
        metadata: {
          patternId: rule.id,
          owaspId: rule.owaspId,
          category: rule.category,
          lineNumber: loc.line,
        },
      });
      break; // one finding per rule per file
    }
  }
  return issues;
}

function collapsePatternIssuesByFile(issues, _relativePath) {
  const byRule = new Map();
  for (const issue of issues) {
    const key = issue.metadata?.patternId || issue.id;
    if (!byRule.has(key)) {
      byRule.set(key, issue);
    } else {
      const existing = byRule.get(key);
      existing.count = (existing.count || 1) + 1;
    }
  }
  return Array.from(byRule.values());
}

// --- Main scan function ---

async function scanOwaspLlmPatterns(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || DEFAULT_SOURCE_PATHS;
  const productionPaths = options.productionPaths || DEFAULT_PRODUCTION_PATHS;
  const ignoreGlobs = options.ignoreGlobs || [];
  const severityDefault = options.severity || "high";

  const files = [];
  await walkSourceFiles(baseDir, sourcePaths, files);
  for (const rel of productionPaths) {
    const abs = path.join(baseDir, ...rel.replace(/\/$/, "").split("/"));
    if (fs.existsSync(abs)) {
      await walkProductionFiles(abs, files);
    }
  }

  const seen = new Set();
  const uniqueFiles = [];
  for (const file of files) {
    const key = file.path;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFiles.push(file);
  }

  const issues = [];
  let scanned = 0;
  const categoryHits = {};

  for (const file of uniqueFiles) {
    const relativePath = normalizeRel(baseDir, file.path);
    if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
    if (isExcludedPath(relativePath)) continue;

    let content;
    try {
      const stat = await fs.promises.stat(file.path);
      if (stat.size > MAX_SCAN_BYTES) continue;
      content = await fs.promises.readFile(file.path, "utf8");
    } catch {
      continue;
    }

    if (/simplebeacon-ignore/i.test(content.substring(0, 500))) continue;

    scanned += 1;
    const ruleIssues = scanCatalogPatterns(
      relativePath,
      content,
      RULE_CATALOG,
      severityDefault,
    );
    for (const issue of ruleIssues) {
      const cat = issue.metadata?.category || "unknown";
      categoryHits[cat] = (categoryHits[cat] || 0) + 1;
    }
    issues.push(...collapsePatternIssuesByFile(ruleIssues, relativePath));
  }

  const summary = {
    owaspVersion: "2025",
    categoriesDetected: Object.keys(categoryHits),
    categoryHits,
    totalRules: RULE_CATALOG.length,
    referenceUrl: "https://genai.owasp.org/llm-top-10/",
  };

  return {
    scanned,
    findings: issues.length,
    issues,
    summary,
    patterns: RULE_CATALOG.map((r) => r.id),
  };
}

module.exports = {
  RULE_CATALOG,
  OWASP_CATEGORIES,
  scanOwaspLlmPatterns,
  DEFAULT_SOURCE_PATHS,
  DEFAULT_PRODUCTION_PATHS,
};
