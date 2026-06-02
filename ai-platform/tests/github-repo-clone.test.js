const { validateRepoUrl } = require('../server/lib/path-safety');

describe('github repo URL validation', () => {
    test('validateRepoUrl accepts HTTPS github repository URLs', () => {
        const url = validateRepoUrl('https://github.com/simplebeacon/simplebeacon-cli.git');
        expect(url).toBe('https://github.com/simplebeacon/simplebeacon-cli.git');
    });

    test('validateRepoUrl rejects non-HTTPS hosts', () => {
        expect(() => validateRepoUrl('http://github.com/foo/bar')).toThrow(/HTTPS/i);
    });
});
