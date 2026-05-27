const {
    probeLlamaCppBin,
    buildSemanticHints
} = require('../../server/lib/llama-cpp-hints');

describe('llama cpp semantic hints', () => {
    const original = process.env.LLAMA_CPP_BIN;

    afterEach(() => {
        if (original === undefined) delete process.env.LLAMA_CPP_BIN;
        else process.env.LLAMA_CPP_BIN = original;
    });

    test('returns disabled hints when LLAMA_CPP_BIN unset', () => {
        delete process.env.LLAMA_CPP_BIN;
        const hints = buildSemanticHints([
            { fileA: 'a.js', fileB: 'b.js', similarity: 0.93, method: 'token-jaccard' }
        ]);
        expect(hints.enabled).toBe(false);
        expect(hints.hints).toEqual([]);
    });

    test('builds review hints from fuzzy pairs when bin configured', () => {
        process.env.LLAMA_CPP_BIN = process.execPath;
        const hints = buildSemanticHints([
            { fileA: 'server/a.js', fileB: 'server/b.js', similarity: 0.96, method: 'token-jaccard' }
        ]);
        expect(hints.enabled).toBe(true);
        expect(hints.executable).toBe(true);
        expect(hints.hints).toHaveLength(1);
        expect(hints.hints[0].files).toEqual(['server/a.js', 'server/b.js']);
        expect(hints.disclaimer).toMatch(/not model-generated/i);
    });

    test('probeLlamaCppBin reports missing path', () => {
        const probe = probeLlamaCppBin('C:\\missing\\llama-cli.exe');
        expect(probe.configured).toBe(true);
        expect(probe.executable).toBe(false);
    });
});
