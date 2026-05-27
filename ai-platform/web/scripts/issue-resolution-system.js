/**
 * Issue Resolution System
 * Comprehensive tracking and management of detected issues
 * Provides workflow for issue resolution with status tracking and automation
 */

class IssueResolutionSystem {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showFilters: true,
            autoRefresh: true,
            refreshInterval: 60000, // 1 minute
            enableWorkflow: true,
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.filteredIssues = null;
        this.filters = {
            severity: [],
            status: [],
            type: [],
            search: ''
        };
        this.refreshTimer = null;
        this.workflowStates = ['open', 'in-progress', 'resolved', 'closed'];
        
        this.init();
    }

    /**
     * Initialize the issue resolution system
     */
    init() {
        if (!this.container) {
            console.error('Issue resolution system container not found');
            return;
        }

        this.setupStyles();
        this.createSystemStructure();
        this.bindEvents();
        
        if (this.options.autoRefresh) {
            this.startAutoRefresh();
        }
    }

    /**
     * Setup CSS styles for the system
     */
    setupStyles() {
        const styleId = 'issue-resolution-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .issue-resolution-system {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .system-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .system-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #f8fafc;
                    background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .system-stats {
                    display: flex;
                    gap: 1rem;
                }

                .stat-badge {
                    padding: 0.5rem 1rem;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .stat-high {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border: 1px solid #ef4444;
                }

                .stat-medium {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .stat-low {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .filters-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .filters-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .filters-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .filters-controls {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .filter-label {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                .filter-select {
                    background: rgba(15, 23, 42, 0.8);
                    color: #f8fafc;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 6px;
                    padding: 0.5rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .filter-select:hover {
                    border-color: #3b82f6;
                }

                .filter-select:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                }

                .search-input {
                    background: rgba(15, 23, 42, 0.8);
                    color: #f8fafc;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 6px;
                    padding: 0.5rem 1rem;
                    font-size: 0.9rem;
                    width: 200px;
                    transition: all 0.3s ease;
                }

                .search-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                }

                .issues-grid {
                    display: grid;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .issue-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .issue-card:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .issue-severity-indicator {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
                }

                .severity-high {
                    background: #ef4444;
                }

                .severity-medium {
                    background: #f59e0b;
                }

                .severity-low {
                    background: #10b981;
                }

                .issue-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                    padding-left: 8px;
                }

                .issue-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .issue-meta {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .issue-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .badge-high {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .badge-medium {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .badge-low {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .status-badge {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                }

                .status-resolved {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .status-closed {
                    background: rgba(100, 116, 139, 0.2);
                    color: #64748b;
                    border: 1px solid #64748b;
                }

                .issue-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin-bottom: 1rem;
                    padding-left: 8px;
                }

                .issue-action {
                    color: #3b82f6;
                    font-size: 0.8rem;
                    font-style: italic;
                    margin-bottom: 1rem;
                    padding-left: 8px;
                }

                .issue-files {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 6px;
                    padding: 0.75rem;
                    margin-bottom: 1rem;
                }

                .files-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    margin-bottom: 0.5rem;
                }

                .file-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                .file-tag {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-family: monospace;
                }

                .issue-workflow {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(148, 163, 184, 0.2);
                }

                .workflow-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                .status-open {
                    background: #ef4444;
                }

                .status-in-progress {
                    background: #f59e0b;
                }

                .status-resolved {
                    background: #10b981;
                }

                .status-closed {
                    background: #64748b;
                }

                .workflow-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .workflow-btn {
                    padding: 0.25rem 0.75rem;
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .workflow-btn:hover {
                    background: rgba(59, 130, 246, 0.3);
                    transform: translateY(-1px);
                }

                .workflow-btn.resolve {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .workflow-btn.resolve:hover {
                    background: rgba(16, 185, 129, 0.3);
                }

                .workflow-btn.close {
                    background: rgba(100, 116, 139, 0.2);
                    color: #64748b;
                    border: 1px solid #64748b;
                }

                .workflow-btn.close:hover {
                    background: rgba(100, 116, 139, 0.3);
                }

                .workflow-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .summary-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .summary-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .summary-item {
                    text-align: center;
                    padding: 1rem;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                }

                .summary-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .summary-label {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                }

                .progress-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .progress-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .progress-bar-container {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 8px;
                    height: 24px;
                    overflow: hidden;
                    margin: 1rem 0;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%);
                    border-radius: 8px;
                    transition: width 1s ease-in-out;
                    position: relative;
                }

                .progress-bar::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                    animation: shimmer 2s infinite;
                }

                .progress-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    margin-top: 0.5rem;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: #94a3b8;
                }

                .empty-icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    opacity: 0.5;
                }

                .empty-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .empty-description {
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                @media (max-width: 768px) {
                    .issue-resolution-system {
                        padding: 1rem;
                    }

                    .system-header {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .filters-controls {
                        flex-direction: column;
                        width: 100%;
                    }

                    .search-input {
                        width: 100%;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the system structure
     */
    createSystemStructure() {
        this.container.textContent = `
            <div class="issue-resolution-system">
                <div class="system-header">
                    <h2 class="system-title">⚠️ Issue Resolution System</h2>
                    <div class="system-stats" id="system-stats">
                        <!-- Stats will be rendered here -->
                    </div>
                </div>

                <div class="filters-section" id="filters-section">
                    <div class="filters-header">
                        <h3 class="filters-title">🔍 Filters</h3>
                        <button class="workflow-btn" onclick="issueResolutionSystem.clearFilters()">Clear All</button>
                    </div>
                    <div class="filters-controls">
                        <div class="filter-group">
                            <label class="filter-label">Severity:</label>
                            <select class="filter-select" id="severity-filter" multiple>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Status:</label>
                            <select class="filter-select" id="status-filter" multiple>
                                <option value="open">Open</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Type:</label>
                            <select class="filter-select" id="type-filter" multiple>
                                <option value="Data Inconsistency">Data Inconsistency</option>
                                <option value="Missing Fields">Missing Fields</option>
                                <option value="Duplicate Data">Duplicate Data</option>
                                <option value="Schema Violation">Schema Violation</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <input type="text" class="search-input" id="search-input" placeholder="Search issues...">
                        </div>
                    </div>
                </div>

                <div class="issues-grid" id="issues-grid">
                    <!-- Issues will be rendered here -->
                </div>

                <div class="progress-section" id="progress-section">
                    <h3 class="progress-header">📊 Resolution Progress</h3>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Open</span>
                        <span id="progress-percentage">0%</span>
                        <span>Resolved</span>
                    </div>
                </div>

                <div class="summary-section" id="summary-section">
                    <h3 class="summary-header">📋 Issue Summary</h3>
                    <div class="summary-grid" id="summary-grid">
                        <!-- Summary will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load issues data and render system
     */
    async loadIssues() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData.detectedIssues;
            this.filteredIssues = [...this.data];
            
            this.renderSystem();
            
        } catch (error) {
            console.error('Failed to load issues:', error);
            this.showError('Failed to load issues');
        }
    }

    /**
     * Render the system with data
     */
    renderSystem() {
        if (!this.data || this.data.length === 0) {
            this.renderEmptyState();
            return;
        }

        this.renderStats();
        this.renderIssues();
        this.renderProgress();
        this.renderSummary();
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        const issuesGrid = document.getElementById('issues-grid');
        issuesGrid.textContent = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-title">No Issues Found</div>
                <div class="empty-description">All quality checks passed! No issues detected in the mock data.</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render system statistics
     */
    renderStats() {
        const container = document.getElementById('system-stats');
        const stats = this.calculateStats();
        
        container.textContent = `
            <div class="stat-badge stat-high">
                <span>⚠️</span>
                <span>High: ${stats.high}</span>
            </div>
            <div class="stat-badge stat-medium">
                <span>⚠️</span>
                <span>Medium: ${stats.medium}</span>
            </div>
            <div class="stat-badge stat-low">
                <span>⚠️</span>
                <span>Low: ${stats.low}</span>
            </div>
            <div class="stat-badge">
                <span>📊</span>
                <span>Total: ${stats.total}</span>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render issues list
     */
    renderIssues() {
        const container = document.getElementById('issues-grid');
        
        const issues = this.filteredIssues.map((issue, index) => ({
            ...issue,
            id: `issue-${index}`,
            status: this.getIssueStatus(issue),
            workflowState: 'open'
        }));
        
        container.textContent = issues.map(issue => `
            <div class="issue-card" data-issue-id="${issue.id}">
                <div class="issue-severity-indicator severity-${issue.severity}"></div>
                <div class="issue-header">
                    <div>
                        <div class="issue-title">${issue.type}</div>
                        <div class="issue-meta">
                            <span class="issue-badge badge-${issue.severity}">${issue.severity}</span>
                            <span class="status-badge ${issue.status.class}">${issue.status.text}</span>
                            <span class="issue-badge">Count: ${issue.count}</span>
                        </div>
                    </div>
                </div>
                <div class="issue-description">${issue.description}</div>
                <div class="issue-action">Recommended: ${issue.recommendedAction}</div>
                <div class="issue-files">
                    <div class="files-label">Affected Files:</div>
                    <div class="file-list">
                        ${issue.affectedFiles.map(file => `<span class="file-tag">${file}</span>`).join('')}
                    </div>
                </div>
                <div class="issue-workflow">
                    <div class="workflow-status">
                        <span class="status-dot status-${issue.workflowState}"></span>
                        <span>${issue.status.text}</span>
                    </div>
                    <div class="workflow-actions">
                        ${this.getWorkflowButtons(issue)}
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Get issue status
     */
    getIssueStatus(issue) {
        // Default status based on severity
        const statusMap = {
            'high': { text: 'Open', class: 'badge-high' },
            'medium': { text: 'Open', class: 'badge-medium' },
            'low': { text: 'Open', class: 'badge-low' }
        };
        
        return statusMap[issue.severity] || statusMap['low'];
    }

    /**
     * Get workflow buttons based on issue status
     */
    getWorkflowButtons(issue) {
        const buttons = [];
        
        if (issue.workflowState === 'open') {
            buttons.push('<button class="workflow-btn" onclick="issueResolutionSystem.startResolution(\'' + issue.id + '\')">Start Resolution</button>');
        } else if (issue.workflowState === 'in-progress') {
            buttons.push('<button class="workflow-btn" onclick="issueResolutionSystem.resolveIssue(\'' + issue.id + '\')">Resolve</button>');
            buttons.push('<button class="workflow-btn" onclick="issueResolutionSystem.reopenIssue(\'' + issue.id + '\')">Reopen</button>');
        } else if (issue.workflowState === 'resolved') {
            buttons.push('<button class="workflow-btn close" onclick="issueResolutionSystem.closeIssue(\'' + issue.id + '\')">Close</button>');
            buttons.push('<button class="workflow-btn" onclick="issueResolutionSystem.reopenIssue(\'' + issue.id + '\')">Reopen</button>');
        }
        
        return buttons.join('');
    }

    /**
     * Render progress bar
     */
    renderProgress() {
        const progressBar = document.getElementById('progress-bar');
        const percentageElement = document.getElementById('progress-percentage');
        
        const stats = this.calculateStats();
        const resolved = stats.resolved;
        const total = stats.total;
        const percentage = total > 0 ? Math.round((resolved / total) * 100) : 0;
        
        progressBar.style.width = `${percentage}%`;
        percentageElement.textContent = `${percentage}%`;
    }

    /**
     * Render summary statistics
     */
    renderSummary() {
        const container = document.getElementById('summary-grid');
        const stats = this.calculateStats();
        
        container.textContent = `
            <div class="summary-item">
                <div class="summary-value">${stats.total}</div>
                <div class="summary-label">Total Issues</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${stats.open}</div>
                <div class="summary-label">Open</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${stats.inProgress}</div>
                <div class="summary-label">In Progress</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${stats.resolved}</div>
                <div class="summary-label">Resolved</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${stats.closed}</div>
                <div class="summary-label">Closed</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${stats.avgResolutionTime || 'N/A'}</div>
                <div class="summary-label">Avg Resolution Time</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Calculate statistics
     */
    calculateStats() {
        const issues = this.filteredIssues || [];
        
        const stats = {
            total: issues.length,
            high: issues.filter(i => i.severity === 'high').length,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length,
            open: issues.filter(i => i.workflowState === 'open').length,
            inProgress: issues.filter(i => i.workflowState === 'in-progress').length,
            resolved: issues.filter(i => i.workflowState === 'resolved').length,
            closed: issues.filter(i => i.workflowState === 'closed').length,
            avgResolutionTime: this.calculateAvgResolutionTime()
        };
        
        return stats;
    }

    /**
     * Calculate average resolution time (mock implementation)
     */
    calculateAvgResolutionTime() {
        // Mock calculation - in real implementation, this would track actual resolution times
        const stats = this.calculateStats();
        const resolvedCount = stats.resolved + stats.closed;
        
        if (resolvedCount === 0) return 'N/A';
        
        // Mock average resolution time in hours
        const avgHours = Math.round(Math.random() * 24 + 2); // 2-26 hours
        return `${avgHours}h`;
    }

    /**
     * Start issue resolution workflow
     */
    startResolution(issueId) {
        const issueCard = document.querySelector(`[data-issue-id="${issueId}"]`);
        if (!issueCard) return;
        
        // Update workflow state
        this.updateIssueWorkflowState(issueId, 'in-progress');
        
        // Show notification
        this.showNotification(`Resolution started for issue ${issueId}`, 'info');
    }

    /**
     * Resolve an issue
     */
    resolveIssue(issueId) {
        const issueCard = document.querySelector(`[data-issue-id="${issueId}"]`);
        if (!issueCard) return;
        
        // Update workflow state
        this.updateIssueWorkflowState(issueId, 'resolved');
        
        // Update progress
        this.renderProgress();
        
        // Show notification
        this.showNotification(`Issue ${issueId} resolved successfully`, 'success');
    }

    /**
     * Close an issue
     */
    closeIssue(issueId) {
        const issueCard = document.querySelector(`[data-issue-id="${issueId}"]`);
        if (!issueCard) return;
        
        // Update workflow state
        this.updateIssueWorkflowState(issueId, 'closed');
        
        // Update progress
        this.renderProgress();
        
        // Show notification
        this.showNotification(`Issue ${issueId} closed`, 'info');
    }

    /**
     * Reopen an issue
     */
    reopenIssue(issueId) {
        const issueCard = document.querySelector(`[data-issue-id="${issueId}"]`);
        if (!issueCard) return;
        
        // Update workflow state
        this.updateIssueWorkflowState(issueId, 'open');
        
        // Update progress
        this.renderProgress();
        
        // Show notification
        this.showNotification(`Issue ${issueId} reopened`, 'warning');
    }

    /**
     * Update issue workflow state
     */
    updateIssueWorkflowState(issueId, newState) {
        const issue = this.filteredIssues.find(i => i.id === issueId);
        if (issue) {
            issue.workflowState = newState;
            this.renderIssues();
            this.renderSummary();
        }
    }

    /**
     * Apply filters to issues
     */
    applyFilters() {
        const severityFilter = Array.from(document.getElementById('severity-filter').selectedOptions).map(opt => opt.value);
        const statusFilter = Array.from(document.getElementById('status-filter').selectedOptions).map(opt => opt.value);
        const typeFilter = Array.from(document.getElementById('type-filter').selectedOptions).map(opt => opt.value);
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        
        this.filteredIssues = this.data.filter(issue => {
            const matchesSeverity = severityFilter.length === 0 || severityFilter.includes(issue.severity);
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(issue.workflowState);
            const matchesType = typeFilter.length === 0 || typeFilter.includes(issue.type);
            const matchesSearch = searchTerm === '' || 
                issue.type.toLowerCase().includes(searchTerm) ||
                issue.description.toLowerCase().includes(searchTerm) ||
                issue.recommendedAction.toLowerCase().includes(searchTerm);
            
            return matchesSeverity && matchesStatus && matchesType && matchesSearch;
        });
        
        this.renderIssues();
        this.renderStats();
        this.renderSummary();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        document.getElementById('severity-filter').selectedIndex = -1;
        document.getElementById('status-filter').selectedIndex = -1;
        document.getElementById('type-filter').selectedIndex = -1;
        document.getElementById('search-input').value = '';
        
        this.filteredIssues = [...this.data];
        this.renderIssues();
        this.renderStats();
        this.renderSummary();
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        notification.textContent = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        this.refreshTimer = setInterval(async () => {
            try {
                await this.loadIssues();
            } catch (error) {
                console.error('Failed to refresh issues:', error);
            }
        }, this.options.refreshInterval);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.container.textContent = `
            <div class="issue-resolution-system">
                <div class="error-message">
                    <h3>❌ Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Refresh system data
     */
    async refresh() {
        await this.loadIssues();
    }

    /**
     * Export system data
     */
    exportData(_format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            totalIssues: this.data.length,
            issues: this.filteredIssues,
            statistics: this.calculateStats(),
            filters: this.filters
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `issue-resolution-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy system and cleanup
     */
    destroy() {
        this.stopAutoRefresh();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('issue-resolution-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IssueResolutionSystem;
} else if (typeof window !== 'undefined') {
    window.IssueResolutionSystem = IssueResolutionSystem;
}
