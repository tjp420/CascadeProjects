import * as vscode from 'vscode';

export class UploadPanel {
    public static currentPanel: UploadPanel | undefined;
    public static readonly viewType = 'simplebeaconUpload';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri): UploadPanel {
        const column = vscode.ViewColumn.One;

        if (UploadPanel.currentPanel) {
            UploadPanel.currentPanel._panel.reveal(column);
            return UploadPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            UploadPanel.viewType,
            'SimpleBeacon Upload',
            column,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        UploadPanel.currentPanel = new UploadPanel(panel, extensionUri);
        return UploadPanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
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
            },
            null,
            this._disposables
        );
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
            --primary: var(--vscode-button-background, #0ea5e9);
            --success: var(--vscode-testing-iconPassed, #22c55e);
            --warning: var(--vscode-editorWarning-foreground, #f59e0b);
            --danger: var(--vscode-editorError-foreground, #ef4444);
            --info: var(--vscode-editorInfo-foreground, #3b82f6);
            --bg: var(--vscode-editor-background, #0a0a0a);
            --surface: var(--vscode-panel-background, #141414);
            --border: var(--vscode-panel-border, #262626);
            --text: var(--vscode-foreground, #fafafa);
            --text-secondary: var(--vscode-descriptionForeground, #a3a3a3);
            --text-muted: var(--vscode-disabledForeground, #737373);
            --font: var(--vscode-font-family, 'Inter', system-ui, sans-serif);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: var(--font);
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
            padding: 20px;
        }
        h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 16px; }
        .dropzone {
            border: 2px dashed var(--border);
            border-radius: 8px;
            padding: 32px;
            text-align: center;
            background: var(--surface);
            transition: all 150ms;
            cursor: pointer;
            margin-bottom: 16px;
        }
        .dropzone:hover, .dropzone.drag-active {
            border-color: var(--primary);
            background: rgba(99,102,241,0.05);
        }
        .dropzone .icon { font-size: 2rem; margin-bottom: 8px; }
        .dropzone p { color: var(--text-secondary); margin: 0; }
        .dropzone .hint { color: var(--text-muted); font-size: 0.75rem; margin-top: 6px; }
        .panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            background: var(--surface);
            margin-bottom: 16px;
        }
        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
        }
        .panel-title { font-weight: 600; font-size: 1rem; margin: 0; }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .badge-success { background: rgba(34,197,94,0.15); color: var(--success); }
        .badge-warning { background: rgba(245,158,11,0.15); color: var(--warning); }
        .badge-danger { background: rgba(239,68,68,0.15); color: var(--danger); }
        .badge-info { background: rgba(59,130,246,0.15); color: var(--info); }
        .validation-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .validation-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg);
        }
        .validation-item.ok { border-color: rgba(34,197,94,0.25); }
        .validation-item.warn { border-color: rgba(245,158,11,0.25); }
        .validation-item.err { border-color: rgba(239,68,68,0.25); }
        .validation-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
        .validation-text { flex: 1; min-width: 0; }
        .validation-title { font-size: 0.875rem; font-weight: 500; }
        .validation-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .metric-box {
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);
            text-align: center;
        }
        .metric-value { font-size: 1.1rem; font-weight: 700; }
        .metric-label { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 0.875rem;
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
        pre {
            margin: 0;
            padding: 12px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.75rem;
            overflow-x: auto;
            max-height: 300px;
        }
        .empty { text-align: center; padding: 32px; color: var(--text-muted); }
        .actions { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
    </style>
</head>
<body>
    <h1>📁 Upload & Validate</h1>

    <input type="file" id="fileInput" accept=".json" style="display:none;">

    <div class="dropzone" id="dropzone">
        <div class="icon">📁</div>
        <p>Drop a JSON report here or click to browse</p>
        <p class="hint">Supports: gate scans, complete scans, consolidation, cleanup, codebase, roadmap, fiction digest</p>
    </div>

    <div id="results"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const results = document.getElementById('results');

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

        function renderChecks(checks) {
            return checks.map(c => '<div class="validation-item ' + (c.ok ? 'ok' : 'err') + '"><span class="validation-icon">' + (c.ok ? '✅' : '❌') + '</span><div class="validation-text"><div class="validation-title">' + escape(c.title) + '</div><div class="validation-desc">' + escape(c.desc) + '</div></div></div>').join('');
        }

        function renderMetrics(data, type, checks) {
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

            return '<div class="metric-grid">' + items.map(i => '<div class="metric-box"><div class="metric-value" style="color:' + (i.color || 'inherit') + '">' + escape(String(i.value)) + '</div><div class="metric-label">' + escape(i.label) + '</div></div>').join('') + '</div>';
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

        async function processFile(file) {
            if (!file.name.toLowerCase().endsWith('.json')) {
                results.innerHTML = '<div class="panel"><span class="badge badge-danger">Error</span><p style="margin-top:8px;">Only .json files are supported. Received: ' + escape(file.name) + '</p></div>';
                return;
            }

            let text;
            try { text = await file.text(); }
            catch { results.innerHTML = '<div class="panel"><span class="badge badge-danger">Read Error</span><p style="margin-top:8px;">Could not read ' + escape(file.name) + '</p></div>'; return; }

            const parse = parseJsonWithDiagnostics(text);
            if (!parse.ok) {
                results.innerHTML = '<div class="panel"><div class="panel-header"><span class="panel-title">Parse Error</span><span class="badge badge-danger">Invalid JSON</span></div><p style="color:var(--text-secondary);margin:0 0 12px;">' + escape(parse.error) + '</p><p style="color:var(--text-muted);font-size:0.875rem;margin:0;">Line ' + parse.line + ', Column ' + parse.col + '</p><pre style="margin-top:12px;">' + escape(text.split('\\n').slice(Math.max(0, parse.line - 3), parse.line + 2).map((l, i) => (Math.max(0, parse.line - 3) + i + 1) + ': ' + l).join('\\n')) + '</pre></div>';
                return;
            }

            const data = parse.data;
            const detection = detectReportType(data);
            const checks = validateReport(data, detection.type);
            const score = computeIntegrityScore(checks);
            const allOk = checks.every(c => c.ok);

            results.innerHTML = '<div class="panel"><div class="panel-header"><span class="panel-title">' + escape(file.name) + '</span><span class="badge ' + (allOk ? 'badge-success' : score >= 80 ? 'badge-warning' : 'badge-danger') + '">' + escape(detection.type) + ' ' + (allOk ? '✓' : score + '%') + '</span></div>' + renderMetrics(data, detection.type, checks) + '</div><div class="panel"><div class="panel-header"><span class="panel-title">Validation Checks (' + checks.filter(c=>c.ok).length + '/' + checks.length + ')</span></div><div class="validation-list">' + renderChecks(checks) + '</div></div><div class="panel"><div class="panel-header"><span class="panel-title">Raw Preview</span></div><pre>' + escape(JSON.stringify(data, null, 2).slice(0, 2000)) + (JSON.stringify(data, null, 2).length > 2000 ? '\\n\\n... truncated' : '') + '</pre></div><div class="actions"><button id="upload-server">Upload to Server</button><button id="download-validated">Download JSON</button><button class="secondary" onclick="results.innerHTML=\'\';dropzone.style.display=\'\';">Clear</button></div>';

            dropzone.style.display = 'none';
            document.getElementById('download-validated')?.addEventListener('click', () => downloadValidatedJson(data, file.name));
            document.getElementById('upload-server')?.addEventListener('click', () => {
                vscode.postMessage({ command: 'uploadReport', data });
            });
        }
    </script>
</body>
</html>`;
    }

    private async _uploadReport(data: any) {
        const config = vscode.workspace.getConfiguration('simplebeacon');
        const apiUrl = config.get<string>('apiUrl', '').trim();
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
                    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
                },
                body: JSON.stringify({ report: data, mode: 'report' })
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Upload failed: ${response.status} ${err}`);
            }
            vscode.window.showInformationMessage('Report uploaded to SimpleBeacon server successfully');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Upload failed: ${err.message}`);
        }
    }

    public dispose() {
        UploadPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
