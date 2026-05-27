// Section Content Provider
// Provides rich content for all dashboard sections

console.log('🔧 Loading section content provider...');

// Content for Risk Assessment section
function showRiskAssessment(container) {
    console.log('📊 Loading Risk Assessment content...');
    
    container.textContent = `
        <div class="risk-assessment-content">
            <div class="section-header">
                <h2><i class="fas fa-exclamation-triangle"></i> Risk Assessment</h2>
                <p>Comprehensive risk analysis and mitigation strategies</p>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="risk-card text-center">
                        <div class="risk-score high">HIGH</div>
                        <h3>7.2</h3>
                        <p>Overall Risk Score</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="risk-card text-center">
                        <div class="risk-count">12</div>
                        <h3>12</h3>
                        <p>Risk Items</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="risk-card text-center">
                        <div class="risk-count critical">5</div>
                        <h3>5</h3>
                        <p>Critical Risks</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="risk-card text-center">
                        <div class="risk-count mitigated">8</div>
                        <h3>8</h3>
                        <p>Mitigated</p>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header bg-danger text-white">
                            <h5><i class="fas fa-exclamation-triangle"></i> Critical Risk Items</h5>
                        </div>
                        <div class="card-body">
                            <div class="risk-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Data Security Breach</h6>
                                    <span class="badge bg-danger">Critical</span>
                                </div>
                                <p class="text-muted">Potential unauthorized access to sensitive data</p>
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-danger" style="width: 85%">85% Risk</div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger">View Details</button>
                            </div>
                            
                            <div class="risk-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Integration Complexity</h6>
                                    <span class="badge bg-danger">Critical</span>
                                </div>
                                <p class="text-muted">High complexity in system integration</p>
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-danger" style="width: 75%">75% Risk</div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger">View Details</button>
                            </div>
                            
                            <div class="risk-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Compliance Violations</h6>
                                    <span class="badge bg-danger">Critical</span>
                                </div>
                                <p class="text-muted">Multiple regulatory compliance issues</p>
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-danger" style="width: 90%">90% Risk</div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger">View Details</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header bg-warning text-dark">
                            <h5><i class="fas fa-chart-pie"></i> Risk Distribution</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="riskChart" width="200" height="200"></canvas>
                            <div class="mt-3">
                                <small class="text-muted">Risk breakdown by category</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card mt-3">
                        <div class="card-header bg-info text-white">
                            <h5><i class="fas fa-shield-alt"></i> Mitigation Status</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <span>Security</span>
                                    <span class="text-success">✅ 75%</span>
                                </div>
                                <div class="progress" style="height: 8px /* Replaced innerHTML with textContent for safety */">
                                    <div class="progress-bar bg-success" style="width: 75%"></div>
                                </div>
                            </div>
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <span>Integration</span>
                                    <span class="text-warning">⚠️ 45%</span>
                                </div>
                                <div class="progress" style="height: 8px;">
                                    <div class="progress-bar bg-warning" style="width: 45%"></div>
                                </div>
                            </div>
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <span>Compliance</span>
                                    <span class="text-danger">❌ 20%</span>
                                </div>
                                <div class="progress" style="height: 8px;">
                                    <div class="progress-bar bg-danger" style="width: 20%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize chart if Chart.js is available
    setTimeout(() => {
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('riskChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Critical', 'High', 'Medium', 'Low'],
                        datasets: [{
                            data: [5, 4, 2, 1],
                            backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
        }
    }, 100);
}

// Content for Compliance Check section
function showComplianceCheck(container) {
    console.log('📊 Loading Compliance Check content...');
    
    container.textContent = `
        <div class="compliance-check-content">
            <div class="section-header">
                <h2><i class="fas fa-shield-alt"></i> Compliance Check</h2>
                <p>Regulatory compliance assessment and certification readiness</p>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="compliance-card text-center">
                        <div class="compliance-score">85%</div>
                        <h3>85%</h3>
                        <p>Overall Compliance</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="compliance-card text-center">
                        <div class="compliance-count">12</div>
                        <h3>12</h3>
                        <p>Standards Checked</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="compliance-card text-center">
                        <div class="compliance-status">PASS</div>
                        <h3>PASS</h3>
                        <p>Overall Status</p>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h5><i class="fas fa-check-circle"></i> Compliant Standards</h5>
                        </div>
                        <div class="card-body">
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-check-circle text-success"></i> GDPR</span>
                                    <span class="badge bg-success">Compliant</span>
                                </div>
                                <small class="text-muted">General Data Protection Regulation</small>
                            </div>
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-check-circle text-success"></i> CCPA</span>
                                    <span class="badge bg-success">Compliant</span>
                                </div>
                                <small class="text-muted">California Consumer Privacy Act</small>
                            </div>
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-check-circle text-success"></i> SOX</span>
                                    <span class="badge bg-success">Compliant</span>
                                </div>
                                <small class="text-muted">Sarbanes-Oxley Act</small>
                            </div>
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-check-circle text-success"></i> HIPAA</span>
                                    <span class="badge bg-success">Compliant</span>
                                </div>
                                <small class="text-muted">Health Insurance Portability</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-warning text-dark">
                            <h5><i class="fas fa-exclamation-triangle"></i> Action Required</h5>
                        </div>
                        <div class="card-body">
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-exclamation-triangle text-warning"></i> ISO 27001</span>
                                    <span class="badge bg-warning">In Progress</span>
                                </div>
                                <small class="text-muted">Information Security Management</small>
                                <div class="progress mt-2" style="height: 6px /* Replaced innerHTML with textContent for safety */">
                                    <div class="progress-bar bg-warning" style="width: 70%"></div>
                                </div>
                            </div>
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-exclamation-triangle text-warning"></i> SOC 2</span>
                                    <span class="badge bg-warning">In Progress</span>
                                </div>
                                <small class="text-muted">Service Organization Control</small>
                                <div class="progress mt-2" style="height: 6px;">
                                    <div class="progress-bar bg-warning" style="width: 60%"></div>
                                </div>
                            </div>
                            <div class="compliance-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-exclamation-triangle text-warning"></i> PCI DSS</span>
                                    <span class="badge bg-warning">In Progress</span>
                                </div>
                                <small class="text-muted">Payment Card Industry</small>
                                <div class="progress mt-2" style="height: 6px;">
                                    <div class="progress-bar bg-warning" style="width: 45%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header bg-info text-white">
                    <h5><i class="fas fa-tasks"></i> Compliance Action Items</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Immediate Actions Required:</h6>
                            <ul class="list-unstyled">
                                <li><i class="fas fa-arrow-right text-warning"></i> Complete ISO 27001 certification</li>
                                <li><i class="fas fa-arrow-right text-warning"></i> Implement SOC 2 Type II controls</li>
                                <li><i class="fas fa-arrow-right text-warning"></i> Address PCI DSS compliance gaps</li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h6>Next Steps:</h6>
                            <ul class="list-unstyled">
                                <li><i class="fas fa-check text-success"></i> Schedule compliance audit</li>
                                <li><i class="fas fa-check text-success"></i> Update documentation</li>
                                <li><i class="fas fa-check text-success"></i> Train staff on requirements</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Content for Codebase Analysis section
function showCodebaseAnalysis(container) {
    console.log('📊 Loading Codebase Analysis content...');
    
    container.textContent = `
        <div class="codebase-analysis-content">
            <div class="section-header">
                <h2><i class="fas fa-code"></i> Codebase Analysis</h2>
                <p>Comprehensive code quality and technical debt analysis</p>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="code-card text-center">
                        <div class="code-score">8.5</div>
                        <h3>8.5</h3>
                        <p>Quality Score</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="code-card text-center">
                        <div class="code-count">156</div>
                        <h3>156</h3>
                        <p>Total Files</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="code-card text-center">
                        <div class="code-count">45K</div>
                        <h3>45K</h3>
                        <p>Lines of Code</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="code-card text-center">
                        <div class="code-count">23</div>
                        <h3>23</h3>
                        <p>Issues Found</p>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header bg-info text-white">
                            <h5><i class="fas fa-chart-line"></i> Code Quality Metrics</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Complexity Analysis</h6>
                                    <div class="mb-2">
                                        <div class="d-flex justify-content-between">
                                            <span>Cyclomatic Complexity</span>
                                            <span class="text-success">Good</span>
                                        </div>
                                        <div class="progress" style="height: 8px /* Replaced innerHTML with textContent for safety */">
                                            <div class="progress-bar bg-success" style="width: 75%"></div>
                                        </div>
                                    </div>
                                    <div class="mb-2">
                                        <div class="d-flex justify-content-between">
                                            <span>Code Duplication</span>
                                            <span class="text-warning">5%</span>
                                        </div>
                                        <div class="progress" style="height: 8px;">
                                            <div class="progress-bar bg-warning" style="width: 5%"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <h6>Maintainability</h6>
                                    <div class="mb-2">
                                        <div class="d-flex justify-content-between">
                                            <span>Code Coverage</span>
                                            <span class="text-success">82%</span>
                                        </div>
                                        <div class="progress" style="height: 8px;">
                                            <div class="progress-bar bg-success" style="width: 82%"></div>
                                        </div>
                                    </div>
                                    <div class="mb-2">
                                        <div class="d-flex justify-content-between">
                                            <span>Documentation</span>
                                            <span class="text-info">78%</span>
                                        </div>
                                        <div class="progress" style="height: 8px;">
                                            <div class="progress-bar bg-info" style="width: 78%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header bg-warning text-dark">
                            <h5><i class="fas fa-bug"></i> Issues Found</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <span>Critical</span>
                                    <span class="badge bg-danger">3</span>
                                </div>
                            </div>
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <span>Major</span>
                                    <span class="badge bg-warning">8</span>
                                </div>
                            </div>
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <span>Minor</span>
                                    <span class="badge bg-info">12</span>
                                </div>
                            </div>
                            <hr>
                            <button class="btn btn-sm btn-primary w-100">View All Issues</button>
                        </div>
                    </div>
                    
                    <div class="card mt-3">
                        <div class="card-header bg-success text-white">
                            <h5><i class="fas fa-code-branch"></i> Technology Stack</h5>
                        </div>
                        <div class="card-body">
                            <div class="tech-item">
                                <i class="fab fa-js text-warning"></i> JavaScript
                            </div>
                            <div class="tech-item">
                                <i class="fab fa-react text-info"></i> React
                            </div>
                            <div class="tech-item">
                                <i class="fab fa-node text-success"></i> Node.js
                            </div>
                            <div class="tech-item">
                                <i class="fab fa-python text-primary"></i> Python
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Content for Security Scan section
function showSecurityScan(container) {
    console.log('📊 Loading Security Scan content...');
    
    container.textContent = `
        <div class="security-scan-content">
            <div class="section-header">
                <h2><i class="fas fa-lock"></i> Security Scan</h2>
                <p>Comprehensive security vulnerability assessment</p>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="security-card text-center">
                        <div class="security-status warning">MODERATE</div>
                        <h3>MODERATE</h3>
                        <p>Security Status</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="security-card text-center">
                        <div class="vulnerability-count">18</div>
                        <h3>18</h3>
                        <p>Vulnerabilities</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="security-card text-center">
                        <div class="vulnerability-count critical">2</div>
                        <h3>2</h3>
                        <p>Critical</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="security-card text-center">
                        <div class="vulnerability-count mitigated">12</div>
                        <h3>12</h3>
                        <p>Mitigated</p>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header bg-danger text-white">
                            <h5><i class="fas fa-exclamation-triangle"></i> Critical Vulnerabilities</h5>
                        </div>
                        <div class="card-body">
                            <div class="vulnerability-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>SQL Injection</h6>
                                    <span class="badge bg-danger">Critical</span>
                                </div>
                                <p class="text-muted">Database query vulnerable to SQL injection attacks</p>
                                <div class="alert alert-danger">
                                    <i class="fas fa-info-circle"></i> Found in: user-authentication.js line 45
                                </div>
                                <button class="btn btn-sm btn-outline-danger">Fix Now</button>
                            </div>
                            
                            <div class="vulnerability-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>XSS Vulnerability</h6>
                                    <span class="badge bg-danger">Critical</span>
                                </div>
                                <p class="text-muted">Cross-site scripting vulnerability in user input</p>
                                <div class="alert alert-danger">
                                    <i class="fas fa-info-circle"></i> Found in: comment-system.js line 123
                                </div>
                                <button class="btn btn-sm btn-outline-danger">Fix Now</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card mt-3">
                        <div class="card-header bg-warning text-dark">
                            <h5><i class="fas fa-exclamation-triangle"></i> High Risk Issues</h5>
                        </div>
                        <div class="card-body">
                            <div class="vulnerability-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Weak Encryption</h6>
                                    <span class="badge bg-warning">High</span>
                                </div>
                                <p class="text-muted">Outdated encryption algorithm detected</p>
                                <button class="btn btn-sm btn-outline-warning">Review</button>
                            </div>
                            
                            <div class="vulnerability-item">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Authentication Bypass</h6>
                                    <span class="badge bg-warning">High</span>
                                </div>
                                <p class="text-muted">Potential authentication mechanism bypass</p>
                                <button class="btn btn-sm btn-outline-warning">Review</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header bg-info text-white">
                            <h5><i class="fas fa-shield-alt"></i> Security Score</h5>
                        </div>
                        <div class="card-body text-center">
                            <div class="security-score-circle">
                                <div class="score-value">72</div>
                                <div class="score-label">/100</div>
                            </div>
                            <div class="mt-3">
                                <small class="text-muted">Overall security rating</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card mt-3">
                        <div class="card-header bg-success text-white">
                            <h5><i class="fas fa-check-circle"></i> Security Features</h5>
                        </div>
                        <div class="card-body">
                            <div class="security-feature">
                                <i class="fas fa-check text-success"></i> HTTPS Enabled
                            </div>
                            <div class="security-feature">
                                <i class="fas fa-check text-success"></i> Input Validation
                            </div>
                            <div class="security-feature">
                                <i class="fas fa-check text-success"></i> Rate Limiting
                            </div>
                            <div class="security-feature">
                                <i class="fas fa-times text-danger"></i> CSRF Protection
                            </div>
                            <div class="security-feature">
                                <i class="fas fa-check text-success"></i> Password Hashing
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

// Content for other sections
function showScalabilityReview(container) {
    container.textContent = `
        <div class="scalability-content">
            <h2><i class="fas fa-expand-arrows-alt"></i> Scalability Review</h2>
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i> Scalability assessment in progress
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="card text-center">
                        <h3>85%</h3>
                        <p>Scalability Score</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <h3>10K</h3>
                        <p>Concurrent Users</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <h3>99.9%</h3>
                        <p>Uptime Target</p>
                    </div>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

function showIndustryBenchmark(container) {
    container.textContent = `
        <div class="benchmark-content">
            <h2><i class="fas fa-balance-scale"></i> Industry Benchmark</h2>
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i> Industry benchmark comparison in progress
            </div>
            <div class="row">
                <div class="col-md-3">
                    <div class="card text-center">
                        <h3>Above</h3>
                        <p>Industry Average</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <h3>92%</h3>
                        <p>Performance</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <h3>87%</h3>
                        <p>Security</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <h3>95%</h3>
                        <p>Reliability</p>
                    </div>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

function showExecutiveSummary(container) {
    container.textContent = `
        <div class="executive-content">
            <h2><i class="fas fa-file-contract"></i> Executive Summary</h2>
            <div class="alert alert-success">
                <i class="fas fa-check-circle"></i> Premium Feature - Full analysis available
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="card text-center">
                        <h3>$2.5M</h3>
                        <p>Estimated Value</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <h3>85%</h3>
                        <p>Confidence</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <h3>30 days</h3>
                        <p>Timeline</p>
                    </div>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

function showDealTimeline(container) {
    container.textContent = `
        <div class="timeline-content">
            <h2><i class="fas fa-calendar-alt"></i> Deal Timeline</h2>
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i> Deal timeline planning in progress
            </div>
            <div class="timeline">
                <div class="timeline-item">
                    <div class="timeline-date">Q1 2024</div>
                    <div class="timeline-content">
                        <h5>Due Diligence</h5>
                        <p>Initial assessment phase</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-date">Q2 2024</div>
                    <div class="timeline-content">
                        <h5>Negotiation</h5>
                        <p>Terms and conditions</p>
                    </div>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

function showIntegrationPlan(container) {
    container.textContent = `
        <div class="integration-content">
            <h2><i class="fas fa-project-diagram"></i> Integration Plan</h2>
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i> Integration planning in progress
            </div>
            <div class="row">
                <div class="col-md-6">
                    <h4>Phase 1: Technical Integration</h4>
                    <ul>
                        <li>System architecture alignment</li>
                        <li>Data migration planning</li>
                        <li>API development</li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <h4>Phase 2: Business Integration</h4>
                    <ul>
                        <li>Process alignment</li>
                        <li>Team integration</li>
                        <li>Cultural integration</li>
                    </ul>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

// Make functions globally available
window.showRiskAssessment = showRiskAssessment;
window.showComplianceCheck = showComplianceCheck;
window.showCodebaseAnalysis = showCodebaseAnalysis;
window.showSecurityScan = showSecurityScan;
window.showScalabilityReview = showScalabilityReview;
window.showIndustryBenchmark = showIndustryBenchmark;
window.showExecutiveSummary = showExecutiveSummary;
window.showDealTimeline = showDealTimeline;
window.showIntegrationPlan = showIntegrationPlan;

console.log('✅ Section content provider loaded');
