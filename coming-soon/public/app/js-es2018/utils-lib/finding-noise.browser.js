/**
 * Contact-noise paths: docs, lockfiles, i18n catalogs, vendor bundles, and tests
 * must not appear as production HIGH findings.
 * Keep in sync with packages/simplebeacon-cli/src/lib/path-context.js
 * and packages/simplebeacon-cli/src/lib/signal-engine.js
 */

const ROOT_DOC_NAMES =
  /^(CODE_OF_CONDUCT|CHANGELOG|CONTRIBUTING|LICENSE|LICENCE|README|SECURITY|AUTHORS|NOTICE|COPYING|PATENTS|GOVERNANCE)(\.[a-z0-9]+)?$/i;

const LOCKFILE_NAMES =
  /^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|composer\.lock|poetry\.lock|Gemfile\.lock|go\.sum)$/i;

const INTERRUPT_TYPES = new Set([
  "evaldanger",
  "eval-danger",
  "innerhtmlxss",
  "inner-html-xss",
  "prototypepollution",
  "prototype-pollution",
  "sensitivedata",
  "sensitive-data",
  "credentials",
  "loggingsecrets",
  "secretincomment",
  "commandinjection",
  "sqlinjection",
]);

const NOISE_TYPES = new Set([
  "todo",
  "tododensity",
  "llmslop",
  "llm-slop",
  "fictionkpi",
  "eu-ai-act",
  "euaiact",
  "governance",
  "i18n",
  "documentation",
]);

function basename(rel) {
  const parts = String(rel || "").split("/");
  return parts[parts.length - 1] || "";
}

function typeKey(type) {
  return String(type || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export function isNoisePath(filePath) {
  const rel = String(filePath || "").replace(/\\/g, "/");
  const name = basename(rel);
  if (!name) return false;
  if (LOCKFILE_NAMES.test(name)) return true;
  if (ROOT_DOC_NAMES.test(name) || /\.(md|rst|adoc)$/i.test(name)) return true;
  if (
    /(^|\/)(i18n|locales?|translations?|lang|options\/locale)(\/|$)/i.test(
      rel,
    ) &&
    /\.(json|po|mo|ya?ml|xliff)$/i.test(name)
  ) {
    return true;
  }
  if (/swagger-ui/i.test(name) || /\.min\.(js|css)$/i.test(name)) return true;
  if (
    /(^|\/)(node_modules|vendor|third_party|third-party|dist|build)(\/|$)/i.test(
      rel,
    )
  ) {
    return true;
  }
  if (
    /(^|\/)(__tests__|tests?|spec|specs|fixtures?|mocks?|testdata|e2e|e2e-[^/]+|cypress|playwright)(\/|$)/i.test(
      rel,
    ) ||
    /\.(test|spec)\.[a-z0-9]+$/i.test(name) ||
    /_test\.(go|rs)$/i.test(name)
  ) {
    return true;
  }
  return false;
}

export function isInterruptType(type) {
  const key = typeKey(type);
  if (INTERRUPT_TYPES.has(key)) return true;
  for (const id of INTERRUPT_TYPES) {
    if (key.includes(id.replace(/-/g, ""))) return true;
  }
  return false;
}

export function isNoiseType(type) {
  const key = typeKey(type);
  if (NOISE_TYPES.has(key)) return true;
  for (const id of NOISE_TYPES) {
    if (key.includes(id.replace(/-/g, ""))) return true;
  }
  return false;
}

export function partitionScanFindings(findings) {
  const production = [];
  const noise = [];
  for (const f of findings || []) {
    const path = f.filePath || f.file || f.path || "";
    const type = f.rule || f.analyzer || f.type || f.category || "";
    if (isNoisePath(path) || isNoiseType(type)) noise.push(f);
    else production.push(f);
  }
  return { production, noise };
}

export function selectVerifiedFindings(findings, max = 10) {
  const { production } = partitionScanFindings(findings);
  return production
    .filter((f) => {
      const severity = String(f.severity || "").toLowerCase();
      const type = f.rule || f.analyzer || f.type || f.category || "";
      return (
        (severity === "high" || severity === "critical") &&
        isInterruptType(type)
      );
    })
    .slice(0, max)
    .map((f) => {
      const isEval = String(f.rule || f.analyzer || f.type || "")
        .toLowerCase()
        .includes("eval");
      return {
        title: isEval
          ? "Potential remote code execution"
          : "Investigate application-code finding",
        type: f.rule || f.analyzer || f.type || "finding",
        severity: f.severity,
        filePath: f.filePath || f.file || "",
        line: f.line || null,
        evidence: f.impact || f.description || f.message || "",
        interruptWorthy: true,
        triage: "investigate",
        nextAction: isEval
          ? "Verify whether the evaluated value can be influenced by untrusted input and whether the code path is reachable."
          : "Review the match in application source. Do not treat pattern severity as a confirmed vulnerability.",
      };
    });
}
