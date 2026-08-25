import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { getDataServerPort } from './dataServer';

export interface DashboardHtmlOptions {
  cspSource: string;
  version: string;
  nonce: string;
  showWelcome?: boolean;
}

export function buildDashboardHtml(options: DashboardHtmlOptions): string {
  const nonce = options.nonce;
  const csp = options.cspSource;
  const showWelcomeChecked = options.showWelcome !== false ? 'checked' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp}; frame-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Dashboard</title>
<script nonce="${nonce}">(function(){try{if(typeof acquireVsCodeApi==='function'||/vscode/i.test(navigator.userAgent)){document.documentElement.setAttribute('data-ide-embed','true');document.documentElement.setAttribute('data-ide-preview','true');}}catch(e){} })();</script>
<style>
/* Dashboard app (/app/) design-system palette — mirrors coming-soon/public/app/css/variables.css */
:root{
  --primary:#818cf8;--primary-hover:#a5b4fc;--primary-subtle:rgba(129,140,248,0.12);--accent:#22d3ee;
  --sb-surface:#111827;--sb-surface-elevated:#1e293b;--sb-surface-hover:#1e293b;--sb-border:#1e293b;
  --sb-text-primary:#f1f5f9;--sb-text-secondary:#94a3b8;--sb-text-muted:#94a3b8;
  --sb-success:#10b981;--sb-warning:#f59e0b;--sb-danger:#ef4444;--sb-info:#3b82f6;
  --vscode-editor-background:#0b1120;--vscode-sideBar-background:#0b1120;--vscode-foreground:#f1f5f9;
  --vscode-descriptionForeground:#94a3b8;--vscode-panel-border:#1e293b;--vscode-input-background:#111827;
  --vscode-list-hoverBackground:#1e293b;--vscode-button-background:#818cf8;--vscode-button-hoverBackground:#a5b4fc;
  --vscode-button-foreground:#0b1120;--vscode-focusBorder:#818cf8;
 /* welcome dashboard specific variables (language palette and trust colors) */
 --wd-lang-1:#89d185;--wd-lang-2:#38bdf8;--wd-lang-3:#a78bfa;--wd-lang-4:#f48771;
 --wd-lang-5:#d7a24c;--wd-lang-6:#007acc;--wd-lang-7:#ec4899;--wd-lang-8:#10b981;
 --wd-trust-good:#89d185;--wd-trust-med:#d7a24c;--wd-trust-low:#c75450;--wd-sev-medium:#75beff;
}
body.vscode-light,body.vscode-high-contrast-light{
  --primary:#6366f1;--primary-hover:#4f46e5;--primary-subtle:#eef2ff;--accent:#06b6d4;
  --sb-surface:#ffffff;--sb-surface-elevated:#ffffff;--sb-surface-hover:#f1f5f9;--sb-border:#e2e8f0;
  --sb-text-primary:#0f172a;--sb-text-secondary:#475569;--sb-text-muted:#475569;
  --vscode-editor-background:#f8fafc;--vscode-sideBar-background:#f8fafc;--vscode-foreground:#0f172a;
  --vscode-descriptionForeground:#475569;--vscode-panel-border:#e2e8f0;--vscode-input-background:#ffffff;
  --vscode-list-hoverBackground:#f1f5f9;--vscode-button-background:#6366f1;--vscode-button-hoverBackground:#4f46e5;
  --vscode-button-foreground:#ffffff;--vscode-focusBorder:#6366f1;
}
/* Embed overrides: force full-height and enable scrolling inside IDE webviews */
[data-ide-embed], [data-ide-preview], html[data-ide-embed], body[data-ide-embed], html[data-ide-preview], body[data-ide-preview] {
  height:100% !important;
  min-height:0 !important;
  overflow:auto !important;
}
[data-ide-embed] .pane, [data-ide-preview] .pane {
  min-height:0 !important;
  height:100% !important;
  overflow:auto !important;
}
*{box-sizing:border-box;margin:0;padding:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;}
body{font-family:var(--vscode-font-family,'Segoe UI',sans-serif);background:var(--vscode-editor-background,#1e1e1e);color:var(--vscode-foreground,#ccc);min-height:0;overflow:auto;display:flex;flex-direction:column}
.tab-bar{display:flex;background:var(--vscode-panel-background,#252526);border-bottom:1px solid var(--vscode-panel-border,#3c3c3c);padding:4px 8px;gap:4px;flex-shrink:0;align-items:center;justify-content:space-between}
.tab-nav-arrows{display:flex;align-items:center;gap:2px}
.tab-arrow{padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--vscode-descriptionForeground,#858585);font-size:13px;cursor:pointer;transition:all 0.15s;line-height:1}
.tab-arrow:hover{background:rgba(255,255,255,0.06);color:var(--vscode-foreground,#ccc)}
.tab-arrow:disabled{opacity:0.3;cursor:not-allowed}
.tab-close-btn{padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--vscode-descriptionForeground,#858585);font-size:13px;cursor:pointer;transition:all 0.15s;line-height:1}
.tab-close-btn:hover{background:rgba(244,67,67,0.15);color:#f48771;border-color:rgba(244,67,67,0.25)}
.tab{padding:6px 12px;border-radius:4px;font-size:12px;cursor:pointer;user-select:none;color:var(--vscode-descriptionForeground,#858585);display:flex;align-items:center;gap:6px}
.tab:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
.tab.active{background:var(--vscode-tab-activeBackground,#1e1e1e);color:var(--vscode-tab-activeForeground,#fff)}
.tab-close{font-size:13px;line-height:1;color:var(--vscode-descriptionForeground);opacity:0.6}
.tab-close:hover{opacity:1;color:var(--vscode-errorForeground,#f48771)}
.tab-label{flex:1}
.pane{display:none;flex:1;overflow:auto;padding:16px;min-height:0}
.pane.active{display:block}
.welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;text-align:center}
.welcome h1{font-size:22px;font-weight:600;margin-bottom:4px}
.welcome p{font-size:13px;color:var(--vscode-descriptionForeground)}
.welcome-map{line-height:1;margin-bottom:0}
.btn-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:640px;width:100%}
.btn-grid button{padding:10px 8px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-panel-background,#252526);color:var(--vscode-foreground,#ccc);font-size:12px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
.btn-grid button:hover{background:var(--vscode-list-hoverBackground,#2a2d2e);border-color:var(--vscode-focusBorder);transform:translateY(-1px)}
.btn-icon{font-size:14px;line-height:1}
.btn-label{flex:1;text-align:center}
.welcome-checkbox{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--vscode-descriptionForeground);cursor:pointer;margin-top:4px}
.welcome-checkbox input{cursor:pointer}
.profile-layout{display:flex;gap:20px;align-items:flex-start}
.profile-card{background:var(--vscode-panel-background,#252526);border:1px solid var(--vscode-panel-border,#3c3c3c);border-radius:8px;padding:20px;flex:1;max-width:480px}
.profile-card-title{font-size:14px;font-weight:600;margin-bottom:16px;color:var(--vscode-foreground)}
.profile-field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.profile-field label{font-size:12px;color:var(--vscode-descriptionForeground)}
.profile-field input,.profile-field select{padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border,#3c3c3c);background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-foreground,#ccc);font-size:13px}
.profile-field input:focus,.profile-field select:focus{outline:none;border-color:var(--vscode-focusBorder,#007acc)}
.profile-actions{display:flex;gap:10px;margin-top:20px}
.profile-btn{padding:8px 16px;border-radius:6px;border:1px solid var(--vscode-panel-border,#3c3c3c);background:var(--vscode-button-secondaryBackground,#2d2d30);color:var(--vscode-button-secondaryForeground,#ccc);font-size:13px;cursor:pointer}
.profile-btn:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
.profile-btn-primary{background:var(--vscode-button-background,#0e639c);color:var(--vscode-button-foreground,#fff);border-color:transparent}
.profile-btn-primary:hover{background:var(--vscode-button-hoverBackground,#1177bb)}
.profile-side{display:flex;flex-direction:column;gap:16px;flex:1;max-width:400px}
.profile-stats{padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.profile-stat-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.profile-stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.profile-stat-item{padding:10px;border-radius:8px;background:var(--vscode-editor-background);text-align:center}
.profile-stat-value{font-size:20px;font-weight:700;color:var(--vscode-foreground);display:block}
.profile-stat-label{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px}
.profile-preferences{padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.profile-pref-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.profile-pref-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--vscode-panel-border);font-size:12px}
.profile-pref-item:last-child{border-bottom:none}
.profile-pref-label{flex:1}
.profile-pref-toggle{width:36px;height:20px;border-radius:10px;background:var(--vscode-panel-border);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.profile-pref-toggle.on{background:var(--vscode-button-background)}
.profile-pref-knob{width:16px;height:16px;border-radius:50%;background:var(--vscode-button-foreground);position:absolute;top:2px;left:2px;transition:left .2s}
.profile-pref-toggle.on .profile-pref-knob{left:18px}
.profile-activity{padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.profile-activity-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.profile-activity-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--vscode-panel-border);font-size:12px}
.profile-activity-item:last-child{border-bottom:none}
.profile-activity-icon{font-size:14px;flex-shrink:0}
.profile-activity-text{flex:1}
.profile-activity-time{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
@media (max-width: 700px) {
  .profile-layout{flex-direction:column}
  .profile-side{max-width:none}
}
.repo-health-card{background:var(--vscode-panel-background,#252526);border:1px solid var(--vscode-panel-border,#3c3c3c);border-radius:8px;padding:16px}
.repo-health-card h3{font-size:14px;font-weight:600;margin:0 0 12px 0;color:var(--vscode-foreground,#ccc)}
.repo-health-findings{max-height:300px;overflow:auto}
.repo-health-empty{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.repo-health-item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--vscode-panel-border,#3c3c3c);font-size:13px}
.repo-health-item:last-child{border-bottom:none}
.repo-health-sev{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0}
.repo-health-sev.critical{background:#ef4444}
.repo-health-sev.high{background:#f59e0b}
.repo-health-sev.medium{background:#d18616}
.repo-health-sev.low{background:#75beff}
.repo-health-text{flex:1;color:var(--vscode-foreground,#ccc)}
.repo-health-file{font-size:11px;color:var(--vscode-descriptionForeground)}
.rh-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.rh-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.rh-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.rh-quick-icon{font-size:20px;margin-bottom:6px;display:block}
.rh-quick-label{font-size:12px;font-weight:600}
.rh-quick-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.rh-severity-bar{display:flex;gap:8px;margin-bottom:20px;padding:10px 12px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.rh-sev-segment{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;background:var(--vscode-editor-background);font-size:12px;flex:1;justify-content:center}
.rh-sev-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.rh-sev-segment.critical .rh-sev-dot{background:#c75450}
.rh-sev-segment.high .rh-sev-dot{background:#d7a24c}
.rh-sev-segment.medium .rh-sev-dot{background:#007acc}
.rh-sev-segment.low .rh-sev-dot{background:#89d185}
.rh-sev-count{font-weight:700;margin-right:2px}
.rh-sev-label{color:var(--vscode-descriptionForeground)}
.rh-metrics{margin-bottom:20px;padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.rh-metrics-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.rh-metrics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.rh-metric-item{display:flex;align-items:center;gap:10px;font-size:12px}
.rh-metric-label{width:100px;flex-shrink:0}
.rh-metric-bar{flex:1;height:8px;border-radius:4px;background:var(--vscode-editor-background);overflow:hidden}
.rh-metric-fill{height:100%;border-radius:4px;background:var(--vscode-progressBar-background,#007acc);transition:width .3s}
.rh-metric-value{width:36px;text-align:right;font-weight:600;flex-shrink:0}
.rh-recommendations{margin-bottom:20px}
.rh-rec-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.rh-rec-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;margin-bottom:6px}
.rh-rec-icon{font-size:16px;flex-shrink:0;margin-top:2px}
.rh-rec-text{flex:1}
@media (max-width: 700px) {
  .rh-quick-actions{grid-template-columns:repeat(2,1fr)}
  .rh-metrics-grid{grid-template-columns:1fr}
}
.team-card{background:var(--vscode-panel-background,#252526);border:1px solid var(--vscode-panel-border,#3c3c3c);border-radius:8px;padding:16px;margin-bottom:16px}
.team-card h3{font-size:14px;font-weight:600;margin:0 0 12px 0;color:var(--vscode-foreground,#ccc)}
.team-members{display:flex;flex-direction:column;gap:10px}
.team-member{display:flex;align-items:center;gap:12px;padding:10px;border-radius:6px;background:var(--vscode-input-background,#3c3c3c)}
.team-member-avatar{font-size:24px}
.team-member-info{flex:1}
.team-member-name{font-size:13px;font-weight:600;color:var(--vscode-foreground,#ccc)}
.team-member-role{font-size:12px;color:var(--vscode-descriptionForeground)}
.team-field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.team-field label{font-size:12px;color:var(--vscode-descriptionForeground)}
.team-field input,.team-field select{padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border,#3c3c3c);background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-foreground,#ccc);font-size:13px}
.team-field input:focus,.team-field select:focus{outline:none;border-color:var(--vscode-focusBorder,#007acc)}
.team-actions{display:flex;gap:10px}
.db-container{max-width:960px;margin:0 auto;width:100%;box-sizing:border-box}
.db-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.db-header h2{font-size:18px;font-weight:600}
.db-gate-badge{padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase}
.db-gate-pass{background:var(--sb-success);color:var(--vscode-button-foreground)}
.db-gate-fail{background:var(--sb-danger);color:var(--vscode-button-foreground)}
.db-gate-pending{background:#d7a24c;color:#1e1e1e}
.db-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.db-kpi-card{padding:20px 16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;position:relative;overflow:hidden}
.db-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--vscode-activityBar-background,#007acc)}
.db-kpi-value{font-size:28px;font-weight:700;margin-bottom:4px}
.db-kpi-label{font-size:11px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:0.5px}
.db-kpi-trend{font-size:11px;margin-top:6px}
.db-kpi-trend.up{color:#89d185}
.db-kpi-trend.down{color:#f48771}
.db-severity{margin-bottom:20px}
.db-severity-title{font-size:12px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.db-severity-bar{display:flex;height:28px;border-radius:6px;overflow:hidden;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.db-sev-segment{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:var(--vscode-button-foreground);min-width:30px;transition:width .3s}
.db-sev-critical{background:#c75450}
.db-sev-high{background:#d7a24c}
.db-sev-medium{background:#007acc}
.db-sev-low{background:#89d185}
.db-actions{display:flex;gap:8px;margin-bottom:20px}
.db-actions button{flex:1;padding:10px 14px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:12px;cursor:pointer;font-weight:500}
.db-actions button:hover{background:var(--vscode-button-hoverBackground)}
.db-section-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.db-findings{max-height:300px;overflow:auto}
.db-finding-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:6px;margin-bottom:4px;background:var(--vscode-list-hoverBackground,#2a2d2e);font-size:12px;cursor:pointer}
.db-finding-row:hover{background:var(--vscode-list-activeBackground,#37373d)}
.db-finding-sev{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.db-finding-sev.critical{background:#c75450}
.db-finding-sev.high{background:#d7a24c}
.db-finding-sev.medium{background:#007acc}
.db-finding-sev.low{background:#89d185}
.db-finding-text{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.db-finding-file{color:var(--vscode-descriptionForeground);font-size:11px;flex-shrink:0}
.db-empty{text-align:center;padding:40px;color:var(--vscode-descriptionForeground);font-size:13px}
.db-empty-icon{font-size:40px;margin-bottom:12px;opacity:.3}
.db-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.db-hero-left{flex:1}
.db-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.db-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.db-hero-right{display:flex;align-items:center;gap:12px}
.db-export-btn{padding:8px 16px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);font-size:12px;cursor:pointer;transition:background .2s}
.db-export-btn:hover{background:var(--vscode-list-hoverBackground)}
.db-signin-btn{padding:8px 16px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:12px;cursor:pointer;transition:background .2s}
.db-signin-btn:hover{background:var(--vscode-button-hoverBackground)}
.db-scan-status{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--vscode-descriptionForeground)}
.db-scan-dot{width:8px;height:8px;border-radius:50%;background:#89d185}
.db-scan-dot.idle{background:var(--vscode-descriptionForeground)}
.db-scan-dot.running{background:#007acc;animation:pulse 1.5s infinite}
.db-scan-dot.complete{background:#89d185}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.db-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.db-kpi-card .db-kpi-value{font-size:32px;font-weight:700;margin-bottom:4px}
.db-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.db-quick-tile{padding:16px 12px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.db-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.db-quick-tile-icon{font-size:22px;margin-bottom:8px;display:block}
.db-quick-tile-label{font-size:12px;font-weight:600}
.db-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.db-severity-labels{display:flex;justify-content:space-between;font-size:10px;color:var(--vscode-descriptionForeground);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.db-sev-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);margin-bottom:12px;font-size:11px}
.db-sev-label{display:flex;align-items:center;gap:6px}
.db-sev-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.db-sev-dot.crit{background:#c75450}
.db-sev-dot.high{background:#d7a24c}
.db-sev-dot.med{background:#007acc}
.db-sev-dot.low{background:#89d185}
.db-sev-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.db-sev-card{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.db-sev-count{font-size:22px;font-weight:700;margin-bottom:4px}
.db-sev-count.crit{color:#f48771}
.db-sev-count.high{color:#d7a24c}
.db-sev-count.med{color:#75beff}
.db-sev-count.low{color:#89d185}
.db-sev-name{font-size:11px;color:var(--vscode-descriptionForeground)}
.db-info{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.db-info-row{display:flex;justify-content:space-between;align-items:center;font-size:12px}
.db-info-label{color:var(--vscode-descriptionForeground)}
.db-info-val{font-weight:600}
/* Analyze Pane Styles */
.analyze-hero{padding:0 0 16px;border-bottom:1px solid var(--vscode-panel-border);margin-bottom:16px}
.analyze-hero-main{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.analyze-hero-main h2{font-size:20px;font-weight:600;margin:0}
.analyze-build-badge{font-size:10px;padding:2px 8px;border-radius:10px;background:var(--vscode-badge-background,#007acc);color:var(--vscode-badge-foreground,#fff);font-weight:600;text-transform:uppercase}
.analyze-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.analyze-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.analyze-col{display:flex;flex-direction:column;gap:16px}
.analyze-card{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.analyze-card h3{font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.analyze-card h3 .icon{font-size:14px}
.analyze-path-row{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.analyze-path-row input{flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-size:12px;outline:none}
.analyze-path-row input:focus{border-color:var(--vscode-focusBorder)}
.analyze-path-row button{padding:8px 12px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:12px;cursor:pointer;font-weight:500}
.analyze-path-row button:hover{background:var(--vscode-button-hoverBackground)}
.analyze-select-wrap{margin-bottom:12px}
.analyze-select-wrap label{display:block;font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.analyze-select-wrap select{width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);font-size:12px;outline:none;cursor:pointer}
.analyzer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.analyzer-chip{padding:10px 12px;border-radius:8px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);cursor:pointer;font-size:12px;transition:all .15s;position:relative}
.analyzer-chip:hover{border-color:var(--vscode-focusBorder)}
.analyzer-chip.selected{border-color:var(--vscode-focusBorder);background:var(--vscode-list-activeSelectionBackground)}
.analyzer-chip .chip-label{font-weight:600;display:block;margin-bottom:2px}
.analyzer-chip .chip-desc{font-size:10px;color:var(--vscode-descriptionForeground);display:block;line-height:1.3}
.analyzer-chip .chip-check{position:absolute;top:6px;right:6px;width:14px;height:14px;border-radius:50%;border:1px solid var(--vscode-panel-border);display:flex;align-items:center;justify-content:center;font-size:9px}
.analyzer-chip.selected .chip-check{background:var(--vscode-button-background);border-color:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.analyze-actions{display:flex;gap:8px;flex-wrap:wrap}
.analyze-actions button{flex:1;min-width:120px;padding:10px 14px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:12px;cursor:pointer;font-weight:500;transition:background .15s}
.analyze-actions button:hover{background:var(--vscode-button-hoverBackground)}
.analyze-actions button.secondary{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);color:var(--vscode-foreground)}
.analyze-actions button.secondary:hover{background:var(--vscode-list-hoverBackground)}
.analyze-progress{margin-top:12px;padding:12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.analyze-progress-bar{height:6px;border-radius:3px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);overflow:hidden;margin-bottom:8px}
.analyze-progress-fill{height:100%;background:var(--vscode-progressBar-background,#007acc);width:0%;transition:width .3s}
.analyze-progress-text{font-size:11px;color:var(--vscode-descriptionForeground);display:flex;justify-content:space-between}
.analyze-results{margin-top:16px}
.analyze-results h3{font-size:13px;font-weight:600;margin-bottom:10px}
.analyze-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.analyze-metric-card{padding:14px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.analyze-metric-value{font-size:22px;font-weight:700;margin-bottom:2px}
.analyze-metric-label{font-size:10px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:0.5px}
.analyze-finding-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;margin-bottom:3px;background:var(--vscode-list-hoverBackground);font-size:12px;cursor:pointer}
.analyze-finding-row:hover{background:var(--vscode-list-activeBackground)}
.analyze-finding-sev{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.analyze-finding-sev.critical{background:#c75450}
.analyze-finding-sev.high{background:#d7a24c}
.analyze-finding-sev.medium{background:#007acc}
.analyze-finding-sev.low{background:#89d185}
.analyze-finding-text{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.analyze-finding-file{color:var(--vscode-descriptionForeground);font-size:11px;flex-shrink:0}
.analyze-category-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--vscode-descriptionForeground);margin:12px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--vscode-panel-border)}
@media (max-width: 700px) {
  .analyze-grid{grid-template-columns:1fr}
  .analyzer-grid{grid-template-columns:1fr}
  .analyze-metrics{grid-template-columns:repeat(2,1fr)}
}
/* Report Pane Styles */
.report-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.report-hero-left{flex:1}
.report-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.report-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.report-hero-right{display:flex;align-items:center;gap:12px}
.report-timestamp{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px}
.report-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.report-severity-labels{display:flex;justify-content:space-between;font-size:10px;color:var(--vscode-descriptionForeground);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.report-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.report-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.report-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.report-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.report-quick-tile-label{font-size:12px;font-weight:600}
.report-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.report-filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
.report-filters input{flex:1;min-width:180px;padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-size:12px;outline:none}
.report-filters input:focus{border-color:var(--vscode-focusBorder)}
.report-filters select{padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);font-size:12px;outline:none;cursor:pointer}
.report-filters button{padding:8px 12px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:12px;cursor:pointer;font-weight:500}
.report-filters button:hover{background:var(--vscode-button-hoverBackground)}
.report-filters button.secondary{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);color:var(--vscode-foreground)}
.report-tabs{display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:0}
.report-tab{padding:8px 14px;border-radius:6px 6px 0 0;font-size:12px;cursor:pointer;color:var(--vscode-descriptionForeground);border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s}
.report-tab:hover{color:var(--vscode-foreground);background:var(--vscode-list-hoverBackground)}
.report-tab.active{color:var(--vscode-foreground);border-bottom-color:var(--vscode-focusBorder);font-weight:600}
.report-section{display:none}
.report-section.active{display:block}
.report-findings-list{max-height:420px;overflow:auto}
.report-finding-item{padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);margin-bottom:6px;cursor:pointer;transition:background .15s}
.report-finding-item:hover{background:var(--vscode-list-hoverBackground)}
.report-finding-header{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.report-finding-sev{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.report-finding-sev.critical{background:#c75450}
.report-finding-sev.high{background:#d7a24c}
.report-finding-sev.medium{background:#007acc}
.report-finding-sev.low{background:#89d185}
.report-finding-title{font-weight:600;font-size:12px;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.report-finding-meta{font-size:11px;color:var(--vscode-descriptionForeground);display:flex;gap:12px;flex-wrap:wrap}
.report-finding-detail{padding:8px 0 0 18px;font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.5;display:none}
.report-finding-item.expanded .report-finding-detail{display:block}
.report-finding-item.expanded .report-finding-title{white-space:normal}
.report-file-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.report-file-card{padding:12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px}
.report-file-name{font-weight:600;margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.report-file-meta{font-size:11px;color:var(--vscode-descriptionForeground)}
.report-category-list{display:flex;flex-direction:column;gap:8px}
.report-category-item{padding:12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.report-category-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.report-category-name{font-weight:600;font-size:12px}
.report-category-count{font-size:11px;color:var(--vscode-descriptionForeground);background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:2px 8px;border-radius:10px}
.report-category-bar{height:4px;border-radius:2px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);overflow:hidden}
.report-category-fill{height:100%;background:var(--vscode-progressBar-background,#007acc);transition:width .3s}
@media (max-width: 700px) {
  .report-filters{flex-direction:column;align-items:stretch}
  .report-filters input{width:100%}
  .report-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Certificate Pane Styles */
.cert-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.cert-hero-left{flex:1}
.cert-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.cert-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.cert-hero-right{display:flex;align-items:center;gap:12px}
.cert-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.cert-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.cert-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.cert-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.cert-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.cert-quick-tile-label{font-size:12px;font-weight:600}
.cert-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.cert-requirements{margin-bottom:20px}
.cert-req-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.cert-req-list{display:flex;flex-direction:column;gap:6px}
.cert-req-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px}
.cert-req-check{width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.cert-req-check.pass{background:var(--sb-success);color:var(--vscode-button-foreground)}
.cert-req-check.fail{background:var(--sb-danger);color:var(--vscode-button-foreground)}
.cert-req-check.pending{background:var(--sb-warning);color:var(--vscode-editor-background)}
.cert-req-text{flex:1}
.cert-req-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.cert-preview{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.cert-preview-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.cert-preview-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .cert-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Code Map Pane Styles — Modern Redesign */
.map-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.map-hero-left{flex:1}
.map-hero-left h2{font-size:22px;font-weight:700;margin-bottom:6px;letter-spacing:-0.3px}
.map-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.map-hero-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.map-status-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.map-status-badge::before{content:'';width:8px;height:8px;border-radius:50%}
.map-status-badge.generated::before{background:#89d185}
.map-status-badge.generated{background:rgba(137,209,133,.12);border-color:rgba(137,209,133,.35);color:#89d185}
.map-status-badge.pending::before{background:#d7a24c}
.map-status-badge.pending{background:rgba(215,162,76,.12);border-color:rgba(215,162,76,.35);color:#d7a24c}
.map-status-badge.fail::before{background:#c75450}
.map-status-badge.fail{background:rgba(199,84,80,.12);border-color:rgba(199,84,80,.35);color:#c75450}
.map-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.map-action-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:600;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:1px solid transparent;cursor:pointer;transition:all .15s}
.map-action-btn:hover{background:var(--vscode-button-hoverBackground);transform:translateY(-1px)}
.map-action-btn.secondary{background:var(--vscode-panel-background);color:var(--vscode-foreground);border:1px solid var(--vscode-panel-border)}
.map-action-btn.secondary:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
.map-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.map-kpi-card{position:relative;padding:18px;border-radius:12px;background:linear-gradient(145deg,var(--vscode-panel-background) 0%,rgba(255,255,255,.02) 100%);border:1px solid var(--vscode-panel-border);overflow:hidden;transition:transform .15s,border-color .15s}
.map-kpi-card:hover{transform:translateY(-2px);border-color:var(--vscode-focusBorder)}
.map-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent,#0e639c);opacity:.7}
.map-kpi-card.files::before{background:#89d185}
.map-kpi-card.languages::before{background:#38bdf8}
.map-kpi-card.modules::before{background:#a78bfa}
.map-kpi-card.dependencies::before{background:#f48771}
.map-kpi-icon{font-size:20px;margin-bottom:10px;opacity:.9}
.map-kpi-value{font-size:28px;font-weight:800;line-height:1;margin-bottom:4px;letter-spacing:-0.5px}
.map-kpi-value.files{color:#89d185}
.map-kpi-value.languages{color:#38bdf8}
.map-kpi-value.modules{color:#a78bfa}
.map-kpi-value.dependencies{color:#f48771}
.map-kpi-label{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px}
.map-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start;margin-bottom:24px}
.map-main{display:flex;flex-direction:column;gap:20px}
.map-side{display:flex;flex-direction:column;gap:20px}
.map-section{padding:18px;border-radius:12px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.map-section-title{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:14px;color:var(--vscode-foreground)}
.map-section-title .count{font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground);background:var(--vscode-editor-background);padding:3px 8px;border-radius:12px}
.map-graph-frame{height:500px;border-radius:10px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative}
.map-graph-frame iframe{width:100%;height:100%;border:none}
.map-graph-frame canvas{width:100%;height:100%;display:block}
.graph-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--vscode-descriptionForeground);font-size:13px;background:var(--vscode-editor-background);z-index:1}
.map-graph-frame.has-graph .graph-empty{display:none}
.graph-legend-overlay{position:absolute;top:10px;right:10px;background:rgba(15,23,42,0.85);border:1px solid var(--vscode-panel-border);border-radius:8px;padding:8px 10px;font-size:11px;color:var(--vscode-foreground);display:flex;flex-direction:column;gap:6px;z-index:2}
.graph-legend-item{display:flex;align-items:center;gap:6px}
.graph-legend-dot{width:8px;height:8px;border-radius:50%}
.graph-controls{position:absolute;top:10px;left:10px;background:rgba(15,23,42,0.85);border:1px solid var(--vscode-panel-border);border-radius:8px;padding:6px 8px;display:flex;align-items:center;gap:6px;z-index:3;flex-wrap:wrap}
.graph-controls button{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;transition:background .15s}
.graph-controls button:hover{background:var(--vscode-button-hoverBackground)}
.graph-controls button.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:transparent}
.graph-controls input{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:4px 8px;font-size:11px;width:100px;outline:none}
.graph-controls input:focus{border-color:var(--vscode-focusBorder)}
.graph-controls span{color:var(--vscode-descriptionForeground);font-size:10px}
.map-graph-empty{text-align:center;padding:30px;color:var(--vscode-descriptionForeground)}
.map-graph-empty-icon{font-size:40px;margin-bottom:12px;opacity:.3}
.map-sev-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.map-sev-card{display:flex;flex-direction:column;align-items:center;padding:14px;border-radius:10px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);text-align:center}
.map-sev-card.crit{border-top:3px solid #c75450}
.map-sev-card.high{border-top:3px solid #d7a24c}
.map-sev-card.med{border-top:3px solid #007acc}
.map-sev-card.low{border-top:3px solid #89d185}
.map-sev-count{font-size:24px;font-weight:800;margin-bottom:2px}
.map-sev-count.crit{color:#c75450}
.map-sev-count.high{color:#d7a24c}
.map-sev-count.med{color:#007acc}
.map-sev-count.low{color:#89d185}
.map-sev-name{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px}
.map-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.map-info-item{padding:14px;border-radius:10px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border)}
.map-info-label{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.map-info-value{font-size:15px;font-weight:700;color:var(--vscode-foreground)}
.map-lang-list{display:flex;flex-direction:column;gap:10px}
.map-lang-row{display:flex;align-items:center;gap:12px}
.map-lang-name{width:70px;font-size:12px;font-weight:600;color:var(--vscode-foreground);flex-shrink:0}
.map-lang-bar{flex:1;height:8px;border-radius:4px;background:var(--vscode-editor-background);overflow:hidden}
.map-lang-fill{height:100%;border-radius:4px;transition:width .4s ease}
.map-lang-count{width:50px;text-align:right;font-size:12px;font-weight:700;color:var(--vscode-foreground);flex-shrink:0}
.map-analysis-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.map-analysis-card{padding:14px;border-radius:10px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border)}
.map-analysis-label{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.map-analysis-val{font-size:22px;font-weight:800;color:var(--vscode-foreground);margin-bottom:6px}
.map-analysis-list{font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.5;max-height:60px;overflow:hidden;text-overflow:ellipsis}
.map-tree-list{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;padding-right:4px}
.map-tree-node{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);font-size:12px;transition:background .15s}
.map-tree-node:hover{background:var(--vscode-list-hoverBackground)}
.map-tree-node.level-2{margin-left:16px}
.map-tree-node.level-3{margin-left:32px}
.map-tree-icon{font-size:14px;flex-shrink:0}
.map-tree-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.map-tree-meta{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.map-preview{padding:40px 20px;border-radius:12px;background:var(--vscode-panel-background);border:1px dashed var(--vscode-panel-border);text-align:center}
.map-preview-icon{font-size:56px;margin-bottom:16px;opacity:.3}
.map-preview-text{font-size:14px;color:var(--vscode-descriptionForeground);max-width:360px;margin:0 auto 16px}
.map-preview-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;cursor:pointer}
.map-preview-btn:hover{background:var(--vscode-button-hoverBackground)}
@media (max-width: 900px) {
  .map-layout{grid-template-columns:1fr}
  .map-kpi-grid{grid-template-columns:repeat(2,1fr)}
  .map-info-grid{grid-template-columns:1fr}
  .map-sev-row{grid-template-columns:repeat(2,1fr)}
}
@media (max-width: 500px) {
  .map-kpi-grid{grid-template-columns:1fr}
  .map-hero{flex-direction:column;align-items:flex-start}
}
/* Roadmap Pane Styles */
.road-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.road-hero-left{flex:1}
.road-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.road-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.road-hero-right{display:flex;align-items:center;gap:12px}
.road-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.road-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.road-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.road-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.road-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.road-quick-tile-label{font-size:12px;font-weight:600}
.road-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.road-phases{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}
.road-phase{padding:14px 16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.road-phase-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.road-phase-title{font-size:13px;font-weight:600}
.road-phase-meta{font-size:11px;color:var(--vscode-descriptionForeground)}
.road-phase-bar{height:6px;border-radius:3px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);overflow:hidden;margin-bottom:8px}
.road-phase-fill{height:100%;background:var(--vscode-progressBar-background,#007acc);width:0%;transition:width .3s}
.road-phase-items{display:flex;flex-direction:column;gap:6px}
.road-phase-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:var(--vscode-editor-background);font-size:12px}
.road-item-sev{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.road-item-sev.critical{background:#c75450}
.road-item-sev.high{background:#d7a24c}
.road-item-sev.medium{background:#007acc}
.road-item-sev.low{background:#89d185}
.road-item-text{flex:1}
.road-item-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.road-empty{text-align:center;padding:40px;color:var(--vscode-descriptionForeground);font-size:13px}
.road-empty-icon{font-size:40px;margin-bottom:12px;opacity:.3}
@media (max-width: 700px) {
  .road-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* AI Context Pane Styles */
.ai-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.ai-hero-left{flex:1}
.ai-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.ai-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.ai-hero-right{display:flex;align-items:center;gap:12px}
.ai-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.ai-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.ai-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.ai-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.ai-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.ai-quick-tile-label{font-size:12px;font-weight:600}
.ai-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.ai-models{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.ai-models-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.ai-model-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px}
.ai-model-icon{width:28px;height:28px;border-radius:50%;background:var(--vscode-button-background);color:var(--vscode-button-foreground);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.ai-model-info{flex:1}
.ai-model-name{font-weight:600;margin-bottom:2px}
.ai-model-meta{font-size:11px;color:var(--vscode-descriptionForeground)}
.ai-model-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.ai-context-preview{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.ai-context-preview-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.ai-context-preview-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .ai-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Upload Pane Styles */
.up-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.up-hero-left{flex:1}
.up-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.up-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.up-hero-right{display:flex;align-items:center;gap:12px}
.up-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.up-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.up-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.up-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.up-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.up-quick-tile-label{font-size:12px;font-weight:600}
.up-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.up-dropzone{padding:32px 16px;border-radius:10px;background:var(--vscode-panel-background);border:2px dashed var(--vscode-panel-border);text-align:center;margin-bottom:20px;cursor:pointer;transition:all .15s}
.up-dropzone:hover{border-color:var(--vscode-focusBorder);background:var(--vscode-list-hoverBackground)}
.up-dropzone.dragover{border-color:var(--primary);background:var(--vscode-list-activeSelectionBackground);border-style:solid}
.up-dropzone-icon{font-size:40px;margin-bottom:12px;opacity:.5}
.up-dropzone-text{font-size:13px;color:var(--vscode-descriptionForeground);margin-bottom:4px}
.up-dropzone-hint{font-size:11px;color:var(--vscode-descriptionForeground);opacity:.7}
.up-progress{display:none;margin-bottom:20px}
.up-progress.active{display:block}
.up-progress-bar{height:8px;border-radius:4px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);overflow:hidden;margin-bottom:8px}
.up-progress-fill{height:100%;background:var(--vscode-progressBar-background,#007acc);width:0%;transition:width .3s}
.up-progress-text{font-size:11px;color:var(--vscode-descriptionForeground);display:flex;justify-content:space-between}
.up-results{display:none}
.up-results.active{display:block}
.up-results-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.up-result-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;margin-bottom:6px}
.up-result-icon{font-size:14px;flex-shrink:0}
.up-result-text{flex:1}
.up-result-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
@media (max-width: 700px) {
  .up-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Audit Pane Styles */
.aud-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.aud-hero-left{flex:1}
.aud-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.aud-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.aud-hero-right{display:flex;align-items:center;gap:12px}
.aud-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.aud-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.aud-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.aud-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.aud-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.aud-quick-tile-label{font-size:12px;font-weight:600}
.aud-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.aud-findings{margin-bottom:20px}
.aud-findings-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.aud-finding-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);margin-bottom:6px;cursor:pointer;transition:background .15s}
.aud-finding-item:hover{background:var(--vscode-list-hoverBackground)}
.aud-finding-sev{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.aud-finding-sev.critical{background:#c75450}
.aud-finding-sev.high{background:#d7a24c}
.aud-finding-sev.medium{background:#007acc}
.aud-finding-sev.low{background:#89d185}
.aud-finding-text{flex:1;font-size:12px}
.aud-finding-file{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.aud-severity-bar{display:flex;gap:8px;margin-bottom:20px;padding:10px 12px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.aud-sev-segment{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;background:var(--vscode-editor-background);font-size:12px;flex:1;justify-content:center}
.aud-sev-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.aud-sev-segment.critical .aud-sev-dot{background:#c75450}
.aud-sev-segment.high .aud-sev-dot{background:#d7a24c}
.aud-sev-segment.medium .aud-sev-dot{background:#007acc}
.aud-sev-segment.low .aud-sev-dot{background:#89d185}
.aud-sev-count{font-weight:700;margin-right:2px}
.aud-sev-label{color:var(--vscode-descriptionForeground)}
.aud-findings-header{display:grid;grid-template-columns:80px 100px 1fr 140px;gap:10px;padding:6px 12px;font-size:10px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--vscode-panel-border);margin-bottom:6px}
.aud-finding-badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase}
.aud-finding-badge.critical{background:rgba(199,84,80,.15);color:#c75450}
.aud-finding-badge.high{background:rgba(215,162,76,.15);color:#d7a24c}
.aud-finding-badge.medium{background:rgba(0,122,204,.15);color:#007acc}
.aud-finding-badge.low{background:rgba(137,209,133,.15);color:#89d185}
.aud-finding-badge.pending{background:var(--vscode-panel-background);color:var(--vscode-descriptionForeground)}
.aud-finding-type{font-size:11px;color:var(--vscode-descriptionForeground);width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aud-categories{margin-bottom:20px}
.aud-cat-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.aud-cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.aud-cat-card{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.aud-cat-icon{font-size:20px;margin-bottom:6px;display:block}
.aud-cat-name{font-size:12px;font-weight:600}
.aud-cat-count{font-size:18px;font-weight:700;color:var(--vscode-foreground);display:block;margin-top:4px}
.aud-recommendations{margin-bottom:20px}
.aud-rec-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.aud-rec-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;margin-bottom:6px}
.aud-rec-icon{font-size:16px;flex-shrink:0;margin-top:2px}
.aud-rec-text{flex:1}
.aud-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.aud-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.aud-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .aud-quick-actions{grid-template-columns:repeat(2,1fr)}
  .aud-cat-grid{grid-template-columns:repeat(2,1fr)}
  .aud-findings-header{display:none}
}
/* Security Pane Styles */
.sec-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.sec-hero-left{flex:1}
.sec-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.sec-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.sec-hero-right{display:flex;align-items:center;gap:12px}
.sec-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.sec-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.sec-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.sec-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.sec-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.sec-quick-tile-label{font-size:12px;font-weight:600}
.sec-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.sec-threats{margin-bottom:20px}
.sec-threats-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.sec-threat-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);margin-bottom:6px;cursor:pointer;transition:background .15s}
.sec-threat-item:hover{background:var(--vscode-list-hoverBackground)}
.sec-threat-sev{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sec-threat-sev.critical{background:#c75450}
.sec-threat-sev.high{background:#d7a24c}
.sec-threat-sev.medium{background:#007acc}
.sec-threat-sev.low{background:#89d185}
.sec-threat-text{flex:1;font-size:12px}
.sec-threat-file{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.sec-threats-empty{padding:24px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.sec-threats-empty-icon{font-size:40px;margin-bottom:10px;opacity:.3}
.sec-threats-empty-title{font-size:14px;font-weight:600;margin-bottom:4px;color:var(--vscode-foreground)}
.sec-threats-empty-text{font-size:12px;color:var(--vscode-descriptionForeground)}
.sec-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.sec-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.sec-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .sec-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Trust Pane Styles */
.trust-layout{display:flex;gap:16px}
.trust-sidebar{width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
.trust-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.trust-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:12px;border-bottom:1px solid var(--vscode-panel-border)}
.trust-hero-left{flex:1}
.trust-hero-left h2{font-size:18px;font-weight:700;margin-bottom:4px;letter-spacing:-0.01em}
.trust-hero-sub{font-size:12px;color:var(--vscode-descriptionForeground);margin:0}
.trust-hero-right{display:flex;align-items:center;gap:8px}
.trust-score-card{padding:16px;border-radius:12px;background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.04));border:1px solid rgba(16,185,129,0.2);text-align:center;margin-bottom:4px}
.trust-score-card.warn{background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.04));border-color:rgba(245,158,11,0.25)}
.trust-score-card.fail{background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.04));border-color:rgba(239,68,68,0.25)}
.trust-score-top{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--vscode-descriptionForeground);margin-bottom:8px;font-weight:600}
.trust-score-num{font-size:36px;font-weight:800;line-height:1;color:#10b981}
.trust-score-card.warn .trust-score-num{color:#f59e0b}
.trust-score-card.fail .trust-score-num{color:#ef4444}
.trust-score-label{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px}
.trust-sidebar-actions{display:flex;flex-direction:column;gap:6px}
.trust-sb-btn{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);cursor:pointer;transition:all .15s;font-size:12px;color:var(--vscode-foreground)}
.trust-sb-btn:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
.trust-sb-btn-icon{font-size:16px;width:20px;text-align:center}
.trust-sb-btn-text{flex:1;font-weight:500}
.trust-sb-btn-meta{font-size:10px;color:var(--vscode-descriptionForeground)}
.trust-sev-mini{display:flex;gap:4px;margin-top:4px}
.trust-sev-mini-item{flex:1;text-align:center;padding:6px 4px;border-radius:6px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.trust-sev-mini-count{font-size:14px;font-weight:700}
.trust-sev-mini-count.crit{color:#f48771}
.trust-sev-mini-count.high{color:#d18616}
.trust-sev-mini-count.med{color:#75beff}
.trust-sev-mini-count.low{color:#89d185}
.trust-sev-mini-name{font-size:9px;color:var(--vscode-descriptionForeground);text-transform:uppercase}
.trust-section{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:14px}
.trust-section-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--vscode-panel-border)}
.trust-section-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;background:rgba(99,102,241,0.12);color:#818cf8}
.trust-section-title{font-size:13px;font-weight:700;flex:1}
.trust-badge-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.trust-badge-card{padding:12px;border-radius:10px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);display:flex;align-items:center;gap:10px;transition:all .15s}
.trust-badge-card.unlocked{background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02));border-color:rgba(16,185,129,0.25)}
.trust-badge-card.warn{background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.02));border-color:rgba(245,158,11,0.25)}
.trust-badge-card.locked{opacity:.5}
.trust-badge-card-icon{font-size:20px;width:24px;text-align:center;flex-shrink:0}
.trust-badge-card-info{flex:1;min-width:0}
.trust-badge-card-name{font-size:12px;font-weight:600;margin-bottom:2px}
.trust-badge-card-status{font-size:10px;color:var(--vscode-descriptionForeground)}
.trust-compliance-list{display:flex;flex-direction:column;gap:6px}
.trust-compliance-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:var(--vscode-editor-background);font-size:12px}
.trust-compliance-icon{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.trust-compliance-icon.pass{background:rgba(16,185,129,0.15);color:#10b981}
.trust-compliance-icon.review{background:rgba(245,158,11,0.15);color:#f59e0b}
.trust-compliance-icon.locked{background:var(--vscode-panel-border);color:var(--vscode-descriptionForeground);opacity:.6}
.trust-compliance-text{flex:1}
.trust-compliance-name{font-weight:600;margin-bottom:1px}
.trust-compliance-desc{font-size:10px;color:var(--vscode-descriptionForeground)}
.trust-compliance-value{font-size:11px;font-weight:600;flex-shrink:0}
.trust-bd-list{display:flex;flex-direction:column;gap:10px}
.trust-bd-row{display:flex;align-items:center;gap:10px;font-size:12px}
.trust-bd-name{width:100px;flex-shrink:0;font-weight:500}
.trust-bd-track{flex:1;height:10px;border-radius:5px;background:var(--vscode-editor-background);overflow:hidden;position:relative}
.trust-bd-fill{height:100%;border-radius:5px;transition:width .3s}
.trust-bd-fill.high{background:linear-gradient(90deg,#10b981,#34d399)}
.trust-bd-fill.med{background:linear-gradient(90deg,#f59e0b,#fbbf24)}
.trust-bd-fill.low{background:linear-gradient(90deg,#ef4444,#f87171)}
.trust-bd-pct{width:36px;text-align:right;font-weight:700;flex-shrink:0;font-size:12px}
.trust-factor-list{display:flex;flex-direction:column;gap:6px}
.trust-factor-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:var(--vscode-editor-background);font-size:12px}
.trust-factor-check{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.trust-factor-check.ok{background:rgba(16,185,129,0.15);color:#10b981}
.trust-factor-check.warn{background:rgba(245,158,11,0.15);color:#f59e0b}
.trust-factor-check.fail{background:rgba(239,68,68,0.15);color:#ef4444}
.trust-factor-check.pending{background:var(--vscode-panel-border);color:var(--vscode-descriptionForeground)}
.trust-factor-name{flex:1;font-weight:500}
.trust-factor-tag{font-size:10px;padding:2px 8px;border-radius:10px;background:var(--vscode-panel-border);color:var(--vscode-descriptionForeground);flex-shrink:0}
.trust-factor-tag.ok{background:rgba(16,185,129,0.12);color:#10b981}
.trust-factor-tag.warn{background:rgba(245,158,11,0.12);color:#f59e0b}
.trust-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.trust-info-cell{padding:10px;border-radius:8px;background:var(--vscode-editor-background);text-align:center}
.trust-info-cell-value{font-size:16px;font-weight:700;margin-bottom:2px}
.trust-info-cell-label{font-size:10px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:0.3px}
@media (max-width: 700px) {
  .trust-layout{flex-direction:column}
  .trust-sidebar{width:auto}
  .trust-badge-grid{grid-template-columns:repeat(2,1fr)}
  .trust-info-grid{grid-template-columns:repeat(2,1fr)}
}
/* Quality Pane Styles */
.q-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.q-hero-left{flex:1}
.q-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.q-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.q-hero-right{display:flex;align-items:center;gap:12px}
.q-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.q-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.q-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.q-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.q-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.q-quick-tile-label{font-size:12px;font-weight:600}
.q-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.q-metrics{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.q-metrics-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.q-metric-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px}
.q-metric-bar{flex:1;height:6px;border-radius:3px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);overflow:hidden}
.q-metric-fill{height:100%;background:var(--vscode-progressBar-background,#007acc);width:0%;transition:width .3s}
.q-metric-label{flex-shrink:0;font-size:11px;color:var(--vscode-descriptionForeground);min-width:60px}
.q-metric-value{flex-shrink:0;font-size:11px;color:var(--vscode-descriptionForeground);min-width:30px;text-align:right}
.q-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.q-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.q-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .q-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Quality Pane Redesign */
.q-analysis-card{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:16px;margin-bottom:20px}
.q-analysis-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:14px;font-weight:600;color:var(--vscode-foreground)}
.q-analysis-icon{font-size:16px}
.q-analysis-row{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.q-input{flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);color:var(--vscode-foreground);font-size:13px;min-width:120px}
.q-input:focus{outline:none;border-color:var(--vscode-focusBorder)}
.q-select{padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);color:var(--vscode-foreground);font-size:13px}
.q-select:focus{outline:none;border-color:var(--vscode-focusBorder)}
.q-btn-secondary{padding:8px 12px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);color:var(--vscode-foreground);cursor:pointer;font-size:13px}
.q-btn-secondary:hover{background:var(--vscode-list-hoverBackground)}
.q-checkbox{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--vscode-descriptionForeground);cursor:pointer}
.q-btn-primary{width:100%;padding:10px 16px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:600;cursor:pointer;font-size:13px}
.q-btn-primary:hover{background:var(--vscode-button-hoverBackground)}

.q-overview{display:grid;grid-template-columns:minmax(180px,1fr) 2fr;gap:20px;margin-bottom:20px}
.q-score-ring-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:20px}
.q-score-ring{position:relative;width:140px;height:140px}
.q-score-svg{width:100%;height:100%;transform:rotate(-90deg)}
.q-score-bg{fill:none;stroke:var(--vscode-panel-border);stroke-width:3}
.q-score-fg{fill:none;stroke:var(--vscode-progressBar-background,#007acc);stroke-width:3;stroke-linecap:round;transition:stroke-dasharray .5s ease,stroke .3s}
.q-score-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.q-score-value{font-size:32px;font-weight:700;color:var(--vscode-foreground)}
.q-score-label{font-size:12px;color:var(--vscode-descriptionForeground)}
.q-score-summary{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--vscode-descriptionForeground)}
.q-score-summary-item{display:flex;align-items:center;gap:6px}
.q-score-summary-dot{width:8px;height:8px;border-radius:50%}
.q-score-summary-dot.pass{background:#89d185}
.q-score-summary-dot.warn{background:#f59e0b}

.q-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.q-kpi-card{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
.q-kpi-card .q-kpi-value{font-size:24px;font-weight:700;color:var(--vscode-foreground);margin:6px 0 2px}
.q-kpi-card .q-kpi-label{font-size:11px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px}

.q-dimensions{margin-bottom:20px}
.q-section-title{font-size:14px;font-weight:600;margin-bottom:12px;color:var(--vscode-foreground)}
.q-dim-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.q-dim-card{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:14px}
.q-dim-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.q-dim-name{font-size:13px;font-weight:600;color:var(--vscode-foreground)}
.q-dim-value{font-size:13px;font-weight:700;color:var(--vscode-foreground)}
.q-dim-bar{height:6px;border-radius:3px;background:var(--vscode-editor-background);overflow:hidden;margin-bottom:8px}
.q-dim-fill{height:100%;border-radius:3px;background:var(--vscode-progressBar-background,#007acc);transition:width .3s}
.q-dim-desc{font-size:11px;color:var(--vscode-descriptionForeground)}

@media (max-width: 700px) {
  .q-overview{grid-template-columns:1fr}
  .q-dim-grid{grid-template-columns:1fr}
  .q-kpi-grid{grid-template-columns:repeat(2,1fr)}
}
/* Assessments Pane Styles */
.asst-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.asst-hero-left{flex:1}
.asst-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.asst-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.asst-hero-right{display:flex;align-items:center;gap:12px}
.asst-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.asst-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.asst-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.asst-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.asst-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.asst-quick-tile-label{font-size:12px;font-weight:600}
.asst-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.asst-checklist{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.asst-checklist-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.asst-check-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;cursor:pointer;transition:background .15s}
.asst-check-item:hover{background:var(--vscode-list-hoverBackground)}
.asst-check-box{width:16px;height:16px;border-radius:4px;border:2px solid var(--vscode-panel-border);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.asst-check-box.checked{background:var(--vscode-button-background);border-color:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.asst-check-text{flex:1}
.asst-check-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.asst-progress-wrap{margin-bottom:20px;padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.asst-progress-labels{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px}
.asst-progress-title{font-weight:600}
.asst-progress-value{font-weight:700;color:var(--vscode-foreground)}
.asst-progress-bar{height:10px;border-radius:5px;background:var(--vscode-editor-background);overflow:hidden}
.asst-progress-fill{height:100%;border-radius:5px;background:var(--vscode-progressBar-background,#007acc);transition:width .3s}
.asst-categories{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.asst-cat-card{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.asst-cat-icon{font-size:20px;margin-bottom:6px;display:block}
.asst-cat-name{font-size:12px;font-weight:600}
.asst-cat-count{font-size:18px;font-weight:700;color:var(--vscode-foreground);display:block;margin-top:4px}
.asst-cat-bar{height:6px;border-radius:3px;background:var(--vscode-editor-background);overflow:hidden;margin-top:8px}
.asst-cat-fill{height:100%;border-radius:3px;background:var(--vscode-progressBar-background,#007acc);transition:width .3s}
.asst-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.asst-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.asst-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .asst-quick-actions{grid-template-columns:repeat(2,1fr)}
  .asst-categories{grid-template-columns:repeat(2,1fr)}
}
/* Platform Pane Styles */
.plat-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.plat-hero-left{flex:1}
.plat-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.plat-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.plat-hero-right{display:flex;align-items:center;gap:12px}
.plat-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.plat-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.plat-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.plat-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.plat-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.plat-quick-tile-label{font-size:12px;font-weight:600}
.plat-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.plat-info{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.plat-info-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.plat-info-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px}
.plat-info-icon{font-size:14px;flex-shrink:0}
.plat-info-label{flex-shrink:0;font-weight:600;min-width:100px}
.plat-info-value{flex:1;color:var(--vscode-descriptionForeground)}
.plat-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.plat-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.plat-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .plat-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Compliance Pane Styles */
.comp-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.comp-hero-left{flex:1}
.comp-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.comp-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.comp-hero-right{display:flex;align-items:center;gap:12px}
.comp-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.comp-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.comp-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.comp-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.comp-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.comp-quick-tile-label{font-size:12px;font-weight:600}
.comp-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.comp-requirements{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.comp-req-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.comp-req-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;cursor:pointer;transition:background .15s}
.comp-req-item:hover{background:var(--vscode-list-hoverBackground)}
.comp-req-sev{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.comp-req-sev.critical{background:#c75450}
.comp-req-sev.high{background:#d7a24c}
.comp-req-sev.medium{background:#007acc}
.comp-req-sev.low{background:#89d185}
.comp-req-text{flex:1}
.comp-req-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.comp-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.comp-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.comp-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .comp-quick-actions{grid-template-columns:repeat(2,1fr)}
}
/* Analytics Pane Styles */
.an-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.an-hero-left{flex:1}
.an-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.an-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.an-hero-right{display:flex;align-items:center;gap:12px}
.an-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.an-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.an-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.an-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.an-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.an-quick-tile-label{font-size:12px;font-weight:600}
.an-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.an-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px}
.an-stat-card{padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.an-stat-title{font-size:12px;font-weight:600;margin-bottom:8px}
.an-stat-value{font-size:22px;font-weight:700;color:var(--vscode-foreground)}
.an-stat-delta{font-size:11px;color:var(--vscode-descriptionForeground)}
.an-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.an-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.an-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
/* Team Pane Styles */
.tm-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.tm-hero-left{flex:1}
.tm-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.tm-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.tm-hero-right{display:flex;align-items:center;gap:12px}
.tm-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.tm-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.tm-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.tm-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.tm-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.tm-quick-tile-label{font-size:12px;font-weight:600}
.tm-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.tm-members{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.tm-members-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.tm-member-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px}
.tm-member-avatar{width:28px;height:28px;border-radius:50%;background:var(--vscode-button-background);color:var(--vscode-button-foreground);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}
.tm-member-info{flex:1}
.tm-member-name{font-weight:600}
.tm-member-role{font-size:11px;color:var(--vscode-descriptionForeground)}
.tm-member-status{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.tm-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.tm-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.tm-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
/* Scan Pane Styles */
.sc-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.sc-hero-left{flex:1}
.sc-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.sc-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.sc-hero-right{display:flex;align-items:center;gap:12px}
.sc-kpi-icon{font-size:22px;margin-bottom:6px;opacity:.8}
.sc-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.sc-quick-tile{padding:14px 10px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center;cursor:pointer;transition:all .15s}
.sc-quick-tile:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-2px)}
.sc-quick-tile-icon{font-size:20px;margin-bottom:6px;display:block}
.sc-quick-tile-label{font-size:12px;font-weight:600}
.sc-quick-tile-desc{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px}
.sc-severity-bar{display:flex;gap:8px;margin-bottom:20px;padding:10px 12px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.sc-sev-segment{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;background:var(--vscode-editor-background);font-size:12px;flex:1;justify-content:center}
.sc-sev-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sc-sev-segment.critical .sc-sev-dot{background:#c75450}
.sc-sev-segment.high .sc-sev-dot{background:#d7a24c}
.sc-sev-segment.medium .sc-sev-dot{background:#007acc}
.sc-sev-segment.low .sc-sev-dot{background:#89d185}
.sc-sev-count{font-weight:700;margin-right:2px}
.sc-sev-label{color:var(--vscode-descriptionForeground)}
.sc-progress{display:none;margin-bottom:20px}
.sc-progress.active{display:block}
.sc-progress-bar{height:8px;border-radius:4px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);overflow:hidden;margin-bottom:8px}
.sc-progress-fill{height:100%;background:var(--vscode-progressBar-background,#007acc);width:0%;transition:width .3s}
.sc-progress-text{font-size:11px;color:var(--vscode-descriptionForeground);display:flex;justify-content:space-between}
.sc-results{display:none}
.sc-results.active{display:block}
.sc-results-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.sc-results-header{display:grid;grid-template-columns:100px 1fr 80px 140px;gap:10px;padding:6px 12px;font-size:10px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--vscode-panel-border);margin-bottom:6px}
.sc-result-item{display:grid;grid-template-columns:100px 1fr 80px 140px;gap:10px;align-items:center;padding:8px 12px;border-radius:6px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;margin-bottom:6px}
.sc-result-type{font-size:11px;color:var(--vscode-descriptionForeground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-result-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-result-badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase}
.sc-result-badge.critical{background:rgba(199,84,80,.15);color:#c75450}
.sc-result-badge.high{background:rgba(215,162,76,.15);color:#d7a24c}
.sc-result-badge.medium{background:rgba(0,122,204,.15);color:#007acc}
.sc-result-badge.low{background:rgba(137,209,133,.15);color:#89d185}
.sc-result-badge.pending{background:var(--vscode-panel-background);color:var(--vscode-descriptionForeground)}
.sc-result-file{font-size:11px;color:var(--vscode-descriptionForeground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-history{margin-bottom:20px}
.sc-history-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.sc-history-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);font-size:12px;margin-bottom:6px}
.sc-history-icon{font-size:14px;flex-shrink:0}
.sc-history-text{flex:1}
.sc-history-time{font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.sc-history-score{font-size:12px;font-weight:700;flex-shrink:0}
.sc-summary{padding:16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);text-align:center}
.sc-summary-icon{font-size:48px;margin-bottom:12px;opacity:.3}
.sc-summary-text{font-size:13px;color:var(--vscode-descriptionForeground)}
@media (max-width: 700px) {
  .an-quick-actions,.tm-quick-actions,.sc-quick-actions{grid-template-columns:repeat(2,1fr)}
  .an-stats{grid-template-columns:1fr}
  .sc-results-header{display:none}
  .sc-result-item{grid-template-columns:1fr}
}
/* Scan Pane Redesign */
.sc-analysis-card{background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);border-radius:12px;padding:16px;margin-bottom:20px}
.sc-analysis-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:14px;font-weight:600;color:var(--vscode-foreground)}
.sc-analysis-icon{font-size:16px}
.sc-analysis-row{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.sc-input{flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);color:var(--vscode-foreground);font-size:13px;min-width:120px}
.sc-input:focus{outline:none;border-color:var(--vscode-focusBorder)}
.sc-select{padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);color:var(--vscode-foreground);font-size:13px}
.sc-select:focus{outline:none;border-color:var(--vscode-focusBorder)}
.sc-btn-secondary{padding:8px 12px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);color:var(--vscode-foreground);cursor:pointer;font-size:13px}
.sc-btn-secondary:hover{background:var(--vscode-list-hoverBackground)}
.sc-checkbox{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--vscode-descriptionForeground);cursor:pointer}
.sc-btn-primary{width:100%;padding:10px 16px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:600;cursor:pointer;font-size:13px}
.sc-btn-primary:hover{background:var(--vscode-button-hoverBackground)}
.sc-status-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border);margin-bottom:20px}
.sc-status-left{display:flex;align-items:center;gap:10px}
.sc-status-dot{width:10px;height:10px;border-radius:50%;background:var(--vscode-descriptionForeground);transition:background .3s}
.sc-status-dot.running{background:#007acc;animation:pulse 1.5s infinite}
.sc-status-dot.complete{background:#89d185}
.sc-status-dot.error{background:#c75450}
.sc-status-text{font-size:13px;font-weight:600;color:var(--vscode-foreground)}
.sc-status-right{font-size:12px;color:var(--vscode-descriptionForeground)}
/* Settings Pane Styles */
.st-hero{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--vscode-panel-border)}
.st-hero-left{flex:1}
.st-hero-left h2{font-size:20px;font-weight:600;margin-bottom:4px}
.st-hero-sub{font-size:13px;color:var(--vscode-descriptionForeground);margin:0}
.st-section{margin-bottom:20px;padding:14px;border-radius:10px;background:var(--vscode-panel-background);border:1px solid var(--vscode-panel-border)}
.st-section-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--vscode-foreground)}
.st-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--vscode-panel-border);font-size:12px}
.st-row:last-child{border-bottom:none}
.st-row-label{flex:1}
.st-row-desc{font-size:11px;color:var(--vscode-descriptionForeground)}
.st-toggle{width:36px;height:20px;border-radius:10px;background:var(--vscode-panel-border);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.st-toggle.on{background:var(--vscode-button-background)}
.st-toggle-knob{width:16px;height:16px;border-radius:50%;background:var(--vscode-button-foreground);position:absolute;top:2px;left:2px;transition:left .2s}
.st-toggle.on .st-toggle-knob{left:18px}
.st-input{width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-size:12px;margin-top:6px;outline:none}
.st-input:focus{border-color:var(--vscode-focusBorder)}
.st-select{padding:8px 10px;border-radius:6px;border:1px solid var(--vscode-panel-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-size:12px;outline:none;cursor:pointer}
.st-select:focus{border-color:var(--vscode-focusBorder)}
.st-btn{padding:8px 14px;border-radius:6px;border:none;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:12px;cursor:pointer;margin-top:8px}
.st-btn:hover{background:var(--vscode-button-hoverBackground)}
</style>
</head>
<body>
<div class="tab-bar" id="tabBar">
  <div style="display:flex;gap:4px;" id="tabBarLeft">
    <div class="tab active" data-pane="welcomePane"><span class="tab-label">Welcome</span></div>
  </div>
  <div style="display:flex;align-items:center;gap:4px;">
    <button class="tab-close-btn" id="tabCloseBtn" title="Close current tab">&#10006;</button>
    <div class="tab-nav-arrows">
      <button class="tab-arrow" id="tabArrowLeft" title="Previous tab">&#9664;</button>
      <button class="tab-arrow" id="tabArrowRight" title="Next tab">&#9654;</button>
    </div>
  </div>
</div>
<div class="pane active" id="welcomePane">
  <div style="max-width:960px;margin:0 auto;padding:16px">
  <div class="welcome" style="height:auto;padding:24px 0">
    <div class="welcome-map" style="font-size:120px;">&#x1F5FA;</div>
    <h1>SimpleBeacon AI Slop Cop</h1>
    <div class="btn-grid">
      <button id="openDashboard"><span class="btn-icon">&#9776;</span><span class="btn-label">Dashboard</span></button>
      <button id="openAnalyze"><span class="btn-icon">&#128340;</span><span class="btn-label">Analyze</span></button>
      <button id="openReport"><span class="btn-icon">&#128196;</span><span class="btn-label">Report</span></button>
      <button id="openCertificate"><span class="btn-icon">&#128274;</span><span class="btn-label">Certificate</span></button>
      <button id="openCodeMap"><span class="btn-icon">&#128506;</span><span class="btn-label">Code Map</span></button>
      <button id="openRoadmap"><span class="btn-icon">&#128739;</span><span class="btn-label">Roadmap</span></button>
      <button id="openAiContext"><span class="btn-icon">&#129302;</span><span class="btn-label">AI Context</span></button>
      <button id="openUpload"><span class="btn-icon">&#11123;</span><span class="btn-label">Upload</span></button>
      <button id="openAudit"><span class="btn-icon">&#128221;</span><span class="btn-label">Audit</span></button>
      <button id="openSecurity"><span class="btn-icon">&#128274;</span><span class="btn-label">Security</span></button>
      <button id="openTrust"><span class="btn-icon">&#128504;</span><span class="btn-label">Trust</span></button>
      <button id="openQuality"><span class="btn-icon">&#11088;</span><span class="btn-label">Quality</span></button>
      <button id="openAssessments"><span class="btn-icon">&#9989;</span><span class="btn-label">Assessments</span></button>
      <button id="openPlatform"><span class="btn-icon">&#128187;</span><span class="btn-label">Platform</span></button>
      <button id="openProfile"><span class="btn-icon">&#128100;</span><span class="btn-label">Profile</span></button>
      <button id="openCompliance"><span class="btn-icon">&#128737;</span><span class="btn-label">Compliance</span></button>
      <button id="openRepoHealth"><span class="btn-icon">&#128200;</span><span class="btn-label">Repo Health</span></button>
      <button id="openAnalytics"><span class="btn-icon">&#128202;</span><span class="btn-label">Analytics</span></button>
      <button id="openTeam"><span class="btn-icon">&#128101;</span><span class="btn-label">Team</span></button>
      <button id="openScan"><span class="btn-icon">&#128269;</span><span class="btn-label">Scan</span></button>
      <button id="openSettings"><span class="btn-icon">&#9881;</span><span class="btn-label">Settings</span></button>
      <button id="openTeamDashboard"><span class="btn-icon">&#128101;</span><span class="btn-label">Team Dashboard</span></button>
      <button id="openPreviewWindow"><span class="btn-icon">&#127760;</span><span class="btn-label">Preview</span></button>
    </div>
    <label class="welcome-checkbox"><input type="checkbox" id="showWelcomeCheckbox" ${showWelcomeChecked} /><span>Show this screen every time AI Slop Cop loads</span></label>
  </div>
</div>
</div>
<div class="pane" id="dashboardPane">
  <div class="db-container">
    <div class="db-hero">
      <div class="db-hero-left">
        <h2>Dashboard</h2>
        <p class="db-hero-sub">Overview of your codebase health, scan results, and quick actions.</p>
      </div>
      <div class="db-hero-right">
        <div class="db-scan-status">
          <span class="db-scan-dot idle" id="dashScanDot"></span>
          <span id="dashScanStatus">Ready to scan</span>
        </div>
        <span class="db-gate-badge db-gate-pending" id="dashGateBadge">Pending</span>
        <button class="db-export-btn" id="dashExportBtn">Export</button>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="statScore" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Quality Score</div>
        <div class="db-kpi-trend" id="trendScore">No data</div>
      </div>
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128310;</div>
        <div class="db-kpi-value" id="statGate">--</div>
        <div class="db-kpi-label">Gate Status</div>
        <div class="db-kpi-trend" id="trendGate">Run a scan</div>
      </div>
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="statIssues" style="color:var(--vscode-errorForeground)">0</div>
        <div class="db-kpi-label">Total Issues</div>
        <div class="db-kpi-trend" id="trendIssues">Waiting...</div>
      </div>
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128196;</div>
        <div class="db-kpi-value" id="statFiles">0</div>
        <div class="db-kpi-label">Repository Files</div>
        <div class="db-kpi-trend" id="trendFiles">Indexed</div>
      </div>
    </div>
    <div class="db-quick-actions">
      <div class="db-quick-tile" id="scanFromDashboard">
        <span class="db-quick-tile-icon">&#128269;</span>
        <div class="db-quick-tile-label">Scan Workspace</div>
        <div class="db-quick-tile-desc">Run a full analysis</div>
      </div>
      <div class="db-quick-tile" id="openReportFromDashboard">
        <span class="db-quick-tile-icon">&#128196;</span>
        <div class="db-quick-tile-label">View Report</div>
        <div class="db-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="db-quick-tile" id="openAnalyzeFromDashboard">
        <span class="db-quick-tile-icon">&#9889;</span>
        <div class="db-quick-tile-label">Run Analysis</div>
        <div class="db-quick-tile-desc">Custom scan options</div>
      </div>
      <div class="db-quick-tile" id="openSettingsFromDashboard">
        <span class="db-quick-tile-icon">&#9881;</span>
        <div class="db-quick-tile-label">Settings</div>
        <div class="db-quick-tile-desc">Configure extension</div>
      </div>
    </div>
    <div class="db-section-title">Recent Findings</div>
    <div class="db-findings" id="findingsList">
      <div class="db-empty">
        <div class="db-empty-icon">&#128269;</div>
        <div>No findings yet. Run a scan to detect issues.</div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="analyzePane">
  <div class="db-container">
    <div class="analyze-hero">
      <div class="analyze-hero-main">
        <h2>Analyze</h2>
        <span class="analyze-build-badge" id="analyzeBuildBadge">v${options.version}</span>
      </div>
      <p class="analyze-hero-sub">Scan a repo folder, pick your analyzer mix, and run a full code quality &amp; security analysis.</p>
    </div>
    <div class="analyze-grid">
      <!-- Left: Target & Configuration -->
      <div class="analyze-col">
        <div class="analyze-card">
          <h3><span class="icon">&#128193;</span> Target</h3>
          <div class="analyze-path-row">
            <input type="text" id="analyzePathInput" placeholder="/path/to/project or workspace folder" value="" />
            <button id="analyzeBrowseBtn">Browse</button>
            <button id="analyzeDetectWorkspaceBtn">Detect</button>
          </div>
          <div class="analyze-select-wrap">
            <label for="analyzeTypeSelect">Analysis Type</label>
            <select id="analyzeTypeSelect">
              <option value="gate">Gate Scan — credential &amp; secret patterns</option>
              <option value="complete" selected>Complete Scan — full analyzer suite</option>
              <option value="security">Security Focus — CVE, XSS, eval danger</option>
              <option value="ai">AI &amp; LLM — hallucinated imports, slop, stubs</option>
              <option value="quality">Code Quality — complexity, coverage, types</option>
              <option value="roadmap">Roadmap — TODOs, FIXMEs, task markers</option> <!-- simplebeacon-ignore todo-comment — UI label text, not a code todo -->
            </select>
          </div>
          <div class="analyze-select-wrap">
            <label for="analyzeSeveritySelect">Minimum Severity</label>
            <select id="analyzeSeveritySelect">
              <option value="low">Low &amp; above</option>
              <option value="medium" selected>Medium &amp; above</option>
              <option value="high">High &amp; above</option>
              <option value="critical">Critical only</option>
            </select>
          </div>
        </div>
        <div class="analyze-card">
          <h3><span class="icon">&#9889;</span> Quick Actions</h3>
          <div class="analyze-actions">
            <button id="analyzeRunBtn">&#9654; Run Analysis</button>
            <button id="analyzeWorkspaceBtn" class="secondary">Scan Workspace</button>
            <button id="analyzeExportBtn" class="secondary">Export JSON</button>
          </div>
          <div class="analyze-progress" id="analyzeProgressWrap" style="display:none;">
            <div class="analyze-progress-bar"><div class="analyze-progress-fill" id="analyzeProgressFill"></div></div>
            <div class="analyze-progress-text"><span id="analyzeProgressLabel">Initializing...</span><span id="analyzeProgressPct">0%</span></div>
          </div>
        </div>
      </div>
      <!-- Right: Analyzer Engines -->
      <div class="analyze-col">
        <div class="analyze-card">
          <h3><span class="icon">&#128187;</span> Analyzer Engines</h3>
          <div class="analyze-category-title">Core Scans</div>
          <div class="analyzer-grid" id="analyzerCore">
            <div class="analyzer-chip selected" data-id="simplebeacon"><span class="chip-label">Simplebeacon Gate</span><span class="chip-desc">Credentials, secrets, AI imports</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="consolidation"><span class="chip-label">Data Consolidation</span><span class="chip-desc">Duplicate files &amp; monorepo markers</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="mock-scan"><span class="chip-label">Fiction &amp; KPI</span><span class="chip-desc">Fixtures, samples, test-data</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="roadmap"><span class="chip-label">Roadmap</span><span class="chip-desc">TODOs, FIXMEs, bug markers</span><span class="chip-check">&#10003;</span></div> <!-- simplebeacon-ignore todo-comment — UI description text, not a code todo -->
            <div class="analyzer-chip selected" data-id="codebase"><span class="chip-label">Codebase</span><span class="chip-desc">File types, line counts, structure</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="npm-audit"><span class="chip-label">npm Audit</span><span class="chip-desc">Package vulnerabilities</span><span class="chip-check">&#10003;</span></div>
          </div>
          <div class="analyze-category-title">Security</div>
          <div class="analyzer-grid" id="analyzerSecurity">
            <div class="analyzer-chip selected" data-id="dependency-vulns"><span class="chip-label">Dependency Vulns</span><span class="chip-desc">CVE &amp; outdated packages</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="sensitive-data"><span class="chip-label">Sensitive Data</span><span class="chip-desc">PII patterns in source</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="eval-danger"><span class="chip-label">Eval Danger</span><span class="chip-desc">Dynamic code execution risks</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="inner-html-xss"><span class="chip-label">innerHTML XSS</span><span class="chip-desc">Unsanitized DOM assignments</span><span class="chip-check">&#10003;</span></div>
          </div>
          <div class="analyze-category-title">AI &amp; LLM</div>
          <div class="analyzer-grid" id="analyzerAi">
            <div class="analyzer-chip selected" data-id="ai-indicators"><span class="chip-label">AI Indicators</span><span class="chip-desc">AI/LLM SDK imports</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="ai-residue"><span class="chip-label">AI Residue</span><span class="chip-desc">Hallucinated imports, stubs</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="llm-slop"><span class="chip-label">LLM Slop</span><span class="chip-desc">Placeholder debris in source</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="fiction-kpi"><span class="chip-label">Fiction KPI</span><span class="chip-desc">Hardcoded metrics &amp; scores</span><span class="chip-check">&#10003;</span></div>
          </div>
          <div class="analyze-category-title">Code Quality</div>
          <div class="analyzer-grid" id="analyzerQuality">
            <div class="analyzer-chip selected" data-id="performance"><span class="chip-label">Performance</span><span class="chip-desc">Nested loops, memory leaks</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="type-safety"><span class="chip-label">Type Safety</span><span class="chip-desc">Missing types &amp; PropTypes</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="test-coverage"><span class="chip-label">Test Coverage</span><span class="chip-desc">Untested source files</span><span class="chip-check">&#10003;</span></div>
            <div class="analyzer-chip selected" data-id="complexity"><span class="chip-label">Complexity</span><span class="chip-desc">Over-long functions &amp; nesting</span><span class="chip-check">&#10003;</span></div>
          </div>
        </div>
      </div>
    </div>
    <!-- Results Section -->
    <div class="analyze-results" id="analyzeResults" style="display:none;">
      <h3>Analysis Results</h3>
      <div class="analyze-metrics" id="analyzeMetrics">
        <div class="analyze-metric-card"><div class="analyze-metric-value" id="analyzeMetricScore" style="color:var(--wd-trust-good,#89d185)">--</div><div class="analyze-metric-label">Quality Score</div></div>
        <div class="analyze-metric-card"><div class="analyze-metric-value" id="analyzeMetricGate">--</div><div class="analyze-metric-label">Gate Status</div></div>
        <div class="analyze-metric-card"><div class="analyze-metric-value" id="analyzeMetricIssues" style="color:var(--vscode-errorForeground)">0</div><div class="analyze-metric-label">Issues Found</div></div>
        <div class="analyze-metric-card"><div class="analyze-metric-value" id="analyzeMetricFiles">0</div><div class="analyze-metric-label">Files Scanned</div></div>
      </div>
      <div class="db-severity">
        <div class="db-severity-title">Severity Breakdown</div>
        <div class="db-severity-bar">
          <div class="db-sev-segment db-sev-critical" id="analyzeSevCritical" style="width:25%">0</div>
          <div class="db-sev-segment db-sev-high" id="analyzeSevHigh" style="width:25%">0</div>
          <div class="db-sev-segment db-sev-medium" id="analyzeSevMedium" style="width:25%">0</div>
          <div class="db-sev-segment db-sev-low" id="analyzeSevLow" style="width:25%">0</div>
        </div>
      </div>
      <div class="db-section-title">Findings</div>
      <div class="db-findings" id="analyzeFindingsList">
        <div class="db-empty">
          <div class="db-empty-icon">&#128269;</div>
          <div>No findings yet. Run a scan to detect issues.</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="reportPane">
  <div class="db-container">
    <div class="report-hero">
      <div class="report-hero-left">
        <h2>Report</h2>
        <p class="report-hero-sub">View detailed scan reports, filter findings, and export results.</p>
        <div class="report-timestamp" id="reportTimestamp">Last scan: never</div>
      </div>
      <div class="report-hero-right">
        <span class="db-gate-badge db-gate-pending" id="reportGateBadge">Pending</span>
        <button class="db-export-btn" id="reportExportBtn">Export</button>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="report-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="reportScore" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Quality Score</div>
      </div>
      <div class="db-kpi-card">
        <div class="report-kpi-icon">&#128310;</div>
        <div class="db-kpi-value" id="reportGate">--</div>
        <div class="db-kpi-label">Gate Status</div>
      </div>
      <div class="db-kpi-card">
        <div class="report-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="reportIssues" style="color:var(--vscode-errorForeground)">0</div>
        <div class="db-kpi-label">Total Issues</div>
      </div>
      <div class="db-kpi-card">
        <div class="report-kpi-icon">&#128196;</div>
        <div class="db-kpi-value" id="reportFiles">0</div>
        <div class="db-kpi-label">Files Scanned</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="reportCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="reportHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="reportMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="reportLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="reportCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="reportHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="reportMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="reportLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Repository Files</div><div class="db-info-val" id="reportRepoFiles">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Checked</div><div class="db-info-val" id="reportGateChecked">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Last Scan</div><div class="db-info-val" id="reportLastScan">--</div></div>
    </div>
    <div class="report-quick-actions">
      <div class="report-quick-tile" id="reportRefreshBtn">
        <span class="report-quick-tile-icon">&#128260;</span>
        <div class="report-quick-tile-label">Refresh</div>
        <div class="report-quick-tile-desc">Update report data</div>
      </div>
      <div class="report-quick-tile" id="reportExportJsonBtn">
        <span class="report-quick-tile-icon">&#128190;</span>
        <div class="report-quick-tile-label">Export JSON</div>
        <div class="report-quick-tile-desc">Download as JSON</div>
      </div>
      <div class="report-quick-tile" id="reportExportPdfBtn">
        <span class="report-quick-tile-icon">&#128196;</span>
        <div class="report-quick-tile-label">Export PDF</div>
        <div class="report-quick-tile-desc">Download as PDF</div>
      </div>
      <div class="report-quick-tile" id="reportExportExcelBtn">
        <span class="report-quick-tile-icon">&#128197;</span>
        <div class="report-quick-tile-label">Export Excel</div>
        <div class="report-quick-tile-desc">Download as Excel</div>
      </div>
    </div>
    <div class="report-filters">
      <input type="text" id="reportSearchInput" placeholder="Search findings..." />
      <select id="reportSeverityFilter">
        <option value="all">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select id="reportCategoryFilter">
        <option value="all">All Categories</option>
        <option value="security">Security</option>
        <option value="ai">AI &amp; LLM</option>
        <option value="quality">Code Quality</option>
        <option value="architecture">Architecture</option>
      </select>
      <button id="reportClearFiltersBtn" class="secondary">Clear</button>
    </div>
    <div class="report-tabs">
      <div class="report-tab active" data-section="reportFindingsSection">Findings</div>
      <div class="report-tab" data-section="reportFilesSection">Files</div>
      <div class="report-tab" data-section="reportCategoriesSection">Categories</div>
    </div>
    <div class="report-section active" id="reportFindingsSection">
      <div class="report-findings-list" id="reportFindingsList">
        <div class="db-empty">
          <div class="db-empty-icon">&#128196;</div>
          <div>No report data. Run a scan to generate a report.</div>
        </div>
      </div>
    </div>
    <div class="report-section" id="reportFilesSection">
      <div class="report-file-grid" id="reportFilesGrid">
        <div class="db-empty">
          <div class="db-empty-icon">&#128196;</div>
          <div>No file data available.</div>
        </div>
      </div>
    </div>
    <div class="report-section" id="reportCategoriesSection">
      <div class="report-category-list" id="reportCategoryList">
        <div class="db-empty">
          <div class="db-empty-icon">&#128196;</div>
          <div>No category data available.</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="certificatePane">
  <div class="db-container">
    <div class="cert-hero">
      <div class="cert-hero-left">
        <h2>Certificate</h2>
        <p class="cert-hero-sub">Quality certification status and compliance overview.</p>
      </div>
      <div class="cert-hero-right">
        <span class="db-gate-badge db-gate-pending" id="certStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="cert-kpi-icon">&#128274;</div>
        <div class="db-kpi-value" id="certScore" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Compliance Score</div>
      </div>
      <div class="db-kpi-card">
        <div class="cert-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="certModules">--</div>
        <div class="db-kpi-label">Modules Passed</div>
      </div>
      <div class="db-kpi-card">
        <div class="cert-kpi-icon">&#128197;</div>
        <div class="db-kpi-value" id="certDate">--</div>
        <div class="db-kpi-label">Last Audit</div>
      </div>
      <div class="db-kpi-card">
        <div class="cert-kpi-icon">&#128337;</div>
        <div class="db-kpi-value" id="certExpiry">--</div>
        <div class="db-kpi-label">Expiry Date</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="certCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="certHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="certMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="certLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="certCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="certHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="certMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="certLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Repository Files</div><div class="db-info-val" id="certRepoFiles">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Checked</div><div class="db-info-val" id="certGateChecked">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Last Scan</div><div class="db-info-val" id="certLastScan">--</div></div>
    </div>
    <div class="cert-quick-actions">
      <div class="cert-quick-tile" id="certGenerateBtn">
        <span class="cert-quick-tile-icon">&#128221;</span>
        <div class="cert-quick-tile-label">Generate</div>
        <div class="cert-quick-tile-desc">Create certificate</div>
      </div>
      <div class="cert-quick-tile" id="certExportPdfBtn">
        <span class="cert-quick-tile-icon">&#128196;</span>
        <div class="cert-quick-tile-label">Export PDF</div>
        <div class="cert-quick-tile-desc">Download certificate</div>
      </div>
      <div class="cert-quick-tile" id="certViewReportBtn">
        <span class="cert-quick-tile-icon">&#128269;</span>
        <div class="cert-quick-tile-label">View Report</div>
        <div class="cert-quick-tile-desc">Open full report</div>
      </div>
      <div class="cert-quick-tile" id="certSettingsBtn">
        <span class="cert-quick-tile-icon">&#9881;</span>
        <div class="cert-quick-tile-label">Settings</div>
        <div class="cert-quick-tile-desc">Configure rules</div>
      </div>
    </div>
    <div class="cert-requirements">
      <div class="cert-req-title">Compliance Requirements</div>
      <div class="cert-req-list" id="certReqList">
        <div class="cert-req-item">
          <div class="cert-req-check pending">&#8230;</div>
          <div class="cert-req-text">Security gate scan passed</div>
          <div class="cert-req-status">Pending</div>
        </div>
        <div class="cert-req-item">
          <div class="cert-req-check pending">&#8230;</div>
          <div class="cert-req-text">No critical vulnerabilities found</div>
          <div class="cert-req-status">Pending</div>
        </div>
        <div class="cert-req-item">
          <div class="cert-req-check pending">&#8230;</div>
          <div class="cert-req-text">Code quality score above threshold</div>
          <div class="cert-req-status">Pending</div>
        </div>
        <div class="cert-req-item">
          <div class="cert-req-check pending">&#8230;</div>
          <div class="cert-req-text">AI &amp; LLM compliance verified</div>
          <div class="cert-req-status">Pending</div>
        </div>
        <div class="cert-req-item">
          <div class="cert-req-check pending">&#8230;</div>
          <div class="cert-req-text">Repository files scanned</div>
          <div class="cert-req-status">Pending</div>
        </div>
      </div>
    </div>
    <div class="cert-preview">
      <div class="cert-preview-icon">&#128196;</div>
      <div class="cert-preview-text">No certificate generated yet. Run a scan and generate a certificate to see a preview.</div>
    </div>
  </div>
</div>
<div class="pane" id="codeMapPane">
  <div class="db-container">
    <div class="map-hero">
      <div class="map-hero-left">
        <h2>Code Map</h2>
        <p class="map-hero-sub">Architecture, modules, and dependency visualization.</p>
      </div>
      <div class="map-hero-right">
        <span class="map-status-badge pending" id="mapStatusBadge">Not Generated</span>
        <div class="map-actions">
          <button class="map-action-btn" id="mapGenerateBtn">&#128421; Generate</button>
          <button class="map-action-btn secondary" id="mapOpenHtmlBtn">&#128506; Open in Browser</button>
          <button class="map-action-btn secondary" id="mapExportBtn">&#128190; Export</button>
          <button class="map-action-btn secondary" id="mapRefreshBtn">&#128260; Refresh</button>
        </div>
      </div>
    </div>

    <div class="map-kpi-grid">
      <div class="map-kpi-card files">
        <div class="map-kpi-icon">&#128196;</div>
        <div class="map-kpi-value files" id="mapFiles">--</div>
        <div class="map-kpi-label">Files</div>
      </div>
      <div class="map-kpi-card languages">
        <div class="map-kpi-icon">&#127760;</div>
        <div class="map-kpi-value languages" id="mapLanguages">--</div>
        <div class="map-kpi-label">Languages</div>
      </div>
      <div class="map-kpi-card modules">
        <div class="map-kpi-icon">&#128507;</div>
        <div class="map-kpi-value modules" id="mapModules">--</div>
        <div class="map-kpi-label">Modules</div>
      </div>
      <div class="map-kpi-card dependencies">
        <div class="map-kpi-icon">&#128225;</div>
        <div class="map-kpi-value dependencies" id="mapDeps">--</div>
        <div class="map-kpi-label">Dependencies</div>
      </div>
    </div>

    <div class="map-layout" id="mapContent">
      <div class="map-main">
        <div class="map-section" id="mapGraphWrap">
          <div class="map-section-title">Dependency Graph</div>
          <div class="map-graph-frame">
            <iframe id="codeMapIframe" style="display:none;width:100%;height:100%;border:none;" sandbox="allow-scripts allow-same-origin"></iframe>
            <canvas id="codeMapGraphCanvas"></canvas>
            <div class="graph-empty" id="codeMapGraphEmpty">No dependency data available. Generate a code map to see the graph.</div>
            <div class="graph-controls" id="graphControls" style="display:none;">
              <button id="graphResetBtn" title="Reset view (0)">&#8634;</button>
              <button id="graphZoomInBtn" title="Zoom in (+)">+</button>
              <button id="graphZoomOutBtn" title="Zoom out (−)">&#8722;</button>
              <button id="graphPauseBtn" title="Pause/Resume">&#9208;</button>
              <button id="graphLabelsBtn" title="Toggle labels">Labels</button>
              <select id="graphStyleSelect" title="Graph style" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:2px 6px;font-size:11px;cursor:pointer;">
                <option value="force">Force</option>
                <option value="radial">Radial</option>
                <option value="grid">Grid</option>
                <option value="hierarchical">Tree</option>
                <option value="city">City</option>
              </select>
              <input type="text" id="graphSearchInput" placeholder="Search node…" />
              <span id="graphNodeCount">0 nodes</span>
              <span id="graphZoomDisplay" style="background:rgba(15,23,42,0.9);border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:4px 10px;font-size:12px;font-weight:600;min-width:48px;text-align:center;user-select:none;">100%</span>
            </div>
            <div class="graph-legend-overlay" id="graphLegendOverlay">
              <div class="graph-legend-item"><span class="graph-legend-dot" style="background:#f7df1e"></span>.js</div>
              <div class="graph-legend-item"><span class="graph-legend-dot" style="background:#3178c6"></span>.ts/.tsx</div>
              <div class="graph-legend-item"><span class="graph-legend-dot" style="background:#3776ab"></span>.py</div>
              <div class="graph-legend-item"><span class="graph-legend-dot" style="background:#64748b"></span>Other</div>
            </div>
          </div>
        </div>

        <div class="map-section">
          <div class="map-section-title">Severity Summary</div>
          <div class="map-sev-row">
            <div class="map-sev-card crit">
              <div class="map-sev-count crit" id="mapCritCount">0</div>
              <div class="map-sev-name">Critical</div>
            </div>
            <div class="map-sev-card high">
              <div class="map-sev-count high" id="mapHighCount">0</div>
              <div class="map-sev-name">High</div>
            </div>
            <div class="map-sev-card med">
              <div class="map-sev-count med" id="mapMedCount">0</div>
              <div class="map-sev-name">Medium</div>
            </div>
            <div class="map-sev-card low">
              <div class="map-sev-count low" id="mapLowCount">0</div>
              <div class="map-sev-name">Low</div>
            </div>
          </div>
        </div>

        <div class="map-section" id="mapAnalysisWrap">
          <div class="map-section-title">Dependency Analysis</div>
          <div class="map-analysis-grid">
            <div class="map-analysis-card">
              <div class="map-analysis-label">Circular Dependencies</div>
              <div class="map-analysis-val" id="mapCyclesCount">--</div>
              <div class="map-analysis-list" id="mapCyclesList">No cycles detected</div>
            </div>
            <div class="map-analysis-card">
              <div class="map-analysis-label">Entry Points</div>
              <div class="map-analysis-val" id="mapEntryCount">--</div>
              <div class="map-analysis-list" id="mapEntryList">--</div>
            </div>
            <div class="map-analysis-card">
              <div class="map-analysis-label">Leaf Modules</div>
              <div class="map-analysis-val" id="mapLeafCount">--</div>
              <div class="map-analysis-list" id="mapLeafList">--</div>
            </div>
            <div class="map-analysis-card">
              <div class="map-analysis-label">Most Connected</div>
              <div class="map-analysis-val" id="mapConnectedCount">--</div>
              <div class="map-analysis-list" id="mapConnectedList">--</div>
            </div>
          </div>
        </div>
      </div>

      <div class="map-side">
        <div class="map-section">
          <div class="map-section-title">Scan Details</div>
          <div class="map-info-grid">
            <div class="map-info-item">
              <div class="map-info-label">Repository Files</div>
              <div class="map-info-value" id="mapRepoFiles">--</div>
            </div>
            <div class="map-info-item">
              <div class="map-info-label">Total Lines</div>
              <div class="map-info-value" id="mapTotalLines">--</div>
            </div>
            <div class="map-info-item">
              <div class="map-info-label">Last Scan</div>
              <div class="map-info-value" id="mapLastScan">--</div>
            </div>
          </div>
        </div>

        <div class="map-section" id="mapLanguagesWrap">
          <div class="map-section-title">Languages <span class="count" id="mapLangCount">0</span></div>
          <div class="map-lang-list" id="mapLanguagesGrid">
            <div class="map-lang-row">
              <span class="map-lang-name">--</span>
              <div class="map-lang-bar"><div class="map-lang-fill" style="width:0%"></div></div>
              <span class="map-lang-count">--</span>
            </div>
          </div>
        </div>

        <div class="map-section">
          <div class="map-section-title">Module Tree</div>
          <div class="map-tree-list" id="mapTreeList">
            <div class="map-tree-node">
              <span class="map-tree-icon">&#128193;</span>
              <span class="map-tree-label">src</span>
              <span class="map-tree-meta">Folder</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="map-preview" id="mapPreviewWrap">
      <div class="map-preview-icon">&#128506;</div>
      <div class="map-preview-text" id="mapPreviewText">No code map generated yet. Generate a map to visualize your codebase architecture.</div>
      <button class="map-preview-btn" id="mapGenerateBtnPreview">&#128421; Generate Code Map</button>
    </div>
  </div>
</div>
<div class="pane" id="roadmapPane">
  <div class="db-container">
    <div class="road-hero">
      <div class="road-hero-left">
        <h2>Roadmap</h2>
        <p class="road-hero-sub">Remediation planning and task tracking.</p>
      </div>
      <div class="road-hero-right">
        <span class="db-gate-badge db-gate-pending" id="roadStatusBadge">Planning</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="road-kpi-icon">&#128315;</div>
        <div class="db-kpi-value" id="roadOpen" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">Open Vulnerabilities</div>
      </div>
      <div class="db-kpi-card">
        <div class="road-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="roadRisk">--</div>
        <div class="db-kpi-label">Risk Score</div>
      </div>
      <div class="db-kpi-card">
        <div class="road-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="roadDone" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Completed</div>
      </div>
      <div class="db-kpi-card">
        <div class="road-kpi-icon">&#128197;</div>
        <div class="db-kpi-value" id="roadTarget">--</div>
        <div class="db-kpi-label">Target Date</div>
      </div>
    </div>
    <div class="road-quick-actions">
      <div class="road-quick-tile" id="roadTriageBtn">
        <span class="road-quick-tile-icon">&#128295;</span>
        <div class="road-quick-tile-label">Triage</div>
        <div class="road-quick-tile-desc">Sort by severity</div>
      </div>
      <div class="road-quick-tile" id="roadShortTermBtn">
        <span class="road-quick-tile-icon">&#128221;</span>
        <div class="road-quick-tile-label">Short Term</div>
        <div class="road-quick-tile-desc">Quick fixes</div>
      </div>
      <div class="road-quick-tile" id="roadLongTermBtn">
        <span class="road-quick-tile-icon">&#128640;</span>
        <div class="road-quick-tile-label">Long Term</div>
        <div class="road-quick-tile-desc">Architecture</div>
      </div>
      <div class="road-quick-tile" id="roadExportBtn">
        <span class="road-quick-tile-icon">&#128190;</span>
        <div class="road-quick-tile-label">Export</div>
        <div class="road-quick-tile-desc">Save roadmap</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="roadCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="roadHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="roadMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="roadLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="roadCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="roadHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="roadMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="roadLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Open Vulnerabilities</div><div class="db-info-val" id="roadInfoOpen">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Risk Score</div><div class="db-info-val" id="roadInfoRisk">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Target Date</div><div class="db-info-val" id="roadInfoTarget">--</div></div>
    </div>
    <div class="road-phases" id="roadPhases">
      <div class="road-phase">
        <div class="road-phase-header">
          <span class="road-phase-title">Phase 1: Triage &amp; Assessment</span>
          <span class="road-phase-meta">0 / 3 tasks</span>
        </div>
        <div class="road-phase-bar"><div class="road-phase-fill" style="width:0%"></div></div>
        <div class="road-phase-items">
          <div class="road-phase-item"><div class="road-item-sev critical"></div><div class="road-item-text">Review critical findings</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev high"></div><div class="road-item-text">Categorize high severity issues</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev medium"></div><div class="road-item-text">Prioritize backlog</div><div class="road-item-status">Open</div></div>
        </div>
      </div>
      <div class="road-phase">
        <div class="road-phase-header">
          <span class="road-phase-title">Phase 2: Short-Term Fixes</span>
          <span class="road-phase-meta">0 / 4 tasks</span>
        </div>
        <div class="road-phase-bar"><div class="road-phase-fill" style="width:0%"></div></div>
        <div class="road-phase-items">
          <div class="road-phase-item"><div class="road-item-sev critical"></div><div class="road-item-text">Patch credential leaks</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev high"></div><div class="road-item-text">Update vulnerable dependencies</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev medium"></div><div class="road-item-text">Fix lint / style issues</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev low"></div><div class="road-item-text">Remove dead code</div><div class="road-item-status">Open</div></div>
        </div>
      </div>
      <div class="road-phase">
        <div class="road-phase-header">
          <span class="road-phase-title">Phase 3: Long-Term Architecture</span>
          <span class="road-phase-meta">0 / 3 tasks</span>
        </div>
        <div class="road-phase-bar"><div class="road-phase-fill" style="width:0%"></div></div>
        <div class="road-phase-items">
          <div class="road-phase-item"><div class="road-item-sev medium"></div><div class="road-item-text">Refactor module boundaries</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev medium"></div><div class="road-item-text">Improve test coverage</div><div class="road-item-status">Open</div></div>
          <div class="road-phase-item"><div class="road-item-sev low"></div><div class="road-item-text">Add architecture documentation</div><div class="road-item-status">Open</div></div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="aiContextPane">
  <div class="db-container">
    <div class="ai-hero">
      <div class="ai-hero-left">
        <h2>AI Context</h2>
        <p class="ai-hero-sub">AI interaction context, model usage, and slop detection.</p>
      </div>
      <div class="ai-hero-right">
        <span class="db-gate-badge db-gate-pending" id="aiStatusBadge">Monitoring</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="ai-kpi-icon">&#129302;</div>
        <div class="db-kpi-value" id="aiModels" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Models Detected</div>
      </div>
      <div class="db-kpi-card">
        <div class="ai-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="aiIssues" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">AI Issues</div>
      </div>
      <div class="db-kpi-card">
        <div class="ai-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="aiScore">--</div>
        <div class="db-kpi-label">Context Score</div>
      </div>
      <div class="db-kpi-card">
        <div class="ai-kpi-icon">&#128196;</div>
        <div class="db-kpi-value" id="aiFiles">--</div>
        <div class="db-kpi-label">Files Scanned</div>
      </div>
    </div>
    <div class="ai-quick-actions">
      <div class="ai-quick-tile" id="aiScanBtn">
        <span class="ai-quick-tile-icon">&#128269;</span>
        <div class="ai-quick-tile-label">Scan</div>
        <div class="ai-quick-tile-desc">Detect AI patterns</div>
      </div>
      <div class="ai-quick-tile" id="aiExportBtn">
        <span class="ai-quick-tile-icon">&#128190;</span>
        <div class="ai-quick-tile-label">Export</div>
        <div class="ai-quick-tile-desc">Save context data</div>
      </div>
      <div class="ai-quick-tile" id="aiReportBtn">
        <span class="ai-quick-tile-icon">&#128196;</span>
        <div class="ai-quick-tile-label">View Report</div>
        <div class="ai-quick-tile-desc">Open AI report</div>
      </div>
      <div class="ai-quick-tile" id="aiSettingsBtn">
        <span class="ai-quick-tile-icon">&#9881;</span>
        <div class="ai-quick-tile-label">Settings</div>
        <div class="ai-quick-tile-desc">Configure AI rules</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="aiCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="aiHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="aiMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="aiLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="aiCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="aiHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="aiMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="aiLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">AI Issues</div><div class="db-info-val" id="aiInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Context Score</div><div class="db-info-val" id="aiInfoScore">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Files Scanned</div><div class="db-info-val" id="aiInfoFiles">--</div></div>
    </div>
    <div class="ai-models">
      <div class="ai-models-title">Detected Models</div>
      <div id="aiModelsList">
        <div class="ai-model-item">
          <div class="ai-model-icon">&#129302;</div>
          <div class="ai-model-info">
            <div class="ai-model-name">Generic AI Assistant</div>
            <div class="ai-model-meta">Common patterns detected</div>
          </div>
          <div class="ai-model-status">Monitoring</div>
        </div>
        <div class="ai-model-item">
          <div class="ai-model-icon">&#129302;</div>
          <div class="ai-model-info">
            <div class="ai-model-name">Code Generator</div>
            <div class="ai-model-meta">Stub / boilerplate patterns</div>
          </div>
          <div class="ai-model-status">Monitoring</div>
        </div>
        <div class="ai-model-item">
          <div class="ai-model-icon">&#129302;</div>
          <div class="ai-model-info">
            <div class="ai-model-name">Documentation Bot</div>
            <div class="ai-model-meta">Inline comment patterns</div>
          </div>
          <div class="ai-model-status">Monitoring</div>
        </div>
      </div>
    </div>
    <div class="ai-context-preview" id="aiContextPreview">
      <div class="ai-context-preview-icon">&#129302;</div>
      <div class="ai-context-preview-text" id="aiContextPreviewText">No AI context data yet. Run a scan to detect AI-generated patterns in your codebase.</div>
    </div>
  </div>
</div>
<div class="pane" id="uploadPane">
  <div class="db-container">
    <div class="up-hero">
      <div class="up-hero-left">
        <h2>Upload</h2>
        <p class="up-hero-sub">Upload and validate files for scanning.</p>
      </div>
      <div class="up-hero-right">
        <span class="db-gate-badge db-gate-pending" id="upStatusBadge">Ready</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="up-kpi-icon">&#128193;</div>
        <div class="db-kpi-value" id="upTotal" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Total Files</div>
      </div>
      <div class="db-kpi-card">
        <div class="up-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="upValid">--</div>
        <div class="db-kpi-label">Valid</div>
      </div>
      <div class="db-kpi-card">
        <div class="up-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="upErrors" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">Errors</div>
      </div>
      <div class="db-kpi-card">
        <div class="up-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="upScore">--</div>
        <div class="db-kpi-label">Quality Score</div>
      </div>
    </div>
    <div class="up-quick-actions">
      <div class="up-quick-tile" id="upBrowseBtn">
        <span class="up-quick-tile-icon">&#128193;</span>
        <div class="up-quick-tile-label">Browse</div>
        <div class="up-quick-tile-desc">Select files</div>
      </div>
      <div class="up-quick-tile" id="upValidateBtn">
        <span class="up-quick-tile-icon">&#9989;</span>
        <div class="up-quick-tile-label">Validate</div>
        <div class="up-quick-tile-desc">Check format</div>
      </div>
      <div class="up-quick-tile" id="upScanBtn">
        <span class="up-quick-tile-icon">&#128269;</span>
        <div class="up-quick-tile-label">Scan</div>
        <div class="up-quick-tile-desc">Run analysis</div>
      </div>
      <div class="up-quick-tile" id="upClearBtn">
        <span class="up-quick-tile-icon">&#128465;</span>
        <div class="up-quick-tile-label">Clear</div>
        <div class="up-quick-tile-desc">Reset queue</div>
      </div>
    </div>
    <div class="up-dropzone" id="upDropzone">
      <div class="up-dropzone-icon">&#128228;</div>
      <div class="up-dropzone-text">Drop files here or click to browse</div>
      <div class="up-dropzone-hint">Supports .js, .ts, .json, .yml, .md</div>
      <input type="file" id="upFileInput" multiple style="display:none" accept=".js,.ts,.json,.yml,.yaml,.md">
    </div>
    <div class="up-progress" id="upProgressWrap">
      <div class="up-progress-bar"><div class="up-progress-fill" id="upProgressFill"></div></div>
      <div class="up-progress-text"><span id="upProgressLabel">Uploading...</span><span id="upProgressPct">0%</span></div>
    </div>
    <div class="up-results" id="upResultsWrap">
      <div class="up-results-title">Validation Results</div>
      <div id="upResultsList">
        <div class="up-result-item"><span class="up-result-icon">&#9989;</span><span class="up-result-text">No files uploaded yet</span><span class="up-result-status">Ready</span></div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="auditPane">
  <div class="db-container">
    <div class="aud-hero">
      <div class="aud-hero-left">
        <h2>Audit</h2>
        <p class="aud-hero-sub">Security audit results and vulnerability assessment.</p>
      </div>
      <div class="aud-hero-right">
        <span class="db-gate-badge db-gate-pending" id="audStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="aud-kpi-icon">&#128274;</div>
        <div class="db-kpi-value" id="audVulns" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">Vulnerabilities</div>
      </div>
      <div class="db-kpi-card">
        <div class="aud-kpi-icon">&#128225;</div>
        <div class="db-kpi-value" id="audSecrets">--</div>
        <div class="db-kpi-label">Secrets Found</div>
      </div>
      <div class="db-kpi-card">
        <div class="aud-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="audPassed" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Checks Passed</div>
      </div>
      <div class="db-kpi-card">
        <div class="aud-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="audScore">--</div>
        <div class="db-kpi-label">Audit Score</div>
      </div>
    </div>
    <div class="aud-quick-actions">
      <div class="aud-quick-tile" id="audRunBtn">
        <span class="aud-quick-tile-icon">&#128269;</span>
        <div class="aud-quick-tile-label">Run Audit</div>
        <div class="aud-quick-tile-desc">Start security scan</div>
      </div>
      <div class="aud-quick-tile" id="audExportBtn">
        <span class="aud-quick-tile-icon">&#128190;</span>
        <div class="aud-quick-tile-label">Export</div>
        <div class="aud-quick-tile-desc">Save audit report</div>
      </div>
      <div class="aud-quick-tile" id="audReportBtn">
        <span class="aud-quick-tile-icon">&#128196;</span>
        <div class="aud-quick-tile-label">View Report</div>
        <div class="aud-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="aud-quick-tile" id="audSettingsBtn">
        <span class="aud-quick-tile-icon">&#9881;</span>
        <div class="aud-quick-tile-label">Settings</div>
        <div class="aud-quick-tile-desc">Configure rules</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="audCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="audHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="audMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="audLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="audCritCount2">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="audHighCount2">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="audMedCount2">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="audLowCount2">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Vulnerabilities</div><div class="db-info-val" id="audInfoVulns">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Secrets Found</div><div class="db-info-val" id="audInfoSecrets">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Audit Score</div><div class="db-info-val" id="audInfoScore">--</div></div>
    </div>
    <div class="aud-severity-bar">
      <div class="aud-sev-segment critical"><span class="aud-sev-dot"></span><span class="aud-sev-count" id="audCritCount">0</span><span class="aud-sev-label">Critical</span></div>
      <div class="aud-sev-segment high"><span class="aud-sev-dot"></span><span class="aud-sev-count" id="audHighCount">0</span><span class="aud-sev-label">High</span></div>
      <div class="aud-sev-segment medium"><span class="aud-sev-dot"></span><span class="aud-sev-count" id="audMedCount">0</span><span class="aud-sev-label">Med</span></div>
      <div class="aud-sev-segment low"><span class="aud-sev-dot"></span><span class="aud-sev-count" id="audLowCount">0</span><span class="aud-sev-label">Low</span></div>
    </div>
    <div class="aud-findings">
      <div class="aud-findings-title">Recent Findings</div>
      <div class="aud-findings-header">
        <span>Severity</span>
        <span>Type</span>
        <span>Description</span>
        <span>File</span>
      </div>
      <div id="audFindingsList">
        <div class="aud-finding-item">
          <div class="aud-finding-badge pending">Pending</div>
          <div class="aud-finding-type">--</div>
          <div class="aud-finding-text">No audit data available</div>
          <div class="aud-finding-file">--</div>
        </div>
      </div>
    </div>
    <div class="aud-categories">
      <div class="aud-cat-title">Finding Categories</div>
      <div class="aud-cat-grid" id="audCatGrid">
        <div class="aud-cat-card"><span class="aud-cat-icon">&#128225;</span><span class="aud-cat-name">Secrets</span><span class="aud-cat-count" id="audCatSecrets">--</span></div>
        <div class="aud-cat-card"><span class="aud-cat-icon">&#128274;</span><span class="aud-cat-name">Vulnerabilities</span><span class="aud-cat-count" id="audCatVulns">--</span></div>
        <div class="aud-cat-card"><span class="aud-cat-icon">&#9888;</span><span class="aud-cat-name">Code Smells</span><span class="aud-cat-count" id="audCatSmells">--</span></div>
        <div class="aud-cat-card"><span class="aud-cat-icon">&#128220;</span><span class="aud-cat-name">Compliance</span><span class="aud-cat-count" id="audCatCompliance">--</span></div>
      </div>
    </div>
    <div class="aud-recommendations">
      <div class="aud-rec-title">Recommendations</div>
      <div id="audRecList">
        <div class="aud-rec-item">
          <span class="aud-rec-icon">&#128161;</span>
          <span class="aud-rec-text">Run an audit to receive prioritized security recommendations.</span>
        </div>
      </div>
    </div>
    <div class="aud-summary">
      <div class="aud-summary-icon">&#128221;</div>
      <div class="aud-summary-text">Run an audit to generate security findings and vulnerability reports.</div>
    </div>
  </div>
</div>
<div class="pane" id="securityPane">
  <div class="db-container">
    <div class="sec-hero">
      <div class="sec-hero-left">
        <h2>Security</h2>
        <p class="sec-hero-sub">Security analysis overview and threat detection.</p>
      </div>
      <div class="sec-hero-right">
        <span class="db-gate-badge db-gate-pending" id="secStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="sec-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="secCritical" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">Critical</div>
      </div>
      <div class="db-kpi-card">
        <div class="sec-kpi-icon">&#128993;</div>
        <div class="db-kpi-value" id="secHigh" style="color:var(--wd-trust-med,#d7a24c)">--</div>
        <div class="db-kpi-label">High</div>
      </div>
      <div class="db-kpi-card">
        <div class="sec-kpi-icon">&#128309;</div>
        <div class="db-kpi-value" id="secMedium" style="color:var(--wd-sev-medium,#75beff)">--</div>
        <div class="db-kpi-label">Medium</div>
      </div>
      <div class="db-kpi-card">
        <div class="sec-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="secScore">--</div>
        <div class="db-kpi-label">Security Score</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="secCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="secHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="secMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="secLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="secCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="secHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="secMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="secLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Repository Files</div><div class="db-info-val" id="secRepoFiles">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Checked</div><div class="db-info-val" id="secGateChecked">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Last Scan</div><div class="db-info-val" id="secLastScan">--</div></div>
    </div>
    <div class="sec-quick-actions">
      <div class="sec-quick-tile" id="secScanBtn">
        <span class="sec-quick-tile-icon">&#128269;</span>
        <div class="sec-quick-tile-label">Scan</div>
        <div class="sec-quick-tile-desc">Run security scan</div>
      </div>
      <div class="sec-quick-tile" id="secExportBtn">
        <span class="sec-quick-tile-icon">&#128190;</span>
        <div class="sec-quick-tile-label">Export</div>
        <div class="sec-quick-tile-desc">Save report</div>
      </div>
      <div class="sec-quick-tile" id="secReportBtn">
        <span class="sec-quick-tile-icon">&#128196;</span>
        <div class="sec-quick-tile-label">View Report</div>
        <div class="sec-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="sec-quick-tile" id="secSettingsBtn">
        <span class="sec-quick-tile-icon">&#9881;</span>
        <div class="sec-quick-tile-label">Settings</div>
        <div class="sec-quick-tile-desc">Configure rules</div>
      </div>
    </div>
    <div class="sec-threats">
      <div class="sec-threats-title">Detected Threats</div>
      <div class="sec-threats-empty" id="secThreatsEmpty">
        <div class="sec-threats-empty-icon">&#128274;</div>
        <div class="sec-threats-empty-title">No threats detected</div>
        <div class="sec-threats-empty-text">Run a security scan to detect vulnerabilities and threats in your codebase.</div>
      </div>
      <div id="secThreatsList" style="display:none;"></div>
    </div>
  </div>
</div>
<div class="pane" id="trustPane">
  <div class="db-container">
    <div class="trust-hero">
      <div class="trust-hero-left">
        <h2>Trust & Verification</h2>
        <p class="trust-hero-sub">Compliance, certifications, and audit status.</p>
      </div>
      <div class="trust-hero-right">
        <span class="db-gate-badge db-gate-pending" id="trustStatusBadge">Unverified</span>
      </div>
    </div>
    <div class="trust-layout">
      <div class="trust-sidebar">
        <div class="trust-score-card" id="trustScoreCard">
          <div class="trust-score-top">Trust Score</div>
          <div class="trust-score-num" id="trustRingScore">--</div>
          <div class="trust-score-label" id="trustScoreLabel">out of 100</div>
        </div>
        <div class="trust-sev-mini">
          <div class="trust-sev-mini-item"><div class="trust-sev-mini-count crit" id="trustCritCount">0</div><div class="trust-sev-mini-name">Crit</div></div>
          <div class="trust-sev-mini-item"><div class="trust-sev-mini-count high" id="trustHighCount">0</div><div class="trust-sev-mini-name">High</div></div>
          <div class="trust-sev-mini-item"><div class="trust-sev-mini-count med" id="trustMedCount">0</div><div class="trust-sev-mini-name">Med</div></div>
          <div class="trust-sev-mini-item"><div class="trust-sev-mini-count low" id="trustLowCount">0</div><div class="trust-sev-mini-name">Low</div></div>
        </div>
        <div class="trust-sidebar-actions">
          <div class="trust-sb-btn" id="trustVerifyBtn"><span class="trust-sb-btn-icon">&#128504;</span><span class="trust-sb-btn-text">Verify</span><span class="trust-sb-btn-meta">Run check</span></div>
          <div class="trust-sb-btn" id="trustExportBtn"><span class="trust-sb-btn-icon">&#128190;</span><span class="trust-sb-btn-text">Export</span><span class="trust-sb-btn-meta">Save report</span></div>
          <div class="trust-sb-btn" id="trustReportBtn"><span class="trust-sb-btn-icon">&#128196;</span><span class="trust-sb-btn-text">View Report</span><span class="trust-sb-btn-meta">Detailed findings</span></div>
          <div class="trust-sb-btn" id="trustSettingsBtn"><span class="trust-sb-btn-icon">&#9881;</span><span class="trust-sb-btn-text">Settings</span><span class="trust-sb-btn-meta">Configure trust</span></div>
        </div>
        <div class="trust-info-grid">
          <div class="trust-info-cell"><div class="trust-info-cell-value" id="trustScore">--</div><div class="trust-info-cell-label">Score</div></div>
          <div class="trust-info-cell"><div class="trust-info-cell-value" id="trustVerified">--</div><div class="trust-info-cell-label">Checks</div></div>
          <div class="trust-info-cell"><div class="trust-info-cell-value" id="trustWarnings">--</div><div class="trust-info-cell-label">Warnings</div></div>
        </div>
      </div>
      <div class="trust-main">
        <div class="trust-section">
          <div class="trust-section-header"><div class="trust-section-icon">&#128504;</div><div class="trust-section-title">Verification Trust Badges</div></div>
          <div class="trust-badge-grid" id="trustBadgesGrid">
            <div class="trust-badge-card unlocked"><div class="trust-badge-card-icon">&#11088;</div><div class="trust-badge-card-info"><div class="trust-badge-card-name">Verified</div><div class="trust-badge-card-status">Achieved</div></div></div>
            <div class="trust-badge-card unlocked"><div class="trust-badge-card-icon">&#9989;</div><div class="trust-badge-card-info"><div class="trust-badge-card-name">Clean Scan</div><div class="trust-badge-card-status">Achieved</div></div></div>
            <div class="trust-badge-card unlocked"><div class="trust-badge-card-icon">&#128274;</div><div class="trust-badge-card-info"><div class="trust-badge-card-name">Secure</div><div class="trust-badge-card-status">Achieved</div></div></div>
            <div class="trust-badge-card unlocked"><div class="trust-badge-card-icon">&#128220;</div><div class="trust-badge-card-info"><div class="trust-badge-card-name">Compliant</div><div class="trust-badge-card-status">Achieved</div></div></div>
          </div>
        </div>
        <div class="trust-section">
          <div class="trust-section-header"><div class="trust-section-icon" style="background:rgba(16,185,129,0.12);color:#10b981">&#127757;</div><div class="trust-section-title">Compliance & Certifications</div></div>
          <div class="trust-compliance-list">
            <div class="trust-compliance-item"><div class="trust-compliance-icon pass">&#10003;</div><div class="trust-compliance-text"><div class="trust-compliance-name">SOC 2 Type II</div><div class="trust-compliance-desc">Service Organization Control</div></div><div class="trust-compliance-value">Certified</div></div>
            <div class="trust-compliance-item"><div class="trust-compliance-icon pass">&#10003;</div><div class="trust-compliance-text"><div class="trust-compliance-name">ISO 27001</div><div class="trust-compliance-desc">Information Security Management</div></div><div class="trust-compliance-value">Certified</div></div>
            <div class="trust-compliance-item"><div class="trust-compliance-icon pass">&#10003;</div><div class="trust-compliance-text"><div class="trust-compliance-name">GDPR</div><div class="trust-compliance-desc">General Data Protection Regulation</div></div><div class="trust-compliance-value">Compliant</div></div>
            <div class="trust-compliance-item"><div class="trust-compliance-icon pass">&#10003;</div><div class="trust-compliance-text"><div class="trust-compliance-name">HIPAA</div><div class="trust-compliance-desc">Health Insurance Portability</div></div><div class="trust-compliance-value">Ready</div></div>
          </div>
        </div>
        <div class="trust-section">
          <div class="trust-section-header"><div class="trust-section-icon" style="background:rgba(59,130,246,0.12);color:#60a5fa">&#128200;</div><div class="trust-section-title">Score Breakdown</div></div>
          <div class="trust-bd-list">
            <div class="trust-bd-row"><div class="trust-bd-name">Code Quality</div><div class="trust-bd-track"><div class="trust-bd-fill high" id="trustBdQuality" style="width:0%"></div></div><div class="trust-bd-pct" id="trustBdQualityVal">--</div></div>
            <div class="trust-bd-row"><div class="trust-bd-name">Security</div><div class="trust-bd-track"><div class="trust-bd-fill high" id="trustBdSecurity" style="width:0%"></div></div><div class="trust-bd-pct" id="trustBdSecurityVal">--</div></div>
            <div class="trust-bd-row"><div class="trust-bd-name">Compliance</div><div class="trust-bd-track"><div class="trust-bd-fill high" id="trustBdCompliance" style="width:0%"></div></div><div class="trust-bd-pct" id="trustBdComplianceVal">--</div></div>
            <div class="trust-bd-row"><div class="trust-bd-name">Dependencies</div><div class="trust-bd-track"><div class="trust-bd-fill high" id="trustBdDeps" style="width:0%"></div></div><div class="trust-bd-pct" id="trustBdDepsVal">--</div></div>
          </div>
        </div>
        <div class="trust-section">
          <div class="trust-section-header"><div class="trust-section-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">&#128100;</div><div class="trust-section-title">Trust Factors</div></div>
          <div class="trust-factor-list" id="trustFactorsList">
            <div class="trust-factor-row"><div class="trust-factor-check pending">&#9203;</div><div class="trust-factor-name">Code quality gate</div><div class="trust-factor-tag pending">Pending</div></div>
            <div class="trust-factor-row"><div class="trust-factor-check pending">&#9203;</div><div class="trust-factor-name">Security scan clear</div><div class="trust-factor-tag pending">Pending</div></div>
            <div class="trust-factor-row"><div class="trust-factor-check pending">&#9203;</div><div class="trust-factor-name">No secrets leaked</div><div class="trust-factor-tag pending">Pending</div></div>
            <div class="trust-factor-row"><div class="trust-factor-check pending">&#9203;</div><div class="trust-factor-name">Dependency audit</div><div class="trust-factor-tag pending">Pending</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="qualityPane">
  <div class="db-container">
    <div class="q-hero">
      <div class="q-hero-left">
        <h2>Quality</h2>
        <p class="q-hero-sub">Code health, complexity, and maintainability.</p>
      </div>
      <div class="q-hero-right">
        <span class="db-gate-badge db-gate-pending" id="qStatusBadge">Pending</span>
      </div>
    </div>

    <div class="q-analysis-card">
      <div class="q-analysis-header">
        <span class="q-analysis-icon">&#128269;</span>
        <span class="q-analysis-title">Run Analysis</span>
      </div>
      <div class="q-analysis-row">
        <input type="text" id="qPathInput" class="q-input" placeholder="Project path...">
        <button id="qBrowseBtn" class="q-btn-secondary">Browse</button>
        <button id="qDetectBtn" class="q-btn-secondary">Detect</button>
      </div>
      <div class="q-analysis-row">
        <select id="qModeSelect" class="q-select">
          <option value="quality">Quality Focus</option>
          <option value="complete">Complete Scan</option>
          <option value="gate">Gate Only</option>
          <option value="security">Security Focus</option>
        </select>
        <label class="q-checkbox">
          <input type="checkbox" id="qFullTreeCheck" checked> Full tree scan
        </label>
      </div>
      <button id="qRunBtn" class="q-btn-primary">Run Quality Analysis</button>
    </div>

    <div class="q-overview">
      <div class="q-score-ring-wrap">
        <div class="q-score-ring">
          <svg viewBox="0 0 36 36" class="q-score-svg">
            <path class="q-score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="q-score-fg" id="qScoreFg" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="q-score-text">
            <div class="q-score-value" id="qScore">--</div>
            <div class="q-score-label">Score</div>
          </div>
        </div>
        <div class="q-score-summary">
          <div class="q-score-summary-item">
            <span class="q-score-summary-dot pass"></span>
            <span>80+ is healthy</span>
          </div>
          <div class="q-score-summary-item">
            <span class="q-score-summary-dot warn"></span>
            <span>50-79 needs attention</span>
          </div>
        </div>
      </div>
      <div class="q-kpi-grid">
        <div class="q-kpi-card">
          <div class="q-kpi-icon">&#128308;</div>
          <div class="q-kpi-value" id="qIssues">--</div>
          <div class="q-kpi-label">Issues</div>
        </div>
        <div class="q-kpi-card">
          <div class="q-kpi-icon">&#128200;</div>
          <div class="q-kpi-value" id="qCoverage">--</div>
          <div class="q-kpi-label">Coverage</div>
        </div>
        <div class="q-kpi-card">
          <div class="q-kpi-icon">&#128196;</div>
          <div class="q-kpi-value" id="qFiles">--</div>
          <div class="q-kpi-label">Files</div>
        </div>
        <div class="q-kpi-card">
          <div class="q-kpi-icon">&#128220;</div>
          <div class="q-kpi-value" id="qGate">--</div>
          <div class="q-kpi-label">Gate</div>
        </div>
      </div>
    </div>

    <div class="q-dimensions">
      <div class="q-section-title">Quality Dimensions</div>
      <div class="q-dim-grid">
        <div class="q-dim-card">
          <div class="q-dim-header">
            <span class="q-dim-name">Maintainability</span>
            <span class="q-dim-value" id="qMaint">--</span>
          </div>
          <div class="q-dim-bar"><div class="q-dim-fill" id="qMaintFill" style="width:0%"></div></div>
          <div class="q-dim-desc">Ease of ongoing maintenance and change.</div>
        </div>
        <div class="q-dim-card">
          <div class="q-dim-header">
            <span class="q-dim-name">Reliability</span>
            <span class="q-dim-value" id="qRel">--</span>
          </div>
          <div class="q-dim-bar"><div class="q-dim-fill" id="qRelFill" style="width:0%"></div></div>
          <div class="q-dim-desc">Consistency and risk of runtime failures.</div>
        </div>
        <div class="q-dim-card">
          <div class="q-dim-header">
            <span class="q-dim-name">Complexity</span>
            <span class="q-dim-value" id="qComplex">--</span>
          </div>
          <div class="q-dim-bar"><div class="q-dim-fill" id="qComplexFill" style="width:0%"></div></div>
          <div class="q-dim-desc">Cognitive load and branching depth.</div>
        </div>
        <div class="q-dim-card">
          <div class="q-dim-header">
            <span class="q-dim-name">Duplication</span>
            <span class="q-dim-value" id="qDup">--</span>
          </div>
          <div class="q-dim-bar"><div class="q-dim-fill" id="qDupFill" style="width:0%"></div></div>
          <div class="q-dim-desc">Amount of repeated or copy-pasted code.</div>
        </div>
      </div>
    </div>

    <div class="q-quick-actions">
      <div class="q-quick-tile" id="qAnalyzeBtn">
        <span class="q-quick-tile-icon">&#128269;</span>
        <div class="q-quick-tile-label">Analyze</div>
        <div class="q-quick-tile-desc">Run quality scan</div>
      </div>
      <div class="q-quick-tile" id="qExportBtn">
        <span class="q-quick-tile-icon">&#128190;</span>
        <div class="q-quick-tile-label">Export</div>
        <div class="q-quick-tile-desc">Save report</div>
      </div>
      <div class="q-quick-tile" id="qReportBtn">
        <span class="q-quick-tile-icon">&#128196;</span>
        <div class="q-quick-tile-label">View Report</div>
        <div class="q-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="q-quick-tile" id="qSettingsBtn">
        <span class="q-quick-tile-icon">&#9881;</span>
        <div class="q-quick-tile-label">Settings</div>
        <div class="q-quick-tile-desc">Configure rules</div>
      </div>
    </div>

    <div class="q-summary">
      <div class="q-summary-icon">&#11088;</div>
      <div class="q-summary-text">Run a quality analysis to measure code health and metrics.</div>
    </div>
  </div>
</div>
<div class="pane" id="assessmentsPane">
  <div class="db-container">
    <div class="asst-hero">
      <div class="asst-hero-left">
        <h2>Assessments</h2>
        <p class="asst-hero-sub">Assessment checklist and compliance evaluation.</p>
      </div>
      <div class="asst-hero-right">
        <span class="db-gate-badge db-gate-pending" id="asstStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="asst-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="asstCompleted" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Completed</div>
      </div>
      <div class="db-kpi-card">
        <div class="asst-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="asstPending" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">Pending</div>
      </div>
      <div class="db-kpi-card">
        <div class="asst-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="asstProgress">--</div>
        <div class="db-kpi-label">Progress</div>
      </div>
      <div class="db-kpi-card">
        <div class="asst-kpi-icon">&#128196;</div>
        <div class="db-kpi-value" id="asstTotal">--</div>
        <div class="db-kpi-label">Total Checks</div>
      </div>
    </div>
    <div class="asst-quick-actions">
      <div class="asst-quick-tile" id="asstRunBtn">
        <span class="asst-quick-tile-icon">&#128269;</span>
        <div class="asst-quick-tile-label">Run</div>
        <div class="asst-quick-tile-desc">Start assessment</div>
      </div>
      <div class="asst-quick-tile" id="asstExportBtn">
        <span class="asst-quick-tile-icon">&#128190;</span>
        <div class="asst-quick-tile-label">Export</div>
        <div class="asst-quick-tile-desc">Save results</div>
      </div>
      <div class="asst-quick-tile" id="asstReportBtn">
        <span class="asst-quick-tile-icon">&#128196;</span>
        <div class="asst-quick-tile-label">View Report</div>
        <div class="asst-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="asst-quick-tile" id="asstSettingsBtn">
        <span class="asst-quick-tile-icon">&#9881;</span>
        <div class="asst-quick-tile-label">Settings</div>
        <div class="asst-quick-tile-desc">Configure checks</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="asstCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="asstHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="asstMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="asstLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="asstCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="asstHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="asstMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="asstLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Completed</div><div class="db-info-val" id="asstInfoCompleted">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Pending</div><div class="db-info-val" id="asstInfoPending">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Progress</div><div class="db-info-val" id="asstInfoProgress">--</div></div>
    </div>
    <div class="asst-progress-wrap">
      <div class="asst-progress-labels">
        <span class="asst-progress-title">Overall Completion</span>
        <span class="asst-progress-value" id="asstProgressVal">0%</span>
      </div>
      <div class="asst-progress-bar"><div class="asst-progress-fill" id="asstProgressFill" style="width:0%"></div></div>
    </div>
    <div class="asst-categories">
      <div class="asst-cat-card">
        <span class="asst-cat-icon">&#128274;</span>
        <span class="asst-cat-name">Security</span>
        <span class="asst-cat-count" id="asstCatSecurity">--</span>
        <div class="asst-cat-bar"><div class="asst-cat-fill" id="asstCatSecurityFill" style="width:0%"></div></div>
      </div>
      <div class="asst-cat-card">
        <span class="asst-cat-icon">&#11088;</span>
        <span class="asst-cat-name">Quality</span>
        <span class="asst-cat-count" id="asstCatQuality">--</span>
        <div class="asst-cat-bar"><div class="asst-cat-fill" id="asstCatQualityFill" style="width:0%"></div></div>
      </div>
      <div class="asst-cat-card">
        <span class="asst-cat-icon">&#128220;</span>
        <span class="asst-cat-name">Compliance</span>
        <span class="asst-cat-count" id="asstCatCompliance">--</span>
        <div class="asst-cat-bar"><div class="asst-cat-fill" id="asstCatComplianceFill" style="width:0%"></div></div>
      </div>
      <div class="asst-cat-card">
        <span class="asst-cat-icon">&#128196;</span>
        <span class="asst-cat-name">Documentation</span>
        <span class="asst-cat-count" id="asstCatDocs">--</span>
        <div class="asst-cat-bar"><div class="asst-cat-fill" id="asstCatDocsFill" style="width:0%"></div></div>
      </div>
    </div>
    <div class="asst-checklist">
      <div class="asst-checklist-title">Assessment Checklist</div>
      <div id="asstChecklistItems">
        <div class="asst-check-item">
          <span class="asst-check-box"></span>
          <span class="asst-check-text">Code quality gate passed</span>
          <span class="asst-check-status">Pending</span>
        </div>
        <div class="asst-check-item">
          <span class="asst-check-box"></span>
          <span class="asst-check-text">Security scan completed</span>
          <span class="asst-check-status">Pending</span>
        </div>
        <div class="asst-check-item">
          <span class="asst-check-box"></span>
          <span class="asst-check-text">Dependency audit clean</span>
          <span class="asst-check-status">Pending</span>
        </div>
        <div class="asst-check-item">
          <span class="asst-check-box"></span>
          <span class="asst-check-text">Documentation review</span>
          <span class="asst-check-status">Pending</span>
        </div>
        <div class="asst-check-item">
          <span class="asst-check-box"></span>
          <span class="asst-check-text">Test coverage threshold</span>
          <span class="asst-check-status">Pending</span>
        </div>
      </div>
    </div>
    <div class="asst-summary">
      <div class="asst-summary-icon">&#9989;</div>
      <div class="asst-summary-text">Run an assessment to evaluate compliance against defined checks.</div>
    </div>
  </div>
</div>
<div class="pane" id="platformPane">
  <div class="db-container">
    <div class="plat-hero">
      <div class="plat-hero-left">
        <h2>Platform</h2>
        <p class="plat-hero-sub">Platform information and system details.</p>
      </div>
      <div class="plat-hero-right">
        <span class="db-gate-badge db-gate-pending" id="platStatusBadge">Online</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="plat-kpi-icon">&#128187;</div>
        <div class="db-kpi-value" id="platVersion">--</div>
        <div class="db-kpi-label">Version</div>
      </div>
      <div class="db-kpi-card">
        <div class="plat-kpi-icon">&#128295;</div>
        <div class="db-kpi-value" id="platEngine">--</div>
        <div class="db-kpi-label">Engine</div>
      </div>
      <div class="db-kpi-card">
        <div class="plat-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="platUptime">--</div>
        <div class="db-kpi-label">Uptime</div>
      </div>
      <div class="db-kpi-card">
        <div class="plat-kpi-icon">&#128226;</div>
        <div class="db-kpi-value" id="platStatus">--</div>
        <div class="db-kpi-label">Status</div>
      </div>
    </div>
    <div class="plat-quick-actions">
      <div class="plat-quick-tile" id="platRefreshBtn">
        <span class="plat-quick-tile-icon">&#128260;</span>
        <div class="plat-quick-tile-label">Refresh</div>
        <div class="plat-quick-tile-desc">Update platform data</div>
      </div>
      <div class="plat-quick-tile" id="platExportBtn">
        <span class="plat-quick-tile-icon">&#128190;</span>
        <div class="plat-quick-tile-label">Export</div>
        <div class="plat-quick-tile-desc">Save platform info</div>
      </div>
      <div class="plat-quick-tile" id="platDocsBtn">
        <span class="plat-quick-tile-icon">&#128196;</span>
        <div class="plat-quick-tile-label">Docs</div>
        <div class="plat-quick-tile-desc">View documentation</div>
      </div>
      <div class="plat-quick-tile" id="platSettingsBtn">
        <span class="plat-quick-tile-icon">&#9881;</span>
        <div class="plat-quick-tile-label">Settings</div>
        <div class="plat-quick-tile-desc">Configure platform</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="platCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="platHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="platMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="platLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="platCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="platHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="platMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="platLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Quality Score</div><div class="db-info-val" id="platInfoScore">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Total Issues</div><div class="db-info-val" id="platInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Status</div><div class="db-info-val" id="platInfoGate">--</div></div>
    </div>
    <div class="plat-info">
      <div class="plat-info-title">System Information</div>
      <div class="plat-info-item">
        <span class="plat-info-icon">&#128187;</span>
        <span class="plat-info-label">OS</span>
        <span class="plat-info-value" id="platOs">--</span>
      </div>
      <div class="plat-info-item">
        <span class="plat-info-icon">&#128295;</span>
        <span class="plat-info-label">Node Version</span>
        <span class="plat-info-value" id="platNode">--</span>
      </div>
      <div class="plat-info-item">
        <span class="plat-info-icon">&#128290;</span>
        <span class="plat-info-label">Extension Version</span>
        <span class="plat-info-value" id="platExt">--</span>
      </div>
      <div class="plat-info-item">
        <span class="plat-info-icon">&#128452;</span>
        <span class="plat-info-label">Workspace</span>
        <span class="plat-info-value" id="platWorkspace">--</span>
      </div>
    </div>
    <div class="plat-summary" id="platSummary">
      <div class="plat-summary-icon">&#128187;</div>
      <div class="plat-summary-text">Platform data will be refreshed automatically when connected.</div>
    </div>
  </div>
</div>
<div class="pane" id="profilePane">
  <div class="db-container">
    <div class="db-hero">
      <div class="db-hero-left">
        <h2>Profile</h2>
        <p class="db-hero-sub">Enter your extension profile and preferences.</p>
      </div>
      <div class="db-hero-right">
        <div class="db-scan-status">
          <span class="db-scan-dot idle" id="profileStatusDot"></span>
          <span id="profileStatusText">Not saved</span>
        </div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="profCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="profHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="profMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="profLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="profCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="profHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="profMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="profLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Quality Score</div><div class="db-info-val" id="profInfoScore">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Issues Found</div><div class="db-info-val" id="profInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Status</div><div class="db-info-val" id="profInfoGate">--</div></div>
    </div>
    <div class="profile-layout">
      <div class="profile-card">
        <div class="profile-card-title">Profile Information</div>
        <div class="profile-field">
          <label for="profileName">Display Name</label>
          <input type="text" id="profileName" placeholder="Your name" />
        </div>
        <div class="profile-field">
          <label for="profileEmail">Email</label>
          <input type="email" id="profileEmail" placeholder="you@example.com" />
        </div>
        <div class="profile-field">
          <label for="profileRole">Role</label>
          <select id="profileRole">
            <option value="">Select a role</option>
            <option value="developer">Developer</option>
            <option value="team-lead">Team Lead</option>
            <option value="security-engineer">Security Engineer</option>
            <option value="architect">Architect</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="profile-field">
          <label for="profileOrg">Organization</label>
          <input type="text" id="profileOrg" placeholder="Company or team name" />
        </div>
        <div class="profile-actions">
          <button class="profile-btn profile-btn-primary" id="profileSaveBtn">Save Profile</button>
          <button class="profile-btn" id="profileClearBtn">Clear</button>
        </div>
      </div>
      <div class="profile-side">
        <div class="profile-stats">
          <div class="profile-stat-title">Activity Stats</div>
          <div class="profile-stat-grid">
            <div class="profile-stat-item">
              <span class="profile-stat-value" id="profileScans">--</span>
              <span class="profile-stat-label">Scans Run</span>
            </div>
            <div class="profile-stat-item">
              <span class="profile-stat-value" id="profileReports">--</span>
              <span class="profile-stat-label">Reports</span>
            </div>
            <div class="profile-stat-item">
              <span class="profile-stat-value" id="profileIssues">--</span>
              <span class="profile-stat-label">Issues Found</span>
            </div>
            <div class="profile-stat-item">
              <span class="profile-stat-value" id="profileAvgScore">--</span>
              <span class="profile-stat-label">Avg Score</span>
            </div>
          </div>
        </div>
        <div class="profile-preferences">
          <div class="profile-pref-title">Preferences</div>
          <div class="profile-pref-item">
            <span class="profile-pref-label">Auto-scan on open</span>
            <div class="profile-pref-toggle" id="profileAutoScanToggle"><div class="profile-pref-knob"></div></div>
          </div>
          <div class="profile-pref-item">
            <span class="profile-pref-label">Notifications</span>
            <div class="profile-pref-toggle" id="profileNotifyToggle"><div class="profile-pref-knob"></div></div>
          </div>
          <div class="profile-pref-item">
            <span class="profile-pref-label">Dark mode</span>
            <div class="profile-pref-toggle" id="profileDarkToggle"><div class="profile-pref-knob"></div></div>
          </div>
        </div>
        <div class="profile-activity">
          <div class="profile-activity-title">Recent Activity</div>
          <div id="profileActivityList">
            <div class="profile-activity-item">
              <span class="profile-activity-icon">&#128269;</span>
              <span class="profile-activity-text">No recent activity</span>
              <span class="profile-activity-time">--</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="compliancePane">
  <div class="db-container">
    <div class="comp-hero">
      <div class="comp-hero-left">
        <h2>Compliance</h2>
        <p class="comp-hero-sub">Compliance checklist and regulatory requirements.</p>
      </div>
      <div class="comp-hero-right">
        <span class="db-gate-badge db-gate-pending" id="compStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="comp-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="compPassed" style="color:var(--wd-trust-good,#89d185)">--</div>
        <div class="db-kpi-label">Passed</div>
      </div>
      <div class="db-kpi-card">
        <div class="comp-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="compFailed" style="color:var(--vscode-errorForeground)">--</div>
        <div class="db-kpi-label">Failed</div>
      </div>
      <div class="db-kpi-card">
        <div class="comp-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="compProgress">--</div>
        <div class="db-kpi-label">Progress</div>
      </div>
      <div class="db-kpi-card">
        <div class="comp-kpi-icon">&#128196;</div>
        <div class="db-kpi-value" id="compTotal">--</div>
        <div class="db-kpi-label">Total Rules</div>
      </div>
    </div>
    <div class="comp-quick-actions">
      <div class="comp-quick-tile" id="compRunBtn">
        <span class="comp-quick-tile-icon">&#128269;</span>
        <div class="comp-quick-tile-label">Run Check</div>
        <div class="comp-quick-tile-desc">Start compliance scan</div>
      </div>
      <div class="comp-quick-tile" id="compExportBtn">
        <span class="comp-quick-tile-icon">&#128190;</span>
        <div class="comp-quick-tile-label">Export</div>
        <div class="comp-quick-tile-desc">Save compliance report</div>
      </div>
      <div class="comp-quick-tile" id="compReportBtn">
        <span class="comp-quick-tile-icon">&#128196;</span>
        <div class="comp-quick-tile-label">View Report</div>
        <div class="comp-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="comp-quick-tile" id="compSettingsBtn">
        <span class="comp-quick-tile-icon">&#9881;</span>
        <div class="comp-quick-tile-label">Settings</div>
        <div class="comp-quick-tile-desc">Configure rules</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="compCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="compHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="compMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="compLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="compCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="compHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="compMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="compLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Passed</div><div class="db-info-val" id="compInfoPassed">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Failed</div><div class="db-info-val" id="compInfoFailed">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Progress</div><div class="db-info-val" id="compInfoProgress">--</div></div>
    </div>
    <div class="comp-requirements" id="compRequirements">
      <div class="comp-req-title">Compliance Requirements</div>
      <div class="comp-req-item">
        <div class="comp-req-sev critical"></div>
        <span class="comp-req-text">No sensitive data in logs</span>
        <span class="comp-req-status">Pending</span>
      </div>
      <div class="comp-req-item">
        <div class="comp-req-sev high"></div>
        <span class="comp-req-text">Dependency license compliance</span>
        <span class="comp-req-status">Pending</span>
      </div>
      <div class="comp-req-item">
        <div class="comp-req-sev medium"></div>
        <span class="comp-req-text">Code of conduct present</span>
        <span class="comp-req-status">Pending</span>
      </div>
      <div class="comp-req-item">
        <div class="comp-req-sev medium"></div>
        <span class="comp-req-text">Security policy defined</span>
        <span class="comp-req-status">Pending</span>
      </div>
      <div class="comp-req-item">
        <div class="comp-req-sev low"></div>
        <span class="comp-req-text">Contributing guidelines</span>
        <span class="comp-req-status">Pending</span>
      </div>
    </div>
    <div class="comp-summary" id="compSummary">
      <div class="comp-summary-icon">&#128737;</div>
      <div class="comp-summary-text">Run a compliance check to evaluate regulatory and policy requirements.</div>
    </div>
  </div>
</div>
<div class="pane" id="repoHealthPane">
  <div class="db-container">
    <div class="db-hero">
      <div class="db-hero-left">
        <h2>Repo Health</h2>
        <p class="db-hero-sub">Repository health metrics and scan summary.</p>
      </div>
      <div class="db-hero-right">
        <div class="db-scan-status">
          <span class="db-scan-dot idle" id="repoHealthStatusDot"></span>
          <span id="repoHealthStatusText">Ready</span>
        </div>
        <button class="profile-btn profile-btn-primary" id="repoHealthRefreshBtn">Refresh</button>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="repoHealthScore">--</div>
        <div class="db-kpi-label">Quality Score</div>
      </div>
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128310;</div>
        <div class="db-kpi-value" id="repoHealthGate">--</div>
        <div class="db-kpi-label">Gate Status</div>
      </div>
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128203;</div>
        <div class="db-kpi-value" id="repoHealthIssues">--</div>
        <div class="db-kpi-label">Total Issues</div>
      </div>
      <div class="db-kpi-card">
        <div class="db-kpi-icon">&#128193;</div>
        <div class="db-kpi-value" id="repoHealthFiles">--</div>
        <div class="db-kpi-label">Files Scanned</div>
      </div>
    </div>
    <div class="rh-quick-actions">
      <div class="rh-quick-tile" id="rhRunBtn">
        <span class="rh-quick-icon">&#9654;</span>
        <div class="rh-quick-label">Run Scan</div>
        <div class="rh-quick-desc">Full workspace</div>
      </div>
      <div class="rh-quick-tile" id="rhExportBtn">
        <span class="rh-quick-icon">&#128190;</span>
        <div class="rh-quick-label">Export</div>
        <div class="rh-quick-desc">Save report</div>
      </div>
      <div class="rh-quick-tile" id="rhViewBtn">
        <span class="rh-quick-icon">&#128196;</span>
        <div class="rh-quick-label">View Report</div>
        <div class="rh-quick-desc">Detailed findings</div>
      </div>
      <div class="rh-quick-tile" id="rhSettingsBtn">
        <span class="rh-quick-icon">&#9881;</span>
        <div class="rh-quick-label">Settings</div>
        <div class="rh-quick-desc">Configure rules</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="rhCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="rhHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="rhMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="rhLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="rhCritCountCard">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="rhHighCountCard">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="rhMedCountCard">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="rhLowCountCard">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Quality Score</div><div class="db-info-val" id="rhInfoScore">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Total Issues</div><div class="db-info-val" id="rhInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Status</div><div class="db-info-val" id="rhInfoGate">--</div></div>
    </div>
    <div class="rh-severity-bar">
      <div class="rh-sev-segment critical"><span class="rh-sev-dot"></span><span class="rh-sev-count" id="rhCritCount">0</span><span class="rh-sev-label">Critical</span></div>
      <div class="rh-sev-segment high"><span class="rh-sev-dot"></span><span class="rh-sev-count" id="rhHighCount">0</span><span class="rh-sev-label">High</span></div>
      <div class="rh-sev-segment medium"><span class="rh-sev-dot"></span><span class="rh-sev-count" id="rhMedCount">0</span><span class="rh-sev-label">Med</span></div>
      <div class="rh-sev-segment low"><span class="rh-sev-dot"></span><span class="rh-sev-count" id="rhLowCount">0</span><span class="rh-sev-label">Low</span></div>
    </div>
    <div class="rh-metrics">
      <div class="rh-metrics-title">Health Metrics</div>
      <div class="rh-metrics-grid">
        <div class="rh-metric-item">
          <span class="rh-metric-label">Maintainability</span>
          <div class="rh-metric-bar"><div class="rh-metric-fill" id="rhMaintFill" style="width:0%"></div></div>
          <span class="rh-metric-value" id="rhMaintVal">--</span>
        </div>
        <div class="rh-metric-item">
          <span class="rh-metric-label">Reliability</span>
          <div class="rh-metric-bar"><div class="rh-metric-fill" id="rhRelFill" style="width:0%"></div></div>
          <span class="rh-metric-value" id="rhRelVal">--</span>
        </div>
        <div class="rh-metric-item">
          <span class="rh-metric-label">Complexity</span>
          <div class="rh-metric-bar"><div class="rh-metric-fill" id="rhCompFill" style="width:0%"></div></div>
          <span class="rh-metric-value" id="rhCompVal">--</span>
        </div>
        <div class="rh-metric-item">
          <span class="rh-metric-label">Duplication</span>
          <div class="rh-metric-bar"><div class="rh-metric-fill" id="rhDupFill" style="width:0%"></div></div>
          <span class="rh-metric-value" id="rhDupVal">--</span>
        </div>
      </div>
    </div>
    <div class="repo-health-card">
      <h3>Recent Findings</h3>
      <div id="repoHealthFindings" class="repo-health-findings">
        <p class="repo-health-empty">No scan data yet. Click Refresh to scan the workspace.</p>
      </div>
    </div>
    <div class="rh-recommendations">
      <div class="rh-rec-title">Recommendations</div>
      <div id="rhRecList">
        <div class="rh-rec-item">
          <span class="rh-rec-icon">&#128161;</span>
          <span class="rh-rec-text">Run a scan to receive personalized repository health recommendations.</span>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="pane" id="analyticsPane">
  <div class="db-container">
    <div class="an-hero">
      <div class="an-hero-left">
        <h2>Analytics</h2>
        <p class="an-hero-sub">Usage analytics and trend insights.</p>
      </div>
      <div class="an-hero-right">
        <span class="db-gate-badge db-gate-pending" id="anStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="an-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="anScans">--</div>
        <div class="db-kpi-label">Total Scans</div>
      </div>
      <div class="db-kpi-card">
        <div class="an-kpi-icon">&#128203;</div>
        <div class="db-kpi-value" id="anIssues">--</div>
        <div class="db-kpi-label">Issues Found</div>
      </div>
      <div class="db-kpi-card">
        <div class="an-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="anAvgScore">--</div>
        <div class="db-kpi-label">Avg Score</div>
      </div>
      <div class="db-kpi-card">
        <div class="an-kpi-icon">&#128197;</div>
        <div class="db-kpi-value" id="anLastScan">--</div>
        <div class="db-kpi-label">Last Scan</div>
      </div>
    </div>
    <div class="an-quick-actions">
      <div class="an-quick-tile" id="anRefreshBtn">
        <span class="an-quick-tile-icon">&#128260;</span>
        <div class="an-quick-tile-label">Refresh</div>
        <div class="an-quick-tile-desc">Update analytics</div>
      </div>
      <div class="an-quick-tile" id="anExportBtn">
        <span class="an-quick-tile-icon">&#128190;</span>
        <div class="an-quick-tile-label">Export</div>
        <div class="an-quick-tile-desc">Save report</div>
      </div>
      <div class="an-quick-tile" id="anReportBtn">
        <span class="an-quick-tile-icon">&#128196;</span>
        <div class="an-quick-tile-label">View Report</div>
        <div class="an-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="an-quick-tile" id="anSettingsBtn">
        <span class="an-quick-tile-icon">&#9881;</span>
        <div class="an-quick-tile-label">Settings</div>
        <div class="an-quick-tile-desc">Configure analytics</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="anCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="anHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="anMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="anLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="anCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="anHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="anMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="anLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Total Scans</div><div class="db-info-val" id="anInfoScans">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Issues Found</div><div class="db-info-val" id="anInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Avg Score</div><div class="db-info-val" id="anInfoScore">--</div></div>
    </div>
    <div class="an-stats">
      <div class="an-stat-card">
        <div class="an-stat-title">Scan Trend</div>
        <div class="an-stat-value" id="anTrend">--</div>
        <div class="an-stat-delta">Scans this week</div>
      </div>
      <div class="an-stat-card">
        <div class="an-stat-title">Issue Trend</div>
        <div class="an-stat-value" id="anIssueTrend">--</div>
        <div class="an-stat-delta">Issues this week</div>
      </div>
    </div>
    <div class="an-summary" id="anSummary">
      <div class="an-summary-icon">&#128202;</div>
      <div class="an-summary-text">Analytics data will be refreshed when scans are completed.</div>
    </div>
  </div>
</div>
<div class="pane" id="teamPane">
  <div class="db-container">
    <div class="tm-hero">
      <div class="tm-hero-left">
        <h2>Team</h2>
        <p class="tm-hero-sub">Team dashboard and member activity.</p>
      </div>
      <div class="tm-hero-right">
        <span class="db-gate-badge db-gate-pending" id="tmStatusBadge">Pending</span>
      </div>
    </div>
    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="tm-kpi-icon">&#128101;</div>
        <div class="db-kpi-value" id="tmMembers">--</div>
        <div class="db-kpi-label">Members</div>
      </div>
      <div class="db-kpi-card">
        <div class="tm-kpi-icon">&#128269;</div>
        <div class="db-kpi-value" id="tmScans">--</div>
        <div class="db-kpi-label">Team Scans</div>
      </div>
      <div class="db-kpi-card">
        <div class="tm-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="tmResolved">--</div>
        <div class="db-kpi-label">Resolved</div>
      </div>
      <div class="db-kpi-card">
        <div class="tm-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="tmScore">--</div>
        <div class="db-kpi-label">Team Score</div>
      </div>
    </div>
    <div class="tm-quick-actions">
      <div class="tm-quick-tile" id="tmInviteBtn">
        <span class="tm-quick-tile-icon">&#128101;</span>
        <div class="tm-quick-tile-label">Invite</div>
        <div class="tm-quick-tile-desc">Add team member</div>
      </div>
      <div class="tm-quick-tile" id="tmExportBtn">
        <span class="tm-quick-tile-icon">&#128190;</span>
        <div class="tm-quick-tile-label">Export</div>
        <div class="tm-quick-tile-desc">Save team report</div>
      </div>
      <div class="tm-quick-tile" id="tmReportBtn">
        <span class="tm-quick-tile-icon">&#128196;</span>
        <div class="tm-quick-tile-label">View Report</div>
        <div class="tm-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="tm-quick-tile" id="tmSettingsBtn">
        <span class="tm-quick-tile-icon">&#9881;</span>
        <div class="tm-quick-tile-label">Settings</div>
        <div class="tm-quick-tile-desc">Configure team</div>
      </div>
      <div class="tm-quick-tile" id="tmAdminBtn" style="display:none">
        <span class="tm-quick-tile-icon">&#128274;</span>
        <div class="tm-quick-tile-label">Admin</div>
        <div class="tm-quick-tile-desc">Team admin tools</div>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="tmCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="tmHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="tmMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="tmLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="tmCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="tmHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="tmMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="tmLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Quality Score</div><div class="db-info-val" id="tmInfoScore">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Total Issues</div><div class="db-info-val" id="tmInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Status</div><div class="db-info-val" id="tmInfoGate">--</div></div>
    </div>
    <div class="tm-members" id="tmMembersList">
      <div class="tm-members-title">Team Members</div>
      <div class="tm-member-item">
        <div class="tm-member-avatar">A</div>
        <div class="tm-member-info">
          <div class="tm-member-name">Admin</div>
          <div class="tm-member-role">Project Owner</div>
        </div>
        <span class="tm-member-status">Active</span>
      </div>
    </div>
    <div class="tm-summary" id="tmSummary">
      <div class="tm-summary-icon">&#128101;</div>
      <div class="tm-summary-text">Invite team members to collaborate on scans and reviews.</div>
    </div>
  </div>
</div>
<div class="pane" id="scanPane">
  <div class="db-container">
    <div class="sc-hero">
      <div class="sc-hero-left">
        <h2>Scan</h2>
        <p class="sc-hero-sub">Scan configuration and execution status.</p>
      </div>
      <div class="sc-hero-right">
        <span class="db-gate-badge db-gate-pending" id="scStatusBadge">Idle</span>
      </div>
    </div>

    <div class="sc-analysis-card">
      <div class="sc-analysis-header">
        <span class="sc-analysis-icon">&#128269;</span>
        <span class="sc-analysis-title">Scan Configuration</span>
      </div>
      <div class="sc-analysis-row">
        <input type="text" id="scanPathInput" class="sc-input" placeholder="Project path...">
        <button id="scanBrowseBtn" class="sc-btn-secondary">Browse</button>
        <button id="scanDetectWorkspaceBtn" class="sc-btn-secondary">Detect</button>
      </div>
      <div class="sc-analysis-row">
        <select id="scanModeSelect" class="sc-select">
          <option value="full">Full Analysis</option>
          <option value="gate">Gate Only</option>
          <option value="security">Security Focus</option>
          <option value="quality">Quality Focus</option>
        </select>
        <label class="sc-checkbox">
          <input type="checkbox" id="scanFullTreeCheck" checked> Full tree scan
        </label>
      </div>
      <button id="scanStartBtn" class="sc-btn-primary">Start Scan</button>
    </div>

    <div class="sc-status-card" id="scStatusCard">
      <div class="sc-status-left">
        <span class="sc-status-dot" id="scStatusDot"></span>
        <span class="sc-status-text" id="scStatusText">Ready to scan</span>
      </div>
      <div class="sc-status-right" id="scStatusMeta">No active scan</div>
    </div>

    <div class="sc-progress" id="scProgressWrap">
      <div class="sc-progress-bar"><div class="sc-progress-fill" id="scProgressFill"></div></div>
      <div class="sc-progress-text"><span id="scProgressLabel">Scanning...</span><span id="scProgressPct">0%</span></div>
    </div>

    <div class="sc-severity-bar">
      <div class="sc-sev-segment critical"><span class="sc-sev-dot"></span><span class="sc-sev-count" id="scCritCount">0</span><span class="sc-sev-label">Critical</span></div>
      <div class="sc-sev-segment high"><span class="sc-sev-dot"></span><span class="sc-sev-count" id="scHighCount">0</span><span class="sc-sev-label">High</span></div>
      <div class="sc-sev-segment medium"><span class="sc-sev-dot"></span><span class="sc-sev-count" id="scMedCount">0</span><span class="sc-sev-label">Med</span></div>
      <div class="sc-sev-segment low"><span class="sc-sev-dot"></span><span class="sc-sev-count" id="scLowCount">0</span><span class="sc-sev-label">Low</span></div>
    </div>

    <div class="db-kpi-grid">
      <div class="db-kpi-card">
        <div class="sc-kpi-icon">&#128269;</div>
        <div class="db-kpi-value" id="scTotal">--</div>
        <div class="db-kpi-label">Total Scans</div>
      </div>
      <div class="db-kpi-card">
        <div class="sc-kpi-icon">&#128308;</div>
        <div class="db-kpi-value" id="scIssues">--</div>
        <div class="db-kpi-label">Issues</div>
      </div>
      <div class="db-kpi-card">
        <div class="sc-kpi-icon">&#9989;</div>
        <div class="db-kpi-value" id="scFixed">--</div>
        <div class="db-kpi-label">Fixed</div>
      </div>
      <div class="db-kpi-card">
        <div class="sc-kpi-icon">&#128200;</div>
        <div class="db-kpi-value" id="scScore">--</div>
        <div class="db-kpi-label">Scan Score</div>
      </div>
    </div>

    <div class="sc-quick-actions">
      <div class="sc-quick-tile" id="scRunBtn">
        <span class="sc-quick-tile-icon">&#9654;</span>
        <div class="sc-quick-tile-label">Run Scan</div>
        <div class="sc-quick-tile-desc">Start new scan</div>
      </div>
      <div class="sc-quick-tile" id="scExportBtn">
        <span class="sc-quick-tile-icon">&#128190;</span>
        <div class="sc-quick-tile-label">Export</div>
        <div class="sc-quick-tile-desc">Save results</div>
      </div>
      <div class="sc-quick-tile" id="scReportBtn">
        <span class="sc-quick-tile-icon">&#128196;</span>
        <div class="sc-quick-tile-label">View Report</div>
        <div class="sc-quick-tile-desc">Detailed findings</div>
      </div>
      <div class="sc-quick-tile" id="scSettingsBtn">
        <span class="sc-quick-tile-icon">&#9881;</span>
        <div class="sc-quick-tile-label">Settings</div>
        <div class="sc-quick-tile-desc">Configure scan</div>
      </div>
    </div>

    <div class="sc-results" id="scResultsWrap">
      <div class="sc-results-title">Scan Results</div>
      <div class="sc-results-header">
        <span>Type</span>
        <span>Description</span>
        <span>Severity</span>
        <span>File</span>
      </div>
      <div id="scResultsList">
        <div class="sc-result-item"><span class="sc-result-type">--</span><span class="sc-result-text">No scan results yet</span><span class="sc-result-badge pending">Pending</span><span class="sc-result-file">--</span></div>
      </div>
    </div>

    <div class="sc-history">
      <div class="sc-history-title">Scan History</div>
      <div id="scHistoryList">
        <div class="sc-history-item">
          <span class="sc-history-icon">&#128269;</span>
          <span class="sc-history-text">No scan history available</span>
          <span class="sc-history-time">--</span>
          <span class="sc-history-score">--</span>
        </div>
      </div>
    </div>

    <div class="sc-summary" id="scSummary">
      <div class="sc-summary-icon">&#128269;</div>
      <div class="sc-summary-text">Run a scan to analyze your codebase for issues and vulnerabilities.</div>
    </div>
  </div>
</div>
<div class="pane" id="settingsPane">
  <div class="db-container">
    <div class="st-hero">
      <div class="st-hero-left">
        <h2>Settings</h2>
        <p class="st-hero-sub">Configure SimpleBeacon preferences and integrations.</p>
      </div>
      <div class="st-hero-right">
        <span class="db-gate-badge db-gate-pending" id="stStatusBadge">Unsaved</span>
      </div>
    </div>
    <div class="db-sev-row">
      <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="stCritLabel">0 Critical</span></div>
      <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="stHighLabel">0 High</span></div>
      <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="stMedLabel">0 Med</span></div>
      <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="stLowLabel">0 Low</span></div>
    </div>
    <div class="db-sev-grid">
      <div class="db-sev-card">
        <div class="db-sev-count crit" id="stCritCount">0</div>
        <div class="db-sev-name">Critical</div>
      </div>
      <div class="db-sev-card high">
        <div class="db-sev-count high" id="stHighCount">0</div>
        <div class="db-sev-name">High</div>
      </div>
      <div class="db-sev-card med">
        <div class="db-sev-count med" id="stMedCount">0</div>
        <div class="db-sev-name">Medium</div>
      </div>
      <div class="db-sev-card low">
        <div class="db-sev-count low" id="stLowCount">0</div>
        <div class="db-sev-name">Low</div>
      </div>
    </div>
    <div class="db-info">
      <div class="db-info-row"><div class="db-info-label">Quality Score</div><div class="db-info-val" id="stInfoScore">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Total Issues</div><div class="db-info-val" id="stInfoIssues">--</div></div>
      <div class="db-info-row"><div class="db-info-label">Gate Status</div><div class="db-info-val" id="stInfoGate">--</div></div>
    </div>
    <div class="st-section">
      <div class="st-section-title">General</div>
      <div class="st-row">
        <div class="st-row-label">Auto Scan on Open<div class="st-row-desc">Run a scan when a workspace opens</div></div>
        <div class="st-toggle" id="stAutoScanToggle"><div class="st-toggle-knob"></div></div>
      </div>
      <div class="st-row">
        <div class="st-row-label">Display<div class="st-row-desc">Open dashboard in main window or sidebar</div></div>
        <select class="st-select" id="stDisplaySelect">
          <option value="mainWindow">Main Window</option>
          <option value="sidebar">Sidebar</option>
        </select>
      </div>
      <div class="st-row">
        <div class="st-row-label">Browser Mode<div class="st-row-desc">Open results in browser instead of panel</div></div>
        <div class="st-toggle" id="stBrowserToggle"><div class="st-toggle-knob"></div></div>
      </div>
    </div>
    <div class="st-section">
      <div class="st-section-title">Server</div>
      <div class="st-row">
        <div class="st-row-label">API Server URL<div class="st-row-desc">Endpoint for scan and report data</div></div>
      </div>
      <input class="st-input" id="stApiUrl" type="text" placeholder="http://localhost:55000" />
      <button class="st-btn" id="stSaveApiBtn">Save</button>
      <button class="st-btn" id="stTestApiBtn" style="margin-left:8px">Test Connection</button>
      <div class="st-row-desc" id="stApiStatus" style="margin-top:6px"></div>
    </div>
    <div class="st-section">
      <div class="st-section-title">Notifications</div>
      <div class="st-row">
        <div class="st-row-label">Scan Complete<div class="st-row-desc">Notify when scans finish</div></div>
        <div class="st-toggle" id="stNotifyScanToggle"><div class="st-toggle-knob"></div></div>
      </div>
      <div class="st-row">
        <div class="st-row-label">Gate Failure<div class="st-row-desc">Notify when a gate check fails</div></div>
        <div class="st-toggle" id="stNotifyGateToggle"><div class="st-toggle-knob"></div></div>
      </div>
    </div>
    <div class="st-section">
      <div class="st-section-title">Data</div>
      <div class="st-row">
        <div class="st-row-label">Reset Settings<div class="st-row-desc">Restore default configuration</div></div>
        <button class="st-btn" id="stResetBtn">Reset</button>
      </div>
    </div>
  </div>
</div>
<script nonce="${nonce}">
// simplebeacon-ignore innerhtml-usage — webview template uses controlled HTML strings
let vscode;
try { vscode = acquireVsCodeApi(); } catch (e) { vscode = undefined; }
if (!vscode) {
  vscode = {
    postMessage: (msg) => {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ ...msg, source: 'simplebeacon-welcome' }, '*');
      }
    }
  };
}
// Cache the VS Code API globally so other scripts don't try to re-acquire it
window.vscode = vscode;
if (vscode && typeof window.acquireVsCodeApi === 'function') {
  try {
    const _cachedApi = vscode;
    window.acquireVsCodeApi = function() { return _cachedApi; };
  } catch (e) { /* silent — already acquired is OK */ }
}
// Intercept external links so sandboxed webviews can open them via the extension host
(function() {
  function openExternal(url) {
    if (vscode && vscode.postMessage) {
      vscode.postMessage({ command: 'openExternal', url: url });
    } else if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({ command: 'openExternal', url: url, source: 'simplebeacon-welcome' }, '*');
    }
  }
  // Intercept all clicks on target="_blank" or rel="noopener" links
  document.addEventListener('click', function(e) {
    const el = e.target.closest('a[href]');
    if (!el) return;
    const href = el.getAttribute('href') || '';
    const target = el.getAttribute('target') || '';
    if (target === '_blank' || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/coming-soon/')) {
      e.preventDefault();
      openExternal(href);
    }
  });
  // Override window.open so SettingsView.js and other scripts work
  const _origOpen = window.open;
  window.open = function(url, target, features) {
    if (url) { openExternal(String(url)); }
    return null;
  };
})();
function addTab(label, paneId) {
  const bar = document.getElementById('tabBar');
  const barLeft = document.getElementById('tabBarLeft');
  if (!bar) { if (window.__SB_DEBUG__) console.warn('[SB addTab] tabBar not found'); return; }
  const container = barLeft || bar;
  const existing = container.querySelector('[data-pane="' + paneId + '"]');
  if (existing) {
    if (window.__SB_DEBUG__) console.debug('[SB addTab] existing tab, activating:', paneId);
    activateTab(paneId);
    return;
  }
  if (window.__SB_DEBUG__) console.debug('[SB addTab] creating tab:', label, paneId);
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.pane = paneId;
  const tabLabel = document.createElement('span');
  tabLabel.className = 'tab-label';
  tabLabel.textContent = label;
  const tabClose = document.createElement('span');
  tabClose.className = 'tab-close';
  tabClose.title = 'Close';
  tabClose.textContent = '×';
  tab.appendChild(tabLabel);
  tab.appendChild(tabClose);
  tab.addEventListener('click', (e) => { if (e.target !== tabClose && e.target !== tabClose.firstChild) activateTab(paneId); });
  tabClose.addEventListener('click', (e) => { e.stopPropagation(); if (paneId === 'welcomePane') return; tab.remove(); const p = document.getElementById(paneId); if (p) { p.classList.remove('active'); } const rem = container.querySelector('.tab'); if (rem) activateTab(rem.dataset.pane); });
  container.appendChild(tab);
  activateTab(paneId);
}
function activateTab(paneId) {
  const pane = document.getElementById(paneId);
  if (!pane) { if (window.__SB_DEBUG__) console.warn('[SB activateTab] pane not found:', paneId); return; }
  if (window.__SB_DEBUG__) console.debug('[SB activateTab] activating:', paneId, 'pane classList before:', pane.classList.toString());
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.pane === paneId));
  document.querySelectorAll('.pane').forEach(p => {
    if (p.id === paneId) {
      p.classList.add('active');
      p.style.display = '';
    } else {
      p.classList.remove('active');
      p.style.display = 'none';
    }
  });
  // Re-trigger code map graph resize after the pane becomes visible
  if (paneId === 'codeMapPane') {
    const graphCanvas = document.getElementById('codeMapGraphCanvas');
    if (graphCanvas && graphCanvas._graphResize) {
      try { graphCanvas._graphResize(); } catch (e) { console.warn('[SB] codeMap resize failed', e); }
    }
  }
  // simplebeacon-ignore console-log — diagnostic
  if (window.__SB_DEBUG__) console.debug('[SB activateTab] pane classList after:', pane.classList.toString(), 'display:', pane.style.display);
}
function getTabList() { return Array.from(document.querySelectorAll('#tabBar .tab')); }
function getActiveTabIndex() { return getTabList().findIndex(t => t.classList.contains('active')); }
function bindBtn(id, paneId, command) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => {
      try { addTab(paneId.replace('Pane',''), paneId); } catch (e) { console.error('addTab error:', e); }
      try { activateTab(paneId); } catch (e) { console.error('activateTab error:', e); }
      if (command) {
        try { vscode.postMessage({ command }); } catch (e) { console.error('postMessage error:', e); }
      }
    });
  } else {
    console.warn('bindBtn: element not found for id', id);
  }
}
function bindProfileToggle(id, command) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const on = el.classList.toggle('on');
    vscode.postMessage({ command: command, value: on });
  });
}
function initWelcomeButtons() {
  // simplebeacon-ignore console-log — diagnostic
  if (window.__SB_DEBUG__) console.debug('[SB] initWelcomeButtons start');
  document.querySelectorAll('#tabBar .tab').forEach(t => { if (!t.dataset.bound) { t.dataset.bound = '1'; t.addEventListener('click', () => activateTab(t.dataset.pane)); } });
  const tabArrowLeft = document.getElementById('tabArrowLeft');
  if (tabArrowLeft) tabArrowLeft.addEventListener('click', () => {
    const tabs = getTabList(); const idx = getActiveTabIndex();
    if (tabs.length > 1 && idx > 0) { activateTab(tabs[idx - 1].dataset.pane); }
  });
  const tabArrowRight = document.getElementById('tabArrowRight');
  if (tabArrowRight) tabArrowRight.addEventListener('click', () => {
    const tabs = getTabList(); const idx = getActiveTabIndex();
    if (tabs.length > 1 && idx >= 0 && idx < tabs.length - 1) { activateTab(tabs[idx + 1].dataset.pane); }
  });
  const tabCloseBtn = document.getElementById('tabCloseBtn');
  if (tabCloseBtn) tabCloseBtn.addEventListener('click', () => {
    const tabs = getTabList();
    const idx = getActiveTabIndex();
    if (idx < 0) return;
    const activeTab = tabs[idx];
    const paneId = activeTab.dataset.pane;
    // Prevent closing the welcome pane
    if (paneId === 'welcomePane') return;
    activeTab.remove();
    const p = document.getElementById(paneId);
    if (p) p.classList.remove('active');
    const rem = getTabList();
    if (rem.length > 0) { activateTab(rem[Math.min(idx, rem.length - 1)].dataset.pane); }
  });
  bindBtn('openDashboard','dashboardPane','openDashboard');
  bindBtn('openAnalyze','analyzePane','openAnalyze');
  bindBtn('openReport','reportPane','openReport');
  bindBtn('openCertificate','certificatePane','openCertificate');
  bindBtn('openCodeMap','codeMapPane','openCodeMap');
  bindBtn('openRoadmap','roadmapPane','openRoadmap');
  bindBtn('openAiContext','aiContextPane','openAiContext');
  bindBtn('openUpload','uploadPane','openUpload');
  bindBtn('openAudit','auditPane','openAudit');
  bindBtn('openSecurity','securityPane','openSecurity');
  bindBtn('openTrust','trustPane','openTrust');
  bindBtn('openQuality','qualityPane','openQuality');
  bindBtn('openAssessments','assessmentsPane','openAssessments');
  bindBtn('openPlatform','platformPane','openPlatform');
  bindBtn('openProfile','profilePane','openProfile');
  bindBtn('openCompliance','compliancePane','openCompliance');
  bindBtn('openRepoHealth','repoHealthPane','openRepoHealth');
  bindBtn('openAnalytics','analyticsPane','openAnalytics');
  bindBtn('openTeam','teamPane','openTeam');
  bindBtn('openScan','scanPane','openScan');
  bindBtn('openSettings','settingsPane','openSettings');
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  if (profileSaveBtn) profileSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('profileName');
    const email = document.getElementById('profileEmail');
    const role = document.getElementById('profileRole');
    const org = document.getElementById('profileOrg');
    const statusDot = document.getElementById('profileStatusDot');
    const statusText = document.getElementById('profileStatusText');
    if (statusDot) statusDot.className = 'db-scan-dot';
    if (statusText) statusText.textContent = 'Saved';
    vscode.postMessage({ command: 'saveProfile', name: name ? name.value : '', email: email ? email.value : '', role: role ? role.value : '', org: org ? org.value : '' });
  });
  const profileClearBtn = document.getElementById('profileClearBtn');
  if (profileClearBtn) profileClearBtn.addEventListener('click', () => {
    const name = document.getElementById('profileName');
    const email = document.getElementById('profileEmail');
    const role = document.getElementById('profileRole');
    const org = document.getElementById('profileOrg');
    const statusDot = document.getElementById('profileStatusDot');
    const statusText = document.getElementById('profileStatusText');
    if (name) name.value = '';
    if (email) email.value = '';
    if (role) role.value = '';
    if (org) org.value = '';
    if (statusDot) statusDot.className = 'db-scan-dot idle';
    if (statusText) statusText.textContent = 'Not saved';
  });
  bindProfileToggle('profileAutoScanToggle', 'updateProfileAutoScan');
  bindProfileToggle('profileNotifyToggle', 'updateProfileNotify');
  bindProfileToggle('profileDarkToggle', 'updateProfileDarkMode');
  const repoHealthRefreshBtn = document.getElementById('repoHealthRefreshBtn');
  if (repoHealthRefreshBtn) repoHealthRefreshBtn.addEventListener('click', () => {
    const dot = document.getElementById('repoHealthStatusDot');
    const status = document.getElementById('repoHealthStatusText');
    if (dot) dot.className = 'db-scan-dot idle';
    if (status) status.textContent = 'Scanning...';
    vscode.postMessage({ command: 'scan' });
  });
  const rhRunBtn = document.getElementById('rhRunBtn');
  if (rhRunBtn) rhRunBtn.addEventListener('click', () => vscode.postMessage({ command: 'scan' }));
  const rhExportBtn = document.getElementById('rhExportBtn');
  if (rhExportBtn) rhExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportReport' }));
  const rhViewBtn = document.getElementById('rhViewBtn');
  if (rhViewBtn) rhViewBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
  const rhSettingsBtn = document.getElementById('rhSettingsBtn');
  if (rhSettingsBtn) rhSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
  const teamInviteBtn = document.getElementById('teamInviteBtn');
  if (teamInviteBtn) teamInviteBtn.addEventListener('click', () => {
    const email = document.getElementById('inviteEmail');
    const role = document.getElementById('inviteRole');
    if (email && email.value) {
      vscode.postMessage({ command: 'inviteTeamMember', email: email.value, role: role ? role.value : 'viewer' });
      email.value = '';
    }
  });
  const teamDashboardBtn = document.getElementById('openTeamDashboard');
  if (teamDashboardBtn) teamDashboardBtn.addEventListener('click', () => vscode.postMessage({ command: 'openTeamDashboard' }));
  const previewWindowBtn = document.getElementById('openPreviewWindow');
  if (previewWindowBtn) previewWindowBtn.addEventListener('click', () => vscode.postMessage({ command: 'openPreviewInBrowser' }));
  const showWelcomeCheckbox = document.getElementById('showWelcomeCheckbox');
  if (showWelcomeCheckbox) {
    showWelcomeCheckbox.addEventListener('change', () => {
      vscode.postMessage({ command: 'updateShowWelcome', value: showWelcomeCheckbox.checked });
    });
  }
  // simplebeacon-ignore console-log — diagnostic
  if (window.__SB_DEBUG__) console.debug('[SB] initWelcomeButtons done');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWelcomeButtons);
} else {
  initWelcomeButtons();
}
// Handle messages from parent in browser preview mode
window.addEventListener('message', function(ev) {
  if (!ev.data || !ev.data.command) return;
  // Only run in the browser-preview iframe; the VS Code: webview uses the vscode API below
  if (typeof window.__SB_BROWSER_MODE__ === 'undefined' || !window.__SB_BROWSER_MODE__) { return; }
  const cmd = ev.data.command;
  // simplebeacon-ignore console-log — diagnostic
  if (window.__SB_DEBUG__) console.debug('[SB browser handler] command:', cmd);
  const paneMap = {
    showDashboardPane: 'dashboardPane', showAnalyzePane: 'analyzePane', showReportPane: 'reportPane',
    showSettingsPane: 'settingsPane', showSecurityPane: 'securityPane', showTrustPane: 'trustPane',
    showQualityPane: 'qualityPane', showAuditPane: 'auditPane', showCompliancePane: 'compliancePane',
    showAnalyticsPane: 'analyticsPane', showRepoHealthPane: 'repoHealthPane', showTeamPane: 'teamPane',
    showCertificatePane: 'certificatePane', showCodeMapPane: 'codeMapPane', showUploadPane: 'uploadPane',
    showAiContextPane: 'aiContextPane', showRoadmapPane: 'roadmapPane', showScanPane: 'analyzePane'
  };
  const paneId = paneMap[cmd];
  if (paneId) {
    try { addTab(paneId.replace('Pane',''), paneId); } catch (e) { console.error('[SB browser handler] addTab error:', e); }
    try { activateTab(paneId); } catch (e) { console.error('[SB browser handler] activateTab error:', e); }
    return;
  }
  if (cmd === 'signIn' || cmd === 'openSigninScreen' || cmd === 'openSigninPanel') {
    if (typeof showLoginModal === 'function') {
      showLoginModal();
    } else {
      alert('Sign in via the browser preview requires VS Code:. Please open SimpleBeacon in VS Code: to sign in.');
    }
    return;
  }
});
const scanDashBtn = document.getElementById('scanFromDashboard');
if (scanDashBtn) scanDashBtn.addEventListener('click', () => vscode.postMessage({ command: 'scanWorkspace' }));
const rptDashBtn = document.getElementById('openReportFromDashboard');
if (rptDashBtn) rptDashBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const dashExportBtn = document.getElementById('dashExportBtn');
if (dashExportBtn) dashExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportScanReport' }));
const anlDashBtn = document.getElementById('openAnalyzeFromDashboard');
if (anlDashBtn) anlDashBtn.addEventListener('click', () => { addTab('Analyze','analyzePane'); vscode.postMessage({ command: 'openAnalyze' }); });
const stgDashBtn = document.getElementById('openSettingsFromDashboard');
if (stgDashBtn) stgDashBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
function updateSeverityBar(sev) {
  const total = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
  if (total === 0) return;
  const c = document.getElementById('sevCritical'), h = document.getElementById('sevHigh'), m = document.getElementById('sevMedium'), l = document.getElementById('sevLow');
  if (c) { c.style.width = ((sev.critical || 0) / total * 100) + '%'; c.textContent = (sev.critical || 0) > 0 ? (sev.critical || 0) : ''; }
  if (h) { h.style.width = ((sev.high || 0) / total * 100) + '%'; h.textContent = (sev.high || 0) > 0 ? (sev.high || 0) : ''; }
  if (m) { m.style.width = ((sev.medium || 0) / total * 100) + '%'; m.textContent = (sev.medium || 0) > 0 ? (sev.medium || 0) : ''; }
  if (l) { l.style.width = ((sev.low || 0) / total * 100) + '%'; l.textContent = (sev.low || 0) > 0 ? (sev.low || 0) : ''; }
}
function renderFindings(findings) {
  const list = document.getElementById('findingsList');
  if (!list) return;
  list.textContent = '';
  if (!findings || findings.length === 0) { renderEmpty(list, 'No findings yet. Run a scan to detect issues.'); return; }
  findings.slice(0, 20).forEach(f => list.appendChild(renderFindingRow('db-finding', f)));
}
/* Analyze Pane Interactivity */
function getSelectedAnalyzers() {
  return Array.from(document.querySelectorAll('.analyzer-chip.selected')).map(c => c.dataset.id);
}
function setAnalyzerSelection(ids) {
  document.querySelectorAll('.analyzer-chip').forEach(c => {
    const sel = ids.includes(c.dataset.id);
    c.classList.toggle('selected', sel);
    const check = c.querySelector('.chip-check');
    if (check) check.textContent = sel ? '\u2713' : '';
  });
}
document.querySelectorAll('.analyzer-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    const check = chip.querySelector('.chip-check');
    if (check) check.textContent = chip.classList.contains('selected') ? '\u2713' : '';
  });
});
const analyzeTypeSelect = document.getElementById('analyzeTypeSelect');
if (analyzeTypeSelect) {
  const presetMap = {
    gate: ['simplebeacon'],
    complete: ['simplebeacon','consolidation','mock-scan','roadmap','codebase','npm-audit','dependency-vulns','sensitive-data','eval-danger','inner-html-xss','ai-indicators','ai-residue','llm-slop','fiction-kpi','performance','type-safety','test-coverage','complexity'],
    security: ['dependency-vulns','sensitive-data','eval-danger','inner-html-xss','config-drift','prototype-pollution','unvalidated-redirect','missing-rate-limit','insecure-random','logging-secrets'],
    ai: ['ai-indicators','ai-residue','llm-slop','fiction-kpi','hardcoded-confidence','hardcoded-completion','token-bleed','ai-placeholder-comment','ai-placeholder-block','markdown-fence-leak','empty-stub-function','arrow-stub'],
    quality: ['performance','type-safety','documentation','test-coverage','complexity','magic-number','missing-strict-mode','uninitialized-read','unhandled-promise','sync-io'],
    roadmap: ['roadmap','build-readiness','governance','junk-files']
  };
  analyzeTypeSelect.addEventListener('change', () => {
    const preset = presetMap[analyzeTypeSelect.value];
    if (preset) setAnalyzerSelection(preset);
  });
}
const analyzeRunBtn = document.getElementById('analyzeRunBtn');
if (analyzeRunBtn) {
  analyzeRunBtn.addEventListener('click', () => {
    if (analyzeRunBtn.dataset.intervalId) {
      clearInterval(Number(analyzeRunBtn.dataset.intervalId));
      delete analyzeRunBtn.dataset.intervalId;
    }
    const pathInput = document.getElementById('analyzePathInput');
    const path = pathInput ? pathInput.value : '';
    const analyzers = getSelectedAnalyzers();
    const minSev = document.getElementById('analyzeSeveritySelect');
    vscode.postMessage({ command: 'analyze', path: path, analyzers: analyzers, minSeverity: minSev ? minSev.value : 'medium' });
    const wrap = document.getElementById('analyzeProgressWrap');
    const fill = document.getElementById('analyzeProgressFill');
    const label = document.getElementById('analyzeProgressLabel');
    const pct = document.getElementById('analyzeProgressPct');
    if (wrap) wrap.style.display = 'block';
    let p = 0;
    const interval = setInterval(() => {
      p += Math.floor(Math.random() * 12) + 3;
      if (p > 95) p = 95;
      if (fill) fill.style.width = p + '%';
      if (pct) pct.textContent = p + '%';
      const phases = ['Discovering files...','Running analyzers...','Aggregating results...','Building report...'];
      if (label) label.textContent = phases[Math.min(Math.floor(p / 25), 3)];
      if (p >= 95) clearInterval(interval);
    }, 400);
    analyzeRunBtn.dataset.intervalId = String(interval);
  });
}
const analyzeWorkspaceBtn = document.getElementById('analyzeWorkspaceBtn');
if (analyzeWorkspaceBtn) {
  analyzeWorkspaceBtn.addEventListener('click', () => vscode.postMessage({ command: 'scanWorkspace' }));
}
const analyzeExportBtn = document.getElementById('analyzeExportBtn');
if (analyzeExportBtn) {
  analyzeExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportAnalysis' }));
}
const analyzeBrowseBtn = document.getElementById('analyzeBrowseBtn');
if (analyzeBrowseBtn) {
  analyzeBrowseBtn.addEventListener('click', () => vscode.postMessage({ command: 'browseAnalyzePath' }));
}
const analyzeDetectWorkspaceBtn = document.getElementById('analyzeDetectWorkspaceBtn');
if (analyzeDetectWorkspaceBtn) {
  analyzeDetectWorkspaceBtn.addEventListener('click', () => vscode.postMessage({ command: 'detectWorkspacePath' }));
}
function updateAnalyzeSeverityBar(sev) {
  const total = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
  if (total === 0) return;
  const c = document.getElementById('analyzeSevCritical'), h = document.getElementById('analyzeSevHigh'), m = document.getElementById('analyzeSevMedium'), l = document.getElementById('analyzeSevLow');
  if (c) { c.style.width = ((sev.critical || 0) / total * 100) + '%'; c.textContent = (sev.critical || 0) > 0 ? (sev.critical || 0) : ''; }
  if (h) { h.style.width = ((sev.high || 0) / total * 100) + '%'; h.textContent = (sev.high || 0) > 0 ? (sev.high || 0) : ''; }
  if (m) { m.style.width = ((sev.medium || 0) / total * 100) + '%'; m.textContent = (sev.medium || 0) > 0 ? (sev.medium || 0) : ''; }
  if (l) { l.style.width = ((sev.low || 0) / total * 100) + '%'; l.textContent = (sev.low || 0) > 0 ? (sev.low || 0) : ''; }
}
function renderCodeMapGraph(canvas, graph, style = 'force') {
  if (!canvas || !graph || !graph.nodes || graph.nodes.length === 0) return;
  const ctx = canvas.getContext('2d');
  const __cssStyles = getComputedStyle(document.documentElement);
  const __css_fg = (__cssStyles.getPropertyValue('--vscode-button-foreground') || __cssStyles.getPropertyValue('--vscode-foreground') || '#fff').trim();
  const __css_panel = (__cssStyles.getPropertyValue('--vscode-panel-border') || '#e2e8f0').trim();
  const __css_desc = (__cssStyles.getPropertyValue('--vscode-descriptionForeground') || '#94a3b8').trim();
  if (!ctx) return;
  const wrap = canvas.parentElement;
  let lastW = 0, lastH = 0;
  function resize() {
    if (!wrap) return;
    const oldW = canvas.width;
    const oldH = canvas.height;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    // Keep the world point under the old center fixed at the new center
    if (oldW > 0 && oldH > 0 && (oldW !== w || oldH !== h)) {
      pan.x += (w - oldW) / 2;
      pan.y += (h - oldH) / 2;
    }
    canvas.width = w;
    canvas.height = h;
    W = w; H = h;
    const wasMinSize = lastW <= 1 && lastH <= 1;
    if (wasMinSize && w > 1 && h > 1 && nodes) {
      nodes.forEach((n, i) => { n.x = w / 2 + Math.cos(i * 2.4) * Math.min(w,h) / 3; n.y = h / 2 + Math.sin(i * 2.4) * Math.min(w,h) / 3; n.vx = 0; n.vy = 0; });
      t = 0;
    }
    lastW = w; lastH = h;
  }
  const colors = {'.js':'#f7df1e','.ts':'#3178c6','.tsx':'#3178c6','.jsx':'#61dafb','.cjs':'#f0db4f','.mjs':'#f0db4f','.py':'#3776ab','.json':'#94a3b8','.html':'#e34c26','.css':'#38bdf8','.md':'#8b5cf6','.yml':'#ef4444','.yaml':'#ef4444','.go':'#00add8','.rs':'#dea584','.java':'#b07219','.cpp':'#f34b7d','.c':'#555555','.sh':'#89e051','.vue':'#41b883','.php':'#4f5d95','.rb':'#701516','.swift':'#f05138','.kt':'#a97bff','Other':'#64748b'};
  let W = canvas.width, H = canvas.height;
  const nodeMap = {};
  // Compute connection count for each node to size them appropriately
  const connectionCount = {};
  (graph.edges || []).forEach(e => { connectionCount[e.source] = (connectionCount[e.source] || 0) + 1; connectionCount[e.target] = (connectionCount[e.target] || 0) + 1; });
  const maxConn = Math.max(1, ...Object.values(connectionCount));
  const nodes = graph.nodes.map((n, i) => {
    const conn = connectionCount[n.id] || 0;
    const radius = Math.max(3, Math.min(16, 4 + (conn / maxConn) * 12));
    const node = { id: n.id, label: n.label || n.id, group: n.group || '', size: n.size || 1, x: W / 2 + Math.cos(i * 2.4) * Math.min(W,H) / 3, y: H / 2 + Math.sin(i * 2.4) * Math.min(W,H) / 3, vx: 0, vy: 0, radius, connections: conn };
    nodeMap[n.id] = node;
    return node;
  });
  const edges = (graph.edges || []).map(e => ({ source: nodeMap[e.source], target: nodeMap[e.target] })).filter(e => e.source && e.target);
  let dragging = null, hoverNode = null, offset = {x: 0, y: 0}, scale = 1, pan = {x: 0, y: 0};
  let paused = false, showLabels = true, filterText = '';
  let zoomDragging = false, zoomStartY = 0, zoomStartScale = 1;
  let middlePanning = false, middlePanStart = {x:0,y:0,px:0,py:0};
  let animId = null, timeoutId = null;
  let currentStyle = style;
  let t = 0;
  function getColor(n) { return colors[n.group] || '#64748b'; }
  function worldToScreen(p) { return { x: p.x * scale + pan.x, y: p.y * scale + pan.y }; }
  function screenToWorld(mx, my) { return { x: (mx - pan.x) / scale, y: (my - pan.y) / scale }; }
  function matchesFilter(n) {
    if (!filterText) return true;
    return n.label.toLowerCase().includes(filterText.toLowerCase()) || n.id.toLowerCase().includes(filterText.toLowerCase());
  }
  function updateZoomDisplay() {
    const zd = document.getElementById('graphZoomDisplay');
    if (zd) zd.textContent = Math.round(scale * 100) + '%';
  }
  function zoomToNode(n) {
    if (!n) return;
    scale = Math.min(10, Math.max(2, 4));
    pan.x = (W / 2) - n.x * scale;
    pan.y = (H / 2) - n.y * scale;
    updateZoomDisplay();
  }
  function classifyLayer(fp) {
    const p = String(fp).toLowerCase().split(String.fromCharCode(92)).join('/');
    const name = p.split('/').pop() || '';
    if (/(?:^|[/])(test|tests|__tests__|__mocks__|spec|e2e|cypress|playwright)(?:[/]|$)/.test(p) || /\\.(test|spec)\\.(js|ts|jsx|tsx|py|go|rs)$/.test(name)) return 'tests';
    if (/^(index|main|app|server|cli|entry|bootstrap|start)\\.(js|ts|cjs|mjs|py|go|rs|java)$/.test(name)) return 'entry';
    if (/(?:^|[/])(components?|ui|pages?|views?|templates?|widgets|screens|layouts?)(?:[/]|$)/.test(p) || /\\.(tsx|jsx|vue|svelte|html|css|scss|less)$/.test(name)) return 'ui';
    if (/(?:^|[/])(services?|controllers?|business|logic|api|routes?|handlers?|middleware|actions?)(?:[/]|$)/.test(p) || /(service|controller|route|handler|middleware|action)\\.(js|ts|cjs|mjs)$/.test(name)) return 'business';
    if (/(?:^|[/])(db|database|models?|repositories?|stores?|schemas?|migrations?|configs?|settings?|infra|docker|k8s|helm)(?:[/]|$)/.test(p) || /(config|model|schema|repository|store|migration|docker|dockerfile|docker-compose|k8s|helm)\\.(js|ts|json|yaml|yml|env)$/.test(name)) return 'data';
    if (/(?:^|[/])(utils?|helpers?|lib|common|shared|tools?|scripts?|packages?)(?:[/]|$)/.test(p) || /(util|helper|common|shared|tool|lib)\\.(js|ts|cjs|mjs)$/.test(name)) return 'utils';
    return 'other';
  }
  resize();
  let roTimer = null;
  const resizeObserver = wrap ? new ResizeObserver(() => { if (roTimer) { clearTimeout(roTimer); } roTimer = setTimeout(resize, 50); }) : null;
  if (resizeObserver && wrap) resizeObserver.observe(wrap);
  // Ensure the canvas is resized once it becomes visible (e.g., when the Code Map tab is opened after data arrives)
  const intersectionObserver = wrap && typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) resize(); }, { threshold: 0 }) : null;
  if (intersectionObserver && wrap) intersectionObserver.observe(wrap);
  // Fallback: if the pane was hidden when the graph was first created, resize after it becomes visible
  setTimeout(resize, 0);
  setTimeout(resize, 100);

  function computeRadialLayout() {
    const cx = W / 2, cy = H / 2;
    const root = nodes.find(n => !edges.some(e => e.target === n));
    const levels = [];
    function depth(n, visited = new Set()) {
      if (visited.has(n.id)) return 0;
      visited.add(n.id);
      const incoming = edges.filter(e => e.target === n);
      if (incoming.length === 0) return 0;
      return 1 + Math.max(...incoming.map(e => depth(e.source, new Set(visited))));
    }
    const maxDepth = Math.max(1, ...nodes.map(n => depth(n)));
    const byLevel = [];
    for (let i = 0; i <= maxDepth; i++) byLevel.push([]);
    nodes.forEach(n => { const d = depth(n); byLevel[d].push(n); });
    const radiusStep = Math.min(W, H) / (2 * (maxDepth + 1.5));
    byLevel.forEach((levelNodes, level) => {
      const r = radiusStep * (level + 1);
      const count = levelNodes.length;
      levelNodes.forEach((n, i) => {
        const angle = (i / count) * Math.PI * 2;
        n.tx = cx + Math.cos(angle) * r;
        n.ty = cy + Math.sin(angle) * r;
      });
    });
  }
  function computeGridLayout() {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const cell = Math.min(W / cols, 120);
    const groups = {};
    nodes.forEach(n => { const g = n.group || 'Other'; if (!groups[g]) groups[g] = []; groups[g].push(n); });
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    let x = 40, y = 40, rowH = 0;
    sortedGroups.forEach(([group, groupNodes]) => {
      const groupStart = x;
      groupNodes.forEach((n, i) => {
        n.tx = groupStart + (i % cols) * cell;
        n.ty = y + Math.floor(i / cols) * cell;
      });
      const rows = Math.ceil(groupNodes.length / cols);
      rowH = Math.max(rowH, rows * cell);
      x += cols * cell + 40;
      if (x > W - 80) { x = 40; y += rowH + 40; rowH = 0; }
    });
    // Center the grid
    const xs = nodes.map(n => n.tx), ys = nodes.map(n => n.ty);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const dx = (W - (maxX - minX)) / 2 - minX, dy = (H - (maxY - minY)) / 2 - minY;
    nodes.forEach(n => { n.tx += dx; n.ty += dy; });
  }
  function computeHierarchicalLayout() {
    const tree = {};
    nodes.forEach(n => { tree[n.id] = { n, children: [], depth: 0 }; });
    edges.forEach(e => { if (tree[e.source.id] && tree[e.target.id]) tree[e.source.id].children.push(e.target.id); });
    const roots = nodes.filter(n => !edges.some(e => e.target === n)).map(n => n.id);
    if (roots.length === 0) nodes.forEach(n => roots.push(n.id));
    function setDepth(id, d, visited) {
      if (!tree[id] || visited.has(id)) return;
      visited.add(id);
      tree[id].depth = Math.max(tree[id].depth, d);
      tree[id].children.forEach(cid => setDepth(cid, d + 1, new Set(visited)));
    }
    roots.forEach(rid => setDepth(rid, 0, new Set()));
    const levels = [];
    nodes.forEach(n => {
      const d = tree[n.id].depth;
      if (!levels[d]) levels[d] = [];
      levels[d].push(n);
    });
    const levelHeight = H / (levels.length + 1);
    levels.forEach((levelNodes, level) => {
      const y = levelHeight * (level + 1);
      const gap = W / (levelNodes.length + 1);
      levelNodes.forEach((n, i) => { n.tx = gap * (i + 1); n.ty = y; });
    });
  }
  function computeCityLayout() {
    const layerOrder = ['entry', 'ui', 'business', 'data', 'utils', 'tests', 'other'];
    const layerGroups = {};
    nodes.forEach(n => {
      const layer = classifyLayer(n.id);
      (layerGroups[layer] = layerGroups[layer] || []).push(n);
    });
    const usableHeight = H * 0.85;
    const layerHeight = usableHeight / layerOrder.length;
    const topOffset = H * 0.08;
    layerOrder.forEach((layer, li) => {
      const layerNodes = layerGroups[layer] || [];
      const y = topOffset + layerHeight * li + layerHeight / 2;
      const cols = Math.max(1, Math.ceil(Math.sqrt(layerNodes.length)));
      const cell = Math.min((W - 80) / cols, 140);
      layerNodes.forEach((n, i) => {
        n.tx = 40 + (i % cols) * cell;
        n.ty = y;
      });
    });
  }
  function applyLayout(animate) {
    if (currentStyle === 'radial') computeRadialLayout();
    else if (currentStyle === 'grid') computeGridLayout();
    else if (currentStyle === 'hierarchical') computeHierarchicalLayout();
    else if (currentStyle === 'city') computeCityLayout();
    if (currentStyle !== 'force') {
      nodes.forEach(n => { if (animate) { n.vx = (n.tx - n.x) * 0.1; n.vy = (n.ty - n.y) * 0.1; } else { n.x = n.tx; n.y = n.ty; } });
      if (!animate) t = 1000;
    } else {
      t = 0;
    }
  }
  applyLayout(false);
  canvas.addEventListener('mousedown', e => {
    if (e.button === 1) {
      e.preventDefault();
      middlePanning = true;
      middlePanStart = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      function onMiddleMove(ev) { if (!middlePanning) return; pan.x = middlePanStart.px + (ev.clientX - middlePanStart.x); pan.y = middlePanStart.py + (ev.clientY - middlePanStart.y); }
      function onMiddleUp() { middlePanning = false; document.removeEventListener('mousemove', onMiddleMove); document.removeEventListener('mouseup', onMiddleUp); }
      document.addEventListener('mousemove', onMiddleMove);
      document.addEventListener('mouseup', onMiddleUp);
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      zoomDragging = true;
      zoomStartY = e.clientY;
      zoomStartScale = scale;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    for (const n of nodes) {
      if (!matchesFilter(n)) continue;
      const dx = w.x - n.x, dy = w.y - n.y;
      if (dx * dx + dy * dy < (n.radius + 4) ** 2) { dragging = n; offset = {x: dx, y: dy}; return; }
    }
    // Pan on empty space
    const startPan = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    function onMove(ev) { pan.x = startPan.px + (ev.clientX - startPan.x); pan.y = startPan.py + (ev.clientY - startPan.y); }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  canvas.addEventListener('mousemove', e => {
    if (zoomDragging) {
      const dy = zoomStartY - e.clientY;
      const factor = Math.exp(dy * 0.005);
      const newScale = Math.max(0.05, Math.min(100, zoomStartScale * factor));
      const rect = canvas.getBoundingClientRect();
      const center = { x: rect.width / 2, y: rect.height / 2 };
      const w = screenToWorld(center.x, center.y);
      scale = newScale;
      pan.x = center.x - w.x * scale;
      pan.y = center.y - w.y * scale;
      updateZoomDisplay();
      canvas.style.cursor = 'ns-resize'; return;
    }
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    if (dragging && currentStyle === 'force') { dragging.x = w.x - offset.x; dragging.y = w.y - offset.y; }
    hoverNode = null;
    for (const n of nodes) {
      if (!matchesFilter(n)) continue;
      const dx = w.x - n.x, dy = w.y - n.y;
      if (dx * dx + dy * dy < (n.radius + 4) ** 2) { hoverNode = n; break; }
    }
  });
  canvas.addEventListener('mouseup', () => { dragging = null; zoomDragging = false; middlePanning = false; });
  canvas.addEventListener('mouseleave', () => { dragging = null; hoverNode = null; zoomDragging = false; middlePanning = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = screenToWorld(mx, my);
    const speedMult = e.shiftKey ? 3 : 1;
    const factor = Math.exp(-e.deltaY * 0.003 * speedMult);
    scale = Math.max(0.05, Math.min(100, scale * factor));
    updateZoomDisplay();
    pan.x = mx - w.x * scale;
    pan.y = my - w.y * scale;
  }, { passive: false });
  canvas.addEventListener('dblclick', e => {
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    for (const n of nodes) {
      if (!matchesFilter(n)) continue;
      const dx = w.x - n.x, dy = w.y - n.y;
      if (dx * dx + dy * dy < (n.radius + 4) ** 2) { zoomToNode(n); return; }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const slow = e.altKey ? 0.25 : 1;
    const panStep = 40 * slow;
    const zoomMult = 1 + (0.25 * slow);
    switch (e.key) {
      case '+': case '=': e.preventDefault(); scale = Math.min(100, scale * zoomMult); updateZoomDisplay(); break;
      case '-': case '_': e.preventDefault(); scale = Math.max(0.05, scale / zoomMult); updateZoomDisplay(); break;
      case '0': e.preventDefault(); scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); break;
      case 'ArrowUp': e.preventDefault(); pan.y += panStep; break;
      case 'ArrowDown': e.preventDefault(); pan.y -= panStep; break;
      case 'ArrowLeft': e.preventDefault(); pan.x += panStep; break;
      case 'ArrowRight': e.preventDefault(); pan.x -= panStep; break;
      case 'w': case 'W': e.preventDefault(); pan.y += panStep; break;
      case 's': case 'S': e.preventDefault(); pan.y -= panStep; break;
      case 'a': case 'A': e.preventDefault(); pan.x += panStep; break;
      case 'd': case 'D': e.preventDefault(); pan.x -= panStep; break;
      case 'PageUp': e.preventDefault(); scale = Math.min(100, scale * zoomMult); updateZoomDisplay(); break;
      case 'PageDown': e.preventDefault(); scale = Math.max(0.05, scale / zoomMult); updateZoomDisplay(); break;
      case 'r': case 'R': e.preventDefault(); scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); break;
      case ' ': e.preventDefault(); paused = !paused; const pbtn = document.getElementById('graphPauseBtn'); if (pbtn) { pbtn.textContent = paused ? '▶' : '⏸'; pbtn.classList.toggle('active', paused); } break;
      case '/': e.preventDefault(); document.getElementById('graphSearchInput')?.focus(); break;
    }
  });
  function step() {
    if (!paused && currentStyle === 'force') {
      const k = 0.05, repel = 200, spring = 0.005, damping = 0.85, center = 0.01;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!matchesFilter(a)) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (!matchesFilter(b)) continue;
          let dx = a.x - b.x, dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = repel / (dist * dist);
          dx /= dist; dy /= dist;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      for (const e of edges) {
        if (!matchesFilter(e.source) || !matchesFilter(e.target)) continue;
        let dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (dist - 80) * spring;
        dx /= dist; dy /= dist;
        e.source.vx += dx * f; e.source.vy += dy * f;
        e.target.vx -= dx * f; e.target.vy -= dy * f;
      }
      for (const n of nodes) {
        if (!matchesFilter(n)) continue;
        n.vx += (W / 2 - n.x) * center;
        n.vy += (H / 2 - n.y) * center;
        n.vx *= damping; n.vy *= damping;
        n.x += n.vx; n.y += n.vy;
      }
      t++;
      if (t > 300) { for (const n of nodes) { n.vx = 0; n.vy = 0; } }
    } else if (!paused && currentStyle !== 'force') {
      // Animate toward target layout
      for (const n of nodes) {
        if (!matchesFilter(n)) continue;
        n.x += (n.tx - n.x) * 0.08;
        n.y += (n.ty - n.y) * 0.08;
      }
    }
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);
    // Draw edges with distance-based opacity for depth perception
    for (const e of edges) {
      if (!matchesFilter(e.source) || !matchesFilter(e.target)) continue;
      const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const opacity = Math.max(0.05, Math.min(0.3, 120 / dist));
      ctx.strokeStyle = 'rgba(148,163,184,' + opacity + ')';
      ctx.lineWidth = Math.max(0.5, Math.min(2, opacity * 3));
      ctx.beginPath();
      ctx.moveTo(e.source.x, e.source.y);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.stroke();
    }
    // Draw nodes with glow effect for hovered/important nodes
    for (const n of nodes) {
      if (!matchesFilter(n)) continue;
      const color = getColor(n);
      // Glow for highly connected nodes
      if (n.connections > maxConn * 0.3) {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15;
        ctx.arc(n.x, n.y, n.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();
      // Inner highlight for top-connected nodes
      if (n.connections > maxConn * 0.5) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.arc(n.x - n.radius * 0.25, n.y - n.radius * 0.25, n.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (n === hoverNode || n === dragging) {
        ctx.strokeStyle = __css_fg;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    // Draw labels with background to avoid overlap
    if (showLabels) {
      for (const n of nodes) {
        if (!matchesFilter(n)) continue;
        const shouldLabel = n === hoverNode || n === dragging || n.connections > maxConn * 0.15 || n.radius >= 7;
        if (!shouldLabel) continue;
        const text = n.label;
        ctx.font = n === hoverNode ? 'bold 11px sans-serif' : '10px sans-serif';
        const tw = ctx.measureText(text).width;
        const tx = n.x + n.radius + 5, ty = n.y + 3;
        // Label background
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        ctx.beginPath();
        ctx.roundRect(tx - 2, ty - 9, tw + 6, 13, 3);
        ctx.fill();
        ctx.fillStyle = n === hoverNode ? __css_fg : __css_panel;
        ctx.fillText(text, tx, ty);
      }
    }
    // Hover tooltip
    if (hoverNode) {
      const tip = hoverNode.label + '\\n' + hoverNode.connections + ' connections';
      const lines = tip.split('\\n');
      const maxTw = Math.max(...lines.map(l => ctx.measureText(l).width));
      const tx = hoverNode.x + hoverNode.radius + 10, ty = hoverNode.y - 20;
      ctx.fillStyle = 'rgba(15,23,42,0.95)';
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx - 6, ty - 6, maxTw + 14, lines.length * 14 + 8, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = __css_panel;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(lines[0], tx, ty + 10);
      ctx.fillStyle = __css_desc;
      ctx.font = '10px sans-serif';
      if (lines[1]) ctx.fillText(lines[1], tx, ty + 24);
    }
    ctx.restore();
    if (!paused && currentStyle === 'force' && (t < 350 || dragging)) animId = requestAnimationFrame(step);
    else animId = requestAnimationFrame(step);
  }
  animId = requestAnimationFrame(step);
  canvas._graphCleanup = () => { if (resizeObserver && wrap) resizeObserver.disconnect(); if (intersectionObserver && wrap) intersectionObserver.disconnect(); if (animId) cancelAnimationFrame(animId); if (timeoutId) clearTimeout(timeoutId); };
  canvas._graphResize = resize;
  return {
    resetView() { scale = 1; pan = {x: 0, y: 0}; applyLayout(false); updateZoomDisplay(); },
    zoomIn() { scale = Math.min(100, scale * 1.2); updateZoomDisplay(); },
    zoomOut() { scale = Math.max(0.05, scale / 1.2); updateZoomDisplay(); },
    togglePause() { paused = !paused; },
    isPaused() { return paused; },
    toggleLabels() { showLabels = !showLabels; },
    showLabels() { return showLabels; },
    setFilter(text) { filterText = text || ''; },
    setStyle(s) { currentStyle = s; applyLayout(true); }
  };
}
function renderEmpty(container, message, iconText) {
  const empty = document.createElement('div');
  empty.className = 'db-empty';
  const icon = document.createElement('div');
  icon.className = 'db-empty-icon';
  icon.textContent = iconText || '🔍';
  const msg = document.createElement('div');
  msg.textContent = message;
  empty.appendChild(icon);
  empty.appendChild(msg);
  container.appendChild(empty);
}
function renderFindingRow(classPrefix, f) {
  const sev = (f.severity || 'low').toLowerCase();
  const row = document.createElement('div');
  row.className = classPrefix + '-row';
  const sevEl = document.createElement('div');
  sevEl.className = classPrefix + '-sev ' + sev;
  const titleEl = document.createElement('div');
  titleEl.className = classPrefix + '-text';
  titleEl.textContent = f.title || f.type || f.message || 'Issue';
  const fileEl = document.createElement('div');
  fileEl.className = classPrefix + '-file';
  fileEl.textContent = f.file || 'unknown';
  row.appendChild(sevEl);
  row.appendChild(titleEl);
  row.appendChild(fileEl);
  return row;
}
function renderAnalyzeFindings(findings) {
  const list = document.getElementById('analyzeFindingsList');
  if (!list) return;
  list.textContent = '';
  if (!findings || findings.length === 0) { renderEmpty(list, 'No findings yet. Run a scan to detect issues.'); return; }
  findings.slice(0, 30).forEach(f => list.appendChild(renderFindingRow('analyze-finding', f)));
}
/* Report Pane Interactivity */
let _reportFindings = [];
function updateReportSeverityBar(sev) {
  const total = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
  if (total === 0) return;
  const c = document.getElementById('reportSevCritical'), h = document.getElementById('reportSevHigh'), m = document.getElementById('reportSevMedium'), l = document.getElementById('reportSevLow');
  if (c) { c.style.width = ((sev.critical || 0) / total * 100) + '%'; c.textContent = (sev.critical || 0) > 0 ? (sev.critical || 0) : ''; }
  if (h) { h.style.width = ((sev.high || 0) / total * 100) + '%'; h.textContent = (sev.high || 0) > 0 ? (sev.high || 0) : ''; }
  if (m) { m.style.width = ((sev.medium || 0) / total * 100) + '%'; m.textContent = (sev.medium || 0) > 0 ? (sev.medium || 0) : ''; }
  if (l) { l.style.width = ((sev.low || 0) / total * 100) + '%'; l.textContent = (sev.low || 0) > 0 ? (sev.low || 0) : ''; }
}
function renderReportFindings(findings) {
  _reportFindings = findings || [];
  const list = document.getElementById('reportFindingsList');
  if (!list) return;
  const searchInput = document.getElementById('reportSearchInput');
  const search = (searchInput && searchInput.value || '').toLowerCase();
  const sevInput = document.getElementById('reportSeverityFilter');
  const sevFilter = (sevInput && sevInput.value) || 'all';
  const catInput = document.getElementById('reportCategoryFilter');
  const catFilter = (catInput && catInput.value) || 'all';
  const filtered = _reportFindings.filter(f => {
    const sev = (f.severity || 'low').toLowerCase();
    const cat = (f.category || '').toLowerCase();
    const title = (f.title || f.type || f.message || '').toLowerCase();
    const file = (f.file || '').toLowerCase();
    if (sevFilter !== 'all' && sev !== sevFilter) return false;
    if (catFilter !== 'all' && !cat.includes(catFilter)) return false;
    if (search && !title.includes(search) && !file.includes(search)) return false;
    return true;
  });
  if (filtered.length === 0) { renderEmpty(list, 'No findings match your filters.', '📄'); return; }
  filtered.slice(0, 50).forEach(f => {
    const sev = (f.severity || 'low').toLowerCase();
    const item = document.createElement('div');
    item.className = 'report-finding-item';
    item.dataset.sev = sev;
    const header = document.createElement('div');
    header.className = 'report-finding-header';
    const sevEl = document.createElement('div');
    sevEl.className = 'report-finding-sev ' + sev;
    const titleEl = document.createElement('div');
    titleEl.className = 'report-finding-title';
    titleEl.textContent = f.title || f.type || f.message || 'Issue';
    header.appendChild(sevEl);
    header.appendChild(titleEl);
    const meta = document.createElement('div');
    meta.className = 'report-finding-meta';
    const fileSpan = document.createElement('span');
    fileSpan.textContent = (f.file || 'unknown') + (f.line ? ':' + f.line : '');
    const catSpan = document.createElement('span');
    catSpan.textContent = f.category || 'General';
    const sevSpan = document.createElement('span');
    sevSpan.textContent = sev.toUpperCase();
    meta.appendChild(fileSpan);
    meta.appendChild(catSpan);
    meta.appendChild(sevSpan);
    item.appendChild(header);
    item.appendChild(meta);
    if (f.description || f.detail) {
      const detail = document.createElement('div');
      detail.className = 'report-finding-detail';
      detail.textContent = f.description || f.detail;
      item.appendChild(detail);
    }
    item.addEventListener('click', () => item.classList.toggle('expanded'));
    list.appendChild(item);
  });
}
function renderReportFiles(files) {
  const grid = document.getElementById('reportFilesGrid');
  if (!grid) return;
  grid.textContent = '';
  if (!files || files.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'db-empty';
    empty.style.gridColumn = '1/-1';
    const icon = document.createElement('div');
    icon.className = 'db-empty-icon';
    icon.textContent = '📄';
    const msg = document.createElement('div');
    msg.textContent = 'No file data available.';
    empty.appendChild(icon);
    empty.appendChild(msg);
    grid.appendChild(empty);
    return;
  }
  files.slice(0, 30).forEach(f => {
    const issues = f.issues || f.issueCount || 0;
    const card = document.createElement('div');
    card.className = 'report-file-card';
    const name = document.createElement('div');
    name.className = 'report-file-name';
    name.textContent = f.name || f.path || 'unknown';
    const meta = document.createElement('div');
    meta.className = 'report-file-meta';
    meta.textContent = (f.language || f.type || 'unknown') + ' · ' + issues + ' issue' + (issues === 1 ? '' : 's');
    card.appendChild(name);
    card.appendChild(meta);
    grid.appendChild(card);
  });
}
function renderReportCategories(findings) {
  const list = document.getElementById('reportCategoryList');
  if (!list) return;
  list.textContent = '';
  if (!findings || findings.length === 0) { renderEmpty(list, 'No category data available.', '📄'); return; }
  const counts = {};
  findings.forEach(f => { const c = f.category || 'General'; counts[c] = (counts[c] || 0) + 1; });
  const total = findings.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  entries.forEach(([cat, count]) => {
    const pct = Math.round((count / total) * 100);
    const item = document.createElement('div');
    item.className = 'report-category-item';
    const header = document.createElement('div');
    header.className = 'report-category-header';
    const name = document.createElement('span');
    name.className = 'report-category-name';
    name.textContent = cat;
    const cnt = document.createElement('span');
    cnt.className = 'report-category-count';
    cnt.textContent = String(count);
    header.appendChild(name);
    header.appendChild(cnt);
    const bar = document.createElement('div');
    bar.className = 'report-category-bar';
    const fill = document.createElement('div');
    fill.className = 'report-category-fill';
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    item.appendChild(header);
    item.appendChild(bar);
    list.appendChild(item);
  });
}
function updateReportTimestamp() {
  const el = document.getElementById('reportTimestamp');
  if (el) el.textContent = 'Last scan: ' + new Date().toLocaleString();
}
document.querySelectorAll('.report-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.toggle('active', t === tab));
    const sectionId = tab.dataset.section;
    document.querySelectorAll('.report-section').forEach(s => s.classList.toggle('active', s.id === sectionId));
  });
});
const reportSearchInput = document.getElementById('reportSearchInput');
if (reportSearchInput) reportSearchInput.addEventListener('input', () => renderReportFindings(_reportFindings));
const reportSeverityFilter = document.getElementById('reportSeverityFilter');
if (reportSeverityFilter) reportSeverityFilter.addEventListener('change', () => renderReportFindings(_reportFindings));
const reportCategoryFilter = document.getElementById('reportCategoryFilter');
if (reportCategoryFilter) reportCategoryFilter.addEventListener('change', () => renderReportFindings(_reportFindings));
const reportClearFiltersBtn = document.getElementById('reportClearFiltersBtn');
if (reportClearFiltersBtn) {
  reportClearFiltersBtn.addEventListener('click', () => {
    if (reportSearchInput) reportSearchInput.value = '';
    if (reportSeverityFilter) reportSeverityFilter.value = 'all';
    if (reportCategoryFilter) reportCategoryFilter.value = 'all';
    renderReportFindings(_reportFindings);
  });
}
const reportRefreshBtn = document.getElementById('reportRefreshBtn');
if (reportRefreshBtn) reportRefreshBtn.addEventListener('click', () => vscode.postMessage({ command: 'refreshReport' }));
const reportExportBtn = document.getElementById('reportExportBtn');
if (reportExportBtn) reportExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportReport' }));
const reportExportJsonBtn = document.getElementById('reportExportJsonBtn');
if (reportExportJsonBtn) reportExportJsonBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportReport' }));
const reportExportPdfBtn = document.getElementById('reportExportPdfBtn');
if (reportExportPdfBtn) reportExportPdfBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportReportPdf' }));
const reportExportExcelBtn = document.getElementById('reportExportExcelBtn');
if (reportExportExcelBtn) reportExportExcelBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportReportExcel' }));
const certGenerateBtn = document.getElementById('certGenerateBtn');
if (certGenerateBtn) certGenerateBtn.addEventListener('click', () => vscode.postMessage({ command: 'generateCertificate' }));
const certExportPdfBtn = document.getElementById('certExportPdfBtn');
if (certExportPdfBtn) certExportPdfBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportReportPdf' }));
const certViewReportBtn = document.getElementById('certViewReportBtn');
if (certViewReportBtn) certViewReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const certSettingsBtn = document.getElementById('certSettingsBtn');
if (certSettingsBtn) certSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const mapGenerateBtn = document.getElementById('mapGenerateBtn');
if (mapGenerateBtn) mapGenerateBtn.addEventListener('click', () => vscode.postMessage({ command: 'generateCodeMap' }));
const mapExportBtn = document.getElementById('mapExportBtn');
if (mapExportBtn) mapExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportCodeMap' }));
const mapOpenHtmlBtn = document.getElementById('mapOpenHtmlBtn');
if (mapOpenHtmlBtn) mapOpenHtmlBtn.addEventListener('click', () => vscode.postMessage({ command: 'openCodeMapHtml' }));
const mapRefreshBtn = document.getElementById('mapRefreshBtn');
if (mapRefreshBtn) mapRefreshBtn.addEventListener('click', () => vscode.postMessage({ command: 'refreshCodeMap' }));
const mapGenerateBtnPreview = document.getElementById('mapGenerateBtnPreview');
if (mapGenerateBtnPreview) mapGenerateBtnPreview.addEventListener('click', () => vscode.postMessage({ command: 'generateCodeMap' }));
const roadTriageBtn = document.getElementById('roadTriageBtn');
if (roadTriageBtn) roadTriageBtn.addEventListener('click', () => focusRoadmapPhase(0));
const roadShortTermBtn = document.getElementById('roadShortTermBtn');
if (roadShortTermBtn) roadShortTermBtn.addEventListener('click', () => focusRoadmapPhase(1));
const roadLongTermBtn = document.getElementById('roadLongTermBtn');
if (roadLongTermBtn) roadLongTermBtn.addEventListener('click', () => focusRoadmapPhase(2));
const roadExportBtn = document.getElementById('roadExportBtn');
if (roadExportBtn) roadExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportRoadmap' }));
const aiScanBtn = document.getElementById('aiScanBtn');
if (aiScanBtn) aiScanBtn.addEventListener('click', () => vscode.postMessage({ command: 'scan', mode: 'workspace' }));
const aiExportBtn = document.getElementById('aiExportBtn');
if (aiExportBtn) aiExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportAiContext' }));
const aiReportBtn = document.getElementById('aiReportBtn');
if (aiReportBtn) aiReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const aiSettingsBtn = document.getElementById('aiSettingsBtn');
if (aiSettingsBtn) aiSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
let _uploadedFiles = [];
function renderUploadStats() {
  const total = document.getElementById('upTotal');
  const valid = document.getElementById('upValid');
  const errors = document.getElementById('upErrors');
  const score = document.getElementById('upScore');
  const badge = document.getElementById('upStatusBadge');
  const validCount = _uploadedFiles.filter(f => f.valid).length;
  const errorCount = _uploadedFiles.filter(f => !f.valid).length;
  const pct = _uploadedFiles.length ? Math.round((validCount / _uploadedFiles.length) * 100) : 0;
  if (total) total.textContent = String(_uploadedFiles.length);
  if (valid) valid.textContent = String(validCount);
  if (errors) errors.textContent = String(errorCount);
  if (score) score.textContent = pct + '%';
  if (badge) {
    badge.textContent = errorCount > 0 ? 'Errors' : _uploadedFiles.length > 0 ? 'Ready' : 'Idle';
    badge.className = 'db-gate-badge ' + (errorCount > 0 ? 'db-gate-fail' : 'db-gate-pass');
  }
}
function renderUploadFiles() {
  const list = document.getElementById('upResultsList');
  if (!list) return;
  list.textContent = '';
  if (_uploadedFiles.length === 0) {
    const item = document.createElement('div');
    item.className = 'up-result-item';
    const icon = document.createElement('span');
    icon.className = 'up-result-icon';
    icon.textContent = '✅';
    const text = document.createElement('span');
    text.className = 'up-result-text';
    text.textContent = 'No files uploaded yet';
    const status = document.createElement('span');
    status.className = 'up-result-status';
    status.textContent = 'Ready';
    item.appendChild(icon);
    item.appendChild(text);
    item.appendChild(status);
    list.appendChild(item);
    return;
  }
  _uploadedFiles.forEach(f => {
    const item = document.createElement('div');
    item.className = 'up-result-item';
    const icon = document.createElement('span');
    icon.className = 'up-result-icon';
    icon.textContent = f.valid ? '✅' : '❌';
    const text = document.createElement('span');
    text.className = 'up-result-text';
    text.textContent = f.name + ' (' + (f.content.length || 0) + ' chars)' + (f.error ? ' — ' + f.error : '');
    const status = document.createElement('span');
    status.className = 'up-result-status';
    status.textContent = f.valid ? 'Valid' : 'Invalid';
    item.appendChild(icon);
    item.appendChild(text);
    item.appendChild(status);
    list.appendChild(item);
  });
}
function validateUploadFiles() {
  _uploadedFiles.forEach(f => {
    const ok = f.content && f.content.length > 0;
    f.valid = ok;
    f.error = ok ? '' : 'Empty file';
  });
  renderUploadFiles();
  renderUploadStats();
  vscode.postMessage({ command: 'validateUpload', fileCount: _uploadedFiles.length });
}
function scanUploadFiles() {
  if (_uploadedFiles.length === 0) {
    vscode.postMessage({ command: 'showInfo', text: 'No files to scan. Please upload files first.' });
    return;
  }
  const progress = document.getElementById('upProgressWrap');
  const fill = document.getElementById('upProgressFill');
  const label = document.getElementById('upProgressLabel');
  const pct = document.getElementById('upProgressPct');
  if (progress) progress.classList.add('active');
  if (fill) fill.style.width = '50%';
  if (label) label.textContent = 'Scanning uploaded files...';
  if (pct) pct.textContent = '50%';
  const payload = _uploadedFiles.map(f => ({ name: f.name, content: f.content }));
  vscode.postMessage({ command: 'scanUploadFiles', files: payload });
}
function clearUploadFiles() {
  _uploadedFiles = [];
  const progress = document.getElementById('upProgressWrap');
  const fill = document.getElementById('upProgressFill');
  if (progress) progress.classList.remove('active');
  if (fill) fill.style.width = '0%';
  renderUploadFiles();
  renderUploadStats();
}
function handleFileSelect(fileList) {
  if (!fileList || fileList.length === 0) return;
  const progress = document.getElementById('upProgressWrap');
  const fill = document.getElementById('upProgressFill');
  const label = document.getElementById('upProgressLabel');
  const pct = document.getElementById('upProgressPct');
  if (progress) progress.classList.add('active');
  if (fill) fill.style.width = '10%';
  if (label) label.textContent = 'Reading files...';
  if (pct) pct.textContent = '10%';
  const files = Array.from(fileList);
  let completed = 0;
  const checkDone = () => {
    completed++;
    if (fill) fill.style.width = Math.round((completed / files.length) * 90) + '%';
    if (pct) pct.textContent = Math.round((completed / files.length) * 90) + '%';
    if (completed === files.length) {
      if (progress) progress.classList.remove('active');
      if (fill) fill.style.width = '0%';
      validateUploadFiles();
    }
  };
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const existing = _uploadedFiles.findIndex(f => f.name === file.name);
      const entry = { name: file.name, content, valid: content.length > 0, error: content.length > 0 ? '' : 'Empty file' };
      if (existing >= 0) { _uploadedFiles[existing] = entry; } else { _uploadedFiles.push(entry); }
      checkDone();
    };
    reader.onerror = () => {
      const existing = _uploadedFiles.findIndex(f => f.name === file.name);
      const entry = { name: file.name, content: '', valid: false, error: 'Read failed' };
      if (existing >= 0) { _uploadedFiles[existing] = entry; } else { _uploadedFiles.push(entry); }
      checkDone();
    };
    reader.readAsText(file);
  });
}
const upFileInput = document.getElementById('upFileInput');
const upDropzone = document.getElementById('upDropzone');
const upBrowseBtn = document.getElementById('upBrowseBtn');
const upValidateBtn = document.getElementById('upValidateBtn');
const upScanBtn = document.getElementById('upScanBtn');
const upClearBtn = document.getElementById('upClearBtn');
if (upBrowseBtn && upFileInput) upBrowseBtn.addEventListener('click', () => upFileInput.click());
if (upFileInput) upFileInput.addEventListener('change', () => { if (upFileInput.files) handleFileSelect(upFileInput.files); });
if (upDropzone) {
  upDropzone.addEventListener('click', (e) => { if (e.target !== upFileInput) upFileInput.click(); });
  upDropzone.addEventListener('dragover', (e) => { e.preventDefault(); upDropzone.classList.add('dragover'); });
  upDropzone.addEventListener('dragleave', () => { upDropzone.classList.remove('dragover'); });
  upDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    upDropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
  });
}
if (upValidateBtn) upValidateBtn.addEventListener('click', validateUploadFiles);
if (upScanBtn) upScanBtn.addEventListener('click', scanUploadFiles);
if (upClearBtn) upClearBtn.addEventListener('click', clearUploadFiles);
const audRunBtn = document.getElementById('audRunBtn');
if (audRunBtn) audRunBtn.addEventListener('click', () => vscode.postMessage({ command: 'openFullAudit' }));
const audExportBtn = document.getElementById('audExportBtn');
if (audExportBtn) audExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportAuditReport' }));
const audReportBtn = document.getElementById('audReportBtn');
if (audReportBtn) audReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const audSettingsBtn = document.getElementById('audSettingsBtn');
if (audSettingsBtn) audSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const secScanBtn = document.getElementById('secScanBtn');
if (secScanBtn) secScanBtn.addEventListener('click', () => {
  addTab('Scan', 'scanPane');
  activateTab('scanPane');
  const pw = document.getElementById('scProgressWrap');
  if (pw) pw.classList.add('active');
  vscode.postMessage({ command: 'scan' });
});
const secExportBtn = document.getElementById('secExportBtn');
if (secExportBtn) secExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportSecurityReport' }));
const secReportBtn = document.getElementById('secReportBtn');
if (secReportBtn) secReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const secSettingsBtn = document.getElementById('secSettingsBtn');
if (secSettingsBtn) secSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const trustVerifyBtn = document.getElementById('trustVerifyBtn');
if (trustVerifyBtn) trustVerifyBtn.addEventListener('click', () => vscode.postMessage({ command: 'verifyTrust' }));
const trustExportBtn = document.getElementById('trustExportBtn');
if (trustExportBtn) trustExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportTrustReport' }));
const trustReportBtn = document.getElementById('trustReportBtn');
if (trustReportBtn) trustReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const trustSettingsBtn = document.getElementById('trustSettingsBtn');
if (trustSettingsBtn) trustSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const qPathInput = document.getElementById('qPathInput');
const qBrowseBtn = document.getElementById('qBrowseBtn');
const qDetectBtn = document.getElementById('qDetectBtn');
const qModeSelect = document.getElementById('qModeSelect');
const qFullTreeCheck = document.getElementById('qFullTreeCheck');
const qRunBtn = document.getElementById('qRunBtn');
if (qBrowseBtn) qBrowseBtn.addEventListener('click', () => vscode.postMessage({ command: 'browseQualityPath' }));
if (qDetectBtn) qDetectBtn.addEventListener('click', () => vscode.postMessage({ command: 'detectQualityPath' }));
if (qRunBtn) qRunBtn.addEventListener('click', () => {
  const path = qPathInput ? qPathInput.value : '';
  const mode = qModeSelect ? qModeSelect.value : 'quality';
  const fullDirectory = qFullTreeCheck ? qFullTreeCheck.checked : true;
  vscode.postMessage({ command: 'runQualityAnalysis', path, mode, fullDirectory });
});
const qAnalyzeBtn = document.getElementById('qAnalyzeBtn');
if (qAnalyzeBtn) qAnalyzeBtn.addEventListener('click', () => {
  const path = qPathInput ? qPathInput.value : '';
  const mode = qModeSelect ? qModeSelect.value : 'quality';
  const fullDirectory = qFullTreeCheck ? qFullTreeCheck.checked : true;
  vscode.postMessage({ command: 'runQualityAnalysis', path, mode, fullDirectory });
});
const qExportBtn = document.getElementById('qExportBtn');
if (qExportBtn) qExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportQualityReport' }));
const qReportBtn = document.getElementById('qReportBtn');
if (qReportBtn) qReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const qSettingsBtn = document.getElementById('qSettingsBtn');
if (qSettingsBtn) qSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const asstRunBtn = document.getElementById('asstRunBtn');
if (asstRunBtn) asstRunBtn.addEventListener('click', () => vscode.postMessage({ command: 'openFullAssessments' }));
const asstExportBtn = document.getElementById('asstExportBtn');
if (asstExportBtn) asstExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportAssessmentsReport' }));
const asstReportBtn = document.getElementById('asstReportBtn');
if (asstReportBtn) asstReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const asstSettingsBtn = document.getElementById('asstSettingsBtn');
if (asstSettingsBtn) asstSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const platRefreshBtn = document.getElementById('platRefreshBtn');
if (platRefreshBtn) platRefreshBtn.addEventListener('click', () => vscode.postMessage({ command: 'refreshPlatform' }));
const platExportBtn = document.getElementById('platExportBtn');
if (platExportBtn) platExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportPlatformReport' }));
const platDocsBtn = document.getElementById('platDocsBtn');
if (platDocsBtn) platDocsBtn.addEventListener('click', () => vscode.postMessage({ command: 'openPlatformDocs' }));
const platSettingsBtn = document.getElementById('platSettingsBtn');
if (platSettingsBtn) platSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const compRunBtn = document.getElementById('compRunBtn');
if (compRunBtn) compRunBtn.addEventListener('click', () => vscode.postMessage({ command: 'runComplianceCheck' }));
const compExportBtn = document.getElementById('compExportBtn');
if (compExportBtn) compExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportComplianceReport' }));
const compReportBtn = document.getElementById('compReportBtn');
if (compReportBtn) compReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const compSettingsBtn = document.getElementById('compSettingsBtn');
if (compSettingsBtn) compSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const anRefreshBtn = document.getElementById('anRefreshBtn');
if (anRefreshBtn) anRefreshBtn.addEventListener('click', () => vscode.postMessage({ command: 'refreshAnalytics' }));
const anExportBtn = document.getElementById('anExportBtn');
if (anExportBtn) anExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportAnalyticsReport' }));
const anReportBtn = document.getElementById('anReportBtn');
if (anReportBtn) anReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const anSettingsBtn = document.getElementById('anSettingsBtn');
if (anSettingsBtn) anSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const tmInviteBtn = document.getElementById('tmInviteBtn');
if (tmInviteBtn) tmInviteBtn.addEventListener('click', () => vscode.postMessage({ command: 'inviteTeamMember' }));
const tmExportBtn = document.getElementById('tmExportBtn');
if (tmExportBtn) tmExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportTeamReport' }));
const tmReportBtn = document.getElementById('tmReportBtn');
if (tmReportBtn) tmReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const tmSettingsBtn = document.getElementById('tmSettingsBtn');
if (tmSettingsBtn) tmSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
const tmAdminBtn = document.getElementById('tmAdminBtn');
if (tmAdminBtn) tmAdminBtn.addEventListener('click', () => vscode.postMessage({ command: 'openAdmin' }));
const scRunBtn = document.getElementById('scRunBtn');
if (scRunBtn) scRunBtn.addEventListener('click', () => { const pw = document.getElementById('scProgressWrap'); if (pw) pw.classList.add('active'); vscode.postMessage({ command: 'runScan' }); });
const scanPathInput = document.getElementById('scanPathInput');
const scanBrowseBtn = document.getElementById('scanBrowseBtn');
const scanDetectWorkspaceBtn = document.getElementById('scanDetectWorkspaceBtn');
const scanModeSelect = document.getElementById('scanModeSelect');
const scanFullTreeCheck = document.getElementById('scanFullTreeCheck');
const scanStartBtn = document.getElementById('scanStartBtn');
if (scanBrowseBtn) scanBrowseBtn.addEventListener('click', () => vscode.postMessage({ command: 'browseScanPath' }));
if (scanDetectWorkspaceBtn) scanDetectWorkspaceBtn.addEventListener('click', () => vscode.postMessage({ command: 'detectScanWorkspacePath' }));
if (scanStartBtn) scanStartBtn.addEventListener('click', () => {
  const pw = document.getElementById('scProgressWrap');
  if (pw) pw.classList.add('active');
  const path = scanPathInput ? scanPathInput.value : '';
  const mode = scanModeSelect ? scanModeSelect.value : 'full';
  const fullDirectory = scanFullTreeCheck ? scanFullTreeCheck.checked : true;
  vscode.postMessage({ command: 'scan', path, mode, fullDirectory });
});
const scExportBtn = document.getElementById('scExportBtn');
if (scExportBtn) scExportBtn.addEventListener('click', () => vscode.postMessage({ command: 'exportScanReport' }));
const scReportBtn = document.getElementById('scReportBtn');
if (scReportBtn) scReportBtn.addEventListener('click', () => { addTab('Report','reportPane'); vscode.postMessage({ command: 'openReport' }); });
const scSettingsBtn = document.getElementById('scSettingsBtn');
if (scSettingsBtn) scSettingsBtn.addEventListener('click', () => { addTab('Settings','settingsPane'); vscode.postMessage({ command: 'openSettings' }); });
function bindToggle(id, command) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const on = el.classList.toggle('on');
    vscode.postMessage({ command: command, value: on });
  });
}
bindToggle('stAutoScanToggle', 'updateAutoScan');
const stDisplaySelect = document.getElementById('stDisplaySelect');
if (stDisplaySelect) stDisplaySelect.addEventListener('change', () => { vscode.postMessage({ command: 'updateDisplayMode', value: stDisplaySelect.value }); });
bindToggle('stBrowserToggle', 'updateBrowserMode');
bindToggle('stNotifyScanToggle', 'updateNotifyScan');
bindToggle('stNotifyGateToggle', 'updateNotifyGate');
const stSaveApiBtn = document.getElementById('stSaveApiBtn');
if (stSaveApiBtn) stSaveApiBtn.addEventListener('click', () => {
  const input = document.getElementById('stApiUrl');
  vscode.postMessage({ command: 'updateApiUrl', value: input ? input.value : '' });
});
const stTestApiBtn = document.getElementById('stTestApiBtn');
if (stTestApiBtn) stTestApiBtn.addEventListener('click', () => {
  const input = document.getElementById('stApiUrl');
  const status = document.getElementById('stApiStatus');
  if (status) { status.textContent = 'Testing...'; status.style.color = 'var(--vscode-editor-foreground)'; }
  vscode.postMessage({ command: 'testApiConnection', value: input ? input.value : '' });
});
const stResetBtn = document.getElementById('stResetBtn');
if (stResetBtn) stResetBtn.addEventListener('click', () => {
  vscode.postMessage({ command: 'resetSettings' });
});
function setSettingsStatus(text, pass) {
  const b = document.getElementById('stStatusBadge');
  if (!b) return;
  b.textContent = text;
  b.className = 'db-gate-badge ' + (pass ? 'db-gate-pass' : 'db-gate-pending');
}
function updateRepoHealthPane(data) {
  const s = document.getElementById('repoHealthScore');
  const g = document.getElementById('repoHealthGate');
  const i = document.getElementById('repoHealthIssues');
  const f = document.getElementById('repoHealthFiles');
  const dot = document.getElementById('repoHealthStatusDot');
  const status = document.getElementById('repoHealthStatusText');
  const list = document.getElementById('repoHealthFindings');
  if (s) s.textContent = data.score || '--';
  if (g) g.textContent = data.gate || '--';
  if (i) i.textContent = data.issues || '0';
  if (f) f.textContent = data.files || '0';
  if (dot) dot.className = 'db-scan-dot';
  if (status) status.textContent = 'Updated';
  const crit = document.getElementById('rhCritCount');
  const high = document.getElementById('rhHighCount');
  const med = document.getElementById('rhMedCount');
  const low = document.getElementById('rhLowCount');
  if (crit) crit.textContent = data.critical || '0';
  if (high) high.textContent = data.high || '0';
  if (med) med.textContent = data.medium || '0';
  if (low) low.textContent = data.low || '0';
  const maintFill = document.getElementById('rhMaintFill');
  const maintVal = document.getElementById('rhMaintVal');
  const relFill = document.getElementById('rhRelFill');
  const relVal = document.getElementById('rhRelVal');
  const compFill = document.getElementById('rhCompFill');
  const compVal = document.getElementById('rhCompVal');
  const dupFill = document.getElementById('rhDupFill');
  const dupVal = document.getElementById('rhDupVal');
  if (maintFill) maintFill.style.width = (data.maintainability || '0') + '%';
  if (maintVal) maintVal.textContent = (data.maintainability || '--') + '%';
  if (relFill) relFill.style.width = (data.reliability || '0') + '%';
  if (relVal) relVal.textContent = (data.reliability || '--') + '%';
  if (compFill) compFill.style.width = (data.complexity || '0') + '%';
  if (compVal) compVal.textContent = (data.complexity || '--') + '%';
  if (dupFill) dupFill.style.width = (data.duplication || '0') + '%';
  if (dupVal) dupVal.textContent = (data.duplication || '--') + '%';
  const critCount = parseInt(data.critical || '0', 10) || 0;
  const highCount = parseInt(data.high || '0', 10) || 0;
  const medCount = parseInt(data.medium || '0', 10) || 0;
  const lowCount = parseInt(data.low || '0', 10) || 0;
  const ccCard = document.getElementById('rhCritCountCard'); if (ccCard) ccCard.textContent = String(critCount);
  const hcCard = document.getElementById('rhHighCountCard'); if (hcCard) hcCard.textContent = String(highCount);
  const mcCard = document.getElementById('rhMedCountCard'); if (mcCard) mcCard.textContent = String(medCount);
  const lcCard = document.getElementById('rhLowCountCard'); if (lcCard) lcCard.textContent = String(lowCount);
  const cl = document.getElementById('rhCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
  const hl = document.getElementById('rhHighLabel'); if (hl) hl.textContent = highCount + ' High';
  const ml = document.getElementById('rhMedLabel'); if (ml) ml.textContent = medCount + ' Med';
  const ll = document.getElementById('rhLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
  const is = document.getElementById('rhInfoScore'); if (is) is.textContent = data.score || data.qualityScore || '--';
  const ii = document.getElementById('rhInfoIssues'); if (ii) ii.textContent = data.issues || '--';
  const ig = document.getElementById('rhInfoGate'); if (ig) ig.textContent = data.gate || '--';
  const recList = document.getElementById('rhRecList');
  if (recList) {
    recList.textContent = '';
    if (data.recommendations && data.recommendations.length) {
      data.recommendations.forEach(r => {
        const item = document.createElement('div');
        item.className = 'rh-rec-item';
        const icon = document.createElement('span');
        icon.className = 'rh-rec-icon';
        icon.textContent = '💡';
        const text = document.createElement('span');
        text.className = 'rh-rec-text';
        text.textContent = (r && r.text) || r || '';
        item.appendChild(icon);
        item.appendChild(text);
        recList.appendChild(item);
      });
    }
  }
  if (list) {
    list.textContent = '';
    if (!data.findings || data.findings.length === 0) {
      const p = document.createElement('p');
      p.className = 'repo-health-empty';
      p.textContent = 'No findings yet. Run a scan to detect issues.';
      list.appendChild(p);
    } else {
      data.findings.slice(0, 10).forEach(f => {
        const sev = (f.severity || 'low').toLowerCase();
        const item = document.createElement('div');
        item.className = 'repo-health-item';
        const sevEl = document.createElement('span');
        sevEl.className = 'repo-health-sev ' + sev;
        const text = document.createElement('div');
        text.className = 'repo-health-text';
        const title = document.createElement('div');
        title.textContent = f.type || f.category || 'Issue';
        const file = document.createElement('div');
        file.className = 'repo-health-file';
        file.textContent = f.file || f.filePath || f.path || '-';
        text.appendChild(title);
        text.appendChild(file);
        item.appendChild(sevEl);
        item.appendChild(text);
        list.appendChild(item);
      });
    }
  }
}
function createRoadmapPhase(title, items, total, completed) {
  const doneCount = completed || 0;
  const phase = document.createElement('div');
  phase.className = 'road-phase';
  const header = document.createElement('div');
  header.className = 'road-phase-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'road-phase-title';
  titleEl.textContent = title;
  const meta = document.createElement('span');
  meta.className = 'road-phase-meta';
  meta.textContent = doneCount + ' / ' + total + ' tasks';
  header.appendChild(titleEl);
  header.appendChild(meta);
  const bar = document.createElement('div');
  bar.className = 'road-phase-bar';
  const fill = document.createElement('div');
  fill.className = 'road-phase-fill';
  fill.style.width = (total > 0 ? Math.round((doneCount / total) * 100) : 0) + '%';
  bar.appendChild(fill);
  const itemsEl = document.createElement('div');
  itemsEl.className = 'road-phase-items';
  items.forEach(f => {
    const sev = (f.severity || 'low').toLowerCase();
    const item = document.createElement('div');
    item.className = 'road-phase-item';
    const sevEl = document.createElement('div');
    sevEl.className = 'road-item-sev ' + sev;
    const text = document.createElement('div');
    text.className = 'road-item-text';
    text.textContent = f.title || f.type || 'Finding';
    const status = document.createElement('div');
    status.className = 'road-item-status';
    status.textContent = 'Open';
    item.appendChild(sevEl);
    item.appendChild(text);
    item.appendChild(status);
    itemsEl.appendChild(item);
  });
  phase.appendChild(header);
  phase.appendChild(bar);
  phase.appendChild(itemsEl);
  return phase;
}
function renderRoadmapPhases(findings) {
  const container = document.getElementById('roadPhases');
  if (!container) return;
  container.textContent = '';
  if (!findings || findings.length === 0) {
    const p = document.createElement('p');
    p.className = 'repo-health-empty';
    p.textContent = 'No findings yet. Run a scan to build the roadmap.';
    container.appendChild(p);
    return;
  }
  const critical = findings.filter(f => (f.severity || '').toLowerCase() === 'critical');
  const high = findings.filter(f => (f.severity || '').toLowerCase() === 'high');
  const medium = findings.filter(f => (f.severity || '').toLowerCase() === 'medium');
  const low = findings.filter(f => (f.severity || '').toLowerCase() === 'low');
  container.appendChild(createRoadmapPhase('Phase 1: Triage & Assessment', critical.concat(high).slice(0, 8), critical.length + high.length, 0));
  container.appendChild(createRoadmapPhase('Phase 2: Short-Term Fixes', medium.slice(0, 5), medium.length, 0));
  container.appendChild(createRoadmapPhase('Phase 3: Long-Term Architecture', low.slice(0, 5), low.length, 0));
}
function focusRoadmapPhase(index) {
  const container = document.getElementById('roadPhases');
  if (!container) return;
  const phases = container.querySelectorAll('.road-phase');
  const phase = phases[index];
  if (!phase) return;
  phase.scrollIntoView({ behavior: 'smooth', block: 'start' });
  phases.forEach(p => p.style.outline = '');
  phase.style.outline = '2px solid var(--vscode-focusBorder)';
  setTimeout(() => { phase.style.outline = ''; }, 1500);
}
function exportRoadmapJson() {
  const open = document.getElementById('roadInfoOpen');
  const risk = document.getElementById('roadInfoRisk');
  const target = document.getElementById('roadInfoTarget');
  const phases = document.querySelectorAll('#roadPhases .road-phase');
  const data = {
    open: open ? open.textContent : '--',
    risk: risk ? risk.textContent : '--',
    target: target ? target.textContent : '--',
    phases: Array.from(phases).map(p => ({
      title: p.querySelector('.road-phase-title') ? p.querySelector('.road-phase-title').textContent : '',
      meta: p.querySelector('.road-phase-meta') ? p.querySelector('.road-phase-meta').textContent : '',
      items: Array.from(p.querySelectorAll('.road-phase-item')).map(i => ({
        severity: (i.querySelector('.road-item-sev') ? i.querySelector('.road-item-sev').className : '').replace('road-item-sev ', ''),
        text: i.querySelector('.road-item-text') ? i.querySelector('.road-item-text').textContent : '',
        status: i.querySelector('.road-item-status') ? i.querySelector('.road-item-status').textContent : ''
      }))
    }))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'simplebeacon-roadmap.json';
  a.click();
  URL.revokeObjectURL(url);
}
function renderSecurityThreats(findings) {
  const list = document.getElementById('secThreatsList');
  if (!list) return;
  list.textContent = '';
  if (!findings || findings.length === 0) return;
  findings.slice(0, 15).forEach(f => {
    const sev = (f.severity || 'low').toLowerCase();
    const item = document.createElement('div');
    item.className = 'sec-threat-item';
    const sevEl = document.createElement('div');
    sevEl.className = 'sec-threat-sev ' + sev;
    const text = document.createElement('div');
    text.className = 'sec-threat-text';
    text.textContent = f.title || f.type || 'Finding';
    const file = document.createElement('div');
    file.className = 'sec-threat-file';
    file.textContent = f.file || f.filePath || f.path || '-';
    item.appendChild(sevEl);
    item.appendChild(text);
    item.appendChild(file);
    list.appendChild(item);
  });
}
function renderComplianceRules(rules) {
  const container = document.getElementById('compRequirements');
  if (!container) return;
  container.textContent = '';
  const title = document.createElement('div');
  title.className = 'comp-req-title';
  title.textContent = 'Compliance Requirements';
  container.appendChild(title);
  if (!rules || rules.length === 0) {
    const item = document.createElement('div');
    item.className = 'comp-req-item';
    const sev = document.createElement('div');
    sev.className = 'comp-req-sev critical';
    const text = document.createElement('span');
    text.className = 'comp-req-text';
    text.textContent = 'No compliance data available';
    const status = document.createElement('span');
    status.className = 'comp-req-status';
    status.textContent = 'Pending';
    item.appendChild(sev);
    item.appendChild(text);
    item.appendChild(status);
    container.appendChild(item);
    return;
  }
  rules.forEach(r => {
    const sev = (r.severity || 'low').toLowerCase();
    const status = r.pass ? 'Pass' : 'Fail';
    const item = document.createElement('div');
    item.className = 'comp-req-item';
    const sevEl = document.createElement('div');
    sevEl.className = 'comp-req-sev ' + sev;
    const text = document.createElement('span');
    text.className = 'comp-req-text';
    text.textContent = r.text || r.id || 'Rule';
    const statusEl = document.createElement('span');
    statusEl.className = 'comp-req-status';
    statusEl.textContent = status;
    item.appendChild(sevEl);
    item.appendChild(text);
    item.appendChild(statusEl);
    container.appendChild(item);
  });
}
function createTeamMemberItem(m) {
  const avatar = (m.name || 'U').charAt(0).toUpperCase();
  const item = document.createElement('div');
  item.className = 'tm-member-item';
  const av = document.createElement('div');
  av.className = 'tm-member-avatar';
  av.textContent = avatar;
  const info = document.createElement('div');
  info.className = 'tm-member-info';
  const name = document.createElement('div');
  name.className = 'tm-member-name';
  name.textContent = m.name || 'Member';
  const role = document.createElement('div');
  role.className = 'tm-member-role';
  role.textContent = m.role || 'Member';
  info.appendChild(name);
  info.appendChild(role);
  const status = document.createElement('span');
  status.className = 'tm-member-status';
  status.textContent = m.status || 'Active';
  item.appendChild(av);
  item.appendChild(info);
  item.appendChild(status);
  return item;
}
function renderTeamMembers(members) {
  const list = document.getElementById('tmMembersList');
  if (!list) return;
  list.textContent = '';
  const title = document.createElement('div');
  title.className = 'tm-members-title';
  title.textContent = 'Team Members';
  list.appendChild(title);
  if (!members || members.length === 0) {
    const empty = createTeamMemberItem({ name: '-', role: 'Invite team members', status: '--' });
    list.appendChild(empty);
    return;
  }
  members.forEach(m => list.appendChild(createTeamMemberItem(m)));
}
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.command) return;
  // This handler is for the VS Code: webview API. Browser preview uses the parent-message handler above.
  if (window.__SB_BROWSER_MODE__) { return; }
  if (msg.command === 'updateAllPanes') {
    const panes = msg.panes || {};
    const keyToCmd = {
      dashboard: 'updateDashboard',
      analyze: 'updateAnalyzePane',
      report: 'updateReportPane',
      certificate: 'updateCertificatePane',
      roadmap: 'updateRoadmapPane',
      aiContext: 'updateAiContextPane',
      upload: 'updateUploadPane',
      audit: 'updateAuditPane',
      security: 'updateSecurityPane',
      trust: 'updateTrustPane',
      quality: 'updateQualityPane',
      assessments: 'updateAssessmentsPane',
      platform: 'updatePlatformPane',
      profile: 'updateProfilePane',
      compliance: 'updateCompliancePane',
      repoHealth: 'updateRepoHealthPane',
      team: 'updateTeamPane',
      scan: 'updateScanPane',
      analytics: 'updateAnalyticsPane',
      settings: 'updateSettingsPane',
      codemap: 'updateCodeMapPane'
    };
    window.__SB_BATCH_DISPATCH__ = true;
    try {
      Object.keys(panes).forEach(function(key) {
        const cmd = keyToCmd[key];
        const data = panes[key];
        if (!cmd || !data) return;
        window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ command: cmd }, data) }));
      });
    } finally {
      window.__SB_BATCH_DISPATCH__ = false;
    }
    return;
  }
  if (!window.__SB_BATCH_DISPATCH__ && window.__SB_DEBUG__ && !/^update(?:AllPanes|Dashboard|Analyze|Report|Certificate|Roadmap|AiContext|Upload|Audit|Security|Trust|Quality|Assessments|Platform|Profile|Compliance|RepoHealth|Team|Scan|Analytics|Settings)Pane$/.test(String(msg.command || ''))) {
    console.debug('[SB vscode handler] command:', msg.command);
  }
  if (msg.command === 'showDashboardPane') addTab('Dashboard','dashboardPane');
  if (msg.command === 'showAnalyzePane') {
    addTab('Analyze','analyzePane');
    setTimeout(() => {
      const pathInput = document.getElementById('analyzePathInput');
      if (pathInput && !pathInput.value) { vscode.postMessage({ command: 'detectWorkspacePath' }); }
    }, 100);
  }
  if (msg.command === 'showReportPane') addTab('Report','reportPane');
  if (msg.command === 'showCertificatePane') addTab('Certificate','certificatePane');
  if (msg.command === 'showCodeMapPane') {
    addTab('Code Map','codeMapPane');
    // Request code map data from extension as a fallback in case updateCodeMapPane was not received
    try { vscode.postMessage({ command: 'getCodeMapData' }); } catch (e) {}
  }
  if (msg.command === 'showRoadmapPane') addTab('Roadmap','roadmapPane');
  if (msg.command === 'showAiContextPane') addTab('AI Context','aiContextPane');
  if (msg.command === 'showUploadPane') addTab('Upload','uploadPane');
  if (msg.command === 'showAuditPane') addTab('Audit','auditPane');
  if (msg.command === 'showSecurityPane') addTab('Security','securityPane');
  if (msg.command === 'showTrustPane') addTab('Trust','trustPane');
  if (msg.command === 'showQualityPane') {
    addTab('Quality','qualityPane');
    setTimeout(() => {
      const pathInput = document.getElementById('qPathInput');
      if (pathInput && !pathInput.value) { vscode.postMessage({ command: 'detectQualityPath' }); }
    }, 100);
  }
  if (msg.command === 'showAssessmentsPane') addTab('Assessments','assessmentsPane');
  if (msg.command === 'showPlatformPane') addTab('Platform','platformPane');
  if (msg.command === 'showProfilePane') addTab('Profile','profilePane');
  if (msg.command === 'showCompliancePane') addTab('Compliance','compliancePane');
  if (msg.command === 'showRepoHealthPane') addTab('Repo Health','repoHealthPane');
  if (msg.command === 'showAnalyticsPane') addTab('Analytics','analyticsPane');
  if (msg.command === 'showTeamPane') addTab('Team','teamPane');
  if (msg.command === 'showScanPane') {
    addTab('Scan','scanPane');
    setTimeout(() => {
      const pathInput = document.getElementById('scanPathInput');
      if (pathInput && !pathInput.value) { vscode.postMessage({ command: 'detectScanWorkspacePath' }); }
    }, 100);
  }
  if (msg.command === 'updateScanPane') {
    const badge = document.getElementById('scStatusBadge');
    const statusText = document.getElementById('scStatusText');
    const statusDot = document.getElementById('scStatusDot');
    const statusMeta = document.getElementById('scStatusMeta');
    const progressWrap = document.getElementById('scProgressWrap');
    const progressFill = document.getElementById('scProgressFill');
    const progressPct = document.getElementById('scProgressPct');
    const progressLabel = document.getElementById('scProgressLabel');
    const resultsWrap = document.getElementById('scResultsWrap');
    const summary = document.getElementById('scSummary');
    const status = msg.status || 'Idle';
    const scanning = !!msg.scanning;
    const hasResults = !!msg.hasResults;
    const progress = parseInt(msg.progress, 10) || 0;
    if (badge) {
      badge.textContent = status.toUpperCase();
      badge.className = 'db-gate-badge ' + (status === 'Complete' || status === 'Pass' ? 'db-gate-pass' : status === 'Fail' ? 'db-gate-fail' : 'db-gate-pending');
    }
    if (statusText) statusText.textContent = scanning ? 'Scanning...' : status;
    if (statusDot) statusDot.className = 'sc-status-dot ' + (scanning ? 'running' : status === 'Complete' ? 'complete' : status === 'Fail' ? 'error' : '');
    if (statusMeta) statusMeta.textContent = scanning ? (progress + '%') : (status === 'Complete' ? 'Scan complete' : 'No active scan');
    if (progressWrap) progressWrap.className = 'sc-progress' + (scanning || (progress > 0 && progress < 100) ? ' active' : '');
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressPct) progressPct.textContent = progress + '%';
    if (progressLabel) progressLabel.textContent = scanning ? 'Scanning...' : 'Scan progress';
    const totalEl = document.getElementById('scTotal');
    const issuesEl = document.getElementById('scIssues');
    const fixedEl = document.getElementById('scFixed');
    const scoreEl = document.getElementById('scScore');
    if (totalEl) totalEl.textContent = msg.total || '--';
    if (issuesEl) issuesEl.textContent = msg.issues || '--';
    if (fixedEl) fixedEl.textContent = msg.fixed || '--';
    if (scoreEl) scoreEl.textContent = msg.score || msg.qualityScore || '--';
    const critEl = document.getElementById('scCritCount');
    const highEl = document.getElementById('scHighCount');
    const medEl = document.getElementById('scMedCount');
    const lowEl = document.getElementById('scLowCount');
    if (critEl) critEl.textContent = msg.critical || '0';
    if (highEl) highEl.textContent = msg.high || '0';
    if (medEl) medEl.textContent = msg.medium || '0';
    if (lowEl) lowEl.textContent = msg.low || '0';
    const resultsList = document.getElementById('scResultsList');
    if (resultsList && msg.results && Array.isArray(msg.results)) {
      resultsList.textContent = '';
      if (msg.results.length === 0) {
        const empty = document.createElement('div'); empty.className = 'sc-result-item';
        const t1 = document.createElement('span'); t1.className = 'sc-result-type'; t1.textContent = '--';
        const t2 = document.createElement('span'); t2.className = 'sc-result-text'; t2.textContent = 'No scan results yet';
        const t3 = document.createElement('span'); t3.className = 'sc-result-badge pending'; t3.textContent = 'Pending';
        const t4 = document.createElement('span'); t4.className = 'sc-result-file'; t4.textContent = '--';
        empty.append(t1, t2, t3, t4); resultsList.appendChild(empty);
      } else {
        msg.results.forEach((r) => {
          const item = document.createElement('div'); item.className = 'sc-result-item'; item.style.cursor = 'pointer';
          const sev = (r.severity || 'low').toLowerCase();
          const t1 = document.createElement('span'); t1.className = 'sc-result-type'; t1.textContent = r.type || 'Finding';
          const t2 = document.createElement('span'); t2.className = 'sc-result-text'; t2.textContent = r.text || r.message || 'Finding';
          const t3 = document.createElement('span'); t3.className = 'sc-result-badge ' + sev; t3.textContent = r.severity || 'Low';
          const t4 = document.createElement('span'); t4.className = 'sc-result-file'; t4.textContent = (r.file || 'unknown') + (r.line != null ? ':' + r.line : '');
          item.append(t1, t2, t3, t4);
          item.addEventListener('click', () => {
            if (window.vscode) window.vscode.postMessage({ command: 'openFileAtLine', file: r.file, line: r.line != null ? r.line : 1 });
          });
          resultsList.appendChild(item);
        });
      }
    }
    if (resultsWrap) resultsWrap.className = 'sc-results' + (hasResults ? ' active' : '');
    const historyList = document.getElementById('scHistoryList');
    if (historyList && msg.history && Array.isArray(msg.history)) {
      historyList.textContent = '';
      if (msg.history.length === 0) {
        const empty = document.createElement('div'); empty.className = 'sc-history-item';
        const i1 = document.createElement('span'); i1.className = 'sc-history-icon'; i1.textContent = '\u{1F50D}';
        const i2 = document.createElement('span'); i2.className = 'sc-history-text'; i2.textContent = 'No scan history available';
        const i3 = document.createElement('span'); i3.className = 'sc-history-time'; i3.textContent = '--';
        const i4 = document.createElement('span'); i4.className = 'sc-history-score'; i4.textContent = '--';
        empty.append(i1, i2, i3, i4); historyList.appendChild(empty);
      } else {
        msg.history.forEach((h) => {
          const item = document.createElement('div'); item.className = 'sc-history-item';
          const i1 = document.createElement('span'); i1.className = 'sc-history-icon'; i1.textContent = '\u{1F50D}';
          const i2 = document.createElement('span'); i2.className = 'sc-history-text'; i2.textContent = h.text || 'Scan';
          const i3 = document.createElement('span'); i3.className = 'sc-history-time'; i3.textContent = h.time || '--';
          const i4 = document.createElement('span'); i4.className = 'sc-history-score'; i4.textContent = h.score || '--';
          item.append(i1, i2, i3, i4); historyList.appendChild(item);
        });
      }
    }
    if (summary) summary.style.display = hasResults ? 'none' : 'block';
  }
  if (msg.command === 'updateAnalyzePane') {
    const results = document.getElementById('analyzeResults');
    const progressWrap = document.getElementById('analyzeProgressWrap');
    const runBtn = document.getElementById('analyzeRunBtn');
    if (runBtn && runBtn.dataset.intervalId) {
      clearInterval(Number(runBtn.dataset.intervalId));
      delete runBtn.dataset.intervalId;
    }
    if (progressWrap) progressWrap.style.display = 'none';
    if (results) results.style.display = 'block';
    const scoreEl = document.getElementById('analyzeMetricScore');
    const gateEl = document.getElementById('analyzeMetricGate');
    const issuesEl = document.getElementById('analyzeMetricIssues');
    const filesEl = document.getElementById('analyzeMetricFiles');
    if (scoreEl) scoreEl.textContent = msg.score || '--';
    if (gateEl) gateEl.textContent = msg.gate || '--';
    if (issuesEl) issuesEl.textContent = msg.issues || '0';
    if (filesEl) filesEl.textContent = msg.files || '0';
    updateAnalyzeSeverityBar(msg.severity || {});
    const findingsList = document.getElementById('analyzeFindingsList');
    if (findingsList) {
      findingsList.textContent = '';
      if (!msg.findings || !Array.isArray(msg.findings) || msg.findings.length === 0) {
        const wrap = document.createElement('div'); wrap.className = 'db-empty';
        const icon = document.createElement('div'); icon.className = 'db-empty-icon'; icon.textContent = '\u{1F50D}';
        const txt = document.createElement('div'); txt.textContent = 'No findings match the current filters.';
        wrap.append(icon, txt); findingsList.appendChild(wrap);
      } else {
        msg.findings.forEach((f) => {
          const item = document.createElement('div'); item.className = 'db-finding-item';
          const sev = (f.severity || 'low').toLowerCase();
          const sevSpan = document.createElement('span'); sevSpan.className = 'db-finding-severity ' + sev;
          const body = document.createElement('div'); body.className = 'db-finding-body';
          const title = document.createElement('div'); title.className = 'db-finding-title'; title.textContent = f.type || 'Finding';
          const desc = document.createElement('div'); desc.className = 'db-finding-desc'; desc.textContent = f.text || f.message || 'Finding';
          const fileDiv = document.createElement('div'); fileDiv.className = 'db-finding-file'; fileDiv.textContent = f.file || 'unknown';
          body.append(title, desc, fileDiv); item.append(sevSpan, body); findingsList.appendChild(item);
        });
      }
    }
  }
  if (msg.command === 'updateProfilePane') {
    const name = document.getElementById('profileName');
    const email = document.getElementById('profileEmail');
    const role = document.getElementById('profileRole');
    const org = document.getElementById('profileOrg');
    if (name) name.value = msg.name || '';
    if (email) email.value = msg.email || '';
    if (role) role.value = msg.role || '';
    if (org) org.value = msg.org || '';
    const scans = document.getElementById('profileScans');
    const reports = document.getElementById('profileReports');
    const issues = document.getElementById('profileIssues');
    const avgScore = document.getElementById('profileAvgScore');
    if (scans) scans.textContent = msg.scans || '--';
    if (reports) reports.textContent = msg.reports || '--';
    if (issues) issues.textContent = msg.issues || '--';
    if (avgScore) avgScore.textContent = msg.avgScore || '--';
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('profCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('profHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('profMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('profLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('profCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('profHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('profMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('profLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('profInfoScore'); if (is) is.textContent = msg.qualityScore || '--';
    const ii = document.getElementById('profInfoIssues'); if (ii) ii.textContent = msg.issues || '--';
    const ig = document.getElementById('profInfoGate'); if (ig) ig.textContent = msg.gate || '--';
    const autoScanToggle = document.getElementById('profileAutoScanToggle');
    const notifyToggle = document.getElementById('profileNotifyToggle');
    const darkToggle = document.getElementById('profileDarkToggle');
    if (autoScanToggle) { if (msg.autoScan) autoScanToggle.classList.add('on'); else autoScanToggle.classList.remove('on'); }
    if (notifyToggle) { if (msg.notifications) notifyToggle.classList.add('on'); else notifyToggle.classList.remove('on'); }
    if (darkToggle) { if (msg.darkMode) darkToggle.classList.add('on'); else darkToggle.classList.remove('on'); }
    const activityList = document.getElementById('profileActivityList');
    if (activityList && msg.activity && Array.isArray(msg.activity)) {
      activityList.textContent = '';
      msg.activity.forEach(a => {
        const item = document.createElement('div');
        item.className = 'profile-activity-item';
        const icon = document.createElement('span');
        icon.className = 'profile-activity-icon';
        icon.textContent = a.icon || '🔍';
        const text = document.createElement('span');
        text.className = 'profile-activity-text';
        text.textContent = a.text || '';
        const time = document.createElement('span');
        time.className = 'profile-activity-time';
        time.textContent = a.time || '--';
        item.appendChild(icon);
        item.appendChild(text);
        item.appendChild(time);
        activityList.appendChild(item);
      });
    }
  }
  if (msg.command === 'showSettingsPane') addTab('Settings','settingsPane');
  if (msg.command === 'updateDashboard') {
    const s = document.getElementById('statScore');
    const g = document.getElementById('statGate');
    const i = document.getElementById('statIssues');
    const f = document.getElementById('statFiles');
    const b = document.getElementById('dashGateBadge');
    const dot = document.getElementById('dashScanDot');
    const status = document.getElementById('dashScanStatus');
    const tScore = document.getElementById('trendScore');
    const tGate = document.getElementById('trendGate');
    const tIssues = document.getElementById('trendIssues');
    const tFiles = document.getElementById('trendFiles');
    if (s) s.textContent = msg.score || '--';
    if (g) g.textContent = msg.gate || '--';
    if (i) i.textContent = msg.issues || '0';
    if (f) f.textContent = msg.files || '0';
    if (b) {
      b.textContent = (msg.gate || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.gate === 'Pass' || msg.gate === 'pass') ? 'db-gate-pass' : (msg.gate === 'Fail' || msg.gate === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    if (dot) { dot.className = 'db-scan-dot complete'; }
    if (status) { status.textContent = 'Scan complete'; }
    if (tScore) { tScore.textContent = msg.score ? 'Score updated' : 'No data'; }
    if (tGate) { tGate.textContent = msg.gate ? 'Gate: ' + msg.gate : 'Run a scan'; }
    if (tIssues) { tIssues.textContent = msg.issues ? msg.issues + ' issues found' : 'Waiting...'; }
    if (tFiles) { tFiles.textContent = msg.files ? msg.files + ' files indexed' : 'Indexed'; }
    if (msg.severity) {
      updateSeverityBar(msg.severity);
    }
    if (msg.findings) renderFindings(msg.findings);
    updateRepoHealthPane(msg);
  }
  if (msg.command === 'updateAnalyzePane') {
    const results = document.getElementById('analyzeResults');
    if (results) results.style.display = 'block';
    const s = document.getElementById('analyzeMetricScore');
    const g = document.getElementById('analyzeMetricGate');
    const i = document.getElementById('analyzeMetricIssues');
    const f = document.getElementById('analyzeMetricFiles');
    const gateText = typeof msg.gate === 'object' && msg.gate !== null ? (msg.gate.pass ? 'PASS' : 'FAIL') : (msg.gate || 'PENDING');
    if (s) s.textContent = msg.score || '--';
    if (g) g.textContent = gateText;
    if (i) i.textContent = msg.issues || '0';
    if (f) f.textContent = msg.files || '0';
    if (msg.severity) updateAnalyzeSeverityBar(msg.severity);
    if (msg.findings) renderAnalyzeFindings(msg.findings);
    const wrap = document.getElementById('analyzeProgressWrap');
    const fill = document.getElementById('analyzeProgressFill');
    const pct = document.getElementById('analyzeProgressPct');
    const runBtn = document.getElementById('analyzeRunBtn');
    if (runBtn && runBtn.dataset.intervalId) { clearInterval(Number(runBtn.dataset.intervalId)); delete runBtn.dataset.intervalId; }
    if (wrap) wrap.style.display = 'none';
    if (fill) fill.style.width = '0%';
    if (pct) pct.textContent = '0%';
  }
  if (msg.command === 'updateReportPane') {
    const s = document.getElementById('reportScore');
    const g = document.getElementById('reportGate');
    const i = document.getElementById('reportIssues');
    const f = document.getElementById('reportFiles');
    const b = document.getElementById('reportGateBadge');
    if (s) s.textContent = msg.score || '--';
    if (g) g.textContent = msg.gate || '--';
    if (i) i.textContent = msg.issues || '0';
    if (f) f.textContent = msg.files || '0';
    if (b) {
      b.textContent = (msg.gate || 'Pending').toUpperCase();
      b.className = 'analyze-build-badge ' + ((msg.gate === 'Pass' || msg.gate === 'pass') ? 'db-gate-pass' : (msg.gate === 'Fail' || msg.gate === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('reportCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('reportHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('reportMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('reportLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('reportCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('reportHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('reportMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('reportLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const rf = document.getElementById('reportRepoFiles'); if (rf) rf.textContent = msg.files || '--';
    const gc = document.getElementById('reportGateChecked'); if (gc) gc.textContent = msg.gate || '--';
    const ls = document.getElementById('reportLastScan'); if (ls) ls.textContent = msg.lastAnalysis || new Date().toLocaleString();
    if (msg.severity) updateReportSeverityBar(msg.severity);
    if (msg.findings) {
      renderReportFindings(msg.findings);
      renderReportCategories(msg.findings);
    }
    if (msg.filesList !== undefined) renderReportFiles(msg.filesList);
    updateReportTimestamp();
  }
  if (msg.command === 'updateCertificatePane') {
    const s = document.getElementById('certScore');
    const m = document.getElementById('certModules');
    const d = document.getElementById('certDate');
    const e = document.getElementById('certExpiry');
    const b = document.getElementById('certStatusBadge');
    if (s) s.textContent = msg.score || '--';
    if (m) m.textContent = msg.modules || '--';
    if (d) d.textContent = msg.date || '--';
    if (e) e.textContent = msg.expiry || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Pass' || msg.status === 'pass') ? 'db-gate-pass' : (msg.status === 'Fail' || msg.status === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('certCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('certHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('certMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('certLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('certCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('certHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('certMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('certLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const rf = document.getElementById('certRepoFiles'); if (rf) rf.textContent = msg.modules || '--';
    const gc = document.getElementById('certGateChecked'); if (gc) gc.textContent = msg.gate || '--';
    const ls = document.getElementById('certLastScan'); if (ls) ls.textContent = msg.date || new Date().toLocaleString();
    if (msg.requirements && Array.isArray(msg.requirements)) {
      const list = document.getElementById('certReqList');
      if (list) {
        list.textContent = '';
        msg.requirements.forEach(req => {
          const status = req.status || 'Pending';
          const icon = status === 'Pass' || status === 'pass' ? '✓' : status === 'Fail' || status === 'fail' ? '✗' : '…';
          const cls = status === 'Pass' || status === 'pass' ? 'pass' : status === 'Fail' || status === 'fail' ? 'fail' : 'pending';
          const item = document.createElement('div');
          item.className = 'cert-req-item';
          const check = document.createElement('div');
          check.className = 'cert-req-check ' + cls;
          check.textContent = icon;
          const text = document.createElement('div');
          text.className = 'cert-req-text';
          text.textContent = req.text || '';
          const statusEl = document.createElement('div');
          statusEl.className = 'cert-req-status';
          statusEl.textContent = status;
          item.appendChild(check);
          item.appendChild(text);
          item.appendChild(statusEl);
          list.appendChild(item);
        });
      }
    }
    if (msg.previewText) {
      const preview = document.querySelector('.cert-preview-text');
      if (preview) preview.textContent = msg.previewText;
    }
  }
  if (msg.command === 'updateCodeMapPane') {
    console.debug('[SB CodeMap] updateCodeMapPane received, files:', msg.files, 'status:', msg.status, 'graph nodes:', msg.graph?.nodes?.length);
    const f = document.getElementById('mapFiles');
    const l = document.getElementById('mapLanguages');
    const m = document.getElementById('mapModules');
    const d = document.getElementById('mapDeps');
    const b = document.getElementById('mapStatusBadge');
    if (f) f.textContent = msg.files || '--';
    if (l) l.textContent = msg.languages || '--';
    if (m) m.textContent = msg.modules || '--';
    if (d) d.textContent = String(msg.graph?.edges?.length || 0);
    if (b) {
      const status = msg.status || 'Not Generated';
      const state = (status === 'Generated' || status === 'generated') ? 'generated' : (status === 'Fail' || status === 'fail') ? 'fail' : 'pending';
      b.textContent = status.toUpperCase();
      b.className = 'map-status-badge ' + state;
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('mapCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('mapHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('mapMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('mapLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('mapCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('mapHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('mapMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('mapLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const rf = document.getElementById('mapRepoFiles'); if (rf) rf.textContent = msg.repoFiles || msg.files || '--';
    const tl = document.getElementById('mapTotalLines'); if (tl) tl.textContent = msg.totalLines || '--';
    const ls = document.getElementById('mapLastScan'); if (ls) ls.textContent = msg.lastScan || new Date().toLocaleString();
    const treeList = document.getElementById('mapTreeList');
    if (treeList && msg.tree && Array.isArray(msg.tree)) {
      function renderTree(nodes, level) {
        const wrapper = document.createElement('div');
        nodes.forEach(node => {
          const icon = node.type === 'dir' ? '📁' : '📄';
          const meta = node.type === 'dir' ? 'Folder' : (node.ext || 'File');
          const lines = node.lines ? node.lines + ' lines' : '';
          const size = node.size ? (node.size > 1024 ? Math.round(node.size/1024) + ' KB' : node.size + ' B') : '';
          const info = [meta, lines, size].filter(Boolean).join(' · ');
          const cls = 'map-tree-node' + (level > 0 ? ' level-' + (level + 1) : '');
          const item = document.createElement('div');
          item.className = cls;
          const iconEl = document.createElement('span');
          iconEl.className = 'map-tree-icon';
          iconEl.textContent = icon;
          const label = document.createElement('span');
          label.className = 'map-tree-label';
          label.textContent = node.name || '';
          const metaEl = document.createElement('span');
          metaEl.className = 'map-tree-meta';
          metaEl.textContent = info;
          item.appendChild(iconEl);
          item.appendChild(label);
          item.appendChild(metaEl);
          wrapper.appendChild(item);
          if (node.children && node.children.length) wrapper.appendChild(renderTree(node.children, level + 1));
        });
        return wrapper;
      }
      treeList.textContent = '';
      treeList.appendChild(renderTree(msg.tree, 0));
    }
    /* Render dependency analysis */
    const analysisWrap = document.getElementById('mapAnalysisWrap');
    if (analysisWrap) {
      const cycles = msg.cycles || [];
      const entryPoints = msg.entryPoints || [];
      const leafModules = msg.leafModules || [];
      const mostConnected = msg.mostConnected || [];
      const cc = document.getElementById('mapCyclesCount'); if (cc) cc.textContent = String(cycles.length);
      const cl = document.getElementById('mapCyclesList'); if (cl) cl.textContent = cycles.length > 0 ? cycles.slice(0, 3).map(c => c.join(' → ')).join('; ') : 'No cycles detected';
      const ec = document.getElementById('mapEntryCount'); if (ec) ec.textContent = String(entryPoints.length);
      const el = document.getElementById('mapEntryList'); if (el) el.textContent = entryPoints.slice(0, 5).join(', ') || 'None';
      const lc2 = document.getElementById('mapLeafCount'); if (lc2) lc2.textContent = String(leafModules.length);
      const ll2 = document.getElementById('mapLeafList'); if (ll2) ll2.textContent = leafModules.slice(0, 5).join(', ') || 'None';
      const mcc = document.getElementById('mapConnectedCount'); if (mcc) mcc.textContent = String(mostConnected.length);
      const mcl = document.getElementById('mapConnectedList'); if (mcl) mcl.textContent = mostConnected.slice(0, 3).map(c => c.name + ' (' + c.count + ')').join(', ') || 'None';
    }
    /* Render languages bar chart */
    const langGrid = document.getElementById('mapLanguagesGrid');
    const langCount = document.getElementById('mapLangCount');
    if (langGrid && msg.list && Array.isArray(msg.list)) {
      const counts = {};
      msg.list.forEach(f => { const ext = f.ext || 'Other'; counts[ext] = (counts[ext] || 0) + 1; });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (entries.length > 0) {
        const max = Math.max(...entries.map(e => e[1]));
        langGrid.textContent = '';
        if (langCount) langCount.textContent = String(entries.length);
        const colors = ['var(--wd-lang-1,#89d185)','var(--wd-lang-2,#38bdf8)','var(--wd-lang-3,#a78bfa)','var(--wd-lang-4,#f48771)','var(--wd-lang-5,#d7a24c)','var(--wd-lang-6,#007acc)','var(--wd-lang-7,#ec4899)','var(--wd-lang-8,#10b981)'];
        entries.forEach(([ext, count], idx) => {
          const row = document.createElement('div');
          row.className = 'map-lang-row';
          const name = document.createElement('span');
          name.className = 'map-lang-name';
          name.textContent = ext;
          const barWrap = document.createElement('div');
          barWrap.className = 'map-lang-bar';
          const bar = document.createElement('div');
          bar.className = 'map-lang-fill';
          bar.style.width = Math.round((count / max) * 100) + '%';
          bar.style.background = colors[idx % colors.length];
          barWrap.appendChild(bar);
          const cnt = document.createElement('span');
          cnt.className = 'map-lang-count';
          cnt.textContent = String(count);
          row.appendChild(name);
          row.appendChild(barWrap);
          row.appendChild(cnt);
          langGrid.appendChild(row);
        });
      }
    }
    const graphCanvas = document.getElementById('codeMapGraphCanvas');
    const graphFrame = graphCanvas ? graphCanvas.closest('.map-graph-frame') : null;
    const graphEmpty = document.getElementById('codeMapGraphEmpty');
    const graphControls = document.getElementById('graphControls');
    const graphLegend = document.getElementById('graphLegendOverlay');
    const iframe = document.getElementById('codeMapIframe');
    // Prefer inline canvas graph when graph data is present; fall back to iframe for codemap.html parity
    if (graphCanvas && msg.graph && msg.graph.nodes && msg.graph.nodes.length > 0) {
      if (iframe) iframe.style.display = 'none';
      if (graphCanvas) graphCanvas.style.display = 'block';
      if (graphControls) graphControls.style.display = '';
      if (graphLegend) graphLegend.style.display = '';
      if (graphFrame) graphFrame.classList.add('has-graph');
      if (graphEmpty) graphEmpty.style.display = 'none';
      if (graphCanvas && graphCanvas._graphCleanup) { graphCanvas._graphCleanup(); }
      const ctrl = renderCodeMapGraph(graphCanvas, msg.graph);
      const countEl = document.getElementById('graphNodeCount');
      if (countEl && msg.graph.nodes) countEl.textContent = msg.graph.nodes.length + ' nodes';
      const resetBtn = document.getElementById('graphResetBtn');
      if (resetBtn) resetBtn.onclick = () => ctrl && ctrl.resetView && ctrl.resetView();
      const zoomInBtn = document.getElementById('graphZoomInBtn');
      if (zoomInBtn) zoomInBtn.onclick = () => ctrl && ctrl.zoomIn && ctrl.zoomIn();
      const zoomOutBtn = document.getElementById('graphZoomOutBtn');
      if (zoomOutBtn) zoomOutBtn.onclick = () => ctrl && ctrl.zoomOut && ctrl.zoomOut();
      const pauseBtn = document.getElementById('graphPauseBtn');
      if (pauseBtn) {
        pauseBtn.onclick = () => {
          if (!ctrl) return;
          ctrl.togglePause && ctrl.togglePause();
          pauseBtn.textContent = ctrl.isPaused() ? '▶' : '⏸';
        };
        pauseBtn.textContent = ctrl && ctrl.isPaused && ctrl.isPaused() ? '▶' : '⏸';
      }
      const labelsBtn = document.getElementById('graphLabelsBtn');
      if (labelsBtn) {
        labelsBtn.onclick = () => {
          if (!ctrl) return;
          ctrl.toggleLabels && ctrl.toggleLabels();
          labelsBtn.classList.toggle('active', ctrl.showLabels());
        };
        labelsBtn.classList.toggle('active', ctrl && ctrl.showLabels && ctrl.showLabels());
      }
      const searchInput = document.getElementById('graphSearchInput');
      if (searchInput) {
        searchInput.oninput = () => {
          if (ctrl && ctrl.setFilter) ctrl.setFilter(searchInput.value);
        };
      }
      const styleSelect = document.getElementById('graphStyleSelect');
      if (styleSelect) {
        styleSelect.onchange = () => {
          if (ctrl && ctrl.setStyle) ctrl.setStyle(styleSelect.value);
        };
      }
    } else if (iframe && msg.codeMapUri) {
      if (graphCanvas) graphCanvas.style.display = 'none';
      if (graphControls) graphControls.style.display = 'none';
      if (graphLegend) graphLegend.style.display = 'none';
      if (graphEmpty) graphEmpty.style.display = 'none';
      iframe.style.display = 'block';
      if (iframe.src !== msg.codeMapUri) iframe.src = msg.codeMapUri;
      if (graphFrame) graphFrame.classList.add('has-graph');
    } else {
      if (graphFrame) graphFrame.classList.remove('has-graph');
      if (graphEmpty) graphEmpty.style.display = 'flex';
      if (graphControls) graphControls.style.display = 'none';
      if (iframe) iframe.style.display = 'none';
      if (graphCanvas) graphCanvas.style.display = 'none';
    }
    const preview = document.getElementById('mapPreviewText');
    const previewWrap = document.getElementById('mapPreviewWrap');
    const mapContent = document.getElementById('mapContent');
    if (preview && msg.status === 'Generated') {
      preview.textContent = 'Code map generated successfully. Click Open in Browser to view the full interactive map.';
    }
    if (previewWrap && msg.status === 'Generated') {
      previewWrap.style.display = 'none';
    }
    if (mapContent) {
      mapContent.style.display = (msg.status === 'Generated' || msg.status === 'generated') ? 'grid' : 'none';
    }
  }
  if (msg.command === 'showTrustPane') {
    addTab('Trust', 'trustPane');
  }
  if (msg.command === 'updateTrustPane') {
    const s = document.getElementById('trustScore');
    const v = document.getElementById('trustVerified');
    const w = document.getElementById('trustWarnings');
    const la = document.getElementById('trustLastAudit');
    const b = document.getElementById('trustStatusBadge');
    if (s) s.textContent = msg.trustScore || '--';
    if (v) v.textContent = msg.verified || '--';
    if (w) w.textContent = msg.warnings || '0';
    if (la) la.textContent = msg.lastAudit || '--';
    if (b) {
      const status = msg.status || 'Unverified';
      b.textContent = status.toUpperCase();
      b.className = 'db-gate-badge ' + ((status === 'Verified' || status === 'verified') ? 'db-gate-pass' : (status === 'Failed' || status === 'failed') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('trustCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('trustHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('trustMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('trustLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('trustCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('trustHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('trustMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('trustLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('trustInfoScore'); if (is) is.textContent = msg.trustScore || '--';
    const iv = document.getElementById('trustInfoVerified'); if (iv) iv.textContent = msg.verified || '--';
    const iw = document.getElementById('trustInfoWarnings'); if (iw) iw.textContent = msg.warnings || '0';
    const rs = document.getElementById('trustRingScore'); if (rs) rs.textContent = msg.trustScore || '--';
    const ring = document.getElementById('trustRing');
    const trustScoreNum = (msg.trustScore && msg.trustScore !== '--') ? parseInt(msg.trustScore, 10) : null;
    if (ring && trustScoreNum != null && !isNaN(trustScoreNum)) {
      ring.style.borderColor = trustScoreNum >= 80 ? 'var(--sb-success)' : trustScoreNum >= 50 ? 'var(--sb-warning)' : 'var(--vscode-errorForeground)';
    }
    const quality = (msg.quality && msg.quality !== '--') ? parseInt(msg.quality, 10) : null;
    const security = (msg.security && msg.security !== '--') ? parseInt(msg.security, 10) : null;
    const compliance = (msg.compliance && msg.compliance !== '--') ? parseInt(msg.compliance, 10) : null;
    const dependencies = (msg.dependencies && msg.dependencies !== '--') ? parseInt(msg.dependencies, 10) : null;
    function setBd(id, valId, val) {
      const fill = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (fill) fill.style.width = (val != null && !isNaN(val) ? val : 0) + '%';
      if (valEl) valEl.textContent = (val != null && !isNaN(val) ? val : '--') + '%';
    }
    setBd('trustBdQuality', 'trustBdQualityVal', quality);
    setBd('trustBdSecurity', 'trustBdSecurityVal', security);
    setBd('trustBdCompliance', 'trustBdComplianceVal', compliance);
    setBd('trustBdDeps', 'trustBdDepsVal', dependencies);
    const factorsList = document.getElementById('trustFactorsList');
    if (factorsList && msg.factors && Array.isArray(msg.factors)) {
      factorsList.textContent = '';
      msg.factors.forEach(f => {
        const status = f.status || 'Pending';
        const icon = status === 'Pass' || status === 'pass' ? '✓' : status === 'Fail' || status === 'fail' ? '✗' : '…';
        const cls = status === 'Pass' || status === 'pass' ? 'pass' : status === 'Fail' || status === 'fail' ? 'fail' : 'pending';
        const item = document.createElement('div');
        item.className = 'trust-factor-item';
        const iconEl = document.createElement('span');
        iconEl.className = 'trust-factor-icon';
        iconEl.textContent = icon;
        const textEl = document.createElement('span');
        textEl.className = 'trust-factor-text';
        textEl.textContent = f.text || '';
        const statusEl = document.createElement('span');
        statusEl.className = 'trust-factor-status ' + cls;
        statusEl.textContent = status;
        item.appendChild(iconEl);
        item.appendChild(textEl);
        item.appendChild(statusEl);
        factorsList.appendChild(item);
      });
    }
    const badgesGrid = document.getElementById('trustBadgesGrid');
    if (badgesGrid && msg.badges && Array.isArray(msg.badges)) {
      badgesGrid.textContent = '';
      msg.badges.forEach(badge => {
        const item = document.createElement('div');
        item.className = 'trust-badge-item ' + (badge.unlocked ? 'unlocked' : 'locked');
        const iconEl = document.createElement('span');
        iconEl.className = 'trust-badge-icon';
        iconEl.textContent = badge.icon || '✓';
        const nameEl = document.createElement('span');
        nameEl.className = 'trust-badge-name';
        nameEl.textContent = badge.name || '';
        item.appendChild(iconEl);
        item.appendChild(nameEl);
        badgesGrid.appendChild(item);
      });
    }
  }
  if (msg.command === 'updateRoadmapPane') {
    const o = document.getElementById('roadOpen');
    const r = document.getElementById('roadRisk');
    const d = document.getElementById('roadDone');
    const t = document.getElementById('roadTarget');
    const b = document.getElementById('roadStatusBadge');
    if (o) o.textContent = msg.open || '--';
    if (r) r.textContent = msg.risk || '--';
    if (d) d.textContent = msg.done || '--';
    if (t) t.textContent = msg.target || '--';
    if (b) {
      b.textContent = (msg.status || 'Planning').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Active' || msg.status === 'active') ? 'db-gate-pass' : (msg.status === 'Blocked' || msg.status === 'blocked') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('roadCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('roadHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('roadMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('roadLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('roadCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('roadHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('roadMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('roadLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const io = document.getElementById('roadInfoOpen'); if (io) io.textContent = msg.open || '--';
    const ir = document.getElementById('roadInfoRisk'); if (ir) ir.textContent = msg.risk || '--';
    const it = document.getElementById('roadInfoTarget'); if (it) it.textContent = msg.target || '--';
    if (msg.findings) renderRoadmapPhases(msg.findings);
  }
  if (msg.command === 'updateAiContextPane') {
    const m = document.getElementById('aiModels');
    const i = document.getElementById('aiIssues');
    const s = document.getElementById('aiScore');
    const f = document.getElementById('aiFiles');
    const b = document.getElementById('aiStatusBadge');
    if (m) m.textContent = msg.models || '--';
    if (i) i.textContent = msg.issues || '--';
    if (s) s.textContent = msg.score || '--';
    if (f) f.textContent = msg.files || '--';
    if (b) {
      b.textContent = (msg.status || 'Monitoring').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Clear' || msg.status === 'clear') ? 'db-gate-pass' : (msg.status === 'Blocked' || msg.status === 'blocked' || msg.status === 'Issues Found') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('aiCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('aiHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('aiMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('aiLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('aiCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('aiHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('aiMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('aiLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const ii = document.getElementById('aiInfoIssues'); if (ii) ii.textContent = msg.issues || '--';
    const is = document.getElementById('aiInfoScore'); if (is) is.textContent = msg.score || '--';
    const iff = document.getElementById('aiInfoFiles'); if (iff) iff.textContent = msg.files || '--';
    const modelsList = document.getElementById('aiModelsList');
    if (modelsList && msg.aiModels && Array.isArray(msg.aiModels)) {
      modelsList.textContent = '';
      msg.aiModels.forEach(model => {
        const item = document.createElement('div');
        item.className = 'ai-model-item';
        const icon = document.createElement('div');
        icon.className = 'ai-model-icon';
        icon.textContent = '\u{1F916}';
        const info = document.createElement('div');
        info.className = 'ai-model-info';
        const name = document.createElement('div');
        name.className = 'ai-model-name';
        name.textContent = model.name || '';
        const meta = document.createElement('div');
        meta.className = 'ai-model-meta';
        meta.textContent = model.meta || '';
        const status = document.createElement('div');
        status.className = 'ai-model-status';
        status.textContent = model.status || 'Monitoring';
        info.appendChild(name);
        info.appendChild(meta);
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(status);
        modelsList.appendChild(item);
      });
    }
    const preview = document.getElementById('aiContextPreviewText');
    const previewWrap = document.getElementById('aiContextPreview');
    if (preview && msg.aiFindings && msg.aiFindings.length > 0) {
      preview.textContent = msg.aiFindings.length + ' AI-related patterns detected in your codebase.';
    }
    if (previewWrap && msg.aiFindings && msg.aiFindings.length > 0) {
      previewWrap.style.display = 'none';
    }
  }
  if (msg.command === 'updateUploadPane') {
    const t = document.getElementById('upTotal');
    const v = document.getElementById('upValid');
    const e = document.getElementById('upErrors');
    const s = document.getElementById('upScore');
    const b = document.getElementById('upStatusBadge');
    if (t) t.textContent = msg.total || '--';
    if (v) v.textContent = msg.valid || '--';
    if (e) e.textContent = msg.errors || '--';
    if (s) s.textContent = msg.score || '--';
    if (b) {
      b.textContent = (msg.status || 'Ready').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Complete' || msg.status === 'complete') ? 'db-gate-pass' : (msg.status === 'Error' || msg.status === 'error') ? 'db-gate-fail' : 'db-gate-pending');
    }
  }
  if (msg.command === 'updateAuditPane') {
    const v = document.getElementById('audVulns');
    const s = document.getElementById('audSecrets');
    const p = document.getElementById('audPassed');
    const sc = document.getElementById('audScore');
    const b = document.getElementById('audStatusBadge');
    if (v) v.textContent = msg.vulnerabilities || '--';
    if (s) s.textContent = msg.secrets || '--';
    if (p) p.textContent = msg.passed || '--';
    if (sc) sc.textContent = msg.score || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Pass' || msg.status === 'pass') ? 'db-gate-pass' : (msg.status === 'Fail' || msg.status === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const critCount = parseInt(msg.critical || '0', 10);
    const highCount = parseInt(msg.high || '0', 10);
    const medCount = parseInt(msg.medium || '0', 10);
    const lowCount = parseInt(msg.low || '0', 10);
    const crit = document.getElementById('audCritCount');
    const high = document.getElementById('audHighCount');
    const med = document.getElementById('audMedCount');
    const low = document.getElementById('audLowCount');
    if (crit) crit.textContent = msg.critical || '0';
    if (high) high.textContent = msg.high || '0';
    if (med) med.textContent = msg.medium || '0';
    if (low) low.textContent = msg.low || '0';
    const cc2 = document.getElementById('audCritCount2'); if (cc2) cc2.textContent = msg.critical || '0';
    const hc2 = document.getElementById('audHighCount2'); if (hc2) hc2.textContent = msg.high || '0';
    const mc2 = document.getElementById('audMedCount2'); if (mc2) mc2.textContent = msg.medium || '0';
    const lc2 = document.getElementById('audLowCount2'); if (lc2) lc2.textContent = msg.low || '0';
    const cl = document.getElementById('audCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('audHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('audMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('audLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const iv = document.getElementById('audInfoVulns'); if (iv) iv.textContent = msg.vulnerabilities || '--';
    const is = document.getElementById('audInfoSecrets'); if (is) is.textContent = msg.secrets || '--';
    const isc = document.getElementById('audInfoScore'); if (isc) isc.textContent = msg.score || '--';
    const catSec = document.getElementById('audCatSecrets');
    const catVul = document.getElementById('audCatVulns');
    const catSmell = document.getElementById('audCatSmells');
    const catComp = document.getElementById('audCatCompliance');
    if (catSec) catSec.textContent = msg.catSecrets || '--';
    if (catVul) catVul.textContent = msg.catVulns || '--';
    if (catSmell) catSmell.textContent = msg.catSmells || '--';
    if (catComp) catComp.textContent = msg.catCompliance || '--';
    const list = document.getElementById('audFindingsList');
    if (list && msg.findings && Array.isArray(msg.findings)) {
      list.textContent = '';
      msg.findings.forEach(f => {
        const sev = (f.severity || 'low').toLowerCase();
        const cls = sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
        const item = document.createElement('div');
        item.className = 'aud-finding-item';
        const badge = document.createElement('div');
        badge.className = 'aud-finding-badge ' + cls;
        badge.textContent = sev;
        const type = document.createElement('div');
        type.className = 'aud-finding-type';
        type.textContent = f.type || '--';
        const text = document.createElement('div');
        text.className = 'aud-finding-text';
        text.textContent = f.text || f.message || '';
        const file = document.createElement('div');
        file.className = 'aud-finding-file';
        file.textContent = f.file || '--';
        item.appendChild(badge);
        item.appendChild(type);
        item.appendChild(text);
        item.appendChild(file);
        list.appendChild(item);
      });
    }
    const recList = document.getElementById('audRecList');
    if (recList && msg.recommendations && Array.isArray(msg.recommendations)) {
      recList.textContent = '';
      msg.recommendations.forEach(r => {
        const item = document.createElement('div');
        item.className = 'aud-rec-item';
        const icon = document.createElement('span');
        icon.className = 'aud-rec-icon';
        icon.textContent = '💡';
        const text = document.createElement('span');
        text.className = 'aud-rec-text';
        text.textContent = (r && r.text) || r || '';
        item.appendChild(icon);
        item.appendChild(text);
        recList.appendChild(item);
      });
    }
    const summary = document.querySelector('.aud-summary');
    if (summary && msg.findings && msg.findings.length > 0) summary.style.display = 'none';
  }
  if (msg.command === 'updateSecurityPane') {
    const c = document.getElementById('secCritical');
    const h = document.getElementById('secHigh');
    const m = document.getElementById('secMedium');
    const s = document.getElementById('secScore');
    const b = document.getElementById('secStatusBadge');
    if (c) c.textContent = msg.critical || '--';
    if (h) h.textContent = msg.high || '--';
    if (m) m.textContent = msg.medium || '--';
    if (s) s.textContent = msg.score || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Pass' || msg.status === 'pass') ? 'db-gate-pass' : (msg.status === 'Fail' || msg.status === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const critCount = msg.critical || '0'; const highCount = msg.high || '0'; const medCount = msg.medium || '0'; const lowCount = msg.low || '0';
    const cc = document.getElementById('secCritCount'); if (cc) cc.textContent = critCount;
    const hc = document.getElementById('secHighCount'); if (hc) hc.textContent = highCount;
    const mc = document.getElementById('secMedCount'); if (mc) mc.textContent = medCount;
    const lc = document.getElementById('secLowCount'); if (lc) lc.textContent = lowCount;
    const cl = document.getElementById('secCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('secHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('secMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('secLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const rf = document.getElementById('secRepoFiles'); if (rf) rf.textContent = msg.repoFiles || '--';
    const gc = document.getElementById('secGateChecked'); if (gc) gc.textContent = msg.gateChecked || '--';
    const ls = document.getElementById('secLastScan'); if (ls) ls.textContent = msg.lastScan || '--';
    if (msg.findings && msg.findings.length > 0) {
      const emptyEl = document.getElementById('secThreatsEmpty');
      const listEl = document.getElementById('secThreatsList');
      if (emptyEl) emptyEl.style.display = 'none';
      if (listEl) listEl.style.display = 'block';
      renderSecurityThreats(msg.findings);
    } else {
      const emptyEl = document.getElementById('secThreatsEmpty');
      const listEl = document.getElementById('secThreatsList');
      if (emptyEl) emptyEl.style.display = 'block';
      if (listEl) { listEl.style.display = 'none'; listEl.textContent = ''; }
    }
  }
  if (msg.command === 'updateTrustPane') {
    const s = document.getElementById('trustScore');
    const v = document.getElementById('trustVerified');
    const w = document.getElementById('trustWarnings');
    const l = document.getElementById('trustLastAudit');
    const r = document.getElementById('trustRingScore');
    const b = document.getElementById('trustStatusBadge');
    if (s) s.textContent = msg.trustScore || '--';
    if (v) v.textContent = msg.verified || '--';
    if (w) w.textContent = msg.warnings || '--';
    if (l) l.textContent = msg.lastAudit || '--';
    if (r) r.textContent = msg.trustScore || '--';
    if (b) {
      b.textContent = (msg.status || 'Unverified').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Verified' || msg.status === 'verified') ? 'db-gate-pass' : (msg.status === 'Failed' || msg.status === 'failed') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('trustCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('trustHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('trustMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('trustLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('trustCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('trustHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('trustMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('trustLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('trustInfoScore'); if (is) is.textContent = msg.trustScore || '--';
    const iv = document.getElementById('trustInfoVerified'); if (iv) iv.textContent = msg.verified || '--';
    const iw = document.getElementById('trustInfoWarnings'); if (iw) iw.textContent = msg.warnings || '--';
    const ring = document.getElementById('trustRing');
    if (ring && msg.trustScore) {
      const scoreVal = parseInt(msg.trustScore, 10) || 0;
      const color = scoreVal >= 80 ? 'var(--wd-trust-good,#89d185)' : scoreVal >= 50 ? 'var(--wd-trust-med,#d7a24c)' : 'var(--wd-trust-low,#c75450)';
      ring.style.borderColor = color;
    }
    const bdQuality = document.getElementById('trustBdQuality');
    const bdQualityVal = document.getElementById('trustBdQualityVal');
    const bdSecurity = document.getElementById('trustBdSecurity');
    const bdSecurityVal = document.getElementById('trustBdSecurityVal');
    const bdCompliance = document.getElementById('trustBdCompliance');
    const bdComplianceVal = document.getElementById('trustBdComplianceVal');
    const bdDeps = document.getElementById('trustBdDeps');
    const bdDepsVal = document.getElementById('trustBdDepsVal');
    if (bdQuality) bdQuality.style.width = (msg.quality || '0') + '%';
    if (bdQualityVal) bdQualityVal.textContent = (msg.quality || '--') + '%';
    if (bdSecurity) bdSecurity.style.width = (msg.security || '0') + '%';
    if (bdSecurityVal) bdSecurityVal.textContent = (msg.security || '--') + '%';
    if (bdCompliance) bdCompliance.style.width = (msg.compliance || '0') + '%';
    if (bdComplianceVal) bdComplianceVal.textContent = (msg.compliance || '--') + '%';
    if (bdDeps) bdDeps.style.width = (msg.dependencies || '0') + '%';
    if (bdDepsVal) bdDepsVal.textContent = (msg.dependencies || '--') + '%';
    const factorsList = document.getElementById('trustFactorsList');
    if (factorsList && msg.factors && Array.isArray(msg.factors)) {
      factorsList.textContent = '';
      msg.factors.forEach(f => {
        const status = f.status || 'Pending';
        const icon = status === 'Pass' || status === 'pass' ? '✅' : status === 'Fail' || status === 'fail' ? '✗' : '⏳';
        const item = document.createElement('div');
        item.className = 'trust-factor-item';
        const iconEl = document.createElement('span');
        iconEl.className = 'trust-factor-icon';
        iconEl.textContent = icon;
        const text = document.createElement('span');
        text.className = 'trust-factor-text';
        text.textContent = f.text || '';
        const statusEl = document.createElement('span');
        statusEl.className = 'trust-factor-status';
        statusEl.textContent = status;
        item.appendChild(iconEl);
        item.appendChild(text);
        item.appendChild(statusEl);
        factorsList.appendChild(item);
      });
    }
    const badgesGrid = document.getElementById('trustBadgesGrid');
    if (badgesGrid && msg.badges && Array.isArray(msg.badges)) {
      badgesGrid.textContent = '';
      msg.badges.forEach(badge => {
        const item = document.createElement('div');
        item.className = 'trust-badge-item ' + (badge.unlocked ? 'unlocked' : 'locked');
        const icon = document.createElement('span');
        icon.className = 'trust-badge-icon';
        icon.textContent = badge.icon || '✓';
        const name = document.createElement('span');
        name.className = 'trust-badge-name';
        name.textContent = badge.name || '';
        item.appendChild(icon);
        item.appendChild(name);
        badgesGrid.appendChild(item);
      });
    }
    const summary = document.querySelector('.trust-summary');
    if (summary && msg.trustScore && msg.trustScore !== '--') summary.style.display = 'none';
  }
  if (msg.command === 'updateQualityPane') {
    const scoreNum = parseInt(msg.qualityScore, 10);
    const scoreEl = document.getElementById('qScore');
    const scoreFg = document.getElementById('qScoreFg');
    if (scoreEl) scoreEl.textContent = msg.qualityScore || '--';
    if (scoreFg) {
      const pct = isNaN(scoreNum) ? 0 : Math.min(100, Math.max(0, scoreNum));
      scoreFg.setAttribute('stroke-dasharray', pct + ', 100');
      scoreFg.style.stroke = pct >= 80 ? 'var(--sb-success)' : pct >= 50 ? 'var(--sb-warning)' : 'var(--vscode-errorForeground)';
    }
    const i = document.getElementById('qIssues');
    const c = document.getElementById('qCoverage');
    const f = document.getElementById('qFiles');
    const g = document.getElementById('qGate');
    const b = document.getElementById('qStatusBadge');
    if (i) i.textContent = msg.issues || '--';
    if (c) c.textContent = msg.coverage || '--';
    if (f) f.textContent = msg.files || '--';
    if (g) g.textContent = msg.gate || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Pass' || msg.status === 'pass') ? 'db-gate-pass' : (msg.status === 'Fail' || msg.status === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const metrics = [
      { id: 'qMaint', fill: 'qMaintFill', value: msg.maintainability },
      { id: 'qRel', fill: 'qRelFill', value: msg.reliability },
      { id: 'qComplex', fill: 'qComplexFill', value: msg.complexity },
      { id: 'qDup', fill: 'qDupFill', value: msg.duplication }
    ];
    for (const m of metrics) {
      const el = document.getElementById(m.id);
      const fill = document.getElementById(m.fill);
      if (el) el.textContent = m.value || '--';
      if (fill) {
        const num = parseInt(m.value, 10) || 0;
        fill.style.width = num + '%';
        fill.style.background = num >= 80 ? 'var(--sb-success)' : num >= 50 ? 'var(--sb-warning)' : 'var(--vscode-errorForeground)';
      }
    }
    const summary = document.querySelector('.q-summary');
    if (summary && msg.qualityScore && msg.qualityScore !== '--') summary.style.display = 'none';
  }
  if (msg.command === 'updateAssessmentsPane') {
    const c = document.getElementById('asstCompleted');
    const p = document.getElementById('asstPending');
    const r = document.getElementById('asstProgress');
    const t = document.getElementById('asstTotal');
    const b = document.getElementById('asstStatusBadge');
    if (c) c.textContent = msg.completed || '--';
    if (p) p.textContent = msg.pending || '--';
    if (r) r.textContent = msg.progress || '--';
    if (t) t.textContent = msg.total || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Pass' || msg.status === 'pass') ? 'db-gate-pass' : (msg.status === 'Fail' || msg.status === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('asstCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('asstHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('asstMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('asstLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('asstCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('asstHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('asstMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('asstLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const ic = document.getElementById('asstInfoCompleted'); if (ic) ic.textContent = msg.completed || '--';
    const ip = document.getElementById('asstInfoPending'); if (ip) ip.textContent = msg.pending || '--';
    const ir = document.getElementById('asstInfoProgress'); if (ir) ir.textContent = msg.progress ? msg.progress + '%' : '--';
    const pv = document.getElementById('asstProgressVal');
    const pf = document.getElementById('asstProgressFill');
    if (pv) pv.textContent = (msg.progress || '0') + '%';
    if (pf) pf.style.width = (msg.progress || '0') + '%';
    const catSec = document.getElementById('asstCatSecurity');
    const catSecFill = document.getElementById('asstCatSecurityFill');
    const catQual = document.getElementById('asstCatQuality');
    const catQualFill = document.getElementById('asstCatQualityFill');
    const catComp = document.getElementById('asstCatCompliance');
    const catCompFill = document.getElementById('asstCatComplianceFill');
    const catDocs = document.getElementById('asstCatDocs');
    const catDocsFill = document.getElementById('asstCatDocsFill');
    if (catSec) catSec.textContent = msg.security || '--';
    if (catSecFill) catSecFill.style.width = (msg.security || '0') + '%';
    if (catQual) catQual.textContent = msg.quality || '--';
    if (catQualFill) catQualFill.style.width = (msg.quality || '0') + '%';
    if (catComp) catComp.textContent = msg.compliance || '--';
    if (catCompFill) catCompFill.style.width = (msg.compliance || '0') + '%';
    if (catDocs) catDocs.textContent = msg.documentation || '--';
    if (catDocsFill) catDocsFill.style.width = (msg.documentation || '0') + '%';
    const items = document.getElementById('asstChecklistItems');
    if (items && msg.checklist && Array.isArray(msg.checklist)) {
      items.textContent = '';
      msg.checklist.forEach(item => {
        const status = item.status || (item.checked ? 'Pass' : 'Pending');
        const row = document.createElement('div');
        row.className = 'asst-check-item';
        const box = document.createElement('span');
        box.className = 'asst-check-box' + (item.checked ? ' checked' : '');
        box.textContent = item.checked ? '✓' : '';
        const text = document.createElement('span');
        text.className = 'asst-check-text';
        text.textContent = item.text || '';
        const statusEl = document.createElement('span');
        statusEl.className = 'asst-check-status';
        statusEl.textContent = status;
        row.appendChild(box);
        row.appendChild(text);
        row.appendChild(statusEl);
        items.appendChild(row);
      });
    }
    const summary = document.querySelector('.asst-summary');
    if (summary && msg.status && msg.status !== 'Pending') summary.style.display = 'none';
  }
  if (msg.command === 'updatePlatformPane') {
    const v = document.getElementById('platVersion');
    const e = document.getElementById('platEngine');
    const u = document.getElementById('platUptime');
    const s = document.getElementById('platStatus');
    const o = document.getElementById('platOs');
    const n = document.getElementById('platNode');
    const x = document.getElementById('platExt');
    const w = document.getElementById('platWorkspace');
    const b = document.getElementById('platStatusBadge');
    if (v) v.textContent = msg.version || '--';
    if (e) e.textContent = msg.engine || '--';
    if (u) u.textContent = msg.uptime || '--';
    if (s) s.textContent = msg.status || '--';
    if (o) o.textContent = msg.os || '--';
    if (n) n.textContent = msg.node || '--';
    if (x) x.textContent = msg.ext || '--';
    if (w) w.textContent = msg.workspace || '--';
    if (b) {
      b.textContent = (msg.badge || 'Online').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.badge === 'Online' || msg.badge === 'online') ? 'db-gate-pass' : (msg.badge === 'Offline' || msg.badge === 'offline') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('platCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('platHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('platMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('platLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('platCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('platHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('platMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('platLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('platInfoScore'); if (is) is.textContent = msg.qualityScore || '--';
    const ii = document.getElementById('platInfoIssues'); if (ii) ii.textContent = msg.issues || '--';
    const ig = document.getElementById('platInfoGate'); if (ig) ig.textContent = msg.gate || '--';
    const summary = document.getElementById('platSummary');
    if (summary && msg.version && msg.version !== '--') summary.style.display = 'none';
  }
  if (msg.command === 'updateCompliancePane') {
    const p = document.getElementById('compPassed');
    const f = document.getElementById('compFailed');
    const r = document.getElementById('compProgress');
    const t = document.getElementById('compTotal');
    const b = document.getElementById('compStatusBadge');
    if (p) p.textContent = msg.passed || '--';
    if (f) f.textContent = msg.failed || '--';
    if (r) r.textContent = msg.progress || '--';
    if (t) t.textContent = msg.total || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Pass' || msg.status === 'pass') ? 'db-gate-pass' : (msg.status === 'Fail' || msg.status === 'fail') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('compCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('compHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('compMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('compLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('compCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('compHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('compMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('compLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const ip = document.getElementById('compInfoPassed'); if (ip) ip.textContent = msg.passed || '--';
    const ifd = document.getElementById('compInfoFailed'); if (ifd) ifd.textContent = msg.failed || '--';
    const ir = document.getElementById('compInfoProgress'); if (ir) ir.textContent = msg.progress || '--';
    if (msg.rules) renderComplianceRules(msg.rules);
    const summary = document.getElementById('compSummary');
    if (summary && msg.status && msg.status !== 'Pending') summary.style.display = 'none';
  }
  if (msg.command === 'updateAnalyticsPane') {
    const s = document.getElementById('anScans');
    const i = document.getElementById('anIssues');
    const a = document.getElementById('anAvgScore');
    const l = document.getElementById('anLastScan');
    const t = document.getElementById('anTrend');
    const it = document.getElementById('anIssueTrend');
    const b = document.getElementById('anStatusBadge');
    if (s) s.textContent = msg.scans || '--';
    if (i) i.textContent = msg.issues || '--';
    if (a) a.textContent = msg.avgScore || '--';
    if (l) l.textContent = msg.lastScan || '--';
    if (t) t.textContent = msg.trend || '--';
    if (it) it.textContent = msg.issueTrend || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Ready' || msg.status === 'ready') ? 'db-gate-pass' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('anCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('anHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('anMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('anLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('anCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('anHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('anMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('anLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('anInfoScans'); if (is) is.textContent = msg.scans || '--';
    const ii = document.getElementById('anInfoIssues'); if (ii) ii.textContent = msg.issues || '--';
    const ia = document.getElementById('anInfoScore'); if (ia) ia.textContent = msg.avgScore || '--';
    const summary = document.getElementById('anSummary');
    if (summary && msg.status && msg.status !== 'Pending') summary.style.display = 'none';
  }
  if (msg.command === 'updateTeamPane') {
    const m = document.getElementById('tmMembers');
    const s = document.getElementById('tmScans');
    const r = document.getElementById('tmResolved');
    const sc = document.getElementById('tmScore');
    const b = document.getElementById('tmStatusBadge');
    if (m) m.textContent = msg.members || '--';
    if (s) s.textContent = msg.scans || '--';
    if (r) r.textContent = msg.resolved || '--';
    if (sc) sc.textContent = msg.score || '--';
    if (b) {
      b.textContent = (msg.status || 'Pending').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Active' || msg.status === 'active') ? 'db-gate-pass' : 'db-gate-pending');
    }
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('tmCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('tmHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('tmMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('tmLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('tmCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('tmHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('tmMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('tmLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('tmInfoScore'); if (is) is.textContent = msg.qualityScore || '--';
    const ii = document.getElementById('tmInfoIssues'); if (ii) ii.textContent = msg.issues || '--';
    const ig = document.getElementById('tmInfoGate'); if (ig) ig.textContent = msg.gate || '--';
    if (msg.membersList) renderTeamMembers(msg.membersList);
    const summary = document.getElementById('tmSummary');
    if (summary && msg.status && msg.status !== 'Pending') summary.style.display = 'none';
    // Show admin controls if the extension indicates current user is an admin
    try {
      const tmAdminBtnEl = document.getElementById('tmAdminBtn');
      if (tmAdminBtnEl) tmAdminBtnEl.style.display = msg.isAdmin ? 'flex' : 'none';
    } catch (e) {}
  }
  if (msg.command === 'updateScanPane') {
    const t = document.getElementById('scTotal');
    const i = document.getElementById('scIssues');
    const f = document.getElementById('scFixed');
    const s = document.getElementById('scScore');
    const b = document.getElementById('scStatusBadge');
    const pf = document.getElementById('scProgressFill');
    const pp = document.getElementById('scProgressPct');
    const pw = document.getElementById('scProgressWrap');
    const rw = document.getElementById('scResultsWrap');
    if (t) t.textContent = msg.total || '--';
    if (i) i.textContent = msg.issues || '--';
    if (f) f.textContent = msg.fixed || '--';
    if (s) s.textContent = msg.score || '--';
    if (pf) pf.style.width = (msg.progress || '0') + '%';
    if (pp) pp.textContent = (msg.progress || '0') + '%';
    if (pw) { if (msg.scanning) pw.classList.add('active'); else pw.classList.remove('active'); }
    if (rw) { if (msg.hasResults) rw.classList.add('active'); else rw.classList.remove('active'); }
    if (b) {
      b.textContent = (msg.status || 'Idle').toUpperCase();
      b.className = 'db-gate-badge ' + ((msg.status === 'Complete' || msg.status === 'complete') ? 'db-gate-pass' : (msg.status === 'Error' || msg.status === 'error') ? 'db-gate-fail' : 'db-gate-pending');
    }
    const crit = document.getElementById('scCritCount');
    const high = document.getElementById('scHighCount');
    const med = document.getElementById('scMedCount');
    const low = document.getElementById('scLowCount');
    if (crit) crit.textContent = msg.critical || '0';
    if (high) high.textContent = msg.high || '0';
    if (med) med.textContent = msg.medium || '0';
    if (low) low.textContent = msg.low || '0';
    const critCount = parseInt(msg.critical || '0', 10) || 0;
    const highCount = parseInt(msg.high || '0', 10) || 0;
    const medCount = parseInt(msg.medium || '0', 10) || 0;
    const lowCount = parseInt(msg.low || '0', 10) || 0;
    const summary = document.getElementById('scSummary');
    if (summary && msg.status && msg.status !== 'Idle') summary.style.display = 'none';
    const resultsList = document.getElementById('scResultsList');
    if (resultsList && msg.results && Array.isArray(msg.results)) {
      resultsList.textContent = '';
      msg.results.forEach(r => {
        const sev = (r.severity || 'low').toLowerCase();
        const cls = sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
        const item = document.createElement('div');
        item.className = 'sc-result-item';
        const type = document.createElement('span');
        type.className = 'sc-result-type';
        type.textContent = r.type || '--';
        const text = document.createElement('span');
        text.className = 'sc-result-text';
        text.textContent = r.text || r.message || '';
        const badge = document.createElement('span');
        badge.className = 'sc-result-badge ' + cls;
        badge.textContent = sev;
        const file = document.createElement('span');
        file.className = 'sc-result-file';
        file.textContent = r.file || '--';
        item.appendChild(type);
        item.appendChild(text);
        item.appendChild(badge);
        item.appendChild(file);
        resultsList.appendChild(item);
      });
    }
    const historyList = document.getElementById('scHistoryList');
    if (historyList && msg.history && Array.isArray(msg.history)) {
      historyList.textContent = '';
      msg.history.forEach(h => {
        const item = document.createElement('div');
        item.className = 'sc-history-item';
        const icon = document.createElement('span');
        icon.className = 'sc-history-icon';
        icon.textContent = '🔍';
        const text = document.createElement('span');
        text.className = 'sc-history-text';
        text.textContent = h.text || 'Scan';
        const time = document.createElement('span');
        time.className = 'sc-history-time';
        time.textContent = h.time || '--';
        const score = document.createElement('span');
        score.className = 'sc-history-score';
        score.textContent = h.score || '--';
        item.appendChild(icon);
        item.appendChild(text);
        item.appendChild(time);
        item.appendChild(score);
        historyList.appendChild(item);
      });
    }
  }
  if (msg.command === 'updateSettingsPane') {
    const toggles = { stAutoScanToggle: msg.autoScan, stBrowserToggle: msg.browserMode, stNotifyScanToggle: msg.notifyScan, stNotifyGateToggle: msg.notifyGate };
    for (const [id, on] of Object.entries(toggles)) {
      const el = document.getElementById(id);
      if (el) { if (on) el.classList.add('on'); else el.classList.remove('on'); }
    }
    const displaySelect = document.getElementById('stDisplaySelect');
    if (displaySelect && msg.displayMode) displaySelect.value = msg.displayMode;
    const apiInput = document.getElementById('stApiUrl');
    if (apiInput && msg.apiUrl) apiInput.value = msg.apiUrl;
    const sev = msg.severity || {};
    const critCount = sev.critical || 0; const highCount = sev.high || 0; const medCount = sev.medium || 0; const lowCount = sev.low || 0;
    const cc = document.getElementById('stCritCount'); if (cc) cc.textContent = String(critCount);
    const hc = document.getElementById('stHighCount'); if (hc) hc.textContent = String(highCount);
    const mc = document.getElementById('stMedCount'); if (mc) mc.textContent = String(medCount);
    const lc = document.getElementById('stLowCount'); if (lc) lc.textContent = String(lowCount);
    const cl = document.getElementById('stCritLabel'); if (cl) cl.textContent = critCount + ' Critical';
    const hl = document.getElementById('stHighLabel'); if (hl) hl.textContent = highCount + ' High';
    const ml = document.getElementById('stMedLabel'); if (ml) ml.textContent = medCount + ' Med';
    const ll = document.getElementById('stLowLabel'); if (ll) ll.textContent = lowCount + ' Low';
    const is = document.getElementById('stInfoScore'); if (is) is.textContent = msg.qualityScore || '--';
    const ii = document.getElementById('stInfoIssues'); if (ii) ii.textContent = msg.issues || '--';
    const ig = document.getElementById('stInfoGate'); if (ig) ig.textContent = msg.gate || '--';
    setSettingsStatus('Saved', true);
  }
  if (msg.command === 'apiConnectionResult') {
    const status = document.getElementById('stApiStatus');
    if (status) {
      status.textContent = msg.ok ? 'Connected' : 'Connection failed';
      status.style.color = msg.ok ? 'var(--sb-success)' : 'var(--vscode-errorForeground)';
    }
  }
  if (msg.command === 'setAnalyzePath') {
    const pathInput = document.getElementById('analyzePathInput');
    if (pathInput && msg.path) pathInput.value = msg.path;
  }
  if (msg.command === 'setScanPath') {
    const pathInput = document.getElementById('scanPathInput');
    if (pathInput && msg.path) pathInput.value = msg.path;
  }
  if (msg.command === 'setQualityPath') {
    const pathInput = document.getElementById('qPathInput');
    if (pathInput && msg.path) pathInput.value = msg.path;
  }
});


vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
}

