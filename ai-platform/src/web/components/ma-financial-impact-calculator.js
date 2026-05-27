/**
 * M&A Financial Impact Calculator Frontend
 * Connects dashboard to financial impact calculation API
 */

class FinancialImpactCalculator {
    constructor() {
        this.apiBaseUrl = '/api/financial-impact';
        this.currentCalculation = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSupportedIndustries();
        this.loadSampleData();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('financial-impact-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.calculateFinancialImpact();
            });
        }

        // Real-time calculation on input change
        const inputs = ['team-size', 'average-salary', 'debt-score', 'complexity-score', 'security-score'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    if (this.currentCalculation) {
                        this.calculateFinancialImpact();
                    }
                });
            }
        });

        // Industry change
        const industrySelect = document.getElementById('industry');
        if (industrySelect) {
            industrySelect.addEventListener('change', () => {
                this.updateIndustryMultiplier();
            });
        }
    }

    async loadSupportedIndustries() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/industries`);
            const data = await response.json();
            
            const industrySelect = document.getElementById('industry');
            if (industrySelect) {
                industrySelect.textContent = '' /* Replaced innerHTML with textContent for safety */
                Object.entries(data.industries).forEach(([industry, multiplier]) => {
                    const option = document.createElement('option');
                    option.value = industry;
                    option.textContent = `${industry.charAt(0).toUpperCase() + industry.slice(1)} (x${multiplier})`;
                    industrySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading industries:', error);
        }
    }

    async loadSampleData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/sample-calculation`);
            const data = await response.json();
            
            if (data.success) {
                this.populateSampleData(data.data.cost_breakdown);
            }
        } catch (error) {
            console.error('Error loading sample data:', error);
        }
    }

    populateSampleData(costData) {
        // Populate form with sample values for demonstration
        const fields = {
            'company-name': 'Sample Target Company',
            'team-size': '15',
            'average-salary': '135000',
            'debt-score': '65',
            'complexity-score': '72',
            'security-score': '78',
            'industry': 'fintech'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });
    }

    async calculateFinancialImpact() {
        const form = document.getElementById('financial-impact-form');
        if (!form) return;

        // Show loading state
        this.showLoadingState(true);

        try {
            // Collect form data
            const formData = new FormData(form);
            const metrics = {
                debt_score: parseInt(formData.get('debt-score') || 50, 10),
                complexity_score: parseInt(formData.get('complexity-score') || 50, 10),
                security_score: parseInt(formData.get('security-score') || 70, 10),
                test_coverage: parseInt(formData.get('test-coverage') || 50, 10),
                documentation_score: parseInt(formData.get('documentation-score') || 50, 10)
            };

            const requestData = {
                metrics: metrics,
                team_size: parseInt(formData.get('team-size') || 10),
                avg_salary: parseFloat(formData.get('average-salary') || 120000),
                industry: formData.get('industry') || 'tech',
                company_name: formData.get('company-name') || 'Target Company'
            };

            // Call API
            const response = await fetch(`${this.apiBaseUrl}/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (data.success) {
                this.currentCalculation = data.data;
                this.displayResults(data.data);
            } else {
                this.showError(data.error || 'Calculation failed');
            }

        } catch (error) {
            console.error('Calculation error:', error);
            this.showError('Network error during calculation');
        } finally {
            this.showLoadingState(false);
        }
    }

    displayResults(data) {
        const { cost_breakdown, executive_summary } = data;

        // Display cost breakdown
        this.displayCostBreakdown(cost_breakdown);
        
        // Display executive summary
        this.displayExecutiveSummary(executive_summary);
        
        // Show results section
        const resultsSection = document.getElementById('financial-results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        // Scroll to results
        resultsSection?.scrollIntoView({ behavior: 'smooth' });
    }

    displayCostBreakdown(costData) {
        const breakdownContainer = document.getElementById('cost-breakdown');
        if (!breakdownContainer) return;

        const currencyFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        breakdownContainer.textContent = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-title">One-Time Costs</h6>
                            <div class="mb-2">
                                <strong>Remediation Cost:</strong> ${currencyFormatter.format(costData.remediation_cost)}
                            </div>
                            <div class="mb-2">
                                <strong>Integration Cost:</strong> ${currencyFormatter.format(costData.integration_cost)}
                            </div>
                            <div class="mb-2">
                                <strong>Security Cost:</strong> ${currencyFormatter.format(costData.security_cost)}
                            </div>
                            <hr>
                            <div class="mb-2">
                                <strong>Total One-Time:</strong> ${currencyFormatter.format(
                                    costData.remediation_cost + costData.integration_cost + costData.security_cost
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-title">Ongoing Costs</h6>
                            <div class="mb-2">
                                <strong>Annual Maintenance:</strong> ${currencyFormatter.format(costData.annual_maintenance)}
                            </div>
                            <div class="mb-2">
                                <strong>3-Year Total:</strong> ${currencyFormatter.format(costData.annual_maintenance * 3)}
                            </div>
                            <hr>
                            <div class="mb-2">
                                <strong>Total 3-Year Impact:</strong> 
                                <span class="text-primary fw-bold">${currencyFormatter.format(costData.total_3_year_impact)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">Risk-Adjusted Analysis</h6>
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="text-center">
                                        <div class="h4 text-danger">${currencyFormatter.format(cost_data.risk_adjusted_impact)}</div>
                                        <small class="text-muted">Risk-Adjusted Impact</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-center">
                                        <div class="h4">${costData.severity.charAt(0).toUpperCase() + costData.severity.slice(1)}</div>
                                        <small class="text-muted">Debt Severity</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-center">
                                        <div class="h4">${costData.industry_multiplier}x</div>
                                        <small class="text-muted">Industry Multiplier</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    displayExecutiveSummary(summary) {
        const summaryContainer = document.getElementById('executive-summary');
        if (!summaryContainer) return;

        const currencyFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        const riskBadgeClass = {
            'Low': 'bg-success',
            'Medium': 'bg-warning',
            'High': 'bg-danger',
            'Critical': 'bg-dark'
        }[summary.risk_level] || 'bg-secondary';

        summaryContainer.textContent = `
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Executive Summary for ${summary.company_name}</h5>
                </div>
                <div class="card-body">
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="d-flex align-items-center mb-3">
                                <span class="badge ${riskBadgeClass} me-2">${summary.risk_level}</span>
                                <strong>Financial Risk Level</strong>
                            </div>
                            <p class="mb-3">${summary.recommendation}</p>
                        </div>
                        <div class="col-md-6">
                            <div class="text-center">
                                <div class="h3 text-primary">${currencyFormatter.format(summary.total_3_year_impact)}</div>
                                <div class="text-muted">Total 3-Year Impact</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mb-4">
                        <div class="col-12">
                            <h6>Key Cost Drivers</h6>
                            <div class="progress" style="height: 25px /* Replaced innerHTML with textContent for safety */">
                                ${summary.key_cost_drivers.map(driver => `
                                    <div class="progress-bar" style="width: ${driver.percentage}%" 
                                         title="${driver.category}: ${currencyFormatter.format(driver.cost)}">
                                        ${driver.percentage}%
                                    </div>
                                `).join('')}
                            </div>
                            <div class="mt-2">
                                ${summary.key_cost_drivers.map(driver => `
                                    <small class="me-3">
                                        <strong>${driver.category}:</strong> ${currencyFormatter.format(driver.cost)}
                                    </small>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Negotiation Leverage</h6>
                            <p><strong>${summary.negotiation_leverage.leverage_points}</strong></p>
                            <p>Suggested discount: <strong>${summary.negotiation_leverage.suggested_discount}</strong></p>
                            <p>Total leverage value: <strong>${currencyFormatter.format(summary.negotiation_leverage.total_leverage_value)}</strong></p>
                        </div>
                        <div class="col-md-6">
                            <h6>Timeline Impact</h6>
                            <p><strong>Time to Value:</strong> ${summary.timeline_impact.time_to_value}</p>
                            <p><strong>Delay Risk:</strong> ${summary.timeline_impact.delay_risk}</p>
                            <p><strong>Remediation:</strong> ${summary.timeline_impact.remediation_timeline_months} months</p>
                            <p><strong>Integration:</strong> ${summary.timeline_impact.integration_timeline_months} months</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showLoadingState(show) {
        const button = document.querySelector('#financial-impact-form button[type="submit"]');
        if (button) {
            if (show) {
                button.disabled = true;
                button.textContent = '<i class="fas fa-spinner fa-spin"></i> Calculating...' /* Replaced innerHTML with textContent for safety */
            } else {
                button.disabled = false;
                button.textContent = '<i class="fas fa-calculator"></i> Calculate Financial Impact' /* Replaced innerHTML with textContent for safety */
            }
        }
    }

    showError(message) {
        const alertContainer = document.getElementById('financial-alerts');
        if (alertContainer) {
            alertContainer.textContent = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }

    updateIndustryMultiplier() {
        const industrySelect = document.getElementById('industry');
        const multiplierDisplay = document.getElementById('industry-multiplier');
        
        if (industrySelect && multiplierDisplay) {
            // Get multiplier from the option text
            const selectedOption = industrySelect.selectedOptions[0];
            const multiplierText = selectedOption.textContent.match(/\(x([\d.]+)\)/);
            if (multiplierText) {
                multiplierDisplay.textContent = `Industry Multiplier: ${multiplierText[1]}`;
            }
        }
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('financial-impact-form')) {
        window.financialImpactCalculator = new FinancialImpactCalculator();
    }
});
