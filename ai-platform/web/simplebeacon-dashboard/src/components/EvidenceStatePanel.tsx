import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Search, CheckCircle2, Ban } from "lucide-react";
import {
  resolveEvidenceState,
  type InvestigationCard,
} from "@/lib/evidence-state";

function Metric({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: number;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 text-center ${
        emphasize ? "border-foreground/40 bg-muted/40" : ""
      }`}
    >
      <div
        className={`font-semibold tabular-nums ${
          emphasize ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-foreground-muted mt-1">{label}</div>
      {hint ? (
        <div className="text-[11px] text-foreground-muted mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

function InvestigationRow({ item }: { item: InvestigationCard }) {
  const isDismissed = item.verification === "dismissed";
  return (
    <div
      className={`rounded-md border p-3 space-y-1.5 ${
        isDismissed ? "opacity-90 border-dashed" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isDismissed ? "secondary" : "outline"}>
          Evidence: {item.verification}
        </Badge>
        <Badge variant="outline">{item.type}</Badge>
        {item.clusterSize && item.clusterSize > 1 ? (
          <Badge variant="outline">cluster ×{item.clusterSize}</Badge>
        ) : null}
        {item.privileges && item.privileges !== "unknown" ? (
          <Badge variant="outline">{item.privileges}</Badge>
        ) : null}
        {item.detectorSeverity ? (
          <span className="text-[11px] text-foreground-muted">
            detector severity: {item.detectorSeverity} (unverified)
          </span>
        ) : null}
      </div>
      <div className="text-sm font-mono break-all">
        {item.filePath}
        {item.line != null ? `:${item.line}` : ""}
      </div>
      {item.reason ? (
        <p className="text-sm">{item.reason}</p>
      ) : null}
      {item.nextAction ? (
        <p className="text-sm text-foreground-muted">
          <span className="font-medium text-foreground">Next:</span>{" "}
          {item.nextAction}
        </p>
      ) : null}
    </div>
  );
}

export function EvidenceStatePanel({ report }: { report: any }) {
  if (!report || typeof report !== "object") return null;
  const { headline, investigations, dismissals, pipeline } =
    resolveEvidenceState(report);

  return (
    <Card className="border-2 border-foreground/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Evidence state
        </CardTitle>
        <CardDescription className="text-sm text-foreground">
          {headline.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Signals analyzed"
            value={headline.signalsAnalyzed}
            hint="Pattern matches, not vulns"
          />
          <Metric
            label="Dismissed"
            value={headline.automaticallyDismissed}
            hint="Noise / unreachable / expected"
          />
          <Metric
            label="Require review"
            value={headline.requireReview}
            hint="Human or deeper verifier"
            emphasize={headline.requireReview > 0}
          />
          <Metric
            label="Verified"
            value={headline.verifiedVulnerabilities}
            hint="Evidence-backed only"
            emphasize
          />
        </div>

        <p className="text-xs text-foreground-muted">
          Pipeline: {pipeline.join(" → ")}. Detector severity is advisory only
          until evidence verifies an attack or data-flow chain.
        </p>

        <Separator />

        <div className="flex items-center gap-2 text-base font-semibold">
          {headline.verifiedVulnerabilities === 0 ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-success" />
              No verified vulnerabilities
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              Verified issues
            </>
          )}
        </div>

        {dismissals.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Ban className="h-4 w-4" />
              Notable dismissals ({dismissals.length})
            </div>
            <div className="space-y-2">
              {dismissals.map((item, idx) => (
                <InvestigationRow
                  key={`dismiss-${item.filePath}:${item.line}:${item.type}:${idx}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        ) : null}

        {investigations.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Search className="h-4 w-4" />
              Investigations ({investigations.length})
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {investigations.map((item, idx) => (
                <InvestigationRow
                  key={`${item.filePath}:${item.line}:${item.type}:${idx}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-foreground-muted">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" />
            No open investigations after triage and verification.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
