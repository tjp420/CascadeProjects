import * as React from "react";

type ScanReport = {
  id?: string;
  timestamp: string; // ISO date
  gate_pass: boolean;
  high_entropy_count?: number;
  unsuppressed_high_severity?: number;
  total_findings?: number;
};

type Props = {
  reports: ScanReport[];
  className?: string;
};

function toNumberArray(reports: ScanReport[], selector: (r: ScanReport) => number) {
  return reports.map((r) => selector(r) ?? 0);
}

function sparklinePath(values: number[], width = 300, height = 48) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(height - ((v - min) / range) * height);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

export default function SiemTelemetryDashboard({ reports, className }: Props) {
  const sorted = [...(reports || [])].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const gateValues = toNumberArray(sorted, (r) => (r.gate_pass ? 1 : 0));
  const cryptoValues = toNumberArray(sorted, (r) => r.high_entropy_count ?? 0);
  const unsuppressed = toNumberArray(sorted, (r) => r.unsuppressed_high_severity ?? 0);

  const gatePath = sparklinePath(gateValues);
  const cryptoPath = sparklinePath(cryptoValues);

  const latest = sorted[sorted.length - 1];
  const latestGate = latest ? (latest.gate_pass ? "PASS" : "FAIL") : "N/A";

  const totalUnsuppressed = unsuppressed.reduce((s, v) => s + v, 0);
  const totalFindings = sorted.reduce((s, r) => s + (r.total_findings ?? 0), 0) || 1;
  const noiseRatio = Math.round((totalUnsuppressed / totalFindings) * 100);

  return (
    <div className={className} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>SIEM Telemetry</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <section style={{ padding: 12, border: "1px solid #e6e9ee", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Gate Execution Velocity</strong>
            <span style={{ color: latestGate === "PASS" ? "#0b8457" : "#d44" }}>{latestGate}</span>
          </div>
          <svg width={300} height={48} style={{ width: "100%", marginTop: 8 }}>
            <path d={gatePath} fill="none" stroke="#2b6cb0" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>{sorted.length} runs</div>
        </section>

        <section style={{ padding: 12, border: "1px solid #e6e9ee", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Cryptographic Threat Drift</strong>
            <span style={{ color: "#333" }}>{cryptoValues.reduce((s, v) => s + v, 0)} high-entropy</span>
          </div>
          <svg width={300} height={48} style={{ width: "100%", marginTop: 8 }}>
            <path d={cryptoPath} fill="none" stroke="#d69e2e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Shows volumetric high-entropy findings over time</div>
        </section>

        <section style={{ padding: 12, border: "1px solid #e6e9ee", borderRadius: 8 }}>
          <strong>Noise vs Boundary Ratio</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: `conic-gradient(#d44 ${noiseRatio}%, #e6e9ee 0)` }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{noiseRatio}%</div>
              <div style={{ fontSize: 12, color: "#666" }}>{totalUnsuppressed} unsuppressed · {totalFindings} total</div>
            </div>
          </div>
        </section>

        <section style={{ padding: 12, border: "1px solid #e6e9ee", borderRadius: 8 }}>
          <strong>Quick Summary</strong>
          <ul style={{ marginTop: 8, paddingLeft: 16 }}>
            <li>Runs: {sorted.length}</li>
            <li>Latest Gate: {latestGate}</li>
            <li>Unsuppressed (total): {totalUnsuppressed}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
