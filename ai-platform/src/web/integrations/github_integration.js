/**
 * GitHub Integration for AI Coding Dashboard
 * Handles repository cloning, analysis, and synchronization
 */

class GitHubIntegration {
    constructor() {
        this.apiBase = 'https://api.github.com';
        this.accessToken = null;
        this.repositories = [];
        this.currentRepo = null;
        this.webhooks = [];
        this.init();
    }

    init() {
        this.loadStoredToken();
        this.setupEventListeners();
    }

    // Load stored GitHub access token
    loadStoredToken() {
        const stored = localStorage.getItem('github_access_token');
        if (stored) {
            this.accessToken = stored;
        }
    }

    // Save GitHub access token
    saveToken(token) {
        this.accessToken = token;
        localStorage.setItem('github_access_token', token);
    }

    // Setup event listeners
    setupEventListeners() {
        // GitHub connect button
        const connectBtn = document.getElementById('github-connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.showTokenInput());
        }

        // Token connect button
        const tokenConnectBtn = document.getElementById('github-token-connect-btn');
        if (tokenConnectBtn) {
            tokenConnectBtn.addEventListener('click', async () => {
                const result = await this.connectGitHub();
                if (!result.success) {
                    this.showConnectionError(result.error);
                }
            });
        }

        // Token cancel button
        const tokenCancelBtn = document.getElementById('github-token-cancel-btn');
        if (tokenCancelBtn) {
            tokenCancelBtn.addEventListener('click', () => this.hideTokenInput());
        }

        // Token input Enter key
        const tokenInput = document.getElementById('github-token-input');
        if (tokenInput) {
            tokenInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const result = await this.connectGitHub();
                    if (!result.success) {
                        this.showConnectionError(result.error);
                    }
                }
            });
        }

        // Repository selection
        const repoSelect = document.getElementById('github-repo-select');
        if (repoSelect) {
            repoSelect.addEventListener('change', (e) => {
                this.selectRepository(e.target.value);
            });
        }

        // Sync repository button
        const syncBtn = document.getElementById('github-sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncRepository());
        }

        // Clone repository button
        const cloneBtn = document.getElementById('github-clone-btn');
        if (cloneBtn) {
            cloneBtn.addEventListener('click', () => this.cloneRepository());
        }

        // Disconnect button
        const disconnectBtn = document.getElementById('github-disconnect-btn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnect());
        }
    }

    // Connect to GitHub (OAuth flow simulation)
    async connectGitHub(token = null) {
        try {
            // Get token from parameter or input field
            if (!token) {
                const tokenInput = document.getElementById('github-token-input');
                token = tokenInput ? tokenInput.value : null;
            }
            
            if (!token) {
                return { success: false, error: 'Token is required' };
            }

            // Show loading state
            this.updateConnectionStatus('loading', 'Connecting to GitHub...');

            // Validate token
            const validation = await this.validateToken(token);
            
            if (validation.success) {
                this.updateConnectionStatus('loading', 'Loading repositories...');
                this.saveToken(token);
                await this.loadRepositories();
                this.updateUI();
                this.hideTokenInput();
                return { success: true, user: validation.user };
            }
            
            return validation;
        } catch (error) {
            console.error('GitHub connection error:', error);
            this.updateConnectionStatus('error', 'Connection failed');
            return { success: false, error: error.message };
        }
    }

    // Update connection status
    updateConnectionStatus(status, message) {
        const statusElement = document.getElementById('github-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `github-status ${status}`;
        }
    }

    // Show token input interface
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
    }

    // Hide token input interface
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
        }
    }

    // Show connection error message
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
    }

    // Validate GitHub access token
    async validateToken(token) {
        try {
            const response = await fetch(`${this.apiBase}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const user = await response.json();
                return { success: true, user };
            }
            
            return { success: false, error: 'Invalid token' };
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    // Load user repositories
    async loadRepositories() {
        if (!this.accessToken) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const response = await fetch(`${this.apiBase}/user/repos?per_page=100&sort=updated`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                this.repositories = await response.json();
                this.populateRepositorySelect();
                return { success: true, repositories: this.repositories };
            }
            
            return { success: false, error: 'Failed to load repositories' };
        } catch (error) {
            console.error('Load repositories error:', error);
            return { success: false, error: error.message };
        }
    }

    // Populate repository select dropdown
    populateRepositorySelect() {
        const select = document.getElementById('github-repo-select');
        if (!select) {
            return;
        }

        select.textContent = '<option value="">Select a repository...</option>' /* Replaced innerHTML with textContent for safety */
        
        this.repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.full_name;
            option.textContent = `${repo.full_name} (${repo.private ? 'Private' : 'Public'})`;
            select.appendChild(option);
        });
    }

    // Select repository
    selectRepository(repoFullName) {
        if (!repoFullName) {
            this.currentRepo = null;
            return;
        }

        this.currentRepo = this.repositories.find(repo => repo.full_name === repoFullName);
        
        if (this.currentRepo) {
            this.updateRepositoryInfo();
            this.enableRepositoryActions();
        }
    }

    // Update repository information display
    updateRepositoryInfo() {
        const infoContainer = document.getElementById('github-repo-info');
        if (!infoContainer || !this.currentRepo) {
            return;
        }

        infoContainer.textContent = `
            <div class="repo-details">
                <h4>${this.currentRepo.name}</h4>
                <p>${this.currentRepo.description || 'No description'}</p>
                <div class="repo-stats">
                    <span>⭐ ${this.currentRepo.stargazers_count}</span>
                    <span>🍴 ${this.currentRepo.forks_count}</span>
                    <span>👀 ${this.currentRepo.watchers_count}</span>
                    <span>📝 ${this.currentRepo.language || 'Unknown'}</span>
                </div>
                <div class="repo-meta">
                    <span>📅 Updated: ${new Date(this.currentRepo.updated_at).toLocaleDateString()}</span>
                    <span>📊 Size: ${(this.currentRepo.size / 1024).toFixed(1)} MB</span>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    // Enable repository action buttons
    enableRepositoryActions() {
        const syncBtn = document.getElementById('github-sync-btn');
        const cloneBtn = document.getElementById('github-clone-btn');
        const analyzeBtn = document.getElementById('github-analyze-btn');

        if (syncBtn) {
            syncBtn.disabled = false;
        }
        if (cloneBtn) {
            cloneBtn.disabled = false;
        }
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }
    }

    // Sync repository data
    async syncRepository() {
        if (!this.currentRepo) {
            return { success: false, error: 'No repository selected' };
        }

        try {
            // Get repository contents
            const contents = await this.getRepositoryContents();
            
            // Get repository statistics
            const stats = await this.getRepositoryStats();
            
            // Get recent commits
            const commits = await this.getRecentCommits();
            
            // Get issues
            const issues = await this.getRepositoryIssues();
            
            // Get pull requests
            const pullRequests = await this.getRepositoryPullRequests();
            
            const syncData = {
                repository: this.currentRepo,
                contents,
                stats,
                commits,
                issues,
                pullRequests,
                syncedAt: new Date().toISOString()
            };

            // Save sync data to local storage
            localStorage.setItem(`github_sync_${this.currentRepo.id}`, JSON.stringify(syncData));
            
            // Update UI
            this.updateSyncStatus('success');
            this.triggerAnalysis(syncData);
            
            return { success: true, data: syncData };
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('error');
            return { success: false, error: error.message };
        }
    }

    // Get repository contents
    async getRepositoryContents(path = '') {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.currentRepo.full_name}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
            
            return [];
        } catch (error) {
            console.error('Get contents error:', error);
            return [];
        }
    }

    // Get repository statistics
    async getRepositoryStats() {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.currentRepo.full_name}/stats/contributors`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
            
            return [];
        } catch (error) {
            console.error('Get stats error:', error);
            return [];
        }
    }

    // Get recent commits
    async getRecentCommits(limit = 10) {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.currentRepo.full_name}/commits?per_page=${limit}`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
            
            return [];
        } catch (error) {
            console.error('Get commits error:', error);
            return [];
        }
    }

    // Get repository issues
    async getRepositoryIssues(state = 'open') {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.currentRepo.full_name}/issues?state=${state}`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
            
            return [];
        } catch (error) {
            console.error('Get issues error:', error);
            return [];
        }
    }

    // Get repository pull requests
    async getRepositoryPullRequests(state = 'open') {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.currentRepo.full_name}/pulls?state=${state}`, {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
            
            return [];
        } catch (error) {
            console.error('Get pull requests error:', error);
            return [];
        }
    }

    // Clone repository (simulated)
    async cloneRepository() {
        if (!this.currentRepo) {
            return { success: false, error: 'No repository selected' };
        }

        try {
            // In a real implementation, this would use a backend service
            // For now, we'll simulate the cloning process
            
            this.updateCloneStatus('cloning');
            
            // Simulate cloning delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Create a local project entry
            const projectData = {
                id: `github_${this.currentRepo.id}`,
                name: this.currentRepo.name,
                description: this.currentRepo.description,
                source: 'github',
                repositoryUrl: this.currentRepo.html_url,
                clonedAt: new Date().toISOString(),
                lastSync: new Date().toISOString()
            };

            // Save to data manager
            if (typeof dataManager !== 'undefined') {
                await dataManager.saveProject(projectData);
            }

            this.updateCloneStatus('success');
            
            return { success: true, project: projectData };
        } catch (error) {
            console.error('Clone error:', error);
            this.updateCloneStatus('error');
            return { success: false, error: error.message };
        }
    }

    // Update sync status
    updateSyncStatus(status) {
        const statusElement = document.getElementById('github-sync-status');
        if (!statusElement) {
            return;
        }

        const statusConfig = {
            success: { text: '✅ Synced', class: 'success' },
            error: { text: '❌ Sync Failed', class: 'error' },
            syncing: { text: '🔄 Syncing...', class: 'syncing' }
        };

        const config = statusConfig[status] || { text: '❓ Unknown', class: 'unknown' };
        
        statusElement.textContent = config.text;
        statusElement.className = `sync-status ${config.class}`;
    }

    // Update clone status
    updateCloneStatus(status) {
        const statusElement = document.getElementById('github-clone-status');
        if (!statusElement) {
            return;
        }

        const statusConfig = {
            success: { text: '✅ Cloned', class: 'success' },
            error: { text: '❌ Clone Failed', class: 'error' },
            cloning: { text: '🔄 Cloning...', class: 'syncing' }
        };

        const config = statusConfig[status] || { text: '❓ Unknown', class: 'unknown' };
        
        statusElement.textContent = config.text;
        statusElement.className = `clone-status ${config.class}`;
    }

    // Trigger analysis on synced data
    triggerAnalysis(syncData) {
        // Convert GitHub data to analysis format
        const analysisData = {
            projectStructure: this.convertContentsToStructure(syncData.contents),
            codeMetrics: this.extractCodeMetrics(syncData.stats),
            commitHistory: syncData.commits,
            issues: syncData.issues,
            pullRequests: syncData.pullRequests,
            metadata: {
                repository: syncData.repository,
                syncedAt: syncData.syncedAt
            }
        };

        // Trigger dashboard analysis
        if (typeof analyzeProject === 'function') {
            analyzeProject(analysisData);
        }

        // Update analytics
        if (typeof updateAnalytics === 'function') {
            updateAnalytics(analysisData);
        }
    }

    // Convert GitHub contents to project structure
    convertContentsToStructure(contents) {
        const structure = {
            files: [],
            directories: [],
            totalFiles: 0,
            totalSize: 0,
            languages: {}
        };

        // Process contents recursively
        const processContents = (items, path = '') => {
            items.forEach(item => {
                if (item.type === 'file') {
                    structure.files.push({
                        name: item.name,
                        path: item.path,
                        size: item.size || 0,
                        language: this.detectLanguage(item.name)
                    });
                    structure.totalFiles++;
                    structure.totalSize += item.size || 0;
                    
                    const lang = this.detectLanguage(item.name);
                    structure.languages[lang] = (structure.languages[lang] || 0) + 1;
                } else if (item.type === 'dir') {
                    structure.directories.push({
                        name: item.name,
                        path: item.path
                    });
                }
            });
        };

        if (Array.isArray(contents)) {
            processContents(contents);
        }

        return structure;
    }

    // Detect programming language from file extension
    detectLanguage(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const languageMap = {
            'js': 'JavaScript',
            'ts': 'TypeScript',
            'py': 'Python',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C',
            'cs': 'C#',
            'php': 'PHP',
            'rb': 'Ruby',
            'go': 'Go',
            'rs': 'Rust',
            'swift': 'Swift',
            'kt': 'Kotlin',
            'scala': 'Scala',
            'html': 'HTML',
            'css': 'CSS',
            'scss': 'SCSS',
            'sass': 'Sass',
            'json': 'JSON',
            'xml': 'XML',
            'yaml': 'YAML',
            'yml': 'YAML',
            'md': 'Markdown',
            'sql': 'SQL'
        };

        return languageMap[extension] || 'Unknown';
    }

    // Extract code metrics from GitHub stats
    extractCodeMetrics(stats) {
        return {
            contributors: stats.length,
            totalCommits: stats.reduce((sum, contributor) => sum + contributor.total, 0),
            additions: stats.reduce((sum, contributor) => sum + contributor.a, 0),
            deletions: stats.reduce((sum, contributor) => sum + contributor.d, 0),
            topContributors: stats
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
                .map(contributor => ({
                    username: contributor.author.login,
                    commits: contributor.total,
                    additions: contributor.a,
                    deletions: contributor.d
                }))
        };
    }

    // Update UI based on authentication state
    updateUI() {
        const connectBtn = document.getElementById('github-connect-btn');
        const tokenContainer = document.getElementById('token-input-container');
        const repoSection = document.getElementById('github-repo-section');
        const actionsSection = document.getElementById('github-actions-section');
        const resultsSection = document.getElementById('github-results-section');
        const webhooksSection = document.getElementById('github-webhooks-section');
        const disconnectBtn = document.getElementById('github-disconnect-btn');
        const statusElement = document.getElementById('github-status');

        if (this.accessToken) {
            // Hide connection UI
            if (connectBtn) {
                connectBtn.style.display = 'none';
            }
            if (tokenContainer) {
                tokenContainer.style.display = 'none';
            }
            
            // Show repository and actions sections
            if (repoSection) {
                repoSection.style.display = 'block';
            }
            if (actionsSection) {
                actionsSection.style.display = 'block';
            }
            if (resultsSection) {
                resultsSection.style.display = 'block';
            }
            if (webhooksSection) {
                webhooksSection.style.display = 'block';
            }
            
            // Show disconnect button
            if (disconnectBtn) {
                disconnectBtn.style.display = 'block';
            }
            
            // Update status
            if (statusElement) {
                statusElement.textContent = '✅ Connected to GitHub';
                statusElement.className = 'github-status success';
            }
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
            if (repoSection) {
                repoSection.style.display = 'none';
            }
            if (actionsSection) {
                actionsSection.style.display = 'none';
            }
            if (resultsSection) {
                resultsSection.style.display = 'none';
            }
            if (webhooksSection) {
                webhooksSection.style.display = 'none';
            }
            
            // Hide disconnect button
            if (disconnectBtn) {
                disconnectBtn.style.display = 'none';
            }
            
            // Update status
            if (statusElement) {
                statusElement.textContent = '❌ Not connected';
                statusElement.className = 'github-status error';
            }
        }
    }

    // Disconnect from GitHub
    disconnect() {
        this.accessToken = null;
        this.repositories = [];
        this.currentRepo = null;
        localStorage.removeItem('github_access_token');
        
        // Clear any stored sync data
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('github_sync_')) {
                localStorage.removeItem(key);
            }
        });
        
        this.updateUI();
        console.log('Disconnected from GitHub');
    }

    // Get GitHub integration status
    getStatus() {
        return {
            isConnected: !!this.accessToken,
            repositories: this.repositories.length,
            currentRepo: this.currentRepo?.full_name || null
        };
    }
}

// Initialize GitHub integration
window.githubIntegration = new GitHubIntegration();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubIntegration;
}
