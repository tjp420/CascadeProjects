/**
 * GitHub UI Manager - Handles UI operations and user interactions
 * Extracted from GitHubIntegration for single responsibility principle
 */

class GitHubUIManager {
    constructor(containerId = 'github-integration') {
        this.containerId = containerId;
        this.container = null;
        this.eventListeners = new Map();
        this.statusElement = null;
        this.isConnected = false;
    }

    /**
     * Initialize UI manager
     */
    init() {
        this.container = document.getElementById(this.containerId);
        this.statusElement = document.getElementById('github-status');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Connect button
        const connectBtn = document.getElementById('github-connect-btn');
        if (connectBtn) {
            this.addEventListener('click', () => this.showTokenInput(), connectBtn);
        }

        // Token connect button
        const tokenConnectBtn = document.getElementById('github-token-connect-btn');
        if (tokenConnectBtn) {
            this.addEventListener('click', () => this.handleTokenConnect(), tokenConnectBtn);
        }

        // Token cancel button
        const tokenCancelBtn = document.getElementById('github-token-cancel-btn');
        if (tokenCancelBtn) {
            this.addEventListener('click', () => this.hideTokenInput(), tokenCancelBtn);
        }

        // Token input Enter key
        const tokenInput = document.getElementById('github-token-input');
        if (tokenInput) {
            this.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleTokenConnect();
                }
            }, tokenInput);
        }

        // Disconnect button
        const disconnectBtn = document.getElementById('github-disconnect-btn');
        if (disconnectBtn) {
            this.addEventListener('click', () => this.handleDisconnect(), disconnectBtn);
        }

        // Repository selection
        const repoSelect = document.getElementById('github-repo-select');
        if (repoSelect) {
            this.addEventListener('change', (e) => this.handleRepositorySelection(e), repoSelect);
        }

        // Clone button
        const cloneBtn = document.getElementById('github-clone-btn');
        if (cloneBtn) {
            this.addEventListener('click', () => this.handleCloneRepository(), cloneBtn);
        }

        // Sync button
        const syncBtn = document.getElementById('github-sync-btn');
        if (syncBtn) {
            this.addEventListener('click', () => this.handleSyncRepository(), syncBtn);
        }

        // Refresh button
        const refreshBtn = document.getElementById('github-refresh-btn');
        if (refreshBtn) {
            this.addEventListener('click', () => this.handleRefreshRepositories(), refreshBtn);
        }

        // Analyze button
        const analyzeBtn = document.getElementById('github-analyze-btn');
        if (analyzeBtn) {
            this.addEventListener('click', () => this.handleAnalyzeRepository(), analyzeBtn);
        }
    }

    /**
     * Add event listener with tracking
     */
    addEventListener(event, handler, element) {
        if (!element) {
            return;
        }

        const wrappedHandler = (e) => {
            try {
                handler(e);
            } catch (error) {
                console.error('UI event handler error:', error);
                this.showError(`UI Error: ${error.message}`);
            }
        };

        element.addEventListener(event, wrappedHandler);
        this.eventListeners.set(element, { event, handler: wrappedHandler });
    }

    /**
     * Show token input interface
     */
    showTokenInput() {
        const tokenContainer = document.getElementById('token-input-container');
        const connectBtn = document.getElementById('github-connect-btn');
        
        if (tokenContainer) {
            tokenContainer.style.display = 'block';
        }
        if (connectBtn) {
            connectBtn.style.display = 'none';
        }
        
        // Focus on the input field
        setTimeout(() => {
            const tokenInput = document.getElementById('github-token-input');
            if (tokenInput) {
                tokenInput.focus();
            }
        }, 100);

        this.triggerEvent('tokenInputShown');
    }

    /**
     * Hide token input interface
     */
    hideTokenInput() {
        const tokenContainer = document.getElementById('token-input-container');
        const connectBtn = document.getElementById('github-connect-btn');
        const tokenInput = document.getElementById('github-token-input');
        
        if (tokenContainer) {
            tokenContainer.style.display = 'none';
        }
        if (connectBtn) {
            connectBtn.style.display = 'block';
        }
        if (tokenInput) {
            tokenInput.value = '';
            tokenInput.style.borderColor = 'var(--border)';
            tokenInput.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
        }

        this.triggerEvent('tokenInputHidden');
    }

    /**
     * Handle token connect
     */
    handleTokenConnect() {
        const tokenInput = document.getElementById('github-token-input');
        const token = tokenInput ? tokenInput.value : null;
        
        if (!token) {
            this.showConnectionError('Token is required');
            return;
        }

        this.triggerEvent('tokenConnectRequested', { token });
    }

    /**
     * Handle disconnect
     */
    handleDisconnect() {
        this.triggerEvent('disconnectRequested');
    }

    /**
     * Handle repository selection
     */
    handleRepositorySelection(event) {
        const repoName = event.target.value;
        this.triggerEvent('repositorySelected', { repoName });
    }

    /**
     * Handle clone repository
     */
    handleCloneRepository() {
        this.triggerEvent('cloneRequested');
    }

    /**
     * Handle sync repository
     */
    handleSyncRepository() {
        this.triggerEvent('syncRequested');
    }

    /**
     * Handle refresh repositories
     */
    handleRefreshRepositories() {
        this.triggerEvent('refreshRequested');
    }

    /**
     * Handle analyze repository
     */
    handleAnalyzeRepository() {
        this.triggerEvent('analyzeRequested');
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status, message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            this.statusElement.className = `github-status ${status}`;
        }

        this.triggerEvent('statusUpdated', { status, message });
    }

    /**
     * Show connection error
     */
    showConnectionError(error) {
        const tokenInput = document.getElementById('github-token-input');
        if (tokenInput) {
            tokenInput.style.borderColor = 'var(--danger)';
            tokenInput.placeholder = `Error: ${error}`;
            
            // Clear error after 3 seconds
            setTimeout(() => {
                tokenInput.style.borderColor = 'var(--border)';
                tokenInput.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
            }, 3000);
        }
        
        console.error('GitHub connection error:', error);
        this.triggerEvent('connectionError', { error });
    }

    /**
     * Update UI based on connection state
     */
    updateConnectionState(isConnected) {
        this.isConnected = isConnected;
        
        const connectBtn = document.getElementById('github-connect-btn');
        const tokenContainer = document.getElementById('token-input-container');
        const repoSection = document.getElementById('github-repo-section');
        const actionsSection = document.getElementById('github-actions-section');
        const resultsSection = document.getElementById('github-results-section');
        const webhooksSection = document.getElementById('github-webhooks-section');
        const disconnectBtn = document.getElementById('github-disconnect-btn');

        if (isConnected) {
            // Hide connection UI
            if (connectBtn) {
                connectBtn.style.display = 'none';
            }
            if (tokenContainer) {
                tokenContainer.style.display = 'none';
            }
            
            // Show repository and actions sections
            this.showElement(repoSection);
            this.showElement(actionsSection);
            this.showElement(resultsSection);
            this.showElement(webhooksSection);
            
            // Show disconnect button
            this.showElement(disconnectBtn);
            
            // Update status
            this.updateConnectionStatus('success', '✅ Connected to GitHub');
        } else {
            // Show connection UI
            if (connectBtn) {
                connectBtn.style.display = 'block';
                connectBtn.textContent = '🔌 Connect GitHub';
                connectBtn.disabled = false;
            }
            if (tokenContainer) {
                tokenContainer.style.display = 'none';
            }
            
            // Hide repository and actions sections
            this.hideElement(repoSection);
            this.hideElement(actionsSection);
            this.hideElement(resultsSection);
            this.hideElement(webhooksSection);
            
            // Hide disconnect button
            this.hideElement(disconnectBtn);
            
            // Update status
            this.updateConnectionStatus('error', '❌ Not connected');
        }

        this.triggerEvent('connectionStateChanged', { isConnected });
    }

    /**
     * Update repositories list
     */
    updateRepositoriesList(repositories) {
        const repoSelect = document.getElementById('github-repo-select');
        if (!repoSelect) {
            return;
        }

        repoSelect.textContent = '<option value="">Select a repository...</option>' /* Replaced innerHTML with textContent for safety */
        
        repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.full_name;
            option.textContent = `${repo.full_name} (${repo.private ? 'Private' : 'Public'})`;
            repoSelect.appendChild(option);
        });

        this.triggerEvent('repositoriesUpdated', { repositories });
    }

    /**
     * Update repository details
     */
    updateRepositoryDetails(repository) {
        const detailsElement = document.getElementById('github-repo-details');
        if (!detailsElement) {
            return;
        }

        detailsElement.textContent = `
            <div class="repo-info">
                <h3>${repository.full_name}</h3>
                <p>${repository.description || 'No description'}</p>
                <div class="repo-stats">
                    <span>⭐ ${repository.stargazers_count}</span>
                    <span>🍴 ${repository.forks_count}</span>
                    <span>📝 ${repository.language || 'Unknown'}</span>
                    <span>🔒 ${repository.private ? 'Private' : 'Public'}</span>
                </div>
                <div class="repo-actions">
                    <button class="btn btn-primary" onclick="window.githubIntegration.cloneRepository()">
                        📥 Clone Repository
                    </button>
                    <button class="btn btn-secondary" onclick="window.githubIntegration.syncRepository()">
                        🔄 Sync Repository
                    </button>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        this.triggerEvent('repositoryDetailsUpdated', { repository });
    }

    /**
     * Update sync results
     */
    updateSyncResults(syncData) {
        const resultsElement = document.getElementById('github-sync-results');
        if (!resultsElement) {
            return;
        }

        const { repository, syncTime, syncDuration, additionalData } = syncData;
        
        resultsElement.textContent = `
            <div class="sync-results">
                <h4>📊 Sync Results</h4>
                <div class="sync-info">
                    <p><strong>Repository:</strong> ${repository.full_name}</p>
                    <p><strong>Sync Time:</strong> ${new Date(syncTime).toLocaleString()}</p>
                    <p><strong>Duration:</strong> ${syncDuration}ms</p>
                </div>
                ${additionalData.commits ? `
                    <div class="commits-section">
                        <h5>Recent Commits</h5>
                        <ul class="commits-list">
                            ${additionalData.commits.slice(0, 5).map(commit => `
                                <li>
                                    <strong>${commit.sha.substring(0, 7)}</strong> - ${commit.commit.message}
                                    <br><small>by ${commit.commit.author.name} on ${new Date(commit.commit.author.date).toLocaleDateString()}</small>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div class="sync-actions">
                    <button class="btn btn-primary" onclick="window.githubIntegration.triggerAnalysis()">
                        🔍 Analyze Repository
                    </button>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        this.triggerEvent('syncResultsUpdated', { syncData });
    }

    /**
     * Show loading state
     */
    showLoading(message = 'Loading...') {
        this.updateConnectionStatus('loading', message);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.updateConnectionStatus('error', `❌ ${message}`);
        
        // Show toast notification
        this.showToast(message, 'error');
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * Show element
     */
    showElement(element) {
        if (element) {
            element.style.display = 'block';
        }
    }

    /**
     * Hide element
     */
    hideElement(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    /**
     * Trigger custom event
     */
    triggerEvent(eventName, detail = {}) {
        const event = new CustomEvent(`githubUI:${eventName}`, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Add event listener for custom events
     */
    addCustomEventListener(eventName, handler) {
        document.addEventListener(`githubUI:${eventName}`, handler);
    }

    /**
     * Remove event listener for custom events
     */
    removeCustomEventListener(eventName, handler) {
        document.removeEventListener(`githubUI:${eventName}`, handler);
    }

    /**
     * Get connection state
     */
    isConnectedState() {
        return this.isConnected;
    }

    /**
     * Get container element
     */
    getContainer() {
        return this.container;
    }

    /**
     * Destroy UI manager and clean up
     */
    destroy() {
        // Remove all event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners.clear();

        // Clear references
        this.container = null;
        this.statusElement = null;

        console.log('GitHub UI Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubUIManager;
}

// Global assignment for browser compatibility
window.GitHubUIManager = window.GitHubUIManager || GitHubUIManager;
