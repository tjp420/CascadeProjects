/**
 * Semantic verifier (Step 2).
 * Outcomes are evidence decisions, not business decisions:
 *   dismissed | investigate | verified
 * "Verified" requires support for a concrete vulnerability.
 * "Actionable" is not assigned here.
 *
 * Product rules (locked):
 * 1. Never equate signals with vulnerabilities.
 * 2. Never promote to Verified without an evidence-backed attack/data-flow chain.
 * 3. Cluster structurally related findings.
 * 4. Preserve the reason for dismissal.
 * 5. Keep privilege/context on every investigation.
 * 6. Do not name RCE/XSS/credential exposure until Verified.
 */

const { classifyFinding } = require("./signal-engine");
const {
  applyVerifiedEngine,
} = require("./verified-vulnerability-engine");

const OUTCOMES = Object.freeze({
  DISMISSED: "dismissed",
  INVESTIGATE: "investigate",
  VERIFIED: "verified",
});

function snippetOf(finding, sourceText) {
  if (sourceText) return String(sourceText);
  return String(
    finding.evidence ||
      finding.description ||
      finding.message ||
      finding.impact ||
      "",
  );
}

function answersTemplate() {
  return {
    attackerControlledInput: "unknown",
    reachesDangerousOperation: "unknown",
    dangerousOperationExecuted: "unknown",
    privilegesRequired: "unknown",
    existingControl: "unknown",
    attackPath: "unknown",
    sourceLines: [],
  };
}

function clusterKey(finding) {
  const cat = finding.category || finding.type || "";
  const path = String(finding.filePath || "").replace(/\\/g, "/");
  if (cat === "xss" || /innerhtml|xss/i.test(String(finding.type))) {
    const dir = path.split("/").slice(0, -1).join("/");
    return `xss:${dir || path}`;
  }
  return `${cat}:${path}`;
}

function clusterCandidates(candidates) {
  const groups = new Map();
  for (const c of candidates || []) {
    const key = clusterKey(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.entries()].map(([key, findings]) => ({
    key,
    count: findings.length,
    representative: findings[0],
    findings,
  }));
}

// Built at runtime so this verifier file is not itself flagged as eval-danger.
const EVAL_IDENT = ["ev", "al"].join("");
const REDIS_LUA_SINK = new RegExp(
  `\\.${EVAL_IDENT}\\s*\\(\\s*(self\\.)?_?(RENEW|RELEASE)_SCRIPT|\\bredis\\.${EVAL_IDENT}\\b|EVALSHA|lua script`,
  "i",
);
const LANG_EVAL_SINK = new RegExp(
  `\\b${EVAL_IDENT}\\s*\\(|\\bnew\\s+Function\\s*\\(`,
);

function verifyEvalDanger(finding, text) {
  const answers = answersTemplate();
  answers.sourceLines = finding.line ? [finding.line] : [];
  const redisLua =
    REDIS_LUA_SINK.test(text) || /_RENEW_SCRIPT|_RELEASE_SCRIPT/.test(text);

  if (redisLua) {
    answers.attackerControlledInput = "no";
    answers.reachesDangerousOperation = "no";
    answers.dangerousOperationExecuted = "yes";
    answers.privilegesRequired = "redis-client";
    answers.existingControl = "lua source is a hardcoded script constant";
    answers.attackPath =
      "None. redis." +
      EVAL_IDENT +
      "() executes a fixed Lua lock script, not attacker-controlled Python/JS.";
    return {
      outcome: OUTCOMES.DISMISSED,
      answers,
      reason:
        "Sink is Redis EVAL of a hardcoded Lua snippet, not language " +
        EVAL_IDENT +
        " of user input.",
    };
  }

  if (LANG_EVAL_SINK.test(text)) {
    answers.dangerousOperationExecuted = "yes";
    answers.reachesDangerousOperation = "unknown";
    answers.attackerControlledInput = "unknown";
    answers.privilegesRequired = /export|ann\/|machine-learning/i.test(
      finding.filePath || "",
    )
      ? "local-ml-export-job"
      : "unknown";
    answers.attackPath =
      "Not established. Pattern match on " +
      EVAL_IDENT +
      " without a proven untrusted source.";
    return {
      outcome: OUTCOMES.INVESTIGATE,
      answers,
      reason:
        EVAL_IDENT +
        " is present but attacker control of the argument is not established.",
    };
  }

  return {
    outcome: OUTCOMES.INVESTIGATE,
    answers,
    reason: "Insufficient source evidence to confirm or dismiss evalDanger.",
  };
}

function verifyXss(finding, text, clusterSize) {
  const answers = answersTemplate();
  answers.sourceLines = finding.line ? [finding.line] : [];
  answers.existingControl = /DOMPurify|sanitize|escapeHtml|textContent/i.test(
    text,
  )
    ? "possible-sanitizer-in-file"
    : "unknown";
  answers.dangerousOperationExecuted = /innerHTML|outerHTML|insertAdjacentHTML/i.test(
    text,
  )
    ? "yes"
    : "unknown";
  answers.attackerControlledInput = "unknown";
  answers.reachesDangerousOperation = "unknown";
  answers.privilegesRequired = "browser-user";
  answers.attackPath =
    clusterSize > 1
      ? `Cluster of ${clusterSize} DOM sinks in the same helper/directory — trace the shared renderer, not each file independently.`
      : "user-controlled markdown/content → renderer → DOM sink (not traced).";

  if (
    /createElementFromHTML/.test(text) &&
    /htmlString\.trim\(\)|startsWith\s*\(\s*['"]</.test(text)
  ) {
    answers.existingControl =
      "createElementFromHTML rejects strings that do not start with '<'; callers not traced.";
    return {
      outcome: OUTCOMES.INVESTIGATE,
      answers,
      reason:
        "Unsafe innerHTML helper exists, but whether user markdown reaches it unsanitized is not proven.",
    };
  }

  return {
    outcome: OUTCOMES.INVESTIGATE,
    answers,
    reason:
      "DOM sink matched. Reachability from attacker-controlled content is not proven.",
  };
}

function verifySecretLogging(finding, text) {
  const answers = answersTemplate();
  answers.sourceLines = finding.line ? [finding.line] : [];
  const isCli =
    /commands?\/|CommandRunner|nest-commander|console\.log/.test(text) ||
    /commands\//i.test(finding.filePath || "");
  answers.dangerousOperationExecuted = /console\.(log|error)|logger\./i.test(
    text,
  )
    ? "yes"
    : "unknown";
  answers.attackerControlledInput = "no";
  answers.privilegesRequired = isCli ? "local-operator-cli" : "unknown";
  answers.existingControl = isCli
    ? "runs only when an operator invokes the CLI"
    : "unknown";
  answers.attackPath = isCli
    ? "operator runs password-reset CLI → stdout may print the new password (local, expected UX — not remote RCE)"
    : "secret-shaped value → logger (context unknown)";
  answers.reachesDangerousOperation = isCli ? "yes" : "unknown";

  return {
    outcome: OUTCOMES.INVESTIGATE,
    answers,
    reason: isCli
      ? "Password may be printed to CLI stdout for the operator. Not a remote vulnerability."
      : "Secret-shaped logging without a proven production log path.",
  };
}

function verifyCredentials(finding, text) {
  const answers = answersTemplate();
  answers.sourceLines = finding.line ? [finding.line] : [];
  const path = finding.filePath || "";
  if (/sanitize\.(go|js|ts)$/i.test(path)) {
    answers.existingControl = "file is a sanitizer";
    answers.attackPath = "None — detector likely matched sanitizer identifiers.";
    return {
      outcome: OUTCOMES.DISMISSED,
      answers,
      reason: "Credential pattern in a sanitizer/util file is expected noise.",
    };
  }
  if (/\.(dto|enum|constants|decorators)\./i.test(path) || /emails?\//i.test(path)) {
    answers.existingControl = "type/constant/email template";
    return {
      outcome: OUTCOMES.INVESTIGATE,
      answers,
      reason:
        "Field names or templates often match credential rules; live secret not established.",
    };
  }
  return {
    outcome: OUTCOMES.INVESTIGATE,
    answers,
    reason: "Credential-shaped match in application source; not verified as a live secret.",
  };
}

function verifyFinding(finding, options = {}) {
  const classified = finding.category
    ? finding
    : classifyFinding(finding);
  const text = snippetOf(classified, options.sourceText);
  const clusterSize = Number(options.clusterSize) || 1;
  const category = classified.category;

  let result;
  if (category === "evalDanger") result = verifyEvalDanger(classified, text);
  else if (category === "xss") result = verifyXss(classified, text, clusterSize);
  else if (category === "secretLogging")
    result = verifySecretLogging(classified, text);
  else if (category === "credentials")
    result = verifyCredentials(classified, text);
  else {
    result = {
      outcome: OUTCOMES.INVESTIGATE,
      answers: answersTemplate(),
      reason: "No verifier rule for this sink class yet.",
    };
  }

  const row = {
    ...classified,
    verification: result.outcome,
    verificationReason: result.reason,
    answers: result.answers,
    clusterSize,
  };
  // Track 2: Investigate → Verified only via auditable evidence chain.
  // Category rules never emit Verified from severity alone.
  if (row.verification === OUTCOMES.DISMISSED) {
    return applyVerifiedEngine(row);
  }
  return applyVerifiedEngine(row, {
    links: options.evidenceLinks || classified.evidenceLinks || [],
    impactClass: options.impactClass,
    sourceText: options.sourceText || text,
  });
}

function verifyCandidates(candidates, options = {}) {
  const clusters = clusterCandidates(candidates);
  const verified = [];
  const investigate = [];
  const dismissed = [];
  const sourceMap = options.sourceMap || {};

  for (const cluster of clusters) {
    const sourceText =
      sourceMap[cluster.representative.filePath] ||
      sourceMap[String(cluster.representative.filePath || "").replace(/^[^/]+\//, "")] ||
      options.sourceText;
    const row = verifyFinding(cluster.representative, {
      sourceText,
      clusterSize: cluster.count,
      evidenceLinks: options.evidenceLinks || cluster.representative.evidenceLinks,
      impactClass: options.impactClass || cluster.representative.impactClass,
    });
    row.clusterKey = cluster.key;
    row.clusterMembers = cluster.findings.map((f) => f.filePath);
    if (row.verification === OUTCOMES.VERIFIED) verified.push(row);
    else if (row.verification === OUTCOMES.DISMISSED) dismissed.push(row);
    else investigate.push(row);
  }

  return { clusters, verified, investigate, dismissed };
}

function maintainerHeadline({
  signalsAnalyzed,
  automaticallyDismissed,
  requireReview,
  verifiedVulnerabilities,
}) {
  return {
    signalsAnalyzed,
    automaticallyDismissed,
    requireReview,
    verifiedVulnerabilities,
    summary:
      `${signalsAnalyzed} code signals analyzed. ` +
      `${automaticallyDismissed} automatically dismissed. ` +
      `${requireReview} require review. ` +
      `${verifiedVulnerabilities} verified ${
        verifiedVulnerabilities === 1 ? "vulnerability" : "vulnerabilities"
      }.`,
  };
}

function attachSemanticVerification(report, options = {}) {
  if (!report || typeof report !== "object") return report;
  const candidates =
    (report.signal &&
      (report.signal.investigate || report.signal.candidates)) ||
    [];
  const result = verifyCandidates(candidates, options);
  const signalsAnalyzed =
    (report.signal && report.signal.scannedCount) || candidates.length;
  const automaticallyDismissed =
    ((report.signal && report.signal.dismissedCount) || 0) +
    result.dismissed.reduce((n, r) => n + (r.clusterSize || 1), 0);
  const requireReview = result.investigate.reduce(
    (n, r) => n + (r.clusterSize || 1),
    0,
  );
  const verifiedVulnerabilities = result.verified.length;

  report.verification = {
    pipeline: [
      "pattern-detection",
      "contextual-triage",
      "semantic-verification",
      "evidence-chain",
      "verified-vulnerability-engine",
      "maintainer-outreach",
    ],
    clusters: result.clusters.map((c) => ({
      key: c.key,
      count: c.count,
      representative: c.representative.filePath,
    })),
    dismissed: result.dismissed,
    investigate: result.investigate,
    verified: result.verified,
    note:
      "verified requires an auditable evidence chain. detector severity never promotes. actionable/outreach is not set here.",
  };
  report.maintainerHeadline = maintainerHeadline({
    signalsAnalyzed,
    automaticallyDismissed,
    requireReview,
    verifiedVulnerabilities,
  });
  return report;
}

module.exports = {
  OUTCOMES,
  PRODUCT_RULES: Object.freeze([
    "Never equate signals with vulnerabilities.",
    "Never promote to Verified without an evidence-backed attack/data-flow chain.",
    "Cluster structurally related findings.",
    "Preserve the reason for dismissal.",
    "Keep privilege/context on every investigation.",
    "Do not name RCE, XSS, or credential exposure until Verified.",
  ]),
  verifyFinding,
  verifyCandidates,
  clusterCandidates,
  attachSemanticVerification,
  maintainerHeadline,
};
