// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Finding utilities — path classification, deduplication, enrichment, and scoring.
 */

const { formatRule, defaultRemediation } = require("../simplebeacon-proxy.cjs");
const {
  redactSnippet,
  truncateForDisplay,
} = require("../audit-report-utils.cjs");
const { enrichRemediationRow } = require("../audit-remediation-recipes.cjs");

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const PRODUCTION_PREFIXES = [
  "server/",
  "src/",
  "packages/",
  "app/",
  "lib/",
  "client/",
  "api/",
];
const NOISE_PREFIXES = [
  "docs/",
  "tests/",
  "test/",
  "templates/",
  ".cursor/",
  "archive/",
];
const MAX_REMEDIATION_ROWS = 100;

/**
 * Collect issues.
 * @param {Object|null} simplebeaconReport
 * @returns {any}
 */
function collectIssues(simplebeaconReport) {
  if (!simplebeaconReport) return [];
  const raw =
    simplebeaconReport.rawIssues || simplebeaconReport.detectedIssues || [];
  return raw.map((issue) => ({
    severity: issue.severity || issue.severityBand || "low",
    severityBand: issue.severityBand || issue.severity || "low",
    category: issue.category || "general",
    filePath: issue.filePath || issue.path || "",
    description: issue.description || issue.message || "",
    count: issue.count || 1,
  }));
}

/**
 * Normalize finding description.
 * @param {any} finding
 * @returns {any}
 */
function normalizeFindingDescription(finding) {
  if (!finding || typeof finding !== "object") return "";
  let raw = String(finding.description || finding.match || finding.type || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const basename =
    String(finding.filePath || "")
      .split(/[/\\]/)
      .pop()
      ?.toLowerCase() || "";
  if (basename) {
    raw = raw.replace(
      new RegExp(basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      "",
    );
  }
  raw = raw.replace(/\s+in\s+[\w./_-]+\s*$/g, "").trim();
  if (/\b(stub|not implemented)\b/.test(raw)) return "stub-not-implemented";
  if (
    /\b(python\s+todo|todo\s+comment|todo\s+marker|fixme\s+marker)\b/.test(
      raw,
    ) ||
    /\btodo\b/.test(raw)
  ) {
    return "todo-marker";
  }
  if (/\bdeprecated\b/.test(raw)) return "deprecated-marker";
  if (/\bfixme\b/.test(raw)) return "fixme-marker";
  return raw.slice(0, 80);
}

/**
 * Dedupe findings.
 * @param {Array} findings
 * @returns {any}
 */
function dedupeFindings(findings = []) {
  const seen = new Set();
  const out = [];
  for (const item of findings) {
    const key = [
      normalizeFindingPath(item.filePath),
      item.line,
      item.category,
      normalizeFindingDescription(item),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Sort by severity.
 * @param {Array} findings
 * @returns {any}
 */
function sortBySeverity(findings) {
  return [...findings].sort((a, b) => {
    const left = SEVERITY_ORDER[a.severity] ?? 9;
    const right = SEVERITY_ORDER[b.severity] ?? 9;
    if (left !== right) return left - right;
    if (a.productionPriority !== b.productionPriority) {
      return (b.productionPriority || 0) - (a.productionPriority || 0);
    }
    return String(a.filePath || "").localeCompare(String(b.filePath || ""));
  });
}

/**
 * Normalize finding path.
 * @param {string} filePath
 * @returns {any}
 */
function normalizeFindingPath(filePath) {
  const rel = String(filePath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  const marker = "ai-platform/";
  const idx = rel.indexOf(marker);
  return idx >= 0 ? rel.slice(idx + marker.length) : rel;
}

/**
 * Is documentation path.
 * @param {string} filePath
 * @returns {any}
 */
function isDocumentationPath(filePath) {
  const rel = normalizeFindingPath(filePath);
  if (/\.(md|markdown|rst)$/i.test(rel)) return true;
  return NOISE_PREFIXES.some(
    (prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`),
  );
}

/**
 * Is production code path.
 * @param {string} filePath
 * @returns {any}
 */
function isProductionCodePath(filePath) {
  const rel = normalizeFindingPath(filePath);
  if (isDocumentationPath(rel)) return false;
  if (/\.(test|spec)\.[jt]s$/i.test(rel)) return false;
  return PRODUCTION_PREFIXES.some(
    (prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`),
  );
}

/** Client handoff scope — runtime deploy paths, not CLI reporters, test harnesses, or legacy src trees. */
function isAuditProductionRuntimePath(filePath) {
  const rel = normalizeFindingPath(filePath);
  if (isDocumentationPath(rel)) return false;
  if (/\.(test|spec)\.[jt]s$/i.test(rel)) return false;
  if (/\.(?:ps1|sh|bat|cmd)$/i.test(rel)) return false;
  if (/(?:^|\/)scripts\//.test(rel) || /(?:^|\/)tools\//.test(rel))
    return false;
  if (/(?:^|\/)reporters\//.test(rel)) return false;
  if (/^server\/test[-_.]/i.test(rel) || /\/test-gateway\./i.test(rel))
    return false;
  if (/^src\/ai-system\//.test(rel)) return false;
  if (rel.startsWith("server/")) return true;
  if (rel.startsWith("web/") || rel.includes("/web/simplebeacon-dashboard/"))
    return true;
  if (rel.startsWith("packages/") || rel.includes("/packages/")) {
    if (/(?:^|\/)packages\/[^/]+\/(?:reporters|bin|scripts|tools)\//.test(rel))
      return false;
    if (/(?:^|\/)packages\/[^/]+\/publish\.(?:ps1|sh)$/i.test(rel))
      return false;
    if (
      /(?:^|\/)packages\/[^/]+\/src\/(?:reporters|bin|scripts|tools)\//.test(
        rel,
      )
    )
      return false;
    return /(?:^|\/)packages\/[^/]+\/src\//.test(rel);
  }
  if (
    rel.startsWith("src/api/") ||
    rel.startsWith("src/server/") ||
    rel.startsWith("src/web/")
  )
    return true;
  if (
    rel.startsWith("app/") ||
    rel.startsWith("lib/") ||
    rel.startsWith("client/") ||
    rel.startsWith("api/")
  ) {
    return true;
  }
  return false;
}

/**
 * Score finding.
 * @param {any} finding
 * @returns {any}
 */
function scoreFinding(finding) {
  if (!finding || typeof finding !== "object") return 0;
  let score = 0;
  if (finding.severity === "high") score += 40;
  else if (finding.severity === "medium") score += 25;
  else score += 10;
  if (isAuditProductionRuntimePath(finding.filePath)) score += 35;
  if (finding.category === "broken") score += 30;
  if (
    finding.category === "debug-artifact" &&
    isAuditProductionRuntimePath(finding.filePath)
  )
    score += 20;
  if (isDocumentationPath(finding.filePath)) score -= 30;
  return score;
}

/**
 * Enrich findings.
 * @param {Array} findings
 * @returns {any}
 */
function enrichFindings(findings = []) {
  return dedupeFindings(findings).map((f) => ({
    ...f,
    productionPriority: scoreFinding(f),
    tier: isAuditProductionRuntimePath(f.filePath)
      ? "production"
      : isDocumentationPath(f.filePath)
        ? "documentation"
        : "general",
  }));
}

/**
 * Format codebase rule.
 * @param {any} finding
 * @returns {any}
 */
function formatCodebaseRule(finding) {
  const category = finding.category || finding.type || "scan-rule";
  const map = {
    "debug-artifact": "DEBUG_ARTIFACT / CONSOLE_OR_DEBUGGER",
    "tech-debt": "TECH_DEBT_MARKER / TODO_FIXME",
    broken: "SYNTAX_OR_PARSE_ERROR",
    "meaningless-data": "FICTION_KPI_PATTERN",
    eslint: "ESLINT_RULE",
    empty: "EMPTY_OR_WHITESPACE_FILE",
    artifact: "GENERATED_ARTIFACT",
    duplicate: "DUPLICATE_BASENAME",
  };
  return map[category] || String(category).toUpperCase().replace(/-/g, "_");
}

/**
 * Classify gate issue business tier.
 * @param {Object} issue
 * @returns {string}
 */
function classifyGateIssueBusinessTier(issue) {
  const type = String(issue.type || "").toLowerCase();
  const severity = String(issue.severity || "low").toLowerCase();
  if (/credential/i.test(type) || severity === "critical") return "critical";
  if (/production leak/i.test(type) || severity === "high") return "high";
  if (/fiction|kpi|consistency|schema/i.test(type)) return "medium";
  return "low";
}

/**
 * Classify codebase business tier.
 * @param {any} finding
 * @returns {any}
 */
function classifyCodebaseBusinessTier(finding) {
  if (finding.category === "meaningless-data") return "medium";
  if (finding.category === "broken" || finding.severity === "high")
    return "high";
  if (finding.category === "debug-artifact") return "medium";
  if (finding.severity === "medium") return "medium";
  return "low";
}

/**
 * Build business risk counts.
 * @param {any} model
 * @returns {any}
 */
function buildBusinessRiskCounts(model) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of model.issues || []) {
    const tier = classifyGateIssueBusinessTier(issue);
    counts[tier] += issue.count || 1;
  }
  for (const finding of (model.allCodeFindings || []).filter(
    (f) => f.tier === "production",
  )) {
    const tier = classifyCodebaseBusinessTier(finding);
    counts[tier] += 1;
  }
  return counts;
}

/**
 * Dedupe remediation rows.
 * @param {Array} rows
 * @returns {any}
 */
function dedupeRemediationRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.location}|${row.rule}|${row.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build developer remediation rows.
 * @param {any} model
 * @returns {any}
 */
function buildDeveloperRemediationRows(model) {
  const rows = [];

  for (const issue of sortBySeverity(model.issues || [])) {
    rows.push(
      enrichRemediationRow({
        severity: issue.severity || "high",
        location: issue.line
          ? `${issue.filePath}:${issue.line}`
          : issue.filePath,
        rule: formatRule(issue).replace(/`/g, ""),
        snippet: redactSnippet(
          issue.snippet || issue.match || issue.description,
        ),
        remediation: issue.recommendedAction || defaultRemediation(issue),
        source: "Simplebeacon gate",
      }),
    );
  }

  const runtimeFindings = sortBySeverity(
    (model.allCodeFindings || []).filter((f) => f.tier === "production"),
  );
  for (const finding of runtimeFindings) {
    rows.push(
      enrichRemediationRow({
        severity: finding.severity || "medium",
        location: finding.line
          ? `${finding.filePath}:${finding.line}`
          : finding.filePath,
        rule: formatCodebaseRule(finding),
        snippet: redactSnippet(finding.match || finding.description),
        remediation: truncateForDisplay(
          finding.recommendedAction ||
            "Review and remediate before client handoff.",
          160,
        ),
        source: "Runtime codebase scan",
      }),
    );
  }

  return dedupeRemediationRows(rows).slice(0, MAX_REMEDIATION_ROWS);
}

/**
 * Format ledger files scanned.
 * @param {any} summary
 * @returns {any}
 */
function formatLedgerFilesScanned(summary) {
  const parts = [];
  if (summary.codeFilesAnalyzed != null) {
    parts.push(
      `${Number(summary.codeFilesAnalyzed).toLocaleString()} code files deep-scanned`,
    );
  }
  if (summary.ruleScopedFiles === 0) {
    parts.push(
      "0 gate-rule files — configure production paths in simplebeacon.config.json for credential/leak rules",
    );
  } else if (summary.ruleScopedFiles != null) {
    parts.push(
      `${Number(summary.ruleScopedFiles).toLocaleString()} gate-rule files checked`,
    );
  } else if (summary.gatePass == null) {
    parts.push("Gate scan not included in this bundle");
  }
  if (summary.repositoryFiles != null) {
    parts.push(
      `${Number(summary.repositoryFiles).toLocaleString()} repo files indexed`,
    );
  }
  return parts.length ? parts.join(" · ") : "—";
}

/**
 * Format report date.
 * @param {string|Date} [iso]
 * @returns {string}
 */
function _formatReportDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Redact path for display.
 * @param {string} projectPath
 * @returns {any}
 */
function redactPathForDisplay(projectPath) {
  const normalized = String(projectPath || "")
    .replace(/\\/g, "/")
    .trim();
  if (!normalized) return "Project";
  const parts = normalized.split("/").filter(Boolean);
  if (/^[A-Za-z]:$/i.test(parts[0]) && parts.length > 1) parts.shift();
  if (parts.length <= 2) return parts.join("/") || "Project";
  return parts.slice(-2).join("/");
}

/**
 * Count by tier.
 * @param {Array} findings
 * @returns {any}
 */
function countByTier(findings) {
  return findings.reduce(
    (acc, f) => {
      acc[f.tier] = (acc[f.tier] || 0) + 1;
      return acc;
    },
    { production: 0, documentation: 0, general: 0 },
  );
}

/**
 * Count by severity.
 * @param {Array} findings
 * @returns {any}
 */
function countBySeverity(findings) {
  return findings.reduce(
    (acc, f) => {
      const band = String(f.severity || "low").toLowerCase();
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

/**
 * Count production severity.
 * @param {Array} findings
 * @returns {any}
 */
function countProductionSeverity(findings) {
  return findings
    .filter((f) => f.tier === "production")
    .reduce(
      (acc, f) => {
        const band = String(f.severity || "low").toLowerCase();
        acc[band] = (acc[band] || 0) + 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );
}

/**
 * Normalize simplebeacon for compliance.
 * @param {any} simplebeacon
 * @param {any} summary
 * @returns {any}
 */
function normalizeSimplebeaconForCompliance(simplebeacon, summary = {}) {
  if (!simplebeacon || typeof simplebeacon !== "object") return simplebeacon;
  const ruleScoped =
    simplebeacon.ruleScopedFilesAnalyzed ??
    simplebeacon.scanScope?.ruleScopedFilesAnalyzed ??
    summary.ruleScopedFiles ??
    null;
  const credentialScanned =
    simplebeacon.credentialScanned ??
    simplebeacon.scanScope?.credentialScanned ??
    ruleScoped ??
    0;
  const productionLeakScanned =
    simplebeacon.productionLeakScanned ??
    simplebeacon.scanScope?.productionDirsScanned ??
    simplebeacon.scanScope?.productionLeakScanned ??
    ruleScoped ??
    0;
  return {
    ...simplebeacon,
    credentialScanned,
    productionLeakScanned,
    schemaChecked: simplebeacon.schemaChecked ?? 0,
    schemaPassed: simplebeacon.schemaPassed ?? 0,
    consistencyChecked: simplebeacon.consistencyChecked ?? 0,
    ruleScopedFilesAnalyzed: ruleScoped,
  };
}

/**
 * Is placeholder executive text.
 * @param {string} executiveText
 * @returns {any}
 */
function isPlaceholderExecutiveText(executiveText) {
  const normalizedText = String(executiveText || "").trim();
  if (!normalizedText) return true;
  return (
    /^priority\s+\d+$/i.test(normalizedText) ||
    /^priority\s*[:-]?\s*\d+$/i.test(normalizedText) ||
    /^item\s+\d+$/i.test(normalizedText)
  );
}

/**
 * Resolve tier counts.
 * @param {any} codebaseSummary
 * @param {Array} enrichedFindings
 * @returns {any}
 */
function resolveTierCounts(codebaseSummary, enrichedFindings) {
  if (enrichedFindings?.length) {
    return countByTier(enrichedFindings);
  }
  const fromSummary = codebaseSummary?.tierCounts;
  if (fromSummary && typeof fromSummary === "object") {
    return {
      production: fromSummary.production ?? 0,
      documentation: fromSummary.documentation ?? 0,
      general: fromSummary.general ?? 0,
    };
  }
  return { production: 0, documentation: 0, general: 0 };
}

/**
 * Build category rollup from scan.
 * @param {any} codebase
 * @param {Array} enrichedFindings
 * @returns {any}
 */
function buildCategoryRollupFromScan(codebase, enrichedFindings) {
  return buildCategoryRollup(enrichedFindings).sort(
    (a, b) => b.production - a.production || b.count - a.count,
  );
}

/**
 * Build category rollup.
 * @param {Array} findings
 * @returns {any}
 */
function buildCategoryRollup(findings) {
  const buckets = new Map();
  for (const f of findings) {
    const key = f.category || f.type || "other";
    const bucket = buckets.get(key) || {
      category: key,
      count: 0,
      production: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    bucket.count += 1;
    if (f.tier === "production") bucket.production += 1;
    bucket[f.severity || "low"] = (bucket[f.severity || "low"] || 0) + 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort(
    (a, b) => b.production - a.production || b.count - a.count,
  );
}

module.exports = {
  collectIssues,
  normalizeFindingDescription,
  dedupeFindings,
  sortBySeverity,
  normalizeFindingPath,
  isDocumentationPath,
  isProductionCodePath,
  isAuditProductionRuntimePath,
  scoreFinding,
  enrichFindings,
  formatCodebaseRule,
  classifyGateIssueBusinessTier,
  classifyCodebaseBusinessTier,
  buildBusinessRiskCounts,
  dedupeRemediationRows,
  MAX_REMEDIATION_ROWS,
  buildDeveloperRemediationRows,
  formatLedgerFilesScanned,
  _formatReportDate,
  redactPathForDisplay,
  countByTier,
  countBySeverity,
  countProductionSeverity,
  normalizeSimplebeaconForCompliance,
  isPlaceholderExecutiveText,
  resolveTierCounts,
  buildCategoryRollupFromScan,
  buildCategoryRollup,
};
