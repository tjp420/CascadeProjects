const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getPlanningPrompt, getVerificationPrompt } = require('../prompts.js');

describe('getPlanningPrompt', () => {
    it('returns a string containing the user goal', () => {
        const goal = 'Refactor the auth module';
        const prompt = getPlanningPrompt(goal);
        assert.strictEqual(typeof prompt, 'string');
        assert.ok(prompt.includes(goal), 'Prompt should include the user goal');
    });

    it('mentions available operations', () => {
        const prompt = getPlanningPrompt('test');
        assert.ok(prompt.includes('read_file'), 'Should mention read_file operation');
        assert.ok(prompt.includes('patch_file'), 'Should mention patch_file operation');
        assert.ok(prompt.includes('run_tests'), 'Should mention run_tests operation');
    });

    it('insists on JSON array output only', () => {
        const prompt = getPlanningPrompt('test');
        assert.ok(prompt.includes('JSON array'), 'Should require JSON array output');
        assert.ok(prompt.includes('Output ONLY'), 'Should restrict output to JSON only');
    });

    it('forbids path traversal', () => {
        const prompt = getPlanningPrompt('test');
        assert.ok(
            prompt.includes('..') || prompt.includes('absolute'),
            'Should warn against relative or absolute path tricks'
        );
    });
});

describe('getVerificationPrompt', () => {
    it('returns a string containing the terminal output', () => {
        const output = 'Test passed successfully';
        const prompt = getVerificationPrompt(output);
        assert.strictEqual(typeof prompt, 'string');
        assert.ok(prompt.includes(output), 'Prompt should include the terminal output');
    });

    it('requests SUCCESS or FAILURE only', () => {
        const prompt = getVerificationPrompt('some log');
        assert.ok(prompt.includes('SUCCESS'), 'Should mention SUCCESS');
        assert.ok(prompt.includes('FAILURE'), 'Should mention FAILURE');
        assert.ok(prompt.includes('one word'), 'Should restrict to one word');
    });
});
