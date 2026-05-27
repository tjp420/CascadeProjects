/**
 * GitHub API Client - Pure API operations with no UI dependencies
 * Extracted from GitHubIntegration for single responsibility principle
 */

class GitHubAPIClient {
    constructor(config = {}) {
        this.apiBase = config.apiBase || 'https://api.github.com';
        this.accessToken = config.accessToken || null;
        this.timeout = config.timeout || 30000;
        this.retryAttempts = config.retryAttempts || 3;
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 300000; // 5 minutes
    }

    /**
     * Set access token
     */
    setAccessToken(token) {
        this.accessToken = token;
    }

    /**
     * Get access token
     */
    getAccessToken() {
        return this.accessToken;
    }

    /**
     * Make authenticated API request
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const cacheKey = `${endpoint}:${JSON.stringify(options)}`;

        // Check cache first
        if (options.cache !== false) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AI-Coding-Dashboard'
                },
                ...options
            });

            if (!response.ok) {
                throw new APIError(response.status, response.statusText, await response.text());
            }

            const data = await response.json();

            // Cache successful responses
            if (options.cache !== false) {
                this.setCache(cacheKey, data);
            }

            return data;
        } catch (error) {
            console.error(`GitHub API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry(url, options, attempt = 1) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            if (attempt < this.retryAttempts && this.shouldRetry(error)) {
                console.warn(`Retry attempt ${attempt + 1} for ${url}`);
                await this.delay(1000 * attempt); // Exponential backoff
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Check if error should trigger retry
     */
    shouldRetry(error) {
        return (
            error.name === 'AbortError' ||
            (error.name === 'TypeError' && error.message.includes('fetch')) ||
            (error instanceof APIError && error.status >= 500)
        );
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cache management
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Validate access token
     */
    async validateToken(token = this.accessToken) {
        if (!token) {
            throw new Error('No access token provided');
        }

        try {
            const user = await this.makeRequest('/user');
            return {
                valid: true,
                user: {
                    id: user.id,
                    login: user.login,
                    name: user.name,
                    email: user.email,
                    avatar_url: user.avatar_url
                }
            };
        } catch (error) {
            if (error instanceof APIError && error.status === 401) {
                return { valid: false, error: 'Invalid or expired token' };
            }
            throw error;
        }
    }

    /**
     * Get user repositories
     */
    async getUserRepositories(options = {}) {
        const params = new URLSearchParams({
            type: options.type || 'all',
            sort: options.sort || 'updated',
            direction: options.direction || 'desc',
            per_page: options.perPage || 100
        });

        return await this.makeRequest(`/user/repos?${params}`);
    }

    /**
     * Get repository details
     */
    async getRepository(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}`);
    }

    /**
     * Get repository contents
     */
    async getRepositoryContents(owner, repo, path = '') {
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        return await this.makeRequest(`/repos/${owner}/${repo}/contents/${encodedPath}`);
    }

    /**
     * Get repository branches
     */
    async getRepositoryBranches(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}/branches`);
    }

    /**
     * Get repository commits
     */
    async getRepositoryCommits(owner, repo, options = {}) {
        const params = new URLSearchParams({
            per_page: options.perPage || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/repos/${owner}/${repo}/commits?${params}`);
    }

    /**
     * Get repository webhooks
     */
    async getRepositoryWebhooks(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}/hooks`);
    }

    /**
     * Create webhook
     */
    async createWebhook(owner, repo, webhookConfig) {
        return await this.makeRequest(`/repos/${owner}/${repo}/hooks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookConfig)
        });
    }

    /**
     * Delete webhook
     */
    async deleteWebhook(owner, repo, hookId) {
        return await this.makeRequest(`/repos/${owner}/${repo}/hooks/${hookId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get repository languages
     */
    async getRepositoryLanguages(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}/languages`);
    }

    /**
     * Get repository contributors
     */
    async getRepositoryContributors(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}/contributors`);
    }

    /**
     * Get repository stats
     */
    async getRepositoryStats(owner, repo) {
        const [languages, contributors, branches] = await Promise.all([
            this.getRepositoryLanguages(owner, repo),
            this.getRepositoryContributors(owner, repo),
            this.getRepositoryBranches(owner, repo)
        ]);

        return {
            languages,
            contributors,
            branchCount: branches.length
        };
    }

    /**
     * Search repositories
     */
    async searchRepositories(query, options = {}) {
        const params = new URLSearchParams({
            q: query,
            sort: options.sort || 'stars',
            order: options.order || 'desc',
            per_page: options.perPage || 30
        });

        return await this.makeRequest(`/search/repositories?${params}`);
    }

    /**
     * Get rate limit information
     */
    async getRateLimit() {
        return await this.makeRequest('/rate_limit');
    }

    /**
     * Check if repository is accessible
     */
    async isRepositoryAccessible(owner, repo) {
        try {
            await this.getRepository(owner, repo);
            return true;
        } catch (error) {
            if (error instanceof APIError && (error.status === 404 || error.status === 403)) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get repository file content
     */
    async getFileContent(owner, repo, path) {
        try {
            const content = await this.getRepositoryContents(owner, repo, path);
            
            if (content.type === 'file') {
                // Decode base64 content
                const decodedContent = atob(content.content);
                return {
                    name: content.name,
                    path: content.path,
                    size: content.size,
                    type: content.type,
                    content: decodedContent,
                    encoding: content.encoding
                };
            }
            
            return content;
        } catch (error) {
            console.error(`Failed to get file content for ${path}:`, error);
            throw error;
        }
    }

    /**
     * Create repository
     */
    async createRepository(repoData) {
        return await this.makeRequest('/user/repos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(repoData)
        });
    }

    /**
     * Fork repository
     */
    async forkRepository(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}/forks`, {
            method: 'POST'
        });
    }

    /**
     * Get repository issues
     */
    async getRepositoryIssues(owner, repo, options = {}) {
        const params = new URLSearchParams({
            state: options.state || 'open',
            sort: options.sort || 'created',
            direction: options.direction || 'desc',
            per_page: options.perPage || 30
        });

        return await this.makeRequest(`/repos/${owner}/${repo}/issues?${params}`);
    }

    /**
     * Get repository pull requests
     */
    async getRepositoryPullRequests(owner, repo, options = {}) {
        const params = new URLSearchParams({
            state: options.state || 'open',
            sort: options.sort || 'created',
            direction: options.direction || 'desc',
            per_page: options.perPage || 30
        });

        return await this.makeRequest(`/repos/${owner}/${repo}/pulls?${params}`);
    }
}

/**
 * API Error class for better error handling
 */
class APIError extends Error {
    constructor(status, statusText, message) {
        super(`GitHub API Error: ${status} ${statusText}`);
        this.status = status;
        this.statusText = statusText;
        this.message = message;
        this.name = 'APIError';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GitHubAPIClient, APIError };
}

// Global assignment for browser compatibility
window.GitHubAPIClient = window.GitHubAPIClient || GitHubAPIClient;
window.APIError = window.APIError || APIError;
