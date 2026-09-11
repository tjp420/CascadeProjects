/**
 * Contact-grade finding validation.
 * Scan volume is not the product. Interrupt-worthy findings are.
 *
 * SCAN → FILTER → UNDERSTAND → VERIFY → RANK → CONTACT
 */

const { classifyPath } = require("./path-context");
const { enrichIssueContext } = require("./finding-context");
const { classifyFinding, DECISIONS } = require("./signal-engine");

const CONSEQUENTIAL_SINKS = {
  evaldanger: {
    title: "Potential remote code execution",
    why: "User-influenced data may reach an eval() or equivalent sink.",
    exploitability: "high",
    fix: "Remove eval(); parse with json.loads / ast.literal_eval, or a dedicated interpreter with no dynamic execution.",
  },
  "eval-danger": {
    title: "Potential remote code execution",
    why: "User-influenced data may reach an eval() or equivalent sink.",
    exploitability: "high",
    fix: "Remove eval(); parse with json.loads / ast.literal_eval, or a dedicated interpreter with no dynamic execution.",
  },
  innerhtmlxss: {
    title: "Potential cross-site scripting",
    why: "Markup is assigned via innerHTML or equivalent without sanitization.",
    exploitability: "medium",
    fix: "Use textContent or a vetted sanitizer; never assign untrusted HTML.",
  },
  "inner-html-xss": {
    title: "Potential cross-site scripting",
    why: "Markup is assigned via innerHTML or equivalent without sanitization.",
    exploitability: "medium",
    fix: "Use textContent or a vetted sanitizer; never assign untrusted HTML.",
  },
  commandinjection: {
    title: "Potential command injection",
    why: "A shell or process spawn may concatenate untrusted input.",
    exploitability: "high",
    fix: "Use argument arrays; never interpolate untrusted strings into a shell command.",
  },
  sqlinjection: {
    title: "Potential SQL injection",
    why: "A query appears to concatenate untrusted input.",
    exploitability: "high",
    fix: "Use parameterized queries or an ORM bind API.",
  },
  prototypepollution: {
    title: "Potential prototype pollution",
    why: "Object merge/assign of untrusted keys can pollute Object.prototype.",
    exploitability: "medium",
    fix: "Reject __proto__ / constructor keys; use Object.create(null) maps or a safe merge.",
  },
  "prototype-pollution": {
    title: "Potential prototype pollution",
    why: "Object merge/assign of untrusted keys can pollute Object.prototype.",
    exploitability: "medium",
    fix: "Reject __proto__ / constructor keys; use Object.create(null) maps or a safe merge.",
  },
  sensitivedata: {
    title: "Potential secret or credential in source",
    why: "A high-entropy or credential-shaped value appears in application source.",
    exploitability: "high",
    fix: "Move the secret to an environment variable or secret manager and rotate it.",
  },
  "sensitive-data": {
    title: "Potential secret or credential in source",
    why: "A high-entropy or credential-shaped value appears in application source.",
    exploitability: "high",
    fix: "Move the secret to an environment variable or secret manager and rotate it.",
  },
  credential: {
    title: "Potential secret or credential in source",
    why: "A credential pattern was matched in application source.",
    exploitability: "high",
    fix: "Move the secret to an environment variable or secret manager and rotate it.",
  },
};

const NOISE_ROLES = new Set([
  "docs",
  "vendor",
  "generated",
  "test",
  "sample",
]);

const SEVERITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function typeKey(issue) {
  return String(issue.type || issue.id || issue.pattern || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function sinkMeta(issue) {
  const key = typeKey(issue);
  if (CONSEQUENTIAL_SINKS[key]) return CONSEQUENTIAL_SINKS[key];
  for (const [id, meta] of Object.entries(CONSEQUENTIAL_SINKS)) {
    if (key.includes(id.replace(/-/g, ""))) return meta;
  }
  return null;
}

function hasLocation(issue) {
  const file = issue.filePath || issue.file || issue.path;
  const line = issue.line || issue.lineNumber;
  return Boolean(file) && line !== undefined && line !== null && line !== "";
}

function reachabilityLabel(hint) {
  if (hint === "http-surface-path") return "Likely";
  if (hint === "non-runtime") return "Unknown";
  return "Unknown";
}

function attackPath(pathInfo, issue) {
  const file = issue.filePath || issue.file || "";
  if (pathInfo.reachabilityHint === "http-surface-path") {
    return `HTTP/WebSocket surface → ${file} → matched sink`;
  }
  if (pathInfo.fileRole === "app") {
    return `Application source → ${file} → matched sink (caller not proven)`;
  }
  return "No production attack path established";
}

/**
 * Five commercial questions. All must be true to interrupt a maintainer.
 */
function evaluateFiveQuestions(issue, pathInfo) {
  const sink = sinkMeta(issue);
  const severity = String(issue.severity || "").toLowerCase();
  const isHigh = severity === "high" || severity === "critical";
  const relevant =
    pathInfo.lane === "production" &&
    (pathInfo.fileRole === "app" || pathInfo.class === "http-surface");
  const notNoise = !NOISE_ROLES.has(pathInfo.fileRole);

  const real = Boolean(sink) && hasLocation(issue) && notNoise;
  const actionable = Boolean(sink && sink.fix);
  const consequential = Boolean(sink) && isHigh && pathInfo.fileRole === "app";
  const interrupt =
    real &&
    relevant &&
    actionable &&
    consequential &&
    pathInfo.reachabilityHint !== "non-runtime";

  return {
    real,
    relevant,
    actionable,
    consequential,
    interrupt,
    checks: {
      notTestCode: pathInfo.fileRole !== "test",
      notDocumentation: pathInfo.fileRole !== "docs",
      notVendorCode: pathInfo.fileRole !== "vendor" && pathInfo.fileRole !== "generated",
      productionSource: pathInfo.fileRole === "app",
      sinkKnown: Boolean(sink),
      hasFileAndLine: hasLocation(issue),
      highOrCritical: isHigh,
    },
  };
}

function confidencePercent(questions, pathInfo) {
  const checks = Object.values(questions.checks);
  const passed = checks.filter(Boolean).length;
  let score = Math.round((passed / checks.length) * 100);
  if (pathInfo.reachabilityHint === "http-surface-path") score = Math.min(95, score + 8);
  if (pathInfo.reachabilityHint === "unknown") score = Math.max(0, score - 12);
  if (!questions.interrupt) score = Math.min(score, 55);
  return score;
}

function toVerifiedFinding(raw) {
  const issue = enrichIssueContext(raw);
  const filePath = issue.filePath || issue.file || issue.path || "";
  const pathInfo = classifyPath(filePath);
  const questions = evaluateFiveQuestions(issue, pathInfo);
  const sink = sinkMeta(issue);
  const confidence = confidencePercent(questions, pathInfo);
  const signal = classifyFinding(issue);
  const interruptWorthy =
    signal.decision === DECISIONS.INVESTIGATE &&
    questions.interrupt &&
    confidence >= 70;

  return {
    title: sink ? sink.title : "Unverified pattern match",
    type: issue.type || "unknown",
    severity: issue.severity || "medium",
    filePath,
    line: issue.line || issue.lineNumber || null,
    whyThisMatters: sink ? sink.why : "Pattern matched; not validated as exploitable.",
    attackPath: attackPath(pathInfo, issue),
    reachability: reachabilityLabel(pathInfo.reachabilityHint),
    exploitability: sink && interruptWorthy ? sink.exploitability : "low",
    evidence: issue.description || issue.message || issue.match || "",
    falsePositiveChecks: questions.checks,
    recommendedFix: sink ? sink.fix : "No contact-grade fix until the sink is confirmed in application source.",
    nextAction: signal.nextAction,
    triage: signal.decision,
    signalScore: signal.score,
    signalReason: signal.reason,
    confidence,
    interruptWorthy,
    questions,
    fileRole: pathInfo.fileRole,
    lane: pathInfo.lane,
    pathContextReason: pathInfo.reason,
  };
}

function rankScore(finding) {
  const sev = SEVERITY_WEIGHT[String(finding.severity).toLowerCase()] || 0;
  const reach = finding.reachability === "Likely" ? 20 : 0;
  const interrupt = finding.interruptWorthy ? 40 : 0;
  return interrupt + reach + sev * 10 + finding.confidence;
}

/**
 * FILTER → VERIFY → RANK. Returns at most `max` interrupt-worthy findings.
 * Non-interrupt findings are omitted from the contact list on purpose.
 */
function selectVerifiedFindings(issues, options = {}) {
  const max = Number.isFinite(options.max) ? options.max : 10;
  const evaluated = (issues || []).map(toVerifiedFinding);
  const contact = evaluated
    .filter((f) => f.interruptWorthy)
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, max);
  return {
    pipeline: ["scan", "filter", "understand", "verify", "rank", "contact"],
    scannedCount: (issues || []).length,
    filteredOutCount: evaluated.filter((f) => !f.interruptWorthy).length,
    verifiedCount: contact.length,
    findings: contact,
  };
}

function attachVerifiedFindings(report, issues, options = {}) {
  if (!report || typeof report !== "object") return report;
  const selected = selectVerifiedFindings(issues, options);
  report.verifiedFindings = selected.findings;
  report.contactGrade = {
    pipeline: selected.pipeline,
    scannedCount: selected.scannedCount,
    filteredOutCount: selected.filteredOutCount,
    verifiedCount: selected.verifiedCount,
    emailReady: selected.verifiedCount > 0,
    benchmark:
      "Ship 3–10 interrupt-worthy findings, not hundreds of pattern matches.",
  };
  return report;
}

function formatVerifiedFindingMarkdown(finding) {
  if (!finding) return "";
  const checks = finding.falsePositiveChecks || {};
  const mark = (ok) => (ok ? "✓" : "✗");
  return [
    `### Verified Finding`,
    `**${finding.title}**`,
    `\`${finding.filePath}:${finding.line}\``,
    ``,
    `**Why this matters:**`,
    finding.whyThisMatters,
    ``,
    `**Attack path:**`,
    finding.attackPath,
    ``,
    `**Reachability:** ${finding.reachability}`,
    `**Exploitability:** ${finding.exploitability}`,
    ``,
    `**Evidence:**`,
    finding.evidence,
    ``,
    `**False-positive checks:**`,
    `${mark(checks.notTestCode)} Not test code`,
    `${mark(checks.notDocumentation)} Not documentation`,
    `${mark(checks.notVendorCode)} Not vendor code`,
    `${mark(checks.productionSource)} Production source`,
    `${mark(checks.hasFileAndLine)} File and line present`,
    `${mark(checks.sinkKnown)} Known exploitable sink class`,
    ``,
    `**Recommended fix:**`,
    finding.recommendedFix,
    ``,
    `**Confidence:** ${finding.confidence}%`,
  ].join("\n");
}

module.exports = {
  CONSEQUENTIAL_SINKS,
  evaluateFiveQuestions,
  toVerifiedFinding,
  selectVerifiedFindings,
  attachVerifiedFindings,
  formatVerifiedFindingMarkdown,
};
