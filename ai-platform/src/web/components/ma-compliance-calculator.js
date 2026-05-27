/**
 * M&A Compliance Assessment Calculator Frontend
 * Connects dashboard to compliance assessment API
 */

class ComplianceAssessmentCalculator {
    constructor() {
        this.apiBaseUrl = '/api/compliance-assessment';
        this.currentAssessment = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadComplianceFrameworks();
        this.loadSampleData();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('compliance-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performComplianceCheck();
            });
        }

        // Real-time assessment on input change
        const inputs = ['compliance-framework', 'industry-regulation', 'data-sensitivity', 'audit-history'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    if (this.currentAssessment) {
                        this.performComplianceCheck();
                    }
                });
            }
        });
    }

    async loadComplianceFrameworks() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/frameworks`);
            const data = await response.json();
            
            console.log('Compliance frameworks loaded:', data);
        } catch (error) {
            console.error('Error loading compliance frameworks:', error);
        }
    }

    async loadSampleData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/sample-assessment`);
            const data = await response.json();
            
            if (data.success) {
                this.populateSampleData(data.data);
            }
        } catch (error) {
            console.error('Error loading sample data:', error);
        }
    }

    populateSampleData(sampleData) {
        // Populate form with sample values for demonstration
        const fields = {
            'target-company': 'Sample Target Corp',
            'compliance-framework': 'soc2',
            'industry-regulation': 'technology',
            'data-sensitivity': 'medium',
            'audit-history': 'internal'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });
    }

    async performComplianceCheck() {
        const form = document.getElementById('compliance-form');
        if (!form) return;

        // Show loading state
        this.showLoadingState(true);

        try {
            // Collect form data
            const formData = new FormData(form);
            
            const requestData = {
                company_name: formData.get('target-company') || 'Target Company',
                framework: formData.get('compliance-framework') || 'soc2',
                industry: formData.get('industry-regulation') || 'technology',
                data_sensitivity: formData.get('data-sensitivity') || 'medium',
                audit_history: formData.get('audit-history') || 'none'
            };

            // Call API
            const response = await fetch(`${this.apiBaseUrl}/assess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (data.success) {
                this.currentAssessment = data.data;
                this.displayResults(data.data);
            } else {
                this.showError(data.error || 'Compliance assessment failed');
            }

        } catch (error) {
            console.error('Compliance assessment error:', error);
            this.showError('Network error during compliance assessment');
        } finally {
            this.showLoadingState(false);
        }
    }

    displayResults(data) {
        const { compliance_assessment, framework_results, critical_issues, recommendations } = data;

        // Display overall compliance score
        this.displayOverallCompliance(compliance_assessment);
        
        // Display framework results
        this.displayFrameworkResults(framework_results);
        
        // Display critical issues
        this.displayCriticalIssues(critical_issues);
        
        // Display recommendations
        this.displayRecommendations(recommendations);
        
        // Show results section
        const resultsSection = document.getElementById('compliance-results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        // Scroll to results
        resultsSection?.scrollIntoView({ behavior: 'smooth' });
    }

    displayOverallCompliance(complianceData) {
        const overallContainer = document.getElementById('overall-compliance-score');
        if (!overallContainer) return;

        const scoreClass = this.getComplianceClass(complianceData.compliance_score);
        const riskBadgeClass = {
            'LOW': 'success',
            'MEDIUM': 'warning', 
            'HIGH': 'danger',
            'CRITICAL': 'dark'
        }[complianceData.risk_level] || 'secondary';

        overallContainer.textContent = `
            <div class="row">
                <div class="col-md-3">
                    <div class="compliance-score-card">
                        <h4>Compliance Score</h4>
                        <div class="compliance-score ${scoreClass}">${complianceData.compliance_score}/100</div>
                        <div class="compliance-level">${complianceData.compliance_level}</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="compliance-score-card">
                        <h4>Risk Level</h4>
                        <div class="risk-score ${riskBadgeClass}">${complianceData.risk_level}</div>
                        <div class="risk-label">Compliance Risk</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="compliance-score-card">
                        <h4>Remediation Cost</h4>
                        <div class="cost-score">$${complianceData.remediation_cost.toLocaleString()}</div>
                        <div class="cost-label">Estimated Cost</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="compliance-score-card">
                        <h4>Timeline</h4>
                        <div class="timeline-score">${complianceData.timeline}</div>
                        <div class="timeline-label">Time to Comply</div>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    displayFrameworkResults(frameworkData) {
        const frameworkContainer = document.getElementById('framework-results');
        if (!frameworkContainer) return;

        frameworkContainer.textContent = `
            <div class="row">
                ${Object.entries(frameworkData).map(([framework, data]) => {
                    const statusIcon = data.status === 'compliant' ? '✅' : data.status === 'partial' ? '⚠️' : '❌' /* Replaced innerHTML with textContent for safety */
                    const statusClass = data.status === 'compliant' ? 'compliant' : data.status === 'partial' ? 'partial' : 'non-compliant';
                    
                    return `
                        <div class="col-md-6 mb-3">
                            <div class="framework-item ${statusClass}">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5>${statusIcon} ${framework}</h5>
                                        <div class="d-flex align-items-center mt-2">
                                            <span class="badge bg-${this.getFrameworkColor(data.status)} me-2">${data.status.toUpperCase()}</span>
                                            <span class="me-2">Score: ${data.score}/100</span>
                                            <span>${data.issues} issues</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    displayCriticalIssues(issues) {
        const issuesContainer = document.getElementById('critical-issues-list');
        const issuesCard = document.getElementById('critical-issues-card');
        
        if (issues.length === 0) {
            if (issuesCard) issuesCard.style.display = 'none';
            return;
        }
        
        if (issuesCard) issuesCard.style.display = 'block';
        
        issuesContainer.textContent = issues.map(issue => `
            <div class="compliance-issue critical">
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <span>${issue}</span>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    displayRecommendations(recommendations) {
        const recommendationsContainer = document.getElementById('compliance-recommendations');
        if (!recommendationsContainer) return;

        recommendationsContainer.textContent = recommendations.map((rec, index) => `
            <div class="recommendation-item">
                <h5>Recommendation ${index + 1}</h5>
                <p class="mb-0">${rec}</p>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    getComplianceClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'fair';
        return 'poor';
    }

    getFrameworkColor(status) {
        switch(status) {
            case 'compliant': return 'success';
            case 'partial': return 'warning';
            case 'non-compliant': return 'danger';
            default: return 'secondary';
        }
    }

    showLoadingState(show) {
        const button = document.querySelector('#compliance-form button[type="submit"]');
        if (button) {
            if (show) {
                button.disabled = true;
                button.textContent = '<i class="fas fa-spinner fa-spin"></i> Assessing...' /* Replaced innerHTML with textContent for safety */
            } else {
                button.disabled = false;
                button.textContent = '<i class="fas fa-shield-alt"></i> Perform Compliance Check' /* Replaced innerHTML with textContent for safety */
            }
        }
    }

    showError(message) {
        const alertContainer = document.getElementById('compliance-alerts');
        if (alertContainer) {
            alertContainer.textContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('compliance-form')) {
        window.complianceAssessmentCalculator = new ComplianceAssessmentCalculator();
    }
});

// Export for global access
window.performComplianceCheck = function() {
    if (window.complianceAssessmentCalculator) {
        window.complianceAssessmentCalculator.performComplianceCheck();
    }
};
