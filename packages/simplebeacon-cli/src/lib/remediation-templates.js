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
    replaceTemplate: "// TODO: Implement production logic",
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
