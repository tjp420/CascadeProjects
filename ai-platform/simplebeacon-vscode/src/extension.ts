import * as vscode from 'vscode';
import * as http from 'http';
import { SimpleBeaconProvider, ScanIssue } from './simplebeaconProvider';
import { ScanPanel } from './scanPanel';
import { UploadPanel } from './uploadPanel';
import { DiagnosticsManager } from './diagnostics';
import { RealtimeMonitor } from './realtimeMonitor';
import { DashboardPanel } from './dashboardPanel';
import { fetchHtml, rewritePageHtml, injectPreviewScripts, postAiContext } from './browserPreview';

export let provider: SimpleBeaconProvider;
export let diagnosticsManager: DiagnosticsManager;
export let dashboardPanel: DashboardPanel;

export function activate(context: vscode.ExtensionContext) {
    provider = new SimpleBeaconProvider(context);
    diagnosticsManager = new DiagnosticsManager();
    const realtimeMonitor = RealtimeMonitor.getInstance();

    // Register modern dashboard webview view
    dashboardPanel = new DashboardPanel(context.extensionUri);
    vscode.window.registerWebviewViewProvider('simplebeaconDashboard', dashboardPanel);

    // Dashboard refresh command (internal bridge from scan results)
    vscode.commands.registerCommand('simplebeacon.refreshDashboard', (stats) => {
        dashboardPanel.updateStats(stats);
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('simplebeacon.scanWorkspace', () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder open. Open a folder first.');
                return;
            }
            ScanPanel.createOrShow(context.extensionUri, workspaceFolders[0].uri.fsPath);
        }),

        vscode.commands.registerCommand('simplebeacon.scanFolder', (uri: vscode.Uri) => {
            const targetPath = uri ? uri.fsPath : undefined;
            if (!targetPath) {
                vscode.window.showWarningMessage('No folder selected.');
                return;
            }
            ScanPanel.createOrShow(context.extensionUri, targetPath);
        }),

        vscode.commands.registerCommand('simplebeacon.uploadReport', () => {
            UploadPanel.createOrShow(context.extensionUri);
        }),

        vscode.commands.registerCommand('simplebeacon.refreshResults', async () => {
            await provider.refresh();
        }),

        vscode.commands.registerCommand('simplebeacon.clearResults', () => {
            provider.clear();
            diagnosticsManager.clear();
            vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', false);
            dashboardPanel.clearStats();
        }),

        vscode.commands.registerCommand('simplebeacon.openIssue', (issue: ScanIssue) => {
            if (issue && issue.filePath && issue.line) {
                const docUri = vscode.Uri.file(issue.filePath);
                vscode.workspace.openTextDocument(docUri).then(doc => {
                    vscode.window.showTextDocument(doc).then(editor => {
                        const position = new vscode.Position(issue.line! - 1, issue.column || 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    });
                });
            }
        }),

        vscode.commands.registerCommand('simplebeacon.toggleRealtimeMonitoring', () => {
            if (realtimeMonitor.getMonitoringStatus()) {
                realtimeMonitor.stop();
                vscode.window.showInformationMessage('Real-time AI slop monitoring stopped');
            } else {
                realtimeMonitor.start();
            }
        }),

        vscode.commands.registerCommand('simplebeacon.openBrowser', async () => {
            const config = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = config.get<string>('apiUrl', '').trim();
            if (!apiUrl) {
                vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
                return;
            }
            const dashboardUrl = apiUrl.replace(/\/$/, '') + '/simplebeacon-dashboard/index.html';
            openPreviewPanel(dashboardUrl, 'SimpleBeacon Dashboard');
        }),

        vscode.commands.registerCommand('simplebeacon.openAnalyze', async () => {
            const config = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = config.get<string>('apiUrl', '').trim();
            if (!apiUrl) {
                vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
                return;
            }
            const analyzeUrl = apiUrl.replace(/\/$/, '') + '/simplebeacon-dashboard/index.html#/analyze';
            openPreviewPanel(analyzeUrl, 'SimpleBeacon Analyze');
        }),

        vscode.commands.registerCommand('simplebeacon.openUpload', async () => {
            const config = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = config.get<string>('apiUrl', '').trim();
            if (!apiUrl) {
                vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
                return;
            }
            const uploadUrl = apiUrl.replace(/\/$/, '') + '/coming-soon/upload.html';
            openPreviewPanel(uploadUrl, 'SimpleBeacon Upload');
        }),

        vscode.commands.registerCommand('simplebeacon.openPreview', async (url?: string, title?: string) => {
            const configUrl = vscode.workspace.getConfiguration('simplebeacon').get<string>('apiUrl', '').trim();
            const targetUrl = url || configUrl;
            if (!targetUrl) {
                vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
                return;
            }
            const panelTitle = title || 'SimpleBeacon Preview';
            openPreviewPanel(targetUrl, panelTitle);
        }),

        vscode.commands.registerCommand('simplebeacon.openAiContext', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }
            const contextPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.simplebeacon', 'ai-context.md');
            try {
                await vscode.workspace.fs.stat(contextPath);
                await vscode.commands.executeCommand('vscode.open', contextPath);
            } catch {
                vscode.window.showInformationMessage('No AI context file yet. Send data from the upload page first.');
            }
        }),

        vscode.commands.registerCommand('simplebeacon.sendToAi', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }
            const config = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = config.get<string>('apiUrl', '').trim();
            if (!apiUrl) {
                vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
                return;
            }
            const projectPath = workspaceFolders[0].uri.fsPath;

            try {
                const url = `${apiUrl}/api/ai-context?projectPath=${encodeURIComponent(projectPath)}`;
                const http = require('http');
                const parsed = new URL(url);
                const result: { content?: string; path?: string } = await new Promise((resolve, reject) => {
                    const req = http.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: 'GET' }, (res: http.IncomingMessage) => {
                        let body = '';
                        res.on('data', (chunk: Buffer) => { body += chunk; });
                        res.on('end', () => {
                            try { resolve(JSON.parse(body)); }
                            catch { resolve({}); }
                        });
                    });
                    req.on('error', reject);
                    req.end();
                });

                if (result.content) {
                    await vscode.env.clipboard.writeText(result.content);
                    vscode.window.showInformationMessage('Scan data copied to clipboard — paste into your AI coding agent with Ctrl+V');
                } else {
                    vscode.window.showWarningMessage('No AI context found. Run a scan and click "Send to AI" on the dashboard first.');
                }
            } catch (err) {
                vscode.window.showErrorMessage('Failed to fetch AI context: ' + (err instanceof Error ? err.message : String(err)));
            }
        })
    );

    // Auto-scan on open if configured
    const config = vscode.workspace.getConfiguration('simplebeacon');
    if (config.get<boolean>('autoScanOnOpen', false)) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            setTimeout(() => {
                vscode.commands.executeCommand('simplebeacon.scanWorkspace');
            }, 2000);
        }
    }

    // Auto-start real-time AI slop monitoring if enabled
    if (config.get<boolean>('autoMonitorAI', false)) {
        realtimeMonitor.start();
    }

    vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', false);

    // Watch for new AI context files and auto-open them
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const contextPattern = new vscode.RelativePattern(workspaceFolders[0], '.simplebeacon/ai-context.md');
        const contextWatcher = vscode.workspace.createFileSystemWatcher(contextPattern);
        contextWatcher.onDidCreate(async (uri) => {
            await vscode.commands.executeCommand('vscode.open', uri);
            vscode.window.showInformationMessage('SimpleBeacon: New AI context available. The AI agent can now see your scan data.');
        });
        contextWatcher.onDidChange(async (uri) => {
            await vscode.commands.executeCommand('vscode.open', uri);
            vscode.window.showInformationMessage('SimpleBeacon: AI context updated with new scan data.');
        });
        context.subscriptions.push(contextWatcher);
    }

    // Register URI handler for website → VS Code deep links
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
                if (uri.path === '/fix' || uri.path === 'fix') {
                    const params = new URLSearchParams(uri.query);
                    const projectPath = params.get('projectPath') || '';
                    const scanId = params.get('scanId') || '';
                    if (projectPath) {
                        vscode.window.showInformationMessage(
                            `SimpleBeacon: Received scan from website. Open fix panel?`,
                            'Open', 'Dismiss'
                        ).then(choice => {
                            if (choice === 'Open') {
                                ScanPanel.createOrShow(context.extensionUri, projectPath);
                            }
                        });
                    }
                }
            }
        })
    );
}

async function openPreviewPanel(url: string, title: string) {
    const panel = vscode.window.createWebviewPanel(
        'simplebeaconPreview',
        title,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    try {
        const html = await fetchHtml(url);
        const { html: rewritten, origin } = rewritePageHtml(html, url);
        const parsedUrl = new URL(url);
        panel.webview.html = injectPreviewScripts(rewritten, origin, parsedUrl.hash || '');

        panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'updateStats') {
                dashboardPanel?.updateStats(msg);
                return;
            }
            if (msg.command === 'scanComplete' && msg.stats) {
                dashboardPanel?.updateStats(msg.stats);
                return;
            }
            if (msg.command === 'sendToAI' && msg.data) {
                const config = vscode.workspace.getConfiguration('simplebeacon');
                const apiUrl = config.get<string>('apiUrl', '').trim();
                if (!apiUrl) {
                    vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
                    return;
                }
                try {
                    const postRes = await postAiContext(apiUrl, msg.data);
                    if (postRes.success && postRes.content) {
                        await vscode.env.clipboard.writeText(postRes.content);
                        vscode.window.showInformationMessage('Scan data copied to clipboard — paste into your AI coding agent with Ctrl+V');
                    } else {
                        vscode.window.showWarningMessage('AI context saved but no content returned');
                    }
                } catch (err) {
                    vscode.window.showErrorMessage('Failed to send to AI: ' + (err instanceof Error ? err.message : String(err)));
                }
            } else if (msg.command === 'scanComplete' && msg.stats) {
                vscode.commands.executeCommand('simplebeacon.refreshDashboard', msg.stats);
            } else if (msg.command === 'updateReport' && msg.report) {
                vscode.commands.executeCommand('simplebeacon.refreshDashboard', {
                    issues: msg.report.issueCount || 0,
                    critical: msg.report.severityCounts?.critical || 0,
                    high: msg.report.severityCounts?.high || 0,
                    medium: msg.report.severityCounts?.medium || 0,
                    low: msg.report.severityCounts?.low || 0,
                    score: msg.report.qualityScore || 0
                });
            }
        });
    } catch (err) {
        panel.webview.html = `<!DOCTYPE html><html><body style="background:#0f0f1a;color:#ef4444;font-family:sans-serif;text-align:center;padding-top:40vh;">Failed to load preview: ${(err instanceof Error ? err.message : String(err))}</body></html>`;
    }
}

export function deactivate() {
    if (diagnosticsManager) {
        diagnosticsManager.dispose();
    }
}
