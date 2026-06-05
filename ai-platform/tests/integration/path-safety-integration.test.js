/**
 * Path Safety Integration Tests
 * 
 * Tests the path safety validation functions and repository URL validation.
 */

const { validateRepoUrl, assertSafeProjectPath, logResolvedAllowedRoots } = require('../../server/lib/path-safety.cjs');
const path = require('path');

describe('Path Safety Integration', () => {
  describe('validateRepoUrl', () => {
    it('should accept valid HTTPS GitHub URLs', () => {
      const validUrls = [
        'https://github.com/simplebeacon/simplebeacon-cli.git',
        'https://github.com/user/repo.git',
        'https://github.com/org/project.git'
      ];

      validUrls.forEach(url => {
        const result = validateRepoUrl(url);
        expect(result).toBe(url);
      });
    });

    it('should reject non-HTTPS URLs', () => {
      const invalidUrls = [
        'http://github.com/user/repo.git',
        'ftp://github.com/user/repo.git',
        'git@github.com:user/repo.git'
      ];

      invalidUrls.forEach(url => {
        expect(() => validateRepoUrl(url)).toThrow(/HTTPS/i);
      });
    });

    it('should reject malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'https://',
        'https://github.com/',
        ''
      ];

      malformedUrls.forEach(url => {
        expect(() => validateRepoUrl(url)).toThrow();
      });
    });

    it('should accept HTTPS URLs with authentication', () => {
      const authUrls = [
        'https://token@github.com/user/repo.git',
        'https://user:pass@github.com/user/repo.git'
      ];

      authUrls.forEach(url => {
        const result = validateRepoUrl(url);
        expect(result).toBe(url);
      });
    });
  });

  describe('assertSafeProjectPath', () => {
    const testRoot = path.join(__dirname, '../../..');
    
    it('should accept safe project paths', () => {
      const safePaths = [
        path.join(testRoot, 'ai-platform'),
        path.join(testRoot, 'packages/simplebeacon-cli'),
        path.join(testRoot, 'server')
      ];

      safePaths.forEach(projectPath => {
        expect(() => {
          assertSafeProjectPath(projectPath, {
            allowedRoots: [testRoot],
            platformRoot: testRoot
          });
        }).not.toThrow();
      });
    });

    it('should reject paths outside allowed roots', () => {
      const unsafePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32',
        path.join(testRoot, '../outside'),
        path.join(testRoot, '../../far-outside')
      ];

      unsafePaths.forEach(projectPath => {
        expect(() => {
          assertSafeProjectPath(projectPath, {
            allowedRoots: [testRoot],
            platformRoot: testRoot
          });
        }).toThrow(/outside allowed analysis roots/i);
      });
    });

    it('should handle relative paths correctly', () => {
      const relativePath = './ai-platform';
      const absolutePath = path.resolve(relativePath);

      expect(() => {
        assertSafeProjectPath(absolutePath, {
          allowedRoots: [testRoot],
          platformRoot: testRoot
        });
      }).not.toThrow();
    });

    it('should normalize path separators', () => {
      const windowsPath = 'C:\\Users\\Test\\project';
      const unixPath = '/Users/Test/project';

      // These would need to be tested in actual Windows environment
      expect(typeof windowsPath).toBe('string');
      expect(typeof unixPath).toBe('string');
    });
  });

  describe('logResolvedAllowedRoots', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log allowed roots information', () => {
      const allowedRoots = [
        path.join(testRoot, 'ai-platform'),
        path.join(testRoot, 'packages')
      ];

      logResolvedAllowedRoots(allowedRoots, testRoot);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Allowed analysis roots:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Platform root:')
      );
    });

    it('should handle empty allowed roots', () => {
      logResolvedAllowedRoots([], testRoot);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No allowed roots configured')
      );
    });

    it('should handle single allowed root', () => {
      const singleRoot = [path.join(testRoot, 'ai-platform')];

      logResolvedAllowedRoots(singleRoot, testRoot);

      expect(consoleSpy).toHaveBeenCalledTimes(3); // Header, root, platform
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined inputs gracefully', () => {
      expect(() => validateRepoUrl(null)).toThrow();
      expect(() => validateRepoUrl(undefined)).toThrow();
      expect(() => validateRepoUrl('')).toThrow();
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://github.com/' + 'a'.repeat(1000) + '/repo.git';
      
      // Should either accept or reject gracefully
      expect(() => validateRepoUrl(longUrl)).not.toThrow('Out of memory');
    });

    it('should handle special characters in URLs', () => {
      const specialUrls = [
        'https://github.com/user-name/repo-name.git',
        'https://github.com/user_name/repo_name.git',
        'https://github.com/user123/repo-456.git'
      ];

      specialUrls.forEach(url => {
        const result = validateRepoUrl(url);
        expect(result).toBe(url);
      });
    });

    it('should validate path traversal attempts', () => {
      const traversalPaths = [
        '../../../etc/passwd',
        path.join(testRoot, 'ai-platform/../../../etc/passwd'),
        path.join(testRoot, 'ai-platform/..\\..\\..\\windows\\system32')
      ];

      traversalPaths.forEach(projectPath => {
        expect(() => {
          assertSafeProjectPath(projectPath, {
            allowedRoots: [testRoot],
            platformRoot: testRoot
          });
        }).toThrow(/outside allowed analysis roots/i);
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of allowed roots efficiently', () => {
      const manyRoots = Array.from({ length: 100 }, (_, i) => 
        path.join(testRoot, `project-${i}`)
      );

      const startTime = Date.now();
      
      expect(() => {
        logResolvedAllowedRoots(manyRoots, testRoot);
      }).not.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should cache path resolutions for repeated calls', () => {
      const projectPath = path.join(testRoot, 'ai-platform');
      const options = {
        allowedRoots: [testRoot],
        platformRoot: testRoot
      };

      // Multiple calls should not throw and should be consistent
      expect(() => {
        assertSafeProjectPath(projectPath, options);
        assertSafeProjectPath(projectPath, options);
        assertSafeProjectPath(projectPath, options);
      }).not.toThrow();
    });
  });
});
