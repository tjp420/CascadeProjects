/** Pull operator-facing findings from nested scan payloads (complete scan, GitHub clone). */

export type AuditIssue = {
  severity: string;
  type: string;
  description: string;
  filePath: string;
  line: string | number;
  count: number;
};

const SEVERITY_ORDER = [
  "critical",
  "high",
  "low",
  "medium",
  "info",
] as const;

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSeverity(value: unknown): string {
  const sev = String(value || "medium").toLowerCase().trim();
  if (
    sev === "critical" ||
    sev === "high" ||
    sev === "medium" ||
    sev === "low" ||
    sev === "info"
  ) {
    return sev;
  }
  if (sev === "error" || sev === "fatal") return "critical";
  if (sev === "warn" || sev === "warning") return "medium";
  return "medium";
}

function normalizeIssue(issue: any): AuditIssue | null {
  if (!issue || typeof issue !== "object") return null;
  const description = String(
    issue.description || issue.message || issue.summary || "",
  ).trim();
  const type = String(
    issue.type || issue.category || issue.rule || issue.pattern || "finding",
  );
  const filePath = String(
    issue.filePath || issue.file || issue.path || issue.relativePath || "",
  );
  if (!description && !filePath) return null;
  return {
    severity: normalizeSeverity(issue.severity || issue.severityBand),
    type,
    description: description || type,
    filePath: filePath || "—",
    line: issue.line ?? issue.lineNumber ?? "—",
    count: Number(issue.count) || 1,
  };
}

function takeIssues(node: any, keys: string[]): any[] {
  if (!node || typeof node !== "object") return [];
  for (const key of keys) {
    const arr = asArray(node[key]);
    if (arr.length && typeof arr[0] === "object") return arr;
  }
  return [];
}

/**
 * Cap findings for browser storage without drowning Critical/Low under Medium flood.
 * Round-robins critical → high → low → medium → info so every band present in the
 * scan keeps representation in the Results table filters.
 */
export function selectIssuesForBrowserStorage<T extends { severity?: string }>(
  issues: T[],
  max = 50,
): T[] {
  if (!Array.isArray(issues) || issues.length === 0) return [];
  if (issues.length <= max) return issues.slice();

  const buckets: Record<string, T[]> = {
    critical: [],
    high: [],
    low: [],
    medium: [],
    info: [],
  };
  for (const issue of issues) {
    const sev = normalizeSeverity(issue?.severity);
    (buckets[sev] || buckets.medium).push(issue);
  }

  const queues = SEVERITY_ORDER.map((sev) => buckets[sev].slice());
  const picked: T[] = [];
  while (picked.length < max) {
    let progressed = false;
    for (const queue of queues) {
      if (picked.length >= max) break;
      if (queue.length) {
        picked.push(queue.shift() as T);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return picked;
}

export function countIssuesBySeverity(
  issues: Array<{ severity?: string; count?: number }>,
): Record<"critical" | "high" | "medium" | "low" | "info", number> {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const issue of issues || []) {
    const sev = normalizeSeverity(issue?.severity) as keyof typeof counts;
    const n = Number(issue?.count) || 1;
    if (counts[sev] !== undefined) counts[sev] += n;
  }
  return counts;
}

/**
 * Walk complete-scan / simplebeacon wrappers until an issue list is found.
 */
export function collectScanIssues(root: unknown, max = 200): AuditIssue[] {
  if (!root || typeof root !== "object") return [];
  const out: AuditIssue[] = [];
  const seen = new Set<string>();
  const visited = new Set<any>();

  const push = (raw: any) => {
    const issue = normalizeIssue(raw);
    if (!issue) return false;
    const key = `${issue.severity}|${issue.type}|${issue.filePath}|${issue.line}|${issue.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    out.push(issue);
    return false;
  };

  const walk = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 5) return;
    if (visited.has(node)) return;
    visited.add(node);
    for (const item of takeIssues(node, [
      "rawIssues",
      "detectedIssues",
      "issues",
      "findings",
    ])) {
      push(item);
    }
    const nested = [
      node.simplebeacon,
      node.results?.simplebeacon,
      node.completeScan,
      node.report,
      node.reportJson,
      node.results?.codebase,
      node.codebase,
    ];
    for (const child of nested) {
      walk(child, depth + 1);
    }
  };

  walk(root, 0);
  if (out.length === 0) {
    for (const item of takeIssues(root, ["qualityIssues"])) {
      push(item);
    }
  }

  // Prefer high-signal severities before applying the hard cap.
  return selectIssuesForBrowserStorage(out, max);
}
