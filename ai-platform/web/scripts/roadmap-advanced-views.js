// Roadmap Advanced Views System
// Provides Gantt chart, Kanban board, and other advanced visualizations

class RoadmapAdvancedViews {
    constructor() {
        this.currentView = 'timeline';
        this.milestones = [];
        this.settings = null;
        this.ganttChart = null;
        this.kanbanBoard = null;
        
        this.init();
    }

    init() {
        console.log('✅ Roadmap advanced views initialized');
    }

    // Gantt Chart View
    renderGanttChart(container, milestones) {
        this.milestones = milestones;
        
        container.textContent = `
            <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin: 0;">📊 Gantt Chart View</h3>
                    <div style="display: flex; gap: 1rem;">
                        <button onclick="zoomGanttChart('in')" style="padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            🔍+
                        </button>
                        <button onclick="zoomGanttChart('out')" style="padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            🔍-
                        </button>
                        <button onclick="exportGanttChart()" style="padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            📥 Export
                        </button>
                    </div>
                </div>
                
                <div id="gantt-chart-container" style="position: relative; overflow-x: auto; overflow-y: auto; max-height: 600px; border: 1px solid var(--border-color); border-radius: 8px;">
                    ${this.generateGanttChartHTML(milestones)}
                </div>
                
                <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📈 Critical Path Analysis</h4>
                    <div id="critical-path-info">
                        ${this.generateCriticalPathAnalysis(milestones)}
                    </div>
                </div>
            </div>
        `;
        
        this.initializeGanttInteractions();
    }

    generateGanttChartHTML(milestones) {
        if (milestones.length === 0) {
            return '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No milestones to display</div>';
        }

        // Calculate date range
        const dates = milestones.map(m => new Date(m.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // Add padding to date range
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 7);
        
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
        const dayWidth = Math.max(30, 1200 / totalDays); // Minimum 30px per day
        
        // Generate timeline header
        let timelineHTML = '<div style="display: flex; border-bottom: 2px solid var(--border-color); background: var(--bg-secondary); position: sticky; top: 0; z-index: 10;">';
        timelineHTML += '<div style="width: 200px; padding: 1rem; font-weight: 500; color: var(--text-primary); border-right: 1px solid var(--border-color);">Milestone</div>';
        
        // Month headers
        const currentMonth = new Date(minDate);
        while (currentMonth <= maxDate) {
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
            const monthDays = Math.min(Math.ceil((monthEnd - monthStart) / (1000 * 60 * 60 * 24)), totalDays);
            const monthWidth = monthDays * dayWidth;
            
            timelineHTML += `
                <div style="width: ${monthWidth}px; padding: 0.5rem; text-align: center; border-right: 1px solid var(--border-color); color: var(--text-primary); font-weight: 500;">
                    ${currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
            `;
            
            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        
        timelineHTML += '</div>';
        
        // Generate milestone rows
        let milestonesHTML = '';
        
        milestones.forEach((milestone, _index) => {
            const milestoneDate = new Date(milestone.date);
            const daysFromStart = Math.floor((milestoneDate - minDate) / (1000 * 60 * 60 * 24));
            const leftPosition = daysFromStart * dayWidth;
            
            // Status colors
            const statusColors = {
                'completed': 'var(--success-color)',
                'in-progress': 'var(--primary-color)',
                'planned': 'var(--warning-color)',
                'delayed': 'var(--danger-color)'
            };
            
            const statusColor = statusColors[milestone.status] || 'var(--text-secondary)';
            
            milestonesHTML += `
                <div style="display: flex; border-bottom: 1px solid var(--border-color); min-height: 60px; align-items: center;" data-milestone-id="${milestone.id}">
                    <div style="width: 200px; padding: 0.75rem; border-right: 1px solid var(--border-color);">
                        <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.25rem;">${milestone.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${milestone.team}</div>
                        <div style="margin-top: 0.25rem;">
                            <span style="padding: 0.2rem 0.5rem; background: ${statusColor}; color: white; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
                                ${milestone.status}
                            </span>
                        </div>
                    </div>
                    
                    <div style="position: relative; height: 40px; width: ${totalDays * dayWidth}px;" class="gantt-timeline">
                        <!-- Grid lines -->
                        ${this.generateGridLines(totalDays, dayWidth)}
                        
                        <!-- Milestone bar -->
                        <div style="
                            position: absolute;
                            left: ${leftPosition}px;
                            top: 50%;
                            transform: translateY(-50%);
                            width: 8px;
                            height: 8px;
                            background: ${statusColor};
                            border-radius: 50%;
                            cursor: pointer;
                            z-index: 5;
                        " 
                        class="gantt-milestone"
                        data-milestone-id="${milestone.id}"
                        title="${milestone.name}: ${milestone.date}">
                        </div>
                        
                        <!-- Progress bar if in progress -->
                        ${milestone.status === 'in-progress' ? `
                            <div style="
                                position: absolute;
                                left: ${leftPosition}px;
                                top: 50%;
                                transform: translateY(-50%);
                                width: 100px;
                                height: 4px;
                                background: var(--bg-secondary);
                                border-radius: 2px;
                            ">
                                <div style="
                                    width: ${milestone.progress}%;
                                    height: 100%;
                                    background: ${statusColor};
                                    border-radius: 2px;
                                "></div>
                            </div>
                        ` : ''}
                        
                        <!-- Milestone label -->
                        <div style="
                            position: absolute;
                            left: ${leftPosition + 10}px;
                            top: 5px;
                            font-size: 0.7rem;
                            color: var(--text-secondary);
                            white-space: nowrap;
                        ">
                            ${milestone.date}
                        </div>
                    </div>
                </div>
            `;
        });
        
        return timelineHTML + milestonesHTML;
    }

    generateGridLines(totalDays, dayWidth) {
        let gridHTML = '';
        for (let i = 0; i <= totalDays; i += 7) { // Weekly grid lines
            gridHTML += `
                <div style="
                    position: absolute;
                    left: ${i * dayWidth}px;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: var(--border-color);
                    opacity: 0.3;
                "></div>
            `;
        }
        return gridHTML;
    }

    generateCriticalPathAnalysis(milestones) {
        // Simple critical path calculation based on dependencies and dates
        const completedMilestones = milestones.filter(m => m.status === 'completed');
        const inProgressMilestones = milestones.filter(m => m.status === 'in-progress');
        const delayedMilestones = milestones.filter(m => m.status === 'delayed');
        
        const criticalPath = milestones
            .filter(m => m.priority === 'high' && (m.status === 'in-progress' || m.status === 'planned'))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--success-color);">${completedMilestones.length}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary-color);">${inProgressMilestones.length}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">In Progress</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--danger-color);">${delayedMilestones.length}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Delayed</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--warning-color);">${criticalPath.length}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Critical Path</div>
                </div>
            </div>
            
            ${criticalPath.length > 0 ? `
                <div style="margin-top: 1rem;">
                    <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem;">Critical Path Items:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${criticalPath.map(m => `
                            <span style="padding: 0.25rem 0.5rem; background: var(--bg-secondary); border-radius: 4px; font-size: 0.8rem; color: var(--text-primary);">
                                ${m.name}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    initializeGanttInteractions() {
        // Add drag and drop functionality
        const milestones = document.querySelectorAll('.gantt-milestone');
        milestones.forEach(milestone => {
            milestone.addEventListener('click', (e) => {
                const milestoneId = e.target.dataset.milestoneId;
                this.showMilestoneDetails(milestoneId);
            });
            
            // Make draggable
            milestone.draggable = true;
            milestone.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('milestoneId', e.target.dataset.milestoneId);
                e.target.style.opacity = '0.5';
            });
            
            milestone.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
            });
        });
        
        // Setup drop zones
        const timeline = document.querySelector('.gantt-timeline');
        if (timeline) {
            timeline.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.currentTarget.style.background = 'var(--bg-secondary)';
            });
            
            timeline.addEventListener('dragleave', (e) => {
                e.currentTarget.style.background = '';
            });
            
            timeline.addEventListener('drop', (e) => {
                e.preventDefault();
                e.currentTarget.style.background = '';
                
                const milestoneId = e.dataTransfer.getData('milestoneId');
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                
                // Calculate new date based on drop position
                const newDate = this.calculateDateFromPosition(x, rect.width);
                this.updateMilestoneDate(milestoneId, newDate);
            });
        }
    }

    calculateDateFromPosition(position, totalWidth) {
        // Simple calculation - in real implementation would use actual date range
        const today = new Date();
        const daysOffset = Math.floor((position / totalWidth) * 365);
        const newDate = new Date(today);
        newDate.setDate(today.getDate() + daysOffset);
        return newDate.toISOString().split('T')[0];
    }

    updateMilestoneDate(milestoneId, newDate) {
        console.log(`Updating milestone ${milestoneId} to ${newDate}`);
        
        // Update local storage
        if (window.roadmapStorage) {
            const milestones = window.roadmapStorage.loadMilestones();
            const milestone = milestones.find(m => m.id === milestoneId);
            if (milestone) {
                milestone.date = newDate;
                milestone.updatedAt = new Date().toISOString();
                window.roadmapStorage.saveMilestones(milestones);
                
                // Refresh view
                if (window.refreshRoadmap) {
                    window.refreshRoadmap();
                }
                
                // Show notification
                if (window.showNotification) {
                    window.showNotification(`Milestone date updated to ${newDate}`, 'success');
                }
            }
        }
    }

    showMilestoneDetails(milestoneId) {
        const milestones = window.roadmapStorage ? window.roadmapStorage.loadMilestones() : [];
        const milestone = milestones.find(m => m.id === milestoneId);
        
        if (!milestone) {
            return;
        }
        
        // Create details modal
        const modal = document.createElement('div');
        modal.id = 'milestone-details-modal';
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
            <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin: 0;">📍 ${milestone.name}</h3>
                    <button onclick="closeMilestoneDetailsModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                        ✕
                    </button>
                </div>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Description</div>
                        <div style="color: var(--text-primary);">${milestone.description || 'No description'}</div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Target Date</div>
                            <div style="color: var(--text-primary);">${milestone.date}</div>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Team</div>
                            <div style="color: var(--text-primary);">${milestone.team}</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Priority</div>
                            <div style="color: var(--text-primary);">${milestone.priority}</div>
                        </div>
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Status</div>
                            <div style="color: var(--text-primary);">${milestone.status}</div>
                        </div>
                    </div>
                    
                    ${milestone.progress !== undefined ? `
                        <div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Progress</div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="flex: 1; height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                                    <div style="width: ${milestone.progress}%; height: 100%; background: var(--primary-color);"></div>
                                </div>
                                <span style="color: var(--text-primary); font-weight: 500;">${milestone.progress}%</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button onclick="closeMilestoneDetailsModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                        Close
                    </button>
                    <button onclick="editMilestoneFromDetails('${milestone.id}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                        Edit
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeMilestoneDetailsModal();
            }
        });
        
        // Show modal
        setTimeout(() => {
            modal.style.display = 'flex';
        }, 100);
    }

    closeMilestoneDetailsModal() {
        const modal = document.getElementById('milestone-details-modal');
        if (modal) {
            modal.style.display = 'none';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        }
    }

    // Kanban Board View
    renderKanbanBoard(container, milestones) {
        const columns = [
            { id: 'planned', title: '📋 Planned', color: 'var(--warning-color)' },
            { id: 'in-progress', title: '🔄 In Progress', color: 'var(--primary-color)' },
            { id: 'completed', title: '✅ Completed', color: 'var(--success-color)' },
            { id: 'delayed', title: '⚠️ Delayed', color: 'var(--danger-color)' }
        ];
        
        container.textContent = `
            <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin: 0;">📋 Kanban Board</h3>
                    <div style="display: flex; gap: 1rem;">
                        <button onclick="addNewMilestoneCard()" style="padding: 0.5rem 1rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                            + Add Milestone
                        </button>
                        <button onclick="exportKanbanBoard()" style="padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            📥 Export
                        </button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; overflow-x: auto;">
                    ${columns.map(column => `
                        <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem;">
                            <div style="display: flex; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid ${column.color};">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${column.color}; margin-right: 0.5rem;"></div>
                                <h4 style="color: var(--text-primary); margin: 0;">${column.title}</h4>
                                <span style="margin-left: auto; background: ${column.color}; color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">
                                    ${milestones.filter(m => m.status === column.id).length}
                                </span>
                            </div>
                            
                            <div class="kanban-column" data-status="${column.id}" style="min-height: 400px;">
                                ${this.generateKanbanCards(milestones.filter(m => m.status === column.id))}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        this.initializeKanbanInteractions();
    }

    generateKanbanCards(milestones) {
        if (milestones.length === 0) {
            return '<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">No milestones</div>';
        }
        
        return milestones.map(milestone => `
            <div class="kanban-card" draggable="true" data-milestone-id="${milestone.id}" style="
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
                cursor: move;
                transition: transform 0.2s ease;
            ">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <h5 style="color: var(--text-primary); margin: 0; font-size: 0.9rem;">${milestone.name}</h5>
                    <span style="padding: 0.2rem 0.5rem; background: var(--bg-secondary); color: var(--text-primary); border-radius: 4px; font-size: 0.7rem;">
                        ${milestone.priority}
                    </span>
                </div>
                
                <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0 0 0.75rem 0; line-height: 1.4;">
                    ${milestone.description || 'No description'}
                </p>
                
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                    <div style="color: var(--text-secondary);">
                        📅 ${milestone.date}
                    </div>
                    <div style="color: var(--text-secondary);">
                        👥 ${milestone.team}
                    </div>
                </div>
                
                ${milestone.progress !== undefined ? `
                    <div style="margin-top: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div style="flex: 1; height: 4px; background: var(--bg-secondary); border-radius: 2px; overflow: hidden;">
                                <div style="width: ${milestone.progress}%; height: 100%; background: var(--primary-color);"></div>
                            </div>
                            <span style="color: var(--text-primary); font-size: 0.7rem;">${milestone.progress}%</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    initializeKanbanInteractions() {
        // Drag and drop for kanban cards
        const cards = document.querySelectorAll('.kanban-card');
        const columns = document.querySelectorAll('.kanban-column');
        
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('milestoneId', e.target.dataset.milestoneId);
                e.target.style.opacity = '0.5';
            });
            
            card.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
            });
        });
        
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.currentTarget.style.background = 'var(--bg-secondary)';
            });
            
            column.addEventListener('dragleave', (e) => {
                e.currentTarget.style.background = '';
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                e.currentTarget.style.background = '';
                
                const milestoneId = e.dataTransfer.getData('milestoneId');
                const newStatus = e.currentTarget.dataset.status;
                
                this.updateMilestoneStatus(milestoneId, newStatus);
            });
        });
    }

    updateMilestoneStatus(milestoneId, newStatus) {
        console.log(`Updating milestone ${milestoneId} status to ${newStatus}`);
        
        // Update local storage
        if (window.roadmapStorage) {
            const milestones = window.roadmapStorage.loadMilestones();
            const milestone = milestones.find(m => m.id === milestoneId);
            if (milestone) {
                milestone.status = newStatus;
                milestone.updatedAt = new Date().toISOString();
                window.roadmapStorage.saveMilestones(milestones);
                
                // Refresh view
                if (window.refreshRoadmap) {
                    window.refreshRoadmap();
                }
                
                // Show notification
                if (window.showNotification) {
                    window.showNotification(`Milestone status updated to ${newStatus}`, 'success');
                }
            }
        }
    }
}

// Global functions for UI interactions
window.zoomGanttChart = function(direction) {
    const container = document.getElementById('gantt-chart-container');
    if (!container) {
        return;
    }
    
    const currentScale = parseFloat(container.style.transform?.replace('scale(', '')?.replace(')', '') || '1');
    const newScale = direction === 'in' ? Math.min(currentScale * 1.2, 3) : Math.max(currentScale / 1.2, 0.5);
    
    container.style.transform = `scale(${newScale})`;
    container.style.transformOrigin = 'left center';
};

window.exportGanttChart = function() {
    if (window.showNotification) {
        window.showNotification('Gantt chart export feature coming soon!', 'info');
    }
};

window.exportKanbanBoard = function() {
    if (window.showNotification) {
        window.showNotification('Kanban board export feature coming soon!', 'info');
    }
};

window.addNewMilestoneCard = function() {
    if (window.addMilestone) {
        window.addMilestone();
    }
};

window.editMilestoneFromDetails = function(_milestoneId) {
    // Close details modal and open edit modal
    const detailsModal = document.getElementById('milestone-details-modal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
        setTimeout(() => {
            document.body.removeChild(detailsModal);
        }, 300);
    }
    
    // Open edit modal (would need to implement this)
    if (window.showNotification) {
        window.showNotification('Edit milestone feature coming soon!', 'info');
    }
};

window.closeMilestoneDetailsModal = function() {
    const modal = document.getElementById('milestone-details-modal');
    if (modal) {
        modal.style.display = 'none';
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }
};

// Initialize advanced views system
const roadmapAdvancedViews = new RoadmapAdvancedViews();
window.roadmapAdvancedViews = roadmapAdvancedViews;

console.log('✅ Roadmap advanced views system loaded');
