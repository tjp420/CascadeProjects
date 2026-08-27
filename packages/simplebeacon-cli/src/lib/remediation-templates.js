// simplebeacon-ignore: Scanner pattern definitions and dashboard code — all findings are false positives
/**
 * Remediation Templates — maps ACTION_CODES to structured fix templates.
 *
 * Each template contains:
 *   - searchPattern: regex to locate the offending code
 *   - replaceTemplate: replacement string (or null if no safe auto-fix)
 *   - envVarHint: hint for environment variable setup (credentials only)
 *   - verifyCommand: command to verify the fix
 *   - manualSteps: human-readable steps (from remediation-guides.js playbooks)
 *   - canAutoFix: true if search/replace is safe, false if human judgment required
 *   - playbookId: maps to GUIDE_PLAYBOOKS key in remediation-guides.js
 */

const REMEDIATION_TEMPLATES = {
  // ── Credential actions ────────────────────────────────────────────────────
  REVOKE_AND_ENV: {
    actionCode: "REVOKE_AND_ENV",
    searchPattern:
      /(?:const|let|var)\s+(\w+)\s*=\s*["'](ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{48}|sk_live_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{16})["']/g,
    replaceTemplate: 'process.env.$1',
    envVarHint:
      "Add $1 to your .env file and secret manager (AWS Secrets Manager, Doppler, etc.)",
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Rotate the exposed credential in the provider console immediately",
      "Add the credential to your secret manager (AWS Secrets Manager, Doppler, etc.)",
      "Replace the hardcoded string with process.env.VAR_NAME",
      "Add .env, .env.local, and .env.production to .gitignore if not already present",
    ],
    canAutoFix: true,
    playbookId: "credentials",
  },

  ROTATE_AND_REMOVE: {
    actionCode: "ROTATE_AND_REMOVE",
    searchPattern:
      /(?:const|let|var)\s+(\w+)\s*=\s*["']((?:gho_|ghu_|ghs_|ghr_)?[A-Za-z0-9]{36,})["']/g,
    replaceTemplate: 'process.env.$1',
    envVarHint: "Rotate this token if it was ever exposed, then load from environment",
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Rotate the token in the provider console if it was ever committed",
      "Remove the hardcoded string from source",
      "Load the value from an environment variable or secret manager",
    ],
    canAutoFix: true,
    playbookId: "credentials",
  },

  ENV_CONFIG_VERIFY: {
    actionCode: "ENV_CONFIG_VERIFY",
    searchPattern:
      /(?:const|let|var)\s+(\w+)\s*=\s*["']([a-zA-Z0-9_-]{20,})["']/g,
    replaceTemplate: 'process.env.$1',
    envVarHint: "Verify this is a real secret before rotating; if so, move to env config",
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Verify whether this is a real secret or a test fixture",
      "If real: rotate and move to environment-backed configuration",
      "If test: add a simplebeacon-ignore comment or move to test fixtures",
    ],
    canAutoFix: false,
    playbookId: "credentials",
  },

  // ── Production leak actions ───────────────────────────────────────────────
  REPLACE_SAMPLE_IMPORT: {
    actionCode: "REPLACE_SAMPLE_IMPORT",
    searchPattern:
      /import\s+(\w+)\s+from\s+["'].*?sample.*?\.json["']/g,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Replace the sample JSON import with a live API call or env-based config",
      "Move fixture files to test-only directories (__tests__/, fixtures/)",
      "Confirm the production build does not bundle sample JSON",
    ],
    canAutoFix: false,
    playbookId: "production-leak",
  },

  REPLACE_PLAIN_SAMPLE: {
    actionCode: "REPLACE_PLAIN_SAMPLE",
    searchPattern:
      /import\s+(\w+)\s+from\s+["'].*?\/data\/.*?\.json["']/g,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Replace plain sample.json imports with live data sources",
      "Move demo defaults behind example/dev routes",
    ],
    canAutoFix: false,
    playbookId: "production-leak",
  },

  GATE_MOCK_PATHS: {
    actionCode: "GATE_MOCK_PATHS",
    searchPattern:
      /import\s+.*\s+from\s+["'].*?(?:mock|fixture|test).*?["']/g,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Move mock-only paths behind test/dev gates",
      "Keep production paths bound to live data sources",
      "Use process.env.NODE_ENV to conditionally load mocks",
    ],
    canAutoFix: false,
    playbookId: "production-leak",
  },

  AUDIT_FIXTURES: {
    actionCode: "AUDIT_FIXTURES",
    searchPattern:
      /import\s+.*\s+from\s+["'].*?fixture.*?["']/g,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Audit fixture usage in this file",
      "Remove mock references from production-bound modules",
      "Move fixtures to test-only directories",
    ],
    canAutoFix: false,
    playbookId: "production-leak",
  },

  // ── LLM slop actions ──────────────────────────────────────────────────────
  REPLACE_PLACEHOLDER: {
    actionCode: "REPLACE_PLACEHOLDER",
    searchPattern:
      /\/\/\s*AI Generated Placeholder.*$/gm,
    replaceTemplate: "// Implement production logic here",
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace the placeholder comment with actual implementation",
      "Remove any 'replace with real implementation' markers",
    ],
    canAutoFix: false,
    playbookId: "fiction-kpi",
  },

  REMOVE_MARKDOWN_FENCE: {
    actionCode: "REMOVE_MARKDOWN_FENCE",
    searchPattern: /```[a-z]*\n[\s\S]*?```/g,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Remove markdown code fences from source/config files",
      "Move documentation to .md files, not inline in source",
    ],
    canAutoFix: false,
    playbookId: "fiction-kpi",
  },

  REPLACE_FAKE_METRIC: {
    actionCode: "REPLACE_FAKE_METRIC",
    searchPattern:
      /["'](99\.99%?\s*Uptime|100%?\s*Secure|9,999\s*Users|99\.9%?\s*Accuracy)["']/gi,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace hardcoded metrics with dynamic values from .simplebeacon/baseline.json",
      "Bind UI labels to fetched data instead of static literals",
      "Run npx simplebeacon baseline sync after a green test run",
    ],
    canAutoFix: false,
    playbookId: "fiction-kpi",
  },

  VERIFY_SDK_EXISTS: {
    actionCode: "VERIFY_SDK_EXISTS",
    searchPattern:
      /\.(getOrCreate|fetchAllRecords|autoResolve|getOrCreateEverything)\s*\(/g,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Verify this SDK/API method exists in the actual library documentation",
      "Remove the call if it was hallucinated by the LLM",
      "Replace with the correct method from the library's API reference",
    ],
    canAutoFix: false,
    playbookId: "fiction-kpi",
  },

  REMOVE_AI_DEBRIS: {
    actionCode: "REMOVE_AI_DEBRIS",
    searchPattern:
      /\/\/\s*(I have implemented|Let me know if|Generated by Claude|Generated by GPT|As requested|Here is the).*$/gim,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Remove conversational AI debris and placeholder comments",
      "Delete comments like 'I have implemented...', 'Let me know if...', 'Generated by...'",
      "Keep only comments that explain business logic",
    ],
    canAutoFix: true,
    playbookId: "fiction-kpi",
  },

  // ── General ───────────────────────────────────────────────────────────────
  MANUAL_REVIEW: {
    actionCode: "MANUAL_REVIEW",
    searchPattern: null,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Manual review required — no automated fix template available",
      "Inspect the flagged line and apply project-specific remediation",
    ],
    canAutoFix: false,
    playbookId: null,
  },

  // ── Custom heuristic actions ─────────────────────────────────────────────
  ADD_ERROR_LOGGING: {
    actionCode: "ADD_ERROR_LOGGING",
    searchPattern: /catch\s*(\(([^)]*)\))?\s*\{\s*(?:\/\*[^*]*\*\/\s*)?\}/g,
    replaceTemplate: (match, fullParens, paramName) => {
      const param = paramName || "err";
      if (fullParens) {
        return `catch (${param}) { console.error("[${param}] Error:", ${param}); }`;
      }
      // TS catch without binding — add a parameter
      return `catch (${param}) { console.error("[${param}] Error:", ${param}); }`;
    },
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Add console.error(err) or console.warn(err) inside the empty catch block",
      "If the error should be re-raised, use: catch (err) { console.error(err); throw err; }",
      "If the error is truly safe to ignore, add an explicit comment: catch (err) { /* safe to ignore: <reason> */ }",
    ],
    canAutoFix: true,
    playbookId: "custom-heuristic",
  },

  ENABLE_SSL_VERIFY: {
    actionCode: "ENABLE_SSL_VERIFY",
    searchPattern: /rejectUnauthorized\s*:\s*false/g,
    replaceTemplate: 'rejectUnauthorized: true // Use a self-signed CA cert for local dev',
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Remove rejectUnauthorized: false from HTTPS/TLS configuration",
      "For local development, use NODE_EXTRA_CA_CERTS with a self-signed CA certificate",
      "Never disable certificate verification in production code",
    ],
    canAutoFix: true,
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-001: Debug print ───────────────────────────────────────────────
  REMOVE_DEBUG_PRINT: {
    actionCode: "REMOVE_DEBUG_PRINT",
    searchPattern: null,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Remove the debug print statement or replace with a structured logger",
      "Python: use logging.debug() instead of pprint() or print_r()",
      "Go: use log/slog.Debug() instead of dbg!()",
      "Rust: use tracing::debug!() instead of dbg!()",
    ],
    canAutoFix: false, // Language-dependent — not safe to auto-remove
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-002: TODO/FIXME marker ─────────────────────────────────────────
  RESOLVE_TODO: {
    actionCode: "RESOLVE_TODO",
    searchPattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|REVIEW|OPTIMIZE|REFACTOR)\b[^\n]*$/gim,
    replaceTemplate: '// Resolved — see commit history for details',
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Complete the task described in the TODO/FIXME marker",
      "Or create a tracked issue (GitHub/Jira) with the context and link it",
      "Then remove the marker or replace with a reference to the issue",
    ],
    canAutoFix: false, // Cannot auto-resolve the task — requires human judgment
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-005: Eval/exec usage ───────────────────────────────────────────
  REPLACE_EVAL: {
    actionCode: "REPLACE_EVAL",
    searchPattern: null,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Python: replace eval() with ast.literal_eval() for literal expressions",
      "JS: replace eval() with JSON.parse() for JSON data",
      "For dynamic code, use a proper parser/interpreter sandbox",
    ],
    canAutoFix: false, // Context-dependent replacement — not safe to auto-fix
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-006: Hardcoded credential ──────────────────────────────────────
  MOVE_CREDENTIAL_TO_ENV: {
    actionCode: "MOVE_CREDENTIAL_TO_ENV",
    searchPattern:
      /(?:const|let|var)\s+(\w*(?:password|passwd|pwd|api_key|apikey|secret|access_key|private_key|token)\w*)\s*=\s*["']([^"']{8,})["']/gi,
    replaceTemplate: 'process.env.$1',
    envVarHint: "Add $1 to your .env file and rotate the exposed credential immediately",
    verifyCommand: "npx simplebeacon scan --gate --path <file>",
    manualSteps: [
      "Rotate the exposed credential in the provider console immediately",
      "Move the credential to an environment variable or secrets manager",
      "Replace the hardcoded string with process.env.VAR_NAME",
      "Add .env to .gitignore if not already present",
    ],
    canAutoFix: true,
    playbookId: "credentials",
  },

  // ── SB-AI-007: Debug mode enabled ────────────────────────────────────────
  DISABLE_DEBUG_MODE: {
    actionCode: "DISABLE_DEBUG_MODE",
    searchPattern: /(?:(?:^|\n)\s*(?:DEBUG|debug)\s*=\s*)(True|true|TRUE|1|yes|on)/g,
    replaceTemplate: 'false // Disable debug mode in production',
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Set debug=false in production configuration",
      "Use environment-specific config files (e.g. config.prod.json)",
      "Or gate with: debug: process.env.NODE_ENV === 'development'",
    ],
    canAutoFix: true,
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-008: Broad exception catch ─────────────────────────────────────
  NARROW_EXCEPTION: {
    actionCode: "NARROW_EXCEPTION",
    searchPattern: null,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace bare 'except:' with 'except SpecificError:'",
      "Replace 'except Exception:' with the specific exception types you expect",
      "Replace 'catch (e)' with typed catches where possible",
    ],
    canAutoFix: false, // Requires knowing which specific exceptions to catch
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-009: Hardcoded filesystem path ─────────────────────────────────
  USE_RELATIVE_PATH: {
    actionCode: "USE_RELATIVE_PATH",
    searchPattern: null,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace hardcoded paths with relative paths using path.join() or pathlib",
      "Use environment variables for configurable paths (e.g. DATA_DIR)",
      "For Node.js: use path.resolve(__dirname, 'relative/path')",
    ],
    canAutoFix: false, // Path replacement is context-dependent
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-010: Wildcard import ───────────────────────────────────────────
  EXPLICIT_IMPORTS: {
    actionCode: "EXPLICIT_IMPORTS",
    searchPattern: /from\s+(\S+)\s+import\s+\*/g,
    replaceTemplate: null, // Cannot determine which specific names to import
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace 'from module import *' with explicit imports",
      "List only the names you actually use: from module import ClassA, funcB",
      "Use an IDE auto-import feature to discover used names",
    ],
    canAutoFix: false, // Requires analyzing which names are used downstream
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-011: Bare string exception ─────────────────────────────────────
  PROPER_EXCEPTION_CLASS: {
    actionCode: "PROPER_EXCEPTION_CLASS",
    searchPattern: /raise\s+["']([^"']+)["']/g,
    replaceTemplate: "raise ValueError('$1')",
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Python: replace raise 'message' with raise ValueError('message')",
      "JS: replace throw 'message' with throw new Error('message')",
      "Choose the appropriate exception class for the error type",
    ],
    canAutoFix: true,
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-012: Mutable default argument ──────────────────────────────────
  FIX_MUTABLE_DEFAULT: {
    actionCode: "FIX_MUTABLE_DEFAULT",
    searchPattern: /def\s+(\w+)\s*\(([^)]*\b(?:x|y|z|items|data|result|args|opts|options|config|lst|arr|dct|mapping)\w*\s*=\s*(?:\[\]|\{\}|\{\}\s*|\[\]\s*))/g,
    replaceTemplate: null, // Needs function-specific rewrite — too complex for regex
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace the mutable default with None",
      "Create the mutable object inside the function body",
      "Pattern: def f(x=None): x = x or [] if x is None else x",
    ],
    canAutoFix: false, // Requires multi-line rewrite
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-013: Disabled authentication ───────────────────────────────────
  ENABLE_AUTH_CHECK: {
    actionCode: "ENABLE_AUTH_CHECK",
    searchPattern: /(?:auth\s*=\s*)(False|false|FALSE|0|no|off|disabled)/g,
    replaceTemplate: 'true // Enable auth — use dev bypass flag for development',
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Enable authentication in production configuration",
      "For development, use a dev auth bypass flag gated on NODE_ENV=development",
      "Never deploy with auth disabled",
    ],
    canAutoFix: true,
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-014: Long sleep ────────────────────────────────────────────────
  REPLACE_LONG_SLEEP: {
    actionCode: "REPLACE_LONG_SLEEP",
    searchPattern: null,
    replaceTemplate: null,
    envVarHint: null,
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace long sleep() with an event-driven approach (condition variable, asyncio.Event)",
      "If polling is necessary, use shorter intervals (1-5s) with a total timeout",
      "Use asyncio.wait_for() or threading.Event.wait(timeout) instead of fixed sleeps",
    ],
    canAutoFix: false, // Requires architectural change
    playbookId: "custom-heuristic",
  },

  // ── SB-AI-015: Wildcard CORS ─────────────────────────────────────────────
  NARROW_CORS: {
    actionCode: "NARROW_CORS",
    searchPattern: /(["'])(?:access-control-allow-origin|allowed_origins|cors_origins)\1\s*[:=]\s*["']\*["']/gi,
    replaceTemplate: "'access-control-allow-origin': process.env.CORS_ORIGINS || 'http://localhost:3000'",
    envVarHint: "Set CORS_ORIGINS env var to a comma-separated list of allowed origins",
    verifyCommand: "npx simplebeacon scan --path <file>",
    manualSteps: [
      "Replace '*' with an explicit list of allowed origins",
      "For development, use 'http://localhost:3000' or similar",
      "Load allowed origins from an environment variable for flexibility",
    ],
    canAutoFix: true,
    playbookId: "custom-heuristic",
  },
};

/**
 * Look up a remediation template by action code.
 * @param {string} actionCode - One of the ACTION_CODES from finding-compressor.js
 * @returns {object|null} Remediation template or null if not found
 */
function getRemediationTemplate(actionCode) {
  return REMEDIATION_TEMPLATES[actionCode] || REMEDIATION_TEMPLATES.MANUAL_REVIEW;
}

/**
 * Generate a unified diff preview for a finding in a file.
 * Does NOT apply the fix — just shows what would change.
 * @param {string} fileContent - Current file content
 * @param {object} finding - Finding object (compressed or full)
 * @param {object} template - Remediation template from REMEDIATION_TEMPLATES
 * @returns {object} { canPreview, diff, originalLine, fixedLine }
 */
function generateDiffPreview(fileContent, finding, template) {
  if (!template || !template.searchPattern || !template.replaceTemplate) {
    return { canPreview: false, diff: null, reason: "No safe auto-fix available" };
  }

  const lines = fileContent.split("\n");
  const lineNum = finding.l || finding.line || 0;
  if (lineNum < 1 || lineNum > lines.length) {
    return { canPreview: false, diff: null, reason: "Line number out of range" };
  }

  const originalLine = lines[lineNum - 1];
  const pattern = new RegExp(
    template.searchPattern.source,
    template.searchPattern.flags,
  );

  let fixedLine = originalLine;
  const matches = [...originalLine.matchAll(pattern)];
  if (matches.length === 0) {
    return {
      canPreview: false,
      diff: null,
      reason: "Search pattern did not match on the flagged line",
    };
  }

  fixedLine = originalLine.replace(pattern, template.replaceTemplate);

  return {
    canPreview: true,
    originalLine: originalLine.trim(),
    fixedLine: fixedLine.trim(),
    lineNumber: lineNum,
    matchCount: matches.length,
  };
}

/**
 * Resolve a remediation template from a compressed finding.
 * @param {object} compressedFinding - { c, s, l, m, a }
 * @returns {object} { template, diffPreview }
 */
function resolveRemediation(compressedFinding, fileContent) {
  const actionCode = compressedFinding.a || "MANUAL_REVIEW";
  const template = getRemediationTemplate(actionCode);

  let diffPreview = null;
  if (fileContent && template.canAutoFix) {
    diffPreview = generateDiffPreview(fileContent, compressedFinding, template);
  }

  return {
    actionCode,
    canAutoFix: template.canAutoFix,
    searchPattern: template.searchPattern ? template.searchPattern.source : null,
    replaceTemplate: template.replaceTemplate,
    envVarHint: template.envVarHint,
    verifyCommand: template.verifyCommand,
    manualSteps: template.manualSteps,
    playbookId: template.playbookId,
    diffPreview,
  };
}

module.exports = {
  REMEDIATION_TEMPLATES,
  getRemediationTemplate,
  generateDiffPreview,
  resolveRemediation,
};
