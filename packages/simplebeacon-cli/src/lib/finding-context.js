const { classifyPath } = require("./path-context");
const { getStandardsForFinding } = require("./standards-map");

function issueDedupeKey(issue) {
  return [
    issue.id || "",
    issue.filePath || issue.file || "",
    issue.line || "",
    issue.description || issue.message || "",
  ].join("|");
}

function enrichIssueContext(issue) {
  if (!issue || typeof issue !== "object") return issue;
  const filePath = issue.filePath || issue.file || issue.path || "";
  const pathInfo = classifyPath(filePath);
  const standards = getStandardsForFinding(issue);
  return {
    ...issue,
    lane: pathInfo.lane,
    pathClass: pathInfo.class,
    fileRole: pathInfo.fileRole,
    pathContextReason: pathInfo.reason,
    reachabilityHint: pathInfo.reachabilityHint,
    cwe: standards.cwe,
    cweTitle: standards.cweTitle,
    owasp: standards.owasp,
    asvs: standards.asvs,
    standards: {
      cwe: standards.cwe,
      cweTitle: standards.cweTitle,
      owasp: standards.owasp,
      asvs: standards.asvs,
      ruleId: standards.ruleId,
    },
  };
}

function partitionByLane(issues) {
  const production = [];
  const quality = [];
  const seen = new Set();
  for (const raw of issues || []) {
    const issue = enrichIssueContext(raw);
    const key = issueDedupeKey(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    if (issue.lane === "quality") quality.push(issue);
    else production.push(issue);
  }
  return { production, quality };
}

module.exports = {
  enrichIssueContext,
  partitionByLane,
};
