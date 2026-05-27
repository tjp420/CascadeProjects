// Global Roadmap Enhancement Functions
// This file contains all the global functions that need to be accessible from the test suite

// These functions will be defined after the main export-system.js loads
// They reference functions defined inside the closure

function showAdvancedViews() {
    console.log('Opening advanced views...');
  
    if (!window.roadmapAdvancedViews) {
        console.warn('Advanced views system not available, loading fallback...');
        showNotification('Advanced views system loading...', 'info');
        setTimeout(() => {
            if (window.roadmapAdvancedViews) {
                showAdvancedViews();
            } else {
                showNotification('Advanced views system not available', 'error');
            }
        }, 1000);
        return;
    }
  
    const _milestones = window.roadmapStorage.loadMilestones();
    const container = document.querySelector('.dashboard-container');
  
    if (container) {
    // Create view selector modal
        const modal = document.createElement('div');
        modal.id = 'advanced-views-modal';
        modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
        modal.textContent = `
      <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <h3 style="color: var(--text-primary); margin: 0;">📊 Advanced Views</h3>
          <button onclick="closeAdvancedViewsModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
            ✕
          </button>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
          <button onclick="openGanttChart()" style="padding: 2rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">📊</div>
            <h4 style="margin: 0 0 0.5rem 0;">Gantt Chart</h4>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Visual timeline with dependencies</p>
          </button>
          
          <button onclick="openKanbanBoard()" style="padding: 2rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">📋</div>
            <h4 style="margin: 0 0 0.5rem 0;">Kanban Board</h4>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Task board with drag & drop</p>
          </button>
        </div>
      </div>
    `;
    
        document.body.appendChild(modal);
    
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAdvancedViewsModal();
            }
        });
    
        // Show modal
        setTimeout(() => {
            modal.style.display = 'flex';
        }, 100);
    }
}

function closeAdvancedViewsModal() {
    const modal = document.getElementById('advanced-views-modal');
    if (modal) {
        modal.style.display = 'none';
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }
}

function openGanttChart() {
    closeAdvancedViewsModal();
    const milestones = window.roadmapStorage.loadMilestones();
    const container = document.querySelector('.dashboard-container');
    if (container) {
        window.roadmapAdvancedViews.renderGanttChart(container, milestones);
        showNotification('Gantt chart view opened', 'success');
    }
}

function openKanbanBoard() {
    closeAdvancedViewsModal();
    const milestones = window.roadmapStorage.loadMilestones();
    const container = document.querySelector('.dashboard-container');
    if (container) {
        window.roadmapAdvancedViews.renderKanbanBoard(container, milestones);
        showNotification('Kanban board view opened', 'success');
    }
}

function showIntegrations() {
    console.log('Opening integrations...');
  
    if (!window.roadmapIntegrations) {
        console.warn('Integrations system not available, loading fallback...');
        showNotification('Integrations system loading...', 'info');
        setTimeout(() => {
            if (window.roadmapIntegrations) {
                showIntegrations();
            } else {
                showNotification('Integrations system not available', 'error');
            }
        }, 1000);
        return;
    }
  
    window.roadmapIntegrations.showIntegrationsModal();
}

function showCollaboration() {
    console.log('Opening collaboration features...');
  
    if (!window.roadmapCollaboration) {
        console.warn('Collaboration system not available, loading fallback...');
        showNotification('Collaboration system loading...', 'info');
        setTimeout(() => {
            if (window.roadmapCollaboration) {
                showCollaboration();
            } else {
                showNotification('Collaboration system not available', 'error');
            }
        }, 1000);
        return;
    }
  
    // Show collaboration panel
    const container = document.querySelector('.dashboard-container');
    if (container) {
        const collaborationPanel = document.createElement('div');
        collaborationPanel.id = 'collaboration-panel';
        collaborationPanel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 300px;
      height: 100%;
      background: var(--card-bg);
      border-left: 1px solid var(--border-color);
      padding: 2rem;
      overflow-y: auto;
      z-index: 9999;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
        collaborationPanel.textContent = `
      <div style="display: flex /* Replaced innerHTML with textContent for safety */ justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h3 style="color: var(--text-primary); margin: 0;">👥 Collaboration</h3>
        <button onclick="closeCollaborationPanel()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="margin-bottom: 2rem;">
        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Active Users</h4>
        <div id="active-users">
          <!-- Active users will be populated here -->
        </div>
      </div>
      
      <div style="margin-bottom: 2rem;">
        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Recent Activity</h4>
        <div id="activity-list">
          <!-- Activity will be populated here -->
        </div>
      </div>
    `;
    
        document.body.appendChild(collaborationPanel);
    
        // Show panel
        setTimeout(() => {
            collaborationPanel.style.transform = 'translateX(0)';
        }, 100);
    
        // Update displays
        window.roadmapCollaboration.updateActiveUsersDisplay();
        window.roadmapCollaboration.updateActivityDisplay();
    }
}

function closeCollaborationPanel() {
    const panel = document.getElementById('collaboration-panel');
    if (panel) {
        panel.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(panel);
        }, 300);
    }
}

// Storage functions
function exportRoadmap() {
    console.log('Exporting roadmap...');
    exportRoadmapData();
}

function exportRoadmapData() {
    console.log('Exporting roadmap data...');
  
    if (!window.roadmapStorage) {
        showNotification('Roadmap storage not available', 'error');
        return;
    }

    try {
        const data = window.roadmapStorage.exportData();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `roadmap-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification('Roadmap data exported successfully!', 'success');
    } catch (error) {
        console.error('Failed to export roadmap data:', error);
        showNotification('Failed to export roadmap data. Please try again.', 'error');
    }
}

function importRoadmapData() {
    console.log('Importing roadmap data...');
  
    if (!window.roadmapStorage) {
        showNotification('Roadmap storage not available', 'error');
        return;
    }

    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                const success = window.roadmapStorage.importData(data);
        
                if (success) {
                    showNotification('Roadmap data imported successfully!', 'success');
                    // Refresh the roadmap display
                    if (typeof refreshRoadmap === 'function') {
                        refreshRoadmap();
                    }
                } else {
                    showNotification('Failed to import roadmap data. Please check the file format.', 'error');
                }
            } catch (error) {
                console.error('Failed to parse import file:', error);
                showNotification('Failed to parse import file. Please ensure it is valid JSON.', 'error');
            }
        };

        reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

function clearRoadmapData() {
    console.log('Clearing roadmap data...');
  
    if (!window.roadmapStorage) {
        showNotification('Roadmap storage not available', 'error');
        return;
    }

    // Show confirmation modal
    const modal = document.createElement('div');
    modal.id = 'clear-confirm-modal';
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    modal.textContent = `
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%;">
      <h3 style="color: var(--text-primary); margin-bottom: 1rem;">⚠️ Clear All Data?</h3>
      <p style="color: var(--text-secondary); margin-bottom: 2rem;">This will permanently delete all milestones and settings. This action cannot be undone.</p>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="closeClearConfirmModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="confirmClearData()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: #dc3545; color: white; cursor: pointer;">
          Clear Data
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeClearConfirmModal();
        }
    });

    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
}

function closeClearConfirmModal() {
    const modal = document.getElementById('clear-confirm-modal');
    if (modal) {
        modal.style.display = 'none';
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }
}

function confirmClearData() {
    const success = window.roadmapStorage.clearAllData();
  
    if (success) {
        showNotification('All roadmap data cleared successfully!', 'success');
        // Refresh the roadmap display
        if (typeof refreshRoadmap === 'function') {
            refreshRoadmap();
        }
    } else {
        showNotification('Failed to clear roadmap data. Please try again.', 'error');
    }
  
    closeClearConfirmModal();
}

// Helper function for notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10001;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;

    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    notification.style.background = colors[type] || colors.info;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// RoadmapStorage class definition (simplified version)
class RoadmapStorage {
    constructor() {
        this.storageKey = 'roadmapData';
        this.settingsKey = 'roadmapSettings';
        this.version = '1.0.0';
    }

    // Load milestones from localStorage
    loadMilestones() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) {
                return this.getDefaultMilestones();
            }

            const parsed = JSON.parse(data);

            // Version migration handling
            if (parsed.version !== this.version) {
                console.log('🔄 Migrating roadmap data from version', parsed.version, 'to', this.version);
                return this.migrateData(parsed);
            }

            return parsed.milestones || this.getDefaultMilestones();
        } catch (error) {
            console.error('❌ Failed to load milestones:', error);
            return this.getDefaultMilestones();
        }
    }

    // Save milestones to localStorage
    saveMilestones(milestones) {
        try {
            const data = {
                version: this.version,
                timestamp: new Date().toISOString(),
                milestones: milestones
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            console.log('✅ Milestones saved to localStorage');
            return true;
        } catch (error) {
            console.error('❌ Failed to save milestones:', error);
            return false;
        }
    }

    // Load timeline settings
    loadSettings() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            if (!data) {
                return this.getDefaultSettings();
            }

            const parsed = JSON.parse(data);
            return parsed.settings || this.getDefaultSettings();
        } catch (error) {
            console.error('❌ Failed to load settings:', error);
            return this.getDefaultSettings();
        }
    }

    // Save timeline settings
    saveSettings(settings) {
        try {
            const data = {
                version: this.version,
                timestamp: new Date().toISOString(),
                settings: settings,
            };
            localStorage.setItem(this.settingsKey, JSON.stringify(data));
            console.log('✅ Timeline settings saved to localStorage');
            return true;
        } catch (error) {
            console.error('❌ Failed to save settings:', error);
            return false;
        }
    }

    // Export all data
    exportData() {
        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            milestones: this.loadMilestones(),
            settings: this.loadSettings(),
        };
    }

    // Import data from backup
    importData(data) {
        try {
            if (!data.milestones || !Array.isArray(data.milestones)) {
                throw new Error('Invalid data format');
            }

            // Validate milestone structure
            const validatedMilestones = data.milestones.filter(
                (milestone) => milestone.id && milestone.name && milestone.date
            );

            this.saveMilestones(validatedMilestones);

            if (data.settings) {
                this.saveSettings(data.settings);
            }

            console.log('✅ Roadmap data imported successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to import roadmap data:', error);
            return false;
        }
    }

    // Clear all data
    clearAllData() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.settingsKey);
            console.log('✅ All roadmap data cleared');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear roadmap data:', error);
            return false;
        }
    }

    // Get default milestones
    getDefaultMilestones() {
        return [
            // Phase 1: Foundation & Core Infrastructure
            {
                id: 'm1',
                name: 'Project Setup & Architecture',
                date: '2024-01-05',
                description: 'Initialize project structure, set up development environment',
                status: 'completed',
                progress: 100,
                dependencies: [],
                tags: ['planning', 'architecture', 'infrastructure'],
                phase: 'Foundation & Core Infrastructure'
            },
            {
                id: 'm2',
                name: 'Core Dashboard Framework',
                date: '2024-01-20',
                description: 'Build main dashboard interface and navigation',
                status: 'completed',
                progress: 100,
                dependencies: ['m1'],
                tags: ['frontend', 'ui', 'framework'],
                phase: 'Foundation & Core Infrastructure'
            },
            {
                id: 'm3',
                name: 'Data Storage & Management',
                date: '2024-02-05',
                description: 'Implement data persistence and management systems',
                status: 'completed',
                progress: 100,
                dependencies: ['m2'],
                tags: ['backend', 'database', 'storage'],
                phase: 'Foundation & Core Infrastructure'
            },
            {
                id: 'm4',
                name: 'Authentication & Security',
                date: '2024-02-15',
                description: 'Implement user authentication and security measures',
                status: 'completed',
                progress: 100,
                dependencies: ['m3'],
                tags: ['security', 'authentication', 'access-control'],
                phase: 'Foundation & Core Infrastructure'
            },
      
            // Phase 2: AI Integration & Analytics
            {
                id: 'm5',
                name: 'AI Analysis Engine',
                date: '2024-03-01',
                description: 'Develop core AI analysis and code scanning capabilities',
                status: 'completed',
                progress: 100,
                dependencies: ['m4'],
                tags: ['ai', 'analysis', 'code-scanning'],
                phase: 'AI Integration & Analytics'
            },
            {
                id: 'm6',
                name: 'Real-time Analytics',
                date: '2024-03-20',
                description: 'Implement real-time data processing and analytics',
                status: 'completed',
                progress: 100,
                dependencies: ['m5'],
                tags: ['analytics', 'real-time', 'processing'],
                phase: 'AI Integration & Analytics'
            },
            {
                id: 'm7',
                name: 'Machine Learning Models',
                date: '2024-04-10',
                description: 'Integrate ML models for predictive analytics',
                status: 'in-progress',
                progress: 85,
                dependencies: ['m6'],
                tags: ['machine-learning', 'prediction', 'models'],
                phase: 'AI Integration & Analytics'
            },
            {
                id: 'm8',
                name: 'Technical Debt Assessment',
                date: '2024-04-30',
                description: 'Build comprehensive technical debt analysis system',
                status: 'in-progress',
                progress: 60,
                dependencies: ['m7'],
                tags: ['technical-debt', 'assessment', 'analysis'],
                phase: 'AI Integration & Analytics'
            },
      
            // Phase 3: Advanced Features & Integration
            {
                id: 'm9',
                name: 'Advanced Reporting System',
                date: '2024-05-15',
                description: 'Build comprehensive reporting and export capabilities',
                status: 'in-progress',
                progress: 70,
                dependencies: ['m8'],
                tags: ['reporting', 'export', 'documentation'],
                phase: 'Advanced Features & Integration'
            },
            {
                id: 'm10',
                name: 'Collaboration Features',
                date: '2024-06-01',
                description: 'Implement team collaboration and sharing features',
                status: 'pending',
                progress: 30,
                dependencies: ['m9'],
                tags: ['collaboration', 'team', 'sharing'],
                phase: 'Advanced Features & Integration'
            },
            {
                id: 'm11',
                name: 'External Integrations',
                date: '2024-06-20',
                description: 'Integrate with external tools and services',
                status: 'pending',
                progress: 20,
                dependencies: ['m10'],
                tags: ['integration', 'api', 'external-services'],
                phase: 'Advanced Features & Integration'
            },
            {
                id: 'm12',
                name: 'Mobile responsiveness',
                date: '2024-07-15',
                description: 'Optimize for mobile devices and tablets',
                status: 'pending',
                progress: 10,
                dependencies: ['m11'],
                tags: ['mobile', 'responsive', 'ui'],
                phase: 'Advanced Features & Integration'
            },
      
            // Phase 4: Production & Optimization
            {
                id: 'm13',
                name: 'Performance Optimization',
                date: '2024-08-01',
                description: 'Optimize application performance and scalability',
                status: 'pending',
                progress: 0,
                dependencies: ['m12'],
                tags: ['performance', 'optimization', 'scalability'],
                phase: 'Production & Optimization'
            },
            {
                id: 'm14',
                name: 'Security Hardening',
                date: '2024-08-15',
                description: 'Enhance security measures and conduct security audit',
                status: 'pending',
                progress: 0,
                dependencies: ['m13'],
                tags: ['security', 'audit', 'hardening'],
                phase: 'Production & Optimization'
            },
            {
                id: 'm15',
                name: 'Production Deployment',
                date: '2024-09-01',
                description: 'Deploy to production environment',
                status: 'pending',
                progress: 0,
                dependencies: ['m14'],
                tags: ['deployment', 'production', 'infrastructure'],
                phase: 'Production & Optimization'
            },
            {
                id: 'm16',
                name: 'User Training & Documentation',
                date: '2024-09-30',
                description: 'Create user documentation and training materials',
                status: 'pending',
                progress: 0,
                dependencies: ['m15'],
                tags: ['documentation', 'training', 'user-support'],
                phase: 'Production & Optimization'
            }
        ];
    }

    // Get default settings
    getDefaultSettings() {
        return {
            view: 'months',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            showCompleted: true,
            showDependencies: true,
            autoSave: true,
            notifications: true,
        };
    }

    // Data migration for version updates
    migrateData(oldData) {
        const milestones = oldData.milestones || this.getDefaultMilestones();

        // Add missing fields for new version
        const migratedMilestones = milestones.map((milestone) => ({
            ...milestone,
            createdAt: milestone.createdAt || new Date().toISOString(),
            updatedAt: milestone.updatedAt || new Date().toISOString(),
            dependencies: milestone.dependencies || [],
            tags: milestone.tags || [],
        }));

        this.saveMilestones(migratedMilestones);
        return migratedMilestones;
    }
}

// Initialize storage system
const roadmapStorage = new RoadmapStorage();
window.roadmapStorage = roadmapStorage;

// Assign all functions to window object
window.showAdvancedViews = showAdvancedViews;
window.closeAdvancedViewsModal = closeAdvancedViewsModal;
window.openGanttChart = openGanttChart;
window.openKanbanBoard = openKanbanBoard;
window.showIntegrations = showIntegrations;
window.showCollaboration = showCollaboration;
window.closeCollaborationPanel = closeCollaborationPanel;
window.exportRoadmap = exportRoadmap;
window.exportRoadmapData = exportRoadmapData;
window.importRoadmapData = importRoadmapData;
window.clearRoadmapData = clearRoadmapData;
window.closeClearConfirmModal = closeClearConfirmModal;
window.confirmClearData = confirmClearData;

console.log('✅ Global roadmap functions and storage loaded');
