// simplebeacon-ignore: Scanner pattern definitions and dashboard code — all findings are false positives
/**
 * Finding Compressor — reduces scan_snippet/scan_file finding payloads
 * from ~120 tokens per finding to ~30 tokens.
 *
 * Maps verbose recommendedAction strings to short action codes that
 * downstream LLM agents can look up via ACTION_CODE_DICTIONARY.
 *
 * Before (verbose):
 *   {
 *     id: "github-pat-src/api/handler.ts-42",
 *     severity: "critical",
 *     type: "Credential Pattern",
 *     description: "src/api/handler.ts:14 — Credential Pattern detected",
 *     filePath: "src/api/handler.ts",
 *     line: 14,
 *     pattern: "github-pat",
 *     recommendedAction: "Immediately remove and rotate this credential; store only via environment/secret manager bindings",
 *     match: "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
 *   }
 *
 * After (compressed):
 *   {
 *     c: "github-pat",       // pattern code
 *     s: "C",                // severity (C/H/M/L)
 *     l: 14,                 // line number
 *     m: "ghp_123456...wxyz",// truncated match evidence
 *     a: "REVOKE_AND_ENV"    // action code
 *   }
 */

// ── Severity codes ───────────────────────────────────────────────────────────
const SEVERITY_CODES = {
  critical: "C",
  high: "H",
  medium: "M",
  low: "L",
};

const SEVERITY_FROM_CODE = {
  C: "critical",
  H: "high",
  M: "medium",
  L: "low",
};

// ── Action code dictionary ───────────────────────────────────────────────────
// Maps short codes to full recommended action strings.
// Downstream LLM agents can call explain_finding to expand these.
const ACTION_CODES = {
  // Credential actions
  REVOKE_AND_ENV: "Immediately remove and rotate this credential; store only via environment/secret manager bindings",
  ROTATE_AND_REMOVE: "Remove token-like material from source control and rotate if it was ever exposed",
  ENV_CONFIG_VERIFY: "Replace hardcoded token/value with environment-backed configuration and verify this is not a real secret",

  // Production leak actions
  REPLACE_SAMPLE_IMPORT: "Replace hardcoded sample data imports with measured runtime API/scanner output before release",
  REPLACE_PLAIN_SAMPLE: "Replace plain sample.json imports with live data sources or move demo defaults behind example/dev routes",
  GATE_MOCK_PATHS: "Move mock-only paths behind test/dev gates and keep production paths bound to live data sources",
  AUDIT_FIXTURES: "Audit fixture usage and remove mock references from production-bound modules",

  // LLM slop actions
  REPLACE_PLACEHOLDER: "Replace placeholder copy with production-ready values before client handoff",
  REMOVE_MARKDOWN_FENCE: "Remove markdown code fences from source/config files",
  REPLACE_FAKE_METRIC: "Replace hardcoded metrics with dynamic or production-validated values",
  VERIFY_SDK_EXISTS: "Verify this SDK/API method exists in the actual library documentation; remove if hallucinated",
  REMOVE_AI_DEBRIS: "Remove conversational AI debris and placeholder comments from production source",

  // General
  MANUAL_REVIEW: "Manual review required",

  // Custom heuristic actions
  ADD_ERROR_LOGGING: "Log the error, re-raise it, or handle it explicitly. Never silently swallow exceptions.",
  ENABLE_SSL_VERIFY: "Enable SSL/TLS verification. For local development, use a self-signed CA certificate instead of disabling verification.",
  REMOVE_DEBUG_PRINT: "Remove the debug print or replace it with a structured logger (e.g. Python logging, Go log/slog, Rust tracing, Java SLF4J).",
  RESOLVE_TODO: "Complete the task, remove the marker, or create a tracked issue with context.",
  REPLACE_EVAL: "Replace with a safe alternative: use ast.literal_eval for Python, JSON.parse for JS, or a proper parser/interpreter.",
  MOVE_CREDENTIAL_TO_ENV: "Move the credential to an environment variable or secrets manager. Rotate the exposed credential immediately.",
  DISABLE_DEBUG_MODE: "Disable debug mode for production. Use environment-specific configuration files.",
  NARROW_EXCEPTION: "Catch specific exception types (e.g. ValueError, ConnectionError) rather than bare except or Exception.",
  USE_RELATIVE_PATH: "Use relative paths, environment variables, or path.join/pathlib for cross-platform compatibility.",
  EXPLICIT_IMPORTS: "Replace with explicit imports: from module import SpecificClass, specific_function.",
  PROPER_EXCEPTION_CLASS: "Raise a proper exception class: raise ValueError('message') or throw new Error('message').",
  FIX_MUTABLE_DEFAULT: "Use None as the default and create the mutable object inside the function: def f(x=None): x = x or [].",
  ENABLE_AUTH_CHECK: "Enable authentication. For development, use a dev auth bypass flag that requires NODE_ENV=development or equivalent.",
  REPLACE_LONG_SLEEP: "Replace with an event-driven approach, condition variable, or async/await pattern. If polling is necessary, use shorter intervals with a timeout.",
  NARROW_CORS: "Specify explicit allowed origins instead of '*'. For development, use a local origin list.",
};

// ── Reverse lookup: action string → code ─────────────────────────────────────
const ACTION_STRING_TO_CODE = {};
for (const [code, text] of Object.entries(ACTION_CODES)) {
  ACTION_STRING_TO_CODE[text] = code;
}

/**
 * Resolve a recommendedAction string to its short code.
 * Falls back to MANUAL_REVIEW if no match.
 */
function resolveActionCode(recommendedAction) {
  if (!recommendedAction || typeof recommendedAction !== "string") {
    return "MANUAL_REVIEW";
  }
  // Exact match
  if (ACTION_STRING_TO_CODE[recommendedAction]) {
    return ACTION_STRING_TO_CODE[recommendedAction];
  }
  // Prefix match (for truncated or slightly varied strings)
  const lower = recommendedAction.toLowerCase();
  if (lower.includes("rotate") && lower.includes("credential")) return "REVOKE_AND_ENV";
  if (lower.includes("rotate") && lower.includes("exposed")) return "ROTATE_AND_REMOVE";
  if (lower.includes("environment") && lower.includes("verify")) return "ENV_CONFIG_VERIFY";
  if (lower.includes("sample data") && lower.includes("runtime")) return "REPLACE_SAMPLE_IMPORT";
  if (lower.includes("plain sample") || lower.includes("sample.json")) return "REPLACE_PLAIN_SAMPLE";
  if (lower.includes("mock") && lower.includes("test/dev")) return "GATE_MOCK_PATHS";
  if (lower.includes("fixture")) return "AUDIT_FIXTURES";
  if (lower.includes("placeholder") && lower.includes("production-ready")) return "REPLACE_PLACEHOLDER";
  if (lower.includes("markdown") && lower.includes("fence")) return "REMOVE_MARKDOWN_FENCE";
  if (lower.includes("hardcoded") && lower.includes("metric")) return "REPLACE_FAKE_METRIC";
  if (lower.includes("verify") && lower.includes("sdk")) return "VERIFY_SDK_EXISTS";
  if (lower.includes("conversational") || lower.includes("debris")) return "REMOVE_AI_DEBRIS";
  if (lower.includes("log the error") || lower.includes("silently swallow")) return "ADD_ERROR_LOGGING";
  if (lower.includes("ssl") || lower.includes("tls") && lower.includes("verification")) return "ENABLE_SSL_VERIFY";
  if (lower.includes("debug print") || lower.includes("structured logger")) return "REMOVE_DEBUG_PRINT";
  if (lower.includes("todo") || lower.includes("fixme") || lower.includes("tracked issue")) return "RESOLVE_TODO";
  if (lower.includes("eval") && lower.includes("safe alternative")) return "REPLACE_EVAL";
  if (lower.includes("credential") && lower.includes("environment variable")) return "MOVE_CREDENTIAL_TO_ENV";
  if (lower.includes("debug mode") && lower.includes("production")) return "DISABLE_DEBUG_MODE";
  if (lower.includes("specific exception") || lower.includes("bare except")) return "NARROW_EXCEPTION";
  if (lower.includes("relative paths") || lower.includes("cross-platform")) return "USE_RELATIVE_PATH";
  if (lower.includes("explicit imports")) return "EXPLICIT_IMPORTS";
  if (lower.includes("proper exception class")) return "PROPER_EXCEPTION_CLASS";
  if (lower.includes("mutable") && lower.includes("none")) return "FIX_MUTABLE_DEFAULT";
  if (lower.includes("authentication") && lower.includes("dev auth bypass")) return "ENABLE_AUTH_CHECK";
  if (lower.includes("event-driven") || lower.includes("polling")) return "REPLACE_LONG_SLEEP";
  if (lower.includes("allowed origins") || lower.includes("wildcard") && lower.includes("cors")) return "NARROW_CORS";
  return "MANUAL_REVIEW";
}

/**
 * Compress a single finding to minimal token footprint.
 * @param {object} finding - Full finding object from scan_snippet/scan_file
 * @param {number} maxMatchLen - Max chars for match evidence (default 30)
 * @returns {object} Compressed finding {c, s, l, m, a}
 */
function compressFinding(finding, maxMatchLen = 30) {
  if (!finding || typeof finding !== "object") return null;

  const severity = (finding.severity || finding.severityBand || "medium").toLowerCase();
  const sevCode = SEVERITY_CODES[severity] || "?";

  // Truncate match evidence
  let match = finding.match || finding.metadata?.match || "";
  if (match && match.length > maxMatchLen) {
    const half = Math.floor((maxMatchLen - 3) / 2);
    match = match.slice(0, half) + "..." + match.slice(-half);
  }

  const code = resolveActionCode(finding.recommendedAction);

  const compressed = {
    c: finding.pattern || finding.metadata?.ruleId || finding.type || "UNKNOWN",
    s: sevCode,
    l: finding.line || 0,
  };

  // Only include match if non-empty (saves tokens on clean findings)
  if (match) compressed.m = match;

  // Only include action code if it's not MANUAL_REVIEW (saves tokens)
  if (code !== "MANUAL_REVIEW") compressed.a = code;

  return compressed;
}

/**
 * Compress an array of findings.
 * @param {array} findings - Array of finding objects
 * @param {object} options - { maxMatchLen, includeFilePaths }
 * @returns {array} Array of compressed findings
 */
function compressFindings(findings, options = {}) {
  if (!Array.isArray(findings)) return [];
  const maxMatchLen = options.maxMatchLen || 30;
  return findings
    .map((f) => compressFinding(f, maxMatchLen))
    .filter(Boolean);
}

/**
 * Expand a compressed finding back to full format using the action dictionary.
 * @param {object} compressed - { c, s, l, m, a }
 * @param {string} filePath - File path to inject (not stored in compressed format)
 * @returns {object} Expanded finding
 */
function expandFinding(compressed, filePath = "") {
  if (!compressed || typeof compressed !== "object") return null;

  const severity = SEVERITY_FROM_CODE[compressed.s] || "medium";
  const actionCode = compressed.a || "MANUAL_REVIEW";
  const recommendedAction = ACTION_CODES[actionCode] || "Manual review required";

  return {
    pattern: compressed.c,
    severity,
    line: compressed.l,
    match: compressed.m || null,
    actionCode,
    recommendedAction,
    filePath,
  };
}

module.exports = {
  SEVERITY_CODES,
  SEVERITY_FROM_CODE,
  ACTION_CODES,
  resolveActionCode,
  compressFinding,
  compressFindings,
  expandFinding,
};
