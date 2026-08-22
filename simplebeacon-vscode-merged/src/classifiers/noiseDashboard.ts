/**
 * Noise dashboard — a webview panel showing false-positive analytics:
 * - Top rules by finding count
 * - Top rules by dismissal rate (false positive suspects)
 * - Rules with zero findings (candidates for removal)
 * - Suggested allowlist entries
 * - Overall signal-to-noise ratio
 *
 * Milestone 1: Trust and Noise Reduction
 */

import * as vscode from 'vscode';
import { getDismissalTracker, DismissalStats, DismissalSuggestion } from '../classifiers/dismissalTracker';

export class NoiseDashboard {
  private static panel: vscode.WebviewPanel | null = null;

  public static show(context: vscode.ExtensionContext): void {
    const tracker = getDismissalTracker();
    const data = tracker.exportJson();

    if (NoiseDashboard.panel) {
      NoiseDashboard.panel.reveal(vscode.ViewColumn.Two);
      NoiseDashboard.panel.webview.html = NoiseDashboard.getHtml(data);
      return;
    }

    NoiseDashboard.panel = vscode.window.createWebviewPanel(
      'simplebeaconNoiseDashboard',
      'AI Slop Cop — Noise Dashboard',
      vscode.ViewColumn.Two,
      {
        enableScripts: false,
        retainContextWhenHidden: false,
      }
    );

    NoiseDashboard.panel.webview.html = NoiseDashboard.getHtml(data);

    NoiseDashboard.panel.onDidDispose(() => {
      NoiseDashboard.panel = null;
    }, null, context.subscriptions);
  }

  private static getHtml(data: {
    rules: Array<{ ruleType: string; totalFindings: number; dismissedFindings: number; dismissalRate: number }>;
    suggestions: Array<{ ruleType: string; dismissalRate: number; suggestion: string }>;
    noisiest: Array<{ ruleType: string; totalFindings: number; dismissedFindings: number; dismissalRate: number }>;
    dormant: string[];
    totalFindings: number;
    totalDismissed: number;
    overallDismissalRate: number;
  }): string {
    // Build the HTML content
    const overallRate = (data.overallDismissalRate * 100).toFixed(1);
    const healthColor = data.overallDismissalRate < 0.1 ? '#22c55e' : data.overallDismissalRate < 0.3 ? '#f59e0b' : '#ef4444';
    const healthLabel = data.overallDismissalRate < 0.1 ? 'Healthy' : data.overallDismissalRate < 0.3 ? 'Needs Tuning' : 'Noisy';

    const noisiestRows = data.noisiest
      .map((r) => {
        const rate = (r.dismissalRate * 100).toFixed(0);
        const rateColor = r.dismissalRate > 0.3 ? '#ef4444' : r.dismissalRate > 0.1 ? '#f59e0b' : '#22c55e';
        return `<tr>
          <td><code>${r.ruleType}</code></td>
          <td style="text-align:right">${r.totalFindings}</td>
          <td style="text-align:right">${r.dismissedFindings}</td>
          <td style="text-align:right;color:${rateColor}">${rate}%</td>
        </tr>`;
      })
      .join('');

    const suggestionRows = data.suggestions
      .map((s) => {
        const rate = (s.dismissalRate * 100).toFixed(0);
        return `<tr>
          <td><code>${s.ruleType}</code></td>
          <td style="text-align:right;color:#ef4444">${rate}%</td>
          <td>${s.suggestion}</td>
        </tr>`;
      })
      .join('');

    const dormantList = data.dormant.length > 0
      ? data.dormant.map((r) => `<code style="margin-right:8px">${r}</code>`).join('')
      : '<em>None — all rules have produced findings</em>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Slop Cop — Noise Dashboard</title>
<style>
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 { font-size: 1.6em; margin-bottom: 8px; }
  h2 { font-size: 1.2em; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border, #444); padding-bottom: 6px; }
  .health-badge {
    display: inline-block; padding: 4px 12px; border-radius: 4px;
    font-weight: 600; font-size: 0.9em; margin-left: 12px;
    background: ${healthColor}; color: #000;
  }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .stat-card {
    background: var(--vscode-editor-inactive-selection-background, #2a2a2a);
    padding: 16px; border-radius: 6px; text-align: center;
  }
  .stat-value { font-size: 2em; font-weight: 700; display: block; }
  .stat-label { font-size: 0.85em; opacity: 0.7; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--vscode-panel-border, #444); font-size: 0.85em; text-transform: uppercase; opacity: 0.7; }
  td { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
  code { background: var(--vscode-textCodeBlock-background, #2a2a2a); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  .empty { opacity: 0.5; font-style: italic; padding: 16px; text-align: center; }
  .suggestion-box {
    background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px; padding: 12px 16px; margin: 8px 0;
  }
</style>
</head>
<body>
  <h1>AI Slop Cop — Noise Dashboard <span class="health-badge">${healthLabel}</span></h1>
  <p style="opacity:0.7">Signal-to-noise analytics for false-positive suppression (Milestone 1)</p>

  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-value">${data.totalFindings}</span>
      <span class="stat-label">Total Findings</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${data.totalDismissed}</span>
      <span class="stat-label">Dismissed (False Positives)</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" style="color:${healthColor}">${overallRate}%</span>
      <span class="stat-label">Dismissal Rate</span>
    </div>
  </div>

  <h2>Top 10 Noisiest Rules</h2>
  ${noisiestRows ? `<table>
    <thead><tr><th>Rule Type</th><th style="text-align:right">Findings</th><th style="text-align:right">Dismissed</th><th style="text-align:right">Dismissal %</th></tr></thead>
    <tbody>${noisiestRows}</tbody>
  </table>` : '<div class="empty">No findings recorded yet this session.</div>'}

  ${data.suggestions.length > 0 ? `
  <h2>⚠️ Suggested Allowlist Entries</h2>
  <p style="opacity:0.7">These rules have dismissal rates above 30% — consider allowlisting or adjusting their confidence threshold.</p>
  <table>
    <thead><tr><th>Rule Type</th><th style="text-align:right">Dismissal %</th><th>Suggestion</th></tr></thead>
    <tbody>${suggestionRows}</tbody>
  </table>` : ''}

  <h2>Dormant Rules (Zero Findings)</h2>
  <p style="opacity:0.7">Rules that have not produced any findings this session — candidates for removal or re-tuning.</p>
  <div style="padding:12px;background:var(--vscode-editor-inactive-selection-background,#2a2a2a);border-radius:6px">${dormantList}</div>

  <h2>How to Reduce Noise</h2>
  <div style="opacity:0.8;line-height:1.6">
    <p><strong>1. Allowlist noisy rules:</strong> Add high-dismissal rules to <code>.simplebeacon/config.json</code> under <code>allowlist</code>.</p>
    <p><strong>2. Raise confidence threshold:</strong> Set <code>simplebeacon.confidenceThreshold</code> to <code>high</code> in VS Code settings.</p>
    <p><strong>3. Use suppression comments:</strong> Add <code>// slop-cop-disable-next-line</code> above specific false positives.</p>
    <p><strong>4. Switch to low-noise preset:</strong> Set <code>simplebeacon.preset</code> to <code>low-noise</code> for high-confidence-only findings.</p>
  </div>
</body>
</html>`;
  }
}
