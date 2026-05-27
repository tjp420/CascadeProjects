/**
 * Refactored GitHub Integration - Uses dependency injection and single responsibility principle
 * Orchestrates GitHub operations with clean separation of concerns
 */

// Prevent redeclaration
if (typeof GitHubIntegration !== 'undefined') {
    console.log('GitHubIntegration already defined, skipping redeclaration');
} else {

    class GitHubIntegration {
        constructor(dependencies = {}) {
        // Dependency injection
            this.apiClient = dependencies.apiClient || new window.GitHubAPIClient();
            this.repositoryManager = dependencies.repositoryManager || new window.GitHubRepositoryManager(this.apiClient);
            this.uiManager = dependencies.uiManager || new window.GitHubUIManager();
            this.storage = dependencies.storage || new window.GitHubStorage();
        
            // Configuration
            this.config = dependencies.config || {
                maxRepositories: 100,
                syncTimeout: 30000,
                enableCaching: true,
                autoRefresh: false
            };

            // State
            this.isConnected = false;
            this.currentUser = null;
            this.webhooks = [];
            this.eventListeners = new Map();
        
            this.init();
        }

        /**
     * Initialize GitHub integration
     */
        init() {
            console.log('Initializing GitHub Integration...');
        
            try {
                this.loadStoredToken();
                this.setupEventListeners();
                this.updateUI();
            
                console.log('GitHub Integration initialized successfully');
            } catch (error) {
                this.handleError('GitHub Integration initialization failed', error);
            }
        }

        /**
     * Load stored access token
     */
        loadStoredToken() {
            const stored = localStorage.getItem('github_access_token');
            if (stored) {
                this.apiClient.setAccessToken(stored);
                this.isConnected = true;
            }
        }

        /**
     * Setup event listeners
     */
        setupEventListeners() {
        // Listen to UI events
            this.uiManager.addCustomEventListener('tokenConnectRequested', (event) => {
                this.handleTokenConnectRequest(event.detail);
            });

            this.uiManager.addCustomEventListener('disconnectRequested', () => {
                this.handleDisconnectRequest();
            });

            this.uiManager.addCustomEventListener('repositorySelected', (event) => {
                this.handleRepositorySelection(event.detail);
            });

            this.uiManager.addCustomEventListener('cloneRequested', () => {
                this.handleCloneRequest();
            });

            this.uiManager.addCustomEventListener('syncRequested', () => {
                this.handleSyncRequest();
            });

            this.uiManager.addCustomEventListener('refreshRequested', () => {
                this.handleRefreshRequest();
            });

            this.uiManager.addCustomEventListener('analyzeRequested', () => {
                this.handleAnalyzeRequest();
            });
        }

        /**
     * Update UI based on current state
     */
        updateUI() {
            this.uiManager.updateConnectionState(this.isConnected);
        
            if (this.isConnected && this.repositoryManager.getAllRepositories().length > 0) {
                this.uiManager.updateRepositoriesList(this.repositoryManager.getAllRepositories());
            }
        }

        /**
     * Connect to GitHub with token
     */
        async connectGitHub(token = null) {
            try {
                this.uiManager.showLoading('Connecting to GitHub...');

                // Get token from parameter or UI
                if (!token) {
                    const tokenInput = document.getElementById('github-token-input');
                    token = tokenInput ? tokenInput.value : null;
                }
            
                if (!token) {
                    return { success: false, error: 'Token is required' };
                }

                // Validate token
                const validation = await this.apiClient.validateToken(token);
            
                if (validation.valid) {
                // Save token and update state
                    this.saveToken(token);
                    this.isConnected = true;
                    this.currentUser = validation.user;
                
                    // Load repositories
                    this.uiManager.showLoading('Loading repositories...');
                    await this.repositoryManager.loadRepositories({
                        perPage: this.config.maxRepositories
                    });
                
                    // Update UI
                    this.updateUI();
                    this.uiManager.hideTokenInput();
                
                    this.triggerEvent('connected', { user: validation.user });
                    return { success: true, user: validation.user };
                }
            
                return { success: false, error: 'Invalid token' };
            
            } catch (error) {
                this.handleError('GitHub connection failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Disconnect from GitHub
     */
        async disconnect() {
            try {
            // Clear token and state
                this.apiClient.setAccessToken(null);
                this.isConnected = false;
                this.currentUser = null;
            
                // Clear stored data
                localStorage.removeItem('github_access_token');
                this.repositoryManager.clearData();
            
                // Update UI
                this.updateUI();
            
                this.triggerEvent('disconnected');
                console.log('Disconnected from GitHub');
            
                return { success: true };
            
            } catch (error) {
                this.handleError('Disconnect failed', error);
                return { success: false, error: error.message };
            }
        }

        /**
     * Save access token
     */
        saveToken(token) {
            this.apiClient.setAccessToken(token);
            localStorage.setItem('github_access_token', token);
        }

        /**
     * Handle token connect request
     */
        async handleTokenConnectRequest(detail) {
            const result = await this.connectGitHub(detail.token);
        
            if (!result.success) {
                this.uiManager.showConnectionError(result.error);
            }
        }

        /**
     * Handle disconnect request
     */
        async handleDisconnectRequest() {
            await this.disconnect();
        }

        /**
     * Handle repository selection
     */
        async handleRepositorySelection(detail) {
            try {
                const repo = this.repositoryManager.getRepositoryByName(detail.repoName);
            
                if (repo) {
                    await this.repositoryManager.setCurrentRepository(repo);
                    this.uiManager.updateRepositoryDetails(repo);
                
                    this.triggerEvent('repositoryChanged', { repository: repo });
                }
            
            } catch (error) {
                this.handleError('Repository selection failed', error);
            }
        }

        /**
     * Handle clone request
     */
        async handleCloneRequest() {
            try {
                const currentRepo = this.repositoryManager.getCurrentRepository();
            
                if (!currentRepo) {
                    this.uiManager.showError('No repository selected');
                    return;
                }

                this.triggerEvent('cloneRequested', { repository: currentRepo });
            
            } catch (error) {
                this.handleError('Clone request failed', error);
            }
        }

        /**
     * Handle sync request
     */
        async handleSyncRequest() {
            try {
                const currentRepo = this.repositoryManager.getCurrentRepository();
            
                if (!currentRepo) {
                    this.uiManager.showError('No repository selected');
                    return;
                }

                this.uiManager.showLoading('Syncing repository...');
            
                const syncData = await this.repositoryManager.syncRepository(currentRepo, {
                    includeCommits: true,
                    includeIssues: true,
                    includePullRequests: true
                });
            
                this.uiManager.updateSyncResults(syncData);
                this.uiManager.showSuccess('Repository synced successfully');
            
                this.triggerEvent('syncCompleted', { repository: currentRepo, syncData });
            
            } catch (error) {
                this.handleError('Sync failed', error);
            }
        }

        /**
     * Handle refresh request
     */
        async handleRefreshRequest() {
            try {
                this.uiManager.showLoading('Refreshing repositories...');
            
                await this.repositoryManager.loadRepositories({
                    perPage: this.config.maxRepositories
                });
            
                this.updateUI();
                this.uiManager.showSuccess('Repositories refreshed successfully');
            
                this.triggerEvent('repositoriesRefreshed');
            
            } catch (error) {
                this.handleError('Refresh failed', error);
            }
        }

        /**
     * Handle analyze request
     */
        async handleAnalyzeRequest() {
            try {
                const currentRepo = this.repositoryManager.getCurrentRepository();
            
                if (!currentRepo) {
                    this.uiManager.showError('No repository selected');
                    return;
                }

                // Get sync data
                const syncData = this.repositoryManager.getSyncData(currentRepo.id);
            
                if (!syncData) {
                    this.uiManager.showError('Repository data not synced. Please sync first.');
                    return;
                }

                this.triggerEvent('analyzeRequested', { 
                    repository: currentRepo, 
                    syncData 
                });
            
            } catch (error) {
                this.handleError('Analysis request failed', error);
            }
        }

        /**
     * Get current user
     */
        getCurrentUser() {
            return this.currentUser;
        }

        /**
     * Get current repository
     */
        getCurrentRepository() {
            return this.repositoryManager.getCurrentRepository();
        }

        /**
     * Get all repositories
     */
        getAllRepositories() {
            return this.repositoryManager.getAllRepositories();
        }

        /**
     * Get repository statistics
     */
        getRepositoryStatistics() {
            return this.repositoryManager.getRepositoryStatistics();
        }

        /**
     * Search repositories
     */
        async searchRepositories(query, options = {}) {
            try {
                return await this.repositoryManager.searchRepositories(query, options);
            } catch (error) {
                this.handleError('Search failed', error);
                return [];
            }
        }

        /**
     * Filter repositories
     */
        filterRepositories(criteria) {
            return this.repositoryManager.filterRepositories(criteria);
        }

        /**
     * Get repository file tree
     */
        async getRepositoryFileTree(repo, path = '') {
            try {
                return await this.repositoryManager.getRepositoryFileTree(repo, path);
            } catch (error) {
                this.handleError('Failed to get file tree', error);
                return [];
            }
        }

        /**
     * Get file content
     */
        async getFileContent(repo, path) {
            try {
                return await this.repositoryManager.getFileContent(repo, path);
            } catch (error) {
                this.handleError('Failed to get file content', error);
                return null;
            }
        }

        /**
     * Trigger analysis
     */
        triggerAnalysis() {
            const currentRepo = this.repositoryManager.getCurrentRepository();
            const syncData = this.repositoryManager.getSyncData(currentRepo.id);
        
            if (syncData) {
                this.triggerEvent('analyzeRequested', { 
                    repository: currentRepo, 
                    syncData 
                });
            }
        }

        /**
     * Clone repository
     */
        async cloneRepository() {
            const currentRepo = this.repositoryManager.getCurrentRepository();
        
            if (currentRepo) {
                this.triggerEvent('cloneRequested', { repository: currentRepo });
            }
        }

        /**
     * Sync repository
     */
        async syncRepository() {
            await this.handleSyncRequest();
        }

        /**
     * Load repositories
     */
        async loadRepositories() {
            await this.handleRefreshRequest();
        }

        /**
     * Get integration status
     */
        getStatus() {
            return {
                isConnected: this.isConnected,
                user: this.currentUser,
                repositoryCount: this.repositoryManager.getAllRepositories().length,
                currentRepository: this.repositoryManager.getCurrentRepository()
            };
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
                apiClient: this.apiClient,
                repositoryManager: this.repositoryManager,
                uiManager: this.uiManager,
                storage: this.storage
            };
        }

        /**
     * Destroy and clean up
     */
        destroy() {
            this.uiManager.destroy();
            this.repositoryManager.clearData();
            this.eventListeners.clear();
        
            console.log('GitHub Integration destroyed');
        }
    }

    // Factory function for creating GitHubIntegration with default dependencies
    function createGitHubIntegration(options = {}) {
        const dependencies = {
            apiClient: options.apiClient || new window.GitHubAPIClient(),
            repositoryManager: options.repositoryManager || null,
            uiManager: options.uiManager || new window.GitHubUIManager(),
            storage: options.storage || new window.GitHubStorage(),
            config: options.config
        };

        // Create repository manager if not provided
        if (!dependencies.repositoryManager) {
            dependencies.repositoryManager = new window.GitHubRepositoryManager(dependencies.apiClient, dependencies.storage);
        }

        return new GitHubIntegration(dependencies);
    }

    // Export for use in other modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { GitHubIntegration, createGitHubIntegration };
    }

// Close the if statement
}

// Global assignment for browser compatibility
if (typeof GitHubIntegration !== 'undefined') {
    window.GitHubIntegration = window.GitHubIntegration || GitHubIntegration;
    window.createGitHubIntegration = window.createGitHubIntegration || createGitHubIntegration;
}
