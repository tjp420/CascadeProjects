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
  lines.push(paint("Simplebeacon", "cyan"));
  lines.push(
    paint(
      "48 analyzers + 25 scan engines · catch AI code debt traditional linting misses",
      "dim",
    ),
  );
  lines.push("==================");
  lines.push(`Root: ${report.projectRoot || "unknown"}`);
  if (report.repositoryFilesTotal != null) {
    lines.push(
      `Repository files: ${report.repositoryFilesTotal.toLocaleString()}`,
    );
  }
  lines.push(
    `Gate rules checked: ${report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? report.totalFiles ?? 0} files`,
  );
  if (report.mockSampleFiles != null) {
    lines.push(`Mock/sample files: ${report.mockSampleFiles}`);
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
    lines.push(`Quality score: ${qs}/100`);
  }
  lines.push("");

  // Remove free tier limitations
  // if (!isPaid) {
  //     lines.push(paint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow'));
  //     lines.push(paint('  FREE TIER — showing first 5 findings only', 'yellow'));
  //     lines.push(paint('  Upgrade: https://simplebeacon.ai/pricing', 'yellow'));
  //     lines.push(paint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow'));
  //     lines.push('');
  // }

  const counts = report.severityCounts || {};
  lines.push(
    `${paint("Critical", "red")}: ${counts.critical || 0}  ` +
      `${paint("High", "red")}: ${counts.high || 0}  ` +
      `${paint("Medium", "yellow")}: ${counts.medium || 0}  ` +
      `${paint("Low", "dim")}: ${counts.low || 0}`,
  );
  if (report.productionLeakScanned != null) {
    lines.push(
      `Production files scanned: ${report.productionLeakScanned} (${report.productionLeakFindings || 0} leak(s))`,
    );
  }
  if (report.credentialScanned != null) {
    lines.push(
      `Credential files scanned: ${report.credentialScanned} (${report.credentialFindings || 0} finding(s))`,
    );
  }
  if (report.jestBaselineChecked) {
    lines.push(
      `Jest baseline: ${report.jestBaselinePassed ? paint("PASS", "green") : paint("FAIL", "red")}`,
    );
  }
  lines.push("");

  if (gateResult) {
    lines.push(
      gateResult.pass
        ? paint("Gate: PASS", "green")
        : paint("Gate: FAIL", "red"),
    );
    lines.push("");
  }

  const issues = enrichFindingsWithAlerts(report.rawIssues || []);
  if (issues.length === 0) {
    lines.push(paint("No issues detected.", "green"));
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
    lines.push(paint("Top Remediation Actions (do these first):", "cyan"));
    for (const [idx, issue] of prioritized.entries()) {
      const action = remediationText(issue);
      const title = alertTitle(issue);
      const label = title ? `${issue.type} → ${title}` : issue.type;
      lines.push(
        `  ${idx + 1}. ${paint(`[${String(issue.severity || "low").toUpperCase()}]`, severityColor(issue.severity))} ${label}: ${action}`,
      );
      const steps = alertRemediationSteps(issue);
      if (steps.length > 0) {
        for (const [stepIdx, step] of steps.entries()) {
          lines.push(`     ${stepIdx + 1}. ${step}`);
        }
      }
    }
    lines.push("");
  }

  const displayLimit = 1000;
  const buckets = ["critical", "high", "medium", "low", "info"];
  const grouped = new Map(buckets.map((key) => [key, []]));
  for (const issue of sortedIssues.slice(0, displayLimit)) {
    const sev = grouped.has(issue.severity) ? issue.severity : "info";
    grouped.get(sev).push(issue);
  }

  lines.push("Issues by severity:");
  for (const sev of buckets) {
    const list = grouped.get(sev);
    if (!list || list.length === 0) continue;
    lines.push(
      `  ${paint(sev.toUpperCase(), severityColor(sev))} (${list.length})`,
    );
    for (const issue of list) {
      const title = alertTitle(issue);
      const label = title
        ? `${issue.type}: ${title} — ${issue.description}`
        : `${issue.type}: ${issue.description}`;
      lines.push(`    - ${label}`);
      const action = remediationText(issue);
      if (action) {
        lines.push(`      Fix: ${action}`);
      }
      const steps = alertRemediationSteps(issue);
      if (steps.length > 0) {
        lines.push(`      Steps:`);
        for (const [stepIdx, step] of steps.entries()) {
          lines.push(`        ${stepIdx + 1}. ${step}`);
        }
      }
      if (issue.alertTemplate?.cwe) {
        lines.push(`      CWE: ${issue.alertTemplate.cwe}`);
      }
    }
  }

  const hiddenCount = issues.length - displayLimit;
  if (hiddenCount > 0) {
    lines.push(`  ... and ${hiddenCount} more`);
  }

  return lines.join("\n");
}

function formatActionPlanReport(report, gateResult = null) {
  const lines = [];
  lines.push(paint("Simplebeacon Action Plan", "cyan"));
  lines.push("========================");
  lines.push(`Root: ${report.projectRoot || "unknown"}`);
  lines.push(
    `Quality score: ${report.qualityScore ?? (report.qualityScorecard ? Math.round(Object.values(report.qualityScorecard).reduce((a, b) => a + (Number(b) || 0), 0) / Math.max(Object.keys(report.qualityScorecard).length, 1)) : 0)}/100`,
  );
  lines.push("");

  if (gateResult) {
    lines.push(
      gateResult.pass
        ? paint("Gate: PASS", "green")
        : paint("Gate: FAIL", "red"),
    );
    lines.push("");
  }

  const counts = report.severityCounts || {};
  lines.push("Severity counts:");
  lines.push(`  ${paint("Critical", "red")}: ${counts.critical || 0}`);
  lines.push(`  ${paint("High", "red")}: ${counts.high || 0}`);
  lines.push(`  ${paint("Medium", "yellow")}: ${counts.medium || 0}`);
  lines.push(`  ${paint("Low", "dim")}: ${counts.low || 0}`);
  lines.push("");

  const issues = report.rawIssues || [];
  if (issues.length === 0) {
    lines.push(paint("No issues detected. No action required.", "green"));
    return lines.join("\n");
  }

  const guideIds = collectActiveGuideIds(issues, null).filter(
    (id) => id !== "ci-integration" && id !== "roadmap",
  );

  if (guideIds.length === 0) {
    lines.push(
      paint(
        "No prioritized action items — scan is clean under configured paths.",
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
  lines.push(paint("Prioritized Remediation", "cyan"));
  lines.push("");

  for (const id of orderedIds) {
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
    lines.push(
      `${paint(`[${guide.difficulty}]`, diffColor)} ${guide.title}${count > 1 ? ` (${count} findings)` : ""}`,
    );
    lines.push(`  Time: ${guide.timeRequired}`);
    lines.push(`  Impact: ${guide.whyItMatters}`);
    lines.push("  Steps:");
    for (const step of guide.steps) {
      lines.push(`    • ${step}`);
    }
    lines.push(`  Verify: ${guide.verify}`);
    lines.push("");
  }

  const hours = Math.max(1, Math.round(totalMinutes / 60));
  lines.push(`Estimated total effort: ~${hours} hour${hours === 1 ? "" : "s"}`);
  lines.push(
    paint("Run `npx simplebeacon scan --gate` after fixes to verify.", "green"),
  );

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
