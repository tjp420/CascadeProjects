// simplebeacon-ignore memory-leak — real-time pattern matching, short-lived iterations
import * as vscode from 'vscode';
import { existsSync } from 'fs';
import * as http from 'http';
import { getSbConfig } from '../utils';

interface RealtimeIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  suggestion?: string;
  timestamp: Date;
}

interface AISlopPattern {
  regex: RegExp;
  severity: 'error' | 'warning' | 'info';
  confidence?: number;
  type: string;
  message: string;
  suggestion: string;
}

interface FileMonitor {
  filePath: string;
  lastModified: number;
  isBeingEdited: boolean;
  lastCheck: Date;
}

/**
 * Monitors workspace files in real-time for security issues and updates diagnostics.
 */
export class RealtimeMonitor {
  private static instance: RealtimeMonitor;
  private disposables: vscode.Disposable[] = [];
  private fileMonitors: Map<string, FileMonitor> = new Map();
  private activeIssues: Map<string, RealtimeIssue[]> = new Map();
  private diagnosticsCollection: vscode.DiagnosticCollection;
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private aiSlopPatterns: AISlopPattern[] = [];
  private clipboardHistory: string[] = [];

  private getEffectiveMinConfidence(): number {
    const config = getSbConfig();
    const preset = config.get<string>('preset', 'default');
    const threshold = config.get<string>('confidenceThreshold', 'medium');

    const thresholdMap: Record<string, number> = {
      low: 0.4,
      medium: 0.6,
      high: 0.85,
    };

    if (preset === 'low-noise') {
      return 0.85;
    }

    return thresholdMap[threshold] ?? config.get<number>('minConfidence', 0.6);
  }

  private get ollamaUrl(): string {
    return getSbConfig().get<string>('ollamaUrl', 'http://127.0.0.1:11434');
  }
  private readonly maxClipboardHistory = 10;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('SimpleBeacon Real-time Monitor');
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('simplebeacon-ai-slop');
    this.statusBarItem = vscode.window.createStatusBarItem(
      'simplebeacon-realtime-status',
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.show();
    this.initAISlopPatterns();
    this.updateStatus('🔍 Ready', 'Real-time monitoring ready');
  }

  private initAISlopPatterns(): void {
    this.aiSlopPatterns = [
      {
        regex:
          /\b(Here is the implementation|In summary|As an AI|As a language model|I cannot|I apologise|I apologize|As requested|As per your request|Below is the|Please let me know if you need|Feel free to ask|I hope this helps|Let me know if you have any questions)\b/gi,
        severity: 'warning',
        type: 'ai-boilerplate',
        message: 'AI boilerplate text detected in code',
        suggestion: 'Remove conversational AI artifacts from source code',
      },
      {
        regex: /\/\*\*\s*\n(?:\s*\*\s+.+\n){8,}\s*\*\//g,
        severity: 'info',
        type: 'verbose-comment',
        message: 'Excessively verbose comment block',
        suggestion: 'Keep comments concise and meaningful',
      },
      {
        regex:
          /\b(const|let|var)\s+(temp|tmp|result|res|data|dat|item|itm|value|val|obj|object|arr|array|num|number|str|string|bool|boolean|func|function|fn)\d*\s*[:=]/gi,
        severity: 'info',
        type: 'generic-variable',
        message: 'Generic AI-style variable name',
        suggestion: 'Use descriptive, domain-specific variable names',
      },
      {
        regex:
          /(\/\/\s*(This function|This method|This class|This module|This component|This variable|This is used to|This will))\b/gi,
        severity: 'info',
        type: 'repetitive-comment',
        message: 'Repetitive AI-style comment pattern',
        suggestion: 'Write comments that explain why, not what',
      },
      {
        regex: /\/\/\s*TODO[\s:]*.{30,200}/gi,
        severity: 'warning',
        type: 'ai-todo',
        message: 'Overly detailed TODO comment (AI artifact)',
        suggestion: 'Keep TODOs short and actionable',
      },
      {
        regex: /^(\s{4}|\t)\1{3,}\S/gm,
        severity: 'info',
        type: 'uniform-indent',
        message: 'Suspiciously uniform code structure',
        suggestion: 'Refactor repeated patterns into reusable functions',
      },
      {
        regex: /\/\/\s*.+\n.*\/\/\s*.+\n.*\/\/\s*.+/g,
        severity: 'info',
        type: 'comment-spam',
        message: 'Excessive inline comments on consecutive lines',
        suggestion: 'Self-documenting code > comments',
      },
      {
        regex:
          /\b(helper|util|utility|manager|handler|service|factory|provider|controller|middleware)\d*\s*(=|:|\(|<)/gi,
        severity: 'info',
        type: 'generic-naming',
        message: 'Generic suffix pattern common in AI-generated code',
        suggestion: 'Use names that describe the actual behavior',
      },
      {
        regex:
          /\b(processData|handleRequest|manageState|updateUI|renderComponent|fetchData|sendRequest|getData|setData|createItem|deleteItem|updateItem)\s*\(/gi,
        severity: 'info',
        type: 'crud-generic',
        message: 'Generic CRUD function names typical of AI',
        suggestion: 'Use business-domain terminology in function names',
      },
      {
        regex: /^(import\s+.+from\s+['"][^'"]+['"];\n){5,}/gm,
        severity: 'info',
        type: 'import-blocks',
        message: 'Large import block (possibly AI-generated)',
        suggestion: 'Organize imports logically, not by length',
      },
      {
        regex: /function\s+\w+\s*\([^)]{80,}\)/g,
        severity: 'warning',
        type: 'mega-params',
        message: 'Function with excessive parameters',
        suggestion: 'Use an options object or destructure parameters',
      },
      {
        regex: /\/\*\s*\n\s*\*\s+Copyright \(c\)\s+\d{4}\s+\[Your Name\]|\[Company Name\]|\[Author\]/gi,
        severity: 'error',
        type: 'placeholder-copyright',
        message: 'Placeholder copyright header not filled in',
        suggestion: 'Replace placeholder with actual copyright info',
      },
    ];
  }

  static getInstance(): RealtimeMonitor {
    if (!RealtimeMonitor.instance) {
      RealtimeMonitor.instance = new RealtimeMonitor();
    }
    return RealtimeMonitor.instance;
  }

  start(): void {
    if (this.isMonitoring) {
      vscode.window.showInformationMessage('Real-time monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.updateStatus('🟢 Active', 'Real-time monitoring active');
    this.outputChannel.appendLine('🚀 Starting real-time code monitoring...');

    this.setupFileWatchers();
    this.startPeriodicMonitoring();
    this.setupEventListeners();

    vscode.window.showInformationMessage('Real-time monitoring started! 🎯');
  }

  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.updateStatus('⏸️ Paused', 'Real-time monitoring paused');
    this.outputChannel.appendLine('⏸️ Real-time monitoring stopped');

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  private setupFileWatchers(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const changeDisposable = watcher.onDidChange((uri) => this.handleFileChange(uri.fsPath));
    const createDisposable = watcher.onDidCreate((uri) => this.handleFileChange(uri.fsPath));
    this.disposables.push(watcher, changeDisposable, createDisposable);
  }

  private setupEventListeners(): void {
    const textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.isMonitoring) {
        this.handleTextDocumentChange(event);
      }
    });
    const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (this.isMonitoring && editor) {
        this.handleActiveEditorChange(editor);
      }
    });
    this.disposables.push(textDocumentChangeDisposable, activeEditorChangeDisposable);
    this.setupClipboardMonitoring();
  }

  private setupClipboardMonitoring(): void {
    let lastText = '';
    const checkClipboard = () => {
      if (!this.isMonitoring) return;
      Promise.resolve(vscode.env.clipboard.readText())
        .then((text) => {
          if (text && text !== lastText && text.length > 200) {
            lastText = text;
            this.clipboardHistory.unshift(text.slice(0, 500));
            if (this.clipboardHistory.length > this.maxClipboardHistory) this.clipboardHistory.pop();
            const pasteScore = this.scorePasteForAI(text);
            if (pasteScore > 0.6) {
              this.outputChannel.appendLine(
                `📋 Large paste detected (AI score: ${Math.round(pasteScore * 100)}%) — ${text.length} chars`
              );
              Promise.resolve(vscode.window
                .showWarningMessage('Large AI-like paste detected. Review before committing.', 'Review', 'Ignore'))
                .then((choice) => {
                  if (choice === 'Review') {
                    vscode.commands.executeCommand('workbench.action.toggleDevTools');
                  }
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    };
    const interval = setInterval(checkClipboard, 2000);
    this.disposables.push({ dispose: () => clearInterval(interval) } as vscode.Disposable);
  }

  private scorePasteForAI(text: string): number {
    let score = 0;
    const checks = [
      {
        pattern:
          /\b(Here is the|In summary|As an AI|As a language model|I cannot|I apologize|As requested|Below is the|Please let me know if you need|Feel free to ask|I hope this helps)\b/gi,
        weight: 0.3,
      },
      {
        pattern:
          /\b(processData|handleRequest|manageState|updateUI|renderComponent|fetchData|sendRequest|getData|setData|createItem|deleteItem|updateItem)\b/gi,
        weight: 0.2,
      },
      {
        pattern: /\b(helper|util|utility|manager|handler|service|factory|provider|controller|middleware)\d*\b/gi,
        weight: 0.15,
      },
      { pattern: /\n\n\n+/g, weight: 0.1 },
      { pattern: /^(\s{4}|\t)\1{2,}\S/gm, weight: 0.1 },
      {
        pattern:
          /\/\/\s*(This function|This method|This class|This module|This component|This variable|This is used to|This will)/gi,
        weight: 0.15,
      },
    ];
    for (const check of checks) {
      const matches = (text.match(check.pattern) || []).length;
      if (matches > 0) score += check.weight * Math.min(matches, 5);
    }
    return Math.min(score, 1);
  }

  private handleFileChange(filePath: string): void {
    const monitor = this.fileMonitors.get(filePath);
    const now = new Date();
    if (!monitor) {
      this.fileMonitors.set(filePath, { filePath, lastModified: now.getTime(), isBeingEdited: true, lastCheck: now });
    } else {
      monitor.lastModified = now.getTime();
      monitor.isBeingEdited = true;
      monitor.lastCheck = now;
    }
    this.debounceFileAnalysis(filePath);
  }

  private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;
    // Skip non-code windows, output channels, or diff views
    if (document.uri.scheme !== 'file') {
      return;
    }
    this.debounceFileAnalysis(document.uri.fsPath);
  }

  private handleActiveEditorChange(editor: vscode.TextEditor): void {
    if (editor.document) {
      this.debounceFileAnalysis(editor.document.uri.fsPath);
    }
  }

  private debounceFileAnalysis(filePath: string): void {
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      this.analyzeFile(filePath);
      this.debounceTimers.delete(filePath);
    }, 500);
    this.debounceTimers.set(filePath, timer);
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      if (!existsSync(filePath)) {
        return;
      }
      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = Buffer.from(fileContent).toString('utf8');
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';

      const config = getSbConfig();
      const preset = config.get<string>('preset', 'default');

      const issues: RealtimeIssue[] = [];

      if (preset !== 'ai-only') {
        const detectedIssues = await this.detectIssues(filePath, content, fileExtension);
        issues.push(...detectedIssues);
      }

      const aiSlopIssues = this.detectAISlop(filePath, content);
      issues.push(...aiSlopIssues);

      // Entropy / AST checks are stylistic noise — skip them in ai-only and low-noise presets
      if (preset !== 'ai-only' && preset !== 'low-noise') {
        const entropyIssues = this.detectEntropyAnomalies(filePath, content);
        const astIssues = this.detectASTPatterns(filePath, content, fileExtension);
        issues.push(...entropyIssues, ...astIssues);
      }

      // Ollama check on first 2000 chars if suspicious
      if (issues.length >= 3) {
        const snippet = content.slice(0, 2000);
        this.queryOllamaForAI(filePath, snippet)
          .then((ollamaIssues) => {
            if (ollamaIssues.length > 0) {
              this.activeIssues.set(filePath, [...(this.activeIssues.get(filePath) || []), ...ollamaIssues]);
              this.displayIssues(ollamaIssues);
            }
          })
          .catch(() => {});
      }

      if (issues.length > 0) {
        this.activeIssues.set(filePath, issues);
        this.displayIssues(issues);
        this.updateStatusBar(issues.length);
      } else {
        this.activeIssues.delete(filePath);
        this.clearIssues(filePath);
        this.updateStatusBar(0);
      }
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error analyzing ${filePath}: ${error}`);
    }
  }

  private isInsideStringLiteral(line: string, index: number): boolean {
    let inDouble = false, inSingle = false, inTemplate = false, escaped = false;
    for (let i = 0; i < index; i++) {
      const ch = line[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
      else if (ch === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
      else if (ch === '`' && !inDouble && !inSingle) inTemplate = !inTemplate;
    }
    return inDouble || inSingle || inTemplate;
  }

  private async detectIssues(filePath: string, content: string, fileExtension: string): Promise<RealtimeIssue[]> {
    const issues: RealtimeIssue[] = [];
    const lines = content.split('\n');
    const patterns = this.getPatternsForFileType(fileExtension);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      for (const pattern of patterns) {
        let matches: IterableIterator<RegExpMatchArray>;
        try {
          matches = line.matchAll(new RegExp(pattern.regex, 'g'));
        } catch (regexErr) {
          this.outputChannel.appendLine(`⚠️ Invalid regex pattern ${pattern.type}: ${pattern.regex}`);
          continue;
        }
        for (const match of matches) {
          // Skip matches inside string literals for patterns that commonly produce false positives in rule definitions
          if (['eval-usage', 'innerhtml-usage', 'console-log', 'todo-comment'].includes(pattern.type)) {
            if (this.isInsideStringLiteral(line, match.index || 0)) continue;
          }
          // Respect line-above ignore comment
          if (lineNumber > 1 && lines[lineNumber - 2]?.toLowerCase().includes('slop-cop-disable-next-line')) {
            continue;
          }
          const column = match.index ? match.index + 1 : 1;
          issues.push({
            file: filePath,
            line: lineNumber,
            column,
            severity: pattern.severity,
            type: pattern.type,
            message: pattern.message,
            suggestion: pattern.suggestion,
            timestamp: new Date(),
          });
        }
      }
    }

    const fileIssues = await this.detectFileLevelIssues(filePath, content, fileExtension);
    issues.push(...fileIssues);
    return issues;
  }

  private getPatternsForFileType(fileExtension: string): Array<{
    regex: string;
    severity: 'error' | 'warning' | 'info';
    type: string;
    message: string;
    suggestion: string;
  }> {
    const basePatterns = [
      {
        regex: 'password\\s*=\\s*["\'][^"\']+["\']',
        severity: 'error' as const,
        type: 'hardcoded-password',
        message: 'Hardcoded password detected',
        suggestion: 'Use environment variables or configuration files',
      },
      {
        regex: 'api[_-]?key\\s*=\\s*["\'][^"\']+["\']',
        severity: 'error' as const,
        type: 'hardcoded-api-key',
        message: 'Hardcoded API key detected',
        suggestion: 'Use environment variables or secure storage',
      },
      {
        regex: 'token\\s*=\\s*["\'][^"\']+["\']',
        severity: 'error' as const,
        type: 'hardcoded-token',
        message: 'Hardcoded token detected',
        suggestion: 'Use environment variables or secure storage',
      },
      {
        regex: 'console\\.log\\(',
        severity: 'warning' as const,
        type: 'console-log',
        message: 'Console.log statement found',
        suggestion: 'Remove or replace with proper logging',
      },
      {
        regex: 'debug' + 'ger;',
        severity: 'warning' as const,
        type: 'debugger-statement',
        message: 'Debugger statement found',
        suggestion: 'Remove debugger statements before production',
      },
      {
        regex: 'TODO|FIXME|HACK|XXX',
        severity: 'info' as const,
        type: 'todo-comment',
        message: 'TODO/FIXME comment found',
        suggestion: 'Address the TODO or remove the comment',
      },
      {
        regex: 'ev' + 'al\\(',
        severity: 'warning' as const,
        type: 'eval-usage',
        message: 'eval() usage detected',
        suggestion: 'Avoid eval() for security reasons',
      },
      {
        regex: 'innerHTML\\s*=',
        severity: 'warning' as const,
        type: 'innerhtml-usage',
        message: 'innerHTML usage detected',
        suggestion: 'Use safer alternatives like textContent or DOM manipulation',
      },
    ];
    return [...basePatterns, ...this.getTypeSpecificPatterns(fileExtension)];
  }

  private getTypeSpecificPatterns(fileExtension: string): Array<{
    regex: string;
    severity: 'error' | 'warning' | 'info';
    type: string;
    message: string;
    suggestion: string;
  }> {
    switch (fileExtension) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return [
          {
            regex: 'var\\s+\\w+\\s*=',
            severity: 'info' as const,
            type: 'var-declaration',
            message: 'var declaration found',
            suggestion: 'Use let or const instead of var',
          },
          {
            regex: '(?<![=!])==(?!=)\\s*["\'][^"\']+["\']|["\'][^"\']+["\']\\s*(?<![=!])==(?![=])',
            severity: 'warning' as const,
            type: 'equality-comparison',
            message: 'String comparison with == detected',
            suggestion: 'Use === for strict equality comparison',
          },
          {
            regex: 'function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{[^}]*}\\s*\\(',
            severity: 'info' as const,
            type: 'immediately-invoked-function',
            message: 'Immediately invoked function expression',
            suggestion: 'Consider using arrow functions or named functions',
          },
        ];
      case 'json':
        return [
          {
            regex: ',\\s*[,\\s*]',
            severity: 'error' as const,
            type: 'json-trailing-comma',
            message: 'Trailing comma in JSON',
            suggestion: 'Remove trailing comma',
          },
          {
            regex: '"[^"]*"\\s*:\\s*"[^"]*"\\s*[,\\s*]',
            severity: 'warning' as const,
            type: 'json-key-quotes',
            message: 'JSON key should be quoted',
            suggestion: 'Ensure all JSON keys are properly quoted',
          },
        ];
      case 'py':
        return [
          {
            regex: 'print\\(',
            severity: 'warning' as const,
            type: 'print-statement',
            message: 'print statement found',
            suggestion: 'Use logging module instead of print',
          },
          {
            regex: 'except:',
            severity: 'warning' as const,
            type: 'bare-except',
            message: 'Bare except clause',
            suggestion: 'Specify exception types to catch',
          },
        ];
      default:
        return [];
    }
  }

  private async detectFileLevelIssues(
    filePath: string,
    content: string,
    fileExtension: string
  ): Promise<RealtimeIssue[]> {
    const issues: RealtimeIssue[] = [];
    if (content.length > 1000000) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'warning',
        type: 'large-file',
        message: 'Large file detected',
        suggestion: 'Consider splitting large files for better maintainability',
        timestamp: new Date(),
      });
    }
    if (content.trim().length === 0) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'info',
        type: 'empty-file',
        message: 'Empty file detected',
        suggestion: 'Add content or remove the file',
        timestamp: new Date(),
      });
    }
    if (content.includes('\uFFFD')) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'warning',
        type: 'encoding-issue',
        message: 'Character encoding issue detected',
        suggestion: 'Check file encoding and ensure UTF-8',
        timestamp: new Date(),
      });
    }
    return issues;
  }

  private detectAISlop(filePath: string, content: string): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];
    const lines = content.split('\n');
    const minConfidence = this.getEffectiveMinConfidence();
    for (const pattern of this.aiSlopPatterns) {
      if ((pattern.confidence ?? 0) < minConfidence) {
        continue;
      }
      const matches = content.matchAll(pattern.regex);
      for (const match of matches) {
        const matchIndex = match.index ?? 0;
        let lineNumber = 1;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > matchIndex) {
            lineNumber = i + 1;
            break;
          }
        }
        // Respect line-above ignore comment
        if (lineNumber > 1 && lines[lineNumber - 2]?.toLowerCase().includes('slop-cop-disable-next-line')) {
          continue;
        }
        const column = match.index ? match.index - content.lastIndexOf('\n', match.index - 1) - 1 : 1;
        issues.push({
          file: filePath,
          line: lineNumber,
          column: column > 0 ? column : 1,
          severity: pattern.severity,
          type: pattern.type,
          message: pattern.message,
          suggestion: pattern.suggestion,
          timestamp: new Date(),
        });
      }
    }
    return issues;
  }

  private displayIssues(issues: RealtimeIssue[]): void {
    const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
    for (const issue of issues) {
      const fileName = issue.file.split(/[/\\]/).pop() || issue.file;
      const severityIcon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      this.outputChannel.appendLine(`${severityIcon} ${fileName}:${issue.line}:${issue.column} - ${issue.message}`);
      if (issue.suggestion) {
        this.outputChannel.appendLine(`   💡 ${issue.suggestion}`);
      }

      const diagnosticSeverity =
        issue.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : issue.severity === 'warning'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;
      const range = new vscode.Range(
        new vscode.Position(issue.line - 1, issue.column - 1),
        new vscode.Position(issue.line - 1, issue.column + 20)
      );
      const diagnostic = new vscode.Diagnostic(range, `${issue.message} (${issue.type})`, diagnosticSeverity);
      diagnostic.code = 'simplebeacon-ai-slop';
      diagnostic.source = 'SimpleBeacon AI Slop Cop';
      const existing = diagnosticsMap.get(issue.file) || [];
      existing.push(diagnostic);
      diagnosticsMap.set(issue.file, existing);
    }
    for (const [file, fileDiagnostics] of diagnosticsMap) {
      this.diagnosticsCollection.set(vscode.Uri.file(file), fileDiagnostics);
    }
  }

  private detectEntropyAnomalies(filePath: string, content: string): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];
    const lines = content.split('\n');
    if (lines.length < 5) return issues;

    // Indentation uniformity — high variance is human, low variance is AI
    const indents: number[] = [];
    for (const line of lines) {
      const trimmed = line.trimStart();
      if (trimmed.length > 0) indents.push(line.length - trimmed.length);
    }
    if (indents.length > 10) {
      const mean = indents.reduce((a, b) => a + b, 0) / indents.length;
      const variance = indents.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / indents.length;
      if (variance === 0) {
        issues.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'info',
          type: 'uniform-indent-entropy',
          message: 'Zero indentation variance — suspiciously uniform structure',
          suggestion: 'Check for AI-generated boilerplate or copy-pasted code',
          timestamp: new Date(),
        });
      }
    }

    // Comment density — AI often over-comments or under-comments
    const codeLines = lines.filter(
      (l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('#') && !l.trim().startsWith('*')
    );
    const commentLines = lines.filter(
      (l) =>
        l.trim().startsWith('//') || l.trim().startsWith('/*') || l.trim().startsWith('*') || l.trim().startsWith('#')
    );
    const density = codeLines.length > 0 ? commentLines.length / codeLines.length : 0;
    if (density > 0.5) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'info',
        type: 'high-comment-density',
        message: `High comment density (${Math.round(density * 100)}%) — possible AI verbosity`,
        suggestion: 'Trim redundant comments; code should be self-documenting',
        timestamp: new Date(),
      });
    } else if (density === 0 && lines.length > 50) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'info',
        type: 'zero-comment-density',
        message: 'Zero comments in a large file — possible AI under-documentation',
        suggestion: 'Add strategic comments for complex logic',
        timestamp: new Date(),
      });
    }

    // Line length uniformity — AI tends toward uniform line lengths
    const lengths = lines.filter((l) => l.trim().length > 0).map((l) => l.length);
    if (lengths.length > 20) {
      const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const cv = Math.sqrt(lengths.reduce((s, v) => s + Math.pow(v - meanLen, 2), 0) / lengths.length) / meanLen;
      if (cv < 0.15) {
        issues.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'info',
          type: 'uniform-line-length',
          message: 'Suspiciously uniform line lengths — possible AI formatting',
          suggestion: 'Review for boilerplate or auto-generated code',
          timestamp: new Date(),
        });
      }
    }

    return issues;
  }

  private detectASTPatterns(filePath: string, content: string, fileExtension: string): RealtimeIssue[] {
    const issues: RealtimeIssue[] = [];
    if (!['js', 'ts', 'jsx', 'tsx', 'cjs', 'mjs'].includes(fileExtension)) return issues;

    // Lightweight AST-style detection without full parser
    const lines = content.split('\n');
    let functionCount = 0;
    let tryCatchCount = 0;
    let arrowFunctionCount = 0;
    let repetitiveBlocks = 0;
    let lastBlock = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\b(function|async function|const.*=.*function)\b/.test(line)) functionCount++;
      if (/=>\s*\{/.test(line)) arrowFunctionCount++;
      if (/try\s*\{/.test(line)) tryCatchCount++;

      // Detect repetitive try-catch boilerplate
      const blockStart = line.trim().slice(0, 30);
      if (blockStart === lastBlock && blockStart.length > 10) repetitiveBlocks++;
      lastBlock = blockStart;
    }

    if (tryCatchCount > 5) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'warning',
        type: 'excessive-try-catch',
        message: `${tryCatchCount} try-catch blocks — possible AI defensive coding pattern`,
        suggestion: 'Consolidate error handling or use higher-level error boundaries',
        timestamp: new Date(),
      });
    }

    const totalFunctions = functionCount + arrowFunctionCount;
    if (totalFunctions > 0) {
      const ratio = arrowFunctionCount / totalFunctions;
      if (ratio > 0.9 && totalFunctions > 10) {
        issues.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'info',
          type: 'arrow-function-monoculture',
          message: `${Math.round(ratio * 100)}% arrow functions — possible AI style homogenization`,
          suggestion: 'Mix function styles where appropriate for readability',
          timestamp: new Date(),
        });
      }
    }

    if (repetitiveBlocks > 8) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'warning',
        type: 'repetitive-block-structure',
        message: 'Repetitive block structures detected — possible AI copy-paste pattern',
        suggestion: 'Extract common patterns into reusable functions or utilities',
        timestamp: new Date(),
      });
    }

    // Detect excessive chained calls (common in AI-generated data processing)
    const chainMatches = content.match(/\.[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*\.[a-zA-Z_$]/g);
    if (chainMatches && chainMatches.length > 15) {
      issues.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: 'info',
        type: 'excessive-method-chaining',
        message: 'Excessive method chaining — possible AI pipeline pattern',
        suggestion: 'Break long chains into intermediate variables for debugging',
        timestamp: new Date(),
      });
    }

    return issues;
  }

  private async queryOllamaForAI(filePath: string, snippet: string): Promise<RealtimeIssue[]> {
    const issues: RealtimeIssue[] = [];
    try {
      const prompt = `Was this code generated by an AI? Reply ONLY "YES" or "NO".\n\n${snippet.slice(0, 1500)}`;
      const body = JSON.stringify({ model: 'qwen2.5-coder', prompt, stream: false });
      const response = await new Promise<{ response?: string }>((resolve, reject) => {
        const req = http.request(
          `${this.ollamaUrl}/api/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                reject(new Error('Invalid JSON'));
              }
            });
          }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      const text = (response.response || '').toUpperCase();
      if (text.includes('YES')) {
        issues.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'ollama-ai-suspicion',
          message: 'Local LLM flagged this code as likely AI-generated',
          suggestion: 'Review for AI artifacts, boilerplate, or impersonal style',
          timestamp: new Date(),
        });
      }
    } catch {
      // simplebeacon-ignore error-swallowing — Ollama not running, skip
    }
    return issues;
  }

  private clearIssues(filePath: string): void {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    this.outputChannel.appendLine(`✅ ${fileName} - No issues detected`);
    this.diagnosticsCollection.delete(vscode.Uri.file(filePath));
  }

  private updateStatusBar(issueCount: number): void {
    if (issueCount === 0) {
      this.updateStatus('🟢 Clean', 'No issues detected');
    } else if (issueCount <= 5) {
      this.updateStatus('🟡 Minor', `${issueCount} issues detected`);
    } else if (issueCount <= 10) {
      this.updateStatus('🟠 Moderate', `${issueCount} issues detected`);
    } else {
      this.updateStatus('🔴 Critical', `${issueCount} issues detected`);
    }
  }

  private updateStatus(text: string, tooltip: string): void {
    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.show();
  }

  private startPeriodicMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.cleanupOldMonitors();
      }
    }, 30000);
  }

  private cleanupOldMonitors(): void {
    const now = new Date();
    const threshold = 60000;
    for (const [filePath, monitor] of this.fileMonitors.entries()) {
      if (now.getTime() - monitor.lastCheck.getTime() > threshold) {
        this.fileMonitors.delete(filePath);
      }
    }
    if (this.activeIssues.size > 500) {
      const oldest = Array.from(this.activeIssues.entries())
        .sort((a, b) => (a[1][0]?.timestamp.getTime() ?? 0) - (b[1][0]?.timestamp.getTime() ?? 0))
        .slice(0, this.activeIssues.size - 500);
      for (const [key] of oldest) {
        this.activeIssues.delete(key);
      }
    }
  }

  public getMonitoringStatus(): boolean {
    return this.isMonitoring;
  }

  public getActiveIssues(): RealtimeIssue[] {
    const allIssues: RealtimeIssue[] = [];
    for (const issues of this.activeIssues.values()) {
      allIssues.push(...issues);
    }
    return allIssues.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public dispose(): void {
    this.stop();
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
  }
}
