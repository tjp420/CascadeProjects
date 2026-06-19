import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getFixForFinding } from './fixes/fixRegistry';

const SKIP_DIRS = /^(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|\.github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|ai-agent|ai-platform|scripts|ai-tools|packages|\.vscode-test|simplebeacon-vscode-merged)$/i;
const SKIP_EXTS = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|ai|eps|sketch|mp3|mp4|avi|mov|wav|flac|ogg|webm|mkv|zip|tar|gz|bz2|xz|lz|7z|rar|exe|dll|so|dylib|bin|o|obj|class|woff2?|ttf|otf|eot|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|db|sqlite3?|wasm|dat|pkl|npy|h5|pb|pt|onnx|tflite|parquet|pcap|cap|jar|war|ear|apk|aab|ipa|dmg|pkg|msi|iso|img|vmdk|ova|tgz|rpm|deb|lock|map)$/i;

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
export class CodeMapProvider {
  private static instance: CodeMapProvider;
  private webviewPanel: vscode.WebviewPanel | undefined;
  private analysisData: AnalysisInput | null = null;

  static getInstance(): CodeMapProvider {
    if (!CodeMapProvider.instance) {
      CodeMapProvider.instance = new CodeMapProvider();
    }
    return CodeMapProvider.instance;
  }

  showCodeMap(analysisData: AnalysisInput, context: vscode.ExtensionContext) {
    if (analysisData.projectRoot && fs.existsSync(analysisData.projectRoot)) {
      analysisData.repositoryInventory = analysisData.repositoryInventory || {};
      if (!analysisData.repositoryInventory.allFiles) {
        try {
          analysisData.repositoryInventory.allFiles = this.scanDirectory(analysisData.projectRoot);
        } catch { /* silent */ }
      }
    }
    this.analysisData = analysisData;

    if (this.webviewPanel) {
      this.webviewPanel.reveal();
      this.updateWebview();
      return;
    }

    const mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
    this.webviewPanel = vscode.window.createWebviewPanel(
      'codeMap',
      'Code Map Visualization',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri, mediaUri]
      }
    );

    const d3Uri = this.webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'd3.v7.min.js'));
    this.webviewPanel.webview.html = this.getWebviewContent(d3Uri);
    
    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = undefined;
    });

    // Handle messages from webview
    this.webviewPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      undefined
    );
  }

  private handleWebviewMessage(message: { command: string; format?: string; filters?: unknown; path?: string }) {
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
        if (message.path) {
          const docUri = vscode.Uri.file(message.path);
          vscode.workspace.openTextDocument(docUri).then(d => vscode.window.showTextDocument(d));
        }
        break;
    }
  }

  private updateWebview() {
    if (this.webviewPanel && this.analysisData) {
      this.webviewPanel.webview.postMessage({
        command: 'updateData',
        data: this.processAnalysisData(this.analysisData)
      });
    }
  }

  private scanDirectory(root: string, maxFiles = 2000): string[] {
    const results: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (SKIP_DIRS.test(entry.name)) continue;
          walk(path.join(dir, entry.name));
        } else if (entry.isFile()) {
          const fullPath = path.join(dir, entry.name);
          if (SKIP_EXTS.test(path.extname(entry.name))) continue;
          results.push(fullPath);
          if (results.length >= maxFiles) return;
        }
      }
    };
    walk(root);
    return results;
  }

  private buildHierarchy(files: CodeMapFile[], projectRoot?: string): any {
    const root: any = { name: projectRoot ? path.basename(projectRoot) : 'Project', children: [] };
    const dirMap = new Map<string, any>();
    dirMap.set('', root);

    for (const file of files) {
      const relPath = projectRoot ? path.relative(projectRoot, file.path).replace(/\\/g, '/') : file.path;
      const parts = relPath.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      let current = root;
      let builtPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        builtPath += (builtPath ? '/' : '') + parts[i];
        if (!dirMap.has(builtPath)) {
          const dirNode = { name: parts[i], children: [] };
          current.children.push(dirNode);
          dirMap.set(builtPath, dirNode);
        }
        current = dirMap.get(builtPath);
      }

      current.children.push({
        name: parts[parts.length - 1],
        value: Math.max(1, file.size || 1000),
        issues: file.issues.length,
        language: file.language,
        path: file.path
      });
    }
    return root;
  }

  private processAnalysisData(rawData: AnalysisInput): CodeMapData {
    const files = this.extractFiles(rawData);
    const dependencies = this.extractDependencies(rawData);
    const patterns = this.extractPatterns(rawData);
    const issues = this.extractIssues(rawData);
    const hierarchy = this.buildHierarchy(files, rawData.projectRoot);

    return {
      files,
      dependencies,
      patterns,
      issues,
      metrics: this.calculateMetrics(files, dependencies, patterns, issues),
      layout: this.generateLayout(files),
      hierarchy
    };
  }

  private extractFiles(data: AnalysisInput): CodeMapFile[] {
    const fileMap = new Map<string, CodeMapFile>();
    
    // Support both CLI report format (rawIssues/detectedIssues) and ScanResult format (findings/categories)
    const issues = data.rawIssues || data.detectedIssues || data.findings || [];
    for (const issue of issues) {
      const filePath = issue.file || issue.filePath || issue.path || 'unknown';
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          id: filePath,
          name: path.basename(filePath),
          path: filePath,
          size: 0,
          language: this.detectLanguage(filePath),
          complexity: 0,
          issues: [],
          patterns: [],
          metrics: {}
        });
      }
      fileMap.get(filePath)!.issues.push(issue);
    }

    // If we have a repository inventory with file list, add those too
    const inventory = data.repositoryInventory;
    if (inventory?.allFiles && Array.isArray(inventory.allFiles)) {
      for (const filePath of inventory.allFiles) {
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, {
            id: filePath,
            name: path.basename(filePath),
            path: filePath,
            size: 0,
            language: this.detectLanguage(filePath),
            complexity: 0,
            issues: [],
            patterns: [],
            metrics: {}
          });
        }
      }
    }

    // Fallback: if no files found but we have counts, create placeholder entries
    if (fileMap.size === 0 && data.totalFiles) {
      fileMap.set('root', {
        id: 'root',
        name: 'Project Root',
        path: data.projectRoot || 'project',
        size: 0,
        language: 'mixed',
        complexity: 0,
        issues: issues,
        patterns: [],
        metrics: { totalFiles: data.totalFiles, filesAnalyzed: data.filesAnalyzed || 0 }
      });
    }

    return Array.from(fileMap.values());
  }

  private extractDependencies(data: AnalysisInput): CodeMapDependency[] {
    const dependencies: CodeMapDependency[] = [];
    
    // Build basic dependency graph from file paths
    const files = data.rawIssues || data.detectedIssues || data.findings || [];
    const seenPaths = new Set<string>();
    for (const issue of files) {
      const fp = issue.file || issue.filePath || issue.path;
      if (fp) seenPaths.add(fp);
    }
    
    // Create dependencies between files in same directory
    const pathList = Array.from(seenPaths);
    for (let i = 0; i < Math.min(pathList.length, 50); i++) {
      for (let j = i + 1; j < Math.min(pathList.length, 50); j++) {
        const dir1 = path.dirname(pathList[i]);
        const dir2 = path.dirname(pathList[j]);
        if (dir1 === dir2 || path.dirname(dir1) === path.dirname(dir2)) {
          dependencies.push({
            from: pathList[i],
            to: pathList[j],
            type: 'related',
            strength: dir1 === dir2 ? 0.8 : 0.3
          });
        }
      }
    }

    return dependencies;
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
          description: pattern.description || ''
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
        patternId: issue.patternId || issue.type || 'unknown'
      };
      // Attach fix suggestion if available
      const fixResult = getFixForFinding(enrichedIssue as any);
      if (fixResult) {
        (enrichedIssue as any).fix = {
          description: fixResult.description,
          autoFixable: fixResult.autoFixable
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
            category
          });
        }
      }
    }

    return issues;
  }

  private calculateMetrics(files: CodeMapFile[], dependencies: CodeMapDependency[], patterns: CodeMapPattern[], issues: CodeMapIssue[]): CodeMapMetrics {
    const totalFiles = files.length;
    const totalIssues = issues.length;
    const totalPatterns = patterns.length;
    const totalDependencies = dependencies.length;
    
    const severityCounts = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const languageCounts = files.reduce((acc, file) => {
      acc[file.language] = (acc[file.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgComplexity = files.length > 0 
      ? files.reduce((sum, file) => sum + file.complexity, 0) / files.length 
      : 0;

    return {
      totalFiles,
      totalIssues,
      totalPatterns,
      totalDependencies,
      severityCounts,
      languageCounts,
      avgComplexity,
      healthScore: this.calculateHealthScore(totalFiles, totalIssues, avgComplexity)
    };
  }

  private calculateHealthScore(totalFiles: number, totalIssues: number, avgComplexity: number): number {
    const issueDensity = totalFiles > 0 ? totalIssues / totalFiles : 0;
    const complexityPenalty = avgComplexity > 10 ? (avgComplexity - 10) * 2 : 0;
    const baseScore = 100;
    
    return Math.max(0, Math.min(100, baseScore - (issueDensity * 10) - complexityPenalty));
  }

  private generateLayout(files: CodeMapFile[]): CodeMapLayout {
    const nodes: CodeMapNode[] = [];
    const edges: CodeMapEdge[] = [];

    // Deterministic pseudo-random based on file path hash
    const hash = (s: string): number => {
      let h = 0;
      for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
      return Math.abs(h);
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const h = hash(file.path);
      nodes.push({
        id: file.id,
        label: file.name,
        x: (h % 800),
        y: ((h >> 10) % 600),
        size: Math.max(20, Math.min(60, file.size / 1000)),
        color: this.getNodeColor(file),
        data: file
      });
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ source: nodes[i].id, target: nodes[i + 1].id, strength: 0.5 });
    }

    return { nodes, edges };
  }

  private getNodeColor(file: CodeMapFile): string {
    // Color based on file health
    const issueCount = file.issues.length;
    if (issueCount === 0) return '#4CAF50'; // Green
    if (issueCount <= 2) return '#FFC107'; // Yellow
    if (issueCount <= 5) return '#FF9800'; // Orange
    return '#F44336'; // Red
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
      '.sql': 'sql'
    };
    
    return languageMap[ext] || 'unknown';
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
      vscode.window.showSaveDialog({
        filters: { 'JSON Files': ['json'] },
        defaultUri: vscode.Uri.file('code-map.json')
      }).then(uri => {
        if (uri) {
          vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(processedData, null, 2)));
          vscode.window.showInformationMessage('Code map exported successfully');
        }
      });
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

  private getWebviewContent(d3Uri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src ${d3Uri} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Map Visualization</title>
    <script src="${d3Uri}"></script>
    <style>
:root{--bg:var(--vscode-editor-background);--fg:var(--vscode-foreground);--panel:var(--vscode-panel-background,var(--bg));--bd:var(--vscode-panel-border);--muted:var(--vscode-descriptionForeground);--ac:var(--vscode-textLink-foreground);--btn:var(--vscode-button-background);--btn-fg:var(--vscode-button-foreground);--btn-h:var(--vscode-button-hoverBackground);--drop:var(--vscode-dropdown-background);--drop-fg:var(--vscode-dropdown-foreground);--in:var(--vscode-input-background);--hover:var(--vscode-list-hoverBackground);--suc:#10B981;--warn:#F59E0B;--err:#EF4444;--info:#3B82F6;--r:6px;--r2:10px;--sh:0 4px 20px rgba(0,0,0,.15)}
*{box-sizing:border-box}body{font-family:var(--vscode-font-family);margin:0;padding:0;background:var(--bg);color:var(--fg);overflow:hidden;height:100vh}
.app{display:flex;flex-direction:column;height:100%}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:var(--panel);border-bottom:1px solid var(--bd);flex-shrink:0}
.brand{display:flex;align-items:center;gap:10px}
.brand .ico{width:32px;height:32px;border-radius:var(--r);background:linear-gradient(135deg,var(--ac),#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.brand .t{font-size:16px;font-weight:700}.brand .st{font-size:11px;color:var(--muted);margin-top:-2px}
.ctrls{display:flex;align-items:center;gap:8px}
.sel{appearance:none;background:var(--drop);color:var(--drop-fg);border:1px solid var(--bd);padding:5px 26px 5px 10px;border-radius:var(--r);font-size:12px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M0 2l4 4 4-4' fill='none' stroke='%23999' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.btn{display:inline-flex;align-items:center;gap:5px;background:var(--btn);color:var(--btn-fg);border:none;padding:5px 12px;border-radius:var(--r);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
.btn:hover{background:var(--btn-h);transform:translateY(-1px)}.btn.gh{background:var(--in);color:var(--fg);border:1px solid var(--bd)}.btn.gh:hover{background:var(--hover)}
.main{display:flex;flex:1;overflow:hidden}
.vis{flex:1;position:relative;overflow:hidden;background:var(--bg)}.vis svg{width:100%;height:100%}
.side{width:260px;background:var(--panel);border-left:1px solid var(--bd);display:flex;flex-direction:column;overflow-y:auto}
.sec{padding:14px 16px;border-bottom:1px solid var(--bd)}
.sec h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.card{background:var(--bg);border:1px solid var(--bd);border-radius:var(--r);padding:10px;text-align:center;transition:transform .15s}
.card:hover{transform:translateY(-2px)}.card .v{font-size:20px;font-weight:700;color:var(--fg);line-height:1}.card .l{font-size:10px;color:var(--muted);margin-top:4px;font-weight:500}
.card .v.g{color:var(--suc)}.card .v.w{color:var(--warn)}.card .v.b{color:var(--err)}
.leg{display:flex;flex-direction:column;gap:6px}
.leg-i{display:flex;align-items:center;gap:8px;font-size:12px}
.leg-d{width:10px;height:10px;border-radius:50%;flex-shrink:0}.lg{background:var(--suc)}.ly{background:var(--warn)}.lo{background:#F97316}.lr{background:var(--err)}
.fp{display:none}.fp.on{display:block}
.fname{font-size:13px;font-weight:600;color:var(--fg);margin-bottom:8px;word-break:break-all}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.meta-i{background:var(--bg);border:1px solid var(--bd);border-radius:var(--r);padding:6px 8px}
.meta-i .ml{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:1px}
.meta-i .mv{font-size:12px;font-weight:600;color:var(--fg)}
.tip{position:absolute;background:var(--panel);border:1px solid var(--bd);border-radius:var(--r);padding:8px 12px;pointer-events:none;opacity:0;transition:opacity .2s;box-shadow:var(--sh);font-size:11px;z-index:100;max-width:200px}
.tip .tt{font-weight:700;font-size:12px;margin-bottom:3px}.tip .tr{color:var(--muted);line-height:1.5}
.lk{stroke:var(--bd);stroke-opacity:.6}
.nd{cursor:pointer}.nd:hover{stroke:var(--ac);stroke-width:2.5px}
    </style>
</head>
<body>
<div class="app">
  <div class="header">
    <div class="brand">
      <div class="ico">🗺️</div>
      <div><div class="t">Code Map</div><div class="st">Treemap Explorer</div></div>
    </div>
    <div class="ctrls">
      <select class="sel" id="colorMode"><option value="issues">Color: Issues</option><option value="lang">Color: Language</option></select>
      <button class="btn gh" id="exportBtn">Export JSON</button>
      <button class="btn" id="refreshBtn">Refresh</button>
    </div>
  </div>
  <div class="main">
    <div class="vis"><svg id="codeMapSvg"></svg></div>
    <div class="side">
      <div class="sec">
        <h4>Overview</h4>
        <div class="grid">
          <div class="card"><div class="v" id="totalFiles">0</div><div class="l">Files</div></div>
          <div class="card"><div class="v" id="totalIssues">0</div><div class="l">Issues</div></div>
          <div class="card"><div class="v g" id="healthScore">0</div><div class="l">Health %</div></div>
          <div class="card"><div class="v" id="totalDirs">0</div><div class="l">Dirs</div></div>
        </div>
      </div>
      <div class="sec">
        <h4>Legend — Issues</h4>
        <div class="leg">
          <div class="leg-i"><div class="leg-d" style="background:#10B981"></div><span>Clean (0 issues)</span></div>
          <div class="leg-i"><div class="leg-d" style="background:#F59E0B"></div><span>1–2 issues</span></div>
          <div class="leg-i"><div class="leg-d" style="background:#F97316"></div><span>3–5 issues</span></div>
          <div class="leg-i"><div class="leg-d" style="background:#EF4444"></div><span>6+ issues</span></div>
        </div>
      </div>
      <div class="sec">
        <h4>Legend — Languages</h4>
        <div class="leg" id="langLegend"></div>
      </div>
    </div>
  </div>
</div>
<div class="tip" id="tooltip"></div>
<script>
const vscode=acquireVsCodeApi();let cd=null;
function req(){vscode.postMessage({command:'requestData'})}
document.addEventListener('DOMContentLoaded',()=>{req();bind()});
function bind(){document.getElementById('exportBtn').onclick=()=>vscode.postMessage({command:'exportMap',format:'json'});document.getElementById('refreshBtn').onclick=req;document.getElementById('colorMode').onchange=()=>cd&&render(cd)}
window.addEventListener('message',e=>{const m=e.data;if(m.command==='updateData'){cd=m.data;render(cd);updMet(m.data.metrics);buildLangLegend(m.languageCounts)}});
const ISSUE_COL={0:'#10B981',1:'#10B981',2:'#F59E0B',3:'#F59E0B',4:'#F59E0B',5:'#F97316'};
const LANG_COL=['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
function iCol(n){return n>5?'#EF4444':(ISSUE_COL[n]||'#EF4444')}
function lCol(l,langMap){const idx=Object.keys(langMap||{}).indexOf(l);return LANG_COL[idx%LANG_COL.length]||'#6366f1'}
function render(data){const svg=d3.select('#codeMapSvg'),vis=document.querySelector('.vis'),w=vis.clientWidth,h=vis.clientHeight;svg.attr('width',w).attr('height',h);svg.selectAll('*').remove();if(!data.hierarchy){svg.append('text').attr('x',w/2).attr('y',h/2).attr('text-anchor','middle').text('No project data');return}const root=d3.hierarchy(data.hierarchy).sum(d=>d.value||0).sort((a,b)=>b.value-a.value);d3.treemap().size([w,h]).padding(2).paddingTop(16).paddingInner(1)(root);const colorMode=document.getElementById('colorMode').value;const g=svg.append('g');const leaf=g.selectAll('g').data(root.leaves()).enter().append('g').attr('transform',d=>'translate('+d.x0+','+d.y0+')');leaf.append('rect').attr('width',d=>Math.max(0,d.x1-d.x0)).attr('height',d=>Math.max(0,d.y1-d.y0)).attr('fill',d=>{if(colorMode==='lang')return lCol(d.data.language,cd?.metrics?.languageCounts);return iCol(d.data.issues||0)}).attr('stroke','rgba(255,255,255,0.1)').attr('stroke-width',1).style('cursor','pointer').on('click',(e,d)=>{if(d.data.path)vscode.postMessage({command:'openFile',path:d.data.path})}).on('mouseover',(e,d)=>{const t=document.getElementById('tooltip');let h='<div class="tt">'+esc(d.data.name)+'</div><div class="tr">'+esc(d.data.language||'unknown')+'</div>';if(d.data.issues){h+='<div class="tr" style="margin-top:3px;">'+d.data.issues+' issue'+(d.data.issues===1?'':'s')+'</div>'}t.innerHTML=h;t.style.left=e.pageX+12+'px';t.style.top=e.pageY+12+'px';t.style.opacity=1}).on('mouseout',()=>document.getElementById('tooltip').style.opacity=0);leaf.filter(d=>(d.x1-d.x0)>40&&(d.y1-d.y0)>14).append('text').attr('x',3).attr('y',12).text(d=>d.data.name).attr('font-size',10).attr('fill','#fff').attr('pointer-events','none').style('text-shadow','0 1px 2px rgba(0,0,0,.6)');g.selectAll('.dir-label').data(root.descendants().filter(d=>d.depth<root.height&&d.children)).enter().append('text').attr('x',d=>d.x0+3).attr('y',d=>d.y0+12).text(d=>d.data.name).attr('font-size',10).attr('font-weight',600).attr('fill','var(--vscode-foreground)').attr('opacity',0.7).attr('pointer-events','none');}
function buildLangLegend(counts){const c=document.getElementById('langLegend');if(!c||!counts)return;c.innerHTML='';Object.entries(counts).forEach(([lang,n],i)=>{c.innerHTML+='<div class="leg-i"><div class="leg-d" style="background:'+LANG_COL[i%LANG_COL.length]+'"></div><span>'+esc(lang)+' ('+n+')</span></div>'})}
function esc(s){const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}
function updMet(m){document.getElementById('totalFiles').textContent=m.totalFiles||0;document.getElementById('totalIssues').textContent=m.totalIssues||0;document.getElementById('healthScore').textContent=Math.round(m.healthScore||0);const dirs=cd?.hierarchy?countDirs(cd.hierarchy):0;document.getElementById('totalDirs').textContent=dirs;}
function countDirs(node){if(!node||!node.children)return 0;let c=1;for(const child of node.children){if(child.children)c+=countDirs(child);}return c;}
</script>
</body>
</html>`;
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
  hierarchy: any;
}

interface CodeMapFile {
  id: string;
  name: string;
  path: string;
  size: number;
  language: string;
  complexity: number;
  issues: any[];
  patterns: any[];
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
