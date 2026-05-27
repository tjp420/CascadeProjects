/**
 * Git API Integration Module
 * Provides unified API interface for Git history export functionality
 * Integrates with the existing API client and extends it with Git-specific endpoints
 */

class GitAPIIntegration {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.endpoints = {
            // Git repository endpoints
            REPOSITORIES: '/api/git/repositories',
            COMMITS: '/api/git/commits',
            BRANCHES: '/api/git/branches',
            CONTRIBUTORS: '/api/git/contributors',
            METRICS: '/api/git/metrics',
            EXPORT: '/api/git/export',
            
            // Analysis endpoints
            ANALYZE: '/api/git/analyze',
            INSIGHTS: '/api/git/insights',
            HEALTH: '/api/git/health'
        };
    }

    /**
     * Get repository information
     * @param {string} repoPath - Repository path or identifier
     * @returns {Promise<Object>} Repository metadata
     */
    async getRepository(repoPath) {
        try {
            return await this.apiClient.request(this.endpoints.REPOSITORIES, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    include_stats: true
                })
            });
        } catch (error) {
            console.error('Failed to get repository info:', error);
            throw new Error(`Unable to access repository: ${error.message}`);
        }
    }

    /**
     * Get commit history with filtering options
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of commits
     */
    async getCommits(options = {}) {
        const {
            repoPath,
            branch = 'main',
            since = null,
            until = null,
            limit = 100,
            includeStats = true,
            includeFiles = false
        } = options;

        try {
            const params = new URLSearchParams({
                repo_path: repoPath,
                branch,
                limit: limit.toString(),
                include_stats: includeStats.toString(),
                include_files: includeFiles.toString()
            });

            if (since) {
                params.append('since', since);
            }
            if (until) {
                params.append('until', until);
            }

            const response = await this.apiClient.request(
                `${this.endpoints.COMMITS}?${params.toString()}`
            );

            return response.commits || [];
        } catch (error) {
            console.error('Failed to get commits:', error);
            throw new Error(`Unable to fetch commits: ${error.message}`);
        }
    }

    /**
     * Get branch information
     * @param {string} repoPath - Repository path
     * @returns {Promise<Array>} Array of branch information
     */
    async getBranches(repoPath) {
        try {
            return await this.apiClient.request(this.endpoints.BRANCHES, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    include_ahead_behind: true
                })
            });
        } catch (error) {
            console.error('Failed to get branches:', error);
            throw new Error(`Unable to fetch branches: ${error.message}`);
        }
    }

    /**
     * Get contributor statistics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Contributor analysis
     */
    async getContributors(options = {}) {
        const {
            repoPath,
            branch = 'main',
            since = null,
            until = null,
            includeDetails = true
        } = options;

        try {
            return await this.apiClient.request(this.endpoints.CONTRIBUTORS, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    since,
                    until,
                    include_details: includeDetails
                })
            });
        } catch (error) {
            console.error('Failed to get contributors:', error);
            throw new Error(`Unable to fetch contributors: ${error.message}`);
        }
    }

    /**
     * Get comprehensive development metrics
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Development metrics
     */
    async getMetrics(options = {}) {
        const {
            repoPath,
            branch = 'main',
            since = null,
            until = null,
            includeInsights = true
        } = options;

        try {
            return await this.apiClient.request(this.endpoints.METRICS, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    since,
                    until,
                    include_insights: includeInsights
                })
            });
        } catch (error) {
            console.error('Failed to get metrics:', error);
            throw new Error(`Unable to fetch metrics: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive history report
     * @param {Object} options - Report generation options
     * @returns {Promise<Object>} Complete history report
     */
    async generateReport(options = {}) {
        const {
            repoPath,
            branch = 'main',
            since = null,
            until = null,
            format = 'json',
            includeInsights = true,
            includeRecommendations = true
        } = options;

        try {
            return await this.apiClient.request(this.endpoints.EXPORT, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    since,
                    until,
                    format,
                    include_insights: includeInsights,
                    include_recommendations: includeRecommendations
                })
            });
        } catch (error) {
            console.error('Failed to generate report:', error);
            throw new Error(`Unable to generate report: ${error.message}`);
        }
    }

    /**
     * Analyze repository and provide insights
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeRepository(options = {}) {
        const {
            repoPath,
            branch = 'main',
            analysisType = 'comprehensive',
            includeMetrics = true,
            includePatterns = true,
            includeRisks = true
        } = options;

        try {
            return await this.apiClient.request(this.endpoints.ANALYZE, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    analysis_type: analysisType,
                    include_metrics: includeMetrics,
                    include_patterns: includePatterns,
                    include_risks: includeRisks
                })
            });
        } catch (error) {
            console.error('Failed to analyze repository:', error);
            throw new Error(`Unable to analyze repository: ${error.message}`);
        }
    }

    /**
     * Get repository health score and insights
     * @param {string} repoPath - Repository path
     * @returns {Promise<Object>} Health assessment
     */
    async getHealthAssessment(repoPath) {
        try {
            return await this.apiClient.request(this.endpoints.HEALTH, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath
                })
            });
        } catch (error) {
            console.error('Failed to get health assessment:', error);
            throw new Error(`Unable to assess repository health: ${error.message}`);
        }
    }

    /**
     * Get AI-powered insights and recommendations
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} AI insights
     */
    async getInsights(options = {}) {
        const {
            repoPath,
            insightTypes = ['patterns', 'risks', 'recommendations', 'achievements'],
            timeframe = 'last-year'
        } = options;

        try {
            return await this.apiClient.request(this.endpoints.INSIGHTS, {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    insight_types: insightTypes,
                    timeframe
                })
            });
        } catch (error) {
            console.error('Failed to get insights:', error);
            throw new Error(`Unable to generate insights: ${error.message}`);
        }
    }

    /**
     * Batch export multiple repositories
     * @param {Array} repositories - Array of repository configurations
     * @param {Object} options - Export options
     * @returns {Promise<Array>} Array of reports
     */
    async batchExport(repositories, options = {}) {
        const {
            format = 'json',
            parallel = true,
            includeInsights = true
        } = options;

        try {
            if (parallel) {
                // Export in parallel
                const promises = repositories.map(repo => 
                    this.generateReport({
                        repoPath: repo.path,
                        branch: repo.branch || 'main',
                        since: repo.since,
                        until: repo.until,
                        format,
                        includeInsights
                    })
                );
                
                return await Promise.all(promises);
            } else {
                // Export sequentially
                const results = [];
                for (const repo of repositories) {
                    const report = await this.generateReport({
                        repoPath: repo.path,
                        branch: repo.branch || 'main',
                        since: repo.since,
                        until: repo.until,
                        format,
                        includeInsights
                    });
                    results.push(report);
                }
                return results;
            }
        } catch (error) {
            console.error('Batch export failed:', error);
            throw new Error(`Batch export failed: ${error.message}`);
        }
    }

    /**
     * Validate repository access and permissions
     * @param {string} repoPath - Repository path
     * @returns {Promise<Object>} Validation result
     */
    async validateRepository(repoPath) {
        try {
            const result = await this.apiClient.request('/api/git/validate', {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath
                })
            });

            return {
                valid: true,
                permissions: result.permissions,
                accessible: true,
                error: null
            };
        } catch (error) {
            return {
                valid: false,
                permissions: null,
                accessible: false,
                error: error.message
            };
        }
    }

    /**
     * Get repository activity summary
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Activity summary
     */
    async getActivitySummary(options = {}) {
        const {
            repoPath,
            branch = 'main',
            period = 'last-30-days'
        } = options;

        try {
            return await this.apiClient.request('/api/git/activity-summary', {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    period
                })
            });
        } catch (error) {
            console.error('Failed to get activity summary:', error);
            throw new Error(`Unable to fetch activity summary: ${error.message}`);
        }
    }

    /**
     * Compare two branches or time periods
     * @param {Object} options - Comparison options
     * @returns {Promise<Object>} Comparison results
     */
    async compare(options = {}) {
        const {
            repoPath,
            branch1,
            branch2,
            period1,
            period2,
            metrics = ['commits', 'contributors', 'changes']
        } = options;

        try {
            return await this.apiClient.request('/api/git/compare', {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch1,
                    branch2,
                    period1,
                    period2,
                    metrics
                })
            });
        } catch (error) {
            console.error('Comparison failed:', error);
            throw new Error(`Unable to perform comparison: ${error.message}`);
        }
    }

    /**
     * Get repository trends over time
     * @param {Object} options - Trend analysis options
     * @returns {Promise<Object>} Trend data
     */
    async getTrends(options = {}) {
        const {
            repoPath,
            branch = 'main',
            period = 'last-year',
            granularity = 'month',
            metrics = ['commits', 'contributors', 'changes']
        } = options;

        try {
            return await this.apiClient.request('/api/git/trends', {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    period,
                    granularity,
                    metrics
                })
            });
        } catch (error) {
            console.error('Failed to get trends:', error);
            throw new Error(`Unable to fetch trends: ${error.message}`);
        }
    }

    /**
     * Search commits by message, author, or file
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching commits
     */
    async searchCommits(options = {}) {
        const {
            repoPath,
            query,
            author = null,
            file = null,
            since = null,
            until = null,
            limit = 50
        } = options;

        try {
            return await this.apiClient.request('/api/git/search', {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    query,
                    author,
                    file,
                    since,
                    until,
                    limit
                })
            });
        } catch (error) {
            console.error('Search failed:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Get file change statistics
     * @param {Object} options - File analysis options
     * @returns {Promise<Object>} File statistics
     */
    async getFileStatistics(options = {}) {
        const {
            repoPath,
            branch = 'main',
            since = null,
            until = null,
            includeAuthors = true,
            includeTimeline = true
        } = options;

        try {
            return await this.apiClient.request('/api/git/file-stats', {
                method: 'POST',
                body: JSON.stringify({
                    repo_path: repoPath,
                    branch,
                    since,
                    until,
                    include_authors: includeAuthors,
                    include_timeline: includeTimeline
                })
            });
        } catch (error) {
            console.error('Failed to get file statistics:', error);
            throw new Error(`Unable to fetch file statistics: ${error.message}`);
        }
    }

    /**
     * Create a comprehensive report combining multiple data sources
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Comprehensive report
     */
    async createComprehensiveReport(options = {}) {
        const {
            repoPath,
            branch = 'main',
            since = null,
            until = null,
            includeSections = [
                'overview',
                'timeline',
                'contributors',
                'metrics',
                'insights',
                'health',
                'trends'
            ]
        } = options;

        try {
            // Fetch all required data in parallel
            const promises = [];

            if (includeSections.includes('overview')) {
                promises.push(this.getRepository(repoPath));
            }

            if (includeSections.includes('timeline')) {
                promises.push(this.getCommits({ repoPath, branch, since, until }));
            }

            if (includeSections.includes('contributors')) {
                promises.push(this.getContributors({ repoPath, branch, since, until }));
            }

            if (includeSections.includes('metrics')) {
                promises.push(this.getMetrics({ repoPath, branch, since, until }));
            }

            if (includeSections.includes('insights')) {
                promises.push(this.getInsights({ repoPath }));
            }

            if (includeSections.includes('health')) {
                promises.push(this.getHealthAssessment(repoPath));
            }

            if (includeSections.includes('trends')) {
                promises.push(this.getTrends({ repoPath, branch, period: 'last-year' }));
            }

            const results = await Promise.all(promises);

            // Combine results into comprehensive report
            const report = {
                metadata: {
                    repoPath,
                    branch,
                    since,
                    until,
                    generatedAt: new Date().toISOString(),
                    sections: includeSections
                },
                ...this.combineResults(results, includeSections)
            };

            return report;
        } catch (error) {
            console.error('Failed to create comprehensive report:', error);
            throw new Error(`Unable to create comprehensive report: ${error.message}`);
        }
    }

    /**
     * Combine results from multiple API calls
     * @param {Array} results - Array of API results
     * @param {Array} sections - Included sections
     * @returns {Object} Combined results
     */
    combineResults(results, sections) {
        const combined = {};
        let index = 0;

        sections.forEach(section => {
            switch (section) {
            case 'overview':
                combined.overview = results[index++];
                break;
            case 'timeline':
                combined.timeline = results[index++];
                break;
            case 'contributors':
                combined.contributors = results[index++];
                break;
            case 'metrics':
                combined.metrics = results[index++];
                break;
            case 'insights':
                combined.insights = results[index++];
                break;
            case 'health':
                combined.health = results[index++];
                break;
            case 'trends':
                combined.trends = results[index++];
                break;
            }
        });

        return combined;
    }

    /**
     * Export report to different formats
     * @param {Object} report - Report data
     * @param {string} format - Export format
     * @returns {Promise<string|Blob>} Exported data
     */
    async exportReport(report, format = 'json') {
        try {
            return await this.apiClient.request('/api/git/export-format', {
                method: 'POST',
                body: JSON.stringify({
                    report,
                    format
                })
            });
        } catch (error) {
            console.error('Export failed:', error);
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    /**
     * Get supported export formats
     * @returns {Promise<Array>} Supported formats
     */
    async getSupportedFormats() {
        try {
            return await this.apiClient.request('/api/git/export-formats');
        } catch (error) {
            console.error('Failed to get supported formats:', error);
            return ['json', 'csv', 'html'];
        }
    }

    /**
     * Check API status and capabilities
     * @returns {Promise<Object>} API status
     */
    async getStatus() {
        try {
            return await this.apiClient.request('/api/git/status');
        } catch (error) {
            console.error('Failed to get API status:', error);
            return {
                available: false,
                error: error.message,
                capabilities: []
            };
        }
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitAPIIntegration;
} else if (typeof window !== 'undefined') {
    window.GitAPIIntegration = GitAPIIntegration;
}
