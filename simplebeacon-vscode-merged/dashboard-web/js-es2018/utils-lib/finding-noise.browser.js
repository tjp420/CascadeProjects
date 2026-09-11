/**
 * Contact-noise paths: docs, lockfiles, i18n catalogs, and vendor bundles
 * must not appear as production HIGH findings.
 * Keep in sync with packages/simplebeacon-cli/src/lib/path-context.js
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

function basename(rel) {
  const parts = String(rel || "").split("/");
  return parts[parts.length - 1] || "";
}

export function isNoisePath(filePath) {
  const rel = String(filePath || "").replace(/\\/g, "/");
  const name = basename(rel);
  if (!name) return false;
  if (LOCKFILE_NAMES.test(name)) return true;
  if (ROOT_DOC_NAMES.test(name) || /\.(md|rst|adoc)$/i.test(name)) return true;
  if (
    /(^|\/)(i18n|locales?|translations?|lang)(\/|$)/i.test(rel) &&
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
  return false;
}

export function isInterruptType(type) {
  const key = String(type || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (INTERRUPT_TYPES.has(key)) return true;
  for (const id of INTERRUPT_TYPES) {
    if (key.includes(id.replace(/-/g, ""))) return true;
  }
  return false;
}

export function partitionScanFindings(findings) {
  const production = [];
  const noise = [];
  for (const f of findings || []) {
    const path = f.filePath || f.file || f.path || "";
    if (isNoisePath(path)) noise.push(f);
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
    .map((f) => ({
      title:
        String(f.rule || f.analyzer || f.type || "").toLowerCase().includes(
          "eval",
        )
          ? "Potential remote code execution"
          : "Verified application-code finding",
      type: f.rule || f.analyzer || f.type || "finding",
      severity: f.severity,
      filePath: f.filePath || f.file || "",
      line: f.line || null,
      evidence: f.impact || f.description || f.message || "",
      interruptWorthy: true,
    }));
}
