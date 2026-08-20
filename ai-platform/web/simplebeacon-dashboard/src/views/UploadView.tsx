import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { navigate } from "@/router/HashRouter";

function normalizeReport(raw: any) {
  const sev = raw?.severityCounts || {};
  const totalFiles = raw?.totalFiles ?? raw?.repositoryFilesTotal ?? 0;
  const issueCount =
    raw?.issueCount ?? raw?.scan_summary?.total_risks_found ?? 0;
  const blockingCount = (sev.critical ?? 0) + (sev.high ?? 0);
  const warningCount = (sev.medium ?? 0) + (sev.low ?? 0);
  const gatePass =
    raw?.scan_summary?.status === "PASSED" && !raw?.scan_summary?.block_merge;

  return {
    totalFiles,
    issueCount,
    severityCounts: {
      critical: sev.critical ?? 0,
      high: sev.high ?? 0,
      medium: sev.medium ?? 0,
      low: sev.low ?? 0,
      info: sev.info ?? 0,
    },
    gate: {
      pass: gatePass,
      blockingCount,
      warningCount,
    },
    qualityScore: raw?.qualityScore ?? null,
    projectPath: raw?.projectRoot || raw?.scanPaths?.[0] || "",
    scanScope: {
      profile: raw?.repositoryInventory?.profile || "default",
      resultsViewScope: Array.isArray(raw?.scanPaths)
        ? raw.scanPaths.join("; ")
        : raw?.projectRoot || "",
      codeFilesAnalyzed:
        raw?.filesAnalyzed ?? raw?.ruleScopedFilesAnalyzed ?? 0,
    },
  };
}

export function UploadView() {
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (
      !file ||
      (file.type !== "application/json" && !file.name.endsWith(".json"))
    ) {
      setStatus({
        type: "error",
        message: "Please select a JSON report file.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || "{}"));
        if (raw.type !== "simplebeacon-report" && !raw.scan_summary) {
          setStatus({
            type: "error",
            message: "File does not look like a SimpleBeacon report.",
          });
          return;
        }
        const normalized = normalizeReport(raw);
        localStorage.setItem("sb_last_scan_full", JSON.stringify(normalized));
        localStorage.setItem(
          "sb_last_scan",
          JSON.stringify({
            files: normalized.totalFiles,
            issues: normalized.issueCount,
            gate: normalized.gate.pass,
          }),
        );
        localStorage.setItem(
          "sb_last_scan_time",
          raw.generatedAt || new Date().toISOString(),
        );
        setStatus({
          type: "success",
          message: `Loaded report: ${normalized.issueCount} issues, gate ${normalized.gate.pass ? "PASS" : "FAIL"}.`,
        });
        setTimeout(() => navigate("results"), 600);
      } catch (e: any) {
        setStatus({
          type: "error",
          message: e?.message || "Failed to parse JSON.",
        });
      }
    };
    reader.onerror = () =>
      setStatus({
        type: "error",
        message: "Could not read the selected file.",
      });
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Upload</h1>
        <p className="text-foreground-muted">
          Upload a SimpleBeacon scan report to view results
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Upload className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">
            Select a downloaded SimpleBeacon report JSON file
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileJson className="h-4 w-4 mr-2" /> Browse JSON Report
          </Button>
          {status.type === "error" && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" /> {status.message}
            </div>
          )}
          {status.type === "success" && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" /> {status.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
