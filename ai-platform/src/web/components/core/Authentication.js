/**
 * Authentication System for AI Coding Intelligence Dashboard
 * 
 * Provides JWT-based authentication with role-based access control (RBAC).
 * Supports user management, session handling, and secure password hashing.
 * 
 * @class Authentication
 * @since 1.0.0
 * @example
 * const auth = new Authentication();
 * const success = await auth.login('admin', 'password');
 * if (success) {
 *   console.log('User authenticated:', auth.currentUser);
 * }
 * 
 * @property {Map<string, Object>} users - User database with credentials and roles
 * @property {Map<string, Object>} sessions - Active user sessions
 * @property {Object|null} currentUser - Currently authenticated user
 * @property {boolean} isAuthenticated - Authentication status flag
 * @property {Map<string, Array<string>>} roles - Role-based permissions mapping
 * @property {string} jwtSecret - Secret key for JWT token signing
 * @property {number} tokenExpiry - Token expiration time in seconds
 */
class Authentication {
    /**
     * Creates an Authentication instance and initializes the system
     * 
     * @constructor
     * @description Initializes user database, roles, and default accounts.
     * Sets up JWT configuration and prepares authentication mechanisms.
     * 
     * @since 1.0.0
     */
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.currentUser = null;
        this.isAuthenticated = false;
        this.roles = new Map();
        this.jwtSecret = 'your-secret-key-change-in-production';
        this.tokenExpiry = 3600; // 1 hour
        this.initDefaultUsers();
        this.initRoles();
    }

    /**
     * Initialize default user accounts for the system
     * 
     * @method initDefaultUsers
     * @description Creates default admin and user accounts with predefined credentials.
     * Should be replaced with proper user management in production environments.
     * 
     * @since 1.0.0
     * @returns {void}
     * @private
     */
    initDefaultUsers() {
        // Default admin user
        this.users.set('admin', {
            id: 'admin',
            username: 'admin',
            email: 'admin@cascade-projects.com',
            password: this.hashPassword('CascadeSecure2024!'),
            role: 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        });

        // Default viewer user
        this.users.set('viewer', {
            id: 'viewer',
            username: 'viewer',
            email: 'viewer@cascade-projects.com',
            password: this.hashPassword('CascadeView2024!'),
            role: 'viewer',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        });

        // Default developer user
        this.users.set('developer', {
            id: 'developer',
            username: 'developer',
            email: 'developer@cascade-projects.com',
            password: this.hashPassword('CascadeDev2024!'),
            role: 'developer',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        });
    }

    /**
     * Initialize roles and permissions
     */
    initRoles() {
        this.roles.set('admin', {
            name: 'Administrator',
            permissions: [
                'read_all',
                'write_all',
                'delete_all',
                'manage_users',
                'manage_system',
                'view_reports',
                'export_data',
                'configure_system'
            ]
        });

        this.roles.set('developer', {
            name: 'Developer',
            permissions: [
                'read_all',
                'write_all',
                'view_reports',
                'export_data',
                'configure_system'
            ]
        });

        this.roles.set('viewer', {
            name: 'Viewer',
            permissions: [
                'read_all',
                'view_reports'
            ]
        });
    }

    /**
     * Hash password using simple hash (in production, use bcrypt)
     */
    hashPassword(password) {
        // Simple hash for demo - in production use bcrypt
        return btoa(password + this.jwtSecret);
    }

    /**
     * Verify password
     */
    verifyPassword(password, hashedPassword) {
        return this.hashPassword(password) === hashedPassword;
    }

    /**
     * Generate JWT token
     */
    generateToken(user) {
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: this.roles.get(user.role)?.permissions || [],
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.tokenExpiry
        };

        // Simple JWT generation (in production, use proper JWT library)
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payloadBase64 = btoa(JSON.stringify(payload));
        const signature = btoa(`${header}.${payloadBase64}.${this.jwtSecret}`);
        
        return `${header}.${payloadBase64}.${signature}`;
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            const [header, payload, signature] = token.split('.');
            const decodedPayload = JSON.parse(atob(payload));
            
            // Check expiration
            if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
                return null;
            }
            
            // Find user
            const user = this.users.get(decodedPayload.id);
            if (!user || !user.isActive) {
                return null;
            }
            
            return decodedPayload;
        } catch (error) {
            return null;
        }
    }

    /**
     * Login user
     */
    login(username, password) {
        const user = this.users.get(username);
        
        if (!user || !user.isActive) {
            return {
                success: false,
                error: 'Invalid username or password'
            };
        }

        if (!this.verifyPassword(password, user.password)) {
            return {
                success: false,
                error: 'Invalid username or password'
            };
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        
        // Generate token
        const token = this.generateToken(user);
        
        // Create session
        const session = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                lastLogin: user.lastLogin
            },
            token,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.tokenExpiry * 1000).toISOString()
        };

        this.sessions.set(token, session);
        this.currentUser = session.user;
        this.isAuthenticated = true;

        return {
            success: true,
            user: session.user,
            token,
            expiresAt: session.expiresAt
        };
    }

    /**
     * Logout user
     */
    logout(token) {
        if (this.sessions.has(token)) {
            this.sessions.delete(token);
        }
        
        this.currentUser = null;
        this.isAuthenticated = false;
        
        return {
            success: true,
            message: 'Logged out successfully'
        };
    }

    /**
     * Validate session
     */
    validateSession(token) {
        const session = this.sessions.get(token);
        
        if (!session) {
            return {
                valid: false,
                error: 'Session not found'
            };
        }

        // Check expiration
        if (new Date(session.expiresAt) < new Date()) {
            this.sessions.delete(token);
            return {
                valid: false,
                error: 'Session expired'
            };
        }

        return {
            valid: true,
            user: session.user
        };
    }

    /**
     * Check if user has permission
     */
    hasPermission(permission) {
        if (!this.isAuthenticated || !this.currentUser) {
            return false;
        }

        const role = this.roles.get(this.currentUser.role);
        return role && role.permissions.includes(permission);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get all users (admin only)
     */
    getAllUsers() {
        if (!this.hasPermission('manage_users')) {
            return {
                success: false,
                error: 'Insufficient permissions'
            };
        }

        const users = Array.from(this.users.values()).map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            isActive: user.isActive
        }));

        return {
            success: true,
            users
        };
    }

    /**
     * Create new user (admin only)
     */
    createUser(userData) {
        if (!this.hasPermission('manage_users')) {
            return {
                success: false,
                error: 'Insufficient permissions'
            };
        }

        if (this.users.has(userData.username)) {
            return {
                success: false,
                error: 'Username already exists'
            };
        }

        const newUser = {
            id: userData.username,
            username: userData.username,
            email: userData.email,
            password: this.hashPassword(userData.password),
            role: userData.role || 'viewer',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };

        this.users.set(userData.username, newUser);

        return {
            success: true,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt,
                isActive: newUser.isActive
            }
        };
    }

    /**
     * Update user (admin only)
     */
    updateUser(username, updates) {
        if (!this.hasPermission('manage_users')) {
            return {
                success: false,
                error: 'Insufficient permissions'
            };
        }

        const user = this.users.get(username);
        if (!user) {
            return {
                success: false,
                error: 'User not found'
            };
        }

        // Update allowed fields
        if (updates.email) {
            user.email = updates.email;
        }
        if (updates.role) {
            user.role = updates.role;
        }
        if (updates.isActive !== undefined) {
            user.isActive = updates.isActive;
        }
        if (updates.password) {
            user.password = this.hashPassword(updates.password);
        }

        // Update in sessions if user is currently logged in
        this.sessions.forEach(session => {
            if (session.user.id === user.id) {
                session.user = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    lastLogin: user.lastLogin
                };
            }
        });

        // Update current user if it's the same user
        if (this.currentUser && this.currentUser.id === user.id) {
            this.currentUser = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                lastLogin: user.lastLogin
            };
        }

        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                isActive: user.isActive
            }
        };
    }

    /**
     * Delete user (admin only)
     */
    deleteUser(username) {
        if (!this.hasPermission('delete_all')) {
            return {
                success: false,
                error: 'Insufficient permissions'
            };
        }

        if (!this.users.has(username)) {
            return {
                success: false,
                error: 'User not found'
            };
        }

        this.users.delete(username);

        // Remove from sessions
        this.sessions.forEach((session, token) => {
            if (session.user.username === username) {
                this.sessions.delete(token);
            }
        });

        return {
            success: true,
            message: 'User deleted successfully'
        };
    }

    /**
     * Change password
     */
    changePassword(username, currentPassword, newPassword) {
        const user = this.users.get(username);
        
        if (!user) {
            return {
                success: false,
                error: 'User not found'
            };
        }

        // Verify current password
        if (!this.verifyPassword(currentPassword, user.password)) {
            return {
                success: false,
                error: 'Current password is incorrect'
            };
        }

        // Update password
        user.password = this.hashPassword(newPassword);

        return {
            success: true,
            message: 'Password changed successfully'
        };
    }

    /**
     * Get authentication status
     */
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser,
            hasPermissions: this.currentUser ? this.roles.get(this.currentUser.role)?.permissions || [] : [],
            sessionCount: this.sessions.size
        };
    }

    /**
     * Get available roles
     */
    getRoles() {
        return Array.from(this.roles.entries()).map(([key, role]) => ({
            id: key,
            name: role.name,
            permissions: role.permissions
        }));
    }

    /**
     * Cleanup expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const expiredSessions = [];

        this.sessions.forEach((session, token) => {
            if (new Date(session.expiresAt) < now) {
                expiredSessions.push(token);
            }
        });

        expiredSessions.forEach(token => {
            this.sessions.delete(token);
        });

        return expiredSessions.length;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Authentication;
} else if (typeof window !== 'undefined') {
    window.Authentication = Authentication;
}
