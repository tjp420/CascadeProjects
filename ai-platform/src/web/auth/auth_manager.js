/**
 * Authentication Manager for AI Coding Dashboard
 * Handles user authentication, team management, and access control
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.teamMembers = [];
        this.isAuthenticated = false;
        this.storageKey = 'ai_dashboard_auth';
        this.init();
    }

    init() {
        this.loadStoredAuth();
        this.setupEventListeners();
        this.updateUI();
    }

    // Load authentication data from localStorage
    loadStoredAuth() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                const authData = JSON.parse(stored);
                this.currentUser = authData.user;
                this.teamMembers = authData.teamMembers || [];
                this.isAuthenticated = authData.isAuthenticated || false;
            } catch (error) {
                console.error('Error loading auth data:', error);
                this.clearAuth();
            }
        }
    }

    // Save authentication data to localStorage
    saveAuth() {
        const authData = {
            user: this.currentUser,
            teamMembers: this.teamMembers,
            isAuthenticated: this.isAuthenticated
        };
        localStorage.setItem(this.storageKey, JSON.stringify(authData));
    }

    // User registration
    async register(userData) {
        try {
            // In production, this would call your backend API
            const response = await this.mockAPICall('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });

            if (response.success) {
                this.currentUser = {
                    id: response.user.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role || 'developer',
                    teamId: response.user.teamId,
                    createdAt: new Date().toISOString()
                };
                this.isAuthenticated = true;
                this.saveAuth();
                this.updateUI();
                return { success: true, user: this.currentUser };
            }
            return response;
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    // User login
    async login(email, password) {
        try {
            console.log('Attempting login with:', email);
            
            // In production, this would call your backend API
            const response = await this.mockAPICall('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            console.log('Login API response:', response);

            if (response.success) {
                this.currentUser = response.user;
                this.teamMembers = response.teamMembers || [];
                this.isAuthenticated = true;
                this.saveAuth();
                this.updateUI();
                
                console.log('Authentication state saved:', this.getAuthState());
                return { success: true, user: this.currentUser };
            }
            return response;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    // User logout
    logout() {
        this.currentUser = null;
        this.teamMembers = [];
        this.isAuthenticated = false;
        this.clearAuth();
        this.updateUI();
        window.location.hash = '#login';
    }

    // Clear authentication data
    clearAuth() {
        localStorage.removeItem(this.storageKey);
    }

    // Check if user has specific role
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    // Check if user has specific permission
    hasPermission(permission) {
        if (!this.currentUser) {
            return false;
        }
        
        const rolePermissions = {
            'admin': ['read', 'write', 'delete', 'manage_team', 'manage_billing'],
            'manager': ['read', 'write', 'manage_team'],
            'developer': ['read', 'write'],
            'viewer': ['read']
        };

        return rolePermissions[this.currentUser.role]?.includes(permission) || false;
    }

    // Add team member
    async addTeamMember(memberData) {
        if (!this.hasPermission('manage_team')) {
            return { success: false, error: 'Insufficient permissions' };
        }

        try {
            const response = await this.mockAPICall('/api/team/add', {
                method: 'POST',
                body: JSON.stringify(memberData)
            });

            if (response.success) {
                this.teamMembers.push(response.member);
                this.saveAuth();
                return { success: true, member: response.member };
            }
            return response;
        } catch (error) {
            console.error('Add team member error:', error);
            return { success: false, error: error.message };
        }
    }

    // Remove team member
    async removeTeamMember(memberId) {
        if (!this.hasPermission('manage_team')) {
            return { success: false, error: 'Insufficient permissions' };
        }

        try {
            const response = await this.mockAPICall('/api/team/remove', {
                method: 'DELETE',
                body: JSON.stringify({ memberId })
            });

            if (response.success) {
                this.teamMembers = this.teamMembers.filter(m => m.id !== memberId);
                this.saveAuth();
                return { success: true };
            }
            return response;
        } catch (error) {
            console.error('Remove team member error:', error);
            return { success: false, error: error.message };
        }
    }

    // Update user profile
    async updateProfile(profileData) {
        try {
            const response = await this.mockAPICall('/api/user/update', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });

            if (response.success) {
                this.currentUser = { ...this.currentUser, ...response.user };
                this.saveAuth();
                this.updateUI();
                return { success: true, user: this.currentUser };
            }
            return response;
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const rememberMe = document.getElementById('rememberMe').checked;
                
                try {
                    const result = await this.login(email, password);
                    if (result.success) {
                        // Close modal if Bootstrap is available
                        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                        if (modal) {
                            modal.hide();
                        }
                        // Show welcome notification
                        this.showNotification(`Welcome back, ${result.user.name}!`, 'success');
                    } else {
                        this.showNotification(result.error, 'error');
                    }
                } catch (error) {
                    this.showNotification('Login failed. Please try again.', 'error');
                }
            });
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(registerForm);
                const userData = Object.fromEntries(formData);
                this.register(userData);
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    // Update UI based on authentication state
    updateUI() {
        const loginElements = document.querySelectorAll('.auth-required');
        const authElements = document.querySelectorAll('.no-auth-required');
        const userElements = document.querySelectorAll('.user-info');

        if (this.isAuthenticated) {
            loginElements.forEach(el => el.style.display = 'none');
            authElements.forEach(el => el.style.display = 'block');
            
            userElements.forEach(el => {
                el.textContent = this.currentUser.name || this.currentUser.email;
            });
        } else {
            loginElements.forEach(el => el.style.display = 'block');
            authElements.forEach(el => el.style.display = 'none');
        }
    }

    // Mock API call (replace with real API calls in production)
    async mockAPICall(endpoint, options) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock responses based on endpoint
        if (endpoint.includes('login')) {
            const body = JSON.parse(options.body);
            
            // Demo credentials for testing
            const demoCredentials = [
                { email: 'admin@demo.com', password: 'admin123', name: 'Admin User', role: 'admin' },
                { email: 'analyst@demo.com', password: 'analyst123', name: 'M&A Analyst', role: 'manager' },
                { email: 'developer@demo.com', password: 'dev123', name: 'Developer', role: 'developer' },
                { email: 'viewer@demo.com', password: 'view123', name: 'Viewer', role: 'viewer' },
                { email: 'test@example.com', password: 'password123', name: 'Test User', role: 'developer' }
            ];
            
            // Check credentials against demo list
            const credential = demoCredentials.find(cred => 
                cred.email === body.email && cred.password === body.password
            );
            
            if (credential) {
                return {
                    success: true,
                    user: {
                        id: credential.email.split('@')[0],
                        email: credential.email,
                        name: credential.name,
                        role: credential.role,
                        teamId: 'team-demo'
                    },
                    teamMembers: [
                        { id: 'member1', name: 'Team Member 1', email: 'member1@demo.com', role: 'developer' },
                        { id: 'member2', name: 'Team Member 2', email: 'member2@demo.com', role: 'analyst' }
                    ]
                };
            }
            
            return { success: false, error: 'Invalid credentials. Use demo credentials: admin@demo.com/admin123, analyst@demo.com/analyst123, etc.' };
        }

        if (endpoint.includes('register')) {
            return {
                success: true,
                user: {
                    id: Date.now().toString(),
                    email: JSON.parse(options.body).email,
                    name: JSON.parse(options.body).name,
                    role: 'developer',
                    teamId: 'team-' + Date.now()
                }
            };
        }

        return { success: false, error: 'Unknown endpoint' };
    }

    // Show notification to user
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.textContent = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Get current authentication state
    getAuthState() {
        return {
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser,
            teamMembers: this.teamMembers
        };
    }
}

// Initialize auth manager
window.authManager = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
