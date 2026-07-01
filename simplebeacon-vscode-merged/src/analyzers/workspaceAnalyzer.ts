// simplebeacon-ignore memory-leak — import analysis with short-lived line iteration
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSbConfig } from '../utils';

export interface MatchEntry {
  line: number;
  snippet: string;
  context: string[];
}

export interface Finding {
  file: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  matches: MatchEntry[];
  confidence?: number;
  message?: string;
  patternId?: string;
}

export interface BuildReadinessCheck {
  name: string;
  found: boolean;
  critical: boolean;
}

export interface BuildReadinessResult {
  readinessScore: number;
  readinessStatus: 'READY' | 'NEEDS WORK' | 'BLOCKED';
  totalChecks: number;
  passedChecks: number;
  missingCritical: string[];
  missingRecommended: string[];
  checklist: BuildReadinessCheck[];
  summary: string;
  remediation: string;
  recommendations: string[];
}

export interface EuAiActControl {
  controlId: string;
  title: string;
  article: string;
  status: 'PASS' | 'WARN' | 'REVIEW';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: string;
  action: string;
}

export interface EuAiActResult {
  controls: EuAiActControl[];
  aiSdkCount: number;
  hasGovernanceDocs: boolean;
  summary: string;
}

export type ScanProfile = 'complete' | 'gate' | 'aislopcop' | 'codebase' | 'euai' | 'compliance' | 'hygiene' | 'custom';

export interface ScanResult {
  findings?: Finding[];
  projectRoot?: string;
  rawIssues?: Array<Record<string, unknown>>;
  detectedIssues?: Array<Record<string, unknown>>;
  allFilePaths?: string[];
  dependencies?: Array<{from: string; to: string; type: string}>;
  summary?: {
    totalFiles: number;
    filesAnalyzed: number;
    totalFindings: number;
    severityCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
    scanProfile?: ScanProfile;
    selectedModules?: string[];
    aiAssistedFindings?: number;
    averageFileSizeBytes?: number;
    totalLinesOfCode?: number;
  };
  categories?: Record<string, Finding[]>;
  qualityScore?: number;
  gate?: {
    pass?: boolean;
    blockingCount?: number;
    blockingIssues?: Array<Record<string, unknown>>;
  };
  credentialHygiene?: {
    secrets?: Array<Record<string, unknown>>;
  };
  buildReadiness?: BuildReadinessResult;
  euAiAct?: EuAiActResult;
}

interface FixTemplate {
  description: string;
  search: RegExp;
  replace: string;
  autoFixable: boolean;
  previewDiff: boolean;
}

interface PatternDef {
  id: string;
  name: string;
  appliesTo: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: RegExp;
  maxMatches: number;
  multiline?: boolean;
  realtime?: boolean;
  sources?: RegExp[];
  sinks?: RegExp[];
  redact?: boolean;
  selfReferenceFilter?: RegExp;
  contextFilter?: (snippet: string, filePath: string) => boolean;
  message: string;
  fix?: FixTemplate;
}

interface AnalyzerSchemaEntry {
  category: string;
}

const LANGUAGE_REGISTRY: Record<string, { extensions: string[] }> = {
  javascript: { extensions: ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'] },
  python: { extensions: ['py', 'pyw', 'pyi'] },
  java: { extensions: ['java', 'kt', 'scala', 'groovy'] },
  go: { extensions: ['go'] },
  rust: { extensions: ['rs'] },
  php: { extensions: ['php'] },
  ruby: { extensions: ['rb'] },
  dotnet: { extensions: ['cs', 'vb'] },
  html: { extensions: ['html', 'htm'] },
  json: { extensions: ['json'] },
  yaml: { extensions: ['yaml', 'yml'] },
  css: { extensions: ['css', 'scss', 'sass', 'less'] },
  markdown: { extensions: ['md', 'mdx'] },
  xml: { extensions: ['xml', 'svg'] },
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  for (const [langKey, cfg] of Object.entries(LANGUAGE_REGISTRY)) {
    if (cfg.extensions.includes(ext)) return langKey;
  }
  return 'unknown';
}

function extractMatches(
  text: string,
  pattern: RegExp,
  maxMatches = 5,
  redact = false,
  multiline = false
): MatchEntry[] {
  const matches: MatchEntry[] = [];
  const lines = text.split('\n');
  const MAX_LINE_LEN = 5000;

  if (multiline) {
    // Multi-line: scan full text with exec to capture matches across lines
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null && matches.length < maxMatches) {
      const matchIndex = match.index;
      const preText = text.slice(0, matchIndex);
      const lineNumber = preText.split('\n').length;
      const snippetStart = Math.max(0, matchIndex - 60);
      const snippetEnd = Math.min(text.length, matchIndex + match[0].length + 60);
      let snippet = text.slice(snippetStart, snippetEnd).trim().slice(0, 120);
      if (redact) {
        snippet = snippet
          .replace(/(=\s*['"]?)[A-Za-z0-9_\-]{8,}(['"]?)/g, '$1***REDACTED***$2')
          .replace(/(:\s*['"]?)[A-Za-z0-9_\-]{8,}(['"]?)/g, '$1***REDACTED***$2');
      }
      matches.push({
        line: lineNumber,
        snippet,
        context: [
          lines[Math.max(0, lineNumber - 2)]?.trim().slice(0, 100) || '',
          snippet,
          lines[Math.min(lines.length - 1, lineNumber)]?.trim().slice(0, 100) || '',
        ].filter(Boolean),
      });
    }
    return matches;
  }

  // Single-line: original behavior
  for (let li = 0; li < lines.length && matches.length < maxMatches; li++) {
    let line = lines[li];
    if (line.length > MAX_LINE_LEN) {
      if (/\{2000,\}/.test(pattern.source)) {
        if (!pattern.test(line.slice(0, MAX_LINE_LEN))) continue;
      } else {
        continue;
      }
    }
    if (pattern.test(line)) {
      let snippet = line.trim().slice(0, 120);
      if (redact) {
        snippet = snippet
          .replace(/(=\s*['"]?)[A-Za-z0-9_\-]{8,}(['"]?)/g, '$1***REDACTED***$2')
          .replace(/(:\s*['"]?)[A-Za-z0-9_\-]{8,}(['"]?)/g, '$1***REDACTED***$2');
      }
      matches.push({
        line: li + 1,
        snippet,
        context: [
          lines[Math.max(0, li - 1)]?.trim().slice(0, 100) || '',
          snippet,
          lines[Math.min(lines.length - 1, li + 1)]?.trim().slice(0, 100) || '',
        ].filter(Boolean),
      });
    }
  }
  return matches;
}

function isInComment(line: string, language: string): boolean {
  const trimmed = line.trim();
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'java':
    case 'go':
    case 'rust':
    case 'php':
    case 'dotnet':
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    case 'python':
      return trimmed.startsWith('#');
    case 'ruby':
      return trimmed.startsWith('#');
    default:
      return false;
  }
}

function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    /\.(test|spec)\./i.test(normalized) ||
    /__tests__/.test(normalized) ||
    /\/tests?\//.test(normalized) ||
    /\/(fixtures?|mocks?)\//.test(normalized)
  );
}

function shouldSkipFile(filePath: string): boolean {
  const includeAll = getSbConfig().get<boolean>('scanIncludeAllFiles', false);
  if (includeAll) { return false; }
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  // Skip test files entirely
  if (isTestFile(filePath)) return true;
  // Skip non-production directories (dev tools, demos, scripts)
  if (/(^|\/)scripts\//.test(normalized)) return true;
  if (/(^|\/)bin\//.test(normalized)) return true;
  if (/(^|\/)tools\//.test(normalized)) return true;
  if (/(^|\/)coming-soon(-dev)?\//.test(normalized)) return true;
  // Skip pattern-definition files (they describe patterns, not contain them)
  if (/(^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
  if (/[-]patterns\.js$/.test(normalized)) return true;
  if (/pattern-documentation\.js$/.test(normalized)) return true;
  if (/test-all-patterns\.js$/.test(normalized)) return true;
  // Skip one-off generator / export scripts
  if (/generate-.*\.js$/.test(normalized)) return true;
  if (/generate-.*\.cjs$/.test(normalized)) return true;
  if (/run-.*\.cjs$/.test(normalized)) return true;
  if (/export-.*\.js$/.test(normalized)) return true;
  if (/trello-.*\.js$/.test(normalized)) return true;
  if (/quick-actions\.js$/.test(normalized)) return true;
  // Skip files that start with test- but aren't .test. (e.g. test-technical-audit.js)
  if (/(^|\/)test-[^/]+\.js$/.test(normalized)) return true;
  // Skip mock files
  if (/__mocks__\//.test(normalized)) return true;
  // Skip VS Code: extension files that contain large inline HTML/JS templates (false positives)
  if (/modernSidebarProvider\.ts$/.test(normalized)) return true;
  if (/enhancedScanProvider\.ts$/.test(normalized)) return true;
  if (/enhancedDashboard2_0\.ts$/.test(normalized)) return true;
  if (/enhancedDashboard3_0\.ts$/.test(normalized)) return true;
  return false;
}

function computeDynamicSeverity(
  baseSeverity: 'critical' | 'high' | 'medium' | 'low',
  snippet: string,
  filePath: string,
  language: string
): 'critical' | 'high' | 'medium' | 'low' {
  if (isInComment(snippet, language)) return 'low';
  if (isTestFile(filePath)) return 'low';

  // Downgrade if argument is a literal string (not tainted)
  const hasVariableRef = /\b(req\.body|req\.query|req\.params|process\.argv|args\[|argv\[)/i.test(snippet);
  const isLiteral = /['"`][^'"`]*['"`]$/.test(snippet.trim());

  if (baseSeverity === 'high' && isLiteral && !hasVariableRef) return 'medium';
  if (baseSeverity === 'medium' && isLiteral && !hasVariableRef) return 'low';
  if (baseSeverity === 'high' && hasVariableRef) return 'critical';

  return baseSeverity;
}

/**
 * Default patterns for build artifacts and dependency directories to exclude from scans.
 */
export const DEFAULT_BUILD_ARTIFACT_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  'frontend-build',
  'vendor',
  '.vscode-test',
  '.simplebeacon',
  'code-map.json',
  '.map',
  '.lock',
  '.min.js',
  '.min.css',
  '.bundle.js',
  '.bundle.css',
];

/**
 * Retrieve the combined default and user-configured build artifact exclusion patterns.
 * @returns Array of exclusion pattern strings.
 */
export function getBuildArtifactPatterns(): string[] {
  const config = getSbConfig();
  const userPatterns: string[] = config.get('excludePatterns', []);
  return [...new Set([...DEFAULT_BUILD_ARTIFACT_PATTERNS, ...userPatterns])];
}

/**
 * Check whether a file path matches any build artifact exclusion pattern.
 * @param filePath - Path to evaluate.
 * @param customPatterns - Optional override patterns.
 * @returns True if the file is a build artifact.
 */
export function isBuildArtifact(filePath: string, customPatterns?: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop() || normalized;
  const patterns = customPatterns ?? getBuildArtifactPatterns();

  for (const p of patterns) {
    if (!p) continue;
    let pat = p.toLowerCase().replace(/\/+$/, '').replace(/\/\*\*$/, '');
    if (!pat) continue;
    // Exact filename / basename match (e.g. code-map.json)
    if (basename === pat) return true;
    // Directory match: pattern appears as a path segment
    if (!pat.startsWith('.')) {
      if (new RegExp(`(^|\\/)${escapeRegex(pat)}\\/`, 'i').test(normalized)) return true;
    }
    // Extension match (e.g. .map, .lock, .min.js) and dot-directory match (e.g. .git)
    if (pat.startsWith('.')) {
      const ext = pat.replace(/^\./, '');
      if (new RegExp(`\\.${escapeRegex(ext)}$`, 'i').test(normalized)) return true;
      if (new RegExp(`(^|\\/)${escapeRegex(pat)}\\/`, 'i').test(normalized)) return true;
    }
  }
  return false;
}

/**
 * Escape a string for safe use inside a regular expression.
 * @param str - String to escape.
 * @returns Escaped string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Node.js built-in modules that don't need package.json entry
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
  'module', 'net', 'os', 'path', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'tty',
  'url', 'util', 'v8', 'vm', 'zlib', 'worker_threads', 'perf_hooks',
  'async_hooks', 'http2', 'diagnostics_channel', 'trace_events',
  'process', 'timers/promises', 'fs/promises', 'stream/promises',
  'path/posix', 'path/win32', 'dns/promises', 'readline/promises',
]);

function loadPackageDependencies(rootPath: string): Set<string> {
  try {
    const pkgPath = path.join(rootPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return new Set();
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const deps = new Set<string>();
    const addDeps = (obj?: Record<string, string>) => {
      if (obj) Object.keys(obj).forEach((k) => deps.add(k));
    };
    addDeps(pkg.dependencies);
    addDeps(pkg.devDependencies);
    addDeps(pkg.peerDependencies);
    addDeps(pkg.optionalDependencies);
    return deps;
  } catch {
    return new Set();
  }
}

interface ImportMatch {
  line: number;
  module: string;
  statement: string;
}

function extractImports(text: string): ImportMatch[] {
  const lines = text.split('\n');
  const results: ImportMatch[] = [];
  // Match: import X from 'mod' | import 'mod' | require('mod') | import('mod')
  const importRegex = /(?:^|[^a-zA-Z0-9_$])import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = importRegex.exec(line)) !== null) {
      const mod = match[1] || match[2];
      if (mod && !mod.startsWith('.') && !mod.startsWith('/')) {
        // Extract root package name (e.g., "lodash/debounce" -> "lodash")
        const rootPkg = mod.split('/')[0];
        results.push({ line: i + 1, module: rootPkg, statement: line.trim() });
      }
    }
    importRegex.lastIndex = 0;
  }
  return results;
}

function extractInternalImports(text: string, fromFile: string): Array<{from: string; to: string; type: string}> {
  const deps: Array<{from: string; to: string; type: string}> = [];
  // Match relative imports: import X from './foo' | require('../bar') | import('./baz')
  const relRegex = /(?:^|[^a-zA-Z0-9_$])import\s+(?:.*?\s+from\s+)?['"](\.+\/[^'"]+)['"]|\brequire\s*\(\s*['"](\.+\/[^'"]+)['"]\s*\)/g;
  let match;
  while ((match = relRegex.exec(text)) !== null) {
    const raw = (match[1] || match[2]).trim();
    if (!raw) continue;
    // Resolve relative path to normalized relative path
    const toPath = raw.replace(/\/index$/, '').replace(/\.\/(.*?)\.\w+$/, './$1');
    deps.push({ from: fromFile, to: toPath, type: 'import' });
  }
  relRegex.lastIndex = 0;
  return deps;
}

const PATTERN_REGISTRY: Record<string, PatternDef> = {
  credentials: {
    id: 'credentials',
    name: 'Credential Pattern',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'medium',
    pattern:
      /password\s*=\s*['"][^'"]{6,}|api[_-]?key\s*=\s*['"][a-z0-9]{12,}|secret[_-]?key\s*=\s*['"][a-z0-9]{12,}|private_key\s*=\s*['"][^'"]{8,}|aws_access_key_id\s*=\s*['"][A-Z0-9]{16,}|API_KEY\s*=\s*['"][A-Za-z0-9_\-]{16,}|SECRET\s*=\s*['"][A-Za-z0-9_\-]{12,}|AUTH_TOKEN\s*=\s*['"][A-Za-z0-9_\-]{12,}/i,
    maxMatches: 3,
    redact: true,
    realtime: true,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude archive/ and test directories
      if (/(^|[\\/])archive[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])simplebeacon-rule-tests[\\/]/i.test(filePath)) return false;
      // Exclude already-redacted secrets
      if (/\*\*\*REDACTED\*\*\*/.test(snippet)) return false;
      // Exclude localStorage key names (not actual credentials)
      if (/LS_KEY_\w+\s*=\s*['"]/.test(snippet)) return false;
      // Exclude placeholder/example credential values
      if (/your[-_]?api[-_]?key[-_]?here|your[-_]?api[-_]?secret[-_]?here|test[-_]?api[-_]?key|fake[-_]?secret|placeholder/i.test(snippet)) return false;
      // Exclude pattern definition files that describe credential detection
      if (
        /scanner-patterns\.js|scanner-engine\.js|pattern-documentation\.js/i.test(filePath) &&
        /label.*Secret|section.*credentials|message.*secret/i.test(snippet)
      )
        return false;
      // Exclude test fixture data with placeholder secrets
      if (/test-all-patterns\.js/i.test(filePath)) return false;
      // Exclude demo/test data files (coming-soon public data is generated/demo content)
      if (/coming-soon[\\/]public[\\/]data[\\/]report\.json$/i.test(filePath)) return false;
      // Exclude workspaceAnalyzer.ts pattern definition
      if (/workspaceAnalyzer\.ts/i.test(filePath) && /pattern.*password|message.*secret/i.test(snippet)) return false;
      return true;
    },
    message: 'Potential hardcoded secret detected. Move to environment variables or secret manager.',
  },
  debugArtifacts: {
    id: 'debugArtifacts',
    name: 'Debug Artifact',
    appliesTo: ['javascript'],
    severity: 'low',
    pattern:
      /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group|assert|count|time|timeEnd|profile)\s*\(|\bdebugger\b|\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(|\/\/\s*TODO:?\s*\w|\/\/\s*FIXME:?\s*\w|\/\*\s*TODO|\/\*\s*FIXME|\bconsole\.log\s*\(\s*['"`]/i,
    maxMatches: 3,
    realtime: true,
    contextFilter: (snippet: string, filePath: string) => {
      // === TOP-LEVEL FILE EXCLUSIONS (before any snippet checks) ===
      // Exclude scripts/, coming-soon/, tools/, test files entirely
      if (/(^|[\\/])scripts[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])coming-soon(-dev)?[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])ai-platform[\\/]tools[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])ai-platform[\\/]tests[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])packages[\\/]simplebeacon-cli[\\/]tests[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])simplebeacon-rule-tests[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])ai-agent[\\/]/i.test(filePath)) return false;
      // Rule definition files that define debugger/console patterns
      if (/realtimeMonitor\.ts$/i.test(filePath)) return false;
      if (/codebase-analyzer\.cjs$/i.test(filePath)) return false;
      if (/file-quality-heuristics\.cjs$/i.test(filePath)) return false;
      if (/universal-baseline-patterns\.cjs$/i.test(filePath)) return false;
      if (/python-patterns\.cjs$/i.test(filePath)) return false;
      if (/language-patterns[\\/]/i.test(filePath)) return false;
      // Frameworkless diagnostic tool (legitimate debugger/alert patterns)
      if (/simplebeacon-frameworkless[\\/]app\.js$/i.test(filePath)) return false;
      // Dashboard utility files (error handling is legitimate)
      if (/recoverable-fetch\.js$/i.test(filePath)) return false;
      if (/AnalyzeView\.js$/i.test(filePath)) return false;
      // VS Code extension dashboard webview files
      if (/enhancedDashboard2?_0?\.ts$/i.test(filePath)) return false;
      // Rule definition and remediation text files that legitimately mention debugger/console
      if (/workspaceAnalyzer\.ts$/i.test(filePath)) return false;
      if (/remediationProvider\.ts$/i.test(filePath)) return false;
      if (/audit-remediation-recipes\.cjs$/i.test(filePath)) return false;
      if (/reporters[\\/]json\.js$/i.test(filePath)) return false;
      // Scanner rule definition files that define debug artifact patterns
      if (/scan-directory\.js$/i.test(filePath)) return false;
      if (/scan-worker\.js$/i.test(filePath)) return false;
      if (/count-files\.js$/i.test(filePath)) return false;
      if (/count-all-files\.js$/i.test(filePath)) return false;
      if (/analyze-directory\.js$/i.test(filePath)) return false;
      if (/local-scanner-bridge\.cjs$/i.test(filePath)) return false;
      if (/token-manager\.js$/i.test(filePath)) return false;
      // === CONSOLE-SPECIFIC EXCLUSIONS ===
      const isConsoleLog = /\bconsole\.(log|warn|error|info)/i.test(snippet);
      if (isConsoleLog) {
        const hasVariable = /console\.[\w]+\s*\([^)]*\w+\s*[,+)]/.test(snippet);
        const onlyStrings = /console\.[\w]+\s*\(\s*['"]/.test(snippet);
        if (!hasVariable && onlyStrings) return false;
        // console.error/console.warn in catch blocks and error handlers is legitimate
        if (/console\.(error|warn)/.test(snippet)) {
          // Server, dashboard, and CLI source files use structured error logging
          if (/(^|[\\/])server[\\/]/i.test(filePath)) return false;
          if (/(^|[\\/])ai-platform[\\/]web[\\/]simplebeacon-dashboard[\\/]js[\\/]/i.test(filePath)) return false;
          if (/(^|[\\/])packages[\\/]simplebeacon-cli[\\/]src[\\/]/i.test(filePath)) return false;
          if (/(^|[\\/])ai-platform[\\/]src[\\/]/i.test(filePath)) return false;
          if (/(^|[\\/])simplebeacon-vscode[\\/]src[\\/]/i.test(filePath)) return false;
        }
        // Error-logging utility wrappers
        if (/app-logger\.cjs/i.test(filePath)) return false;
        // Conditional debug loggers (behind PROCESSOR_DEBUG, options.debug, DEBUG flag, etc.)
        if (/PROCESSOR_DEBUG|options\.debug|\bif\s*\(\s*DEBUG/.test(snippet) && /console\.(log|error|warn)/.test(snippet)) return false;
        // CLI usage/help text console.error is legitimate
        // Dashboard web UI uses console.error/warn for legitimate error feedback
        if (/(^|[\\/])dashboard-web[\\/]js(-es2018)?[\\/]/i.test(filePath) && /console\.(error|warn)/.test(snippet)) return false;
        if (/console\.error\s*\(\s*[`'"][^`'"]*(?:Usage|usage|help|options|required|missing)/.test(snippet)) return false;
        // VS Code extension fixes registry mentions console.log as remediation
        if (/fixes[\\/](fixRegistry|findingConverter)/i.test(filePath)) return false;
        // Pattern definition files that define console.log detection rules
        if (
          /workspaceAnalyzer\.ts/i.test(filePath) &&
          /pattern.*console|contextFilter.*console|console\.log|debugger/.test(snippet)
        )
          return false;
        // CLI entry points
        if (/bin[\\/]generate-marketing-content\.js/i.test(filePath)) return false;
        if (/bin[\\/]simplebeacon\.js/i.test(filePath) && /console\.(error|warn)/.test(snippet)) return false;
        // Exclude simplebeacon-server.cjs and transform-roadmap.cjs
        if (/simplebeacon-server\.cjs/i.test(filePath) && /console\.(log|warn|error)/.test(snippet)) return false;
        if (/transform-roadmap\.cjs/i.test(filePath) && /console\.log/.test(snippet)) return false;
        // Exclude scanner-engine.js debug artifact rule description strings
        if (/scanner-engine\.js$/i.test(filePath) && /Debug Artifact|console\.log|debugger/.test(snippet)) return false;
        // Exclude ui-renderer.js HTML templates showing debug artifact results
        if (/ui-renderer\.js$/i.test(filePath) && /Debug Artifacts|debugArts|debugCount/.test(snippet)) return false;
        // Exclude main.js action item generation for debug artifacts
        if (/main\.js$/i.test(filePath) && /debug artifact|console\.log|debugger/.test(snippet)) return false;
        // Exclude build/scan scripts with legitimate progress logging
        if (/count-files\.js$/i.test(filePath) && /console\.log|Scanning/.test(snippet)) return false;
        if (/count-all-files\.js$/i.test(filePath) && /console\.log|Scanning/.test(snippet)) return false;
        if (/analyze-directory\.js$/i.test(filePath) && /console\.log|files indexed/.test(snippet)) return false;
        if (/server\.cjs$/i.test(filePath) && /console\.warn|Cannot read/.test(snippet)) return false;
        if (/local-scanner-bridge\.cjs$/i.test(filePath) && /DEBUG_BRIDGE|console\.error/.test(snippet)) return false;
        if (/token-manager\.js$/i.test(filePath) && /console\.log.*syncModuleSelectionFromTier/.test(snippet)) return false;
      }
      if (/\bconfirm\s*\(/.test(snippet) && /globalThis\.|window\./.test(snippet)) return false;
      // modernSidebarProvider injects console.error fallback into standalone browser HTML — not a debug artifact
      if (/modernSidebarProvider\.ts/i.test(filePath) && /console\.error\s*\(\s*['"]acquireVsCodeApi failed/.test(snippet)) return false;
      // ProfileView uses prompt() for password confirmation — legitimate production UI
      if (/ProfileView\.js$/i.test(filePath) && /\bprompt\s*\(/.test(snippet)) return false;
      // ChatbotView is a legitimate production UI view — not a debug artifact
      if (/ChatbotView\.js$/i.test(filePath)) return false;
      return true;
    },
    message: 'Development-only debug artifact. Remove before production builds.',
    fix: {
      description: 'Remove debugger statement',
      search: /\bdebugger\b;?/,
      replace: '',
      autoFixable: true,
      previewDiff: true,
    },
  },
  aiResidueStub: {
    id: 'aiResidueStub',
    name: 'Stub Implementation',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'low',
    pattern:
      /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*TODO|def\s+\w+\s*\([^)]*\):\s*pass\b|TODO\s*:\s*implement|TODO\s*:\s*AI|\/\/\s*AI\s+generated|\/\/\s*Generated\s+by\s+(ChatGPT|GPT|Claude|Copilot|Gemini|LLM)/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude pattern definition files that describe stub detection
      if (
        /scanner-patterns\.js|scanner-engine\.js|pattern-documentation\.js|main\.js/i.test(filePath) &&
        /label.*Placeholder|desc.*TODO|id.*ai-placeholder/i.test(snippet)
      )
        return false;
      // Exclude workspaceAnalyzer.ts pattern definition
      if (/workspaceAnalyzer\.ts/i.test(filePath) && /pattern.*TODO|message.*placeholder/i.test(snippet)) return false;
      // Exclude quick-actions.js and pattern-documentation.js pattern examples
      if (/quick-actions\.js$/i.test(filePath)) return false;
      if (/pattern-documentation\.js$/i.test(filePath)) return false;
      return true;
    },
    message: 'Stub or AI-generated placeholder detected. Replace with actual implementation before production.',
  },
  aiResidueSwallow: {
    id: 'aiResidueSwallow',
    name: 'Error Swallowing',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'medium',
    pattern:
      /catch\s*\([^)]*\)\s*\{\s*\}|except\s*[^:]+:\s*pass|catch\s*\([^)]*\)\s*\{\s*return\s*null|rescue\s*=>\s*e\s*#\s*ignore/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude pattern definition files that describe error-swallowing detection
      if (
        /scanner-patterns\.js|scanner-engine\.js|pattern-documentation\.js/i.test(filePath) &&
        /label.*Error|message.*swallow|desc.*catch/i.test(snippet)
      )
        return false;
      // Exclude test-all-patterns.js fixture data
      if (/test-all-patterns\.js$/i.test(filePath)) return false;
      // Exclude main.js history.replaceState benign catch (browser API guard)
      if (/main\.js$/i.test(filePath) && /history\.replaceState/.test(snippet)) return false;
      // Exclude server.cjs benign catch blocks
      if (/server\.cjs$/i.test(filePath) && /catch\s*\(_\)/.test(snippet)) return false;
      // Exclude VS Code extension webview event handler guards (before() hook catch)
      if (/simplebeacon-vscode(-merged)?[/\\]src[/\\]/i.test(filePath) && /addEventListener|onclick|before\(\)/i.test(snippet)) return false;
      return true;
    },
    message: 'Error swallowing anti-pattern detected. Empty catch blocks hide runtime failures.',
  },
  perfNestedLoop: {
    id: 'perfNestedLoop',
    name: 'Performance Anti-Pattern',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'low',
    pattern:
      /for\s*\([^)]*\)\s*\{[\s\S]{0,80}for\s*\(|for\s+\w+\s+in\s+\w+\s*:[\s\S]{0,80}for\s+\w+\s+in|while\s*\([^)]*\)\s*\{[\s\S]{0,80}while\s*\(/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude pattern definition files that describe nested-loop detection
      if (
        /scanner-patterns\.js|scanner-engine\.js|pattern-documentation\.js/i.test(filePath) &&
        /label.*Nested|message.*O\(n\)|desc.*loop/i.test(snippet)
      )
        return false;
      // Exclude test-all-patterns.js fixture data
      if (/test-all-patterns\.js$/i.test(filePath)) return false;
      return true;
    },
    message: 'Nested loops detected. Consider optimization to reduce O(n²) complexity.',
  },
  typeSafetyAny: {
    id: 'typeSafetyAny',
    name: 'Type Safety Gap',
    appliesTo: ['javascript', 'typescript'],
    severity: 'low',
    pattern: /:\s*any\b(?!\s*\[\])|@ts-ignore|@ts-nocheck/i,
    maxMatches: 3,
    selfReferenceFilter:
      /id:\s*['"]typeSafetyAny['"]|message:\s*['"]Type safety gap|pattern:\s*\/.*any\b|label:\s*['"]Explicit any|label:\s*['"]TypeScript error suppression/i,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude suggestion text in findingConverter that mentions 'any' as advice
      if (/findingConverter\.ts/i.test(filePath) && /Replace any with specific types|@ts-ignore/.test(snippet))
        return false;
      // Exclude pattern definition in workspaceAnalyzer.ts
      if (/workspaceAnalyzer\.ts/i.test(filePath) && /pattern.*any|message.*any/.test(snippet)) return false;
      // Exclude codebase-analyzer pattern definitions
      if (/codebase-analyzer\.cjs/i.test(filePath) && /any-type|any\b/.test(snippet)) return false;
      // Exclude remediationProvider.ts which contains remediation text about type safety
      if (/remediationProvider\.ts/i.test(filePath) && /Replace : any|type safety|@ts-ignore/.test(snippet))
        return false;
      // Exclude scanner-engine.js which builds type-safety finding objects
      if (/scanner-engine\.js$/i.test(filePath) && /typeSafetyFindings|severity.*low.*type.*Type Safety/.test(snippet))
        return false;
      return true;
    },
    message: 'Type safety gap: any type, missing PropTypes, or excessive parameters detected.',
  },
  missingTest: {
    id: 'missingTest',
    name: 'Missing Test Coverage',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'low',
    pattern:
      /test\.(todo|skip|xit|xtest)\s*\(|describe\.(skip|todo)\s*\(|it\.(skip|todo)\s*\(|pytest\.mark\.skip|^\s*@Disabled\b|func Test.*\{\s*\}/i,
    maxMatches: 3,
    message: 'Empty or skipped test detected. Ensure production code has active coverage.',
  },
  a11yGap: {
    id: 'a11yGap',
    name: 'Accessibility Gap',
    appliesTo: ['javascript', 'typescript', 'html'],
    severity: 'medium',
    pattern:
      /<img\b(?![^>]*\balt=)[^>]*>|<(input|textarea|select)\b(?![^>]*\b(?:aria-label|aria-labelledby|title|placeholder)=)(?![^>]*\b(?:hidden|id)\b)[^>]*>|<button\b(?![^>]*\b(?:aria-label|aria-labelledby|title)=)[^>]*>\s*<\/button>/i,
    maxMatches: 3,
    selfReferenceFilter: /pattern:\s*\/.*img\b|label:\s*['"]Missing alt|id:\s*['"]a11yGap['"]/i,
    contextFilter: (snippet: string, filePath: string) => {
      if (/style=["'][^"']*display:\s*none/i.test(snippet)) return false;
      if (/label[^>]*>.*(input|select|textarea)/i.test(snippet)) return false;
      // Exclude hidden inputs (visually hidden from all users, incl. screen readers)
      if (/type=["']?hidden["']?/i.test(snippet)) return false;
      // Exclude VS Code webview panel HTML templates and extension source files
      if (/simplebeacon-vscode(?:-merged)?[/\\]src[/\\]/i.test(filePath)) return false;
      // Exclude pattern definition files
      if (/scanner-patterns\.js|test-all-patterns\.js|codebase-analyzer\.cjs/i.test(filePath)) return false;
      if (/workspaceAnalyzer\.ts/i.test(filePath) && /pattern.*img|message.*alt|id:\s*['"]a11yGap/i.test(snippet))
        return false;
      // Exclude inputs with an ID that are likely labeled externally
      if (/\bid=['"]/i.test(snippet)) return false;
      // Exclude usage strings / doc comments where <input> is a filename placeholder, not HTML
      if (/Usage:|\*\s*Usage|#\s*Usage|usage:/i.test(snippet)) return false;
      if (/<input\.json|<input\.txt|<input\.csv/i.test(snippet)) return false;
      // Exclude non-HTML contexts (markdown, plain text docs)
      if (/\.md\b|\.txt\b/i.test(filePath) && !/\.(html|jsx|tsx|vue|svelte)$/i.test(filePath)) return false;
      return true;
    },
    message: 'Missing alt text, unlabeled input, or inaccessible button detected.',
  },
  sensitiveData: {
    id: 'sensitiveData',
    name: 'Sensitive Data Exposure',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'high',
    pattern:
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|console\.(log|warn|error|info)\s*\(\s*(?:user|customer|email|password|token|ssn|phone)|localStorage\.setItem\s*\(\s*['"](?:token|auth|session|password)/i,
    maxMatches: 3,
    redact: true,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude scripts/, coming-soon/, tools/, test files entirely
      if (/(^|\/)scripts\//i.test(filePath)) return false;
      if (/(^|\/)coming-soon(-dev)?\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tools\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tests\//i.test(filePath)) return false;
      if (/(^|\/)packages\/simplebeacon-cli\/tests\//i.test(filePath)) return false;
      if (/(^|\/)simplebeacon-rule-tests\//i.test(filePath)) return false;
      if (/(^|\/)ai-agent\//i.test(filePath)) return false;
      // Exclude when the "sensitive" word is only inside a string literal (message text)
      const hasVariable = /\b(?:token|password|secret|email|ssn|phone)\s*[,+)]/.test(snippet);
      const onlyInString = /['"][^'"]*(?:token|password|secret|email|ssn|phone)[^'"]*['"]/.test(snippet);
      if (!hasVariable && onlyInString) return false;
      // Exclude business emails from the project's own domain
      if (
        /\b(?:dev|audit|outreach|press|hello|certificates|sandbox|admin|user)@simplebeacon\.(?:ai|dev|local)\b/.test(
          snippet
        )
      )
        return false;
      // Exclude email regex definitions in privacy/redaction utilities
      if (/privacy-utils\.cjs/i.test(filePath) && /replace.*email.*REDACTED/i.test(snippet)) return false;
      if (/codebase-analyzer\.cjs/i.test(filePath)) return false;
      // Exclude test fixture data with fake SSNs/cards
      if (/test-gateway\.js/i.test(filePath) && /\b123-45-6789\b/.test(snippet)) return false;
      // Exclude CLI usage examples with example emails
      if (/generate-(token|account-token)/i.test(filePath) && /Usage:/i.test(snippet)) return false;
      if (/generate-(token|account-token)/i.test(filePath) && /example\.com|@company\.com/i.test(snippet)) return false;
      // Exclude pattern definitions describing sensitive data detection
      if (/scanner-patterns\.js/i.test(filePath) && /label.*Sensitive|section.*sensitiveData/i.test(snippet))
        return false;
      // Exclude fix registry and finding converter (remediation suggestions)
      if (/fixes[/\\](fixRegistry|findingConverter)/i.test(filePath)) return false;
      // Exclude privacy redaction utilities (contain email regex patterns)
      if (/privacy-utils\.cjs$/i.test(filePath)) return false;
      // Exclude server files with legitimate log labels containing email/token
      if (/index\.cjs$/i.test(filePath)) return false;
      // Exclude dashboard view files with string literals containing email patterns
      if (/AssessmentView\.js$/i.test(filePath)) return false;
      if (/AnalyzeView\.js$/i.test(filePath) && !/\.innerHTML/i.test(snippet)) return false;
      // Exclude CLI utility files
      if (/generate-license-token\.cjs$/i.test(filePath)) return false;
      // Exclude certificate-module.js default contact email placeholder
      if (/certificate-module\.js$/i.test(filePath) && /contactEmail|options\.contactEmail/.test(snippet)) return false;
      // Exclude email.cjs SMTP config (env vars, not hardcoded secrets)
      if (/email\.cjs$/i.test(filePath) && /SMTP_HOST|SMTP_PORT|SMTP_USER|pass/.test(snippet)) return false;
      // Exclude send-all-tier-emails.cjs mailto links
      if (/send-all-tier-emails\.cjs$/i.test(filePath)) return false;
      // Exclude db.test.cjs test fixture emails
      if (/db\.test\.cjs$/i.test(filePath)) return false;
      // Exclude auth-routes.test.js env var setup
      if (/auth-routes\.test\.js$/i.test(filePath)) return false;
      // Exclude setup.js test fixture data
      if (/setup\.js$/i.test(filePath)) return false;
      // Exclude placeholder example emails in HTML attributes or JS property assignments
      if (/\.placeholder\s*=\s*['"][^'"]*@.*\.com['"]|placeholder=['"][^'"]*@.*\.com['"]/.test(snippet)) return false;
      return true;
    },
    message: 'Potential PII or sensitive data exposure in logs or storage detected.',
  },
  configDrift: {
    id: 'configDrift',
    name: 'Configuration Drift',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'medium',
    pattern:
      /localhost:\d+|127\.0\.0\.1:\d+|0\.0\.0\.0:\d+|hardcoded.*url|\bpassword\s*=\s*['"]|\bsecret\s*=\s*['"]|\bapi_key\s*=\s*['"]/i,
    maxMatches: 3,
    redact: true,
    selfReferenceFilter: /message:\s*['"].*URL.*secret|\bpattern:\s*\/.*localhost|\bsection:\s*['"]configDrift['"]/i,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude scripts/, coming-soon/, tools/, test files entirely
      if (/(^|\/)scripts\//i.test(filePath)) return false;
      if (/(^|\/)coming-soon(-dev)?\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tools\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tests\//i.test(filePath)) return false;
      if (/(^|\/)packages\/simplebeacon-cli\/tests\//i.test(filePath)) return false;
      if (/(^|\/)simplebeacon-rule-tests\//i.test(filePath)) return false;
      if (/(^|\/)ai-agent\//i.test(filePath)) return false;
      // Exclude SVG namespace and W3C standard URLs
      if (/xmlns\s*=\s*['"]http:\/\/www\.w3\.org\//i.test(snippet)) return false;
      // Exclude URL strings that are just examples/docs
      if (/['"]http[s]?:\/\/.*['"]\s*[,)]/.test(snippet) && !/\bpassword\b|\bsecret\b|\bapi_key\b/.test(snippet))
        return false;
      // Exclude pattern definitions that describe config drift detection
      if (
        /scanner-patterns\.js|scanner-engine\.js|certificate-module\.js/i.test(filePath) &&
        /pattern.*localhost|label.*Config|section.*configDrift|detail.*hardcoded.*url/i.test(snippet)
      )
        return false;
      if (/test-all-patterns\.js/i.test(filePath)) return false;
      if (/codebase-analyzer\.cjs/i.test(filePath) && /pattern.*localhost|hardcoded|isExcludedPatternCatalogLine|isExcludedDebugLine/.test(snippet)) return false;
      // Exclude localhost in comments/docstrings explaining local dev
      if (/\/\/.*localhost|\*.*localhost|#.*localhost/i.test(snippet) && !/=['"]/.test(snippet)) return false;
      // Exclude pattern definition lines in workspaceAnalyzer itself
      if (/workspaceAnalyzer\.ts/i.test(filePath) && /pattern:|message:.*config|hardcoded.*url|localhost|127\.0\.0\.1/i.test(snippet))
        return false;
      // Exclude scanner's own source files from localhost/hardcoded URL findings
      if (/simplebeacon-vscode(?:-merged)?\/src\//i.test(filePath) && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(snippet)) return false;
      // Exclude standard test data directories from security-risk findings
      if (/(^|\/)(test|tests|__tests__|test-data|fixtures|mock-data|sample-data|examples?)\//i.test(filePath)) return false;
      // Exclude fixes registry and remediation provider (remediation suggestions mention hardcoded URLs)
      if (/fixes[/\\](fixRegistry|findingConverter|remediationProvider)/i.test(filePath)) return false;
      // Exclude files that define or describe config drift detection patterns
      if (
        /findingConverter\.ts$/i.test(filePath) &&
        /Configuration Drift|Move hardcoded|secrets to \.env/i.test(snippet)
      )
        return false;
      if (
        /remediationProvider\.ts$/i.test(filePath) &&
        /hardcoded URLs|configuration values|deployments frag/i.test(snippet)
      )
        return false;
      // Exclude files with known false-positive patterns
      if (/enhancedAIProvider\.ts$/i.test(filePath)) return false;
      if (/simplebeacon-frameworkless[/\\]app\.js$/i.test(filePath)) return false;
      if (/auto-processor\.js$/i.test(filePath)) return false;
      if (
        /AnalyzeView\.js$/i.test(filePath) &&
        /localhost|127\.0\.0\.1|deploy leaks|hardcoded URLs|\.env files/i.test(snippet)
      )
        return false;
      if (/SettingsView\.js$/i.test(filePath) && /localhost|127\.0\.0\.1/i.test(snippet)) return false;
      // Exclude main.js free-token API endpoint (static reference URL, not config drift)
      if (/main\.js$/i.test(filePath) && /free-token|127\.0\.0\.1:3000/.test(snippet)) return false;
      // Exclude agency-handoff-patterns.js pattern definition references to localhost
      if (/agency-handoff-patterns\.js$/i.test(filePath)) return false;
      return true;
    },
    message: 'Hardcoded URL, secret, or .env reference detected. Use environment-based configuration.',
  },
  dbAntiPattern: {
    id: 'dbAntiPattern',
    name: 'Database Anti-Pattern',
    appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby'],
    severity: 'high',
    pattern:
      /SELECT\s+.*['"]\s*\+\s*['"]|query\s*\(\s*['"].*\+\s*['"]|raw\s*\(\s*['"].*\$\{|\.findAll\s*\(\s*\)(?!.*limit)/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude test fixture data that intentionally shows bad SQL for pattern matching
      if (/test-all-patterns\.js$/i.test(filePath)) return false;
      // Exclude pattern definition files that describe SQL injection detection
      if (
        /scanner-patterns\.js|scanner-engine\.js|pattern-documentation\.js/i.test(filePath) &&
        /label.*SQL|message.*query|desc.*parameterized/i.test(snippet)
      )
        return false;
      return true;
    },
    message: 'Raw SQL concatenation or unbounded query detected. Use parameterized queries and pagination.',
  },
  evalDanger: {
    id: 'evalDanger',
    name: 'Dangerous eval() Usage',
    appliesTo: ['javascript', 'python', 'php', 'ruby'],
    severity: 'high',
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]|\bsystem\s*\(/i,
    maxMatches: 3,
    selfReferenceFilter:
      /id:\s*['"]evalDanger['"]|\bname:\s*['"]Dangerous eval\(\)|message:\s*['"]eval\(\)|\/\/\s*Scanner rule definitions that detect eval|\/\/\s*CLI rule files use new Function/i,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude scripts/, coming-soon/, tools/, test files entirely
      if (/(^|\/)scripts\//i.test(filePath)) return false;
      if (/(^|\/)coming-soon(-dev)?\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tools\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tests\//i.test(filePath)) return false;
      if (/(^|\/)packages\/simplebeacon-cli\/tests\//i.test(filePath)) return false;
      if (/(^|\/)simplebeacon-rule-tests\//i.test(filePath)) return false;
      if (/(^|\/)ai-agent\//i.test(filePath)) return false;
      // CLI rule files use new Function() for pattern evaluation
      if (/packages[/\\]simplebeacon-cli[/\\]src[/\\]rules[/\\]/i.test(filePath)) return false;
      // CLI analyzer utilities use dynamic code execution for pattern matching
      if (/packages[/\\]simplebeacon-cli[/\\]src[/\\]analyzers[/\\]/i.test(filePath)) return false;
      // Scanner rule definitions that detect eval (not actual eval usage)
      if (/message:\s*['"]eval\(\)/i.test(snippet)) return false;
      if (/severity.*warning.*eval-usage/i.test(snippet)) return false;
      // new RegExp() is safe regex construction, not dynamic code execution
      if (/new\s+RegExp\s*\(/i.test(snippet)) return false;
      // Exclude 'system' when it's inside a string literal
      if (/['"][^'"]*system\s*\(/i.test(snippet) && !/[^'"]\)system\s*\(/.test(snippet)) return false;
      // Exclude pattern definition files that define system-call patterns
      if (/language-patterns[/\\]/i.test(filePath)) return false;
      if (/codebase-analyzer\.cjs/i.test(filePath) && /pattern.*system/i.test(snippet)) return false;
      // Exclude pattern definition descriptions in scanner-patterns.js, scanner-engine.js, certificate-module.js, ui-renderer.js, main.js
      if (
        /scanner-patterns\.js|scanner-engine\.js|certificate-module\.js|ui-renderer\.js|main\.js/i.test(filePath) &&
        /section:\s*['"]evalDanger['"]|label.*Eval|desc.*eval\(\)|id:\s*['"]eval-danger['"]/i.test(snippet)
      )
        return false;
      // Exclude workspaceAnalyzer.ts and enhancedAIProvider.ts pattern definition / false-positive filter lines
      if (
        /(?:workspaceAnalyzer|enhancedAIProvider)\.ts/i.test(filePath) &&
        /id:\s*['"]evalDanger['"]|name:\s*['"]Dangerous eval|message:\s*['"]eval\(\)|\.exec\(|\.match\(|dangerous eval/i.test(snippet)
      )
        return false;
      // Exclude fixes registry and remediation provider (remediation suggestions mention eval)
      if (/fixes[/\\](fixRegistry|findingConverter|remediationProvider)/i.test(filePath)) return false;
      // Exclude files with string-split eval patterns
      if (/AnalyzeView\.js$/i.test(filePath)) return false;
      // Exclude codebase-analyzer rule definition patterns
      if (/codebase-analyzer\.cjs$/i.test(filePath) && /system|eval|Function/i.test(snippet)) return false;
      // Exclude comment lines describing eval detection
      if (/\/\/.*detect eval|\/\/.*eval\(\) usage|\/\/.*rule files use new Function/i.test(snippet)) return false;
      // Exclude EU AI Act article comments in ui-renderer.js and scanner-engine.js (not eval)
      if (/ui-renderer\.js$/i.test(filePath) && /Art\.\s*9.*Risk management/.test(snippet)) return false;
      if (/scanner-engine\.js$/i.test(filePath) && /Art\.\s*9.*Risk management/.test(snippet)) return false;
      return true;
    },
    message: 'eval(), new Function(), or dynamic code execution — code injection risk. Use structured parsing instead.',
  },
  innerHtmlXss: {
    id: 'innerHtmlXss',
    name: 'innerHTML XSS Risk',
    appliesTo: ['javascript', 'typescript', 'html'],
    severity: 'medium',
    pattern: /\.innerHTML\s*=\s*[^'"]/i,
    maxMatches: 3,
    realtime: true,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude scripts/, coming-soon/, tools/, test files entirely
      if (/(^|\/)scripts\//i.test(filePath)) return false;
      if (/(^|\/)coming-soon(-dev)?\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tools\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tests\//i.test(filePath)) return false;
      if (/(^|\/)packages\/simplebeacon-cli\/tests\//i.test(filePath)) return false;
      if (/(^|\/)simplebeacon-rule-tests\//i.test(filePath)) return false;
      if (/(^|\/)ai-agent\//i.test(filePath)) return false;
      // Dashboard files intentionally build static HTML templates (no user input)
      if (/simplebeacon-dashboard[/\\]js[/\\](views|components|lib)[/\\]/i.test(filePath)) return false;
      if (/simplebeacon-dashboard[/\\]js[/\\]main\.js$/i.test(filePath)) return false;
      if (/dashboard-web[/\\]js(-es2018)?[/\\](views|components|lib|utils|services)[/\\]/i.test(filePath)) return false;
      if (/simplebeacon-frameworkless[/\\]app\.js$/i.test(filePath)) return false;
      // VS Code extension webview panels build HTML templates
      if (/simplebeacon-vscode(-merged)?[/\\]src[/\\]/i.test(filePath)) return false;
      // Server-side HTML generation files (controlled server output)
      if (/server[/\\]lib[/\\]complete-scan-audit-report\.cjs/i.test(filePath)) return false;
      if (/server[/\\]dlp-dashboard\.cjs/i.test(filePath)) return false;
      // Token-file-system.js static UI HTML (no user input)
      if (/token-file-system\.js$/i.test(filePath)) return false;
      // certificate-module.js static status HTML (no user input)
      if (/certificate-module\.js$/i.test(filePath)) return false;
      // contact.js handoff preview uses syntax-highlighted JSON (controlled content)
      if (/contact\.js$/i.test(filePath)) return false;
      // main.js static button HTML (no user input)
      if (/main\.js$/i.test(filePath) && /Copied|&#10003;/.test(snippet)) return false;
      // ui-renderer.js static scan preview HTML (no user input)
      if (/ui-renderer\.js$/i.test(filePath)) return false;
      // simplebeacon-ignore innerhtml-usage — pattern definition regex, not actual DOM assignment
      if (/\.innerHTML\s*=\s*['"]\s*['"]/.test(snippet)) return false;
      // Escaped content via textContent/innerHTML helper is safe
      if (/esc\s*\(/.test(snippet)) return false;
      return true;
    },
    message: 'Assigning to innerHTML without sanitization — XSS risk. Use textContent or DOMPurify.',
  },
  prototypePollution: {
    id: 'prototypePollution',
    name: 'Prototype Pollution Risk',
    appliesTo: ['javascript'],
    severity: 'high',
    pattern: /Object\.prototype\.|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
    maxMatches: 3,
    contextFilter: (snippet: string) => {
      // Object.prototype.hasOwnProperty.call() is the SAFE pattern
      if (/Object\.prototype\.hasOwnProperty\.call/i.test(snippet)) return false;
      // Object.prototype.toString.call() is also safe
      if (/Object\.prototype\.toString\.call/i.test(snippet)) return false;
      return true;
    },
    message:
      'Modifying Object.prototype or __proto__ — prototype pollution vulnerability. Use Object.create(null) or Map.',
  },
  unhandledPromise: {
    id: 'unhandledPromise',
    name: 'Unhandled Promise',
    appliesTo: ['javascript', 'typescript'],
    severity: 'medium',
    pattern: /\.then\s*\([^)]*\)(?!\s*\.(catch|finally))\s*;?\s*$/m,
    maxMatches: 3,
    contextFilter: (snippet: string) => {
      // Allow top-level await patterns
      if (/await\s+\w+\.then\s*\(/i.test(snippet)) return false;
      return true;
    },
    message: 'Promise chain missing .catch() handler — unhandled rejection. Add error handling.',
    fix: {
      description: 'Add .catch() handler to promise chain',
      search: /(\.then\s*\([^)]*\))\s*;?\s*$/m,
      replace: '$1.catch(err => console.error(err));',
      autoFixable: false,
      previewDiff: true,
    },
  },
  // Disabled per AGENTS.md: "Do not flag math operations (Math.random(), Math.pow()) or
  // standard test data directories as security risks." AI-hallucinated weak-crypto findings
  // on Math.random() are invalid; leave crypto audits to explicit dependency/static analysis.
  insecureRandom: {
    id: 'insecureRandom',
    name: 'Insecure Random for Security',
    appliesTo: ['javascript'],
    severity: 'low',
    pattern: /(?!)/, // intentionally disabled
    maxMatches: 0,
    contextFilter: () => false,
    message: 'Math.random() used for crypto/security — predictable values. Use crypto.randomBytes().',
    fix: {
      description: 'Replace Math.random() with crypto.randomBytes()',
      search: /Math\.random\s*\(\)/,
      replace: 'crypto.randomBytes(16).toString("hex")',
      autoFixable: false,
      previewDiff: true,
    },
  },
  loggingSecrets: {
    id: 'loggingSecrets',
    name: 'Sensitive Data in Logs',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'high',
    pattern:
      /console\.(log|warn|error|info)\s*\([^)]*(?:password|token|secret|apiKey|api_key|privateKey|private_key|credential)/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      // Exclude scripts/, coming-soon/, tools/, test files entirely
      if (/(^|\/)scripts\//i.test(filePath)) return false;
      if (/(^|\/)coming-soon(-dev)?\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tools\//i.test(filePath)) return false;
      if (/(^|\/)ai-platform\/tests\//i.test(filePath)) return false;
      if (/(^|\/)packages\/simplebeacon-cli\/tests\//i.test(filePath)) return false;
      if (/(^|\/)simplebeacon-rule-tests\//i.test(filePath)) return false;
      if (/(^|\/)ai-agent\//i.test(filePath)) return false;
      // Exclude when the sensitive word is only inside a string literal
      const hasVariable = /\b(?:password|token|secret|apiKey|api_key|privateKey|private_key|credential)\s*[,+)]/.test(
        snippet
      );
      const onlyInString =
        /['"][^'"]*(?:password|token|secret|apiKey|api_key|privateKey|private_key|credential)[^'"]*['"]/.test(snippet);
      if (!hasVariable && onlyInString) return false;
      // Exclude commented-out console.log lines
      if (/\/\/\s*console\.(log|error|warn)/i.test(snippet)) return false;
      // Exclude env var check / setup messages
      if (/Set.*env var|environment variable|requires.*SECRET|is not set|Run with --setup/i.test(snippet)) return false;
      // Exclude CLI setup script output headers
      if (/===.*Token.*Generator|Token is INVALID|Token Generator Setup/i.test(snippet)) return false;
      // Exclude error handling in catch blocks
      if (/catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/i.test(snippet)) return false;
      // Exclude token-file-system.js legitimate lock-corruption warnings
      if (/token-file-system\.js$/i.test(filePath) && /console\.(warn|error|log)/i.test(snippet)) return false;
      // Exclude main.js FreeToken HTTP error logging
      if (/main\.js$/i.test(filePath) && /console\.error.*HTTP|serverMsg/.test(snippet)) return false;
      // Exclude audit-token-bleed.js scan output headers
      if (/audit-token-bleed\.js$/i.test(filePath) && /console\.(log|warn)/i.test(snippet)) return false;
      // Exclude pattern definitions describing logging detection
      if (
        /scanner-patterns\.js|codebase-analyzer\.cjs|workspaceAnalyzer\.ts/i.test(filePath) &&
        /label.*Sensitive|message.*log|pattern.*console/i.test(snippet)
      )
        return false;
      // Exclude CLI entry points and API files with legitimate error logging
      if (/simplebeacon-billing-api\.cjs$/i.test(filePath)) return false;
      if (/simplebeacon\.js$/i.test(filePath)) return false;
      if (/enrich-complete-scan\.js$/i.test(filePath)) return false;
      return true;
    },
    message: 'Password, token, or secret value being logged. Remove secrets from log statements.',
  },
  llmSlop: {
    id: 'llmSlop',
    name: 'LLM Slop / Placeholder',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'html', 'json', 'yaml', 'yml'],
    severity: 'medium',
    pattern:
      /YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE|\[Insert\s[^\]]+\]|\/\/\s*Handle\s+this\s+later|99\.99\s*%?\s*Uptime|100\s*%?\s*Secure|Lorem\s+Ipsum\s+Dolor|9,999\s*Users/i,
    maxMatches: 5,
    contextFilter: (snippet: string, filePath: string) => {
      if (/\.template\.|\.example\.|\.sample\./i.test(filePath)) return false;
      if (/readme|docs?|guide|tutorial|example/i.test(filePath)) return false;
      if (/fixture|mock|test-data|__tests__|spec/i.test(filePath)) return false;
      if (/\/\/\s*TODO:?|\/\/\s*FIXME:?/i.test(snippet) && !/AI\s+Generated|Placeholder/i.test(snippet)) return false;
      return true;
    },
    message: 'Unresolved LLM placeholder or hardcoded AI-default metric copy detected.',
  },
  productionLeak: {
    id: 'productionLeak',
    name: 'Production Leak',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'medium',
    pattern:
      /mock\w*\.json|fixture\w*\.json|sample\w*\.json|test\w*\.json|demo\w*\.json|placeholder|your_|my_|change_me|replace_me|xxxx|todo\.json|spec\.json|testdata|test_data|test-fixture|sample-data|sample_report|sample-report|sampleReport|mockData|mock_data|fixtureData|fixture_data/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      if (/(^|[\\/])tests?[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])__tests__[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])test[\\-]/i.test(filePath)) return false;
      if (/(^|[\\/])spec[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])coming-soon[\\/]archive[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])packages[\\/]simplebeacon-cli[\\/]tests[\\/]/i.test(filePath)) return false;
      if (/\.(test|spec)\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|php|rb|cs|vb)$/i.test(filePath)) return false;
      if (/pattern-documentation|scanner-engine|scanner-patterns|ui-renderer/i.test(filePath)) return false;
      // Skip feature name strings like 'mock-data', 'sample-report' in config/maps
      if (/['"]mock-data['"]|['"]sample-report['"]|['"]mockData['"]|['"]mock_data['"]/i.test(snippet)) return false;
      // Skip HTML file names in arrays (not mock data paths)
      if (/\['"][\w-]+\.(html|json)['"]/i.test(snippet) && !/path|dir|folder|url|src/i.test(snippet)) return false;
      // Skip variable/property names containing mock/sample (not file paths)
      if (/\.(mockData|mockSample|sampleFiles|sampleReportUrl|mockDataCategories)\b/i.test(snippet)) return false;
      // Skip function names with sample/mock
      if (/function\s+\w*(sample|mock|demo)/i.test(snippet)) return false;
      // Skip comments about demo/placeholder values
      if (/\/\/.*demo|example|test|placeholder|your_|my_/i.test(snippet)) return false;
      // Skip certificate module definitions
      if (/certificate-module\.js$/i.test(filePath) && /moduleId|section|title|metricLabel|advice/i.test(snippet)) return false;
      // Skip product plan descriptions
      if (/plans\.cjs$/i.test(filePath)) return false;
      // Skip server.cjs demo pattern definitions
      if (/server\.cjs$/i.test(filePath) && /DEMO_PATTERNS/i.test(snippet)) return false;
      // Skip token-file-system innerHTML with placeholder labels
      if (/token-file-system\.js$/i.test(filePath) && /innerHTML|placeholder/i.test(snippet)) return false;
      // Skip build-public.js progress logging
      if (/build-public\.js$/i.test(filePath) && /console\.log|Copied/i.test(snippet)) return false;
      // Skip HTML input placeholder attributes in template strings (not mock data leaks)
      if (/placeholder=["'][^"']*["']/.test(snippet) && /<input|<div\s+class=["'][^"']*section/.test(snippet)) return false;
      // Skip VS Code extension webview HTML templates
      if (/simplebeacon-vscode(-merged)?[/\\]src[/\\]/i.test(filePath) && /<input|<div\s+class=["'][^"']*section/.test(snippet)) return false;
      // Skip legitimate data/config file references in server config
      if (/config\.(js|cjs|json)$/i.test(filePath) && /sample|mock|fixture|demo|testdata/i.test(snippet)) return false;
      // Skip route/service files that handle data exports (legitimate business logic)
      if (/(export|route|service|api)\.(js|cjs)$/i.test(filePath) && /sample|mock|fixture|demo|testdata/i.test(snippet)) return false;
      // Skip analytics/builder files that process sample data
      if (/analytics|builder|generator\.cjs$/i.test(filePath) && /sample|mock|fixture|demo/i.test(snippet)) return false;
      // Skip mock-data infrastructure files whose sole purpose is handling mock/sample data
      if (/mock-data-helpers|simplebeacon-proxy|snapshot-seeds|sample-path-resolver|sample-consistency-checker|page-sample-specs|mock-data-scanner|code-roadmap-generator|file-merger-reduction-scanner|data-lineage-analyzer|unused-file-detector|scan-conclusion|marketing-content-generator/i.test(filePath)) return false;
      // Skip scanner CLI root files that legitimately reference mock data paths
      if (/\/(scan|index|config-schema|project-detect|assessment)\.c?js$/i.test(filePath)) return false;
      // Skip dashboard export utilities that process report data
      if (/-export\.browser\.js$|export\.browser\.js$/i.test(filePath)) return false;
      // Skip dashboard components/views that display scan results (legitimate reference to report data)
      if (/CodebaseReport\.js$|HelpView\.js$|ResultsView\.js$|AnalyzeView\.js$/i.test(filePath)) return false;
      // Skip analysis/service files that process scan data
      if (/completeScanAnalysis\.js$|aiProblemAnalyzerSuite\.mjs$/i.test(filePath)) return false;
      // Skip reporter files that generate output from scan data
      if (/audit-report\.js$|remediation-guides\.js$/i.test(filePath)) return false;
      // Skip MCP tool definitions that reference mock data for examples
      if (/mcp[/\\]tools\.js$/i.test(filePath)) return false;
      // Skip web data injection files
      if (/roadmap-ai-agent-localstorage-inject\.js$/i.test(filePath)) return false;
      // Skip security middleware that references mock paths in validation schemas
      if (/middleware[/\\]security\.cjs$/i.test(filePath)) return false;
      // Skip analyze-mode file scope utility which explicitly annotates mock path references
      if (/analyze-mode-file-scope\.browser\.js$/i.test(filePath)) return false;
      // Skip files with explicit production-leak-intent annotation (same as CLI rule)
      if (/simplebeacon:production-leak-intent/i.test(snippet)) return false;
      return true;
    },
    message: 'Mock/fixture data path referenced in production source. Replace with environment-based configuration or runtime discovery.',
  },
  governanceMarker: {
    id: 'governanceMarker',
    name: 'License/Governance Marker',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'low',
    pattern:
      /SPDX-License-Identifier|Copyright\s*\(c\)|©\s*\d{4}|All rights reserved|Licensed under|MIT License|Apache License|GPL License|BSD License|Mozilla Public License|EU AI Act|high.risk|transparency gap|conformity|bias.audit|data.governance|Article\s*14|Annex\s*III/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      if (/\.md$/i.test(filePath)) return false;
      if (/GOVERNANCE\.md/i.test(filePath)) return false;
      if (/LICENSE/i.test(filePath)) return false;
      if (/\.simplebeacon[\\/]/i.test(filePath)) return false;
      // EU AI Act is SimpleBeacon's core product feature — exclude ALL files implementing it
      if (/eu-ai-act/i.test(filePath)) return false;
      if (/ai-platform[\\/]/i.test(filePath)) return false;
      if (/packages[\\/]simplebeacon-cli[\\/]/i.test(filePath)) return false;
      if (/compliance-rules\.cjs$/i.test(filePath)) return false;
      if (/ai-proxy-gateway\.cjs$/i.test(filePath)) return false;
      if (/cloud-inference-service\.cjs$/i.test(filePath)) return false;
      if (/strategic-insights-engine\.cjs$/i.test(filePath)) return false;
      if (/dlp-dashboard\.cjs$/i.test(filePath)) return false;
      if (/operator-deliverable-service\.cjs$/i.test(filePath)) return false;
      if (/register-operator-routes\.cjs$/i.test(filePath)) return false;
      if (/user-ai-keys-store\.cjs$/i.test(filePath)) return false;
      if (/chatbot-api\.cjs$/i.test(filePath)) return false;
      if (/compliance-schema-api\.cjs$/i.test(filePath)) return false;
      if (/flexible-analyze-api\.cjs$/i.test(filePath)) return false;
      if (/scan-report-patch\.cjs$/i.test(filePath)) return false;
      if (/slm-bridge\.js$/i.test(filePath)) return false;
      if (/intent-scanner\.js$/i.test(filePath)) return false;
      if (/certificate-utils/i.test(filePath) && /transparency|conformity|bias/i.test(snippet)) return false;
      if (/scan-worker|scanner-engine|scanner-patterns/i.test(filePath) && /ai.system|high.risk|transparency|conformity|bias/i.test(snippet)) return false;
      // Skip product descriptions and pricing content
      if (/site-config\.js$/i.test(filePath) && /subtitle|description|EU AI Act|compliance|quarterly/i.test(snippet)) return false;
      if (/subscriptions-billing\.cjs$/i.test(filePath)) return false;
      if (/checkout\.cjs$/i.test(filePath)) return false;
      if (/plans\.cjs$/i.test(filePath)) return false;
      // Skip feature name mappings (e.g., 'eu-ai-act': 'EU AI Act')
      if (/['"]eu-ai-act['"]|['"]euaiact['"]/i.test(snippet)) return false;
      // Skip certificate module titles and labels
      if (/certificates\.cjs$/i.test(filePath) && /EU AI Act|Readiness|compliance/i.test(snippet)) return false;
      if (/certificate-module\.js$/i.test(filePath) && /label|title|moduleId|section/i.test(snippet)) return false;
      if (/certificate-utils\.cjs$/i.test(filePath) && /label|kicker|subtitle|EU AI Act/i.test(snippet)) return false;
      if (/certificate-generator\.cjs$/i.test(filePath) && /label|kicker|subtitle|EU AI Act/i.test(snippet)) return false;
      // Skip contact.js pricing page content
      if (/contact\.js$/i.test(filePath) && /EU AI Act|Sprint|\$/.test(snippet)) return false;
      // Skip token-manager feature category names
      if (/token-manager\.js$/i.test(filePath) && /'eu-ai-act'|'compliance'|'cleanup'/.test(snippet)) return false;
      // Skip phase-registry roadmap titles
      if (/phase-registry\.js$/i.test(filePath) && /title.*EU AI Act|id.*euaiact/i.test(snippet)) return false;
      // Skip main.js module data mappings
      if (/main\.js$/i.test(filePath) && /'eu-ai-act'|'magic-number'|moduleKeyMap|dataMapping/i.test(snippet)) return false;
      // Skip ui-renderer.js EU AI Act comments and builder descriptions
      if (/ui-renderer\.js$/i.test(filePath) && /EU AI Act|control builder|compliance/i.test(snippet)) return false;
      // Skip outreach-prospects.js fictional demo data
      if (/outreach-prospects\.js$/i.test(filePath)) return false;
      // Skip "High Risk" / "high-risk" / "High risks" in UI labels/score badges (not governance)
      if (/['"](?:High|high)[- ]?[Rr]isk['"]|label.*[Rr]isk|ringColor|cssVar|className.*risk|class.*risk/i.test(snippet)) return false;
      // Suppress governance terms used in dashboard-web UI templates/HTML strings
      if (/(^|[\\/])dashboard-web[\\/]js(-es2018)?[\\/]/i.test(filePath) && /[<>]|\$\{|innerHTML|className|class=|style=/.test(snippet)) return false;
      // Skip VS Code extension webview panels that render EU AI Act UI labels and color maps
      if (/simplebeacon-vscode(-merged)?[/\\]src[/\\]/i.test(filePath) && /['"]EU AI Act['"]\s*[:=]\s*['"]|push\('EU AI Act'|case\s+['"]EU AI Act['"]|option\s+value=["']EU AI Act["']|Phase\s*\d*\s*:\s*EU AI Act|EU AI Act:\s*\$\{|['"]euaiact['"]/i.test(snippet)) return false;
      // Skip color/severity map definitions containing EU AI Act
      if (/['"]EU AI Act['"]\s*[:=]\s*['"](#|var\(--)/i.test(snippet)) return false;
      // Skip pattern definition files that define governance detection regexes
      if (/workspaceAnalyzer\.ts$/i.test(filePath) && /pattern.*spdx|pattern.*mit license|contextFilter.*governance|site-config\.js/i.test(snippet)) return false;
      if (/enhancedAIProvider\.ts$/i.test(filePath) && /spdx-license-identifier|mit license|site-config\.js/i.test(snippet)) return false;
      if (/remediationProvider\.ts$/i.test(filePath) && /spdx-license-identifier|mit license/i.test(snippet)) return false;
      // Skip ALL governance markers when they appear in comments/JSDoc blocks.
      // SimpleBeacon's own source code extensively documents EU AI Act features
      // in JSDoc comments — these are not compliance violations.
      const hasCommentMarker = /(\/\/|\/\*|\*\s|#\s)/.test(snippet);
      if (hasCommentMarker) {
        // Suppress license headers (legally required, not issues)
        const isLicenseHeader = /(SPDX-License-Identifier|Copyright\s*\(c\)|©\s*\d{4}|All rights reserved|Licensed under|MIT License|Apache License|GPL License|BSD License)/i.test(snippet);
        // Suppress EU AI Act product documentation in JSDoc/comment blocks
        const isEuAiActDoc = /(EU AI Act|Article\s*14|Annex\s*III|high\.risk|transparency\s*gap|conformity|bias\.audit|data\.governance)/i.test(snippet);
        if (isLicenseHeader || isEuAiActDoc) return false;
      }
      // Also suppress if snippet is clearly a regex pattern definition containing license terms
      if (/workspaceAnalyzer\.ts$/i.test(filePath) && /pattern.*spdx|pattern.*mit license|pattern.*copyright|contextFilter.*governance/i.test(snippet)) return false;
      if (/enhancedAIProvider\.ts$/i.test(filePath) && /spdx-license-identifier|mit license|copyright/i.test(snippet)) return false;
      if (/remediationProvider\.ts$/i.test(filePath) && /spdx-license-identifier|mit license|copyright/i.test(snippet)) return false;
      // Skip package.json license fields
      if (/"license"\s*:\s*"(MIT|Apache|GPL|BSD|ISC)"/i.test(snippet)) return false;
      // Skip README/LICENSE files entirely
      if (/\/(README|LICENSE|COPYING|NOTICE)(\.md|\.txt)?$/i.test(filePath)) return false;
      return true;
    },
    message: 'License header or governance marker detected. Verify compliance with open-source policy.',
  },
  maintainabilityIssue: {
    id: 'maintainabilityIssue',
    name: 'Maintainability Issue',
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    severity: 'low',
    pattern:
      /TODO\s*:?\s*implement|TODO\s*:?\s*fix|TODO\s*:?\s*review|FIXME\s*:?\s*broken|FIXME\s*:?\s*now|HACK\s*:?|XXX\s*:?|magic\s+number|\b\d{3,}\b.*\b(ms|px|rem|em|s|min|hours|days)\b|\b(timeout|delay|interval|max|min|limit|retry|attempt)\s*=\s*\d{3,}/i,
    maxMatches: 3,
    contextFilter: (snippet: string, filePath: string) => {
      if (/(^|[\\/])tests?[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])__tests__[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])coming-soon[\\/]archive[\\/]/i.test(filePath)) return false;
      if (/(^|[\\/])packages[\\/]simplebeacon-cli[\\/]tests[\\/]/i.test(filePath)) return false;
      if (/file-quality-heuristics/i.test(filePath)) return false;
      if (/pattern-documentation/i.test(filePath) && /TODO|FIXME/i.test(snippet)) return false;
      if (/quick-actions/i.test(filePath) && /TODO|FIXME/i.test(snippet)) return false;
      if (/test-all-patterns/i.test(filePath)) return false;
      if (/scanner-engine/i.test(filePath) && /TODO|FIXME|maintainability/i.test(snippet)) return false;
      if (/scanner-patterns/i.test(filePath) && /TODO|FIXME|maintainability/i.test(snippet)) return false;
      // Skip scanner's own TODO/FIXME regex patterns (not actual TODOs)
      if (/scan-worker\.js$/i.test(filePath) && /pattern.*TODO|pattern.*FIXME|RegExp.*TODO/i.test(snippet)) return false;
      if (/scan-directory\.js$/i.test(filePath) && /todo.*TODO|todo.*FIXME|RegExp/i.test(snippet)) return false;
      // Skip module mapping definitions
      if (/main\.js$/i.test(filePath) && /'magic-number'|'maintainability'|moduleKeyMap|dataMapping/i.test(snippet)) return false;
      if (/certificate-module\.js$/i.test(filePath) && /moduleId.*44|section.*magicNumber|title.*Magic/i.test(snippet)) return false;
      // Skip progress/score computation formulas using 100
      if (/phase-registry\.js$/i.test(filePath) && /progress.*100|Math\.max.*5.*Math\.min.*100|issues.*weight/i.test(snippet)) return false;
      // Skip pagination limit defaults (100, 200)
      if (/function.*getPendingEmails|function.*getAdminLogs|function.*getAuditLogs/i.test(snippet) && /limit\s*=\s*(100|200)/i.test(snippet)) return false;
      if (/db\.cjs$/i.test(filePath) && /limit\s*=\s*(100|200)/i.test(snippet)) return false;
      if (/system-logger\.cjs$/i.test(filePath) && /limit\s*=\s*(100|200)/i.test(snippet)) return false;
      if (/admin-token\.cjs$/i.test(filePath) && /limit\s*=\s*(100|200)/i.test(snippet)) return false;
      // Skip certificate score thresholds (70, 80, etc.)
      if (/certificate-utils\.cjs$/i.test(filePath) && /qs\s*<\s*\d+|severity.*qs|scoreThreshold/i.test(snippet)) return false;
      // Skip server.cjs demo pattern array definitions
      if (/server\.cjs$/i.test(filePath) && /DEMO_PATTERNS|const.*=\s*\[.*'demo'/i.test(snippet)) return false;
      // Skip font-size CSS values in template strings
      if (/font-size:\s*\d+\.?\d*rem/i.test(snippet) && /buildDetail|detail-label/i.test(snippet)) return false;
      // Skip regex pattern definitions containing TODO/FIXME/HACK/XXX
      if (/regex:\s*['"`][^'"`]*TODO\|FIXME\|HACK\|XXX['"`]|RegExp.*TODO.*FIXME/i.test(snippet)) return false;
      // Skip CSS template strings with pixel/rem/em values (not magic numbers)
      if (/font-size:\s*\d+\.?\d*rem|min-width:\s*\d+px|font-weight:\s*\d+/i.test(snippet)) return false;
      // Skip time constants like 7 * 24 * 60 * 60 * 1000 (ms in N days)
      if (/\d+\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(snippet)) return false;
      // Skip function parameter defaults with timeout
      if (/function\s+\w+\s*\([^)]*timeout\s*=\s*\d+/.test(snippet)) return false;
      // Skip score display strings with /100
      if (/\$\{[^}]*\}\/100|Score:\s*\$\{[^}]*\}\/100|issueCount.*issue\$\{issueCount/i.test(snippet)) return false;
      // Skip pattern definitions for maintainability/magic numbers
      if (/workspaceAnalyzer\.ts$/i.test(filePath) && /magic\s+number|maintainability|TODO.*implement|replace\s+constants/i.test(snippet)) return false;
      if (/enhancedAIProvider\.ts$/i.test(filePath) && /magic\s+number|named\s+constants|replace\s+constants/i.test(snippet)) return false;
      if (/remediationProvider\.ts$/i.test(filePath) && /magic\s+number|named\s+constants/i.test(snippet)) return false;
      // Skip coming-soon marketing site (not production code)
      if (/(^|\/)coming-soon(-dev)?\//i.test(filePath)) return false;
      // Skip TODO/FIXME in comments that are clearly pattern definitions or documentation
      if (/\/\/.\s*TODO.*implement|TODO.*review|TODO.*fix|FIXME.*broken|FIXME.*now/i.test(snippet) && /pattern|regex|scanner|analyzer|workspaceAnalyzer/i.test(filePath)) return false;
      // Skip TODO markers in issue tracking / roadmap files
      if (/roadmap|TODO\.md|CHANGELOG|CONTRIBUTING/i.test(filePath)) return false;
      // Skip magic numbers in CSS/styling contexts (common values like font sizes, widths)
      if (/font-size:\s*\d+\.?\d*(px|rem|em)|width:\s*\d+\.?\d*(px|%|rem)|height:\s*\d+\.?\d*(px|%|rem)|padding:\s*\d+\.?\d*(px|rem)|margin:\s*\d+\.?\d*(px|rem)/i.test(snippet)) return false;
      // Skip common timeout/polling intervals (100, 200, 500, 1000, 2000, 5000, 10000)
      if (/setTimeout|setInterval|poll|retry|delay.*=.*\b(100|200|250|500|1000|1500|2000|3000|5000|10000)\b/i.test(snippet)) return false;
      // Skip HTTP status codes and port numbers
      if (/statusCode|status.*\b(200|201|204|301|302|400|401|403|404|500|502|503)\b|port.*\b(3000|3001|3002|5432|6379|8080|8443)\b/i.test(snippet)) return false;
      // Skip array indices and common loop bounds
      if (/\[\s*(0|1|2|3|4|5)\s*\]|\.length\s*[\-+]\s*1|for\s*\(.*\b(length|count|size)\b/i.test(snippet)) return false;
      // Skip common RGB/color values
      if (/rgba?\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/i.test(snippet)) return false;
      return true;
    },
    message: 'TODO/FIXME marker or magic number detected. Extract constants and resolve before release.',
  },
};

export interface AnalyzerPreset {
  label: string;
  description: string;
  patternIds: string[];
}

export const ANALYZER_PRESETS: Record<string, AnalyzerPreset> = {
  essential: {
    label: 'Essential',
    description: 'Credential hygiene, security risks, and error swallowing',
    patternIds: [
      'credentials',
      'sensitiveData',
      'evalDanger',
      'dbAntiPattern',
      'aiResidueSwallow',
      'loggingSecrets',
      'innerHtmlXss',
      'prototypePollution',
    ],
  },
  security: {
    label: 'Security',
    description: 'All security-focused scans',
    patternIds: [
      'credentials',
      'sensitiveData',
      'evalDanger',
      'dbAntiPattern',
      'configDrift',
      'innerHtmlXss',
      'prototypePollution',
      'loggingSecrets',
      'hallucinatedImport',
    ],
  },
  full: {
    label: 'Full',
    description: 'All available scans',
    patternIds: [...Object.keys(PATTERN_REGISTRY), 'hallucinatedImport'],
  },
  custom: {
    label: 'Custom',
    description: 'Manual selection',
    patternIds: [],
  },
};

const ANALYZER_SCHEMA: Record<string, AnalyzerSchemaEntry> = {
  credentials: { category: 'security' },
  debugArtifacts: { category: 'debug' },
  aiResidueStub: { category: 'aiResidue' },
  aiResidueSwallow: { category: 'aiResidue' },
  perfNestedLoop: { category: 'performance' },
  typeSafetyAny: { category: 'typeSafety' },
  missingTest: { category: 'testCoverage' },
  a11yGap: { category: 'accessibility' },
  sensitiveData: { category: 'security' },
  configDrift: { category: 'security' },
  dbAntiPattern: { category: 'security' },
  evalDanger: { category: 'security' },
  innerHtmlXss: { category: 'security' },
  prototypePollution: { category: 'security' },
  unhandledPromise: { category: 'quality' },
  insecureRandom: { category: 'security' },
  loggingSecrets: { category: 'security' },
  llmSlop: { category: 'aiResidue' },
  productionLeak: { category: 'security' },
  governanceMarker: { category: 'governance' },
  maintainabilityIssue: { category: 'maintainability' },
  hallucinatedImport: { category: 'security' },
};

// ============================================================================
// Build Readiness Analyzer
// ============================================================================

interface BuildCheckDef {
  name: string;
  regex: RegExp | null;
  customCheck?: (paths: string[]) => boolean;
  critical: boolean;
}

const BUILD_CHECK_REGISTRY: Record<string, BuildCheckDef[]> = {
  javascript: [
    { name: 'package.json', regex: /(^|\/)package\.json$/, critical: true },
    {
      name: 'Lockfile',
      regex: /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|bun\.lock)$/,
      critical: true,
    },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: 'CHANGELOG', regex: /(^|\/)(changelog|changes|history)/i, critical: false },
    {
      name: 'Tests',
      regex: /(^|\/)(test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress)/i,
      critical: true,
    },
    {
      name: 'CI/CD',
      regex:
        /(^|\/)(\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|build\.yml|deploy\.yml)/i,
      critical: true,
    },
    { name: 'Docker', regex: /(^|\/)(dockerfile|docker-compose|\.dockerignore)/i, critical: false },
    { name: 'Linting/Formatting', regex: /(^|\/)(eslint|prettier|\.editorconfig|lint-staged|husky)/i, critical: false },
    { name: 'TypeScript Config', regex: /(^|\/)(tsconfig|\.ts$)/i, critical: false },
    {
      name: 'Build Tool Config',
      regex: /(^|\/)(webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile)/i,
      critical: false,
    },
    { name: 'Dev Server / HMR', regex: /(^|\/)(vite\.config|webpack\.dev|nodemon|live-reload|hmr)/i, critical: false },
    { name: '.env.example', regex: /(^|\/)\.env\.(example|sample|template)/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
    {
      name: 'Build artifacts ignored',
      regex: null,
      customCheck: (paths) => !paths.some((p) => /\/(dist|build|\.next|out)\//.test(p) && !/node_modules\//.test(p)),
      critical: true,
    },
    { name: 'Git LFS config', regex: /(^|\/)\.gitattributes/, critical: false },
    { name: 'Build cache config', regex: /(^|\/)(\.eslintcache|\.parcel-cache|\.next\/cache)/i, critical: false },
    { name: '.npmignore', regex: /(^|\/)\.npmignore$/, critical: false },
  ],
  python: [
    { name: 'pyproject.toml / setup.py', regex: /(^|\/)(pyproject\.toml|setup\.py)/, critical: true },
    { name: 'requirements.txt', regex: /(^|\/)requirements.*\.txt/, critical: true },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: 'Tests', regex: /(^|\/)(test|spec|pytest|unittest)/i, critical: true },
    { name: 'CI/CD', regex: /(^|\/)(\.github\/workflows|\.gitlab-ci|jenkins|\.travis)/i, critical: false },
    { name: 'Docker', regex: /(^|\/)(dockerfile|docker-compose)/i, critical: false },
    { name: '.env.example', regex: /(^|\/)\.env\.(example|sample)/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
  java: [
    { name: 'pom.xml / build.gradle', regex: /(^|\/)(pom\.xml|build\.gradle)/, critical: true },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: 'Tests', regex: /(^|\/)(test|spec|junit|testng)/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
  go: [
    { name: 'go.mod', regex: /(^|\/)go\.mod$/, critical: true },
    { name: 'go.sum', regex: /(^|\/)go\.sum$/, critical: true },
    { name: 'Makefile', regex: /(^|\/)makefile/i, critical: false },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
  rust: [
    { name: 'Cargo.toml', regex: /(^|\/)Cargo\.toml$/, critical: true },
    { name: 'Cargo.lock', regex: /(^|\/)Cargo\.lock$/, critical: true },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
  php: [
    { name: 'composer.json', regex: /(^|\/)composer\.json$/, critical: true },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: 'Tests', regex: /(^|\/)(test|spec|phpunit)/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
  ruby: [
    { name: 'Gemfile', regex: /(^|\/)Gemfile$/, critical: true },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: 'Tests', regex: /(^|\/)(test|spec|rspec)/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
  dotnet: [
    { name: '.csproj / .sln', regex: /(^|\/)(\.csproj|\.sln)/, critical: true },
    { name: 'README', regex: /(^|\/)readme\.?/i, critical: true },
    { name: 'Tests', regex: /(^|\/)(test|spec|xunit|nunit|mstest)/i, critical: true },
    { name: '.gitignore', regex: /(^|\/)\.gitignore$/, critical: true },
  ],
};

function detectDominantLanguage(paths: string[]): string {
  const counts: Record<string, number> = {};
  for (const p of paths) {
    const ext = (p.match(/\.([^.]+)$/) || [null, ''])[1].toLowerCase();
    for (const [langKey, defs] of Object.entries(BUILD_CHECK_REGISTRY)) {
      const firstDef = defs[0];
      // Infer language from file extensions of critical files (e.g., package.json -> javascript)
      if (langKey === 'javascript' && ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'].includes(ext)) {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'python' && ['py', 'pyw', 'pyi'].includes(ext)) {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'java' && ['java', 'kt', 'scala', 'groovy'].includes(ext)) {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'go' && ext === 'go') {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'rust' && ext === 'rs') {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'php' && ext === 'php') {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'ruby' && ext === 'rb') {
        counts[langKey] = (counts[langKey] || 0) + 1;
      } else if (langKey === 'dotnet' && ['cs', 'vb'].includes(ext)) {
        counts[langKey] = (counts[langKey] || 0) + 1;
      }
    }
  }
  let dominant = 'javascript';
  let maxCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = lang;
    }
  }
  return dominant;
}

function analyzeBuildReadiness(allPaths: string[]): BuildReadinessResult {
  const lowerPaths = allPaths.map((p) => p.toLowerCase().replace(/\\/g, '/'));
  const dominantLang = detectDominantLanguage(allPaths);
  const checks = BUILD_CHECK_REGISTRY[dominantLang] || BUILD_CHECK_REGISTRY.javascript;

  const brChecks: BuildReadinessCheck[] = checks.map((check) => ({
    name: check.name,
    found: check.customCheck
      ? check.customCheck(lowerPaths)
      : check.regex
        ? lowerPaths.some((p) => check.regex!.test(p))
        : false,
    critical: check.critical,
  }));

  const missingCritical = brChecks.filter((c) => c.critical && !c.found);
  const missingNice = brChecks.filter((c) => !c.critical && !c.found);
  const score = Math.round((brChecks.filter((c) => c.found).length / brChecks.length) * 100);

  return {
    readinessScore: score,
    readinessStatus: score >= 80 ? 'READY' : score >= 50 ? 'NEEDS WORK' : 'BLOCKED',
    totalChecks: brChecks.length,
    passedChecks: brChecks.filter((c) => c.found).length,
    missingCritical: missingCritical.map((c) => c.name),
    missingRecommended: missingNice.map((c) => c.name),
    checklist: brChecks,
    summary: `${score >= 80 ? 'READY' : score >= 50 ? 'NEEDS WORK' : 'BLOCKED'} — ${brChecks.filter((c) => c.found).length} of ${brChecks.length} checklist items present.${missingCritical.length ? ` ${missingCritical.length} critical blocker${missingCritical.length === 1 ? '' : 's'}.` : ''}`,
    remediation:
      missingCritical.length > 0
        ? `Missing critical: ${missingCritical.map((c) => c.name).join(', ')}.`
        : missingNice.length > 0
          ? `Missing recommended: ${missingNice.map((c) => c.name).join(', ')}.`
          : 'No remediation needed.',
    recommendations:
      missingCritical.length > 0
        ? [
            'Add all critical files before production deployment.',
            'Start with package.json, README, .gitignore, && .env.example.',
          ]
        : missingNice.length > 0
          ? ['Add recommended files to improve maintainability.', 'Consider Docker, linting config, && CHANGELOG.']
          : ['Project is fully ready for production. All checklist items present.'],
  };
}

function normalizeDirPattern(pattern: string): string {
  return pattern.replace(/\/+$/, '').replace(/\/\*\*$/, '');
}

async function findFilesRecursive(root: string, excludeDirs: string[]): Promise<string[]> {
  const results: string[] = [];
  const normalizedExcludes = excludeDirs.map(normalizeDirPattern);
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!normalizedExcludes.includes(entry.name)) {
        results.push(...await findFilesRecursive(path.join(root, entry.name), excludeDirs));
      }
    } else {
      results.push(path.join(root, entry.name));
    }
  }
  return results;
}

export async function analyzeWorkspace(
  progress?: vscode.Progress<{ message?: string; increment?: number }>,
  token?: vscode.CancellationToken,
  profile: ScanProfile = 'complete',
  selectedModules?: string[],
  targetPath?: string,
  includeDeps?: boolean
): Promise<ScanResult> {
  const outputChannel = vscode.window.createOutputChannel('SimpleBeacon Workspace Analyzer');

  let rootPath: string;
  let files: string[];
  const buildArtifactPatterns = getBuildArtifactPatterns();
  let dirPatterns = buildArtifactPatterns.filter(
    (p) => !p.startsWith('.') || p === '.git' || p === '.next' || p === '.vscode-test'
  );
  if (includeDeps) {
    dirPatterns = dirPatterns.filter((p) => p !== 'node_modules');
  }

  if (targetPath) {
    rootPath = targetPath;
    outputChannel.appendLine(`[WorkspaceAnalyzer] Starting scan of ${rootPath} with profile: ${profile}`);
    files = await findFilesRecursive(rootPath, dirPatterns);
  } else {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      outputChannel.dispose();
      throw new Error('No workspace folder open');
    }
    rootPath = workspaceFolders[0].uri.fsPath;
    outputChannel.appendLine(`[WorkspaceAnalyzer] Starting scan of ${rootPath} with profile: ${profile}`);
    const findFilesExclude = `**/{${dirPatterns.join(',')}}/**`;
    const uriFiles = await vscode.workspace.findFiles('**/*', findFilesExclude);
    files = uriFiles.map((f) => f.fsPath);
  }

  // Resolve active pattern IDs from profile / selected modules
  const activePatternIds = resolveActivePatterns(profile, selectedModules);
  outputChannel.appendLine(`[WorkspaceAnalyzer] Active patterns: ${activePatternIds.join(', ')}`);

  // Load package.json dependencies for hallucinated import detection
  const knownDeps = activePatternIds.includes('hallucinatedImport') ? loadPackageDependencies(rootPath) : new Set<string>();
  if (activePatternIds.includes('hallucinatedImport')) {
    outputChannel.appendLine(`[WorkspaceAnalyzer] Loaded ${knownDeps.size} dependencies from package.json`);
  }

  const findings: Finding[] = [];
  let filesAnalyzed = 0;
  let totalLinesOfCode = 0;
  let totalBytes = 0;
  const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const categoryCounts: Record<string, number> = {};
  const allWorkspacePaths: string[] = files.map((f) => path.relative(rootPath, f));
  const analyzedFilePaths: string[] = [];
  const allDependencies: Array<{from: string; to: string; type: string}> = [];

  const totalFiles = files.length;
  const incrementPerFile = totalFiles > 0 ? 100 / totalFiles : 0;

  for (let i = 0; i < files.length; i++) {
    if (token?.isCancellationRequested) break;

    const filePath = files[i];
    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');

    if (isBuildArtifact(relativePath, buildArtifactPatterns)) {
      outputChannel.appendLine(`[WorkspaceAnalyzer] Skip (build artifact): ${relativePath}`);
      continue;
    }
    if (shouldSkipFile(relativePath)) {
      outputChannel.appendLine(`[WorkspaceAnalyzer] Skip (excluded path): ${relativePath}`);
      continue;
    }

    const lang = detectLanguage(filePath);
    if (lang === 'unknown') {
      outputChannel.appendLine(`[WorkspaceAnalyzer] Skip (unknown language): ${relativePath}`);
      continue;
    }

    try {
      const content = targetPath ? await fs.promises.readFile(filePath) : await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const text = targetPath ? content.toString('utf-8') : new TextDecoder('utf-8').decode(content);
      filesAnalyzed++;
      analyzedFilePaths.push(relativePath);
      totalBytes += content.byteLength;
      totalLinesOfCode += (text.match(/\n/g) || []).length + (text.length > 0 ? 1 : 0);

      for (const [patternId, def] of Object.entries(PATTERN_REGISTRY)) {
        if (!activePatternIds.includes(patternId)) continue;
        if (!def.appliesTo.includes(lang)) continue;

        let matches = extractMatches(text, def.pattern, def.maxMatches, def.redact, def.multiline);
        if (matches.length === 0) continue;

        if (def.selfReferenceFilter) {
          matches = matches.filter((m) => !def.selfReferenceFilter!.test(m.snippet));
        }
        if (def.contextFilter) {
          matches = matches.filter((m) => def.contextFilter!(m.snippet, relativePath));
        }
        if (matches.length === 0) continue;

        const category = ANALYZER_SCHEMA[patternId]?.category || 'other';

        // Compute dynamic severity based on context (comment, test file, literal vs tainted)
        const firstMatch = matches[0];
        const dynamicSev = computeDynamicSeverity(def.severity, firstMatch.snippet, relativePath, lang);

        // Adjust confidence based on context clarity
        let confidence = 0.85;
        if (isInComment(firstMatch.snippet, lang)) confidence = 0.4;
        else if (isTestFile(relativePath)) confidence = 0.5;
        else if (dynamicSev === 'critical') confidence = 0.95;

        const finding: Finding = {
          file: relativePath,
          type: def.name,
          severity: dynamicSev,
          matches,
          confidence,
          message: def.message,
          patternId,
        };
        findings.push(finding);
        severityCounts[dynamicSev]++;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }

      // Extract internal file dependencies for real Code Map visualization
      const fileDeps = extractInternalImports(text, relativePath);
      allDependencies.push(...fileDeps);

      // Hallucinated import detection (special rule requiring package.json context)
      if (activePatternIds.includes('hallucinatedImport') && knownDeps.size > 0) {
        const imports = extractImports(text);
        for (const imp of imports) {
          if (NODE_BUILTINS.has(imp.module)) continue;
          if (knownDeps.has(imp.module)) continue;
          const category = ANALYZER_SCHEMA['hallucinatedImport']?.category || 'security';
          const finding: Finding = {
            file: relativePath,
            type: 'Hallucinated Import',
            severity: 'medium',
            matches: [{ line: imp.line, snippet: imp.statement, context: [] }],
            confidence: 0.9,
            message: `Importing "${imp.module}" which is not declared in package.json dependencies. LLMs often hallucinate npm package names.`,
            patternId: 'hallucinatedImport',
          };
          findings.push(finding);
          severityCounts['medium']++;
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      }
    } catch (err) {
      outputChannel.appendLine(`[WorkspaceAnalyzer] Error reading ${relativePath}: ${err}`);
    }

    if (progress && i % 10 === 0) {
      progress.report({ message: `Analyzed ${i + 1}/${totalFiles} files...`, increment: incrementPerFile * 10 });
    }
  }

  // Group findings by category (O(n) via lookup map)
  const typeToCategory = new Map<string, string>();
  for (const [pid, schema] of Object.entries(ANALYZER_SCHEMA)) {
    const pat = PATTERN_REGISTRY[pid];
    if (pat) {
      typeToCategory.set(pat.name, schema.category);
    }
  }
  const categories: Record<string, Finding[]> = {};
  for (const finding of findings) {
    const cat = typeToCategory.get(finding.type) || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(finding);
  }

  outputChannel.appendLine(
    `[WorkspaceAnalyzer] Scan complete: ${filesAnalyzed} files analyzed, ${findings.length} findings`
  );
  outputChannel.dispose();

  const buildReadiness = analyzeBuildReadiness(allWorkspacePaths);
  const euAiAct = analyzeEuAiAct(allWorkspacePaths, findings);

  // Compute quality score and gate
  const criticalCount = severityCounts.critical || 0;
  const highCount = severityCounts.high || 0;
  const mediumCount = severityCounts.medium || 0;
  const lowCount = severityCounts.low || 0;
  const issuePenalty = criticalCount * 15 + highCount * 10 + mediumCount * 5 + lowCount * 2;
  const qualityScore = Math.max(0, Math.min(100, 100 - issuePenalty));
  const aiAssistedFindings = findings.filter(
    (f) => f.patternId === 'llmSlop' || f.patternId === 'aiResidueStub' || f.patternId === 'aiResidueSwallow'
  ).length;

  return {
    findings,
    projectRoot: rootPath,
    allFilePaths: analyzedFilePaths,
    summary: {
      totalFiles,
      filesAnalyzed,
      totalFindings: findings.length,
      severityCounts,
      categoryCounts,
      scanProfile: profile,
      selectedModules: activePatternIds,
      aiAssistedFindings,
      averageFileSizeBytes: filesAnalyzed > 0 ? Math.round(totalBytes / filesAnalyzed) : 0,
      totalLinesOfCode,
    },
    categories,
    qualityScore,
    gate: {
      pass: highCount === 0 && criticalCount === 0,
      blockingCount: highCount + criticalCount,
      blockingIssues: findings
        .filter((f) => f.severity === 'high' || f.severity === 'critical')
        .map((f) => ({
          file: f.file,
          type: f.type,
          severity: f.severity,
          line: f.matches[0]?.line ?? 0,
          message: f.message,
        })),
    },
    buildReadiness,
    euAiAct,
    dependencies: allDependencies,
  };
}

function resolveActivePatterns(profile: ScanProfile, selectedModules?: string[]): string[] {
  switch (profile) {
    case 'gate':
      return ANALYZER_PRESETS.essential.patternIds;
    case 'aislopcop':
      return ['llmSlop', 'aiResidueStub', 'aiResidueSwallow'];
    case 'codebase':
      return Object.keys(PATTERN_REGISTRY);
    case 'euai':
      return [
        'llmSlop',
        'aiResidueStub',
        'aiResidueSwallow',
        'evalDanger',
        'dbAntiPattern',
        'configDrift',
        'sensitiveData',
        'credentials',
      ];
    case 'compliance':
      return [
        'credentials',
        'sensitiveData',
        'configDrift',
        'evalDanger',
        'dbAntiPattern',
        'loggingSecrets',
        'innerHtmlXss',
        'prototypePollution',
      ];
    case 'hygiene':
      return ['debugArtifacts', 'aiResidueStub', 'aiResidueSwallow', 'llmSlop', 'missingTest', 'typeSafetyAny'];
    case 'custom':
      return selectedModules && selectedModules.length > 0 ? selectedModules : Object.keys(PATTERN_REGISTRY);
    case 'complete':
    default:
      return Object.keys(PATTERN_REGISTRY);
  }
}

export function exportScanResultToJson(result: ScanResult, pretty = true): string {
  const payload = {
    type: 'simplebeacon-report',
    reportVersion: 2,
    generatedAt: new Date().toISOString(),
    generatedBy: 'SimpleBeacon VS Code Extension',
    ...result,
  };
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
}

function analyzeEuAiAct(allPaths: string[], findings: Finding[]): EuAiActResult {
  const lowerPaths = allPaths.map((p) => p.toLowerCase().replace(/\\/g, '/'));
  // Count AI SDK imports (openai, anthropic, google generative-ai, etc.)
  const aiSdkPattern =
    /(^|\/)(openai|@anthropic-ai|@google\/generative-ai|@google-ai|@huggingface|ollama|langchain|ai-sdk|vertexai|gemini|claude|gpt-4|gpt-3)/i;
  const aiSdkFiles = lowerPaths.filter((p) => aiSdkPattern.test(p));
  const aiSdkCount = aiSdkFiles.length;

  // Detect governance docs
  const govDocPattern = /(^|\/)(license|security\.md|risk-assessment|governance|compliance|ai-policy|ethical-ai)/i;
  const govDocFiles = lowerPaths.filter((p) => govDocPattern.test(p));
  const hasGovDocs = govDocFiles.length > 0;

  const controls: EuAiActControl[] = [];

  // Art. 5 — Prohibited AI Practices
  controls.push({
    controlId: 'EU-AIA-ART-5',
    title: 'Prohibited AI Practices Audit',
    article: 'Regulation (EU) 2024/1689, Article 5',
    status: aiSdkCount > 0 ? 'WARN' : 'PASS',
    severity: aiSdkCount > 0 ? 'critical' : 'low',
    description:
      aiSdkCount > 0
        ? `Article 5 prohibits: (a) subliminal techniques, (b) exploitation of vulnerabilities, (c) social scoring by governments, (d) real-time biometric ID in public spaces. ${aiSdkCount} AI SDK import(s) detected — review whether use case falls under prohibited practices.`
        : 'No AI SDK imports or model inference patterns detected. Article 5 prohibited practices not applicable.',
    evidence:
      aiSdkCount > 0
        ? `${aiSdkCount} file(s) with AI SDK imports (e.g., openai, @anthropic-ai, @google/generative-ai)`
        : 'None detected',
    action:
      aiSdkCount > 0
        ? 'Conduct legal review: document that the AI system does not perform prohibited practices listed in Art. 5(1). If social scoring or biometric identification, stop development immediately.'
        : 'No action needed — maintain zero-AI posture or document lawful use case.',
  });

  // Art. 6 — Classification as high-risk (Annex III)
  controls.push({
    controlId: 'EU-AIA-ART-6',
    title: 'AI System Classification (Annex III)',
    article: 'Regulation (EU) 2024/1689, Article 6 & Annex III',
    status: aiSdkCount > 0 ? 'REVIEW' : 'PASS',
    severity: aiSdkCount > 0 ? 'medium' : 'low',
    description:
      aiSdkCount > 0
        ? 'Annex III lists high-risk AI systems (critical infrastructure, education, employment, law enforcement, migration, democratic processes). Classification determines conformity obligations.'
        : 'No AI system indicators — Annex III classification not applicable.',
    evidence:
      aiSdkCount > 0
        ? `${aiSdkCount} AI indicator(s); ${hasGovDocs ? govDocFiles.length + ' governance doc(s) present — verify Annex III classification is explicitly documented' : '0 governance docs — add risk-assessment.md'}`
        : 'None detected',
    action:
      aiSdkCount > 0
        ? hasGovDocs
          ? 'Review existing governance docs to confirm Annex III classification is explicitly documented. Do not assume presence of docs equals correct classification.'
          : 'Add risk-assessment.md documenting whether the system is high-risk under Annex III.'
        : 'No action needed.',
  });

  // Art. 50 — Transparency obligations (chatbots, deepfakes)
  controls.push({
    controlId: 'EU-AIA-ART-50',
    title: 'Transparency Obligations',
    article: 'Regulation (EU) 2024/1689, Article 50',
    status: aiSdkCount > 0 ? 'WARN' : 'PASS',
    severity: aiSdkCount > 0 ? 'medium' : 'low',
    description:
      aiSdkCount > 0
        ? 'Article 50 requires that persons interacting with AI systems are informed they are engaging with an AI (chatbots), and that deep-synthetic content is labelled as artificially generated.'
        : 'No AI indicators — transparency obligations not applicable.',
    evidence: aiSdkCount > 0 ? `${aiSdkCount} AI indicator(s) detected` : 'None detected',
    action:
      aiSdkCount > 0
        ? 'Verify UI/UX includes AI disclosure notices. If generating images/video/audio, implement synthetic media watermarking or metadata tags.'
        : 'No action needed.',
  });

  // Art. 9 — Risk management system (high-risk only)
  controls.push({
    controlId: 'EU-AIA-ART-9',
    title: 'Risk Management System',
    article: 'Regulation (EU) 2024/1689, Article 9',
    status: aiSdkCount > 0 ? (hasGovDocs ? 'REVIEW' : 'WARN') : 'PASS',
    severity: aiSdkCount > 0 ? (hasGovDocs ? 'medium' : 'high') : 'low',
    description:
      aiSdkCount > 0
        ? 'High-risk AI systems must implement a continuous risk management system throughout the entire lifecycle.'
        : 'No AI indicators — risk management system not applicable.',
    evidence:
      aiSdkCount > 0
        ? `${hasGovDocs ? govDocFiles.length + ' doc(s) present — verify risk management coverage' : 'No risk management documentation detected'}`
        : 'None detected',
    action:
      aiSdkCount > 0
        ? 'Create or update risk-assessment.md covering: identified risks, estimated likelihood/severity, mitigation measures, residual risk acceptance criteria.'
        : 'No action needed.',
  });

  const passCount = controls.filter((c) => c.status === 'PASS').length;
  const warnCount = controls.filter((c) => c.status === 'WARN').length;

  return {
    controls,
    aiSdkCount,
    hasGovernanceDocs: hasGovDocs,
    summary: `${passCount}/${controls.length} controls passing. ${warnCount > 0 ? `${warnCount} warning(s) requiring review.` : 'All clear.'}`,
  };
}
