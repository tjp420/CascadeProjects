/** Pull operator-facing findings from nested scan payloads (complete scan, GitHub clone). */

export type AuditIssue = {
  severity: string;
  type: string;
  description: string;
  filePath: string;
  line: string | number;
  count: number;
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
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
    severity: String(issue.severity || issue.severityBand || "medium"),
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
    return out.length >= max;
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
      if (push(item)) return;
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
      if (out.length >= max) return;
    }
  };

  walk(root, 0);
  if (out.length === 0) {
    for (const item of takeIssues(root, ["qualityIssues"])) {
      if (push(item)) break;
    }
  }
  return out;
}
