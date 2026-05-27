/**
 * Git Integration Module for Dashboard
 * Provides real Git repository analysis and branch details
 */

class GitIntegration {
    constructor() {
        this.gitExporter = null;
        this.currentRepo = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Git integration
     * @param {string} repoPath - Path to Git repository
     * @param {string} provider - Git provider ('local', 'github', 'gitlab')
     * @returns {Promise<boolean>} Success status
     */
    async initialize(repoPath = './', provider = 'local') {
        try {
            // Load GitHistoryExporter if not already loaded
            if (typeof GitHistoryExporter === 'undefined') {
                await this.loadGitExporter();
            }

            this.gitExporter = new GitHistoryExporter({
                provider: provider,
                repoPath: repoPath,
                branch: 'main'
            });

            this.isInitialized = await this.gitExporter.initialize();
            
            if (this.isInitialized) {
                this.currentRepo = {
                    path: repoPath,
                    provider: provider,
                    branch: 'main'
                };
                console.log('Git integration initialized successfully');
            }
            
            return this.isInitialized;
        } catch (error) {
            console.error('Failed to initialize Git integration:', error);
            return false;
        }
    }

    /**
     * Load GitHistoryExporter module
     */
    async loadGitExporter() {
        return new Promise((resolve, reject) => {
            if (typeof GitHistoryExporter !== 'undefined') {
                resolve();
                return;
            }

            // Load the script
            const script = document.createElement('script');
            script.src = 'js/git-history-export.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load GitHistoryExporter'));
            document.head.appendChild(script);
        });
    }

    /**
     * Get branch details
     * @param {string} branchName - Branch name (default: 'main')
     * @returns {Promise<Object>} Branch details
     */
    async getBranchDetails(branchName = 'main') {
        if (!this.isInitialized) {
            return this.getPlaceholderBranchDetails(branchName);
        }

        try {
            // Get branch information
            const branches = await this.gitExporter.getBranches();
            const branch = branches.find(b => b.name === branchName) || branches[0];
            
            if (!branch) {
                return this.getPlaceholderBranchDetails(branchName);
            }

            // Get recent commits for this branch
            const commits = await this.gitExporter.getCommits(branchName, 10);
            
            // Get contributors
            const contributors = await this.gitExporter.getContributors();
            
            // Get branch statistics
            const stats = await this.gitExporter.getBranchStats(branchName);

            return {
                name: branch.name,
                isDefault: branch.isDefault || branch.name === 'main',
                isProtected: branch.protected || false,
                ahead: branch.ahead || 0,
                behind: branch.behind || 0,
                createdAt: new Date(branch.created || Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                lastCommit: commits[0] ? {
                    hash: commits[0].hash,
                    message: commits[0].message,
                    author: commits[0].author,
                    date: commits[0].date,
                    changes: commits[0].changes
                } : null,
                commitCount: commits.length,
                contributors: contributors.length,
                totalChanges: stats.totalChanges || 0,
                additions: stats.additions || 0,
                deletions: stats.deletions || 0,
                files: stats.files || 0,
                description: this.generateBranchDescription(branch, stats),
                recentCommits: commits.slice(0, 5).map(commit => ({
                    hash: commit.hash.substring(0, 7),
                    message: commit.message,
                    author: commit.author,
                    date: commit.date,
                    changes: commit.changes
                }))
            };
        } catch (error) {
            console.error('Error getting branch details:', error);
            return this.getPlaceholderBranchDetails(branchName);
        }
    }

    /**
     * Get placeholder branch details when Git integration is not available
     * @param {string} branchName - Branch name
     * @returns {Object} Placeholder branch details
     */
    getPlaceholderBranchDetails(branchName) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        return {
            name: branchName,
            isDefault: branchName === 'main',
            isProtected: branchName === 'main',
            ahead: 0,
            behind: 0,
            createdAt: thirtyDaysAgo.toISOString(),
            lastCommit: {
                hash: 'abc1234',
                message: 'Latest commit message',
                author: 'Trevor',
                date: now.toISOString(),
                changes: {
                    additions: 42,
                    deletions: 12,
                    files: 5
                }
            },
            commitCount: 47,
            contributors: 3,
            totalChanges: 1500,
            additions: 1200,
            deletions: 300,
            files: 85,
            description: `Main development branch for the project. Contains ${47} commits from ${3} contributors.`,
            recentCommits: [
                {
                    hash: 'abc1234',
                    message: 'Fix authentication issue',
                    author: 'Placeholder Author',
                    date: now.toISOString(),
                    changes: { additions: 15, deletions: 3, files: 2 }
                },
                {
                    hash: 'def5678',
                    message: 'Add new dashboard features',
                    author: 'Trevor',
                    date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    changes: { additions: 120, deletions: 8, files: 12 }
                },
                {
                    hash: 'ghi9012',
                    message: 'Update dependencies',
                    author: 'Trevor',
                    date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    changes: { additions: 45, deletions: 38, files: 8 }
                }
            ]
        };
    }

    /**
     * Generate branch description
     * @param {Object} branch - Branch object
     * @param {Object} stats - Branch statistics
     * @returns {string} Branch description
     */
    generateBranchDescription(branch, stats) {
        const commitCount = stats.commitCount || 0;
        const contributorCount = stats.contributors || 0;
        const daysActive = Math.floor((Date.now() - new Date(branch.created).getTime()) / (24 * 60 * 60 * 1000));
        
        let description = `${branch.isDefault ? 'Default branch' : 'Feature branch'}`;
        
        if (commitCount > 0) {
            description += ` with ${commitCount} commits`;
        }
        
        if (contributorCount > 0) {
            description += ` from ${contributorCount} contributor${contributorCount > 1 ? 's' : ''}`;
        }
        
        if (daysActive > 0) {
            description += ` over ${daysActive} day${daysActive > 1 ? 's' : ''}`;
        }
        
        return description;
    }

    /**
     * Get all branches
     * @returns {Promise<Array>} List of branches
     */
    async getAllBranches() {
        if (!this.isInitialized) {
            return this.getPlaceholderBranches();
        }

        try {
            const branches = await this.gitExporter.getBranches();
            return branches.map(branch => ({
                name: branch.name,
                isDefault: branch.isDefault || branch.name === 'main',
                isProtected: branch.protected || false,
                ahead: branch.ahead || 0,
                behind: branch.behind || 0,
                lastCommit: branch.lastCommit || null
            }));
        } catch (error) {
            console.error('Error getting branches:', error);
            return this.getPlaceholderBranches();
        }
    }

    /**
     * Get placeholder branches when Git integration is not available
     * @returns {Array} Placeholder branches
     */
    getPlaceholderBranches() {
        return [
            {
                name: 'main',
                isDefault: true,
                isProtected: true,
                ahead: 0,
                behind: 0,
                lastCommit: {
                    hash: 'abc1234',
                    message: 'Latest commit',
                    author: 'Trevor',
                    date: new Date().toISOString()
                }
            },
            {
                name: 'develop',
                isDefault: false,
                isProtected: false,
                ahead: 5,
                behind: 0,
                lastCommit: {
                    hash: 'def5678',
                    message: 'Feature development',
                    author: 'Trevor',
                    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
                }
            },
            {
                name: 'feature/dashboard-update',
                isDefault: false,
                isProtected: false,
                ahead: 0,
                behind: 2,
                lastCommit: {
                    hash: 'ghi9012',
                    message: 'Update dashboard UI',
                    author: 'Trevor',
                    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                }
            }
        ];
    }

    /**
     * Get repository overview
     * @returns {Promise<Object>} Repository overview
     */
    async getRepositoryOverview() {
        if (!this.isInitialized) {
            return this.getPlaceholderRepository();
        }

        try {
            const overview = await this.gitExporter.getRepositoryOverview();
            return overview;
        } catch (error) {
            console.error('Error getting repository overview:', error);
            return this.getPlaceholderRepository();
        }
    }

    /**
     * Get placeholder repository information
     * @returns {Object} Placeholder repository
     */
    getPlaceholderRepository() {
        return {
            name: 'AI Coding Intelligence Dashboard',
            description: 'Comprehensive code analysis and technical debt dashboard',
            provider: 'local',
            path: this.currentRepo?.path || './',
            defaultBranch: 'main',
            totalBranches: 3,
            totalCommits: 47,
            totalContributors: 3,
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastActivity: new Date().toISOString(),
            languages: ['JavaScript', 'HTML', 'CSS', 'JSON'],
            size: '2.5 MB'
        };
    }

    /**
     * Format commit date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (60 * 1000));
                return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
            }
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else if (diffDays < 30) {
            return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Format file changes for display
     * @param {Object} changes - Changes object
     * @returns {string} Formatted changes
     */
    formatChanges(changes) {
        const parts = [];
        
        if (changes.additions > 0) {
            parts.push(`+${changes.additions}`);
        }
        
        if (changes.deletions > 0) {
            parts.push(`-${changes.deletions}`);
        }
        
        if (changes.files > 0) {
            parts.push(`${changes.files} file${changes.files !== 1 ? 's' : ''}`);
        }
        
        return parts.join(' ');
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.GitIntegration = GitIntegration;
}
