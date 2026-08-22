/**
 * Slop Cop settings panel — a webview-based sidebar settings UI.
 *
 * 4 sections:
 * 1. Monitoring — mode, scope, rule tier, severity gate
 * 2. Noise controls — ignore tests/fixtures/generated/vendor, auto-suppress
 * 3. Policy — custom rules, production path checks, AI guardrails
 * 4. Status — monitoring state, last scan, blocked findings, suppressed count
 *
 * Milestone 3.5: Sidebar Settings Panel
 */

import * as vscode from 'vscode';
import { SlopCopSettings, SlopCopSettingsManager, MonitoringMode, ScanScope, RuleTier, BlockingBehavior, PauseDuration } from './slopCopSettings';

export class SlopCopSettingsPanel {
  private static panel: vscode.WebviewPanel | null = null;
  private static manager: SlopCopSettingsManager;

  public static show(context: vscode.ExtensionContext, manager: SlopCopSettingsManager): void {
    SlopCopSettingsPanel.manager = manager;

    if (SlopCopSettingsPanel.panel) {
      SlopCopSettingsPanel.panel.reveal(vscode.ViewColumn.Two);
      SlopCopSettingsPanel.panel.webview.html = SlopCopSettingsPanel.getHtml(manager.getSettings());
      return;
    }

    SlopCopSettingsPanel.panel = vscode.window.createWebviewPanel(
      'simplebeaconSlopCopSettings',
      'AI Slop Cop — Settings',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    SlopCopSettingsPanel.panel.webview.html = SlopCopSettingsPanel.getHtml(manager.getSettings());

    // Handle messages from webview
    SlopCopSettingsPanel.panel.webview.onDidReceiveMessage(
      async (message) => {
        await SlopCopSettingsPanel.handleMessage(message, manager);
      },
      undefined,
      context.subscriptions
    );

    // Subscribe to settings changes to refresh the panel
    manager.onChange((settings) => {
      if (SlopCopSettingsPanel.panel && SlopCopSettingsPanel.panel.visible) {
        SlopCopSettingsPanel.panel.webview.html = SlopCopSettingsPanel.getHtml(settings);
      }
    });

    SlopCopSettingsPanel.panel.onDidDispose(() => {
      SlopCopSettingsPanel.panel = null;
    }, null, context.subscriptions);
  }

  private static async handleMessage(message: any, manager: SlopCopSettingsManager): Promise<void> {
    switch (message.command) {
      case 'updateSetting':
        await manager.updateSettings({ [message.key]: message.value });
        break;
      case 'pause':
        await manager.pause(message.duration as PauseDuration);
        break;
      case 'resume':
        manager.resume();
        break;
      case 'openCustomRules':
        vscode.commands.executeCommand('simplebeacon.initCustomRules');
        break;
      case 'openNoiseDashboard':
        vscode.commands.executeCommand('simplebeacon.showNoiseDashboard');
        break;
      case 'scanDiff':
        vscode.commands.executeCommand('simplebeacon.scanDiff');
        break;
    }
  }

  private static getHtml(settings: SlopCopSettings): string {
    const monitoringModeOptions: Array<{ value: MonitoringMode; label: string; desc: string }> = [
      { value: 'live', label: 'Live', desc: 'Scan on every file change (real-time)' },
      { value: 'diff-only', label: 'Diff only', desc: 'Scan only changed files (recommended)' },
      { value: 'off', label: 'Off', desc: 'No automatic scanning' },
    ];

    const scopeOptions: Array<{ value: ScanScope; label: string }> = [
      { value: 'changed-files', label: 'Changed files only' },
      { value: 'current-file', label: 'Current file' },
      { value: 'workspace', label: 'Whole workspace' },
    ];

    const ruleTierOptions: Array<{ value: RuleTier; label: string }> = [
      { value: 'security-only', label: 'Security only' },
      { value: 'security-plus-repo', label: 'Security + repo rules' },
      { value: 'all-rules', label: 'All rules' },
      { value: 'minimal-advisory', label: 'Minimal advisory' },
    ];

    const blockingOptions: Array<{ value: BlockingBehavior; label: string }> = [
      { value: 'high-only', label: 'Block on high severity only' },
      { value: 'medium-plus', label: 'Block on medium+ for changed files' },
      { value: 'advisory-none', label: 'Do not block on advisory' },
    ];

    const radioGroup = (name: string, options: Array<{ value: string; label: string; desc?: string }>, current: string) =>
      options
        .map(
          (opt) => `
          <label class="radio-option ${opt.value === current ? 'selected' : ''}">
            <input type="radio" name="${name}" value="${opt.value}" ${opt.value === current ? 'checked' : ''} />
            <span class="radio-label">${opt.label}</span>
            ${opt.desc ? `<span class="radio-desc">${opt.desc}</span>` : ''}
          </label>`
        )
        .join('');

    const toggle = (key: string, label: string, checked: boolean) => `
      <label class="toggle-row">
        <span class="toggle-label">${label}</span>
        <label class="switch">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="updateSetting('${key}', this.checked)" />
          <span class="slider"></span>
        </label>
      </label>`;

    const statusBadge = settings.isPaused
      ? '<span class="status-badge paused">Paused</span>'
      : settings.monitoringMode === 'off'
      ? '<span class="status-badge off">Off</span>'
      : settings.monitoringMode === 'live'
      ? '<span class="status-badge live">Live</span>'
      : '<span class="status-badge diff">Diff only</span>';

    const lastScan = settings.lastScanTime
      ? new Date(settings.lastScanTime).toLocaleTimeString()
      : 'Never';

    const pauseButtons = settings.isPaused
      ? `<button class="btn btn-resume" onclick="sendCommand('resume')">▶ Resume monitoring</button>
         <span class="pause-info">Paused until ${settings.pausedUntil ? new Date(settings.pausedUntil).toLocaleTimeString() : 'session end'}</span>`
      : `<div class="pause-controls">
           <button class="btn btn-pause" onclick="sendCommand('pause', 'session')">Pause for session</button>
           <button class="btn btn-pause" onclick="sendCommand('pause', '30min')">Pause 30 min</button>
           <button class="btn btn-pause" onclick="sendCommand('pause', 'until-restart')">Pause until restart</button>
         </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Slop Cop — Settings</title>
<style>
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    padding: 16px;
    font-size: 13px;
  }
  h1 { font-size: 1.3em; margin: 0 0 4px 0; }
  h2 {
    font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;
    opacity: 0.7; margin: 20px 0 10px 0; padding-bottom: 6px;
    border-bottom: 1px solid var(--vscode-panel-border, #444);
  }
  .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .status-badge {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 0.75em; font-weight: 600; text-transform: uppercase;
  }
  .status-badge.live { background: #22c55e; color: #000; }
  .status-badge.diff { background: #3b82f6; color: #fff; }
  .status-badge.paused { background: #f59e0b; color: #000; }
  .status-badge.off { background: #6b7280; color: #fff; }

  .radio-option {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 6px 8px; margin: 2px 0; border-radius: 4px; cursor: pointer;
    transition: background 0.15s;
  }
  .radio-option:hover { background: var(--vscode-list-hoverBackground, #2a2a2a); }
  .radio-option.selected { background: var(--vscode-list-activeSelectionBackground, #094771); }
  .radio-option input[type="radio"] { margin-top: 3px; }
  .radio-content { display: flex; flex-direction: column; }
  .radio-label { font-weight: 500; }
  .radio-desc { font-size: 0.85em; opacity: 0.6; }

  .toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 0;
  }
  .toggle-label { flex: 1; }

  .switch {
    position: relative; display: inline-block; width: 36px; height: 20px;
  }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background: #555; border-radius: 20px; transition: 0.2s;
  }
  .slider:before {
    content: ""; position: absolute; height: 16px; width: 16px;
    left: 2px; bottom: 2px; background: #fff; border-radius: 50%; transition: 0.2s;
  }
  .switch input:checked + .slider { background: #22c55e; }
  .switch input:checked + .slider:before { transform: translateX(16px); }

  .btn {
    padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer;
    font-size: 0.85em; transition: background 0.15s;
  }
  .btn-pause {
    background: var(--vscode-button-secondaryBackground, #3a3a3a);
    color: var(--vscode-button-secondaryForeground, #ddd);
  }
  .btn-pause:hover { background: var(--vscode-button-secondaryHoverBackground, #4a4a4a); }
  .btn-resume {
    background: #22c55e; color: #000; font-weight: 600;
  }
  .btn-resume:hover { background: #16a34a; }

  .pause-controls { display: flex; gap: 6px; flex-wrap: wrap; }
  .pause-info { display: block; margin-top: 6px; opacity: 0.6; font-size: 0.85em; }

  .status-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0;
  }
  .status-item {
    background: var(--vscode-editor-inactive-selection-background, #2a2a2a);
    padding: 8px 12px; border-radius: 4px;
  }
  .status-value { font-size: 1.3em; font-weight: 700; display: block; }
  .status-label { font-size: 0.75em; opacity: 0.6; }

  .action-row { display: flex; gap: 6px; margin-top: 8px; }
  .action-btn {
    padding: 4px 10px; border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 4px; background: transparent; color: inherit;
    cursor: pointer; font-size: 0.85em;
  }
  .action-btn:hover { background: var(--vscode-list-hoverBackground, #2a2a2a); }
</style>
</head>
<body>
  <div class="header">
    <h1>AI Slop Cop</h1>
    ${statusBadge}
  </div>

  <h2>1. Monitoring</h2>
  <div class="radio-group" data-group="monitoringMode">
    ${radioGroup('monitoringMode', monitoringModeOptions, settings.monitoringMode)}
  </div>

  <div style="margin-top:10px">
    <strong style="opacity:0.7;font-size:0.85em">Scope</strong>
    <div class="radio-group" data-group="scope" style="margin-top:4px">
      ${radioGroup('scope', scopeOptions, settings.scope)}
    </div>
  </div>

  <div style="margin-top:10px">
    <strong style="opacity:0.7;font-size:0.85em">Rule set</strong>
    <div class="radio-group" data-group="ruleTier" style="margin-top:4px">
      ${radioGroup('ruleTier', ruleTierOptions, settings.ruleTier)}
    </div>
  </div>

  <div style="margin-top:10px">
    <strong style="opacity:0.7;font-size:0.85em">Severity gate</strong>
    <div class="radio-group" data-group="blockingBehavior" style="margin-top:4px">
      ${radioGroup('blockingBehavior', blockingOptions, settings.blockingBehavior)}
    </div>
  </div>

  <h2>2. Noise controls</h2>
  ${toggle('ignoreTests', 'Ignore test files', settings.ignoreTests)}
  ${toggle('ignoreFixtures', 'Ignore fixtures/demo/sample directories', settings.ignoreFixtures)}
  ${toggle('ignoreGenerated', 'Ignore generated files', settings.ignoreGenerated)}
  ${toggle('ignoreVendor', 'Ignore vendor bundles', settings.ignoreVendor)}
  ${toggle('autoSuppressSafePatterns', 'Auto-suppress known safe patterns', settings.autoSuppressSafePatterns)}

  <h2>3. Policy</h2>
  ${toggle('customRulesEnabled', 'Repository custom rules', settings.customRulesEnabled)}
  ${toggle('productionPathChecks', 'Production path checks', settings.productionPathChecks)}
  ${toggle('aiGuardrails', 'AI guardrails', settings.aiGuardrails)}
  <div class="action-row">
    <button class="action-btn" onclick="sendCommand('openCustomRules')">Edit custom rules</button>
    <button class="action-btn" onclick="sendCommand('openNoiseDashboard')">Noise dashboard</button>
  </div>

  <h2>4. Status</h2>
  <div class="status-grid">
    <div class="status-item">
      <span class="status-value">${settings.activeBlockedFindings}</span>
      <span class="status-label">Blocked findings</span>
    </div>
    <div class="status-item">
      <span class="status-value">${settings.suppressedFalsePositives}</span>
      <span class="status-label">Suppressed FPs</span>
    </div>
    <div class="status-item">
      <span class="status-value">${lastScan}</span>
      <span class="status-label">Last scan</span>
    </div>
    <div class="status-item">
      <span class="status-value">${settings.monitoringMode}</span>
      <span class="status-label">Mode</span>
    </div>
  </div>

  <h2>Pause controls</h2>
  ${pauseButtons}

  <div class="action-row" style="margin-top:12px">
    <button class="action-btn" onclick="sendCommand('scanDiff')">Scan diff now</button>
  </div>

<script>
  const vscode = acquireVsCodeApi();

  // Radio button handlers
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const name = e.target.name;
      const value = e.target.value;
      updateSetting(name, value);
      // Update selected styling
      document.querySelectorAll('input[name="' + name + '"]').forEach(r => {
        r.closest('.radio-option').classList.toggle('selected', r.checked);
      });
    });
  });

  function updateSetting(key, value) {
    vscode.postMessage({ command: 'updateSetting', key, value });
  }

  function sendCommand(command, arg) {
    vscode.postMessage({ command, duration: arg });
  }
</script>
</body>
</html>`;
  }
}
