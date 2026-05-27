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

// Component Registry System
class ComponentRegistry {
    constructor() {
        this.components = new Map();
        this.loadedScripts = new Set();
    }

    // Register a component class
    register(name, componentClass) {
        this.components.set(name, componentClass);
        console.log(`📝 Registered component: ${name}`);
    }

    // Load component script dynamically
    async loadScript(scriptPath) {
        if (this.loadedScripts.has(scriptPath)) {
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.onload = () => {
                this.loadedScripts.add(scriptPath);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load script: ${scriptPath}`));
            document.head.appendChild(script);
        });
    }

    // Initialize component in container
    async initializeComponent(componentName, containerId, options = {}) {
        try {
            // Check if component is already registered
            if (!this.components.has(componentName)) {
                // Try to load the component script
                let scriptPath;
                if (componentName === 'AIAnalysisDashboard') {
                    scriptPath = `/web/components/ai-analysis/AIAnalysisDashboard.js`;
                } else if (componentName === 'AIToolsDashboard') {
                    scriptPath = `/web/components/ai-tools/AIToolsDashboard.js`;
                } else if (componentName === 'DatabaseDashboard') {
                    scriptPath = `/web/components/database/DatabaseDashboard.js`;
                } else if (componentName === 'APIDashboard') {
                    scriptPath = `/web/components/api/APIDashboard.js`;
                } else if (componentName === 'AnalyticsDashboard') {
                    scriptPath = `/web/components/analytics/AnalyticsDashboard.js`;
                } else if (componentName === 'MergerToolDashboard') {
                    scriptPath = `/web/components/merger-tool/MergerToolDashboard.js`;
                } else if (componentName === 'DebtCalculatorDashboard') {
                    scriptPath = `/web/components/debt-calculator/DebtCalculatorDashboard.js`;
                } else if (componentName === 'DebtReductionDashboard') {
                    scriptPath = `/web/components/debt-reduction/DebtReductionDashboard.js`;
                } else if (componentName === 'DebtAnalyticsDashboard') {
                    scriptPath = `/web/components/debt-analytics/DebtAnalyticsDashboard.js`;
                } else if (componentName === 'BillingSystemDashboard') {
                    scriptPath = `/web/components/billing-system/BillingSystemDashboard.js`;
                } else if (componentName === 'ProjectReportsDashboard') {
                    scriptPath = `/web/components/project-reports/ProjectReportsDashboard.js`;
                } else if (componentName === 'AssetsLibraryDashboard') {
                    scriptPath = `/web/components/assets-library/AssetsLibraryDashboard.js`;
                } else if (componentName === 'CodeTemplatesDashboard') {
                    scriptPath = `/web/components/code-templates/CodeTemplatesDashboard.js`;
                } else if (componentName === 'CoverageReportsDashboard') {
                    scriptPath = `/web/components/coverage-reports/CoverageReportsDashboard.js`;
                } else if (componentName === 'SettingsDashboard') {
                    scriptPath = `/web/components/settings/SettingsDashboard.js`;
                } else if (componentName === 'HelpDashboard') {
                    scriptPath = `/web/components/help/HelpDashboard.js`;
                } else if (componentName === 'CodeGenerationDashboard') {
                    scriptPath = `/web/components/codegen/CodeGenerationDashboard.js`;
                } else if (componentName === 'DevToolsDashboard') {
                    scriptPath = `/components/devtools/DevToolsDashboard.js`;
                } else if (componentName === 'RoadmapTimelineVisualization') {
                    scriptPath = `/web/components/roadmap/RoadmapTimelineVisualization.js`;
                } else if (componentName === 'RoadmapProgressTracker') {
                    scriptPath = `/web/components/roadmap/RoadmapProgressTracker.js`;
                } else if (componentName === 'AnalyticsPerformanceDashboard') {
                    scriptPath = `/web/components/analytics/AnalyticsPerformanceDashboard.js`;
                } else if (componentName === 'OptimizationEngine') {
                    scriptPath = `/web/components/optimization/OptimizationEngine.js`;
                } else if (componentName === 'PatternAnalyzer') {
                    scriptPath = `/web/components/patterns/PatternAnalyzer.js`;
                } else {
                    scriptPath = `/web/components/${componentName.toLowerCase()}/${componentName}.js`;
                }
                await this.loadScript(scriptPath);
                
                // Wait a bit for the script to register
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const ComponentClass = this.components.get(componentName);
            if (!ComponentClass) {
                throw new Error(`Component ${componentName} not found`);
            }

            const component = new ComponentClass(containerId, options);
            await component.initialize();
            
            return component;
        } catch (error) {
            console.error(`❌ Failed to initialize component ${componentName}:`, error);
            throw error;
        }
    }
}

// Global component registry instance
window.componentRegistry = new ComponentRegistry();
console.log('🔧 Component registry initialized');

// Enhanced section loader with component support
async function loadSectionWithComponent(sectionId, componentName, options = {}) {
    console.log(`🔄 Loading component ${componentName} into section ${sectionId}`);
    
    const container = document.getElementById(sectionId);
    if (!container) {
        console.error(`Container ${sectionId} not found`);
        return;
    }

    try {
        // Show loading state
        container.textContent = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading ${componentName}...</p>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        // Initialize component
        const component = await window.componentRegistry.initializeComponent(componentName, sectionId, options);
        
        // Store component reference for cleanup
        container._component = component;
        
        console.log(`✅ Loaded component ${componentName} in section ${sectionId}`);
    } catch (error) {
        // Fallback to placeholder content
        console.warn(`⚠️ Failed to load component ${componentName}, showing placeholder:`, error);
        showPlaceholderContent(container, componentName);
    }
}

// Fallback placeholder content
function showPlaceholderContent(container, componentName) {
    const placeholderContent = getPlaceholderContent(componentName);
    container.textContent = placeholderContent /* Replaced innerHTML with textContent for safety */
}

// Get placeholder content for different components
function getPlaceholderContent(componentName) {
    const placeholders = {
        'AnalyticsDashboard': `
            <div class="chart-container">
                <h3>📊 Analytics Dashboard</h3>
                <p>Platform analytics and insights will be displayed here...</p>
                <div class="mt-3">
                    <div class="progress mb-2">
                        <div class="progress-bar" style="width: 75%">75% Complete</div>
                    </div>
                    <small class="text-muted">Analytics processing in progress</small>
                </div>
            </div>
        `,
        'CodeGenerationDashboard': `
            <div class="chart-container">
                <h3>💻 Code Generation Tools</h3>
                <p>AI code generation interface will be displayed here...</p>
                <div class="mt-3">
                    <button class="btn btn-primary me-2">Generate Code</button>
                    <button class="btn btn-outline-secondary">View Templates</button>
                </div>
            </div>
        `,
        'DevToolsDashboard': `
            <div class="chart-container">
                <h3>🔧 Development Tools</h3>
                <p>Development tools interface will be displayed here...</p>
                <div class="mt-3">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5>12</h5>
                                    <p>Available Tools</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5>8</h5>
                                    <p>Active Tools</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5>95%</h5>
                                    <p>Success Rate</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        'DatabaseDashboard': `
            <div class="chart-container">
                <h3>🗄️ Database Management</h3>
                <p>Database management interface will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Database connection status: Connected
                    </div>
                </div>
            </div>
        `,
        'APIDashboard': `
            <div class="chart-container">
                <h3>🔌 API Management</h3>
                <p>API management interface will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-plug me-2"></i>
                        API management system ready for documentation and testing
                    </div>
                    <div class="badge bg-success me-2">5 APIs Active</div>
                    <div class="badge bg-warning me-2">2 APIs Testing</div>
                    <div class="badge bg-secondary">3 APIs Inactive</div>
                </div>
            </div>
        `,
        'AIAnalysisDashboard': `
            <div class="chart-container">
                <h3>🔍 AI Analysis</h3>
                <p>AI-powered codebase analysis will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-brain me-2"></i>
                        AI analysis engine ready for comprehensive code review
                    </div>
                </div>
            </div>
        `,
        'AIToolsDashboard': `
            <div class="chart-container">
                <h3>🛠️ AI Tools</h3>
                <p>Advanced AI-powered development tools will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-success">
                        <i class="fas fa-magic me-2"></i>
                        AI tools suite ready for intelligent development assistance
                    </div>
                </div>
            </div>
        `,
        'DatabaseDashboard': `
            <div class="chart-container">
                <h3>🗄️ Database Management</h3>
                <p>Database management interface will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-database me-2"></i>
                        Database management system ready for operations
                    </div>
                </div>
            </div>
        `,
        'MergerToolDashboard': `
            <div class="chart-container">
                <h3>🔄 Merger Tool</h3>
                <p>Advanced file and project merging tools will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-warning">
                        <i class="fas fa-code-branch me-2"></i>
                        Merger tool system ready for intelligent file merging
                    </div>
                </div>
            </div>
        `,
        'DebtCalculatorDashboard': `
            <div class="chart-container">
                <h3>🧮 Debt Calculator</h3>
                <p>Technical debt calculation and analysis will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-warning">
                        <i class="fas fa-calculator me-2"></i>
                        Technical debt calculator ready for comprehensive analysis
                    </div>
                </div>
            </div>
        `,
        'DebtReductionDashboard': `
            <div class="chart-container">
                <h3>🔨 Debt Reduction</h3>
                <p>Technical debt reduction strategies and tools will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-success">
                        <i class="fas fa-tools me-2"></i>
                        Debt reduction system ready for automated remediation
                    </div>
                </div>
            </div>
        `,
        'DebtAnalyticsDashboard': `
            <div class="chart-container">
                <h3>📊 Debt Analytics</h3>
                <p>Technical debt analytics and reporting will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-chart-bar me-2"></i>
                        Debt analytics system ready for comprehensive reporting
                    </div>
                </div>
            </div>
        `,
        'BillingSystemDashboard': `
            <div class="chart-container">
                <h3>💰 Billing System</h3>
                <p>Billing and subscription management will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-success">
                        <i class="fas fa-credit-card me-2"></i>
                        Billing system ready for subscription management
                    </div>
                </div>
            </div>
        `,
        'ProjectReportsDashboard': `
            <div class="chart-container">
                <h3>📄 Project Reports</h3>
                <p>Project documentation and reports will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-file-alt me-2"></i>
                        Project reports system ready for documentation management
                    </div>
                </div>
            </div>
        `,
        'AssetsLibraryDashboard': `
            <div class="chart-container">
                <h3>🎨 Assets Library</h3>
                <p>Digital assets and media library will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-success">
                        <i class="fas fa-images me-2"></i>
                        Assets library ready for media management
                    </div>
                </div>
            </div>
        `,
        'CodeTemplatesDashboard': `
            <div class="chart-container">
                <h3>📝 Code Templates</h3>
                <p>Reusable code templates and snippets will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-code me-2"></i>
                        Code templates ready for development productivity
                    </div>
                </div>
            </div>
        `,
        'CoverageReportsDashboard': `
            <div class="chart-container">
                <h3>🛡️ Coverage Reports</h3>
                <p>Code coverage analysis and reporting will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-success">
                        <i class="fas fa-shield-alt me-2"></i>
                        Coverage reports ready for test analysis
                    </div>
                </div>
            </div>
        `,
        'SettingsDashboard': `
            <div class="chart-container">
                <h3>⚙️ Settings</h3>
                <p>Platform configuration and preferences will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-cog me-2"></i>
                        Settings ready for platform configuration
                    </div>
                </div>
            </div>
        `,
        'HelpDashboard': `
            <div class="chart-container">
                <h3>❓ Help</h3>
                <p>Documentation, tutorials, and support will be displayed here...</p>
                <div class="mt-3">
                    <div class="alert alert-success">
                        <i class="fas fa-question-circle me-2"></i>
                        Help system ready for documentation and support
                    </div>
                </div>
            </div>
        `
    };

    return placeholders[componentName] || `
        <div class="chart-container">
            <h3>📋 ${componentName}</h3>
            <p>${componentName} interface will be displayed here...</p>
            <div class="mt-3">
                <div class="text-muted">
                    <i class="fas fa-tools me-2"></i>
                    Component implementation in progress
                </div>
            </div>
        </div>
    `;
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
window.loadSectionWithComponent = loadSectionWithComponent;
window.showPlaceholderContent = showPlaceholderContent;

// SectionContentProvider class
class SectionContentProvider {
    constructor() {
        this.components = new Map();
        this.initializedComponents = new Set();
        console.log('🔧 SectionContentProvider initialized');
    }

    getComponentScriptPath(componentClass) {
        const paths = {
            DevToolsDashboard: '/components/devtools/DevToolsDashboard.js',
            APIDashboard: '/components/api/APIDashboard.js',
            DatabaseDashboard: '/components/database/DatabaseDashboard.js',
            AnalyticsDashboard: '/components/analytics/AnalyticsDashboard.js',
            MergerToolDashboard: '/components/merger-tool/MergerToolDashboard.js',
            DebtCalculatorDashboard: '/components/debt-calculator/DebtCalculatorDashboard.js',
            DebtReductionDashboard: '/components/debt-reduction/DebtReductionDashboard.js',
            DebtAnalyticsDashboard: '/components/debt-analytics/DebtAnalyticsDashboard.js',
            BillingSystemDashboard: '/components/billing-system/BillingSystemDashboard.js',
            ProjectReportsDashboard: '/components/project-reports/ProjectReportsDashboard.js',
            AssetsLibraryDashboard: '/components/assets-library/AssetsLibraryDashboard.js',
            CodeTemplatesDashboard: '/components/code-templates/CodeTemplatesDashboard.js',
            CoverageReportsDashboard: '/components/coverage-reports/CoverageReportsDashboard.js',
            SettingsDashboard: '/components/settings/SettingsDashboard.js',
            HelpDashboard: '/components/help/HelpDashboard.js',
            CodeGenerationDashboard: '/components/codegen/CodeGenerationDashboard.js',
            IssueResolutionDashboard: '/components/issue-resolution/IssueResolutionDashboard.js'
        };
        return paths[componentClass] || `/components/${componentClass.replace(/Dashboard$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}/${componentClass}.js`;
    }

    loadComponentScript(scriptPath) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[data-component-src="${scriptPath}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = scriptPath;
            script.dataset.componentSrc = scriptPath;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${scriptPath}`));
            document.head.appendChild(script);
        });
    }

    async initializeComponent(componentClass, container, options = {}) {
        try {
            console.log(`🔧 Initializing ${componentClass}...`);
            
            // Get container ID from container element
            const containerId = container.id || `container-${Date.now()}`;
            if (!container.id) {
                container.id = containerId;
            }

            if (!window[componentClass]) {
                try {
                    await this.loadComponentScript(this.getComponentScriptPath(componentClass));
                } catch (error) {
                    console.warn(`⚠️ Could not load script for ${componentClass}:`, error.message);
                }
            }
            
            // Create data service instance
            const dataService = options.dataService || window.realDataService || new RealDataService();
            
            // Dynamically load and initialize component
            const component = this.getComponentInstance(componentClass, containerId, dataService);
            if (component) {
                await component.initialize();
                this.initializedComponents.add(componentClass);
                console.log(`✅ ${componentClass} initialized successfully`);
                return true;
            } else {
                console.warn(`⚠️ Component ${componentClass} not found`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error initializing ${componentClass}:`, error);
            return false;
        }
    }

    getComponentInstance(componentClass, containerId, dataService) {
        if (window[componentClass]) {
            const svc = dataService && typeof dataService.getCachedData === 'function'
                ? dataService
                : (window.realDataService || dataService);
            return new window[componentClass](containerId, { dataService: svc });
        }
        return null;
    }

    loadSectionWithComponent(sectionId, componentClass, options = {}) {
        const container = document.getElementById(sectionId);
        if (!container) {
            console.warn(`Container ${sectionId} not found — skipping ${componentClass}`);
            return false;
        }
        return this.initializeComponent(componentClass, container, options);
    }
}

// Make SectionContentProvider globally available
window.SectionContentProvider = SectionContentProvider;

console.log('✅ Enhanced section content provider loaded');
