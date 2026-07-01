/**
 * Shared dark-theme CSS for web sample report + exported audit PDFs (matches simplebeacon.ai).
 */
function getAuditReportStyles() {
  return `
    @page {
      margin: 14mm 16mm;
      background: #0d1117;
    }
    :root {
      color-scheme: dark;
      --bg: #0d1117;
      --bg-elevated: #161b22;
      --bg-panel: #010409;
      --border: #30363d;
      --border-muted: #21262d;
      --text: #e6edf3;
      --muted: #8b949e;
      --dim: #6e7681;
      --line: #30363d;
      --accent: #58a6ff;
      --accent-soft: rgba(88, 166, 255, 0.12);
      --pass: #3fb950;
      --pass-bg: rgba(46, 164, 79, 0.14);
      --warn: #d29922;
      --warn-bg: rgba(210, 153, 34, 0.14);
      --blocked: #f85149;
      --blocked-bg: rgba(248, 81, 73, 0.14);
      --gold: #d29922;
      --green-glow: rgba(46, 164, 79, 0.12);
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body {
      font-family: "Inter", "Segoe UI", system-ui, sans-serif;
      color: var(--text);
      margin: 0;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, var(--green-glow), transparent 55%),
        radial-gradient(circle at 100% 80%, rgba(88, 166, 255, 0.06), transparent 40%),
        var(--bg);
      font-size: 11pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover-page {
      min-height: 100vh;
      padding: 48px 52px 40px;
      background:
        radial-gradient(ellipse 90% 60% at 20% 0%, rgba(46, 164, 79, 0.18), transparent 55%),
        radial-gradient(circle at 100% 20%, rgba(88, 166, 255, 0.12), transparent 45%),
        linear-gradient(160deg, #010409 0%, #0d1117 42%, #161b22 100%);
      color: var(--text);
      border-bottom: 1px solid var(--border);
      page-break-after: always;
    }
    .cover-kicker { letter-spacing: 0.14em; text-transform: uppercase; font-size: 10pt; color: var(--muted); margin: 0 0 12px; }
    .cover-title { font-family: "Inter", "Segoe UI", sans-serif; font-size: 34pt; line-height: 1.12; margin: 0 0 16px; font-weight: 700; max-width: 720px; letter-spacing: -0.02em; }
    .cover-sub { font-size: 13pt; color: #c9d1d9; max-width: 640px; margin: 0 0 28px; }
    .cover-meta { font-size: 10pt; color: var(--muted); line-height: 1.7; }
    .cover-badges { margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .cover-badges .badge { display: inline-flex; margin: 0; flex-shrink: 0; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 10pt; font-weight: 700; letter-spacing: 0.04em; border: 1px solid var(--border); }
    .badge-gold { background: rgba(210, 153, 34, 0.12); color: #e3b341; border-color: rgba(210, 153, 34, 0.35); }
    .badge-pass { background: var(--pass-bg); color: var(--pass); border-color: rgba(63, 185, 80, 0.35); }
    .badge-warn { background: var(--warn-bg); color: var(--warn); border-color: rgba(210, 153, 34, 0.35); }
    .badge-blocked { background: var(--blocked-bg); color: var(--blocked); border-color: rgba(248, 81, 73, 0.35); }
    .confidential { margin-top: 48px; font-size: 9pt; color: var(--dim); border-top: 1px solid var(--border-muted); padding-top: 16px; }
    main { padding: 36px 52px 48px; max-width: 920px; margin: 0 auto; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-num { color: var(--gold); font-size: 10pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
    h2 { font-family: "Inter", "Segoe UI", sans-serif; font-size: 20pt; margin: 0 0 12px; color: var(--text); page-break-after: avoid; letter-spacing: -0.02em; }
    h3 { font-size: 12pt; margin: 18px 0 8px; color: #c9d1d9; }
    .meta { color: var(--muted); font-size: 9.5pt; }
    .verdict-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin: 16px 0 24px; }
    .verdict-card { border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; background: var(--bg-elevated); }
    .verdict-card.ready { border-left: 5px solid var(--pass); }
    .verdict-card.conditional { border-left: 5px solid var(--warn); }
    .verdict-card.blocked { border-left: 5px solid var(--blocked); }
    .verdict-label { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
    .verdict-value { font-family: "Inter", "Segoe UI", sans-serif; font-size: 18pt; font-weight: 700; margin-bottom: 8px; }
    .score-ring { font-size: 28pt; font-weight: 700; color: var(--accent); }
    .exec-box { background: var(--accent-soft); border: 1px solid rgba(88, 166, 255, 0.28); border-radius: 12px; padding: 20px 22px; margin: 12px 0 8px; }
    .exec-headline { font-weight: 700; color: #79c0ff; margin: 14px 0 10px; font-size: 12pt; }
    .kpi-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
    .kpi { border: 1px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; background: var(--bg-elevated); }
    .kpi strong { display: block; font-size: 18pt; line-height: 1.1; margin-bottom: 4px; color: var(--text); }
    .kpi span { color: var(--muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
    .risk-matrix { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .risk-matrix th, .risk-matrix td { border: 1px solid var(--border); padding: 10px; font-size: 10pt; }
    .risk-matrix th { background: var(--bg-panel); text-align: left; color: #c9d1d9; }
    .data-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; }
    .data-table th, .data-table td { border: 1px solid var(--border); padding: 8px 9px; vertical-align: top; text-align: left; }
    .data-table th { background: var(--bg-panel); font-weight: 600; color: #c9d1d9; }
    .data-table td { background: var(--bg-elevated); color: var(--text); }
    .data-table tbody tr:nth-child(even) td { background: #131920; }
    .data-table .empty { color: var(--muted); font-style: italic; }
    code { font-size: 9pt; word-break: break-word; background: rgba(110, 118, 129, 0.18); color: #e6edf3; padding: 1px 4px; border-radius: 4px; font-family: "JetBrains Mono", Consolas, monospace; }
    .sev { font-size: 8pt; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
    .sev-high { background: var(--blocked-bg); color: #ff7b72; }
    .sev-medium { background: var(--warn-bg); color: #e3b341; }
    .sev-low { background: var(--accent-soft); color: #79c0ff; }
    .callout { background: rgba(210, 153, 34, 0.1); border: 1px solid rgba(210, 153, 34, 0.35); border-radius: 8px; padding: 12px 14px; font-size: 10pt; margin: 12px 0; color: #e6edf3; }
    .gate-banner { margin: 18px 0 22px; padding: 22px 24px; border-radius: 14px; text-align: center; border: 2px solid var(--border); background: var(--bg-elevated); }
    .gate-banner.pass { background: var(--pass-bg); border-color: rgba(63, 185, 80, 0.45); color: var(--pass); }
    .gate-banner.fail { background: var(--blocked-bg); border-color: rgba(248, 81, 73, 0.45); color: var(--blocked); }
    .gate-banner-label { font-size: 10pt; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
    .gate-banner-value { font-family: "Inter", "Segoe UI", sans-serif; font-size: 42pt; font-weight: 800; line-height: 1.1; margin-top: 6px; }
    .gate-banner-value.gate-banner-compact { font-size: 24pt; line-height: 1.25; }
    .ledger-table td:first-child { width: 34%; font-weight: 600; background: var(--bg-panel); color: #c9d1d9; }
    .tier-dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-right: 6px; vertical-align: middle; }
    .tier-critical { background: #f85149; }
    .tier-high { background: #d29922; }
    .tier-medium { background: #58a6ff; }
    code.snippet { display: block; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; background: var(--bg-panel); border: 1px solid var(--border-muted); padding: 6px 8px; }
    .fix-cell { min-width: 140px; word-break: break-word; overflow-wrap: anywhere; }
    .impact-cell, .recipe-cell { min-width: 160px; max-width: 240px; font-size: 9pt; line-height: 1.45; vertical-align: top; }
    .impact-badge { display: block; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); font-weight: 600; }
    .impact-critical { background: var(--blocked-bg); color: #ff7b72; border-color: rgba(248, 81, 73, 0.35); }
    .impact-high { background: rgba(210, 153, 34, 0.12); color: #e3b341; border-color: rgba(210, 153, 34, 0.35); }
    .impact-hygiene { background: var(--accent-soft); color: #79c0ff; border-color: rgba(88, 166, 255, 0.28); }
    .impact-review { background: rgba(110, 118, 129, 0.12); color: #c9d1d9; }
    .recipe-cell { color: #c9d1d9; }
    .recipe-cell code { display: inline; font-size: 8.5pt; }
    .verify-block { margin: 18px 0 8px; }
    .verify-block h3 { margin-top: 0; }
    .signoff-section { page-break-before: always; }
    .signoff-grid { border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; background: var(--bg-elevated); margin: 12px 0 20px; }
    .signoff-check { display: block; margin: 0 0 12px; padding-left: 1.6rem; position: relative; font-size: 10pt; line-height: 1.5; color: var(--text); }
    .signoff-check:last-child { margin-bottom: 0; }
    .signoff-box { position: absolute; left: 0; top: 0.15rem; width: 0.95rem; height: 0.95rem; border: 2px solid var(--border); border-radius: 3px; background: var(--bg-panel); }
    .signoff-signature { margin-top: 1.25rem; font-size: 10pt; color: var(--muted); }
    .signoff-line { display: block; margin: 1rem 0 0.35rem; border-bottom: 1px solid var(--border); min-height: 1.75rem; color: var(--text); }
    .signoff-role { font-size: 9pt; color: var(--dim); }
    .command-box { background: var(--bg-panel); color: #c9d1d9; border: 1px solid var(--border); padding: 14px 16px; border-radius: 8px; font-family: "JetBrains Mono", Consolas, monospace; font-size: 9.5pt; margin: 10px 0; }
    .disclaimer-box { border: 1px solid var(--border); background: var(--bg-elevated); padding: 16px 18px; border-radius: 8px; font-size: 9.5pt; color: var(--muted); }
    .footer { margin-top: 40px; padding-top: 18px; border-top: 2px solid var(--border); color: var(--muted); font-size: 9pt; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin-bottom: 6px; }
    a { color: #79c0ff; }
    @media print {
      html, body, main, section, .section {
        background: var(--bg) !important;
        color: var(--text) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .cover-page { min-height: auto; padding: 24mm 18mm; }
      main { padding: 0; max-width: none; }
      .kpi-strip { grid-template-columns: repeat(5, 1fr); }
      .cover-page, .gate-banner, .gate-banner.pass, .gate-banner.fail,
      .kpi, .verdict-card, .exec-box, .callout, .command-box, .disclaimer-box,
      .data-table th, .data-table td, .risk-matrix th, .risk-matrix td,
      .ledger-table td:first-child, .badge, code, code.snippet {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }`;
}

module.exports = { getAuditReportStyles };
