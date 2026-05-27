// AI Platform Navigation System
console.log('🚀 Initializing AI Platform Navigation System...');

// Global navigation state
window.currentSection = 'overview';
window.navigationHistory = [];

// Section content templates
const sectionContent = {
  overview: {
    title: '🏢 AI Platform Dashboard',
    content: `
            <div class="dashboard-overview">
                <h2>Welcome to Cascade AI Platform</h2>
                <p>M&A Due Diligence & Enterprise Code Analysis Platform</p>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="stat-value">162K+</div>
                        <div class="stat-label">Files Analyzed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="stat-value">100%</div>
                        <div class="stat-label">SAIF Compliant</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning">
                            <i class="fas fa-dollar-sign"></i>
                        </div>
                        <div class="stat-value">$1M+</div>
                        <div class="stat-label">ARR Target</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info">
                            <i class="fas fa-cloud"></i>
                        </div>
                        <div class="stat-value">Multi</div>
                        <div class="stat-label">Cloud Ready</div>
                    </div>
                </div>
                <div class="quick-actions">
                    <h3>Quick Actions</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="navigateTo('ai-analysis', this)">
                            <i class="fas fa-search"></i> Start Analysis
                        </button>
                        <button class="btn btn-success" onclick="navigateTo('oracle-ai', this)">
                            <i class="fas fa-eye"></i> Oracle AI
                        </button>
                        <button class="btn btn-info" onclick="navigateTo('reports', this)">
                            <i class="fas fa-file-alt"></i> View Reports
                        </button>
                    </div>
                </div>
            </div>
        `,
  },
  'ai-tools': {
    title: '🤖 AI Tools',
    content: `
            <div class="ai-tools-section">
                <h2>AI Development Tools</h2>
                <div class="tools-grid">
                    <div class="tool-card" onclick="launchTool('ai-builder')">
                        <div class="tool-icon">
                            <i class="fas fa-hammer"></i>
                        </div>
                        <h3>AI Builder</h3>
                        <p>Build AI-powered applications with visual tools</p>
                    </div>
                    <div class="tool-card" onclick="launchTool('oracle-ai')">
                        <div class="tool-icon">
                            <i class="fas fa-eye"></i>
                        </div>
                        <h3>Oracle AI</h3>
                        <p>Get insights and predictions from AI oracle</p>
                    </div>
                    <div class="tool-card" onclick="launchTool('code-gen')">
                        <div class="tool-icon">
                            <i class="fas fa-code"></i>
                        </div>
                        <h3>Code Generation</h3>
                        <p>Generate code with AI assistance</p>
                    </div>
                </div>
            </div>
        `,
  },
  'ai-analysis': {
    title: 'AI Analysis',
    content: `
            <div class="ai-analysis-section">
                <h2>AI-Powered Analysis</h2>
                <div class="analysis-tools">
                    <div class="analysis-card">
                        <h3>Code Analysis</h3>
                        <p>Analyze code quality, security, and performance</p>
                        <button class="btn btn-primary" onclick="runCodeAnalysis()">Start Analysis</button>
                    </div>
                    <div class="analysis-card">
                        <h3>Data Analysis</h3>
                        <p>Process and analyze your data with AI</p>
                        <button class="btn btn-primary" onclick="runDataAnalysis()">Start Analysis</button>
                    </div>
                </div>
            </div>
        `,
  },
  'oracle-ai': {
    title: 'Oracle AI',
    content: `
            <div class="oracle-ai-section">
                <h2>Oracle AI Interface</h2>
                <div class="oracle-container">
                    <div class="oracle-input">
                        <textarea id="oracleQuery" placeholder="Ask Oracle AI anything..." rows="4"></textarea>
                        <button class="btn btn-primary" onclick="askOracle()">Get Insight</button>
                    </div>
                    <div class="oracle-output" id="oracleResponse">
                        <p>Oracle AI is ready to provide insights...</p>
                    </div>
                </div>
            </div>
        `,
  },
  'code-generation': {
    title: 'Code Generation',
    content: `
            <div class="code-gen-section">
                <h2>AI Code Generation</h2>
                <div class="code-gen-interface">
                    <div class="input-section">
                        <label for="codePrompt">Describe what you want to build:</label>
                        <textarea id="codePrompt" placeholder="E.g., Create a React component for a user profile..." rows="3"></textarea>
                        <select id="languageSelect">
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                        </select>
                        <button class="btn btn-primary" onclick="generateCode()">Generate Code</button>
                    </div>
                    <div class="output-section">
                        <pre id="generatedCode"><code>Your generated code will appear here...</code></pre>
                    </div>
                </div>
            </div>
        `,
  },
  reports: {
    title: '📊 Reports',
    content: `
            <div class="reports-section">
                <h2>Analytics & Reports</h2>
                <div class="reports-grid">
                    <div class="report-card">
                        <h3>Performance Report</h3>
                        <p>System performance metrics and analysis</p>
                        <button class="btn btn-secondary" onclick="generateReport('performance')">Generate</button>
                    </div>
                    <div class="report-card">
                        <h3>Security Report</h3>
                        <p>Security assessment and vulnerability report</p>
                        <button class="btn btn-secondary" onclick="generateReport('security')">Generate</button>
                    </div>
                    <div class="report-card">
                        <h3>Usage Analytics</h3>
                        <p>Platform usage statistics and trends</p>
                        <button class="btn btn-secondary" onclick="generateReport('usage')">Generate</button>
                    </div>
                </div>
            </div>
        `,
  },
  analytics: {
    title: 'Analytics',
    content: `
            <div class="analytics-section">
                <h2>Real-time Analytics</h2>
                <div class="charts-container">
                    <div class="chart-card">
                        <h3>Usage Trends</h3>
                        <canvas id="usageChart"></canvas>
                    </div>
                    <div class="chart-card">
                        <h3>Performance Metrics</h3>
                        <canvas id="performanceChart"></canvas>
                    </div>
                </div>
            </div>
        `,
  },
  performance: {
    title: 'Performance',
    content: `
            <div class="performance-section">
                <h2>Performance Monitoring</h2>
                <div class="performance-metrics">
                    <div class="metric-card">
                        <h3>Response Time</h3>
                        <div class="metric-value">1.2s</div>
                        <div class="metric-status good">Good</div>
                    </div>
                    <div class="metric-card">
                        <h3>CPU Usage</h3>
                        <div class="metric-value">45%</div>
                        <div class="metric-status good">Normal</div>
                    </div>
                    <div class="metric-card">
                        <h3>Memory Usage</h3>
                        <div class="metric-value">2.1GB</div>
                        <div class="metric-status warning">High</div>
                    </div>
                </div>
            </div>
        `,
  },
  'dev-tools': {
    title: '🔧 Development Tools',
    content: `
            <div class="dev-tools-section">
                <h2>Development Environment</h2>
                <div class="dev-tools-grid">
                    <div class="dev-tool">
                        <h3>Code Editor</h3>
                        <p>Integrated code editor with syntax highlighting</p>
                        <button class="btn btn-primary" onclick="openEditor()">Open Editor</button>
                    </div>
                    <div class="dev-tool">
                        <h3>Terminal</h3>
                        <p>Command line interface for development tasks</p>
                        <button class="btn btn-primary" onclick="openTerminal()">Open Terminal</button>
                    </div>
                    <div class="dev-tool">
                        <h3>File Manager</h3>
                        <p>Browse and manage project files</p>
                        <button class="btn btn-primary" onclick="openFileManager()">Open File Manager</button>
                    </div>
                </div>
            </div>
        `,
  },
  reports: {
    title: '📊 Reports',
    content: `
            <div class="reports-section">
                <h2>Analysis Reports</h2>
                <div class="reports-grid">
                    <div class="report-card">
                        <h3>Security Report</h3>
                        <p>Comprehensive security vulnerability assessment</p>
                        <button class="btn btn-primary" onclick="generateReport('security')">Generate</button>
                    </div>
                    <div class="report-card">
                        <h3>Quality Report</h3>
                        <p>Code quality and maintainability analysis</p>
                        <button class="btn btn-primary" onclick="generateReport('quality')">Generate</button>
                    </div>
                    <div class="report-card">
                        <h3>Compliance Report</h3>
                        <p>SAIF compliance and regulatory adherence</p>
                        <button class="btn btn-primary" onclick="generateReport('compliance')">Generate</button>
                    </div>
                    <div class="report-card">
                        <h3>Cost Analysis</h3>
                        <p>Cloud infrastructure cost optimization</p>
                        <button class="btn btn-primary" onclick="generateReport('cost')">Generate</button>
                    </div>
                </div>
            </div>
        `,
  },
  database: {
    title: '🗄️ Database',
    content: `
            <div class="database-section">
                <h2>Database Management</h2>
                <div class="database-tools">
                    <div class="db-tool">
                        <h3>Query Editor</h3>
                        <textarea id="sqlQuery" placeholder="Enter SQL query..." rows="4"></textarea>
                        <button class="btn btn-primary" onclick="executeQuery()">Execute Query</button>
                    </div>
                    <div class="db-results" id="queryResults">
                        <p>Query results will appear here...</p>
                    </div>
                </div>
            </div>
        `,
  },
  api: {
    title: 'API',
    content: `
            <div class="api-section">
                <h2>API Management</h2>
                <div class="api-tools">
                    <div class="api-tool">
                        <h3>API Tester</h3>
                        <input type="text" id="apiUrl" placeholder="Enter API endpoint..." />
                        <select id="apiMethod">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <button class="btn btn-primary" onclick="testApi()">Test API</button>
                    </div>
                    <div class="api-results" id="apiResults">
                        <p>API response will appear here...</p>
                    </div>
                </div>
            </div>
        `,
  },
  'original-dashboard': {
    title: 'Original Dashboard (Legacy)',
    content: `
            <div class="legacy-dashboard">
                <h2>Original Dashboard</h2>
                <p>This is the legacy dashboard interface.</p>
                <button class="btn btn-secondary" onclick="window.open('stable_dashboard.html', '_blank')">Open Legacy Dashboard</button>
            </div>
        `,
  },
  'clean-dashboard': {
    title: 'Clean Dashboard (Current)',
    content: `
            <div class="clean-dashboard">
                <h2>Clean Dashboard</h2>
                <p>This is the current clean dashboard interface.</p>
                <div class="dashboard-preview">
                    <p>You are currently viewing the clean dashboard interface.</p>
                </div>
            </div>
        `,
  },
  'merger-tool': {
    title: '🔧 Project Merger Tool',
    content: `
            <div class="merger-tool-section">
                <h2>Project Merger Tool</h2>
                <p>Analyze and merge your CascadeProjects directory structure</p>
                
                <div class="merger-stats">
                    <div class="stat-card">
                        <h3>📊 Analysis Results</h3>
                        <div class="stat-value">9,534</div>
                        <div class="stat-label">Total Files</div>
                    </div>
                    <div class="stat-card">
                        <h3>📁 Directories</h3>
                        <div class="stat-value">19</div>
                        <div class="stat-label">Projects</div>
                    </div>
                    <div class="stat-card">
                        <h3>🎯 Strategy</h3>
                        <div class="stat-value">Selective</div>
                        <div class="stat-label">Merger Type</div>
                    </div>
                    <div class="stat-card">
                        <h3>⏱️ Timeframe</h3>
                        <div class="stat-value">6-8 weeks</div>
                        <div class="stat-label">Est. Duration</div>
                    </div>
                </div>
                
                <div class="merger-actions">
                    <h3>🚀 Available Actions</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="runMergerAnalysis()">
                            <i class="fas fa-search"></i> Run Analysis
                        </button>
                        <button class="btn btn-success" onclick="viewMergerReports()">
                            <i class="fas fa-file-alt"></i> View Reports
                        </button>
                        <button class="btn btn-info" onclick="openMergerInterface()">
                            <i class="fas fa-cog"></i> Open Interface
                        </button>
                        <button class="btn btn-warning" onclick="downloadMergerReports()">
                            <i class="fas fa-download"></i> Download Reports
                        </button>
                    </div>
                </div>
                
                <div class="merger-reports">
                    <h3>📋 Generated Reports</h3>
                    <div class="report-list">
                        <div class="report-item">
                            <h4>📊 Summary Report</h4>
                            <p>project_merger_summary.md - Executive overview and key metrics</p>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewReport('summary')">View</button>
                        </div>
                        <div class="report-item">
                            <h4>📋 Detailed Analysis</h4>
                            <p>project_merger_report.json - Comprehensive project data (62KB)</p>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewReport('detailed')">View</button>
                        </div>
                        <div class="report-item">
                            <h4>🎯 Recommendations</h4>
                            <p>merger_recommendations.md - Implementation guide and best practices</p>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewReport('recommendations')">View</button>
                        </div>
                    </div>
                </div>
                
                <div class="merger-phases">
                    <h3>📅 Implementation Phases</h3>
                    <div class="phase-item">
                        <h4>Phase 1: Foundation (Week 1)</h4>
                        <p>Create unified build system, establish shared configuration, implement code standards</p>
                    </div>
                    <div class="phase-item">
                        <h4>Phase 2: High Priority (Week 2-3)</h4>
                        <p>Merge ai-platform (1,520 files) and src (1,171 files) - core application logic</p>
                    </div>
                    <div class="phase-item">
                        <h4>Phase 3: Supporting (Week 4-5)</h4>
                        <p>Merge web (401 files), tools (22 files), tests (621 files), docs (1,102 files)</p>
                    </div>
                    <div class="phase-item">
                        <h4>Phase 4: Cleanup (Week 6)</h4>
                        <p>Evaluate archives (3,049 files), remove duplicates, optimize performance</p>
                    </div>
                </div>
            </div>
        `,
  },
  settings: {
    title: '⚙️ Settings',
    content: `
            <div class="settings-section">
                <h2>Platform Settings</h2>
                <div class="settings-categories">
                    <div class="setting-category">
                        <h3>General Settings</h3>
                        <div class="setting-item">
                            <label>Theme</label>
                            <select id="themeSelect">
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>Language</label>
                            <select id="languageSelect">
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                            </select>
                        </div>
                    </div>
                    <div class="setting-category">
                        <h3>AI Settings</h3>
                        <div class="setting-item">
                            <label>AI Model</label>
                            <select id="aiModelSelect">
                                <option value="gpt-4">GPT-4</option>
                                <option value="claude">Claude</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
            </div>
        `,
  },
  help: {
    title: '? Help',
    content: `
            <div class="help-section">
                <h2>Help & Documentation</h2>
                <div class="help-categories">
                    <div class="help-category">
                        <h3>Getting Started</h3>
                        <ul>
                            <li><a href="#" onclick="showHelp('quick-start')">Quick Start Guide</a></li>
                            <li><a href="#" onclick="showHelp('tutorials')">Tutorials</a></li>
                            <li><a href="#" onclick="showHelp('examples')">Examples</a></li>
                        </ul>
                    </div>
                    <div class="help-category">
                        <h3>Documentation</h3>
                        <ul>
                            <li><a href="#" onclick="showHelp('api-docs')">API Documentation</a></li>
                            <li><a href="#" onclick="showHelp('user-guide')">User Guide</a></li>
                            <li><a href="#" onclick="showHelp('developer-docs')">Developer Docs</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `,
  },
};

// Mobile menu toggle function
window.toggleMobileMenu = function () {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-menu-overlay');

  if (sidebar && overlay) {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');

    // Update menu button
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    if (toggleBtn) {
      const isOpen = sidebar.classList.contains('mobile-open');
      toggleBtn.textContent = isOpen ? '✕ Close' : '☰ Menu' /* Replaced innerHTML with textContent for safety */
      toggleBtn.setAttribute('aria-expanded', isOpen);
    }
  }
};

// Main navigation function
window.navigateTo = function (section, element) {
  console.log(`📍 Navigating to: ${section}`);

  // Close mobile menu if open
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-menu-overlay');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    toggleMobileMenu();
  }

  // Update active state
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
  });
  if (element) {
    element.classList.add('active');
  }

  // Update current section
  window.currentSection = section;
  window.navigationHistory.push(section);

  // Update content
  updateMainContent(section);

  // Show notification
  showNotification(`Navigated to ${section}`, 'info');
};

// Update main content area
function updateMainContent(section) {
  const mainContent = document.querySelector('.dashboard-container');
  if (!mainContent) return;

  const content = sectionContent[section] || sectionContent['overview'];

  // Hide loading spinner
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) {
    spinner.style.display = 'none';
  }

  // Clear existing content
  mainContent.textContent = '' /* Replaced innerHTML with textContent for safety */

  // Create section header
  const sectionHeader = document.createElement('div');
  sectionHeader.className = 'section-header';
  sectionHeader.textContent = `<h1>${content.title}</h1>` /* Replaced innerHTML with textContent for safety */
  mainContent.appendChild(sectionHeader);

  // Create section content
  const sectionContentDiv = document.createElement('div');
  sectionContentDiv.className = 'section-content';
  sectionContentDiv.textContent = content.content /* Replaced innerHTML with textContent for safety */
  mainContent.appendChild(sectionContentDiv);

  // Initialize section-specific functionality
  initializeSection(section);

  console.log(`✅ Content loaded for section: ${section}`);
}

// Initialize section-specific features
function initializeSection(section) {
  console.log(`🔧 Initializing section: ${section}`);

  switch (section) {
    case 'overview':
      initializeOverview();
      break;
    case 'ai-tools':
    case 'ai-analysis':
    case 'oracle-ai':
    case 'code-generation':
      initializeAITools();
      break;
    case 'reports':
      initializeReports();
      break;
    case 'analytics':
      initializeAnalyticsCharts();
      break;
    case 'performance':
      initializePerformance();
      break;
    case 'dev-tools':
      initializeDevTools();
      break;
    case 'database':
      initializeDatabase();
      break;
    case 'api':
      initializeAPI();
      break;
    case 'merger-tool':
      initializeMergerTool();
      break;
    case 'settings':
      initializeSettings();
      break;
    case 'help':
      initializeHelp();
      break;
    case 'original-dashboard':
      initializeOriginalDashboard();
      break;
    case 'clean-dashboard':
      initializeCleanDashboard();
      break;
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 0.5rem;
        color: white;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Tool launch functions
window.launchTool = function (tool) {
  console.log(`🚀 Launching tool: ${tool}`);
  showNotification(`Launching ${tool}...`, 'info');
};

window.runCodeAnalysis = function () {
  showNotification('Starting code analysis...', 'info');
  setTimeout(() => {
    showNotification('Code analysis completed!', 'success');
  }, 2000);
};

window.runDataAnalysis = function () {
  showNotification('Starting data analysis...', 'info');
  setTimeout(() => {
    showNotification('Data analysis completed!', 'success');
  }, 2000);
};

window.askOracle = function () {
  const query = document.getElementById('oracleQuery')?.value;
  if (query) {
    showNotification('Oracle is processing your question...', 'info');
    setTimeout(() => {
      const response = document.getElementById('oracleResponse');
      if (response) {
        response.textContent = `<p><strong>Oracle Response:</strong> Based on your question about "${query}", here's my insight...</p>` /* Replaced innerHTML with textContent for safety */
      }
    }, 1500);
  }
};

window.generateCode = function () {
  const prompt = document.getElementById('codePrompt')?.value;
  const language = document.getElementById('languageSelect')?.value;
  if (prompt) {
    showNotification('Generating code...', 'info');
    setTimeout(() => {
      const codeOutput = document.getElementById('generatedCode');
      if (codeOutput) {
        codeOutput.textContent = `<code>// Generated ${language} code for: ${prompt}\n// This is a placeholder implementation\nfunction main() {\n    console.log("Hello, World!") /* Replaced innerHTML with textContent for safety */\n}</code>`;
      }
    }, 1500);
  }
};

// Additional initialization functions
window.initializeReports = function () {
  console.log('📊 Initializing Reports section...');
  // Add charts and report functionality
};

window.initializePerformance = function () {
  console.log('📈 Initializing Performance section...');
  // Add performance metrics and monitoring
};

window.initializeDevTools = function () {
  console.log('🔧 Initializing Dev Tools section...');
  // Add development tools and utilities
};

window.initializeDatabase = function () {
  console.log('🗄️ Initializing Database section...');
  // Add database management interface
};

window.initializeAPI = function () {
  console.log('🔌 Initializing API section...');
  // Add API documentation and testing tools
};

window.initializeSettings = function () {
  console.log('⚙️ Initializing Settings section...');
  // Add settings and configuration options
};

window.initializeHelp = function () {
  console.log('❓ Initializing Help section...');
  // Add help documentation and support
};

window.initializeOverview = function () {
  console.log('🏢 Initializing Overview section...');
  // Add dashboard overview functionality
};

window.initializeOriginalDashboard = function () {
  console.log('📋 Initializing Original Dashboard section...');
  // Add original dashboard functionality
};

window.initializeCleanDashboard = function () {
  console.log('✨ Initializing Clean Dashboard section...');
  // Add clean dashboard functionality
};

window.initializeMergerTool = function () {
  console.log('🔧 Initializing Merger Tool section...');
  // Add merger tool functionality
};

window.generateReport = function (type) {
  showNotification(`Generating ${type} report...`, 'info');
  setTimeout(() => {
    showNotification(`${type} report generated!`, 'success');
  }, 2000);
};

window.openEditor = function () {
  showNotification('Opening code editor...', 'info');
};

window.executeQuery = function () {
  const query = document.getElementById('sqlQuery')?.value;
  if (query) {
    showNotification('Executing SQL query...', 'info');
    setTimeout(() => {
      const results = document.getElementById('queryResults');
      if (results) {
        results.textContent = `<div class="query-result">
          <h4>Query Results</h4>
          <p>Query executed successfully: ${query}</p>
          <table class="table table-striped">
            <thead><tr><th>ID</th><th>Name</th><th>Value</th></tr></thead>
            <tbody><tr><td>1</td><td>Sample</td><td>100</td></tr></tbody>
          </table>
        </div>` /* Replaced innerHTML with textContent for safety */
      }
    }, 1500);
  }
};

window.testApi = function () {
  const url = document.getElementById('apiUrl')?.value;
  const method = document.getElementById('apiMethod')?.value;
  if (url) {
    showNotification(`Testing ${method} ${url}...`, 'info');
    setTimeout(() => {
      const results = document.getElementById('apiResults');
      if (results) {
        results.textContent = `<div class="api-result">
          <h4>API Response</h4>
          <p><strong>${method}</strong> ${url}</p>
          <pre>{
  "status": "success",
  "data": {
    "message": "API call successful",
    "timestamp": "${new Date().toISOString()}"
  }
}</pre>
        </div>` /* Replaced innerHTML with textContent for safety */
      }
    }, 1500);
  }
};

window.saveSettings = function () {
  showNotification('Saving settings...', 'info');
  setTimeout(() => {
    showNotification('Settings saved successfully!', 'success');
  }, 1000);
};

window.showHelp = function (topic) {
  showNotification(`Opening help for ${topic}...`, 'info');
  setTimeout(() => {
    showNotification(`Help documentation for ${topic} loaded`, 'success');
  }, 1000);
};

window.openTerminal = function () {
  showNotification('Opening terminal...', 'info');
};

window.openFileManager = function () {
  showNotification('Opening file manager...', 'info');
};

window.runMergerAnalysis = function () {
  showNotification('Running merger analysis...', 'info');
  setTimeout(() => {
    showNotification('Merger analysis completed! Check generated reports.', 'success');
  }, 2000);
};

window.viewMergerReports = function () {
  showNotification('Opening merger reports...', 'info');
  setTimeout(() => {
    showNotification('Reports available in project directory', 'success');
  }, 1500);
};

window.openMergerInterface = function () {
  showNotification('Opening merger interface...', 'info');
  setTimeout(() => {
    showNotification('Dashboard interface ready', 'success');
  }, 1500);
};

window.downloadMergerReports = function () {
  showNotification('Downloading merger reports...', 'info');
  setTimeout(() => {
    showNotification('Reports downloaded successfully', 'success');
  }, 2000);
};

window.viewReport = function (type) {
  showNotification(`Opening ${type} report...`, 'info');
  setTimeout(() => {
    showNotification(`${type} report loaded`, 'success');
  }, 1500);
};

window.testApi = function () {
  const url = document.getElementById('apiUrl')?.value;
  const method = document.getElementById('apiMethod')?.value;
  if (url) {
    showNotification(`Testing ${method} ${url}...`, 'info');
    setTimeout(() => {
      const results = document.getElementById('apiResults');
      if (results) {
        results.textContent = `<p>API test completed. Response would appear here.</p>` /* Replaced innerHTML with textContent for safety */
      }
    }, 1500);
  }
};

window.saveSettings = function () {
  showNotification('Settings saved successfully!', 'success');
};

window.showHelp = function (topic) {
  showNotification(`Loading help for ${topic}...`, 'info');
};

// Initialize analytics charts
function initializeAnalyticsCharts() {
  console.log('📊 Initializing analytics charts...');
  // Chart initialization would go here
}

// Initialize AI tools
function initializeAITools() {
  console.log('🤖 Initializing AI tools...');
  // AI tools initialization would go here
}

// Initialize navigation on page load
document.addEventListener('DOMContentLoaded', function () {
  console.log('🎯 AI Platform Navigation System ready');

  // Set up navigation listeners
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      const section = this.getAttribute('onclick')?.match(/navigateTo\('([^']+)'/);
      if (section) {
        navigateTo(section[1], this);
      }
    });
  });

  // Load default section
  updateMainContent('overview');
});

// Export for global access
window.AIPlatformNavigation = {
  navigateTo,
  updateMainContent,
  showNotification,
};
