/**
 * Refactored Authentication Manager - Uses dependency injection and strategy pattern
 * Reduces complexity and improves maintainability
 */

// Use conditional declaration to avoid redeclaration errors
if (typeof AuthManager === 'undefined') {
    class AuthManager {
        constructor(dependencies = {}) {
        // Dependency injection
            this.authContext = dependencies.authContext || new window.AuthenticationContext();
            this.storage = dependencies.storage || new AuthStorage();
            this.uiManager = dependencies.uiManager || new AuthUIManager();
            this.teamManager = dependencies.teamManager || new TeamManager();
            this.permissionManager = dependencies.permissionManager || new PermissionManager();
        
            // Configuration
            this.config = dependencies.config || {
                storageKey: 'ai_dashboard_auth',
                defaultStrategy: 'local',
                sessionTimeout: 3600000, // 1 hour
                enableAutoRefresh: true
            };

            // State
            this.currentUser = null;
            this.teamMembers = [];
            this.isAuthenticated = false;
            this.sessionTimer = null;
        
            // Event listeners
            this.eventListeners = new Map();
        
            this.init();
        }

        /**
     * Initialize authentication manager
     */
        init() {
            console.log('Initializing AuthManager...');
        
            try {
                this.loadStoredAuth();
                this.setupEventListeners();
                this.setupSessionManagement();
                this.updateUI();
            
                console.log('AuthManager initialized successfully');
            } catch (error) {
                this.handleError('AuthManager initialization failed', error);
            }
        }

        /**
     * Load stored authentication data
     */
        loadStoredAuth() {
            try {
                const stored = this.storage.getAuthData(this.config.storageKey);
                if (stored) {
                    this.setAuthState(stored.user, stored.teamMembers, stored.isAuthenticated);
                    console.log('Loaded stored authentication data');
                }
            } catch (error) {
                console.error('Error loading stored auth data:', error);
                this.clearAuth();
            }
        }

        /**
     * Setup event listeners
     */
        setupEventListeners() {
        // Listen to auth context events
            this.authContext.addEventListener('authSuccess', (event) => {
                this.handleAuthSuccess(event.detail);
            });

            this.authContext.addEventListener('authError', (event) => {
                this.handleAuthError(event.detail);
            });

            // Listen to storage events
            this.storage.addEventListener('storageChanged', (event) => {
                this.handleStorageChanged(event.detail);
            });

            // Listen to UI events
            this.uiManager.addEventListener('loginRequested', (event) => {
                this.handleLoginRequest(event.detail);
            });

            this.uiManager.addEventListener('logoutRequested', (event) => {
                this.handleLogoutRequest();
            });

            this.uiManager.addEventListener('registerRequested', (event) => {
                this.handleRegisterRequest(event.detail);
            });
        }

        /**
     * Setup session management
     */
        setupSessionManagement() {
            if (this.config.enableAutoRefresh) {
                this.startSessionTimer();
            }
        }

        /**
     * Start session timeout timer
     */
        startSessionTimer() {
            this.clearSessionTimer();
        
            this.sessionTimer = setTimeout(() => {
                console.log('Session expired, logging out...');
                this.logout();
            }, this.config.sessionTimeout);
        }

        /**
     * Clear session timer
     */
        clearSessionTimer() {
            if (this.sessionTimer) {
                clearTimeout(this.sessionTimer);
                this.sessionTimer = null;
            }
        }

        /**
     * Update UI based on authentication state
     */
        updateUI() {
            if (this.isAuthenticated) {
                this.uiManager.showAuthenticatedState(this.currentUser, this.teamMembers);
            } else {
                this.uiManager.showUnauthenticatedState();
            }
        }

        /**
     * Set authentication state
     */
        setAuthState(user, teamMembers = [], isAuthenticated = false) {
            this.currentUser = user;
            this.teamMembers = teamMembers;
            this.isAuthenticated = isAuthenticated;
        
            // Save to storage
            this.saveAuth();
        
            // Update UI
            this.updateUI();
        
            // Trigger events
            this.triggerEvent('authStateChanged', {
                user,
                teamMembers,
                isAuthenticated
            });
        }

        /**
     * Save authentication data
     */
        saveAuth() {
            const authData = {
                user: this.currentUser,
                teamMembers: this.teamMembers,
                isAuthenticated: this.isAuthenticated,
                lastUpdated: new Date().toISOString()
            };
        
            this.storage.saveAuthData(this.config.storageKey, authData);
        }

        /**
     * Clear authentication data
     */
        clearAuth() {
            this.currentUser = null;
            this.teamMembers = [];
            this.isAuthenticated = false;
            this.clearSessionTimer();
        
            // Remove from storage
            this.storage.removeAuthData(this.config.storageKey);
        
            // Update UI
            this.updateUI();
        }

        /**
     * Register new user
     */
        async register(userData) {
            try {
                this.validateRegistrationData(userData);
            
                // Use authentication context with local strategy
                const result = await this.authContext.authenticate('local', userData);
            
                if (result.success) {
                    this.setAuthState(result.user);
                    this.triggerEvent('registrationSuccess', { user: result.user });
                    return { success: true, user: result.user };
                }
            
                return result;
            
            } catch (error) {
                this.handleError('Registration failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Authenticate user
     */
        async authenticate(strategyName, credentials) {
            try {
                console.log(`Authenticating with strategy: ${strategyName}`);
            
                const result = await this.authContext.authenticate(strategyName, credentials);
            
                if (result.success) {
                    this.setAuthState(result.user);
                    this.startSessionTimer();
                    this.triggerEvent('authenticationSuccess', { 
                        user: result.user,
                        strategy: result.strategy 
                    });
                    return result;
                }
            
                return result;
            
            } catch (error) {
                this.handleError('Authentication failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Login with email and password
     */
        async login(email, password) {
            return this.authenticate('local', { email, password });
        }

        /**
     * Auto-authenticate (detect strategy)
     */
        async autoAuthenticate(credentials) {
            try {
                const result = await this.authContext.autoAuthenticate(credentials);
            
                if (result.success) {
                    this.setAuthState(result.user);
                    this.startSessionTimer();
                    this.triggerEvent('autoAuthenticationSuccess', { 
                        user: result.user,
                        strategy: result.strategy 
                    });
                    return result;
                }
            
                return result;
            
            } catch (error) {
                this.handleError('Auto-authentication failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Logout user
     */
        async logout() {
            try {
                const user = this.currentUser;
            
                // Clear auth state
                this.clearAuth();
            
                // Trigger events
                this.triggerEvent('logoutSuccess', { user });
            
                console.log('User logged out successfully');
                return { success: true };
            
            } catch (error) {
                this.handleError('Logout failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Get current user
     */
        getCurrentUser() {
            return this.currentUser;
        }

        /**
     * Get team members
     */
        getTeamMembers() {
            return this.teamMembers;
        }

        /**
     * Check if user is authenticated
     */
        isLoggedIn() {
            return this.isAuthenticated;
        }

        /**
     * Check user permissions
     */
        hasPermission(permission) {
            if (!this.isAuthenticated || !this.currentUser) {
                return false;
            }
        
            return this.permissionManager.hasPermission(this.currentUser, permission);
        }

        /**
     * Check user role
     */
        hasRole(role) {
            if (!this.isAuthenticated || !this.currentUser) {
                return false;
            }
        
            return this.currentUser.role === role;
        }

        /**
     * Refresh authentication
     */
        async refreshAuth() {
            if (!this.isAuthenticated) {
                return { success: false, error: 'Not authenticated' };
            }

            try {
            // This would refresh tokens or re-validate session
            // For now, just extend session
                this.startSessionTimer();
            
                this.triggerEvent('authRefreshed', { user: this.currentUser });
                return { success: true };
            
            } catch (error) {
                this.handleError('Auth refresh failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Update user profile
     */
        async updateProfile(updates) {
            if (!this.isAuthenticated) {
                return { success: false, error: 'Not authenticated' };
            }

            try {
                this.validateProfileUpdates(updates);
            
                // Update user object
                this.currentUser = { ...this.currentUser, ...updates };
            
                // Save changes
                this.saveAuth();
            
                // Update UI
                this.updateUI();
            
                this.triggerEvent('profileUpdated', { user: this.currentUser });
                return { success: true, user: this.currentUser };
            
            } catch (error) {
                this.handleError('Profile update failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Event handlers
     */
        handleAuthSuccess(detail) {
            console.log('Authentication successful:', detail);
        }

        handleAuthError(detail) {
            console.error('Authentication error:', detail);
            const errorMessage = detail && detail.error ? detail.error : 
                detail && detail.message ? detail.message :
                    'Authentication failed';
            this.uiManager.showError(errorMessage);
        }

        handleStorageChanged(detail) {
            console.log('Storage changed:', detail);
            // Handle storage changes from other tabs
            if (detail.key === this.config.storageKey) {
                this.loadStoredAuth();
            }
        }

        handleLoginRequest(detail) {
            this.login(detail.email, detail.password);
        }

        handleLogoutRequest() {
            this.logout();
        }

        handleRegisterRequest(detail) {
            this.register(detail);
        }

        /**
     * Validation methods
     */
        validateRegistrationData(userData) {
            if (!userData || typeof userData !== 'object') {
                throw new Error('User data is required');
            }

            if (!userData.email || typeof userData.email !== 'string') {
                throw new Error('Email is required');
            }

            if (!userData.name || typeof userData.name !== 'string') {
                throw new Error('Name is required');
            }

            if (!userData.password || typeof userData.password !== 'string') {
                throw new Error('Password is required');
            }

            if (userData.password.length < 8) {
                throw new Error('Password must be at least 8 characters');
            }
        }

        validateProfileUpdates(updates) {
            if (!updates || typeof updates !== 'object') {
                throw new Error('Updates must be an object');
            }

            // Validate allowed fields
            const allowedFields = ['name', 'email', 'avatar', 'preferences'];
            const updateKeys = Object.keys(updates);
        
            for (const key of updateKeys) {
                if (!allowedFields.includes(key)) {
                    throw new Error(`Field '${key}' cannot be updated`);
                }
            }
        }

        /**
     * Event management
     */
        addEventListener(eventName, handler) {
            if (!this.eventListeners.has(eventName)) {
                this.eventListeners.set(eventName, []);
            }
            this.eventListeners.get(eventName).push(handler);
        }

        removeEventListener(eventName, handler) {
            if (this.eventListeners.has(eventName)) {
                const handlers = this.eventListeners.get(eventName);
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                }
            }
        }

        triggerEvent(eventName, detail) {
            if (this.eventListeners.has(eventName)) {
                const handlers = this.eventListeners.get(eventName);
                handlers.forEach(handler => {
                    try {
                        handler(detail);
                    } catch (error) {
                        console.error(`Error in event handler for '${eventName}':`, error);
                    }
                });
            }
        }

        /**
     * Error handling
     */
        handleError(message, error) {
            console.error(message, error);
            this.uiManager.showError(`${message}: ${error.message}`);
            this.triggerEvent('error', { message, error });
        }

        /**
     * Get configuration
     */
        getConfig() {
            return { ...this.config };
        }

        /**
     * Update configuration
     */
        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
        }

        /**
     * Get dependencies
     */
        getDependencies() {
            return {
                authContext: this.authContext,
                storage: this.storage,
                uiManager: this.uiManager,
                teamManager: this.teamManager,
                permissionManager: this.permissionManager
            };
        }

        /**
     * Destroy and clean up
     */
        destroy() {
            this.clearSessionTimer();
            this.clearAuth();
            this.eventListeners.clear();
        
            console.log('AuthManager destroyed');
        }
    }

    // Supporting classes (simplified implementations)
    class AuthStorage {
        constructor() {
            this.listeners = new Map();
        }

        getAuthData(key) {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : null;
        }

        saveAuthData(key, data) {
            localStorage.setItem(key, JSON.stringify(data));
            this.notifyListeners('storageChanged', { key, data });
        }

        removeAuthData(key) {
            localStorage.removeItem(key);
            this.notifyListeners('storageChanged', { key, removed: true });
        }

        addEventListener(eventName, handler) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(handler);
        }

        notifyListeners(eventName, detail) {
            if (this.listeners.has(eventName)) {
                this.listeners.get(eventName).forEach(handler => {
                    try {
                        handler(detail);
                    } catch (error) {
                        console.error('Storage event error:', error);
                    }
                });
            }
        }
    }

    class AuthUIManager {
        constructor() {
            this.listeners = new Map();
        }

        showAuthenticatedState(user, teamMembers) {
        // Update UI to show authenticated state
            this.updateUserHeader(user);
            this.hideLoginForms();
            this.showAuthenticatedFeatures();
        }

        showUnauthenticatedState() {
        // Update UI to show unauthenticated state
            this.hideUserHeader();
            this.showLoginForms();
            this.hideAuthenticatedFeatures();
        }

        updateUserHeader(user) {
            const userHeader = document.getElementById('user-header');
            if (userHeader && user) {
                userHeader.textContent = `
                <div class="user-info">
                    <div class="user-avatar">${this.getUserInitials(user.name)}</div>
                    <div class="user-details">
                        <div class="user-name">${user.name}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                <button class="btn-logout" onclick="authManager.logout()">Logout</button>
            ` /* Replaced innerHTML with textContent for safety */
                userHeader.style.display = 'flex';
            }
        }

        hideUserHeader() {
            const userHeader = document.getElementById('user-header');
            if (userHeader) {
                userHeader.style.display = 'none';
            }
        }

        getUserInitials(name) {
            return name.split(' ')
                .map(word => word[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }

        hideLoginForms() {
            const loginPrompt = document.getElementById('login-prompt');
            if (loginPrompt) {
                loginPrompt.style.display = 'none';
            }
        }

        showLoginForms() {
            const loginPrompt = document.getElementById('login-prompt');
            if (loginPrompt) {
                loginPrompt.style.display = 'block';
            }
        }

        showAuthenticatedFeatures() {
        // Enable authenticated features
            const premiumTabs = document.querySelectorAll('[data-tab="ai-analysis"], [data-tab="predictions"], [data-tab="exports"]');
            premiumTabs.forEach(tab => {
                tab.disabled = false;
                tab.style.opacity = '1';
            });
        }

        hideAuthenticatedFeatures() {
        // Disable premium features
            const premiumTabs = document.querySelectorAll('[data-tab="ai-analysis"], [data-tab="predictions"], [data-tab="exports"]');
            premiumTabs.forEach(tab => {
                tab.disabled = true;
                tab.style.opacity = '0.5';
            });
        }

        showError(message) {
            console.error(message);
            // Show error in UI
            const errorElement = document.createElement('div');
            errorElement.className = 'auth-error';
            errorElement.textContent = message;
            errorElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
        `;
            document.body.appendChild(errorElement);
        
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 5000);
        }

        addEventListener(eventName, handler) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(handler);
        }
    }

    class TeamManager {
        constructor() {
            this.teams = new Map();
        }

        getTeam(teamId) {
            return this.teams.get(teamId);
        }

        addTeam(team) {
            this.teams.set(team.id, team);
        }
    }

    class PermissionManager {
        hasPermission(user, permission) {
        // Simple permission check
            if (!user || !user.role) {
                return false;
            }

            const permissions = {
                'admin': ['read', 'write', 'delete', 'manage_users', 'manage_teams'],
                'developer': ['read', 'write'],
                'viewer': ['read']
            };

            return permissions[user.role]?.includes(permission) || false;
        }
    }

    // Factory function for creating AuthManager with default dependencies
    function createAuthManager(options = {}) {
        const dependencies = {
            authContext: options.authContext || new window.AuthenticationContext(),
            storage: options.storage || new AuthStorage(),
            uiManager: options.uiManager || new AuthUIManager(),
            teamManager: options.teamManager || new TeamManager(),
            permissionManager: options.permissionManager || new PermissionManager(),
            config: options.config
        };

        return new AuthManager(dependencies);
    }
} // Close conditional declaration

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, createAuthManager };
}

// Global assignment for browser compatibility
window.AuthManager = window.AuthManager || AuthManager;
window.createAuthManager = window.createAuthManager || createAuthManager;
