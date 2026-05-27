/**
 * Issues Grid Component
 * Interactive interface for managing GGUF-detected issues
 */

class IssuesGrid {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.issues = [];
        this.filteredIssues = [];
        this.selectedIssues = new Set();
        this.filters = {
            severity: '',
            status: '',
            type: '',
            search: ''
        };
        this.sortBy = 'priority';
        this.sortOrder = 'asc';
        
        this.init();
    }

    init() {
        this.render();
        this.loadIssues();
        this.setupEventListeners();
    }

    render() {
        this.container.textContent = `
            <div class="issues-grid-container">
                <div class="issues-header">
                    <div class="header-title">
                        <h3>
                            <i class="fas fa-exclamation-triangle"></i>
                            Issues Management
                        </h3>
                        <div class="issues-summary">
                            <span class="total-issues" id="totalIssues">0 issues</span>
                            <span class="selected-count" id="selectedCount" style="display: none /* Replaced innerHTML with textContent for safety */">
                                <span id="selectedNumber">0</span> selected
                            </span>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="issuesGrid.bulkActions()">
                            <i class="fas fa-tasks"></i>
                            Bulk Actions
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="issuesGrid.exportIssues()">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="issuesGrid.refreshIssues()">
                            <i class="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Filters Bar -->
                <div class="filters-bar">
                    <div class="filter-group">
                        <label for="severityFilter">Severity</label>
                        <select id="severityFilter" class="form-select form-select-sm">
                            <option value="">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="statusFilter">Status</label>
                        <select id="statusFilter" class="form-select form-select-sm">
                            <option value="">All Status</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="typeFilter">Type</label>
                        <select id="typeFilter" class="form-select form-select-sm">
                            <option value="">All Types</option>
                            <option value="Schema Violation">Schema Violation</option>
                            <option value="Data Inconsistency">Data Inconsistency</option>
                            <option value="Missing Fields">Missing Fields</option>
                            <option value="Duplicate Data">Duplicate Data</option>
                        </select>
                    </div>
                    
                    <div class="filter-group search-group">
                        <label for="searchFilter">Search</label>
                        <div class="search-input">
                            <input type="text" id="searchFilter" class="form-control form-control-sm" placeholder="Search issues...">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>
                    
                    <button class="btn btn-sm btn-outline-secondary clear-filters" onclick="issuesGrid.clearFilters()">
                        <i class="fas fa-times"></i>
                        Clear Filters
                    </button>
                </div>

                <!-- Issues Table -->
                <div class="issues-table-container">
                    <div class="table-wrapper">
                        <table class="issues-table">
                            <thead>
                                <tr>
                                    <th class="checkbox-column">
                                        <input type="checkbox" id="selectAll" onchange="issuesGrid.toggleSelectAll()">
                                    </th>
                                    <th class="severity-column" onclick="issuesGrid.sortByColumn('severity')">
                                        Severity
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="type-column" onclick="issuesGrid.sortByColumn('type')">
                                        Type
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="description-column">Description</th>
                                    <th class="count-column" onclick="issuesGrid.sortByColumn('count')">
                                        Count
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="status-column" onclick="issuesGrid.sortByColumn('status')">
                                        Status
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="priority-column" onclick="issuesGrid.sortByColumn('priority')">
                                        Priority
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="actions-column">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="issuesTableBody">
                                <!-- Issues will be rendered here -->
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Loading State -->
                    <div class="loading-state" id="issuesLoading" style="display: none;">
                        <div class="spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <p>Loading issues...</p>
                    </div>
                    
                    <!-- Empty State -->
                    <div class="empty-state" id="issuesEmpty" style="display: none;">
                        <div class="empty-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h3>No Issues Found</h3>
                        <p>All mock data looks good! No issues detected.</p>
                    </div>
                </div>

                <!-- Pagination -->
                <div class="pagination-container" id="paginationContainer">
                    <div class="pagination-info">
                        <span id="paginationInfo">Showing 0 of 0 issues</span>
                    </div>
                    <div class="pagination-controls">
                        <button class="btn btn-sm btn-outline-secondary" id="prevPage" onclick="issuesGrid.previousPage()" disabled>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <div class="page-numbers" id="pageNumbers">
                            <!-- Page numbers will be rendered here -->
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" id="nextPage" onclick="issuesGrid.nextPage()" disabled>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Filter change listeners
        document.getElementById('severityFilter').addEventListener('change', (e) => {
            this.filters.severity = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('searchFilter').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });
    }

    async loadIssues() {
        this.showLoading(true);
        
        try {
            if (window.ggufDataService) {
                this.issues = window.ggufDataService.getIssues();
            } else {
                const response = await fetch('/api/gguf/issues');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                this.issues = await response.json();
            }
            
            this.applyFilters();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading issues:', error);
            this.showError('Failed to load issues data');
            this.showLoading(false);
        }
    }

    applyFilters() {
        this.filteredIssues = this.issues.filter(issue => {
            // Severity filter
            if (this.filters.severity && issue.severity !== this.filters.severity) {
                return false;
            }
            
            // Status filter
            if (this.filters.status && issue.status !== this.filters.status) {
                return false;
            }
            
            // Type filter
            if (this.filters.type && issue.type !== this.filters.type) {
                return false;
            }
            
            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                return issue.description.toLowerCase().includes(searchTerm) ||
                       issue.type.toLowerCase().includes(searchTerm) ||
                       issue.recommendedAction.toLowerCase().includes(searchTerm);
            }
            
            return true;
        });
        
        this.sortIssues();
        this.renderIssues();
        this.updateSummary();
    }

    sortIssues() {
        this.filteredIssues.sort((a, b) => {
            let aVal = a[this.sortBy];
            let bVal = b[this.sortBy];
            
            // Handle different data types
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (this.sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    sortByColumn(column) {
        if (this.sortBy === column) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortBy = column;
            this.sortOrder = 'asc';
        }
        
        this.applyFilters();
        this.updateSortIcons();
    }

    updateSortIcons() {
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon';
        });
        
        const activeIcon = document.querySelector(`th[onclick*="${this.sortBy}"] .sort-icon`);
        if (activeIcon) {
            activeIcon.className = this.sortOrder === 'asc' ? 
                'fas fa-sort-up sort-icon active' : 
                'fas fa-sort-down sort-icon active';
        }
    }

    renderIssues() {
        const tbody = document.getElementById('issuesTableBody');
        const emptyState = document.getElementById('issuesEmpty');
        
        if (this.filteredIssues.length === 0) {
            tbody.textContent = '' /* Replaced innerHTML with textContent for safety */
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        tbody.textContent = this.filteredIssues.map(issue => `
            <tr class="issue-row" data-issue-id="${issue.id}">
                <td class="checkbox-column">
                    <input type="checkbox" class="issue-checkbox" 
                           data-issue-id="${issue.id}" 
                           onchange="issuesGrid.toggleIssueSelection('${issue.id}')">
                </td>
                <td class="severity-column">
                    <span class="severity-badge severity-${issue.severity}">
                        ${issue.severity}
                    </span>
                </td>
                <td class="type-column">
                    <span class="type-badge">${issue.type}</span>
                </td>
                <td class="description-column">
                    <div class="issue-description">
                        <div class="description-text">${issue.description}</div>
                        <div class="recommended-action">
                            <i class="fas fa-lightbulb"></i>
                            ${issue.recommendedAction}
                        </div>
                    </div>
                </td>
                <td class="count-column">
                    <span class="count-badge">${issue.count}</span>
                </td>
                <td class="status-column">
                    <select class="status-select" onchange="issuesGrid.updateIssueStatus('${issue.id}', this.value)">
                        <option value="open" ${issue.status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="in_progress" ${issue.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="resolved" ${issue.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </td>
                <td class="priority-column">
                    <span class="priority-badge priority-${issue.priority}">
                        Priority ${issue.priority}
                    </span>
                </td>
                <td class="actions-column">
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="issuesGrid.viewIssueDetails('${issue.id}')"
                                title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" 
                                onclick="issuesGrid.fixIssue('${issue.id}')"
                                title="Auto Fix">
                            <i class="fas fa-wrench"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" 
                                onclick="issuesGrid.viewAffectedFiles('${issue.id}')"
                                title="View Files">
                            <i class="fas fa-file-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    updateSummary() {
        const totalIssues = this.filteredIssues.length;
        const selectedCount = this.selectedIssues.size;
        
        document.getElementById('totalIssues').textContent = `${totalIssues} issues`;
        
        const selectedCountElement = document.getElementById('selectedCount');
        if (selectedCount > 0) {
            selectedCountElement.style.display = 'inline-flex';
            document.getElementById('selectedNumber').textContent = selectedCount;
        } else {
            selectedCountElement.style.display = 'none';
        }
    }

    toggleSelectAll() {
        const selectAll = document.getElementById('selectAll');
        const checkboxes = document.querySelectorAll('.issue-checkbox');
        
        if (selectAll.checked) {
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedIssues.add(checkbox.dataset.issueId);
            });
        } else {
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            this.selectedIssues.clear();
        }
        
        this.updateSummary();
    }

    toggleIssueSelection(issueId) {
        if (this.selectedIssues.has(issueId)) {
            this.selectedIssues.delete(issueId);
        } else {
            this.selectedIssues.add(issueId);
        }
        
        this.updateSummary();
        this.updateSelectAllCheckbox();
    }

    updateSelectAllCheckbox() {
        const selectAll = document.getElementById('selectAll');
        const checkboxes = document.querySelectorAll('.issue-checkbox');
        const checkedBoxes = document.querySelectorAll('.issue-checkbox:checked');
        
        selectAll.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
        selectAll.indeterminate = checkedBoxes.length > 0 && checkboxes.length !== checkedBoxes.length;
    }

    showIssueDetails(issueId) {
        const issue = this.issues.find(i => i.id === issueId);
        if (!issue) return;
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="issueDetailsModal" tabindex="-1" aria-labelledby="issueDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content" style="background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                        <div class="modal-header">
                            <h5 class="modal-title" id="issueDetailsModalLabel">
                                <i class="fas fa-exclamation-triangle"></i>
                                Issue Details: ${issue.type}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Issue Information</h6>
                                    <p><strong>Type:</strong> ${issue.type}</p>
                                    <p><strong>Severity:</strong> <span class="badge bg-${this.getSeverityColor(issue.severity)}">${issue.severity.toUpperCase()}</span></p>
                                    <p><strong>Status:</strong> <span class="badge bg-info">${issue.status.replace('_', ' ').toUpperCase()}</span></p>
                                    <p><strong>Priority:</strong> ${issue.priority}</p>
                                    <p><strong>Count:</strong> ${issue.count} instances</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Recommended Action</h6>
                                    <p>${issue.recommendedAction}</p>
                                    
                                    <h6>Estimated Fix Time</h6>
                                    <p>${issue.estimatedFixTime || 'Not specified'}</p>
                                    
                                    <h6>Created At</h6>
                                    <p>${new Date(issue.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div class="row mt-3">
                                <div class="col-12">
                                    <h6>Description</h6>
                                    <p>${issue.description}</p>
                                </div>
                            </div>
                            
                            <div class="row mt-3">
                                <div class="col-12">
                                    <h6>Affected Files (${issue.affectedFiles.length})</h6>
                                    <div class="affected-files-list">
                                        ${issue.affectedFiles.map(file => `
                                            <div class="file-item">
                                                <i class="fas fa-file-code"></i>
                                                <code>${file}</code>
                                                <button class="btn btn-sm btn-outline-primary ms-2" onclick="issuesGrid.viewFile('${file}')">
                                                    <i class="fas fa-eye"></i> View
                                                </button>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="issuesGrid.startIssueResolution('${issueId}')">
                                <i class="fas fa-tools"></i> Start Resolution
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('issueDetailsModal'));
        modal.show();
        
        // Remove modal from DOM after hidden
        document.getElementById('issueDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    viewFile(filename) {
        this.showNotification(`Opening file: ${filename}`, 'info');
        // In a real implementation, this would open the file in an editor
        console.log('View file:', filename);
    }
    
    startIssueResolution(issueId) {
        const issue = this.issues.find(i => i.id === issueId);
        if (!issue) return;
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('issueDetailsModal')).hide();
        
        // Start resolution workflow
        this.updateIssueStatus(issueId, 'in_progress');
        
        this.showNotification(`Started resolution for ${issue.type} issue`, 'info');
    }
    
    getSeverityColor(severity) {
        const colors = {
            'critical': 'danger',
            'high': 'warning',
            'medium': 'info',
            'low': 'success'
        };
        return colors[severity] || 'secondary';
    }

    async updateIssueStatus(issueId, status) {
        try {
            if (window.ggufDataService) {
                const success = await window.ggufDataService.updateIssueStatus(issueId, status);
                if (success) {
                    this.showNotification('Issue status updated successfully', 'success');
                    // Update local data
                    const issue = this.issues.find(i => i.id === issueId);
                    if (issue) {
                        issue.status = status;
                    }
                    this.applyFilters();
                } else {
                    this.showNotification('Failed to update issue status', 'error');
                }
            } else {
                // Fallback API call
                const response = await fetch(`/api/gguf/issues/${issueId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status })
                });
                
                if (response.ok) {
                    this.showNotification('Issue status updated successfully', 'success');
                    this.loadIssues();
                } else {
                    this.showNotification('Failed to update issue status', 'error');
                }
            }
        } catch (error) {
            console.error('Error updating issue status:', error);
            this.showNotification('Error updating issue status', 'error');
        }
    }

    viewIssueDetails(issueId) {
        const issue = this.issues.find(i => i.id === issueId);
        if (!issue) return;
        
        // Create modal with issue details
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.textContent = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Issue Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="issue-details">
                            <div class="detail-row">
                                <label>Issue ID:</label>
                                <span>${issue.id}</span>
                            </div>
                            <div class="detail-row">
                                <label>Severity:</label>
                                <span class="severity-badge severity-${issue.severity}">${issue.severity}</span>
                            </div>
                            <div class="detail-row">
                                <label>Type:</label>
                                <span class="type-badge">${issue.type}</span>
                            </div>
                            <div class="detail-row">
                                <label>Status:</label>
                                <span class="status-badge status-${issue.status}">${issue.status}</span>
                            </div>
                            <div class="detail-row">
                                <label>Count:</label>
                                <span>${issue.count}</span>
                            </div>
                            <div class="detail-row">
                                <label>Priority:</label>
                                <span class="priority-badge priority-${issue.priority}">Priority ${issue.priority}</span>
                            </div>
                            <div class="detail-row">
                                <label>Description:</label>
                                <p>${issue.description}</p>
                            </div>
                            <div class="detail-row">
                                <label>Recommended Action:</label>
                                <p>${issue.recommendedAction}</p>
                            </div>
                            <div class="detail-row">
                                <label>Estimated Fix Time:</label>
                                <span>${issue.estimatedFixTime || 'Unknown'} minutes</span>
                            </div>
                            <div class="detail-row">
                                <label>Created At:</label>
                                <span>${new Date(issue.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="issuesGrid.fixIssue('${issue.id}')">
                            <i class="fas fa-wrench"></i>
                            Auto Fix
                        </button>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    fixIssue(issueId) {
        this.showNotification(`Auto-fix for issue ${issueId} initiated`, 'info');
        // Implement auto-fix logic here
    }

    viewAffectedFiles(issueId) {
        const issue = this.issues.find(i => i.id === issueId);
        if (!issue || !issue.affectedFiles || issue.affectedFiles.length === 0) {
            this.showNotification('No affected files found', 'info');
            return;
        }
        
        // Create modal with affected files
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.textContent = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Affected Files (${issue.affectedFiles.length})</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="files-list">
                            ${issue.affectedFiles.map(file => `
                                <div class="file-item">
                                    <i class="fas fa-file-code"></i>
                                    <span class="file-name">${file}</span>
                                    <button class="btn btn-sm btn-outline-primary" onclick="issuesGrid.openFile('${file}')">
                                        Open
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="issuesGrid.fixAllFiles('${issueId}')">
                            <i class="fas fa-wrench"></i>
                            Fix All Files
                        </button>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    openFile(filename) {
        this.showNotification(`Opening file: ${filename}`, 'info');
        // Implement file opening logic
    }

    fixAllFiles(issueId) {
        this.showNotification(`Fixing all files for issue ${issueId}`, 'info');
        // Implement bulk fix logic
    }

    bulkActions() {
        if (this.selectedIssues.size === 0) {
            this.showNotification('No issues selected', 'warning');
            return;
        }
        
        // Create bulk actions modal
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.textContent = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Bulk Actions (${this.selectedIssues.size} issues)</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="bulk-actions">
                            <button class="btn btn-primary" onclick="issuesGrid.bulkFix()">
                                <i class="fas fa-wrench"></i>
                                Fix All Selected
                            </button>
                            <button class="btn btn-success" onclick="issuesGrid.bulkMarkResolved()">
                                <i class="fas fa-check"></i>
                                Mark as Resolved
                            </button>
                            <button class="btn btn-warning" onclick="issuesGrid.bulkMarkInProgress()">
                                <i class="fas fa-spinner"></i>
                                Mark as In Progress
                            </button>
                            <button class="btn btn-secondary" onclick="issuesGrid.bulkReopen()">
                                <i class="fas fa-undo"></i>
                                Reopen
                            </button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    bulkFix() {
        this.showNotification(`Bulk fixing ${this.selectedIssues.size} issues`, 'info');
        // Implement bulk fix logic
    }

    bulkMarkResolved() {
        this.showNotification(`Marking ${this.selectedIssues.size} issues as resolved`, 'info');
        // Implement bulk status update
    }

    bulkMarkInProgress() {
        this.showNotification(`Marking ${this.selectedIssues.size} issues as in progress`, 'info');
        // Implement bulk status update
    }

    bulkReopen() {
        this.showNotification(`Reopening ${this.selectedIssues.size} issues`, 'info');
        // Implement bulk status update
    }

    exportIssues() {
        const data = this.filteredIssues.map(issue => ({
            id: issue.id,
            severity: issue.severity,
            type: issue.type,
            description: issue.description,
            count: issue.count,
            status: issue.status,
            priority: issue.priority,
            recommendedAction: issue.recommendedAction,
            affectedFiles: issue.affectedFiles?.join(', ') || '',
            createdAt: issue.createdAt
        }));
        
        const csv = this.convertToCSV(data);
        this.downloadCSV(csv, 'gguf-issues-export.csv');
        
        this.showNotification('Issues exported successfully', 'success');
    }

    convertToCSV(data) {
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row => 
            headers.map(header => `"${row[header] || ''}"`).join(',')
        );
        
        return [csvHeaders, ...csvRows].join('\n');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    clearFilters() {
        this.filters = {
            severity: '',
            status: '',
            type: '',
            search: ''
        };
        
        document.getElementById('severityFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('searchFilter').value = '';
        
        this.applyFilters();
    }

    refreshIssues() {
        this.loadIssues();
    }

    showLoading(show) {
        const loadingElement = document.getElementById('issuesLoading');
        const tableElement = document.querySelector('.table-wrapper');
        
        if (show) {
            loadingElement.style.display = 'block';
            tableElement.style.display = 'none';
        } else {
            loadingElement.style.display = 'none';
            tableElement.style.display = 'block';
        }
    }

    showError(message) {
        const tbody = document.getElementById('issuesTableBody');
        tbody.textContent = `
            <tr>
                <td colspan="8" class="error-cell">
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${message}
                    </div>
                </td>
            </tr>
        ` /* Replaced innerHTML with textContent for safety */
    }

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
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    previousPage() {
        // Implement pagination logic
    }

    nextPage() {
        // Implement pagination logic
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IssuesGrid;
} else {
    window.IssuesGrid = IssuesGrid;
}
