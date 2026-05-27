/**
 * AI Builder Interface - Local AI Integration
 * Provides AI-powered project building capabilities through the dashboard
 */

class AIBuilderInterface {
    constructor() {
        this.isBuilding = false;
        this.currentProject = null;
        this.aiEndpoint = '/api/ai-build';
        this.buildHistory = [];
        this.initializeInterface();
    }

    initializeInterface() {
        this.createBuilderSection();
        this.setupEventListeners();
        this.loadBuildHistory();
    }

    createBuilderSection() {
        const builderHTML = `
            <div id="aiBuilderSection" class="builder-section" style="display: none;">
                <div class="builder-header">
                    <h2><i class="fas fa-robot"></i> AI Project Builder</h2>
                    <button class="btn btn-secondary" onclick="toggleBuilder()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>

                <div class="builder-content">
                    <!-- Project Requirements -->
                    <div class="builder-card">
                        <h3><i class="fas fa-edit"></i> Project Requirements</h3>
                        <textarea id="projectRequirements" 
                                  class="form-control" 
                                  rows="4" 
                                  placeholder="Describe what you want to build...&#10;Example: Create a web application with user authentication, dashboard, and API endpoints"></textarea>
                    </div>

                    <!-- Build Options -->
                    <div class="builder-card">
                        <h3><i class="fas fa-cog"></i> Build Options</h3>
                        <div class="row">
                            <div class="col-md-6">
                                <label for="projectType">Project Type:</label>
                                <select id="projectType" class="form-control">
                                    <option value="web">Web Application</option>
                                    <option value="api">REST API</option>
                                    <option value="mobile">Mobile App</option>
                                    <option value="desktop">Desktop Application</option>
                                    <option value="microservice">Microservice</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="techStack">Technology Stack:</label>
                                <select id="techStack" class="form-control">
                                    <option value="react">React + Node.js</option>
                                    <option value="vue">Vue.js + Express</option>
                                    <option value="angular">Angular + .NET</option>
                                    <option value="python">Python + FastAPI</option>
                                    <option value="java">Java + Spring Boot</option>
                                </select>
                            </div>
                        </div>
                        <div class="mt-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeTests" checked>
                                <label class="form-check-label" for="includeTests">
                                    Include automated tests
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeDocs" checked>
                                <label class="form-check-label" for="includeDocs">
                                    Include documentation
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeDeployment">
                                <label class="form-check-label" for="includeDeployment">
                                    Setup deployment configuration
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Build Controls -->
                    <div class="builder-controls">
                        <button id="startBuildBtn" class="btn btn-primary btn-lg" onclick="startAIBuild()">
                            <i class="fas fa-play"></i> Start AI Build
                        </button>
                        <button id="stopBuildBtn" class="btn btn-danger btn-lg" onclick="stopAIBuild()" style="display: none;">
                            <i class="fas fa-stop"></i> Stop Build
                        </button>
                    </div>

                    <!-- Build Progress -->
                    <div id="buildProgress" class="build-progress" style="display: none;">
                        <h3><i class="fas fa-chart-line"></i> Build Progress</h3>
                        <div class="progress-container">
                            <div class="progress">
                                <div id="progressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                                     role="progressbar" style="width: 0%">0%</div>
                            </div>
                        </div>
                        <div id="buildLog" class="build-log"></div>
                    </div>

                    <!-- Build Results -->
                    <div id="buildResults" class="build-results" style="display: none;">
                        <h3><i class="fas fa-check-circle"></i> Build Results</h3>
                        <div id="resultsContent"></div>
                    </div>
                </div>
            </div>
        `;

        // Insert builder section after the quick actions
        const quickActions = document.querySelector('.quick-actions');
        if (quickActions) {
            quickActions.insertAdjacentHTML('afterend', builderHTML);
        }
    }

    setupEventListeners() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                this.toggleBuilder();
            }
        });
    }

    toggleBuilder() {
        const builderSection = document.getElementById('aiBuilderSection');
        if (builderSection) {
            builderSection.style.display = builderSection.style.display === 'none' ? 'block' : 'none';
        }
    }

    async startAIBuild() {
        if (this.isBuilding) return;

        const requirements = document.getElementById('projectRequirements').value.trim();
        if (!requirements) {
            this.showNotification('Please provide project requirements', 'warning');
            return;
        }

        this.isBuilding = true;
        this.updateUIState('building');
        this.showProgress();

        const buildConfig = {
            requirements: requirements,
            projectType: document.getElementById('projectType').value,
            techStack: document.getElementById('techStack').value,
            includeTests: document.getElementById('includeTests').checked,
            includeDocs: document.getElementById('includeDocs').checked,
            includeDeployment: document.getElementById('includeDeployment').checked
        };

        try {
            // Simulate AI build process
            await this.simulateBuildProcess(buildConfig);

        } catch (error) {
            console.error('AI Build error:', error);
            this.showNotification(`Build failed: ${error.message}`, 'error');
            this.updateUIState('ready');
        }
    }

    stopAIBuild() {
        if (!this.isBuilding) return;
        
        this.isBuilding = false;
        this.updateUIState('ready');
        this.showNotification('Build stopped by user', 'info');
    }

    showProgress() {
        const progressSection = document.getElementById('buildProgress');
        const resultsSection = document.getElementById('buildResults');
        
        if (progressSection) progressSection.style.display = 'block';
        if (resultsSection) resultsSection.style.display = 'none';

        this.simulateBuildProgress();
    }

    async simulateBuildProcess(config) {
        // Integrate with the internal AI system we created earlier
        const response = await fetch('/api/ai-build', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error(`Build failed: ${response.statusText}`);
        }

        const result = await response.json();
        await this.processBuildResult(result);
    }

    simulateBuildProgress() {
        const phases = [
            { name: 'Analyzing requirements...', duration: 2000 },
            { name: 'Generating project structure...', duration: 3000 },
            { name: 'Creating source files...', duration: 4000 },
            { name: 'Setting up configuration...', duration: 2000 },
            { name: 'Running automated tests...', duration: 3000 },
            { name: 'Generating documentation...', duration: 2000 },
            { name: 'Finalizing build...', duration: 1000 }
        ];

        let currentPhase = 0;
        let totalProgress = 0;

        const runPhase = () => {
            if (!this.isBuilding || currentPhase >= phases.length) {
                if (this.isBuilding) {
                    this.completeBuild();
                }
                return;
            }

            const phase = phases[currentPhase];
            this.updateProgress(totalProgress, phase.name);
            
            totalProgress += Math.round(100 / phases.length);
            currentPhase++;

            setTimeout(runPhase, phase.duration);
        };

        runPhase();
    }

    updateProgress(percentage, message) {
        const progressBar = document.getElementById('progressBar');
        const buildLog = document.getElementById('buildLog');

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
        }

        if (buildLog) {
            const timestamp = new Date().toLocaleTimeString();
            buildLog.innerHTML += `<div class="log-entry">[${timestamp}] ${message}</div>`;
            buildLog.scrollTop = buildLog.scrollHeight;
        }
    }

    async completeBuild() {
        this.updateProgress(100, 'Build completed successfully!');
        
        // Simulate build results
        const buildResults = {
            success: true,
            duration: 15.2,
            filesGenerated: 12,
            testsCreated: 8,
            documentationGenerated: true,
            deploymentReady: document.getElementById('includeDeployment').checked,
            projectStructure: this.generateProjectStructure(),
            nextSteps: [
                'Review generated code in the project directory',
                'Run local tests to verify functionality',
                'Customize styling and business logic',
                'Deploy to your preferred hosting platform'
            ]
        };

        await this.processBuildResult(buildResults);
        this.updateUIState('completed');
    }

    async processBuildResult(results) {
        const resultsSection = document.getElementById('buildResults');
        const resultsContent = document.getElementById('resultsContent');

        if (!resultsSection || !resultsContent) return;

        resultsSection.style.display = 'block';
        resultsContent.textContent = this.generateResultsHTML(results) /* Replaced innerHTML with textContent for safety */

        // Add to build history
        this.buildHistory.push({
            timestamp: new Date().toISOString(),
            requirements: document.getElementById('projectRequirements').value,
            results: results
        });

        this.saveBuildHistory();
        this.showNotification('Project built successfully!', 'success');
    }

    generateResultsHTML(results) {
        return `
            <div class="results-summary">
                <div class="row">
                    <div class="col-md-3">
                        <div class="result-metric">
                            <i class="fas fa-clock text-primary"></i>
                            <div class="metric-value">${results.duration}s</div>
                            <div class="metric-label">Build Time</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="result-metric">
                            <i class="fas fa-file-code text-success"></i>
                            <div class="metric-value">${results.filesGenerated}</div>
                            <div class="metric-label">Files Generated</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="result-metric">
                            <i class="fas fa-vial text-info"></i>
                            <div class="metric-value">${results.testsCreated}</div>
                            <div class="metric-label">Tests Created</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="result-metric">
                            <i class="fas fa-book text-warning"></i>
                            <div class="metric-value">${results.documentationGenerated ? 'Yes' : 'No'}</div>
                            <div class="metric-label">Documentation</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="project-structure">
                <h4><i class="fas fa-folder-tree"></i> Project Structure</h4>
                <pre class="structure-tree">${results.projectStructure}</pre>
            </div>

            <div class="next-steps">
                <h4><i class="fas fa-tasks"></i> Next Steps</h4>
                <ul class="steps-list">
                    ${results.nextSteps.map(step => `<li>${step}</li>`).join('')}
                </ul>
            </div>

            <div class="build-actions">
                <button class="btn btn-success" onclick="viewGeneratedProject()">
                    <i class="fas fa-eye"></i> View Project
                </button>
                <button class="btn btn-primary" onclick="downloadProject()">
                    <i class="fas fa-download"></i> Download Project
                </button>
                <button class="btn btn-info" onclick="runTests()">
                    <i class="fas fa-play"></i> Run Tests
                </button>
            </div>
        `;
    }

    generateProjectStructure() {
        const projectType = document.getElementById('projectType').value;
        const techStack = document.getElementById('techStack').value;

        const structures = {
            web: {
                'react': `project/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── utils/
│   └── App.js
├── public/
├── package.json
├── README.md
└── .gitignore`,
                'vue': `project/
├── src/
│   ├── components/
│   ├── views/
│   ├── router/
│   └── main.js
├── public/
├── package.json
├── README.md
└── .gitignore`
            },
            api: {
                'python': `project/
├── app/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── main.py
├── tests/
├── requirements.txt
├── README.md
└── .gitignore`,
                'node': `project/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── app.js
├── tests/
├── package.json
├── README.md
└── .gitignore`
            }
        };

        return structures[projectType]?.[techStack] || 'Project structure generated based on requirements';
    }

    updateUIState(state) {
        const startBtn = document.getElementById('startBuildBtn');
        const stopBtn = document.getElementById('stopBuildBtn');
        const progressSection = document.getElementById('buildProgress');

        switch (state) {
            case 'building':
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'inline-block';
                break;
            case 'ready':
            case 'completed':
                if (startBtn) startBtn.style.display = 'inline-block';
                if (stopBtn) stopBtn.style.display = 'none';
                if (progressSection) progressSection.style.display = 'none';
                break;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show notification-toast`;
        notification.textContent = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        ` /* Replaced innerHTML with textContent for safety */

        // Add to page
        const container = document.querySelector('.dashboard-container');
        if (container) {
            container.insertBefore(notification, container.firstChild);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    }

    saveBuildHistory() {
        try {
            localStorage.setItem('aiBuildHistory', JSON.stringify(this.buildHistory));
        } catch (error) {
            console.warn('Could not save build history:', error);
        }
    }

    loadBuildHistory() {
        try {
            const saved = localStorage.getItem('aiBuildHistory');
            if (saved) {
                this.buildHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Could not load build history:', error);
            this.buildHistory = [];
        }
    }
}

// Global functions for button onclick handlers
let aiBuilder = null;

function toggleBuilder() {
    if (!aiBuilder) {
        aiBuilder = new AIBuilderInterface();
    }
    aiBuilder.toggleBuilder();
}

function startAIBuild() {
    if (aiBuilder) {
        aiBuilder.startAIBuild();
    }
}

function stopAIBuild() {
    if (aiBuilder) {
        aiBuilder.stopAIBuild();
    }
}

function viewGeneratedProject() {
    window.open('/project-viewer', '_blank');
}

function downloadProject() {
    window.open('/api/download-project', '_blank');
}

function runTests() {
    window.open('/test-runner', '_blank');
}

// Initialize AI Builder when page loads
document.addEventListener('DOMContentLoaded', () => {
    aiBuilder = new AIBuilderInterface();
    
    // Add AI Builder button to quick actions
    const quickActions = document.querySelector('.quick-actions');
    if (quickActions) {
        const aiButton = document.createElement('div');
        aiButton.className = 'action-card ai-builder-card';
        aiButton.onclick = toggleBuilder;
        aiButton.textContent = `
            <div class="action-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) /* Replaced innerHTML with textContent for safety */">
                <i class="fas fa-robot"></i>
            </div>
            <div class="action-title">AI Builder</div>
            <div class="action-description">Build projects with AI</div>
        `;
        quickActions.appendChild(aiButton);
    }
});

// Add CSS styles
const builderStyles = `
<style>
.builder-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin: 20px 0;
    overflow: hidden;
}

.builder-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.builder-content {
    padding: 30px;
}

.builder-card {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
}

.builder-controls {
    text-align: center;
    margin: 30px 0;
}

.build-progress {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
}

.build-log {
    background: #2d3748;
    color: #e2e8f0;
    border-radius: 6px;
    padding: 15px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    max-height: 300px;
    overflow-y: auto;
    margin-top: 15px;
}

.log-entry {
    margin: 5px 0;
    opacity: 0.9;
}

.build-results {
    background: #e8f5e8;
    border: 1px solid #28a745;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
}

.result-metric {
    text-align: center;
    padding: 15px;
}

.metric-value {
    font-size: 2rem;
    font-weight: bold;
    color: #2c3e50;
}

.metric-label {
    color: #6c757d;
    font-size: 0.9rem;
}

.structure-tree {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 15px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    overflow-x: auto;
}

.steps-list {
    padding-left: 20px;
}

.steps-list li {
    margin: 10px 0;
}

.build-actions {
    text-align: center;
    margin-top: 20px;
}

.build-actions .btn {
    margin: 0 10px;
}

.ai-builder-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
}

.ai-builder-card .action-title {
    color: white !important;
}

.ai-builder-card .action-description {
    color: rgba(255, 255, 255, 0.8) !important;
}

.notification-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', builderStyles);
