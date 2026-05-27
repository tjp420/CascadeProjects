// Team Module
console.log('👥 Team module loading...');

// Mock team data
const teamData = {
    teamMembers: [
        {
            id: 'member_001',
            name: 'Sarah Chen',
            role: 'Project Manager',
            department: 'Management',
            email: 'sarah.chen@company.com',
            avatar: 'SC',
            status: 'active',
            joinDate: '2023-01-15',
            expertise: ['Project Management', 'Agile', 'Scrum', 'Team Leadership'],
            currentProjects: ['Dashboard Enhancement', 'Backup System'],
            performance: {
                productivity: 92,
                quality: 88,
                collaboration: 95,
                innovation: 85,
            },
            availability: 'full-time',
            location: 'Remote',
        },
        {
            id: 'member_002',
            name: 'Michael Rodriguez',
            role: 'Lead Developer',
            department: 'Engineering',
            email: 'michael.rodriguez@company.com',
            avatar: 'MR',
            status: 'active',
            joinDate: '2022-06-01',
            expertise: ['JavaScript', 'React', 'Node.js', 'System Architecture'],
            currentProjects: ['Dashboard Enhancement', 'Performance Optimization'],
            performance: {
                productivity: 88,
                quality: 94,
                collaboration: 82,
                innovation: 90,
            },
            availability: 'full-time',
            location: 'Hybrid',
        },
        {
            id: 'member_003',
            name: 'Emily Johnson',
            role: 'Backend Developer',
            department: 'Engineering',
            email: 'emily.johnson@company.com',
            avatar: 'EJ',
            status: 'active',
            joinDate: '2022-09-10',
            expertise: ['Python', 'FastAPI', 'Database Design', 'API Development'],
            currentProjects: ['Backup System', 'API Gateway'],
            performance: {
                productivity: 85,
                quality: 91,
                collaboration: 88,
                innovation: 87,
            },
            availability: 'full-time',
            location: 'Office',
        },
        {
            id: 'member_004',
            name: 'David Kim',
            role: 'UI/UX Designer',
            department: 'Design',
            email: 'david.kim@company.com',
            avatar: 'DK',
            status: 'active',
            joinDate: '2023-03-20',
            expertise: ['UI Design', 'UX Research', 'Prototyping', 'Figma', 'Adobe Creative Suite'],
            currentProjects: ['Dashboard Enhancement', 'Mobile App'],
            performance: {
                productivity: 90,
                quality: 87,
                collaboration: 93,
                innovation: 92,
            },
            availability: 'full-time',
            location: 'Remote',
        },
        {
            id: 'member_005',
            name: 'Lisa Wang',
            role: 'QA Engineer',
            department: 'Quality Assurance',
            email: 'lisa.wang@company.com',
            avatar: 'LW',
            status: 'active',
            joinDate: '2023-02-01',
            expertise: ['Testing', 'Automation', 'Selenium', 'Test Planning', 'Quality Assurance'],
            currentProjects: ['Quality Assurance', 'Performance Testing'],
            performance: {
                productivity: 87,
                quality: 93,
                collaboration: 85,
                innovation: 78,
            },
            availability: 'full-time',
            location: 'Hybrid',
        },
        {
            id: 'member_006',
            name: 'James Wilson',
            role: 'DevOps Engineer',
            department: 'Operations',
            email: 'james.wilson@company.com',
            avatar: 'JW',
            status: 'active',
            joinDate: '2022-11-15',
            expertise: ['DevOps', 'CI/CD', 'Docker', 'Kubernetes', 'AWS', 'Infrastructure'],
            currentProjects: ['Infrastructure', 'Cloud Integration'],
            performance: {
                productivity: 83,
                quality: 89,
                collaboration: 86,
                innovation: 84,
            },
            availability: 'full-time',
            location: 'Office',
        },
    ],
    departments: [
        {
            id: 'dept_001',
            name: 'Engineering',
            head: 'Michael Rodriguez',
            members: ['member_002', 'member_003'],
            projects: ['Dashboard Enhancement', 'Performance Optimization', 'Backup System'],
            budget: 500000,
            utilization: 85,
        },
        {
            id: 'dept_002',
            name: 'Design',
            head: 'David Kim',
            members: ['member_004'],
            projects: ['Dashboard Enhancement', 'Mobile App'],
            budget: 150000,
            utilization: 90,
        },
        {
            id: 'dept_003',
            name: 'Management',
            head: 'Sarah Chen',
            members: ['member_001'],
            projects: ['All Projects'],
            budget: 200000,
            utilization: 95,
        },
        {
            id: 'dept_004',
            name: 'Quality Assurance',
            head: 'Lisa Wang',
            members: ['member_005'],
            projects: ['Quality Assurance', 'Performance Testing'],
            budget: 120000,
            utilization: 88,
        },
        {
            id: 'dept_005',
            name: 'Operations',
            head: 'James Wilson',
            members: ['member_006'],
            projects: ['Infrastructure', 'Cloud Integration'],
            budget: 180000,
            utilization: 92,
        },
    ],
    projects: [
        {
            id: 'proj_001',
            name: 'Dashboard Enhancement',
            description: 'Complete overhaul of the AI dashboard with new features',
            status: 'active',
            startDate: '2024-04-01',
            endDate: '2024-06-30',
            team: ['member_001', 'member_002', 'member_003', 'member_004'],
            progress: 75,
            budget: 250000,
            priority: 'high',
        },
        {
            id: 'proj_002',
            name: 'Backup System',
            description: 'Advanced backup and recovery system',
            status: 'active',
            startDate: '2024-02-01',
            endDate: '2024-05-31',
            team: ['member_001', 'member_003', 'member_006'],
            progress: 85,
            budget: 180000,
            priority: 'high',
        },
        {
            id: 'proj_003',
            name: 'Performance Optimization',
            description: 'System-wide performance improvements',
            status: 'planned',
            startDate: '2024-07-01',
            endDate: '2024-09-30',
            team: ['member_002', 'member_006'],
            progress: 0,
            budget: 120000,
            priority: 'medium',
        },
    ],
    skills: [
        { name: 'JavaScript', category: 'frontend', level: 'expert', members: ['member_002'] },
        { name: 'Python', category: 'backend', level: 'expert', members: ['member_003'] },
        { name: 'React', category: 'frontend', level: 'expert', members: ['member_002'] },
        { name: 'Node.js', category: 'backend', level: 'expert', members: ['member_002'] },
        { name: 'UI Design', category: 'design', level: 'expert', members: ['member_004'] },
        { name: 'UX Research', category: 'design', level: 'advanced', members: ['member_004'] },
        { name: 'FastAPI', category: 'backend', level: 'expert', members: ['member_003'] },
        { name: 'Testing', category: 'qa', level: 'expert', members: ['member_005'] },
        { name: 'DevOps', category: 'operations', level: 'expert', members: ['member_006'] },
    ],
    activities: [
        {
            id: 'activity_001',
            type: 'milestone',
            title: 'Dashboard Beta Release',
            description: 'Beta version of enhanced dashboard released',
            timestamp: '2024-05-20T10:00:00',
            project: 'Dashboard Enhancement',
            member: 'Michael Rodriguez',
            impact: 'high',
        },
        {
            id: 'activity_002',
            type: 'achievement',
            title: 'Code Quality Improvement',
            description: 'Achieved 95% code coverage in backup system',
            timestamp: '2024-05-19T14:30:00',
            project: 'Backup System',
            member: 'Emily Johnson',
            impact: 'medium',
        },
        {
            id: 'activity_003',
            type: 'recognition',
            title: 'Employee of the Month',
            description: 'Sarah Chen recognized for outstanding project management',
            timestamp: '2024-05-15T09:00:00',
            project: 'All Projects',
            member: 'Sarah Chen',
            impact: 'high',
        },
    ],
};

// Show team
function _showTeam(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-users"></i> Team
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="addTeamMember()">
                        <i class="fas fa-user-plus"></i> Add Member
                    </button>
                    <button class="btn btn-secondary" onclick="createDepartment()">
                        <i class="fas fa-building"></i> Department
                    </button>
                    <button class="btn btn-secondary" onclick="exportTeamReport()">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
            
            <!-- Team Overview -->
            <div class="team-overview" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${teamData.teamMembers.length}</div>
                        <div class="stat-label">Team Members</div>
                        <div class="stat-change">+2 this month</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teamData.departments.length}</div>
                        <div class="stat-label">Departments</div>
                        <div class="stat-change">1 new</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teamData.projects.length}</div>
                        <div class="stat-label">Active Projects</div>
                        <div class="stat-change">2 in progress</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">87%</div>
                        <div class="stat-label">Team Utilization</div>
                        <div class="stat-change">+5% improvement</div>
                    </div>
                </div>
            </div>
            
            <!-- Team Tabs -->
            <div class="team-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showTeamTab('members')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Members
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('departments')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Departments
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('projects')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Projects
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('skills')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Skills
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('activities')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Activities
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="team-tab-content">
                ${getMembersContent()}
            </div>
        </div>
    `;
}

// Get members content
function getMembersContent() {
    return `
        <div class="team-members">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Team Members</h3>
                <div>
                    <select onchange="filterMembers(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Members</option>
                        <option value="active">Active</option>
                        <option value="remote">Remote</option>
                        <option value="office">Office</option>
                        <option value="hybrid">Hybrid</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" onclick="refreshTeamData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="members-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                ${teamData.teamMembers
        .map(
            (member) => `
                    <div class="member-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem;">
                            <div class="member-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--success-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                                ${member.avatar}
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${member.name}</h4>
                                    <span class="status-badge status-${member.status}">${member.status}</span>
                                    <span class="availability-badge availability-${member.availability}">${member.availability}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${member.role} • ${member.department}</p>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${member.email}</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Expertise:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${member.expertise
        .map(
            (skill) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${skill}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${member.performance.productivity}%</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Productivity</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${member.performance.quality}%</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Quality</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${member.performance.collaboration}%</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Collaboration</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${member.performance.innovation}%</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Innovation</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                <i class="fas fa-calendar"></i> Joined: ${formatDate(member.joinDate)}
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewMemberProfile('${member.id}')">
                                    <i class="fas fa-user"></i> Profile
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="sendMessage('${member.id}')">
                                    <i class="fas fa-envelope"></i> Message
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

// Get departments content
function getDepartmentsContent() {
    return `
        <div class="team-departments">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Departments</h3>
                <button class="btn btn-primary" onclick="createDepartment()">
                    <i class="fas fa-plus"></i> Create Department
                </button>
            </div>
            
            <div class="departments-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                ${teamData.departments
        .map(
            (dept) => `
                    <div class="department-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${dept.name}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Head: ${dept.head}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">${dept.members.length}</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Members</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Current Projects:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${dept.projects
        .map(
            (project) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${project}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">$${dept.budget.toLocaleString()}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Budget</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${dept.utilization}%</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Utilization</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewDepartmentDetails('${dept.id}')">
                                    <i class="fas fa-info-circle"></i> Details
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="editDepartment('${dept.id}')">
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

// Get projects content
function getProjectsContent() {
    return `
        <div class="team-projects">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Team Projects</h3>
                <button class="btn btn-primary" onclick="createProject()">
                    <i class="fas fa-plus"></i> Create Project
                </button>
            </div>
            
            <div class="projects-list" style="display: grid; gap: 1.5rem;">
                ${teamData.projects
        .map(
            (project) => `
                    <div class="project-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${project.name}</h4>
                                    <span class="status-badge status-${project.status}">${project.status.toUpperCase()}</span>
                                    <span class="priority-badge priority-${project.priority}">${project.priority}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${project.description}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">${project.progress}%</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Progress</p>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div style="margin-bottom: 1rem;">
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${project.progress}%; background: ${getProjectProgressColor(project.progress)}; border-radius: 4px;"></div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${project.team.length}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Team Size</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">$${project.budget.toLocaleString()}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Budget</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatDate(project.startDate)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Start Date</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatDate(project.endDate)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">End Date</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                <i class="fas fa-users"></i> Team: ${project.team.map((id) => getMemberName(id)).join(', ')}
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewProjectDetails('${project.id}')">
                                    <i class="fas fa-info-circle"></i> Details
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="editProject('${project.id}')">
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

// Get skills content
function getSkillsContent() {
    return `
        <div class="team-skills">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Team Skills Matrix</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                ${teamData.skills
        .map(
            (skill) => `
                    <div class="skill-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${skill.name}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${skill.category}</p>
                            </div>
                            <span class="skill-badge level-${skill.level}">${skill.level.toUpperCase()}</span>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Team Members:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${skill.members
        .map(
            (memberId) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${getMemberName(memberId)}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                ${skill.members.length} team members have this skill
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="viewSkillDetails('${skill.name}')">
                                <i class="fas fa-chart-bar"></i> Analytics
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

// Get activities content
function getActivitiesContent() {
    return `
        <div class="team-activities">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Recent Activities</h3>
            
            <div class="activities-list" style="display: grid; gap: 1rem;">
                ${teamData.activities
        .map(
            (activity) => `
                    <div class="activity-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${getActivityColor(activity.type)};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${activity.title}</h4>
                                    <span class="activity-badge type-${activity.type}">${activity.type}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${activity.description}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatTimestamp(activity.timestamp)}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                                <span style="color: var(--text-secondary);">
                                    <i class="fas fa-user"></i> ${getMemberName(activity.member)}
                                </span>
                                <span style="color: var(--text-secondary);">
                                    <i class="fas fa-project"></i> ${activity.project}
                                </span>
                                <span style="color: ${getImpactColor(activity.impact)};">
                                    <i class="fas fa-star"></i> ${activity.impact} impact
                                </span>
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

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function getMemberName(memberId) {
    const member = teamData.teamMembers.find((m) => m.id === memberId);
    return member ? member.name : 'Unknown';
}

function getProjectProgressColor(progress) {
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

function _getSkillLevelColor(level) {
    switch (level) {
    case 'expert':
        return 'var(--success-color)';
    case 'advanced':
        return 'var(--primary-color)';
    case 'intermediate':
        return 'var(--warning-color)';
    case 'beginner':
        return 'var(--danger-color)';
    default:
        return 'var(--text-secondary)';
    }
}

function getActivityColor(type) {
    switch (type) {
    case 'milestone':
        return 'var(--success-color)';
    case 'achievement':
        return 'var(--primary-color)';
    case 'recognition':
        return 'var(--warning-color)';
    default:
        return 'var(--text-secondary)';
    }
}

function getImpactColor(impact) {
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
function _showTeamTab(tabName) {
    const content = document.getElementById('team-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.team-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'members':
        content.textContent = getMembersContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'departments':
        content.textContent = getDepartmentsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'projects':
        content.textContent = getProjectsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'skills':
        content.textContent = getSkillsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'activities':
        content.textContent = getActivitiesContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function _addTeamMember() {
    console.log('Adding new team member...');
    alert('Team member creation form would be shown here');
}

function _createDepartment() {
    console.log('Creating new department...');
    alert('Department creation wizard would be shown here');
}

function _exportTeamReport() {
    console.log('Exporting team report...');
    alert('Team report would be exported as PDF/Excel with all team analytics');
}

function _filterMembers(filter) {
    console.log('Filtering members:', filter);
    alert(`Team members would be filtered to show only ${filter} members`);
}

function _refreshTeamData() {
    console.log('Refreshing team data...');
    alert('Team data would be refreshed from the system');
}

function _viewMemberProfile(memberId) {
    console.log('Viewing member profile:', memberId);
    alert(`Detailed profile for team member ${memberId} would be shown here`);
}

function _sendMessage(memberId) {
    console.log('Sending message to:', memberId);
    alert(`Message composer for team member ${memberId} would be shown here`);
}

function _viewDepartmentDetails(deptId) {
    console.log('Viewing department details:', deptId);
    alert(`Detailed information for department ${deptId} would be shown here`);
}

function _editDepartment(deptId) {
    console.log('Editing department:', deptId);
    alert(`Department ${deptId} editing interface would be shown here`);
}

function _createProject() {
    console.log('Creating new project...');
    alert('Project creation wizard would be shown here');
}

function _viewProjectDetails(projectId) {
    console.log('Viewing project details:', projectId);
    alert(`Detailed information for project ${projectId} would be shown here`);
}

function _editProject(projectId) {
    console.log('Editing project:', projectId);
    alert(`Project ${projectId} editing interface would be shown here`);
}

function _viewSkillDetails(skillName) {
    console.log('Viewing skill details:', skillName);
    alert(`Skill analytics for ${skillName} would be shown here`);
}

// Add styles for team badges
if (!document.getElementById('team-styles')) {
    const style = document.createElement('style');
    style.id = 'team-styles';
    style.textContent = `
.status-badge {
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

.status-inactive {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-secondary);
}

.availability-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.availability-full-time {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.availability-part-time {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.availability-remote {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.availability-office {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.availability-hybrid {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
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

.skill-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.level-expert {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.level-advanced {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.level-intermediate {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.level-beginner {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.activity-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.type-milestone {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.type-achievement {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.type-recognition {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.member-card:hover {
    background: var(--bg-primary);
    cursor: pointer;
}

.department-card:hover {
    background: var(--bg-primary);
    cursor: pointer;
}

.project-card:hover {
    background: var(--bg-primary);
    cursor: pointer;
}

.skill-card:hover {
    background: var(--bg-primary);
    cursor: pointer;
}

.activity-card:hover {
    background: var(--bg-primary);
    cursor: pointer;
}
`;
    document.head.appendChild(style);
}

console.log('✅ Team module loaded');
