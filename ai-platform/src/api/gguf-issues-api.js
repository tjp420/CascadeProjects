/**
 * GGUF Issues API
 * Enhanced API endpoints for automated issue detection and resolution
 */

const express = require('express');
const GGUFIssueAnalyzer = require('../../core/engines/issue-analyzer');
const GGUFFixEngine = require('../../core/engines/fix-engine');
const path = require('path');

class GGUFIssuesAPI {
    constructor(app, options = {}) {
        this.app = app;
        this.options = options;
        
        // Initialize core components
        this.issueAnalyzer = new GGUFIssueAnalyzer({
            watchDirectories: options.watchDirectories || ['data/mock', 'src/data'],
            enableRealTime: options.enableRealTime !== false,
            enableAI: options.enableAI !== false
        });
        
        this.fixEngine = new GGUFFixEngine({
            enableBackups: options.enableBackups !== false,
            enableValidation: options.enableValidation !== false,
            enableAI: options.enableAI !== false
        });

        this.setupRoutes();
        console.log('🔧 GGUF Issues API initialized');
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        const router = express.Router();

        // Issue Detection Routes
        router.get('/scan', this.scanForIssues.bind(this));
        router.post('/detect', this.detectIssues.bind(this));
        router.get('/patterns', this.getIssuePatterns.bind(this));
        router.get('/history', this.getIssueHistory.bind(this));
        router.get('/stats', this.getIssueStats.bind(this));

        // Issue Management Routes
        router.get('/', this.getIssues.bind(this));
        router.get('/:id', this.getIssue.bind(this));
        router.patch('/:id/status', this.updateIssueStatus.bind(this));

        // Fix Management Routes
        router.post('/fix/preview', this.previewFix.bind(this));
        router.post('/fix/apply', this.applyFix.bind(this));
        router.post('/fix/batch', this.applyBatchFix.bind(this));
        router.post('/fix/rollback/:fixId', this.rollbackFix.bind(this));
        router.get('/fix/history', this.getFixHistory.bind(this));
        router.get('/fix/stats', this.getFixStats.bind(this));

        // Queue Management Routes
        router.get('/queue', this.getProcessingQueue.bind(this));
        router.post('/queue/prioritize', this.prioritizeIssues.bind(this));

        // Analytics Routes
        router.get('/analytics', this.getIssueAnalytics.bind(this));
        router.get('/analytics/trends', this.getIssueTrends.bind(this));
        router.get('/analytics/performance', this.getFixPerformance.bind(this));

        // Use the router
        this.app.use('/api/gguf/issues', router);
    }

    /**
     * Scan for issues in specified directories
     */
    async scanForIssues(req, res) {
        try {
            const { directories, patterns, includeSubdirs } = req.query;
            
            console.log('🔍 Starting issue scan...');
            
            // Determine files to scan
            let scanPaths = [];
            if (directories) {
                scanPaths = directories.split(',').map(dir => dir.trim());
            } else {
                // Use default directories
                scanPaths = this.issueAnalyzer.options.watchDirectories;
            }

            // Find files matching patterns
            const filePaths = await this.findFiles(scanPaths, patterns, includeSubdirs === 'true');
            
            // Analyze files
            const results = await this.issueAnalyzer.analyzeFiles(filePaths);
            
            res.json({
                success: true,
                scanId: `scan_${Date.now()}`,
                scannedFiles: filePaths.length,
                issuesFound: results.issues.length,
                scanDuration: this.issueAnalyzer.stats.scanDuration,
                results,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Issue scan failed:', error);
            res.status(500).json({
                success: false,
                error: 'Issue scan failed',
                message: error.message
            });
        }
    }

    /**
     * Detect issues in specific files
     */
    async detectIssues(req, res) {
        try {
            const { files, options } = req.body;
            
            if (!files || !Array.isArray(files)) {
                return res.status(400).json({
                    success: false,
                    error: 'Files array is required'
                });
            }

            console.log(`🔍 Detecting issues in ${files.length} files...`);
            
            const results = await this.issueAnalyzer.analyzeFiles(files);
            
            res.json({
                success: true,
                results,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Issue detection failed:', error);
            res.status(500).json({
                success: false,
                error: 'Issue detection failed',
                message: error.message
            });
        }
    }

    /**
     * Get issue patterns
     */
    async getIssuePatterns(req, res) {
        try {
            const stats = this.issueAnalyzer.getStats();
            const fixStats = this.fixEngine.getFixStats();
            
            res.json({
                success: true,
                patterns: {
                    detection: {
                        totalFilesScanned: stats.filesAnalyzed,
                        totalIssuesDetected: stats.issuesDetected,
                        filesInHistory: stats.filesInHistory,
                        isWatching: stats.isWatching
                    },
                    fixing: {
                        totalFixesApplied: fixStats.totalFixes,
                        successRate: fixStats.successfulFixes / fixStats.totalFixes,
                        averageDuration: fixStats.averageDuration,
                        rolledBackFixes: fixStats.rolledBackFixes
                    },
                    strategies: fixStats.strategies
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Pattern retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Pattern retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get issue history
     */
    async getIssueHistory(req, res) {
        try {
            const { filePath, dateFrom, dateTo, limit } = req.query;
            
            // Get fix history with filters
            const history = this.fixEngine.getFixHistory({
                filePath,
                dateFrom,
                dateTo
            });

            // Apply limit if specified
            const limitedHistory = limit ? history.slice(0, parseInt(limit)) : history;

            res.json({
                success: true,
                history: limitedHistory,
                total: history.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ History retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'History retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get issue statistics
     */
    async getIssueStats(req, res) {
        try {
            const analyzerStats = this.issueAnalyzer.getStats();
            const fixStats = this.fixEngine.getFixStats();
            
            res.json({
                success: true,
                analyzer: analyzerStats,
                fixer: fixStats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Stats retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Stats retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get all issues
     */
    async getIssues(req, res) {
        try {
            const { severity, type, status, search, limit, offset } = req.query;
            
            // Get current issues from analyzer
            // This would typically come from the analyzer's current state
            const issues = this.getCurrentIssues();
            
            // Apply filters
            let filteredIssues = issues;
            
            if (severity) {
                filteredIssues = filteredIssues.filter(issue => issue.severity === severity);
            }
            
            if (type) {
                filteredIssues = filteredIssues.filter(issue => issue.type === type);
            }
            
            if (status) {
                filteredIssues = filteredIssues.filter(issue => issue.status === status);
            }
            
            if (search) {
                const searchLower = search.toLowerCase();
                filteredIssues = filteredIssues.filter(issue => 
                    issue.message.toLowerCase().includes(searchLower) ||
                    issue.filePath.toLowerCase().includes(searchLower)
                );
            }
            
            // Apply pagination
            const startIndex = offset ? parseInt(offset) : 0;
            const endIndex = limit ? startIndex + parseInt(limit) : filteredIssues.length;
            const paginatedIssues = filteredIssues.slice(startIndex, endIndex);
            
            res.json({
                success: true,
                issues: paginatedIssues,
                total: filteredIssues.length,
                offset: startIndex,
                limit: limit ? parseInt(limit) : null,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Issues retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Issues retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get specific issue
     */
    async getIssue(req, res) {
        try {
            const { id } = req.params;
            
            const issues = this.getCurrentIssues();
            const issue = issues.find(i => i.id === id);
            
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: 'Issue not found',
                    message: `Issue with ID ${id} not found`
                });
            }
            
            res.json({
                success: true,
                issue,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Issue retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Issue retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Update issue status
     */
    async updateIssueStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;
            
            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }
            
            console.log(`📝 Updating issue ${id} status to: ${status}`);
            
            // This would update the issue in the data store
            // For now, we'll just acknowledge the update
            res.json({
                success: true,
                message: `Issue ${id} status updated to ${status}`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Issue status update failed:', error);
            res.status(500).json({
                success: false,
                error: 'Issue status update failed',
                message: error.message
            });
        }
    }

    /**
     * Preview fix for an issue
     */
    async previewFix(req, res) {
        try {
            const { issue, strategyId, options } = req.body;
            
            if (!issue || !strategyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Issue and strategyId are required'
                });
            }
            
            console.log(`👁️ Previewing fix for issue ${issue.id} with strategy ${strategyId}`);
            
            const preview = await this.fixEngine.previewFix(issue, strategyId, options);
            
            res.json({
                success: true,
                preview,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Fix preview failed:', error);
            res.status(500).json({
                success: false,
                error: 'Fix preview failed',
                message: error.message
            });
        }
    }

    /**
     * Apply fix to an issue
     */
    async applyFix(req, res) {
        try {
            const { issue, strategyId, options } = req.body;
            
            if (!issue || !strategyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Issue and strategyId are required'
                });
            }
            
            console.log(`🔧 Applying fix for issue ${issue.id} with strategy ${strategyId}`);
            
            const result = await this.fixEngine.applyFix(issue, strategyId, options);
            
            res.json({
                success: true,
                result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Fix application failed:', error);
            res.status(500).json({
                success: false,
                error: 'Fix application failed',
                message: error.message
            });
        }
    }

    /**
     * Apply batch fixes
     */
    async applyBatchFix(req, res) {
        try {
            const { issues, strategyId, options } = req.body;
            
            if (!issues || !Array.isArray(issues) || !strategyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Issues array and strategyId are required'
                });
            }
            
            console.log(`🔄 Applying batch fix for ${issues.length} issues with strategy ${strategyId}`);
            
            const result = await this.fixEngine.applyBatchFixes(issues, strategyId, options);
            
            res.json({
                success: true,
                result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Batch fix failed:', error);
            res.status(500).json({
                success: false,
                error: 'Batch fix failed',
                message: error.message
            });
        }
    }

    /**
     * Rollback a fix
     */
    async rollbackFix(req, res) {
        try {
            const { fixId } = req.params;
            
            console.log(`🔄 Rolling back fix ${fixId}`);
            
            const result = await this.fixEngine.rollbackFix(fixId);
            
            res.json({
                success: true,
                result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Fix rollback failed:', error);
            res.status(500).json({
                success: false,
                error: 'Fix rollback failed',
                message: error.message
            });
        }
    }

    /**
     * Get fix history
     */
    async getFixHistory(req, res) {
        try {
            const { filePath, strategyId, dateFrom, dateTo, limit } = req.query;
            
            const history = this.fixEngine.getFixHistory({
                filePath,
                strategyId,
                dateFrom,
                dateTo
            });

            const limitedHistory = limit ? history.slice(0, parseInt(limit)) : history;

            res.json({
                success: true,
                history: limitedHistory,
                total: history.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Fix history retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Fix history retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get fix statistics
     */
    async getFixStats(req, res) {
        try {
            const stats = this.fixEngine.getFixStats();
            
            res.json({
                success: true,
                stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Fix stats retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Fix stats retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get processing queue
     */
    async getProcessingQueue(req, res) {
        try {
            // This would return the current processing queue
            // For now, we'll return a mock queue
            const queue = {
                pending: [],
                processing: [],
                completed: [],
                failed: []
            };
            
            res.json({
                success: true,
                queue,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Queue retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Queue retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Prioritize issues
     */
    async prioritizeIssues(req, res) {
        try {
            const { issueIds, priority } = req.body;
            
            if (!issueIds || !Array.isArray(issueIds) || !priority) {
                return res.status(400).json({
                    success: false,
                    error: 'Issue IDs array and priority are required'
                });
            }
            
            console.log(`🎯 Prioritizing ${issueIds.length} issues with priority ${priority}`);
            
            // This would update the priority of issues in the queue
            res.json({
                success: true,
                message: `Prioritized ${issueIds.length} issues`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Issue prioritization failed:', error);
            res.status(500).json({
                success: false,
                error: 'Issue prioritization failed',
                message: error.message
            });
        }
    }

    /**
     * Get issue analytics
     */
    async getIssueAnalytics(req, res) {
        try {
            const { timeRange, groupBy } = req.query;
            
            const analytics = {
                summary: {
                    totalIssues: 0,
                    criticalIssues: 0,
                    highIssues: 0,
                    mediumIssues: 0,
                    lowIssues: 0
                },
                trends: {
                    daily: [],
                    weekly: [],
                    monthly: []
                },
                categories: {},
                topFiles: []
            };
            
            // This would generate real analytics from the data
            res.json({
                success: true,
                analytics,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Analytics retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Analytics retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get issue trends
     */
    async getIssueTrends(req, res) {
        try {
            const { period, startDate, endDate } = req.query;
            
            const trends = {
                period: period || 'daily',
                data: [],
                summary: {
                    total: 0,
                    resolved: 0,
                    new: 0,
                    recurring: 0
                }
            };
            
            // This would generate real trend data
            res.json({
                success: true,
                trends,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Trends retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Trends retrieval failed',
                message: error.message
            });
        }
    }

    /**
     * Get fix performance metrics
     */
    async getFixPerformance(req, res) {
        try {
            const { timeRange, strategyId } = req.query;
            
            const performance = {
                overall: {
                    successRate: 0,
                    averageDuration: 0,
                    totalFixes: 0
                },
                byStrategy: {},
                byTimeRange: {},
                efficiency: {
                    fixesPerHour: 0,
                    issuesPerFix: 0,
                    rollbackRate: 0
                }
            };
            
            // This would generate real performance metrics
            res.json({
                success: true,
                performance,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Performance retrieval failed:', error);
            res.status(500).json({
                success: false,
                error: 'Performance retrieval failed',
                message: error.message
            });
        }
    }

    // Helper Methods

    /**
     * Find files matching patterns
     */
    async findFiles(directories, patterns, includeSubdirs) {
        const fs = require('fs').promises;
        const path = require('path');
        
        const files = [];
        
        for (const dir of directories) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isFile() && this.matchesPattern(entry.name, patterns)) {
                        files.push(fullPath);
                    } else if (entry.isDirectory() && includeSubdirs) {
                        // Recursively scan subdirectories
                        const subFiles = await this.findFiles([fullPath], patterns, includeSubdirs);
                        files.push(...subFiles);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not scan directory ${dir}:`, error.message);
            }
        }
        
        return files;
    }

    /**
     * Check if filename matches patterns
     */
    matchesPattern(filename, patterns) {
        if (!patterns) return true;
        
        const patternList = patterns.split(',').map(p => p.trim());
        return patternList.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(filename);
        });
    }

    /**
     * Get current issues (mock implementation)
     */
    getCurrentIssues() {
        // This would typically come from the analyzer's current state
        // For now, return empty array
        return [];
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.issueAnalyzer.cleanup();
        await this.fixEngine.cleanup();
        console.log('🧹 GGUF Issues API cleaned up');
    }
}

module.exports = GGUFIssuesAPI;
