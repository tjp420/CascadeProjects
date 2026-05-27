/**
 * M&A Risk Assessment Calculator Frontend
 * Connects dashboard to risk assessment calculation API
 */

class RiskAssessmentCalculator {
    constructor() {
        this.apiBaseUrl = '/api/ma-risk-assessment';
        this.currentAssessment = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadRiskCategories();
        this.loadSampleData();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('risk-assessment-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performRiskAssessment();
            });
        }

        // Real-time assessment on input change
        const inputs = ['risk-company-name', 'risk-industry', 'risk-team-size', 'risk-project-path'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    if (this.currentAssessment) {
                        this.performRiskAssessment();
                    }
                });
            }
        });

        // Assessment scope change
        const scopeSelect = document.getElementById('assessment-scope');
        if (scopeSelect) {
            scopeSelect.addEventListener('change', () => {
                this.updateScopeDescription();
            });
        }

        // Risk tolerance change
        const toleranceSelect = document.getElementById('risk-tolerance');
        if (toleranceSelect) {
            toleranceSelect.addEventListener('change', () => {
                this.updateToleranceDescription();
            });
        }
    }

    async loadRiskCategories() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/categories`);
            const data = await response.json();
            
            // Populate risk categories if needed
            console.log('Risk categories loaded:', data);
        } catch (error) {
            console.error('Error loading risk categories:', error);
        }
    }

    async loadSampleData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/sample-assessment`);
            const data = await response.json();
            
            if (data.success) {
                // Sample data is already populated, just log success
                console.log('Sample assessment data loaded successfully');
            }
        } catch (error) {
            console.error('Error loading sample data:', error);
        }
    }

    getCodebaseMetrics() {
        // Return mock codebase metrics for now
        // In production, this would come from actual codebase analysis
        return {
            debt_score: 65,
            complexity_score: 72,
            security_score: 78,
            architecture_score: 60,
            performance_score: 55,
            documentation_score: 38,
            modularity_score: 45,
            productivity_score: 50,
            api_count: 75,
            coupling_score: 68,
            tech_diversity_score: 70,
            database_score: 62,
            privacy_score: 70,
            audit_score: 55
        };
    }

    populateSampleData(sampleData) {
        // Populate form with sample values for demonstration
        const fields = {
            'risk-company-name': 'Sample Target Corp',
            'risk-industry': 'technology',
            'risk-team-size': '25',
            'assessment-scope': 'comprehensive',
            'risk-tolerance': 'medium'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });
    }

    async performRiskAssessment() {
        const form = document.getElementById('risk-assessment-form');
        if (!form) return;

        // Show loading state
        this.showLoadingState(true);

        try {
            // Collect form data
            const formData = new FormData(form);
            
            const requestData = {
                company_name: formData.get('risk-company-name') || 'Target Company',
                industry: formData.get('risk-industry') || 'technology',
                team_size: parseInt(formData.get('risk-team-size') || 10),
                assessment_scope: formData.get('assessment-scope') || 'comprehensive',
                risk_tolerance: formData.get('risk-tolerance') || 'medium',
                project_path: formData.get('risk-project-path') || './'
            };

            // Call API
            const response = await fetch(`${this.apiBaseUrl}/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    codebase_metrics: this.getCodebaseMetrics(),
                    deal_context: requestData
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentAssessment = data.data;
                this.displayResults(data.data);
            } else {
                this.showError(data.error || 'Assessment failed');
            }

        } catch (error) {
            console.error('Assessment error:', error);
            this.showError('Network error during assessment');
        } finally {
            this.showLoadingState(false);
        }
    }

    displayResults(data) {
        // M&A risk assessment API returns different structure
        const { overall_maq_risk, risk_level, risk_factors, risk_scores, recommendation, key_risks, mitigation_strategies } = data;

        // Display overall risk score
        this.displayOverallRisk({
            overall_risk_score: overall_maq_risk,
            overall_risk_level: risk_level,
            critical_risks_count: key_risks.filter(r => r.priority === 'High').length
        });
        
        // Display detailed risk breakdown
        this.displayDetailedRisks(risk_factors);
        
        // Display recommendations
        this.displayRecommendations(mitigation_strategies);
        
        // Show results section
        const resultsSection = document.getElementById('risk-results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        // Scroll to results
        resultsSection?.scrollIntoView({ behavior: 'smooth' });
    }

    displayOverallRisk(riskData) {
        const overallContainer = document.getElementById('overall-risk-score');
        if (!overallContainer) return;

        const riskLevelClass = {
            'LOW': 'success',
            'MEDIUM': 'warning', 
            'HIGH': 'danger',
            'CRITICAL': 'dark'
        }[riskData.overall_risk_level] || 'secondary';

        overallContainer.textContent = `
            <div class="row">
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="h1 text-${riskLevelClass}">${riskData.overall_risk_score.toFixed(1)}</div>
                            <div class="text-muted">Overall Risk Score</div>
                            <div class="mt-2">
                                <span class="badge bg-${riskLevelClass} fs-6">${riskData.overall_risk_level}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="h3 text-danger">${riskData.critical_risks_count}</div>
                            <div class="text-muted">Critical Risks</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="h3">${riskData.total_risk_factors}</div>
                            <div class="text-muted">Total Risk Factors</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <div class="alert alert-${riskLevelClass === 'success' ? 'success' : riskLevelClass === 'warning' ? 'warning' : 'danger'}">
                        <h5><i class="fas fa-exclamation-triangle"></i> Deal Recommendation</h5>
                        <p class="mb-0"><strong>${riskData.deal_recommendation}</strong></p>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    displayDetailedRisks(riskData) {
        const detailedContainer = document.getElementById('detailed-risks');
        if (!detailedContainer) return;

        const categoryColors = {
            'Technical': 'primary',
            'Security': 'danger',
            'Scalability': 'info',
            'Compliance': 'warning',
            'Integration': 'secondary',
            'Talent': 'success'
        };

        detailedContainer.textContent = `
            <div class="row">
                <div class="col-md-6">
                    <h5>Risk Category Breakdown</h5>
                    <canvas id="risk-radar-chart" width="400" height="400"></canvas>
                </div>
                <div class="col-md-6">
                    <h5>Risk Scores by Category</h5>
                    ${Object.entries(riskData.category_scores).map(([category, score]) => {
                        const color = categoryColors[category] || 'secondary' /* Replaced innerHTML with textContent for safety */
                        const percentage = (score / 10) * 100;
                        return `
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>${category}</span>
                                    <span class="badge bg-${color}">${score.toFixed(1)}/10</span>
                                </div>
                                <div class="progress">
                                    <div class="progress-bar bg-${color}" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Create radar chart
        this.createRadarChart(riskData.category_scores);
    }

    createRadarChart(categoryScores) {
        const canvas = document.getElementById('risk-radar-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (window.riskRadarChart) {
            window.riskRadarChart.destroy();
        }

        window.riskRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(categoryScores),
                datasets: [{
                    label: 'Risk Score',
                    data: Object.values(categoryScores),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(255, 99, 132, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 10,
                        ticks: {
                            stepSize: 2
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    displayRecommendations(recommendations) {
        const recommendationsContainer = document.getElementById('risk-recommendations');
        if (!recommendationsContainer) return;

        recommendationsContainer.textContent = `
            <div class="row">
                <div class="col-12">
                    <h5>Risk Mitigation Recommendations</h5>
                    ${recommendations.map((rec, index) => {
                        const priorityClass = {
                            'high': 'danger',
                            'medium': 'warning',
                            'low': 'info'
                        }[rec.priority] || 'secondary' /* Replaced innerHTML with textContent for safety */

                        return `
                            <div class="card mb-3">
                                <div class="card-header">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <h6 class="mb-0">Recommendation ${index + 1}</h6>
                                        <span class="badge bg-${priorityClass}">${rec.priority.toUpperCase()}</span>
                                    </div>
                                </div>
                                <div class="card-body">
                                    <p class="mb-2"><strong>${rec.action}</strong></p>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <small class="text-muted">
                                                <i class="fas fa-clock"></i> Timeline: ${rec.timeline}
                                            </small>
                                        </div>
                                        <div class="col-md-6">
                                            <small class="text-muted">
                                                <i class="fas fa-user"></i> Owner: ${rec.owner}
                                            </small>
                                        </div>
                                    </div>
                                    ${rec.impact ? `<p class="mt-2 mb-0"><small>${rec.impact}</small></p>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    showLoadingState(show) {
        const button = document.querySelector('#risk-assessment-form button[type="submit"]');
        if (button) {
            if (show) {
                button.disabled = true;
                button.textContent = '<i class="fas fa-spinner fa-spin"></i> Assessing...' /* Replaced innerHTML with textContent for safety */
            } else {
                button.disabled = false;
                button.textContent = '<i class="fas fa-search"></i> Perform Risk Assessment' /* Replaced innerHTML with textContent for safety */
            }
        }
    }

    showError(message) {
        const alertContainer = document.getElementById('risk-alerts');
        if (alertContainer) {
            alertContainer.textContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }

    updateScopeDescription() {
        const scopeSelect = document.getElementById('assessment-scope');
        const descriptionElement = document.getElementById('scope-description');
        
        if (scopeSelect && descriptionElement) {
            const descriptions = {
                'basic': 'Quick assessment of major risk categories',
                'standard': 'Comprehensive analysis of all risk factors',
                'comprehensive': 'Deep dive analysis with industry benchmarks',
                'custom': 'Tailored assessment based on specific requirements'
            };
            
            descriptionElement.textContent = descriptions[scopeSelect.value] || '';
        }
    }

    updateToleranceDescription() {
        const toleranceSelect = document.getElementById('risk-tolerance');
        const descriptionElement = document.getElementById('tolerance-description');
        
        if (toleranceSelect && descriptionElement) {
            const descriptions = {
                'low': 'Conservative approach - minimize all risks',
                'medium': 'Balanced approach - accept calculated risks',
                'high': 'Aggressive approach - tolerate higher risks for greater rewards'
            };
            
            descriptionElement.textContent = descriptions[toleranceSelect.value] || '';
        }
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('risk-assessment-form')) {
        window.riskAssessmentCalculator = new RiskAssessmentCalculator();
    }
});

// Export for global access
window.performRiskAssessment = function() {
    if (window.riskAssessmentCalculator) {
        window.riskAssessmentCalculator.performRiskAssessment();
    }
};
