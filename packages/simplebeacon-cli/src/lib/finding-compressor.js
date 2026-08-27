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
