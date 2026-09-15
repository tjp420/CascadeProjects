/**
 * Browser helpers for executive brief download.
 * Model selection lives in @sb/executive-brief-core (CLI source of truth).
 * Markdown rendering stays lightweight here — no secret file contents.
 */

import { buildExecutiveBriefModel as buildModel } from "@sb/executive-brief-core";

export function buildExecutiveBriefModel(report: any, options: any = {}) {
  return buildModel(report, options, {});
}

export function renderExecutiveBriefMarkdown(
  report: any,
  options: any = {},
): string {
  const model = buildExecutiveBriefModel(report, options);
  const gate = model.gate;
  const failed = gate ? gate.pass === false : model.findings.length > 0;
  const lines: string[] = [
    "# SimpleBeacon Executive Brief",
    "",
    `**Status:** ${failed ? "FAILED / MERGE BLOCKED" : "GATE PASS"}`,
    `**Project:** ${model.projectLabel}`,
  ];
  if (model.projectPath !== "" && model.projectPath != null) {
    lines.push(`**Scan root:** ${model.projectPath}`);
  }
  if (model.repositoryFilesTotal != null) {
    lines.push(`**Files in this scan:** ${model.repositoryFilesTotal}`);
  }
  if (model.qualityScore != null) {
    lines.push(`**Code health score:** ${model.qualityScore}/100`);
  }
  if (model.signal) {
    lines.push(
      `**Signal triage:** investigate ${model.signal.investigateCount ?? 0}, review ${model.signal.reviewCount ?? 0}, dismissed ${model.signal.dismissedCount ?? 0}`,
    );
  }
  lines.push("");
  lines.push(
    "Executive set excludes `decision=dismiss` when `report.signal` is present, and prefers production `lane` / non-test `fileClass`. Paths are POSIX-normalized; `projectPath` is preserved. No file contents are embedded.",
  );
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  if (!model.findings.length) {
    lines.push("_No non-dismissed production-path findings in this extract._");
    lines.push("");
  } else {
    model.findings.slice(0, 40).forEach((f: any, i: number) => {
      const loc = f.line ? `${f.filePath}:${f.line}` : f.filePath || "(no path)";
      lines.push(`### Finding ${i + 1}: ${f.type}`);
      lines.push("");
      lines.push(`* **Location:** \`${loc}\``);
      lines.push(`* **Severity:** ${f.severity}`);
      if (f.decision) lines.push(`* **Decision:** ${f.decision}`);
      if (f.lane) lines.push(`* **Lane:** ${f.lane}`);
      if (f.fileClass) lines.push(`* **File class:** ${f.fileClass}`);
      if (f.score != null) lines.push(`* **Score:** ${f.score}`);
      if (f.nextAction) lines.push(`* **Next action:** ${f.nextAction}`);
      lines.push(`* **Note:** ${f.description || f.type}`);
      lines.push("");
    });
  }
  return `${lines.join("\n").trim()}\n`;
}

export function isIdeEmbeddedDownload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (typeof (window as any).acquireVsCodeApi === "function") return true;
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("sb_parent_urlbar") ||
      params.get("sb_notify_base") ||
      params.get("sb_api_base") ||
      params.get("sb_website_mode")
    ) {
      return true;
    }
    if (typeof sessionStorage !== "undefined") {
      if (
        sessionStorage.getItem("sb_notify_base") ||
        sessionStorage.getItem("sb_api_base")
      ) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    return window.self !== window.top;
  } catch {
    return false;
  }
}

function postIdeDownloadFile(
  filename: string,
  mimeType: string,
  base64: string,
) {
  const msg = {
    command: "downloadFile",
    filename,
    mimeType,
    base64,
  };
  try {
    const vscode = (window as any).acquireVsCodeApi?.();
    if (vscode) {
      vscode.postMessage(msg);
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, "*");
    }
  } catch {
    /* ignore */
  }
}

export function downloadBrowserBlob(blob: Blob, filename: string): void {
  if (isIdeEmbeddedDownload()) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIdx = result.indexOf(",");
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      postIdeDownloadFile(
        filename,
        blob.type || "application/octet-stream",
        base64,
      );
    };
    reader.readAsDataURL(blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadBrowserFile(
  filename: string,
  content: string | Blob,
  mimeType = "application/octet-stream",
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  downloadBrowserBlob(blob, filename);
}
