import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── vscode mock ───
// The mock captures the onWillSaveTextDocument callback so tests can invoke it
// manually, simulating save events without a real VS Code extension host.

const mockDiagnosticCollection = {
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  dispose: jest.fn(),
};

const mockClipboardWriteText = jest.fn(() => Promise.resolve());

interface MockTextDocument {
  uri: { fsPath: string };
  lineCount: number;
  getText: () => string;
}

interface WillSaveEvent {
  document: MockTextDocument;
}

let capturedSaveCallback: ((event: WillSaveEvent) => void) | null = null;
let capturedSessionEndCallback: ((files: string[]) => void) | null = null;

const mockShowWarningMessage = jest.fn();
const mockConfig: Record<string, unknown> = {};

jest.mock('vscode', () => ({
  workspace: {
    onWillSaveTextDocument: jest.fn((cb: (event: WillSaveEvent) => void) => {
      capturedSaveCallback = cb;
      return { dispose: jest.fn() };
    }),
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue?: unknown) => mockConfig[key] ?? defaultValue),
    })),
  },
  window: {
    showWarningMessage: mockShowWarningMessage,
  },
  languages: {
    createDiagnosticCollection: jest.fn(() => mockDiagnosticCollection),
  },
  env: {
    clipboard: {
      writeText: mockClipboardWriteText,
    },
  },
  Range: jest.fn((startLine: number, startCol: number, endLine: number, endCol: number) => ({
    startLine,
    startCol,
    endLine,
    endCol,
  })),
  Diagnostic: jest.fn((range: unknown, message: string, severity: number) => ({ range, message, severity })),
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  Disposable: {
    from: jest.fn((...disposables: Array<{ dispose: () => void }>) => ({
      dispose: () => disposables.forEach((d) => d.dispose()),
    })),
  },
  ExtensionContext: jest.fn(() => ({ subscriptions: [] })),
}));

import { parseDiff, filterToChangedLines, buildDiffScanResult, formatDiffScanReport } from '../diffScanner';
import {
  explainFinding,
  makeGateDecision,
  recordSuppression,
  loadSuppressionLog,
  buildCouplingSummary,
  registerContextInterceptor,
  ContextInterceptorDeps,
} from '../agentValidation';
import { RealtimeIssue } from '../../realtimeIssue';

describe('DiffScanner', () => {
  describe('parseDiff', () => {
    it('parses a simple modified file diff', () => {
      const diff = [
        'diff --git a/src/app.ts b/src/app.ts',
        'index 1234567..abcdefg 100644',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -5,3 +5,4 @@',
        '+const x = 1;',
        '@@ -12,2 +13,3 @@',
        '+const y = 2;',
      ].join('\n');

      const files = parseDiff(diff);
      expect(files.length).toBe(1);
      expect(files[0].filePath).toBe('src/app.ts');
      expect(files[0].status).toBe('modified');
      expect(files[0].changedLines.length).toBe(2);
      expect(files[0].changedLines[0]).toEqual({ start: 5, end: 8 });
      expect(files[0].changedLines[1]).toEqual({ start: 13, end: 15 });
    });

    it('parses a new file diff', () => {
      const diff = [
        'diff --git a/src/new.ts b/src/new.ts',
        'new file mode 100644',
        'index 0000000..1234567',
        '--- /dev/null',
        '+++ b/src/new.ts',
        '@@ -0,0 +1,10 @@',
        '+const a = 1;',
        '+const b = 2;',
      ].join('\n');

      const files = parseDiff(diff);
      expect(files.length).toBe(1);
      expect(files[0].status).toBe('added');
      expect(files[0].changedLines[0]).toEqual({ start: 1, end: 10 });
    });

    it('handles empty diff', () => {
      expect(parseDiff('')).toEqual([]);
    });

    it('filters out deleted files', () => {
      const diff = [
        'diff --git a/src/old.ts b/src/old.ts',
        'deleted file mode 100644',
        '--- a/src/old.ts',
        '+++ /dev/null',
        '@@ -1,5 +0,0 @@',
        '-const x = 1;',
      ].join('\n');

      const files = parseDiff(diff);
      expect(files.length).toBe(0); // deleted file filtered out
    });
  });

  describe('filterToChangedLines', () => {
    it('filters findings to only changed lines', () => {
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 3,
          column: 1,
          severity: 'warning',
          type: 'test',
          message: 'msg',
          timestamp: new Date(),
        },
        {
          file: 'app.ts',
          line: 7,
          column: 1,
          severity: 'warning',
          type: 'test',
          message: 'msg',
          timestamp: new Date(),
        },
        {
          file: 'app.ts',
          line: 15,
          column: 1,
          severity: 'warning',
          type: 'test',
          message: 'msg',
          timestamp: new Date(),
        },
      ];
      const changedLines = [
        { start: 5, end: 10 },
        { start: 13, end: 20 },
      ];

      const filtered = filterToChangedLines(findings, changedLines);
      expect(filtered.length).toBe(2);
      expect(filtered[0].line).toBe(7);
      expect(filtered[1].line).toBe(15);
    });

    it('returns empty for no changed lines', () => {
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'test',
          message: 'msg',
          timestamp: new Date(),
        },
      ];
      expect(filterToChangedLines(findings, [])).toEqual([]);
    });
  });

  describe('buildDiffScanResult', () => {
    it('builds a passing result when no blocking findings', () => {
      const files = [{ filePath: 'app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 2,
          column: 1,
          severity: 'info',
          type: 'todo',
          message: 'TODO found',
          timestamp: new Date(),
        },
      ];

      const result = buildDiffScanResult(files, findings, [], 'error');
      expect(result.gatePassed).toBe(true);
      expect(result.blockingFindings.length).toBe(0);
      expect(result.summary.gateStatus).toBe('review');
    });

    it('builds a failing result when error findings exist', () => {
      const files = [{ filePath: 'app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 2,
          column: 1,
          severity: 'error',
          type: 'hardcoded-password',
          message: 'Password found',
          timestamp: new Date(),
        },
      ];

      const result = buildDiffScanResult(files, findings, [], 'error');
      expect(result.gatePassed).toBe(false);
      expect(result.blockingFindings.length).toBe(1);
      expect(result.summary.gateStatus).toBe('fail');
    });

    it('blocks on warnings when configured', () => {
      const files = [{ filePath: 'app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 2,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'console.log',
          timestamp: new Date(),
        },
      ];

      const result = buildDiffScanResult(files, findings, [], 'warning');
      expect(result.gatePassed).toBe(false);
      expect(result.blockingFindings.length).toBe(1);
    });
  });

  describe('formatDiffScanReport', () => {
    it('generates a readable report', () => {
      const files = [{ filePath: 'src/app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        {
          file: 'src/app.ts',
          line: 2,
          column: 1,
          severity: 'error',
          type: 'hardcoded-password',
          message: 'Password leaked',
          suggestion: 'Use env var',
          timestamp: new Date(),
        },
      ];

      const result = buildDiffScanResult(files, findings, [], 'error');
      const report = formatDiffScanReport(result);

      expect(report).toContain('GATE FAILED');
      expect(report).toContain('hardcoded-password');
      expect(report).toContain('Password leaked');
      expect(report).toContain('Use env var');
    });

    it('shows pass message when gate passes', () => {
      const result = buildDiffScanResult([], [], [], 'error');
      const report = formatDiffScanReport(result);
      expect(report).toContain('GATE PASSED');
    });
  });
});

describe('AgentValidation', () => {
  describe('explainFinding', () => {
    it('recommends fix for error findings', () => {
      const issue: RealtimeIssue = {
        file: 'src/app.ts',
        line: 1,
        column: 1,
        severity: 'error',
        type: 'hardcoded-password',
        message: 'Hardcoded password detected',
        suggestion: 'Use process.env.PASSWORD',
        timestamp: new Date(),
        fileRole: 'app',
      };

      const result = explainFinding(issue, 'const pw = "Sup3rS3cr3t!";', 'const pw = "Sup3rS3cr3t!";');
      expect(result.recommendedAction).toBe('fix');
      expect(result.isFalsePositive).toBe(false);
      expect(result.fixInstructions).toContain('process.env');
    });

    it('recommends suppress for false positives', () => {
      const issue: RealtimeIssue = {
        file: 'tests/app.test.ts',
        line: 1,
        column: 1,
        severity: 'error',
        type: 'hardcoded-password',
        message: 'Hardcoded password detected',
        timestamp: new Date(),
        fileRole: 'test',
      };

      const result = explainFinding(issue, 'const pw = "changeme";', 'const pw = "changeme";');
      expect(result.recommendedAction).toBe('suppress');
      expect(result.isFalsePositive).toBe(true);
      expect(result.suppressionRationale).toBeDefined();
    });
  });

  describe('makeGateDecision', () => {
    it('allows finalization when gate passes', () => {
      const scanResult = buildDiffScanResult([], [], [], 'error');
      const decision = makeGateDecision(scanResult);
      expect(decision.canFinalize).toBe(true);
      expect(decision.recommendation).toBe('proceed');
    });

    it('blocks finalization when gate fails', () => {
      const files = [{ filePath: 'app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 2,
          column: 1,
          severity: 'error',
          type: 'secret',
          message: 'Secret!',
          timestamp: new Date(),
        },
      ];
      const scanResult = buildDiffScanResult(files, findings, [], 'error');

      const decision = makeGateDecision(scanResult);
      expect(decision.canFinalize).toBe(false);
      expect(decision.recommendation).toBe('fix-required');
      expect(decision.blockingCount).toBe(1);
    });

    it('recommends human review for warnings when configured', () => {
      const files = [{ filePath: 'app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        {
          file: 'app.ts',
          line: 2,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'console.log',
          timestamp: new Date(),
        },
      ];
      const scanResult = buildDiffScanResult(files, findings, [], 'error');

      const decision = makeGateDecision(scanResult, true); // requireHumanReviewForWarnings
      expect(decision.canFinalize).toBe(false);
      expect(decision.recommendation).toBe('human-review');
    });

    it('proceeds with notes for non-blocking findings', () => {
      const files = [{ filePath: 'app.ts', status: 'modified' as const, changedLines: [{ start: 1, end: 5 }] }];
      const findings: RealtimeIssue[] = [
        { file: 'app.ts', line: 2, column: 1, severity: 'info', type: 'todo', message: 'TODO', timestamp: new Date() },
      ];
      const scanResult = buildDiffScanResult(files, findings, [], 'error');

      const decision = makeGateDecision(scanResult);
      expect(decision.canFinalize).toBe(true);
      expect(decision.recommendation).toBe('proceed-with-notes');
    });
  });

  describe('Learning loop (suppression log)', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('records and loads suppressions', () => {
      recordSuppression(tmpDir, 'console-log', 'src/app.ts', 5, 'Intentional debug logging in dev');

      const log = loadSuppressionLog(tmpDir);
      expect(log.length).toBe(1);
      expect(log[0].ruleType).toBe('console-log');
      expect(log[0].filePath).toBe('src/app.ts');
      expect(log[0].line).toBe(5);
      expect(log[0].rationale).toBe('Intentional debug logging in dev');
      expect(log[0].timestamp).toBeDefined();
    });

    it('appends to existing suppression log', () => {
      recordSuppression(tmpDir, 'rule-a', 'file-a.ts', 1, 'Reason A');
      recordSuppression(tmpDir, 'rule-b', 'file-b.ts', 2, 'Reason B');

      const log = loadSuppressionLog(tmpDir);
      expect(log.length).toBe(2);
    });

    it('returns empty array when no log exists', () => {
      const log = loadSuppressionLog(tmpDir);
      expect(log).toEqual([]);
    });
  });

  describe('buildCouplingSummary', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coupling-test-'));
      const sbDir = path.join(tmpDir, '.simplebeacon');
      fs.mkdirSync(sbDir, { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns null when codemap-analysis.json does not exist', () => {
      expect(buildCouplingSummary(['src/app.ts'], tmpDir)).toBeNull();
    });

    it('returns null when no edited files match codemap issues', () => {
      const codemap = {
        issues: [
          {
            title: 'High Coupling',
            severity: 'high',
            files: ['ai-platform/server/lib/cluster-keyring-sync.cjs'],
            description: '60 files have >20 connections.',
          },
        ],
      };
      fs.writeFileSync(path.join(tmpDir, '.simplebeacon', 'codemap-analysis.json'), JSON.stringify(codemap));

      const result = buildCouplingSummary(['src/unrelated-file.ts'], tmpDir);
      expect(result).toBeNull();
    });

    it('produces coupling summary when edited file matches a codemap issue', () => {
      const codemap = {
        issues: [
          {
            title: 'High Coupling',
            severity: 'high',
            files: [
              'ai-platform/server/lib/cluster-keyring-sync.cjs',
              'ai-platform/server/lib/app-logger.cjs',
              'ai-platform/server/middleware/auth.cjs',
            ],
            description: '60 files have >20 connections. Consider decoupling via interfaces or events.',
          },
        ],
      };
      fs.writeFileSync(path.join(tmpDir, '.simplebeacon', 'codemap-analysis.json'), JSON.stringify(codemap));

      const result = buildCouplingSummary(['ai-platform/server/lib/cluster-keyring-sync.cjs'], tmpDir);
      expect(result).not.toBeNull();
      expect(result).toContain('Coupling Summary');
      expect(result).toContain('High Coupling');
      expect(result).toContain('cluster-keyring-sync.cjs');
      // Should list coupled files that were NOT edited
      expect(result).toContain('app-logger.cjs');
      expect(result).toContain('auth.cjs');
      expect(result).toContain('Consider decoupling');
    });

    it('handles malformed codemap JSON gracefully', () => {
      fs.writeFileSync(path.join(tmpDir, '.simplebeacon', 'codemap-analysis.json'), 'not valid json{');
      expect(buildCouplingSummary(['src/app.ts'], tmpDir)).toBeNull();
    });

    it('handles codemap with no issues array', () => {
      fs.writeFileSync(path.join(tmpDir, '.simplebeacon', 'codemap-analysis.json'), JSON.stringify({ summary: {} }));
      expect(buildCouplingSummary(['src/app.ts'], tmpDir)).toBeNull();
    });
  });

  describe('registerContextInterceptor', () => {
    let tmpDir: string;
    let mockDeps: ContextInterceptorDeps;
    let mockContext: any;
    let aiSessionActive = false;
    let aiEditedFiles: string[] = [];

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interceptor-test-'));

      // Reset all mocks
      mockDiagnosticCollection.set.mockClear();
      mockDiagnosticCollection.delete.mockClear();
      mockShowWarningMessage.mockClear();
      mockClipboardWriteText.mockClear();
      capturedSaveCallback = null;
      capturedSessionEndCallback = null;
      aiSessionActive = false;
      aiEditedFiles = [];

      // Reset config to defaults
      for (const key of Object.keys(mockConfig)) delete mockConfig[key];

      mockDeps = {
        isAiSessionActive: () => aiSessionActive,
        getAiEditedFiles: () => aiEditedFiles,
        onAiSessionEnd: (cb) => {
          capturedSessionEndCallback = cb;
        },
        workspaceRoot: tmpDir,
        outputChannel: { appendLine: jest.fn() },
      };

      mockContext = { subscriptions: [] };
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // Helper: create a mock TextDocument and fire the save callback
    function fireSaveEvent(relativePath: string, content: string): void {
      if (!capturedSaveCallback) throw new Error('Save callback not registered');
      const fullPath = path.join(tmpDir, relativePath);
      const doc: MockTextDocument = {
        uri: { fsPath: fullPath },
        lineCount: content.split('\n').length,
        getText: () => content,
      };
      capturedSaveCallback({ document: doc });
    }

    it('registers a save listener and session-end callback on activation', () => {
      registerContextInterceptor(mockDeps, mockContext);
      expect(capturedSaveCallback).not.toBeNull();
      expect(capturedSessionEndCallback).not.toBeNull();
      expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(2);
    });

    it('skips validation when agentDetectionMode is "off"', () => {
      mockConfig.agentDetectionMode = 'off';
      aiSessionActive = true; // Even if AI is active
      registerContextInterceptor(mockDeps, mockContext);

      fireSaveEvent('test.js', 'const x = 1;');

      expect(mockDiagnosticCollection.set).not.toHaveBeenCalled();
      expect(mockShowWarningMessage).not.toHaveBeenCalled();
    });

    it('skips validation when no AI session is active in heuristic mode', () => {
      mockConfig.agentDetectionMode = 'heuristic';
      aiSessionActive = false;
      registerContextInterceptor(mockDeps, mockContext);

      fireSaveEvent('test.js', 'const x = 1;');

      expect(mockDiagnosticCollection.set).not.toHaveBeenCalled();
    });

    it('validates on save when AI session is active in heuristic mode', () => {
      mockConfig.agentDetectionMode = 'heuristic';
      aiSessionActive = true;
      registerContextInterceptor(mockDeps, mockContext);

      // Use a clean file — should produce no diagnostics
      fireSaveEvent('clean.js', 'const x = 1;\n');

      // No findings → diagnosticCollection.delete should be called (clearing old diagnostics)
      expect(mockDiagnosticCollection.delete).toHaveBeenCalled();
      expect(mockShowWarningMessage).not.toHaveBeenCalled();
    });

    it('validates on save when mode is "always" regardless of AI session', () => {
      mockConfig.agentDetectionMode = 'always';
      aiSessionActive = false; // No AI session, but mode is 'always'
      registerContextInterceptor(mockDeps, mockContext);

      fireSaveEvent('clean.js', 'const x = 1;\n');

      expect(mockDiagnosticCollection.delete).toHaveBeenCalled();
    });

    it('skips non-source file extensions', () => {
      mockConfig.agentDetectionMode = 'always';
      registerContextInterceptor(mockDeps, mockContext);

      fireSaveEvent('readme.md', '# Hello World\n');

      expect(mockDiagnosticCollection.set).not.toHaveBeenCalled();
      expect(mockDiagnosticCollection.delete).not.toHaveBeenCalled();
    });

    it('skips files outside the workspace root', () => {
      mockConfig.agentDetectionMode = 'always';
      registerContextInterceptor(mockDeps, mockContext);

      // Fire save with a file path outside tmpDir
      if (!capturedSaveCallback) throw new Error('Save callback not registered');
      const outsidePath = path.join(os.tmpdir(), 'outside-workspace.js');
      const doc: MockTextDocument = {
        uri: { fsPath: outsidePath },
        lineCount: 1,
        getText: () => 'const x = 1;',
      };
      capturedSaveCallback({ document: doc });

      expect(mockDiagnosticCollection.set).not.toHaveBeenCalled();
    });

    it('does not block the save — validation errors are caught and logged', () => {
      mockConfig.agentDetectionMode = 'always';
      const mockOutput = { appendLine: jest.fn() };
      mockDeps.outputChannel = mockOutput;
      registerContextInterceptor(mockDeps, mockContext);

      // Fire save with a document that has content — should not throw
      expect(() => fireSaveEvent('test.js', 'const x = 1;\n')).not.toThrow();
    });

    it('copies coupling summary to clipboard on AI session end', () => {
      // Create a codemap file with a coupling issue
      const sbDir = path.join(tmpDir, '.simplebeacon');
      fs.mkdirSync(sbDir, { recursive: true });
      const codemap = {
        issues: [
          {
            title: 'High Coupling',
            severity: 'high',
            files: ['src/edited.cjs', 'src/coupled-a.cjs', 'src/coupled-b.cjs'],
            description: 'Files have >20 connections.',
          },
        ],
      };
      fs.writeFileSync(path.join(sbDir, 'codemap-analysis.json'), JSON.stringify(codemap));

      registerContextInterceptor(mockDeps, mockContext);

      // Simulate AI session end with the edited file
      expect(capturedSessionEndCallback).not.toBeNull();
      capturedSessionEndCallback!(['src/edited.cjs']);

      // Clipboard should have received the coupling summary
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1);
      const calls = mockClipboardWriteText.mock.calls as unknown as string[][];
      const clipboardContent = calls[0]?.[0] ?? '';
      expect(clipboardContent).toContain('Coupling Summary');
      expect(clipboardContent).toContain('edited.cjs');
      expect(clipboardContent).toContain('coupled-a.cjs');
      expect(clipboardContent).toContain('coupled-b.cjs');
    });

    it('does not copy to clipboard when no coupling issues match edited files', () => {
      const sbDir = path.join(tmpDir, '.simplebeacon');
      fs.mkdirSync(sbDir, { recursive: true });
      const codemap = {
        issues: [
          {
            title: 'High Coupling',
            severity: 'high',
            files: ['src/unrelated-a.cjs', 'src/unrelated-b.cjs'],
            description: 'Files have >20 connections.',
          },
        ],
      };
      fs.writeFileSync(path.join(sbDir, 'codemap-analysis.json'), JSON.stringify(codemap));

      registerContextInterceptor(mockDeps, mockContext);
      capturedSessionEndCallback!(['src/completely-different.cjs']);

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });

    it('does not copy to clipboard when AI session ends with zero files', () => {
      registerContextInterceptor(mockDeps, mockContext);
      capturedSessionEndCallback!([]);

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });

    it('does not copy to clipboard when codemap-analysis.json does not exist', () => {
      registerContextInterceptor(mockDeps, mockContext);
      capturedSessionEndCallback!(['src/edited.cjs']);

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });
  });
});
