/**
 * Evidence-state presentation for scan reports.
 * Hierarchy: Evidence → explanation → context → severity.
 * Signals ≠ vulnerabilities. Verified is an evidence decision.
 */

export type EvidenceHeadline = {
  signalsAnalyzed: number;
  automaticallyDismissed: number;
  requireReview: number;
  verifiedVulnerabilities: number;
  summary: string;
};

export type InvestigationCard = {
  filePath: string;
  line: string | number | null;
  type: string;
  triage: string;
  verification: "dismissed" | "investigate" | "verified" | "unknown";
  reason: string;
  nextAction: string;
  privileges?: string;
  clusterSize?: number;
  /** Detector severity — never the primary label. */
  detectorSeverity?: string;
};

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatEvidenceHeadline(input: {
  signalsAnalyzed: number;
  automaticallyDismissed: number;
  requireReview: number;
  verifiedVulnerabilities: number;
}): EvidenceHeadline {
  const signalsAnalyzed = Math.max(0, asNumber(input.signalsAnalyzed));
  const automaticallyDismissed = Math.max(
    0,
    asNumber(input.automaticallyDismissed),
  );
  const requireReview = Math.max(0, asNumber(input.requireReview));
  const verifiedVulnerabilities = Math.max(
    0,
    asNumber(input.verifiedVulnerabilities),
  );
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

function mapCard(
  row: any,
  verification: InvestigationCard["verification"],
): InvestigationCard {
  return {
    filePath: String(row.filePath || row.file || ""),
    line: row.line ?? null,
    type: String(row.type || row.category || "finding"),
    triage: String(row.triage || verification),
    verification,
    reason: String(
      row.verificationReason ||
        row.signalReason ||
        row.whyThisMatters ||
        row.reason ||
        "",
    ),
    nextAction: String(row.nextAction || row.recommendedFix || ""),
    privileges: row.answers?.privilegesRequired,
    clusterSize: row.clusterSize || 1,
    detectorSeverity: String(
      row.scannerSeverity || row.severity || row.detectorSeverity || "",
    ).toLowerCase() || undefined,
  };
}

/**
 * Prefer report.maintainerHeadline / report.verification when present.
 * Never invent verified vulnerabilities from raw severity counts.
 */
export function resolveEvidenceState(report: any): {
  headline: EvidenceHeadline;
  investigations: InvestigationCard[];
  dismissals: InvestigationCard[];
  pipeline: string[];
} {
  const pipeline = Array.isArray(report?.verification?.pipeline)
    ? report.verification.pipeline
    : Array.isArray(report?.signal?.pipeline)
      ? report.signal.pipeline
      : [
          "pattern-detection",
          "contextual-triage",
          "semantic-verification",
          "evidence",
          "maintainer-outreach",
        ];

  const dismissals = collectDismissals(report);
  const investigations = collectInvestigations(report);

  if (report?.maintainerHeadline?.summary) {
    const h = report.maintainerHeadline;
    return {
      headline: formatEvidenceHeadline({
        signalsAnalyzed: h.signalsAnalyzed,
        automaticallyDismissed: h.automaticallyDismissed,
        requireReview: h.requireReview,
        verifiedVulnerabilities: h.verifiedVulnerabilities ?? 0,
      }),
      investigations,
      dismissals,
      pipeline,
    };
  }

  const signalsAnalyzed = asNumber(
    report?.signal?.scannedCount ??
      report?.summary?.rawFindingCount ??
      report?.rawIssues?.length ??
      report?.issueCount ??
      0,
  );
  const noise = asNumber(
    report?.signal?.dismissedCount ??
      report?.summary?.noiseFindingCount ??
      report?.qualityIssues?.length ??
      0,
  );
  const reviewFromSignal = asNumber(
    report?.signal?.investigateCount ??
      report?.verification?.investigate?.length ??
      0,
  );
  const verified = asNumber(
    report?.verification?.verified?.length ??
      report?.maintainerHeadline?.verifiedVulnerabilities ??
      0,
  );
  const requireReview =
    reviewFromSignal ||
    asNumber(report?.contactGrade?.verifiedCount) ||
    Math.max(0, signalsAnalyzed - noise - verified);

  return {
    headline: formatEvidenceHeadline({
      signalsAnalyzed,
      automaticallyDismissed: noise,
      requireReview,
      verifiedVulnerabilities: verified,
    }),
    investigations,
    dismissals,
    pipeline,
  };
}

function collectDismissals(report: any): InvestigationCard[] {
  const fromVerification = Array.isArray(report?.verification?.dismissed)
    ? report.verification.dismissed
    : [];
  return fromVerification.map((row: any) => mapCard(row, "dismissed"));
}

function collectInvestigations(report: any): InvestigationCard[] {
  const fromVerification = Array.isArray(report?.verification?.investigate)
    ? report.verification.investigate
    : [];
  if (fromVerification.length) {
    return fromVerification.map((row: any) => mapCard(row, "investigate"));
  }

  const fromSignal = Array.isArray(report?.signal?.investigate)
    ? report.signal.investigate
    : Array.isArray(report?.verifiedFindings)
      ? report.verifiedFindings
      : [];

  return fromSignal.slice(0, 40).map((row: any) => {
    const v =
      row.verification === "verified" || row.verification === "dismissed"
        ? row.verification
        : "investigate";
    return mapCard(row, v);
  });
}
