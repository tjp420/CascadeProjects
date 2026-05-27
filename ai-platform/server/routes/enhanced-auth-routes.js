/**
 * Enhanced Authentication Routes
 * Complete API endpoints for authentication system
 */

const express = require('express');
const { EnhancedAuthHandlers, authenticate, authorize } = require('../services/enhanced-auth-handlers');

const router = express.Router();
const authHandlers = new EnhancedAuthHandlers();

// Public routes (no authentication required)

/**
 * POST /api/auth/login
 * Sign in with email and password
 * Body: { email, password, rememberMe? }
 */
router.post('/login', async (req, res) => {
    await authHandlers.handleLogin(req, res);
});

/**
 * POST /api/auth/signup
 * Create a new account
 * Body: { name, email, password }
 */
router.post('/signup', async (req, res) => {
    await authHandlers.handleSignUp(req, res);
});

/**
 * POST /api/auth/reset-password
 * Request password reset
 * Body: { email }
 */
router.post('/reset-password', async (req, res) => {
    await authHandlers.handlePasswordReset(req, res);
});

/**
 * POST /api/auth/reset-password-confirm
 * Confirm password reset with token
 * Body: { token, newPassword }
 */
router.post('/reset-password-confirm', async (req, res) => {
    await authHandlers.handlePasswordResetConfirm(req, res);
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 * Body: { refreshToken }
 */
router.post('/refresh', async (req, res) => {
    await authHandlers.handleRefreshToken(req, res);
});

/**
 * GET /api/auth/verify-email
 * Verify email address
 * Query: { token }
 */
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }
        
        // Find user with this verification token
        const user = authHandlers.demoUsers.find(u => u.emailVerificationToken === token);
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }
        
        // Mark email as verified
        user.emailVerified = true;
        user.emailVerificationToken = null;
        
        res.json({
            success: true,
            message: 'Email verified successfully! You can now sign in.'
        });
        
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /api/auth/logout
 * Sign out (clear cookies)
 */
router.post('/logout', async (req, res) => {
    await authHandlers.handleLogout(req, res);
});

// Protected routes (authentication required)

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
    await authHandlers.handleMe(req, res);
});

/**
 * PUT /api/auth/profile
 * Update user profile
 * Body: { name?, email? }
 */
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = req.user;
        
        // Validation
        if (email && !authHandlers.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }
        
        if (name && name.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters'
            });
        }
        
        // Check if email is being changed and already exists
        if (email && email !== user.email) {
            const existingUser = authHandlers.findUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'An account with this email already exists'
                });
            }
            
            // Mark email as unverified if changed
            user.emailVerified = false;
            user.emailVerificationToken = require('crypto').randomBytes(32).toString('hex');
        }
        
        // Update user
        if (name) user.name = name;
        if (email) user.email = email;
        
        // Send verification email if email was changed
        if (email && email !== user.email) {
            await authHandlers.sendVerificationEmail(user);
        }
        
        res.json({
            success: true,
            message: email && email !== user.email ? 
                'Profile updated. Please check your email to verify the new address.' : 
                'Profile updated successfully',
            user: authHandlers.sanitizeUser(user)
        });
        
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * PUT /api/auth/password
 * Change password
 * Body: { currentPassword, newPassword }
 */
router.put('/password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = req.user;
        const bcrypt = require('bcryptjs');
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, authHandlers.bcryptRounds);
        user.password = hashedPassword;
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * DELETE /api/auth/account
 * Delete user account
 */
router.delete('/account', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // In production, you'd want to soft delete or mark for deletion
        const index = authHandlers.demoUsers.findIndex(u => u.id === user.id);
        if (index > -1) {
            authHandlers.demoUsers.splice(index, 1);
        }
        
        // Clear cookies
        res.clearCookie('authToken');
        res.clearCookie('refreshToken');
        
        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
        
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Admin routes (require admin role)

/**
 * GET /api/auth/admin/users
 * Get all users (admin only)
 */
router.get('/admin/users', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const users = authHandlers.demoUsers.map(user => authHandlers.sanitizeUser(user));
        
        res.json({
            success: true,
            users,
            total: users.length
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * PUT /api/auth/admin/users/:id/role
 * Update user role (admin only)
 */
router.put('/admin/users/:id/role', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        const validRoles = ['user', 'admin', 'moderator'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }
        
        const user = authHandlers.findUserById(parseInt(id));
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.role = role;
        
        res.json({
            success: true,
            message: 'User role updated successfully',
            user: authHandlers.sanitizeUser(user)
        });
        
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * PUT /api/auth/admin/users/:id/status
 * Activate/deactivate user (admin only)
 */
router.put('/admin/users/:id/status', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean'
            });
        }
        
        const user = authHandlers.findUserById(parseInt(id));
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Prevent deactivating yourself
        if (user.id === req.user.id && !isActive) {
            return res.status(400).json({
                success: false,
                message: 'You cannot deactivate your own account'
            });
        }
        
        user.isActive = isActive;
        
        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user: authHandlers.sanitizeUser(user)
        });
        
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Social authentication routes (placeholder)

/**
 * GET /api/auth/google
 * Initiate Google OAuth
 */
router.get('/google', (req, res) => {
    res.status(501).json({
        success: false,
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google sign-in requires OAuth credentials — use email login for v1-internal'
    });
});

/**
 * GET /api/auth/github
 * Initiate GitHub OAuth
 */
router.get('/github', (req, res) => {
    res.status(501).json({
        success: false,
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'GitHub sign-in requires OAuth credentials — use email login for v1-internal'
    });
});

/**
 * GET /api/auth/microsoft
 * Initiate Microsoft OAuth
 */
router.get('/microsoft', (req, res) => {
    res.status(501).json({
        success: false,
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Microsoft sign-in requires OAuth credentials — use email login for v1-internal'
    });
});

module.exports = router;
