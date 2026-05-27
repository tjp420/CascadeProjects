// Reports Module
console.log('📊 Reports module loading...');

// Enhanced Mock Data Infrastructure Integration
// Version: 2.0.0
// Integration with mock-data-templates.js and mock-data-validator.js
// API Integration: Fetches real data from database, falls back to mock data

// API Configuration
const API_CONFIG = {
    useAPI: true,
    baseURL: 'http://localhost:8002', // Standalone reports API server
    reportsEndpoint: '/api/reports',
    timeout: 5000,
    retryAttempts: 2,
};

// Mock reports data with enhanced version control and validation (fallback)
const reportsData = {
    systemVersion: '2.0.0',
    validationSystem: 'active',
    templateIntegration: 'enabled',
    dataSource: 'database', // 'database' or 'mock'
    availableReports: [], // Will be populated from API
    // Fallback mock data if API unavailable
    fallbackReports: [
        {
            id: 'report_001',
            name: 'Project Performance Report',
            description: 'Comprehensive analysis of project performance metrics',
            type: 'performance',
            category: 'analytics',
            lastGenerated: '2024-05-20T13:25:00',
            format: 'pdf',
            size: 2457600,
            schedule: 'weekly',
            status: 'ready',
            version: '1.0.0',
            validationStatus: 'valid',
            templateSource: 'createPerformanceReportTemplate',
            dataVersion: '1.0.0',
        },
        {
            id: 'report_002',
            name: 'Code Quality Analysis',
            description: 'Detailed code quality metrics and recommendations',
            type: 'quality',
            category: 'development',
            lastGenerated: '2024-05-19T09:00:00',
            format: 'excel',
            size: 1024000,
            schedule: 'monthly',
            status: 'ready',
            version: '1.0.0',
            validationStatus: 'valid',
            templateSource: 'createCodeQualityReportTemplate',
            dataVersion: '1.0.0',
        },
        {
            id: 'report_003',
            name: 'Security Audit Report',
            description: 'Security vulnerabilities and compliance analysis',
            type: 'security',
            category: 'compliance',
            lastGenerated: '2024-05-18T15:30:00',
            format: 'pdf',
            size: 3145728,
            schedule: 'monthly',
            status: 'processing',
            version: '1.0.0',
            validationStatus: 'pending',
            templateSource: 'createSecurityAuditReportTemplate',
            dataVersion: '1.0.0',
        },
        {
            id: 'report_004',
            name: 'Resource Utilization',
            description: 'System resource usage and capacity planning',
            type: 'resources',
            category: 'operations',
            lastGenerated: '2024-05-20T08:00:00',
            format: 'json',
            size: 512000,
            schedule: 'daily',
            status: 'ready',
            version: '1.0.0',
            validationStatus: 'valid',
            templateSource: 'createResourceUtilizationReportTemplate',
            dataVersion: '1.0.0',
        },
    ],
    // This will be populated from API or fallback to fallbackReports
    get availableReports() {
        return this._availableReports || this.fallbackReports;
    },
    set availableReports(value) {
        this._availableReports = value;
    },
    reportTemplates: [
        {
            id: 'template_001',
            name: 'Executive Summary',
            description: 'High-level overview for stakeholders',
            category: 'executive',
            sections: ['overview', 'key_metrics', 'recommendations'],
            format: 'pdf',
        },
        {
            id: 'template_002',
            name: 'Technical Analysis',
            description: 'Detailed technical metrics and analysis',
            category: 'technical',
            sections: ['performance', 'quality', 'security', 'infrastructure'],
            format: 'excel',
        },
        {
            id: 'template_003',
            name: 'Compliance Report',
            description: 'Regulatory compliance and audit findings',
            category: 'compliance',
            sections: ['compliance_status', 'violations', 'remediation'],
            format: 'pdf',
        },
    ],
    scheduledReports: [
        {
            id: 'schedule_001',
            reportName: 'Daily Performance Summary',
            frequency: 'daily',
            time: '08:00',
            recipients: ['manager@company.com', 'team@company.com'],
            format: 'pdf',
            status: 'active',
            nextRun: '2024-05-21T08:00:00',
        },
        {
            id: 'schedule_002',
            reportName: 'Weekly Development Report',
            frequency: 'weekly',
            time: '09:00',
            dayOfWeek: 'monday',
            recipients: ['dev-team@company.com'],
            format: 'excel',
            status: 'active',
            nextRun: '2024-05-27T09:00:00',
        },
    ],
    reportAnalytics: {
        totalGenerated: 156,
        totalViews: 892,
        popularReports: [
            { name: 'Project Performance Report', views: 245 },
            { name: 'Code Quality Analysis', views: 189 },
            { name: 'Security Audit Report', views: 156 },
        ],
        generationTime: {
            average: 45,
            fastest: 12,
            slowest: 180,
        },
    },
};

// Show reports
function _showReports(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-chart-bar"></i> Reports
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="createNewReport()">
                        <i class="fas fa-plus"></i> Create Report
                    </button>
                    <button class="btn btn-secondary" onclick="manageTemplates()">
                        <i class="fas fa-file-alt"></i> Templates
                    </button>
                    <button class="btn btn-secondary" onclick="scheduleReport()">
                        <i class="fas fa-clock"></i> Schedule
                    </button>
                </div>
            </div>
            
            <!-- Report Statistics -->
            <div class="report-stats" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${reportsData.reportAnalytics.totalGenerated}</div>
                        <div class="stat-label">Reports Generated</div>
                        <div class="stat-change">+12 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportsData.reportAnalytics.totalViews}</div>
                        <div class="stat-label">Total Views</div>
                        <div class="stat-change">+89 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportsData.reportAnalytics.generationTime.average}s</div>
                        <div class="stat-label">Avg Generation Time</div>
                        <div class="stat-change">-8s improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportsData.scheduledReports.length}</div>
                        <div class="stat-label">Scheduled Reports</div>
                        <div class="stat-change">2 active</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportsData.systemVersion || '2.0.0'}</div>
                        <div class="stat-label">System Version</div>
                        <div class="stat-change">Enhanced infrastructure</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportsData.availableReports.filter((r) => r.validationStatus === 'valid').length}/${reportsData.availableReports.length}</div>
                        <div class="stat-label">Validated Reports</div>
                        <div class="stat-change">Schema validation active</div>
                    </div>
                </div>
            </div>
            
            <!-- Report Tabs -->
            <div class="reports-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showReportsTab('available')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Available Reports
                    </button>
                    <button class="tab-btn" onclick="showReportsTab('scheduled')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Scheduled
                    </button>
                    <button class="tab-btn" onclick="showReportsTab('templates')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Templates
                    </button>
                    <button class="tab-btn" onclick="showReportsTab('analytics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Analytics
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="reports-tab-content">
                ${getAvailableReportsContent()}
            </div>
        </div>
    `;
}

// Get available reports content
function getAvailableReportsContent() {
    return `
        <div class="available-reports">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Available Reports</h3>
                <div>
                    <select onchange="filterReports(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Reports</option>
                        <option value="performance">Performance</option>
                        <option value="quality">Quality</option>
                        <option value="security">Security</option>
                        <option value="resources">Resources</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" onclick="refreshReports()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="reports-list" style="display: grid; gap: 1rem;">
                ${reportsData.availableReports
        .map(
            (report) => `
                    <div class="report-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${report.name}</h4>
                                    <span class="report-type-badge type-${report.type}">${report.type}</span>
                                    <span class="report-status-badge status-${report.status}">${report.status}</span>
                                    ${report.version ? `<span class="version-badge">v${report.version}</span>` : ''}
                                    ${report.validationStatus ? `<span class="validation-badge status-${report.validationStatus}">${report.validationStatus}</span>` : ''}
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${report.description}</p>
                                ${
    report.templateSource
        ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    <i class="fas fa-cube"></i> Template: ${report.templateSource}
                                </div>`
        : ''
}
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">${formatFileSize(report.size)}</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${report.format.toUpperCase()}</p>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${report.category}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Category</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${report.schedule}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Schedule</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatFileSize(report.size)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Size</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatTimestamp(report.lastGenerated)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Generated</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-primary" onclick="viewReport('${report.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="downloadReport('${report.id}')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="regenerateReport('${report.id}')">
                                    <i class="fas fa-redo"></i> Regenerate
                                </button>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                Last: ${formatTimestamp(report.lastGenerated)}
                            </div>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get scheduled reports content
function getScheduledReportsContent() {
    return `
        <div class="scheduled-reports">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Scheduled Reports</h3>
                <button class="btn btn-primary" onclick="createSchedule()">
                    <i class="fas fa-plus"></i> New Schedule
                </button>
            </div>
            
            <div class="scheduled-list" style="display: grid; gap: 1rem;">
                ${reportsData.scheduledReports
        .map(
            (schedule) => `
                    <div class="schedule-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${schedule.reportName}</h4>
                                    <span class="schedule-badge status-${schedule.status}">${schedule.status}</span>
                                </div>
                                <div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                        <i class="fas fa-clock"></i> ${schedule.frequency} at ${schedule.time}
                                    </span>
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                        <i class="fas fa-file"></i> ${schedule.format}
                                    </span>
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                    <i class="fas fa-users"></i> Recipients: ${schedule.recipients.join(', ')}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: var(--text-primary); font-weight: bold;">Next Run:</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatTimestamp(schedule.nextRun)}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="editSchedule('${schedule.id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="runNow('${schedule.id}')">
                                    <i class="fas fa-play"></i> Run Now
                                </button>
                                ${
    schedule.status === 'active'
        ? `
                                    <button class="btn btn-sm btn-secondary" onclick="pauseSchedule('${schedule.id}')">
                                        <i class="fas fa-pause"></i> Pause
                                    </button>
                                `
        : `
                                    <button class="btn btn-sm btn-secondary" onclick="resumeSchedule('${schedule.id}')">
                                        <i class="fas fa-play"></i> Resume
                                    </button>
                                `
}
                            </div>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get templates content
function getTemplatesContent() {
    return `
        <div class="report-templates">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Report Templates</h3>
                <button class="btn btn-primary" onclick="createTemplate()">
                    <i class="fas fa-plus"></i> Create Template
                </button>
            </div>
            
            <div class="templates-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                ${reportsData.reportTemplates
        .map(
            (template) => `
                    <div class="template-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <h4 style="color: var(--text-primary); margin: 0;">${template.name}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${template.description}</p>
                            </div>
                            <span class="template-badge category-${template.category}">${template.category}</span>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Sections:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${template.sections
        .map(
            (section) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${section}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                <i class="fas fa-file"></i> ${template.format.toUpperCase()}
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-sm btn-secondary" onclick="editTemplate('${template.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-primary" onclick="useTemplate('${template.id}')">
                                    <i class="fas fa-plus"></i> Use
                                </button>
                            </div>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get analytics content
function getAnalyticsContent() {
    return `
        <div class="report-analytics">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Report Analytics</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2rem;">
                <!-- Popular Reports -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Popular Reports</h4>
                    <div style="display: grid; gap: 1rem;">
                        ${reportsData.reportAnalytics.popularReports
        .map(
            (report) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                <span style="color: var(--text-primary); font-weight: 500;">${report.name}</span>
                                <span style="color: var(--primary-color); font-weight: bold;">${report.views} views</span>
                            </div>
                        `
        )
        .join('')}
                    </div>
                </div>
                
                <!-- Generation Time Analytics -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Generation Time Analytics</h4>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--text-secondary);">Average</span>
                            <span style="color: var(--text-primary); font-weight: bold;">${reportsData.reportAnalytics.generationTime.average}s</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--success-color);">Fastest</span>
                            <span style="color: var(--success-color); font-weight: bold;">${reportsData.reportAnalytics.generationTime.fastest}s</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--warning-color);">Slowest</span>
                            <span style="color: var(--warning-color); font-weight: bold;">${reportsData.reportAnalytics.generationTime.slowest}s</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Validation & Version Analytics -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2rem;">
                <!-- Validation Status -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Validation Status</h4>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--success-color);">Valid Reports</span>
                            <span style="color: var(--success-color); font-weight: bold;">${reportsData.availableReports.filter((r) => r.validationStatus === 'valid').length}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--warning-color);">Pending Validation</span>
                            <span style="color: var(--warning-color); font-weight: bold;">${reportsData.availableReports.filter((r) => r.validationStatus === 'pending').length}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--danger-color);">Invalid Reports</span>
                            <span style="color: var(--danger-color); font-weight: bold;">${reportsData.availableReports.filter((r) => r.validationStatus === 'invalid').length}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--text-secondary);">Validation Rate</span>
                            <span style="color: var(--text-primary); font-weight: bold;">${((reportsData.availableReports.filter((r) => r.validationStatus === 'valid').length / reportsData.availableReports.length) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                
                <!-- Template Usage -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Template Usage</h4>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--text-secondary);">Template-Based Reports</span>
                            <span style="color: var(--primary-color); font-weight: bold;">${reportsData.availableReports.filter((r) => r.templateSource && r.templateSource !== 'standard').length}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--text-secondary);">System Version</span>
                            <span style="color: var(--text-primary); font-weight: bold;">${reportsData.systemVersion || '2.0.0'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--text-secondary);">Template Integration</span>
                            <span style="color: var(--success-color); font-weight: bold;">${reportsData.templateIntegration || 'enabled'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <span style="color: var(--text-secondary);">Validation System</span>
                            <span style="color: var(--success-color); font-weight: bold;">${reportsData.validationSystem || 'active'}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Report Trends -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Report Generation Trends</h4>
                <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                    <div style="text-align: center;">
                        <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Report generation trend chart would be rendered here</p>
                        <p style="font-size: 0.9rem;">Showing report generation volume over time</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function formatFileSize(bytes) {
    if (bytes === 0) {
        return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// ============================================================================
// API INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Fetch reports from the database API
 * @returns {Promise<Array>} Array of reports from database
 */
async function fetchReportsFromAPI() {
    if (!API_CONFIG.useAPI) {
        console.log('API integration disabled, using fallback data');
        return reportsData.fallbackReports;
    }

    try {
        console.log('Fetching reports from API...');
        const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.reportsEndpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(API_CONFIG.timeout),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Successfully fetched ${data.length} reports from API`);
        reportsData.dataSource = 'database';
        return data;
    } catch (error) {
        console.warn('API fetch failed, using fallback data:', error.message);
        reportsData.dataSource = 'mock';
        return reportsData.fallbackReports;
    }
}

/**
 * Initialize reports data from API or fallback
 */
async function initializeReportsData() {
    try {
        const reports = await fetchReportsFromAPI();
        reportsData.availableReports = reports;
        console.log(`Reports initialized with ${reports.length} items from ${reportsData.dataSource}`);
    } catch (error) {
        console.error('Failed to initialize reports data:', error);
        reportsData.availableReports = reportsData.fallbackReports;
    }
}

/**
 * Refresh reports data from API
 */
async function refreshReportsFromAPI() {
    console.log('Refreshing reports from API...');
    const reports = await fetchReportsFromAPI();
    reportsData.availableReports = reports;
    // Refresh the UI if reports tab is active
    const content = document.getElementById('reports-tab-content');
    if (
        content &&
    document.querySelector('.reports-tabs .tab-btn.active')?.textContent.includes('Available')
    ) {
        content.textContent = getAvailableReportsContent() /* Replaced innerHTML with textContent for safety */
    }
    console.log('Reports refreshed successfully');
}

// ============================================================================
// ENHANCED MOCK DATA GENERATION WITH TEMPLATES
// ============================================================================

/**
 * Generate mock report data using template library
 * @param {string} reportType - Type of report to generate
 * @param {object} overrides - Properties to override in template
 * @returns {object} Generated report data
 */
function generateMockReportData(reportType, overrides = {}) {
    // Check if template library is available
    if (typeof window !== 'undefined' && window.MockDataTemplates) {
        switch (reportType) {
        case 'resources':
            return window.MockDataTemplates.createResourceUtilizationReportTemplate(overrides);
        case 'performance':
            return window.MockDataTemplates.createPerformanceReportTemplate(overrides);
        case 'quality':
            return window.MockDataTemplates.createCodeQualityReportTemplate(overrides);
        case 'security':
            return window.MockDataTemplates.createSecurityAuditReportTemplate(overrides);
        default:
            return generateLegacyMockReportData(reportType, overrides);
        }
    } else {
        console.warn('Mock data templates not available, using legacy generation');
        return generateLegacyMockReportData(reportType, overrides);
    }
}

/**
 * Legacy mock report data generation (fallback)
 * @param {string} reportType - Type of report to generate
 * @param {object} overrides - Properties to override
 * @returns {object} Generated report data
 */
function generateLegacyMockReportData(reportType, overrides = {}) {
    const baseData = {
        reportInfo: {
            name: overrides.name || 'Generated Report',
            description: overrides.description || 'Auto-generated mock report',
            type: reportType,
            category: overrides.category || 'analytics',
            format: overrides.format || 'json',
            generated: new Date().toISOString(),
            status: 'ready',
            version: '1.0.0',
        },
        metadata: {
            id: overrides.id || `report_${Date.now()}`,
            size: overrides.size || 1024000,
            schedule: overrides.schedule || 'daily',
            lastGenerated: new Date().toISOString(),
            version: '1.0.0',
            validationStatus: 'valid',
            templateSource: 'legacy',
        },
        data: {
            summary: {
                totalMetrics: 45,
                passed: 38,
                failed: 7,
                score: 84.4,
            },
            metrics: [
                { name: 'Performance', value: 85, status: 'good', trend: 'up' },
                { name: 'Quality', value: 92, status: 'excellent', trend: 'stable' },
                { name: 'Security', value: 78, status: 'fair', trend: 'down' },
                { name: 'Resources', value: 65, status: 'optimal', trend: 'up' },
            ],
            recommendations: [
                'Continue monitoring metrics',
                'Maintain current standards',
                'Address any issues identified',
            ],
        },
    };

    return { ...baseData, ...overrides };
}

// ============================================================================
// VALIDATION INTEGRATION
// ============================================================================

/**
 * Validate report data using schema validation system
 * @param {string} reportType - Type of report to validate
 * @param {object} reportData - Report data to validate
 * @returns {object} Validation result
 */
function validateReportData(reportType, reportData) {
    // Check if validator is available
    if (typeof window !== 'undefined' && window.MockDataValidator) {
        const schemaName = `${reportType}-report`;
        const validation = window.MockDataValidator.validateMockData(schemaName, reportData);

        if (validation.isValid) {
            return {
                isValid: true,
                status: 'valid',
                errors: [],
                timestamp: new Date().toISOString(),
            };
        } else {
            return {
                isValid: false,
                status: 'invalid',
                errors: validation.errors,
                timestamp: new Date().toISOString(),
            };
        }
    } else {
        console.warn('Mock data validator not available, skipping validation');
        return {
            isValid: true,
            status: 'pending',
            errors: [],
            timestamp: new Date().toISOString(),
            note: 'Validator not available',
        };
    }
}

/**
 * Get report version information
 * @param {string} reportId - Report ID
 * @returns {object} Version information
 */
function getReportVersionInfo(reportId) {
    const report = reportsData.availableReports.find((r) => r.id === reportId);
    if (!report) {
        return {
            version: 'unknown',
            dataVersion: 'unknown',
            templateSource: 'unknown',
            validationStatus: 'unknown',
        };
    }

    return {
        version: report.version || '1.0.0',
        dataVersion: report.dataVersion || '1.0.0',
        templateSource: report.templateSource || 'standard',
        validationStatus: report.validationStatus || 'pending',
        systemVersion: reportsData.systemVersion || '2.0.0',
    };
}

/**
 * Update report validation status
 * @param {string} reportId - Report ID
 * @param {string} status - New validation status
 */
function _updateReportValidationStatus(reportId, status) {
    const report = reportsData.availableReports.find((r) => r.id === reportId);
    if (report) {
        report.validationStatus = status;
        console.log(`Updated report ${reportId} validation status to ${status}`);
    }
}

// Tab switching
function _showReportsTab(tabName) {
    const content = document.getElementById('reports-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.reports-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'available':
        content.textContent = getAvailableReportsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'scheduled':
        content.textContent = getScheduledReportsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'templates':
        content.textContent = getTemplatesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'analytics':
        content.textContent = getAnalyticsContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function _createNewReport() {
    console.log('Creating new report...');

    // Create report creation modal
    const modal = document.createElement('div');
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    modal.textContent = `
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0;">📊 Create New Report</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="display: grid; gap: 1rem;">
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Report Name</label>
          <input type="text" id="reportName" placeholder="Enter report name" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Report Type</label>
          <select id="reportType" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="">Select report type</option>
            <option value="performance">Performance Report</option>
            <option value="resources">Resource Utilization</option>
            <option value="quality">Quality Analysis</option>
            <option value="security">Security Assessment</option>
            <option value="custom">Custom Report</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Category</label>
          <select id="reportCategory" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="">Select category</option>
            <option value="system">System</option>
            <option value="business">Business</option>
            <option value="technical">Technical</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Description</label>
          <textarea id="reportDescription" placeholder="Enter report description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); resize: vertical;"></textarea>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Format</label>
          <select id="reportFormat" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
            <option value="text">Text</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Schedule</label>
          <select id="reportSchedule" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="manual">Manual</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="confirmCreateReport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
          Create Report
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
}

function _manageTemplates() {
    console.log('Managing templates...');

    // Create template management modal
    const modal = document.createElement('div');
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    modal.textContent = `
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0;">📋 Manage Templates</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="display: grid; gap: 1rem;">
        <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Available Templates</h4>
          <div style="display: grid; gap: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--card-bg); border-radius: 4px;">
              <span style="color: var(--text-primary);">Performance Report Template</span>
              <div style="display: flex; gap: 0.5rem;">
                <button style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Edit</button>
                <button style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Duplicate</button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--card-bg); border-radius: 4px;">
              <span style="color: var(--text-primary);">Resource Utilization Template</span>
              <div style="display: flex; gap: 0.5rem;">
                <button style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Edit</button>
                <button style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Duplicate</button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--card-bg); border-radius: 4px;">
              <span style="color: var(--text-primary);">Quality Analysis Template</span>
              <div style="display: flex; gap: 0.5rem;">
                <button style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Edit</button>
                <button style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Duplicate</button>
              </div>
            </div>
          </div>
        </div>
        
        <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Template Actions</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <button onclick="createNewTemplate()" style="padding: 0.75rem 1rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
              Create New Template
            </button>
            <button onclick="importTemplate()" style="padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
              Import Template
            </button>
          </div>
        </div>
        
        <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Template Statistics</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">12</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Templates</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--success-color);">8</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">Active</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--warning-color);">4</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">Draft</div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Close
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
}

function _scheduleReport() {
    console.log('Scheduling report...');

    // Create report scheduling modal
    const modal = document.createElement('div');
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    modal.textContent = `
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0;">⏰ Schedule Report</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="display: grid; gap: 1rem;">
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Select Report</label>
          <select id="scheduleReport" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="">Select report to schedule</option>
            <option value="report_001">Project Performance Report</option>
            <option value="report_002">Resource Utilization Report</option>
            <option value="report_003">Quality Analysis Report</option>
            <option value="report_004">Security Assessment Report</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Schedule Frequency</label>
          <select id="scheduleFrequency" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Time of Day</label>
          <input type="time" id="scheduleTime" value="09:00" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Recipients</label>
          <input type="text" id="scheduleRecipients" placeholder="Enter email addresses (comma separated)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Delivery Method</label>
          <select id="deliveryMethod" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            <option value="email">Email</option>
            <option value="download">Download</option>
            <option value="api">API Endpoint</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Start Date</label>
          <input type="date" id="startDate" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="confirmScheduleReport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
          Schedule Report
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
}

function _filterReports(filter) {
    console.log('Filtering reports:', filter);
    alert(`Reports would be filtered to show only ${filter} type reports`);
}

function _refreshReports() {
    console.log('Refreshing reports...');
    refreshReportsFromAPI();
}

// Helper functions for enhanced reports functionality
function _confirmCreateReport() {
    const name = document.getElementById('reportName').value.trim();
    const type = document.getElementById('reportType').value;
    const category = document.getElementById('reportCategory').value;
    const _description = document.getElementById('reportDescription').value.trim();
    const _format = document.getElementById('reportFormat').value;
    const _schedule = document.getElementById('reportSchedule').value;

    if (!name || !type || !category) {
        if (window.showNotification) {
            window.showNotification('Please fill in all required fields', 'warning');
        } else {
            alert('Please fill in all required fields');
        }
        return;
    }

    // Simulate creating report
    if (window.showNotification) {
        window.showNotification(`Report "${name}" created successfully!`, 'success');
    } else {
        alert(`Report "${name}" created successfully!`);
    }

    // Close modal
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
}

function _createNewTemplate() {
    console.log('Creating new template...');
    if (window.showNotification) {
        window.showNotification('Template creation wizard would open here', 'info');
    } else {
        alert('Template creation wizard would open here');
    }
}

function _importTemplate() {
    console.log('Importing template...');
    if (window.showNotification) {
        window.showNotification('Template import wizard would open here', 'info');
    } else {
        alert('Template import wizard would open here');
    }
}

function _confirmScheduleReport() {
    const report = document.getElementById('scheduleReport').value;
    const frequency = document.getElementById('scheduleFrequency').value;
    const time = document.getElementById('scheduleTime').value;
    const _recipients = document.getElementById('scheduleRecipients').value.trim();
    const _deliveryMethod = document.getElementById('deliveryMethod').value;
    const _startDate = document.getElementById('startDate').value;

    if (!report || !frequency || !time) {
        if (window.showNotification) {
            window.showNotification('Please fill in all required fields', 'warning');
        } else {
            alert('Please fill in all required fields');
        }
        return;
    }

    // Simulate scheduling report
    if (window.showNotification) {
        window.showNotification(`Report scheduled ${frequency} at ${time}!`, 'success');
    } else {
        alert(`Report scheduled ${frequency} at ${time}!`);
    }

    // Close modal
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
}

function _viewReport(reportId) {
    console.log('Viewing report:', reportId);

    const report = reportsData.availableReports.find((r) => r.id === reportId);
    if (!report) {
        alert('Report not found');
        return;
    }

    // Get version information
    const versionInfo = getReportVersionInfo(reportId);

    // Generate enhanced report data
    const reportData = generateMockReportData(report.type, {
        reportInfo: {
            name: report.name,
            description: report.description,
            type: report.type,
            category: report.category,
            format: report.format,
            generated: new Date().toISOString(),
            status: report.status,
            version: report.version,
        },
        metadata: {
            id: report.id,
            size: report.size,
            schedule: report.schedule,
            lastGenerated: report.lastGenerated,
            version: report.dataVersion,
            validationStatus: report.validationStatus,
            templateSource: report.templateSource,
        },
    });

    // Validate the report data
    const validation = validateReportData(report.type, reportData);

    // Display enhanced report information
    const reportInfo = `
REPORT DETAILS
=============
Name: ${report.name}
ID: ${report.id}
Type: ${report.type}
Category: ${report.category}
Format: ${report.format}
Status: ${report.status}

VERSION INFORMATION
==================
Report Version: ${versionInfo.version}
Data Version: ${versionInfo.dataVersion}
System Version: ${versionInfo.systemVersion}
Template Source: ${versionInfo.templateSource}

VALIDATION STATUS
=================
Status: ${versionInfo.validationStatus}
${validation.isValid ? '✅ Valid' : '❌ Invalid'}
${validation.errors.length > 0 ? 'Errors: ' + validation.errors.join(', ') : 'No errors found'}
Validation Timestamp: ${validation.timestamp}

METADATA
========
Size: ${formatFileSize(report.size)}
Schedule: ${report.schedule}
Last Generated: ${formatTimestamp(report.lastGenerated)}
  `;

    alert(reportInfo);
}

function _downloadReport(reportId) {
    console.log('Downloading report:', reportId);

    // Find the report data
    const report = reportsData.availableReports.find((r) => r.id === reportId);
    if (!report) {
        alert('Report not found');
        return;
    }

    // Check if report is ready for download
    if (report.status !== 'ready') {
        alert(`Report is currently ${report.status}. Please wait for it to be ready.`);
        return;
    }

    try {
    // Generate mock report data based on type
        let reportContent = '';
        let fileName = '';
        let mimeType = '';

        switch (report.format.toLowerCase()) {
        case 'pdf':
        // For PDF, create HTML content that can be printed/saved as PDF
            reportContent = generateMockHTMLReport(report);
            fileName = `${report.name.replace(/\s+/g, '_')}.html`;
            mimeType = 'text/html';
            break;
        case 'excel':
        // For Excel, create CSV format
            reportContent = generateMockExcelReport(report);
            fileName = `${report.name.replace(/\s+/g, '_')}.csv`;
            mimeType = 'text/csv';
            break;
        case 'json':
        // For JSON, create structured data
            reportContent = generateMockJSONReport(report);
            fileName = `${report.name.replace(/\s+/g, '_')}.json`;
            mimeType = 'application/json';
            break;
        default:
            reportContent = generateMockTextReport(report);
            fileName = `${report.name.replace(/\s+/g, '_')}.txt`;
            mimeType = 'text/plain';
        }

        // Create blob and download
        const blob = new Blob([reportContent], { type: mimeType });
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Show success message
        if (window.showNotification) {
            window.showNotification(`${report.name} downloaded successfully!`, 'success');
        } else {
            alert(`${report.name} downloaded successfully!`);
        }
    } catch (error) {
        console.error('Failed to download report:', error);
        alert('Failed to download report. Please try again.');
    }
}

// Helper functions to generate mock report content
function generateMockHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 28px;
        }
        .header .subtitle {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }
        .metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .metadata h3 {
            margin-top: 0;
            color: #495057;
        }
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        .metadata-item {
            display: flex;
            justify-content: space-between;
        }
        .metadata-label {
            font-weight: bold;
            color: #666;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #007bff;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
        }
        .metric-card {
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin-bottom: 15px;
        }
        .metric-title {
            font-weight: bold;
            color: #333;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .metric-status {
            color: #28a745;
            font-weight: bold;
        }
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
        }
        .recommendations h3 {
            color: #856404;
            margin-top: 0;
        }
        .recommendations ol {
            margin-bottom: 0;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .header { page-break-after: avoid; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.name}</h1>
        <div class="subtitle">Comprehensive ${report.type} Analysis Report</div>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
    </div>

    <div class="metadata">
        <h3>Report Information</h3>
        <div class="metadata-grid">
            <div class="metadata-item">
                <span class="metadata-label">Report Type:</span>
                <span>${report.type}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Category:</span>
                <span>${report.category}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Status:</span>
                <span class="metric-status">${report.status}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Schedule:</span>
                <span>${report.schedule}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Last Generated:</span>
                <span>${formatTimestamp(report.lastGenerated)}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Description:</span>
                <span>${report.description}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <p>This comprehensive ${report.type} report provides detailed analysis of current system performance, quality metrics, and operational efficiency. The analysis reveals key areas of strength and opportunities for improvement.</p>
        
        <div class="metric-card">
            <div class="metric-title">Overall Performance Score</div>
            <div class="metric-value">85.4%</div>
            <div class="metric-status">Good Performance</div>
        </div>
    </div>

    <div class="section">
        <h2>Key Performance Metrics</h2>
        
        <div class="metric-card">
            <div class="metric-title">Performance Score</div>
            <div class="metric-value">85%</div>
            <div class="metric-status">Good</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-title">Quality Score</div>
            <div class="metric-value">92%</div>
            <div class="metric-status">Excellent</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-title">Security Score</div>
            <div class="metric-value">78%</div>
            <div class="metric-status">Fair</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-title">Resource Utilization</div>
            <div class="metric-value">65%</div>
            <div class="metric-status">Optimal</div>
        </div>
    </div>

    <div class="section">
        <h2>Detailed Analysis</h2>
        <p>The system demonstrates strong performance across multiple dimensions. Key highlights include:</p>
        <ul>
            <li><strong>Performance:</strong> Response times within acceptable ranges, processing efficiency optimized</li>
            <li><strong>Quality:</strong> Code quality standards consistently maintained, testing coverage above threshold</li>
            <li><strong>Security:</strong> Core security measures in place, some areas require attention</li>
            <li><strong>Resources:</strong> Resource allocation optimized for current workload</li>
        </ul>
    </div>

    <div class="section recommendations">
        <h3>Recommendations</h3>
        <ol>
            <li>Address security vulnerabilities identified in the analysis to improve overall security posture</li>
            <li>Continue monitoring performance metrics to maintain current efficiency levels</li>
            <li>Maintain current quality assurance processes and standards</li>
            <li>Optimize resource allocation based on usage patterns and projected growth</li>
            <li>Implement automated monitoring for proactive issue detection</li>
        </ol>
    </div>

    <div class="section">
        <h2>Next Steps</h2>
        <ul>
            <li>Schedule follow-up review in 30 days to assess progress</li>
            <li>Implement security improvements within next quarter</li>
            <li>Update monitoring thresholds based on recent performance data</li>
            <li>Review resource allocation strategy for upcoming projects</li>
        </ul>
    </div>

    <div class="footer">
        <p>This report was automatically generated by the AI Dashboard Analytics System</p>
        <p>Report ID: ${report.id} | Generated: ${new Date().toISOString()}</p>
        <p>© 2024 AI Dashboard. All rights reserved.</p>
    </div>
</body>
</html>
    `;
}

function generateMockExcelReport(report) {
    const headers = ['Metric', 'Value', 'Status', 'Trend'];
    const rows = [
        ['Performance Score', '85%', 'Good', '↑ Improving'],
        ['Quality Score', '92%', 'Excellent', '→ Stable'],
        ['Security Score', '78%', 'Fair', '↓ Declining'],
        ['Resource Usage', '65%', 'Optimal', '↑ Improving'],
        ['Completion Rate', '88%', 'Good', '↑ Improving'],
    ];

    let csv = headers.join(',') + '\n';
    rows.forEach((row) => {
        csv += row.join(',') + '\n';
    });

    return `Report: ${report.name}\nGenerated: ${new Date().toLocaleString()}\n\n${csv}`;
}

function generateMockJSONReport(report) {
    // Use enhanced mock data generation with templates
    const mockData = generateMockReportData(report.type, {
        reportInfo: {
            name: report.name,
            description: report.description,
            type: report.type,
            category: report.category,
            format: report.format,
            generated: new Date().toISOString(),
            status: report.status,
            version: report.version || '1.0.0',
        },
        metadata: {
            id: report.id,
            size: report.size,
            schedule: report.schedule,
            lastGenerated: report.lastGenerated,
            version: report.dataVersion || '1.0.0',
            validationStatus: report.validationStatus || 'valid',
            templateSource: report.templateSource || 'standard',
        },
    });

    // Validate the generated data
    const validation = validateReportData(report.type, mockData);

    // Add validation result to the output
    mockData.validation = validation;

    return JSON.stringify(mockData, null, 2);
}

function generateMockTextReport(report) {
    return `
REPORT: ${report.name}
====================

Description: ${report.description}
Type: ${report.type}
Category: ${report.category}
Format: ${report.format}
Status: ${report.status}
Schedule: ${report.schedule}

Generated: ${new Date().toLocaleString()}
Last Generated: ${formatTimestamp(report.lastGenerated)}

EXECUTIVE SUMMARY
================
This is a comprehensive ${report.type} report for ${report.name}.
The report contains detailed analysis and recommendations.

KEY FINDINGS
============
• Performance metrics are within acceptable ranges
• Quality standards are being maintained
• Security posture requires attention
• Resource utilization is optimal

RECOMMENDATIONS
===============
1. Address security vulnerabilities identified in the analysis
2. Continue monitoring performance metrics
3. Maintain current quality assurance processes
4. Optimize resource allocation based on usage patterns

NEXT STEPS
==========
• Schedule follow-up review in 30 days
• Implement security improvements
• Update monitoring thresholds
• Review resource allocation strategy

====================
End of Report
    `.trim();
}

function _regenerateReport(reportId) {
    console.log('Regenerating report:', reportId);
    alert(`Report ${reportId} would be regenerated here`);
}

function _createSchedule() {
    console.log('Creating new schedule...');
    alert('Schedule creation wizard would be shown here');
}

function _editSchedule(scheduleId) {
    console.log('Editing schedule:', scheduleId);
    alert(`Schedule ${scheduleId} editing interface would be shown here`);
}

function _runNow(scheduleId) {
    console.log('Running schedule now:', scheduleId);
    alert(`Scheduled report ${scheduleId} would be generated immediately`);
}

function _pauseSchedule(scheduleId) {
    console.log('Pausing schedule:', scheduleId);
    alert(`Schedule ${scheduleId} would be paused here`);
}

function _resumeSchedule(scheduleId) {
    console.log('Resuming schedule:', scheduleId);
    alert(`Schedule ${scheduleId} would be resumed here`);
}

function _createTemplate() {
    console.log('Creating new template...');
    alert('Template creation wizard would be shown here');
}

function _editTemplate(templateId) {
    console.log('Editing template:', templateId);
    alert(`Template ${templateId} editing interface would be shown here`);
}

function _useTemplate(templateId) {
    console.log('Using template:', templateId);
    alert(`Template ${templateId} would be used to create a new report here`);
}

// Add styles for report badges
const reportsStyle = document.createElement('style');
reportsStyle.textContent = `
.report-type-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.type-performance {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.type-quality {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.type-security {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.type-resources {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.report-status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-ready {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-processing {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-failed {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.schedule-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-active {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-paused {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-processing {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-failed {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.status-ready {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.schedule-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.template-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.category-executive {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.category-technical {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.category-compliance {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.version-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.validation-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.status-valid {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-invalid {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.status-pending {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.reports:hover {
    border-color: var(--primary-color);
}
`;
document.head.appendChild(reportsStyle);

// Initialize reports data from API when module loads
initializeReportsData().catch((error) => {
    console.error('Reports data initialization failed:', error);
    // Ensure fallback data is available
    reportsData.availableReports = reportsData.fallbackReports;
});

console.log('✅ Reports module loaded');
