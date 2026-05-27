/**
 * Reports API - Comprehensive reporting system for the AI Platform
 * Provides endpoints for generating, viewing, downloading, and scheduling reports
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { spawn } = require('child_process');

class ReportsAPI {
    constructor(app, globalContextManager) {
        this.app = app;
        this.globalContextManager = globalContextManager;
        this.activeReports = new Map();
        this.scheduledReports = new Map();
        this.reportHistory = [];
        this.setupRoutes();
    }

    setupRoutes() {
        // Get all available reports
        this.app.get('/api/reports', (req, res) => {
            try {
                const reports = this.getAvailableReports();
                res.json({
                    success: true,
                    reports: reports,
                    total: reports.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Failed to get reports:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get reports',
                    message: error.message
                });
            }
        });

        // Generate new report
        this.app.post('/api/reports/generate', async (req, res) => {
            try {
                const { reportType, dateRange, format, options = {} } = req.body;
                
                if (!this.isValidReportType(reportType)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid report type',
                        validTypes: this.getValidReportTypes()
                    });
                }

                const reportId = this.generateReportId();
                const reportData = {
                    id: reportId,
                    type: reportType,
                    dateRange: dateRange,
                    format: format || 'pdf',
                    status: 'queued',
                    progress: 0,
                    createdAt: new Date(),
                    options: options,
                    downloadUrl: null,
                    error: null
                };

                this.activeReports.set(reportId, reportData);

                // Start report generation in background
                this.generateReport(reportId).catch(error => {
                    console.error(`Report generation failed for ${reportId}:`, error);
                    reportData.status = 'failed';
                    reportData.error = error.message;
                });

                res.json({
                    success: true,
                    reportId: reportId,
                    status: 'queued',
                    estimatedDuration: this.getEstimatedDuration(reportType, format)
                });

            } catch (error) {
                console.error('Failed to start report generation:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to start report generation',
                    message: error.message
                });
            }
        });

        // Get specific report details
        this.app.get('/api/reports/:id', (req, res) => {
            try {
                const { id } = req.params;
                const report = this.activeReports.get(id);

                if (!report) {
                    return res.status(404).json({
                        success: false,
                        error: 'Report not found'
                    });
                }

                res.json({
                    success: true,
                    report: {
                        id: report.id,
                        type: report.type,
                        status: report.status,
                        progress: report.progress,
                        createdAt: report.createdAt,
                        completedAt: report.completedAt,
                        downloadUrl: report.downloadUrl,
                        error: report.error
                    }
                });

            } catch (error) {
                console.error('Failed to get report details:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get report details',
                    message: error.message
                });
            }
        });

        // Download report file
        this.app.get('/api/reports/:id/download', async (req, res) => {
            try {
                const { id } = req.params;
                const report = this.activeReports.get(id);

                if (!report) {
                    return res.status(404).json({
                        success: false,
                        error: 'Report not found'
                    });
                }

                if (report.status !== 'completed') {
                    return res.status(400).json({
                        success: false,
                        error: 'Report not ready for download',
                        status: report.status
                    });
                }

                const filePath = path.join(__dirname, '../../reports', `${report.id}.${report.format}`);
                
                try {
                    await fs.access(filePath);
                    
                    // Set appropriate headers for file download
                    const fileName = `${report.type.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report_${report.createdAt.toISOString().split('T')[0]}.${report.format}`;
                    
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                    res.setHeader('Content-Type', this.getContentType(report.format));
                    
                    const fileStream = fs.createReadStream(filePath);
                    fileStream.pipe(res);
                    
                } catch (fileError) {
                    res.status(404).json({
                        success: false,
                        error: 'Report file not found'
                    });
                }

            } catch (error) {
                console.error('Failed to download report:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to download report',
                    message: error.message
                });
            }
        });

        // Schedule automated report
        this.app.post('/api/reports/schedule', async (req, res) => {
            try {
                const { reportType, schedule, options = {} } = req.body;
                
                if (!this.isValidReportType(reportType)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid report type',
                        validTypes: this.getValidReportTypes()
                    });
                }

                const scheduleId = this.generateScheduleId();
                const scheduleData = {
                    id: scheduleId,
                    reportType: reportType,
                    schedule: schedule,
                    options: options,
                    status: 'active',
                    createdAt: new Date(),
                    lastRun: null,
                    nextRun: this.calculateNextRun(schedule),
                    error: null
                };

                this.scheduledReports.set(scheduleId, scheduleData);

                res.json({
                    success: true,
                    scheduleId: scheduleId,
                    status: 'scheduled',
                    nextRun: scheduleData.nextRun
                });

            } catch (error) {
                console.error('Failed to schedule report:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to schedule report',
                    message: error.message
                });
            }
        });

        // Get scheduled reports
        this.app.get('/api/reports/scheduled', (req, res) => {
            try {
                const scheduled = Array.from(this.scheduledReports.values())
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                res.json({
                    success: true,
                    scheduled: scheduled,
                    total: scheduled.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Failed to get scheduled reports:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get scheduled reports',
                    message: error.message
                });
            }
        });

        // Delete report
        this.app.delete('/api/reports/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const report = this.activeReports.get(id);

                if (!report) {
                    return res.status(404).json({
                        success: false,
                        error: 'Report not found'
                    });
                }

                // Delete report file if it exists
                if (report.status === 'completed' && report.downloadUrl) {
                    try {
                        const filePath = path.join(__dirname, '../../reports', `${report.id}.${report.format}`);
                        await fs.unlink(filePath);
                    } catch (fileError) {
                        console.warn('Failed to delete report file:', fileError);
                    }
                }

                // Remove from active reports
                this.activeReports.delete(id);

                // Add to history
                this.reportHistory.push({
                    id: report.id,
                    type: report.type,
                    status: 'deleted',
                    deletedAt: new Date()
                });

                res.json({
                    success: true,
                    message: 'Report deleted successfully'
                });

            } catch (error) {
                console.error('Failed to delete report:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete report',
                    message: error.message
                });
            }
        });

        // Get report generation history
        this.app.get('/api/reports/history', (req, res) => {
            try {
                const { limit = 50, type } = req.query;
                let history = [...this.reportHistory];

                // Add completed reports to history
                this.activeReports.forEach(report => {
                    if (report.status === 'completed') {
                        history.push({
                            id: report.id,
                            type: report.type,
                            status: 'completed',
                            completedAt: report.completedAt,
                            downloadUrl: report.downloadUrl
                        });
                    }
                });

                // Filter by type if specified
                if (type) {
                    history = history.filter(item => item.type === type);
                }

                // Sort by completion/deletion date (most recent first)
                history.sort((a, b) => {
                    const dateA = a.completedAt || a.deletedAt || a.createdAt;
                    const dateB = b.completedAt || b.deletedAt || b.createdAt;
                    return new Date(dateB) - new Date(dateA);
                });

                // Limit results
                history = history.slice(0, parseInt(limit));

                res.json({
                    success: true,
                    history: history,
                    total: history.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Failed to get report history:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get report history',
                    message: error.message
                });
            }
        });
    }

    // Helper methods
    generateReportId() {
        return `report_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generateScheduleId() {
        return `schedule_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    isValidReportType(type) {
        return this.getValidReportTypes().includes(type);
    }

    getValidReportTypes() {
        return [
            'performance',
            'user-activity',
            'ai-usage',
            'security',
            'financial',
            'health'
        ];
    }

    getAvailableReports() {
        const reportTypes = this.getValidReportTypes();
        
        return reportTypes.map(type => ({
            id: type,
            name: this.getReportName(type),
            description: this.getReportDescription(type),
            type: type,
            category: this.getReportCategory(type),
            availableFormats: this.getAvailableFormats(type),
            schedulingSupported: true,
            estimatedDuration: this.getEstimatedDuration(type, 'pdf'),
            icon: this.getReportIcon(type)
        }));
    }

    getReportName(type) {
        const names = {
            'performance': 'Performance Analytics',
            'user-activity': 'User Activity Report',
            'ai-usage': 'AI Model Usage',
            'security': 'Security Audit',
            'financial': 'Financial Summary',
            'health': 'System Health'
        };
        return names[type] || type;
    }

    getReportDescription(type) {
        const descriptions = {
            'performance': 'Comprehensive performance metrics including API response times, system health, and user engagement analytics.',
            'user-activity': 'Detailed user engagement metrics, session analytics, and behavioral patterns across all platform features.',
            'ai-usage': 'AI model utilization statistics, token consumption, cost analysis, and performance benchmarks across all models.',
            'security': 'Security compliance report, vulnerability assessments, access logs, and threat detection analytics for platform security.',
            'financial': 'Revenue analytics, cost breakdown, subscription metrics, and financial performance indicators for business intelligence.',
            'health': 'System resource monitoring, uptime statistics, error rates, and infrastructure health metrics for operational excellence.'
        };
        return descriptions[type] || 'Report description not available.';
    }

    getReportCategory(type) {
        const categories = {
            'performance': 'analytics',
            'user-activity': 'analytics',
            'ai-usage': 'ai',
            'security': 'security',
            'financial': 'business',
            'health': 'system'
        };
        return categories[type] || 'general';
    }

    getAvailableFormats(type) {
        // All reports support these formats by default
        return ['pdf', 'excel', 'csv', 'json'];
    }

    getEstimatedDuration(type, format) {
        const baseDurations = {
            'performance': 5000,
            'user-activity': 8000,
            'ai-usage': 6000,
            'security': 10000,
            'financial': 7000,
            'health': 4000
        };

        const formatMultipliers = {
            'pdf': 1.2,
            'excel': 1.0,
            'csv': 0.8,
            'json': 0.5
        };

        const base = baseDurations[type] || 5000;
        const multiplier = formatMultipliers[format] || 1.0;
        
        return Math.round(base * multiplier);
    }

    getReportIcon(type) {
        const icons = {
            'performance': '📈',
            'user-activity': '👥',
            'ai-usage': '🤖',
            'security': '🔒',
            'financial': '💰',
            'health': '📊'
        };
        return icons[type] || '📄';
    }

    getContentType(format) {
        const contentTypes = {
            'pdf': 'application/pdf',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv',
            'json': 'application/json'
        };
        return contentTypes[format] || 'application/octet-stream';
    }

    calculateNextRun(schedule) {
        const now = new Date();
        const nextRun = new Date(now);

        switch (schedule.frequency) {
            case 'daily':
                nextRun.setDate(now.getDate() + 1);
                nextRun.setHours(schedule.hour || 8, 0, 0, 0);
                break;
            case 'weekly':
                nextRun.setDate(now.getDate() + 7);
                nextRun.setHours(schedule.hour || 9, 0, 0, 0);
                break;
            case 'monthly':
                nextRun.setMonth(now.getMonth() + 1);
                nextRun.setDate(schedule.day || 1);
                nextRun.setHours(schedule.hour || 10, 0, 0, 0);
                break;
            case 'quarterly':
                nextRun.setMonth(now.getMonth() + 3);
                nextRun.setDate(schedule.day || 1);
                nextRun.setHours(schedule.hour || 11, 0, 0, 0);
                break;
            default:
                // Custom schedule - return as is for now
                return schedule.nextRun;
        }

        return nextRun;
    }

    async generateReport(reportId) {
        const report = this.activeReports.get(reportId);
        if (!report) return;

        try {
            report.status = 'generating';
            report.progress = 10;

            // Simulate report generation progress
            const progressInterval = setInterval(() => {
                if (report.progress < 90) {
                    report.progress += Math.random() * 20;
                    if (report.progress > 90) report.progress = 90;
                } else {
                    clearInterval(progressInterval);
                    this.completeReportGeneration(reportId);
                }
            }, 500);

            // In a real implementation, this would:
            // 1. Gather data from various sources
            // 2. Process and aggregate the data
            // 3. Generate the report in the requested format
            // 4. Save the report file
            // 5. Update the report status

        } catch (error) {
            console.error(`Report generation failed for ${reportId}:`, error);
            report.status = 'failed';
            report.error = error.message;
        }
    }

    async completeReportGeneration(reportId) {
        const report = this.activeReports.get(reportId);
        if (!report) return;

        try {
            // Generate mock report data
            const reportData = await this.generateReportData(report.type, report.dateRange, report.options);
            
            // Save report file
            const reportsDir = path.join(__dirname, '../../reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const filePath = path.join(reportsDir, `${reportId}.${report.format}`);
            
            if (report.format === 'json') {
                await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));
            } else {
                // For other formats, create a simple mock file
                await fs.writeFile(filePath, this.generateMockReportContent(report, reportData));
            }

            // Update report status
            report.status = 'completed';
            report.progress = 100;
            report.completedAt = new Date();
            report.downloadUrl = `/api/reports/${reportId}/download`;

            console.log(`✅ Report generated successfully: ${reportId} (${report.type})`);

        } catch (error) {
            console.error(`Failed to complete report generation for ${reportId}:`, error);
            report.status = 'failed';
            report.error = error.message;
        }
    }

    async generateReportData(reportType, dateRange, options) {
        // Generate mock report data based on type
        const mockData = {
            'performance': {
                successRate: 89.3,
                avgResponseTime: 234,
                uptime: 99.9,
                errorRate: 0.2,
                totalRequests: 1245678,
                metrics: {
                    api: { success: 95.2, avgTime: 180 },
                    database: { success: 98.7, avgTime: 45 },
                    cache: { success: 99.9, avgTime: 12 }
                }
            },
            'user-activity': {
                activeUsers: 24500,
                totalSessions: 12300000,
                avgSessionDuration: 1250,
                bounceRate: 23.4,
                topFeatures: ['ai-analysis', 'code-generation', 'mock-data'],
                demographics: {
                    desktop: 67.8,
                    mobile: 28.3,
                    tablet: 3.9
                }
            },
            'ai-usage': {
                totalTokens: 156000000,
                totalCost: 12400,
                models: {
                    'gpt-4': { tokens: 89000000, cost: 8900 },
                    'claude': { tokens: 45000000, cost: 2700 },
                    'local': { tokens: 22000000, cost: 800 }
                },
                efficiency: 94.2,
                avgResponseTime: 1250
            },
            'security': {
                compliance: 98.7,
                vulnerabilities: 3,
                threatsBlocked: 1247,
                accessAttempts: 45678,
                suspiciousActivity: 12
            },
            'financial': {
                revenue: 45200,
                growth: 23.4,
                costs: 12400,
                profit: 32800,
                subscriptions: 892,
                avgRevenuePerUser: 156.7
            },
            'health': {
                uptime: 99.9,
                cpuUsage: 45.2,
                memoryUsage: 67.8,
                diskUsage: 34.1,
                networkLatency: 23,
                errorRate: 0.1
            }
        };

        return mockData[reportType] || { error: 'Report type not supported' };
    }

    generateMockReportContent(report, data) {
        const timestamp = new Date().toISOString();
        const content = `Report: ${report.type.toUpperCase()}\n` +
                       `Generated: ${timestamp}\n` +
                       `Format: ${report.format}\n` +
                       `Date Range: ${report.dateRange || 'Last 30 days'}\n\n` +
                       `Data: ${JSON.stringify(data, null, 2)}`;
        
        return content;
    }
}

module.exports = ReportsAPI;
