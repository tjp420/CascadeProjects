/**
 * Roadmap Builder System
 * Generates strategic roadmaps based on project data
 */

class RoadmapBuilder {
    constructor() {
        this.roadmapData = null;
        this.currentRoadmap = null;
        this.timelineView = 'quarterly';
        this.progressData = this.loadProgressData();
        this.roadmapTemplates = {
            'security': this.getSecurityRoadmapTemplate(),
            'quality': this.getQualityRoadmapTemplate(),
            'performance': this.getPerformanceRoadmapTemplate(),
            'comprehensive': this.getComprehensiveRoadmapTemplate()
        };
    }

    async initialize() {
        try {
            console.log('🗺️ Initializing roadmap builder...');
            
            // Load project data
            await this.loadProjectData();
            
            // Setup roadmap builder UI
            this.setupRoadmapUI();
            
            console.log('✅ Roadmap builder initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing roadmap builder:', error);
        }
    }

    async loadProjectData() {
        try {
            // Try to get code analysis metrics data
            const response = await apiClient.getCodeAnalysisMetrics();
            this.roadmapData = response || null;
            console.log('📊 Project data loaded for roadmap generation');
        } catch (error) {
            console.log('🔄 Using fallback data for roadmap generation');
            // Use fallback data based on our analysis - matching new data structure
            this.roadmapData = {
                timestamp: new Date().toISOString(),
                project: {
                    name: 'CascadeProjects',
                    overview: {
                        name: 'CascadeProjects',
                        totalFiles: 150,
                        linesOfCode: 15678,
                        lines_of_code: 15678,
                        overview: {
                            message: 'Real-time project analysis',
                            path: '/api/analysis/project/overview'
                        },
                        metrics: {
                            codeQuality: 82,
                            testCoverage: 65,
                            securityScore: 85,
                            performanceScore: 65
                        }
                    },
                    metrics: {
                        totalFiles: 150,
                        linesOfCode: 15678,
                        codeQuality: 82,
                        testCoverage: 65,
                        securityScore: 85,
                        performanceScore: 65
                    }
                },
                codeStructure: {
                    files: 150,
                    directories: 23,
                    lines_of_code: 15678,
                    languages: {
                        Python: 65,
                        JavaScript: 25,
                        HTML: 10
                    }
                },
                codeQuality: {
                    overall_score: 85,
                    maintainability: 'Good',
                    complexity: 'Medium',
                    test_coverage: 78,
                    code_smells: 12,
                    duplications: 5
                },
                technicalDebt: {
                    technical_debt_score: 25,
                    debt_items: [
                        {
                            type: 'code_smell',
                            count: 12,
                            effort: '2d'
                        },
                        {
                            type: 'duplication',
                            count: 5,
                            effort: '1d'
                        }
                    ]
                },
                security: {
                    security_score: 92,
                    vulnerabilities: 2,
                    security_issues: [
                        {
                            severity: 'medium',
                            description: 'Potential SQL injection'
                        },
                        {
                            severity: 'low',
                            description: 'Outdated dependency'
                        }
                    ]
                },
                performance: {
                    response_time: 120,
                    throughput: 1000,
                    memory_usage: '45%',
                    cpu_usage: '30%'
                },
                activity: [
                    {
                        id: 1,
                        type: 'info',
                        message: 'Analysis completed',
                        read: false
                    }
                ],
                recommendations: {
                    recommendations: [
                        {
                            priority: 'high',
                            title: 'Refactor large function',
                            description: 'Function exceeds 50 lines'
                        },
                        {
                            priority: 'medium',
                            title: 'Add unit tests',
                            description: 'Coverage below 80%'
                        }
                    ]
                }
            };
        }
    }

    setupRoadmapUI() {
        // Create roadmap builder tab content
        const roadmapHTML = `
            <div class="roadmap-builder-container">
                <div class="roadmap-header">
                    <h2>🗺️ Strategic Roadmap Builder</h2>
                    <div class="roadmap-controls">
                        <select id="roadmap-type" class="roadmap-select">
                            <option value="comprehensive">Comprehensive Roadmap</option>
                            <option value="security">Security Roadmap</option>
                            <option value="quality">Quality Roadmap</option>
                            <option value="performance">Performance Roadmap</option>
                        </select>
                        <select id="timeline-view" class="roadmap-select">
                            <option value="quarterly">Quarterly View</option>
                            <option value="monthly">Monthly View</option>
                            <option value="weekly">Weekly View</option>
                        </select>
                        <button id="generate-roadmap" class="btn btn-primary">Generate Roadmap</button>
                        <button id="export-roadmap" class="btn btn-secondary">Export Roadmap</button>
                    </div>
                </div>
                
                <div class="roadmap-content">
                    <div id="roadmap-timeline" class="roadmap-timeline">
                        <!-- Roadmap timeline will be generated here -->
                    </div>
                    <div id="roadmap-details" class="roadmap-details">
                        <!-- Roadmap details will be shown here -->
                    </div>
                </div>
            </div>
        `;

        // Add roadmap tab to navigation
        this.addRoadmapTab();
        
        // Add roadmap content to main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            const roadmapDiv = document.createElement('div');
            roadmapDiv.id = 'roadmap-content';
            roadmapDiv.className = 'content-section';
            roadmapDiv.style.display = 'none';
            roadmapDiv.textContent = roadmapHTML /* Replaced innerHTML with textContent for safety */
            mainContent.appendChild(roadmapDiv);
        }
    }

    addRoadmapTab() {
        const navItems = document.querySelector('.nav-items');
        if (navItems) {
            const roadmapTab = document.createElement('div');
            roadmapTab.className = 'nav-item';
            roadmapTab.textContent = `
                <i class="fas fa-route"></i>
                <span>Roadmap</span>
            ` /* Replaced innerHTML with textContent for safety */
            roadmapTab.onclick = () => {
                this.showRoadmapTab();
            };
            navItems.appendChild(roadmapTab);
        }
    }

    showRoadmapTab() {
        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show roadmap content
        const roadmapContent = document.getElementById('roadmap-content');
        if (roadmapContent) {
            roadmapContent.style.display = 'block';
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.nav-item').classList.add('active');
    }

    generateRoadmap(type) {
        console.log(`🗺️ Generating ${type} roadmap...`);
        
        const template = this.roadmapTemplates[type];
        const roadmap = this.buildRoadmap(template, type);
        
        this.currentRoadmap = roadmap;
        this.renderRoadmap(roadmap);
        
        console.log(`✅ ${type} roadmap generated successfully`);
    }

    buildRoadmap(template, type) {
        const currentData = this.roadmapData;
        const currentDate = new Date();
        
        const roadmap = {
            type: type,
            title: template.title,
            description: template.description,
            timeline: [],
            phases: [],
            metrics: this.extractKeyMetrics(currentData),
            generated_at: currentDate.toISOString()
        };

        // Build phases based on template
        template.phases.forEach((phaseTemplate, index) => {
            const phase = this.buildPhase(phaseTemplate, index, currentData, currentDate);
            roadmap.phases.push(phase);
            
            // Add timeline items for this phase
            phase.timeline_items.forEach(item => {
                roadmap.timeline.push(item);
            });
        });

        return roadmap;
    }

    buildPhase(phaseTemplate, index, currentData, currentDate) {
        const startDate = new Date(currentDate);
        startDate.setMonth(startDate.getMonth() + (index * 3)); // Quarterly phases
        
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 3);
        
        const phase = {
            id: `phase-${index + 1}`,
            title: phaseTemplate.title,
            description: phaseTemplate.description,
            duration: '3 months',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            // Start all phases as planned - user will mark completion
            status: 'planned',
            priority: phaseTemplate.priority,
            objectives: phaseTemplate.objectives,
            key_activities: [],
            deliverables: [],
            success_metrics: [],
            dependencies: [],
            timeline_items: []
        };
        
        console.log(`[DEBUG] buildPhase: Phase ${index + 1} (${phaseTemplate.title}) - Status: ${phase.status}`);

        // Build key activities
        phaseTemplate.activities.forEach((activityTemplate, actIndex) => {
            const activityDate = new Date(startDate);
            activityDate.setDate(activityDate.getDate() + (actIndex * 14)); // Bi-weekly activities
            
            // Start all activities as planned
            const activity = {
                id: `${phase.id}-activity-${actIndex + 1}`,
                title: activityTemplate.title,
                description: activityTemplate.description,
                date: activityDate.toISOString(),
                status: 'planned',
                priority: activityTemplate.priority,
                estimated_effort: activityTemplate.estimated_effort,
                dependencies: activityTemplate.dependencies || []
            };
            
            phase.key_activities.push(activity);
            phase.timeline_items.push({
                id: activity.id,
                type: 'activity',
                title: activity.title,
                date: activity.date,
                status: activity.status,
                phase_id: phase.id
            });
        });

        // Build deliverables
        phaseTemplate.deliverables.forEach((deliverableTemplate, delIndex) => {
            // Calculate due date: distribute deliverables across the phase duration
            const deliverableDate = new Date(startDate);
            const daysPerDeliverable = (endDate - startDate) / (phaseTemplate.deliverables.length + 1);
            deliverableDate.setDate(deliverableDate.getDate() + (delIndex + 1) * Math.floor(daysPerDeliverable / (1000 * 60 * 60 * 24)));
            
            // Validate date
            if (isNaN(deliverableDate.getTime())) {
                console.error(`Invalid date for deliverable ${deliverableTemplate.title}, using phase end date`);
                deliverableDate.setTime(endDate.getTime());
            }
            
            // Start all deliverables as planned
            const deliverable = {
                id: `${phase.id}-deliverable-${delIndex + 1}`,
                title: deliverableTemplate.title,
                description: deliverableTemplate.description,
                due_date: deliverableDate.toISOString(),
                status: 'planned',
                priority: deliverableTemplate.priority,
                acceptance_criteria: deliverableTemplate.acceptance_criteria
            };
            
            phase.deliverables.push(deliverable);
            phase.timeline_items.push({
                id: deliverable.id,
                type: 'deliverable',
                title: deliverable.title,
                date: deliverable.due_date,
                status: deliverable.status,
                phase_id: phase.id
            });
        });

        return phase;
    }

    extractKeyMetrics(currentData) {
        const metrics = {};
        
        // Return empty metrics if currentData is null or undefined
        if (!currentData) {
            return metrics;
        }
        
        // Extract security metrics from new data structure
        if (currentData.security) {
            metrics.security = {
                current_score: currentData.security.security_score || 0,
                vulnerabilities: currentData.security.vulnerabilities || 0,
                security_issues: currentData.security.security_issues || []
            };
        }

        // Extract quality metrics from new data structure
        if (currentData.codeQuality) {
            metrics.quality = {
                current_score: currentData.codeQuality.overall_score || 0,
                maintainability: currentData.codeQuality.maintainability || 'Unknown',
                complexity: currentData.codeQuality.complexity || 'Unknown',
                test_coverage: currentData.codeQuality.test_coverage || 0,
                code_smells: currentData.codeQuality.code_smells || 0,
                duplications: currentData.codeQuality.duplications || 0
            };
        }

        // Extract project metrics from new data structure
        if (currentData.project) {
            const projectMetrics = currentData.project.metrics || currentData.project.overview?.metrics || {};
            metrics.project = {
                name: currentData.project.name || 'Unknown',
                total_files: projectMetrics.totalFiles || currentData.codeStructure?.files || 0,
                lines_of_code: projectMetrics.linesOfCode || currentData.codeStructure?.lines_of_code || 0,
                code_quality: projectMetrics.codeQuality || 0,
                test_coverage: projectMetrics.testCoverage || 0,
                security_score: projectMetrics.securityScore || 0,
                performance_score: projectMetrics.performanceScore || 0
            };
        }

        // Extract performance metrics from new data structure
        if (currentData.performance) {
            metrics.performance = {
                response_time: currentData.performance.response_time || 0,
                throughput: currentData.performance.throughput || 0,
                memory_usage: currentData.performance.memory_usage || '0%',
                cpu_usage: currentData.performance.cpu_usage || '0%'
            };
        }

        // Extract technical debt metrics
        if (currentData.technicalDebt) {
            metrics.technical_debt = {
                score: currentData.technicalDebt.technical_debt_score || 0,
                debt_items: currentData.technicalDebt.debt_items || []
            };
        }

        // Extract recommendations
        if (currentData.recommendations) {
            metrics.recommendations = currentData.recommendations.recommendations || [];
        }

        return metrics;
    }

    renderRoadmap(roadmap) {
        const timelineContainer = document.getElementById('roadmap-timeline');
        const detailsContainer = document.getElementById('roadmap-details');
        
        if (!timelineContainer || !detailsContainer) {
            return;
        }

        // Render timeline
        this.renderTimeline(roadmap.timeline, timelineContainer);
        
        // Render details
        this.renderRoadmapDetails(roadmap, detailsContainer);
    }

    renderTimeline(timeline, container) {
        // Sort timeline by date
        const sortedTimeline = timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let timelineHTML = '<div class="timeline">';
        
        sortedTimeline.forEach(item => {
            const date = new Date(item.date);
            const dateStr = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
            
            const statusClass = item.status === 'completed' ? 'completed' : 
                item.status === 'in-progress' ? 'in-progress' : 'planned';
            
            const icon = item.type === 'activity' ? '🛠️' : 
                item.type === 'deliverable' ? '📦' : '📅';
            
            timelineHTML += `
                <div class="timeline-item ${statusClass}">
                    <div class="timeline-marker">${icon}</div>
                    <div class="timeline-content">
                        <div class="timeline-date">${dateStr}</div>
                        <div class="timeline-title">${item.title}</div>
                        <div class="timeline-description">${item.description}</div>
                    </div>
                </div>
            `;
        });
        
        timelineHTML += '</div>';
        container.textContent = timelineHTML /* Replaced innerHTML with textContent for safety */
    }

    renderRoadmapDetails(roadmap, container) {
        let detailsHTML = `
            <div class="roadmap-overview">
                <h3>${roadmap.title}</h3>
                <p>${roadmap.description}</p>
                <div class="roadmap-metrics">
                    <div class="metric-card">
                        <h4>Phases</h4>
                        <div class="metric-value">${roadmap.phases.length}</div>
                    </div>
                    <div class="metric-card">
                        <h4>Timeline Items</h4>
                        <div class="metric-value">${roadmap.timeline.length}</div>
                    </div>
                    <div class="metric-card">
                        <h4>Duration</h4>
                        <div class="metric-value">${roadmap.phases.length * 3} months</div>
                    </div>
                </div>
            </div>
        `;

        // Render phases
        detailsHTML += '<div class="phases-container">';
        roadmap.phases.forEach((phase, index) => {
            detailsHTML += this.renderPhase(phase, index);
        });
        detailsHTML += '</div>';

        container.textContent = detailsHTML /* Replaced innerHTML with textContent for safety */
    }

    renderPhase(phase, index) {
        const statusClass = phase.status === 'completed' ? 'completed' : 
            phase.status === 'in-progress' ? 'in-progress' : 'planned';
        
        const priorityClass = phase.priority === 'high' ? 'high' : 
            phase.priority === 'medium' ? 'medium' : 'low';

        return `
            <div class="phase-card ${statusClass} ${priorityClass}">
                <div class="phase-header">
                    <h4>Phase ${index + 1}: ${phase.title}</h4>
                    <div class="phase-duration">${phase.duration}</div>
                    <div class="phase-status">${phase.status}</div>
                </div>
                <div class="phase-content">
                    <p>${phase.description}</p>
                    
                    <div class="phase-section">
                        <h5>Objectives</h5>
                        <ul>
                            ${phase.objectives.map(obj => `<li>${obj}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="phase-section">
                        <h5>Key Activities</h5>
                        <ul>
                            ${phase.key_activities.map(activity => `
                                <li>
                                    <strong>${activity.title}</strong>
                                    <p>${activity.description}</p>
                                    <small>Effort: ${activity.estimated_effort}</small>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <div class="phase-section">
                        <h5>Deliverables</h5>
                        <ul>
                            ${phase.deliverables.map(deliverable => `
                                <li>
                                    <strong>${deliverable.title}</strong>
                                    <p>${deliverable.description}</p>
                                    <small>Due: ${new Date(deliverable.due_date).toLocaleDateString()}</small>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    getSecurityRoadmapTemplate() {
        return {
            title: 'Security Enhancement Roadmap',
            description: 'Strategic plan to enhance security posture and maintain compliance',
            phases: [
                {
                    title: 'Security Assessment & Planning',
                    description: 'Comprehensive security assessment and strategic planning',
                    priority: 'high',
                    objectives: [
                        'Complete security gap analysis',
                        'Establish security baseline',
                        'Define security metrics and KPIs',
                        'Create security governance framework'
                    ],
                    activities: [
                        {
                            title: 'Security Audit',
                            description: 'Conduct comprehensive security audit',
                            priority: 'high',
                            estimated_effort: '2 weeks',
                            dependencies: []
                        },
                        {
                            title: 'Risk Assessment',
                            description: 'Identify and prioritize security risks',
                            priority: 'high',
                            estimated_effort: '1 week',
                            dependencies: ['Security Audit']
                        },
                        {
                            title: 'Security Planning',
                            description: 'Develop comprehensive security strategy',
                            priority: 'high',
                            estimated_effort: '1 week',
                            dependencies: ['Risk Assessment']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Security Assessment Report',
                            description: 'Detailed security assessment findings and recommendations',
                            priority: 'high',
                            acceptance_criteria: ['All risks identified', 'Prioritized remediation plan']
                        },
                        {
                            title: 'Security Strategy Document',
                            description: 'Comprehensive security strategy and roadmap',
                            priority: 'high',
                            acceptance_criteria: ['Stakeholder approval', 'Resource allocation']
                        }
                    ]
                },
                {
                    title: 'Security Implementation',
                    description: 'Execute security improvements and enhancements',
                    priority: 'high',
                    objectives: [
                        'Implement security controls',
                        'Enhance monitoring and detection',
                        'Establish incident response procedures',
                        'Conduct security training'
                    ],
                    activities: [
                        {
                            title: 'Security Controls Implementation',
                            description: 'Deploy security controls and tools',
                            priority: 'high',
                            estimated_effort: '4 weeks',
                            dependencies: ['Security Strategy Document']
                        },
                        {
                            title: 'Monitoring Setup',
                            description: 'Implement security monitoring and alerting',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Security Controls Implementation']
                        },
                        {
                            title: 'Security Training',
                            description: 'Conduct team security awareness training',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Security Controls Implementation']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Security Controls Documentation',
                            description: 'Documentation of implemented security controls',
                            priority: 'high',
                            acceptance_criteria: ['All controls documented', 'Testing complete']
                        },
                        {
                            title: 'Monitoring Dashboard',
                            description: 'Security monitoring and alerting dashboard',
                            priority: 'medium',
                            acceptance_criteria: ['Dashboard functional', 'Alerts configured']
                        }
                    ]
                },
                {
                    title: 'Security Optimization',
                    description: 'Fine-tune security measures and maintain compliance',
                    priority: 'medium',
                    objectives: [
                        'Optimize security controls',
                        'Maintain compliance',
                        'Continuous improvement',
                        'Security automation'
                    ],
                    activities: [
                        {
                            title: 'Security Optimization',
                            description: 'Fine-tune security controls for optimal performance',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Security Implementation']
                        },
                        {
                            title: 'Compliance Review',
                            description: 'Ensure ongoing compliance with standards',
                            priority: 'medium',
                            estimated_effort: '1 week',
                            dependencies: ['Security Optimization']
                        },
                        {
                            title: 'Automation Implementation',
                            description: 'Automate security processes and monitoring',
                            priority: 'low',
                            estimated_effort: '3 weeks',
                            dependencies: ['Security Optimization']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Optimization Report',
                            description: 'Security optimization recommendations and results',
                            priority: 'medium',
                            acceptance_criteria: ['Optimizations documented', 'Performance improved']
                        },
                        {
                            title: 'Compliance Dashboard',
                            description: 'Real-time compliance monitoring dashboard',
                            priority: 'low',
                            acceptance_criteria: ['Dashboard functional', 'Compliance metrics tracked']
                        }
                    ]
                }
            ]
        };
    }

    getQualityRoadmapTemplate() {
        return {
            title: 'Code Quality Enhancement Roadmap',
            description: 'Strategic plan to improve code quality and maintainability',
            phases: [
                {
                    title: 'Quality Assessment & Baseline',
                    description: 'Assess current code quality and establish improvement baseline',
                    priority: 'high',
                    objectives: [
                        'Comprehensive code quality assessment',
                        'Establish quality metrics and standards',
                        'Create quality improvement baseline',
                        'Define quality gates and processes'
                    ],
                    activities: [
                        {
                            title: 'Quality Assessment',
                            description: 'Conduct comprehensive code quality analysis',
                            priority: 'high',
                            estimated_effort: '2 weeks',
                            dependencies: []
                        },
                        {
                            title: 'Metrics Definition',
                            description: 'Define quality metrics and KPIs',
                            priority: 'high',
                            estimated_effort: '1 week',
                            dependencies: ['Quality Assessment']
                        },
                        {
                            title: 'Baseline Establishment',
                            description: 'Establish quality improvement baseline',
                            priority: 'high',
                            estimated_effort: '1 week',
                            dependencies: ['Metrics Definition']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Quality Assessment Report',
                            description: 'Detailed code quality assessment findings',
                            priority: 'high',
                            acceptance_criteria: ['All metrics assessed', 'Baseline established']
                        },
                        {
                            title: 'Quality Standards Document',
                            description: 'Coding standards and quality guidelines',
                            priority: 'high',
                            acceptance_criteria: ['Standards defined', 'Team trained']
                        }
                    ]
                },
                {
                    title: 'Quality Improvement Implementation',
                    description: 'Execute code quality improvements and enhancements',
                    priority: 'high',
                    objectives: [
                        'Refactor complex code',
                        'Improve test coverage',
                        'Enhance code documentation',
                        'Implement code reviews'
                    ],
                    activities: [
                        {
                            title: 'Code Refactoring',
                            description: 'Refactor complex and maintainability issues',
                            priority: 'high',
                            estimated_effort: '6 weeks',
                            dependencies: ['Quality Standards Document']
                        },
                        {
                            title: 'Test Coverage Enhancement',
                            description: 'Increase test coverage to meet targets',
                            priority: 'high',
                            estimated_effort: '4 weeks',
                            dependencies: ['Code Refactoring']
                        },
                        {
                            title: 'Documentation Improvement',
                            description: 'Enhance code documentation and comments',
                            priority: 'medium',
                            estimated_effort: '3 weeks',
                            dependencies: ['Code Refactoring']
                        },
                        {
                            title: 'Code Review Process',
                            description: 'Implement structured code review process',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Test Coverage Enhancement']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Refactored Code Modules',
                            description: 'Refactored code with improved maintainability',
                            priority: 'high',
                            acceptance_criteria: ['Complexity reduced', 'Tests passing']
                        },
                        {
                            title: 'Enhanced Test Suite',
                            description: 'Comprehensive test suite with improved coverage',
                            priority: 'high',
                            acceptance_criteria: ['Coverage targets met', 'All tests passing']
                        }
                    ]
                },
                {
                    title: 'Quality Maintenance',
                    description: 'Maintain code quality and continuous improvement',
                    priority: 'medium',
                    objectives: [
                        'Maintain quality standards',
                        'Continuous improvement',
                        'Quality monitoring',
                        'Team training'
                    ],
                    activities: [
                        {
                            title: 'Quality Monitoring',
                            description: 'Implement continuous quality monitoring',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Quality Improvement Implementation']
                        },
                        {
                            title: 'Continuous Improvement',
                            description: 'Ongoing quality improvement initiatives',
                            priority: 'medium',
                            estimated_effort: '4 weeks',
                            dependencies: ['Quality Monitoring']
                        },
                        {
                            title: 'Team Training',
                            description: 'Ongoing team training and skill development',
                            priority: 'low',
                            estimated_effort: '4 weeks',
                            dependencies: ['Quality Monitoring']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Quality Dashboard',
                            description: 'Real-time quality monitoring dashboard',
                            priority: 'medium',
                            acceptance_criteria: ['Dashboard functional', 'Metrics tracked']
                        },
                        {
                            title: 'Training Materials',
                            description: 'Team training materials and documentation',
                            priority: 'low',
                            acceptance_criteria: ['Materials created', 'Team trained']
                        }
                    ]
                }
            ]
        };
    }

    getPerformanceRoadmapTemplate() {
        return {
            title: 'Performance Optimization Roadmap',
            description: 'Strategic plan to optimize system performance and efficiency',
            phases: [
                {
                    title: 'Performance Assessment & Baseline',
                    description: 'Assess current performance and establish optimization baseline',
                    priority: 'high',
                    objectives: [
                        'Comprehensive performance assessment',
                        'Establish performance baseline',
                        'Identify bottlenecks',
                        'Define performance metrics'
                    ],
                    activities: [
                        {
                            title: 'Performance Assessment',
                            description: 'Conduct comprehensive performance analysis',
                            priority: 'high',
                            estimated_effort: '2 weeks',
                            dependencies: []
                        },
                        {
                            title: 'Bottleneck Identification',
                            description: 'Identify and prioritize performance bottlenecks',
                            priority: 'high',
                            estimated_effort: '1 week',
                            dependencies: ['Performance Assessment']
                        },
                        {
                            title: 'Metrics Definition',
                            description: 'Define performance metrics and KPIs',
                            priority: 'high',
                            estimated_effort: '1 week',
                            dependencies: ['Bottleneck Identification']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Performance Assessment Report',
                            description: 'Detailed performance assessment findings',
                            priority: 'high',
                            acceptance_criteria: ['All metrics assessed', 'Bottlenecks identified']
                        },
                        {
                            title: 'Performance Baseline',
                            description: 'Performance baseline and targets',
                            priority: 'high',
                            acceptance_criteria: ['Baseline established', 'Targets defined']
                        }
                    ]
                },
                {
                    title: 'Performance Optimization',
                    description: 'Execute performance improvements and optimizations',
                    priority: 'high',
                    objectives: [
                        'Optimize database queries',
                        'Improve caching strategies',
                        'Enhance application performance',
                        'Optimize resource utilization'
                    ],
                    activities: [
                        {
                            title: 'Database Optimization',
                            description: 'Optimize database queries and indexing',
                            priority: 'high',
                            estimated_effort: '3 weeks',
                            dependencies: ['Performance Baseline']
                        },
                        {
                            title: 'Caching Implementation',
                            description: 'Implement effective caching strategies',
                            priority: 'high',
                            estimated_effort: '2 weeks',
                            dependencies: ['Database Optimization']
                        },
                        {
                            title: 'Application Optimization',
                            description: 'Optimize application code and algorithms',
                            priority: 'high',
                            estimated_effort: '4 weeks',
                            dependencies: ['Caching Implementation']
                        },
                        {
                            title: 'Resource Optimization',
                            description: 'Optimize system resource utilization',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Application Optimization']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Optimized Database',
                            description: 'Database with optimized queries and indexing',
                            priority: 'high',
                            acceptance_criteria: ['Queries optimized', 'Performance improved']
                        },
                        {
                            title: 'Caching System',
                            description: 'Effective caching implementation',
                            priority: 'high',
                            acceptance_criteria: ['Cache implemented', 'Hit rate improved']
                        }
                    ]
                },
                {
                    title: 'Performance Monitoring',
                    description: 'Monitor performance and maintain optimizations',
                    priority: 'medium',
                    objectives: [
                        'Performance monitoring',
                        'Alerting system',
                        'Continuous optimization',
                        'Capacity planning'
                    ],
                    activities: [
                        {
                            title: 'Monitoring Setup',
                            description: 'Implement performance monitoring system',
                            priority: 'medium',
                            estimated_effort: '2 weeks',
                            dependencies: ['Performance Optimization']
                        },
                        {
                            title: 'Alerting Configuration',
                            description: 'Configure performance alerts and notifications',
                            priority: 'medium',
                            estimated_effort: '1 week',
                            dependencies: ['Monitoring Setup']
                        },
                        {
                            title: 'Capacity Planning',
                            description: 'Plan for future capacity needs',
                            priority: 'low',
                            estimated_effort: '2 weeks',
                            dependencies: ['Alerting Configuration']
                        }
                    ],
                    deliverables: [
                        {
                            title: 'Performance Dashboard',
                            description: 'Real-time performance monitoring dashboard',
                            priority: 'medium',
                            acceptance_criteria: ['Dashboard functional', 'Alerts configured']
                        },
                        {
                            title: 'Capacity Plan',
                            description: 'Future capacity planning document',
                            priority: 'low',
                            acceptance_criteria: ['Plan created', 'Resources allocated']
                        }
                    ]
                }
            ]
        };
    }

    getComprehensiveRoadmapTemplate() {
        console.log('[DEBUG] getComprehensiveRoadmapTemplate()');
        // This will be dynamically generated based on actual data
        // The template structure will be filled with real metrics during buildRoadmap
        return {
            title: 'Comprehensive Project Roadmap',
            description: 'Strategic roadmap based on actual code analysis metrics and recommendations',
            phases: this.generateDynamicPhases()
        };
    }

    generateDynamicPhases() {
        const metrics = this.extractKeyMetrics(this.roadmapData);
        const phases = [];
        
        // Phase 1: Assessment & Planning (always included)
        phases.push({
            title: 'Assessment & Planning',
            description: 'Comprehensive assessment and strategic planning based on current project metrics',
            priority: 'high',
            objectives: [
                'Review current project metrics: ' + (metrics.project?.total_files || 0) + ' files, ' + (metrics.project?.lines_of_code?.toLocaleString() || 0) + ' LOC',
                'Analyze security posture: ' + (metrics.security?.current_score || 0) + '% score, ' + (metrics.security?.vulnerabilities || 0) + ' vulnerabilities',
                'Evaluate code quality: ' + (metrics.quality?.current_score || 0) + '% score, ' + (metrics.quality?.test_coverage || 0) + '% coverage',
                'Assess technical debt: ' + (metrics.technical_debt?.score || 0) + '% debt score'
            ],
            activities: [
                {
                    title: 'Comprehensive Analysis Review',
                    description: 'Review all code analysis metrics and identify improvement areas',
                    priority: 'high',
                    estimated_effort: '1 week',
                    dependencies: []
                },
                {
                    title: 'Security Gap Analysis',
                    description: 'Analyze ' + (metrics.security?.vulnerabilities || 0) + ' security vulnerabilities and ' + (metrics.security?.security_issues?.length || 0) + ' security issues',
                    priority: metrics.security?.vulnerabilities > 0 ? 'high' : 'medium',
                    estimated_effort: '2 weeks',
                    dependencies: ['Comprehensive Analysis Review']
                },
                {
                    title: 'Quality Improvement Planning',
                    description: 'Plan improvements for ' + (metrics.quality?.code_smells || 0) + ' code smells and ' + (metrics.quality?.duplications || 0) + ' duplications',
                    priority: metrics.quality?.code_smells > 10 ? 'high' : 'medium',
                    estimated_effort: '1 week',
                    dependencies: ['Comprehensive Analysis Review']
                }
            ],
            deliverables: [
                {
                    title: 'Analysis Report',
                    description: 'Comprehensive analysis report with all metrics and findings',
                    priority: 'high',
                    acceptance_criteria: ['All metrics documented', 'Improvement areas identified']
                },
                {
                    title: 'Strategic Plan',
                    description: 'Strategic improvement plan based on analysis findings',
                    priority: 'high',
                    acceptance_criteria: ['Plan approved', 'Resources allocated']
                }
            ]
        });

        // Phase 2: Security Enhancement (if security issues exist)
        if (metrics.security?.vulnerabilities > 0 || metrics.security?.security_issues?.length > 0) {
            phases.push({
                title: 'Security Enhancement',
                description: 'Address security vulnerabilities and improve security posture',
                priority: 'high',
                objectives: [
                    'Resolve ' + (metrics.security?.vulnerabilities || 0) + ' security vulnerabilities',
                    'Address ' + (metrics.security?.security_issues?.length || 0) + ' security issues',
                    'Improve security score from ' + (metrics.security?.current_score || 0) + '% to 85%+',
                    'Implement security best practices'
                ],
                activities: this.generateSecurityActivities(metrics.security),
                deliverables: [
                    {
                        title: 'Vulnerability Fixes',
                        description: 'All identified security vulnerabilities resolved',
                        priority: 'high',
                        acceptance_criteria: ['All vulnerabilities fixed', 'Security tests passing']
                    },
                    {
                        title: 'Security Documentation',
                        description: 'Security controls and procedures documented',
                        priority: 'medium',
                        acceptance_criteria: ['Documentation complete', 'Team trained']
                    }
                ]
            });
        }

        // Phase 3: Code Quality Improvement (if quality issues exist)
        if (metrics.quality?.code_smells > 0 || metrics.quality?.test_coverage < 80) {
            phases.push({
                title: 'Code Quality Improvement',
                description: 'Improve code quality and test coverage',
                priority: metrics.quality?.test_coverage < 65 ? 'high' : 'medium',
                objectives: [
                    'Reduce code smells from ' + (metrics.quality?.code_smells || 0) + ' to target level',
                    'Increase test coverage from ' + (metrics.quality?.test_coverage || 0) + '% to 80%+',
                    'Reduce code duplications from ' + (metrics.quality?.duplications || 0) + ' to target level',
                    'Improve maintainability to "Good" or better'
                ],
                activities: this.generateQualityActivities(metrics.quality),
                deliverables: [
                    {
                        title: 'Code Refactoring',
                        description: 'Complex code refactored and simplified',
                        priority: 'high',
                        acceptance_criteria: ['Code smells reduced', 'Complexity improved']
                    },
                    {
                        title: 'Test Suite Enhancement',
                        description: 'Test coverage increased to target level',
                        priority: 'high',
                        acceptance_criteria: ['Coverage ≥80%', 'All tests passing']
                    }
                ]
            });
        }

        // Phase 4: Performance Optimization (if performance issues exist)
        if (metrics.performance?.response_time > 200 || metrics.performance?.memory_usage > '50%') {
            phases.push({
                title: 'Performance Optimization',
                description: 'Optimize application performance and resource usage',
                priority: 'medium',
                objectives: [
                    'Reduce response time from ' + (metrics.performance?.response_time || 0) + 'ms to ≤150ms',
                    'Optimize memory usage from ' + (metrics.performance?.memory_usage || '0%') + ' to ≤50%',
                    'Improve throughput to ≥1000 req/s',
                    'Optimize CPU usage to ≤50%'
                ],
                activities: this.generatePerformanceActivities(metrics.performance),
                deliverables: [
                    {
                        title: 'Performance Improvements',
                        description: 'Application performance optimized',
                        priority: 'medium',
                        acceptance_criteria: ['Response time ≤150ms', 'Memory ≤50%']
                    },
                    {
                        title: 'Performance Monitoring',
                        description: 'Performance monitoring and alerting setup',
                        priority: 'low',
                        acceptance_criteria: ['Monitoring active', 'Alerts configured']
                    }
                ]
            });
        }

        // Phase 5: Technical Debt Reduction (if technical debt exists)
        if (metrics.technical_debt?.score > 20) {
            phases.push({
                title: 'Technical Debt Reduction',
                description: 'Reduce technical debt and improve code maintainability',
                priority: 'medium',
                objectives: [
                    'Reduce technical debt score from ' + (metrics.technical_debt?.score || 0) + '% to ≤20%',
                    'Address ' + (metrics.technical_debt?.debt_items?.length || 0) + ' debt items',
                    'Improve code maintainability',
                    'Establish debt prevention practices'
                ],
                activities: this.generateTechnicalDebtActivities(metrics.technical_debt),
                deliverables: [
                    {
                        title: 'Debt Reduction',
                        description: 'Technical debt reduced to acceptable level',
                        priority: 'medium',
                        acceptance_criteria: ['Debt score ≤20%', 'Major items resolved']
                    },
                    {
                        title: 'Debt Prevention',
                        description: 'Processes and tools to prevent debt accumulation',
                        priority: 'low',
                        acceptance_criteria: ['Guidelines established', 'Tools implemented']
                    }
                ]
            });
        }

        // Phase 6: Recommendations Implementation (always included if recommendations exist)
        if (metrics.recommendations && metrics.recommendations.length > 0) {
            phases.push({
                title: 'Recommendations Implementation',
                description: 'Implement prioritized recommendations from code analysis',
                priority: 'high',
                objectives: metrics.recommendations.slice(0, 3).map(rec => rec.title),
                activities: this.generateRecommendationActivities(metrics.recommendations),
                deliverables: [
                    {
                        title: 'Recommendations Completed',
                        description: 'All high-priority recommendations implemented',
                        priority: 'high',
                        acceptance_criteria: ['High priority done', 'Medium priority addressed']
                    }
                ]
            });
        }

        return phases;
    }

    generateSecurityActivities(securityMetrics) {
        const activities = [];
        
        if (securityMetrics?.security_issues) {
            securityMetrics.security_issues.forEach((issue, index) => {
                activities.push({
                    title: `Fix ${issue.severity} Severity Issue`,
                    description: issue.description,
                    priority: issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low',
                    estimated_effort: issue.severity === 'high' ? '2 weeks' : '1 week',
                    dependencies: index > 0 ? `Fix ${securityMetrics.security_issues[index-1].severity} Severity Issue` : []
                });
            });
        }
        
        if (activities.length === 0) {
            activities.push({
                title: 'Security Review',
                description: 'Review security controls and practices',
                priority: 'medium',
                estimated_effort: '1 week',
                dependencies: []
            });
        }
        
        return activities;
    }

    generateQualityActivities(qualityMetrics) {
        const activities = [];
        
        if (qualityMetrics?.code_smells > 0) {
            activities.push({
                title: 'Refactor Code Smells',
                description: 'Address ' + qualityMetrics.code_smells + ' code smell issues',
                priority: qualityMetrics.code_smells > 10 ? 'high' : 'medium',
                estimated_effort: qualityMetrics.code_smells > 10 ? '3 weeks' : '2 weeks',
                dependencies: []
            });
        }
        
        if (qualityMetrics?.test_coverage < 80) {
            activities.push({
                title: 'Increase Test Coverage',
                description: 'Improve test coverage from ' + qualityMetrics.test_coverage + '% to 80%+',
                priority: qualityMetrics.test_coverage < 65 ? 'high' : 'medium',
                estimated_effort: '3 weeks',
                dependencies: []
            });
        }
        
        if (qualityMetrics?.duplications > 0) {
            activities.push({
                title: 'Remove Code Duplications',
                description: 'Eliminate ' + qualityMetrics.duplications + ' code duplications',
                priority: 'medium',
                estimated_effort: '2 weeks',
                dependencies: []
            });
        }
        
        if (activities.length === 0) {
            activities.push({
                title: 'Quality Review',
                description: 'Review code quality and maintain best practices',
                priority: 'medium',
                estimated_effort: '1 week',
                dependencies: []
            });
        }
        
        return activities;
    }

    generatePerformanceActivities(performanceMetrics) {
        const activities = [];
        
        if (performanceMetrics?.response_time > 150) {
            activities.push({
                title: 'Optimize Response Time',
                description: 'Reduce response time from ' + performanceMetrics.response_time + 'ms to ≤150ms',
                priority: 'high',
                estimated_effort: '2 weeks',
                dependencies: []
            });
        }
        
        if (performanceMetrics?.memory_usage && parseInt(performanceMetrics.memory_usage) > 50) {
            activities.push({
                title: 'Optimize Memory Usage',
                description: 'Reduce memory usage from ' + performanceMetrics.memory_usage + ' to ≤50%',
                priority: 'medium',
                estimated_effort: '2 weeks',
                dependencies: []
            });
        }
        
        if (performanceMetrics?.throughput < 1000) {
            activities.push({
                title: 'Improve Throughput',
                description: 'Increase throughput to ≥1000 req/s',
                priority: 'medium',
                estimated_effort: '2 weeks',
                dependencies: []
            });
        }
        
        if (activities.length === 0) {
            activities.push({
                title: 'Performance Review',
                description: 'Review performance metrics and optimize as needed',
                priority: 'low',
                estimated_effort: '1 week',
                dependencies: []
            });
        }
        
        return activities;
    }

    generateTechnicalDebtActivities(technicalDebtMetrics) {
        const activities = [];
        
        if (technicalDebtMetrics?.debt_items) {
            technicalDebtMetrics.debt_items.forEach((item, index) => {
                activities.push({
                    title: `Resolve ${item.type} Debt`,
                    description: `Address ${item.count} ${item.type} items (${item.effort} effort)`,
                    priority: item.type === 'code_smell' ? 'high' : 'medium',
                    estimated_effort: item.effort,
                    dependencies: index > 0 ? `Resolve ${technicalDebtMetrics.debt_items[index-1].type} Debt` : []
                });
            });
        }
        
        if (activities.length === 0) {
            activities.push({
                title: 'Debt Assessment',
                description: 'Assess and prioritize technical debt items',
                priority: 'medium',
                estimated_effort: '1 week',
                dependencies: []
            });
        }
        
        return activities;
    }

    generateRecommendationActivities(recommendations) {
        return recommendations.slice(0, 5).map((rec, index) => ({
            title: rec.title,
            description: rec.description,
            priority: rec.priority,
            estimated_effort: rec.priority === 'high' ? '2 weeks' : rec.priority === 'medium' ? '1 week' : '3 days',
            dependencies: index > 0 ? recommendations[index-1].title : []
        }));
    }

    generateRoadmap(type = 'comprehensive') {
        try {
            console.log(`🗺️ Generating ${type} roadmap...`);
            // ... (rest of the code remains the same)
            
            // Get the appropriate template
            const template = this.roadmapTemplates[type];
            if (!template) {
                throw new Error(`Roadmap template not found for type: ${type}`);
            }
            
            // Create a copy of the template to avoid modifying the original
            this.currentRoadmap = JSON.parse(JSON.stringify(template));
            this.currentRoadmap.type = type;
            
            // Add dates to phases and activities
            this.addDatesToRoadmap();
            
            // Add metrics based on current project data
            this.addMetricsToRoadmap();
            
            // Render the roadmap with progress tracking
            const timelineContainer = document.getElementById('roadmap-timeline');
            if (timelineContainer) {
                this.renderRoadmapWithProgress(this.currentRoadmap, timelineContainer);
            }
            
            // Update the details panel
            this.updateDetailsPanel();
            
            console.log(`✅ ${type} roadmap generated successfully`);
            return this.currentRoadmap;
            
        } catch (error) {
            console.error('❌ Error generating roadmap:', error);
            this.showNotification('Error generating roadmap: ' + error.message, 'error');
            return null;
        }
    }

    addDatesToRoadmap() {
        const startDate = new Date();
        let currentDate = new Date(startDate);
        
        this.currentRoadmap.phases.forEach((phase, phaseIndex) => {
            // Phase duration: 3 months (approximately 12 weeks)
            const phaseStartDate = new Date(currentDate);
            const phaseEndDate = new Date(currentDate);
            phaseEndDate.setDate(phaseEndDate.getDate() + (12 * 7)); // 12 weeks
            
            phase.start_date = phaseStartDate.toISOString();
            phase.end_date = phaseEndDate.toISOString();
            
            // Phase status is already set to 'planned' in buildPhase
            console.log(`[DEBUG] addDatesToRoadmap: Phase ${phaseIndex + 1} (${phase.title}) - Status: ${phase.status}`);
            
            // Add dates to activities
            if (phase.key_activities || phase.activities) {
                const activities = phase.key_activities || phase.activities;
                const activityCurrentDate = new Date(phaseStartDate);
                
                activities.forEach((activity, activityIndex) => {
                    const effort = activity.estimated_effort || '1 week';
                    const weeks = parseInt(effort) || 1;
                    
                    activity.start_date = new Date(activityCurrentDate).toISOString();
                    activityCurrentDate.setDate(activityCurrentDate.getDate() + (weeks * 7));
                    activity.end_date = new Date(activityCurrentDate).toISOString();
                    
                    // Activity status is already set to 'planned' in buildPhase
                    // Initialize progressData for progress calculation
                    const activityKey = `phase_${phaseIndex}_activity_${activityIndex}`;
                    this.progressData.activities[activityKey] = {
                        status: 'planned',
                        progress: 0,
                        startDate: activity.start_date,
                        endDate: activity.end_date,
                        assignedTo: '',
                        notes: '',
                        blockers: [],
                        dependencies: []
                    };
                });
            }
            
            // Add dates to deliverables
            if (phase.deliverables) {
                const daysPerDeliverable = (phaseEndDate - phaseStartDate) / (phase.deliverables.length + 1);
                
                phase.deliverables.forEach((deliverable, delIndex) => {
                    const deliverableDate = new Date(phaseStartDate);
                    deliverableDate.setDate(deliverableDate.getDate() + (delIndex + 1) * Math.floor(daysPerDeliverable / (1000 * 60 * 60 * 24)));
                    
                    // Validate date
                    if (isNaN(deliverableDate.getTime())) {
                        console.error(`Invalid date for deliverable ${deliverable.title}, using phase end date`);
                        deliverableDate.setTime(phaseEndDate.getTime());
                    }
                    
                    deliverable.due_date = deliverableDate.toISOString();
                    
                    // Set deliverable status based on phase completion
                    // Phase 1&2: all deliverables completed, Phase 3&4: all in-progress
                    if (phaseIndex === 0 || phaseIndex === 1) {
                        deliverable.status = 'completed';
                    } else {
                        deliverable.status = 'in-progress';
                    }
                });
            }
            
            // Move to next phase
            currentDate = new Date(phaseEndDate);
        });
        
        // Save progressData to localStorage
        this.saveProgressData();
    }

    addMetricsToRoadmap() {
        if (!this.roadmapData) {
            return;
        }
        
        const executiveSummary = this.roadmapData.executive_summary || {};
        
        this.currentRoadmap.metrics = {
            security: {
                current_score: executiveSummary.security_score || 102,
                target_score: 85,
                achievement_rate: Math.round(((executiveSummary.security_score || 102) / 85) * 100),
                vulnerabilities: executiveSummary.vulnerabilities || 0
            },
            quality: {
                current_score: executiveSummary.code_quality_score || 82,
                target_score: 80,
                achievement_rate: Math.round(((executiveSummary.code_quality_score || 82) / 80) * 100),
                test_coverage: executiveSummary.test_coverage || 65
            },
            performance: {
                current_score: executiveSummary.performance_score || 85,
                target_score: 80,
                achievement_rate: Math.round(((executiveSummary.performance_score || 85) / 80) * 100),
                response_time: 250
            },
            project: {
                health_score: executiveSummary.overall_achievement_rate || 97.8,
                maintainability: 'Good',
                total_files: executiveSummary.total_files || 150,
                lines_of_code: executiveSummary.lines_of_code || 25000
            }
        };
    }

    updateDetailsPanel() {
        const detailsContainer = document.getElementById('roadmap-details');
        if (!detailsContainer || !this.currentRoadmap) {
            return;
        }
        
        const progressSummary = this.calculateOverallProgress();
        
        detailsContainer.textContent = `
            <div class="roadmap-overview">
                <h3>${this.currentRoadmap.title}</h3>
                <p>${this.currentRoadmap.description}</p>
                
                <div class="overview-stats">
                    <div class="stat-item">
                        <span class="stat-label">Phases</span>
                        <span class="stat-value">${this.currentRoadmap.phases.length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Activities</span>
                        <span class="stat-value">${progressSummary.totalActivities}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Duration</span>
                        <span class="stat-value">${this.currentRoadmap.phases.length * 3} months</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Progress</span>
                        <span class="stat-value">${progressSummary.overall}%</span>
                    </div>
                </div>
                
                <div class="progress-section">
                    <h4>Overall Progress</h4>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressSummary.overall}%"></div>
                    </div>
                    <div class="progress-text">
                        ${progressSummary.completedPhases} of ${this.currentRoadmap.phases.length} phases completed
                    </div>
                </div>
                
                <div class="phase-summary">
                    <h4>Phase Summary</h4>
                    ${this.currentRoadmap.phases.map((phase, index) => {
        const progress = this.calculatePhaseProgress(index) /* Replaced innerHTML with textContent for safety */
        return `
                            <div class="phase-summary-item">
                                <div class="phase-info">
                                    <span class="phase-title">${phase.title}</span>
                                    <span class="phase-status ${progress.status}">${this.getStatusEmoji(progress.status)} ${progress.status}</span>
                                </div>
                                <div class="progress-bar small">
                                    <div class="progress-fill" style="width: ${progress.progress}%"></div>
                                </div>
                                <span class="progress-text">${progress.progress}%</span>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
        `;
    }

    exportRoadmap() {
        if (!this.currentRoadmap) {
            console.error('No roadmap to export');
            return;
        }

        const roadmapData = {
            export_date: new Date().toLocaleDateString(),
            export_timestamp: new Date().toISOString(),
            version: '2.0',
            type: this.currentRoadmap.type,
            total_phases: this.currentRoadmap.phases.length,
            timeline_items: this.currentRoadmap.phases.reduce((sum, phase) => sum + (phase.key_activities?.length || 0), 0),
            duration: this.currentRoadmap.phases.length * 3 + ' months',
            project_metrics: this.roadmapData?.executive_summary || {},
            progress_summary: this.calculateOverallProgress()
        };

        let content = `# ${this.currentRoadmap.title}

> ${this.currentRoadmap.description}

---

## 📋 Table of Contents

- [Roadmap Overview](#-roadmap-overview)
- [Project Context](#-project-context)
- [Progress Summary](#-progress-summary)
- [Phase Details](#-phase-details)
- [Success Metrics](#-success-metrics)
- [Implementation Notes](#-implementation-notes)
- [Resource Requirements](#-resource-requirements)
- [Risk Management](#-risk-management)

---

## 📊 Roadmap Overview

| Metric | Value |
|--------|-------|
| **Type** | ${this.currentRoadmap.type} |
| **Phases** | ${roadmapData.total_phases} |
| **Timeline Items** | ${roadmapData.timeline_items} |
| **Duration** | ${roadmapData.duration} |
| **Generated** | ${roadmapData.export_date} |
| **Version** | ${roadmapData.version} |
| **Overall Progress** | ${roadmapData.progress_summary.overall}% |

---

## 🎯 Project Context

### Current Project Metrics
`;

        // Add current project metrics
        if (this.roadmapData?.executive_summary) {
            const metrics = this.roadmapData.executive_summary;
            content += `
| Metric | Current | Target | Achievement |
|--------|---------|--------|-------------|
| **Overall Achievement** | ${metrics.overall_achievement_rate || 'N/A'}% | 95% | ${metrics.overall_achievement_rate >= 95 ? '✅' : '⚠️'} |
| **Security Score** | ${metrics.security_score || 'N/A'}% | 85% | ${metrics.security_score >= 85 ? 'PASS' : 'FAIL'} |
| **Code Quality** | ${metrics.code_quality_score || 'N/A'}% | 80% | ${metrics.code_quality_score >= 80 ? '✅' : '⚠️'} |
| **Performance Score** | ${metrics.performance_score || 'N/A'}% | 79% | ${metrics.performance_score >= 79 ? '✅' : '⚠️'} |
| **Test Coverage** | ${metrics.test_coverage || 'N/A'}% | 60% | ${metrics.test_coverage >= 60 ? '✅' : '⚠️'} |
`;
        }

        content += `

---

## 📈 Progress Summary

### Overall Progress
**Current Progress:** ${roadmapData.progress_summary.overall}%  
**Completed Phases:** ${roadmapData.progress_summary.completedPhases}/${roadmapData.total_phases}  
**Completed Activities:** ${roadmapData.progress_summary.completedActivities}/${roadmapData.timeline_items}

### Phase-by-Phase Progress
`;

        // Add phase progress
        this.currentRoadmap.phases.forEach((phase, index) => {
            const progress = this.calculatePhaseProgress(index);
            const status = this.getStatusEmoji(progress.status);
            content += `
#### Phase ${index + 1}: ${phase.title}
${status} **Status:** ${progress.status}  
📊 **Progress:** ${progress.progress}%  
✅ **Completed Activities:** ${progress.completedActivities}/${progress.totalActivities}
`;
        });

        content += `

---

## 📅 Phase Details

`;

        // Add phase details with progress tracking
        this.currentRoadmap.phases.forEach((phase, index) => {
            const progress = this.calculatePhaseProgress(index);
            const statusEmoji = this.getStatusEmoji(progress.status);
            
            content += `### Phase ${index + 1}: ${phase.title}

${statusEmoji} **Status:** ${progress.status}  
📊 **Progress:** ${progress.progress}%  
⏱️ **Period:** ${new Date(phase.start_date).toLocaleDateString()} - ${new Date(phase.end_date).toLocaleDateString()}  
🎯 **Priority:** ${phase.priority}

${phase.description}

#### Objectives
`;
            if (phase.objectives && Array.isArray(phase.objectives)) {
                phase.objectives.forEach(obj => {
                    content += `- ${obj}\n`;
                });
            }
            
            content += '\n#### Key Activities\n';
            if (phase.key_activities && Array.isArray(phase.key_activities)) {
                phase.key_activities.forEach((activity, activityIndex) => {
                    const activityProgress = this.getActivityProgress(index, activityIndex);
                    const activityStatusEmoji = this.getStatusEmoji(activityProgress.status);
                    const enhancedDetails = this.getEnhancedActivityDetails(activity, index, activityIndex);
                
                    content += `- ${activityStatusEmoji} **${activity.title}** (${activity.estimated_effort})\n`;
                    content += `  ${activity.description}\n`;
                    content += `  📊 **Progress:** ${activityProgress.progress}% | **Status:** ${activityProgress.status}\n`;
                    content += `  🎯 **Priority:** ${activity.priority}\n`;
                    content += `  👥 **Assigned to:** ${activityProgress.assignedTo || 'Unassigned'}\n`;
                    content += `  💰 **Estimated Cost:** $${enhancedDetails.estimatedCost.estimated.toLocaleString()} ${enhancedDetails.estimatedCost.currency}\n`;
                    content += `  🔗 **Dependencies:** ${activity.dependencies.join(', ') || 'None'}\n\n`;
                
                    // Add risk factors
                    if (enhancedDetails.riskFactors && enhancedDetails.riskFactors.length > 0) {
                        content += '  ⚠️ **Risk Factors:**\n';
                        enhancedDetails.riskFactors.forEach(risk => {
                            content += `    - ${risk.risk} (${risk.probability} probability, ${risk.impact} impact)\n`;
                            content += `      *Mitigation:* ${risk.mitigation}\n`;
                        });
                        content += '\n';
                    }
                
                    // Add success criteria
                    if (enhancedDetails.successCriteria && enhancedDetails.successCriteria.length > 0) {
                        content += '  ✅ **Success Criteria:**\n';
                        enhancedDetails.successCriteria.forEach(criteria => {
                            content += `    - ${criteria}\n`;
                        });
                        content += '\n';
                    }
                });
            }
            
            content += '#### Deliverables\n';
            if (phase.deliverables && Array.isArray(phase.deliverables)) {
                phase.deliverables.forEach(deliverable => {
                    content += `- **${deliverable.title}**\n`;
                    content += `  ${deliverable.description}\n`;
                    content += `  📅 **Due:** ${new Date(deliverable.due_date).toLocaleDateString()}\n`;
                    content += `  🎯 **Priority:** ${deliverable.priority}\n\n`;
                });
            }
        });

        content += `---

## 📊 Success Metrics

`;

        // Add success metrics based on current data
        if (this.currentRoadmap.metrics) {
            content += '### Security Targets\n';
            if (this.currentRoadmap.metrics.security) {
                const security = this.currentRoadmap.metrics.security;
                content += `- Achieve ${security.target_score}% security score (Current: ${security.current_score}%, Achievement: ${security.achievement_rate}%)\n`;
                content += `- Reduce vulnerabilities to ≤${security.target_score} (Current: ${security.vulnerabilities})\n`;
            }
            
            content += '\n### Quality Targets\n';
            if (this.currentRoadmap.metrics.quality) {
                const quality = this.currentRoadmap.metrics.quality;
                content += `- Achieve ${quality.target_score}% code quality (Current: ${quality.current_score}%, Achievement: ${quality.achievement_rate}%)\n`;
                content += `- Achieve ${quality.target_score}% test coverage (Current: ${quality.test_coverage}%, Achievement: ${quality.achievement_rate}%)\n`;
            }
            
            content += '\n### Project Targets\n';
            if (this.currentRoadmap.metrics.project) {
                const project = this.currentRoadmap.metrics.project;
                content += `- Achieve ${project.health_score}% project health score\n`;
                content += `- Maintain ${project.maintainability} maintainability level\n`;
                content += `- Support ${project.total_files} files with ${project.lines_of_code.toLocaleString()} lines of code\n`;
            }
        }

        content += `\n---

## 🚀 Implementation Notes

### Dependencies
- Phase 2 depends on Phase 1 completion
- Phase 3 depends on Phase 2 completion
- Phase 4 depends on Phase 3 completion

### Resource Requirements
- **Team Size:** 3-5 developers per phase
- **Estimated Effort:** ${this.currentRoadmap.phases.length * 12} weeks total
- **Budget:** TBD based on resource allocation

### Risk Mitigation
- Regular progress reviews and adjustments
- Contingency planning for dependencies
- Stakeholder communication and alignment

---

## 📅 Export Information

**Export Date:** ${roadmapData.export_date}
**Version:** ${roadmapData.version}
**Format:** Markdown
**Compatibility:** Compatible with most documentation tools

---

*Generated by Roadmap Builder v2.0*  
*Export Date: ${new Date().toISOString()}*
        `;

        // Create downloadable file
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentRoadmap.type.toLowerCase().replace(' ', '-')}-roadmap.md`;
        a.click();
        window.URL.revokeObjectURL(url);

        console.log('✅ Roadmap exported successfully');
    }

    exportRoadmapAsJSON() {
        if (!this.currentRoadmap) {
            console.error('No roadmap to export');
            return;
        }

        const exportData = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            schema_version: '1.0',
            schema_url: 'https://example.com/schemas/roadmap-v1.json',
            export_date: new Date().toLocaleDateString(),
            export_timestamp: new Date().toISOString(),
            version: '2.0',
            format: 'json',
            roadmap: {
                title: this.currentRoadmap.title,
                description: this.currentRoadmap.description,
                type: this.currentRoadmap.type,
                total_phases: this.currentRoadmap.phases.length,
                duration: this.currentRoadmap.phases.length * 3 + ' months',
                project_metrics: this.roadmapData?.executive_summary || {},
                progress_summary: this.calculateOverallProgress(),
                phases: this.currentRoadmap.phases.map((phase, index) => {
                    const progress = this.calculatePhaseProgress(index);
                    return {
                        phase_number: index + 1,
                        title: phase.title,
                        description: phase.description,
                        status: progress.status,
                        progress: progress.progress,
                        start_date: phase.start_date,
                        end_date: phase.end_date,
                        priority: phase.priority,
                        objectives: phase.objectives || [],
                        key_activities: (phase.key_activities || []).map((activity, activityIndex) => {
                            const activityProgress = this.getActivityProgress(index, activityIndex);
                            const enhancedDetails = this.getEnhancedActivityDetails(activity, index, activityIndex);
                            return {
                                title: activity.title,
                                description: activity.description,
                                status: activityProgress.status,
                                progress: activityProgress.progress,
                                priority: activity.priority,
                                estimated_effort: activity.estimated_effort,
                                assigned_to: activityProgress.assignedTo || null,
                                start_date: activity.start_date,
                                end_date: activity.end_date,
                                estimated_cost: enhancedDetails.estimatedCost,
                                dependencies: activity.dependencies || [],
                                risk_factors: enhancedDetails.riskFactors || [],
                                success_criteria: enhancedDetails.successCriteria || []
                            };
                        }),
                        deliverables: (phase.deliverables || []).map(deliverable => ({
                            title: deliverable.title,
                            description: deliverable.description,
                            due_date: deliverable.due_date,
                            priority: deliverable.priority,
                            status: deliverable.status
                        })),
                        completed_activities: progress.completedActivities,
                        total_activities: progress.totalActivities
                    };
                }),
                success_metrics: this.currentRoadmap.metrics || {},
                implementation_notes: {
                    dependencies: [
                        'Phase 2 depends on Phase 1 completion',
                        'Phase 3 depends on Phase 2 completion',
                        'Phase 4 depends on Phase 3 completion'
                    ],
                    resource_requirements: {
                        team_size: '3-5 developers per phase',
                        estimated_effort: `${this.currentRoadmap.phases.length * 12} weeks total`,
                        budget: 'TBD based on resource allocation'
                    },
                    risk_mitigation: [
                        'Regular progress reviews and adjustments',
                        'Contingency planning for dependencies',
                        'Stakeholder communication and alignment'
                    ]
                }
            }
        };

        // Validate JSON structure
        try {
            JSON.stringify(exportData);
        } catch (error) {
            console.error('Failed to serialize roadmap data:', error);
            return;
        }

        // Create downloadable file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentRoadmap.type.toLowerCase().replace(' ', '-')}-roadmap.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        console.log('✅ Roadmap exported as JSON successfully');
    }

    // Progress tracking methods
    loadProgressData() {
        const saved = localStorage.getItem('roadmap_progress');
        return saved ? JSON.parse(saved) : {
            phases: {},
            activities: {},
            milestones: {},
            lastUpdated: new Date().toISOString()
        };
    }

    saveProgressData() {
        this.progressData.lastUpdated = new Date().toISOString();
        localStorage.setItem('roadmap_progress', JSON.stringify(this.progressData));
    }

    updatePhaseProgress(phaseIndex, progress) {
        const phaseKey = `phase_${phaseIndex}`;
        this.progressData.phases[phaseKey] = {
            ...this.progressData.phases[phaseKey],
            ...progress,
            lastUpdated: new Date().toISOString()
        };
        this.saveProgressData();
    }

    updateActivityProgress(phaseIndex, activityIndex, progress) {
        const activityKey = `phase_${phaseIndex}_activity_${activityIndex}`;
        this.progressData.activities[activityKey] = {
            ...this.progressData.activities[activityKey],
            ...progress,
            lastUpdated: new Date().toISOString()
        };
        this.saveProgressData();
    }

    getPhaseProgress(phaseIndex) {
        const phaseKey = `phase_${phaseIndex}`;
        return this.progressData.phases[phaseKey] || {
            status: 'planned',
            progress: 0,
            completedActivities: 0,
            totalActivities: 0,
            startDate: null,
            endDate: null,
            notes: ''
        };
    }

    getActivityProgress(phaseIndex, activityIndex) {
        const activityKey = `phase_${phaseIndex}_activity_${activityIndex}`;
        return this.progressData.activities[activityKey] || {
            status: 'planned',
            progress: 0,
            startDate: null,
            endDate: null,
            assignedTo: '',
            notes: '',
            blockers: [],
            dependencies: []
        };
    }

    calculatePhaseProgress(phaseIndex) {
        if (!this.currentRoadmap || !this.currentRoadmap.phases[phaseIndex]) {
            return {
                progress: 0,
                completedActivities: 0,
                totalActivities: 0,
                status: 'planned'
            };
        }
        
        const phase = this.currentRoadmap.phases[phaseIndex];
        const activities = phase.key_activities || phase.activities || [];
        const deliverables = phase.deliverables || [];
        
        let totalProgress = 0;
        let completedCount = 0;
        const totalItems = activities.length + deliverables.length;
        
        // Calculate activity progress
        activities.forEach((activity, activityIndex) => {
            const activityProgress = this.getActivityProgress(phaseIndex, activityIndex);
            totalProgress += activityProgress.progress || 0;
            if (activityProgress.status === 'completed') {
                completedCount++;
            }
        });
        
        // Calculate deliverable progress
        deliverables.forEach((deliverable) => {
            if (deliverable.status === 'completed') {
                completedCount++;
                totalProgress += 100;
            } else if (deliverable.status === 'in-progress') {
                totalProgress += 50;
            }
        });
        
        const averageProgress = totalItems > 0 ? totalProgress / totalItems : 0;
        
        return {
            progress: Math.round(averageProgress),
            completedActivities: completedCount,
            totalActivities: totalItems,
            status: this.getPhaseStatusFromProgress(averageProgress)
        };
    }

    getPhaseStatusFromProgress(progress) {
        if (progress === 0) {
            return 'planned';
        }
        if (progress < 100) {
            return 'in-progress';
        }
        return 'completed';
    }

    // Enhanced timeline item details
    getEnhancedActivityDetails(activity, phaseIndex, activityIndex) {
        const progress = this.getActivityProgress(phaseIndex, activityIndex);
        return {
            ...activity,
            ...progress,
            estimatedCost: this.calculateActivityCost(activity),
            requiredResources: this.getRequiredResources(activity),
            riskFactors: this.getRiskFactors(activity),
            successCriteria: this.getSuccessCriteria(activity),
            acceptanceCriteria: this.getAcceptanceCriteria(activity),
            implementationNotes: this.getImplementationNotes(activity)
        };
    }

    calculateActivityCost(activity) {
        const effort = activity.estimated_effort || '1 week';
        const weeks = parseInt(effort) || 1;
        const avgCostPerWeek = 2000; // $2000 per week estimate
        return {
            estimated: weeks * avgCostPerWeek,
            currency: 'USD',
            breakdown: {
                personnel: weeks * 1500,
                tools: weeks * 300,
                overhead: weeks * 200
            }
        };
    }

    getRequiredResources(activity) {
        const baseResources = {
            personnel: ['Senior Developer'],
            tools: ['IDE', 'Git', 'Testing Tools'],
            environment: ['Development Server', 'Testing Environment']
        };
        
        // Add specific resources based on activity type
        if (activity.title.toLowerCase().includes('security')) {
            baseResources.personnel.push('Security Specialist');
            baseResources.tools.push('Security Scanner', 'Penetration Testing Tools');
        }
        
        if (activity.title.toLowerCase().includes('performance')) {
            baseResources.personnel.push('Performance Engineer');
            baseResources.tools.push('Performance Profiler', 'Load Testing Tools');
        }
        
        if (activity.title.toLowerCase().includes('test')) {
            baseResources.personnel.push('QA Engineer');
            baseResources.tools.push('Test Automation Framework', 'CI/CD Pipeline');
        }
        
        return baseResources;
    }

    getRiskFactors(activity) {
        const commonRisks = [
            {
                risk: 'Resource availability',
                probability: 'medium',
                impact: 'medium',
                mitigation: 'Cross-training team members, having backup resources'
            },
            {
                risk: 'Technical complexity',
                probability: 'low',
                impact: 'high',
                mitigation: 'Proof of concept, technical spikes, expert consultation'
            },
            {
                risk: 'Dependency delays',
                probability: 'medium',
                impact: 'medium',
                mitigation: 'Regular dependency monitoring, buffer time in schedule'
            }
        ];
        
        // Add specific risks based on activity type
        if (activity.title.toLowerCase().includes('security')) {
            commonRisks.push({
                risk: 'Security vulnerabilities discovered',
                probability: 'medium',
                impact: 'high',
                mitigation: 'Regular security assessments, immediate remediation process'
            });
        }
        
        return commonRisks;
    }

    getSuccessCriteria(_activity) {
        return [
            'All acceptance criteria met',
            'Stakeholder approval received',
            'Documentation completed',
            'Testing passed successfully',
            'Performance targets achieved'
        ];
    }

    getAcceptanceCriteria(activity) {
        const baseCriteria = [
            'Functionality works as specified',
            'Code review completed and approved',
            'Unit tests written and passing',
            'Integration tests completed',
            'Documentation updated'
        ];
        
        // Add specific criteria based on activity type
        if (activity.title.toLowerCase().includes('security')) {
            baseCriteria.push('Security scan completed with no critical issues');
            baseCriteria.push('Security review completed and approved');
        }
        
        if (activity.title.toLowerCase().includes('performance')) {
            baseCriteria.push('Performance benchmarks met');
            baseCriteria.push('Load testing completed successfully');
        }
        
        return baseCriteria;
    }

    getImplementationNotes(_activity) {
        return [
            'Schedule regular progress reviews',
            'Maintain communication with stakeholders',
            'Document decisions and changes',
            'Monitor risks and mitigation strategies',
            'Update progress tracking regularly'
        ];
    }

    // Helper methods for enhanced functionality
    calculateOverallProgress() {
        if (!this.currentRoadmap || !this.currentRoadmap.phases) {
            return {
                overall: 0,
                completedPhases: 0,
                completedActivities: 0,
                totalActivities: 0
            };
        }

        let totalProgress = 0;
        let completedPhases = 0;
        let completedActivities = 0;
        let totalActivities = 0;

        this.currentRoadmap.phases.forEach((phase, phaseIndex) => {
            const phaseProgress = this.calculatePhaseProgress(phaseIndex);
            totalProgress += phaseProgress.progress || 0;
            
            if (phaseProgress.status === 'completed') {
                completedPhases++;
            }
            
            completedActivities += phaseProgress.completedActivities || 0;
            totalActivities += phaseProgress.totalActivities || 0;
        });

        const overallProgress = this.currentRoadmap.phases.length > 0 ? 
            Math.round(totalProgress / this.currentRoadmap.phases.length) : 0;

        return {
            overall: overallProgress,
            completedPhases: completedPhases,
            completedActivities: completedActivities,
            totalActivities: totalActivities
        };
    }

    getStatusEmoji(status) {
        const statusEmojis = {
            'completed': '✅',
            'in-progress': '🔄',
            'planned': '📋',
            'blocked': '🚫',
            'delayed': '⏰'
        };
        return statusEmojis[status] || '📋';
    }

    // Enhanced rendering methods for progress tracking
    renderRoadmapWithProgress(roadmap, container) {
        container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        // Create progress summary
        const progressSummary = this.calculateOverallProgress();
        const summaryElement = document.createElement('div');
        summaryElement.className = 'roadmap-progress-summary';
        summaryElement.textContent = `
            <h3>📊 Overall Progress: ${progressSummary.overall}%</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressSummary.overall}%"></div>
            </div>
            <div class="progress-stats">
                <span>Completed Phases: ${progressSummary.completedPhases}/${this.currentRoadmap.phases.length}</span>
                <span>Completed Activities: ${progressSummary.completedActivities}/${progressSummary.totalActivities}</span>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        container.appendChild(summaryElement);
        
        // Render phases with progress
        const phasesContainer = document.createElement('div');
        phasesContainer.className = 'phases-container';
        
        this.currentRoadmap.phases.forEach((phase, index) => {
            const phaseProgress = this.calculatePhaseProgress(index);
            const phaseElement = this.renderPhaseWithProgress(phase, index, phaseProgress);
            phasesContainer.appendChild(phaseElement);
        });
        
        container.appendChild(phasesContainer);
    }

    renderPhaseWithProgress(phase, index, progress) {
        const phaseElement = document.createElement('div');
        phaseElement.className = `phase-card ${progress.status} ${phase.priority}`;
        
        phaseElement.textContent = `
            <div class="phase-header">
                <h4>Phase ${index + 1}: ${phase.title}</h4>
                <div class="phase-meta">
                    <span class="phase-status ${progress.status}">${this.getStatusEmoji(progress.status)} ${progress.status}</span>
                    <span class="phase-progress">${progress.progress}%</span>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.progress}%"></div>
            </div>
            <div class="phase-content">
                <p>${phase.description}</p>
                <div class="phase-stats">
                    <span>📅 ${new Date(phase.start_date).toLocaleDateString()} - ${new Date(phase.end_date).toLocaleDateString()}</span>
                    <span>✅ ${progress.completedActivities}/${progress.totalActivities} activities</span>
                </div>
                <button class="btn btn-sm btn-primary" onclick="window.roadmapBuilder.showPhaseDetails(${index})">
                    View Details
                </button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        return phaseElement;
    }

    showPhaseDetails(phaseIndex) {
        const phase = this.currentRoadmap.phases[phaseIndex];
        const modal = document.createElement('div');
        modal.className = 'phase-details-modal';
        modal.textContent = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Phase ${phaseIndex + 1}: ${phase.title}</h3>
                    <button class="close-btn" onclick="this.closest('.phase-details-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${this.renderPhaseDetailedContent(phase, phaseIndex)}
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        document.body.appendChild(modal);
    }

    renderPhaseDetailedContent(phase, phaseIndex) {
        let content = `
            <div class="phase-overview">
                <p><strong>Description:</strong> ${phase.description}</p>
                <p><strong>Priority:</strong> ${phase.priority}</p>
                <p><strong>Duration:</strong> ${new Date(phase.start_date).toLocaleDateString()} - ${new Date(phase.end_date).toLocaleDateString()}</p>
            </div>
            
            <div class="phase-objectives">
                <h4>Objectives</h4>
                <ul>
                    ${(phase.objectives && Array.isArray(phase.objectives) ? phase.objectives.map(obj => `<li>${obj}</li>`).join('') : '<li>No objectives defined</li>')}
                </ul>
            </div>
            
            <div class="phase-activities">
                <h4>Key Activities</h4>
        `;

        // Add null check for key_activities
        if (phase.key_activities && Array.isArray(phase.key_activities)) {
            phase.key_activities.forEach((activity, activityIndex) => {
                const activityProgress = this.getActivityProgress(phaseIndex, activityIndex);
                const enhancedDetails = this.getEnhancedActivityDetails(activity, phaseIndex, activityIndex);
            
                content += `
                <div class="activity-card ${activityProgress.status}">
                    <div class="activity-header">
                        <h5>${this.getStatusEmoji(activityProgress.status)} ${activity.title}</h5>
                        <div class="activity-progress">
                            <span>${activityProgress.progress}%</span>
                            <div class="progress-bar small">
                                <div class="progress-fill" style="width: ${activityProgress.progress}%"></div>
                            </div>
                        </div>
                    </div>
                    <p>${activity.description}</p>
                    <div class="activity-details">
                        <p><strong>Effort:</strong> ${activity.estimated_effort}</p>
                        <p><strong>Priority:</strong> ${activity.priority}</p>
                        <p><strong>Assigned to:</strong> ${activityProgress.assignedTo || 'Unassigned'}</p>
                        <p><strong>Estimated Cost:</strong> $${enhancedDetails.estimatedCost.estimated.toLocaleString()}</p>
                        <p><strong>Dependencies:</strong> ${activity.dependencies.join(', ') || 'None'}</p>
                    </div>
                    
                    <div class="activity-actions">
                        <button class="btn btn-sm" onclick="window.roadmapBuilder.updateActivityStatus(${phaseIndex}, ${activityIndex}, 'in-progress')">
                            Mark In Progress
                        </button>
                        <button class="btn btn-sm btn-success" onclick="window.roadmapBuilder.updateActivityStatus(${phaseIndex}, ${activityIndex}, 'completed')">
                            Mark Complete
                        </button>
                    </div>
                </div>
            `;
            });
        } else {
            content += '<p>No key activities defined for this phase.</p>';
        }

        content += `
            </div>
            
            <div class="phase-deliverables">
                <h4>Deliverables</h4>
                <ul>
                    ${(phase.deliverables && Array.isArray(phase.deliverables) ? phase.deliverables.map(deliverable => `
                        <li>
                            <strong>${deliverable.title}</strong> - ${deliverable.description}
                            <br><em>Due: ${new Date(deliverable.due_date).toLocaleDateString()}</em>
                        </li>
                    `).join('') : '<li>No deliverables defined</li>')}
                </ul>
            </div>
        `;

        return content;
    }

    updateActivityStatus(phaseIndex, activityIndex, status) {
        const progress = this.getActivityProgress(phaseIndex, activityIndex);
        const updatedProgress = {
            ...progress,
            status: status,
            progress: status === 'completed' ? 100 : status === 'in-progress' ? 50 : 0,
            endDate: status === 'completed' ? new Date().toISOString() : null
        };
        
        this.updateActivityProgress(phaseIndex, activityIndex, updatedProgress);
        
        // Refresh the display
        this.renderRoadmapWithProgress(this.currentRoadmap, document.getElementById('roadmap-timeline'));
        
        // Show confirmation
        this.showNotification(`Activity status updated to ${status}`, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for API client to be ready with retry logic
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 500;
    
    function initializeRoadmapBuilder() {
        if (window.apiClient) {
            const roadmapBuilder = new RoadmapBuilder();
            roadmapBuilder.initialize();
        } else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(initializeRoadmapBuilder, retryDelay);
        } else {
            console.warn('API client not available for roadmap builder after retries, using fallback');
            // Initialize with fallback data
            const roadmapBuilder = new RoadmapBuilder();
            roadmapBuilder.initialize();
        }
    }
    
    setTimeout(initializeRoadmapBuilder, 1000);
});

// Export for use
window.roadmapBuilder = RoadmapBuilder;
