'use strict';

/**
 * Public registration policy — off by default in production.
 * Set SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION=true to enable self-serve signup.
 * Set SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE=true to skip admin approval (not recommended).
 */

function isPublicRegistrationAllowed() {
    return String(process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION || '').toLowerCase() === 'true';
}

function registrationRequiresApproval() {
    return String(process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE || '').toLowerCase() !== 'true';
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function validateRegistrationPayload(body = {}) {
    const email = normalizeEmail(body.email);
    const username = normalizeUsername(body.username);
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || body.confirm_password || '');

    if (!name || name.length < 2 || name.length > 80) {
        return { ok: false, status: 400, error: 'invalid_name', message: 'Enter your full name (2–80 characters).' };
    }
    if (!username || !/^[a-z0-9_]{3,32}$/.test(username)) {
        return { ok: false, status: 400, error: 'invalid_username', message: 'Username must be 3–32 characters (letters, numbers, underscore).' };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, status: 400, error: 'invalid_email', message: 'Enter a valid email address.' };
    }
    if (!password || password.length < 8) {
        return { ok: false, status: 400, error: 'weak_password', message: 'Password must be at least 8 characters.' };
    }
    if (password !== confirmPassword) {
        return { ok: false, status: 400, error: 'password_mismatch', message: 'Passwords do not match.' };
    }

    return {
        ok: true,
        email,
        username,
        name,
        password
    };
}

module.exports = {
    isPublicRegistrationAllowed,
    registrationRequiresApproval,
    normalizeEmail,
    normalizeUsername,
    validateRegistrationPayload
};
