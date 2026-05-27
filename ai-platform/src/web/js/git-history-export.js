/**
 * Git History Export Module
 * Provides comprehensive Git repository analysis and reporting capabilities
 * Supports GitHub, GitLab, and local Git repositories
 */

class GitHistoryExporter {
    constructor(config = {}) {
        this.config = {
            provider: config.provider || 'local', // 'github', 'gitlab', 'local'
            repoPath: config.repoPath || './',
            apiToken: config.apiToken || null,
            apiUrl: config.apiUrl || null,
            branch: config.branch || 'main',
            since: config.since || null, // Date or commit hash
            until: config.until || null,  // Date or commit hash
            ...config
        };
        
        this.cache = new Map();
        this.contributors = new Map();
        this.branches = new Map();
        this.commits = [];
    }

    /**
     * Initialize the Git history exporter
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            switch (this.config.provider) {
            case 'github':
                return await this.initializeGitHub();
            case 'gitlab':
                return await this.initializeGitLab();
            case 'local':
                return await this.initializeLocal();
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
            }
        } catch (error) {
            console.error('Failed to initialize Git history exporter:', error);
            return false;
        }
    }

    /**
     * Initialize GitHub integration
     * @returns {Promise<boolean>} Success status
     */
    async initializeGitHub() {
        if (!this.config.apiToken) {
            throw new Error('GitHub API token is required');
        }

        const [owner, repo] = this.extractRepoInfo();
        this.githubApi = {
            baseUrl: 'https://api.github.com',
            owner,
            repo,
            token: this.config.apiToken
        };

        // Test connection
        const response = await this.makeGitHubRequest(`/repos/${owner}/${repo}`);
        return response && response.id;
    }

    /**
     * Initialize GitLab integration
     * @returns {Promise<boolean>} Success status
     */
    async initializeGitLab() {
        if (!this.config.apiToken) {
            throw new Error('GitLab API token is required');
        }

        this.gitlabApi = {
            baseUrl: this.config.apiUrl || 'https://gitlab.com/api/v4',
            token: this.config.apiToken,
            projectId: this.config.repoPath
        };

        // Test connection
        const response = await this.makeGitLabRequest('/projects');
        return Array.isArray(response);
    }

    /**
     * Initialize local Git repository
     * @returns {Promise<boolean>} Success status
     */
    async initializeLocal() {
        try {
            // Check if we're in a browser environment (no Node.js modules)
            if (typeof window !== 'undefined' && typeof require !== 'function') {
                console.warn('Git history export not available in browser environment');
                return false;
            }
            
            // Check if child_process is available (Node.js)
            const { execSync } = require('child_process');
            if (!execSync) {
                console.warn('child_process not available - Git history export disabled');
                return false;
            }
            
            // Check if we're in a git repository
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            
            // Get repository info
            const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
            this.repoInfo = {
                path: this.config.repoPath,
                remoteUrl,
                isLocal: true
            };
            
            return true;
        } catch (error) {
            console.warn('Git history export initialization failed:', error.message);
            // Return false instead of throwing to allow graceful degradation
            return false;
        }
    }

    /**
     * Export comprehensive history report
     * @returns {Promise<Object>} Complete history report
     */
    async exportHistoryReport() {
        try {
            console.log('🔍 Starting Git history export...');
            
            const report = {
                metadata: await this.generateMetadata(),
                timeline: await this.generateCommitTimeline(),
                branches: await this.generateBranchOverview(),
                contributors: await this.generateContributorStats(),
                metrics: await this.generateDevelopmentMetrics(),
                insights: await this.generateInsights(),
                exportTimestamp: new Date().toISOString()
            };

            console.log('✅ Git history export completed');
            return report;
        } catch (error) {
            console.error('❌ Failed to export history report:', error);
            throw error;
        }
    }

    /**
     * Generate repository metadata
     * @returns {Promise<Object>} Repository metadata
     */
    async generateMetadata() {
        switch (this.config.provider) {
        case 'github':
            return await this.getGitHubMetadata();
        case 'gitlab':
            return await this.getGitLabMetadata();
        case 'local':
            return await this.getLocalMetadata();
        default:
            throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    /**
     * Generate commit timeline
     * @returns {Promise<Array>} Array of commits with details
     */
    async generateCommitTimeline() {
        const commits = await this.fetchCommits();
        
        return commits.map(commit => ({
            hash: commit.hash || commit.sha,
            message: commit.message || commit.commit.message,
            author: {
                name: commit.author?.name || commit.commit?.author?.name,
                email: commit.author?.email || commit.commit?.author?.email,
                date: commit.author?.date || commit.commit?.author?.date
            },
            committer: {
                name: commit.committer?.name || commit.commit?.committer?.name,
                email: commit.committer?.email || commit.commit?.committer?.email,
                date: commit.committer?.date || commit.commit?.committer?.date
            },
            stats: commit.stats || {
                additions: 0,
                deletions: 0,
                total: 0
            },
            files: commit.files || [],
            branch: commit.branch || this.config.branch,
            url: commit.html_url || commit.url,
            timestamp: new Date(commit.author?.date || commit.commit?.author?.date).getTime()
        })).sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Generate branch overview
     * @returns {Promise<Object>} Branch information and statistics
     */
    async generateBranchOverview() {
        const branches = await this.fetchBranches();
        
        return {
            total: branches.length,
            default: this.config.branch,
            branches: branches.map(branch => ({
                name: branch.name,
                commit: branch.commit?.sha || branch.commit,
                protected: branch.protected || false,
                default: branch.default || false,
                ahead: branch.ahead || 0,
                behind: branch.behind || 0,
                lastCommit: branch.lastCommit || null,
                author: branch.author || null,
                date: branch.date || null
            }))
        };
    }

    /**
     * Generate contributor statistics
     * @returns {Promise<Object>} Contributor analysis and rankings
     */
    async generateContributorStats() {
        const commits = await this.fetchCommits();
        const contributors = new Map();

        // Aggregate contributor data
        commits.forEach(commit => {
            const authorEmail = commit.author?.email || commit.commit?.author?.email;
            const authorName = commit.author?.name || commit.commit?.author?.name;
            
            if (!contributors.has(authorEmail)) {
                contributors.set(authorEmail, {
                    name: authorName,
                    email: authorEmail,
                    commits: 0,
                    additions: 0,
                    deletions: 0,
                    firstCommit: commit.author?.date || commit.commit?.author?.date,
                    lastCommit: commit.author?.date || commit.commit?.author?.date,
                    files: new Set(),
                    languages: new Set(),
                    daysActive: new Set()
                });
            }

            const contributor = contributors.get(authorEmail);
            contributor.commits++;
            contributor.additions += commit.stats?.additions || 0;
            contributor.deletions += commit.stats?.deletions || 0;
            
            // Update first/last commit dates
            const commitDate = commit.author?.date || commit.commit?.author?.date;
            if (new Date(commitDate) < new Date(contributor.firstCommit)) {
                contributor.firstCommit = commitDate;
            }
            if (new Date(commitDate) > new Date(contributor.lastCommit)) {
                contributor.lastCommit = commitDate;
            }

            // Track active days
            const day = commitDate.split('T')[0];
            contributor.daysActive.add(day);

            // Track files and languages
            if (commit.files) {
                commit.files.forEach(file => {
                    contributor.files.add(file.filename);
                    const ext = file.filename.split('.').pop();
                    if (ext) {
                        contributor.languages.add(ext);
                    }
                });
            }
        });

        // Convert to array and calculate additional metrics
        const contributorArray = Array.from(contributors.values()).map(contributor => ({
            ...contributor,
            files: contributor.files.size,
            languages: Array.from(contributor.languages),
            daysActive: contributor.daysActive.size,
            avgCommitsPerDay: contributor.commits / contributor.daysActive.size,
            totalChanges: contributor.additions + contributor.deletions,
            netChange: contributor.additions - contributor.deletions
        }));

        // Sort by contributions
        contributorArray.sort((a, b) => b.commits - a.commits);

        return {
            total: contributorArray.length,
            contributors: contributorArray,
            topContributors: contributorArray.slice(0, 10),
            summary: this.calculateContributorSummary(contributorArray)
        };
    }

    /**
     * Generate development metrics
     * @returns {Promise<Object>} Development activity and quality metrics
     */
    async generateDevelopmentMetrics() {
        const commits = await this.fetchCommits();
        const timeline = await this.generateCommitTimeline();
        
        return {
            overview: {
                totalCommits: commits.length,
                totalContributors: new Set(commits.map(c => c.author?.email || c.commit?.author?.email)).size,
                dateRange: {
                    first: timeline[timeline.length - 1]?.author?.date,
                    last: timeline[0]?.author?.date
                },
                activeDays: new Set(timeline.map(c => c.author?.date?.split('T')[0])).size
            },
            activity: {
                commitsByMonth: this.groupCommitsByMonth(timeline),
                commitsByDay: this.groupCommitsByDay(timeline),
                commitsByHour: this.groupCommitsByHour(timeline),
                commitsByWeekday: this.groupCommitsByWeekday(timeline)
            },
            codeQuality: {
                avgCommitsPerDay: commits.length / new Set(timeline.map(c => c.author?.date?.split('T')[0])).size,
                avgFilesPerCommit: this.calculateAvgFilesPerCommit(commits),
                avgChangesPerCommit: this.calculateAvgChangesPerCommit(commits),
                mergeRate: this.calculateMergeRate(commits)
            },
            trends: {
                growthRate: this.calculateGrowthRate(timeline),
                activityTrend: this.calculateActivityTrend(timeline),
                contributorTrend: this.calculateContributorTrend(timeline)
            }
        };
    }

    /**
     * Generate insights and recommendations
     * @returns {Promise<Object>} AI-powered insights and recommendations
     */
    async generateInsights() {
        const metrics = await this.generateDevelopmentMetrics();
        const contributors = await this.generateContributorStats();
        
        return {
            healthScore: this.calculateHealthScore(metrics, contributors),
            patterns: this.identifyPatterns(metrics),
            recommendations: this.generateRecommendations(metrics, contributors),
            risks: this.identifyRisks(metrics, contributors),
            achievements: this.identifyAchievements(metrics, contributors)
        };
    }

    /**
     * Fetch commits from the Git provider
     * @returns {Promise<Array>} Array of commit objects
     */
    async fetchCommits() {
        switch (this.config.provider) {
        case 'github':
            return await this.fetchGitHubCommits();
        case 'gitlab':
            return await this.fetchGitLabCommits();
        case 'local':
            return await this.fetchLocalCommits();
        default:
            throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    /**
     * Fetch commits from GitHub API
     * @returns {Promise<Array>} Array of GitHub commits
     */
    async fetchGitHubCommits() {
        const commits = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const url = `/repos/${this.githubApi.owner}/${this.githubApi.repo}/commits`;
            const params = new URLSearchParams({
                sha: this.config.branch,
                per_page: 100,
                page: page
            });

            if (this.config.since) {
                params.append('since', this.config.since);
            }
            if (this.config.until) {
                params.append('until', this.config.until);
            }

            const response = await this.makeGitHubRequest(`${url}?${params}`);
            
            if (response.length === 0) {
                hasMore = false;
            } else {
                commits.push(...response);
                page++;
                
                // Prevent infinite loops
                if (page > 1000) {
                    hasMore = false;
                }
            }
        }

        return commits;
    }

    /**
     * Fetch commits from local Git repository
     * @returns {Promise<Array>} Array of local commits
     */
    async fetchLocalCommits() {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined' && typeof require !== 'function') {
            console.warn('Git history export not available in browser environment');
            return [];
        }
        
        try {
            const { execSync } = require('child_process');
            if (!execSync) {
                console.warn('child_process not available - Git history export disabled');
                return [];
            }
            
            // Get commit log with statistics
            const logOutput = execSync(`git log --since="${this.config.since || '1 year ago'}" --until="${this.config.until || 'now'}" --pretty=format:"%H|%an|%ae|%ad|%cn|%ce|%cd|%s" --stat --date=iso`, { 
                encoding: 'utf8',
                cwd: this.config.repoPath 
            });

            const commits = [];
            const lines = logOutput.split('\n');
            let currentCommit = null;

            for (const line of lines) {
                if (line.includes('|') && !line.startsWith(' ') && !line.includes('files changed')) {
                    // Parse commit header
                    const parts = line.split('|');
                    if (parts.length >= 7) {
                        currentCommit = {
                            hash: parts[0],
                            author: { name: parts[1], email: parts[2], date: parts[3] },
                            committer: { name: parts[4], email: parts[5], date: parts[6] },
                            message: parts.slice(7).join('|'),
                            stats: { additions: 0, deletions: 0, total: 0 },
                            files: []
                        };
                        commits.push(currentCommit);
                    }
                } else if (currentCommit && line.includes('files changed')) {
                    // Parse statistics line
                    const statsMatch = line.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
                    if (statsMatch) {
                        currentCommit.stats = {
                            additions: parseInt(statsMatch[2]) || 0,
                            deletions: parseInt(statsMatch[3]) || 0,
                            total: parseInt(statsMatch[1]) || 0
                        };
                    }
                }
            }

            return commits;
        } catch (error) {
            console.error('Failed to fetch local commits:', error);
            return [];
        }
    }

    /**
     * Make authenticated request to GitHub API
     * @param {string} endpoint - API endpoint
     * @returns {Promise<Object>} Response data
     */
    async makeGitHubRequest(endpoint) {
        const url = `${this.githubApi.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `token ${this.githubApi.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Coding-Dashboard'
        };

        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Export report to various formats
     * @param {Object} report - The report data
     * @param {string} format - Export format ('json', 'csv', 'html', 'pdf')
     * @returns {Promise<string|Blob>} Exported data
     */
    async exportToFormat(report, format = 'json') {
        switch (format.toLowerCase()) {
        case 'json':
            return JSON.stringify(report, null, 2);
        case 'csv':
            return this.generateCSV(report);
        case 'html':
            return this.generateHTML(report);
        case 'pdf':
            return this.generatePDF(report);
        default:
            throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Generate CSV export
     * @param {Object} report - Report data
     * @returns {string} CSV formatted string
     */
    generateCSV(report) {
        const csv = [];
        
        // Metadata
        csv.push('Repository Analysis Report');
        csv.push(`Generated,${report.exportTimestamp}`);
        csv.push(`Provider,${this.config.provider}`);
        csv.push(`Branch,${this.config.branch}`);
        csv.push('');

        // Commits
        csv.push('Commit Timeline');
        csv.push('Hash,Author,Date,Message,Additions,Deletions');
        
        report.timeline.forEach(commit => {
            csv.push(`"${commit.hash}","${commit.author.name}","${commit.author.date}","${commit.message.replace(/"/g, '""')}","${commit.stats.additions}","${commit.stats.deletions}"`);
        });

        return csv.join('\n');
    }

    /**
     * Generate HTML export
     * @param {Object} report - Report data
     * @returns {string} HTML formatted string
     */
    generateHTML(report) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Git History Report - ${report.metadata.name || 'Repository'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .chart { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Git History Report</h1>
        <p><strong>Repository:</strong> ${report.metadata.name || 'Unknown'}</p>
        <p><strong>Generated:</strong> ${new Date(report.exportTimestamp).toLocaleString()}</p>
        <p><strong>Provider:</strong> ${this.config.provider}</p>
    </div>

    <div class="section">
        <h2>Overview Metrics</h2>
        <div class="metric">Total Commits: ${report.metrics.overview.totalCommits}</div>
        <div class="metric">Contributors: ${report.metrics.overview.totalContributors}</div>
        <div class="metric">Active Days: ${report.metrics.overview.activeDays}</div>
        <div class="metric">Health Score: ${report.insights.healthScore}/100</div>
    </div>

    <div class="section">
        <h2>Top Contributors</h2>
        <table>
            <thead>
                <tr><th>Name</th><th>Commits</th><th>Additions</th><th>Deletions</th></tr>
            </thead>
            <tbody>
                ${report.contributors.topContributors.slice(0, 10).map(c => 
        `<tr><td>${c.name}</td><td>${c.commits}</td><td>${c.additions}</td><td>${c.deletions}</td></tr>`
    ).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Recent Activity</h2>
        <table>
            <thead>
                <tr><th>Date</th><th>Author</th><th>Message</th></tr>
            </thead>
            <tbody>
                ${report.timeline.slice(0, 20).map(c => 
        `<tr><td>${new Date(c.author.date).toLocaleDateString()}</td><td>${c.author.name}</td><td>${c.message.substring(0, 100)}</td></tr>`
    ).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
    }

    // Helper methods for calculations
    calculateContributorSummary(contributors) {
        const totalCommits = contributors.reduce((sum, c) => sum + c.commits, 0);
        const totalAdditions = contributors.reduce((sum, c) => sum + c.additions, 0);
        const totalDeletions = contributors.reduce((sum, c) => sum + c.deletions, 0);
        
        return {
            avgCommitsPerContributor: totalCommits / contributors.length,
            totalAdditions,
            totalDeletions,
            totalChanges: totalAdditions + totalDeletions
        };
    }

    groupCommitsByMonth(timeline) {
        const grouped = {};
        timeline.forEach(commit => {
            const month = commit.author.date.substring(0, 7);
            grouped[month] = (grouped[month] || 0) + 1;
        });
        return grouped;
    }

    groupCommitsByDay(timeline) {
        const grouped = {};
        timeline.forEach(commit => {
            const day = commit.author.date.substring(0, 10);
            grouped[day] = (grouped[day] || 0) + 1;
        });
        return grouped;
    }

    groupCommitsByHour(timeline) {
        const grouped = {};
        timeline.forEach(commit => {
            const hour = new Date(commit.author.date).getHours();
            grouped[hour] = (grouped[hour] || 0) + 1;
        });
        return grouped;
    }

    groupCommitsByWeekday(timeline) {
        const grouped = {};
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        timeline.forEach(commit => {
            const weekday = weekdays[new Date(commit.author.date).getDay()];
            grouped[weekday] = (grouped[weekday] || 0) + 1;
        });
        return grouped;
    }

    calculateAvgFilesPerCommit(commits) {
        const totalFiles = commits.reduce((sum, c) => sum + (c.files?.length || 0), 0);
        return commits.length > 0 ? totalFiles / commits.length : 0;
    }

    calculateAvgChangesPerCommit(commits) {
        const totalChanges = commits.reduce((sum, c) => sum + (c.stats?.total || 0), 0);
        return commits.length > 0 ? totalChanges / commits.length : 0;
    }

    calculateMergeRate(commits) {
        const mergeCommits = commits.filter(c => c.message?.toLowerCase().includes('merge')).length;
        return commits.length > 0 ? (mergeCommits / commits.length) * 100 : 0;
    }

    calculateGrowthRate(timeline) {
        if (timeline.length < 2) {
            return 0;
        }
        
        const firstMonth = new Date(timeline[timeline.length - 1].author.date).getMonth();
        const lastMonth = new Date(timeline[0].author.date).getMonth();
        const monthsDiff = Math.max(1, lastMonth - firstMonth);
        
        return (timeline.length / monthsDiff).toFixed(2);
    }

    calculateActivityTrend(timeline) {
        // Simple trend calculation based on recent vs older commits
        const recent = timeline.slice(0, Math.floor(timeline.length / 2));
        const older = timeline.slice(Math.floor(timeline.length / 2));
        
        return recent.length > older.length ? 'increasing' : 'decreasing';
    }

    calculateContributorTrend(timeline) {
        const contributorsByMonth = {};
        
        timeline.forEach(commit => {
            const month = commit.author.date.substring(0, 7);
            if (!contributorsByMonth[month]) {
                contributorsByMonth[month] = new Set();
            }
            contributorsByMonth[month].add(commit.author.email);
        });

        const months = Object.keys(contributorsByMonth);
        if (months.length < 2) {
            return 'stable';
        }

        const recent = contributorsByMonth[months[months.length - 1]].size;
        const previous = contributorsByMonth[months[months.length - 2]].size;

        return recent > previous ? 'growing' : recent < previous ? 'declining' : 'stable';
    }

    calculateHealthScore(metrics, contributors) {
        let score = 50; // Base score

        // Activity score (0-25 points)
        const avgCommitsPerDay = metrics.overview.totalCommits / metrics.overview.activeDays;
        if (avgCommitsPerDay > 5) {
            score += 15;
        } else if (avgCommitsPerDay > 2) {
            score += 10;
        } else if (avgCommitsPerDay > 1) {
            score += 5;
        }

        // Contributor diversity (0-15 points)
        if (contributors.total > 10) {
            score += 15;
        } else if (contributors.total > 5) {
            score += 10;
        } else if (contributors.total > 2) {
            score += 5;
        }

        // Consistency (0-10 points)
        const trend = metrics.trends.activityTrend;
        if (trend === 'increasing') {
            score += 10;
        } else if (trend === 'stable') {
            score += 5;
        }

        return Math.min(100, Math.max(0, score));
    }

    identifyPatterns(metrics) {
        const patterns = [];
        
        // Identify peak activity times
        const hourlyActivity = metrics.activity.commitsByHour;
        const peakHour = Object.keys(hourlyActivity).reduce((a, b) => 
            hourlyActivity[a] > hourlyActivity[b] ? a : b
        );
        
        if (hourlyActivity[peakHour] > metrics.overview.totalCommits * 0.1) {
            patterns.push(`Peak development activity at ${peakHour}:00`);
        }

        // Identify most active day
        const dailyActivity = metrics.activity.commitsByWeekday;
        const mostActiveDay = Object.keys(dailyActivity).reduce((a, b) => 
            dailyActivity[a] > dailyActivity[b] ? a : b
        );
        
        patterns.push(`Most active on ${mostActiveDay}s`);

        return patterns;
    }

    generateRecommendations(metrics, contributors) {
        const recommendations = [];

        // Activity recommendations
        if (metrics.overview.avgCommitsPerDay < 1) {
            recommendations.push('Consider increasing commit frequency for better project tracking');
        }

        // Contributor recommendations
        if (contributors.total < 3) {
            recommendations.push('Encourage more team members to contribute to distribute workload');
        }

        // Merge rate recommendations
        if (metrics.codeQuality.mergeRate > 30) {
            recommendations.push('High merge rate detected - consider improving code review process');
        }

        return recommendations;
    }

    identifyRisks(metrics, contributors) {
        const risks = [];

        // Single point of failure risk
        if (contributors.topContributors[0]?.commits > metrics.overview.totalCommits * 0.7) {
            risks.push('High dependency on single contributor - consider knowledge sharing');
        }

        // Activity decline risk
        if (metrics.trends.activityTrend === 'decreasing') {
            risks.push('Declining activity trend - may indicate project stagnation');
        }

        return risks;
    }

    identifyAchievements(metrics, contributors) {
        const achievements = [];

        // Milestone achievements
        if (metrics.overview.totalCommits >= 1000) {
            achievements.push('1000+ commits milestone reached!');
        }

        // Team achievements
        if (contributors.total >= 10) {
            achievements.push('Strong team collaboration with 10+ contributors');
        }

        // Consistency achievements
        if (metrics.overview.activeDays >= 300) {
            achievements.push('Consistent development activity throughout the year');
        }

        return achievements;
    }

    extractRepoInfo() {
        // Extract owner/repo from repoPath or URL
        if (this.config.repoPath.includes('/')) {
            const parts = this.config.repoPath.split('/');
            return [parts[parts.length - 2], parts[parts.length - 1]];
        }
        throw new Error('Unable to extract repository owner and name');
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHistoryExporter;
} else if (typeof window !== 'undefined') {
    window.GitHistoryExporter = GitHistoryExporter;
}
