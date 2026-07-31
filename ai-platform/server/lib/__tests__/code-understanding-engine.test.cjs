'use strict';

jest.mock('../../services/cloud-inference-service.cjs', () => ({
  explainCodeWithProvider: jest.fn(),
  providerConfigured: jest.fn().mockReturnValue(false),
}));

const {
  understandCodeSnippet,
  understandFile,
  attachUnderstandingToCodebaseReport,
} = require('../code-understanding/code-understanding-engine.cjs');

describe('code-understanding/code-understanding-engine', () => {
  test('exports expected functions', () => {
    expect(typeof understandCodeSnippet).toBe('function');
    expect(typeof understandFile).toBe('function');
    expect(typeof attachUnderstandingToCodebaseReport).toBe('function');
  });

  test('understandCodeSnippet returns object for simple snippet', async () => {
    const result = await understandCodeSnippet('const x = 1;', 'javascript', 'test.js');
    expect(typeof result).toBe('object');
  });

  test('attachUnderstandingToCodebaseReport adds understanding to report', () => {
    const report = { files: [{ path: 'src/index.js', content: 'const x = 1;' }] };
    const result = attachUnderstandingToCodebaseReport(report, '/project');
    expect(typeof result).toBe('object');
  });
});
