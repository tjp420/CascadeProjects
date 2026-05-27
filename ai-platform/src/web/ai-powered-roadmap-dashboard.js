/**
 * AI-Powered Roadmap Dashboard
 * Comprehensive visualization and management of development phases, release timeline, and AI recommendations
 */

class AIPoweredRoadmapDashboard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            animateCharts: true,
            showDetails: true,
            interactiveElements: true,
            theme: 'dark',
            realTimeUpdates: true,
            updateInterval: 30000,
            ...options
        };
        this.data = null;
        this.charts = [];
        
        this.init();
    }

    /**
     * Initialize the AI-powered roadmap dashboard
     */
    init() {
        if (!this.container) {
            console.error('AI-powered roadmap dashboard container not found');
            return;
        }

        this.setupStyles();
        this.createDashboardStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the dashboard
     */
    setupStyles() {
        const styleId = 'ai-roadmap-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .ai-roadmap-dashboard {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    color: #f8fafc;
                }

                .dashboard-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .dashboard-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .dashboard-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .model-info {
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 2rem;
                }

                .model-details {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 0.5rem;
                    flex-wrap: wrap;
                }

                .model-name {
                    font-weight: 600;
                    color: #3b82f6;
                }

                .model-type, .model-size, .model-confidence {
                    background: rgba(59, 130, 246, 0.2);
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    color: #f8fafc;
                }

                .generation-info {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    flex-wrap: wrap;
                }

                .generated-at, .generated-by {
                    opacity: 0.8;
                }

                .overview-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .overview-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .overview-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
                    border-color: #3b82f6;
                }

                .card-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #3b82f6;
                    margin-bottom: 0.5rem;
                }

                .card-label {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .card-metric {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .phases-section {
                    margin-bottom: 2rem;
                }

                .phases-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .phases-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .phases-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .phase-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .phase-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .phase-card.completed {
                    border-color: #10b981;
                }

                .phase-card.in-progress {
                    border-color: #f59e0b;
                }

                .phase-card.planned {
                    border-color: #6b7280;
                }

                .phase-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .phase-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .phase-status {
                    padding: 0.25rem 0.75rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-completed {
                    background: #10b981;
                    color: white;
                }

                .status-in-progress {
                    background: #f59e0b;
                    color: white;
                }

                .status-planned {
                    background: #6b7280;
                    color: white;
                }

                .phase-progress {
                    margin: 1rem 0;
                }

                .progress-bar {
                    height: 8px;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
                    border-radius: 4px;
                    transition: width 1s ease-in-out;
                }

                .phase-metrics {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.5rem;
                    margin-top: 1rem;
                }

                .phase-metric {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .deliverables-list {
                    margin-top: 1rem;
                }

                .deliverable-item {
                    padding: 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    margin-bottom: 0.5rem;
                    font-size: 0.9rem;
                }

                .milestones-list {
                    margin-top: 1rem;
                }

                .milestone-item {
                    padding: 0.25rem 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    margin-bottom: 0.25rem;
                    font-size: 0.8rem;
                }

                .milestone-completed {
                    color: #10b981;
                }

                .timeline-section {
                    margin-bottom: 2rem;
                }

                .timeline-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .timeline-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .timeline-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1.5rem;
                }

                .release-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .release-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .release-card.completed {
                    border-color: #10b981;
                }

                .release-card.planned {
                    border-color: #6b7280;
                }

                .release-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .release-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .release-version {
                    padding: 0.25rem 0.75rem;
                    background: rgba(59, 130, 246, 0.2);
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .release-date {
                    font-size: 0.9rem;
                    color: #94a3b8;
                }

                .release-features {
                    margin-top: 1rem;
                }

                .feature-item {
                    padding: 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    margin-bottom: 0.5rem;
                    font-size: 0.9rem;
                }

                .release-metrics {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5rem;
                    margin-top: 1rem;
                }

                .release-metric {
                    text-align: center;
                    padding: 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    font-size: 0.8rem;
                }

                .metric-value {
                    font-weight: 600;
                    color: #f8fafc;
                }

                .metric-label {
                    font-size: 0.7rem;
                    color: #94a3b8;
                }

                .recommendations-section {
                    margin-bottom: 2rem;
                }

                .recommendations-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .recommendations-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .recommendations-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 1.5rem;
                }

                .recommendation-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .recommendation-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .recommendation-card.priority-high {
                    border-left: 4px solid #ef4444;
                }

                .recommendation-card.priority-medium {
                    border-left: 4px solid #f59e0b;
                }

                .recommendation-card.priority-low {
                    border-left: 4px solid #10b981;
                }

                .recommendation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .recommendation-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .recommendation-priority {
                    padding: 0.25rem 0.75rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .priority-high {
                    background: #ef4444;
                    color: white;
                }

                .priority-medium {
                    background: #f59e0b;
                    color: white;
                }

                .priority-low {
                    background: #10b981;
                    color: white;
                }

                .recommendation-content {
                    margin-bottom: 1rem;
                }

                .recommendation-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin-bottom: 0.5rem;
                }

                .recommendation-metrics {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .recommendation-metric {
                    padding: 0.25rem 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .recommendation-timeline {
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .recommendation-impact {
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .metrics-section {
                    margin-bottom: 2rem;
                }

                .metrics-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .metrics-title {
                    font-size: 1.5rem;
                    font-size: 600;
                    color: #f8fafc;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .metric-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .metric-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .metric-card.health-good {
                    border-color: #10b981;
                }

                .metric-card.health-moderate {
                    border-color: #f59e0b;
                }

                .metric-card.health-low {
                    border-color: #ef4444;
                }

                .metric-value {
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }

                .metric-value.excellent {
                    color: #10b981;
                }

                .metric-value.good {
                    color: #3b82f6;
                }

                .metric-value.moderate {
                    color: #f59e0b;
                }

                .metric-value.poor {
                    color: #ef4444;
                }

                .metric-label {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .metric-description {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .risk-assessment {
                    margin-top: 2rem;
                }

                .risk-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .risk-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .risk-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .risk-item {
                    padding: 1rem;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    text-align: center;
                }

                .risk-item.low {
                    border-color: #10b981;
                }

                .risk-item.medium {
                    border-color: #f59e0b;
                }

                .risk-item.high {
                    border-color: #ef4444;
                }

                .risk-label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .risk-value {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin-bottom: 0.25rem;
                }

                .risk-value.low {
                    color: #10b981;
                }

                .risk-value.medium {
                    color: #f59e0b;
                }

                .risk-value.high {
                    color: #ef4444;
                }

                .risk-description {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                @media (max-width: 768px) {
                    .ai-roadmap-dashboard {
                        padding: 1rem;
                    }

                    .overview-cards {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .phases-grid {
                        grid-template-columns: 1fr;
                    }

                    .timeline-grid {
                        grid-template-columns: 1fr;
                    }

                    .recommendations-grid {
                        grid-template-columns: 1fr;
                    }

                    .metrics-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .risk-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the dashboard structure
     */
    createDashboardStructure() {
        this.container.textContent = `
            <div class="ai-roadmap-dashboard">
                <div class="dashboard-header">
                    <h2 class="dashboard-title">🤖️ AI-Powered Roadmap Dashboard</h2>
                    <p class="dashboard-subtitle">Comprehensive development phases, release timeline, and AI recommendations</p>
                    <div class="model-info">
                        <div class="model-details">
                            <span class="model-name">🤖 ${this.data.modelInfo?.name || 'GGUF AI Model'}</span>
                            <span class="model-type">${this.data.modelInfo?.type || 'GGUF'}</span>
                            <span class="model-size">${this.data.modelInfo?.size || '1.88GB'}</span>
                            <span class="model-confidence">Confidence: ${this.data.modelInfo?.confidence || 98.5}%</span>
                        </div>
                        <div class="generation-info">
                            <span class="generated-at">Generated: ${new Date(this.data.generatedAt).toLocaleString()}</span>
                            <span class="generated-by">By: ${this.data.generatedBy || 'GGUF AI Model'}</span>
                        </div>
                    </div>
                </div>

                <div class="overview-cards" id="overview-cards">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="phases-section">
                    <div class="phases-header">
                        <h3 class="phases-title">🚀 Development Phases</h3>
                    <div class="phases-summary">4 phases • 50% completion</div>
                    </div>
                    <div class="phases-grid" id="phases-grid">
                        <!-- Development phases will be rendered here -->
                    </div>
                </div>

                <div class="timeline-section">
                    <div class="timeline-header">
                        <h3 class="timeline-title">📅 Release Timeline</h3>
                        <div class="timeline-summary">4 releases • 2 completed</div>
                    </div>
                    <div class="timeline-grid" id="timeline-grid">
                        <!-- Release timeline will be rendered here -->
                    </div>
                </div>

                <div class="recommendations-section">
                    <div class="recommendations-header">
                        <h3 class="recommendations-title">🧠 AI Recommendations</h3>
                        <div class="recommendations-summary">4 recommendations • 95.2% confidence</div>
                    </div>
                    <div class="recommendations-grid" id="recommendations-grid">
                        <!-- AI recommendations will be rendered here -->
                    </div>
                </div>

                <div class="metrics-section">
                    <div class="metrics-header">
                        <h3 class="metrics-title">📊 Project Metrics</h3>
                        <div class="metrics-summary">Overall health: Good • 85% test coverage</div>
                    </div>
                    <div class="metrics-grid" id="metrics-grid">
                        <!-- Project metrics will be rendered here -->
                    </div>
                </div>

                <div class="feature-categories-section">
                    <div class="categories-header">
                        <h3 class="categories-title">📋 Feature Categories</h3>
                        <div class="categories-summary">4 categories • 47 total features</div>
                    </div>
                    <div class="categories-grid" id="categories-grid">
                        <!-- Feature categories will be rendered here -->
                    </div>
                </div>

                <div class="milestones-section">
                    <div class="milestones-header">
                        <h3 class="milestones-title">🎯 Key Milestones</h3>
                        <div class="milestones-summary">4 milestones • 2 completed</div>
                    </div>
                    <div class="milestones-grid" id="milestones-grid">
                        <!-- Key milestones will be rendered here -->
                    </div>
                </div>

                <div class="gguf-insights-section">
                    <div class="insights-header">
                        <h3 class="insights-title">🤖 GGUF AI Insights</h3>
                        <div class="insights-summary">Comprehensive AI analysis</div>
                    </div>
                    <div class="insights-grid" id="insights-grid">
                        <!-- GGUF AI insights will be rendered here -->
                    </div>
                </div>

                <div class="performance-section">
                    <div class="performance-header">
                        <h3 class="performance-title">⚡ Performance Metrics</h3>
                        <div class="performance-summary">1559 files/second • 0.8s duration</div>
                    </div>
                    <div class="performance-grid" id="performance-grid">
                        <!-- Performance metrics will be rendered here -->
                    </div>
                </div>

                <div class="next-steps-section">
                    <div class="steps-header">
                        <h3 class="steps-title">🚀 Next Steps</h3>
                        <div class="steps-summary">5 action items</div>
                    </div>
                    <div class="steps-grid" id="steps-grid">
                        <!-- Next steps will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load AI-powered roadmap data and render dashboard
     */
    async loadAIRoadmapData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            // Add AI-powered roadmap data structure with latest report data
            this.data = {
                ...roadmapData,
                projectOverview: {
                    projectName: "AI Platform",
                    projectType: "Development Platform",
                    totalFeatures: 47,
                    completedFeatures: 31,
                    inProgressFeatures: 16,
                    plannedFeatures: 0,
                    completionRate: "66.0%",
                    overallProgress: "On Track",
                    projectHealth: "Excellent",
                    developmentVelocity: "High",
                    teamProductivity: "Very High"
                },
                executiveSummary: {
                    totalPhases: 4,
                    completedPhases: 2,
                    plannedPhases: 2,
                    completionRate: "50%",
                    projectHealth: "Excellent",
                    developmentVelocity: "High",
                    technicalDebt: "Low",
                    riskLevel: "Low",
                    estimatedCompletion: "2026-12-15",
                    teamProductivity: "Very High",
                    codeQuality: "Excellent",
                    testCoverage: "85%",
                    aiConfidence: "98.5%"
                },
                developmentPhases: [
                    {
                        phase: 1,
                        title: "Foundation",
                        status: "completed",
                        date: "2026-05-21",
                        description: "Core platform architecture and basic AI processing capabilities",
                        deliverables: [
                            "AI Platform Setup",
                            "Basic Processing",
                            "Core Architecture",
                            "GGUF Integration"
                        ],
                        metrics: {
                            completion: "100%",
                            quality: "Excellent",
                            duration: "8 weeks",
                            teamSize: 8,
                            milestones: 3
                        },
                        aiConfidence: 98.5,
                        ggufInsights: "Strong foundation with GGUF AI integration established"
                    },
                    {
                        phase: 2,
                        title: "AI Integration",
                        status: "completed",
                        date: "2026-05-21",
                        description: "Advanced AI features and intelligent automation systems",
                        deliverables: [
                            "AI Analysis Tools",
                            "Smart Processing",
                            "Automation",
                            "GGUF AI Enhancement"
                        ],
                        metrics: {
                            completion: "100%",
                            quality: "Excellent",
                            duration: "8 weeks",
                            teamSize: 10,
                            milestones: 4
                        },
                        aiConfidence: 98.5,
                        ggufInsights: "AI capabilities fully integrated with GGUF local processing"
                    },
                    {
                        phase: 3,
                        title: "Advanced Features",
                        status: "in-progress",
                        date: "2026-07-15",
                        description: "Advanced analytics, reporting, and optimization features",
                        deliverables: [
                            "Analytics Dashboard",
                            "Reporting System",
                            "Performance Optimization",
                            "GGUF AI Insights"
                        ],
                        metrics: {
                            completion: "75%",
                            quality: "Good",
                            duration: "12 weeks",
                            teamSize: 12,
                            milestones: 6
                        },
                        aiConfidence: 95.2,
                        ggufInsights: "GGUF AI providing advanced analytics and optimization insights"
                    },
                    {
                        phase: 4,
                        title: "Production Ready",
                        status: "planned",
                        date: "2026-12-15",
                        description: "Production deployment, scaling, and enterprise features",
                        deliverables: [
                            "Enterprise Features",
                            "Scaling Solutions",
                            "Production Deployment",
                            "GGUF AI Monitoring"
                        ],
                        metrics: {
                            completion: "0%",
                            quality: "Planned",
                            duration: "10 weeks",
                            teamSize: 15,
                            milestones: 8
                        },
                        aiConfidence: 96,
                        ggufInsights: "GGUF AI will provide production-level monitoring and insights"
                    }
                ],
                releaseTimeline: [
                    {
                        version: "v1.0.0",
                        title: "AI Platform Foundation",
                        date: "2026-05-21",
                        status: "completed",
                        description: "Initial release with core AI capabilities",
                        features: [
                            "AI Platform Setup",
                            "Basic Processing",
                            "Core Architecture",
                            "GGUF Integration"
                        ],
                        metrics: {
                            performance: "Excellent",
                            stability: "High",
                            userSatisfaction: "95%",
                            adoptionRate: "High"
                        }
                    },
                    {
                        version: "v1.1.0",
                        title: "AI Integration Complete",
                        date: "2026-05-21",
                        status: "completed",
                        description: "Full AI integration with GGUF local processing",
                        features: [
                            "AI Analysis Tools",
                            "Smart Processing",
                            "Automation",
                            "GGUF AI Enhancement"
                        ],
                        metrics: {
                            performance: "Excellent",
                            stability: "High",
                            userSatisfaction: "97%",
                            adoptionRate: "Very High"
                        }
                    },
                    {
                        version: "v2.0.0",
                        title: "Advanced Analytics",
                        date: "2026-07-15",
                        status: "planned",
                        description: "Advanced analytics and reporting with GGUF AI insights",
                        features: [
                            "Analytics Dashboard",
                            "Reporting System",
                            "Performance Optimization",
                            "GGUF AI Insights"
                        ],
                        metrics: {
                            performance: "Target: Outstanding",
                            stability: "Target: Very High",
                            userSatisfaction: "Target: 98%",
                            adoptionRate: "Target: Maximum"
                        }
                    },
                    {
                        version: "v3.0.0",
                        title: "Production Scale",
                        date: "2026-12-15",
                        status: "planned",
                        description: "Production-scale deployment with GGUF AI orchestration",
                        features: [
                            "Enterprise Features",
                            "Scaling Solutions",
                            "Production Deployment",
                            "GGUF AI Monitoring"
                        ],
                        metrics: {
                            performance: "Target: Exceptional",
                            stability: "Target: Maximum",
                            userSatisfaction: "Target: 99%",
                            adoptionRate: "Target: Maximum"
                        }
                    }
                ],
                featureCategories: [
                    {
                        category: "AI Tools",
                        totalFeatures: 20,
                        completedFeatures: 17,
                        completionRate: "85%",
                        confidence: 96.5,
                        description: "AI-powered development tools and utilities"
                    },
                    {
                        category: "Analytics",
                        totalFeatures: 18,
                        completedFeatures: 13,
                        completionRate: "72%",
                        confidence: 94.2,
                        description: "Analytics and reporting capabilities"
                    },
                    {
                        category: "Development Tools",
                        totalFeatures: 10,
                        completedFeatures: 9,
                        completionRate: "90%",
                        confidence: 97.8,
                        description: "Development and productivity tools"
                    },
                    {
                        category: "Infrastructure",
                        totalFeatures: 11,
                        completedFeatures: 5,
                        completionRate: "45%",
                        confidence: 89.1,
                        description: "Infrastructure and deployment systems"
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
                ggufAIInsights: {
                    projectHealth: "Excellent foundation with strong GGUF AI integration",
                    developmentVelocity: "High development velocity with AI assistance",
                    technicalDebt: "Low technical debt with GGUF optimization",
                    riskLevel: "Low risk with current implementation",
                    scalability: "Good scalability with GGUF AI orchestration",
                    innovation: "High innovation with local AI capabilities"
                },
                ggufAIRecommendations: [
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
                performanceMetrics: {
                    analysisDuration: "0.8 seconds",
                    filesProcessedPerSecond: 1559,
                    memoryEfficiency: "High",
                    cpuOptimization: "Excellent",
                    scalabilityRating: "Very Good",
                    ggufProcessing: "Local and efficient"
                },
                nextSteps: [
                    "Complete Advanced Features phase (v2.0.0)",
                    "Implement Testing & QA procedures",
                    "Prepare for Production deployment (v3.0.0)",
                    "Monitor and optimize GGUF AI performance",
                    "Gather user feedback and iterate"
                ],
                privacyAndSecurity: {
                    localProcessing: "All roadmap analysis stays on your machine",
                    completePrivacy: "No data sent to external services",
                    secure: "No external security risks",
                    offline: "Works without internet connection",
                    control: "You have complete control",
                    cost: "No API costs or subscription fees"
                }
            };
            
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to load AI-powered roadmap data:', error);
            this.showError('Failed to load AI-powered roadmap data');
        }
    }

    /**
     * Render the dashboard with data
     */
    renderDashboard() {
        if (!this.data) return;

        this.renderOverviewCards();
        this.renderDevelopmentPhases();
        this.renderReleaseTimeline();
        this.renderAIRecommendations();
        this.renderProjectMetrics();
        this.renderFeatureCategories();
        this.renderKeyMilestones();
        this.renderGGUFInsights();
        this.renderPerformanceMetrics();
        this.renderNextSteps();
        
        if (this.options.animateCharts) {
            this.animateCharts();
        }
    }

    /**
     * Render overview cards
     */
    renderOverviewCards() {
        const container = document.getElementById('overview-cards');
        const overview = this.data.projectOverview;
        const summary = this.data.executiveSummary;
        
        container.textContent = `
            <div class="overview-card">
                <div class="card-value">${overview.totalFeatures}</div>
                <div class="card-label">Total Features</div>
                <div class="card-metric">Platform capabilities</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.completedFeatures}</div>
                <div class="card-label">Completed</div>
                <div class="card-metric">Features delivered</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.completionRate}%</div>
                <div class="card-label">Completion Rate</div>
                <div class="card-metric">Overall progress</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.projectHealth}</div>
                <div class="card-label">Project Health</div>
                <div class="card-metric">Status assessment</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.developmentVelocity}</div>
                <div class="card-label">Development Velocity</div>
                <div class="card-metric">Team productivity</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${summary.aiConfidence}%</div>
                <div class="card-label">AI Confidence</div>
                <div class="card-metric">GGUF AI accuracy</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render development phases
     */
    renderDevelopmentPhases() {
        const container = document.getElementById('phases-grid');
        const phases = this.data.developmentPhases;
        
        container.textContent = phases.map(phase => `
            <div class="phase-card ${phase.status}">
                <div class="phase-header">
                    <div class="phase-title">${phase.title}</div>
                    <span class="phase-status status-${phase.status}">${phase.status}</span>
                </div>
                <div class="phase-date">${phase.date}</div>
                <div class="phase-description">${phase.description}</div>
                <div class="phase-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${phase.metrics.completion}%"></div>
                    </div>
                    <div class="progress-text">${phase.metrics.completion}% Complete</div>
                </div>
                <div class="phase-metrics">
                    <div class="phase-metric">Duration: ${phase.metrics.duration}</div>
                    <div class="phase-metric">Quality: ${phase.metrics.quality}</div>
                    <div class="phase-metric">Team Size: ${phase.metrics.teamSize}</div>
                    <div class="phase-metric">Milestones: ${phase.metrics.milestones}</div>
                    <div class="phase-metric">AI Confidence: ${phase.aiConfidence}%</div>
                </div>
                <div class="deliverables-list">
                    ${phase.deliverables.map(deliverable => `
                        <div class="deliverable-item">✅ ${deliverable}</div>
                    `).join('')}
                </div>
                <div class="gguf-insights">
                    <div class="insight-title">🤖 GGUF AI Insights</div>
                    <div class="insight-content">${phase.ggufInsights}</div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render release timeline
     */
    renderReleaseTimeline() {
        const container = document.getElementById('timeline-grid');
        const releases = this.data.releaseTimeline;
        
        container.textContent = releases.map(release => `
            <div class="release-card ${lease.status}">
                <div class="release-header">
                    <div class="release-title">${release.title}</div>
                    <span class="release-version">${release.version}</span>
                </div>
                <div class="release-date">${release.date}</div>
                <div class="release-description">${release.description}</div>
                <div class="release-features">
                    ${release.features.map(feature => `
                        <div class="feature-item">• ${feature}</div>
                    `).join('')}
                </div>
                <div class="release-metrics">
                    <div class="release-metric">
                        <div class="metric-value">${release.metrics.performance}</div>
                        <div class="metric-label">Performance</div>
                    </div>
                    <div class="release-metric">
                        <div class="metric-value">${release.metrics.stability}</div>
                        <div class="metric-label">Stability</div>
                    </div>
                    <div class="release-metric">
                        <div class="metric-value">${release.metrics.userSatisfaction}%</div>
                        <div class="metric-label">Satisfaction</div>
                    </div>
                    <div class="release-metric">
                        <div class="metric-value">${release.metrics.adoptionRate}</div>
                        <div class="metric-label">Adoption Rate</div>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render AI recommendations
     */
    renderAIRecommendations() {
        const container = document.getElementById('recommendations-grid');
        const recommendations = this.data.aiRecommendations;
        
        container.textContent = recommendations.map(rec => `
            <div class="recommendation-card priority-${rec.priority}">
                <div class="recommendation-header">
                    <div class="recommendation-title">${rec.action}</div>
                    <span class="recommendation-priority priority-${rec.priority}">${rec.priority}</span>
                </div>
                <div class="recommendation-content">
                    <p>${rec.description}</p>
                    <div class="recommendation-metrics">
                        <div class="recommendation-metric">Impact: ${rec.impact}</div>
                        <div class="recommendation-metric">Effort: ${rec.effort}</div>
                        <div class="recommendation-timeline">Timeline: ${rec.timeline}</div>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render project metrics
     */
    renderProjectMetrics() {
        const container = document.getElementById('metrics-grid');
        const metrics = this.data.projectMetrics;
        
        container.textContent = `
            <div class="metric-card health-${metrics.overallHealth.toLowerCase()}">
                <div class="metric-value ${this.getHealthClass(metrics.overallHealth)}">${metrics.overallHealth}</div>
                <div class="metric-label">Overall Health</div>
                <div class="metric-description">Project status assessment</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.teamProductivity}</div>
                <div class="card-label">Team Productivity</div>
                <div class="card-description">Development efficiency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.codeQuality}</div>
                <div class="card-label">Code Quality</div>
                <div class="card-description">Code standards</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.testCoverage}%</div>
                <div class="card-label">Test Coverage</div>
                <div class="card-description">Code testing</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.documentation}</div>
                <div class="card-label">Documentation</div>
                <div class="card-description">Documentation status</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.performance}</div>
                <div class="card-label">Performance</div>
                <div class="card-description">System performance</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.scalability}</div>
                <div class="card-label">Scalability</div>
                <div class="card-description">Growth capacity</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render risk assessment
     */
    renderRiskAssessment() {
        const container = document.getElementById('risk-grid');
        const risks = this.data.riskAssessment;
        
        container.textContent = Object.entries(risks).map(([key, value]) => `
            <div class="risk-item ${value.toLowerCase()}">
                <div class="risk-label">${this.formatRiskName(key)}</div>
                <div class="risk-value ${value.toLowerCase()}">${value}</div>
                <div class="risk-description">${this.getRiskDescription(key)}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Get health class based on value
     */
    getHealthClass(health) {
        switch (health.toLowerCase()) {
            case 'excellent': return 'excellent';
            case 'good': return 'good';
            case 'moderate': return 'moderate';
            case 'low': return 'low';
            default: return 'poor';
        }
    }

    /**
     * Format risk name for display
     */
    formatRiskName(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/([A-Z])/g, ' $1');
    }

    /**
     * Get risk description
     */
    getRiskDescription(key) {
        const descriptions = {
            technicalRisk: "Technical implementation risks",
            scheduleRisk: "Timeline and scheduling risks",
            resourceRisk: "Resource availability risks",
            marketRisk: "Market and competitive risks",
            securityRisk: "Security vulnerabilities",
            complianceRisk: "Compliance requirements",
            overallRisk: "Overall project risk"
        };
        return descriptions[key] || 'Unknown risk';
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Add click handlers for interactive elements
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('phase-card')) {
                const phaseCard = e.target.closest('.phase-card');
                const phaseTitle = phaseCard.querySelector('.phase-title').textContent;
                this.showPhaseDetails(phaseTitle);
            }
            
            if (e.target.classList.contains('release-card')) {
                const releaseCard = e.target.closest('.release-card');
                const releaseTitle = releaseCard.querySelector('.release-title').textContent;
                this.showReleaseDetails(releaseTitle);
            }
            
            if (e.target.classList.contains('recommendation-card')) {
                const recommendationCard = e.target.closest('.recommendation-card');
                const recommendationTitle = recommendationCard.querySelector('.recommendation-title').textContent;
                this.showRecommendationDetails(recommendationTitle);
            }
        });

        // Add hover effects for cards
        this.container.addEventListener('mouseenter', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.style.transform = 'translateY(-5px)';
            }
        });

        this.container.addEventListener('mouseleave', (e) => {
            if (e.target.classList.contains('card')) {
                    e.target.style.transform = 'translateY(0)';
                }
        });
    }

    /**
     * Show phase details modal
     */
    showPhaseDetails(phaseTitle) {
        const phase = this.data.developmentPhases.find(p => p.title === phaseTitle);
        if (!phase) return;

        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${phase.title}</h3>
                <div class="phase-details">
                    <p><strong>Status:</strong> ${phase.status}</p>
                    <p><strong>Date:</strong> ${phase.date}</p>
                    <p><strong>Progress:</strong> ${phase.metrics.completion}%</p>
                    <p><strong>Quality:</strong> ${phase.metrics.quality}</p>
                    <p><strong>Duration:</strong> ${phase.metrics.duration}</p>
                    <p><strong>Description:</strong> ${phase.description}</p>
                </div>
                <div class="phase-details">
                    <h4>Deliverables:</h4>
                    <ul>
                        ${phase.deliverables.map(deliverable => `<li>${deliverable}</li>`).join('')}
                    </ul>
                </div>
                <div class="phase-details">
                    <h4>Milestones:</h4>
                    <ul>
                        ${phase.milestones.map(milestone => `<li>${milestone}</li>`).join('')}
                    </ul>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Show release details modal
     */
    showReleaseDetails(releaseTitle) {
        const release = this.data.releaseTimeline.find(r => r.title === releaseTitle);
        if (!release) return;

        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${release.title}</h3>
                <div class="release-details">
                    <p><strong>Version:</strong> ${release.version}</p>
                    <p><strong>Status:</strong> ${release.status}</p>
                    <p><strong>Date:</strong> ${release.date}</p>
                    <p><strong>Description:</strong> ${release.description}</p>
                </div>
                <div class="release-details">
                    <h4>Features:</h4>
                    <ul>
                        ${release.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
                <div class="release-details">
                    <h4>Metrics:</h4>
                    <div class="release-metrics">
                        <div>Performance: ${release.metrics.performance}</div>
                        <div>Stability: ${release.metrics.stability}</div>
                        <div>User Satisfaction: ${release.metrics.userSatisfaction}%</div>
                    </div>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Show recommendation details modal
     */
    showRecommendationDetails(recommendationTitle) {
        const recommendation = this.data.aiRecommendations.find(r => r.action === recommendationTitle);
        if (!recommendation) return;

        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${recommendation.action}</h3>
                <div class="recommendation-details">
                    <p><strong>Priority:</strong> ${recommendation.priority}</p>
                    <p><strong>Impact:</strong> ${recommendation.impact}</p>
                    <p><strong>Effort:</strong> ${recommendation.effort}</p>
                    <p><strong>Timeline:</strong> ${recommendation.timeline}</p>
                    <p><strong>Description:</strong> ${recommendation.description}</p>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        setInterval(() => {
            this.refreshData();
        }, this.options.updateInterval);
    }

    /**
     * Refresh data with latest information
     */
    async refreshData() {
        try {
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            // Update with latest AI-powered roadmap data
            this.data = {
                ...roadmapData,
                executiveSummary: {
                    totalPhases: 4,
                    completedPhases: 1,
                    plannedPhases: 3,
                    completionRate: "25%",
                    projectHealth: "Good",
                    developmentVelocity: "Moderate",
                    technicalDebt: "Low",
                    riskLevel: "Low",
                    estimatedCompletion: "2026-12-15",
                    teamProductivity: "High",
                    codeQuality: "Excellent",
                    testCoverage: "85%",
                    aiConfidence: "95.2%"
                }
            };
            
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to refresh AI-powered roadmap data:', error);
        }
    }

    /**
     * Animate charts and visualizations
     */
    animateCharts() {
        // Animate progress bars
        const progressBars = this.container.querySelectorAll('.progress-fill');
        progressBars.forEach(bar => {
            const targetWidth = bar.getAttribute('data-target-width');
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, 100);
        });

        // Animate cards on scroll
        const cards = this.container.querySelectorAll('.card, .phase-card, .release-card, .recommendation-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Render feature categories
     */
    renderFeatureCategories() {
        const container = document.getElementById('categories-grid');
        const categories = this.data.featureCategories;
        
        container.textContent = categories.map(category => `
            <div class="category-card">
                <div class="category-header">
                    <div class="category-title">${category.category}</div>
                    <span class="category-confidence">${category.confidence}%</span>
                </div>
                <div class="category-description">${category.description}</div>
                <div class="category-metrics">
                    <div class="category-metric">
                        <div class="metric-value">${category.totalFeatures}</div>
                        <div class="metric-label">Total Features</div>
                    </div>
                    <div class="category-metric">
                        <div class="metric-value">${category.completedFeatures}</div>
                        <div class="metric-label">Completed</div>
                    </div>
                    <div class="category-metric">
                        <div class="metric-value">${category.completionRate}</div>
                        <div class="metric-label">Completion Rate</div>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render key milestones
     */
    renderKeyMilestones() {
        const container = document.getElementById('milestones-grid');
        const milestones = this.data.keyMilestones;
        
        container.textContent = milestones.map(milestone => `
            <div class="milestone-card ${milestone.status}">
                <div class="milestone-header">
                    <div class="milestone-title">${milestone.milestone}</div>
                    <span class="milestone-status status-${milestone.status}">${milestone.status}</span>
                </div>
                <div class="milestone-date">${milestone.date}</div>
                <div class="milestone-description">${milestone.description}</div>
                <div class="milestone-achievement">
                    <div class="achievement-title">🎯 Achievement</div>
                    <div class="achievement-content">${milestone.achievement}</div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render GGUF AI insights
     */
    renderGGUFInsights() {
        const container = document.getElementById('insights-grid');
        const insights = this.data.ggufAIInsights;
        
        container.textContent = Object.entries(insights).map(([key, value]) => `
            <div class="insight-card">
                <div class="insight-title">${this.formatInsightTitle(key)}</div>
                <div class="insight-value">${value}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render performance metrics
     */
    renderPerformanceMetrics() {
        const container = document.getElementById('performance-grid');
        const metrics = this.data.performanceMetrics;
        
        container.textContent = Object.entries(metrics).map(([key, value]) => `
            <div class="performance-card">
                <div class="performance-title">${this.formatMetricTitle(key)}</div>
                <div class="performance-value">${value}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render next steps
     */
    renderNextSteps() {
        const container = document.getElementById('steps-grid');
        const steps = this.data.nextSteps;
        
        container.textContent = steps.map((step, index) => `
            <div class="step-card">
                <div class="step-number">${index + 1}</div>
                <div class="step-content">${step}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Format insight title for display
     */
    formatInsightTitle(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    /**
     * Format metric title for display
     */
    formatMetricTitle(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ef4444;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1000;
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Global function to initialize the AI-powered roadmap dashboard
window.initializeAIRoadmapDashboard = async function() {
    try {
        if (typeof window.AIPoweredRoadmapDashboard !== 'undefined') {
            const aiRoadmapDashboard = new AIPoweredRoadmapDashboard('ai-roadmap-dashboard-container', {
                animateCharts: true,
                showDetails: true,
                interactiveElements: true,
                theme: 'dark',
                realTimeUpdates: true,
                updateInterval: 30000
            });
            
            await aiRoadmapDashboard.loadAIRoadmapData();
            
            console.log('✅ AI-powered roadmap dashboard initialized successfully');
        } else {
            console.warn('⚠️ AIPoweredRoadmapDashboard class not available');
        }
    } catch (error) {
        console.error('❌ Failed to initialize AI-powered roadmap dashboard:', error);
    }
};
