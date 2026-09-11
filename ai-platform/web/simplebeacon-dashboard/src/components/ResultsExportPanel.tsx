import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  buildExecutiveBriefModel,
  renderExecutiveBriefMarkdown,
  downloadBrowserFile,
} from "@/lib/executive-brief";

interface Props {
  fullReport: any;
  result?: any;
}

export function ResultsExportPanel({ fullReport, result }: Props) {
  const exportData = fullReport || result;

  const clientName =
    result?.projectPath?.split(/[\\/]/).filter(Boolean).pop() || "project";

  const handleDownload = (format: "json" | "md") => {
    if (!exportData) return;
    // Zero-mutation: operate on a shallow clone only for naming/metadata
    const model = buildExecutiveBriefModel(exportData, { client: clientName });

    if (format === "json") {
      const filename = `simplebeacon-executive-${Date.now()}.json`;
      downloadBrowserFile(filename, `${JSON.stringify(model, null, 2)}\n`, "application/json");
      toast.success(`Executive brief JSON (${model.findings.length} findings)`);
      return;
    }

    const md = renderExecutiveBriefMarkdown(exportData, { client: clientName });
    const filename = `simplebeacon-executive-${Date.now()}.md`;
    downloadBrowserFile(filename, md, "text/markdown;charset=utf-8");
    toast.success("Executive brief markdown downloaded");
  };

  return (
    <div className="flex gap-2 items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDownload("json")}
      >
        <Download className="h-4 w-4" /> Executive JSON
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDownload("md")}
      >
        <Download className="h-4 w-4" /> Executive MD
      </Button>
    </div>
  );
}

export default ResultsExportPanel;
