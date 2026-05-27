/**
 * Enhanced Authentication Handlers
 * Comprehensive server-side authentication with validation, security, and JWT management
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

class EnhancedAuthHandlers {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'cascade-ai-platform-secret-key-2026';
        this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'cascade-refresh-secret-2026';
        this.jwtExpiry = process.env.JWT_EXPIRY || '15m';
        this.refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
        this.bcryptRounds = 12;
        
        // Demo users (in production, use database)
        this.demoUsers = [
            {
                id: 1,
                email: 'dev@cascade.ai',
                password: bcrypt.hashSync('demo123', this.bcryptRounds),
                name: 'Demo User',
                trustLevel: 'Developer',
                role: 'admin',
                isActive: true,
                emailVerified: true,
                createdAt: new Date('2026-01-01'),
                lastLogin: null
            }
        ];
        
        // Reset tokens storage (in production, use database)
        this.resetTokens = new Map();
        
        // Email transporter configuration
        this.setupEmailTransporter();
    }
    
    setupEmailTransporter() {
        // In production, configure with real SMTP settings
        this.emailTransporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || 'demo@cascade.ai',
                pass: process.env.SMTP_PASS || 'demo-password'
            }
        });
    }
    
    async handleLogin(req, res) {
        try {
            const { email, password, rememberMe } = req.body;
            
            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }
            
            // Find user
            const user = this.findUserByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
            
            // Check if user is active
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Account is deactivated. Please contact support.'
                });
            }
            
            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
            
            // Update last login
            user.lastLogin = new Date();
            
            // Generate tokens
            const token = this.generateToken(user);
            const refreshToken = this.generateRefreshToken(user);
            
            // Set secure cookies
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 7 days vs 1 day
            };
            
            res.cookie('authToken', token, cookieOptions);
            res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
            
            // Return user data without password
            const userResponse = this.sanitizeUser(user);
            
            res.json({
                success: true,
                message: 'Signed in successfully',
                token,
                refreshToken,
                user: userResponse,
                expiresIn: this.parseExpiry(this.jwtExpiry)
            });
            
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    
    async handleSignUp(req, res) {
        try {
            const { name, email, password } = req.body;
            
            // Validation
            if (!name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }
            
            if (name.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Name must be at least 2 characters'
                });
            }
            
            if (!this.isValidEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email address'
                });
            }
            
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters'
                });
            }
            
            // Check if user already exists
            const existingUser = this.findUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'An account with this email already exists'
                });
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
            
            // Create new user
            const newUser = {
                id: Date.now(),
                email,
                password: hashedPassword,
                name,
                trustLevel: 'User',
                role: 'user',
                isActive: true,
                emailVerified: false,
                emailVerificationToken: crypto.randomBytes(32).toString('hex'),
                createdAt: new Date(),
                lastLogin: null
            };
            
            // Add to users (in production, save to database)
            this.demoUsers.push(newUser);
            
            // Send verification email
            await this.sendVerificationEmail(newUser);
            
            // Return success (don't auto-login for security)
            res.status(201).json({
                success: true,
                message: 'Account created successfully. Please check your email to verify your account.',
                user: this.sanitizeUser(newUser)
            });
            
        } catch (error) {
            console.error('Sign up error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    
    async handlePasswordReset(req, res) {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required'
                });
            }
            
            if (!this.isValidEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email address'
                });
            }
            
            const user = this.findUserByEmail(email);
            
            // Always return success to prevent email enumeration attacks
            if (!user) {
                return res.json({
                    success: true,
                    message: 'If an account with this email exists, password reset instructions have been sent.'
                });
            }
            
            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            
            // Store reset token
            this.resetTokens.set(resetToken, {
                userId: user.id,
                email: user.email,
                expires: resetExpiry
            });
            
            // Send reset email
            await this.sendPasswordResetEmail(user, resetToken);
            
            res.json({
                success: true,
                message: 'Password reset instructions have been sent to your email.'
            });
            
        } catch (error) {
            console.error('Password reset error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    
    async handlePasswordResetConfirm(req, res) {
        try {
            const { token, newPassword } = req.body;
            
            if (!token || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Token and new password are required'
                });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters'
                });
            }
            
            // Find reset token
            const resetData = this.resetTokens.get(token);
            if (!resetData || resetData.expires < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired reset token'
                });
            }
            
            // Find user
            const user = this.findUserById(resetData.userId);
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
            
            // Update user password
            user.password = hashedPassword;
            
            // Remove reset token
            this.resetTokens.delete(token);
            
            res.json({
                success: true,
                message: 'Password reset successfully. You can now sign in with your new password.'
            });
            
        } catch (error) {
            console.error('Password reset confirm error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    
    async handleRefreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }
            
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
            
            // Find user
            const user = this.findUserById(decoded.userId);
            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid refresh token'
                });
            }
            
            // Generate new access token
            const newToken = this.generateToken(user);
            
            res.json({
                success: true,
                token: newToken,
                expiresIn: this.parseExpiry(this.jwtExpiry)
            });
            
        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }
    }
    
    async handleLogout(req, res) {
        try {
            // Clear cookies
            res.clearCookie('authToken');
            res.clearCookie('refreshToken');
            
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
            
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    
    async handleMe(req, res) {
        try {
            const user = req.user; // Set by authentication middleware
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }
            
            res.json({
                success: true,
                user: this.sanitizeUser(user)
            });
            
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    
    // Helper methods
    generateToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                trustLevel: user.trustLevel
            },
            this.jwtSecret,
            { expiresIn: this.jwtExpiry }
        );
    }
    
    generateRefreshToken(user) {
        return jwt.sign(
            { userId: user.id },
            this.jwtRefreshSecret,
            { expiresIn: this.refreshExpiry }
        );
    }
    
    parseExpiry(expiry) {
        // Convert "15m", "7d", etc. to seconds
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1));
        
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return value;
        }
    }
    
    findUserByEmail(email) {
        return this.demoUsers.find(user => user.email === email);
    }
    
    findUserById(id) {
        return this.demoUsers.find(user => user.id === id);
    }
    
    sanitizeUser(user) {
        const { _password, _emailVerificationToken, ...sanitized } = user;
        return sanitized;
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    async sendVerificationEmail(user) {
        try {
            const verificationUrl = `${process.env.BASE_URL || 'http://localhost:8000'}/verify-email?token=${user.emailVerificationToken}`;
            
            await this.emailTransporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@cascade.ai',
                to: user.email,
                subject: 'Verify your Cascade AI Platform account',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1e3c72;">Welcome to Cascade AI Platform!</h2>
                        <p>Hi ${user.name},</p>
                        <p>Thank you for creating an account with Cascade AI Platform. Please click the button below to verify your email address:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Verify Email</a>
                        </div>
                        <p>If you didn't create this account, you can safely ignore this email.</p>
                        <p>Best regards,<br>The Cascade AI Platform Team</p>
                    </div>
                `
            });
        } catch (error) {
            console.error('Failed to send verification email:', error);
        }
    }
    
    async sendPasswordResetEmail(user, resetToken) {
        try {
            const resetUrl = `${process.env.BASE_URL || 'http://localhost:8000'}/reset-password?token=${resetToken}`;
            
            await this.emailTransporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@cascade.ai',
                to: user.email,
                subject: 'Reset your Cascade AI Platform password',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1e3c72;">Password Reset Request</h2>
                        <p>Hi ${user.name},</p>
                        <p>We received a request to reset your password for your Cascade AI Platform account. Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a>
                        </div>
                        <p>This link will expire in 1 hour for security reasons.</p>
                        <p>If you didn't request this password reset, you can safely ignore this email.</p>
                        <p>Best regards,<br>The Cascade AI Platform Team</p>
                    </div>
                `
            });
        } catch (error) {
            console.error('Failed to send password reset email:', error);
        }
    }
}

// Middleware for authentication
const authenticate = (req, res, next) => {
    try {
        const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cascade-ai-platform-secret-key-2026');
        
        // Find user (in production, query database)
        const authHandlers = new EnhancedAuthHandlers();
        const user = authHandlers.findUserById(decoded.userId);
        
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
        }
        
        req.user = user;
        next();
        
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token'
        });
    }
};

// Optional: Role-based authorization middleware
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }
        
        next();
    };
};

module.exports = {
    EnhancedAuthHandlers,
    authenticate,
    authorize
};
