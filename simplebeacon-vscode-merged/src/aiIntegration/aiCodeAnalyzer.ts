import * as vscode from 'vscode';
import * as path from 'path';
import { designTokens } from '../designSystem';

export interface CodeIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  suggestion?: string;
  autoFixable: boolean;
  fixCode?: string;
  confidence: number;
  context?: string;
}

export interface CodeAnalysis {
  issues: CodeIssue[];
  metrics: {
    totalIssues: number;
    criticalIssues: number;
    autoFixableIssues: number;
    codeQuality: number;
    securityScore: number;
    maintainability: number;
  };
  recommendations: string[];
  patterns: string[];
}

export interface AIFixResult {
  success: boolean;
  fixedIssues: CodeIssue[];
  appliedFixes: string[];
  errors?: string[];
}

/**
 * AI-powered code analyzer that identifies issues and suggests automated fixes.
 */
export class AICodeAnalyzer {
  private static instance: AICodeAnalyzer;
  private outputChannel: vscode.OutputChannel;
  private isAnalyzing: boolean = false;
  private analysisHistory: CodeAnalysis[] = [];

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('SimpleBeacon AI Code Analyzer');
  }

  static getInstance(): AICodeAnalyzer {
    if (!AICodeAnalyzer.instance) {
      AICodeAnalyzer.instance = new AICodeAnalyzer();
    }
    return AICodeAnalyzer.instance;
  }

  async analyzeCode(document: vscode.TextDocument): Promise<CodeAnalysis> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    const startTime = Date.now();

    try {
      const content = document.getText();
      const filePath = document.uri.fsPath;
      const language = this.detectLanguage(filePath);

      this.outputChannel.appendLine(`🔍 Analyzing ${path.basename(filePath)} (${language})...`);

      // Perform AI-powered analysis
      const analysis = await this.performAIAnalysis(content, filePath, language);

      // Calculate metrics
      analysis.metrics = this.calculateMetrics(analysis.issues);

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis.issues);

      // Detect patterns
      analysis.patterns = this.detectPatterns(analysis.issues);

      this.outputChannel.appendLine(`✅ Analysis complete in ${Date.now() - startTime}ms`);
      this.outputChannel.appendLine(
        `📊 Found ${analysis.issues.length} issues (${analysis.metrics.autoFixableIssues} auto-fixable)`
      );

      this.analysisHistory.push(analysis);
      return analysis;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Analysis failed: ${error}`);
      throw error;
    } finally {
      this.isAnalyzing = false;
    }
  }

  async autoFixIssues(document: vscode.TextDocument, issues: CodeIssue[]): Promise<AIFixResult> {
    const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspace) {
      throw new Error('No workspace folder found');
    }

    this.outputChannel.appendLine(`🔧 Auto-fixing ${issues.length} issues in ${path.basename(document.uri.fsPath)}...`);

    const fixableIssues = issues.filter((issue) => issue.autoFixable);
    const appliedFixes: string[] = [];
    const fixedIssues: CodeIssue[] = [];

    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== document) {
        throw new Error('Document not active in editor');
      }

      for (const issue of fixableIssues) {
        try {
          const fixResult = await this.applyFix(editor, issue);
          if (fixResult.success) {
            appliedFixes.push(fixResult.message);
            fixedIssues.push(issue);
            this.outputChannel.appendLine(`✅ Fixed: ${issue.message} at line ${issue.line}`);
          } else {
            this.outputChannel.appendLine(`❌ Failed to fix: ${issue.message} - ${fixResult.error}`);
          }
        } catch (error) {
          this.outputChannel.appendLine(`❌ Error fixing ${issue.message}: ${error}`);
        }
      }

      this.outputChannel.appendLine(`🎉 Auto-fix complete: ${fixedIssues.length}/${fixableIssues.length} issues fixed`);

      return {
        success: true,
        fixedIssues,
        appliedFixes,
      };
    } catch (error) {
      this.outputChannel.appendLine(`❌ Auto-fix failed: ${error}`);
      return {
        success: false,
        fixedIssues: [],
        appliedFixes: [],
        errors: [String(error)],
      };
    }
  }

  private async performAIAnalysis(content: string, filePath: string, language: string): Promise<CodeAnalysis> {
    // Simulate AI analysis with context-aware detection
    const issues = await this.detectIssues(content, filePath, language);

    return {
      issues,
      metrics: { totalIssues: 0, criticalIssues: 0, autoFixableIssues: 0, codeQuality: 0, securityScore: 0, maintainability: 0 },
      recommendations: [],
      patterns: [],
    };
  }

  private async detectIssues(content: string, filePath: string, language: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Security issues
      if (this.detectHardcodedSecrets(line)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: this.findPosition(line, /password|api[_-]?key|token|secret/i),
          severity: 'error' as const,
          type: 'hardcoded-secret',
          message: 'Hardcoded secret detected',
          suggestion: 'Use environment variables or secure storage',
          autoFixable: true,
          fixCode: this.generateSecretFix(line),
          confidence: 0.9,
          context: line.trim(),
        });
      }

      // Code quality issues
      if (this.detectConsoleLog(line, language)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: this.findPosition(line, /console\.log|print\(/),
          severity: 'warning' as const,
          type: 'console-log',
          message: 'Console log statement found',
          suggestion: 'Use proper logging framework',
          autoFixable: true,
          fixCode: this.generateLoggingFix(line, language),
          confidence: 0.8,
          context: line.trim(),
        });
      }

      // Performance issues
      if (this.detectPerformanceAntiPattern(line, language)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: this.findPosition(line, /for.*in.*object|eval\(/),
          severity: 'warning' as const,
          type: 'performance-anti-pattern',
          message: 'Performance anti-pattern detected',
          suggestion: 'Use more efficient alternatives',
          autoFixable: true,
          fixCode: this.generatePerformanceFix(line, language),
          confidence: 0.7,
          context: line.trim(),
        });
      }

      // Code style issues
      if (this.detectStyleViolation(line, language)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: this.findPosition(line, /var\s+\w+\s*=|==\s*["']/),
          severity: 'info' as const,
          type: 'style-violation',
          message: 'Code style violation',
          suggestion: 'Follow coding standards',
          autoFixable: true,
          fixCode: this.generateStyleFix(line, language),
          confidence: 0.6,
          context: line.trim(),
        });
      }
    }

    return issues;
  }

  private detectHardcodedSecrets(line: string): boolean {
    const patterns = [
      /password\s*=\s*["'][^"']+["']/i,
      /api[_-]?key\s*=\s*["'][^"']+["']/i,
      /token\s*=\s*["'][^"']+["']/i,
      /secret\s*=\s*["'][^"']+["']/i,
      /credential\s*=\s*["'][^"']+["']/i,
    ];
    return patterns.some((pattern) => pattern.test(line));
  }

  private detectConsoleLog(line: string, language: string): boolean {
    if (language === 'javascript' || language === 'typescript') {
      return /console\.log\(/.test(line);
    } else if (language === 'python') {
      return /print\s*\(/.test(line);
    }
    return false;
  }

  private detectPerformanceAntiPattern(line: string, language: string): boolean {
    const patterns = {
      javascript: [/for\s+\w+\s+in\s+Object/, /eval\s*\(/],
      python: [/for\s+\w+\s+in\s+dict\.keys\(\)/],
      java: [/for\s+\w+\s*:\s*\w+\.keySet\(\)/],
    };
    return patterns[language as keyof typeof patterns]?.some((pattern) => pattern.test(line)) || false;
  }

  private detectStyleViolation(line: string, language: string): boolean {
    const patterns = {
      javascript: [/var\s+\w+\s*=/, /==\s*["']/],
      python: [/==\s*None/, /len\s*\(/],
      java: [/System\.out\.println/],
    };
    return patterns[language as keyof typeof patterns]?.some((pattern) => pattern.test(line)) || false;
  }

  private findPosition(line: string, pattern: RegExp): number {
    const match = line.match(pattern);
    return match ? match.index! + 1 : 1;
  }

  private generateSecretFix(line: string): string {
    // Replace hardcoded secrets with environment variables
    return line.replace(/(password|api[_-]?key|token|secret)\s*=\s*["'][^"']+["']/gi, (match, secretType) => {
      const envVar = secretType.toUpperCase().replace(/[-_]/g, '_');
      return `${secretType} = process.env.${envVar}`;
    });
  }

  private generateLoggingFix(line: string, language: string): string {
    if (language === 'javascript' || language === 'typescript') {
      return line.replace(/console\.log\((.*)\)/, 'logger.info($1)');
    } else if (language === 'python') {
      return line.replace(/print\((.*)\)/, 'logging.info($1)');
    }
    return line;
  }

  private generatePerformanceFix(line: string, language: string): string {
    if (language === 'javascript' && /for\s+\w+\s+in\s+Object/.test(line)) {
      return line.replace(/for\s+(\w+)\s+in\s+(\w+)/, 'for (const key of Object.keys($2))');
    }
    return line;
  }

  private generateStyleFix(line: string, language: string): string {
    if (language === 'javascript' && /var\s+\w+\s*=/.test(line)) {
      return line.replace(/var\s+(\w+)\s*=/, 'const $1 =');
    }
    return line;
  }

  private calculateMetrics(issues: CodeIssue[]) {
    const totalIssues = issues.length;
    const criticalIssues = issues.filter((i) => i.severity === 'error').length;
    const autoFixableIssues = issues.filter((i) => i.autoFixable).length;

    const codeQuality = Math.max(0, 100 - totalIssues * 2 - criticalIssues * 10);
    const securityScore = Math.max(0, 100 - issues.filter((i) => i.type.includes('secret')).length * 15);
    const maintainability = Math.max(0, 100 - issues.filter((i) => i.severity === 'warning').length * 3);

    return {
      totalIssues,
      criticalIssues,
      autoFixableIssues,
      codeQuality,
      securityScore,
      maintainability,
    };
  }

  private generateRecommendations(issues: CodeIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((i) => i.type === 'hardcoded-secret')) {
      recommendations.push('🔐 Store secrets in environment variables or secure storage');
    }

    if (issues.some((i) => i.type === 'console-log')) {
      recommendations.push('📝 Use proper logging framework instead of console.log');
    }

    if (issues.some((i) => i.type === 'performance-anti-pattern')) {
      recommendations.push('⚡ Optimize code for better performance');
    }

    if (issues.some((i) => i.severity === 'error')) {
      recommendations.push('🚨 Fix critical issues before deploying to production');
    }

    return recommendations;
  }

  private detectPatterns(issues: CodeIssue[]): string[] {
    const patterns: string[] = [];

    const typeCounts = issues.reduce(
      (acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count >= 3) {
        patterns.push(`🔄 ${type}: ${count} occurrences`);
      }
    });

    return patterns;
  }

  private async applyFix(
    editor: vscode.TextEditor,
    issue: CodeIssue
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const document = editor.document;
      const line = document.lineAt(issue.line - 1);

      if (!issue.fixCode) {
        return { success: false, message: 'No fix available', error: 'No auto-fix available for this issue' };
      }

      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(issue.line - 1, 0, issue.line - 1, line.text.length);
      const textEdit = new vscode.TextEdit(range, issue.fixCode);

      edit.set(document.uri, [textEdit]);

      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        return { success: true, message: `Fixed ${issue.type} at line ${issue.line}` };
      } else {
        return { success: false, message: 'Failed to apply fix', error: 'Edit application failed' };
      }
    } catch (error) {
      return { success: false, message: 'Fix failed', error: String(error) };
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
    };

    return languageMap[ext] || 'unknown';
  }

  public getAnalysisHistory(): CodeAnalysis[] {
    return [...this.analysisHistory];
  }

  public clearHistory(): void {
    this.analysisHistory = [];
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
