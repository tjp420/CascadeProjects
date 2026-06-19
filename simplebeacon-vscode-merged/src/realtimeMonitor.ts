import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

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
  private onLiveFindingsCallback?: (issues: RealtimeIssue[]) => void;
  private aiSessionActive: boolean = false;
  private aiSessionTimer: NodeJS.Timeout | null = null;
  private aiEditedFiles: Set<string> = new Set();
  private onAiSessionEndCallback?: (files: string[]) => void;

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
      // AI boilerplate signatures
      {
        regex:
          /\b(Here is the implementation|In summary|As an AI|As a language model|I cannot|I apologise|I apologize|As requested|As per your request|Below is the|Please let me know if you need|Feel free to ask|I hope this helps|Let me know if you have any questions)\b/gi,
        severity: 'warning',
        type: 'ai-boilerplate',
        message: 'AI boilerplate text detected in code',
        suggestion: 'Remove conversational AI artifacts from source code',
      },
      // Overly verbose comments (common AI trait)
      {
        regex: /\/\*\*\s*\n(?:\s*\*\s+.+\n){8,}\s*\*\//g,
        severity: 'info',
        type: 'verbose-comment',
        message: 'Excessively verbose comment block',
        suggestion: 'Keep comments concise and meaningful',
      },
      // Generic variable names (AI often uses temp, result, data)
      {
        regex:
          /\b(const|let|var)\s+(temp|tmp|result|res|data|dat|item|itm|value|val|obj|object|arr|array|num|number|str|string|bool|boolean|func|function|fn)\d*\s*[:=]/gi,
        severity: 'info',
        type: 'generic-variable',
        message: 'Generic AI-style variable name',
        suggestion: 'Use descriptive, domain-specific variable names',
      },
      // Repetitive comment starters
      {
        regex:
          /(\/\/\s*(This function|This method|This class|This module|This component|This variable|This is used to|This will))\b/gi,
        severity: 'info',
        type: 'repetitive-comment',
        message: 'Repetitive AI-style comment pattern',
        suggestion: 'Write comments that explain why, not what',
      },
      // TODO with overly detailed explanation
      {
        regex: /\/\/\s*TODO[\s:]*.{30,200}/gi,
        severity: 'warning',
        type: 'ai-todo',
        message: 'Overly detailed TODO comment (AI artifact)',
        suggestion: 'Keep TODOs short and actionable',
      },
      // Perfectly uniform indentation after generation
      {
        regex: /^(\s{4}|\t)\1{3,}\S/gm,
        severity: 'info',
        type: 'uniform-indent',
        message: 'Suspiciously uniform code structure',
        suggestion: 'Refactor repeated patterns into reusable functions',
      },
      // Excessive inline comments
      {
        regex: /\/\/\s*.+\n.*\/\/\s*.+\n.*\/\/\s*.+/g,
        severity: 'info',
        type: 'comment-spam',
        message: 'Excessive inline comments on consecutive lines',
        suggestion: 'Self-documenting code > comments',
      },
      // Common AI code patterns
      {
        regex:
          /\b(helper|util|utility|manager|handler|service|factory|provider|controller|middleware)\d*\s*(=|:|\(|<)/gi,
        severity: 'info',
        type: 'generic-naming',
        message: 'Generic suffix pattern common in AI-generated code',
        suggestion: 'Use names that describe the actual behavior',
      },
      // Code with no domain-specific terms
      {
        regex:
          /\b(processData|handleRequest|manageState|updateUI|renderComponent|fetchData|sendRequest|getData|setData|createItem|deleteItem|updateItem)\s*\(/gi,
        severity: 'info',
        type: 'crud-generic',
        message: 'Generic CRUD function names typical of AI',
        suggestion: 'Use business-domain terminology in function names',
      },
      // Imports grouped by length (common AI formatting)
      {
        regex: /^(import\s+.+from\s+['"][^'"]+['"];\n){5,}/gm,
        severity: 'info',
        type: 'import-blocks',
        message: 'Large import block (possibly AI-generated)',
        suggestion: 'Organize imports logically, not by length',
      },
      // Function with >10 parameters (AI often generates verbose functions)
      {
        regex: /function\s+\w+\s*\([^)]{80,}\)/g,
        severity: 'warning',
        type: 'mega-params',
        message: 'Function with excessive parameters',
        suggestion: 'Use an options object or destructure parameters',
      },
      // Copyright or license headers that look AI-generated
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

    // Set up file system watchers
    this.setupFileWatchers();

    // Start periodic monitoring
    this.startPeriodicMonitoring();

    // Set up event listeners
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

    // Clear all disposables
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    // Clear timers
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  private setupFileWatchers(): void {
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const monitorDir = config.get<string>('realtimeMonitorDirectory', '');
    const pattern = monitorDir ? `${monitorDir}/**/*` : '**/*';

    this.outputChannel.appendLine(`[Realtime] Watching pattern: ${pattern}`);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const changeDisposable = watcher.onDidChange((uri) => this.handleFileChange(uri.fsPath));
    const createDisposable = watcher.onDidCreate((uri) => this.handleFileChange(uri.fsPath));
    this.disposables.push(watcher, changeDisposable, createDisposable);
  }

  private setupEventListeners(): void {
    // Listen for text document changes
    const textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.isMonitoring) {
        this.handleTextDocumentChange(event);
      }
    });

    // Listen for active editor changes
    const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (this.isMonitoring && editor) {
        this.handleActiveEditorChange(editor);
      }
    });

    this.disposables.push(textDocumentChangeDisposable, activeEditorChangeDisposable);
  }

  private handleFileChange(filePath: string): void {
    const monitor = this.fileMonitors.get(filePath);
    const now = new Date();

    if (!monitor) {
      this.fileMonitors.set(filePath, {
        filePath,
        lastModified: now.getTime(),
        isBeingEdited: true,
        lastCheck: now,
      });
    } else {
      monitor.lastModified = now.getTime();
      monitor.isBeingEdited = true;
      monitor.lastCheck = now;
    }

    // Track AI editing session - rapid file changes indicate AI is writing
    this.trackAiSession(filePath);

    // Debounce the analysis
    this.debounceFileAnalysis(filePath);
  }

  private trackAiSession(filePath: string): void {
    this.aiEditedFiles.add(filePath);

    // If not already in AI session, start one
    if (!this.aiSessionActive) {
      this.aiSessionActive = true;
      this.outputChannel.appendLine(`[AI Session] AI editing session started`);
      this.updateStatus('🤖 AI Editing...', 'AI is actively editing files');
    }

    // Clear existing session end timer
    if (this.aiSessionTimer) {
      clearTimeout(this.aiSessionTimer);
    }

    // Set timer to detect end of AI session (5 seconds of no changes)
    this.aiSessionTimer = setTimeout(() => {
      this.endAiSession();
    }, 5000);
  }

  private endAiSession(): void {
    if (!this.aiSessionActive) return;

    const files = Array.from(this.aiEditedFiles);
    this.aiSessionActive = false;
    this.aiEditedFiles.clear();
    this.outputChannel.appendLine(`[AI Session] AI editing session ended — ${files.length} files modified`);
    this.updateStatus('🟢 Active', 'Real-time monitoring active');

    // Trigger analysis of all modified files
    if (files.length > 0) {
      this.outputChannel.appendLine(`[AI Session] Analyzing ${files.length} modified files...`);
      for (const file of files) {
        this.analyzeFile(file);
      }
      // Notify listeners that AI session ended with modified files
      this.onAiSessionEndCallback?.(files);
    }
  }

  public onAiSessionEnd(callback: (files: string[]) => void): void {
    this.onAiSessionEndCallback = callback;
  }

  public isAiSessionActive(): boolean {
    return this.aiSessionActive;
  }

  public getAiEditedFiles(): string[] {
    return Array.from(this.aiEditedFiles);
  }

  private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const filePath = event.document.uri.fsPath;
    this.debounceFileAnalysis(filePath);
  }

  private handleActiveEditorChange(editor: vscode.TextEditor): void {
    if (editor.document) {
      this.debounceFileAnalysis(editor.document.uri.fsPath);
    }
  }

  private debounceFileAnalysis(filePath: string): void {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer (debounce for 1 second)
    const timer = setTimeout(() => {
      this.analyzeFile(filePath);
      this.debounceTimers.delete(filePath);
    }, 1000);

    this.debounceTimers.set(filePath, timer);
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      if (!existsSync(filePath)) {
        return;
      }

      // Skip generated, cache, and build artifact directories
      const normalizedPath = filePath.replace(/\\/g, '/');
      const skipPatterns = [
        /[\\/]\.simplebeacon[\\/]/i,
        /[\\/]node_modules[\\/]/i,
        /[\\/]\.git[\\/]/i,
        /[\\/]\.github[\\/]/i,
        /[\\/]dist[\\/]/i,
        /[\\/]build[\\/]/i,
        /[\\/]\.next[\\/]/i,
        /[\\/]out[\\/]/i,
        /[\\/]coverage[\\/]/i,
        /[\\/]\.vscode-test[\\/]/i,
        /[\\/]vscode-extension[\\/]out[\\/]/i,
        /\.map$/i,
        /[\\/]\.simplebeaconignore$/i,
      ];
      if (skipPatterns.some((pat) => pat.test(normalizedPath))) {
        return;
      }

      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = Buffer.from(fileContent).toString('utf8');

      // Detect file type
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';

      // Run appropriate analysis based on file type
      const issues = await this.detectIssues(filePath, content, fileExtension);

      // Run AI slop detection on all text/code files
      const aiSlopIssues = this.detectAISlop(filePath, content);
      issues.push(...aiSlopIssues);

      if (issues.length > 0) {
        this.activeIssues.set(filePath, issues);
        this.displayIssues(issues);
        this.updateStatusBar(issues.length);
        this.onLiveFindingsCallback?.(issues);
      } else {
        this.activeIssues.delete(filePath);
        this.clearIssues(filePath);
        this.updateStatusBar(0);
      }
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error analyzing ${filePath}: ${error}`);
    }
  }

  private async detectIssues(filePath: string, content: string, fileExtension: string): Promise<RealtimeIssue[]> {
    const issues: RealtimeIssue[] = [];
    const lines = content.split('\n');

    // Common issue patterns
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

    // Add file-level checks
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
      // Security issues
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
      // Code quality issues
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
      // Potential issues
      {
        // SECURITY RULE: detects dynamic code execution in scanned code
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

    // File type specific patterns
    const typeSpecificPatterns = this.getTypeSpecificPatterns(fileExtension);

    return [...basePatterns, ...typeSpecificPatterns];
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
            regex: '==\\s*["\'][^"\']+["\']|["\'][^"\']+["\']\\s*==',
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

    // Check file size
    if (content.length > 1000000) {
      // 1MB
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

    // Check for empty files
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

    // Check for encoding issues
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

    for (const pattern of this.aiSlopPatterns) {
      const matches = content.matchAll(pattern.regex);
      for (const match of matches) {
        // Find the line number for this match
        const matchIndex = match.index ?? 0;
        let lineNumber = 1;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1; // +1 for newline
          if (charCount > matchIndex) {
            lineNumber = i + 1;
            break;
          }
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

      // Build diagnostics for Problems panel
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

    // Publish to Problems panel
    for (const [file, fileDiagnostics] of diagnosticsMap) {
      this.diagnosticsCollection.set(vscode.Uri.file(file), fileDiagnostics);
    }
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
    }, 30000); // Every 30 seconds
  }

  private cleanupOldMonitors(): void {
    const now = new Date();
    const threshold = 60000; // 1 minute

    for (const [filePath, monitor] of this.fileMonitors.entries()) {
      if (now.getTime() - monitor.lastCheck.getTime() > threshold) {
        this.fileMonitors.delete(filePath);
      }
    }

    // Cap activeIssues map to prevent unbounded growth
    if (this.activeIssues.size > 500) {
      const oldest = Array.from(this.activeIssues.entries())
        .sort((a, b) => a[1][0]?.timestamp.getTime() - b[1][0]?.timestamp.getTime())
        .slice(0, this.activeIssues.size - 500);
      for (const [key] of oldest) {
        this.activeIssues.delete(key);
      }
    }
  }

  public onLiveFindings(callback: (issues: RealtimeIssue[]) => void): void {
    this.onLiveFindingsCallback = callback;
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
