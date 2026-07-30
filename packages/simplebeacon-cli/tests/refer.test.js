'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
    executeReferSubcommandLogic,
    runReferSubcommand
} = require('../src/commands/refer');

describe('refer command phase 1 (local-only)', () => {
    test('enforces deterministic prefix format bounds', () => {
        const payload = executeReferSubcommandLogic('test-manager@company.com', false);
        assert.equal(payload.success, true);
        assert.match(payload.inviteToken, /^tkn_[a-f0-9]{24}$/);
        assert.match(payload.referralLink, /\?ref=cli_[a-f0-9]{24}$/);
        assert.equal(payload.mode, 'local_only');
    });

    test('blocks invalid domain structure arrays with clear error', () => {
        assert.throws(
            () => executeReferSubcommandLogic('corrupted-address-token', false),
            /Invalid target email routing structure/
        );
    });

    test('validates json serialization fields', () => {
        const payload = executeReferSubcommandLogic('ai-architect@platform.io', true);
        assert.equal(payload.mode, 'local_only');
        assert.equal(payload.refereeEmail, 'ai-architect@platform.io');
        assert.ok(typeof payload.timestamp === 'string' && payload.timestamp.endsWith('Z'));
    });

    test('returns exit code 2 when required --email is missing', () => {
        const out = [];
        const err = [];
        const code = runReferSubcommand({}, {
            writeOut: (m) => out.push(m),
            writeErr: (m) => err.push(m)
        });
        assert.equal(code, 2);
        assert.equal(out.length, 0);
        assert.match(err.join('\n'), /Missing required flag: --email/);
    });

    test('returns exit code 1 for invalid email in execution path', () => {
        const out = [];
        const err = [];
        const code = runReferSubcommand({ email: 'not-an-email', format: 'json' }, {
            writeOut: (m) => out.push(m),
            writeErr: (m) => err.push(m)
        });
        assert.equal(code, 1);
        assert.equal(out.length, 0);
        assert.match(err.join('\n'), /Invalid target email routing structure/);
    });

    test('prints json output when requested', () => {
        const out = [];
        const err = [];
        const code = runReferSubcommand({ email: 'engineer@org.com', format: 'json' }, {
            writeOut: (m) => out.push(m),
            writeErr: (m) => err.push(m)
        });
        assert.equal(code, 0);
        assert.equal(err.length, 0);
        const payload = JSON.parse(out.join('\n'));
        assert.equal(payload.success, true);
        assert.equal(payload.refereeEmail, 'engineer@org.com');
        assert.match(payload.inviteToken, /^tkn_[a-f0-9]{24}$/);
    });
});
