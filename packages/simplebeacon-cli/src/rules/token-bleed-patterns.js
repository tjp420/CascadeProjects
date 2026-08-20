/**
 * Token bleed — unchunked file/context passed into LLM API calls (advisory).
 * Production paths only; opt-in via config.rules['token-bleed-patterns'].
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("./production-leak");
const {
  DEFAULT_PRODUCTION_PATHS,
  SCANNABLE_EXTENSIONS,
  isExcludedPath,
  isUnderProductionPaths,
  isCommentLine,
  isAllowlistedMatch,
  splitLines,
  lineIndexesMatching,
  withinLineWindow,
  pushFinding,
  makeFinding,
} = require("./ai-runtime-scan-common");

const MAX_SCAN_BYTES = 512000;

const PROXIMITY_LINES = 10;

const API_LINE_REGEX = new RegExp(
  [
    String.raw`openai\.chat\.completions\.create\s*\(`,
    String.raw`openai\.responses\.create\s*\(`,
    String.raw`anthropic\.messages\.create\s*\(`,
    String.raw`\bstreamText\s*\(`,
    String.raw`\bgenerateText\s*\(`,
    String.raw`\.invoke\s*\(`,
    String.raw`\.batch\s*\(`,
    String.raw`\.stream\s*\(`,
    String.raw`fetch\s*\([^)]*\/v1\/(?:chat\/completions|messages)`,
    // LangChain / LlamaIndex / Vercel AI SDK
    String.raw`\bnew\s+(LLMChain|ConversationalRetrievalQAChain|RetrievalQA)\b`,
    String.raw`\.chain\s*\.{0,1}\s*invoke\s*\(`,
    String.raw`\.asStream\s*\(`,
    String.raw`\buseChat\s*\(`,
    String.raw`\buseCompletion\s*\(`,
  ].join("|"),
  "i",
);

const FILE_IO_LINE_REGEX =
  /readFileSync\s*\(|fs\.readFile\s*\(|fs\.promises\.readFile\s*\(|createReadStream\s*\(/;
const JSON_STRINGIFY_LINE_REGEX = /JSON\.stringify\s*\(/;
const CHUNKING_HELPER_REGEX =
  /RecursiveCharacterTextSplitter|textSplitter|\.chunk\s*\(|splitDocuments|CharacterTextSplitter/;
const MESSAGES_CONTEXT_LINE_REGEX =
  /\bmessages\s*:|content\s*:|role\s*:\s*['"]user['"]/i;

const RULE_CATALOG = [
  {
    id: "SB-TB-001",
    category: "token-bleed",
    type: "Token Bleed",
    severity: "medium",
    description:
      "File read (sync/stream) within 10 lines of an LLM API call — risk of unchunked context",
  },
  {
    id: "SB-TB-002",
    category: "token-bleed",
    type: "Token Bleed",
    severity: "medium",
    description:
      "JSON.stringify near LLM API call — may serialize a large object into the prompt",
  },
  {
    id: "SB-TB-003",
    category: "token-bleed",
    type: "Token Bleed",
    severity: "medium",
    description:
      "Very long string literal (>2000 chars) in messages/content — likely uncapped prompt payload",
  },
  {
    id: "SB-TB-004",
    category: "token-bleed",
    type: "Token Bleed",
    severity: "medium",
    description:
      "File I/O without chunking/splitting helpers — read whole files before LLM calls",
  },
  {
    id: "SB-TB-005",
    category: "token-bleed",
    type: "Token Bleed",
    severity: "medium",
    description:
      "LLM API call without max_tokens, max_completion_tokens, or maxOutputTokens limit",
  },
];

const TOKEN_LIMIT_REGEX =
  /\bmax_(?:completion_)?tokens\b|\bmaxOutputTokens\b|\bmax_tokens_to_sample\b/i;
const UNBOUNDED_CALL_WINDOW = 12;

const LLM_CONTEXT_RE =
  /\b(openai|anthropic|claude|gpt|llm|langchain|chain|model|agent|retriever|prompt|tool|embedding|ai-sdk|vercel|messages|completions|chat|completion|generateText|streamText|useChat|useCompletion)\b/i;
const GENERIC_INVOKE_RE = /\.invoke\s*\(/;
const GENERIC_STREAM_RE = /\.stream\s*\(/;
const GENERIC_BATCH_RE = /\.batch\s*\(/;

function filterApiLines(lines, indexes) {
  return indexes.filter((idx) => {
    const line = lines[idx] || "";
    if (
      GENERIC_INVOKE_RE.test(line) ||
      GENERIC_STREAM_RE.test(line) ||
      GENERIC_BATCH_RE.test(line)
    ) {
      return LLM_CONTEXT_RE.test(line);
    }
    return true;
  });
}

const LONG_SINGLE_QUOTED = /'(?:[^'\\]|\\.){2000,}'/;
const LONG_DOUBLE_QUOTED = /"(?:[^"\\]|\\.){2000,}"/;

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function scanProximityBleed(relativePath, content, ext, options = {}) {
  const findings = [];
  const seen = new Set();
  if (isExcludedPath(relativePath)) return findings;
  if (
    options.productionPathsOnly &&
    !isUnderProductionPaths(relativePath, options.productionPaths)
  ) {
    return findings;
  }

  const lines = splitLines(content);
  const apiLines = filterApiLines(
    lines,
    lineIndexesMatching(lines, API_LINE_REGEX),
  );
  if (!apiLines.length) return findings;

  const fileIoLines = lineIndexesMatching(lines, FILE_IO_LINE_REGEX);
  const stringifyLines = lineIndexesMatching(lines, JSON_STRINGIFY_LINE_REGEX);

  for (const apiIdx of apiLines) {
    const lineText = lines[apiIdx] || "";
    if (isCommentLine(lineText, ext)) continue;
    if (isAllowlistedMatch(lineText, lineText)) continue;

    for (const ioIdx of fileIoLines) {
      if (!withinLineWindow(apiIdx, ioIdx, PROXIMITY_LINES)) continue;
      const ioLine = lines[ioIdx] || "";
      if (isCommentLine(ioLine, ext)) continue;
      pushFinding(
        findings,
        seen,
        makeFinding(
          relativePath,
          apiIdx + 1,
          RULE_CATALOG[0],
          ioLine,
          "Chunk files (text splitter / token-aware chunker) before passing content to LLM APIs.",
        ),
      );
      break;
    }

    for (const strIdx of stringifyLines) {
      if (!withinLineWindow(apiIdx, strIdx, PROXIMITY_LINES)) continue;
      const strLine = lines[strIdx] || "";
      if (isCommentLine(strLine, ext)) continue;
      pushFinding(
        findings,
        seen,
        makeFinding(
          relativePath,
          apiIdx + 1,
          RULE_CATALOG[1],
          strLine,
          "Summarize or chunk structured data instead of JSON.stringify into prompts.",
        ),
      );
      break;
    }
  }

  return findings;
}

function scanLongMessageLiterals(relativePath, content, ext, options = {}) {
  const findings = [];
  const seen = new Set();
  if (isExcludedPath(relativePath)) return findings;
  if (
    options.productionPathsOnly &&
    !isUnderProductionPaths(relativePath, options.productionPaths)
  ) {
    return findings;
  }
  if (
    !MESSAGES_CONTEXT_LINE_REGEX.test(content) &&
    !API_LINE_REGEX.test(content)
  ) {
    return findings;
  }

  const lines = splitLines(content);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, ext)) continue;
    if (!MESSAGES_CONTEXT_LINE_REGEX.test(line) && !API_LINE_REGEX.test(line))
      continue;

    for (const regex of [LONG_SINGLE_QUOTED, LONG_DOUBLE_QUOTED]) {
      regex.lastIndex = 0;
      if (!regex.test(line)) continue;
      if (isAllowlistedMatch(line, line)) continue;
      pushFinding(
        findings,
        seen,
        makeFinding(
          relativePath,
          i + 1,
          RULE_CATALOG[2],
          line.slice(0, 80),
          "Split long user/content strings or load documents via a chunking pipeline.",
        ),
      );
      break;
    }
  }

  return findings;
}

function sliceCallWindow(lines, startIdx) {
  const end = Math.min(lines.length, startIdx + UNBOUNDED_CALL_WINDOW);
  return lines.slice(startIdx, end).join("\n");
}

function scanUnboundedLlmCalls(relativePath, content, ext, options = {}) {
  const findings = [];
  const seen = new Set();
  if (isExcludedPath(relativePath)) return findings;
  if (
    options.productionPathsOnly &&
    !isUnderProductionPaths(relativePath, options.productionPaths)
  ) {
    return findings;
  }

  const lines = splitLines(content);
  const apiLines = filterApiLines(
    lines,
    lineIndexesMatching(lines, API_LINE_REGEX),
  );
  if (!apiLines.length) return findings;

  for (const apiIdx of apiLines) {
    const lineText = lines[apiIdx] || "";
    if (isCommentLine(lineText, ext)) continue;
    if (isAllowlistedMatch(lineText, lineText)) continue;

    const windowText = sliceCallWindow(lines, apiIdx);
    // Check if the call window has any token-cap parameter
    if (TOKEN_LIMIT_REGEX.test(windowText)) continue;

    pushFinding(
      findings,
      seen,
      makeFinding(
        relativePath,
        apiIdx + 1,
        RULE_CATALOG[4],
        lineText.trim().slice(0, 120),
        "Set max_tokens, max_completion_tokens, or maxOutputTokens on LLM client calls.",
      ),
    );
  }

  return findings;
}

function scanMissingChunking(relativePath, content, ext, options = {}) {
  const findings = [];
  if (isExcludedPath(relativePath)) return findings;
  if (
    options.productionPathsOnly &&
    !isUnderProductionPaths(relativePath, options.productionPaths)
  ) {
    return findings;
  }
  if (!FILE_IO_LINE_REGEX.test(content) || !API_LINE_REGEX.test(content))
    return findings;
  if (CHUNKING_HELPER_REGEX.test(content)) return findings;

  const lines = splitLines(content);
  for (let i = 0; i < lines.length; i++) {
    if (!FILE_IO_LINE_REGEX.test(lines[i])) continue;
    if (isCommentLine(lines[i], ext)) continue;
    return [
      makeFinding(
        relativePath,
        i + 1,
        RULE_CATALOG[3],
        lines[i],
        "Add RecursiveCharacterTextSplitter, textSplitter, or chunk/splitDocuments before LLM calls.",
      ),
    ];
  }
  return findings;
}

function scanTextPatterns(relativePath, content, ext, options = {}) {
  const opts = {
    productionPathsOnly: options.productionPathsOnly !== false,
    productionPaths: options.productionPaths || DEFAULT_PRODUCTION_PATHS,
  };
  return [
    ...scanProximityBleed(relativePath, content, ext, opts),
    ...scanLongMessageLiterals(relativePath, content, ext, opts),
    ...scanMissingChunking(relativePath, content, ext, opts),
    ...scanUnboundedLlmCalls(relativePath, content, ext, opts),
  ];
}

async function walkProductionSourceFiles(dir, results = [], depth = 0) {
  if (depth > 8) return results;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          ".git",
          "coverage",
          "dist",
          "build",
          "tests",
          "test",
          "__tests__",
          "docs",
          "examples",
        ].includes(entry.name)
      ) {
        continue;
      }
      await walkProductionSourceFiles(fullPath, results, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.size > MAX_SCAN_BYTES) continue;
      results.push({ path: fullPath, ext });
    } catch {
      /* skip */
    }
  }
  return results;
}

async function scanTokenBleedPatterns(baseDir, options = {}) {
  const productionPaths = options.productionPaths || DEFAULT_PRODUCTION_PATHS;
  const ignoreGlobs = options.ignoreGlobs || [];
  const severityDefault = options.severity || "medium";
  const files = [];

  for (const rel of productionPaths) {
    const abs = path.join(baseDir, ...rel.replace(/\/$/, "").split("/"));
    if (fs.existsSync(abs)) {
      await walkProductionSourceFiles(abs, files);
    }
  }

  const seen = new Set();
  const uniqueFiles = [];
  for (const file of files) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    uniqueFiles.push(file);
  }

  const issues = [];
  let scanned = 0;

  for (const file of uniqueFiles) {
    const relativePath = normalizeRel(baseDir, file.path);
    if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
    if (isExcludedPath(relativePath)) continue;
    if (!isUnderProductionPaths(relativePath, productionPaths)) continue;

    let content;
    try {
      const stat = await fs.promises.stat(file.path);
      if (stat.size > MAX_SCAN_BYTES) continue;
      content = await fs.promises.readFile(file.path, "utf8");
    } catch {
      continue;
    }

    scanned += 1;
    const ext = file.ext || path.extname(file.path).toLowerCase();
    issues.push(
      ...scanTextPatterns(relativePath, content, ext, {
        productionPathsOnly: true,
        productionPaths,
      }),
    );
  }

  for (const issue of issues) {
    if (!issue.severity) issue.severity = severityDefault;
  }

  return {
    scanned,
    findings: issues.length,
    issues,
    patterns: RULE_CATALOG.map((r) => r.id),
  };
}

module.exports = {
  RULE_CATALOG,
  scanTextPatterns,
  scanTokenBleedPatterns,
  DEFAULT_PRODUCTION_PATHS,
};
