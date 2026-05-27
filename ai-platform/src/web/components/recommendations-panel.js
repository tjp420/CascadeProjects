/**
 * Recommendations Panel Component
 * Displays and manages GGUF AI optimization recommendations
 */

class RecommendationsPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.recommendations = [];
        this.filteredRecommendations = [];
        this.selectedRecommendations = new Set();
        this.filters = {
            priority: '',
            status: '',
            impact: ''
        };
        this.sortBy = 'priority';
        this.sortOrder = 'asc';
        
        this.init();
    }

    init() {
        this.render();
        this.loadRecommendations();
        this.setupEventListeners();
    }

    render() {
        this.container.textContent = `
            <div class="recommendations-panel-container">
                <div class="panel-header">
                    <div class="header-title">
                        <h3>
                            <i class="fas fa-lightbulb"></i>
                            Optimization Recommendations
                        </h3>
                        <div class="recommendations-summary">
                            <span class="total-recommendations" id="totalRecommendations">0 recommendations</span>
                            <span class="selected-count" id="selectedRecCount" style="display: none /* Replaced innerHTML with textContent for safety */">
                                <span id="selectedRecNumber">0</span> selected
                            </span>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-sm btn-outline-success" onclick="recommendationsPanel.implementSelected()">
                            <i class="fas fa-play"></i>
                            Implement Selected
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="recommendationsPanel.exportRecommendations()">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="recommendationsPanel.refreshRecommendations()">
                            <i class="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Filters Bar -->
                <div class="filters-bar">
                    <div class="filter-group">
                        <label for="priorityFilter">Priority</label>
                        <select id="priorityFilter" class="form-select form-select-sm">
                            <option value="">All Priorities</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="statusFilter">Status</label>
                        <select id="statusFilter" class="form-select form-select-sm">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="impactFilter">Impact</label>
                        <select id="impactFilter" class="form-select form-select-sm">
                            <option value="">All Impacts</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                    
                    <button class="btn btn-sm btn-outline-secondary clear-filters" onclick="recommendationsPanel.clearFilters()">
                        <i class="fas fa-times"></i>
                        Clear Filters
                    </button>
                </div>

                <!-- Recommendations Grid -->
                <div class="recommendations-grid-container">
                    <div class="recommendations-grid" id="recommendationsGrid">
                        <!-- Recommendations will be rendered here -->
                    </div>
                    
                    <!-- Loading State -->
                    <div class="loading-state" id="recommendationsLoading" style="display: none;">
                        <div class="spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <p>Loading recommendations...</p>
                    </div>
                    
                    <!-- Empty State -->
                    <div class="empty-state" id="recommendationsEmpty" style="display: none;">
                        <div class="empty-icon">
                            <i class="fas fa-trophy"></i>
                        </div>
                        <h3>All Recommendations Complete!</h3>
                        <p>Great job! All optimization recommendations have been implemented.</p>
                    </div>
                </div>

                <!-- Implementation Queue -->
                <div class="implementation-queue" id="implementationQueue" style="display: none;">
                    <div class="queue-header">
                        <h4>
                            <i class="fas fa-tasks"></i>
                            Implementation Queue
                        </h4>
                        <button class="btn btn-sm btn-outline-secondary" onclick="recommendationsPanel.clearQueue()">
                            Clear Queue
                        </button>
                    </div>
                    <div class="queue-items" id="queueItems">
                        <!-- Queue items will be rendered here -->
                    </div>
                    <div class="queue-actions">
                        <button class="btn btn-success" onclick="recommendationsPanel.executeQueue()">
                            <i class="fas fa-play"></i>
                            Execute Queue
                        </button>
                        <button class="btn btn-outline-secondary" onclick="recommendationsPanel.pauseQueue()">
                            <i class="fas fa-pause"></i>
                            Pause
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Filter change listeners
        document.getElementById('priorityFilter').addEventListener('change', (e) => {
            this.filters.priority = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('impactFilter').addEventListener('change', (e) => {
            this.filters.impact = e.target.value;
            this.applyFilters();
        });
    }

    async loadRecommendations() {
        this.showLoading(true);
        
        try {
            if (window.ggufDataService) {
                this.recommendations = window.ggufDataService.getRecommendations();
            } else {
                const response = await fetch('/api/gguf/recommendations');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const rawData = await response.json();
                this.recommendations = this.transformRecommendations(rawData);
            }
            
            this.applyFilters();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading recommendations:', error);
            this.showError('Failed to load recommendations data');
            this.showLoading(false);
        }
    }

    transformRecommendations(rawData) {
        return rawData.map((rec, index) => ({
            id: rec.id || `rec_${index + 1}`,
            priority: rec.priority || 'medium',
            action: rec.action || 'Unknown action',
            description: rec.description || 'No description available',
            potentialSavings: rec.potentialSavings || 'Unknown',
            impact: rec.impact || 'Medium',
            status: rec.status || 'pending',
            progress: rec.progress || 0,
            estimatedEffort: rec.estimatedEffort || '1-2 hours',
            dependencies: rec.dependencies || [],
            createdAt: rec.createdAt || new Date().toISOString(),
            completedAt: rec.completedAt || null
        }));
    }

    applyFilters() {
        this.filteredRecommendations = this.recommendations.filter(rec => {
            // Priority filter
            if (this.filters.priority && rec.priority !== this.filters.priority) {
                return false;
            }
            
            // Status filter
            if (this.filters.status && rec.status !== this.filters.status) {
                return false;
            }
            
            // Impact filter
            if (this.filters.impact && rec.impact !== this.filters.impact) {
                return false;
            }
            
            return true;
        });
        
        this.sortRecommendations();
        this.renderRecommendations();
        this.updateSummary();
    }

    sortRecommendations() {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        const statusOrder = { pending: 1, in_progress: 2, completed: 3 };
        
        this.filteredRecommendations.sort((a, b) => {
            let aVal, bVal;
            
            switch (this.sortBy) {
                case 'priority':
                    aVal = priorityOrder[a.priority] || 999;
                    bVal = priorityOrder[b.priority] || 999;
                    break;
                case 'status':
                    aVal = statusOrder[a.status] || 999;
                    bVal = statusOrder[b.status] || 999;
                    break;
                case 'impact':
                    aVal = a.impact;
                    bVal = b.impact;
                    break;
                default:
                    aVal = a[this.sortBy];
                    bVal = b[this.sortBy];
            }
            
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

    renderRecommendations() {
        const grid = document.getElementById('recommendationsGrid');
        const emptyState = document.getElementById('recommendationsEmpty');
        
        if (this.filteredRecommendations.length === 0) {
            grid.textContent = '' /* Replaced innerHTML with textContent for safety */
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        grid.textContent = this.filteredRecommendations.map(rec => `
            <div class="recommendation-card priority-${rec.priority} status-${rec.status}" data-rec-id="${rec.id}">
                <div class="card-header">
                    <div class="card-title">
                        <div class="priority-indicator">
                            <span class="priority-badge priority-${rec.priority}">
                                ${rec.priority.toUpperCase()}
                            </span>
                        </div>
                        <h4>${rec.action}</h4>
                    </div>
                    <div class="card-actions">
                        <input type="checkbox" class="rec-checkbox" 
                               data-rec-id="${rec.id}" 
                               onchange="recommendationsPanel.toggleRecommendationSelection('${rec.id}')">
                    </div>
                </div>
                
                <div class="card-content">
                    <div class="description">
                        <p>${rec.description}</p>
                    </div>
                    
                    <div class="metrics">
                        <div class="metric-item">
                            <label>Impact:</label>
                            <span class="impact-badge impact-${rec.impact.toLowerCase()}">${rec.impact}</span>
                        </div>
                        <div class="metric-item">
                            <label>Potential Savings:</label>
                            <span class="savings-badge">${rec.potentialSavings}</span>
                        </div>
                        <div class="metric-item">
                            <label>Estimated Effort:</label>
                            <span class="effort-badge">${rec.estimatedEffort}</span>
                        </div>
                    </div>
                    
                    <div class="progress-section">
                        <div class="progress-header">
                            <label>Progress:</label>
                            <span class="progress-text">${rec.progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${rec.progress}%"></div>
                        </div>
                    </div>
                    
                    <div class="status-section">
                        <label>Status:</label>
                        <select class="status-select" onchange="recommendationsPanel.updateRecommendationStatus('${rec.id}', this.value)">
                            <option value="pending" ${rec.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${rec.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${rec.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                </div>
                
                <div class="card-footer">
                    <div class="card-meta">
                        <span class="created-date">
                            <i class="fas fa-calendar"></i>
                            Created: ${new Date(rec.createdAt).toLocaleDateString()}
                        </span>
                        ${rec.completedAt ? `
                            <span class="completed-date">
                                <i class="fas fa-check-circle"></i>
                                Completed: ${new Date(rec.completedAt).toLocaleDateString()}
                            </span>
                        ` : ''}
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="recommendationsPanel.viewRecommendationDetails('${rec.id}')"
                                title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" 
                                onclick="recommendationsPanel.implementRecommendation('${rec.id}')"
                                title="Implement"
                                ${rec.status === 'completed' ? 'disabled' : ''}>
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" 
                                onclick="recommendationsPanel.addToQueue('${rec.id}')"
                                title="Add to Queue"
                                ${rec.status === 'completed' ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    updateSummary() {
        const totalRecs = this.filteredRecommendations.length;
        const selectedCount = this.selectedRecommendations.size;
        
        document.getElementById('totalRecommendations').textContent = `${totalRecs} recommendations`;
        
        const selectedCountElement = document.getElementById('selectedRecCount');
        if (selectedCount > 0) {
            selectedCountElement.style.display = 'inline-flex';
            document.getElementById('selectedRecNumber').textContent = selectedCount;
        } else {
            selectedCountElement.style.display = 'none';
        }
    }

    toggleRecommendationSelection(recId) {
        if (this.selectedRecommendations.has(recId)) {
            this.selectedRecommendations.delete(recId);
        } else {
            this.selectedRecommendations.add(recId);
        }
        
        this.updateSummary();
    }

    async updateRecommendationStatus(recId, status) {
        try {
            if (window.ggufDataService) {
                const success = await window.ggufDataService.updateRecommendationProgress(recId, status === 'completed' ? 100 : 50);
                if (success) {
                    this.showNotification('Recommendation status updated successfully', 'success');
                    // Update local data
                    const rec = this.recommendations.find(r => r.id === recId);
                    if (rec) {
                        rec.status = status;
                        rec.progress = status === 'completed' ? 100 : (status === 'in_progress' ? 50 : 0);
                        if (status === 'completed') {
                            rec.completedAt = new Date().toISOString();
                        }
                    }
                    this.applyFilters();
                } else {
                    this.showNotification('Failed to update recommendation status', 'error');
                }
            } else {
                // Fallback API call
                const response = await fetch(`/api/gguf/recommendations/${recId}/progress`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ progress: status === 'completed' ? 100 : 50 })
                });
                
                if (response.ok) {
                    this.showNotification('Recommendation status updated successfully', 'success');
                    this.loadRecommendations();
                } else {
                    this.showNotification('Failed to update recommendation status', 'error');
                }
            }
        } catch (error) {
            console.error('Error updating recommendation status:', error);
            this.showNotification('Error updating recommendation status', 'error');
        }
    }

    showRecommendationDetails(recId) {
        const rec = this.recommendations.find(r => r.id === recId);
        if (!rec) return;
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="recommendationDetailsModal" tabindex="-1" aria-labelledby="recommendationDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content" style="background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                        <div class="modal-header">
                            <h5 class="modal-title" id="recommendationDetailsModalLabel">
                                <i class="fas fa-lightbulb"></i>
                                ${rec.action}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Recommendation Details</h6>
                                    <p><strong>Priority:</strong> <span class="badge bg-${this.getPriorityColor(rec.priority)}">${rec.priority.toUpperCase()}</span></p>
                                    <p><strong>Status:</strong> <span class="badge bg-info">${rec.status.replace('_', ' ').toUpperCase()}</span></p>
                                    <p><strong>Impact:</strong> ${rec.impact}</p>
                                    <p><strong>Estimated Effort:</strong> ${rec.estimatedEffort}</p>
                                    <p><strong>Created At:</strong> ${new Date(rec.createdAt).toLocaleString()}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Implementation Progress</h6>
                                    <div class="progress mb-3" style="height: 25px;">
                                        <div class="progress-bar bg-${this.getProgressColor(rec.progress)}" style="width: ${rec.progress}%; height: 25px;">
                                            <span class="progress-text">${rec.progress}% Complete</span>
                                        </div>
                                    </div>
                                    <p><strong>Description:</strong></p>
                                    <p>${rec.description}</p>
                                    
                                    <h6>Potential Savings:</h6>
                                    <p><strong>${rec.potentialSavings}</strong></p>
                                </div>
                            </div>
                            
                            <div class="row mt-3">
                                <div class="col-12">
                                    <h6>Implementation Steps</h6>
                                    <div class="implementation-steps">
                                        <div class="step ${rec.progress >= 100 ? 'completed' : rec.progress >= 50 ? 'in-progress' : 'pending'}">
                                            <div class="step-number">1</div>
                                            <div class="step-content">
                                                <h6>Planning Phase</h6>
                                                <p>Analyze requirements and create implementation plan</p>
                                            </div>
                                        </div>
                                        <div class="step ${rec.progress >= 100 ? 'completed' : rec.progress >= 50 ? 'in-progress' : 'pending'}">
                                            <div class="step-number">2</div>
                                            <div class="step-content">
                                                <h6>Implementation Phase</h6>
                                                <p>Execute changes according to the plan</p>
                                            </div>
                                        </div>
                                        <div class="step ${rec.progress >= 100 ? 'completed' : 'pending'}">
                                            <div class="step-number">3</div>
                                            <div class="step-content">
                                                <h6>Validation Phase</h6>
                                                <p>Test and validate the implemented changes</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            ${rec.status === 'pending' ? `
                                <button type="button" class="btn btn-primary" onclick="recommendationsPanel.startImplementation('${recId}')">
                                    <i class="fas fa-play"></i> Start Implementation
                                </button>
                            ` : ''}
                            ${rec.status === 'in_progress' ? `
                                <button type="button" class="btn btn-success" onclick="recommendationsPanel.completeImplementation('${recId}')">
                                    <i class="fas fa-check"></i> Mark Complete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('recommendationDetailsModal'));
        modal.show();
        
        // Remove modal from DOM after hidden
        document.getElementById('recommendationDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    startImplementation(recId) {
        const rec = this.recommendations.find(r => r.id === recId);
        if (!rec) return;
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('recommendationDetailsModal')).hide();
        
        // Start implementation workflow
        this.updateRecommendationStatus(recId, 'in_progress');
        
        this.showNotification(`Started implementation for: ${rec.action}`, 'info');
    }
    
    completeImplementation(recId) {
        const rec = this.recommendations.find(r => r.id === recId);
        if (!rec) return;
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('recommendationDetailsModal')).hide();
        
        // Complete implementation
        this.updateRecommendationStatus(recId, 'completed');
        
        this.showNotification(`Completed implementation: ${rec.action}`, 'success');
    }
    
    getPriorityColor(priority) {
        const colors = {
            'high': 'danger',
            'medium': 'warning',
            'low': 'success'
        };
        return colors[priority] || 'secondary';
    }
    
    getProgressColor(progress) {
        if (progress >= 100) return 'success';
        if (progress >= 50) return 'info';
        return 'secondary';
    }

    viewRecommendationDetails(recId) {
        const rec = this.recommendations.find(r => r.id === recId);
        if (!rec) return;
        
        // Create modal with recommendation details
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.textContent = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Recommendation Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="recommendation-details">
                            <div class="detail-row">
                                <label>Recommendation ID:</label>
                                <span>${rec.id}</span>
                            </div>
                            <div class="detail-row">
                                <label>Priority:</label>
                                <span class="priority-badge priority-${rec.priority}">${rec.priority.toUpperCase()}</span>
                            </div>
                            <div class="detail-row">
                                <label>Status:</label>
                                <span class="status-badge status-${rec.status}">${rec.status}</span>
                            </div>
                            <div class="detail-row">
                                <label>Impact:</label>
                                <span class="impact-badge impact-${rec.impact.toLowerCase()}">${rec.impact}</span>
                            </div>
                            <div class="detail-row">
                                <label>Action:</label>
                                <h5>${rec.action}</h5>
                            </div>
                            <div class="detail-row">
                                <label>Description:</label>
                                <p>${rec.description}</p>
                            </div>
                            <div class="detail-row">
                                <label>Potential Savings:</label>
                                <span class="savings-badge">${rec.potentialSavings}</span>
                            </div>
                            <div class="detail-row">
                                <label>Estimated Effort:</label>
                                <span>${rec.estimatedEffort}</span>
                            </div>
                            <div class="detail-row">
                                <label>Progress:</label>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${rec.progress}%"></div>
                                </div>
                                <span>${rec.progress}%</span>
                            </div>
                            <div class="detail-row">
                                <label>Created At:</label>
                                <span>${new Date(rec.createdAt).toLocaleString()}</span>
                            </div>
                            ${rec.completedAt ? `
                                <div class="detail-row">
                                    <label>Completed At:</label>
                                    <span>${new Date(rec.completedAt).toLocaleString()}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-success" onclick="recommendationsPanel.implementRecommendation('${recId}')"
                                ${rec.status === 'completed' ? 'disabled' : ''}>
                            <i class="fas fa-play"></i>
                            Implement
                        </button>
                        <button type="button" class="btn btn-primary" onclick="recommendationsPanel.addToQueue('${recId}')"
                                ${rec.status === 'completed' ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i>
                            Add to Queue
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

    implementRecommendation(recId) {
        const rec = this.recommendations.find(r => r.id === recId);
        if (!rec) return;
        
        this.showNotification(`Starting implementation of: ${rec.action}`, 'info');
        this.updateRecommendationStatus(recId, 'in_progress');
        
        // Simulate implementation progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            this.updateRecommendationProgress(recId, progress);
            
            if (progress >= 100) {
                clearInterval(interval);
                this.updateRecommendationStatus(recId, 'completed');
                this.showNotification(`Successfully implemented: ${rec.action}`, 'success');
            }
        }, 500);
    }

    async updateRecommendationProgress(recId, progress) {
        // Update local data
        const rec = this.recommendations.find(r => r.id === recId);
        if (rec) {
            rec.progress = progress;
            this.applyFilters();
        }
    }

    addToQueue(recId) {
        const rec = this.recommendations.find(r => r.id === recId);
        if (!rec) return;
        
        this.showNotification(`Added to queue: ${rec.action}`, 'info');
        this.showQueue();
        // Add to queue logic
    }

    showQueue() {
        const queueElement = document.getElementById('implementationQueue');
        queueElement.style.display = 'block';
    }

    clearQueue() {
        const queueElement = document.getElementById('implementationQueue');
        queueElement.style.display = 'none';
        document.getElementById('queueItems').textContent = '' /* Replaced innerHTML with textContent for safety */
    }

    executeQueue() {
        this.showNotification('Executing implementation queue...', 'info');
        // Execute queue logic
    }

    pauseQueue() {
        this.showNotification('Queue paused', 'info');
        // Pause queue logic
    }

    implementSelected() {
        if (this.selectedRecommendations.size === 0) {
            this.showNotification('No recommendations selected', 'warning');
            return;
        }
        
        this.showNotification(`Implementing ${this.selectedRecommendations.size} selected recommendations`, 'info');
        
        // Implement each selected recommendation
        this.selectedRecommendations.forEach(recId => {
            this.implementRecommendation(recId);
        });
        
        // Clear selection
        this.selectedRecommendations.clear();
        this.updateSummary();
    }

    exportRecommendations() {
        const data = this.filteredRecommendations.map(rec => ({
            id: rec.id,
            priority: rec.priority,
            action: rec.action,
            description: rec.description,
            potentialSavings: rec.potentialSavings,
            impact: rec.impact,
            status: rec.status,
            progress: rec.progress,
            estimatedEffort: rec.estimatedEffort,
            createdAt: rec.createdAt,
            completedAt: rec.completedAt
        }));
        
        const csv = this.convertToCSV(data);
        this.downloadCSV(csv, 'gguf-recommendations-export.csv');
        
        this.showNotification('Recommendations exported successfully', 'success');
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
            priority: '',
            status: '',
            impact: ''
        };
        
        document.getElementById('priorityFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('impactFilter').value = '';
        
        this.applyFilters();
    }

    refreshRecommendations() {
        this.loadRecommendations();
    }

    showLoading(show) {
        const loadingElement = document.getElementById('recommendationsLoading');
        const gridElement = document.getElementById('recommendationsGrid');
        
        if (show) {
            loadingElement.style.display = 'block';
            gridElement.style.display = 'none';
        } else {
            loadingElement.style.display = 'none';
            gridElement.style.display = 'grid';
        }
    }

    showError(message) {
        const grid = document.getElementById('recommendationsGrid');
        grid.textContent = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                ${message}
            </div>
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationsPanel;
} else {
    window.RecommendationsPanel = RecommendationsPanel;
}
