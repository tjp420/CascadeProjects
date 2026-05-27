// Simple dashboard initialization - loads essential functions first
console.log('🔧 Dashboard initialization starting...');

// Essential functions that must be available immediately
window.toggleSidebar = function () {
  console.log('🔄 Toggling sidebar...');
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  const toggleButton = document.querySelector('.sidebar-toggle');
  const navElement = document.querySelector('.sidebar-nav');

  if (sidebar && mainContent) {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');

    // Save preference to localStorage
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);

    // Update ARIA attributes for accessibility
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', !isCollapsed);
    }

    if (navElement) {
      navElement.setAttribute('aria-hidden', isCollapsed);
    }
  }
};

window.navigateTo = function (section, element) {
  console.log('🧭 Navigating to:', section);

  // Remove active class from all nav items
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
  });

  // Add active class to clicked item
  if (element) {
    element.classList.add('active');
  }

  // Handle navigation based on section
  const container = document.querySelector('.dashboard-container');
  if (container) {
    switch (section) {
      case 'overview':
        showOverview(container);
        break;
      case 'backup':
        showBackupManager(container);
        break;
      case 'sprint-status':
        showSprintStatus(container);
        break;
      case 'complexity-analysis':
        showComplexityAnalysis(container);
        break;
      case 'performance':
        showPerformanceMetrics(container);
        break;
      case 'data-upload':
        showDataUpload(container);
        break;
      case 'directory-analyzer':
        showDirectoryAnalyzer(container);
        break;
      case 'debug':
        showDebugTools(container);
        break;
      case 'reports':
        showReports(container);
        break;
      case 'roadmap':
        showRoadmap(container);
        break;
      case 'team':
        showTeam(container);
        break;
      case 'mock-data':
        showMockDataAnalysis(container);
        break;
      case 'settings':
        showSettings(container);
        break;
      case 'help':
        showHelp(container);
        break;
      case 'about':
        showAbout(container);
        break;
      // M&A Due Diligence Navigation
      case 'financial-impact':
        showFinancialImpact(container);
        break;
      case 'risk-assessment':
        showRiskAssessment(container);
        break;
      case 'compliance':
        showCompliance(container);
        break;
      case 'codebase-analysis':
        showCodebaseAnalysis(container);
        break;
      case 'security-scan':
        showSecurityScan(container);
        break;
      case 'scalability':
        showScalability(container);
        break;
      case 'benchmark':
        showBenchmark(container);
        break;
      case 'executive-summary':
        showExecutiveSummary(container);
        break;
      case 'deal-timeline':
        showDealTimeline(container);
        break;
      case 'integration-plan':
        showIntegrationPlan(container);
        break;
      default:
        console.log('Section not implemented:', section);
        showComingSoon(section, container);
    }
  }
};

// Simple overview display
function showOverview(container) {
  container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                <i class="fas fa-chart-line"></i> Dashboard Overview
            </h2>
            
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-value">87%</div>
                    <div class="stat-label">Code Quality</div>
                    <div class="stat-change">+5% from last week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">12</div>
                    <div class="stat-label">Security Issues</div>
                    <div class="stat-change">-3 resolved</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">156</div>
                    <div class="stat-label">Files Analyzed</div>
                    <div class="stat-change">+12 new files</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">4.2s</div>
                    <div class="stat-label">Avg Load Time</div>
                    <div class="stat-change">-0.8s improved</div>
                </div>
            </div>
            
            <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <h3 style="color: var(--text-primary); margin-bottom: 1rem;">
                    <i class="fas fa-database"></i> Backup System Status
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                            Backup API: Connected
                        </p>
                        <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                            Real-time Updates: Active
                        </p>
                    </div>
                    <div>
                        <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                            <i class="fas fa-database" style="color: var(--primary-color);"></i>
                            Total Backups: 2
                        </p>
                        <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                            <i class="fas fa-clock" style="color: var(--warning-color);"></i>
                            Last Backup: 2 hours ago
                        </p>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="navigateTo('backup', this)">
                        <i class="fas fa-database"></i> Manage Backups
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Backup manager display
function showBackupManager(container) {
  container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                <i class="fas fa-database"></i> Backup Manager
            </h2>
            
            <div class="backup-stats" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">2</div>
                        <div class="stat-label">Total Backups</div>
                        <div class="stat-change">Loading...</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">150 MB</div>
                        <div class="stat-label">Total Size</div>
                        <div class="stat-change">Loading...</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">1</div>
                        <div class="stat-label">Recent (7 days)</div>
                        <div class="stat-change">Loading...</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">2h ago</div>
                        <div class="stat-label">Last Backup</div>
                        <div class="stat-change">Loading...</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Available Backups</h3>
                <div id="backup-list">
                    <p style="color: var(--text-secondary);">Loading backup list...</p>
                </div>
            </div>
            
            <div style="text-align: center;">
                <button class="btn btn-primary" onclick="createNewBackup()">
                    <i class="fas fa-plus"></i> Create New Backup
                </button>
                <button class="btn btn-secondary" onclick="refreshBackupList()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        </div>
    `;

  // Load backup data
  loadBackupData();
}

// Load backup data from API
async function loadBackupData() {
  try {
    const response = await fetch('http://localhost:8000/api/backup/list');
    const data = await response.json();

    if (data.success) {
      displayBackupList(data.backups);
    } else {
      console.error('Failed to load backups:', data);
    }
  } catch (error) {
    console.error('Error loading backups:', error);
    const backupListElement = document.getElementById('backup-list');
    if (backupListElement) {
      backupListElement.textContent = '<p style="color: var(--text-secondary) /* Replaced innerHTML with textContent for safety */">Failed to load backups. Is the backup API running?</p>';
    }
  }
}

// Display backup list
function displayBackupList(backups) {
  const listContainer = document.getElementById('backup-list');
  if (!listContainer) {
    return;
  }

  if (backups.length === 0) {
    listContainer.textContent = '<p style="color: var(--text-secondary) /* Replaced innerHTML with textContent for safety */">No backups available.</p>';
    return;
  }

  listContainer.textContent = backups
    .map(
      (backup) => `
        <div style="background: var(--bg-primary) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">${backup.name}</h4>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${new Date(backup.timestamp).toLocaleString()}</p>
                </div>
                <div style="text-align: right;">
                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${formatFileSize(backup.size)}</p>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${backup.files_count} files</p>
                </div>
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="downloadBackup('${backup.name}')">
                    <i class="fas fa-download"></i> Download
                </button>
                <button class="btn btn-sm btn-secondary" onclick="restoreBackup('${backup.name}')">
                    <i class="fas fa-undo"></i> Restore
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `
    )
    .join('');
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Backup operations
async function createNewBackup() {
  console.log('Creating new backup...');
  try {
    const response = await fetch('http://localhost:8000/api/backup/create', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      alert('Backup created successfully: ' + data.backup_name);
      loadBackupData();
    } else {
      alert('Failed to create backup');
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    alert('Failed to create backup');
  }
}

async function refreshBackupList() {
  document.getElementById('backup-list').textContent = '<p style="color: var(--text-secondary) /* Replaced innerHTML with textContent for safety */">Refreshing...</p>';
  await loadBackupData();
}

function downloadBackup(name) {
  console.log('Downloading backup:', name);
  alert('Download functionality would be implemented here');
}

function restoreBackup(name) {
  console.log('Restoring backup:', name);
  if (confirm('Are you sure you want to restore this backup? This will replace current files.')) {
    alert('Restore functionality would be implemented here');
  }
}

function deleteBackup(name) {
  console.log('Deleting backup:', name);
  if (confirm('Are you sure you want to delete this backup?')) {
    alert('Delete functionality would be implemented here');
  }
}

// Sprint status display
function showSprintStatus(container) {
  // Load sprint status script if not already loaded
  if (
    typeof showSprintStatus === 'undefined' ||
    !document.querySelector('script[src*="sprint-status.js"]')
  ) {
    const script = document.createElement('script');
    script.src = 'sprint-status.js?v=1.0';
    script.onload = () => {
      // Call the sprint status function after script loads
      if (typeof showSprintStatus === 'function') {
        showSprintStatus(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Loading Sprint Status...</h3>
                <p style="color: var(--text-secondary);">Please wait while we load sprint data.</p>
            </div>
        `;
  } else {
    // Use the loaded sprint status function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 2rem;">
                    <i class="fas fa-running"></i>
                </div>
                <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Sprint Status</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">Sprint management and tracking</p>
                <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Current Sprint</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <p style="color: var(--text-secondary); margin: 0.5rem 0;">Sprint Name:</p>
                            <p style="color: var(--text-primary); font-weight: bold; margin: 0;">Q2 Feature Enhancement</p>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); margin: 0.5rem 0;">Progress:</p>
                            <p style="color: var(--text-primary); font-weight: bold; margin: 0;">85% Complete</p>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); margin: 0.5rem 0;">Duration:</p>
                            <p style="color: var(--text-primary); font-weight: bold; margin: 0;">May 6 - May 20</p>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); margin: 0.5rem 0;">Tasks:</p>
                            <p style="color: var(--text-primary); font-weight: bold; margin: 0;">10/12 Completed</p>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-primary); font-size: 0.9rem;">Sprint Progress</span>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">85%</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: 85%; background: linear-gradient(90deg, var(--primary-color), var(--success-color)); border-radius: 4px;"></div>
                        </div>
                    </div>
                </div>
                <div style="background: var(--card-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Recent Tasks</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Implement backup system API</span>
                                <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Completed</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Backend Team • 14h / 16h</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--primary-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Design backup UI components</span>
                                <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Completed</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Frontend Team • 10h / 12h</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Integrate real-time progress tracking</span>
                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">In Progress</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Frontend Team • 6h / 8h</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }
}

// Complexity analysis display
function showComplexityAnalysis(container) {
  // Load complexity analysis script if not already loaded
  if (!document.querySelector('script[src*="complexity-analysis.js"]')) {
    const script = document.createElement('script');
    script.src = 'complexity-analysis.js?v=1.0';
    script.onload = () => {
      // Call the complexity analysis function after script loads
      if (typeof showComplexityAnalysis === 'function') {
        showComplexityAnalysis(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Analyzing Code Complexity...</h3>
                <p style="color: var(--text-secondary);">Please wait while we analyze your codebase.</p>
            </div>
        `;
  } else {
    // Use the loaded complexity analysis function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-code-branch"></i> Complexity Analysis
                </h2>
                
                <!-- Overall Metrics -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">145</div>
                        <div class="stat-label">Total Complexity</div>
                        <div class="stat-change">+3 from last week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">3.2</div>
                        <div class="stat-label">Average Complexity</div>
                        <div class="stat-change">-0.2 improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">8</div>
                        <div class="stat-label">High Complexity Files</div>
                        <div class="stat-change" style="color: var(--warning-color);">Needs attention</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">76</div>
                        <div class="stat-label">Total Files Analyzed</div>
                        <div class="stat-change">+2 new files</div>
                    </div>
                </div>
                
                <!-- Complexity Distribution -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Complexity Distribution</h3>
                        <div style="margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">Low Complexity (1-3)</span>
                                <span style="color: var(--success-color); font-weight: bold;">45 (59%)</span>
                            </div>
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: 59%; background: var(--success-color); border-radius: 4px;"></div>
                            </div>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">Medium Complexity (4-7)</span>
                                <span style="color: var(--warning-color); font-weight: bold;">23 (30%)</span>
                            </div>
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: 30%; background: var(--warning-color); border-radius: 4px;"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">High Complexity (8+)</span>
                                <span style="color: var(--danger-color); font-weight: bold;">8 (11%)</span>
                            </div>
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: 11%; background: var(--danger-color); border-radius: 4px;"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Critical Files</h3>
                        <div style="display: grid; gap: 1rem;">
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--danger-color);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span style="color: var(--text-primary); font-weight: 500;">dashboard-scripts.js</span>
                                    <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Complexity: 15</span>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">8,397 lines • 45 functions • 392 cyclomatic complexity</p>
                            </div>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span style="color: var(--text-primary); font-weight: 500;">backup-manager.js</span>
                                    <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Complexity: 8</span>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">543 lines • 18 functions • 61 cyclomatic complexity</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Recommendations -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Top Recommendations</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--danger-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Refactor dashboard-scripts.js</span>
                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">High Priority</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Extremely high complexity (392) and zero maintainability index. Break into smaller modules.</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Optimize backup-manager.js</span>
                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Medium Priority</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Moderate complexity with maintainability issues. Extract utilities.</p>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Full complexity analysis would run here')">
                        <i class="fas fa-play"></i> Run Full Analysis
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Detailed report would be exported here')">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
        `;
  }
}

// Performance metrics display
function showPerformanceMetrics(container) {
  // Load performance metrics script if not already loaded
  if (!document.querySelector('script[src*="performance-metrics.js"]')) {
    const script = document.createElement('script');
    script.src = 'performance-metrics.js?v=1.0';
    script.onload = () => {
      // Call the performance metrics function after script loads
      if (typeof showPerformanceMetrics === 'function') {
        showPerformanceMetrics(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Loading Performance Metrics...</h3>
                <p style="color: var(--text-secondary);">Please wait while we gather performance data.</p>
            </div>
        `;
  } else {
    // Use the loaded performance metrics function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-tachometer-alt"></i> Performance Metrics
                </h2>
                
                <!-- Key Performance Indicators -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">4.2s</div>
                        <div class="stat-label">Avg Response Time</div>
                        <div class="stat-change" style="color: var(--success-color);">-0.3s improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">1250</div>
                        <div class="stat-label">Requests/min</div>
                        <div class="stat-change">+12% increase</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">0.8%</div>
                        <div class="stat-label">Error Rate</div>
                        <div class="stat-change" style="color: var(--success-color);">-0.2% improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">99.7%</div>
                        <div class="stat-label">Uptime</div>
                        <div class="stat-change" style="color: var(--success-color);">Excellent</div>
                    </div>
                </div>
                
                <!-- System Health Overview -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Response Time Trend</h3>
                        <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                            <div style="text-align: center;">
                                <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                <p>Response time chart would be rendered here</p>
                                <p style="font-size: 0.9rem;">Showing average response times over the last hour</p>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">System Health</h3>
                        <div style="display: grid; gap: 1rem;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">CPU Usage</span>
                                    <span style="color: var(--success-color); font-weight: bold;">45%</span>
                                </div>
                                <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: 45%; background: var(--success-color); border-radius: 3px;"></div>
                                </div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">Memory Usage</span>
                                    <span style="color: var(--warning-color); font-weight: bold;">67%</span>
                                </div>
                                <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: 67%; background: var(--warning-color); border-radius: 3px;"></div>
                                </div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">Disk Usage</span>
                                    <span style="color: var(--success-color); font-weight: bold;">23%</span>
                                </div>
                                <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: 23%; background: var(--success-color); border-radius: 3px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- API Endpoints Performance -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">API Endpoints Performance</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">API Health Check</span>
                                <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">0.8s</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">1,250 requests • 0% error rate • Healthy</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--primary-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Backup API</span>
                                <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">2.3s</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">450 requests • 0.2% error rate • Healthy</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Export Service</span>
                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">8.7s</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">125 requests • 2.4% error rate • Degraded</p>
                        </div>
                    </div>
                </div>
                
                <!-- Performance Recommendations -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Performance Recommendations</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--danger-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Optimize Export Service</span>
                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">High Priority</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Export API showing slow response times. Consider implementing caching or async processing.</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">Scale Memory Resources</span>
                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Medium Priority</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Memory usage consistently above 60%. Consider adding more RAM or optimizing memory usage.</p>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Full performance test would run here')">
                        <i class="fas fa-play"></i> Run Performance Test
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Performance report would be exported here')">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
        `;
  }
}

// Data upload display
function showDataUpload(container) {
  // Load data upload script if not already loaded
  if (!document.querySelector('script[src*="data-upload.js"]')) {
    const script = document.createElement('script');
    script.src = 'data-upload.js?v=1.0';
    script.onload = () => {
      // Call the data upload function after script loads
      if (typeof showDataUpload === 'function') {
        showDataUpload(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Loading Data Upload...</h3>
                <p style="color: var(--text-secondary);">Please wait while we prepare the upload system.</p>
            </div>
        `;
  } else {
    // Use the loaded data upload function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-upload"></i> Data Upload
                </h2>
                
                <!-- Upload Statistics -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">156</div>
                        <div class="stat-label">Total Uploads</div>
                        <div class="stat-change">+12 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">97.6GB</div>
                        <div class="stat-label">Total Size</div>
                        <div class="stat-change">+2.3GB</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">94.5%</div>
                        <div class="stat-label">Success Rate</div>
                        <div class="stat-change" style="color: var(--success-color);">Excellent</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">28s</div>
                        <div class="stat-label">Avg Processing</div>
                        <div class="stat-change">-5s improvement</div>
                    </div>
                </div>
                
                <!-- Recent Uploads -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Recent Uploads</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">project-source.zip</span>
                                <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Completed</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">5.0MB • 156 files found • 45s processing</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">code-analysis.json</span>
                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Processing</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">1.0MB • 0 files found • 0s processing</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">documentation.pdf</span>
                                <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Completed</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">2.0MB • 1 file found • 12s processing</p>
                        </div>
                    </div>
                </div>
                
                <!-- Supported Formats -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Supported File Formats</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-archive" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">.zip - Archives</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-code" style="color: var(--primary-color);"></i>
                            <span style="color: var(--text-primary);">.json - JSON</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-csv" style="color: var(--success-color);"></i>
                            <span style="color: var(--text-primary);">.csv - CSV</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-pdf" style="color: var(--danger-color);"></i>
                            <span style="color: var(--text-primary);">.pdf - PDF</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <fab fa-js" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">.js - JavaScript</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fab fa-python" style="color: var(--primary-color);"></i>
                            <span style="color: var(--text-primary);">.py - Python</span>
                        </div>
                    </div>
                </div>
                
                <!-- Upload Guidelines -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Upload Guidelines</h3>
                    <ul style="color: var(--text-secondary); line-height: 1.6;">
                        <li>Maximum file size: 100MB per file</li>
                        <li>Maximum total size per batch: 500MB</li>
                        <li>Supported archive formats: .zip, .tar.gz</li>
                        <li>Files are automatically scanned for security issues</li>
                        <li>Processing time varies based on file size and complexity</li>
                        <li>All uploads are logged and tracked</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('File upload modal would be shown here with drag-and-drop support')">
                        <i class="fas fa-plus"></i> Upload Files
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Batch upload modal would be shown here for multiple files')">
                        <i class="fas fa-layer-group"></i> Batch Upload
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Upload report would be exported here')">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
        `;
  }
}

// Directory analyzer display
function showDirectoryAnalyzer(container) {
  // Load directory analyzer script if not already loaded
  if (!document.querySelector('script[src*="directory-analyzer.js"]')) {
    const script = document.createElement('script');
    script.src = 'directory-analyzer.js?v=1.0';
    script.onload = () => {
      // Call the directory analyzer function after script loads
      if (typeof showDirectoryAnalyzer === 'function') {
        showDirectoryAnalyzer(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Analyzing Directory...</h3>
                <p style="color: var(--text-secondary);">Please wait while we scan the directory structure.</p>
            </div>
        `;
  } else {
    // Use the loaded directory analyzer function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-folder-tree"></i> Directory Analyzer
                </h2>
                
                <!-- Current Path -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <i class="fas fa-folder" style="color: var(--primary-color);"></i>
                        <span style="color: var(--text-primary); font-family: monospace;">/Users/Trevor/CascadeProjects/web</span>
                        <span style="color: var(--text-secondary);">• Last analyzed: 2:30 PM</span>
                    </div>
                </div>
                
                <!-- Directory Stats -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">156</div>
                        <div class="stat-label">Total Files</div>
                        <div class="stat-change">+5 new files</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">45</div>
                        <div class="stat-label">Directories</div>
                        <div class="stat-change">+2 new folders</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">97.6GB</div>
                        <div class="stat-label">Total Size</div>
                        <div class="stat-change">+12.5MB</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">8</div>
                        <div class="stat-label">Max Depth</div>
                        <div class="stat-change" style="color: var(--warning-color);">Deep structure</div>
                    </div>
                </div>
                
                <!-- Directory Structure -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Directory Structure</h3>
                    <div style="display: grid; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; cursor: pointer;">
                            <i class="fas fa-folder-open" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">web</span>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">(156 files, 45 dirs)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0 0.5rem 2rem; cursor: pointer;">
                            <i class="fas fa-folder" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">api</span>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">(28 files, 8 dirs)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0 0.5rem 2rem; cursor: pointer;">
                            <i class="fas fa-folder" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">dashboard_components</span>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">(18 files, 0 dirs)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0 0.5rem 2rem; cursor: pointer;">
                            <i class="fas fa-folder" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">tests</span>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">(35 files, 12 dirs)</span>
                        </div>
                    </div>
                </div>
                
                <!-- File Analysis -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Largest Files</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--danger-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">dashboard-scripts.js</span>
                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">8.4MB</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">8,397 lines • 15 complexity • 12 issues</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">backup_system.py</span>
                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">65KB</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">802 lines • 4 complexity • 2 issues</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--primary-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">ai_dashboard.html</span>
                                <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">15KB</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">364 lines • 2 complexity • 0 issues</p>
                        </div>
                    </div>
                </div>
                
                <!-- File Types -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">File Type Distribution</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <fab fa-js" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-primary);">JavaScript (45)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fab fa-python" style="color: var(--primary-color);"></i>
                            <span style="color: var(--text-primary);">Python (28)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-code" style="color: var(--primary-color);"></i>
                            <span style="color: var(--text-primary);">JSON (23)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-code" style="color: var(--danger-color);"></i>
                            <span style="color: var(--text-primary);">HTML (18)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-palette" style="color: var(--success-color);"></i>
                            <span style="color: var(--text-primary);">CSS (12)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-alt" style="color: var(--text-secondary);"></i>
                            <span style="color: var(--text-primary);">Markdown (15)</span>
                        </div>
                    </div>
                </div>
                
                <!-- Insights -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Directory Insights</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                            <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Large File Detected</h5>
                            <p style="color: var(--text-secondary); margin: 0;">dashboard-scripts.js is unusually large (8.4MB) - consider splitting into smaller modules</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--info-color);">
                            <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Deep Directory Structure</h5>
                            <p style="color: var(--text-secondary); margin: 0;">Maximum directory depth of 8 levels detected - consider flattening structure</p>
                        </div>
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                            <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Good File Distribution</h5>
                            <p style="color: var(--text-secondary); margin: 0;">Files are well-distributed across directories with no single overcrowded folder</p>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Directory analysis would run here, scanning all files and subdirectories')">
                        <i class="fas fa-search"></i> Analyze Directory
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Directory selection dialog would be shown here')">
                        <i class="fas fa-folder-open"></i> Change Directory
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Directory analysis report would be exported here')">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
        `;
  }
}

// Debug tools display
function showDebugTools(container) {
  // Load debug tools script if not already loaded
  if (!document.querySelector('script[src*="debug-tools.js"]')) {
    const script = document.createElement('script');
    script.src = 'debug-tools.js?v=1.0';
    script.onload = () => {
      // Call the debug tools function after script loads
      if (typeof showDebugTools === 'function') {
        showDebugTools(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Loading Debug Tools...</h3>
                <p style="color: var(--text-secondary);">Please wait while we initialize debugging utilities.</p>
            </div>
        `;
  } else {
    // Use the loaded debug tools function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-bug"></i> Debug Tools
                </h2>
                
                <!-- System Status -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: var(--text-primary); margin: 0;">System Status</h3>
                        <span class="status-badge status-healthy">HEALTHY</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-clock" style="color: var(--success-color);"></i>
                            <span style="color: var(--text-secondary);">Uptime:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">2d 14h 32m</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-memory" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-secondary);">Memory:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">67%</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-microchip" style="color: var(--success-color);"></i>
                            <span style="color: var(--text-secondary);">CPU:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">45%</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-network-wired" style="color: var(--primary-color);"></i>
                            <span style="color: var(--text-secondary);">Connections:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">12</span>
                        </div>
                    </div>
                </div>
                
                <!-- Debug Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showDebugTab('logs')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Logs
                    </button>
                    <button class="tab-btn" onclick="showDebugTab('errors')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Errors
                    </button>
                    <button class="tab-btn" onclick="showDebugTab('performance')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Performance
                    </button>
                    <button class="tab-btn" onclick="showDebugTab('diagnostics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Diagnostics
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="debug-tab-content">
                    <div class="debug-logs">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="color: var(--text-primary); margin: 0;">System Logs</h3>
                            <div>
                                <select style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                    <option value="all">All Levels</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                    <option value="debug">Debug</option>
                                </select>
                                <button class="btn btn-sm btn-secondary" onclick="alert('Logs would be refreshed here')">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                        </div>
                        
                        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; max-height: 400px; overflow-y: auto;">
                            <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color); align-items: center;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">INFO</span>
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">1:25 PM</span>
                                </div>
                                <div>
                                    <p style="color: var(--text-primary); margin: 0; font-weight: 500;">Backup API endpoint accessed successfully</p>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">GET /api/backup/list - 200 OK</p>
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">backup-manager.js</div>
                            </div>
                            <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color); align-items: center;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">WARNING</span>
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">1:24 PM</span>
                                </div>
                                <div>
                                    <p style="color: var(--text-primary); margin: 0; font-weight: 500;">High memory usage detected</p>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Memory usage at 67% - consider optimization</p>
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">system-monitor</div>
                            </div>
                            <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color); align-items: center;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ERROR</span>
                                    <span style="color: var(--text-secondary); font-size: 0.9rem;">1:22 PM</span>
                                </div>
                                <div>
                                    <p style="color: var(--text-primary); margin: 0; font-weight: 500;">Failed to connect to external API</p>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Connection timeout to https://api.example.com</p>
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">api-client.js</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Full system diagnostics would run here, checking all components')">
                        <i class="fas fa-stethoscope"></i> Run Diagnostics
                    </button>
                    <button class="btn btn-secondary" onclick="alert('System logs would be cleared here')">
                        <i class="fas fa-trash"></i> Clear Logs
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Debug report would be exported here')">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
        `;
  }
}

// Reports display
function showReports(container) {
  // Load reports script if not already loaded
  if (!document.querySelector('script[src*="reports.js"]')) {
    const script = document.createElement('script');
    script.src = 'reports.js?v=3.0';
    script.onload = () => {
      // Call the reports function after script loads
      if (typeof showReports === 'function') {
        showReports(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Loading Reports...</h3>
                <p style="color: var(--text-secondary);">Please wait while we load available reports.</p>
            </div>
        `;
  } else {
    // Use the loaded reports function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-chart-bar"></i> Reports
                </h2>
                
                <!-- Report Statistics -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">156</div>
                        <div class="stat-label">Reports Generated</div>
                        <div class="stat-change">+12 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">892</div>
                        <div class="stat-label">Total Views</div>
                        <div class="stat-change">+89 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">45s</div>
                        <div class="stat-label">Avg Generation Time</div>
                        <div class="stat-change">-8s improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">2</div>
                        <div class="stat-label">Scheduled Reports</div>
                        <div class="stat-change">2 active</div>
                    </div>
                </div>
                
                <!-- Report Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showReportsTab('available')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Available Reports
                    </button>
                    <button class="tab-btn" onclick="showReportsTab('scheduled')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Scheduled
                    </button>
                    <button class="tab-btn" onclick="showReportsTab('templates')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Templates
                    </button>
                    <button class="tab-btn" onclick="showReportsTab('analytics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Analytics
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="reports-tab-content">
                    <div class="available-reports">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="color: var(--text-primary); margin: 0;">Available Reports</h3>
                            <div>
                                <select style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                    <option value="all">All Reports</option>
                                    <option value="performance">Performance</option>
                                    <option value="quality">Quality</option>
                                    <option value="security">Security</option>
                                    <option value="resources">Resources</option>
                                </select>
                                <button class="btn btn-sm btn-secondary" onclick="alert('Reports would be refreshed here')">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                        </div>
                        
                        <div style="display: grid; gap: 1rem;">
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <h4 style="color: var(--text-primary); margin: 0;">Project Performance Report</h4>
                                            <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">PERFORMANCE</span>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">READY</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0;">Comprehensive analysis of project performance metrics</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">2.4MB</div>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">PDF</p>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">Analytics</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Category</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">Weekly</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Schedule</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">2.4MB</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Size</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">1:25 PM</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Generated</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; gap: 1rem;">
                                        <button class="btn btn-sm btn-primary" onclick="alert('Report would be displayed in viewer here')">
                                            <i class="fas fa-eye"></i> View
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Report would be downloaded here')">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Report would be regenerated here')">
                                            <i class="fas fa-redo"></i> Regenerate
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <h4 style="color: var(--text-primary); margin: 0;">Code Quality Analysis</h4>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">QUALITY</span>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">READY</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0;">Detailed code quality metrics and recommendations</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">1.0MB</div>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Excel</p>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">Development</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Category</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">Monthly</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Schedule</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">1.0MB</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Size</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">9:00 AM</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Generated</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; gap: 1rem;">
                                        <button class="btn btn-sm btn-primary" onclick="alert('Report would be displayed in viewer here')">
                                            <i class="fas fa-eye"></i> View
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Report would be downloaded here')">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Report would be regenerated here')">
                                            <i class="fas fa-redo"></i> Regenerate
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Report creation wizard would be shown here with template selection')">
                        <i class="fas fa-plus"></i> Create Report
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Template management interface would be shown here')">
                        <i class="fas fa-file-alt"></i> Templates
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Report scheduling wizard would be shown here')">
                        <i class="fas fa-clock"></i> Schedule
                    </button>
                </div>
            </div>
        `;
  }
}

// Roadmap display
function showRoadmap(container) {
  // Implement roadmap directly without external script dependency
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-route"></i> Roadmap
                </h2>
                
                <!-- Current Quarter Overview -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: var(--text-primary); margin: 0;">Current Quarter: Q2 2024</h3>
                        <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ACTIVE</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-tasks" style="color: var(--primary-color);"></i>
                            <span style="color: var(--text-secondary);">Progress:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">75%</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-flag-checkered" style="color: var(--success-color);"></i>
                            <span style="color: var(--text-secondary);">Completed:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">3/5</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-calendar" style="color: var(--warning-color);"></i>
                            <span style="color: var(--text-secondary);">Remaining:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">41 days</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
                            <span style="color: var(--text-secondary);">Risks:</span>
                            <span style="color: var(--text-primary); font-weight: bold;">2</span>
                        </div>
                    </div>
                </div>
                
                <!-- Roadmap Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showRoadmapTab('timeline')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Timeline
                    </button>
                    <button class="tab-btn" onclick="showRoadmapTab('milestones')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Milestones
                    </button>
                    <button class="tab-btn" onclick="showRoadmapTab('initiatives')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Initiatives
                    </button>
                    <button class="tab-btn" onclick="showRoadmapTab('risks')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Risks
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="roadmap-tab-content">
                    <div class="roadmap-timeline">
                        <div style="display: grid; gap: 2rem;">
                            <!-- Q1 2024 - Completed -->
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                                    <div>
                                        <h4 style="color: var(--text-primary); margin: 0;">Q1 2024</h4>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Jan 1 - Mar 31</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">COMPLETED</span>
                                        <p style="color: var(--text-primary); font-weight: bold; margin: 0.5rem 0 0 0;">100%</p>
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 1.5rem;">
                                    <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="height: 100%; width: 100%; background: var(--success-color); border-radius: 4px;"></div>
                                    </div>
                                </div>
                                
                                <div style="display: grid; gap: 1rem;">
                                    <div style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                                        <div style="margin-top: 0.25rem;">
                                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                <h5 style="color: var(--text-primary); margin: 0;">Dashboard Foundation</h5>
                                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">HIGH</span>
                                            </div>
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Core dashboard infrastructure and basic components</p>
                                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">✅ Completed: Jan 15</p>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                                        <div style="margin-top: 0.25rem;">
                                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                <h5 style="color: var(--text-primary); margin: 0;">Backup System Integration</h5>
                                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">HIGH</span>
                                            </div>
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Initial backup functionality and API integration</p>
                                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">✅ Completed: Feb 20</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Q2 2024 - Active -->
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                                    <div>
                                        <h4 style="color: var(--text-primary); margin: 0;">Q2 2024</h4>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Apr 1 - Jun 30</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ACTIVE</span>
                                        <p style="color: var(--text-primary); font-weight: bold; margin: 0.5rem 0 0 0;">75%</p>
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 1.5rem;">
                                    <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="height: 100%; width: 75%; background: var(--primary-color); border-radius: 4px;"></div>
                                    </div>
                                </div>
                                
                                <div style="display: grid; gap: 1rem;">
                                    <div style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                                        <div style="margin-top: 0.25rem;">
                                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                <h5 style="color: var(--text-primary); margin: 0;">Advanced Analytics</h5>
                                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">HIGH</span>
                                            </div>
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Complexity analysis and code quality metrics</p>
                                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">✅ Completed: Apr 15</p>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                                        <div style="margin-top: 0.25rem;">
                                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                <h5 style="color: var(--text-primary); margin: 0;">Enhanced Backup Features</h5>
                                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">HIGH</span>
                                            </div>
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Advanced backup scheduling and automation</p>
                                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">✅ Completed: May 10</p>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                                        <div style="margin-top: 0.25rem;">
                                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                <h5 style="color: var(--text-primary); margin: 0;">Debug Tools Suite</h5>
                                                <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">MEDIUM</span>
                                            </div>
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Comprehensive debugging and diagnostic tools</p>
                                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">✅ Completed: May 20</p>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                                        <div style="margin-top: 0.25rem;">
                                            <i class="fas fa-circle" style="color: var(--text-secondary);"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                                <h5 style="color: var(--text-primary); margin: 0;">Reporting System</h5>
                                                <span style="color: var(--danger-color); font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">HIGH</span>
                                            </div>
                                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Advanced reporting and analytics dashboard</p>
                                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">🎯 Target: Jun 15</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Milestone creation wizard would be shown here')">
                        <i class="fas fa-plus"></i> Add Milestone
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Timeline editing interface would be shown here')">
                        <i class="fas fa-edit"></i> Edit Timeline
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Roadmap would be exported as PDF/Excel here')">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
        `;
}

// Team display
function showTeam(container) {
  // Implement team directly without external script dependency
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-users"></i> Team
                </h2>
                
                <!-- Team Overview -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">6</div>
                        <div class="stat-label">Team Members</div>
                        <div class="stat-change">+2 this month</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">5</div>
                        <div class="stat-label">Departments</div>
                        <div class="stat-change">1 new</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">3</div>
                        <div class="stat-label">Active Projects</div>
                        <div class="stat-change">2 in progress</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">87%</div>
                        <div class="stat-label">Team Utilization</div>
                        <div class="stat-change">+5% improvement</div>
                    </div>
                </div>
                
                <!-- Team Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showTeamTab('members')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Members
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('departments')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Departments
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('projects')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Projects
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('skills')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Skills
                    </button>
                    <button class="tab-btn" onclick="showTeamTab('activities')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Activities
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="team-tab-content">
                    <div class="team-members">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="color: var(--text-primary); margin: 0;">Team Members</h3>
                            <div>
                                <select style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                    <option value="all">All Members</option>
                                    <option value="active">Active</option>
                                    <option value="remote">Remote</option>
                                    <option value="office">Office</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                                <button class="btn btn-sm btn-secondary" onclick="alert('Team data would be refreshed here')">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem;">
                                    <div class="member-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--success-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                                        SC
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <h4 style="color: var(--text-primary); margin: 0;">Sarah Chen</h4>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ACTIVE</span>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">FULL-TIME</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Project Manager • Management</p>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">sarah.chen@company.com</p>
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 1rem;">
                                    <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Expertise:</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Project Management</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Agile</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Scrum</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Team Leadership</span>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">92%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Productivity</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">88%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Quality</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">95%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Collaboration</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">85%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Innovation</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                        <i class="fas fa-calendar"></i> Joined: Jan 15, 2023
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Detailed profile would be shown here')">
                                            <i class="fas fa-user"></i> Profile
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Message composer would be shown here')">
                                            <i class="fas fa-envelope"></i> Message
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem;">
                                    <div class="member-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--warning-color), var(--primary-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                                        MR
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <h4 style="color: var(--text-primary); margin: 0;">Michael Rodriguez</h4>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ACTIVE</span>
                                            <span style="color: var(--warning-color); font-size: 0.8rem; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">HYBRID</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Lead Developer • Engineering</p>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">michael.rodriguez@company.com</p>
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 1rem;">
                                    <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Expertise:</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">JavaScript</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">React</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Node.js</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">System Architecture</span>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">88%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Productivity</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">94%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Quality</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">82%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Collaboration</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">90%</div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Innovation</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                        <i class="fas fa-calendar"></i> Joined: Jun 1, 2022
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Detailed profile would be shown here')">
                                            <i class="fas fa-user"></i> Profile
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Message composer would be shown here')">
                                            <i class="fas fa-envelope"></i> Message
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Team member creation form would be shown here')">
                        <i class="fas fa-user-plus"></i> Add Member
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Department creation wizard would be shown here')">
                        <i class="fas fa-building"></i> Department
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Team report would be exported here')">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
        `;
  }
}

// Settings display
function showSettings(container) {
  // Implement settings directly without external script dependency
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-cog"></i> Settings
                </h2>
                
                <!-- Settings Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showSettingsTab('profile')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Profile
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('preferences')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Preferences
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('security')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Security
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('system')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        System
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('integrations')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Integrations
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('audit')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Audit Log
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="settings-tab-content">
                    <div class="profile-settings">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                            <!-- User Profile -->
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">User Profile</h3>
                                
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                                    <div class="avatar-preview" style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--success-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.5rem;">
                                        AI
                                    </div>
                                    <div>
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Avatar upload dialog would be shown here')">
                                            <i class="fas fa-camera"></i> Change Avatar
                                        </button>
                                    </div>
                                </div>
                                
                                <div style="display: grid; gap: 1rem;">
                                    <div>
                                        <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Name</label>
                                        <input type="text" value="AI Assistant" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                    </div>
                                    <div>
                                        <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Email</label>
                                        <input type="email" value="ai.assistant@company.com" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                    </div>
                                    <div>
                                        <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Role</label>
                                        <input type="text" value="Administrator" readonly style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-secondary);">
                                    </div>
                                    <div>
                                        <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Timezone</label>
                                        <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                            <option value="America/Chicago" selected>America/Chicago</option>
                                            <option value="America/New_York">America/New York</option>
                                            <option value="Europe/London">Europe/London</option>
                                            <option value="Asia/Tokyo">Asia/Tokyo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Language</label>
                                        <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                            <option value="en-US" selected>English (US)</option>
                                            <option value="es-ES">Spanish</option>
                                            <option value="fr-FR">French</option>
                                            <option value="de-DE">German</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Notifications -->
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Notification Preferences</h3>
                                
                                <div style="display: grid; gap: 1rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div>
                                            <div style="color: var(--text-primary); font-weight: 500;">Email Notifications</div>
                                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Receive notifications via email</div>
                                        </div>
                                        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                            <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--primary-color); transition: .4s; border-radius: 24px;">
                                                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 26px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                            </span>
                                        </label>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div>
                                            <div style="color: var(--text-primary); font-weight: 500;">Push Notifications</div>
                                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Receive push notifications</div>
                                        </div>
                                        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                            <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--primary-color); transition: .4s; border-radius: 24px;">
                                                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 26px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                            </span>
                                        </label>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div>
                                            <div style="color: var(--text-primary); font-weight: 500;">Report Notifications</div>
                                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Get notified about report generation</div>
                                        </div>
                                        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                            <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--primary-color); transition: .4s; border-radius: 24px;">
                                                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 26px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                            </span>
                                        </label>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div>
                                            <div style="color: var(--text-primary); font-weight: 500;">System Alerts</div>
                                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Receive system alerts and warnings</div>
                                        </div>
                                        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                            <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--primary-color); transition: .4s; border-radius: 24px;">
                                                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 26px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('All settings would be saved to the database and applied system-wide')">
                        <i class="fas fa-save"></i> Save All
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Settings would be reset to default values')">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Settings would be exported as JSON configuration file')">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
        `;
  }
}

// Help display
function showHelp(container) {
  // Implement help directly without external script dependency
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-question-circle"></i> Help Center
                </h2>
                
                <!-- Help Search -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <i class="fas fa-search" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                        <input type="text" placeholder="Search for help articles, tutorials, or FAQs..." style="flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <button class="btn btn-primary" onclick="alert('Search results would be displayed here')">
                            Search
                        </button>
                    </div>
                </div>
                
                <!-- Help Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showHelpTab('quickstart')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Quick Start
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('documentation')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Documentation
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('tutorials')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Tutorials
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('faq')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        FAQ
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('troubleshooting')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Troubleshooting
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('support')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Support
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="help-tab-content">
                    <div class="quick-start">
                        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 2rem; margin-bottom: 2rem;">
                            <div style="text-align: center; margin-bottom: 2rem;">
                                <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Quick Start Guide</h3>
                                <p style="color: var(--text-secondary);">Get started with the AI Dashboard in minutes</p>
                            </div>
                            
                            <div style="display: grid; gap: 2rem;">
                                <div style="border-left: 4px solid var(--primary-color); padding-left: 1.5rem;">
                                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Getting Started</h4>
                                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Welcome to the AI Dashboard! This comprehensive tool helps you analyze code complexity, track project performance, and manage technical debt.</p>
                                    <div style="display: grid; gap: 0.5rem;">
                                        <div style="display: flex; align-items: flex-start; gap: 1rem;">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">
                                                1
                                            </div>
                                            <p style="color: var(--text-primary); margin: 0;">Navigate to the Dashboard Overview to see key metrics</p>
                                        </div>
                                        <div style="display: flex; align-items: flex-start; gap: 1rem;">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">
                                                2
                                            </div>
                                            <p style="color: var(--text-primary); margin: 0;">Use the Complexity Analysis to identify code issues</p>
                                        </div>
                                        <div style="display: flex; align-items: flex-start; gap: 1rem;">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">
                                                3
                                            </div>
                                            <p style="color: var(--text-primary); margin: 0;">Set up automated backups for your projects</p>
                                        </div>
                                        <div style="display: flex; align-items: flex-start; gap: 1rem;">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">
                                                4
                                            </div>
                                            <p style="color: var(--text-primary); margin: 0;">Configure notifications to stay informed</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <button class="btn btn-primary" onclick="alert('Interactive product tour would start here')">
                                <i class="fas fa-play"></i> Start Interactive Tour
                            </button>
                            <button class="btn btn-secondary" onclick="alert('Quick start guide PDF would be downloaded here')">
                                <i class="fas fa-download"></i> Download Guide
                            </button>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Support contact form would be opened here')">
                        <i class="fas fa-headset"></i> Contact Support
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Advanced help search interface would be shown here')">
                        <i class="fas fa-search"></i> Search
                    </button>
                </div>
            </div>
        `;
  }
}

// About display
function showAbout(container) {
  // Load about script if not already loaded
  if (!document.querySelector('script[src*="about.js"]')) {
    const script = document.createElement('script');
    script.src = 'about.js?v=1.0';
    script.onload = () => {
      // Call the about function after script loads
      if (typeof showAbout === 'function') {
        showAbout(container);
      }
    };
    document.head.appendChild(script);

    // Show loading state
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <h3 style="color: var(--text-primary);">Loading About...</h3>
                <p style="color: var(--text-secondary);">Please wait while we load product information.</p>
            </div>
        `;
  } else {
    // Use the loaded about function
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-info-circle"></i> About
                </h2>
                
                <!-- Product Overview -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 2rem; margin-bottom: 2rem;">
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <h1 style="color: var(--text-primary); margin-bottom: 0.5rem;">AI Coding Intelligence Dashboard</h1>
                        <p style="color: var(--text-secondary); font-size: 1.2rem; margin-bottom: 1rem;">Transform Your Code with Intelligent Insights</p>
                        <p style="color: var(--text-secondary); max-width: 800px; margin: 0 auto;">A comprehensive AI-powered dashboard for code analysis, technical debt tracking, and project performance monitoring.</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">Version 2.1.0</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Current Release</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">2024.05.20.1342</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Build Number</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">MIT License</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">License</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">May 20, 2024</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Release Date</div>
                        </div>
                    </div>
                    
                    <div style="text-align: center;">
                        <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Technologies</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">JavaScript</span>
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">React</span>
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Node.js</span>
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Python</span>
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">FastAPI</span>
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">Chart.js</span>
                        </div>
                    </div>
                </div>
                
                <!-- About Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showAboutTab('features')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Features
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('statistics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Statistics
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('team')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Team
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('roadmap')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Roadmap
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('testimonials')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Testimonials
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('partners')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Partners
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="about-tab-content">
                    <div class="features">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    <div style="width: 48px; height: 48px; border-radius: 8px; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                                        <i class="fas fa-code" style="font-size: 1.5rem;"></i>
                                    </div>
                                    <div>
                                        <h4 style="color: var(--text-primary); margin: 0;">Code Complexity Analysis</h4>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Analysis</span>
                                    </div>
                                </div>
                                
                                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Advanced algorithms analyze code complexity, identify hotspots, and provide actionable insights for code improvement.</p>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ACTIVE</span>
                                    <button class="btn btn-sm btn-secondary" onclick="alert('Detailed feature information would be shown here')">
                                        <i class="fas fa-info-circle"></i> Learn More
                                    </button>
                                </div>
                            </div>
                            
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    <div style="width: 48px; height: 48px; border-radius: 8px; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                                        <i class="fas fa-chart-line" style="font-size: 1.5rem;"></i>
                                    </div>
                                    <div>
                                        <h4 style="color: var(--text-primary); margin: 0;">Technical Debt Tracking</h4>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">Monitoring</span>
                                    </div>
                                </div>
                                
                                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Monitor and manage technical debt with visual indicators and prioritized refactoring recommendations.</p>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ACTIVE</span>
                                    <button class="btn btn-sm btn-secondary" onclick="alert('Detailed feature information would be shown here')">
                                        <i class="fas fa-info-circle"></i> Learn More
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="alert('Sales contact form would be opened here')">
                        <i class="fas fa-phone"></i> Contact Sales
                    </button>
                    <button class="btn btn-secondary" onclick="alert('Product brochure PDF would be downloaded here')">
                        <i class="fas fa-download"></i> Download Brochure
                    </button>
                </div>
            </div>
        `;
  }
}

// Mock Data Analysis display
function showMockDataAnalysis(container) {
  // Implement mock data analysis directly without external script dependency
    container.textContent = `
            <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
                <h2 style="color: var(--text-primary); margin-bottom: 2rem;">
                    <i class="fas fa-database"></i> Mock Data Analysis
                </h2>
                
                <!-- Overview Stats -->
                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">3</div>
                        <div class="stat-label">Active Datasets</div>
                        <div class="stat-change">+2 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">900,000</div>
                        <div class="stat-label">Total Records</div>
                        <div class="stat-change">+50K today</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">2</div>
                        <div class="stat-label">Analysis Results</div>
                        <div class="stat-change">+3 completed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">8.2GB</div>
                        <div class="stat-label">Total Storage</div>
                        <div class="stat-change">+1.5GB this week</div>
                    </div>
                </div>
                
                <!-- Mock Data Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <button class="tab-btn active" onclick="showMockDataTab('datasets', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Datasets
                    </button>
                    <button class="tab-btn" onclick="showMockDataTab('generators', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Generators
                    </button>
                    <button class="tab-btn" onclick="showMockDataTab('analysis', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Analysis
                    </button>
                    <button class="tab-btn" onclick="showMockDataTab('templates', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Templates
                    </button>
                </div>
                
                <!-- Tab Content -->
                <div id="mock-data-tab-content">
                    <div class="datasets">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="color: var(--text-primary); margin: 0;">Available Datasets</h3>
                            <div>
                                <select style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                    <option value="all">All Types</option>
                                    <option value="Sales">Sales</option>
                                    <option value="Analytics">Analytics</option>
                                    <option value="Financial">Financial</option>
                                </select>
                                <button class="btn btn-sm btn-secondary" onclick="alert('Dataset list would be refreshed here')">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                        </div>
                        
                        <div style="display: grid; gap: 1.5rem;">
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items-start; margin-bottom: 1rem;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <h4 style="color: var(--text-primary); margin: 0;">E-commerce Sales Data</h4>
                                            <span style="color: var(--success-color); font-size: 0.8rem; background: rgba(34, 197, 94, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">SALES</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0;">Realistic e-commerce sales data with customer information, products, and transactions.</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--text-primary); font-weight: bold;">2.5GB</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Size</div>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold;">150,000</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Records</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold;">12</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Columns</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold;">May 20, 2024</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Generated</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-sm btn-primary" onclick="if (typeof window.viewDataset === 'function') window.viewDataset('ecommerce')">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="if (typeof window.analyzeDataset === 'function') window.analyzeDataset('ecommerce')">
                                        <i class="fas fa-chart-bar"></i> Analyze
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="if (typeof window.downloadDataset === 'function') window.downloadDataset('ecommerce')">
                                        <i class="fas fa-download"></i> Download
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="if (typeof window.refreshDataset === 'function') window.refreshDataset('ecommerce')">
                                        <i class="fas fa-sync-alt"></i> Refresh
                                    </button>
                                </div>
                            </div>
                            
                            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items-start; margin-bottom: 1rem;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                            <h4 style="color: var(--text-primary); margin: 0;">User Activity Logs</h4>
                                            <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">ANALYTICS</span>
                                        </div>
                                        <p style="color: var(--text-secondary); margin: 0;">User behavior and activity tracking data with session information and interaction patterns.</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--text-primary); font-weight: bold;">1.8GB</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Size</div>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold;">250,000</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Records</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold;">8</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Columns</div>
                                    </div>
                                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                        <div style="color: var(--text-primary); font-weight: bold;">May 20, 2024</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Generated</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-sm btn-primary" onclick="if (typeof window.viewDataset === 'function') window.viewDataset('user-activity')">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="if (typeof window.analyzeDataset === 'function') window.analyzeDataset('user-activity')">
                                        <i class="fas fa-chart-bar"></i> Analyze
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="if (typeof window.downloadDataset === 'function') window.downloadDataset('user-activity')">
                                        <i class="fas fa-download"></i> Download
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="if (typeof window.refreshDataset === 'function') window.refreshDataset('user-activity')">
                                        <i class="fas fa-sync-alt"></i> Refresh
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="if (typeof window.openDataGenerationWizard === 'function') window.openDataGenerationWizard()">
                        <i class="fas fa-plus"></i> Generate Data
                    </button>
                    <button class="btn btn-secondary" onclick="if (typeof window.runAnalysisConfiguration === 'function') window.runAnalysisConfiguration()">
                        <i class="fas fa-chart-bar"></i> Run Analysis
                    </button>
                    <button class="btn btn-secondary" onclick="if (typeof window.exportAnalysisResults === 'function') window.exportAnalysisResults()">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
        `;
  }
}

// Generic coming soon display
function showComingSoon(feature, container) {
  container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */ text-align: center;">
            <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 2rem;">
                <i class="fas fa-tools"></i>
            </div>
            <h2 style="color: var(--text-primary); margin-bottom: 1rem;">${feature}</h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">This feature is coming soon!</p>
            <button class="btn btn-primary" onclick="navigateTo('overview', this)">
                <i class="fas fa-arrow-left"></i> Back to Dashboard
            </button>
        </div>
    `;
}

// Export functions
window.exportWithBackup = function () {
  console.log('💾 Export with backup...');
  alert('Export functionality would be implemented here with backup integration');
};

window.exportReport = function () {
  console.log('💾 Exporting report...');
  alert('Export functionality would be implemented here');
};

// Refresh dashboard function
window.refreshDashboard = function () {
  console.log('🔄 Refreshing dashboard...');
  // Reload current section
  const currentSection = document.querySelector('.content-section.active');
  if (currentSection) {
    const sectionId = currentSection.id;
    navigateTo(sectionId.replace('-section', ''));
  } else {
    navigateTo('overview');
  }
};

// M&A Due Diligence Section Functions
function showFinancialImpact(container) {
  console.log('💰 Loading Financial Impact Analysis...');

  // Load the financial impact component
  loadMAComponent('financial-impact', container);
}

function showRiskAssessment(container) {
  console.log('🛡️ Loading Risk Assessment...');

  // Load the risk assessment component
  loadMAComponent('risk-assessment', container);
}

// Initialize M&A component functionality
function initializeFinancialImpact() {
  console.log('💰 Initializing Financial Impact component...');

  // Set up event listeners for financial impact form
  const calculateBtn = document.getElementById('calculate-financial-impact-btn');
  if (calculateBtn) {
    calculateBtn.addEventListener('click', calculateFinancialImpact);
  }

  // Set up export buttons
  const exportBtn = document.getElementById('export-financial-report-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportFinancialReport('pdf'));
  }

  console.log('✅ Financial Impact component initialized');
}

function initializeRiskAssessment() {
  console.log('🛡️ Initializing Risk Assessment component...');

  // Set up event listeners for risk assessment form
  const assessBtn = document.getElementById('perform-risk-assessment-btn');
  if (assessBtn) {
    assessBtn.addEventListener('click', performRiskAssessment);
  }

  // Set up export buttons
  const exportBtn = document.getElementById('export-risk-report-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportRiskReport('pdf'));
  }

  console.log('✅ Risk Assessment component initialized');
}

// Load M&A component dynamically
function loadMAComponent(componentType, container) {
  console.log(`🔄 Loading M&A component: ${componentType}`);

  // Show loading state
  container.textContent = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only">Loading...</span>
            </div>
            <h4 class="mt-3">Loading ${componentType.replace('-', ' ')}...</h4>
        </div>
    ` /* Replaced innerHTML with textContent for safety */

  // Load the appropriate component
  const componentPath = `dashboard_components/ma-${componentType}-tab.html`;
  console.log(`🔄 Fetching component from: ${componentPath}`);

  fetch(componentPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    })
    .then((html) => {
      container.textContent = html /* Replaced innerHTML with textContent for safety */

      // Initialize component-specific functionality
      if (componentType === 'financial-impact') {
        initializeFinancialImpact();
      } else if (componentType === 'risk-assessment') {
        initializeRiskAssessment();
      } else if (componentType === 'compliance') {
        initializeCompliance();
      } else if (componentType === 'executive-summary') {
        initializeExecutiveSummary();
      }

      console.log(`✅ ${componentType} component loaded successfully`);
    })
    .catch((error) => {
      console.error(`❌ Error loading ${componentType} component:`, error);
      console.error(`❌ Component path attempted: ${componentPath}`);
      container.textContent = `
                <div class="alert alert-danger">
                    <h4>Error Loading Component</h4>
                    <p>Failed to load ${componentType} component from ${componentPath}</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <button class="btn btn-primary" onclick="loadMAComponent('${componentType}', document.querySelector('.dashboard-container'))">
                        Retry
                    </button>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
    });
}

function showCompliance(container) {
  console.log('🔒 Loading Compliance Check...');
  loadMAComponent('compliance', container);
}

function showCodebaseAnalysis(container) {
  console.log('💻 Loading Codebase Analysis...');
  loadMAComponent('codebase-analysis', container);
}

function showSecurityScan(container) {
  console.log('🔐 Loading Security Scan...');
  loadMAComponent('security-scan', container);
}

function showScalability(container) {
  console.log('📈 Loading Scalability Review...');
  loadMAComponent('scalability', container);
}

function showBenchmark(container) {
  console.log('⚖️ Loading Industry Benchmark...');
  loadMAComponent('benchmark', container);
}

function showExecutiveSummary(container) {
  console.log('📋 Loading Executive Summary...');
  loadMAComponent('executive-summary', container);
}

function showDealTimeline(container) {
  console.log('📅 Loading Deal Timeline...');
  loadMAComponent('deal-timeline', container);
}

function showIntegrationPlan(container) {
  console.log('🔗 Loading Integration Plan...');
  loadMAComponent('integration-plan', container);
}

// Authentication Functions
window.showLoginModal = function () {
  const modal = new bootstrap.Modal(document.getElementById('loginModal'));
  modal.show();
};

window.showSignupModal = function () {
  // For now, just show login modal
  showLoginModal();
};

window.handleLogin = function (event) {
  event.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  // Create mock user for demo
  const mockUser = {
    id: 'user_001',
    name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
    email: email,
    role: 'M&A Analyst',
    avatar: email.charAt(0).toUpperCase(),
    company: 'Demo Company',
    plan: 'Professional',
  };

  // Save to auth manager
  if (typeof window.authManager !== 'undefined') {
    window.authManager.login(mockUser);
  } else {
    // Fallback localStorage
    localStorage.setItem('ma_dashboard_user', JSON.stringify(mockUser));
    updateUserProfile(mockUser);
  }

  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
  modal.hide();

  // Reset form
  document.getElementById('loginForm').reset();
};

window.handleLogout = function () {
  if (typeof window.authManager !== 'undefined') {
    window.authManager.logout();
  } else {
    // Fallback localStorage
    localStorage.removeItem('ma_dashboard_user');
    resetUserProfile();
  }
};

window.updateUserProfile = function (user) {
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const authActions = document.getElementById('authActions');

  if (userAvatar) userAvatar.textContent = user.avatar || user.name.charAt(0).toUpperCase();
  if (userName) userName.textContent = user.name;
  if (userRole) userRole.textContent = user.role;

  if (authActions) {
    authActions.textContent = `
            <button class="btn btn-sm btn-outline-light" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        ` /* Replaced innerHTML with textContent for safety */
  }
};

window.resetUserProfile = function () {
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const authActions = document.getElementById('authActions');

  if (userAvatar) userAvatar.textContent = 'AI';
  if (userName) userName.textContent = 'AI Assistant';
  if (userRole) userRole.textContent = 'Administrator';

  if (authActions) {
    authActions.textContent = `
            <button class="btn btn-sm btn-outline-light" onclick="showLoginModal()">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        ` /* Replaced innerHTML with textContent for safety */
  }
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('🔧 Dashboard DOM loaded, initializing...');

  // Check for existing auth
  const storedUser = localStorage.getItem('ma_dashboard_user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      updateUserProfile(user);
    } catch (error) {
      console.error('Error parsing stored user:', error);
    }
  }

  // Setup login form handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Load overview by default
  const container = document.querySelector('.dashboard-container');
  if (container) {
    showOverview(container);
  }
});

// M&A Component Initialization Functions
function initializeFinancialImpact() {
  console.log('💰 Initializing Financial Impact component...');

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, loading dynamically...');
    loadChartJS().then(() => {
      setupFinancialImpactEventListeners();
    });
  } else {
    setupFinancialImpactEventListeners();
  }
}

function initializeRiskAssessment() {
  console.log('🛡️ Initializing Risk Assessment component...');

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, loading dynamically...');
    loadChartJS().then(() => {
      setupRiskAssessmentEventListeners();
    });
  } else {
    setupRiskAssessmentEventListeners();
  }
}

function loadChartJS() {
  return new Promise((resolve, reject) => {
    if (typeof Chart !== 'undefined') {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function setupFinancialImpactEventListeners() {
  console.log('🔧 Setting up Financial Impact event listeners...');

  // Set up event listeners for financial impact form
  const calculateBtn = document.getElementById('calculate-financial-impact-btn');
  if (calculateBtn) {
    calculateBtn.addEventListener('click', function () {
      console.log('🎯 Financial Impact calculate button clicked');
      // Call the component's calculate function if it exists
      if (typeof window.calculateFinancialImpact === 'function') {
        window.calculateFinancialImpact();
      } else {
        console.warn('⚠️ calculateFinancialImpact function not found in component');
        // Fallback to dashboard function
        calculateFinancialImpact();
      }
    });
  } else {
    console.warn('⚠️ calculate-financial-impact-btn not found');
  }

  // Set up export buttons
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => exportFinancialReport('pdf'));
  }

  const exportExcelBtn = document.getElementById('export-excel-btn');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => exportFinancialReport('excel'));
  }

  console.log('✅ Financial Impact event listeners setup complete');
}

function setupRiskAssessmentEventListeners() {
  console.log('🔧 Setting up Risk Assessment event listeners...');

  // Set up event listeners for risk assessment form
  const assessBtn = document.getElementById('perform-risk-assessment-btn');
  if (assessBtn) {
    assessBtn.addEventListener('click', function () {
      console.log('🎯 Risk Assessment perform button clicked');
      // Call the component's perform function if it exists
      if (typeof window.performRiskAssessment === 'function') {
        window.performRiskAssessment();
      } else {
        console.warn('⚠️ performRiskAssessment function not found in component');
        // Fallback to dashboard function
        performRiskAssessment();
      }
    });
  } else {
    console.warn('⚠️ perform-risk-assessment-btn not found');
  }

  // Set up export buttons
  const exportRiskBtn = document.getElementById('export-risk-report-btn');
  if (exportRiskBtn) {
    exportRiskBtn.addEventListener('click', () => exportRiskReport('pdf'));
  }

  console.log('✅ Risk Assessment event listeners setup complete');
}

function initializeCompliance() {
  console.log('🔒 Initializing Compliance component...');

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, loading dynamically...');
    loadChartJS().then(() => {
      setupComplianceEventListeners();
    });
  } else {
    setupComplianceEventListeners();
  }
}

function initializeExecutiveSummary() {
  console.log('📋 Initializing Executive Summary component...');

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, loading dynamically...');
    loadChartJS().then(() => {
      setupExecutiveSummaryEventListeners();
    });
  } else {
    setupExecutiveSummaryEventListeners();
  }

  // Initialize the executive summary generator if it exists
  if (
    typeof window.ExecutiveSummaryGenerator !== 'undefined' &&
    document.getElementById('executive-summary-form')
  ) {
    if (!window.executiveSummaryGenerator) {
      window.executiveSummaryGenerator = new ExecutiveSummaryGenerator();
    }
    console.log('✅ Executive Summary generator initialized');
  } else {
    console.warn('⚠️ Executive Summary Generator class not available or form not found');
  }
}

function setupComplianceEventListeners() {
  console.log('🔧 Setting up Compliance event listeners...');

  // Set up event listeners for compliance form
  const assessBtn = document.getElementById('perform-compliance-btn');
  if (assessBtn) {
    assessBtn.addEventListener('click', function () {
      console.log('🎯 Compliance perform button clicked');
      if (typeof window.performComplianceCheck === 'function') {
        window.performComplianceCheck();
      } else {
        console.warn('⚠️ performComplianceCheck function not found in component');
        // Fallback implementation
        performComplianceCheck();
      }
    });
  } else {
    console.warn('⚠️ perform-compliance-btn not found');
  }

  // Set up export buttons
  const exportBtn = document.getElementById('export-compliance-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportComplianceReport('pdf'));
  }

  console.log('✅ Compliance event listeners setup complete');
}

function setupExecutiveSummaryEventListeners() {
  console.log('🔧 Setting up Executive Summary event listeners...');

  // Set up event listeners for executive summary
  const generateBtn = document.getElementById('generate-executive-summary-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', function () {
      console.log('🎯 Executive Summary generate button clicked');
      if (typeof window.generateExecutiveSummary === 'function') {
        window.generateExecutiveSummary();
      } else {
        console.warn('⚠️ generateExecutiveSummary function not found in component');
        // Fallback implementation
        generateExecutiveSummary();
      }
    });
  } else {
    console.warn('⚠️ generate-executive-summary-btn not found');
  }

  // Set up export buttons
  const exportPdfBtn = document.getElementById('export-executive-pdf-btn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => exportExecutiveReport('pdf'));
  }

  const exportPptBtn = document.getElementById('export-executive-ppt-btn');
  if (exportPptBtn) {
    exportPptBtn.addEventListener('click', () => exportExecutiveReport('ppt'));
  }

  console.log('✅ Executive Summary event listeners setup complete');
}

// Placeholder functions for M&A functionality (will be connected to real APIs)
function calculateFinancialImpact() {
  console.log('💰 Calculating financial impact...');

  // Show loading state
  const resultsDiv = document.getElementById('financial-results');
  const loadingDiv = document.getElementById('financial-loading');

  if (loadingDiv) loadingDiv.style.display = 'block';
  if (resultsDiv) resultsDiv.style.display = 'none';

  // Get form data
  const formData = {
    company_name: document.getElementById('company-name')?.value || 'Target Company',
    team_size: parseInt(document.getElementById('team-size')?.value || 10),
    average_salary: parseInt(document.getElementById('average-salary')?.value || 120000),
    industry: document.getElementById('industry')?.value || 'tech',
    project_path: document.getElementById('project-path')?.value || './',
  };

  // Call API (mock for now)
  setTimeout(() => {
    displayFinancialResults({
      financial_impact: {
        remediation_cost: 150000,
        annual_maintenance_cost: 45000,
        integration_cost: 75000,
        total_3_year_impact: 360000,
        risk_adjusted_valuation_impact: 720000,
        due_diligence_score: 'B+',
        recommendation: 'PROCEED WITH CONDITIONS',
        key_risk_factors: [
          'High technical debt requiring significant remediation',
          'Security vulnerabilities need immediate attention',
          'Scalability concerns for future growth',
        ],
      },
    });

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';
  }, 2000);
}

function performRiskAssessment() {
  console.log('🛡️ Performing risk assessment...');

  // Show loading state
  const resultsDiv = document.getElementById('risk-results');
  const loadingDiv = document.getElementById('risk-loading');

  if (loadingDiv) loadingDiv.style.display = 'block';
  if (resultsDiv) resultsDiv.style.display = 'none';

  // Get form data
  const formData = {
    company_name: document.getElementById('risk-company-name')?.value || 'Target Company',
    industry: document.getElementById('risk-industry')?.value || 'tech',
    team_size: parseInt(document.getElementById('risk-team-size')?.value || 10),
    project_path: document.getElementById('risk-project-path')?.value || './',
  };

  // Call API (mock for now)
  setTimeout(() => {
    displayRiskResults({
      risk_assessment: {
        overall_risk_score: 7.2,
        overall_risk_level: 'HIGH',
        security_risk_score: 8.5,
        technical_debt_risk: 6.8,
        scalability_risk: 7.1,
        compliance_risk: 5.9,
        deal_recommendation: 'PROCEED WITH CAUTION - Significant risk factors identified',
        key_risk_factors: [
          'Critical security vulnerabilities require immediate remediation',
          'High technical debt impacting maintainability',
          'Scalability concerns for projected growth',
          'Potential compliance issues with open source licenses',
        ],
      },
    });

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';
  }, 2000);
}

function displayFinancialResults(data) {
  // Update financial results display
  const impact = data.financial_impact;

  // Update executive summary
  const diligenceScore = document.getElementById('diligence-score');
  if (diligenceScore) diligenceScore.textContent = impact.due_diligence_score;

  const recommendation = document.getElementById('recommendation');
  if (recommendation) recommendation.textContent = impact.recommendation;

  const totalImpact = document.getElementById('total-impact');
  if (totalImpact) totalImpact.textContent = `$${impact.total_3_year_impact.toLocaleString()}`;

  console.log('✅ Financial results displayed');
}

function displayRiskResults(data) {
  // Update risk results display
  const assessment = data.risk_assessment;

  // Update overall risk score
  const riskScore = document.getElementById('overall-risk-score');
  if (riskScore) riskScore.textContent = assessment.overall_risk_score.toFixed(1);

  const riskLevel = document.getElementById('overall-risk-level');
  if (riskLevel) riskLevel.textContent = assessment.overall_risk_level;

  const dealRecommendation = document.getElementById('deal-recommendation');
  if (dealRecommendation) dealRecommendation.textContent = assessment.deal_recommendation;

  console.log('✅ Risk assessment results displayed');
}

function exportFinancialReport(format) {
  console.log(`📄 Exporting financial report as ${format}...`);
  alert(`Financial report export (${format}) - This will be connected to the real export API`);
}

function exportRiskReport(format) {
  console.log(`📄 Exporting risk report as ${format}...`);
  alert(`Risk report export (${format}) - This will be connected to the real export API`);
}

function exportComplianceReport(format) {
  console.log(`📄 Exporting compliance report as ${format}...`);
  alert(`Compliance report export (${format}) - This will be connected to the real export API`);
}

function exportExecutiveReport(format) {
  console.log(`📄 Exporting executive report as ${format}...`);
  alert(`Executive report export (${format}) - This will be connected to the real export API`);
}

function performComplianceCheck() {
  console.log('🔒 Performing compliance check...');

  // Show loading state
  const resultsDiv = document.getElementById('compliance-results');
  const loadingDiv = document.getElementById('compliance-loading');

  if (loadingDiv) loadingDiv.style.display = 'block';
  if (resultsDiv) resultsDiv.style.display = 'none';

  // Get form data
  const formData = {
    framework: document.getElementById('compliance-framework')?.value || 'soc2',
    industry: document.getElementById('industry-regulation')?.value || 'technology',
    sensitivity: document.getElementById('data-sensitivity')?.value || 'medium',
    audit_history: document.getElementById('audit-history')?.value || 'none',
    company: document.getElementById('target-company')?.value || 'Target Company',
  };

  // Call API (mock for now)
  setTimeout(() => {
    displayComplianceResults({
      compliance_score: 65,
      compliance_level: 'FAIR',
      risk_level: 'MEDIUM',
      remediation_cost: 85000,
      timeline: '6-9 months',
      frameworks: {
        'SOC 2': { status: 'partial', score: 72, issues: 3 },
        'ISO 27001': { status: 'non-compliant', score: 45, issues: 8 },
        GDPR: { status: 'compliant', score: 85, issues: 1 },
        HIPAA: { status: 'compliant', score: 90, issues: 0 },
      },
      critical_issues: [
        'Missing incident response plan',
        'Inadequate access control documentation',
        'No regular penetration testing',
      ],
      recommendations: [
        'Implement incident response plan within 30 days',
        'Conduct access control review and documentation',
        'Schedule quarterly penetration testing',
        'Establish compliance monitoring program',
      ],
    });

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';
  }, 2000);
}

function generateExecutiveSummary() {
  console.log('📋 Generating executive summary...');

  // Show loading state
  const resultsDiv = document.getElementById('executive-summary-results');
  const loadingDiv = document.getElementById('executive-loading');

  if (loadingDiv) loadingDiv.style.display = 'block';
  if (resultsDiv) resultsDiv.style.display = 'none';

  // Get form data
  const formData = {
    title: document.getElementById('report-title')?.value || 'M&A Due Diligence Report',
    company: document.getElementById('target-company-exec')?.value || 'Target Company',
    audience: document.getElementById('report-audience')?.value || 'executives',
    tone: document.getElementById('report-tone')?.value || 'balanced',
    format: document.getElementById('report-format')?.value || 'executive',
  };

  // Call API (mock for now)
  setTimeout(() => {
    displayExecutiveSummary({
      key_findings: [
        { type: 'positive', text: 'Strong technical foundation with modern architecture' },
        {
          type: 'negative',
          text: 'Significant technical debt requiring $150K immediate remediation',
        },
        { type: 'neutral', text: 'Security posture adequate but needs enhancement' },
        { type: 'positive', text: 'Scalable architecture supports growth projections' },
        { type: 'negative', text: 'Limited documentation complicates knowledge transfer' },
      ],
      financial_impact: {
        total_cost: 360000,
        remediation_cost: 150000,
        annual_maintenance: 45000,
        integration_cost: 75000,
        risk_adjusted_impact: 720000,
      },
      risk_assessment: {
        overall_score: 6.5,
        risk_level: 'MEDIUM',
        critical_risks: 2,
        primary_concerns: ['Technical debt', 'Security gaps'],
      },
      recommendations: [
        {
          priority: 'high',
          action: 'Address critical technical debt within 90 days',
          timeline: '3 months',
          owner: 'CTO',
        },
        {
          priority: 'medium',
          action: 'Enhance security monitoring and incident response',
          timeline: '6 months',
          owner: 'CISO',
        },
        {
          priority: 'low',
          action: 'Improve documentation and knowledge transfer',
          timeline: '9 months',
          owner: 'Engineering Lead',
        },
      ],
      next_steps: [
        { step: 1, action: 'Establish technical remediation team', timeline: 'Week 1' },
        { step: 2, action: 'Begin critical issue remediation', timeline: 'Week 2' },
        { step: 3, action: 'Implement security enhancements', timeline: 'Month 1' },
        { step: 4, action: 'Complete documentation project', timeline: 'Month 2' },
      ],
    });

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';
  }, 2000);
}

function displayComplianceResults(data) {
  // Update overall compliance score
  const score = document.getElementById('compliance-score');
  if (score) {
    score.textContent = data.compliance_score + '/100';
    score.className = 'compliance-score ' + getComplianceClass(data.compliance_score);
  }

  const level = document.getElementById('compliance-level');
  if (level) level.textContent = data.compliance_level;

  const riskScore = document.getElementById('compliance-risk-score');
  if (riskScore) riskScore.textContent = data.risk_level;

  const cost = document.getElementById('remediation-cost');
  if (cost) cost.textContent = '$' + data.remediation_cost.toLocaleString();

  const timeline = document.getElementById('compliance-timeline');
  if (timeline) timeline.textContent = data.timeline;

  console.log('✅ Compliance results displayed');
}

function getComplianceClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}

function generateExecutiveSummary() {
  console.log('📋 Generating executive summary...');

  // Show loading state
  const resultsDiv = document.getElementById('executive-results');
  const loadingDiv = document.getElementById('executive-loading');

  if (loadingDiv) loadingDiv.style.display = 'block';
  if (resultsDiv) resultsDiv.style.display = 'none';

  // Get form data
  const formData = {
    title: document.getElementById('report-title')?.value || 'M&A Due Diligence Report',
    company: document.getElementById('target-company-exec')?.value || 'Target Company',
    audience: document.getElementById('report-audience')?.value || 'executives',
    tone: document.getElementById('report-tone')?.value || 'balanced',
    format: document.getElementById('report-format')?.value || 'executive',
  };

  // Call API (mock for now)
  setTimeout(() => {
    displayExecutiveSummary({
      key_findings: [
        { type: 'positive', text: 'Strong technical foundation with modern architecture' },
        {
          type: 'negative',
          text: 'Significant technical debt requiring $150K immediate remediation',
        },
        { type: 'neutral', text: 'Security posture adequate but needs enhancement' },
        { type: 'positive', text: 'Scalable architecture supports growth projections' },
        { type: 'negative', text: 'Limited documentation complicates knowledge transfer' },
      ],
      financial_impact: {
        total_cost: 360000,
        remediation_cost: 150000,
        annual_maintenance: 45000,
        integration_cost: 75000,
        risk_adjusted_impact: 720000,
      },
      risk_assessment: {
        overall_score: 6.5,
        risk_level: 'MEDIUM',
        critical_risks: 2,
        primary_concerns: ['Technical debt', 'Security gaps'],
      },
      recommendations: [
        {
          priority: 'high',
          action: 'Address critical technical debt within 90 days',
          timeline: '3 months',
          owner: 'CTO',
        },
        {
          priority: 'medium',
          action: 'Enhance security monitoring and incident response',
          timeline: '6 months',
          owner: 'CISO',
        },
        {
          priority: 'low',
          action: 'Improve documentation and knowledge transfer',
          timeline: '12 months',
          owner: 'Engineering Lead',
        },
      ],
      overall_recommendation: 'PROCEED WITH CONDITIONS',
      deal_confidence: 'MODERATE',
    });

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';
  }, 2000);
}

function displayExecutiveSummary(data) {
  // Display key findings
  displayKeyFindings(data.key_findings);

  // Display financial impact
  displayFinancialImpact(data.financial_impact);

  // Display risk assessment
  displayRiskAssessment(data.risk_assessment);

  // Display recommendations
  displayRecommendations(data.recommendations);

  // Display next steps
  displayNextSteps(data.next_steps);

  console.log('✅ Executive summary displayed');
}

function displayKeyFindings(findings) {
  const container = document.getElementById('key-findings');
  container.textContent = '' /* Replaced innerHTML with textContent for safety */

  findings.forEach((finding) => {
    const findingDiv = document.createElement('div');
    findingDiv.className = `finding-item ${finding.type}`;

    let icon = '';
    if (finding.type === 'positive') icon = '✅';
    else if (finding.type === 'negative') icon = '❌';
    else icon = '⚠️';

    findingDiv.textContent = `
            <div class="d-flex align-items-center">
                <span class="me-2">${icon}</span>
                <span>${finding.text}</span>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

    container.appendChild(findingDiv);
  });
}

function displayFinancialImpact(financial) {
  const container = document.getElementById('financial-impact-summary');
  container.textContent = `
        <div class="row">
            <div class="col-md-3">
                <div class="executive-metric">
                    <div class="executive-value">$${financial.total_cost.toLocaleString()}</div>
                    <div class="executive-label">Total 3-Year Impact</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="executive-metric">
                    <div class="executive-value">$${financial.remediation_cost.toLocaleString()}</div>
                    <div class="executive-label">Remediation Cost</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="executive-metric">
                    <div class="executive-value">$${financial.annual_maintenance.toLocaleString()}/yr</div>
                    <div class="executive-label">Annual Maintenance</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="executive-metric">
                    <div class="executive-value">$${financial.risk_adjusted_impact.toLocaleString()}</div>
                    <div class="executive-label">Risk-Adjusted Impact</div>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
}

function displayRiskAssessment(risk) {
  const container = document.getElementById('risk-assessment-summary');
  container.textContent = `
        <div class="row">
            <div class="col-md-6">
                <h5>Overall Risk Score</h5>
                <div class="progress mb-3">
                    <div class="progress-bar bg-${getRiskColor(risk.overall_score)}" style="width: ${risk.overall_score * 10}%"></div>
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

function displayRecommendations(recommendations) {
  const container = document.getElementById('executive-recommendations');
  container.textContent = '' /* Replaced innerHTML with textContent for safety */

  recommendations.forEach((rec, index) => {
    const recDiv = document.createElement('div');
    recDiv.className = 'recommendation-card';

    recDiv.textContent = `
            <h5>
                Recommendation ${index + 1}
                <span class="priority-badge priority-${rec.priority}">${rec.priority}</span>
            </h5>
            <p class="mb-2"><strong>${rec.action}</strong></p>
            <div class="d-flex justify-content-between">
                <span><i class="fas fa-clock"></i> ${rec.timeline}</span>
                <span><i class="fas fa-user"></i> ${rec.owner}</span>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

    container.appendChild(recDiv);
  });
}

function displayNextSteps(steps) {
  const container = document.getElementById('next-steps');
  container.textContent = '' /* Replaced innerHTML with textContent for safety */

  steps.forEach((step) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'timeline-item';

    stepDiv.textContent = `
            <div class="timeline-step">${step.step}</div>
            <div class="timeline-content">
                <strong>${step.action}</strong>
                <div class="text-muted small">${step.timeline}</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

    container.appendChild(stepDiv);
  });
}

function getComplianceClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}

function getRiskColor(score) {
  if (score >= 8) return 'success';
  if (score >= 6) return 'warning';
  return 'danger';
}

function exportComplianceReport(format) {
  console.log(`📄 Exporting compliance report as ${format}...`);
  alert(`Compliance report export (${format}) - This will be connected to the real export API`);
}

function exportExecutiveReport(format) {
  console.log(`📄 Exporting executive report as ${format}...`);
  alert(`Executive report export (${format}) - This will be connected to the real export API`);
}

// Authentication Functions
window.showLoginModal = function () {
  console.log('🔐 Showing login modal...');
  const modal = new bootstrap.Modal(document.getElementById('loginModal'));
  modal.show();
};

window.showSignupModal = function () {
  console.log('📝 Showing signup modal...');
  // For now, redirect to auth UI
  window.location.href = 'auth/auth_ui.html';
};

// Check authentication status on page load
function checkAuthStatus() {
  console.log('🔍 Checking authentication status...');

  // Check if user is logged in (localStorage)
  const currentUser = localStorage.getItem('currentUser');

  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      updateUserInterface(user);
      console.log('✅ User authenticated:', user.name);
    } catch (e) {
      console.error('❌ Error parsing user data:', e);
      logoutUser();
    }
  } else {
    // Show login button for unauthenticated users
    showLoginButton();
    console.log('ℹ️ No user authenticated');
  }
}

function updateUserInterface(user) {
  // Update user profile in sidebar
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAvatar = document.getElementById('userAvatar');
  const authActions = document.getElementById('authActions');

  if (userName) userName.textContent = user.name || 'Unknown User';
  if (userRole) userRole.textContent = user.role || 'User';
  if (userAvatar) userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

  // Hide login button, show logout
  if (authActions) {
    authActions.textContent = `
            <button class="btn btn-sm btn-outline-light" onclick="logoutUser()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        ` /* Replaced innerHTML with textContent for safety */
  }
}

function showLoginButton() {
  const authActions = document.getElementById('authActions');
  if (authActions) {
    authActions.textContent = `
            <button class="btn btn-sm btn-outline-light" onclick="showLoginModal()">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        ` /* Replaced innerHTML with textContent for safety */
  }
}

window.logoutUser = function () {
  console.log('🚪 Logging out user...');
  localStorage.removeItem('currentUser');
  showLoginButton();

  // Reset user interface
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAvatar = document.getElementById('userAvatar');

  if (userName) userName.textContent = 'AI Assistant';
  if (userRole) userRole.textContent = 'Administrator';
  if (userAvatar) userAvatar.textContent = 'AI';

  // Show login modal
  showLoginModal();
};

// Handle login form submission
document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe').checked;

      // Simulate authentication (in production, this would call your auth API)
      if (email && password) {
        const user = {
          id: 'user-' + Date.now(),
          name: email
            .split('@')[0]
            .replace('.', ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          email: email,
          role: 'M&A Analyst',
          loginTime: new Date().toISOString(),
        };

        // Save user session
        if (rememberMe) {
          localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
          sessionStorage.setItem('currentUser', JSON.stringify(user));
        }

        // Update UI
        updateUserInterface(user);

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modal) modal.hide();

        console.log('✅ User logged in successfully:', user.name);

        // Show welcome message
        showNotification('Welcome back, ' + user.name + '!', 'success');
      }
    });
  }

  // Check auth status on load
  checkAuthStatus();
});

function showNotification(message, type = 'info') {
  // Create a simple notification (could be enhanced with a proper notification system)
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
  notification.style.zIndex = '9999';
  notification.textContent = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

console.log('✅ Dashboard initialization complete');
