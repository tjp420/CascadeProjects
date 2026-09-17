import { resolveEvidenceState } from "./evidence-state.ts";

export const LAST_SCAN_REPORT_KEY = "sb_last_scan_report";
export const LAST_SCAN_FULL_KEY = "sb_last_scan_full";
export const LAST_SCAN_SUMMARY_KEY = "sb_last_scan";

export type LocalScanHistoryRow = {
  id: string;
  projectName: string;
  timestamp: string | null;
  issueCount: number | null;
  blockingCount: number | null;
  signalsAnalyzed: number | null;
  automaticallyDismissed: number | null;
  requireReview: number | null;
  verifiedVulnerabilities: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseLocalJson(key: string): unknown {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function mapSnapshotToHistoryRow(
  snapshot: unknown,
): LocalScanHistoryRow | null {
  const root = asRecord(snapshot);
  if (!root) return null;
  const gate = asRecord(root.gate);
  const headline = (() => {
    try {
      return resolveEvidenceState(root).headline;
    } catch {
      return {
        signalsAnalyzed: 0,
        automaticallyDismissed: 0,
        requireReview: 0,
        verifiedVulnerabilities: 0,
        summary: "",
      };
    }
  })();
  const projectName = String(
    root.projectName || root.projectRoot || root.projectPath || "",
  ).trim();
  const timestamp = String(
    root.generatedAt || root.timestamp || root.scannedAt || "",
  ).trim();
  const issueCount = Number(root.issueCount ?? root.issues);
  const blockingCount = Number(
    gate?.blockingCount ?? root.blockingCount,
  );
  return {
    id: timestamp || projectName || "sb_last_scan_report",
    projectName: projectName || "Local scan",
    timestamp: timestamp || null,
    issueCount: Number.isFinite(issueCount) ? issueCount : null,
    blockingCount: Number.isFinite(blockingCount) ? blockingCount : null,
    signalsAnalyzed: headline.signalsAnalyzed,
    automaticallyDismissed: headline.automaticallyDismissed,
    requireReview: headline.requireReview,
    verifiedVulnerabilities: headline.verifiedVulnerabilities,
  };
}

/**
 * Read the single most recent browser-local snapshot.
 * Uses simplebeacon-storage / large-items via getLargeItem("sb_last_scan_report").
 * Does not open a second database or create a history object store.
 */
async function readSnapshotCandidates(): Promise<unknown[]> {
  const out: unknown[] = [];
  try {
    const { getLargeItem } = await import("../utils/dbStorage.ts");
    out.push(await getLargeItem(LAST_SCAN_REPORT_KEY));
  } catch {
    /* ignore */
  }
  out.push(parseLocalJson(LAST_SCAN_FULL_KEY));
  out.push(parseLocalJson(LAST_SCAN_REPORT_KEY));
  out.push(parseLocalJson(LAST_SCAN_SUMMARY_KEY));
  return out.filter((item) => item != null);
}

export async function getLocalScanHistory(): Promise<LocalScanHistoryRow[]> {
  try {
    for (const snapshot of await readSnapshotCandidates()) {
      const row = mapSnapshotToHistoryRow(snapshot);
      if (row) return [row];
    }
    return [];
  } catch {
    return [];
  }
}

export const getHistory = getLocalScanHistory;

/**
 * Return the raw stored last-scan snapshot (unmapped) or null.
 * Side-effect free read: attempts `getLargeItem` then localStorage fallbacks.
 */
export async function getRawLastScan(): Promise<unknown | null> {
  try {
    const candidates = await readSnapshotCandidates();
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

export function humanizeTimestamp(ts: string | null): string {
  if (!ts) return "time unknown";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}
