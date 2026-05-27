/**
 * API Client for AI Coding Intelligence Dashboard
 * Handles all HTTP requests to the FastAPI backend
 */

class APIClient {
    constructor(baseURL = null) {
        // Use centralized configuration if available, otherwise fallback to default
        // Use window.location.origin for dynamic port support
        this.baseURL = baseURL || (window.AppConfig?.API?.BASE_URL) || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:54369');
        this.token = localStorage.getItem('access_token') || null;
        this.endpoints = window.AppConfig?.API?.ENDPOINTS || {};
        console.log('APIClient initialized with baseURL:', this.baseURL);
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('access_token', token);
        } else {
            localStorage.removeItem('access_token');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers,
            },
        };

        try {
            console.log(`Making API request to: ${url}`);
            const response = await fetch(url, config);
            
            if (!response.ok) {
                let errorDetails;
                try {
                    const error = await response.json();
                    errorDetails = error.detail || error.message || error.error || `HTTP ${response.status}`;
                } catch (parseError) {
                    errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                }
                const errorMessage = `${endpoint} failed: ${errorDetails}`;
                console.error('API Error:', errorMessage);
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log(`API Success: ${endpoint} - Status: ${response.status}`);
            return data;
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, {
                message: error.message,
                stack: error.stack,
                url: `${this.baseURL}${endpoint}`
            });
            throw error;
        }
    }

    
    async register(email, password, fullName) {
        const response = await this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
            }),
        });

        return response;
    }

    async getCurrentUser() {
        return await this.request('/api/auth/me');
    }

    async logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        this.token = null;
        return { message: 'Logged out successfully' };
    }

    // OAuth endpoints
    async getOAuthProviders() {
        return await this.request('/api/auth/oauth/providers');
    }

    async getOAuthAuthorizationUrl(provider) {
        return await this.request(`/api/auth/oauth/${provider}/authorize`);
    }

    async handleOAuthCallback(provider, code) {
        const response = await fetch(`${this.baseURL}/api/auth/oauth/${provider}/callback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'OAuth authentication failed');
        }

        const data = await response.json();
        this.setToken(data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        return data;
    }

    // Analysis endpoints
    async getCodeStructure() {
        return await this.request('/api/analysis/code-structure');
    }

    async getFileStructure() {
        return await this.request('/api/analysis/file-structure');
    }

    async getProjectOverview() {
        return await this.request('/api/project/overview');
    }

    async getCodeQuality() {
        return await this.request('/api/analysis/quality');
    }

    async getTechnicalDebt() {
        return await this.request('/api/analysis/technical-debt');
    }

    async getRecommendations() {
        return await this.request('/api/analysis/recommendations');
    }

    async getSecurity() {
        return await this.request('/api/analysis/technical-debt');
    }

    async getSecurityAnalysis() {
        return await this.request('/api/analysis/technical-debt');
    }

    async getPerformance() {
        return await this.request('/api/test-coverage');
    }

    async runAnalysis(projectId, analysisType) {
        return await this.request('/api/analysis/run', {
            method: 'POST',
            body: JSON.stringify({
                project_id: projectId,
                analysis_type: analysisType,
            }),
        });
    }

    async getAnalysisResult(analysisId) {
        return await this.request(`/api/analysis/results/${analysisId}`);
    }

    async getProjectAnalysisResults(projectId, analysisType = null) {
        let endpoint = `/api/analysis/project/${projectId}/results`;
        if (analysisType) {
            endpoint += `?analysis_type=${analysisType}`;
        }
        return await this.request(endpoint);
    }

    // Projects endpoints
    async createProject(projectData) {
        return await this.request('/api/projects', {
            method: 'POST',
            body: JSON.stringify(projectData),
        });
    }

    async listProjects(skip = 0, limit = 100) {
        return await this.request(`/api/projects?skip=${skip}&limit=${limit}`);
    }

    async getProject(projectId) {
        return await this.request(`/api/projects/${projectId}`);
    }

    async updateProject(projectId, projectData) {
        return await this.request(`/api/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(projectData),
        });
    }

    async deleteProject(projectId) {
        return await this.request(`/api/projects/${projectId}`, {
            method: 'DELETE',
        });
    }

    async getProjectAnalysisHistory(projectId) {
        return await this.request(`/api/projects/${projectId}/analysis-history`);
    }

    // Notifications endpoints
    async listNotifications(unreadOnly = false, skip = 0, limit = 50) {
        let endpoint = `/api/notifications?skip=${skip}&limit=${limit}`;
        if (unreadOnly) {
            endpoint += '&unread_only=true';
        }
        return await this.request(endpoint);
    }

    async getUnreadCount() {
        return await this.request('/api/notifications/unread-count');
    }

    async getNotification(notificationId) {
        return await this.request(`/api/notifications/${notificationId}`);
    }

    async updateNotification(notificationId, isRead) {
        return await this.request(`/api/notifications/${notificationId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_read: isRead }),
        });
    }

    async markAllAsRead() {
        return await this.request('/api/notifications/mark-all-read', {
            method: 'POST',
        });
    }

    async deleteNotification(notificationId) {
        return await this.request(`/api/notifications/${notificationId}`, {
            method: 'DELETE',
        });
    }

    async updateNotificationPreferences(preferences) {
        return await this.request('/api/notifications/preferences', {
            method: 'POST',
            body: JSON.stringify(preferences),
        });
    }

    async getNotificationPreferences() {
        return await this.request('/api/notifications/preferences');
    }

    // Authentication endpoints
    async login(username, password) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        
        if (response.access_token) {
            this.setToken(response.access_token);
        }
        
        return response;
    }

    async getCurrentUser() {
        return await this.request('/api/auth/me');
    }

    async logout() {
        this.setToken(null);
        return { success: true };
    }

    // Health check
    async healthCheck() {
        return await this.request('/api/health');
    }

    // Issues endpoints
    async createIssue(issueData) {
        return await this.request('/api/issues', {
            method: 'POST',
            body: JSON.stringify(issueData),
        });
    }

    async listIssues(projectId = null, status = null, severity = null, issueType = null, skip = 0, limit = 100) {
        let endpoint = `/api/issues?skip=${skip}&limit=${limit}`;
        if (projectId) {
            endpoint += `&project_id=${projectId}`;
        }
        if (status) {
            endpoint += `&status=${status}`;
        }
        if (severity) {
            endpoint += `&severity=${severity}`;
        }
        if (issueType) {
            endpoint += `&issue_type=${issueType}`;
        }
        return await this.request(endpoint);
    }

    async getIssue(issueId) {
        return await this.request(`/api/issues/${issueId}`);
    }

    async updateIssue(issueId, issueData) {
        return await this.request(`/api/issues/${issueId}`, {
            method: 'PUT',
            body: JSON.stringify(issueData),
        });
    }

    async deleteIssue(issueId) {
        return await this.request(`/api/issues/${issueId}`, {
            method: 'DELETE',
        });
    }

    async resolveIssue(issueId, resolutionType = 'fixed', resolutionNotes = null) {
        return await this.request(`/api/issues/${issueId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({
                resolution_type: resolutionType,
                resolution_notes: resolutionNotes,
            }),
        });
    }

    async closeIssue(issueId) {
        return await this.request(`/api/issues/${issueId}/close`, {
            method: 'POST',
        });
    }

    async reopenIssue(issueId, reason = null) {
        return await this.request(`/api/issues/${issueId}/reopen`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }
}

// Create global API client instance
const apiClient = new APIClient();
