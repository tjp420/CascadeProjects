const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runLocalAgent, callLocalModel } = require('../orchestrator.cjs');

const UNREACHABLE_TEST_PORT = 59999;

describe('orchestrator', () => {
    it('callLocalModel throws when Ollama is unreachable', async () => {
        const originalUrl = process.env.OLLAMA_BASE_URL;
        process.env.OLLAMA_BASE_URL = 'http://localhost:' + UNREACHABLE_TEST_PORT;
        try {
            await assert.rejects(
                callLocalModel('test'),
                /Ollama Connection Error/
            );
        } finally {
            process.env.OLLAMA_BASE_URL = originalUrl;
        }
    });

    it('runLocalAgent returns error when Ollama is unreachable', async () => {
        const originalUrl = process.env.OLLAMA_BASE_URL;
        process.env.OLLAMA_BASE_URL = 'http://localhost:' + UNREACHABLE_TEST_PORT;
        try {
            const result = await runLocalAgent('do something');
            assert.strictEqual(result.success, false);
            assert.match(result.error, /Ollama Connection Error/);
        } finally {
            process.env.OLLAMA_BASE_URL = originalUrl;
        }
    });
});

describe('validateStep', () => {
    it('accepts a valid step with op field', () => {
        const { validateStep } = require('../orchestrator.cjs');
        const step = { op: 'read_file', path: 'package.json' };
        const result = validateStep(step, 1);
        assert.strictEqual(result.valid, true);
    });

    it('rejects a step missing op field', () => {
        const { validateStep } = require('../orchestrator.cjs');
        const step = { path: 'package.json' };
        const result = validateStep(step, 1);
        assert.strictEqual(result.valid, false);
    });

    it('rejects a step referencing a ghost file', () => {
        const { validateStep } = require('../orchestrator.cjs');
        const step = { op: 'read_file', path: 'does-not-exist.txt' };
        const result = validateStep(step, 1);
        assert.strictEqual(result.valid, false);
        assert.match(result.error, /Ghost file/);
    });
});

describe('executeReadFile', () => {
    it('reads an existing file and returns size', () => {
        const { executeReadFile } = require('../orchestrator.cjs');
        const result = executeReadFile({ op: 'read_file', path: 'package.json' }, 1);
        assert.strictEqual(result.op, 'read_file');
        assert.strictEqual(result.path, 'package.json');
        assert.strictEqual(typeof result.size, 'number');
        assert.ok(result.size > 0);
    });
});

describe('parsePlan', () => {
    it('parses a JSON array plan', () => {
        const { parsePlan } = require('../orchestrator.cjs');
        const plan = parsePlan('[{"op":"read_file","path":"package.json"}]');
        assert.strictEqual(Array.isArray(plan), true);
        assert.strictEqual(plan.length, 1);
        assert.strictEqual(plan[0].op, 'read_file');
    });

    it('throws for non-array JSON', () => {
        const { parsePlan } = require('../orchestrator.cjs');
        assert.throws(() => parsePlan('{"op":"read_file"}'), /Plan is not a JSON array/);
    });
});

describe('executePatchFile', () => {
    const tmpFile = path.join(process.cwd(), 'tmp-patch-test.js');

    it('applies a valid patch', () => {
        const { executePatchFile } = require('../orchestrator.cjs');
        fs.writeFileSync(tmpFile, 'const greeting = "hello world";', 'utf8');
        const result = executePatchFile({ op: 'patch_file', path: 'tmp-patch-test.js', search: 'hello world', replace: 'hello universe' }, 1);
        assert.strictEqual(result.ok, true);
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.strictEqual(content, 'const greeting = "hello universe";');
        fs.unlinkSync(tmpFile);
    });

    it('returns error when target string is not found', () => {
        const { executePatchFile } = require('../orchestrator.cjs');
        fs.writeFileSync(tmpFile, 'const greeting = "hello world";', 'utf8');
        const result = executePatchFile({ op: 'patch_file', path: 'tmp-patch-test.js', search: 'nonexistent', replace: 'replacement' }, 1);
        assert.strictEqual(result.ok, false);
        fs.unlinkSync(tmpFile);
    });
});
