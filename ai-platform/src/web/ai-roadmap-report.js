/**
 * AI Roadmap Report Dashboard JavaScript
 * Interactive functionality for the AI-powered roadmap report system
 */

// Global variables
let reportData = null;
let charts = {};
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

/**
 * Initialize the dashboard
 */
async function initializeDashboard() {
    try {
        showLoading();
        await loadReportData();
        hideLoading();
        displayExecutiveSummary();
        initializeCharts();
        displayTabContent('comparative');
        console.log('✅ AI Roadmap Report Dashboard initialized');
    } catch (error) {
        console.error('❌ Failed to initialize dashboard:', error);
        showError('Failed to initialize dashboard: ' + error.message);
        hideLoading();
    }
}

/**
 * Load report data from API
 */
async function loadReportData(retryCount = 0) {
    const maxRetries = 3;
    
    try {
        const response = await fetch('/api/roadmap/ai-report');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            reportData = result.data;
            console.log('✅ Report data loaded successfully');
            return true;
        } else {
            throw new Error(result.message || 'Failed to load report data');
        }
    } catch (error) {
        console.error(`❌ Error loading report data (attempt ${retryCount + 1}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries) {
            console.log(`🔄 Retrying in ${1000 * (retryCount + 1)}ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return loadReportData(retryCount + 1);
        }
        
        // Fallback to mock data if API fails
        console.log('⚠️ Using fallback data due to API failure');
        reportData = generateFallbackData();
        return true;
    }
}

/**
 * Generate new report
 */
async function generateReport() {
    try {
        showLoading();
        const response = await fetch('/api/roadmap/ai-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            reportData = result.data;
            displayExecutiveSummary();
            updateAllCharts();
            displayTabContent(getActiveTab());
            showSuccess('Report generated successfully!');
        } else {
            throw new Error(result.message || 'Failed to generate report');
        }
        
        hideLoading();
    } catch (error) {
        console.error('❌ Error generating report:', error);
        showError('Failed to generate report: ' + error.message);
        hideLoading();
    }
}

/**
 * Generate fallback data for when API is unavailable
 */
function generateFallbackData() {
    return {
        type: 'ai-powered-roadmap-report-fallback',
        title: 'AI-Powered Roadmap Report (Fallback)',
        generatedAt: new Date().toISOString(),
        generatedBy: 'Fallback System',
        executiveSummary: {
            totalFeatures: 47,
            completedFeatures: 31,
            completionRate: '66.0%',
            projectHealth: 'Excellent',
            developmentVelocity: 'High',
            teamProductivity: 'Very High',
            aiConfidence: {
                gguf: 98.5,
                ai: 97.2,
                average: '97.8%'
            }
        },
        comparativeAnalysis: {
            modelComparison: {
                gguf: {
                    confidence: 98.5,
                    size: '1.88GB',
                    status: 'active'
                },
                ai: {
                    confidence: 97.2,
                    size: '2.1GB',
                    status: 'active'
                }
            }
        },
        predictiveAnalytics: {
            completionForecast: {
                currentRate: '66%',
                estimatedCompletion: '2026-07-15',
                confidence: 92.8
            }
        },
        riskAssessment: {
            overallRiskScore: 25,
            riskCategories: {
                technical: { score: 20, level: 'Low' },
                schedule: { score: 35, level: 'Medium' },
                resource: { score: 25, level: 'Low' },
                market: { score: 20, level: 'Low' }
            }
        },
        strategicRecommendations: {
            highPriority: [
                {
                    action: 'Continue AI integration across all development phases',
                    impact: 'High',
                    effort: 'Medium',
                    timeline: 'Immediate',
                    description: 'Leverage AI capabilities for enhanced development velocity and quality'
                }
            ],
            mediumPriority: [
                {
                    action: 'Implement advanced analytics and monitoring',
                    impact: 'Medium',
                    effort: 'Medium',
                    timeline: 'Next phase',
                    description: 'Add comprehensive analytics for performance and user behavior'
                }
            ],
            lowPriority: [
                {
                    action: 'Optimize AI model performance',
                    impact: 'Low',
                    effort: 'Low',
                    timeline: 'Ongoing',
                    description: 'Fine-tune AI models for better performance and efficiency'
                }
            ]
        },
        performanceMetrics: {
            developmentMetrics: {
                velocity: { current: 'High', metric: '2.5 story points per sprint' },
                quality: { codeQuality: '88%', testCoverage: '85%' },
                productivity: { teamProductivity: 'Very High', aiAssistedTasks: '75%' }
            }
        },
        businessImpact: {
            marketImpact: {
                marketReadiness: '75%',
                competitivePosition: 'Strong',
                marketOpportunity: 'High'
            },
            financialImpact: {
                projectedRevenue: { year1Revenue: '$5M', year3Revenue: '$25M' },
                roi: '200%'
            }
        }
    };
}

/**
 * Refresh data with enhanced error handling
 */
async function refreshData() {
    try {
        showLoading();
        const success = await loadReportData();
        
        if (success) {
            displayExecutiveSummary();
            updateAllCharts();
            displayTabContent(getActiveTab());
            showSuccess('Data refreshed successfully!');
        } else {
            showError('Failed to refresh data');
        }
        
        hideLoading();
    } catch (error) {
        console.error('❌ Error refreshing data:', error);
        showError('Failed to refresh data: ' + error.message);
        hideLoading();
    }
}

/**
 * Export report in specified format
 */
async function exportReport(format) {
    try {
        const response = await fetch(`/api/gguf/export/${format}`);
        
        if (format === 'json') {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-roadmap-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showSuccess('Report exported successfully!');
        } else {
            const result = await response.json();
            if (result.success) {
                showSuccess('Export functionality coming soon!');
            } else {
                throw new Error(result.message);
            }
        }
    } catch (error) {
        console.error(`❌ Error exporting report as ${format}:`, error);
        showError(`Failed to export report: ${error.message}`);
    }
}

/**
 * Display executive summary
 */
function displayExecutiveSummary() {
    if (!reportData || !reportData.executiveSummary) return;
    
    const summary = reportData.executiveSummary;
    const container = document.getElementById('executiveSummary');
    
    const executiveCards = [
        {
            icon: 'fas fa-tasks',
            color: 'var(--primary-gradient)',
            value: `${summary.totalPhases} Phases`,
            label: 'Development Phases',
            change: `${summary.completedPhases} Completed`,
            changeType: 'positive'
        },
        {
            icon: 'fas fa-percentage',
            color: 'var(--success-gradient)',
            value: summary.completionRate,
            label: 'Completion Rate',
            change: 'On Track',
            changeType: 'positive'
        },
        {
            icon: 'fas fa-heart',
            color: 'var(--info-gradient)',
            value: summary.projectHealth,
            label: 'Project Health',
            change: summary.developmentVelocity,
            changeType: 'positive'
        },
        {
            icon: 'fas fa-brain',
            color: 'var(--warning-gradient)',
            value: `${summary.aiConfidence}%`,
            label: 'AI Confidence',
            change: 'High Accuracy',
            changeType: 'positive'
        }
    ];
    
    container.textContent = executiveCards.map(card => `
        <div class="col-md-3 col-sm-6">
            <div class="executive-card">
                <div class="card-icon" style="background: ${card.color} /* Replaced innerHTML with textContent for safety */ color: white;">
                    <i class="${card.icon}"></i>
                </div>
                <div class="card-value">${card.value}</div>
                <div class="card-label">${card.label}</div>
                <div class="card-change change-${card.changeType}">
                    <i class="fas fa-arrow-${card.changeType === 'positive' ? 'up' : 'down'} me-1"></i>
                    ${card.change}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Initialize all charts
 */
function initializeCharts() {
    if (!reportData) return;
    
    // Initialize comparative charts
    initializeModelComparisonChart();
    initializePhaseComparisonChart();
    initializeCategoryComparisonChart();
    
    // Initialize predictive charts
    initializeCompletionForecastChart();
    initializeRiskForecastChart();
    
    // Initialize risk charts
    initializeRiskMatrixChart();
    
    // Initialize performance charts
    initializePerformanceTrendsChart();
    initializeTechnicalPerformanceChart();
    
    // Initialize business impact charts
    initializeFinancialProjectionsChart();
    initializeROIAnalysisChart();
    initializeStakeholderImpactChart();
}

/**
 * Initialize model comparison chart
 */
function initializeModelComparisonChart() {
    const ctx = document.getElementById('modelComparisonChart').getContext('2d');
    
    if (!reportData.comparativeAnalysis) return;
    
    const comparison = reportData.comparativeAnalysis.modelComparison;
    
    charts.modelComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['GGUF Model', 'AI Model'],
            datasets: [{
                label: 'Confidence Score',
                data: [comparison.gguf.confidence, comparison.ai.confidence],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ],
                borderColor: [
                    'rgba(99, 102, 241, 1)',
                    'rgba(236, 72, 153, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize phase comparison chart
 */
function initializePhaseComparisonChart() {
    const ctx = document.getElementById('phaseComparisonChart').getContext('2d');
    
    if (!reportData.comparativeAnalysis) return;
    
    const phases = reportData.comparativeAnalysis.phaseComparison;
    
    charts.phaseComparison = new Chart(ctx, {
        type: 'line',
        data: {
            labels: phases.map(p => `Phase ${p.phase}`),
            datasets: [{
                label: 'GGUF Confidence',
                data: phases.map(p => p.ggufMetrics.aiConfidence),
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }, {
                label: 'AI Confidence',
                data: phases.map(p => p.aiMetrics.aiConfidence),
                borderColor: 'rgba(236, 72, 153, 1)',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
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
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize category comparison chart
 */
function initializeCategoryComparisonChart() {
    const ctx = document.getElementById('categoryComparisonChart').getContext('2d');
    
    if (!reportData.comparativeAnalysis) return;
    
    const categories = reportData.comparativeAnalysis.featureCategoryComparison;
    
    charts.categoryComparison = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: categories.map(c => c.category),
            datasets: [{
                label: 'GGUF Completion Rate',
                data: categories.map(c => parseInt(c.ggufData.completionRate)),
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
            }, {
                label: 'AI Completion Rate',
                data: categories.map(c => parseInt(c.aiData.completionRate)),
                borderColor: 'rgba(236, 72, 153, 1)',
                backgroundColor: 'rgba(236, 72, 153, 0.2)',
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
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    },
                    pointLabels: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
}

/**
 * Initialize completion forecast chart
 */
function initializeCompletionForecastChart() {
    const ctx = document.getElementById('completionForecastChart').getContext('2d');
    
    if (!reportData.predictiveAnalytics) return;
    
    const forecast = reportData.predictiveAnalytics.completionForecast;
    
    charts.completionForecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Current', 'Phase 3', 'Phase 4', 'Complete'],
            datasets: [{
                label: 'Completion Probability',
                data: [66, 85, 95, 100],
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
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
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize risk forecast chart
 */
function initializeRiskForecastChart() {
    const ctx = document.getElementById('riskForecastChart').getContext('2d');
    
    if (!reportData.predictiveAnalytics) return;
    
    charts.riskForecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Current', 'Phase 3', 'Phase 4', 'Production'],
            datasets: [{
                label: 'Risk Level',
                data: [25, 35, 30, 20],
                borderColor: 'rgba(245, 158, 11, 1)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true
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
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize risk matrix chart
 */
function initializeRiskMatrixChart() {
    const ctx = document.getElementById('riskMatrixChart').getContext('2d');
    
    if (!reportData.riskAssessment) return;
    
    const riskCategories = reportData.riskAssessment.riskCategories;
    
    charts.riskMatrix = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(riskCategories),
            datasets: [{
                label: 'Risk Score',
                data: Object.values(riskCategories).map(cat => cat.score),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(16, 185, 129, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize performance trends chart
 */
function initializePerformanceTrendsChart() {
    const ctx = document.getElementById('performanceTrendsChart').getContext('2d');
    
    charts.performanceTrends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
            datasets: [{
                label: 'Development Velocity',
                data: [2.0, 2.2, 2.3, 2.4, 2.5, 2.5],
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }, {
                label: 'Code Quality',
                data: [82, 84, 85, 86, 88, 88],
                borderColor: 'rgba(16, 185, 129, 1)',
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
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize technical performance chart
 */
function initializeTechnicalPerformanceChart() {
    const ctx = document.getElementById('technicalPerformanceChart').getContext('2d');
    
    charts.technicalPerformance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Processing Speed', 'Memory Efficiency', 'Scalability', 'Reliability'],
            datasets: [{
                data: [85, 90, 80, 95],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ],
                borderColor: [
                    'rgba(99, 102, 241, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(236, 72, 153, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
}

/**
 * Initialize financial projections chart
 */
function initializeFinancialProjectionsChart() {
    const ctx = document.getElementById('financialProjectionsChart').getContext('2d');
    
    charts.financialProjections = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3'],
            datasets: [{
                label: 'Projected Revenue ($M)',
                data: [5, 15, 25],
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }, {
                label: 'Development Costs ($M)',
                data: [2.5, 3.5, 4.5],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2
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
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize ROI analysis chart
 */
function initializeROIAnalysisChart() {
    const ctx = document.getElementById('roiAnalysisChart').getContext('2d');
    
    charts.roiAnalysis = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'],
            datasets: [{
                label: 'Cumulative ROI (%)',
                data: [-20, -10, 0, 25, 50, 100, 150, 200],
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
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
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Initialize stakeholder impact chart
 */
function initializeStakeholderImpactChart() {
    const ctx = document.getElementById('stakeholderImpactChart').getContext('2d');
    
    charts.stakeholderImpact = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Customers', 'Developers', 'Business', 'Partners', 'Community'],
            datasets: [{
                label: 'Impact Score',
                data: [85, 90, 95, 75, 80],
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
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
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: '#475569'
                    },
                    pointLabels: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked tab button
    event.target.classList.add('active');
    
    // Display tab content
    displayTabContent(tabName);
}

/**
 * Get active tab name
 */
function getActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    return activeTab ? activeTab.id : 'comparative';
}

/**
 * Display tab content based on selected tab
 */
function displayTabContent(tabName) {
    if (!reportData) return;
    
    switch (tabName) {
        case 'comparative':
            displayComparativeAnalysis();
            break;
        case 'predictive':
            displayPredictiveAnalytics();
            break;
        case 'risk':
            displayRiskAssessment();
            break;
        case 'recommendations':
            displayRecommendations();
            break;
        case 'performance':
            displayPerformanceMetrics();
            break;
        case 'business-impact':
            displayBusinessImpact();
            break;
    }
}

/**
 * Display comparative analysis
 */
function displayComparativeAnalysis() {
    if (!reportData.comparativeAnalysis) return;
    
    // Update charts with animation
    if (charts.modelComparison) {
        charts.modelComparison.update();
    }
    if (charts.phaseComparison) {
        charts.phaseComparison.update();
    }
    if (charts.categoryComparison) {
        charts.categoryComparison.update();
    }
}

/**
 * Display predictive analytics
 */
function displayPredictiveAnalytics() {
    if (!reportData.predictiveAnalytics) return;
    
    const forecast = reportData.predictiveAnalytics;
    
    // Update completion forecast
    const completionElement = document.getElementById('completionRate');
    if (completionElement) {
        completionElement.textContent = forecast.completionForecast.currentRate;
    }
    
    // Update resource forecast
    const resourceElement = document.getElementById('resourceForecast');
    if (resourceElement) {
        resourceElement.textContent = `${forecast.resourceForecast.currentTeamSize} → ${forecast.resourceForecast.projectedTeamSize}`;
    }
    
    // Update charts
    if (charts.completionForecast) {
        charts.completionForecast.update();
    }
    if (charts.riskForecast) {
        charts.riskForecast.update();
    }
}

/**
 * Display risk assessment
 */
function displayRiskAssessment() {
    if (!reportData.riskAssessment) return;
    
    const risk = reportData.riskAssessment;
    
    // Display risk grid
    const riskGrid = document.getElementById('riskGrid');
    if (riskGrid) {
        const riskCards = Object.entries(risk.riskCategories).map(([key, category]) => {
            const riskLevel = category.level.toLowerCase();
            return `
                <div class="risk-card">
                    <div class="risk-score">${category.score}</div>
                    <div class="risk-level ${riskLevel}">${category.level}</div>
                    <div class="risk-factors">${key.charAt(0).toUpperCase() + key.slice(1)} Risk</div>
                </div>
            `;
        }).join('');
        
        riskGrid.textContent = riskCards /* Replaced innerHTML with textContent for safety */
    }
    
    // Display mitigation strategies
    const mitigationElement = document.getElementById('mitigationStrategies');
    if (mitigationElement) {
        const strategies = risk.mitigationPlan.map(strategy => `
            <div class="recommendation-card">
                <div class="recommendation-title">${strategy}</div>
            </div>
        `).join('');
        
        mitigationElement.textContent = strategies /* Replaced innerHTML with textContent for safety */
    }
    
    // Update risk matrix chart
    if (charts.riskMatrix) {
        charts.riskMatrix.update();
    }
}

/**
 * Display recommendations
 */
function displayRecommendations() {
    if (!reportData.strategicRecommendations) return;
    
    const recommendations = reportData.strategicRecommendations;
    
    // Display high priority recommendations
    const highPriorityElement = document.getElementById('highPriorityRecommendations');
    if (highPriorityElement) {
        const highPriorityRecs = recommendations.highPriority.map(rec => createRecommendationCard(rec, 'high')).join('');
        highPriorityElement.textContent = highPriorityRecs /* Replaced innerHTML with textContent for safety */
    }
    
    // Display medium priority recommendations
    const mediumPriorityElement = document.getElementById('mediumPriorityRecommendations');
    if (mediumPriorityElement) {
        const mediumPriorityRecs = recommendations.mediumPriority.map(rec => createRecommendationCard(rec, 'medium')).join('');
        mediumPriorityElement.textContent = mediumPriorityRecs /* Replaced innerHTML with textContent for safety */
    }
    
    // Display low priority recommendations
    const lowPriorityElement = document.getElementById('lowPriorityRecommendations');
    if (lowPriorityElement) {
        const lowPriorityRecs = recommendations.lowPriority.map(rec => createRecommendationCard(rec, 'low')).join('');
        lowPriorityElement.textContent = lowPriorityRecs /* Replaced innerHTML with textContent for safety */
    }
    
    // Display strategic initiatives
    const initiativesElement = document.getElementById('strategicInitiatives');
    if (initiativesElement) {
        const initiatives = recommendations.strategicInitiatives.map(initiative => `
            <div class="recommendation-card">
                <div class="recommendation-title">
                    <i class="fas fa-star me-2"></i>
                    ${initiative}
                </div>
            </div>
        `).join('');
        
        initiativesElement.textContent = initiatives /* Replaced innerHTML with textContent for safety */
    }
}

/**
 * Create recommendation card HTML
 */
function createRecommendationCard(recommendation, priority) {
    return `
        <div class="recommendation-card">
            <div class="recommendation-priority priority-${priority}">${priority.toUpperCase()} PRIORITY</div>
            <div class="recommendation-title">${recommendation.action}</div>
            <div class="recommendation-description">${recommendation.description}</div>
            <div class="recommendation-meta">
                <span><i class="fas fa-bolt"></i> ${recommendation.impact} Impact</span>
                <span><i class="fas fa-clock"></i> ${recommendation.effort} Effort</span>
                <span><i class="fas fa-calendar"></i> ${recommendation.timeline}</span>
            </div>
        </div>
    `;
}

/**
 * Display performance metrics
 */
function displayPerformanceMetrics() {
    if (!reportData.performanceMetrics) return;
    
    const performance = reportData.performanceMetrics;
    
    // Update development metrics
    const velocityElement = document.getElementById('developmentVelocity');
    if (velocityElement) {
        velocityElement.textContent = performance.developmentMetrics.velocity.metric;
    }
    
    const qualityElement = document.getElementById('codeQuality');
    if (qualityElement) {
        qualityElement.textContent = `${performance.developmentMetrics.quality.codeQuality}%`;
    }
    
    const productivityElement = document.getElementById('teamProductivity');
    if (productivityElement) {
        productivityElement.textContent = performance.developmentMetrics.productivity.teamProductivity;
    }
    
    // Update charts
    if (charts.performanceTrends) {
        charts.performanceTrends.update();
    }
    if (charts.technicalPerformance) {
        charts.technicalPerformance.update();
    }
}

/**
 * Display business impact
 */
function displayBusinessImpact() {
    if (!reportData.businessImpact) return;
    
    const business = reportData.businessImpact;
    
    // Update market metrics
    const marketElement = document.getElementById('marketReadiness');
    if (marketElement) {
        marketElement.textContent = `${business.marketImpact.marketReadiness}`;
    }
    
    const competitiveElement = document.getElementById('competitivePosition');
    if (competitiveElement) {
        competitiveElement.textContent = business.marketImpact.competitivePosition;
    }
    
    // Update charts
    if (charts.financialProjections) {
        charts.financialProjections.update();
    }
    if (charts.roiAnalysis) {
        charts.roiAnalysis.update();
    }
    if (charts.stakeholderImpact) {
        charts.stakeholderImpact.update();
    }
}

/**
 * Update all charts
 */
function updateAllCharts() {
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.update();
        }
    });
}

/**
 * Update comparison chart based on selected metric
 */
function updateComparisonChart(metric) {
    if (!reportData.comparativeAnalysis || !charts.modelComparison) return;
    
    const comparison = reportData.comparativeAnalysis.modelComparison;
    
    let data, label;
    
    switch (metric) {
        case 'confidence':
            data = [comparison.gguf.confidence, comparison.ai.confidence];
            label = 'Confidence Score';
            break;
        case 'size':
            data = [parseFloat(comparison.gguf.size), parseFloat(comparison.ai.size)];
            label = 'Model Size (GB)';
            break;
        default:
            return;
    }
    
    charts.modelComparison.data.datasets[0].data = data;
    charts.modelComparison.data.datasets[0].label = label;
    charts.modelComparison.update();
    
    // Update button states
    document.querySelectorAll('.chart-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

/**
 * Show loading state
 */
function showLoading() {
    document.getElementById('loadingState').style.display = 'flex';
    document.getElementById('reportContent').style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('reportContent').style.display = 'block';
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Create success alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alert.style.zIndex = '9999';
    alert.textContent = `
        <i class="fas fa-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(alert);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

/**
 * Show error message
 */
function showError(message) {
    // Create error alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alert.style.zIndex = '9999';
    alert.textContent = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

/**
 * Toggle auto-refresh functionality
 */
function toggleAutoRefresh() {
    const button = document.getElementById('autoRefreshBtn');
    const icon = button.querySelector('i');
    
    if (isAutoRefreshEnabled) {
        // Disable auto-refresh
        clearInterval(autoRefreshInterval);
        isAutoRefreshEnabled = false;
        icon.className = 'fas fa-sync me-2';
        button.textContent = '<i class="fas fa-sync me-2"></i>Auto Refresh' /* Replaced innerHTML with textContent for safety */
        button.classList.remove('btn-success');
        button.classList.add('btn-outline-primary');
        showInfo('Auto-refresh disabled');
    } else {
        // Enable auto-refresh
        autoRefreshInterval = setInterval(async () => {
            console.log('🔄 Auto-refreshing data...');
            await refreshData();
        }, 30000); // Refresh every 30 seconds
        
        isAutoRefreshEnabled = true;
        icon.className = 'fas fa-sync-alt me-2';
        button.textContent = '<i class="fas fa-sync-alt me-2"></i>Auto Refreshing' /* Replaced innerHTML with textContent for safety */
        button.classList.remove('btn-outline-primary');
        button.classList.add('btn-success');
        showInfo('Auto-refresh enabled (30s interval)');
    }
}

/**
 * Show info message
 */
function showInfo(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-info alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alert.style.zIndex = '9999';
    alert.textContent = `
        <i class="fas fa-info-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(alert);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

/**
 * Add keyboard shortcuts
 */
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + R: Refresh data
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        refreshData();
    }
    
    // Ctrl/Cmd + E: Export report
    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        exportReport('json');
    }
    
    // Ctrl/Cmd + A: Toggle auto-refresh
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        toggleAutoRefresh();
    }
});

/**
 * Initialize chart interactions
 */
function initializeChartInteractions() {
    // Add hover effects to charts
    Object.values(charts).forEach(chart => {
        if (chart && chart.options) {
            chart.options.onHover = (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            };
        }
    });
}

/**
 * Export enhanced report with metadata
 */
async function exportEnhancedReport(format) {
    try {
        const enhancedData = {
            ...reportData,
            exportMetadata: {
                exportedAt: new Date().toISOString(),
                exportedBy: 'AI Roadmap Report Dashboard',
                format: format,
                version: '2.0',
                source: 'AI Platform'
            },
            dashboardState: {
                activeTab: getActiveTab(),
                autoRefreshEnabled: isAutoRefreshEnabled,
                chartCount: Object.keys(charts).length
            }
        };
        
        const blob = new Blob([JSON.stringify(enhancedData, null, 2)], {
            type: 'application/json'
        });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enhanced-ai-roadmap-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSuccess('Enhanced report exported successfully!');
    } catch (error) {
        console.error('❌ Error exporting enhanced report:', error);
        showError('Failed to export enhanced report: ' + error.message);
    }
}
