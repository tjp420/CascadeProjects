'use strict';

const crypto = require('crypto');

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DEFAULT_BASE_URL = 'https://simplebeacon.ai';

function utcTimestamp() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function normalizeBaseUrl(value) {
    const raw = String(value || DEFAULT_BASE_URL).trim();
    if (!raw) return DEFAULT_BASE_URL;
    return raw.replace(/\/$/, '');
}

function buildInviteToken(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const hex = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
    return `tkn_${hex}`;
}

function executeReferSubcommandLogic(email, jsonMode = false, server = DEFAULT_BASE_URL) {
    const refereeEmail = String(email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(refereeEmail)) {
        throw new Error('Invalid target email routing structure');
    }

    const token = buildInviteToken(refereeEmail);
    const base = normalizeBaseUrl(server);
    const referralLink = `${base}/?ref=cli_${token.slice(4)}`;

    return {
        success: true,
        refereeEmail,
        inviteToken: token,
        referralLink,
        mode: 'local_only',
        timestamp: utcTimestamp(),
        output: jsonMode ? 'json' : 'text'
    };
}

function renderHumanReadable(payload) {
    return [
        '------------------------------------------------------------',
        'SIMPLEBEACON TRACKABLE REFERRAL INVITATION',
        '------------------------------------------------------------',
        `Targeted Referee Email : ${payload.refereeEmail}`,
        `Generated Invite Token : ${payload.inviteToken}`,
        `Trackable Activation URL: ${payload.referralLink}`,
        '------------------------------------------------------------',
        'Token compiled locally. Ready for pipeline distribution.'
    ].join('\n');
}

function runReferSubcommand(options = {}, io = {}) {
    const writeOut = io.writeOut || ((msg) => process.stdout.write(`${msg}\n`));
    const writeErr = io.writeErr || ((msg) => process.stderr.write(`${msg}\n`));

    const email = String(options.email || '').trim();
    if (!email) {
        writeErr('Missing required flag: --email <addr>');
        return 2;
    }

    try {
        const jsonMode = options.format === 'json' || options.jsonOutput === true;
        const payload = executeReferSubcommandLogic(email, jsonMode, options.server);

        if (jsonMode) {
            writeOut(JSON.stringify(payload, null, 2));
        } else {
            writeOut(renderHumanReadable(payload));
        }

        return 0;
    } catch (err) {
        writeErr(err && err.message ? err.message : 'Referral token generation failed');
        return 1;
    }
}

module.exports = {
    EMAIL_PATTERN,
    executeReferSubcommandLogic,
    runReferSubcommand
};
