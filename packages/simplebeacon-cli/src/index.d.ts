// TypeScript definitions for simplebeacon-cli public API

export const version: string;

// ── Barrel introspection ──
export function getExportNames(): ReadonlyArray<string>;
export function getNamespaceNames(): ReadonlyArray<string>;
export function validateBarrelIntegrity(): { valid: boolean; errors: string[] };
export const __barrel__: {
  name: string;
  description: string;
  moduleCount: number;
  exportCount: number;
  namespaceCount: number;
  version: string;
  timestamp: string;
  exports: ReadonlyArray<string>;
  namespaces: ReadonlyArray<string>;
};

// ── Config ──
export function loadSimplebeaconConfig(baseDir: string): any;
export function loadSamplebeaconConfig(baseDir: string): any;
export function loadCentralDataConfig(baseDir: string): any;
export function resolveScanPaths(
  platformRoot: string,
  options?: any,
  extras?: string[],
): string[];
export function resolveMockDataScanPaths(
  baseDir: string,
  extraPaths?: string[],
): string[];
export function countRepositoryInventory(baseDir: string): any;
export function resolvePathFromBase(baseDir: string, relPath: string): string;
export function normalizeRelativePath(p: string): string;
export function getInitTemplates(): any[];
export function initSimplebeacon(baseDir: string, options?: any): any;
export function initSamplebeacon(baseDir: string, options?: any): any;
export function buildInitDryRunPlan(baseDir: string): any;
export function getRepositoryAuditBaseline(baseDir: string): any;
export function getConsistencyAnchorSamples(baseDir: string): any;
export const DEFAULT_MOCK_SCAN_RELATIVE_PATHS: string[];
export const DEFAULT_CONSISTENCY_ANCHOR_SAMPLES: any;
export const DEFAULT_BASELINE: any;
export const DEFAULT_CONFIG: any;
export const PROFILE_RULES: any;
export function validateConfig(config: any): {
  valid: boolean;
  errors?: string[];
};
export const VALID_RULES: Set<string>;
export const VALID_PROFILES: Set<string>;
export const VALID_SCANNER_ACTIONS: Set<string>;
export const VALID_SEVERITIES: Set<string>;
export const SKIP_BY_PROFILE: Record<string, string[]>;

// ── Scan & Analysis ──
export function runScan(paths: string[], options?: any): Promise<any>;
export function scanMockDataDirectories(
  baseDir: string,
  options?: any,
): Promise<any>;
export function formatBytes(bytes: number): string;
export function categoryForExt(ext: string): string;
export function validateSampleSchema(
  sample: any,
  schema?: any,
): { valid: boolean; errors?: string[] };
export function groupIssues(issues: any[]): any;
export function isBlockingIssue(issue: any, config?: any): boolean;
export function countBySeverity(issues: any[]): any;
export function parallelScan(
  filePaths: string[],
  rulesCatalog: { id: string; pattern: string }[],
): Promise<any[]>;
export function singleThreadScan(
  filePaths: string[],
  rulesCatalog: { id: string; pattern: string }[],
): any[];

// ── Gate ──
export function evaluateGate(report: any, config?: any): any;

// ── Reporters ──
export function formatTextReport(report: any, options?: any): string;
export function formatActionPlanReport(report: any): string;
export function formatJsonReport(report: any, options?: any): string;
export function formatGithubComment(report: any): string;
export function formatGithubStepSummary(report: any): string;
export function postGithubComment(
  token: string,
  owner: string,
  repo: string,
  issue: number,
  body: string,
): Promise<any>;
export function buildAssessmentReport(report: any): any;
export function compileAuditReportMarkdown(report: any): string;
export function generateFileReductionReport(findings: any[]): string;
export function aggregateCleanupFindings(findings: any[]): any;
export function formatReportDate(date?: Date | string): string;
export function capitalize(str: string): string;
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string;
export function truncate(str: string, maxLength?: number): string;

// ── Fiction Detection ──
export function buildFictionPatternCatalog(): any[];
export function countFictionIssues(report: any): number;

// ── Proxy / Gateway ──
export function startGateway(options?: any): any;
export function createGateway(options?: any): any;

// ── Compliance ──
export function evaluateComplianceChecklist(report: any, options?: any): any;
export function loadComplianceChecklist(
  projectRoot: string,
  options?: any,
): any;
export const DEFAULT_MAX_STALE_MS: number;
export function evaluateSprintFreshness(sprint: any): any;
export function evaluateEuExportEligibility(report: any): any;
export function isLegalReviewAttestation(report: any): boolean;

// ── Sanitizers ──
export function redactSecretsInString(text: string): string;
export function sanitizeScanReport(report: any): any;
export function sanitizeAssessment(assessment: any): any;
export function sanitizeReportForCloudUpload(report: any): any;
export function sanitizePublicOutput(output: any): any;
export function applyPublicGateToAnalyzeResponse(response: any): any;

// ── Baseline & Hooks ──
export function syncJestBaseline(config?: any): Promise<any>;
export function verifyJestBaseline(config?: any): Promise<any>;
export function installSimplebeaconHook(options?: any): boolean;
export function buildHookScript(options?: any): string;

// ── Project Detection ──
export function detectProjectProfile(projectRoot: string): any;
export function resolvePlatformRoot(baseDir: string): any;

// ── Trust & Safety ──
export function createNetworkGuard(options?: any): any;
export function snapshotFileState(filePath: string): any;
export function assertFileUnchanged(filePath: string, snapshot: any): boolean;
export function printTrustBanner(): void;
export function printTrustCompletion(): void;
export function writeManagedFileSync(filePath: string, content: string): void;
export function withTransactionSync<T>(fn: () => T): T;

// ── Errors ──
export class SimplebeaconError extends Error {
  constructor(message: string, code?: string);
  code?: string;
}
export class ConfigError extends SimplebeaconError {}
export class ScanError extends SimplebeaconError {}
export class PathError extends SimplebeaconError {}

// ── Path Utilities ──
export function normalizePathKey(p: string): string;
export function isPathWithinRoot(filePath: string, root: string): boolean;
export function resolveCliProjectRoot(cwd?: string): string;
export function sanitizeFilePath(filePath: string): string;
export function sanitizePath(p: string): string;
export class PathSanitizer {
  sanitize(p: string): string;
}

// ── File Reduction ──
export function runFileReductionScan(projectRoot: string, options?: any): any;
export class FileReductionOrchestrator {
  constructor(options?: any);
  run(projectRoot: string): Promise<any>;
  listScanners(): any[];
}

// ── Doctor ──
export function runDoctor(): void;

// ── Fix Dry-Run ──
export function runFixDryRun(options?: any): any;
export function formatFixDryRunText(plan: any): string;
export function loadRemediationModule(platformRoot: string): any;

// ── MCP ──
export function createMcpToolHandlers(): any;
export const TOOL_DEFINITIONS: any;
export function createMcpStdioServer(): any;
export function scanSnippetContent(content: string, rules?: string[]): any;
export function scanFileOnDisk(filePath: string, rules?: string[]): any;
export function readGateStatus(projectRoot: string): any;

// ── Export Sanitizers ──
export function buildAnonymizedExport(report: any): any;
export function signAnonymizedExport(exportData: any, secret: string): string;
export function verifyAnonymizedExport(
  exportData: any,
  signature: string,
  secret: string,
): boolean;
export function validateAnonymizedSchema(data: any): {
  valid: boolean;
  errors?: string[];
};
export function attachAnalyzerSuiteToReport(report: any): any;
export function buildAiSystemsIssueAnalysis(report: any): any;
export function getCachedAnalysis(key: string): any;
export function setCachedAnalysis(key: string, value: any): void;
export function clearAnalyzerCache(): void;
export function sanitizeAiProblemAnalyzerExport(report: any): any;
export function sanitizeCompleteScanExport(report: any): any;
export function sanitizeNpmAuditExport(report: any): any;
export function sanitizeCleanupBriefExport(report: any): any;
export function sanitizeDataCleanupReportExport(report: any): any;
export function sanitizeCodebaseReportExport(report: any): any;
export function sanitizeFictionDigestExport(report: any): any;
export function sanitizeConsolidationExport(report: any): any;
export function sanitizeComplianceChecklistArtifactExport(report: any): any;
export function sanitizeRoadmapForBenchmark(report: any): any;
export function sanitizeGateReportForComplianceExport(report: any): any;
export function sanitizePublicSummaryArtifactExport(report: any): any;
export function projectLabelFromPath(projectPath: string): string;
export function redactProjectPathForExport(projectPath: string): string;
export function buildReAttestationNoteArtifact(options?: any): any;
export function sanitizeRoadmapExport(report: any): any;
export function sanitizeSimplebeaconReportExport(report: any): any;
export function buildProductCompleteScanHygieneSummary(report: any): string;
export function buildProductCompleteScanScanScope(report: any): string;
export function hasHollowGateAttestation(report: any): boolean;
export function assembleBenchmarkCompleteScanExportNotes(report: any): string;

// ── Re-exported ai-problem-analyzer-suite helpers ──
export function isEmpty(value: any): boolean;
export function ensureArray<T>(value: T | T[] | null | undefined): T[];
export function deepEqual(a: any, b: any): boolean;
export function sortBy<T>(arr: T[], iteratee: (item: T) => any): T[];
export function flatten<T>(arr: T[][]): T[];
export function range(start: number, end?: number, step?: number): number[];
export function unique<T>(arr: T[]): T[];
export function partition<T>(
  arr: T[],
  predicate: (item: T) => boolean,
): [T[], T[]];
export function chunk<T>(arr: T[], size: number): T[][];
export function times<T>(n: number, fn: (i: number) => T): T[];
export function get(obj: any, path: string, fallback?: any): any;
export function set(obj: any, path: string, value: any): any;
export function seq<T>(...fns: Array<(v: T) => T>): (v: T) => T;
export function identity<T>(value: T): T;
export function constant<T>(value: T): () => T;
export function random(min?: number, max?: number, floating?: boolean): number;
export function sleep(ms: number): Promise<void>;
export function delay(ms: number): Promise<void>;
export function parseJsonSafe<T>(text: string, fallback?: T): T | undefined;
export function tryFn<T>(
  fn: (...args: any[]) => T,
  ...args: any[]
): { ok: true; value: T } | { ok: false; error: Error };
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  resolver?: (...args: any[]) => string,
): T;
export function hash(str: string): number;
export function randomId(length?: number): string;

// ── Inline utility helpers (extracted to utils/) ──
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T>;
export function retry<T>(
  fn: () => Promise<T>,
  opts?: {
    retries?: number;
    delayMs?: number;
    backoff?: number;
    maxDelayMs?: number;
    shouldRetry?: (err: Error) => boolean;
  },
): Promise<T>;
export function pick(obj: any, keys: string[]): any;
export function omit(obj: any, keys: string[]): any;
export function compact<T>(arr: T[]): T[];
export function groupBy<T>(
  arr: T[],
  keyFn: (item: T) => string,
): Record<string, T[]>;
export function keyBy<T>(
  arr: T[],
  keyFn: (item: T) => string,
): Record<string, T>;
export function zipObject(keys: string[], values: any[]): Record<string, any>;
export function kebabCase(str: string): string;
export function camelCase(str: string): string;
export function snakeCase(str: string): string;
export function padStart(
  str: string | number,
  len: number,
  char?: string,
): string;
export function padEnd(
  str: string | number,
  len: number,
  char?: string,
): string;
export function escapeRegExp(str: string): string;
export function formatDuration(ms: number): string;
export function noop(): void;
export function assertNever(value: never, message?: string): never;
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs: number,
  immediate?: boolean,
): T & { cancel(): void; flush(): any };
export function once<T extends (...args: any[]) => any>(fn: T): T;
export function formatNumber(n: number | null | undefined): string;
export function isBlank(value: any): boolean;

// ── Async advanced helpers ──
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  waitMs?: number,
): T;
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limitMs?: number,
): T;
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxSize?: number,
): T;
export function delay(ms: number): Promise<void>;

// ── Namespaced API ────────────────────────────────────────────────────────

export namespace Simplebeacon {
  export { version };
  export namespace config {
    export {
      loadSimplebeaconConfig,
      loadCentralDataConfig,
      resolveScanPaths,
      resolveMockDataScanPaths,
      countRepositoryInventory,
      resolvePathFromBase,
      normalizeRelativePath,
      getInitTemplates,
      initSimplebeacon,
      buildInitDryRunPlan,
      getRepositoryAuditBaseline,
      getConsistencyAnchorSamples,
      DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
      DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
      DEFAULT_BASELINE,
      DEFAULT_CONFIG,
      PROFILE_RULES,
      validateConfig,
    };
  }
  export namespace scan {
    export {
      runScan,
      scanMockDataDirectories,
      formatBytes,
      categoryForExt,
      validateSampleSchema,
      groupIssues,
      isBlockingIssue,
      countBySeverity,
    };
  }
  export namespace gate {
    export { evaluateGate };
  }
  export namespace report {
    export {
      formatTextReport,
      formatActionPlanReport,
      formatJsonReport,
      formatGithubComment,
      formatGithubStepSummary,
      postGithubComment,
      buildAssessmentReport,
      compileAuditReportMarkdown,
      generateFileReductionReport,
      aggregateCleanupFindings,
      formatReportDate,
    };
  }
  export namespace fiction {
    export { buildFictionPatternCatalog, countFictionIssues };
  }
  export namespace proxy {
    export { startGateway, createGateway };
  }
  export namespace compliance {
    export {
      evaluateComplianceChecklist,
      loadComplianceChecklist,
      DEFAULT_MAX_STALE_MS,
      evaluateSprintFreshness,
      evaluateEuExportEligibility,
      isLegalReviewAttestation,
    };
  }
  export namespace sanitize {
    export {
      redactSecretsInString,
      sanitizeScanReport,
      sanitizeAssessment,
      sanitizeReportForCloudUpload,
      sanitizePublicOutput,
      applyPublicGateToAnalyzeResponse,
      buildAnonymizedExport,
      signAnonymizedExport,
      verifyAnonymizedExport,
      validateAnonymizedSchema,
      attachAnalyzerSuiteToReport,
      buildAiSystemsIssueAnalysis,
      sanitizeAiProblemAnalyzerExport,
      sanitizeCompleteScanExport,
      sanitizeNpmAuditExport,
      sanitizeCleanupBriefExport,
      sanitizeDataCleanupReportExport,
      sanitizeCodebaseReportExport,
      sanitizeFictionDigestExport,
      sanitizeConsolidationExport,
      sanitizeComplianceChecklistArtifactExport,
      sanitizeRoadmapForBenchmark,
      sanitizeGateReportForComplianceExport,
      sanitizePublicSummaryArtifactExport,
      projectLabelFromPath,
      redactProjectPathForExport,
      buildReAttestationNoteArtifact,
      sanitizeRoadmapExport,
      sanitizeSimplebeaconReportExport,
      buildProductCompleteScanHygieneSummary,
      buildProductCompleteScanScanScope,
      hasHollowGateAttestation,
      assembleBenchmarkCompleteScanExportNotes,
    };
  }
  export namespace baseline {
    export { syncJestBaseline, verifyJestBaseline };
  }
  export namespace hooks {
    export { installSimplebeaconHook, buildHookScript };
  }
  export namespace project {
    export { detectProjectProfile, resolvePlatformRoot };
  }
  export namespace trust {
    export {
      createNetworkGuard,
      snapshotFileState,
      assertFileUnchanged,
      printTrustBanner,
      printTrustCompletion,
      writeManagedFileSync,
      withTransactionSync,
    };
  }
  export namespace errors {
    export { SimplebeaconError, ConfigError, ScanError, PathError };
  }
  export namespace path {
    export {
      normalizePathKey,
      isPathWithinRoot,
      resolveCliProjectRoot,
      sanitizeFilePath,
      sanitizePath,
      PathSanitizer,
    };
  }
  export namespace mcp {
    export {
      createMcpToolHandlers,
      TOOL_DEFINITIONS,
      createMcpStdioServer,
      scanSnippetContent,
      scanFileOnDisk,
      readGateStatus,
    };
  }
  export namespace doctor {
    export { runDoctor };
  }
  export namespace fixDryRun {
    export { runFixDryRun, formatFixDryRunText, loadRemediationModule };
  }
  export namespace scanOrchestrator {
    export { parallelScan, singleThreadScan };
  }
  export namespace utils {
    export {
      withTimeout,
      retry,
      pick,
      omit,
      compact,
      groupBy,
      keyBy,
      zipObject,
      kebabCase,
      camelCase,
      snakeCase,
      padStart,
      padEnd,
      escapeRegExp,
      formatDuration,
      noop,
      assertNever,
      debounce,
      once,
      formatNumber,
      isBlank,
      isEmpty,
      ensureArray,
      deepEqual,
      sortBy,
      flatten,
      range,
      unique,
      partition,
      chunk,
      times,
      get,
      set,
      seq,
      identity,
      constant,
      random,
      sleep,
      delay,
      parseJsonSafe,
      tryFn,
      memoize,
      hash,
      randomId,
      capitalize,
      pluralize,
      truncate,
    };
  }
}
