// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Deterministic structural intent scanner — Tier 1a.
 * Ports IntelligentIntentScanner logic without Python AST or native deps.
 */

import {
  GENERIC_AI_MARKERS,
  CREDENTIAL_KEY_FRAGMENTS,
  INTENT_RULE_IDS,
} from "./constants.js";

/**
 * Is generic name.
 * @param {string} name
 * @returns {any}
 */
function isGenericName(name) {
  const lower = String(name || "").toLowerCase();
  if (GENERIC_AI_MARKERS.has(lower)) return true;
  for (const marker of GENERIC_AI_MARKERS) {
    if (lower.includes(marker)) return true;
  }
  return false;
}

/**
 * Credential key match.
 * @param {any} key
 * @returns {any}
 */
function credentialKeyMatch(key) {
  const lower = String(key || "").toLowerCase();
  return CREDENTIAL_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

/**
 * Is placeholder credential value.
 * @param {any} value
 * @returns {any}
 */
function isPlaceholderCredentialValue(value) {
  if (value == null) return true;
  const str = String(value);
  if (str.length < 4) return true;
  const lower = str.toLowerCase();
  return (
    lower.includes("your_") ||
    lower.includes("changeme") ||
    lower.includes("placeholder")
  );
}

/**
 * Normalize finding.
 * @param {any} base
 * @returns {any}
 */
function normalizeFinding(base) {
  return {
    id: base.id,
    severity: base.severity,
    category: base.category,
    type: "Structural Intent",
    description: base.details,
    filePath: base.file,
    line: base.line,
    pattern: base.id,
    metadata: {
      ruleId: base.id,
      engine: "structural",
      functionName: base.functionName || null,
    },
  };
}

/**
 * Extract python functions.
 * @param {any} content
 * @returns {any}
 */
function extractPythonFunctions(content) {
  const lines = content.split("\n");
  const functions = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(/^(\s*)def\s+([a-zA-Z_][\w]*)\s*\(/);
    if (!match) {
      i += 1;
      continue;
    }

    const indent = match[1].length;
    const name = match[2];
    const startLine = i + 1;
    const bodyLines = [];
    i += 1;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") {
        bodyLines.push(line);
        i += 1;
        continue;
      }
      const lineIndent = line.match(/^(\s*)/)[1].length;
      if (lineIndent <= indent && line.trim() !== "") break;
      bodyLines.push(line);
      i += 1;
    }

    functions.push({ name, startLine, body: bodyLines.join("\n") });
  }

  return functions;
}

/**
 * Extract js functions.
 * @param {any} content
 * @returns {any}
 */
function findMatchingBrace(content, openBrace) {
  let depth = 0;
  for (let j = openBrace; j < content.length; j += 1) {
    if (content[j] === "{") depth += 1;
    if (content[j] === "}") {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function extractJsFunctions(content) {
  const functions = [];
  const patterns = [
    {
      re: /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
    },
    {
      re: /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
    },
    {
      re: /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g,
    },
  ];

  for (const { re } of patterns) {
    let match;
    while ((match = re.exec(content)) !== null) {
      const name = match[1];
      const openBrace = content.indexOf("{", match.index);
      if (openBrace === -1) continue;

      let depth = 0;
      let end = openBrace;
      for (let j = openBrace; j < content.length; j += 1) {
        if (content[j] === "{") depth += 1;
        if (content[j] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }

      const body = content.slice(openBrace + 1, end);
      const startLine = content.slice(0, match.index).split("\n").length;
      functions.push({ name, startLine, body });
    }
  }

  return functions;
}

/**
 * Has placeholder return.
 * @param {any} body
 * @returns {any}
 */
function hasPlaceholderReturn(body) {
  if (/\breturn\s+(\{|\[|[\"'`]|true|false|null|None)/i.test(body)) return true;

  const assignedGeneric = new Set();
  const assignRe = /\b([a-zA-Z_][\w]*)\s*=\s*(\{|\[)/g;
  let assignMatch;
  while ((assignMatch = assignRe.exec(body)) !== null) {
    if (isGenericName(assignMatch[1])) assignedGeneric.add(assignMatch[1]);
  }

  const retRe = /\breturn\s+([a-zA-Z_][\w]*)/g;
  let retMatch;
  while ((retMatch = retRe.exec(body)) !== null) {
    if (assignedGeneric.has(retMatch[1]) || isGenericName(retMatch[1]))
      return true;
  }

  return false;
}

/**
 * Analyze function block.
 * @param {Function} fn
 * @param {string} filePath
 * @param {Object} options
 * @returns {any}
 */
function analyzeFunctionBlock(fn, filePath, options = {}) {
  const findings = [];
  const threshold = options.genericVarThreshold ?? 0.6;
  const body = fn.body || "";

  const assignmentRe = /\b([a-zA-Z_][\w]*)\s*=/g;
  let assignMatch;
  let totalVars = 0;
  let genericCount = 0;
  while ((assignMatch = assignmentRe.exec(body)) !== null) {
    totalVars += 1;
    if (isGenericName(assignMatch[1])) genericCount += 1;
  }

  const hasTryExcept = /\btry\s*\{/.test(body) || /\btry\s*:/.test(body);
  const hasTryPass =
    /\bexcept\b[^:]*:\s*\n\s*pass\b/.test(body) ||
    /\bcatch\s*\([^)]*\)\s*\{\s*\}/.test(body);
  const returnsPlaceholder = hasPlaceholderReturn(body);

  if (totalVars > 0 && genericCount / totalVars >= threshold) {
    if (!hasTryExcept && returnsPlaceholder) {
      findings.push(
        normalizeFinding({
          id: INTENT_RULE_IDS.HOLLOW_FUNCTION,
          severity: "medium",
          category: "Low Semantic Density (AI Fingerprint)",
          file: filePath,
          line: fn.startLine,
          functionName: fn.name,
          details:
            `Function '${fn.name}' exhibits high structural entropy: ` +
            `${Math.round((genericCount / totalVars) * 100)}% generic variable names, ` +
            "hardcoded return shape, no defensive error routing — likely unchecked AI generation.",
        }),
      );
    }
  }

  if (hasTryExcept && hasTryPass) {
    findings.push(
      normalizeFinding({
        id: INTENT_RULE_IDS.TRY_EXCEPT_PASS,
        severity: "low",
        category: "Structural Drift (Empty Error Handler)",
        file: filePath,
        line: fn.startLine,
        functionName: fn.name,
        details: `Function '${fn.name}' contains try/except or catch blocks with empty handlers — common AI boilerplate.`,
      }),
    );
  }

  return findings;
}

/**
 * Scan credential dict stubs.
 * @param {any} content
 * @param {string} filePath
 * @param {any} language
 * @returns {any}
 */
function scanCredentialDictStubs(content, filePath, language) {
  const findings = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (language === "python") {
      const dictMatch = line.match(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]*)['"]/);
      if (
        dictMatch &&
        credentialKeyMatch(dictMatch[1]) &&
        isPlaceholderCredentialValue(dictMatch[2])
      ) {
        findings.push(
          normalizeFinding({
            id: INTENT_RULE_IDS.CREDENTIAL_STUB,
            severity: "high",
            category: "Credential Mock Stub",
            file: filePath,
            line: i + 1,
            details: `Config key '${dictMatch[1]}' assigned a superficial AI placeholder value.`,
          }),
        );
      }
    } else {
      const jsMatch = line.match(/(['"])?([\w]+)\1\s*:\s*['"]([^'"]*)['"]/);
      if (
        jsMatch &&
        credentialKeyMatch(jsMatch[2]) &&
        isPlaceholderCredentialValue(jsMatch[3])
      ) {
        findings.push(
          normalizeFinding({
            id: INTENT_RULE_IDS.CREDENTIAL_STUB,
            severity: "high",
            category: "Credential Mock Stub",
            file: filePath,
            line: i + 1,
            details: `Config key '${jsMatch[2]}' assigned a superficial AI placeholder value.`,
          }),
        );
      }
    }
  }

  return findings;
}

/**
 * Scan structural intent.
 * @param {any} content
 * @param {Object} options
 * @returns {any}
 */
function scanStructuralIntent(content, options = {}) {
  const filePath = options.filePath || "snippet.txt";
  const language = options.language || "javascript";
  const findings = [];

  const functions =
    language === "python"
      ? extractPythonFunctions(content)
      : extractJsFunctions(content);

  for (const fn of functions) {
    findings.push(...analyzeFunctionBlock(fn, filePath, options));
  }

  findings.push(...scanCredentialDictStubs(content, filePath, language));

  return findings;
}

export {
  scanStructuralIntent,
  scanCredentialDictStubs,
  extractPythonFunctions,
  extractJsFunctions,
  analyzeFunctionBlock,
  isGenericName,
  credentialKeyMatch,
  isPlaceholderCredentialValue,
  hasPlaceholderReturn,
};
