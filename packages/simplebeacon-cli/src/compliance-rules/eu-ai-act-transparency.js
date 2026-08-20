// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
module.exports = function evaluateEuAiActTransparency(rule, { report }) {
  const summary = report.euAiActSummary;
  if (report.euAiActScanned == null && !summary) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "skip",
      evidence: "EU AI Act scan not run — enable eu-ai-act-patterns rule",
    };
  }
  const gaps = summary?.transparencyGaps ?? 0;
  const aiHits = summary?.aiSystemIndicators ?? 0;
  if (aiHits === 0 && gaps === 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "pass",
      evidence: "No generative AI integrations detected in user-facing paths",
    };
  }
  const ok = gaps === 0;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: ok ? "pass" : "fail",
    evidence: ok
      ? `${aiHits} AI integration(s) with Article 50 disclosure markers present`
      : `${gaps} transparency gap(s) — add AI-generated / AI interaction disclosure in UI`,
  };
};
