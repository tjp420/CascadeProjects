'use strict';

/**
 * Email provider configuration helpers (Resend API, Resend SMTP relay, custom SMTP).
 */

function getResendApiKey() {
    return String(process.env.RESEND_API_KEY || '').trim();
}

function getFromAddress() {
    return String(process.env.RESEND_FROM || process.env.SMTP_FROM || 'certificates@simplebeacon.ai').trim();
}

function hasResendApiKey() {
    return getResendApiKey().startsWith('re_');
}

function getSmtpSettings() {
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = String(process.env.SMTP_USER || '').trim();
    let pass = String(process.env.SMTP_PASS || '').trim();
    const from = String(process.env.SMTP_FROM || getFromAddress()).trim();
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if ((!host || !user || !pass) && hasResendApiKey()) {
        return {
            host: 'smtp.resend.com',
            port: 465,
            user: 'resend',
            pass: getResendApiKey(),
            from,
            secure: true,
            mode: 'resend-smtp-relay'
        };
    }

    if (!host || !user || !pass) {
        return null;
    }

    return { host, port, user, pass, from, secure, mode: 'smtp' };
}

function isEmailConfigured() {
    return hasResendApiKey() || Boolean(getSmtpSettings());
}

function getEmailStatus(options = {}) {
    const db = options.db;
    let pendingCount = null;
    if (db && typeof db.prepare === 'function') {
        try {
            const row = db.prepare("SELECT COUNT(*) AS count FROM email_queue WHERE status = 'pending'").get();
            pendingCount = Number(row?.count || 0);
        } catch (_err) {
            pendingCount = null;
        }
    }

    const smtp = getSmtpSettings();
    return {
        configured: isEmailConfigured(),
        from: getFromAddress(),
        providers: {
            resendApi: hasResendApiKey(),
            smtp: Boolean(smtp),
            smtpMode: smtp?.mode || null
        },
        pendingQueueCount: pendingCount,
        setup: {
            resendDashboard: 'https://resend.com/domains',
            requiredEnv: ['RESEND_API_KEY', 'RESEND_FROM'],
            optionalEnv: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
        }
    };
}

module.exports = {
    getResendApiKey,
    getFromAddress,
    hasResendApiKey,
    getSmtpSettings,
    isEmailConfigured,
    getEmailStatus
};
