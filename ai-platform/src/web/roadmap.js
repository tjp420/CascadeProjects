// Roadmap Module
console.log('🗺️ Roadmap module loading...');

// Mock roadmap data
const roadmapData = {
    currentQuarter: 'Q2 2024',
    quarters: [
        {
            id: 'q1_2024',
            name: 'Q1 2024',
            startDate: '2024-01-01',
            endDate: '2024-03-31',
            status: 'completed',
            progress: 100,
            milestones: [
                {
                    id: 'm1',
                    title: 'Dashboard Foundation',
                    description: 'Core dashboard infrastructure and basic components',
                    completed: true,
                    completedDate: '2024-01-15',
                    priority: 'high',
                },
                {
                    id: 'm2',
                    title: 'Backup System Integration',
                    description: 'Initial backup functionality and API integration',
                    completed: true,
                    completedDate: '2024-02-20',
                    priority: 'high',
                },
                {
                    id: 'm3',
                    title: 'Performance Monitoring',
                    description: 'Basic performance metrics and monitoring',
                    completed: true,
                    completedDate: '2024-03-10',
                    priority: 'medium',
                },
            ],
        },
        {
            id: 'q2_2024',
            name: 'Q2 2024',
            startDate: '2024-04-01',
            endDate: '2024-06-30',
            status: 'active',
            progress: 85,
            milestones: [
                {
                    id: 'm4',
                    title: 'Advanced Analytics',
                    description: 'Complexity analysis and code quality metrics',
                    completed: true,
                    completedDate: '2024-04-15',
                    priority: 'high',
                },
                {
                    id: 'm5',
                    title: 'Enhanced Backup Features',
                    description: 'Advanced backup scheduling and automation',
                    completed: true,
                    completedDate: '2024-05-10',
                    priority: 'high',
                },
                {
                    id: 'm6',
                    title: 'Debug Tools Suite',
                    description: 'Comprehensive debugging and diagnostic tools',
                    completed: true,
                    completedDate: '2024-05-20',
                    priority: 'medium',
                },
                {
                    id: 'm9',
                    title: 'Mock Data System Enhancement',
                    description:
            'Export consolidation, lifecycle documentation, version control, and templates',
                    completed: true,
                    completedDate: '2024-05-20',
                    priority: 'high',
                },
                {
                    id: 'm7',
                    title: 'Reporting System',
                    description: 'Advanced reporting and analytics dashboard',
                    completed: false,
                    completedDate: null,
                    priority: 'high',
                    targetDate: '2024-06-15',
                },
                {
                    id: 'm8',
                    title: 'Mobile Optimization',
                    description: 'Responsive design and mobile app integration',
                    completed: false,
                    completedDate: null,
                    priority: 'medium',
                    targetDate: '2024-06-30',
                },
            ],
        },
        {
            id: 'q3_2024',
            name: 'Q3 2024',
            startDate: '2024-07-01',
            endDate: '2024-09-30',
            status: 'planned',
            progress: 0,
            milestones: [
                {
                    id: 'm10',
                    title: 'Mock Data Security Enhancement',
                    description: 'Implement clearly identifiable test data and security isolation',
                    completed: false,
                    completedDate: null,
                    priority: 'high',
                    targetDate: '2024-07-15',
                },
                {
                    id: 'm11',
                    title: 'Mock Data Performance Optimization',
                    description: 'Implement lazy loading and caching for mock data',
                    completed: false,
                    completedDate: null,
                    priority: 'medium',
                    targetDate: '2024-08-15',
                },
                {
                    id: 'm12',
                    title: 'AI-Powered Insights',
                    description: 'Machine learning integration for predictive analytics',
                    completed: false,
                    completedDate: null,
                    priority: 'high',
                    targetDate: '2024-07-31',
                },
                {
                    id: 'm13',
                    title: 'Enterprise Features',
                    description: 'Multi-tenant support and enterprise security',
                    completed: false,
                    completedDate: null,
                    priority: 'high',
                    targetDate: '2024-08-31',
                },
                {
                    id: 'm14',
                    title: 'API Gateway',
                    description: 'Centralized API management and documentation',
                    completed: false,
                    completedDate: null,
                    priority: 'medium',
                    targetDate: '2024-09-15',
                },
            ],
        },
        {
            id: 'q4_2024',
            name: 'Q4 2024',
            startDate: '2024-10-01',
            endDate: '2024-12-31',
            status: 'planned',
            progress: 0,
            milestones: [
                {
                    id: 'm15',
                    title: 'Mock Data Hardcoded Value Reduction',
                    description: 'Replace hardcoded values with generated test data',
                    completed: false,
                    completedDate: null,
                    priority: 'medium',
                    targetDate: '2024-10-15',
                },
                {
                    id: 'm16',
                    title: 'Mock Data Comprehensive Documentation',
                    description: 'Add detailed documentation for all mock data structures',
                    completed: false,
                    completedDate: null,
                    priority: 'medium',
                    targetDate: '2024-11-15',
                },
                {
                    id: 'm17',
                    title: 'Mock Data Cleanup',
                    description: 'Remove unused mock data from archives and deprecated files',
                    completed: false,
                    completedDate: null,
                    priority: 'low',
                    targetDate: '2024-12-01',
                },
                {
                    id: 'm18',
                    title: 'Cloud Integration',
                    description: 'AWS/Azure integration and cloud deployment',
                    completed: false,
                    completedDate: null,
                    priority: 'high',
                    targetDate: '2024-10-31',
                },
                {
                    id: 'm19',
                    title: 'Advanced Security',
                    description: 'Zero-trust security model and compliance',
                    completed: false,
                    completedDate: null,
                    priority: 'high',
                    targetDate: '2024-11-30',
                },
                {
                    id: 'm20',
                    title: 'Performance Optimization',
                    description: 'System-wide performance optimization and scaling',
                    completed: false,
                    completedDate: null,
                    priority: 'medium',
                    targetDate: '2024-12-15',
                },
            ],
        },
    ],
    initiatives: [
        {
            id: 'init_001',
            name: 'Digital Transformation',
            description: 'Complete digital transformation of development processes',
            status: 'active',
            progress: 65,
            startDate: '2024-01-01',
            targetDate: '2024-12-31',
            owner: 'CTO Office',
            milestones: ['m1', 'm2', 'm4', 'm5', 'm7', 'm9', 'm10', 'm12'],
        },
        {
            id: 'init_002',
            name: 'Security Enhancement',
            description: 'Comprehensive security overhaul and compliance',
            status: 'active',
            progress: 45,
            startDate: '2024-04-01',
            targetDate: '2024-12-31',
            owner: 'Security Team',
            milestones: ['m3', 'm6', 'm11', 'm13'],
        },
        {
            id: 'init_003',
            name: 'Performance Excellence',
            description: 'System-wide performance optimization initiative',
            status: 'planned',
            progress: 0,
            startDate: '2024-07-01',
            targetDate: '2024-12-31',
            owner: 'Engineering Team',
            milestones: ['m8', 'm12', 'm14'],
        },
    ],
    dependencies: [
        {
            id: 'dep_001',
            from: 'm4',
            to: 'm9',
            type: 'technical',
            description: 'Analytics foundation required for AI insights',
        },
        {
            id: 'dep_002',
            from: 'm5',
            to: 'm12',
            type: 'technical',
            description: 'Backup system needed for cloud integration',
        },
        {
            id: 'dep_003',
            from: 'm7',
            to: 'm11',
            type: 'technical',
            description: 'Reporting data needed for API gateway',
        },
    ],
    risks: [
        {
            id: 'risk_001',
            title: 'Resource Constraints',
            description: 'Limited development resources may impact timeline',
            probability: 'medium',
            impact: 'high',
            mitigation: 'Prioritize critical features, consider additional resources',
        },
        {
            id: 'risk_002',
            title: 'Technical Debt',
            description: 'Accumulated technical debt may slow development',
            probability: 'high',
            impact: 'medium',
            mitigation: 'Regular refactoring sprints, code review improvements',
        },
        {
            id: 'risk_003',
            title: 'Market Changes',
            description: 'Market requirements may shift during development',
            probability: 'low',
            impact: 'medium',
            mitigation: 'Regular market analysis, flexible architecture',
        },
    ],
};

// Show roadmap
function showRoadmap(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-route"></i> Roadmap
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="addMilestone()">
                        <i class="fas fa-plus"></i> Add Milestone
                    </button>
                    <button class="btn btn-secondary" onclick="editTimeline()">
                        <i class="fas fa-edit"></i> Edit Timeline
                    </button>
                    <button class="btn btn-secondary" onclick="exportRoadmap()">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <!-- Current Quarter Overview -->
            <div class="quarter-overview" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: var(--text-primary); margin: 0;">Current Quarter: ${roadmapData.currentQuarter}</h3>
                    <span class="status-badge status-active">Active</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-tasks" style="color: var(--primary-color);"></i>
                        <span style="color: var(--text-secondary);">Progress:</span>
                        <span style="color: var(--text-primary); font-weight: bold;">75%</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-flag-checkered" style="color: var(--success-color);"></i>
                        <span style="color: var(--text-secondary);">Completed:</span>
                        <span style="color: var(--text-primary); font-weight: bold;">3/5</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-calendar" style="color: var(--warning-color);"></i>
                        <span style="color: var(--text-secondary);">Remaining:</span>
                        <span style="color: var(--text-primary); font-weight: bold;">41 days</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
                        <span style="color: var(--text-secondary);">Risks:</span>
                        <span style="color: var(--text-primary); font-weight: bold;">2</span>
                    </div>
                </div>
            </div>
            
            <!-- Roadmap Tabs -->
            <div class="roadmap-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showRoadmapTab('timeline')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Timeline
                    </button>
                    <button class="tab-btn" onclick="showRoadmapTab('milestones')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Milestones
                    </button>
                    <button class="tab-btn" onclick="showRoadmapTab('initiatives')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Initiatives
                    </button>
                    <button class="tab-btn" onclick="showRoadmapTab('risks')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Risks
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="roadmap-tab-content">
                ${getTimelineContent()}
            </div>
        </div>
    `;
}

// Get timeline content
function getTimelineContent() {
    return `
        <div class="roadmap-timeline">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Quarterly Timeline</h3>
                <div>
                    <select onchange="filterTimeline(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Quarters</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="planned">Planned</option>
                    </select>
                </div>
            </div>
            
            <div class="timeline-container" style="display: grid; gap: 2rem;">
                ${roadmapData.quarters
        .map(
            (quarter, index) => `
                    <div class="quarter-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${quarter.name}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${quarter.startDate} - ${quarter.endDate}</p>
                            </div>
                            <div style="text-align: right;">
                                <span class="status-badge status-${quarter.status}">${quarter.status.toUpperCase()}</span>
                                <p style="color: var(--text-primary); font-weight: bold; margin: 0.5rem 0 0 0;">${quarter.progress}%</p>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div style="margin-bottom: 1.5rem;">
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${quarter.progress}%; background: ${getQuarterProgressColor(quarter.progress)}; border-radius: 4px; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                        
                        <!-- Milestones -->
                        <div class="milestones-list" style="display: grid; gap: 1rem;">
                            ${quarter.milestones
        .map(
            (milestone) => `
                                <div class="milestone-item" style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid ${getMilestoneColor(milestone.priority)};">
                                    <div style="margin-top: 0.25rem;">
                                        ${
    milestone.completed
        ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>'
        : '<i class="fas fa-circle" style="color: var(--text-secondary);"></i>'
}
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                            <h5 style="color: var(--text-primary); margin: 0;">${milestone.title}</h5>
                                            <span class="priority-badge priority-${milestone.priority}">${milestone.priority}</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${milestone.description}</p>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                            <span style="color: var(--text-secondary); font-size: 0.8rem;">
                                                ${
    milestone.completed
        ? `Completed: ${formatDate(milestone.completedDate)}`
        : milestone.targetDate
            ? `Target: ${formatDate(milestone.targetDate)}`
            : 'No target date'
}
                                            </span>
                                            <button class="btn btn-sm btn-secondary" onclick="viewMilestoneDetails('${milestone.id}')">
                                                <i class="fas fa-info-circle"></i> Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `
        )
        .join('')}
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get milestones content
function getMilestonesContent() {
    const allMilestones = roadmapData.quarters.flatMap((q) => q.milestones);

    return `
        <div class="milestones-view">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">All Milestones</h3>
                <div>
                    <select onchange="sortMilestones(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="priority">Sort by Priority</option>
                        <option value="status">Sort by Status</option>
                        <option value="date">Sort by Date</option>
                    </select>
                </div>
            </div>
            
            <div class="milestones-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                ${allMilestones
        .map(
            (milestone) => `
                    <div class="milestone-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${milestone.title}</h4>
                                    <span class="priority-badge priority-${milestone.priority}">${milestone.priority}</span>
                                    ${
    milestone.completed
        ? '<span class="status-badge status-completed">COMPLETED</span>'
        : '<span class="status-badge status-pending">PENDING</span>'
}
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${milestone.description}</p>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">
                                ${
    milestone.completed
        ? `✅ ${formatDate(milestone.completedDate)}`
        : milestone.targetDate
            ? `🎯 ${formatDate(milestone.targetDate)}`
            : '📅 No target date'
}
                            </span>
                            <button class="btn btn-sm btn-secondary" onclick="editMilestone('${milestone.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get initiatives content
function getInitiativesContent() {
    return `
        <div class="initiatives-view">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Strategic Initiatives</h3>
                <button class="btn btn-primary" onclick="createInitiative()">
                    <i class="fas fa-plus"></i> New Initiative
                </button>
            </div>
            
            <div class="initiatives-list" style="display: grid; gap: 1.5rem;">
                ${roadmapData.initiatives
        .map(
            (initiative) => `
                    <div class="initiative-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${initiative.name}</h4>
                                    <span class="status-badge status-${initiative.status}">${initiative.status.toUpperCase()}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${initiative.description}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: ${getInitiativeProgressColor(initiative.progress)};">${initiative.progress}%</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Progress</p>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div style="margin-bottom: 1rem;">
                            <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${initiative.progress}%; background: ${getInitiativeProgressColor(initiative.progress)}; border-radius: 3px;"></div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatDate(initiative.startDate)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Start Date</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatDate(initiative.targetDate)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Target Date</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${initiative.owner}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Owner</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                ${initiative.milestones.length} milestones assigned
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="viewInitiativeDetails('${initiative.id}')">
                                <i class="fas fa-info-circle"></i> Details
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get risks content
function getRisksContent() {
    return `
        <div class="risks-view">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Risk Assessment</h3>
                <button class="btn btn-primary" onclick="addRisk()">
                    <i class="fas fa-exclamation-triangle"></i> Add Risk
                </button>
            </div>
            
            <div class="risks-list" style="display: grid; gap: 1rem;">
                ${roadmapData.risks
        .map(
            (risk) => `
                    <div class="risk-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${getRiskColor(risk.impact)};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${risk.title}</h4>
                                    <span class="risk-badge risk-${risk.probability}">${risk.probability}</span>
                                    <span class="risk-badge impact-${risk.impact}">${risk.impact}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${risk.description}</p>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-primary); border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
                            <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Mitigation Strategy</h5>
                            <p style="color: var(--text-secondary); margin: 0;">${risk.mitigation}</p>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="editRisk('${risk.id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="monitorRisk('${risk.id}')">
                                    <i class="fas fa-eye"></i> Monitor
                                </button>
                            </div>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
            
            <!-- Dependencies -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Dependencies</h4>
                <div style="display: grid; gap: 1rem;">
                    ${roadmapData.dependencies
        .map(
            (dep) => `
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-arrow-right" style="color: var(--primary-color);"></i>
                                <span style="color: var(--text-primary); font-weight: 500;">${dep.from}</span>
                                <span style="color: var(--text-secondary);">→</span>
                                <span style="color: var(--text-primary); font-weight: 500;">${dep.to}</span>
                            </div>
                            <div style="flex: 1;">
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">${dep.description}</span>
                            </div>
                            <span class="dependency-badge type-${dep.type}">${dep.type}</span>
                        </div>
                    `
        )
        .join('')}
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getQuarterProgressColor(progress) {
    if (progress === 100) {
        return 'var(--success-color)';
    }
    if (progress >= 75) {
        return 'var(--primary-color)';
    }
    if (progress >= 50) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getMilestoneColor(priority) {
    switch (priority) {
    case 'high':
        return 'var(--danger-color)';
    case 'medium':
        return 'var(--warning-color)';
    case 'low':
        return 'var(--success-color)';
    default:
        return 'var(--text-secondary)';
    }
}

function getInitiativeProgressColor(progress) {
    if (progress >= 75) {
        return 'var(--success-color)';
    }
    if (progress >= 50) {
        return 'var(--primary-color)';
    }
    if (progress >= 25) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getRiskColor(impact) {
    switch (impact) {
    case 'high':
        return 'var(--danger-color)';
    case 'medium':
        return 'var(--warning-color)';
    case 'low':
        return 'var(--success-color)';
    default:
        return 'var(--text-secondary)';
    }
}

// Tab switching
function showRoadmapTab(tabName) {
    const content = document.getElementById('roadmap-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.roadmap-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'timeline':
        content.textContent = getTimelineContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'milestones':
        content.textContent = getMilestonesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'initiatives':
        content.textContent = getInitiativesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'risks':
        content.textContent = getRisksContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function addMilestone() {
    console.log('Adding new milestone...');
    alert('Milestone creation wizard would be shown here');
}

function editTimeline() {
    console.log('Editing timeline...');
    alert('Timeline editing interface would be shown here');
}

function exportRoadmap() {
    console.log('Exporting roadmap...');
    alert('Roadmap would be exported as PDF/Excel with all timeline data');
}

function filterTimeline(filter) {
    console.log('Filtering timeline:', filter);
    alert(`Timeline would be filtered to show only ${filter} quarters`);
}

function viewMilestoneDetails(milestoneId) {
    console.log('Viewing milestone details:', milestoneId);
    alert(`Detailed information for milestone ${milestoneId} would be shown here`);
}

function sortMilestones(sortBy) {
    console.log('Sorting milestones by:', sortBy);
    alert(`Milestones would be sorted by ${sortBy}`);
}

function editMilestone(milestoneId) {
    console.log('Editing milestone:', milestoneId);
    alert(`Milestone ${milestoneId} editing interface would be shown here`);
}

function createInitiative() {
    console.log('Creating new initiative...');
    alert('Strategic initiative creation wizard would be shown here');
}

function viewInitiativeDetails(initiativeId) {
    console.log('Viewing initiative details:', initiativeId);
    alert(`Detailed information for initiative ${initiativeId} would be shown here`);
}

function addRisk() {
    console.log('Adding new risk...');
    alert('Risk assessment form would be shown here');
}

function editRisk(riskId) {
    console.log('Editing risk:', riskId);
    alert(`Risk ${riskId} editing interface would be shown here`);
}

function monitorRisk(riskId) {
    console.log('Monitoring risk:', riskId);
    alert(`Risk ${riskId} monitoring dashboard would be shown here`);
}

// Add styles for roadmap badges
if (!document.getElementById('roadmap-styles')) {
    const style = document.createElement('style');
    style.id = 'roadmap-styles';
    style.textContent = `
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-active {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.status-completed {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-planned {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-pending {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-secondary);
}

.priority-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.priority-high {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.priority-medium {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.priority-low {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.risk-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.risk-high {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.risk-medium {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.risk-low {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.impact-high {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.impact-medium {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.impact-low {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.dependency-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.type-technical {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.type-business {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.milestone-item:hover {
    background: var(--bg-primary);
    cursor: pointer;
}
`;
    document.head.appendChild(style);
}

console.log('✅ Roadmap module loaded');
