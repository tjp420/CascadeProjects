/**
 * Tests for the in-place remediation feature — verifies code extraction
 * from Ollama responses, the remediation flow, and edge cases.
 *
 * The extractCodeFromResponse function is pure and fully testable without
 * mocking. The full remediateDiagnosticInPlace flow is tested with mocked
 * fetch and vscode APIs.
 */

import { EventEmitter } from 'events';

// Mock vscode module
const mockWorkspaceEdit: any = {
  replace: jest.fn(),
};
const mockWorkspace: any = {
  applyEdit: jest.fn().mockResolvedValue(true),
  openTextDocument: jest.fn().mockResolvedValue({}),
};
const mockWindow: any = {
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  })),
  showInformationMessage: jest.fn().mockResolvedValue('Apply Fix'),
  showTextDocument: jest.fn().mockResolvedValue({
    revealRange: jest.fn(),
  }),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
};

jest.mock('vscode', () => ({
  WorkspaceEdit: jest.fn(() => mockWorkspaceEdit),
  workspace: mockWorkspace,
  window: mockWindow,
  ViewColumn: { Active: 1 },
  TextEditorRevealType: { InCenter: 2 },
  CodeAction: jest.fn((title: string, kind?: any) => ({ title, kind, diagnostics: [], command: undefined, edit: undefined, isPreferred: false })),
  CodeActionKind: { QuickFix: 'quickfix', Refactor: 'refactor' },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock getSbConfig
jest.mock('../../utils/vscode', () => ({
  getSbConfig: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue: any) => {
      if (key === 'ollamaUrl') return 'http://localhost:11434';
      if (key === 'ollamaModel') return 'llama3.2:latest';
      return defaultValue;
    }),
  })),
}));

describe('extractCodeFromResponse', () => {
  let extractCodeFromResponse: (response: string) => string;

  beforeEach(() => {
    jest.resetModules();
    extractCodeFromResponse = require('../localOllamaRemediation').extractCodeFromResponse;
  });

  test('extracts code from a fenced code block with language tag', () => {
    const response = 'Here is the fix:\n```javascript\nconst x = process.env.KEY;\n```\nThat should work.';
    const result = extractCodeFromResponse(response);
    expect(result).toBe('const x = process.env.KEY;');
  });

  test('extracts code from a fenced code block without language tag', () => {
    const response = '```\nconst password = process.env.PASSWORD;\n```';
    const result = extractCodeFromResponse(response);
    expect(result).toBe('const password = process.env.PASSWORD;');
  });

  test('returns trimmed response when no fences present', () => {
    const response = 'const x = 1;';
    const result = extractCodeFromResponse(response);
    expect(result).toBe('const x = 1;');
  });

  test('returns empty string for empty response', () => {
    expect(extractCodeFromResponse('')).toBe('');
    expect(extractCodeFromResponse('   ')).toBe('');
  });

  test('handles multi-line code blocks', () => {
    const response = '```ts\nconst a = 1;\nconst b = 2;\nconst c = a + b;\n```';
    const result = extractCodeFromResponse(response);
    expect(result).toBe('const a = 1;\nconst b = 2;\nconst c = a + b;');
  });

  test('strips prose before code when no fences', () => {
    const response = 'Here is the fix:\nconst x = process.env.KEY;';
    const result = extractCodeFromResponse(response);
    expect(result).toBe('const x = process.env.KEY;');
  });

  test('preserves code that starts with "This" when it looks like code', () => {
    const response = 'this.password = process.env.PASSWORD;';
    const result = extractCodeFromResponse(response);
    // "this." at lowercase start is common code, not prose
    expect(result).toContain('process.env.PASSWORD');
  });

  test('handles response with explanation after code block', () => {
    const response = '```js\nconst token = crypto.randomUUID();\n```\nThis uses a secure random UUID instead of Math.random().';
    const result = extractCodeFromResponse(response);
    expect(result).toBe('const token = crypto.randomUUID();');
  });

  test('handles whitespace-only response', () => {
    expect(extractCodeFromResponse('\n\n  \n')).toBe('');
  });
});

describe('remediateDiagnosticInPlace', () => {
  let remediateDiagnosticInPlace: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockWorkspaceEdit.replace = jest.fn();
    mockWorkspace.applyEdit = jest.fn().mockResolvedValue(true);
    mockWindow.showInformationMessage = jest.fn().mockResolvedValue('Apply Fix');
    remediateDiagnosticInPlace = require('../localOllamaRemediation').remediateDiagnosticInPlace;
  });

  test('returns failure when Ollama is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Hardcoded password',
      snippet: 'const password = "secret"',
    });

    expect(result.success).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  test('returns failure when Ollama returns empty response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '' }),
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Hardcoded password',
      snippet: 'const password = "secret"',
    });

    expect(result.success).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toContain('Empty response');
  });

  test('returns success but not applied when Ollama returns original unchanged (false positive)', async () => {
    const originalSnippet = 'const x = 1;';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: originalSnippet }),
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 12 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Some finding',
      snippet: originalSnippet,
    });

    expect(result.success).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.replacement).toBe(originalSnippet.trim());
  });

  test('applies the fix when user clicks "Apply Fix"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'const password = process.env.PASSWORD;' }),
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Hardcoded password',
      snippet: 'const password = "secret"',
    });

    expect(result.success).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.replacement).toBe('const password = process.env.PASSWORD;');
    expect(mockWorkspaceEdit.replace).toHaveBeenCalled();
    expect(mockWorkspace.applyEdit).toHaveBeenCalled();
  });

  test('autoApply mode applies without showing dialog', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'const password = process.env.PASSWORD;' }),
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Hardcoded password',
      snippet: 'const password = "secret"',
    }, true); // autoApply = true

    expect(result.success).toBe(true);
    expect(result.applied).toBe(true);
    expect(mockWindow.showInformationMessage).not.toHaveBeenCalled();
  });

  test('does not apply when user clicks "Discard"', async () => {
    mockWindow.showInformationMessage = jest.fn().mockResolvedValue('Discard');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'const password = process.env.PASSWORD;' }),
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Hardcoded password',
      snippet: 'const password = "secret"',
    });

    expect(result.success).toBe(true);
    expect(result.applied).toBe(false);
    expect(mockWorkspace.applyEdit).not.toHaveBeenCalled();
  });

  test('handles Ollama HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } } as any,
      diagnosticCode: 'SB-SEC-007a',
      diagnosticMessage: 'Hardcoded password',
      snippet: 'const password = "secret"',
    });

    expect(result.success).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toContain('500');
  });

  test('extracts code from fenced response and applies it', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Here is the fix:\n```javascript\nconst token = crypto.randomUUID();\n```\nThis is more secure.',
      }),
    });

    const result = await remediateDiagnosticInPlace({
      uri: { fsPath: '/test.js', path: '/test.js' } as any,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 30 } } as any,
      diagnosticCode: 'SB-SEC-006b',
      diagnosticMessage: 'Math.random for security',
      snippet: 'const token = Math.random()',
    });

    expect(result.success).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.replacement).toBe('const token = crypto.randomUUID();');
  });
});

describe('LocalRemediationCodeActionProvider', () => {
  let provider: any;

  beforeEach(() => {
    jest.resetModules();
    const { LocalRemediationCodeActionProvider } = require('../localRemediationCodeActionProvider');
    provider = new LocalRemediationCodeActionProvider();
  });

  test('offers in-place fix action for SimpleBeacon diagnostics', () => {
    const mockDoc: any = {
      getText: jest.fn(() => 'const password = "secret"'),
      uri: { fsPath: '/test.js' },
    };
    const mockDiag: any = {
      code: 'SB-SEC-007a',
      source: 'SimpleBeacon AI Slop Cop',
      message: 'Hardcoded password',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } },
    };
    const mockContext: any = { diagnostics: [mockDiag] };

    const actions = provider.provideCodeActions(mockDoc, mockDiag.range, mockContext);

    // Should have: in-place fix, view response, guide (3 actions)
    expect(actions.length).toBeGreaterThanOrEqual(3);

    const inPlaceAction = actions.find((a: any) => a.command?.command === 'simplebeacon.remediateDiagnosticInPlace');
    expect(inPlaceAction).toBeDefined();
    expect(inPlaceAction.command.title).toBe('Fix with local Ollama (in-place)');
  });

  test('still offers legacy view-response action', () => {
    const mockDoc: any = {
      getText: jest.fn(() => 'const password = "secret"'),
      uri: { fsPath: '/test.js' },
    };
    const mockDiag: any = {
      code: 'SB-SEC-007a',
      source: 'SimpleBeacon AI Slop Cop',
      message: 'Hardcoded password',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } },
    };
    const mockContext: any = { diagnostics: [mockDiag] };

    const actions = provider.provideCodeActions(mockDoc, mockDiag.range, mockContext);

    const viewAction = actions.find((a: any) => a.command?.command === 'simplebeacon.remediateDiagnostic');
    expect(viewAction).toBeDefined();
    expect(viewAction.command.title).toContain('view response');
  });

  test('ignores non-SimpleBeacon diagnostics', () => {
    const mockDoc: any = {
      getText: jest.fn(() => 'some code'),
      uri: { fsPath: '/test.js' },
    };
    const mockDiag: any = {
      code: 'eslint-no-unused-vars',
      source: 'eslint',
      message: 'Unused variable',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
    const mockContext: any = { diagnostics: [mockDiag] };

    const actions = provider.provideCodeActions(mockDoc, mockDiag.range, mockContext);
    expect(actions.length).toBe(0);
  });
});

