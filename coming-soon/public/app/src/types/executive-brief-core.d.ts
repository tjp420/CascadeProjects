declare module "@sb/executive-brief-core" {
  export function buildExecutiveBriefModel(
    report: object,
    options?: object,
    hooks?: { classifyFinding?: (f: object) => object },
  ): {
    reportSchemaVersion: string;
    projectPath: string;
    projectLabel: string;
    qualityScore: number | null;
    repositoryFilesTotal: number | null;
    gate: {
      pass: boolean;
      blockingCount: number | null;
      warningCount: number | null;
    } | null;
    signal: {
      pipeline?: string[] | null;
      scannedCount?: number | null;
      dismissedCount?: number | null;
      reviewCount?: number | null;
      investigateCount?: number | null;
      note?: string | null;
    } | null;
    summary: {
      totalFindings: number;
      byDecision: Record<string, number>;
      byLane: Record<string, number>;
    };
    findings: Array<Record<string, unknown>>;
  };
  export function normalizePosixPath(value: unknown): string;
  export function projectExecutiveFinding(source: object): Record<string, unknown>;
}
