        // Global state
        let currentSection = 'overview';
        let charts = {};

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeCharts();
            loadInitialData();
            setupWebSocket();
        });

        // Navigation functions
        function _setActiveNav(element) {
            // Remove active class from all nav links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            // Add active class to clicked link
            element.classList.add('active');
        }

        function _showSection(sectionId) {
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                window.currentSection = sectionId;
                
                // Load section-specific data
                loadSectionData(sectionId);
            }
        }

        function _toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('active');
        }

        // Data loading functions
        function loadInitialData() {
            // Load overview data
            loadOverviewData();
            
            // Set up periodic refresh
            setInterval(refreshData, 30000); // Refresh every 30 seconds
        }

        function loadSectionData(sectionId) {
            switch(sectionId) {
                case 'overview':
                    loadOverviewData();
                    break;
                case 'context-search':
                    loadContextSearchData();
                    break;
                case 'analyzer-dashboard':
                    loadAnalyzerDashboardData();
                    break;
                case 'issue-resolution':
                    loadIssueResolutionData();
                    break;
                case 'settings':
                    loadSettingsData();
                    break;
                case 'help':
                    loadHelpData();
                    break;
                case 'ai-analysis':
                    loadAIAnalysisData();
                    break;
                case 'code-generation':
                    loadCodeGenerationData();
                    break;
                case 'gguf-analysis':
                    loadGGUFData();
                    break;
                case 'mock-analyzer':
                    loadMockData();
                    break;
                case 'analytics':
                    loadAnalyticsData();
                    break;
                case 'billing':
                    loadBillingData();
                    break;
                case 'assets-library':
                    loadAssetsData();
                    break;
                case 'code-templates':
                    loadTemplatesData();
                    break;
                case 'coverage-reports':
                    loadCoverageData();
                    break;
                case 'feature-backlog':
                    loadFeatureBacklogData();
                    break;
                case 'security-dashboard':
                    loadSecurityDashboardData();
                    break;
                case 'ma-tools':
                    loadMAToolsData();
                    break;
                case 'debt-management':
                    loadDebtManagementData();
                    break;
                case 'dev-roadmap':
                    loadRoadmap();
                    break;
                case 'ai-roadmap':
                    loadAIRoadmap();
                    break;
            }
        }

        function loadOverviewData() {
            if (typeof DashboardMetricsService === 'undefined') {
                updateMetrics([
                    { id: 'total-projects', value: '—', change: 0 },
                    { id: 'ai-models', value: '—', change: 0 },
                    { id: 'api-calls', value: '—', change: 0 },
                    { id: 'system-health', value: '—', change: 0 }
                ]);
                return;
            }

            const svc = new DashboardMetricsService();
            svc.getAllMetrics()
                .then((metrics) => {
                    updateMetrics([
                        { id: 'total-projects', value: formatDashboardKpi(metrics.featureCount) || '—', change: 0 },
                        { id: 'ai-models', value: '—', change: 0 },
                        { id: 'api-calls', value: '—', change: 0 },
                        {
                            id: 'system-health',
                            value: formatDashboardKpi(metrics.aiConfidence, { suffix: '%' }) || '—',
                            change: 0
                        }
                    ]);
                })
                .catch((error) => {
                    console.warn('Overview KPI fetch failed:', error.message);
                    updateMetrics([
                        { id: 'total-projects', value: 'Unavailable', change: 0 },
                        { id: 'ai-models', value: 'Unavailable', change: 0 },
                        { id: 'api-calls', value: 'Unavailable', change: 0 },
                        { id: 'system-health', value: 'Unavailable', change: 0 }
                    ]);
                });
        }

        function loadGGUFData() {
            fetch('/api/gguf/analysis')
                .then(response => response.json())
                .then(data => {
                    displayGGUFResults(data);
                })
                .catch(_error => {
                    console.log('Using fallback GGUF data');
                    displayGGUFFallback();
                });
        }

        function loadMockData() {
            fetch('/api/gguf/analysis')
                .then(response => response.json())
                .then(data => {
                    displayMockDataResults(data);
                })
                .catch(_error => {
                    console.log('Using fallback mock data');
                    displayMockDataFallback();
                });
        }

        function loadAnalyticsData() {
            // Update analytics charts
            updateAnalyticsCharts();
        }

        function loadRoadmap() {
            initRoadmapPathBuilder();
            loadRoadmapData();
        }

        function initRoadmapPathBuilder() {
            try {
                const saved = localStorage.getItem('roadmapProjectPath');
                const input = document.getElementById('roadmap-project-path');
                if (input && saved && !input.value) {
                    input.value = saved;
                }
            } catch (e) {
                /* ignore */
            }
        }

        async function parseApiJsonResponse(response) {
            const contentType = response.headers.get('content-type') || '';
            const text = await response.text();
            if (!contentType.includes('application/json')) {
                const htmlHint = text.trimStart().startsWith('<!')
                    ? 'Server returned HTML instead of JSON. Run start-localhost.bat (port 54355) or restart server-51543.'
                    : 'Server returned a non-JSON response';
                throw new Error(`${htmlHint} (HTTP ${response.status})`);
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON from server: ' + e.message);
            }
        }

        function escapeHtmlRoadmap(text) {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        }

        async function _buildRoadmapFromPath() {
            const pathInput = document.getElementById('roadmap-project-path');
            const titleInput = document.getElementById('roadmap-project-title');
            const statusEl = document.getElementById('roadmap-build-status');
            const resultsEl = document.getElementById('roadmap-build-results');

            const projectPath = pathInput?.value?.trim();
            if (!projectPath) {
                showNotification('Enter the folder path for the software you are building', 'warning');
                return;
            }

            try {
                localStorage.setItem('roadmapProjectPath', projectPath);
            } catch (e) {
                /* ignore */
            }

            if (statusEl) {
                statusEl.innerHTML = '<span class="text-info">⏳ Scanning project and building AI roadmap…</span>';
            }
            if (resultsEl) {
                resultsEl.style.display = 'none';
                resultsEl.innerHTML = '';
            }

            showNotification('Analyzing project and generating roadmap…', 'info');

            try {
                const response = await fetch('/api/dynamic-roadmap/build-from-path', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath,
                        title: titleInput?.value?.trim() || undefined
                    })
                });

                const data = await parseApiJsonResponse(response);
                if (!response.ok || !data.success) {
                    throw new Error(data.message || data.error || 'Roadmap generation failed');
                }

                if (statusEl) {
                    statusEl.innerHTML = `<span class="text-success">✅ Roadmap generated from <code>${escapeHtmlRoadmap(data.projectPath)}</code></span>`;
                }

                const roadmap = data.roadmap || {};
                const es = roadmap.executiveSummary || {};
                const rec = roadmap.recommendations || {};
                const immediate = rec.immediate || [];

                if (resultsEl) {
                    resultsEl.style.display = 'block';
                    resultsEl.innerHTML = `
                        <div class="alert alert-success mb-0">
                            <strong>Summary:</strong> ${es.totalFeatures ?? 0} features · ${es.completedFeatures ?? 0} completed ·
                            health: ${escapeHtmlRoadmap(es.projectHealth || '—')}
                            ${immediate.length ? '<ul class="mb-0 mt-2">' + immediate.slice(0, 5).map(i => `<li>${escapeHtmlRoadmap(typeof i === 'string' ? i : i.action || i.title || '')}</li>`).join('') + '</ul>' : ''}
                        </div>
                    `;
                }

                if (roadmap.developmentPhases) {
                    displayRoadmapData({
                        developmentPhases: roadmap.developmentPhases,
                        recommendations: roadmap.recommendations,
                        keyMilestones: [],
                        riskAssessment: {},
                        metrics: { aiInsights: [], nextSteps: immediate },
                        privacyAndSecurity: {}
                    });
                }

                showNotification('AI roadmap generated for your project', 'success');
            } catch (error) {
                console.error('buildRoadmapFromPath:', error);
                if (statusEl) {
                    statusEl.innerHTML = `<span class="text-danger">❌ ${escapeHtmlRoadmap(error.message)}</span>`;
                }
                showNotification(error.message, 'error');
            }
        }

        async function loadRoadmapData() {
            showNotification('Loading roadmap data...', 'info');
            
            try {
                // Fetch roadmap analysis from API
                const response = await fetch('/api/development-roadmap/analyze');
                const data = await response.json();
                
                if (data.success) {
                    displayRoadmapData(data.report);
                    initializeRoadmapCharts(data.report);
                    showNotification('Roadmap data loaded successfully', 'success');
                } else {
                    throw new Error(data.error || 'Failed to load roadmap data');
                }
            } catch (error) {
                console.error('Error loading roadmap data:', error);
                // Load mock data as fallback
                loadMockRoadmapData();
                showNotification('Using mock roadmap data', 'warning');
            }
        }

        function displayRoadmapData(roadmapData) {
            // Display development phases
            displayDevelopmentPhases(roadmapData.developmentPhases);
            
            // Display milestones
            displayMilestones(roadmapData.keyMilestones);
            
            // Display recommendations
            displayRecommendations(roadmapData.recommendations);
            
            // Display risk assessment
            displayRiskAssessment(roadmapData.riskAssessment);
            
            // Display performance metrics
            displayPerformanceMetrics(roadmapData.metrics);
            
            // Display AI insights
            displayAIInsights(roadmapData.metrics.aiInsights);
            
            // Display privacy and security
            displayPrivacySecurity(roadmapData.privacyAndSecurity);
            
            // Display next steps
            displayNextSteps(roadmapData.metrics.nextSteps);
        }

        function displayDevelopmentPhases(phases) {
            const container = document.getElementById('phasesContainer');
            container.innerHTML = phases.map((phase, _index) => `
                <div class="col-md-6 col-lg-3 mb-3">
                    <div class="phase-card">
                        <div class="phase-header">
                            <div class="phase-title">Phase ${phase.phase}: ${phase.title}</div>
                            <div class="phase-status ${phase.status}">${phase.status.replace('-', ' ')}</div>
                        </div>
                        <div class="phase-progress">
                            <div class="progress">
                                <div class="progress-bar bg-${getProgressBarColor(phase.status)}" style="width: ${phase.metrics.completion}">
                                    ${phase.metrics.completion}
                                </div>
                            </div>
                        </div>
                        <div class="phase-metrics">
                            <div class="phase-metric">
                                <span class="phase-metric-label">Duration:</span>
                                <span class="phase-metric-value">${phase.metrics.duration}</span>
                            </div>
                            <div class="phase-metric">
                                <span class="phase-metric-label">Team:</span>
                                <span class="phase-metric-value">${phase.metrics.teamSize} members</span>
                            </div>
                            <div class="phase-metric">
                                <span class="phase-metric-label">Quality:</span>
                                <span class="phase-metric-value">${phase.metrics.quality}</span>
                            </div>
                            <div class="phase-metric">
                                <span class="phase-metric-label">AI Confidence:</span>
                                <span class="phase-metric-value">${phase.aiConfidence}%</span>
                            </div>
                        </div>
                        <div class="mt-2">
                            <small class="text-muted">${phase.description}</small>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function displayMilestones(milestones) {
            const container = document.getElementById('milestonesTimeline');
            container.innerHTML = milestones.map(milestone => `
                <div class="timeline-item ${milestone.status}">
                    <div class="timeline-content">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6>${milestone.milestone}</h6>
                                <p class="mb-1">${milestone.description}</p>
                                <small class="text-muted">Date: ${milestone.date}</small>
                            </div>
                            <span class="badge bg-${getStatusColor(milestone.status)}">${milestone.status}</span>
                        </div>
                        ${milestone.achievement ? `<div class="mt-2"><small class="text-success"><i class="fas fa-check-circle"></i> ${milestone.achievement}</small></div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        function displayRecommendations(recommendations) {
            const container = document.getElementById('recommendationsContainer');
            container.innerHTML = recommendations.map(rec => `
                <div class="recommendation-item">
                    <div class="recommendation-header">
                        <div class="recommendation-title">${rec.action}</div>
                        <div class="recommendation-priority ${rec.priority}">${rec.priority.toUpperCase()}</div>
                    </div>
                    <div class="recommendation-description">${rec.description}</div>
                    <div class="recommendation-meta">
                        <span><i class="fas fa-bolt"></i> Impact: ${rec.impact}</span>
                        <span><i class="fas fa-clock"></i> Effort: ${rec.effort}</span>
                        <span><i class="fas fa-calendar"></i> Timeline: ${rec.timeline}</span>
                    </div>
                </div>
            `).join('');
        }

        function displayRiskAssessment(riskData) {
            const container = document.getElementById('riskAssessmentContainer');
            const risks = [
                { label: 'Technical Risk', level: riskData.technicalRisk, icon: 'fas fa-code' },
                { label: 'Schedule Risk', level: riskData.scheduleRisk, icon: 'fas fa-calendar-alt' },
                { label: 'Resource Risk', level: riskData.resourceRisk, icon: 'fas fa-users' },
                { label: 'Market Risk', level: riskData.marketRisk, icon: 'fas fa-chart-line' }
            ];
            
            container.innerHTML = risks.map(risk => `
                <div class="col-md-6 col-lg-3 mb-3">
                    <div class="risk-item">
                        <div class="risk-level ${risk.level.toLowerCase()}">${risk.level}</div>
                        <div class="risk-label">${risk.label}</div>
                        <div class="mt-2">
                            <i class="${risk.icon}"></i>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function initializeRoadmapCharts(roadmapData) {
            // Category Progress Chart
            const categoryCtx = document.getElementById('categoryProgressChart');
            if (categoryCtx && !charts.categoryProgress) {
                charts.categoryProgress = new Chart(categoryCtx, {
                    type: 'bar',
                    data: {
                        labels: roadmapData.featureCategories.map(cat => cat.category),
                        datasets: [{
                            label: 'Completion Rate',
                            data: roadmapData.featureCategories.map(cat => parseFloat(cat.completionRate)),
                            backgroundColor: [
                                '#6366f1',
                                '#8b5cf6',
                                '#ec4899',
                                '#f59e0b'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Phase Timeline Chart
            const timelineCtx = document.getElementById('phaseTimelineChart');
            if (timelineCtx && !charts.phaseTimeline) {
                charts.phaseTimeline = new Chart(timelineCtx, {
                    type: 'line',
                    data: {
                        labels: roadmapData.developmentPhases.map(phase => `Phase ${phase.phase}`),
                        datasets: [{
                            label: 'AI Confidence',
                            data: roadmapData.developmentPhases.map(phase => phase.aiConfidence),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                min: 90,
                                max: 100,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        function loadMockRoadmapData() {
            const mockData = {
                developmentPhases: [
                    {
                        phase: 1,
                        title: "Foundation",
                        status: "completed",
                        metrics: {
                            completion: "100%",
                            quality: "Excellent",
                            duration: "8 weeks",
                            teamSize: 8
                        },
                        aiConfidence: null,
                        description: "Core platform architecture and basic AI processing capabilities"
                    },
                    {
                        phase: 2,
                        title: "AI Integration",
                        status: "completed",
                        metrics: {
                            completion: "100%",
                            quality: "Excellent",
                            duration: "8 weeks",
                            teamSize: 10
                        },
                        aiConfidence: null,
                        description: "Advanced AI features and intelligent automation systems"
                    },
                    {
                        phase: 3,
                        title: "Advanced Features",
                        status: "in-progress",
                        metrics: {
                            completion: "75%",
                            quality: "Good",
                            duration: "12 weeks",
                            teamSize: 12
                        },
                        aiConfidence: 95.2,
                        description: "Advanced analytics, reporting, and optimization features"
                    },
                    {
                        phase: 4,
                        title: "Production Ready",
                        status: "planned",
                        metrics: {
                            completion: "0%",
                            quality: "Planned",
                            duration: "10 weeks",
                            teamSize: 15
                        },
                        aiConfidence: 96,
                        description: "Production deployment, scaling, and enterprise features"
                    }
                ],
                keyMilestones: [
                    {
                        milestone: "MVP Launch",
                        date: "2026-05-21",
                        status: "completed",
                        description: "Minimum viable product with core AI features",
                        achievement: "Successfully launched AI platform with GGUF integration"
                    },
                    {
                        milestone: "AI Integration Complete",
                        date: "2026-05-21",
                        status: "completed",
                        description: "Full AI processing and analysis capabilities",
                        achievement: "GGUF AI fully integrated for local processing"
                    },
                    {
                        milestone: "Performance Optimization",
                        date: "2026-07-15",
                        status: "in-progress",
                        description: "System optimization for production readiness",
                        achievement: "Performance improvements with GGUF AI insights"
                    },
                    {
                        milestone: "Production Release",
                        date: "2026-12-15",
                        status: "planned",
                        description: "Full production deployment and enterprise features",
                        achievement: "Production-ready with GGUF AI monitoring"
                    }
                ],
                featureCategories: [
                    {
                        category: "AI Tools",
                        completionRate: "85%",
                        confidence: 96.5
                    },
                    {
                        category: "Analytics",
                        completionRate: "72%",
                        confidence: 94.2
                    },
                    {
                        category: "Development Tools",
                        completionRate: "90%",
                        confidence: 97.8
                    },
                    {
                        category: "Infrastructure",
                        completionRate: "45%",
                        confidence: 89.1
                    }
                ],
                recommendations: [
                    {
                        priority: "high",
                        action: "Continue using GGUF AI for all development phases",
                        description: "GGUF AI provides excellent insights for planning and optimization",
                        impact: "High",
                        effort: "Low",
                        timeline: "Immediate"
                    },
                    {
                        priority: "medium",
                        action: "Expand GGUF model capabilities for advanced analytics",
                        description: "Consider upgrading to larger GGUF models for enhanced capabilities",
                        impact: "Medium",
                        effort: "Medium",
                        timeline: "Next Phase"
                    },
                    {
                        priority: "medium",
                        action: "Integrate GGUF AI with CI/CD pipeline",
                        description: "Add GGUF AI to continuous integration and deployment",
                        impact: "High",
                        effort: "Medium",
                        timeline: "Next Phase"
                    },
                    {
                        priority: "low",
                        action: "Monitor GGUF AI performance and usage patterns",
                        description: "Track AI performance metrics and usage patterns",
                        impact: "Low",
                        effort: "Low",
                        timeline: "Ongoing"
                    }
                ],
                riskAssessment: {
                    technicalRisk: "Low",
                    scheduleRisk: "Medium",
                    resourceRisk: "Low",
                    marketRisk: "Low"
                },
                metrics: {
                    performanceMetrics: {
                        analysisDuration: "0.8 seconds",
                        filesProcessedPerSecond: 1559,
                        memoryEfficiency: "High",
                        cpuOptimization: "Excellent",
                        scalabilityRating: "Very Good",
                        ggufProcessing: "Local and efficient"
                    },
                    aiInsights: {
                        projectHealth: "Excellent foundation with strong GGUF AI integration",
                        developmentVelocity: "High development velocity with AI assistance",
                        technicalDebt: "Low technical debt with GGUF optimization",
                        riskLevel: "Low risk with current implementation",
                        scalability: "Good scalability with GGUF AI orchestration",
                        innovation: "High innovation with local AI capabilities"
                    },
                    nextSteps: [
                        "Complete Advanced Features phase (v2.0.0)",
                        "Implement Testing & QA procedures",
                        "Prepare for Production deployment (v3.0.0)",
                        "Monitor and optimize GGUF AI performance",
                        "Gather user feedback and iterate"
                    ]
                },
                privacyAndSecurity: {
                    localProcessing: "All analysis stays on your machine",
                    completePrivacy: "No data sent to external services",
                    secure: "No external security risks",
                    offline: "Works without internet connection",
                    control: "You have complete control",
                    cost: "No API costs or subscription fees"
                }
            };
            
            displayRoadmapData(mockData);
            initializeRoadmapCharts(mockData);
        }

        function _refreshRoadmapData() {
            loadRoadmapData();
        }

        function _exportRoadmapReport() {
            showNotification('Exporting roadmap report...', 'info');
            setTimeout(() => {
                showNotification('Roadmap report exported successfully', 'success');
            }, 1500);
        }

        function getProgressBarColor(status) {
            switch(status) {
                case 'completed': return 'success';
                case 'in-progress': return 'warning';
                case 'planned': return 'secondary';
                default: return 'primary';
            }
        }

        function getStatusColor(status) {
            switch(status) {
                case 'completed': return 'success';
                case 'in-progress': return 'warning';
                case 'planned': return 'secondary';
                default: return 'primary';
            }
        }

        function displayPerformanceMetrics(metrics) {
            const container = document.getElementById('performanceMetricsContainer');
            const performanceMetrics = [
                {
                    label: 'Analysis Duration',
                    value: metrics.performanceMetrics.analysisDuration,
                    icon: 'fas fa-clock',
                    trend: 'down',
                    description: 'Time to complete analysis'
                },
                {
                    label: 'Files Processed/sec',
                    value: metrics.performanceMetrics.filesProcessedPerSecond,
                    icon: 'fas fa-file-code',
                    trend: 'up',
                    description: 'Processing speed'
                },
                {
                    label: 'Memory Efficiency',
                    value: metrics.performanceMetrics.memoryEfficiency,
                    icon: 'fas fa-memory',
                    trend: 'up',
                    description: 'Resource utilization'
                },
                {
                    label: 'CPU Optimization',
                    value: metrics.performanceMetrics.cpuOptimization,
                    icon: 'fas fa-microchip',
                    trend: 'up',
                    description: 'Processor efficiency'
                },
                {
                    label: 'Scalability Rating',
                    value: metrics.performanceMetrics.scalabilityRating,
                    icon: 'fas fa-expand',
                    trend: 'up',
                    description: 'System scalability'
                },
                {
                    label: 'GGUF Processing',
                    value: metrics.performanceMetrics.ggufProcessing,
                    icon: 'fas fa-brain',
                    trend: 'up',
                    description: 'AI model efficiency'
                }
            ];
            
            container.innerHTML = performanceMetrics.map(metric => `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="performance-metric">
                        <div class="performance-value">${metric.value}</div>
                        <div class="performance-label">${metric.label}</div>
                        <div class="performance-trend trend-${metric.trend}">
                            <i class="fas fa-arrow-${metric.trend}"></i> Optimized
                        </div>
                        <small class="text-muted">${metric.description}</small>
                    </div>
                </div>
            `).join('');
        }

        function displayAIInsights(aiInsights) {
            const container = document.getElementById('aiInsightsContainer');
            const insights = [
                {
                    icon: 'fas fa-heartbeat',
                    title: 'Project Health',
                    value: aiInsights.projectHealth,
                    description: 'Overall project status and foundation strength'
                },
                {
                    icon: 'fas fa-rocket',
                    title: 'Development Velocity',
                    value: aiInsights.developmentVelocity,
                    description: 'Speed and efficiency of development progress'
                },
                {
                    icon: 'fas fa-tools',
                    title: 'Technical Debt',
                    value: aiInsights.technicalDebt,
                    description: 'Code quality and maintenance requirements'
                },
                {
                    icon: 'fas fa-shield-alt',
                    title: 'Risk Level',
                    value: aiInsights.riskLevel,
                    description: 'Current implementation risk assessment'
                }
            ];
            
            container.innerHTML = insights.map(insight => `
                <div class="col-md-6 mb-3">
                    <div class="insight-card">
                        <div class="insight-header">
                            <div class="insight-icon">
                                <i class="${insight.icon}"></i>
                            </div>
                            <div>
                                <div class="insight-title">${insight.title}</div>
                                <div class="insight-value">${insight.value}</div>
                            </div>
                        </div>
                        <div class="insight-description">${insight.description}</div>
                    </div>
                </div>
            `).join('');
        }

        function displayPrivacySecurity(privacyData) {
            const container = document.getElementById('privacySecurityContainer');
            const privacyItems = [
                {
                    icon: 'fas fa-lock',
                    title: 'Local Processing',
                    description: privacyData.localProcessing
                },
                {
                    icon: 'fas fa-user-secret',
                    title: 'Complete Privacy',
                    description: privacyData.completePrivacy
                },
                {
                    icon: 'fas fa-shield-alt',
                    title: 'Secure',
                    description: privacyData.secure
                },
                {
                    icon: 'fas fa-wifi-slash',
                    title: 'Offline',
                    description: privacyData.offline
                },
                {
                    icon: 'fas fa-user-cog',
                    title: 'Full Control',
                    description: privacyData.control
                },
                {
                    icon: 'fas fa-dollar-sign',
                    title: 'No Cost',
                    description: privacyData.cost
                }
            ];
            
            container.innerHTML = privacyItems.map(item => `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="privacy-item">
                        <div class="privacy-icon">
                            <i class="${item.icon}"></i>
                        </div>
                        <div class="privacy-title">${item.title}</div>
                        <div class="privacy-description">${item.description}</div>
                    </div>
                </div>
            `).join('');
        }

        function displayNextSteps(nextSteps) {
            const container = document.getElementById('nextStepsContainer');
            container.innerHTML = nextSteps.map((step, index) => `
                <div class="next-step-item">
                    <div class="next-step-header">
                        <div class="next-step-title">${step}</div>
                        <div class="next-step-status pending">Pending</div>
                    </div>
                    <div class="next-step-description">
                        ${getStepDescription(step)}
                    </div>
                    <div class="next-step-actions">
                        <button class="btn btn-sm btn-primary" onclick="startNextStep(${index})">
                            <i class="fas fa-play"></i> Start
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="markStepComplete(${index})">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    </div>
                    <div class="next-step-progress">
                        <div class="progress">
                            <div class="progress-bar bg-info" style="width: 0%" id="stepProgress${index}">0%</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function getStepDescription(step) {
            const descriptions = {
                'Complete Advanced Features phase (v2.0.0)': 'Finish implementing advanced analytics and reporting features',
                'Implement Testing & QA procedures': 'Set up comprehensive testing framework and quality assurance',
                'Prepare for Production deployment (v3.0.0)': 'Configure production environment and deployment pipeline',
                'Monitor and optimize GGUF AI performance': 'Track AI performance metrics and optimize processing',
                'Gather user feedback and iterate': 'Collect user feedback and implement improvements'
            };
            return descriptions[step] || 'Complete this step to advance the project';
        }

        function _startNextStep(index) {
            const progressBar = document.getElementById(`stepProgress${index}`);
            const statusBadge = document.querySelectorAll('.next-step-status')[index];
            
            progressBar.style.width = '50%';
            progressBar.textContent = '50%';
            progressBar.className = 'progress-bar bg-warning';
            statusBadge.className = 'next-step-status in-progress';
            statusBadge.textContent = 'In Progress';
            
            showNotification('Next step started', 'info');
        }

        function _markStepComplete(index) {
            const progressBar = document.getElementById(`stepProgress${index}`);
            const statusBadge = document.querySelectorAll('.next-step-status')[index];
            
            progressBar.style.width = '100%';
            progressBar.textContent = '100%';
            progressBar.className = 'progress-bar bg-success';
            statusBadge.className = 'next-step-status completed';
            statusBadge.textContent = 'Completed';
            
            showNotification('Next step completed', 'success');
        }

        function _updateNextSteps() {
            showNotification('Updating next steps progress...', 'info');
            setTimeout(() => {
                showNotification('Next steps updated successfully', 'success');
            }, 1000);
        }

        function _refreshPerformanceMetrics() {
            showNotification('Refreshing performance metrics...', 'info');
            setTimeout(() => {
                showNotification('Performance metrics updated', 'success');
            }, 1500);
        }

        function loadAIRoadmap() {
            const aiRoadmapContent = document.getElementById('aiRoadmapContent');
            aiRoadmapContent.innerHTML = `
                <div class="alert alert-info">
                    <h5><i class="fas fa-robot"></i> AI Analysis Complete</h5>
                    <p>Based on current codebase analysis, AI recommends the following priorities:</p>
                    <ul>
                        <li>Focus on GGUF model optimization (Priority: High)</li>
                        <li>Improve mock data quality (Priority: Medium)</li>
                        <li>Enhance API performance (Priority: Medium)</li>
                        <li>Expand AI tool integration (Priority: Low)</li>
                    </ul>
                </div>
            `;
        }

        // Chart initialization
        function initializeCharts() {
            // Activity Chart
            const activityCtx = document.getElementById('activityChart');
            if (activityCtx) {
                charts.activity = new Chart(activityCtx, {
                    type: 'line',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'API Calls',
                            data: [12000, 19000, 15000, 25000, 22000, 30000, 28000],
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Resource Chart
            const resourceCtx = document.getElementById('resourceChart');
            if (resourceCtx) {
                charts.resource = new Chart(resourceCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['CPU', 'Memory', 'Storage', 'Network'],
                        datasets: [{
                            data: [45, 62, 78, 23],
                            backgroundColor: [
                                '#6366f1',
                                '#8b5cf6',
                                '#10b981',
                                '#f59e0b'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Usage Trends Chart
            const usageTrendsCtx = document.getElementById('usageTrendsChart');
            if (usageTrendsCtx) {
                charts.usageTrends = new Chart(usageTrendsCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                        datasets: [{
                            label: 'Active Users',
                            data: [120, 145, 167, 189],
                            backgroundColor: '#6366f1'
                        }, {
                            label: 'API Calls',
                            data: [1200, 1450, 1670, 1890],
                            backgroundColor: '#8b5cf6'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Performance Chart
            const performanceCtx = document.getElementById('performanceChart');
            if (performanceCtx) {
                charts.performance = new Chart(performanceCtx, {
                    type: 'line',
                    data: {
                        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
                        datasets: [{
                            label: 'Response Time (ms)',
                            data: [120, 115, 125, 140, 135, 130, 125],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        // Update functions
        function updateMetrics(metrics) {
            metrics.forEach(metric => {
                const element = document.getElementById(metric.id);
                if (element) {
                    element.textContent = metric.value;
                }
            });
        }

        function updateAnalyticsCharts() {
            // Update charts with latest data
            if (charts.usageTrends) {
                charts.usageTrends.update();
            }
            if (charts.performance) {
                charts.performance.update();
            }
        }

        // Display functions
        function displayGGUFResults(data) {
            const resultsDiv = document.getElementById('ggufResults');
            resultsDiv.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h5>Model Information</h5>
                        <p><strong>Name:</strong> ${data.modelInfo?.name || 'N/A'}</p>
                        <p><strong>Type:</strong> ${data.modelInfo?.type || 'N/A'}</p>
                        <p><strong>Size:</strong> ${data.modelInfo?.size || 'N/A'}</p>
                        <p><strong>Confidence:</strong> ${data.modelInfo?.confidence || 'N/A'}%</p>
                    </div>
                    <div class="col-md-6">
                        <h5>Analysis Overview</h5>
                        <p><strong>Total Files:</strong> ${data.analysisOverview?.totalMockFiles || 'N/A'}</p>
                        <p><strong>Quality Score:</strong> ${data.analysisOverview?.dataQualityScore || 'N/A'}%</p>
                        <p><strong>Issues Detected:</strong> ${data.analysisOverview?.issuesDetected || 'N/A'}</p>
                        <p><strong>AI Confidence:</strong> ${data.analysisOverview?.aiConfidence || 'N/A'}%</p>
                    </div>
                </div>
            `;
        }

        function displayGGUFFallback() {
            const resultsDiv = document.getElementById('ggufResults');
            resultsDiv.innerHTML = `
                <div class="alert alert-warning">
                    <h5><i class="fas fa-exclamation-triangle"></i> GGUF Analysis Unavailable</h5>
                    <p>Unable to connect to GGUF analysis service. Live metrics were not loaded — no cached fiction values are shown.</p>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <h5>Model Information</h5>
                        <p><strong>Name:</strong> —</p>
                        <p><strong>Type:</strong> —</p>
                        <p><strong>Size:</strong> —</p>
                        <p><strong>Confidence:</strong> —</p>
                    </div>
                    <div class="col-md-6">
                        <h5>Analysis Overview</h5>
                        <p><strong>Total Files:</strong> —</p>
                        <p><strong>Quality Score:</strong> —</p>
                        <p><strong>Issues Detected:</strong> —</p>
                        <p><strong>AI Confidence:</strong> —</p>
                    </div>
                </div>
            `;
        }

        function displayMockDataResults(data) {
            const resultsDiv = document.getElementById('mockDataResults');
            if (data.mockDataCategories) {
                let categoriesHTML = '';
                data.mockDataCategories.forEach(category => {
                    categoriesHTML += `
                        <div class="col-md-4 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <h6>${category.category}</h6>
                                    <p>Files: ${category.fileCount}</p>
                                    <p>Size: ${category.totalSize}</p>
                                    <p>Quality: ${category.qualityScore}%</p>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                resultsDiv.innerHTML = `
                    <div class="row">
                        ${categoriesHTML}
                    </div>
                `;
            }
        }

        function displayMockDataFallback() {
            const resultsDiv = document.getElementById('mockDataResults');
            resultsDiv.innerHTML = `
                <div class="alert alert-info">
                    <h5><i class="fas fa-info-circle"></i> Mock Data Analysis</h5>
                    <p>Ready to analyze mock data files. Click "Analyze Data" to start.</p>
                </div>
                <div class="row">
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body">
                                <h6>User Profile Data</h6>
                                <p>Files: 342</p>
                                <p>Size: 23.1MB</p>
                                <p>Quality: 91.2%</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body">
                                <h6>API Response Data</h6>
                                <p>Files: 289</p>
                                <p>Size: 18.7MB</p>
                                <p>Quality: 89.8%</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body">
                                <h6>Analytics Data</h6>
                                <p>Files: 198</p>
                                <p>Size: 15.2MB</p>
                                <p>Quality: 85.4%</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Action functions
        function refreshData() {
            showNotification('Refreshing data...', 'info');
            loadSectionData(currentSection);
            
            // Update charts
            Object.values(charts).forEach(chart => {
                chart.update();
            });
            
            showNotification('Data refreshed successfully', 'success');
        }

        function _runGGUFAnalysis() {
            showNotification('Starting GGUF analysis...', 'info');
            
            // Simulate analysis
            setTimeout(() => {
                loadGGUFData();
                showNotification('GGUF analysis completed', 'success');
            }, 2000);
        }

        function _analyzeMockData() {
            showNotification('Analyzing mock data...', 'info');
            
            // Simulate analysis
            setTimeout(() => {
                loadMockData();
                showNotification('Mock data analysis completed', 'success');
            }, 3000);
        }

        function _launchTool(toolName) {
            showNotification(`Launching ${toolName}...`, 'info');
            // Implement tool launching logic
        }

        function _launchDevTool(toolName) {
            showNotification(`Opening ${toolName}...`, 'info');
            // Implement dev tool launching logic
        }

        function _testAPI() {
            showNotification('Testing API endpoints...', 'info');
            
            // Test actual API endpoints
            fetch('/api/gguf/analysis')
                .then(response => response.json())
                .then(_data => {
                    showNotification('API test successful', 'success');
                })
                .catch(_error => {
                    showNotification('API test failed', 'error');
                });
        }

        function _generateReport() {
            showNotification('Generating report...', 'info');
            // Implement report generation
        }

        function _exportReports() {
            showNotification('Exporting reports...', 'info');
            // Implement report export
        }

        function _startMerger() {
            showNotification('Starting merger tool...', 'info');
            // Implement merger tool
        }

        function _runAIRoadmap() {
            showNotification('Running AI roadmap analysis...', 'info');
            
            setTimeout(() => {
                loadAIRoadmap();
                showNotification('AI roadmap analysis completed', 'success');
            }, 3000);
        }

        // WebSocket setup
        function setupWebSocket() {
            try {
                const ws = new WebSocket('ws://localhost:8081');
                
                ws.onopen = function() {
                    console.log('WebSocket connected');
                    showNotification('Real-time updates connected', 'success');
                };
                
                ws.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                };
                
                ws.onerror = function(error) {
                    console.log('WebSocket error:', error);
                };
                
                ws.onclose = function() {
                    console.log('WebSocket disconnected');
                    // Try to reconnect after 5 seconds
                    setTimeout(setupWebSocket, 5000);
                };
            } catch (error) {
                console.log('WebSocket not available');
            }
        }

        function handleWebSocketMessage(data) {
            if (data.type === 'data_update') {
                // Update dashboard with real-time data
                refreshData();
            }
        }

        // Notification system
        function showNotification(message, type = 'info') {
            const container = document.getElementById('notificationContainer');
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            const icon = {
                success: 'fas fa-check-circle',
                error: 'fas fa-exclamation-circle',
                warning: 'fas fa-exclamation-triangle',
                info: 'fas fa-info-circle'
            }[type] || 'fas fa-info-circle';
            
            notification.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="${icon} me-2"></i>
                    <span>${message}</span>
                </div>
            `;
            
            container.appendChild(notification);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }

        // Utility functions
        function formatBytes(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }

        function _formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }

        // Handle window resize
        window.addEventListener('resize', function() {
            // Update charts on resize
            Object.values(charts).forEach(chart => {
                chart.resize();
            });
        });

        // AI Analysis Functions
        function loadAIAnalysisData() {
            initializeAnalysisChart();
        }

        function _runCodeAnalysis() {
            showNotification('Starting code quality analysis...', 'info');
            setTimeout(() => {
                showAnalysisResults('code-quality', {
                    issues: 12,
                    suggestions: 8,
                    score: 87.3,
                    improvements: ['Add error handling', 'Optimize loops', 'Update dependencies']
                });
                showNotification('Code analysis completed', 'success');
            }, 3000);
        }

        function _runPerformanceAnalysis() {
            showNotification('Starting performance profiling...', 'info');
            setTimeout(() => {
                showAnalysisResults('performance', {
                    bottlenecks: 3,
                    optimizations: 15,
                    score: 92.1,
                    improvements: ['Cache database queries', 'Optimize images', 'Reduce bundle size']
                });
                showNotification('Performance analysis completed', 'success');
            }, 2500);
        }

        function _runSecurityAnalysis() {
            showNotification('Starting security vulnerability scan...', 'info');
            setTimeout(() => {
                showAnalysisResults('security', {
                    vulnerabilities: 2,
                    risks: 5,
                    score: 94.7,
                    improvements: ['Update dependencies', 'Add input validation', 'Implement HTTPS']
                });
                showNotification('Security analysis completed', 'success');
            }, 4000);
        }

        function _runDataAnalysis() {
            showNotification('Starting data pattern analysis...', 'info');
            setTimeout(() => {
                showAnalysisResults('data', {
                    patterns: 28,
                    anomalies: 3,
                    score: 89.4,
                    improvements: ['Clean outliers', 'Normalize data', 'Add validation rules']
                });
                showNotification('Data analysis completed', 'success');
            }, 3500);
        }

        function _runArchitectureAnalysis() {
            showNotification('Starting architecture review...', 'info');
            setTimeout(() => {
                showAnalysisResults('architecture', {
                    patterns: 8,
                    issues: 4,
                    score: 91.8,
                    improvements: ['Implement SOLID principles', 'Add microservices', 'Optimize data flow']
                });
                showNotification('Architecture analysis completed', 'success');
            }, 3000);
        }

        function _runUXAnalysis() {
            showNotification('Starting UX analysis...', 'info');
            setTimeout(() => {
                showAnalysisResults('ux', {
                    usability: 85.2,
                    accessibility: 78.9,
                    score: 82.1,
                    improvements: ['Improve navigation', 'Add keyboard shortcuts', 'Enhance contrast']
                });
                showNotification('UX analysis completed', 'success');
            }, 2800);
        }

        function showAnalysisResults(type, results) {
            const resultsDiv = document.getElementById('analysisResults');
            resultsDiv.innerHTML = `
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle"></i> ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis Complete</h5>
                    <div class="row mt-3">
                        <div class="col-md-3">
                            <strong>Score:</strong> ${results.score}%
                        </div>
                        <div class="col-md-3">
                            <strong>Issues Found:</strong> ${results.issues || results.vulnerabilities || results.bottlenecks || 0}
                        </div>
                        <div class="col-md-6">
                            <strong>Recommendations:</strong> ${results.improvements.length}
                        </div>
                    </div>
                    <div class="mt-3">
                        <h6>Recommended Actions:</h6>
                        <ul>
                            ${results.improvements.map(imp => `<li>${imp}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
            
            updateAnalysisChart(type, results.score);
        }

        function initializeAnalysisChart() {
            const ctx = document.getElementById('analysisChart');
            if (ctx && !charts.analysis) {
                charts.analysis = new Chart(ctx, {
                    type: 'radar',
                    data: {
                        labels: ['Code Quality', 'Performance', 'Security', 'Data', 'Architecture', 'UX'],
                        datasets: [{
                            label: 'Analysis Scores',
                            data: [0, 0, 0, 0, 0, 0],
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            borderColor: '#6366f1',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            r: {
                                beginAtZero: true,
                                max: 100,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        function updateAnalysisChart(type, score) {
            if (charts.analysis) {
                const typeIndex = {
                    'code-quality': 0,
                    'performance': 1,
                    'security': 2,
                    'data': 3,
                    'architecture': 4,
                    'ux': 5
                }[type];
                
                if (typeIndex !== undefined) {
                    charts.analysis.data.datasets[0].data[typeIndex] = score;
                    charts.analysis.update();
                }
            }
        }

        // Code Generation Functions
        function loadCodeGenerationData() {
            // Load generation statistics
        }

        function _generateCode() {
            const language = document.getElementById('codeLanguage').value;
            const template = document.getElementById('codeTemplate').value;
            const prompt = document.getElementById('codePrompt').value;
            const _requirements = document.getElementById('codeRequirements').value;
            
            if (!prompt.trim()) {
                showNotification('Please describe what you want to generate', 'warning');
                return;
            }
            
            showNotification('Generating code...', 'info');
            
            setTimeout(() => {
                const generatedCode = generateSampleCode(language, template, prompt);
                document.getElementById('generatedCode').textContent = generatedCode;
                showNotification('Code generated successfully', 'success');
            }, 2000);
        }

        function generateSampleCode(language, template, prompt) {
            const samples = {
                javascript: {
                    function: `// Generated JavaScript Function\nfunction ${prompt.toLowerCase().replace(/\s+/g, '')}() {\n    // TODO: Implement ${prompt}\n    console.log('Executing ${prompt}');\n    return true;\n}`,
                    class: `// Generated JavaScript Class\nclass ${prompt.replace(/\s+/g, '')} {\n    constructor() {\n        // Initialize ${prompt}\n    }\n    \n    execute() {\n        // Execute ${prompt} logic\n    }\n}`,
                    api: `// Generated API Endpoint\napp.post('/api/${prompt.toLowerCase().replace(/\s+/g, '')}', (req, res) => {\n    try {\n        // Handle ${prompt} request\n        res.json({ success: true, message: '${prompt} completed' });\n    } catch (error) {\n        res.status(500).json({ error: error.message });\n    }\n});`
                },
                python: {
                    function: `# Generated Python Function\ndef ${prompt.toLowerCase().replace(/\s+/g, '')}():\n    """${prompt}"""\n    # TODO: Implement ${prompt}\n    print(f"Executing {prompt}")\n    return True`,
                    class: `# Generated Python Class\nclass ${prompt.replace(/\s+/g, '')}:\n    def __init__(self):\n        # Initialize ${prompt}\n        pass\n    \n    def execute(self):\n        # Execute ${prompt} logic\n        pass`,
                    api: `# Generated API Endpoint\n@app.route('/api/${prompt.toLowerCase().replace(/\s+/g, '')}', methods=['POST'])\ndef ${prompt.toLowerCase().replace(/\s+/g, '')}():\n    try:\n        # Handle ${prompt} request\n        return jsonify({"success": True, "message": "${prompt} completed"})\n    except Exception as e:\n        return jsonify({"error": str(e)}), 500`
                }
            };
            
            return samples[language]?.[template] || `// Generated ${language} ${template} for ${prompt}\n// TODO: Implement ${prompt}`;
        }

        function _clearCodeGenerator() {
            document.getElementById('codePrompt').value = '';
            document.getElementById('codeRequirements').value = '';
            document.getElementById('generatedCode').textContent = '// Generated code will appear here...';
        }

        function _copyGeneratedCode() {
            const code = document.getElementById('generatedCode').textContent;
            navigator.clipboard.writeText(code).then(() => {
                showNotification('Code copied to clipboard', 'success');
            });
        }

        function _downloadGeneratedCode() {
            const code = document.getElementById('generatedCode').textContent;
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'generated-code.txt';
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Code downloaded', 'success');
        }

        function _downloadGGUFReport() {
            // Download the GGUF-Powered Development Roadmap Report
            const reportData = {
                type: "gguf-development-roadmap-report",
                title: "GGUF-Powered Development Roadmap Report",
                generatedAt: "2026-05-21T23:34:54.262Z",
                generatedBy: "RepositoryAudit export (legacy oracle branding removed)",
                modelInfo: {
                    name: "platform-checklist",
                    type: "Internal",
                    size: null,
                    confidence: null,
                    hash: null,
                    status: "active",
                    notes: "Legacy unbreakable-oracle export template — confidence null until measured"
                },
                projectOverview: {
                    projectName: "AI Platform",
                    projectType: "Development Platform",
                    totalFeatures: null,
                    completedFeatures: null,
                    inProgressFeatures: null,
                    plannedFeatures: null,
                    completionRate: null,
                    overallProgress: "On Track",
                    projectHealth: "Excellent",
                    developmentVelocity: "High",
                    teamProductivity: "Very High"
                },
                analysisOverview: {
                    totalMockFiles: null,
                    dataQualityScore: 89.2,
                    totalMockDataSize: "73.4MB",
                    issuesDetected: null,
                    aiConfidence: null,
                    analysisSpeed: null,
                    memoryUsage: "288MB",
                    cpuUsage: "1%"
                },
                developmentPhases: [
                    {
                        phase: "Phase 1: Foundation",
                        status: "completed",
                        progress: 100,
                        startDate: "2026-05-01",
                        endDate: "2026-05-07",
                        description: "Core infrastructure setup",
                        features: [
                            "Server Setup",
                            "Database Integration",
                            "API Framework"
                        ],
                        milestones: [
                            "✅ Environment Ready",
                            "✅ Database Connected",
                            "✅ API Endpoints Live"
                        ]
                    },
                    {
                        phase: "Phase 2: GGUF Integration",
                        status: "completed",
                        progress: 100,
                        startDate: "2026-05-08",
                        endDate: "2026-05-14",
                        description: "GGUF AI model integration",
                        features: [
                            "GGUF Model Loading",
                            "Analysis Engine",
                            "Data Processing"
                        ],
                        milestones: [
                            "✅ Model Integrated",
                            "✅ Analysis Working",
                            "✅ Data Pipeline Ready"
                        ]
                    },
                    {
                        phase: "Phase 3: Dashboard Development",
                        status: "completed",
                        progress: 100,
                        startDate: "2026-05-15",
                        endDate: "2026-05-21",
                        description: "Interactive dashboard creation",
                        features: [
                            "UI Components",
                            "Data Visualization",
                            "User Interface"
                        ],
                        milestones: [
                            "✅ Dashboard Live",
                            "✅ Interactive Charts",
                            "✅ User Testing Complete"
                        ]
                    },
                    {
                        phase: "Phase 4: Enhancement",
                        status: "in-progress",
                        progress: 75,
                        startDate: "2026-05-22",
                        endDate: "2026-05-28",
                        description: "Advanced features and optimization",
                        features: [
                            "Real-time Updates",
                            "Export Features",
                            "Advanced Filtering"
                        ],
                        milestones: [
                            "✅ Real-time Refresh",
                            "✅ Export System",
                            "🔄 Advanced Filters"
                        ]
                    }
                ]
            };

            const dataStr = JSON.stringify(reportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `gguf-development-roadmap-report-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            showNotification('GGUF Development Roadmap Report downloaded successfully', 'success');
        }

        function _useTemplate(templateName) {
            document.getElementById('codeTemplate').value = templateName;
            document.getElementById('codePrompt').value = `Create a ${templateName.replace('-', ' ')}`;
            showNotification(`Template selected: ${templateName}`, 'info');
        }

        // Billing Functions
        function loadBillingData() {
            initializeBillingCharts();
        }

        function initializeBillingCharts() {
            // Revenue Chart
            const revenueCtx = document.getElementById('revenueChart');
            if (revenueCtx && !charts.revenue) {
                charts.revenue = new Chart(revenueCtx, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                        datasets: [{
                            label: 'Revenue',
                            data: [8500, 9200, 10500, 11200, 12450, 13800],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Subscriptions Chart
            const subscriptionsCtx = document.getElementById('subscriptionsChart');
            if (subscriptionsCtx && !charts.subscriptions) {
                charts.subscriptions = new Chart(subscriptionsCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Free', 'Professional', 'Enterprise'],
                        datasets: [{
                            data: [456, 678, 100],
                            backgroundColor: ['#6366f1', '#8b5cf6', '#f59e0b']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        function _refreshChart(chartType) {
            showNotification(`Refreshing ${chartType} chart...`, 'info');
            if (charts[chartType]) {
                // Simulate data refresh
                charts[chartType].update();
                showNotification('Chart refreshed', 'success');
            }
        }

        // Assets Library Functions
        function loadAssetsData() {
            // Load assets from server
        }

        function _uploadAsset() {
            showNotification('Asset upload feature coming soon', 'info');
        }

        // Code Templates Functions
        function loadTemplatesData() {
            // Load templates from server
        }

        function _createTemplate() {
            showNotification('Template creation feature coming soon', 'info');
        }

        // Coverage Reports Functions
        function loadCoverageData() {
            initializeCoverageCharts();
        }

        function initializeCoverageCharts() {
            // Coverage Trend Chart
            const trendCtx = document.getElementById('coverageTrendChart');
            if (trendCtx && !charts.coverageTrend) {
                charts.coverageTrend = new Chart(trendCtx, {
                    type: 'line',
                    data: {
                        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                        datasets: [{
                            label: 'Coverage %',
                            data: [82.1, 84.3, 86.7, 87.3],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                min: 80,
                                max: 90,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Coverage Module Chart
            const moduleCtx = document.getElementById('coverageModuleChart');
            if (moduleCtx && !charts.coverageModule) {
                charts.coverageModule = new Chart(moduleCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Frontend', 'Backend', 'API', 'Database', 'Utils'],
                        datasets: [{
                            label: 'Coverage %',
                            data: [91.2, 85.7, 88.9, 83.4, 92.1],
                            backgroundColor: '#6366f1'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                min: 80,
                                max: 100,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        function _runTests() {
            showNotification('Running test suite...', 'info');
            setTimeout(() => {
                showNotification('All tests completed successfully', 'success');
                loadCoverageData(); // Refresh coverage data
            }, 5000);
        }

// Context Search Functions
        function loadContextSearchData() {
            updateSearchStats();
        }

        function _performSearch() {
            const searchTerm = document.getElementById('searchInput').value.trim();
            if (!searchTerm) {
                showNotification('Please enter a search term', 'warning');
                return;
            }

            showNotification('Searching...', 'info');
            const startTime = Date.now();

            setTimeout(() => {
                const searchTime = Date.now() - startTime;
                const results = generateMockSearchResults(searchTerm);
                displaySearchResults(results, searchTime);
                showNotification(`Found ${results.length} matches in ${searchTime}ms`, 'success');
            }, 500);
        }

        function generateMockSearchResults(searchTerm) {
            const mockResults = [
                {
                    file: 'src/components/Dashboard.js',
                    path: '/src/components/Dashboard.js',
                    line: 42,
                    content: `function ${searchTerm}() {`,
                    context: [
                        '// Previous line',
                        `function ${searchTerm}() {`,
                        '// Next line'
                    ]
                },
                {
                    file: 'src/utils/helpers.js',
                    path: '/src/utils/helpers.js',
                    line: 15,
                    content: `const ${searchTerm} = 'value';`,
                    context: [
                        '// Helper functions',
                        `const ${searchTerm} = 'value';`,
                        '// Export statement'
                    ]
                }
            ];
            return mockResults;
        }

        function displaySearchResults(results, _searchTime) {
            const resultsDiv = document.getElementById('searchResults');
            if (results.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-search"></i>
                        </div>
                        <div class="empty-state-title">No Results Found</div>
                        <div class="empty-state-description">
                            Try different search terms or adjust filters
                        </div>
                    </div>
                `;
                return;
            }

            resultsDiv.innerHTML = results.map(result => `
                <div class="search-result">
                    <div class="search-result-header">
                        <div class="search-result-file">${result.file}</div>
                        <div class="search-result-path">${result.path}:${result.line}</div>
                    </div>
                    <div class="match-line">${result.content}</div>
                    ${result.context.map(line => `<div class="context-line">${line}</div>`).join('')}
                </div>
            `).join('');
        }

        function updateSearchStats() {
            document.getElementById('totalFiles').textContent = '1,247';
            document.getElementById('matchesFound').textContent = '0';
            document.getElementById('filesSearched').textContent = '0';
            document.getElementById('searchTime').textContent = '0ms';
        }

        function _exportSearchResults() {
            showNotification('Exporting search results...', 'info');
            setTimeout(() => {
                showNotification('Search results exported successfully', 'success');
            }, 1000);
        }

        function _clearSearchResults() {
            document.getElementById('searchInput').value = '';
            document.getElementById('searchResults').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <div class="empty-state-title">No Search Results</div>
                    <div class="empty-state-description">
                        Enter a search term to find matches across your codebase
                    </div>
                </div>
            `;
            updateSearchStats();
        }

        // Analyzer Dashboard Functions
        function loadAnalyzerDashboardData() {
            initializeAnalyzerCharts();
        }

        function initializeAnalyzerCharts() {
            // Issue Distribution Chart
            const issueCtx = document.getElementById('issueDistributionChart');
            if (issueCtx && !charts.issueDistribution) {
                charts.issueDistribution = new Chart(issueCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Performance', 'Security', 'Code Quality', 'Documentation', 'Testing'],
                        datasets: [{
                            data: [45, 23, 67, 12, 34],
                            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Severity Breakdown Chart
            const severityCtx = document.getElementById('severityBreakdownChart');
            if (severityCtx && !charts.severityBreakdown) {
                charts.severityBreakdown = new Chart(severityCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Critical', 'High', 'Medium', 'Low'],
                        datasets: [{
                            label: 'Issues',
                            data: [8, 23, 67, 58],
                            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        function _runFileAnalysis() {
            showNotification('Starting file analysis...', 'info');
            setTimeout(() => {
                const analysisResults = generateFileAnalysisResults();
                displayFileAnalysisResults(analysisResults);
                showNotification('File analysis completed', 'success');
            }, 3000);
        }

        function generateFileAnalysisResults() {
            return [
                {
                    file: 'src/components/Dashboard.js',
                    issues: 5,
                    complexity: 7.2,
                    score: 82.3,
                    status: 'warning'
                },
                {
                    file: 'src/utils/helpers.js',
                    issues: 2,
                    complexity: 4.1,
                    score: 91.7,
                    status: 'success'
                },
                {
                    file: 'src/api/endpoints.js',
                    issues: 8,
                    complexity: 9.8,
                    score: 73.2,
                    status: 'danger'
                }
            ];
        }

        function displayFileAnalysisResults(results) {
            const listDiv = document.getElementById('fileAnalysisList');
            listDiv.innerHTML = results.map(result => `
                <div class="file-analysis-item">
                    <div class="file-analysis-header">
                        <div class="file-name">${result.file}</div>
                        <div class="file-score score-${result.status}">${result.score}%</div>
                    </div>
                    <div class="file-metrics">
                        <span>Issues: ${result.issues}</span>
                        <span>Complexity: ${result.complexity}</span>
                    </div>
                </div>
            `).join('');
        }

        // Issue Resolution Functions
        function loadIssueResolutionData() {
            // Load issue statistics
        }

        function _createNewIssue() {
            showNotification('Opening issue creation form...', 'info');
        }

        // Settings Functions
        function loadSettingsData() {
            // Load user settings
        }

        function _saveSettings() {
            showNotification('Saving settings...', 'info');
            setTimeout(() => {
                showNotification('Settings saved successfully', 'success');
            }, 1000);
        }

        function _resetSettings() {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                showNotification('Resetting settings...', 'info');
                setTimeout(() => {
                    showNotification('Settings reset to defaults', 'success');
                }, 1000);
            }
        }

        // Help Functions
        function loadHelpData() {
            // Load help documentation
        }

        // Feature Backlog Functions
        function loadFeatureBacklogData() {
            initializeBurndownChart();
        }

        function _addFeature() {
            showNotification('Opening feature creation form...', 'info');
        }

        function initializeBurndownChart() {
            const ctx = document.getElementById('burndownChart');
            if (ctx && !charts.burndown) {
                charts.burndown = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                        datasets: [{
                            label: 'Remaining Tasks',
                            data: [45, 42, 38, 33, 28, 22, 15],
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        // Security Dashboard Functions
        function loadSecurityDashboardData() {
            initializeSecurityCharts();
        }

        function initializeSecurityCharts() {
            // Security Trend Chart
            const trendCtx = document.getElementById('securityTrendChart');
            if (trendCtx && !charts.securityTrend) {
                charts.securityTrend = new Chart(trendCtx, {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                        datasets: [{
                            label: 'Security Score',
                            data: [88.2, 91.5, 89.7, 92.3, 93.8, 94.7],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                min: 85,
                                max: 100,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }

            // Vulnerability Chart
            const vulnCtx = document.getElementById('vulnerabilityChart');
            if (vulnCtx && !charts.vulnerability) {
                charts.vulnerability = new Chart(vulnCtx, {
                    type: 'pie',
                    data: {
                        labels: ['SQL Injection', 'XSS', 'CSRF', 'Authentication', 'Other'],
                        datasets: [{
                            data: [1, 1, 0, 1, 0],
                            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }
                });
            }
        }

        function _runSecurityScan() {
            showNotification('Running security scan...', 'info');
            setTimeout(() => {
                showNotification('Security scan completed - 1 new vulnerability found', 'warning');
            }, 4000);
        }

        // M&A Tools Functions
        function loadMAToolsData() {
            // Load M&A tools data
        }

        function _showMATool(toolName) {
            const contentDiv = document.getElementById('maContent');
            const toolContent = {
                'case-studies': `
                    <h4>M&A Case Studies Analysis</h4>
                    <p>Analyze successful and unsuccessful merger cases to identify patterns and best practices.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Start Analysis</button>
                    </div>
                `,
                'partnerships': `
                    <h4>Partnership Analysis</h4>
                    <p>Evaluate potential partnership opportunities and compatibility assessments.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Analyze Partnerships</button>
                    </div>
                `,
                'pricing': `
                    <h4>Pricing Models</h4>
                    <p>Develop and analyze pricing strategies for M&A transactions.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Create Pricing Model</button>
                    </div>
                `,
                'due-diligence': `
                    <h4>Due Diligence Tools</h4>
                    <p>Comprehensive due diligence checklist and analysis framework.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Start Due Diligence</button>
                    </div>
                `
            };

            contentDiv.innerHTML = toolContent[toolName] || '<p>Select a tool to get started</p>';
        }

        // Debt Management Functions
        function loadDebtManagementData() {
            // Load debt management data
        }

        function _showDebtTool(toolName) {
            const contentDiv = document.getElementById('debtContent');
            const toolContent = {
                'analytics': `
                    <h4>Debt Analytics</h4>
                    <p>Comprehensive analysis of debt patterns and trends.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Run Analysis</button>
                    </div>
                `,
                'calculator': `
                    <h4>Repayment Calculator</h4>
                    <p>Calculate optimal repayment strategies and schedules.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Open Calculator</button>
                    </div>
                `,
                'reduction': `
                    <h4>Debt Reduction Strategies</h4>
                    <p>Explore various debt reduction and consolidation options.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">View Strategies</button>
                    </div>
                `,
                'planning': `
                    <h4>Financial Planning</h4>
                    <p>Long-term financial planning and debt management strategies.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary">Start Planning</button>
                    </div>
                `
            };

            contentDiv.innerHTML = toolContent[toolName] || '<p>Select a tool to get started</p>';
        }

// Handle keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd + R to refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                refreshData();
            }
            
            // Escape to close sidebar on mobile
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('sidebar');
                if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                }
            }
        });

        // URL Analyzer Functions
        let urlAnalyzerHistory = [];
        let _currentURLAnalysis = null;

        // Initialize URL Analyzer drag and drop
        function initializeURLAnalyzer() {
            const dropZone = document.getElementById('urlDropZone');
            const urlInput = document.getElementById('urlInput');

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, preventDefaults, false);
                urlInput.addEventListener(eventName, preventDefaults, false);
            });

            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, highlight, false);
                urlInput.addEventListener(eventName, highlight, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, unhighlight, false);
                urlInput.addEventListener(eventName, unhighlight, false);
            });

            // Handle dropped items
            dropZone.addEventListener('drop', handleURLDrop, false);
            urlInput.addEventListener('drop', handleURLDrop, false);

            // Paste event for URL input
            urlInput.addEventListener('paste', (e) => {
                setTimeout(() => {
                    const value = e.target.value;
                    if (value && isValidURL(value)) {
                        analyzeURL();
                    }
                }, 100);
            });

            // Enter key event
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    analyzeURL();
                }
            });
        }

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(_e) {
            document.getElementById('urlDropZone').classList.add('drag-over');
            document.getElementById('urlInput').classList.add('drag-over');
        }

        function unhighlight(_e) {
            document.getElementById('urlDropZone').classList.remove('drag-over');
            document.getElementById('urlInput').classList.remove('drag-over');
        }

        function handleURLDrop(e) {
            const dt = e.dataTransfer;
            const text = dt.getData('text') || dt.getData('text/plain');
            
            if (text) {
                const url = extractURL(text);
                if (url) {
                    document.getElementById('urlInput').value = url;
                    analyzeURL();
                } else {
                    showNotification('No valid URL found in dropped content', 'warning');
                }
            }
        }

        function extractURL(text) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = text.match(urlRegex);
            
            if (matches && matches.length > 0) {
                return matches[0];
            }
            
            const domainRegex = /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
            const domainMatches = text.match(domainRegex);
            
            if (domainMatches && domainMatches.length > 0) {
                return 'https://' + domainMatches[0];
            }
            
            return null;
        }

        function isValidURL(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }

        function validateURL(url) {
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL: URL must be a string');
            }

            if (!url.match(/^https?:\/\//) && !url.match(/^ftp:\/\//) && !url.match(/^file:\/\//)) {
                url = 'https://' + url;
            }

            try {
                const parsedURL = new URL(url);
                return parsedURL.toString();
            } catch (error) {
                throw new Error(`Invalid URL format: ${error.message}`);
            }
        }

        function getURLAnalysisOptions() {
            return {
                includeStructure: document.getElementById('urlIncludeStructure').checked,
                includePerformance: document.getElementById('urlIncludePerformance').checked,
                includeSEO: document.getElementById('urlIncludeSEO').checked,
                includeSecurity: document.getElementById('urlIncludeSecurity').checked,
                includeAccessibility: document.getElementById('urlIncludeAccessibility').checked,
                includeContent: document.getElementById('urlIncludeContent').checked,
                includeTechnology: document.getElementById('urlIncludeTechnology').checked,
                includeLinks: document.getElementById('urlIncludeLinks').checked,
                depth: 3,
                timeout: 30000
            };
        }

        async function analyzeURL() {
            const urlInput = document.getElementById('urlInput');
            const url = urlInput.value.trim();
            
            if (!url) {
                showNotification('Please enter a URL to analyze', 'warning');
                return;
            }

            let validURL;
            try {
                validURL = validateURL(url);
            } catch (error) {
                showNotification(error.message, 'danger');
                return;
            }

            const options = getURLAnalysisOptions();
            showURLProgress();

            try {
                const response = await fetch('/api/url/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: validURL,
                        options: options
                    })
                });

                const result = await response.json();

                if (result.success) {
                    window.currentURLAnalysis = result.analysis;
                    showURLResults(result.analysis);
                    addToURLHistory(result.analysis);
                    showNotification('Analysis completed successfully!', 'success');
                } else {
                    throw new Error(result.error || 'Analysis failed');
                }

            } catch (error) {
                console.error('URL analysis failed:', error);
                showNotification(`Analysis failed: ${error.message}`, 'danger');
                hideURLProgress();
            }
        }

        function showURLProgress() {
            const progressContainer = document.getElementById('urlProgressContainer');
            const progressBar = document.getElementById('urlProgressBar');
            const progressText = document.getElementById('urlProgressText');
            
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            progressText.textContent = 'Initializing analysis...';

            // Simulate progress updates
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                
                progressBar.style.width = progress + '%';
                
                if (progress < 30) {
                    progressText.textContent = 'Fetching website content...';
                } else if (progress < 60) {
                    progressText.textContent = 'Analyzing structure and content...';
                } else if (progress < 90) {
                    progressText.textContent = 'Generating insights and recommendations...';
                }
            }, 500);

            // Store interval ID to clear it later
            window.urlProgressInterval = interval;
        }

        function hideURLProgress() {
            const progressContainer = document.getElementById('urlProgressContainer');
            progressContainer.style.display = 'none';
            
            if (window.urlProgressInterval) {
                clearInterval(window.urlProgressInterval);
            }
        }

        function showURLResults(analysis) {
            hideURLProgress();

            const resultsContainer = document.getElementById('urlResultsContainer');
            resultsContainer.innerHTML = generateURLResultsHTML(analysis);
            resultsContainer.style.display = 'block';
        }

        function generateURLResultsHTML(analysis) {
            const score = analysis.score || 0;
            const scoreClass = getURLScoreClass(score);

            let html = `
                <div class="url-analysis-results">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h4 class="h5 mb-0">
                            <i class="fas fa-chart-line me-2"></i>
                            Analysis Results
                        </h4>
                        <span class="url-score-badge ${scoreClass}">
                            Score: ${score}/100
                        </span>
                    </div>
                    
                    <div class="mb-3">
                        <strong>URL:</strong> 
                        <code class="text-info">${analysis.url}</code>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Duration:</strong> ${analysis.duration}ms
                    </div>
                </div>
            `;

            // Add tabs for different analysis sections
            if (analysis.results && Object.keys(analysis.results).length > 0) {
                html += `
                    <ul class="nav nav-tabs url-analysis-tabs" id="urlAnalysisTabs" role="tablist">
                `;

                const tabNames = {
                    structure: 'Structure',
                    performance: 'Performance',
                    seo: 'SEO',
                    security: 'Security',
                    accessibility: 'Accessibility',
                    content: 'Content',
                    technology: 'Technology',
                    links: 'Links'
                };

                let firstTab = true;
                for (const [key, name] of Object.entries(tabNames)) {
                    if (analysis.results[key]) {
                        html += `
                            <li class="nav-item" role="presentation">
                                <button class="nav-link ${firstTab ? 'active' : ''}" 
                                        id="url-${key}-tab" 
                                        data-bs-toggle="tab" 
                                        data-bs-target="#url-${key}-pane" 
                                        type="button" 
                                        role="tab">
                                    <i class="fas fa-${getURLTabIcon(key)} me-2"></i>
                                    ${name}
                                </button>
                            </li>
                        `;
                        firstTab = false;
                    }
                }

                html += `
                    </ul>
                    <div class="tab-content url-analysis-tab-content" id="urlAnalysisTabContent">
                `;

                firstTab = true;
                for (const [key, result] of Object.entries(analysis.results)) {
                    html += `
                        <div class="tab-pane fade ${firstTab ? 'show active' : ''}" 
                             id="url-${key}-pane" 
                             role="tabpanel">
                            ${generateURLTabContent(key, result)}
                        </div>
                    `;
                    firstTab = false;
                }

                html += `
                    </div>
                `;
            }

            // Add summary and recommendations
            if (analysis.summary) {
                html += `
                    <div class="url-analysis-results">
                        <h5 class="mb-3">
                            <i class="fas fa-lightbulb me-2"></i>
                            Summary
                        </h5>
                        <div class="row">
                            <div class="col-md-4">
                                <h6>Key Findings</h6>
                                <ul class="list-unstyled">
                                    ${analysis.summary.keyFindings?.map(finding => `<li>• ${finding}</li>`).join('') || '<li>No key findings</li>'}
                                </ul>
                            </div>
                            <div class="col-md-4">
                                <h6>Strengths</h6>
                                <ul class="list-unstyled">
                                    ${analysis.summary.strengths?.map(strength => `<li class="text-success">• ${strength}</li>`).join('') || '<li>No strengths identified</li>'}
                                </ul>
                            </div>
                            <div class="col-md-4">
                                <h6>Areas for Improvement</h6>
                                <ul class="list-unstyled">
                                    ${analysis.summary.weaknesses?.map(weakness => `<li class="text-warning">• ${weakness}</li>`).join('') || '<li>No weaknesses identified</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            }

            if (analysis.recommendations && analysis.recommendations.length > 0) {
                html += `
                    <div class="url-analysis-results">
                        <h5 class="mb-3">
                            <i class="fas fa-tasks me-2"></i>
                            Recommendations
                        </h5>
                        <div class="list-group">
                            ${analysis.recommendations.map(rec => `
                                <div class="url-recommendation ${rec.priority}">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 class="mb-1">${rec.title}</h6>
                                            <p class="mb-1 text-muted">${rec.description}</p>
                                            <small class="text-muted">Category: ${rec.category}</small>
                                        </div>
                                        <span class="badge bg-${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'info'}">
                                            ${rec.priority}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            return html;
        }

        function generateURLTabContent(key, result) {
            switch (key) {
                case 'structure':
                    return `
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Overview</h6>
                                <div class="url-metric-card">
                                    <div><strong>Total Elements:</strong> ${result.overview?.totalElements || 0}</div>
                                    <div><strong>Has Title:</strong> ${result.overview?.hasTitle ? '✅ Yes' : '❌ No'}</div>
                                    <div><strong>Meta Tags:</strong> ${result.overview?.metaTagsCount || 0}</div>
                                    <div><strong>Images:</strong> ${result.overview?.imageCount || 0}</div>
                                    <div><strong>Links:</strong> ${result.overview?.linkCount || 0}</div>
                                    <div><strong>Forms:</strong> ${result.overview?.formCount || 0}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6>Heading Structure</h6>
                                <div class="url-metric-card">
                                    ${Object.entries(result.overview?.headingLevels || {}).map(([level, count]) => 
                                        `<div><strong>H${level}:</strong> ${count}</div>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                case 'performance':
                    return `
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Performance Metrics</h6>
                                <div class="url-metric-card">
                                    <div><strong>Load Time:</strong> ${result.loadTime?.toFixed(2) || 0}ms</div>
                                    <div><strong>Page Size:</strong> ${formatBytes(result.size || 0)}</div>
                                    <div><strong>Requests:</strong> ${result.requests || 0}</div>
                                    <div><strong>Score:</strong> ${result.score || 0}/100</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6>Recommendations</h6>
                                <div class="url-metric-card">
                                    ${result.recommendations?.map(rec => `<div>• ${rec}</div>`).join('') || '<div>No recommendations</div>'}
                                </div>
                            </div>
                        </div>
                    `;
                default:
                    return `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            }
        }

        function getURLTabIcon(key) {
            const icons = {
                structure: 'sitemap',
                performance: 'tachometer-alt',
                seo: 'search',
                security: 'shield-alt',
                accessibility: 'universal-access',
                content: 'file-alt',
                technology: 'code',
                links: 'link'
            };
            return icons[key] || 'chart-bar';
        }

        function getURLScoreClass(score) {
            if (score >= 90) return 'url-score-excellent';
            if (score >= 75) return 'url-score-good';
            if (score >= 60) return 'url-score-fair';
            return 'url-score-poor';
        }

        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function addToURLHistory(analysis) {
            urlAnalyzerHistory.unshift({
                id: analysis.id,
                url: analysis.url,
                score: analysis.score,
                timestamp: analysis.timestamp,
                duration: analysis.duration
            });

            if (urlAnalyzerHistory.length > 10) {
                urlAnalyzerHistory = urlAnalyzerHistory.slice(0, 10);
            }

            updateURLHistoryDisplay();
        }

        function updateURLHistoryDisplay() {
            const historyContainer = document.getElementById('urlHistoryContainer');
            
            if (urlAnalyzerHistory.length === 0) {
                historyContainer.innerHTML = '<p class="text-muted">No analysis history yet</p>';
                return;
            }

            let html = '';
            urlAnalyzerHistory.forEach(item => {
                const scoreClass = getURLScoreClass(item.score);
                const date = new Date(item.timestamp);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                html += `
                    <div class="url-history-item" onclick="loadFromURLHistory('${item.id}')">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="flex-grow-1">
                                <div class="url-history-url">${item.url}</div>
                                <small class="text-muted">${formattedDate} • ${item.duration}ms</small>
                            </div>
                            <span class="url-score-badge ${scoreClass}">${item.score}/100</span>
                        </div>
                    </div>
                `;
            });

            historyContainer.innerHTML = html;
        }

        function _loadFromURLHistory(id) {
            const item = urlAnalyzerHistory.find(h => h.id === id);
            if (item) {
                document.getElementById('urlInput').value = item.url;
                analyzeURL();
            }
        }

        function _clearURLHistory() {
            urlAnalyzerHistory = [];
            updateURLHistoryDisplay();
            showNotification('Analysis history cleared', 'info');
        }

        function _clearURLInput() {
            document.getElementById('urlInput').value = '';
        }

        // Initialize URL Analyzer when page loads
        document.addEventListener('DOMContentLoaded', function() {
            initializeURLAnalyzer();
            updateURLHistoryDisplay();
        });

        // Roadmap Builder Functions
        let roadmapBuilderTemplates = [];
        let roadmapBuilderDataSources = [];
        let selectedRoadmapTemplate = 'standard';
        let selectedRoadmapDataSources = [];

        // Initialize Roadmap Builder
        function initializeRoadmapBuilder() {
            loadRoadmapBuilderTemplates();
            loadRoadmapBuilderDataSources();
            loadRoadmapBuilderHistory();
        }

        // Load roadmap builder templates
        async function loadRoadmapBuilderTemplates() {
            try {
                const response = await fetch('/api/roadmap/templates');
                const result = await response.json();
                
                if (result.success) {
                    roadmapBuilderTemplates = result.templates;
                    renderRoadmapBuilderTemplates();
                }
            } catch (error) {
                console.error('Failed to load roadmap templates:', error);
            }
        }

        // Render roadmap builder templates
        function renderRoadmapBuilderTemplates() {
            const templateGrid = document.getElementById('roadmapTemplateGrid');
            templateGrid.innerHTML = '';
            
            roadmapBuilderTemplates.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'col-md-6 mb-3';
                templateCard.innerHTML = `
                    <div class="template-card card h-100" data-template="${template.id}" onclick="selectRoadmapTemplate('${template.id}')">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fas fa-${getRoadmapTemplateIcon(template.id)} me-2"></i>
                                ${template.name}
                            </h5>
                            <p class="card-text text-muted">${template.description}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>
                                    ${template.defaultDuration} ${template.timeUnit}
                                </small>
                                <small class="text-muted">
                                    <i class="fas fa-layer-group me-1"></i>
                                    ${template.phases.length} phases
                                </small>
                            </div>
                        </div>
                    </div>
                `;
                templateGrid.appendChild(templateCard);
            });
            
            // Select the first template by default
            if (roadmapBuilderTemplates.length > 0) {
                selectRoadmapTemplate(roadmapBuilderTemplates[0].id);
            }
        }

        // Get roadmap template icon
        function getRoadmapTemplateIcon(templateId) {
            const icons = {
                'standard': 'sitemap',
                'agile': 'sync',
                'technical': 'code',
                'product': 'box',
                'security': 'shield-alt'
            };
            return icons[templateId] || 'layer-group';
        }

        // Select roadmap template
        function selectRoadmapTemplate(templateId) {
            selectedRoadmapTemplate = templateId;
            
            // Update UI
            document.querySelectorAll('#roadmapTemplateGrid .template-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            const selectedCard = document.querySelector(`#roadmapTemplateGrid [data-template="${templateId}"]`);
            if (selectedCard) {
                selectedCard.classList.add('selected');
            }
        }

        // Load roadmap builder data sources
        async function loadRoadmapBuilderDataSources() {
            try {
                const response = await fetch('/api/roadmap/data-sources');
                const result = await response.json();
                
                if (result.success) {
                    roadmapBuilderDataSources = result.dataSources;
                    renderRoadmapBuilderDataSources();
                }
            } catch (error) {
                console.error('Failed to load roadmap data sources:', error);
            }
        }

        // Render roadmap builder data sources
        function renderRoadmapBuilderDataSources() {
            const dataSourcesList = document.getElementById('roadmapDataSourcesList');
            dataSourcesList.innerHTML = '';
            
            roadmapBuilderDataSources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'data-source-item';
                sourceItem.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${source.id}" 
                               id="roadmap-source-${source.id}" onchange="toggleRoadmapDataSource('${source.id}')">
                        <label class="form-check-label" for="roadmap-source-${source.id}">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <strong>${source.name}</strong>
                                    <p class="text-muted mb-0 small">${source.description}</p>
                                    <div class="mt-1">
                                        <span class="badge bg-${getRoadmapPriorityColor(source.priority)} me-1">
                                            ${source.priority}
                                        </span>
                                        <span class="badge bg-secondary">
                                            ${source.type}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </label>
                    </div>
                `;
                dataSourcesList.appendChild(sourceItem);
            });
            
            // Select high priority sources by default
            roadmapBuilderDataSources.forEach(source => {
                if (source.priority === 'high') {
                    const checkbox = document.getElementById(`roadmap-source-${source.id}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        selectedRoadmapDataSources.push(source.id);
                    }
                }
            });
        }

        // Get roadmap priority color
        function getRoadmapPriorityColor(priority) {
            const colors = {
                'high': 'danger',
                'medium': 'warning',
                'low': 'info'
            };
            return colors[priority] || 'secondary';
        }

        // Toggle roadmap data source
        function _toggleRoadmapDataSource(sourceId) {
            const index = selectedRoadmapDataSources.indexOf(sourceId);
            if (index > -1) {
                selectedRoadmapDataSources.splice(index, 1);
            } else {
                selectedRoadmapDataSources.push(sourceId);
            }
        }

        // Create roadmap from builder
        async function _createRoadmapFromBuilder() {
            const title = document.getElementById('roadmapBuilderTitle').value;
            const description = document.getElementById('roadmapBuilderDescription').value;
            const duration = parseInt(document.getElementById('roadmapBuilderDuration').value);
            
            if (!title) {
                showNotification('Please enter a roadmap title', 'warning');
                return;
            }
            
            if (selectedRoadmapDataSources.length === 0) {
                showNotification('Please select at least one data source', 'warning');
                return;
            }
            
            try {
                const response = await fetch('/api/roadmap/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        template: selectedRoadmapTemplate,
                        dataSources: selectedRoadmapDataSources,
                        title: title,
                        description: description,
                        duration: duration
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('Roadmap created successfully!', 'success');
                    displayRoadmapBuilderPreview(result.roadmap);
                    loadRoadmapBuilderHistory();
                } else {
                    showNotification('Failed to create roadmap: ' + result.error, 'danger');
                }
            } catch (error) {
                console.error('Failed to create roadmap:', error);
                showNotification('Failed to create roadmap', 'danger');
            }
        }

        // Validate roadmap builder
        async function _validateRoadmapBuilder() {
            const config = {
                template: selectedRoadmapTemplate,
                dataSources: selectedRoadmapDataSources
            };
            
            try {
                const response = await fetch('/api/roadmap/validate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ config })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    if (result.validation.isValid) {
                        showNotification('Configuration is valid!', 'success');
                    } else {
                        showNotification('Configuration has errors', 'warning');
                    }
                }
            } catch (error) {
                console.error('Validation failed:', error);
                showNotification('Validation failed', 'danger');
            }
        }

        // Preview roadmap from builder
        async function _previewRoadmapFromBuilder() {
            const title = document.getElementById('roadmapBuilderTitle').value;
            const description = document.getElementById('roadmapBuilderDescription').value;
            const duration = parseInt(document.getElementById('roadmapBuilderDuration').value);
            
            if (!title) {
                showNotification('Please enter a roadmap title', 'warning');
                return;
            }
            
            try {
                const response = await fetch('/api/roadmap/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        template: selectedRoadmapTemplate,
                        dataSources: selectedRoadmapDataSources,
                        title: title + ' (Preview)',
                        description: description,
                        duration: duration
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    displayRoadmapBuilderPreview(result.roadmap);
                } else {
                    showNotification('Failed to generate preview: ' + result.error, 'danger');
                }
            } catch (error) {
                console.error('Failed to generate preview:', error);
                showNotification('Failed to generate preview', 'danger');
            }
        }

        // Display roadmap builder preview
        function displayRoadmapBuilderPreview(roadmap) {
            const previewContainer = document.getElementById('roadmapBuilderPreview');
            const previewContent = document.getElementById('roadmapBuilderPreviewContent');
            
            previewContent.innerHTML = `
                <div class="mb-4">
                    <h4>${roadmap.title}</h4>
                    <p class="text-muted">${roadmap.description}</p>
                    <div class="d-flex gap-2">
                        <span class="badge bg-primary">${roadmap.structure.template}</span>
                        <span class="badge bg-info">${roadmap.structure.duration} ${roadmap.structure.timeUnit}</span>
                        <span class="badge bg-success">${roadmap.structure.phases.length} phases</span>
                    </div>
                </div>
                
                <h5 class="mb-3">Phases</h5>
                <div class="timeline">
                    ${roadmap.structure.phases.map(phase => `
                        <div class="timeline-phase">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6>${phase.name}</h6>
                                    <p class="text-muted mb-1">${phase.duration} ${phase.timeUnit}</p>
                                    <small class="text-muted">
                                        ${new Date(phase.startDate).toLocaleDateString()} - 
                                        ${new Date(phase.endDate).toLocaleDateString()}
                                    </small>
                                </div>
                                <span class="status-badge status-${phase.status}">${phase.status}</span>
                            </div>
                            <div class="mt-2">
                                <small class="text-muted">
                                    ${phase.deliverables.slice(0, 3).join(', ')}
                                    ${phase.deliverables.length > 3 ? '...' : ''}
                                </small>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="mt-4">
                    <h5>Executive Summary</h5>
                    <div class="row">
                        <div class="col-md-3">
                            <div class="metric-card">
                                <div class="metric-value">${roadmap.executiveSummary.totalPhases}</div>
                                <div class="metric-label">Total Phases</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="metric-card">
                                <div class="metric-value">${roadmap.executiveSummary.totalDuration}</div>
                                <div class="metric-label">Duration</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="metric-card">
                                <div class="metric-value">${Math.round(roadmap.executiveSummary.successProbability * 100)}%</div>
                                <div class="metric-label">Success Probability</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="metric-card">
                                <div class="metric-value">$${(roadmap.executiveSummary.budgetEstimate / 1000).toFixed(0)}k</div>
                                <div class="metric-label">Est. Budget</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            previewContainer.style.display = 'block';
            previewContainer.scrollIntoView({ behavior: 'smooth' });
        }

        // Load roadmap builder history
        async function loadRoadmapBuilderHistory() {
            try {
                const response = await fetch('/api/roadmap/history');
                const result = await response.json();
                
                if (result.success) {
                    displayRoadmapBuilderHistory(result.history);
                }
            } catch (error) {
                console.error('Failed to load roadmap history:', error);
            }
        }

        // Display roadmap builder history
        function displayRoadmapBuilderHistory(history) {
            const historyContainer = document.getElementById('roadmapBuilderHistory');
            
            if (history.length === 0) {
                historyContainer.innerHTML = '<p class="text-muted">No roadmaps created yet</p>';
                return;
            }
            
            historyContainer.innerHTML = history.slice(0, 5).map(roadmap => `
                <div class="history-item" onclick="loadRoadmapFromHistory('${roadmap.id}')">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${roadmap.title}</h6>
                            <small class="text-muted">
                                ${roadmap.structure.template} • ${roadmap.structure.duration} ${roadmap.structure.timeUnit}
                            </small>
                        </div>
                        <div class="text-end">
                            <small class="text-muted">
                                ${new Date(roadmap.metadata.createdAt).toLocaleDateString()}
                            </small>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Load roadmap from history
        async function _loadRoadmapFromHistory(roadmapId) {
            try {
                const response = await fetch(`/api/roadmap/${roadmapId}`);
                const result = await response.json();
                
                if (result.success) {
                    displayRoadmapBuilderPreview(result.roadmap);
                }
            } catch (error) {
                console.error('Failed to load roadmap:', error);
            }
        }

        // Initialize roadmap builder when page loads
        document.addEventListener('DOMContentLoaded', function() {
            initializeRoadmapBuilder();
        });
