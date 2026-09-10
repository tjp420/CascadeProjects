/**
 * SimpleBeacon Signal Engine (Step 1).
 * SCAN → CLASSIFY → SCORE → TRIAGE → INVESTIGATE
 *
 * Does not claim a finding is a vulnerability.
 * `investigate` means: worth analyst or semantic-verifier time.
 */

const { classifyPath } = require("./path-context");

const PIPELINE = Object.freeze([
  "scan",
  "classify",
  "score",
  "triage",
  "investigate",
]);

const DECISIONS = Object.freeze({
  DISMISS: "dismiss",
  REVIEW: "review",
  INVESTIGATE: "investigate",
});

/** Dangerous sink classes that can become investigate-candidates. */
const SINK_CATEGORIES = {
  evaldanger: "evalDanger",
  "eval-danger": "evalDanger",
  innerhtmlxss: "xss",
  "inner-html-xss": "xss",
  xss: "xss",
  sqlinjection: "sqlInjection",
  "sql-injection": "sqlInjection",
  commandinjection: "commandInjection",
  "command-injection": "commandInjection",
  ssrf: "ssrf",
  pathtraversal: "pathTraversal",
  "path-traversal": "pathTraversal",
  authbypass: "authBypass",
  "auth-bypass": "authBypass",
  privilegeescalation: "privilegeEscalation",
  credentials: "credentials",
  credential: "credentials",
  sensitivedata: "credentials",
  "sensitive-data": "credentials",
  loggingsecrets: "secretLogging",
  "logging-secrets": "secretLogging",
  secretincomment: "secretLogging",
  prototypepollution: "prototypePollution",
  "prototype-pollution": "prototypePollution",
};

const NOISE_CATEGORIES = {
  todo: "todo",
  tododensity: "todo",
  llmslop: "aiSlop",
  "llm-slop": "aiSlop",
  fictionkpi: "aiSlop",
  "fiction-kpi": "aiSlop",
  euaiact: "complianceMarker",
  "eu-ai-act": "complianceMarker",
  governance: "complianceMarker",
  "governance-marker": "complianceMarker",
  i18n: "i18n",
  documentation: "docs",
  "ai-indicators": "aiSlop",
  aiindicators: "aiSlop",
};

const SINK_WEIGHT = {
  evalDanger: 92,
  commandInjection: 90,
  sqlInjection: 88,
  ssrf: 86,
  pathTraversal: 84,
  authBypass: 84,
  privilegeEscalation: 84,
  xss: 80,
  secretLogging: 78,
  credentials: 76,
  prototypePollution: 74,
};

const FILE_CLASS_MULTIPLIER = {
  app: 1,
  "http-surface": 1,
  config: 0.65,
  test: 0.12,
  docs: 0.05,
  vendor: 0.04,
  generated: 0.04,
  sample: 0.08,
  other: 0.2,
};

const NEXT_ACTION = {
  evalDanger:
    "Verify whether the evaluated value can be influenced by untrusted input and whether the code path is reachable.",
  xss: "Confirm the assigned HTML/markup is attacker-controlled and not passed through a sanitizer.",
  sqlInjection:
    "Trace the query builder and check whether user input is bound as a parameter.",
  commandInjection:
    "Confirm the spawned command interpolates untrusted strings instead of an argument array.",
  ssrf: "Check whether the request URL/host comes from user input without an allowlist.",
  pathTraversal:
    "Check whether file-path joins include user-controlled segments without canonicalization.",
  authBypass: "Confirm the route is reachable without the expected auth check.",
  privilegeEscalation:
    "Confirm a lower-privilege caller can reach a higher-privilege operation.",
  credentials:
    "Confirm the value is a live secret in production source, not a fixture or placeholder.",
  secretLogging:
    "Confirm logs can include live tokens/passwords in a production path.",
  prototypePollution:
    "Confirm untrusted keys are merged onto an object that inherits Object.prototype.",
  default:
    "Review the match in application source. Do not treat pattern severity as a confirmed vulnerability.",
};

function typeKey(finding) {
  return String(
    finding.type ||
      finding.rule ||
      finding.analyzer ||
      finding.category ||
      finding.pattern ||
      "",
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function fileClassFromPath(filePath) {
  const info = classifyPath(filePath);
  return {
    fileClass: info.fileRole || info.class || "other",
    lane: info.lane,
    reachabilityHint: info.reachabilityHint,
    reason: info.reason,
  };
}

function categoryOf(finding) {
  const key = typeKey(finding);
  if (SINK_CATEGORIES[key]) return SINK_CATEGORIES[key];
  if (NOISE_CATEGORIES[key]) return NOISE_CATEGORIES[key];
  for (const [id, name] of Object.entries(SINK_CATEGORIES)) {
    if (key.includes(id.replace(/-/g, ""))) return name;
  }
  for (const [id, name] of Object.entries(NOISE_CATEGORIES)) {
    if (key.includes(id.replace(/-/g, ""))) return name;
  }
  return "other";
}

function isNoiseCategory(category) {
  return [
    "todo",
    "aiSlop",
    "complianceMarker",
    "i18n",
    "docs",
  ].includes(category);
}

function isSinkCategory(category) {
  return Object.prototype.hasOwnProperty.call(SINK_WEIGHT, category);
}

/**
 * Score 0–100. File class and noisy categories dominate scanner severity.
 */
function scoreFinding(finding, classified) {
  const category = classified.category;
  const fileClass = classified.fileClass;
  const scannerSeverity = String(finding.severity || "medium").toLowerCase();
  const severityBoost =
    scannerSeverity === "critical"
      ? 8
      : scannerSeverity === "high"
        ? 4
        : scannerSeverity === "medium"
          ? 0
          : -6;

  if (isNoiseCategory(category)) {
    return Math.max(0, Math.round(8 + severityBoost * 0.2));
  }

  const base = SINK_WEIGHT[category] || 28;
  const multiplier = FILE_CLASS_MULTIPLIER[fileClass] ?? FILE_CLASS_MULTIPLIER.other;
  return Math.max(0, Math.min(99, Math.round(base * multiplier + severityBoost * multiplier)));
}

function triageDecision(classified) {
  const { score, category, fileClass, lane } = classified;
  if (lane === "quality" || ["test", "docs", "vendor", "generated", "sample"].includes(fileClass)) {
    return DECISIONS.DISMISS;
  }
  if (isNoiseCategory(category)) return DECISIONS.DISMISS;
  if (isSinkCategory(category) && fileClass === "app" && score >= 70) {
    return DECISIONS.INVESTIGATE;
  }
  if (fileClass === "app" && score >= 40) return DECISIONS.REVIEW;
  if (fileClass === "config" && isSinkCategory(category) && score >= 45) {
    return DECISIONS.REVIEW;
  }
  return DECISIONS.DISMISS;
}

function reasonFor(classified, decision) {
  if (decision === DECISIONS.DISMISS) {
    if (classified.fileClass === "test") {
      return "Path looks like test, E2E, or fixture material — likely not production risk.";
    }
    if (classified.fileClass === "docs") {
      return "Match is in documentation or policy text, not executable application code.";
    }
    if (classified.fileClass === "vendor" || classified.fileClass === "generated") {
      return "Match is in vendor, generated, or lockfile content.";
    }
    if (isNoiseCategory(classified.category)) {
      return "Category is a noisy marker (TODO, AI-slop, or compliance text), not a security sink.";
    }
    return "Score and file class do not justify analyst time.";
  }
  if (decision === DECISIONS.INVESTIGATE) {
    return `Application-code ${classified.category} sink — pattern match only; not a confirmed vulnerability.`;
  }
  return "Possible application-code issue; needs a human or semantic pass before contacting anyone.";
}

function nextActionFor(classified, decision) {
  if (decision === DECISIONS.DISMISS) {
    return "Do not alert. Keep in the dismissed/noise lane for audit if needed.";
  }
  return NEXT_ACTION[classified.category] || NEXT_ACTION.default;
}

function classifyFinding(finding) {
  const filePath = finding.filePath || finding.file || finding.path || "";
  const pathInfo = fileClassFromPath(filePath);
  const category = categoryOf(finding);
  const classified = {
    filePath,
    line: finding.line || finding.lineNumber || null,
    type: finding.type || finding.rule || finding.category || "finding",
    scannerSeverity: finding.severity || "medium",
    category,
    fileClass: pathInfo.fileClass,
    lane: pathInfo.lane,
    reachabilityHint: pathInfo.reachabilityHint,
    pathReason: pathInfo.reason,
    description: finding.description || finding.message || finding.impact || "",
  };
  classified.score = scoreFinding(finding, classified);
  classified.decision = triageDecision(classified);
  classified.reason = reasonFor(classified, classified.decision);
  classified.nextAction = nextActionFor(classified, classified.decision);
  return classified;
}

function triageFindings(findings) {
  const records = (findings || []).map(classifyFinding);
  const dismissed = records.filter((r) => r.decision === DECISIONS.DISMISS);
  const review = records.filter((r) => r.decision === DECISIONS.REVIEW);
  const investigate = records
    .filter((r) => r.decision === DECISIONS.INVESTIGATE)
    .sort((a, b) => b.score - a.score);
  return {
    pipeline: PIPELINE,
    scannedCount: records.length,
    dismissedCount: dismissed.length,
    reviewCount: review.length,
    investigateCount: investigate.length,
    dismissed,
    review,
    investigate,
    candidates: investigate,
  };
}

function attachSignalTriage(report, findings) {
  if (!report || typeof report !== "object") return report;
  const result = triageFindings(findings);
  report.signal = {
    pipeline: result.pipeline,
    scannedCount: result.scannedCount,
    dismissedCount: result.dismissedCount,
    reviewCount: result.reviewCount,
    investigateCount: result.investigateCount,
    investigate: result.investigate,
    candidates: result.investigate.slice(0, 10),
    note: "investigate means worth spending analyst/AI time — not a confirmed vulnerability.",
  };
  return report;
}

module.exports = {
  PIPELINE,
  DECISIONS,
  classifyFinding,
  scoreFinding,
  triageFindings,
  attachSignalTriage,
  categoryOf,
};
