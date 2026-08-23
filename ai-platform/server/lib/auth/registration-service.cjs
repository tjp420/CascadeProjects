'use strict';

const logger = require('../app-logger.cjs').child('registration-service');
const { generateToken } = require('../../middleware/auth.cjs');
const { registerUser } = require('../../services/user-service.cjs');
const {
    isPublicRegistrationAllowed,
    registrationRequiresApproval,
    validateRegistrationPayload
} = require('./registration-policy.cjs');

async function handleRegister(req, res) {
    if (!isPublicRegistrationAllowed()) {
        return res.status(403).json({
            error: 'registration_disabled',
            message: 'Self-serve account creation is disabled. Contact support@simplebeacon.ai for access.'
        });
    }

    const validated = validateRegistrationPayload(req.body || {});
    if (!validated.ok) {
        return res.status(validated.status).json({
            error: validated.error,
            message: validated.message
        });
    }

    const pending = registrationRequiresApproval();
    const result = await registerUser(validated.email, validated.password, validated.name, {
        username: validated.username,
        status: pending ? 'pending' : 'active',
        db: req.app?.locals?.db || req.db || null
    });

    if (result.error) {
        const status = result.error.includes('exists') || result.error.includes('taken') ? 409 : 400;
        return res.status(status).json({ error: result.error, message: result.error });
    }

    // Grant 14-day trial on successful registration (non-blocking)
    let trialGranted = false;
    let trialEndsAt = null;
    try {
        const { grantTrial } = require('../simplebeacon-subscription-store.cjs');
        const trialRecord = await grantTrial(result.user.email, 'developer');
        if (trialRecord) {
            trialGranted = true;
            trialEndsAt = trialRecord.trialEndsAt;
        }
    } catch (trialErr) {
        // Non-blocking — signup succeeds even if trial grant fails
        logger.warn('Trial grant failed during registration', { error: trialErr.message });
    }

    if (pending) {
        return res.status(201).json({
            success: true,
            pending: true,
            message: 'Account submitted. An operator will review and activate your access before you can sign in.',
            user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                username: result.user.username,
                status: 'pending'
            }
        });
    }

    const token = generateToken(result.user);
    return res.status(201).json({
        message: 'Account created successfully',
        token,
        trial: trialGranted ? {
            active: true,
            tier: 'developer',
            endsAt: trialEndsAt
        } : null,
        user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            username: result.user.username,
            trustLevel: result.user.trustLevel,
            status: result.user.status || 'active'
        }
    });
}

module.exports = {
    handleRegister
};
