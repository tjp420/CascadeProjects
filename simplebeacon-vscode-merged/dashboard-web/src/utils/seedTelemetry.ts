// Lightweight telemetry history seeder for demo / onboarding
export function seedTelemetryHistoryMock(): void {
  try {
    const targetKey = "sb_scan_history_telemetry";
    if (typeof window === "undefined" || !window.localStorage) return;
    if (localStorage.getItem(targetKey)) return;

    const historicalTimeline = [
      {
        id: "sb_run_001_initial",
        timestamp: "2026-08-15T10:00:00.000Z",
        gate_pass: false,
        high_entropy_count: 24,
        unsuppressed_high_severity: 2,
        total_findings: 384,
      },
      {
        id: "sb_run_002_sprint1",
        timestamp: "2026-08-22T14:30:00.000Z",
        gate_pass: false,
        high_entropy_count: 18,
        unsuppressed_high_severity: 1,
        total_findings: 376,
      },
      {
        id: "sb_run_003_sprint2",
        timestamp: "2026-08-29T09:15:00.000Z",
        gate_pass: false,
        high_entropy_count: 11,
        unsuppressed_high_severity: 0,
        total_findings: 336,
      },
      {
        id: "sb_run_004_audit_prep",
        timestamp: "2026-09-05T16:00:00.000Z",
        gate_pass: true,
        high_entropy_count: 0,
        unsuppressed_high_severity: 0,
        total_findings: 212,
      },
      {
        id: "sb_run_005_current_main",
        timestamp: new Date().toISOString(),
        gate_pass: true,
        high_entropy_count: 0,
        unsuppressed_high_severity: 0,
        total_findings: 127,
      },
    ];

    localStorage.setItem(targetKey, JSON.stringify(historicalTimeline));
    // best-effort console log for dev feedback
    // eslint-disable-next-line no-console
    console.info("[SimpleBeacon] seeded telemetry history ->", targetKey);
  } catch (e) {
    // swallow any storage errors — seeding is non-critical
  }
}
export function seedTelemetryHistoryMock(): void {
  try {
    const targetKey = "sb_scan_history_telemetry";
    if (typeof window === "undefined" || !window.localStorage) return;
    if (localStorage.getItem(targetKey)) return;

    const now = new Date();
    const historicalTimeline = [
      {
        scanId: "sb_run_001_initial",
        date: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(),
        gatePass: false,
        severityCounts: { critical: 2, high: 24, medium: 90, low: 250 },
        filesAnalyzed: 1200,
      },
      {
        scanId: "sb_run_002_sprint1",
        date: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        gatePass: false,
        severityCounts: { critical: 1, high: 18, medium: 95, low: 262 },
        filesAnalyzed: 1250,
      },
      {
        scanId: "sb_run_003_sprint2",
        date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        gatePass: false,
        severityCounts: { critical: 0, high: 11, medium: 85, low: 240 },
        filesAnalyzed: 1280,
      },
      {
        scanId: "sb_run_004_audit_prep",
        date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        gatePass: true,
        severityCounts: { critical: 0, high: 0, medium: 32, low: 180 },
        filesAnalyzed: 1310,
      },
      {
        scanId: "sb_run_005_current_main",
        date: now.toISOString(),
        gatePass: true,
        severityCounts: { critical: 0, high: 0, medium: 12, low: 115 },
        filesAnalyzed: 1342,
      },
    ];

    localStorage.setItem(targetKey, JSON.stringify(historicalTimeline));
    // best-effort logging in browser console only
    // eslint-disable-next-line no-console
    console.info("[SimpleBeacon] seeded telemetry history:", targetKey);
  } catch (e) {
    // do not throw in UI context
  }
}
