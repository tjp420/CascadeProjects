import { RealtimeIssue } from './realtimeMonitor';

export interface MergedReport {
  rawIssues: RawIssue[];
  severityCounts: SeverityCounts;
  totalIssues: number;
  issueCount: number;
  gate?: GateData;
}

export interface RawIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  filePath: string;
  file: string;
  line: number;
  message: string;
  patternId: string;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface GateData {
  blockingCount: number;
  warningCount: number;
  blockingIssues: GateIssue[];
  warningIssues: GateIssue[];
}

export interface GateIssue {
  file: string;
  type: string;
  severity: string;
  line: number;
  message: string;
}

/**
 * Maps a RealtimeIssue severity to the standard report severity level.
 */
export function mapSeverity(sev: RealtimeIssue['severity']): RawIssue['severity'] {
  if (sev === 'error') return 'high';
  if (sev === 'warning') return 'medium';
  return 'low';
}

/**
 * Converts RealtimeIssue array to RawIssue array.
 */
export function convertRealtimeIssues(issues: RealtimeIssue[]): RawIssue[] {
  return issues.map((it) => ({
    type: it.type,
    severity: mapSeverity(it.severity),
    description: it.message,
    filePath: it.file,
    file: it.file,
    line: it.line,
    message: it.message,
    patternId: it.type,
  }));
}

/**
 * Calculates severity counts from a list of raw issues in a single pass.
 */
export function calcSeverityCounts(issues: RawIssue[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    if (counts[issue.severity] !== undefined) {
      counts[issue.severity]++;
    }
  }
  return counts;
}

/**
 * Builds gate data from raw issues and severity counts.
 */
export function buildGateData(rawIssues: RawIssue[], sc: SeverityCounts): GateData {
  const toGateIssue = (i: RawIssue): GateIssue => ({
    file: i.file || i.filePath || '',
    type: i.type,
    severity: i.severity,
    line: i.line || 1,
    message: i.description || i.message || '',
  });

  return {
    blockingCount: (sc.critical || 0) + (sc.high || 0),
    warningCount: (sc.medium || 0) + (sc.low || 0),
    blockingIssues: rawIssues.filter((i) => i.severity === 'critical' || i.severity === 'high').map(toGateIssue),
    warningIssues: rawIssues.filter((i) => i.severity === 'medium' || i.severity === 'low').map(toGateIssue),
  };
}

/**
 * Merges live issues into an existing report, replacing prior live issues
 * for the same files to avoid duplicates.
 */
export function mergeLiveIssues(report: MergedReport, liveIssues: RawIssue[]): MergedReport {
  report.rawIssues = report.rawIssues || [];

  const fileSet = new Set(liveIssues.map((i) => i.filePath || i.file || ''));
  report.rawIssues = report.rawIssues.filter((ri) => !fileSet.has(ri.filePath || ri.file || ''));
  report.rawIssues.push(...liveIssues);

  report.severityCounts = calcSeverityCounts(report.rawIssues);
  report.totalIssues =
    report.severityCounts.critical +
    report.severityCounts.high +
    report.severityCounts.medium +
    report.severityCounts.low;
  report.issueCount = report.totalIssues;

  report.gate = buildGateData(report.rawIssues, report.severityCounts);

  return report;
}
