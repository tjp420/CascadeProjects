/**
 * Shared license token generation and HTML escaping utilities.
 */

'use strict';

const jwt = require('jsonwebtoken');

function generateLicenseToken(payload, secret, expiresInMinutes) {
    const tokenPayload = {
        email: payload.email || '',
        tier: payload.tier || 'community',
        features: payload.features || [],
        clientName: payload.clientName || payload.email || 'Client',
        projectName: payload.projectName || 'Project'
    };
    if (payload.previousToken) tokenPayload.previousToken = payload.previousToken;
    return jwt.sign(tokenPayload, secret, { expiresIn: expiresInMinutes * 60 });
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = { generateLicenseToken, escapeHtml };
