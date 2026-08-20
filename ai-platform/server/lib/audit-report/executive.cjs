// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Executive narrative generation — deterministic summaries, readiness scoring, and AI prompt building.
 */

const constants = require("../../config/constants.cjs");
const {
  MAX_REMEDIATION_ROWS,
  buildBusinessRiskCounts,
  isPlaceholderExecutiveText,
  redactPathForDisplay,
} = require("./finding-utils.cjs");

/**
 * Calculate audit confidence.
 * @param {any} summary
 * @param {any} simplebeacon
 * @returns {any}
 */
function calculateAuditConfidence(summary, simplebeacon = {}) {
  const gate =
    simplebeacon && typeof simplebeacon === "object" ? simplebeacon : {};
  let score = 100;
  if (summary.ruleScopedFiles === 0) score -= 15;
  if (summary.gatePass == null) score -= 10;
  if (summary.codebaseHealth != null && summary.codebaseHealth < 50)
    score -= 10;
  if (summary.codebaseHealth != null && summary.codebaseHealth < 30)
    score -= 15;
  if ((summary.codeFilesAnalyzed || 0) > constants.DEFAULT_RANDOM_MAX)
    score += 5;
  const schemaChecked = gate.schemaChecked ?? 0;
  const schemaPassed = gate.schemaPassed ?? 0;
  if (schemaChecked > 0 && schemaPassed < schemaChecked) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Build executive priorities.
 * @param {any} summary
 * @returns {any}
 */
function buildExecutivePriorities(summary) {
  if (summary.gatePass === false || summary.severityCounts?.high > 0) {
    return [
      "Clear all gate-blocking findings before any production deploy",
      summary.productionFindings > 0
        ? `Remediate ${Math.min(MAX_REMEDIATION_ROWS, summary.productionFindings)} runtime-path finding(s) in Week 1`
        : "Re-run gate scan after fixes to confirm PASS before handoff",
      summary.codebaseHealth != null && summary.codebaseHealth < 90
        ? `Improve production-path hygiene from ${summary.codebaseHealth}% toward 90%+`
        : "Document allowlists for intentional test fixtures and demo data paths",
    ];
  }
  if (
    summary.dataQualityFindings > 0 &&
    summary.gatePass == null &&
    summary.productionFindings === 0
  ) {
    return [
      `Data quality scan: ${Number(summary.dataQualityFindings).toLocaleString()} finding(s) across config, privacy, and lineage`,
      summary.orphanedDataFiles > 0
        ? `Review ${Number(summary.orphanedDataFiles).toLocaleString()} orphaned data file(s) — archive or wire consumers`
        : "Align PORT/CORS_ORIGIN across .env and .env.example before onboarding new developers",
      "Run a Simplebeacon gate scan before production handoff — gate was not included in this export",
    ];
  }
  if (summary.productionFindings === 0) {
    const filesLabel =
      summary.codeFilesAnalyzed != null
        ? summary.codeFilesAnalyzed.toLocaleString()
        : "all scoped";
    return [
      `Zero production-path issues — ${filesLabel} code files analyzed under this profile`,
      summary.documentationFindings > 0
        ? `Track ${summary.documentationFindings.toLocaleString()} documentation-tier markers separately — not release blockers`
        : "Schedule quarterly complete scans before major releases",
      summary.ruleScopedFiles === 0 || summary.ruleScopedFiles == null
        ? "Configure gate rules in simplebeacon.config.json and enforce `npx simplebeacon scan --gate` in CI"
        : "Keep Simplebeacon gate in CI on every pull request",
    ];
  }
  return [
    "Keep Simplebeacon gate in CI on every pull request",
    `Remediate ${Math.min(MAX_REMEDIATION_ROWS, summary.productionFindings)} runtime-path finding(s) in Week 1 (server/ and packages/*/src/)`,
    summary.codebaseHealth != null && summary.codebaseHealth < 90
      ? `Improve codebase health from ${summary.codebaseHealth}% via targeted tech-debt reduction in production paths`
      : "Document allowlists for intentional test fixtures and demo data paths",
  ];
}

/**
 * Build launch readiness.
 * @param {any} model
 * @returns {any}
 */
function buildLaunchReadiness(model) {
  const s = model.summary;
  const sev = s.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
  const productionHigh = s.productionSeverity?.high ?? 0;
  if (s.gatePass === false || sev.high > 0) {
    return {
      label: "Not ready for production",
      tone: "blocked",
      score: Math.max(15, 40 - sev.high * 10),
    };
  }
  if (s.productionFindings > 0 || productionHigh > 0) {
    return {
      label: "Ready with conditions",
      tone: "conditional",
      score: Math.min(85, 55 + (s.codebaseHealth || 0) * 0.3),
    };
  }
  if (s.gatePass === true) {
    const docNote =
      s.documentationFindings > 0
        ? " — documentation markers tracked separately"
        : "";
    return {
      label: `Gate clear — maintain CI enforcement${docNote}`,
      tone: "ready",
      score: Math.min(98, 70 + (s.codebaseHealth || 0) * 0.25),
    };
  }
  return { label: "Review required", tone: "conditional", score: 50 };
}

/**
 * Build codebase action plan.
 * @param {any} model
 * @returns {any}
 */
function buildCodebaseActionPlan(model) {
  const prod = model.priorityFindings.filter((f) => f.tier === "production");
  const high = prod.filter((f) => f.severity === "high");
  const medium = prod.filter((f) => f.severity === "medium").slice(0, 5);

  if (!prod.length && !model.summary.codebaseFindingsDeduped) {
    return "No production-path hygiene backlog detected in analyzed code. Schedule quarterly complete scans before major releases.";
  }

  const week1 = high.length
    ? high
        .slice(0, 4)
        .map(
          (f, i) =>
            `${i + 1}. **Remediate ${f.category}** in \`${f.filePath}\`${f.line ? ` (line ${f.line})` : ""} — ${f.recommendedAction || "Review and fix before handoff"}`,
        )
    : [
        `1. **Triage ${model.summary.productionFindings} production-path marker(s)** — start with ${medium[0]?.filePath || "server/ and packages/"}`,
        "2. **Run** `npx simplebeacon scan --gate` after each fix batch",
      ];

  const week2 = [
    "1. **Reduce medium-severity debt** in server/ and packages/ (TODO/FIXME, debug artifacts)",
    "2. **Enable ESLint in CI** for packages/ and server/ if not already enforced",
    "3. **Exclude or archive** documentation-only debt markers from release-blocking criteria",
  ];

  const week3 = [
    "1. **Integrate Simplebeacon gate** on pull requests (`.github/workflows/simplebeacon-gate.yml`)",
    "2. **Sync baseline** after green test run: `npx simplebeacon baseline sync`",
    "3. **Re-run complete scan** to verify health score improvement",
  ];

  return `### Week 1 — Production-path fixes (est. 4–8 hours)

${week1.join("\n\n")}

### Week 2 — Engineering hygiene (est. 6–10 hours)

${week2.join("\n\n")}

### Week 3 — Prevention & verification (est. 3–5 hours)

${week3.join("\n\n")}

**Note:** ${model.summary.documentationFindings.toLocaleString()} documentation-tier markers are tracked separately and are not release blockers under this audit profile.`;
}

/**
 * Build complete audit prompt.
 * @param {any} model
 * @returns {any}
 */
function buildCompleteAuditPrompt(model) {
  const s = model.summary;
  return `You are writing the executive summary for a premium pre-launch codebase audit ($499 deliverable, enterprise tone). Audience: agency owner presenting to a client stakeholder.

Return STRICT JSON only (no markdown fences):
{
  "verdict": "Not ready for production | Ready with conditions | Gate clear",
  "summary": "2 professional sentences using ONLY the facts below",
  "businessImpact": "1 short paragraph on client handoff risk",
  "headline": "1 sentence priority call to action",
  "priorities": ["Concrete action using scan facts", "Second action", "Third action"]
}

FACTS (use exactly — do not invent):
Project: ${redactPathForDisplay(model.projectPath)}
Launch readiness score: ${Math.round(model.readiness.score)}/100
Gate: ${s.gatePass === true ? "PASS" : s.gatePass === false ? "FAIL" : "unknown"}
Gate issues: ${s.simplebeaconIssues} (high ${s.severityCounts.high}, medium ${s.severityCounts.medium}, low ${s.severityCounts.low})
Production-path codebase findings: ${s.productionFindings} (high ${s.codeSeverity.high}, medium ${s.codeSeverity.medium}, low ${s.codeSeverity.low})
Documentation-tier markers (non-blocking): ${s.documentationFindings}
Deduped codebase total: ${s.codebaseFindingsDeduped}${s.findingsTruncated ? ` (report cap; raw scan ${s.codebaseFindingsRaw})` : ""}
Code health: ${s.codebaseHealth ?? "—"}%
Files analyzed: ${s.codeFilesAnalyzed ?? "—"} / ${s.codeFilesDiscovered ?? "—"}
Repository files indexed: ${s.repositoryFiles ?? "—"}
Duplicate groups: ${s.duplicateGroups ?? 0}

If gate PASS with 0 gate issues, do NOT say the project is blocked. Distinguish gate findings from documentation hygiene.`;
}

/**
 * Parse ai executive.
 * @param {any} raw
 * @returns {any}
 */
function parseAiExecutive(raw) {
  const trimmed = String(raw || "").trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.summary || !parsed.headline) return null;
    return {
      verdict: parsed.verdict || null,
      intro: parsed.summary,
      businessImpact: parsed.businessImpact || "",
      headline: parsed.headline,
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.slice(0, 4)
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Merge executive summary.
 * @param {any} deterministic
 * @param {any} aiParsed
 * @returns {any}
 */
function mergeExecutiveSummary(deterministic, aiParsed) {
  if (!aiParsed) return deterministic;
  const intro = String(aiParsed.intro || "").trim();
  const businessImpact = String(aiParsed.businessImpact || "").trim();
  const headline = String(aiParsed.headline || "").trim();
  return {
    ...deterministic,
    intro:
      intro.length >= 40 && !isPlaceholderExecutiveText(intro)
        ? intro
        : deterministic.intro,
    businessImpact:
      businessImpact.length >= 40 && !isPlaceholderExecutiveText(businessImpact)
        ? businessImpact
        : deterministic.businessImpact,
    headline:
      headline.length >= 20 && !isPlaceholderExecutiveText(headline)
        ? headline
        : deterministic.headline,
  };
}

/**
 * Build deterministic executive.
 * @param {any} model
 * @returns {any}
 */
function buildDeterministicExecutive(model) {
  const s = model.summary;
  const sev = s.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };
  const gate =
    s.gatePass === true
      ? "PASS"
      : s.gatePass === false
        ? "REVIEW REQUIRED"
        : "NOT EVALUATED";
  const readiness = model.readiness;
  const tier = model.exportTier?.tier || "handoff";
  const stepKey = model.exportTier?.stepKey || s.scanKind || null;

  let headline;
  let intro;
  let businessImpact;

  if (tier === "codebase-only") {
    headline =
      s.productionFindings > 0
        ? `Prioritize ${s.productionFindings} production-path hygiene item(s) before handoff — attach gate PASS evidence separately.`
        : `Production paths are clean under configured rules (${s.codeFilesAnalyzed?.toLocaleString() ?? "—"} files deep-scanned) — pair with gate attestation for sign-off.`;
    intro = `Supplementary codebase hygiene deliverable: deep scan on ${s.codeFilesAnalyzed?.toLocaleString() ?? "—"} source files at ${s.codebaseHealth ?? "—"}% code health. Simplebeacon gate attestation was not included in this export bundle.`;
    businessImpact =
      s.productionFindings > 0
        ? "Unresolved production-path debt increases regression risk and on-call burden even when gate evidence is tracked separately."
        : "Codebase paths look clean under configured rules; residual risk is regression without automated gate enforcement between audits.";
  } else if (tier === "supplementary") {
    if (stepKey === "data-quality") {
      headline = `Data quality review: ${(s.dataQualityFindings ?? 0).toLocaleString()} finding(s) across config, privacy, and lineage — not a security gate result.`;
      intro = `Supplementary data-quality scan covering config sprawl, env keys, stale data, privacy patterns, and lineage. ${(s.dataQualityFindings ?? 0).toLocaleString()} finding(s) recorded — run Simplebeacon gate + codebase for vendor handoff.`;
      businessImpact =
        "Config and lineage hygiene reduce operational risk but do not replace gate attestation or production-path deep scan evidence.";
    } else if (stepKey === "file-reduction") {
      headline = `File reduction dry-run: ${(s.fileReductionFindings ?? 0).toLocaleString()} reclaim candidate(s) identified — review before delete.`;
      intro = `Supplementary file-reduction scan listing build artifacts, duplicate assets, unused-file candidates, and directory bloat (dry-run). Gate attestation and codebase deep scan are not included.`;
      businessImpact =
        "Disk reclamation is operational efficiency — it does not attest production security posture for client questionnaires.";
    } else if (stepKey === "consolidation") {
      headline = `Consolidation scan: ${(s.duplicateGroups ?? 0).toLocaleString()} exact duplicate JSON group(s) — merge candidates only.`;
      intro = `Supplementary data-consolidation scan for duplicate JSON groups and merge candidates. Not a compliance gate or codebase hygiene attestation.`;
      businessImpact =
        "Duplicate data groups increase maintenance cost but are separate from credential, mock-path, and fiction KPI gate rules.";
    } else if (stepKey === "roadmap") {
      headline = `Roadmap analysis: ${s.roadmapCompletion != null ? `${s.roadmapCompletion}% sprint completion` : "filesystem sprint metrics"} — engineering planning, not security attestation.`;
      intro = `Supplementary roadmap analysis from filesystem structure and sprint phase detection. Use for engineering planning — not vendor security questionnaires.`;
      businessImpact =
        "Roadmap metrics reflect detected project structure, not runtime security posture or gate compliance.";
    } else if (stepKey === "cleanup-assistant") {
      headline =
        s.cleanupSafeFiles != null
          ? `Cleanup assistant: ${Number(s.cleanupSafeFiles).toLocaleString()} files flagged tier-1 safe — dry-run delete plan only.`
          : "Cleanup assistant: tiered safe-delete plan — dry-run only, not a security attestation.";
      intro =
        "Supplementary cleanup-assistant deliverable with tiered safe-delete recommendations and agent brief export. Gate and codebase evidence are not included.";
      businessImpact =
        "Cleanup tiers reduce repository noise; they do not substitute for gate PASS or production-path audit evidence.";
    } else if (stepKey === "mock-scan") {
      headline = `Fiction and KPI digest: ${(s.fictionKpiHits ?? 0).toLocaleString()} hit(s) in repository JSON samples.`;
      intro = `Supplementary mock-data and fiction KPI digest scoped to JSON sample files — not a full gate or codebase attestation.`;
      businessImpact =
        "Fiction KPI hits in sample JSON threaten demo credibility; pair with gate scan for release evidence.";
    } else {
      headline = `${model.exportTier?.label || "Supplementary scan"} — not a standalone pre-launch security handoff.`;
      intro = `Supplementary scan deliverable (${model.exportTier?.label || "partial step"}). Run Analyze → Complete or combine gate attestation + codebase audit PDFs for vendor sign-off.`;
      businessImpact =
        "Partial scan exports support internal triage — they do not alone satisfy vendor security questionnaire requirements.";
    }
  } else if (s.gatePass === false || sev.high) {
    headline = `Release blocked: resolve ${sev.high || s.simplebeaconIssues} gate-level issue(s) before client handoff.`;
    intro = `Independent pre-launch assessment combining Simplebeacon gate analysis (${gate}), full-tree inventory, and deep codebase hygiene on ${s.codeFilesAnalyzed?.toLocaleString() ?? "—"} source files. This deliverable is scoped to configured paths and deterministic rules — not a penetration test.`;
    businessImpact =
      "Credential leaks, mock data in production paths, or fiction KPIs at this stage directly threaten client trust, incident response cost, and launch timelines.";
  } else if (s.productionFindings > 0) {
    headline = `Gate is clear. Prioritize ${s.productionFindings} production-path hygiene item(s); ${s.documentationFindings.toLocaleString()} doc-tier markers are non-blocking.`;
    intro = `Independent pre-launch assessment combining Simplebeacon gate analysis (${gate}), full-tree inventory, and deep codebase hygiene on ${s.codeFilesAnalyzed?.toLocaleString() ?? "—"} source files. This deliverable is scoped to configured paths and deterministic rules — not a penetration test.`;
    businessImpact =
      "Launch is feasible from a gate perspective, but unresolved production-path debt increases regression risk, on-call burden, and the probability of embarrassing demo data surfacing post-handoff.";
  } else {
    headline =
      tier === "gate-only"
        ? `Gate attestation: ${gate} — attach codebase deep-scan PDF for unified vendor handoff.`
        : "Gate and production paths are clean under configured rules — lock in CI enforcement before release.";
    intro =
      tier === "gate-only"
        ? `Supplementary gate attestation deliverable with Simplebeacon gate result (${gate}). Codebase deep scan was not included — export codebase hygiene separately or run Complete scan.`
        : `Independent pre-launch assessment combining Simplebeacon gate analysis (${gate}), full-tree inventory, and deep codebase hygiene on ${s.codeFilesAnalyzed?.toLocaleString() ?? "—"} source files. This deliverable is scoped to configured paths and deterministic rules — not a penetration test.`;
    businessImpact =
      tier === "gate-only"
        ? "Gate PASS attests configured rule compliance; pair with codebase audit evidence for full stakeholder sign-off."
        : "Primary residual risk is regression: without automated gate enforcement, placeholder metrics and debug artifacts can re-enter production between audits.";
  }

  return {
    verdict: readiness.label,
    intro,
    businessImpact,
    headline,
    priorities: buildExecutivePriorities(s),
  };
}

module.exports = {
  buildDeterministicExecutive,
  calculateAuditConfidence,
  buildExecutivePriorities,
  buildLaunchReadiness,
  buildCodebaseActionPlan,
  buildCompleteAuditPrompt,
  parseAiExecutive,
  mergeExecutiveSummary,
};
