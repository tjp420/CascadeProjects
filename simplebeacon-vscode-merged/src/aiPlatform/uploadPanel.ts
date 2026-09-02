// simplebeacon-ignore memory-leak — static UI bindings and file upload handlers
import * as vscode from 'vscode';
import { getSbConfig, getNonce } from '../utils/vscode';
import { GuardedExtensionPanel } from './scanPanel';

/**
 * Webview panel for uploading scan reports to the SimpleBeacon platform.
 */
export class UploadPanel {
  public static currentPanel: UploadPanel | undefined;
  public static readonly viewType = 'simplebeaconUpload';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    // Guarded listener container to avoid registering listeners after disposal
    private _guard = new GuardedExtensionPanel();

  public static createOrShow(extensionUri: vscode.Uri): UploadPanel {
    const column = vscode.ViewColumn.One;

    if (UploadPanel.currentPanel) {
      UploadPanel.currentPanel._panel.reveal(column);
      return UploadPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(UploadPanel.viewType, 'SimpleBeacon Upload', column, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    });

    UploadPanel.currentPanel = new UploadPanel(panel, extensionUri);
    return UploadPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

        const d1 = this._panel.onDidDispose(() => this.dispose());
        this._guard.register(d1);

        const d2 = this._panel.webview.onDidReceiveMessage(
            async (message) => {
        switch (message.command) {
          case 'showError':
            vscode.window.showErrorMessage(message.text);
            return;
          case 'showInfo':
            vscode.window.showInformationMessage(message.text);
            return;
          case 'uploadReport':
            await this._uploadReport(message.data);
            return;
        }
        });
        this._guard.register(d2);
  }

  private _update() {
    const webview = this._panel.webview;
    webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>SimpleBeacon Upload & Validate</title>
    <style>
        :root {
            --primary: var(--vscode-button-background, #0e639c);
            --success: #22c55e;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --bg: var(--vscode-editor-background, #1e1e1e);
            --surface: var(--vscode-panel-background, #252526);
            --border: var(--vscode-panel-border, #3c3c3c);
            --text: var(--vscode-foreground, #cccccc);
            --text-secondary: var(--vscode-descriptionForeground, #858585);
            --text-muted: var(--vscode-disabledForeground, #6e6e6e);
            --font: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--font);
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
            padding: 20px;
            max-width: 720px;
            margin: 0 auto;
        }
        h1 { font-size: 1.15rem; font-weight: 700; margin: 0 0 18px; }

        /* ── State panels ── */
        .stage { display: none; }
        .stage.active { display: block; }

        /* ── Drop zone ── */
        .dropzone-wrap { margin-bottom: 16px; }
        .dropzone {
            border: 2px dashed var(--border);
            border-radius: 10px;
            padding: 40px 24px;
            text-align: center;
            background: var(--surface);
            transition: border-color .2s, background .2s;
            cursor: pointer;
        }
        .dropzone:hover, .dropzone.drag-active {
            border-color: var(--primary);
            background: rgba(14,99,156,0.08);
        }
        .dropzone .icon { font-size: 2.2rem; margin-bottom: 10px; display: block; }
        .dropzone .lead { color: var(--text-secondary); font-size: .9rem; margin: 0 0 6px; }
        .dropzone .hint { color: var(--text-muted); font-size: .75rem; margin: 0; }
        .template-link {
            text-align: center;
            margin-top: 10px;
        }
        .template-link a {
            color: var(--primary);
            font-size: .8rem;
            text-decoration: none;
            cursor: pointer;
        }
        .template-link a:hover { text-decoration: underline; }

        /* ── Progress ── */
        .progress-wrap {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 28px 24px;
            background: var(--surface);
            text-align: center;
        }
        .progress-bar-track {
            height: 8px;
            border-radius: 4px;
            background: var(--border);
            overflow: hidden;
            margin: 14px 0 8px;
        }
        .progress-bar-fill {
            height: 100%;
            width: 0%;
            border-radius: 4px;
            background: var(--primary);
            transition: width .3s ease;
        }
        .progress-text { font-size: .85rem; color: var(--text-secondary); }
        .progress-cancel {
            margin-top: 12px;
            font-size: .8rem;
            color: var(--text-muted);
            cursor: pointer;
            background: none;
            border: none;
            padding: 0;
        }
        .progress-cancel:hover { color: var(--danger); text-decoration: underline; }

        /* ── Split Counter Summary ── */
        .summary-banner {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
        }
        .summary-card {
            flex: 1;
            border-radius: 8px;
            padding: 14px 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .summary-card.ok { border-left: 3px solid var(--success); }
        .summary-card.err { border-left: 3px solid var(--danger); }
        .summary-icon { font-size: 1.3rem; }
        .summary-body { display: flex; flex-direction: column; }
        .summary-count { font-size: 1.3rem; font-weight: 700; line-height: 1; }
        .summary-label { font-size: .7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; margin-top: 3px; }

        /* ── Panel / Card ── */
        .panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px 16px;
            background: var(--surface);
            margin-bottom: 14px;
        }
        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 6px;
        }
        .panel-title { font-weight: 600; font-size: .9rem; margin: 0; }

        /* ── Badge ── */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: .65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .04em;
        }
        .badge-success { background: rgba(34,197,94,.12); color: var(--success); }
        .badge-warning { background: rgba(245,158,11,.12); color: var(--warning); }
        .badge-danger { background: rgba(239,68,68,.12); color: var(--danger); }
        .badge-info { background: rgba(59,130,246,.12); color: var(--info); }

        /* ── Validation list ── */
        .validation-toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .validation-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: .8rem;
            color: var(--text-secondary);
            cursor: pointer;
            user-select: none;
        }
        .validation-toggle input { accent-color: var(--primary); cursor: pointer; }
        .validation-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .validation-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg);
            transition: background .15s;
        }
        .validation-item.ok { border-left: 3px solid var(--success); }
        .validation-item.err { border-left: 3px solid var(--danger); }
        .validation-item.hidden-row { display: none; }
        .validation-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
        .validation-text { flex: 1; min-width: 0; }
        .validation-title { font-size: .82rem; font-weight: 500; }
        .validation-desc { font-size: .75rem; color: var(--text-muted); margin-top: 1px; }
        .validation-cell {
            margin-top: 6px;
            padding: 4px 8px;
            border-radius: 4px;
            background: rgba(239,68,68,.08);
            border: 1px solid rgba(239,68,68,.2);
            font-size: .75rem;
            color: var(--danger);
            font-family: var(--vscode-editor-font-family, monospace);
            word-break: break-word;
        }

        /* ── Metrics ── */
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
        }
        .metric-box {
            padding: 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);
            text-align: center;
        }
        .metric-value { font-size: 1rem; font-weight: 700; }
        .metric-label { font-size: .65rem; color: var(--text-muted); margin-top: 2px; text-transform: uppercase; letter-spacing: .04em; }

        /* ── Buttons ── */
        button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            border-radius: 6px;
            font-weight: 600;
            font-size: .82rem;
            cursor: pointer;
            border: none;
            background: var(--primary);
            color: #fff;
        }
        button:hover { filter: brightness(1.1); }
        button.secondary {
            background: var(--surface);
            color: var(--text-secondary);
            border: 1px solid var(--border);
        }
        button.secondary:hover { background: var(--border); filter: none; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

        pre {
            margin: 0;
            padding: 10px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: .72rem;
            overflow-x: auto;
            max-height: 260px;
        }
        .empty { text-align: center; padding: 28px; color: var(--text-muted); font-size: .85rem; }
    </style>
</head>
<body>
    <h1>📁 Upload & Validate</h1>

    <input type="file" id="fileInput" accept=".json" style="display:none;">

    <!-- Stage 1: Drop zone -->
    <div class="stage active" id="stageDrop">
        <div class="dropzone-wrap">
            <div class="dropzone" id="dropzone">
                <span class="icon">�</span>
                <p class="lead">Drop a JSON report here or click to browse</p>
                <p class="hint">Accepts: .json up to 25 MB — gate scans, complete scans, consolidation, cleanup, codebase, roadmap, fiction digest</p>
            </div>
            <div class="template-link">
                <a id="downloadTemplate">Download sample template</a>
            </div>
        </div>
    </div>

    <!-- Stage 2: Processing -->
    <div class="stage" id="stageProgress">
        <div class="progress-wrap">
            <div class="progress-text" id="progressText">Reading file…</div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressPercent">0%</div>
            <button class="progress-cancel" id="cancelUpload">Cancel</button>
        </div>
    </div>

    <!-- Stage 3: Validation results -->
    <div class="stage" id="stageResults">
        <div id="summaryBanner"></div>
        <div id="results"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const resultsEl = document.getElementById('results');
        const summaryBanner = document.getElementById('summaryBanner');
        const stageDrop = document.getElementById('stageDrop');
        const stageProgress = document.getElementById('stageProgress');
        const stageResults = document.getElementById('stageResults');
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressText = document.getElementById('progressText');
        let currentFileName = '';
        let currentData = null;

        function showStage(id) {
            [stageDrop, stageProgress, stageResults].forEach(s => s.classList.toggle('active', s.id === id));
        }
        function setProgress(pct, label) {
            progressFill.style.width = pct + '%';
            progressPercent.textContent = pct + '%';
            if (label) progressText.textContent = label;
        }

        dropzone.addEventListener('click', () => fileInput.click());
        ['dragenter','dragover'].forEach(e => {
            dropzone.addEventListener(e, (ev) => { ev.preventDefault(); dropzone.classList.add('drag-active'); });
        });
        ['dragleave','drop'].forEach(e => {
            dropzone.addEventListener(e, (ev) => { ev.preventDefault(); dropzone.classList.remove('drag-active'); });
        });
        dropzone.addEventListener('drop', (ev) => {
            const f = ev.dataTransfer?.files?.[0];
            if (f) processFile(f);
        });
        fileInput.addEventListener('change', (ev) => {
            const f = ev.target.files?.[0];
            if (f) processFile(f);
            ev.target.value = '';
        });
        document.getElementById('cancelUpload').addEventListener('click', () => {
            showStage('stageDrop');
            setProgress(0, 'Reading file…');
        });
        document.getElementById('downloadTemplate').addEventListener('click', () => {
            const sample = { type: 'simplebeacon-gate-scan', projectRoot: '/path/to/project', generatedAt: new Date().toISOString(), severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }, detectedIssues: [] };
            const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'simplebeacon-template.json'; a.click();
            URL.revokeObjectURL(url);
        });

        function escape(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]);
        }

        function parseJsonWithDiagnostics(text) {
            try {
                return { ok: true, data: JSON.parse(text), error: null, line: null, col: null };
            } catch (err) {
                const m = err.message.match(/position (\\d+)/);
                let line = 1, col = 1;
                if (m) {
                    const pos = parseInt(m[1], 10);
                    let idx = 0;
                    for (let i = 0; i < text.length && idx < pos; i++) {
                        if (text[i] === '\\n') { line++; col = 0; }
                        col++;
                        idx++;
                    }
                }
                return { ok: false, data: null, error: err.message, line, col };
            }
        }

        function detectReportType(data) {
            const CERTAIN = 1.0;
            const VERY_LIKELY = 0.95;
            const LIKELY = 0.9;
            const POSSIBLE = 0.7;
            const UNCERTAIN = 0.6;
            const UNKNOWN = 0;
            if (!data || typeof data !== 'object') return { type: 'unknown', confidence: UNKNOWN };
            const typeField = data.type || '';
            if (typeField === 'simplebeacon-complete-scan' && data.results) return { type: 'complete-scan', confidence: CERTAIN };
            if (typeField === 'simplebeacon-gate-scan' || (data.detectedIssues && data.severityCounts)) return { type: 'gate-scan', confidence: VERY_LIKELY };
            if (typeField === 'file-merger-reduction-report') return { type: 'consolidation', confidence: CERTAIN };
            if (typeField === 'data-cleanup-report') return { type: 'cleanup', confidence: CERTAIN };
            if (typeField === 'codebase-analysis') return { type: 'codebase', confidence: CERTAIN };
            if (typeField === 'dynamic-project-roadmap-analysis' || data.codeAnalysis?.structure) return { type: 'roadmap', confidence: LIKELY };
            if (typeField === 'fiction-digest' || (data.fictionIssues && data.sourceReport)) return { type: 'fiction-digest', confidence: VERY_LIKELY };
            if (data.phases && Array.isArray(data.phases)) return { type: 'phases-roadmap', confidence: LIKELY };
            if (data.issues && Array.isArray(data.issues)) return { type: 'issue-list', confidence: POSSIBLE };
            if (data.files && typeof data.files === 'object') return { type: 'scanner-cache', confidence: UNCERTAIN };
            return { type: 'unknown', confidence: UNKNOWN };
        }

        function validateReport(data, type) {
            const checks = [];
            const push = (ok, title, desc) => checks.push({ ok, title, desc });

            if (!data || typeof data !== 'object') {
                push(false, 'Root type', 'Top-level value is not an object');
                return checks;
            }

            if (type === 'gate-scan' || type === 'complete-scan') {
                const sev = data.severityCounts || {};
                const total = (sev.critical||0) + (sev.high||0) + (sev.medium||0) + (sev.low||0) + (sev.info||0);
                const issues = data.detectedIssues || data.rawIssues || [];
                push(typeof data.projectRoot === 'string' || typeof data.projectPath === 'string', 'Project path', data.projectRoot || data.projectPath || 'MISSING');
                push(Array.isArray(issues), 'Issues array', Array.isArray(issues) ? issues.length + ' items' : 'not an array');
                push(typeof sev === 'object', 'Severity counts', typeof sev === 'object' ? JSON.stringify(sev) : 'missing');
                if (Array.isArray(issues) && typeof sev === 'object') {
                    push(total === issues.length, 'Count integrity', 'severityCounts sum=' + total + ', issues.length=' + issues.length);
                }
                if (Array.isArray(issues)) {
                    const bad = issues.filter(i => !i.severity || !i.type).length;
                    push(bad === 0, 'Issue shape', bad === 0 ? 'all have severity + type' : bad + '/' + issues.length + ' missing severity or type');
                }
            }

            if (type === 'complete-scan') {
                push(typeof data.results === 'object', 'Results object', data.results ? 'present' : 'MISSING');
                if (data.results) {
                    const r = data.results;
                    const hasGate = !!(r.simplebeacon || r.gate);
                    push(hasGate, 'Gate report', hasGate ? 'present' : 'MISSING');
                }
            }

            if (type === 'consolidation') {
                push(typeof data.summary === 'object', 'Summary object', data.summary ? 'present' : 'MISSING');
                push(Array.isArray(data.groups), 'Groups array', Array.isArray(data.groups) ? data.groups.length + ' items' : 'not an array');
            }

            if (type === 'cleanup') {
                push(!!data.scanProfile, 'Scan profile', data.scanProfile || 'MISSING');
                push(Array.isArray(data.findings), 'Findings array', Array.isArray(data.findings) ? data.findings.length + ' items' : 'not an array');
            }

            if (type === 'roadmap' || type === 'phases-roadmap') {
                if (data.phases) push(Array.isArray(data.phases), 'Phases array', Array.isArray(data.phases) ? data.phases.length + ' phases' : 'not an array');
                if (data.issues) push(Array.isArray(data.issues), 'Issues array', Array.isArray(data.issues) ? data.issues.length + ' items' : 'not an array');
            }

            if (type === 'fiction-digest') {
                push(!!data.sourceReport, 'Source report', data.sourceReport ? 'present' : 'MISSING');
                push(Array.isArray(data.fictionIssues), 'Fiction issues', Array.isArray(data.fictionIssues) ? data.fictionIssues.length + ' items' : 'not an array');
            }

            if (type === 'codebase') {
                push(Array.isArray(data.fileTypes), 'File types', Array.isArray(data.fileTypes) ? data.fileTypes.length + ' items' : 'not an array');
                push(typeof data.totalFiles === 'number', 'Total files', typeof data.totalFiles === 'number' ? data.totalFiles : 'MISSING');
            }

            push(!!data.generatedAt || !!data.exportedAt || !!data.scannedAt, 'Timestamp', data.generatedAt || data.exportedAt || data.scannedAt || 'MISSING');

            return checks;
        }

        function computeIntegrityScore(checks) {
            const total = checks.length;
            const passed = checks.filter(c => c.ok).length;
            return total ? Math.round((passed / total) * 100) : 0;
        }

        function renderSummaryBanner(checks) {
            const passed = checks.filter(c => c.ok).length;
            const failed = checks.length - passed;
            summaryBanner.textContent = '';
            const wrap = document.createElement('div');
            wrap.className = 'summary-banner';
            const okCard = document.createElement('div');
            okCard.className = 'summary-card ok';
            const okIcon = document.createElement('span'); okIcon.className = 'summary-icon'; okIcon.textContent = '✅';
            const okBody = document.createElement('div'); okBody.className = 'summary-body';
            const okCount = document.createElement('div'); okCount.className = 'summary-count'; okCount.textContent = String(passed);
            const okLabel = document.createElement('div'); okLabel.className = 'summary-label'; okLabel.textContent = 'Valid Checks';
            okBody.append(okCount, okLabel); okCard.append(okIcon, okBody);
            const errCard = document.createElement('div');
            errCard.className = 'summary-card err';
            const errIcon = document.createElement('span'); errIcon.className = 'summary-icon'; errIcon.textContent = '⚠️';
            const errBody = document.createElement('div'); errBody.className = 'summary-body';
            const errCount = document.createElement('div'); errCount.className = 'summary-count'; errCount.textContent = String(failed);
            const errLabel = document.createElement('div'); errLabel.className = 'summary-label'; errLabel.textContent = 'Errors Found';
            errBody.append(errCount, errLabel); errCard.append(errIcon, errBody);
            wrap.appendChild(okCard); wrap.appendChild(errCard);
            summaryBanner.appendChild(wrap);
        }

        function renderChecks(checks, container, showOnlyErrors) {
            container.textContent = '';
            checks.forEach((c, idx) => {
                if (showOnlyErrors && c.ok) return;
                const item = document.createElement('div');
                item.className = 'validation-item ' + (c.ok ? 'ok' : 'err');
                item.dataset.index = String(idx);
                const icon = document.createElement('span');
                icon.className = 'validation-icon';
                icon.textContent = c.ok ? '✅' : '❌';
                const text = document.createElement('div');
                text.className = 'validation-text';
                const title = document.createElement('div');
                title.className = 'validation-title';
                title.textContent = c.title;
                const desc = document.createElement('div');
                desc.className = 'validation-desc';
                desc.textContent = c.desc;
                text.appendChild(title); text.appendChild(desc);
                if (!c.ok) {
                    const cell = document.createElement('div');
                    cell.className = 'validation-cell';
                    cell.textContent = 'Fix: review ' + c.title.toLowerCase() + ' value above';
                    text.appendChild(cell);
                }
                item.appendChild(icon); item.appendChild(text);
                container.appendChild(item);
            });
        }

        function renderMetrics(data, type, checks, container) {
            const score = computeIntegrityScore(checks);
            const items = [];
            if (type === 'gate-scan' || type === 'complete-scan') {
                const sev = data.severityCounts || {};
                items.push({ label: 'Critical', value: sev.critical || 0, color: 'var(--danger)' });
                items.push({ label: 'High', value: sev.high || 0, color: 'var(--danger)' });
                items.push({ label: 'Medium', value: sev.medium || 0, color: 'var(--warning)' });
                items.push({ label: 'Low', value: sev.low || 0, color: 'var(--info)' });
                const issues = data.detectedIssues || data.rawIssues || [];
                items.push({ label: 'Issues', value: issues.length });
            }
            if (type === 'complete-scan' && data.results) {
                const r = data.results;
                if (r.roadmap) items.push({ label: 'Roadmap phases', value: (r.roadmap.phases || []).length || (r.roadmap.issues || []).length });
            }
            if (type === 'consolidation') {
                items.push({ label: 'Groups', value: (data.groups || []).length });
            }
            if (type === 'cleanup') {
                items.push({ label: 'Findings', value: (data.findings || []).length });
            }
            if (type === 'roadmap' || type === 'phases-roadmap') {
                if (data.phases) items.push({ label: 'Phases', value: data.phases.length });
            }
            if (type === 'fiction-digest') {
                items.push({ label: 'Fiction', value: (data.fictionIssues || []).length });
                items.push({ label: 'Non-fiction', value: (data.nonFictionIssues || []).length });
            }
            if (type === 'codebase') {
                items.push({ label: 'Files', value: data.totalFiles || 0 });
                items.push({ label: 'Types', value: (data.fileTypes || []).length });
            }
            items.push({ label: 'Integrity', value: score + '%', color: score === 100 ? 'var(--success)' : score >= 80 ? 'var(--warning)' : 'var(--danger)' });

            const grid = document.createElement('div');
            grid.className = 'metric-grid';
            items.forEach(i => {
                const box = document.createElement('div');
                box.className = 'metric-box';
                const value = document.createElement('div');
                value.className = 'metric-value';
                value.style.color = i.color || 'inherit';
                value.textContent = String(i.value);
                const label = document.createElement('div');
                label.className = 'metric-label';
                label.textContent = i.label;
                box.appendChild(value);
                box.appendChild(label);
                grid.appendChild(box);
            });
            container.appendChild(grid);
        }

        function downloadValidatedJson(data, fileName) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace(/\\.json$/i, '-validated.json');
            a.click();
            URL.revokeObjectURL(url);
        }

        function clearResults() {
            while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild);
            summaryBanner.textContent = '';
        }

        function showErrorPanel(title, message) {
            clearResults();
            showStage('stageResults');
            const panel = document.createElement('div');
            panel.className = 'panel';
            const badge = document.createElement('span');
            badge.className = 'badge badge-danger';
            badge.textContent = title;
            const p = document.createElement('p');
            p.style.marginTop = '8px';
            p.textContent = message;
            panel.appendChild(badge); panel.appendChild(p);
            resultsEl.appendChild(panel);
        }

        function renderValidationPanel(checks, data, detection) {
            const score = computeIntegrityScore(checks);
            const allOk = checks.every(c => c.ok);

            // Info + metrics
            const infoPanel = document.createElement('div');
            infoPanel.className = 'panel';
            const infoHeader = document.createElement('div');
            infoHeader.className = 'panel-header';
            const fileTitle = document.createElement('span');
            fileTitle.className = 'panel-title';
            fileTitle.textContent = currentFileName;
            const typeBadge = document.createElement('span');
            typeBadge.className = 'badge ' + (allOk ? 'badge-success' : score >= 80 ? 'badge-warning' : 'badge-danger');
            typeBadge.textContent = detection.type + ' ' + (allOk ? '✓' : score + '%');
            infoHeader.appendChild(fileTitle); infoHeader.appendChild(typeBadge);
            infoPanel.appendChild(infoHeader);
            renderMetrics(data, detection.type, checks, infoPanel);
            resultsEl.appendChild(infoPanel);

            // Validation checks with toolbar
            const checksPanel = document.createElement('div');
            checksPanel.className = 'panel';
            const checksHeader = document.createElement('div');
            checksHeader.className = 'panel-header';
            const checksTitle = document.createElement('span');
            checksTitle.className = 'panel-title';
            checksTitle.textContent = 'Validation Checks';
            checksHeader.appendChild(checksTitle);
            checksPanel.appendChild(checksHeader);

            const toolbar = document.createElement('div');
            toolbar.className = 'validation-toolbar';
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'validation-toggle';
            const toggleCb = document.createElement('input');
            toggleCb.type = 'checkbox';
            toggleLabel.appendChild(toggleCb);
            toggleLabel.appendChild(document.createTextNode(' Show only errors'));
            toolbar.appendChild(toggleLabel);
            checksPanel.appendChild(toolbar);

            const validationList = document.createElement('div');
            validationList.className = 'validation-list';
            renderChecks(checks, validationList, false);
            checksPanel.appendChild(validationList);
            resultsEl.appendChild(checksPanel);

            toggleCb.addEventListener('change', () => {
                renderChecks(checks, validationList, toggleCb.checked);
            });

            // Raw preview
            const previewPanel = document.createElement('div');
            previewPanel.className = 'panel';
            const previewHeader = document.createElement('div');
            previewHeader.className = 'panel-header';
            const previewTitle = document.createElement('span');
            previewTitle.className = 'panel-title';
            previewTitle.textContent = 'Raw Preview';
            previewHeader.appendChild(previewTitle);
            previewPanel.appendChild(previewHeader);
            const pre = document.createElement('pre');
            const jsonStr = JSON.stringify(data, null, 2);
            pre.textContent = jsonStr.slice(0, 2000) + (jsonStr.length > 2000 ? '\n\n... truncated' : '');
            previewPanel.appendChild(pre);
            resultsEl.appendChild(previewPanel);

            // Actions
            const actions = document.createElement('div');
            actions.className = 'actions';
            const uploadBtn = document.createElement('button');
            uploadBtn.textContent = 'Upload to Server';
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download JSON';
            const clearBtn = document.createElement('button');
            clearBtn.className = 'secondary';
            clearBtn.textContent = 'Clear';
            clearBtn.addEventListener('click', () => { clearResults(); showStage('stageDrop'); });
            actions.appendChild(uploadBtn); actions.appendChild(downloadBtn); actions.appendChild(clearBtn);
            resultsEl.appendChild(actions);

            downloadBtn.addEventListener('click', () => downloadValidatedJson(data, currentFileName));
            uploadBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'uploadReport', data });
            });
        }

        async function processFile(file) {
            if (!file.name.toLowerCase().endsWith('.json')) {
                showErrorPanel('Error', 'Only .json files are supported. Received: ' + file.name);
                return;
            }
            currentFileName = file.name;
            showStage('stageProgress');
            setProgress(15, 'Reading file…');

            let text;
            try { text = await file.text(); }
            catch {
                setProgress(0, 'Read failed');
                showErrorPanel('Read Error', 'Could not read ' + file.name);
                return;
            }
            setProgress(45, 'Parsing JSON…');

            const parse = parseJsonWithDiagnostics(text);
            if (!parse.ok) {
                setProgress(0, 'Parse failed');
                clearResults();
                showStage('stageResults');
                const panel = document.createElement('div');
                panel.className = 'panel';
                const header = document.createElement('div');
                header.className = 'panel-header';
                const title = document.createElement('span');
                title.className = 'panel-title';
                title.textContent = 'Parse Error';
                const badge = document.createElement('span');
                badge.className = 'badge badge-danger';
                badge.textContent = 'Invalid JSON';
                header.appendChild(title); header.appendChild(badge);
                const p1 = document.createElement('p');
                p1.style.color = 'var(--text-secondary)';
                p1.style.margin = '0 0 10px';
                p1.textContent = parse.error;
                const p2 = document.createElement('p');
                p2.style.color = 'var(--text-muted)';
                p2.style.fontSize = '.8rem';
                p2.style.margin = '0';
                p2.textContent = 'Line ' + parse.line + ', Column ' + parse.col;
                const pre = document.createElement('pre');
                pre.style.marginTop = '10px';
                pre.textContent = text.split('\n').slice(Math.max(0, parse.line - 3), parse.line + 2).map((l, i) => (Math.max(0, parse.line - 3) + i + 1) + ': ' + l).join('\n');
                panel.appendChild(header); panel.appendChild(p1); panel.appendChild(p2); panel.appendChild(pre);
                resultsEl.appendChild(panel);
                return;
            }

            setProgress(75, 'Validating structure…');
            const data = parse.data;
            const detection = detectReportType(data);
            const checks = validateReport(data, detection.type);

            setProgress(100, 'Done');
            await new Promise(r => setTimeout(r, 250));
            clearResults();
            showStage('stageResults');
            renderSummaryBanner(checks);
            renderValidationPanel(checks, data, detection);
            currentData = data;
        }
    </script>
</body>
</html>`;
  }

  private async _uploadReport(data: Record<string, unknown>) {
    const config = getSbConfig();
    const apiUrl = (config.get<string>('apiServerUrl') || config.get<string>('apiUrl', '')).trim();
    const apiKey = config.get<string>('apiKey', '');
    if (!apiUrl) {
      vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/analyze/flexible`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ report: data, mode: 'report' }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upload failed: ${response.status} ${err}`);
      }
      vscode.window.showInformationMessage('Report uploaded to SimpleBeacon server successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Upload failed: ${msg}`);
    }
  }

  public dispose() {
        UploadPanel.currentPanel = undefined;
        try { this._guard.dispose(); } catch (err) { console.error('Error disposing upload panel guard', err); }
        try { this._panel.dispose(); } catch (err) { console.error('Error disposing panel', err); }
  }
}
