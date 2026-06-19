import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getFixForFinding } from './fixes/fixRegistry';

// Loose input shape that covers both CLI report and ScanResult formats
interface AnalysisInput {
  rawIssues?: any[];
  detectedIssues?: any[];
  findings?: any[];
  totalFiles?: number;
  filesAnalyzed?: number;
  patterns?: any[];
  dependencies?: any[];
  categories?: Record<string, any[]>;
  repositoryInventory?: { filePaths?: string[]; allFiles?: string[] };
  projectRoot?: string;
}

// Code Map Visualization Provider
/**
 * Provider for the code map visualization webview panel.
 */
export class CodeMapProvider {
  private static instance: CodeMapProvider;
  private webviewPanel: vscode.WebviewPanel | undefined;
  private analysisData: AnalysisInput | null = null;
  private extensionUri: vscode.Uri | undefined;

  static getInstance(): CodeMapProvider {
    if (!CodeMapProvider.instance) {
      CodeMapProvider.instance = new CodeMapProvider();
    }
    return CodeMapProvider.instance;
  }

  showCodeMap(analysisData: AnalysisInput, context: vscode.ExtensionContext) {
    this.analysisData = analysisData;

    if (this.webviewPanel) {
      this.webviewPanel.reveal();
      this.updateWebview();
      return;
    }

    this.extensionUri = context.extensionUri;
    this.webviewPanel = vscode.window.createWebviewPanel('codeMap', 'Code Map Visualization', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri, vscode.Uri.joinPath(context.extensionUri, 'media')],
    });

    this.webviewPanel.webview.html = this.getWebviewContent(this.webviewPanel.webview);

    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = undefined;
    });

    // Handle messages from webview
    this.webviewPanel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), undefined);
  }

  updateData(analysisData: AnalysisInput) {
    this.analysisData = analysisData;
    this.updateWebview();
  }

  private handleWebviewMessage(message: { command: string; format?: string; filters?: unknown; filePath?: string; line?: number }) {
    switch (message.command) {
      case 'requestData':
        this.updateWebview();
        break;
      case 'exportMap':
        this.exportCodeMap(message.format || 'json');
        break;
      case 'filterData':
        this.filterData(message.filters);
        break;
      case 'openFile':
        if (message.filePath) {
          const docUri = vscode.Uri.file(message.filePath);
          vscode.workspace.openTextDocument(docUri).then(doc => {
            vscode.window.showTextDocument(doc).then(editor => {
              if (message.line && message.line > 0) {
                const position = new vscode.Position(message.line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
              }
            }, () => {});
          }, () => {});
        }
        break;
    }
  }

  private updateWebview() {
    if (this.webviewPanel && this.analysisData) {
      this.webviewPanel.webview.postMessage({
        command: 'updateData',
        data: this.processAnalysisData(this.analysisData),
      });
    }
  }

  private processAnalysisData(rawData: AnalysisInput): CodeMapData {
    const files = this.extractFiles(rawData);
    const dependencies = this.extractDependencies(rawData);
    const patterns = this.extractPatterns(rawData);
    const issues = this.extractIssues(rawData);

    return {
      files,
      dependencies,
      patterns,
      issues,
      metrics: this.calculateMetrics(files, dependencies, patterns, issues),
      layout: this.generateLayout(files, dependencies),
    };
  }

  private extractFiles(data: AnalysisInput): CodeMapFile[] {
    const fileMap = new Map<string, CodeMapFile>();

    // 1. Flatten detectedIssues → individual findings → file entries
    const detectedIssues = data.detectedIssues || [];
    for (const category of detectedIssues) {
      // Handle nested category.findings array (workspace analyzer format)
      const catFindings = category.findings || [];
      for (const finding of catFindings) {
        const filePath = finding.file || finding.filePath || finding.path || 'unknown';
        if (!filePath || filePath === 'unknown') continue;
        if (!fileMap.has(filePath)) {
          const stats = this.readFileStats(filePath);
          fileMap.set(filePath, {
            id: filePath,
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            lines: stats.lines,
            language: this.detectLanguage(filePath),
            complexity: stats.lines,
            issues: [],
            patterns: [],
            metrics: {},
          });
        }
        fileMap.get(filePath)!.issues.push({
          id: finding.type + '-' + (finding.matches?.[0]?.line || 0),
          severity: finding.dynamicSeverity || category.severity || 'low',
          type: finding.type || category.type || 'Unknown',
          file: filePath,
          line: finding.matches?.[0]?.line || 0,
          description: finding.matches?.[0]?.snippet || category.message || '',
          category: category.type || 'Unknown',
        } as CodeMapIssue);
      }
      // Also handle flat detectedIssues format (CLI report)
      if (!catFindings.length && (category.file || category.filePath || category.path || category.affectedFiles)) {
        const filePaths = category.affectedFiles || [category.file || category.filePath || category.path || 'unknown'];
        for (const filePath of filePaths) {
          if (!filePath || filePath === 'unknown') continue;
          if (!fileMap.has(filePath)) {
            const stats = this.readFileStats(filePath);
            fileMap.set(filePath, {
              id: filePath,
              name: path.basename(filePath),
              path: filePath,
              size: stats.size,
              lines: stats.lines,
              language: this.detectLanguage(filePath),
              complexity: stats.lines,
              issues: [],
              patterns: [],
              metrics: {},
            });
          }
          fileMap.get(filePath)!.issues.push({
            id: (category.type || 'issue') + '-' + (category.line || 0),
            severity: category.severity || 'low',
            type: category.type || 'Unknown',
            file: filePath,
            line: category.line || 0,
            description: category.description || category.message || '',
            category: category.type || 'Unknown',
          } as CodeMapIssue);
        }
      }
      // Also handle category-level filePath array
      const catFiles = Array.isArray(category.filePath) ? category.filePath : [category.filePath].filter(Boolean);
      for (const filePath of catFiles) {
        if (!filePath || fileMap.has(filePath)) continue;
        const stats = this.readFileStats(filePath);
        fileMap.set(filePath, {
          id: filePath,
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          lines: stats.lines,
          language: this.detectLanguage(filePath),
          complexity: stats.lines,
          issues: [],
          patterns: [],
          metrics: {},
        });
      }
    }

    // 2. Legacy rawIssues / findings format (flat CLI report)
    const rawIssues = data.rawIssues || data.findings || [];
    for (const issue of rawIssues) {
      const filePath = issue.file || issue.filePath || issue.path || issue.affectedFiles?.[0] || 'unknown';
      if (!filePath || filePath === 'unknown') continue;
      if (!fileMap.has(filePath)) {
        const stats = this.readFileStats(filePath);
        fileMap.set(filePath, {
          id: filePath,
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          lines: stats.lines,
          language: this.detectLanguage(filePath),
          complexity: stats.lines,
          issues: [],
          patterns: [],
          metrics: {},
        });
      }
      fileMap.get(filePath)!.issues.push(issue);
    }

    // 3. Repository inventory files
    const inventory = data.repositoryInventory;
    if (inventory?.allFiles && Array.isArray(inventory.allFiles)) {
      for (const filePath of inventory.allFiles) {
        if (!filePath || fileMap.has(filePath)) continue;
        const stats = this.readFileStats(filePath);
        fileMap.set(filePath, {
          id: filePath,
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          lines: stats.lines,
          language: this.detectLanguage(filePath),
          complexity: stats.lines,
          issues: [],
          patterns: [],
          metrics: {},
        });
      }
    }

    // 4. Fallback placeholder
    if (fileMap.size === 0 && data.totalFiles) {
      fileMap.set('root', {
        id: 'root',
        name: 'Project Root',
        path: data.projectRoot || 'project',
        size: 0,
        lines: 0,
        language: 'mixed',
        complexity: 0,
        issues: [],
        patterns: [],
        metrics: { totalFiles: data.totalFiles, filesAnalyzed: data.filesAnalyzed || 0 },
      });
    }

    return Array.from(fileMap.values());
  }

  private readFileStats(filePath: string): { size: number; lines: number } {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return { size: content.length, lines: content.split('\n').length };
      }
    } catch {
      // ignore
    }
    return { size: 0, lines: 0 };
  }

  private extractDependencies(data: AnalysisInput): CodeMapDependency[] {
    const dependencies: CodeMapDependency[] = [];
    const seenPaths = new Set<string>();
    const files = data.rawIssues || data.detectedIssues || data.findings || [];
    for (const issue of files) {
      const fp = issue.file || issue.filePath || issue.path;
      if (fp) seenPaths.add(fp);
    }
    const pathList = Array.from(seenPaths);
    const pathToDir = new Map<string, string>();
    for (const fp of pathList) {
      pathToDir.set(path.basename(fp), path.dirname(fp));
    }

    // Parse imports from file content for real dependencies
    for (const fp of pathList) {
      try {
        if (!fs.existsSync(fp)) continue;
        const content = fs.readFileSync(fp, 'utf8');
        const lang = this.detectLanguage(fp);
        const imports = this.parseImports(content, lang);
        for (const imp of imports) {
          // Resolve relative imports to absolute paths
          let target = imp;
          if (imp.startsWith('.')) {
            target = path.resolve(path.dirname(fp), imp);
            // Try common extensions
            const exts = ['', '.js', '.ts', '.jsx', '.tsx', '.json', '/index.js', '/index.ts'];
            for (const ext of exts) {
              if (fs.existsSync(target + ext)) { target = target + ext; break; }
            }
          } else if (!imp.startsWith('/')) {
            // Check if it matches another file by basename
            const base = imp.replace(/^\.\/|^\.\.\//, '').replace(/\/$/, '');
            for (const [name, dir] of pathToDir) {
              if (name === base || name.replace(/\.\w+$/, '') === base) {
                target = path.join(dir, name);
                break;
              }
            }
          }
          if (target !== fp && (fs.existsSync(target) || pathToDir.has(path.basename(target)))) {
            dependencies.push({ from: fp, to: target, type: 'import', strength: 0.9 });
          }
        }
      } catch {
        // ignore
      }
    }

    return dependencies;
  }

  private parseImports(content: string, lang: string): string[] {
    const imports: string[] = [];
    if (lang === 'javascript' || lang === 'typescript' || lang === 'jsx' || lang === 'tsx') {
      // ES6 imports
      const es6 = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g);
      for (const m of es6) imports.push(m[1]);
      // CommonJS requires
      const cjs = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const m of cjs) imports.push(m[1]);
    } else if (lang === 'python') {
      const py = content.matchAll(/^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm);
      for (const m of py) imports.push(m[1] || m[2]);
    } else if (lang === 'java' || lang === 'kotlin') {
      const j = content.matchAll(/^import\s+([\w.]+);/gm);
      for (const m of j) imports.push(m[1]);
    }
    return imports;
  }

  private extractPatterns(data: AnalysisInput): CodeMapPattern[] {
    const patterns: CodeMapPattern[] = [];

    if (data.patterns) {
      for (const pattern of data.patterns) {
        patterns.push({
          id: pattern.id || pattern.type,
          type: pattern.type || pattern.category,
          category: pattern.category || 'unknown',
          confidence: pattern.confidence || 0,
          files: pattern.files || pattern.locations || [],
          description: pattern.description || '',
        });
      }
    }

    return patterns;
  }

  private extractIssues(data: AnalysisInput): CodeMapIssue[] {
    const issues: CodeMapIssue[] = [];
    // Support CLI report (rawIssues/detectedIssues) and ScanResult (findings/categories)
    const rawIssues = data.rawIssues || data.detectedIssues || data.findings || [];

    for (const issue of rawIssues) {
      // ScanResult Finding structure: { file, type, severity, matches, confidence, message }
      const line = issue.matches?.[0]?.line ?? issue.line ?? 0;
      const desc = issue.message || issue.description || (typeof issue === 'string' ? issue : JSON.stringify(issue));
      const enrichedIssue = {
        id: issue.id || `${issue.file || 'unknown'}-${line}`,
        type: issue.type || issue.category || 'finding',
        severity: issue.severity || 'medium',
        file: issue.file || issue.filePath || issue.path || 'unknown',
        line,
        description: desc,
        category: issue.category || 'general',
        patternId: issue.patternId || issue.type || 'unknown',
      };
      // Attach fix suggestion if available
      const fixResult = getFixForFinding(enrichedIssue as any);
      if (fixResult) {
        (enrichedIssue as any).fix = {
          description: fixResult.description,
          autoFixable: fixResult.autoFixable,
        };
      }
      issues.push(enrichedIssue);
    }

    // Also pull issues from ScanResult.categories if present
    if (data.categories && typeof data.categories === 'object') {
      for (const [category, categoryFindings] of Object.entries(data.categories)) {
        if (!Array.isArray(categoryFindings)) continue;
        for (const issue of categoryFindings) {
          if (rawIssues.includes(issue)) continue; // avoid duplicates
          const line = issue.matches?.[0]?.line ?? issue.line ?? 0;
          const desc = issue.message || issue.description || JSON.stringify(issue);
          issues.push({
            id: issue.id || `${issue.file || 'unknown'}-${line}`,
            type: issue.type || 'finding',
            severity: issue.severity || 'medium',
            file: issue.file || issue.filePath || issue.path || 'unknown',
            line,
            description: desc,
            category,
          });
        }
      }
    }

    return issues;
  }

  private calculateMetrics(
    files: CodeMapFile[],
    dependencies: CodeMapDependency[],
    patterns: CodeMapPattern[],
    issues: CodeMapIssue[]
  ): CodeMapMetrics {
    const totalFiles = files.length;
    const totalIssues = issues.length;
    const totalPatterns = patterns.length;
    const totalDependencies = dependencies.length;

    const severityCounts = issues.reduce(
      (acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const languageCounts = files.reduce(
      (acc, file) => {
        acc[file.language] = (acc[file.language] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const avgComplexity = files.length > 0 ? files.reduce((sum, file) => sum + file.complexity, 0) / files.length : 0;

    return {
      totalFiles,
      totalIssues,
      totalPatterns,
      totalDependencies,
      severityCounts,
      languageCounts,
      avgComplexity,
      healthScore: this.calculateHealthScore(files, totalIssues),
    };
  }

  private calculateHealthScore(files: CodeMapFile[], totalIssues: number): number {
    const totalLines = files.reduce((sum, f) => sum + (f.lines || 0), 0);
    const issueDensity = totalLines > 0 ? totalIssues / totalLines : 0;
    const avgLines = files.length > 0 ? totalLines / files.length : 0;
    const complexityPenalty = avgLines > 200 ? (avgLines - 200) * 0.05 : 0;
    const severityWeight = files.reduce((sum, f) => {
      const c = f.issues.filter((i) => i.severity === 'critical').length;
      const h = f.issues.filter((i) => i.severity === 'high').length;
      const m = f.issues.filter((i) => i.severity === 'medium').length;
      return sum + c * 10 + h * 5 + m * 2;
    }, 0);
    const baseScore = 100;
    return Math.max(0, Math.min(100, Math.round(baseScore - issueDensity * 500 - severityWeight - complexityPenalty)));
  }

  private generateLayout(files: CodeMapFile[], dependencies: CodeMapDependency[]): CodeMapLayout {
    const nodes: CodeMapNode[] = [];
    const edges: CodeMapEdge[] = [];

    // Directory-based tree positioning
    const dirMap = new Map<string, number>();
    for (const file of files) {
      const dir = path.dirname(file.path);
      if (!dirMap.has(dir)) dirMap.set(dir, dirMap.size);
    }
    const dirCount = dirMap.size || 1;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dir = path.dirname(file.path);
      const dirIdx = dirMap.get(dir) || 0;
      const nameHash = this.simpleHash(file.name);
      nodes.push({
        id: file.id,
        label: file.name,
        x: (dirIdx / dirCount) * 800 + (nameHash % 80) - 40,
        y: 100 + (nameHash % 500),
        size: Math.max(10, Math.min(40, (file.lines || 0) / 10)),
        color: this.getNodeColor(file, 'issues'),
        data: file,
      });
    }

    for (const dep of dependencies) {
      edges.push({ source: dep.from, target: dep.to, strength: dep.strength });
    }

    return { nodes, edges };
  }

  private simpleHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  private getNodeColor(file: CodeMapFile, mode: 'issues' | 'language' = 'issues'): string {
    if (mode === 'language') {
      const langColors: Record<string, string> = {
        javascript: '#F7DF1E', typescript: '#3178C6', python: '#3776AB',
        java: '#B07219', go: '#00ADD8', rust: '#DEA584',
        cpp: '#f34b7d', csharp: '#178600', php: '#4F5D95',
        ruby: '#701516', swift: '#F05138', kotlin: '#A97BFF',
        html: '#E34C26', css: '#563D7C', scss: '#C6538C',
        json: '#292929', yaml: '#CB171E', markdown: '#083FA1',
        sql: '#E38C00',
      };
      return langColors[file.language] || '#888888';
    }
    const issueCount = file.issues.length;
    if (issueCount === 0) return '#4CAF50';
    if (issueCount <= 2) return '#FFC107';
    if (issueCount <= 5) return '#FF9800';
    return '#F44336';
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
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql',
    };

    return languageMap[ext] || 'unknown';
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private calculateDependencyStrength(dep: { from?: string; to?: string; type?: string }): number {
    // Simple strength calculation based on import type
    if (dep.type === 'core') return 1.0;
    if (dep.type === 'external') return 0.7;
    if (dep.type === 'internal') return 0.5;
    return 0.3;
  }

  private exportCodeMap(format: string) {
    if (!this.analysisData) return;

    const processedData = this.processAnalysisData(this.analysisData);

    if (format === 'json') {
      Promise.resolve(vscode.window
        .showSaveDialog({
          filters: { 'JSON Files': ['json'] },
          defaultUri: vscode.Uri.file('code-map.json'),
        }))
        .then((uri) => {
          if (uri) {
            vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(processedData, null, 2)));
            vscode.window.showInformationMessage('Code map exported successfully');
          }
        })
        .catch(() => {});
    } else if (format === 'svg') {
      // Export as SVG (would need to generate SVG from the visualization)
      vscode.window.showInformationMessage('SVG export coming soon');
    }
  }

  private filterData(filters: unknown) {
    // Apply filters to the analysis data
    if (!this.analysisData) return;

    // Filter logic would go here
    this.updateWebview();
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const extUri = this.extensionUri || webview.options.localResourceRoots?.[0] || vscode.Uri.file('');
    const d3Uri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'media', 'd3.v7.min.js'));
    const templatePath = path.join(__dirname, '..', 'media', 'codeMapTemplate.html');
    let html = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : this.fallbackTemplate();
    return html.replace(/NONCE/g, nonce).replace(/D3_URI/g, d3Uri.toString());
  }

  private fallbackTemplate(): string {
    return `<!DOCTYPE html><html><body style="background:var(--vscode-editor-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:20px;text-align:center;"><h2>Code Map</h2><p>Template file not found. Please reinstall the extension.</p></body></html>`;
  }
}

// Data Types
interface CodeMapData {
  files: CodeMapFile[];
  dependencies: CodeMapDependency[];
  patterns: CodeMapPattern[];
  issues: CodeMapIssue[];
  metrics: CodeMapMetrics;
  layout: CodeMapLayout;
}

interface CodeMapFile {
  id: string;
  name: string;
  path: string;
  size: number;
  lines: number;
  language: string;
  complexity: number;
  issues: CodeMapIssue[];
  patterns: CodeMapPattern[];
  metrics: unknown;
}

interface CodeMapDependency {
  from: string;
  to: string;
  type: string;
  strength: number;
}

interface CodeMapPattern {
  id: string;
  type: string;
  category: string;
  confidence: number;
  files: string[];
  description: string;
}

interface CodeMapIssue {
  id: string;
  type: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  category: string;
}

interface CodeMapMetrics {
  totalFiles: number;
  totalIssues: number;
  totalPatterns: number;
  totalDependencies: number;
  severityCounts: Record<string, number>;
  languageCounts: Record<string, number>;
  avgComplexity: number;
  healthScore: number;
}

interface CodeMapLayout {
  nodes: CodeMapNode[];
  edges: CodeMapEdge[];
}

interface CodeMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  data: unknown;
}

interface CodeMapEdge {
  source: string;
  target: string;
  strength: number;
}
