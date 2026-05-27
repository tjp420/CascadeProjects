/**
 * M&A Executive Summary Generator Frontend
 * Connects dashboard to executive summary generation API
 */

class ExecutiveSummaryGenerator {
  constructor() {
    this.apiBaseUrl = '/api/executive-summary';
    this.currentSummary = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSampleData();
  }

  setupEventListeners() {
    // Form submission
    const form = document.getElementById('executive-summary-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.generateExecutiveSummary();
      });
    }

    // Real-time generation on input change
    const inputs = [
      'report-title',
      'target-company-exec',
      'report-audience',
      'report-tone',
      'report-format',
    ];
    inputs.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => {
          if (this.currentSummary) {
            this.generateExecutiveSummary();
          }
        });
      }
    });
  }

  async loadSampleData() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/sample-summary`);
      const data = await response.json();

      if (data.success) {
        this.populateSampleData();
      }
    } catch (error) {
      console.error('Error loading sample data:', error);
    }
  }

  populateSampleData() {
    // Populate form with sample values for demonstration
    const fields = {
      'report-title': 'M&A Due Diligence Report - Target Corp',
      'target-company-exec': 'Target Corporation',
      'report-audience': 'executives',
      'report-tone': 'balanced',
      'report-format': 'executive',
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value;
      }
    });
  }

  async generateExecutiveSummary() {
    const form = document.getElementById('executive-summary-form');
    if (!form) return;

    // Show loading state
    this.showLoadingState(true);

    try {
      // Collect form data
      const formData = new FormData(form);

      const requestData = {
        title: formData.get('report-title') || 'M&A Due Diligence Report',
        company: formData.get('target-company-exec') || 'Target Company',
        audience: formData.get('report-audience') || 'executives',
        tone: formData.get('report-tone') || 'balanced',
        format: formData.get('report-format') || 'executive',
      };

      // Call API
      const response = await fetch(`${this.apiBaseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data.success) {
        this.currentSummary = data.data;
        this.displayResults(data.data);
      } else {
        this.showError(data.error || 'Executive summary generation failed');
      }
    } catch (error) {
      console.error('Executive summary generation error:', error);
      this.showError('Network error during executive summary generation');
    } finally {
      this.showLoadingState(false);
    }
  }

  displayResults(data) {
    const { executive_summary } = data;

    // Display key findings
    this.displayKeyFindings(executive_summary.key_findings);

    // Display financial impact
    this.displayFinancialImpact(executive_summary.financial_impact);

    // Display risk assessment
    this.displayRiskAssessment(executive_summary.risk_assessment);

    // Display recommendations
    this.displayRecommendations(executive_summary.recommendations);

    // Display next steps
    this.displayNextSteps(executive_summary.next_steps);

    // Show results section
    const resultsSection = document.getElementById('executive-results');
    if (resultsSection) {
      resultsSection.style.display = 'block';
    }

    // Scroll to results
    resultsSection?.scrollIntoView({ behavior: 'smooth' });
  }

  displayKeyFindings(findings) {
    const findingsContainer = document.getElementById('key-findings');
    if (!findingsContainer) return;

    findingsContainer.textContent = findings
      .map((finding) => {
        const icon = finding.type === 'positive' ? '✅' : finding.type === 'negative' ? '❌' : '⚠️' /* Replaced innerHTML with textContent for safety */
        return `
                <div class="finding-item ${finding.type}">
                    <div class="d-flex align-items-center">
                        <span class="me-2">${icon}</span>
                        <span>${finding.text}</span>
                    </div>
                </div>
            `;
      })
      .join('');
  }

  displayFinancialImpact(financial) {
    const impactContainer = document.getElementById('financial-impact-summary');
    if (!impactContainer) return;

    const currencyFormatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    impactContainer.textContent = `
            <div class="row">
                <div class="col-md-3">
                    <div class="executive-metric">
                        <div class="executive-value">${currencyFormatter.format(financial.total_cost)}</div>
                        <div class="executive-label">Total 3-Year Impact</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="executive-metric">
                        <div class="executive-value">${currencyFormatter.format(financial.remediation_cost)}</div>
                        <div class="executive-label">Remediation Cost</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="executive-metric">
                        <div class="executive-value">${currencyFormatter.format(financial.annual_maintenance)}/yr</div>
                        <div class="executive-label">Annual Maintenance</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="executive-metric">
                        <div class="executive-value">${currencyFormatter.format(financial.risk_adjusted_impact)}</div>
                        <div class="executive-label">Risk-Adjusted Impact</div>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
  }

  displayRiskAssessment(risk) {
    const riskContainer = document.getElementById('risk-assessment-summary');
    if (!riskContainer) return;

    const riskColor = this.getRiskColor(risk.overall_score);

    riskContainer.textContent = `
            <div class="row">
                <div class="col-md-6">
                    <h5>Overall Risk Score</h5>
                    <div class="progress mb-3">
                        <div class="progress-bar bg-${riskColor}" style="width: ${risk.overall_score * 10}%"></div>
                    </div>
                    <p><strong>${risk.risk_level}</strong> risk level (${risk.overall_score}/10)</p>
                </div>
                <div class="col-md-6">
                    <h5>Primary Concerns</h5>
                    <ul class="list-unstyled">
                        ${risk.primary_concerns.map((concern) => `<li>• ${concern}</li>`).join('')}
                    </ul>
                    <p class="mb-0"><strong>${risk.critical_risks}</strong> critical risks identified</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
  }

  displayRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('executive-recommendations');
    if (!recommendationsContainer) return;

    recommendationsContainer.textContent = recommendations
      .map((rec, index) => {
        return `
                <div class="recommendation-card">
                    <h5>
                        Recommendation ${index + 1}
                        <span class="priority-badge priority-${rec.priority}">${rec.priority}</span>
                    </h5>
                    <p class="mb-2"><strong>${rec.action}</strong></p>
                    <div class="d-flex justify-content-between">
                        <span><i class="fas fa-clock"></i> ${rec.timeline}</span>
                        <span><i class="fas fa-user"></i> ${rec.owner}</span>
                    </div>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
      })
      .join('');
  }

  displayNextSteps(steps) {
    const stepsContainer = document.getElementById('next-steps');
    if (!stepsContainer) return;

    stepsContainer.textContent = steps
      .map(
        (step) => `
            <div class="timeline-item">
                <div class="timeline-step">${step.step}</div>
                <div class="timeline-content">
                    <strong>${step.action}</strong>
                    <div class="text-muted small">${step.timeline}</div>
                </div>
            </div>
        `
      )
      .join('') /* Replaced innerHTML with textContent for safety */
  }

  getRiskColor(score) {
    if (score >= 8) return 'success';
    if (score >= 6) return 'warning';
    return 'danger';
  }

  showLoadingState(show) {
    const button = document.querySelector('#executive-summary-form button[type="submit"]');
    if (button) {
      if (show) {
        button.disabled = true;
        button.textContent = '<i class="fas fa-spinner fa-spin"></i> Generating...' /* Replaced innerHTML with textContent for safety */
      } else {
        button.disabled = false;
        button.textContent = '<i class="fas fa-file-alt"></i> Generate Executive Summary' /* Replaced innerHTML with textContent for safety */
      }
    }
  }

  showError(message) {
    const alertContainer = document.getElementById('executive-alerts');
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

// Initialize generator when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('executive-summary-form')) {
    window.executiveSummaryGenerator = new ExecutiveSummaryGenerator();
  }
});

// Fallback initialization for dynamic loading
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (document.getElementById('executive-summary-form')) {
    window.executiveSummaryGenerator = new ExecutiveSummaryGenerator();
  }
}

// Export for global access
window.generateExecutiveSummary = function () {
  if (window.executiveSummaryGenerator) {
    window.executiveSummaryGenerator.generateExecutiveSummary();
  }
};
