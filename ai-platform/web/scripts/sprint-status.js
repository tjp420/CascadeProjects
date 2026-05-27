// Sprint Status Management
console.log('🏃 Sprint Status module loading...');

// Sprint data
const sprintData = {
    currentSprint: {
        id: 'SPR-2024-03',
        name: 'Q2 Feature Enhancement',
        startDate: '2024-05-06',
        endDate: '2024-05-20',
        status: 'active',
        progress: 85,
        tasks: {
            total: 12,
            completed: 10,
            inProgress: 2,
            blocked: 0,
        },
    },
    sprints: [
        {
            id: 'SPR-2024-03',
            name: 'Q2 Feature Enhancement',
            startDate: '2024-05-06',
            endDate: '2024-05-20',
            status: 'active',
            progress: 85,
            tasks: {
                total: 12,
                completed: 10,
                inProgress: 2,
                blocked: 0,
            },
        },
        {
            id: 'SPR-2024-02',
            name: 'Security & Performance',
            startDate: '2024-04-22',
            endDate: '2024-05-05',
            status: 'completed',
            progress: 100,
            tasks: {
                total: 15,
                completed: 15,
                inProgress: 0,
                blocked: 0,
            },
        },
        {
            id: 'SPR-2024-01',
            name: 'Core Infrastructure',
            startDate: '2024-04-08',
            endDate: '2024-04-21',
            status: 'completed',
            progress: 100,
            tasks: {
                total: 18,
                completed: 18,
                inProgress: 0,
                blocked: 0,
            },
        },
    ],
    tasks: [
        {
            id: 'TASK-001',
            title: 'Implement backup system API',
            description: 'Create REST API endpoints for backup operations',
            status: 'completed',
            priority: 'high',
            assignee: 'Backend Team',
            estimatedHours: 16,
            actualHours: 14,
            sprintId: 'SPR-2024-03',
        },
        {
            id: 'TASK-002',
            title: 'Design backup UI components',
            description: 'Create user interface for backup management',
            status: 'completed',
            priority: 'high',
            assignee: 'Frontend Team',
            estimatedHours: 12,
            actualHours: 10,
            sprintId: 'SPR-2024-03',
        },
        {
            id: 'TASK-003',
            title: 'Integrate real-time progress tracking',
            description: 'Add live progress indicators for backup operations',
            status: 'in-progress',
            priority: 'medium',
            assignee: 'Frontend Team',
            estimatedHours: 8,
            actualHours: 6,
            sprintId: 'SPR-2024-03',
        },
        {
            id: 'TASK-004',
            title: 'Add backup scheduling feature',
            description: 'Implement automated backup scheduling',
            status: 'in-progress',
            priority: 'medium',
            assignee: 'Backend Team',
            estimatedHours: 10,
            actualHours: 4,
            sprintId: 'SPR-2024-03',
        },
        {
            id: 'TASK-005',
            title: 'Performance optimization',
            description: 'Optimize dashboard loading and response times',
            status: 'completed',
            priority: 'high',
            assignee: 'Full Stack Team',
            estimatedHours: 20,
            actualHours: 18,
            sprintId: 'SPR-2024-02',
        },
    ],
};

// Show sprint status
function _showSprintStatus(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-running"></i> Sprint Status
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="createNewSprint()">
                        <i class="fas fa-plus"></i> New Sprint
                    </button>
                    <button class="btn btn-secondary" onclick="refreshSprintData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <!-- Current Sprint Overview -->
            <div class="current-sprint-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">
                            ${sprintData.currentSprint.name}
                        </h3>
                        <p style="color: var(--text-secondary); margin: 0;">
                            ${sprintData.currentSprint.startDate} - ${sprintData.currentSprint.endDate}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span class="status-badge status-active">Active</span>
                        <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0; font-size: 0.9rem;">
                            ${sprintData.currentSprint.progress}% Complete
                        </p>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="color: var(--text-primary); font-size: 0.9rem;">Sprint Progress</span>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">${sprintData.currentSprint.progress}%</span>
                    </div>
                    <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${sprintData.currentSprint.progress}%; background: linear-gradient(90deg, var(--primary-color), var(--success-color)); border-radius: 4px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                
                <!-- Task Statistics -->
                <div class="task-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-primary);">
                            ${sprintData.currentSprint.tasks.total}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Tasks</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--success-color);">
                            ${sprintData.currentSprint.tasks.completed}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">
                            ${sprintData.currentSprint.tasks.inProgress}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">In Progress</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--warning-color);">
                            ${sprintData.currentSprint.tasks.blocked}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Blocked</div>
                    </div>
                </div>
            </div>
            
            <!-- Sprint Tabs -->
            <div class="sprint-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showSprintTab('current')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Current Sprint
                    </button>
                    <button class="tab-btn" onclick="showSprintTab('tasks')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Tasks
                    </button>
                    <button class="tab-btn" onclick="showSprintTab('history')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Sprint History
                    </button>
                    <button class="tab-btn" onclick="showSprintTab('burndown')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Burndown Chart
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="sprint-tab-content">
                ${getCurrentSprintContent()}
            </div>
        </div>
    `;
}

// Get current sprint content
function getCurrentSprintContent() {
    const currentTasks = sprintData.tasks.filter(
        (task) => task.sprintId === sprintData.currentSprint.id
    );

    return `
        <div class="current-sprint-tasks">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Current Sprint Tasks</h3>
            <div class="tasks-list" style="display: grid; gap: 1rem;">
                ${currentTasks
        .map(
            (task) => `
                    <div class="task-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${task.title}</h4>
                                    <span class="status-badge status-${task.status}">${task.status}</span>
                                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${task.description}</p>
                            </div>
                            <div style="text-align: right; margin-left: 1rem;">
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${task.assignee}</p>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${task.estimatedHours}h est.</p>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                                <span style="color: var(--text-secondary);">
                                    <i class="fas fa-clock"></i> ${task.actualHours}h / ${task.estimatedHours}h
                                </span>
                                <span style="color: var(--text-secondary);">
                                    <i class="fas fa-tasks"></i> ${task.id}
                                </span>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-secondary" onclick="editTask('${task.id}')">
                                    <i class="fas fa-edit"></i> Edit
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

// Show sprint tab
function _showSprintTab(tabName) {
    const content = document.getElementById('sprint-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'current':
        content.textContent = getCurrentSprintContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'tasks':
        content.textContent = getAllTasksContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'history':
        content.textContent = getSprintHistoryContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'burndown':
        content.textContent = getBurndownChartContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Get all tasks content
function getAllTasksContent() {
    return `
        <div class="all-tasks">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">All Tasks</h3>
            <div class="tasks-filter" style="margin-bottom: 1.5rem;">
                <select onchange="filterTasks(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="all">All Tasks</option>
                    <option value="completed">Completed</option>
                    <option value="in-progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                </select>
            </div>
            <div class="tasks-list" style="display: grid; gap: 1rem;">
                ${sprintData.tasks
        .map(
            (task) => `
                    <div class="task-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${task.title}</h4>
                                    <span class="status-badge status-${task.status}">${task.status}</span>
                                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${task.description}</p>
                            </div>
                            <div style="text-align: right; margin-left: 1rem;">
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${task.assignee}</p>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Sprint: ${task.sprintId}</p>
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

// Get sprint history content
function getSprintHistoryContent() {
    return `
        <div class="sprint-history">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Sprint History</h3>
            <div class="sprints-list" style="display: grid; gap: 1rem;">
                ${sprintData.sprints
        .map(
            (sprint) => `
                    <div class="sprint-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${sprint.name}</h4>
                                    <span class="status-badge status-${sprint.status}">${sprint.status}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${sprint.startDate} - ${sprint.endDate}</p>
                            </div>
                            <div style="text-align: right;">
                                <p style="color: var(--text-primary); margin: 0; font-size: 1.25rem; font-weight: bold;">${sprint.progress}%</p>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Complete</p>
                            </div>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${sprint.progress}%; background: var(--success-color); border-radius: 3px;"></div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; font-size: 0.9rem;">
                            <div style="text-align: center;">
                                <div style="color: var(--text-primary); font-weight: bold;">${sprint.tasks.total}</div>
                                <div style="color: var(--text-secondary);">Total</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--success-color); font-weight: bold;">${sprint.tasks.completed}</div>
                                <div style="color: var(--text-secondary);">Done</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--primary-color); font-weight: bold;">${sprint.tasks.inProgress}</div>
                                <div style="color: var(--text-secondary);">In Progress</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--warning-color); font-weight: bold;">${sprint.tasks.blocked}</div>
                                <div style="color: var(--text-secondary);">Blocked</div>
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

// Get burndown chart content
function getBurndownChartContent() {
    return `
        <div class="burndown-chart">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Sprint Burndown Chart</h3>
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 2rem; text-align: center;">
                <div style="height: 300px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                    <div>
                        <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Burndown chart would be rendered here</p>
                        <p style="font-size: 0.9rem;">Showing task completion rate over sprint duration</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Task operations
function _editTask(taskId) {
    console.log('Editing task:', taskId);
    alert('Task editing would be implemented here');
}

function _createNewSprint() {
    console.log('Creating new sprint');
    alert('New sprint creation would be implemented here');
}

function _refreshSprintData() {
    console.log('Refreshing sprint data');
    location.reload();
}

function _filterTasks(status) {
    console.log('Filtering tasks by status:', status);
    // Implementation would filter the task list
}

// Add styles for status badges
const sprintStatusStyle = document.createElement('style');
sprintStatusStyle.textContent = `
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-active {
    background: var(--primary-color);
    color: white;
}

.status-completed {
    background: var(--success-color);
    color: white;
}

.status-in-progress {
    background: var(--warning-color);
    color: white;
}

.status-blocked {
    background: var(--danger-color);
    color: white;
}

.priority-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
}

.priority-high {
    background: #fee2e2;
    color: #dc2626;
}

.priority-medium {
    background: #fef3c7;
    color: #d97706;
}

.priority-low {
    background: #dbeafe;
    color: #2563eb;
}
`;
document.head.appendChild(sprintStatusStyle);

console.log('✅ Sprint Status module loaded');
