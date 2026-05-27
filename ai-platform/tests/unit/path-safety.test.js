const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    assertSafeProjectPath,
    validateRepoUrl,
    assertSafeExecutablePath,
    isPathWithinRoots,
    resolveDefaultAllowedRoots,
    detectMonorepoRoot
} = require('../../server/lib/path-safety');

describe('path-safety', () => {
    let tempDir;
    let allowedRoot;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-path-safety-'));
        allowedRoot = path.join(tempDir, 'workspace');
        fs.mkdirSync(allowedRoot, { recursive: true });
        fs.writeFileSync(path.join(allowedRoot, 'ok.txt'), 'ok');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('assertSafeProjectPath allows paths within allowed roots', () => {
        const resolved = assertSafeProjectPath(allowedRoot, [allowedRoot]);
        expect(resolved).toBe(path.resolve(allowedRoot));
    });

    test('assertSafeProjectPath rejects paths outside allowed roots', () => {
        expect(() => assertSafeProjectPath(os.tmpdir(), [allowedRoot])).toThrow(/outside allowed analysis roots/);
        expect(() => assertSafeProjectPath(os.tmpdir(), [allowedRoot])).toThrow(/Requested:/);
    });

    test('validateRepoUrl accepts known git hosts', () => {
        expect(validateRepoUrl('https://github.com/org/repo.git')).toContain('github.com');
    });

    test('validateRepoUrl rejects shell metacharacters', () => {
        expect(() => validateRepoUrl('https://github.com/org/repo;rm -rf /')).toThrow(/invalid characters/);
    });

    test('assertSafeExecutablePath requires absolute paths', () => {
        expect(() => assertSafeExecutablePath('llama-cli')).toThrow(/absolute path/);
        expect(assertSafeExecutablePath(path.join(os.tmpdir(), 'llama-cli'))).toContain('llama-cli');
    });

    test('isPathWithinRoots handles nested directories', () => {
        const nested = path.join(allowedRoot, 'nested');
        fs.mkdirSync(nested);
        expect(isPathWithinRoots(nested, [allowedRoot])).toBe(true);
    });

    test('resolveDefaultAllowedRoots includes monorepo parent for ai-platform layout', () => {
        const monorepoRoot = path.join(tempDir, 'CascadeProjects');
        fs.mkdirSync(path.join(monorepoRoot, 'ai-platform'), { recursive: true });
        fs.writeFileSync(path.join(monorepoRoot, 'ai-platform', 'simplebeacon-server.js'), '// stub');

        const roots = resolveDefaultAllowedRoots(path.join(monorepoRoot, 'ai-platform'));
        expect(roots).toEqual(expect.arrayContaining([
            path.resolve(monorepoRoot, 'ai-platform'),
            path.resolve(monorepoRoot)
        ]));
        expect(() => assertSafeProjectPath(monorepoRoot, roots)).not.toThrow();
    });

    test('assertSafeProjectPath rejects traversal outside allowed roots', () => {
        const outside = path.join(tempDir, 'outside');
        fs.mkdirSync(outside, { recursive: true });
        const traversal = path.join(allowedRoot, '..', 'outside');
        expect(() => assertSafeProjectPath(traversal, [allowedRoot])).toThrow(/outside allowed analysis roots/);
    });

    test('detectMonorepoRoot returns parent when platform folder is ai-platform', () => {
        const platformRoot = path.join(tempDir, 'workspace', 'ai-platform');
        fs.mkdirSync(platformRoot, { recursive: true });
        expect(detectMonorepoRoot(platformRoot)).toBe(path.join(tempDir, 'workspace'));
    });
});
