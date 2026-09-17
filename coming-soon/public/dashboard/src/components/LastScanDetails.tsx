import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { humanizeTimestamp } from "@/lib/scan-history";

export default function LastScanDetails({
  snapshot,
  onClose,
}: {
  snapshot: any;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try { prev?.focus(); } catch {}
    };
  }, [onClose]);

  const downloadJson = () => {
    try {
      const data = JSON.stringify(snapshot ?? {}, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = snapshot?.generatedAt || snapshot?.timestamp || snapshot?.scannedAt || new Date().toISOString();
      const nameStamp = String(stamp).replace(/[:\s]/g, "-");
      a.download = `last-scan-${nameStamp}.json`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // best-effort
    }
  };

  const when = humanizeTimestamp(snapshot?.generatedAt || snapshot?.timestamp || snapshot?.scannedAt || null);

  const sev = snapshot?.severityCounts || {};
  const sample = (snapshot?.rawIssues || snapshot?.issues || []).slice(0, 3).map((i: any) => i.filePath || i.path || i.location || i.name || JSON.stringify(i));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="last-scan-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div ref={dialogRef} className="relative z-50 max-w-2xl w-full">
        <Card>
          <CardHeader>
            <CardTitle id="last-scan-title">Last Scan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <strong>Project:</strong> {snapshot?.projectName || "Local scan"}
              </div>
              <div>
                <strong>When:</strong> {when}
              </div>
              <div>
                <strong>Findings:</strong> {snapshot?.issueCount ?? snapshot?.issues?.length ?? "—"}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><strong>Critical:</strong> {sev.critical ?? 0}</div>
                <div><strong>High:</strong> {sev.high ?? 0}</div>
                <div><strong>Medium:</strong> {sev.medium ?? 0}</div>
                <div><strong>Low:</strong> {sev.low ?? 0}</div>
                <div><strong>Info:</strong> {sev.info ?? 0}</div>
              </div>
              <div>
                <strong>Sample files:</strong>
                <ul className="list-disc ml-4">
                  {sample.length ? sample.map((s: any, idx: number) => (
                    <li key={idx} className="text-sm break-all">{s}</li>
                  )) : <li className="text-sm text-muted-foreground">No samples</li>}
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button ref={closeRef as any} onClick={onClose}>Close</Button>
                <Button onClick={downloadJson}>Export JSON</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
