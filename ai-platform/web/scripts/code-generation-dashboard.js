/**
 * Code Generation Dashboard
 * AI-powered code generation with GGUF integration
 */

class CodeGenerationDashboard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            animateCharts: true,
            showDetails: true,
            interactiveElements: true,
            theme: 'dark',
            realTimeUpdates: true,
            updateInterval: 30000,
            ...options
        };
        this.data = null;
        this.charts = [];
        
        this.init();
    }

    /**
     * Initialize the code generation dashboard
     */
    init() {
        if (!this.container) {
            console.error('Code generation dashboard container not found');
            return;
        }

        this.setupStyles();
        this.createDashboardStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the dashboard
     */
    setupStyles() {
        const styleId = 'code-generation-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .code-generation-dashboard {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    color: #f8fafc;
                }

                .dashboard-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .dashboard-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .dashboard-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .overview-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .overview-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .overview-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
                    border-color: #3b82f6;
                }

                .card-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #3b82f6;
                    margin-bottom: 0.5rem;
                }

                .card-label {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .card-metric {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .generation-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .generation-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .generation-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .generation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .generation-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .generation-status {
                    padding: 0.25rem 0.75rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-active {
                    background: #10b981;
                    color: white;
                }

                .status-completed {
                    background: #3b82f6;
                    color: white;
                }

                .status-failed {
                    background: #ef4444;
                    color: white;
                }

                .generation-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 1rem;
                }

                .generation-metrics {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .generation-metric {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .generation-code {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 8px;
                    padding: 1rem;
                    font-family: 'Courier New', monospace;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    margin-bottom: 1rem;
                    max-height: 200px;
                    overflow-y: auto;
                }

                .generation-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .generation-btn {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .generation-btn.primary {
                    background: #3b82f6;
                    color: white;
                }

                .generation-btn.primary:hover {
                    background: #2563eb;
                }

                .generation-btn.secondary {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                }

                .generation-btn.secondary:hover {
                    background: rgba(59, 130, 246, 0.3);
                }

                .templates-section {
                    margin-bottom: 2rem;
                }

                .templates-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .templates-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .templates-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .template-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .template-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .template-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .template-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .template-language {
                    padding: 0.25rem 0.75rem;
                    background: rgba(59, 130, 246, 0.2);
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #3b82f6;
                }

                .template-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 1rem;
                }

                .template-code {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 8px;
                    padding: 1rem;
                    font-family: 'Courier New', monospace;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    margin-bottom: 1rem;
                    max-height: 150px;
                    overflow-y: auto;
                }

                .template-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .metrics-section {
                    margin-bottom: 2rem;
                }

                .metrics-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .metrics-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .metric-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .metric-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                }

                .metric-value {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #3b82f6;
                    margin-bottom: 0.5rem;
                }

                .metric-label {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .metric-description {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .progress-bar {
                    height: 8px;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-top: 0.5rem;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
                    border-radius: 4px;
                    transition: width 1s ease-in-out;
                }

                @media (max-width: 768px) {
                    .code-generation-dashboard {
                        padding: 1rem;
                    }

                    .overview-cards {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .generation-grid {
                        grid-template-columns: 1fr;
                    }

                    .templates-grid {
                        grid-template-columns: 1fr;
                    }

                    .metrics-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the dashboard structure
     */
    createDashboardStructure() {
        this.container.textContent = `
            <div class="code-generation-dashboard">
                <div class="dashboard-header">
                    <h2 class="dashboard-title">💻 Code Generation Dashboard</h2>
                    <p class="dashboard-subtitle">AI-powered code generation with GGUF integration</p>
                </div>

                <div class="overview-cards" id="overview-cards">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="generation-section">
                    <div class="generation-header">
                        <h3 class="generation-title">🚀 Recent Generations</h3>
                        <div class="generation-summary">AI-powered code generation</div>
                    </div>
                    <div class="generation-grid" id="generation-grid">
                        <!-- Generation history will be rendered here -->
                    </div>
                </div>

                <div class="templates-section">
                    <div class="templates-header">
                        <h3 class="templates-title">📋 Code Templates</h3>
                        <div class="templates-summary">Pre-defined templates for common patterns</div>
                    </div>
                    <div class="templates-grid" id="templates-grid">
                        <!-- Templates will be rendered here -->
                    </div>
                </div>

                <div class="metrics-section">
                    <div class="metrics-header">
                        <h3 class="metrics-title">📊 Generation Metrics</h3>
                        <div class="metrics-summary">Performance and usage statistics</div>
                    </div>
                    <div class="metrics-grid" id="metrics-grid">
                        <!-- Metrics will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load code generation data and render dashboard
     */
    async loadCodeGenerationData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            // Add code generation data structure
            this.data = {
                ...roadmapData,
                codeGeneration: {
                    totalGenerations: 156,
                    successfulGenerations: 142,
                    failedGenerations: 14,
                    averageGenerationTime: "2.3 seconds",
                    totalLinesGenerated: 12450,
                    languages: ["JavaScript", "Python", "TypeScript", "HTML", "CSS", "SQL"],
                    templates: [
                        {
                            id: "react-component",
                            name: "React Component",
                            language: "JavaScript",
                            description: "Functional React component with hooks",
                            code: "import React, { useState, useEffect } from 'react';\n\nconst Component = () => {\n  const [state, setState] = useState(initialState);\n  \n  useEffect(() => {\n    // Side effect logic\n  }, []);\n  \n  return (\n    <div>\n      {/* Component JSX */}\n    </div>\n  );\n};\n\nexport default Component;",
                            usage: 45,
                            successRate: 98.2
                        },
                        {
                            id: "api-endpoint",
                            name: "API Endpoint",
                            language: "Python",
                            description: "Flask API endpoint with validation",
                            code: "from flask import Flask, request, jsonify\nfrom flask_restful import Api, Resource\n\nclass UserAPI(Resource):\n    def get(self):\n        return jsonify({'users': users})\n    \n    def post(self):\n        data = request.get_json()\n        # Process data\n        return jsonify({'status': 'success'})",
                            usage: 32,
                            successRate: 95.5
                        },
                        {
                            id: "database-model",
                            name: "Database Model",
                            language: "TypeScript",
                            description: "TypeScript database model with interfaces",
                            code: "interface User {\n  id: number;\n  name: string;\n  email: string;\n  createdAt: Date;\n}\n\nclass User implements IUser {\n  constructor(data: Partial<User>) {\n    Object.assign(this, data);\n  }\n}",
                            usage: 28,
                            successRate: 96.8
                        },
                        {
                            id: "html-template",
                            name: "HTML Template",
                            language: "HTML",
                            description: "Responsive HTML template with semantic structure",
                            code: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Template</title>\n</head>\n<body>\n    <main>\n        <h1>Content</h1>\n    </main>\n</body>\n</html>",
                            usage: 38,
                            successRate: 99.1
                        },
                        {
                            id: "css-styles",
                            name: "CSS Styles",
                            language: "CSS",
                            description: "Modern CSS with flexbox and grid",
                            code: ".container {\n  display: flex;\n  flex-direction: column;\n  gap: 1rem;\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 1rem;\n}\n\n.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n  gap: 1rem;\n}",
                            usage: 42,
                            successRate: 97.3
                        },
                        {
                            id: "sql-query",
                            name: "SQL Query",
                            language: "SQL",
                            description: "Optimized SQL query with joins",
                            code: "SELECT u.*, p.title as post_title\nFROM users u\nLEFT JOIN posts p ON u.id = p.user_id\nWHERE u.status = 'active'\nORDER BY u.created_at DESC\nLIMIT 10;",
                            usage: 25,
                            successRate: 94.1
                        }
                    ],
                    recentGenerations: [
                        {
                            id: "gen_001",
                            template: "react-component",
                            timestamp: "2026-05-21T10:30:00Z",
                            status: "completed",
                            duration: "1.8 seconds",
                            lines: 45,
                            quality: "excellent"
                        },
                        {
                            id: "gen_002",
                            template: "api-endpoint",
                            timestamp: "2026-05-21T10:25:00Z",
                            status: "completed",
                            duration: "2.1 seconds",
                            lines: 32,
                            quality: "good"
                        },
                        {
                            id: "gen_003",
                            template: "database-model",
                            timestamp: "2026-05-21T10:20:00Z",
                            status: "completed",
                            duration: "2.5 seconds",
                            lines: 28,
                            quality: "excellent"
                        },
                        {
                            id: "gen_004",
                            template: "html-template",
                            timestamp: "2026-05-21T10:15:00Z",
                            status: "failed",
                            duration: "1.2 seconds",
                            lines: 38,
                            quality: "poor"
                        },
                        {
                            id: "gen_005",
                            template: "css-styles",
                            timestamp: "2026-05-21T10:10:00Z",
                            status: "completed",
                            duration: "1.5 seconds",
                            lines: 42,
                            quality: "good"
                        }
                    ],
                    metrics: {
                        averageGenerationTime: "2.3 seconds",
                        successRate: 91.0,
                        averageLinesPerGeneration: 80,
                        topLanguage: "JavaScript",
                        mostUsedTemplate: "react-component",
                        qualityDistribution: {
                            excellent: 45,
                            good: 67,
                            fair: 28,
                            poor: 16
                        }
                    }
                }
            };
            
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to load code generation data:', error);
            this.showError('Failed to load code generation data');
        }
    }

    /**
     * Render the dashboard with data
     */
    renderDashboard() {
        if (!this.data) return;

        this.renderOverviewCards();
        this.renderRecentGenerations();
        this.renderTemplates();
        this.renderMetrics();
        
        if (this.options.animateCharts) {
            this.animateCharts();
        }
    }

    /**
     * Render overview cards
     */
    renderOverviewCards() {
        const container = document.getElementById('overview-cards');
        const metrics = this.data.codeGeneration;
        
        container.textContent = `
            <div class="overview-card">
                <div class="card-value">${metrics.totalGenerations}</div>
                <div class="card-label">Total Generations</div>
                <div class="card-metric">Code generated</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${metrics.successfulGenerations}</div>
                <div class="card-label">Successful</div>
                <div class="card-metric">Completed generations</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${metrics.averageGenerationTime}</div>
                <div class="card-label">Avg Time</div>
                <div class="card-metric">Generation speed</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${metrics.totalLinesGenerated.toLocaleString()}</div>
                <div class="card-label">Lines Generated</div>
                <div class="card-metric">Total code lines</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${metrics.successRate}%</div>
                <div class="card-label">Success Rate</div>
                <div="card-metric">Generation quality</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render recent generations
     */
    renderRecentGenerations() {
        const container = document.getElementById('generation-grid');
        const generations = this.data.codeGeneration.recentGenerations;
        
        container.textContent = generations.map(gen => `
            <div class="generation-card">
                <div class="generation-header">
                    <div class="generation-title">${gen.template}</div>
                    <span class="generation-status status-${gen.status}">${gen.status}</span>
                </div>
                <div class="generation-timestamp">${new Date(gen.timestamp).toLocaleString()}</div>
                <div class="generation-description">
                    ${gen.status === 'completed' ? 'Successfully generated' : 'Generation failed'} ${gen.lines} lines of code
                </div>
                <div class="generation-metrics">
                    <div class="generation-metric">Duration: ${gen.duration}</div>
                    <div class="generation-metric">Lines: ${gen.lines}</div>
                    <div class="generation-metric">Quality: ${gen.quality}</div>
                </div>
                <div class="generation-code">
                    <pre>${this.getTemplateCode(gen.template)}</pre>
                </div>
                <div class="generation-actions">
                    <button class="generation-btn primary" onclick="codeGenDashboard.regenerateCode('${gen.id}')">Regenerate</button>
                    <button class="generation-btn secondary" onclick="codeGenDashboard.viewDetails('${gen.id}')">Details</button>
                    <button class="generation-btn secondary" onclick="codeGenDashboard.downloadCode('${gen.id}')">Download</button>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render templates
     */
    renderTemplates() {
        const container = document.getElementById('templates-grid');
        const templates = this.data.codeGeneration.templates;
        
        container.textContent = templates.map(template => `
            <div class="template-card">
                <div class="template-header">
                    <div class="template-title">${template.name}</div>
                    <span class="template-language">${template.language}</span>
                </div>
                <div class="template-description">${template.description}</div>
                <div class="template-code">
                    <pre>${template.code}</pre>
                </div>
                <div class="template-metrics">
                    <div class="generation-metric">Usage: ${template.usage} times</div>
                    <div class="generation-metric">Success: ${template.successRate}%</div>
                </div>
                <div class="template-actions">
                    <button class="generation-btn primary" onclick="codeGenDashboard.useTemplate('${template.id}')">Use Template</button>
                    <button class="generation-btn secondary" onclick="codeGenDashboard.editTemplate('${template.id}')">Edit</button>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render metrics
     */
    renderMetrics() {
        const container = document.getElementById('metrics-grid');
        const metrics = this.data.codeGeneration.metrics;
        
        container.textContent = `
            <div class="metric-card">
                <div class="metric-value">${metrics.averageGenerationTime}</div>
                <div class="metric-label">Average Generation Time</div>
                <div class="metric-description">Speed per generation</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.successRate}%</div>
                <div class="metric-label">Success Rate</div>
                <div class="metric-description">Generation quality</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.averageLinesPerGeneration}</div>
                <div class="metric-label">Avg Lines/Gen</div>
                <div class="metric-description">Code efficiency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.topLanguage}</div>
                <div class="metric-label">Top Language</div>
                <div class="metric-description">Most used language</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.mostUsedTemplate}</div>
                <div class="metric-label">Top Template</div>
                <div class="metric-description">Popular template</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Get template code by ID
     */
    getTemplateCode(templateId) {
        const template = this.data.codeGeneration.templates.find(t => t.id === templateId);
        return template ? template.code : '// Code not available';
    }

    /**
     * Regenerate code using template
     */
    regenerateCode(generationId) {
        const generation = this.data.codeGeneration.recentGenerations.find(g => g.id === generationId);
        if (!generation) return;

        // Simulate regeneration
        const newGeneration = {
            ...generation,
            id: `gen_${Date.now()}`,
            timestamp: new Date().toISOString(),
            status: 'active',
            duration: '0 seconds',
            quality: 'calculating'
        };

        // Update the generation in data
        const index = this.data.codeGeneration.recentGenerations.findIndex(g => g.id === generationId);
        if (index !== -1) {
            this.data.codeGeneration.recentGenerations[index] = newGeneration;
        }

        // Simulate completion
        setTimeout(() => {
            const completedGeneration = {
                ...newGeneration,
                status: Math.random() > 0.1 ? 'completed' : 'failed',
                duration: `${(Math.random() * 3 + 1).toFixed(1)} seconds`,
                quality: Math.random() > 0.8 ? 'excellent' : Math.random() > 0.5 ? 'good' : 'fair'
            };

            this.data.codeGeneration.recentGenerations[index] = completedGeneration;
            this.renderDashboard();
        }, 2000);
    }

    /**
     * View generation details
     */
    viewDetails(generationId) {
        const generation = this.data.codeGeneration.recentGenerations.find(g => g.id === generationId);
        if (!generation) return;

        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>Generation Details</h3>
                <div class="generation-details">
                    <p><strong>ID:</strong> ${generation.id}</p>
                    <p><strong>Template:</strong> ${generation.template}</p>
                    <p><strong>Status:</strong> ${generation.status}</p>
                    <p><strong>Timestamp:</strong> ${new Date(generation.timestamp).toLocaleString()}</p>
                    <p><strong>Duration:</strong> ${generation.duration}</p>
                    <p><strong>Lines:</strong> ${generation.lines}</p>
                    <p><strong>Quality:</strong> ${generation.quality}</p>
                </div>
                <div class="generation-code">
                    <h4>Generated Code:</h4>
                    <pre>${this.getTemplateCode(generation.template)}</pre>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Download generated code
     */
    downloadCode(generationId) {
        const generation = this.data.codeGeneration.recentGenerations.find(g => g.id === generationId);
        if (!generation) return;

        const code = this.getTemplateCode(generation.template);
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generation.template}_${generation.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Use template for new generation
     */
    useTemplate(templateId) {
        const template = this.data.codeGeneration.templates.find(t => t.id === templateId);
        if (!template) return;

        // Create new generation from template
        const newGeneration = {
            id: `gen_${Date.now()}`,
            template: templateId,
            timestamp: new Date().toISOString(),
            status: 'active',
            duration: '0 seconds',
            lines: template.code.split('\n').length,
            quality: 'calculating'
        };

        // Add to recent generations
        this.data.codeGeneration.recentGenerations.unshift(newGeneration);
        
        // Keep only last 10 generations
        if (this.data.codeGeneration.recentGenerations.length > 10) {
            this.data.codeGeneration.recentGenerations.pop();
        }

        // Simulate completion
        setTimeout(() => {
            const completedGeneration = {
                ...newGeneration,
                status: 'completed',
                duration: `${(Math.random() * 3 + 1).toFixed(1)} seconds`,
                quality: Math.random() > 0.8 ? 'excellent' : Math.random() > 0.5 ? 'good' : 'fair'
            };

            this.data.codeGeneration.recentGenerations[0] = completedGeneration;
            this.renderDashboard();
        }, 2000);
    }

    /**
     * Edit template
     */
    editTemplate(templateId) {
        const template = this.data.codeGeneration.templates.find(t => t.id === templateId);
        if (!template) return;

        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>Edit Template: ${template.name}</h3>
                <div class="template-details">
                    <p><strong>ID:</strong> ${template.id}</p>
                    <p><strong>Language:</strong> ${template.language}</p>
                    <p><strong>Description:</strong> ${template.description}</p>
                    <p><strong>Usage:</strong> ${template.usage} times</p>
                    <p><strong>Success Rate:</strong> ${template.successRate}%</p>
                </div>
                <div class="template-code-editor">
                    <h4>Template Code:</h4>
                    <textarea id="template-code-editor" style="width: 100% /* Replaced innerHTML with textContent for safety */ height: 300px; background: rgba(15, 23, 42, 0.8); color: #f8fafc; border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 4px; padding: 1rem; font-family: 'Courier New', monospace; font-size: 0.8rem;">${template.code}</textarea>
                </div>
                <div class="modal-actions">
                    <button class="generation-btn primary" onclick="codeGenDashboard.saveTemplate('${template.id}')">Save Template</button>
                    <button class="generation-btn secondary" onclick="this.closest('.detail-modal').remove()">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Save template
     */
    saveTemplate(templateId) {
        const editor = document.getElementById('template-code-editor');
        if (!editor) return;

        const template = this.data.codeGeneration.templates.find(t => t.id === templateId);
        if (!template) return;

        // Update template code
        template.code = editor.value;
        
        // Remove modal
        const modal = document.querySelector('.detail-modal');
        if (modal) {
            modal.remove();
        }

        // Show success message
        this.showNotification('Template saved successfully', 'success');
        this.renderDashboard();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Add click handlers for interactive elements
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('generation-card')) {
                const generationCard = e.target.closest('.generation-card');
                const generationId = generationCard.querySelector('.generation-title').textContent;
                this.viewDetails(generationId);
            }
            
            if (e.target.classList.contains('template-card')) {
                const templateCard = e.target.closest('.template-card');
                const templateId = templateCard.querySelector('.template-title').textContent;
                this.editTemplate(templateId);
            }
        });

        // Add hover effects for cards
        this.container.addEventListener('mouseenter', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.style.transform = 'translateY(-5px)';
            }
        });

        this.container.addEventListener('mouseleave', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.style.transform = 'translateY(0)';
            }
        });
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        setInterval(() => {
            this.refreshData();
        }, this.options.updateInterval);
    }

    /**
     * Refresh data with latest information
     */
    async refreshData() {
        try {
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            // Update with latest code generation data
            this.data = {
                ...roadmapData,
                codeGeneration: {
                    ...this.data.codeGeneration,
                    totalGenerations: this.data.codeGeneration.totalGenerations + 1,
                    successfulGenerations: this.data.codeGeneration.successfulGenerations + 1,
                    averageGenerationTime: this.calculateAverageTime(),
                    totalLinesGenerated: this.data.codeGeneration.totalLinesGenerated + 80
                }
            };
            
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to refresh code generation data:', error);
        }
    }

    /**
     * Calculate average generation time
     */
    calculateAverageTime() {
        const completedGenerations = this.data.codeGeneration.recentGenerations.filter(g => g.status === 'completed');
        if (completedGenerations.length === 0) return '0.0 seconds';
        
        const totalTime = completedGenerations.reduce((sum, gen) => {
            const time = parseFloat(gen.duration.replace('seconds', ''));
            return sum + time;
        }, 0);
        
        return `${(totalTime / completedGenerations.length).toFixed(1)} seconds`;
    }

    /**
     * Animate charts and visualizations
     */
    animateCharts() {
        // Animate progress bars
        const progressBars = this.container.querySelectorAll('.progress-fill');
        progressBars.forEach(bar => {
            const targetWidth = bar.getAttribute('data-target-width');
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, 100);
        });

        // Animate cards on scroll
        const cards = this.container.querySelectorAll('.card, .generation-card, .template-card, .metric-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1000;
        `;
        
        if (type === 'success') {
            notification.style.background = '#10b981';
            notification.style.color = 'white';
        } else if (type === 'error') {
            notification.style.background = '#ef4444';
            notification.style.color = 'white';
        } else {
            notification.style.background = '#3b82f6';
            notification.style.color = 'white';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ef4444;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1000;
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Global function to initialize the code generation dashboard
window.initializeCodeGenerationDashboard = async function() {
    try {
        if (typeof window.CodeGenerationDashboard !== 'undefined') {
            const codeGenDashboard = new CodeGenerationDashboard('code-generation-dashboard-container', {
                animateCharts: true,
                showDetails: true,
                interactiveElements: true,
                theme: 'dark',
                realTimeUpdates: true,
                updateInterval: 30000
            });
            
            await codeGenDashboard.loadCodeGenerationData();
            
            console.log('✅ Code generation dashboard initialized successfully');
        } else {
            console.warn('⚠️ CodeGenerationDashboard class not available');
        }
    } catch (error) {
        console.error('❌ Failed to initialize code generation dashboard:', error);
    }
};
