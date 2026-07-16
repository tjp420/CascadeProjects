'use strict';

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
        status: pending ? 'pending' : 'active'
    });

    if (result.error) {
        const status = result.error.includes('exists') || result.error.includes('taken') ? 409 : 400;
        return res.status(status).json({ error: result.error, message: result.error });
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
