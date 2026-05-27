/**
 * GitHub Repository Manager - Handles repository operations and data management
 * Extracted from GitHubIntegration for single responsibility principle
 */

class GitHubRepositoryManager {
    constructor(apiClient, storage = null) {
        this.apiClient = apiClient;
        this.storage = storage || new GitHubStorage();
        this.repositories = new Map();
        this.currentRepo = null;
        this.syncData = new Map();
    }

    /**
     * Load user repositories
     */
    async loadRepositories(options = {}) {
        try {
            console.log('Loading GitHub repositories...');
            
            const repos = await this.apiClient.getUserRepositories(options);
            
            // Convert to Map for easier management
            this.repositories.clear();
            repos.forEach(repo => {
                this.repositories.set(repo.id, {
                    id: repo.id,
                    name: repo.name,
                    full_name: repo.full_name,
                    description: repo.description,
                    private: repo.private,
                    html_url: repo.html_url,
                    clone_url: repo.clone_url,
                    ssh_url: repo.ssh_url,
                    default_branch: repo.default_branch,
                    language: repo.language,
                    stargazers_count: repo.stargazers_count,
                    forks_count: repo.forks_count,
                    updated_at: repo.updated_at,
                    created_at: repo.created_at,
                    owner: {
                        login: repo.owner.login,
                        avatar_url: repo.owner.avatar_url
                    }
                });
            });

            console.log(`Loaded ${this.repositories.size} repositories`);
            return Array.from(this.repositories.values());
            
        } catch (error) {
            console.error('Failed to load repositories:', error);
            throw error;
        }
    }

    /**
     * Get repository by ID
     */
    getRepository(id) {
        return this.repositories.get(id);
    }

    /**
     * Get repository by name
     */
    getRepositoryByName(name) {
        for (const repo of this.repositories.values()) {
            if (repo.name === name || repo.full_name === name) {
                return repo;
            }
        }
        return null;
    }

    /**
     * Get all repositories
     */
    getAllRepositories() {
        return Array.from(this.repositories.values());
    }

    /**
     * Set current repository
     */
    setCurrentRepository(repo) {
        if (typeof repo === 'string') {
            repo = this.getRepositoryByName(repo);
        }
        
        if (!repo) {
            throw new Error('Repository not found');
        }

        this.currentRepo = repo;
        this.storage.setCurrentRepository(repo);
        console.log('Current repository set to:', repo.full_name);
        
        return repo;
    }

    /**
     * Get current repository
     */
    getCurrentRepository() {
        return this.currentRepo;
    }

    /**
     * Get repository details
     */
    async getRepositoryDetails(owner, repo) {
        try {
            const details = await this.apiClient.getRepository(owner, repo);
            const stats = await this.apiClient.getRepositoryStats(owner, repo);
            
            return {
                ...details,
                stats
            };
        } catch (error) {
            console.error(`Failed to get repository details for ${owner}/${repo}:`, error);
            throw error;
        }
    }

    /**
     * Sync repository data
     */
    async syncRepository(repo, options = {}) {
        try {
            console.log(`Syncing repository: ${repo.full_name}`);
            
            const syncStartTime = Date.now();
            
            // Get basic repository info
            const details = await this.getRepositoryDetails(repo.owner.login, repo.name);
            
            // Get additional data if requested
            const additionalData = {};
            
            if (options.includeCommits) {
                additionalData.commits = await this.apiClient.getRepositoryCommits(
                    repo.owner.login, 
                    repo.name,
                    { perPage: 10 }
                );
            }
            
            if (options.includeIssues) {
                additionalData.issues = await this.apiClient.getRepositoryIssues(
                    repo.owner.login, 
                    repo.name,
                    { perPage: 10 }
                );
            }
            
            if (options.includePullRequests) {
                additionalData.pullRequests = await this.apiClient.getRepositoryPullRequests(
                    repo.owner.login, 
                    repo.name,
                    { perPage: 10 }
                );
            }
            
            // Create sync data
            const syncData = {
                repository: details,
                additionalData,
                syncTime: new Date().toISOString(),
                syncDuration: Date.now() - syncStartTime,
                options
            };
            
            // Store sync data
            this.syncData.set(repo.id, syncData);
            this.storage.saveSyncData(repo.id, syncData);
            
            console.log(`Repository ${repo.full_name} synced successfully`);
            return syncData;
            
        } catch (error) {
            console.error(`Failed to sync repository ${repo.full_name}:`, error);
            throw error;
        }
    }

    /**
     * Get sync data for repository
     */
    getSyncData(repoId) {
        return this.syncData.get(repoId) || this.storage.getSyncData(repoId);
    }

    /**
     * Get repository file tree
     */
    async getRepositoryFileTree(repo, path = '', recursive = true) {
        try {
            const contents = await this.apiClient.getRepositoryContents(
                repo.owner.login, 
                repo.name, 
                path
            );
            
            if (contents.type === 'dir' && recursive) {
                const tree = [];
                
                for (const item of contents) {
                    if (item.type === 'dir') {
                        const subTree = await this.getRepositoryFileTree(repo, item.path, true);
                        tree.push(...subTree);
                    } else {
                        tree.push({
                            name: item.name,
                            path: item.path,
                            type: item.type,
                            size: item.size
                        });
                    }
                }
                
                return tree;
            }
            
            return Array.isArray(contents) ? contents : [contents];
            
        } catch (error) {
            console.error(`Failed to get file tree for ${repo.full_name}:`, error);
            throw error;
        }
    }

    /**
     * Get repository file content
     */
    async getFileContent(repo, path) {
        try {
            return await this.apiClient.getFileContent(
                repo.owner.login, 
                repo.name, 
                path
            );
        } catch (error) {
            console.error(`Failed to get file content for ${repo.full_name}/${path}:`, error);
            throw error;
        }
    }

    /**
     * Search repositories
     */
    async searchRepositories(query, options = {}) {
        try {
            const results = await this.apiClient.searchRepositories(query, options);
            
            return results.items.map(item => ({
                id: item.id,
                name: item.name,
                full_name: item.full_name,
                description: item.description,
                private: item.private,
                html_url: item.html_url,
                clone_url: item.clone_url,
                ssh_url: item.ssh_url,
                default_branch: item.default_branch,
                language: item.language,
                stargazers_count: item.stargazers_count,
                forks_count: item.forks_count,
                updated_at: item.updated_at,
                created_at: item.created_at,
                owner: {
                    login: item.owner.login,
                    avatar_url: item.owner.avatar_url
                }
            }));
            
        } catch (error) {
            console.error('Failed to search repositories:', error);
            throw error;
        }
    }

    /**
     * Filter repositories
     */
    filterRepositories(criteria = {}) {
        let repos = Array.from(this.repositories.values());
        
        if (criteria.search) {
            const search = criteria.search.toLowerCase();
            repos = repos.filter(repo => 
                repo.name.toLowerCase().includes(search) ||
                repo.description?.toLowerCase().includes(search) ||
                repo.full_name.toLowerCase().includes(search)
            );
        }
        
        if (criteria.language) {
            repos = repos.filter(repo => 
                repo.language?.toLowerCase() === criteria.language.toLowerCase()
            );
        }
        
        if (criteria.private !== undefined) {
            repos = repos.filter(repo => repo.private === criteria.private);
        }
        
        if (criteria.minStars) {
            repos = repos.filter(repo => repo.stargazers_count >= criteria.minStars);
        }
        
        if (criteria.minForks) {
            repos = repos.filter(repo => repo.forks_count >= criteria.minForks);
        }
        
        // Sort repositories
        if (criteria.sortBy) {
            repos.sort((a, b) => {
                const aValue = a[criteria.sortBy];
                const bValue = b[criteria.sortBy];
                
                if (criteria.sortDirection === 'desc') {
                    return bValue > aValue ? 1 : -1;
                } else {
                    return aValue > bValue ? 1 : -1;
                }
            });
        }
        
        return repos;
    }

    /**
     * Get repository statistics
     */
    getRepositoryStatistics() {
        const repos = Array.from(this.repositories.values());
        
        const totalRepos = repos.length;
        const privateRepos = repos.filter(repo => repo.private).length;
        const publicRepos = totalRepos - privateRepos;
        
        const languages = {};
        repos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
        });
        
        const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
        
        return {
            totalRepos,
            privateRepos,
            publicRepos,
            languages,
            totalStars,
            totalForks,
            averageStars: totalRepos > 0 ? Math.round(totalStars / totalRepos) : 0,
            averageForks: totalRepos > 0 ? Math.round(totalForks / totalRepos) : 0
        };
    }

    /**
     * Clear all data
     */
    clearData() {
        this.repositories.clear();
        this.currentRepo = null;
        this.syncData.clear();
        this.storage.clearData();
    }

    /**
     * Export repository data
     */
    exportRepositoryData() {
        return {
            repositories: Array.from(this.repositories.values()),
            currentRepo: this.currentRepo,
            syncData: Array.from(this.syncData.entries()).map(([id, data]) => ({ id, ...data })),
            statistics: this.getRepositoryStatistics()
        };
    }

    /**
     * Import repository data
     */
    importRepositoryData(data) {
        if (data.repositories) {
            this.repositories.clear();
            data.repositories.forEach(repo => {
                this.repositories.set(repo.id, repo);
            });
        }
        
        if (data.currentRepo) {
            this.currentRepo = data.currentRepo;
        }
        
        if (data.syncData) {
            this.syncData.clear();
            data.syncData.forEach(({ id, ...syncData }) => {
                this.syncData.set(id, syncData);
                this.storage.saveSyncData(id, syncData);
            });
        }
    }
}

/**
 * GitHub Storage - Handles localStorage operations for GitHub data
 */
class GitHubStorage {
    constructor() {
        this.prefix = 'github_';
    }

    /**
     * Save current repository
     */
    setCurrentRepository(repo) {
        localStorage.setItem(`${this.prefix}current_repo`, JSON.stringify(repo));
    }

    /**
     * Get current repository
     */
    getCurrentRepository() {
        const stored = localStorage.getItem(`${this.prefix}current_repo`);
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Save sync data
     */
    saveSyncData(repoId, syncData) {
        localStorage.setItem(`${this.prefix}sync_${repoId}`, JSON.stringify(syncData));
    }

    /**
     * Get sync data
     */
    getSyncData(repoId) {
        const stored = localStorage.getItem(`${this.prefix}sync_${repoId}`);
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Clear data
     */
    clearData() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GitHubRepositoryManager, GitHubStorage };
}

// Global assignment for browser compatibility
window.GitHubRepositoryManager = window.GitHubRepositoryManager || GitHubRepositoryManager;
window.GitHubStorage = window.GitHubStorage || GitHubStorage;
