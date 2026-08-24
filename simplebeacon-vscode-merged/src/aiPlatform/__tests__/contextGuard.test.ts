/**
 * Tests for the Context Guard — verifies truncation, mode handling,
 * toast debouncing, and configuration clamping.
 */

// Mock vscode module — getSbConfig() calls vscode.workspace.getConfiguration('simplebeacon')
const mockShowInformationMessage = jest.fn();
const mockConfig: Record<string, unknown> = {};
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: mockShowInformationMessage,
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: unknown) => mockConfig[key] ?? defaultValue),
    })),
  },
}));

// Import once — mock state is reset in beforeEach, not the module
const {
  applyContextGuard,
  getContextGuardMode,
  getContextGuardMaxChars,
  resetToastDebounce,
} = require('../contextGuard');

describe('ContextGuard', () => {
  beforeEach(() => {
    mockShowInformationMessage.mockClear();
    Object.keys(mockConfig).forEach((k) => delete mockConfig[k]);
    resetToastDebounce();
  });

  describe('getContextGuardMode', () => {
    test('returns "both" by default', () => {
      expect(getContextGuardMode()).toBe('both');
    });

    test('returns configured mode when valid', () => {
      mockConfig.contextGuardMode = 'silent';
      expect(getContextGuardMode()).toBe('silent');
    });

    test('falls back to "both" for invalid mode', () => {
      mockConfig.contextGuardMode = 'invalid';
      expect(getContextGuardMode()).toBe('both');
    });

    test('respects "off" mode', () => {
      mockConfig.contextGuardMode = 'off';
      expect(getContextGuardMode()).toBe('off');
    });
  });

  describe('getContextGuardMaxChars', () => {
    test('returns 4000 by default', () => {
      expect(getContextGuardMaxChars()).toBe(4000);
    });

    test('returns configured value when in range', () => {
      mockConfig.contextGuardMaxChars = 8000;
      expect(getContextGuardMaxChars()).toBe(8000);
    });

    test('clamps to 500 minimum', () => {
      mockConfig.contextGuardMaxChars = 100;
      expect(getContextGuardMaxChars()).toBe(500);
    });

    test('clamps to 100000 maximum', () => {
      mockConfig.contextGuardMaxChars = 500000;
      expect(getContextGuardMaxChars()).toBe(100000);
    });

    test('handles non-number values', () => {
      mockConfig.contextGuardMaxChars = 'not a number';
      expect(getContextGuardMaxChars()).toBe(500);
    });
  });

  describe('applyContextGuard — mode "off"', () => {
    test('passes content through unchanged', () => {
      mockConfig.contextGuardMode = 'off';
      const content = 'x'.repeat(10000);
      const result = applyContextGuard(content, 'test.js');
      expect(result.content).toBe(content);
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(10000);
      expect(result.effectiveLength).toBe(10000);
      expect(result.toastShown).toBe(false);
    });
  });

  describe('applyContextGuard — mode "silent"', () => {
    test('truncates content without showing toast', () => {
      mockConfig.contextGuardMode = 'silent';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(2500);
      const result = applyContextGuard(content, 'test.js');
      expect(result.content.length).toBe(600);
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(2500);
      expect(result.effectiveLength).toBe(600);
      expect(result.toastShown).toBe(false);
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });

    test('does not truncate content under threshold', () => {
      mockConfig.contextGuardMode = 'silent';
      mockConfig.contextGuardMaxChars = 5000;
      const content = 'short content';
      const result = applyContextGuard(content, 'test.js');
      expect(result.content).toBe('short content');
      expect(result.truncated).toBe(false);
    });
  });

  describe('applyContextGuard — mode "toast"', () => {
    test('shows toast but does not truncate', () => {
      mockConfig.contextGuardMode = 'toast';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(2500);
      const result = applyContextGuard(content, 'test.js');
      expect(result.content).toBe(content);
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(2500);
      expect(result.effectiveLength).toBe(2500);
      expect(result.toastShown).toBe(true);
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    });

    test('does not show toast when content is under threshold', () => {
      mockConfig.contextGuardMode = 'toast';
      mockConfig.contextGuardMaxChars = 5000;
      const content = 'short';
      const result = applyContextGuard(content, 'test.js');
      expect(result.toastShown).toBe(false);
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('applyContextGuard — mode "both"', () => {
    test('truncates content and shows toast', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(2500);
      const result = applyContextGuard(content, 'test.js');
      expect(result.content.length).toBe(600);
      expect(result.truncated).toBe(true);
      expect(result.toastShown).toBe(true);
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    });

    test('toast message mentions truncation', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(2500);
      applyContextGuard(content, 'bigfile.js');
      expect(mockShowInformationMessage).toHaveBeenCalledWith(expect.stringContaining('bigfile.js'));
      expect(mockShowInformationMessage).toHaveBeenCalledWith(expect.stringContaining('truncated'));
    });

    test('toast message mentions the threshold', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 4000;
      const content = 'x'.repeat(5000);
      applyContextGuard(content, 'test.js');
      expect(mockShowInformationMessage).toHaveBeenCalledWith(expect.stringContaining('4,000'));
    });
  });

  describe('Toast debouncing', () => {
    test('does not show toast more than once per 10 seconds', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(1200);

      applyContextGuard(content, 'file1.js');
      applyContextGuard(content, 'file2.js');
      applyContextGuard(content, 'file3.js');

      // Only one toast should have been shown despite 3 calls
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    });

    test('shows toast again after debounce window resets', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(1200);

      applyContextGuard(content, 'file1.js');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      // Manually reset debounce (simulates time passing)
      resetToastDebounce();

      applyContextGuard(content, 'file2.js');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    test('handles empty content', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const result = applyContextGuard('', 'test.js');
      expect(result.content).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(0);
    });

    test('handles content exactly at threshold', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(600);
      const result = applyContextGuard(content, 'test.js');
      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
    });

    test('handles content one char over threshold', () => {
      mockConfig.contextGuardMode = 'both';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'x'.repeat(601);
      const result = applyContextGuard(content, 'test.js');
      expect(result.truncated).toBe(true);
      expect(result.content.length).toBe(600);
    });

    test('preserves content at the boundary correctly', () => {
      mockConfig.contextGuardMode = 'silent';
      mockConfig.contextGuardMaxChars = 600;
      const content = 'A'.repeat(650);
      const result = applyContextGuard(content, 'test.js');
      expect(result.content.length).toBe(600);
      expect(result.content).toBe('A'.repeat(600));
    });
  });
});
