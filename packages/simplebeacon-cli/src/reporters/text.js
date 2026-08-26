/**
 * Text reporter for simplebeacon scan results.
 */

const {
  GUIDE_PLAYBOOKS,
  issueKind,
  collectActiveGuideIds,
} = require("./remediation-guides");
const { enrichFindingsWithAlerts } = require("./alert-templates");

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function colorEnabled() {
  if (process.env.NO_COLOR != null) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  return process.stdout.isTTY === true;
}

function paint(text, color) {
  if (!colorEnabled()) return text;
  return `${COLORS[color] || ""}${text}${COLORS.reset}`;
}

function severityColor(severity) {
  if (severity === "critical") return "red";
  if (severity === "high") return "red";
  if (severity === "medium") return "yellow";
  return "dim";
}

function severityRank(severity) {
  const map = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  return Object.prototype.hasOwnProperty.call(map, severity)
    ? map[severity]
    : 5;
}

function remediationText(issue) {
  if (issue.alertTemplate?.immediateAction)
    return issue.alertTemplate.immediateAction;
  return (issue.suggestion || issue.fix || issue.remediation || "").trim();
}

function alertTitle(issue) {
  return issue.alertTemplate?.title || "";
}

function alertRemediationSteps(issue) {
  if (!issue.alertTemplate?.remediationSteps) return [];
  return issue.alertTemplate.remediationSteps;
}

function formatTextReport(report, gateResult = null) {
  const { detectTier } = require("../lib/tier-detector");
  const _tierInfo = detectTier();

  const lines = [];
  lines.push(paint("SimpleBeacon", "cyan"));
  lines.push(
    paint(
      "Code quality & security scanner — finds issues AI tools and linters miss",
      "dim",
    ),
  );
  lines.push("==================");
  lines.push(`Project: ${report.projectRoot || "unknown"}`);
  if (report.repositoryFilesTotal != null) {
    lines.push(
      `Files in repo: ${report.repositoryFilesTotal.toLocaleString()}`,
    );
  }
  lines.push(
    `Files analyzed: ${(report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? report.totalFiles ?? 0).toLocaleString()}`,
  );
  if (report.mockSampleFiles != null) {
    lines.push(`Test/sample files: ${report.mockSampleFiles}`);
  }
  // Show quality score for paid users; hide for free tier
  if (report.qualityScoreHidden) {
    lines.push(`Quality score: (upgrade to view)`);
  } else {
    const qs =
      report.qualityScore ??
      (report.qualityScorecard
        ? Math.round(
            Object.values(report.qualityScorecard).reduce(
              (a, b) => a + (Number(b) || 0),
              0,
            ) / Math.max(Object.keys(report.qualityScorecard).length, 1),
          )
        : 0);
    const grade = qs >= 90 ? "A" : qs >= 80 ? "B" : qs >= 70 ? "C" : qs >= 60 ? "D" : "F";
    lines.push(`Quality score: ${qs}/100 (grade: ${grade})`);
  }
  lines.push("");

  const counts = report.severityCounts || {};
  const totalIssues = (counts.critical || 0) + (counts.high || 0) + (counts.medium || 0) + (counts.low || 0);

  // Plain-English summary
  if (totalIssues === 0) {
    lines.push(paint("✓ All clear — no issues found in scanned files.", "green"));
  } else {
    const parts = [];
    if (counts.critical) parts.push(`${counts.critical} critical (${counts.critical === 1 ? "fix immediately" : "fix immediately"})`);
    if (counts.high) parts.push(`${counts.high} high (${counts.high === 1 ? "fix before release" : "fix before release"})`);
    if (counts.medium) parts.push(`${counts.medium} medium (${counts.medium === 1 ? "review soon" : "review soon"})`);
    if (counts.low) parts.push(`${counts.low} low (${counts.low === 1 ? "cleanup when convenient" : "cleanup when convenient"})`);
    lines.push(`Found ${totalIssues} ${totalIssues === 1 ? "issue" : "issues"}: ${parts.join(", ")}`);
  }
  lines.push("");

  if (gateResult) {
    if (gateResult.pass) {
      lines.push(paint("✓ GATE PASSED — safe to merge or deploy", "green"));
    } else {
      lines.push(paint("✗ GATE FAILED — fix blocking issues before merging", "red"));
      if (gateResult.blockingCount) {
        lines.push(paint(`  ${gateResult.blockingCount} ${gateResult.blockingCount === 1 ? "issue is" : "issues are"} blocking the gate`, "red"));
      }
    }
    lines.push("");
  }

  const issues = enrichFindingsWithAlerts(report.rawIssues || []);
  if (issues.length === 0) {
    lines.push(paint("No issues detected. Your code looks clean!", "green"));
    return lines.join("\n");
  }

  const sortedIssues = [...issues].sort((a, b) => {
    const sevDelta = severityRank(a.severity) - severityRank(b.severity);
    if (sevDelta !== 0) return sevDelta;
    const aHasFix = remediationText(a).length > 0;
    const bHasFix = remediationText(b).length > 0;
    if (aHasFix !== bHasFix) return aHasFix ? -1 : 1;
    return String(a.type || "").localeCompare(String(b.type || ""));
  });

  const prioritized = sortedIssues
    .filter((issue) => remediationText(issue).length > 0)
    .slice(0, 8);

  if (prioritized.length > 0) {
    lines.push(paint("What to fix first (prioritized by impact):", "cyan"));
    lines.push("");
    for (const [idx, issue] of prioritized.entries()) {
      const action = remediationText(issue);
      const title = alertTitle(issue);
      const label = title ? `${issue.type} → ${title}` : issue.type;
      const sevLabel = String(issue.severity || "low").toUpperCase();
      lines.push(
        `  ${idx + 1}. ${paint(`[${sevLabel}]`, severityColor(issue.severity))} ${label}`,
      );
      lines.push(paint(`     → ${action}`, "dim"));
      const steps = alertRemediationSteps(issue);
      if (steps.length > 0) {
        for (const [stepIdx, step] of steps.entries()) {
          lines.push(paint(`     ${stepIdx + 1}. ${step}`, "dim"));
        }
      }
    }
    lines.push("");
  }

  const displayLimit = 1000;
  const buckets = ["critical", "high", "medium", "low", "info"];
  const bucketLabels = {
    critical: "🔴 Critical — must fix before release",
    high: "🟠 High — blocking issues, fix before merge",
    medium: "🟡 Medium — review and fix when possible",
    low: "🔵 Low — minor cleanup, no rush",
    info: "ℹ️  Info — for your awareness",
  };
  const grouped = new Map(buckets.map((key) => [key, []]));
  for (const issue of sortedIssues.slice(0, displayLimit)) {
    const sev = grouped.has(issue.severity) ? issue.severity : "info";
    grouped.get(sev).push(issue);
  }

  lines.push("All findings:");
  for (const sev of buckets) {
    const list = grouped.get(sev);
    if (!list || list.length === 0) continue;
    lines.push("");
    lines.push(`  ${paint(bucketLabels[sev] || sev, severityColor(sev))} (${list.length})`);
    for (const issue of list) {
      const title = alertTitle(issue);
      const label = title
        ? `${issue.type}: ${title}`
        : `${issue.type}`;
      const file = issue.filePath || issue.file || "—";
      lines.push(`    • ${label}`);
      lines.push(paint(`      in: ${file}${issue.line ? ` (line ${issue.line})` : ""}`, "dim"));
      if (issue.description && issue.description !== label) {
        lines.push(paint(`      what: ${issue.description}`, "dim"));
      }
      const action = remediationText(issue);
      if (action) {
        lines.push(paint(`      fix: ${action}`, "green"));
      }
      const steps = alertRemediationSteps(issue);
      if (steps.length > 0) {
        for (const [stepIdx, step] of steps.entries()) {
          lines.push(paint(`        ${stepIdx + 1}. ${step}`, "dim"));
        }
      }
      if (issue.alertTemplate?.cwe) {
        lines.push(paint(`      ref: ${issue.alertTemplate.cwe}`, "dim"));
      }
    }
  }

  const hiddenCount = issues.length - displayLimit;
  if (hiddenCount > 0) {
    lines.push(`  ... and ${hiddenCount} more (use --format json for full details)`);
  }

  return lines.join("\n");
}

function formatActionPlanReport(report, gateResult = null) {
  const lines = [];
  lines.push(paint("Simplebeacon Action Plan", "cyan"));
  lines.push("========================");
  lines.push(`Project: ${report.projectRoot || "unknown"}`);
  const qs = report.qualityScore ?? (report.qualityScorecard ? Math.round(Object.values(report.qualityScorecard).reduce((a, b) => a + (Number(b) || 0), 0) / Math.max(Object.keys(report.qualityScorecard).length, 1)) : 0);
  const grade = qs >= 90 ? "A" : qs >= 80 ? "B" : qs >= 70 ? "C" : qs >= 60 ? "D" : "F";
  lines.push(`Quality score: ${qs}/100 (grade: ${grade})`);
  lines.push("");

  if (gateResult) {
    if (gateResult.pass) {
      lines.push(paint("✓ Gate passed — your code is ready to ship", "green"));
    } else {
      lines.push(paint("✗ Gate failed — fix the issues below before shipping", "red"));
    }
    lines.push("");
  }

  const counts = report.severityCounts || {};
  const totalIssues = (counts.critical || 0) + (counts.high || 0) + (counts.medium || 0) + (counts.low || 0);
  lines.push(`Issue summary (${totalIssues} total):`);
  lines.push(`  ${paint("Critical", "red")}: ${counts.critical || 0} — must fix before release`);
  lines.push(`  ${paint("High", "red")}: ${counts.high || 0} — fix before merging`);
  lines.push(`  ${paint("Medium", "yellow")}: ${counts.medium || 0} — review and fix soon`);
  lines.push(`  ${paint("Low", "dim")}: ${counts.low || 0} — minor cleanup`);
  lines.push("");

  const issues = report.rawIssues || [];
  if (issues.length === 0) {
    lines.push(paint("✓ No issues found — nothing to fix. Great work!", "green"));
    return lines.join("\n");
  }

  const guideIds = collectActiveGuideIds(issues, null).filter(
    (id) => id !== "ci-integration" && id !== "roadmap",
  );

  if (guideIds.length === 0) {
    lines.push(
      paint(
        "No prioritized fixes needed — your scan is clean.",
        "green",
      ),
    );
    return lines.join("\n");
  }

  const kindCounts = {};
  for (const issue of issues) {
    const kind = issueKind(issue);
    if (GUIDE_PLAYBOOKS[kind]) {
      kindCounts[kind] = (kindCounts[kind] || 0) + (issue.count || 1);
    }
  }

  const orderedIds = [
    "credentials",
    "production-leak",
    "npm-audit",
    "fiction-kpi",
    "schema",
    "roadmap",
    "ci-integration",
  ].filter((id) => guideIds.includes(id));

  const ESTIMATES = {
    credentials: 45,
    "production-leak": 60,
    "fiction-kpi": 35,
    schema: 30,
    "npm-audit": 20,
    roadmap: 10,
  };

  let totalMinutes = 0;
  lines.push(paint("Fix these issues (in order of priority):", "cyan"));
  lines.push("");

  for (const [idx, id] of orderedIds.entries()) {
    const guide = GUIDE_PLAYBOOKS[id];
    const count = kindCounts[id] || 0;
    const est = ESTIMATES[id] || 30;
    totalMinutes += est;
    const diffColor =
      guide.difficulty === "Easy"
        ? "green"
        : guide.difficulty === "Moderate"
          ? "yellow"
          : "red";
    lines.push(paint(`${idx + 1}. ${guide.title}${count > 1 ? ` (${count} findings)` : ""}`, "cyan"));
    lines.push(`   ${paint(`[${guide.difficulty}]`, diffColor)} · ~${guide.timeRequired} · ${count} finding${count === 1 ? "" : "s"}`);
    lines.push(paint(`   Why it matters: ${guide.whyItMatters}`, "dim"));
    lines.push("   How to fix:");
    for (const step of guide.steps) {
      lines.push(paint(`     • ${step}`, "dim"));
    }
    lines.push(paint(`   Verify: ${guide.verify}`, "green"));
    lines.push("");
  }

  const hours = Math.max(1, Math.round(totalMinutes / 60));
  lines.push(paint(`Estimated total effort: ~${hours} hour${hours === 1 ? "" : "s"}`, "cyan"));
  lines.push("");
  lines.push(
    paint("After fixing, run: npx simplebeacon scan --gate", "green"),
  );
  lines.push(paint("This will verify your fixes pass the quality gate.", "dim"));

  return lines.join("\n");
}

const REFERRAL_NUDGE_INNER_WIDTH = 72;

function truncateToWidth(text, maxWidth) {
  const value = String(text || "");
  if (value.length <= maxWidth) return value;
  if (maxWidth <= 1) return value.slice(0, maxWidth);
  return `${value.slice(0, maxWidth - 1)}…`;
}

function boxLinePlain(text) {
  const visible = truncateToWidth(text, REFERRAL_NUDGE_INNER_WIDTH);
  return `│ ${visible.padEnd(REFERRAL_NUDGE_INNER_WIDTH)} │`;
}

function boxLineColored(text, color) {
  const visible = truncateToWidth(text, REFERRAL_NUDGE_INNER_WIDTH);
  const padding = " ".repeat(
    Math.max(0, REFERRAL_NUDGE_INNER_WIDTH - visible.length),
  );
  if (!colorEnabled()) return boxLinePlain(text);
  return `│ ${paint(visible, color)}${padding} │`;
}

function formatReferralNudgeBanner(context = {}) {
  const shareUrl = String(
    context.shareUrl || "https://simplebeacon.ai/",
  ).trim();
  const lines = [
    "🎉 Scan Passed! Help secure the engineering ecosystem.",
    "",
    "Share SimpleBeacon with your network and earn $50 server credits.",
    `Link: ${shareUrl}`,
    "",
    "Run 'simplebeacon refer --link' to manage or extract tracking codes.",
  ];

  if (!context.personalized) {
    lines.splice(
      4,
      0,
      "Tip: set SIMPLEBEACON_REFERRER_EMAIL for your personal tracking link.",
    );
  } else if (context.partnerCode) {
    lines.splice(4, 0, `Partner code: ${context.partnerCode}`);
  }

  const horiz = "─".repeat(REFERRAL_NUDGE_INNER_WIDTH + 2);
  const top = paint(`┌${horiz}┐`, "cyan");
  const bottom = paint(`└${horiz}┘`, "cyan");
  const body = lines.map((line, index) =>
    index === 0 ? boxLineColored(line, "green") : boxLinePlain(line),
  );

  return [top, ...body, bottom].join("\n");
}

module.exports = {
  formatTextReport,
  formatActionPlanReport,
  formatReferralNudgeBanner,
  paint,
  colorEnabled,
};
