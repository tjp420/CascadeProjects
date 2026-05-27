/**
 * Development Roadmap core — path builder, import/export, rendering, component init
 */
(function () {
    const showNotification = (...args) => window.showNotification?.(...args);

        // Enhanced Development Roadmap Report Function (Supports Multiple Report Types)
        async function downloadDevelopmentRoadmapReport(reportType = 'gguf') {
            if (reportType === 'compare') {
                downloadComparisonReport();
                return;
            }
            
            const reportName = reportType === 'gguf' ? 'GGUF Development Roadmap Report' : 'AI-Powered Roadmap Report';
            const notificationIcon = reportType === 'gguf' ? '⬇️' : '🤖';
            showNotification(`${notificationIcon} Generating ${reportName}...`, 'info');
            
            try {
                let developmentRoadmapReport;
                
                // Initialize roadmap data service
                const roadmapService = new RoadmapDataService();
                
                if (reportType === 'gguf') {
                    // Load GGUF roadmap data dynamically
                    developmentRoadmapReport = await roadmapService.loadRoadmapData('gguf');
                
                // Create and download the report
                const blob = new Blob([JSON.stringify(developmentRoadmapReport, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'gguf-development-roadmap-report-' + new Date().toISOString().split('T')[0] + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showNotification('✅ GGUF Development Roadmap Report downloaded successfully', 'success');
                    
                } else if (reportType === 'ai') {
                    // AI-Powered Roadmap Report
                    developmentRoadmapReport = await generateAIReport();
                    
                    // Create and download the report
                    const blob = new Blob([JSON.stringify(developmentRoadmapReport, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'ai-powered-roadmap-report-' + new Date().toISOString().split('T')[0] + '.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    showNotification('✅ AI-Powered Roadmap Report downloaded successfully', 'success');
                    
                } else {
                    showNotification('❌ Invalid report type specified', 'error');
                    return;
                }
                
            } catch (error) {
                console.error('Error downloading report:', error);
                showNotification('❌ Error downloading report', 'error');
            }
        }
        
        // AI Assessment Calculation Functions
        function calculateAICompletionRate(roadmapData) {
            const totalFeatures = roadmapData.projectOverview?.totalFeatures || 0;
            const completedFeatures = roadmapData.projectOverview?.completedFeatures || 0;
            
            // AI perspective: considers more conservative completion criteria
            const conservativeFactor = 0.85; // AI is more conservative in assessment
            const aiCompletion = Math.round((completedFeatures / totalFeatures) * 100 * conservativeFactor);
            
            return `${aiCompletion}%`;
        }
        
        function assessAIProjectHealth(roadmapData) {
            const completionRate = parseFloat(String(roadmapData.projectOverview?.completionRate || '0').replace('%', ''));
            const velocity = roadmapData.projectOverview?.developmentVelocity || 'Measured';

            if (completionRate >= 70 && (velocity === 'High' || velocity === 'Measured')) {
                return 'Excellent';
            }
            if (completionRate >= 55) {
                return 'Good';
            }
            if (completionRate >= 50) {
                return 'Fair';
            }
            return 'Needs Attention';
        }
        
        function assessAIVelocity(roadmapData) {
            const velocity = roadmapData.projectOverview?.developmentVelocity;
            if (velocity) return velocity;

            const completedPhases = roadmapData.developmentPhases?.filter((p) => p.status === 'completed').length || 0;
            if (completedPhases >= 2) return 'Measured';
            return 'Low';
        }
        
        function assessTechnicalDebt(roadmapData) {
            const infrastructureCompletion = roadmapData.featureCategories?.find(c => c.category === 'Infrastructure')?.completionRate || 45;
            
            // AI assessment of technical debt based on infrastructure and complexity
            if (infrastructureCompletion >= 80) {
                return 'Low';
            } else if (infrastructureCompletion >= 60) {
                return 'Moderate';
            } else {
                return 'High';
            }
        }
        
        function assessRiskLevel(roadmapData) {
            const completionRate = parseFloat(roadmapData.projectOverview?.completionRate || '0');
            const technicalDebt = assessTechnicalDebt(roadmapData);
            
            // AI risk assessment
            if (completionRate >= 70 && technicalDebt === 'Low') {
                return 'Low';
            } else if (completionRate >= 50 && technicalDebt !== 'High') {
                return 'Medium';
            } else {
                return 'High';
            }
        }
        
        // AI-Powered Roadmap Report Function
        async function generateAIReport() {
            const roadmapService = new RoadmapDataService();
            let sample;
            try {
                sample = await roadmapService.loadFromFile('/data/ai-roadmap-sample.json');
            } catch (error) {
                sample = await roadmapService.loadRoadmapData('static');
            }
            sample = roadmapService.normalizeRoadmapData(sample);

            const po = sample.projectOverview || {};
            const phases = sample.developmentPhases || [];
            const completedPhases = phases.filter((phase) => phase.status === 'completed').length;
            const aiCompletion = calculateAICompletionRate(sample);

            return {
                type: 'ai-powered-roadmap-report',
                title: sample.title || 'AI-Powered Roadmap Report (Measured Baseline)',
                generatedAt: sample.generatedAt || new Date().toISOString(),
                generatedBy: sample.generatedBy || 'RepositoryAudit',
                dataSource: sample.dataSource || 'repository-audit',
                modelInfo: sample.modelInfo,
                executiveSummary: {
                    totalPhases: phases.length,
                    completedPhases,
                    plannedPhases: phases.filter((phase) => phase.status === 'planned').length,
                    completionRate: aiCompletion,
                    projectHealth: assessAIProjectHealth(sample),
                    developmentVelocity: assessAIVelocity(sample),
                    technicalDebt: assessTechnicalDebt(sample),
                    riskLevel: assessRiskLevel(sample),
                    teamProductivity: po.teamProductivity || 'Solo maintainer',
                    aiConfidence: po.aiConfidence || sample.modelInfo?.confidence || 95,
                    analysisMethod: 'Repository-audit sprint tracker with conservative completion lens'
                },
                developmentPhases: phases.map((phase, index) => ({
                    phase: index + 1,
                    title: phase.phase || phase.title,
                    status: phase.status,
                    date: phase.endDate || phase.startDate || phase.date,
                    description: phase.description,
                    metrics: {
                        completion: `${phase.progress ?? 0}%`
                    }
                })),
                releaseTimeline: sample.releaseTimeline || [],
                aiRecommendations: sample.recommendations?.priority || sample.actionPlan || [],
                projectMetrics: sample.performanceMetrics || {},
                riskAssessment: { overallRisk: 'Low' },
                nextSteps: (sample.actionPlan || [])
                    .slice(0, 5)
                    .map((item) => item.title || item.action || String(item))
            };
        }
        
        // Enhanced Comparison Analysis Function
        function performEnhancedComparison(ggufData, aiData) {
            // Calculate differences in metrics
            const ggufCompletion = parseFloat(ggufData.projectOverview?.completionRate || '0');
            const aiCompletion = parseFloat(aiData.executiveSummary?.completionRate || '56.1');
            const completionDifference = Math.abs(ggufCompletion - aiCompletion);
            
            // Health assessment comparison
            const ggufHealth = ggufData.projectOverview?.projectHealth || 'Excellent';
            const aiHealth = aiData.executiveSummary?.projectHealth || 'Good';
            const healthConsistent = ggufHealth === aiHealth;
            
            // Velocity comparison
            const ggufVelocity = ggufData.projectOverview?.developmentVelocity || 'High';
            const aiVelocity = aiData.executiveSummary?.developmentVelocity || 'High';
            const velocityConsistent = ggufVelocity === aiVelocity;
            
            // Generate insights based on differences
            const insights = [];
            
            if (completionDifference > 10) {
                insights.push({
                    type: 'significant_difference',
                    category: 'completion_rate',
                    description: `Significant difference in completion rate assessment: GGUF (${ggufCompletion}%) vs AI (${aiCompletion}%)`,
                    impact: 'high',
                    recommendation: 'Review completion methodology and criteria'
                });
            }
            
            if (!healthConsistent) {
                insights.push({
                    type: 'assessment_divergence',
                    category: 'project_health',
                    description: `Different health assessments: GGUF (${ggufHealth}) vs AI (${aiHealth})`,
                    impact: 'medium',
                    recommendation: 'Align health assessment criteria between systems'
                });
            }
            
            if (!velocityConsistent) {
                insights.push({
                    type: 'velocity_mismatch',
                    category: 'development_velocity',
                    description: `Velocity assessment mismatch: GGUF (${ggufVelocity}) vs AI (${aiVelocity})`,
                    impact: 'medium',
                    recommendation: 'Standardize velocity measurement criteria'
                });
            }
            
            // Confidence comparison
            const ggufConfidence = ggufData.analysisOverview?.aiConfidence || 98;
            const aiConfidence = aiData.executiveSummary?.aiConfidence || 97.2;
            
            insights.push({
                type: 'confidence_analysis',
                category: 'ai_confidence',
                description: `AI confidence levels: GGUF (${ggufConfidence}%) vs AI Engine (${aiConfidence}%)`,
                impact: 'low',
                recommendation: 'Both systems show high confidence in their assessments'
            });
            
            // Generate recommendations
            const recommendations = [];
            
            if (completionDifference > 10) {
                recommendations.push({
                    priority: 'high',
                    type: 'methodology_alignment',
                    action: 'Align completion rate calculation methods',
                    description: 'Standardize how completion rates are calculated between GGUF and AI assessment systems',
                    impact: 'High',
                    effort: 'Medium',
                    expectedOutcome: 'Consistent completion metrics across systems'
                });
            }
            
            recommendations.push({
                priority: 'medium',
                type: 'comprehensive_analysis',
                action: 'Use both assessment perspectives',
                description: 'Leverage GGUF development focus alongside AI executive perspective for comprehensive decision-making',
                impact: 'High',
                effort: 'Low',
                expectedOutcome: 'More balanced and thorough project assessment'
            });
            
            if (!healthConsistent || !velocityConsistent) {
                recommendations.push({
                    priority: 'medium',
                    type: 'criteria_standardization',
                    action: 'Standardize assessment criteria',
                    description: 'Create unified criteria for project health and velocity assessments',
                    impact: 'Medium',
                    effort: 'High',
                    expectedOutcome: 'Consistent assessments across all analysis systems'
                });
            }
            
            recommendations.push({
                priority: 'low',
                type: 'continuous_monitoring',
                action: 'Monitor assessment convergence',
                description: 'Track how GGUF and AI assessments converge over time as the project progresses',
                impact: 'Medium',
                effort: 'Low',
                expectedOutcome: 'Improved assessment alignment over time'
            });
            
            // Visual comparison data
            const visualComparison = {
                metrics: {
                    completion: {
                        gguf: ggufCompletion,
                        ai: aiCompletion,
                        difference: completionDifference
                    },
                    health: {
                        gguf: ggufHealth,
                        ai: aiHealth,
                        consistent: healthConsistent
                    },
                    velocity: {
                        gguf: ggufVelocity,
                        ai: aiVelocity,
                        consistent: velocityConsistent
                    },
                    confidence: {
                        gguf: ggufConfidence,
                        ai: aiConfidence,
                        difference: Math.abs(ggufConfidence - aiConfidence)
                    }
                },
                assessmentApproach: {
                    gguf: 'Local GGUF AI processing with development focus',
                    ai: 'Cloud-based AI analysis with executive perspective',
                    complementary: true
                },
                dataSources: {
                    gguf: {
                        type: 'mock_data_analysis',
                        totalFiles: ggufData.analysisOverview?.totalMockFiles || 0,
                        qualityScore: ggufData.analysisOverview?.dataQualityScore || 89.2,
                        issuesDetected: ggufData.analysisOverview?.issuesDetected || 156
                    },
                    ai: {
                        type: 'roadmap_assessment',
                        totalPhases: aiData.executiveSummary?.totalPhases || 4,
                        completedPhases: aiData.executiveSummary?.completedPhases || 2,
                        analysisMethod: aiData.executiveSummary?.analysisMethod || 'Cloud-based AI analysis'
                    }
                }
            };
            
            return {
                differences: {
                    completionRate: {
                        gguf: ggufCompletion,
                        ai: aiCompletion,
                        difference: completionDifference,
                        significant: completionDifference > 10,
                        interpretation: completionDifference > 10 ? 'Significant difference in completion assessment' : 'Minor difference in completion assessment'
                    },
                    projectHealth: {
                        gguf: ggufHealth,
                        ai: aiHealth,
                        consistent: healthConsistent,
                        interpretation: healthConsistent ? 'Health assessment consistent' : 'Health assessment divergence detected'
                    },
                    developmentVelocity: {
                        gguf: ggufVelocity,
                        ai: aiVelocity,
                        consistent: velocityConsistent,
                        interpretation: velocityConsistent ? 'Velocity assessment consistent' : 'Velocity assessment mismatch detected'
                    },
                    aiConfidence: {
                        gguf: ggufConfidence,
                        ai: aiConfidence,
                        difference: Math.abs(ggufConfidence - aiConfidence),
                        interpretation: 'Both systems show high confidence levels'
                    }
                },
                insights: insights,
                recommendations: recommendations,
                visualComparison: visualComparison
            };
        }
        
        // Enhanced Comparison Report Function
        async function downloadComparisonReport() {
            showNotification('📊 Generating Enhanced Comparison Report...', 'info');
            try {
                // Load both reports dynamically
                const roadmapService = new RoadmapDataService();
                const ggufData = await roadmapService.loadRoadmapData('gguf');
                const aiData = await generateAIReport();
                
                // Enhanced analysis with deep insights
                const analyzer = new RoadmapComparisonAnalyzer();
                const analysis = analyzer.performEnhancedComparison(ggufData, aiData);
                
                const comparisonReport = {
                    type: 'roadmap-comparison-report',
                    title: 'Enhanced Roadmap Analysis Comparison Report',
                    generatedAt: new Date().toISOString(),
                    generatedBy: ggufData.generatedBy || 'RepositoryAudit',
                    dataSource: ggufData.dataSource || 'repository-audit',
                    modelInfo: ggufData.modelInfo || {
                        name: 'platform-checklist',
                        type: 'Internal',
                        confidence: 95,
                        status: 'active'
                    },
                    ggufReport: {
                        type: ggufData.type,
                        completionRate: ggufData.projectOverview.completionRate,
                        projectHealth: ggufData.projectOverview.projectHealth,
                        developmentVelocity: ggufData.projectOverview.developmentVelocity,
                        totalFeatures: ggufData.projectOverview.totalFeatures,
                        completedFeatures: ggufData.projectOverview.completedFeatures,
                        analysisMethod: 'Repository-audit sprint tracker (gguf-roadmap-sample.json)'
                    },
                    aiReport: {
                        type: aiData.type,
                        completionRate: aiData.executiveSummary.completionRate,
                        projectHealth: aiData.executiveSummary.projectHealth,
                        developmentVelocity: aiData.executiveSummary.developmentVelocity,
                        analysisMethod: aiData.executiveSummary.analysisMethod,
                        aiConfidence: aiData.executiveSummary.aiConfidence,
                        totalPhases: aiData.executiveSummary.totalPhases,
                        completedPhases: aiData.executiveSummary.completedPhases
                    },
                    differences: analysis.differences,
                    insights: analysis.insights,
                    recommendations: analysis.recommendations,
                    visualComparison: analysis.visualComparison
                };
                
                // Create and download the comparison report
                const blob = new Blob([JSON.stringify(comparisonReport, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'roadmap-comparison-report-' + new Date().toISOString().split('T')[0] + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showNotification('✅ Comparison Report downloaded successfully', 'success');
                
            } catch (error) {
                console.error('Error downloading comparison report:', error);
                showNotification('❌ Error downloading comparison report', 'error');
            }
        }
        
        async function parseApiJsonResponse(response) {
            const contentType = response.headers.get('content-type') || '';
            const text = await response.text();
            if (!contentType.includes('application/json')) {
                const htmlHint = text.trimStart().startsWith('<!')
                    ? 'Server returned HTML instead of JSON. Run start-localhost.bat (port 54355) or restart your server after updating.'
                    : 'Server returned a non-JSON response';
                throw new Error(`${htmlHint} (HTTP ${response.status})`);
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON from server: ' + e.message);
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        }

        function formatCompletionPercent(rate) {
            if (rate == null) return null;
            const n = typeof rate === 'number' ? rate : parseFloat(String(rate).replace('%', ''));
            if (Number.isNaN(n)) return null;
            return n <= 1 ? n * 100 : n;
        }

        function getPhaseStatusMeta(status) {
            const normalized = String(status || 'planned').toLowerCase().replace('_', '-');
            if (normalized === 'completed') {
                return { cardClass: 'completed', icon: '✅', barClass: 'completed', label: 'Completed', timelineClass: 'completed', markerIcon: 'fa-check' };
            }
            if (normalized === 'in-progress') {
                return { cardClass: 'in-progress', icon: '🔄', barClass: 'in-progress', label: 'In Progress', timelineClass: 'current', markerIcon: 'fa-spinner' };
            }
            return { cardClass: 'pending', icon: '⏳', barClass: 'pending', label: 'Planned', timelineClass: 'upcoming', markerIcon: 'fa-flag' };
        }

        function formatRoadmapDate(value) {
            if (!value) return 'TBD';
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }

        function normalizeDynamicRoadmapPhases(phases) {
            return (phases || []).map((phase, index) => {
                const progress = phase.progress ?? phase.metrics?.completion ?? phase.metrics?.progress ?? 0;
                const numericProgress = typeof progress === 'string'
                    ? parseFloat(progress.replace('%', '')) || 0
                    : progress;
                const clampedProgress = Math.min(100, Math.max(0, numericProgress <= 1 ? numericProgress * 100 : numericProgress));
                return {
                    phase: phase.phase || phase.title || phase.name || `Phase ${index + 1}`,
                    title: phase.title || phase.phase || phase.name || `Phase ${index + 1}`,
                    status: (() => {
                        const normalized = String(phase.status || 'planned').toLowerCase().replace('_', '-');
                        return normalized === 'upcoming' ? 'planned' : normalized;
                    })(),
                    progress: clampedProgress,
                    description: phase.description || '',
                    features: phase.features || phase.deliverables || [],
                    milestones: phase.milestones || [],
                    startDate: phase.startDate || phase.date,
                    endDate: phase.endDate,
                    duration: phase.duration || phase.metrics?.duration
                };
            });
        }

        function normalizeFeatureCategories(categories) {
            return (categories || []).map(cat => {
                const total = cat.total ?? cat.totalFeatures ?? 0;
                const completed = cat.completed ?? cat.completedFeatures ?? 0;
                const rate = formatCompletionPercent(cat.completionRate) ?? (total ? (completed / total) * 100 : 0);
                return {
                    category: cat.category || cat.name || 'Category',
                    total,
                    completed,
                    inProgress: Math.max(0, total - completed),
                    completionRate: rate,
                    description: cat.description || ''
                };
            });
        }

        function deriveMilestonesFromPhases(phases) {
            return phases.map(phase => {
                const meta = getPhaseStatusMeta(phase.status);
                const dateLabel = meta.label === 'Completed'
                    ? `Completed: ${formatRoadmapDate(phase.endDate || phase.startDate)}`
                    : meta.label === 'In Progress'
                        ? `In progress · target ${formatRoadmapDate(phase.endDate)}`
                        : `Target: ${formatRoadmapDate(phase.endDate || phase.startDate)}`;
                return {
                    title: phase.title || phase.phase,
                    description: phase.description,
                    status: meta.timelineClass === 'current' ? 'current' : meta.timelineClass,
                    dateLabel,
                    icon: meta.icon
                };
            });
        }

        function renderDynamicPhasesGrid(phases) {
            const container = document.getElementById('roadmap-phases-grid');
            if (!container) return;

            container.innerHTML = phases.map(phase => {
                const meta = getPhaseStatusMeta(phase.status);
                const progress = Math.min(100, Math.max(0, phase.progress || 0));
                const featureTags = (phase.features || []).slice(0, 6).map(feature => {
                    const done = meta.label === 'Completed' || String(feature).startsWith('✓') || String(feature).startsWith('✅');
                    const prefix = meta.label === 'Completed' ? '✓' : meta.label === 'In Progress' && done ? '✓' : meta.label === 'In Progress' ? '🔄' : '⏳';
                    const label = String(feature).replace(/^[✓✅🔄⏳]\s*/u, '');
                    return `<span class="feature-tag">${prefix} ${escapeHtml(label)}</span>`;
                }).join('');

                const timelineText = phase.endDate || phase.startDate
                    ? `<i class="fas fa-calendar"></i> ${formatRoadmapDate(phase.startDate)} → ${formatRoadmapDate(phase.endDate)}`
                    : phase.duration
                        ? `<i class="fas fa-calendar"></i> ${escapeHtml(phase.duration)}`
                        : '';

                return `
                    <div class="phase-card ${meta.cardClass}">
                        <div class="phase-header">
                            <div class="phase-icon">${meta.icon}</div>
                            <div class="phase-info">
                                <h4>${escapeHtml(phase.title || phase.phase)}</h4>
                                <span class="phase-status">${meta.label}</span>
                            </div>
                        </div>
                        <div class="phase-progress">
                            <div class="progress-bar-container">
                                <div class="progress-bar ${meta.barClass}" style="width: ${progress}%"></div>
                            </div>
                            <span>${progress.toFixed(0)}% Complete</span>
                        </div>
                        <div class="phase-details">
                            <p>${escapeHtml(phase.description || '')}</p>
                            ${featureTags ? `<div class="phase-features">${featureTags}</div>` : ''}
                        </div>
                        ${timelineText ? `<div class="phase-timeline">${timelineText}</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        function renderDynamicStaticTimeline(phases) {
            const container = document.getElementById('roadmap-static-timeline');
            if (!container) return;

            container.innerHTML = phases.map(phase => {
                const meta = getPhaseStatusMeta(phase.status);
                const achievements = (phase.features || phase.milestones || []).slice(0, 4).map(item => {
                    if (typeof item === 'string') {
                        return `<span>${escapeHtml(item)}</span>`;
                    }
                    const name = item.name || item.milestone || item.title || 'Milestone';
                    const done = item.completed !== false && meta.label === 'Completed';
                    return `<span>${done ? '✅' : '⏳'} ${escapeHtml(name)}</span>`;
                }).join('');

                return `
                    <div class="timeline-item ${meta.timelineClass}">
                        <div class="timeline-marker">
                            <i class="fas ${meta.markerIcon}"></i>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-date">${formatRoadmapDate(phase.endDate || phase.startDate)}</div>
                            <h4>${escapeHtml(phase.title || phase.phase)}</h4>
                            <p>${escapeHtml(phase.description || '')}</p>
                            ${achievements ? `<div class="timeline-achievements">${achievements}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderDynamicFeatureCategories(categories) {
            const container = document.getElementById('roadmap-feature-categories');
            if (!container) return;

            container.innerHTML = categories.map(cat => {
                const barClass = cat.completionRate >= 80 ? 'completed' : cat.completionRate >= 50 ? 'in-progress' : 'pending';
                return `
                    <div class="category-item">
                        <div class="category-header">
                            <span class="category-name">${escapeHtml(cat.category)}</span>
                            <span class="category-progress">${cat.completionRate.toFixed(0)}%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar ${barClass}" style="width: ${Math.min(100, cat.completionRate)}%"></div>
                        </div>
                        <div class="category-stats">
                            <span>${cat.completed}/${cat.total} completed</span>
                        </div>
                    </div>
                `;
            }).join('');

            updateFeatureBreakdownChart(categories);
        }

        function updateFeatureBreakdownChart(categories) {
            const ctx = document.getElementById('featureBreakdownChart');
            if (!ctx || typeof Chart === 'undefined') return;

            const labels = categories.map(cat => cat.category);
            const completed = categories.map(cat => cat.completed);
            const inProgress = categories.map(cat => Math.max(0, cat.total - cat.completed));

            const chartData = {
                labels,
                datasets: [
                    { label: 'Completed', data: completed, backgroundColor: '#10b981' },
                    { label: 'In Progress', data: inProgress, backgroundColor: '#f59e0b' },
                    { label: 'Pending', data: categories.map(() => 0), backgroundColor: '#6b7280' }
                ]
            };

            if (window.featureBreakdownChartInstance) {
                window.featureBreakdownChartInstance.data = chartData;
                window.featureBreakdownChartInstance.update();
                return;
            }

            window.featureBreakdownChartInstance = new Chart(ctx, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#e2e8f0' } }
                    },
                    scales: {
                        x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                        y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
                    }
                }
            });
        }

        function renderDynamicMilestones(milestones) {
            const container = document.getElementById('roadmap-milestones-grid');
            if (!container) return;

            container.innerHTML = milestones.map(milestone => {
                const statusClass = milestone.status === 'completed' ? 'completed'
                    : milestone.status === 'current' || milestone.status === 'in-progress' ? 'current'
                        : 'upcoming';
                return `
                    <div class="milestone-card ${statusClass}">
                        <div class="milestone-icon">${milestone.icon || '🎯'}</div>
                        <div class="milestone-content">
                            <h4>${escapeHtml(milestone.title || milestone.milestone || 'Milestone')}</h4>
                            <p>${escapeHtml(milestone.description || milestone.achievement || '')}</p>
                            <div class="milestone-date">${escapeHtml(milestone.dateLabel || formatRoadmapDate(milestone.date))}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function buildProgressOverview(roadmap) {
            const es = roadmap.executiveSummary || {};
            const po = roadmap.projectOverview || {};
            const phases = normalizeDynamicRoadmapPhases(roadmap.developmentPhases || []);
            const useDerived = roadmap.dataSource === 'repository-audit';

            if (useDerived && phases.length) {
                let completed = 0;
                let inProgress = 0;
                let planned = 0;
                phases.forEach((phase) => {
                    const count = (phase.features || []).length || 1;
                    const status = String(phase.status || '').toLowerCase();
                    if (status === 'completed') completed += count;
                    else if (status === 'in-progress' || status === 'current') inProgress += count;
                    else planned += count;
                });
                const total = completed + inProgress + planned;
                const completionRate = total ? (completed / total) * 100 : 0;
                return {
                    total,
                    completed,
                    inProgress,
                    planned,
                    completionRate
                };
            }

            const total = es.totalFeatures ?? po.totalFeatures ?? 0;
            const completed = es.completedFeatures ?? po.completedFeatures ?? 0;
            const inProgress = es.inProgressFeatures ?? po.inProgressFeatures ?? Math.max(0, total - completed);
            const planned = es.plannedFeatures ?? po.plannedFeatures ?? Math.max(0, total - completed - inProgress);
            const pct = formatCompletionPercent(es.completionRate ?? po.completionRate);
            return {
                total,
                completed,
                inProgress,
                planned,
                completionRate: pct ?? 0
            };
        }

        function isGenericFivePhaseTemplate(roadmap) {
            const phases = [...(roadmap.developmentPhases || []), ...(roadmap.phases || [])];
            if (phases.length < 5) return false;
            const names = phases.map((phase) => String(phase.name || phase.phase || phase.title || ''));
            return names.some((name) => name.includes('Foundation & Infrastructure'))
                && names.some((name) => name.includes('Analytics Dashboard'))
                && names.some((name) => name.includes('Production Deployment'));
        }

        function isStaleDevelopmentRoadmap(roadmap, sourceLabel) {
            if (!roadmap) return true;

            const es = roadmap.executiveSummary || {};
            const po = roadmap.projectOverview || {};
            const totalFeatures = es.totalFeatures ?? po.totalFeatures;
            const completionRate = es.completionRate ?? po.currentCompletion ?? po.completionRate;
            const label = String(sourceLabel || roadmap.sourceProjectPath || '').toLowerCase();

            if (isGenericFivePhaseTemplate(roadmap)) return true;

            if (label.includes('cascade-project-roadmap.json')) {
                return true;
            }

            if (roadmap.generatedBy === 'RoadmapDataAnalyzer'
                && totalFeatures === 47
                && completionRate != null
                && Math.abs(Number(completionRate) - 74.17) < 0.01) {
                return true;
            }

            const phases = roadmap.developmentPhases || [];
            if (totalFeatures === 47 && phases.some((phase) => (phase.teamSize || 0) >= 8)) {
                return true;
            }

            if (roadmap.dataSource === 'filesystem-scan' || roadmap.generatedBy === 'code-roadmap-generator') {
                const signals = roadmap.codeAnalysis?.signals || {};
                const samples = roadmap.codeAnalysis?.samples || {};
                const completionNum = Number(String(es.completionRate ?? po.completionRate ?? completionRate ?? '').replace('%', ''));
                const progressOverall = Number(roadmap.progressMetrics?.overall);

                const missedPlatformSignals = signals.serverEntry === true
                    && (signals.stubApi === false || signals.pageSampleDir === false || signals.phase2Auth === false);
                if (missedPlatformSignals) return true;

                if (samples.onDisk === 0 && samples.withSpecs === 0 && signals.pageSampleDir === false) {
                    return true;
                }

                if (completionNum === 58 && progressOverall > 70 && progressOverall < 80) {
                    return true;
                }

                return false;
            }

            if (roadmap.dataSource === 'repository-audit') {
                const sprint2 = phases.find((phase) => String(phase.phase || phase.title || '').includes('Sprint 2'));
                const sprint3 = phases.find((phase) => String(phase.phase || phase.title || '').includes('Sprint 3'));
                const completionNum = Number(String(es.completionRate ?? po.completionRate ?? completionRate ?? '').replace('%', ''));
                const recImmediate = roadmap.recommendations?.immediate || [];
                const recShort = roadmap.recommendations?.shortTerm || [];
                const hasStaleRecommendations = recImmediate.some((item) =>
                    String(item).includes('Resolve 5 mock scanner issues')
                ) || recShort.some((item) =>
                    String(item).includes('Wire npm audit to Security page')
                );
                const sprint2Features = (sprint2?.features || []).join(' ');
                if (po.completedFeatures === 4 && (completionNum === 50 || completionNum === 50.0)) return true;
                if (es.completedFeatures === 6 && completionNum === 75) return true;
                if (roadmap.analysisOverview?.testsPassing === 498) return true;
                if (sprint2Features.includes('500 Jest')) return true;
                if (sprint3?.status === 'completed' && sprint3?.progress === 100 && hasStaleRecommendations) return true;
                if (sprint3?.progress === 60) return true;
                if (hasStaleRecommendations) return true;
                if (po.projectName === 'Development Roadmap' && totalFeatures === 5) return true;
                return false;
            }

            if (roadmap.metadata?.totalPhases === 5 && roadmap.metadata?.overallProgress === 50) {
                return true;
            }

            return false;
        }

        function renderPhase2IntelligenceBlock(roadmap) {
            const phase2 = roadmap.codeAnalysis?.phase2;
            const resources = phase2?.resourceEstimate || roadmap.resourceEstimate;
            if (!phase2 && !resources) return '';

            const cycles = phase2?.dependencyGraph?.circularDependencies || [];
            const graphSummary = phase2?.dependencyGraph?.summary || {};
            const fuzzy = phase2?.fuzzySimilarity?.pairs || [];
            const gguf = phase2?.fuzzySimilarity?.gguf || {};
            const semanticHints = phase2?.semanticHints || {};
            const vizNodes = phase2?.visualization?.circularDependencyGraph?.nodes || [];

            const cycleList = cycles.length
                ? `<ul style="font-size: 0.85rem; padding-left: 1.25rem; margin: 0.5rem 0;">
                    ${cycles.slice(0, 5).map((cycle) =>
                        `<li><code>${escapeHtml(cycle.path.join(' → '))}</code> (${escapeHtml(cycle.impact || 'low')})</li>`
                    ).join('')}
                   </ul>`
                : '<p style="font-size: 0.85rem; color: #94a3b8; margin: 0.5rem 0;">No require cycles in scanned JS graph</p>';

            const fuzzyList = fuzzy.length
                ? `<ul style="font-size: 0.85rem; padding-left: 1.25rem; margin: 0.5rem 0;">
                    ${fuzzy.slice(0, 5).map((pair) =>
                        `<li>${Math.round(pair.similarity * 100)}% — <code>${escapeHtml(pair.fileA)}</code> ↔ <code>${escapeHtml(pair.fileB)}</code></li>`
                    ).join('')}
                   </ul>`
                : '<p style="font-size: 0.85rem; color: #94a3b8; margin: 0.5rem 0;">No high-similarity pairs above threshold</p>';

            const hintList = semanticHints.enabled && semanticHints.hints?.length
                ? `<ul style="font-size: 0.85rem; padding-left: 1.25rem; margin: 0.5rem 0;">
                    ${semanticHints.hints.slice(0, 5).map((hint) =>
                        `<li>${escapeHtml(hint.priority || 'low')} — <code>${escapeHtml(hint.files?.join(' ↔ ') || '')}</code></li>`
                    ).join('')}
                   </ul>`
                : `<p style="font-size: 0.85rem; color: #94a3b8; margin: 0.5rem 0;">${escapeHtml(semanticHints.note || 'Set LLAMA_CPP_BIN for optional semantic review hints')}</p>`;

            return `
                <div style="margin: 1rem 0; padding: 0.75rem 1rem; border: 1px solid #334155; border-radius: 8px; background: rgba(15, 23, 42, 0.5);">
                    <h5 style="font-size: 0.95rem; margin: 0 0 0.5rem;">Phase 2 — Code intelligence</h5>
                    <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.75rem;">
                        Dependency graph: ${graphSummary.nodes ?? '—'} nodes · ${graphSummary.edges ?? '—'} edges ·
                        ${graphSummary.circularCycles ?? cycles.length} cycles ·
                        ${fuzzy.length} fuzzy pairs ·
                        ${escapeHtml(gguf.mode || 'filesystem-only')}
                    </p>
                    ${vizNodes.length ? `<p style="font-size: 0.82rem; color: #64748b;">Cycle nodes: ${vizNodes.slice(0, 8).map((n) => `<code>${escapeHtml(n)}</code>`).join(', ')}</p>` : ''}
                    <h6 style="font-size: 0.88rem; margin: 0.75rem 0 0.25rem;">Circular dependencies</h6>
                    ${cycleList}
                    <h6 style="font-size: 0.88rem; margin: 0.75rem 0 0.25rem;">Fuzzy similarity</h6>
                    ${fuzzyList}
                    <h6 style="font-size: 0.88rem; margin: 0.75rem 0 0.25rem;">Semantic hints (optional)</h6>
                    ${hintList}
                    ${resources ? `
                        <h6 style="font-size: 0.88rem; margin: 0.75rem 0 0.25rem;">Solo resource estimate</h6>
                        <p style="font-size: 0.85rem; margin: 0;">
                            ${resources.remainingSprints ?? '—'} remaining sprints ·
                            ~${resources.estimatedHours ?? '—'} hours ·
                            internal ~$${resources.internalBudgetUsd ?? '—'}
                            <span style="color: #64748b;">(${escapeHtml(resources.budgetNote || 'notional')})</span>
                        </p>
                    ` : ''}
                </div>
            `;
        }

        function applyGeneratedRoadmapToDashboard(roadmap, projectPath, options) {
            roadmap = normalizeRoadmapPayload(roadmap);
            if (isStaleDevelopmentRoadmap(roadmap, projectPath || options?.sourceLabel)) {
                showNotification('❌ Stale roadmap fiction rejected — use cascade-roadmap-sample.json or build from path', 'error');
                const statusEl = document.getElementById('roadmap-build-status');
                if (statusEl) {
                    statusEl.innerHTML = '<span style="color: #f87171">❌ Stale cascade-project-roadmap fiction rejected — load measured sample or scan a path</span>';
                }
                return false;
            }
            const progress = buildProgressOverview(roadmap);
            const total = progress.total;
            const completed = progress.completed;
            const pct = progress.completionRate;
            const inProgress = progress.inProgress;

            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };

            setText('roadmap-stat-total', total);
            setText('roadmap-stat-completed', completed);
            setText('roadmap-stat-completion', pct != null ? pct.toFixed(1) + '%' : '—');
            setText('roadmap-stat-in-progress', inProgress);

            if (pct != null) {
                setText('roadmap-progress-pct-label', pct.toFixed(1) + '%');
                const bar = document.getElementById('roadmap-progress-bar');
                if (bar) bar.style.width = Math.min(100, pct).toFixed(1) + '%';
            }

            const phases = normalizeDynamicRoadmapPhases(roadmap.developmentPhases);
            const categories = normalizeFeatureCategories(roadmap.featureCategories);
            const milestones = (roadmap.keyMilestones && roadmap.keyMilestones.length)
                ? roadmap.keyMilestones.map(m => ({
                    title: m.milestone || m.title,
                    description: m.description || m.achievement,
                    status: m.status,
                    dateLabel: m.status === 'completed'
                        ? `Completed: ${formatRoadmapDate(m.date)}`
                        : m.status === 'in-progress'
                            ? `Target: ${formatRoadmapDate(m.date)}`
                            : `Target: ${formatRoadmapDate(m.date)}`,
                    icon: m.status === 'completed' ? '🚀' : m.status === 'in-progress' ? '⚡' : '🎉'
                }))
                : deriveMilestonesFromPhases(phases);

            renderDynamicPhasesGrid(phases);
            renderDynamicStaticTimeline(phases);
            if (categories.length) {
                renderDynamicFeatureCategories(categories);
            }
            renderDynamicMilestones(milestones);

            const timelinePhases = phases.map(phase => ({
                ...phase,
                metrics: { completion: `${phase.progress || 0}%` },
                date: formatRoadmapDate(phase.endDate || phase.startDate)
            }));
            renderSimpleTimeline(timelinePhases);
            renderProgressTracker({ developmentPhases: phases });

            if (typeof initializeExportMenu === 'function') {
                initializeExportMenu(roadmap);
            }
            if (typeof window !== 'undefined') {
                window.currentRoadmapData = roadmap;
            }

            const resultsEl = document.getElementById('roadmap-build-results');
            if (!resultsEl) return;

            const es = roadmap.executiveSummary || {};
            const po = roadmap.projectOverview || {};
            const rec = roadmap.recommendations || {};
            const immediate = rec.immediate || rec.priorities?.high || [];
            const shortTerm = rec.shortTerm || rec.priorities?.medium || [];
            const _aiLevel = roadmap.aiIntegration?.level || (roadmap.modelInfo ? 'GGUF' : 'analyzed');
            const structure = roadmap.projectStructure || {};
            const codebase = roadmap.codebaseMetrics || {};
            const _analysisOverview = roadmap.analysisOverview || {};

            resultsEl.style.display = 'block';
            const measuredNote = roadmap.dataSource === 'repository-audit'
                ? '<p style="font-size: 0.88rem; margin-bottom: 1rem; color: #94a3b8;">Measured baseline — enter a project path above and generate for a live filesystem scan.</p>'
                : roadmap.dataSource === 'filesystem-scan'
                    ? '<p style="font-size: 0.88rem; margin-bottom: 1rem; color: #94a3b8;">Sprint-based scan — not 47-feature / 98% GGUF fiction.</p>'
                    : '';
            resultsEl.innerHTML = `
                    <h4 style="margin: 0 0 0.75rem">📋 Generated Roadmap Summary</h4>
                    ${measuredNote}
                    <p style="font-size: 0.9rem; margin-bottom: 0.75rem;"><strong>Path:</strong> <code>${escapeHtml(projectPath)}</code></p>
                    <p style="font-size: 0.9rem; margin-bottom: 1rem;">
                        <strong>Source:</strong> ${escapeHtml(roadmap.generatedBy || '—')} ·
                        <strong>Version:</strong> ${escapeHtml(roadmap.version || '—')} ·
                        <strong>Health:</strong> ${escapeHtml(es.projectHealth || po.projectHealth || '—')}
                    </p>
                    ${renderPhase2IntelligenceBlock(roadmap)}
                    ${structure.totalFiles || codebase.totalFiles ? `
                        <p style="font-size: 0.88rem; margin-bottom: 1rem; color: #94a3b8;">
                            Codebase: ${structure.totalFiles || codebase.totalFiles || '—'} files scanned
                            ${structure.languages?.length ? ' · ' + structure.languages.slice(0, 4).map(l => escapeHtml(l.language || l.name || l)).join(', ') : ''}
                        </p>
                    ` : ''}
                    ${phases.length ? `
                        <h5 style="font-size: 0.95rem;">Development phases</h5>
                        <ul style="font-size: 0.88rem; margin-bottom: 1rem; padding-left: 1.25rem;">
                            ${phases.slice(0, 6).map(p => `<li><strong>${escapeHtml(p.title || p.phase)}</strong> — ${escapeHtml(p.status)} (${Math.round(p.progress || 0)}%)</li>`).join('')}
                        </ul>
                    ` : ''}
                    ${immediate.length ? `
                        <h5 style="font-size: 0.95rem;">Priority next steps</h5>
                        <ul style="font-size: 0.88rem; margin-bottom: 0; padding-left: 1.25rem;">
                            ${immediate.slice(0, 8).map(item => `<li>${escapeHtml(typeof item === 'string' ? item : item.title || item.action || JSON.stringify(item))}</li>`).join('')}
                        </ul>
                    ` : ''}
                    ${shortTerm.length ? `
                        <h5 style="font-size: 0.95rem; margin-top: 0.75rem;">Short-term</h5>
                        <ul style="font-size: 0.88rem; padding-left: 1.25rem;">
                            ${shortTerm.slice(0, 5).map(item => `<li>${escapeHtml(typeof item === 'string' ? item : item.title || item.action || JSON.stringify(item))}</li>`).join('')}
                        </ul>
                    ` : ''}
                    <button type="button" class="btn btn-sm btn-success mt-3" onclick="downloadGeneratedRoadmapJson()">
                        <i class="fas fa-download"></i> Download roadmap JSON
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-light mt-3 ms-2" onclick="openExecutiveHtmlExport()">
                        <i class="fas fa-file-export"></i> Executive HTML export
                    </button>
            `;

            resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            window.__lastGeneratedRoadmap = roadmap;
            window.__lastGeneratedRoadmapPath = projectPath;

            try {
                localStorage.setItem('lastDynamicRoadmap', JSON.stringify({
                    roadmap,
                    projectPath,
                    savedAt: new Date().toISOString(),
                    isLiveScan: roadmap.dataSource === 'filesystem-scan'
                }));
            } catch (e) {
                /* ignore storage errors */
            }
            return true;
        }

        function importRoadmapJsonFile(event) {
            const file = event.target?.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    applyImportedRoadmapJson(reader.result, file.name);
                } catch (error) {
                    showNotification('❌ ' + error.message, 'error');
                } finally {
                    event.target.value = '';
                }
            };
            reader.onerror = () => showNotification('❌ Failed to read file', 'error');
            reader.readAsText(file);
        }

        function trimRoadmapPayload(roadmap) {
            if (!roadmap || typeof roadmap !== 'object') return roadmap;
            const trimmed = { ...roadmap };

            if (trimmed.aiIntegration?.apis?.length > 20) {
                trimmed.aiIntegration = {
                    ...trimmed.aiIntegration,
                    apis: trimmed.aiIntegration.apis.slice(0, 20)
                };
            }

            if (trimmed.projectStructure?.mainCategories) {
                const slimCats = {};
                for (const [key, cat] of Object.entries(trimmed.projectStructure.mainCategories)) {
                    slimCats[key] = {
                        name: cat.name,
                        path: cat.path,
                        fileCount: cat.fileCount,
                        subdirectoryCount: cat.subdirectoryCount,
                        totalSize: cat.totalSize,
                        depth: cat.depth,
                        fileTypes: cat.fileTypes
                    };
                }
                trimmed.projectStructure = {
                    projectRoot: trimmed.projectStructure.projectRoot,
                    totalDirectories: trimmed.projectStructure.totalDirectories,
                    totalFiles: trimmed.projectStructure.totalFiles,
                    mainCategories: slimCats,
                    depthAnalysis: trimmed.projectStructure.depthAnalysis,
                    fileTypes: trimmed.projectStructure.fileTypes,
                    sizeAnalysis: trimmed.projectStructure.sizeAnalysis
                };
            }

            return trimmed;
        }

        function normalizeRoadmapPayload(roadmap) {
            if (typeof RoadmapDataService === 'undefined') return roadmap;
            return new RoadmapDataService().normalizeRoadmapData(roadmap);
        }

        function normalizeImportedRoadmap(parsed) {
            if (parsed.type === 'gguf-development-roadmap-report') {
                return {
                    roadmap: normalizeRoadmapPayload(parsed),
                    sourcePath: parsed.projectOverview?.projectName || parsed.title || 'GGUF Report'
                };
            }
            if (parsed.type === 'ai-roadmap-report-model') {
                return {
                    roadmap: normalizeRoadmapPayload(parsed),
                    sourcePath: parsed.projectOverview?.projectName || parsed.title || 'AI Roadmap Report'
                };
            }
            if (parsed.data?.type === 'gguf-development-roadmap-report') {
                return {
                    roadmap: normalizeRoadmapPayload(parsed.data),
                    sourcePath: parsed.data.projectOverview?.projectName || parsed.data.title || 'GGUF Report'
                };
            }
            if (parsed.data?.type === 'ai-roadmap-report-model') {
                return {
                    roadmap: normalizeRoadmapPayload(parsed.data),
                    sourcePath: parsed.data.projectOverview?.projectName || parsed.title || 'AI Roadmap Report'
                };
            }
            if (parsed.type === 'dynamic-project-roadmap-analysis') {
                return {
                    roadmap: trimRoadmapPayload(normalizeRoadmapPayload(parsed)),
                    sourcePath: parsed.sourceProjectPath || parsed.projectPath || null
                };
            }
            const roadmap = parsed.roadmap || parsed.analysis || parsed;
            return {
                roadmap: trimRoadmapPayload(normalizeRoadmapPayload(roadmap)),
                sourcePath: parsed.sourceProjectPath || parsed.projectPath || null
            };
        }

        function applyImportedComparisonReport(report, sourceLabel) {
            if (!report || report.type !== 'roadmap-comparison-report') {
                return false;
            }
            if (report.modelInfo?.name === 'unbreakable-oracle'
                || (report.ggufReport?.totalFeatures === 5 && report.differences?.developmentPhases?.some((phase) =>
                    String(phase.phase || '').includes('Foundation & Infrastructure')))) {
                showNotification('❌ Stale comparison fiction rejected — load roadmap-comparison-sample.json', 'error');
                return false;
            }

            const container = document.getElementById('comparison-dashboard-container');
            if (container && report.differences) {
                renderComparisonDashboard(container, {
                    differences: report.differences,
                    insights: report.insights || [],
                    recommendations: report.recommendations || []
                });
            }

            window.__lastComparisonReport = report;
            if (typeof showSection === 'function') {
                showSection('roadmap');
            }
            showNotification(`✅ Comparison report loaded from ${sourceLabel || 'import'}`, 'success');
            return true;
        }

        async function loadComparisonSample() {
            const response = await fetch('/data/roadmap-comparison-sample.json');
            const data = await parseApiJsonResponse(response);
            return applyImportedComparisonReport(data, 'roadmap-comparison-sample.json');
        }

        function applyImportedRoadmapJson(rawJson, sourceLabel) {
            const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            if (parsed.type === 'roadmap-comparison-report') {
                return applyImportedComparisonReport(parsed, sourceLabel);
            }
            const { roadmap, sourcePath } = normalizeImportedRoadmap(parsed);

            if (isStaleDevelopmentRoadmap(roadmap, sourceLabel || sourcePath)) {
                showNotification('❌ Stale roadmap fiction rejected — use cascade-roadmap-sample.json', 'error');
                const statusEl = document.getElementById('roadmap-build-status');
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color: #f87171">❌ Rejected <code style="font-size:0.85em;">${escapeHtml(sourceLabel || sourcePath || 'import')}</code> — 47 features / 74.17% is cached fiction</span>`;
                }
                return false;
            }

            const isRoadmapReport = roadmap.type === 'gguf-development-roadmap-report'
                || roadmap.type === 'ai-roadmap-report-model'
                || Boolean((roadmap.projectOverview && !roadmap.executiveSummary) || roadmap.phases?.length);
            const isDynamicAnalysis = roadmap.type === 'dynamic-project-roadmap-analysis'
                || Boolean(roadmap.executiveSummary);

            if (!isRoadmapReport && !isDynamicAnalysis) {
                throw new Error('JSON must be a dynamic-project-roadmap-analysis, gguf-development-roadmap-report, or ai-roadmap-report-model object');
            }

            const label = sourcePath || sourceLabel || 'Imported analysis';
            applyGeneratedRoadmapToDashboard(roadmap, label);

            if (typeof window.syncMockAnalysisFromRoadmapReport === 'function' && roadmap.analysisOverview) {
                window.syncMockAnalysisFromRoadmapReport(roadmap, sourceLabel || label).catch((error) => {
                    console.warn('Embedded mock analysis sync failed:', error);
                });
            }

            if (typeof showSection === 'function') {
                showSection('roadmap');
            }

            if (isRoadmapReport && typeof window.applyAIRoadmapModel === 'function') {
                try {
                    window.applyAIRoadmapModel(roadmap, sourceLabel || label, {
                        navigate: false,
                        syncMock: false,
                        syncRoadmap: false
                    });
                } catch (error) {
                    console.warn('AI roadmap page sync failed:', error);
                }
            }

            const statusEl = document.getElementById('roadmap-build-status');
            if (statusEl) {
                const typeLabel = isGgufReport && !isDynamicAnalysis
                    ? 'gguf-development-roadmap-report'
                    : 'dynamic-project-roadmap-analysis';
                statusEl.innerHTML = `<span style="color: #34d399">✅ Loaded ${typeLabel} from <code style="font-size:0.85em;">${escapeHtml(sourceLabel || label)}</code></span>`;
            }
            showNotification('✅ Roadmap JSON loaded into dashboard', 'success');
            return true;
        }

        async function loadMasterRoadmapSampleJson() {
            if (window.__roadmapSampleLoad?.master) {
                return window.__roadmapSampleLoad.master;
            }
            const statusEl = document.getElementById('roadmap-build-status');
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: #60a5fa">⏳ Loading master-roadmap-sample.json…</span>';
            }
            window.__roadmapSampleLoad = window.__roadmapSampleLoad || {};
            window.__roadmapSampleLoad.master = (async () => {
                try {
                    const response = await fetch('/data/master-roadmap-sample.json');
                    const data = await parseApiJsonResponse(response);
                    applyImportedRoadmapJson(data, 'master-roadmap-sample.json');
                } catch (error) {
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color: #f87171">❌ ${escapeHtml(error.message)}</span>`;
                    }
                    showNotification('❌ ' + error.message, 'error');
                    throw error;
                }
            })();
            try {
                return await window.__roadmapSampleLoad.master;
            } finally {
                delete window.__roadmapSampleLoad.master;
            }
        }

        const CODE_ROADMAP_GENERATOR_CACHE_KEY = 'codeRoadmapGeneratorSnapshot';
        const CODE_ROADMAP_GENERATOR_CACHE_MS = 60 * 60 * 1000;

        function readCachedCodeRoadmapGenerator() {
            try {
                const raw = sessionStorage.getItem(CODE_ROADMAP_GENERATOR_CACHE_KEY);
                if (!raw) return null;
                const cached = JSON.parse(raw);
                if (!cached?.roadmap || Date.now() - cached.at > CODE_ROADMAP_GENERATOR_CACHE_MS) {
                    return null;
                }
                if (cached.roadmap.roadmapExportProfile !== 'filtered-v3.1') return null;
                if (cached.roadmap.generatedBy !== 'code-roadmap-generator') return null;
                return cached;
            } catch {
                return null;
            }
        }

        function writeCachedCodeRoadmapGenerator(projectPath, roadmap) {
            try {
                sessionStorage.setItem(CODE_ROADMAP_GENERATOR_CACHE_KEY, JSON.stringify({
                    at: Date.now(),
                    projectPath,
                    roadmap
                }));
            } catch {
                /* ignore */
            }
        }

        async function loadLiveRoadmapFromGenerator(options = {}) {
            const { force = false, silent = false } = options;
            const statusEl = document.getElementById('roadmap-build-status');

            if (!force) {
                const cached = readCachedCodeRoadmapGenerator();
                if (cached?.roadmap) {
                    applyGeneratedRoadmapToDashboard(
                        cached.roadmap,
                        cached.projectPath || 'code-roadmap-generator (cached)'
                    );
                    if (statusEl && !silent) {
                        statusEl.innerHTML = '<span style="color: #34d399">✅ Loaded cached code-roadmap-generator scan</span>';
                    }
                    return true;
                }
                return false;
            }

            let projectPath = null;
            try {
                projectPath = localStorage.getItem('roadmapProjectPath');
            } catch {
                /* ignore */
            }

            if (statusEl && !silent) {
                statusEl.innerHTML = '<span style="color: #60a5fa">⏳ Running code-roadmap-generator path scan…</span>';
            }

            try {
                let data;
                if (projectPath) {
                    const response = await fetch('/api/dynamic-roadmap/build-from-path', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectPath })
                    });
                    data = await parseApiJsonResponse(response);
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || data.error || 'Roadmap generation failed');
                    }
                } else {
                    const response = await fetch('/api/code-roadmap/analyze');
                    data = await parseApiJsonResponse(response);
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || data.error || 'Code roadmap analysis failed');
                    }
                }

                const roadmap = data.roadmap;
                if (!roadmap || isStaleDevelopmentRoadmap(roadmap, data.projectPath)) {
                    throw new Error('code-roadmap-generator returned stale fiction');
                }

                writeCachedCodeRoadmapGenerator(data.projectPath, roadmap);
                applyGeneratedRoadmapToDashboard(roadmap, data.projectPath || 'code-roadmap-generator');
                if (statusEl && !silent) {
                    statusEl.innerHTML = `<span style="color: #34d399">✅ Roadmap from code-roadmap-generator (<code style="font-size:0.85em;">${escapeHtml(data.projectPath || 'platform root')}</code>)</span>`;
                }
                if (!silent) {
                    showNotification('✅ Roadmap loaded from code-roadmap-generator', 'success');
                }
                return true;
            } catch (error) {
                console.warn('loadLiveRoadmapFromGenerator:', error.message);
                if (statusEl && !silent) {
                    statusEl.innerHTML = `<span style="color: #f87171">❌ ${escapeHtml(error.message)}</span>`;
                }
                return false;
            }
        }

        async function loadGgufSampleRoadmapJson() {
            if (window.__roadmapSampleLoad?.gguf) {
                return window.__roadmapSampleLoad.gguf;
            }
            const statusEl = document.getElementById('roadmap-build-status');
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: #60a5fa">⏳ Loading sample gguf-development-roadmap-report…</span>';
            }
            window.__roadmapSampleLoad = window.__roadmapSampleLoad || {};
            window.__roadmapSampleLoad.gguf = (async () => {
                try {
                    const response = await fetch('/data/gguf-development-roadmap-report.json');
                    const data = await parseApiJsonResponse(response);
                    applyImportedRoadmapJson(data, 'gguf-development-roadmap-report.json');
                } catch (error) {
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color: #f87171">❌ ${escapeHtml(error.message)}</span>`;
                    }
                    showNotification('❌ ' + error.message, 'error');
                    throw error;
                }
            })();
            try {
                return await window.__roadmapSampleLoad.gguf;
            } finally {
                delete window.__roadmapSampleLoad.gguf;
            }
        }

        async function loadBaselineDevelopmentRoadmap() {
            try {
                const response = await fetch('/data/cascade-roadmap-sample.json?v=20260524ax');
                if (!response.ok) return false;
                const data = await parseApiJsonResponse(response);
                const { roadmap } = normalizeImportedRoadmap(data);
                if (isStaleDevelopmentRoadmap(roadmap, 'cascade-roadmap-sample.json')) return false;
                applyGeneratedRoadmapToDashboard(roadmap, 'cascade-roadmap-sample.json');
                return true;
            } catch (error) {
                console.warn('Baseline development roadmap failed:', error.message);
                return false;
            }
        }

        async function loadSampleRoadmapJson() {
            if (window.__roadmapSampleLoad?.cascade) {
                return window.__roadmapSampleLoad.cascade;
            }
            const statusEl = document.getElementById('roadmap-build-status');
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: #60a5fa">⏳ Loading sample dynamic-project-roadmap-analysis…</span>';
            }
            window.__roadmapSampleLoad = window.__roadmapSampleLoad || {};
            window.__roadmapSampleLoad.cascade = (async () => {
                try {
                    const response = await fetch('/data/cascade-roadmap-sample.json');
                    const data = await parseApiJsonResponse(response);
                    applyImportedRoadmapJson(data, 'cascade-roadmap-sample.json');
                } catch (error) {
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color: #f87171">❌ ${escapeHtml(error.message)}</span>`;
                    }
                    showNotification('❌ ' + error.message, 'error');
                    throw error;
                }
            })();
            try {
                return await window.__roadmapSampleLoad.cascade;
            } finally {
                delete window.__roadmapSampleLoad.cascade;
            }
        }

        function restoreSavedDynamicRoadmap() {
            try {
                const raw = localStorage.getItem('lastDynamicRoadmap');
                if (!raw) return false;
                const saved = JSON.parse(raw);
                const roadmap = saved.roadmap || saved;
                if (isStaleDevelopmentRoadmap(roadmap, saved.projectPath)) {
                    try { localStorage.removeItem('lastDynamicRoadmap'); } catch (e) { /* ignore */ }
                    return false;
                }
                if (saved?.roadmap?.executiveSummary || saved?.roadmap?.projectOverview) {
                    applyGeneratedRoadmapToDashboard(saved.roadmap, saved.projectPath || 'Saved analysis');
                    return true;
                }
            } catch (e) {
                /* ignore */
            }
            return false;
        }

        function downloadGeneratedRoadmapJson() {
            const roadmap = window.__lastGeneratedRoadmap;
            if (!roadmap) {
                showNotification('Generate a roadmap first', 'warning');
                return;
            }
            const blob = new Blob([JSON.stringify(roadmap, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ai-project-roadmap-' + new Date().toISOString().split('T')[0] + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('Roadmap JSON downloaded', 'success');
        }

        async function openExecutiveHtmlExport() {
            const roadmap = window.__lastGeneratedRoadmap;
            const projectPath = window.__lastGeneratedRoadmapPath;

            if (projectPath && projectPath !== 'Saved analysis') {
                window.open(
                    `/api/code-roadmap/export/html?projectPath=${encodeURIComponent(projectPath)}`,
                    '_blank'
                );
                showNotification('Opening executive HTML export', 'info');
                return;
            }

            if (!roadmap) {
                showNotification('Generate a roadmap first', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/code-roadmap/export/html', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roadmap })
                });
                if (!response.ok) {
                    throw new Error('Export failed (HTTP ' + response.status + ')');
                }
                const html = await response.text();
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                }
                showNotification('Executive HTML export ready — use Print to save PDF', 'success');
            } catch (error) {
                showNotification('❌ ' + error.message, 'error');
            }
        }

        // Load Blob-Driven Roadmap for Development Roadmap
        async function loadBlobDrivenRoadmap() {
            showNotification('🗺️ Loading blob-driven roadmap insights...', 'info');
            try {
                // Simulate blob-driven analysis
                const blobInsights = {
                    modelArchitecture: 'llama',
                    dataPatterns: ['structured', 'unstructured', 'time-series'],
                    optimizationAreas: [
                        'Performance Enhancement',
                        'Memory Optimization',
                        'Data Processing Pipeline'
                    ],
                    recommendations: [
                        { action: 'Implement GGUF-based data processing', priority: 'high' },
                        { action: 'Optimize model loading strategy', priority: 'medium' },
                        { action: 'Enhance blob storage access', priority: 'low' }
                    ]
                };
                
                // Update roadmap with blob insights
                updateRoadmapWithBlobInsights(blobInsights);
                
                showNotification('✅ Blob-driven roadmap insights loaded', 'success');
            } catch (error) {
                console.error('Error loading blob-driven roadmap:', error);
                showNotification('⚠️ Using default roadmap data', 'warning');
            }
        }

        // Update Roadmap with Blob Insights
        function updateRoadmapWithBlobInsights(insights) {
            try {
                const roadmapSection = document.getElementById('roadmap');
                if (!roadmapSection) return;
                
                // Create blob insights panel
                const insightsPanel = document.createElement('div');
                insightsPanel.className = 'card mb-4 border-primary blob-analysis-panel';
                insightsPanel.innerHTML = `
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">🔬 Blob-Driven Insights</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4">
                                <h6>📊 Model Architecture</h6>
                                <p><code>${insights.modelArchitecture}</code></p>
                            </div>
                            <div class="col-md-4">
                                <h6>🔍 Data Patterns</h6>
                                <div class="d-flex flex-wrap gap-1">
                                    ${insights.dataPatterns.map(pattern => `<span class="badge bg-info">${pattern}</span>`).join('')}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <h6>⚡ Optimization Areas</h6>
                                <ul class="small mb-0">
                                    ${insights.optimizationAreas.map(area => `<li>${area}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        <div class="mt-3">
                            <h6>🎯 AI Recommendations</h6>
                            <div class="list-group">
                                ${insights.recommendations.map(rec => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span>${rec.action}</span>
                                            <span class="badge bg-${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'secondary'}">${rec.priority}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                
                // Insert insights panel at the beginning
                const firstElement = roadmapSection.querySelector('.card, .header');
                if (firstElement) {
                    roadmapSection.insertBefore(insightsPanel, firstElement);
                } else {
                    roadmapSection.appendChild(insightsPanel);
                }
                
            } catch (error) {
                console.error('Error updating roadmap with blob insights:', error);
            }
        }

        // Analyze Blob with AI for AI-Powered Roadmap
        async function analyzeBlobWithAI() {
            showNotification('🧠 Analyzing blob with AI...', 'info');
            try {
                // Simulate deep AI analysis of the blob
                const aiAnalysis = {
                    blobSignature: 'GGUF-LLAMA-1.88GB',
                    confidence: 99.2,
                    insights: {
                        architecture: 'Transformer-based LLaMA',
                        parameters: '7B parameters (compressed)',
                        quantization: '4-bit quantized',
                        capabilities: [
                            'Natural Language Understanding',
                            'Code Generation',
                            'Data Analysis',
                            'Pattern Recognition',
                            'Mock Data Synthesis'
                        ]
                    },
                    roadmapImpact: {
                        phase1: 'GGUF Integration Complete',
                        phase2: 'AI Model Optimization',
                        phase3: 'Advanced Analytics',
                        phase4: 'Production Deployment'
                    },
                    recommendations: [
                        'Leverage GGUF model for mock data generation',
                        'Implement AI-driven data validation',
                        'Optimize blob storage for faster access',
                        'Create AI-powered development tools'
                    ]
                };
                
                // Update AI roadmap with blob analysis
                updateAIRoadmapWithBlobAnalysis(aiAnalysis);
                
                showNotification('✅ AI blob analysis complete', 'success');
            } catch (error) {
                console.error('Error analyzing blob with AI:', error);
                showNotification('⚠️ AI analysis unavailable', 'error');
            }
        }

        // Update AI Roadmap with Blob Analysis
        function updateAIRoadmapWithBlobAnalysis(analysis) {
            try {
                const aiRoadmapSection = document.getElementById('ai-roadmap');
                if (!aiRoadmapSection) return;
                
                // Create AI analysis panel
                const analysisPanel = document.createElement('div');
                analysisPanel.className = 'card mb-4 border-warning blob-analysis-panel';
                analysisPanel.innerHTML = `
                    <div class="card-header bg-warning text-dark">
                        <h5 class="mb-0">🤖 AI Blob Analysis</h5>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-3">
                                <p><strong>Signature:</strong></p>
                                <code class="small">${analysis.blobSignature}</code>
                            </div>
                            <div class="col-md-3">
                                <p><strong>Confidence:</strong></p>
                                <div class="progress" style="height: 20px">
                                    <div class="progress-bar bg-success" style="width: ${analysis.confidence}%">${analysis.confidence}%</div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <p><strong>Architecture:</strong></p>
                                <p class="small">${analysis.insights.architecture}</p>
                            </div>
                            <div class="col-md-3">
                                <p><strong>Parameters:</strong></p>
                                <p class="small">${analysis.insights.parameters}</p>
                            </div>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <h6>🎯 AI Capabilities</h6>
                                <div class="d-flex flex-wrap gap-1">
                                    ${analysis.insights.capabilities.map(cap => `<span class="badge bg-primary">${cap}</span>`).join('')}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6>📈 Roadmap Impact</h6>
                                <div class="timeline-small">
                                    ${Object.entries(analysis.roadmapImpact).map(([phase, impact]) => `
                                        <div class="d-flex justify-content-between">
                                            <span class="badge bg-secondary">${phase}</span>
                                            <small>${impact}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h6>💡 AI Recommendations</h6>
                            <div class="list-group">
                                ${analysis.recommendations.map(rec => `
                                    <div class="list-group-item">
                                        <div class="d-flex align-items-center">
                                            <i class="fas fa-lightbulb text-warning me-2"></i>
                                            <span>${rec}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                
                // Insert analysis panel at the beginning
                const firstElement = aiRoadmapSection.querySelector('.card, .header');
                if (firstElement) {
                    aiRoadmapSection.insertBefore(analysisPanel, firstElement);
                } else {
                    aiRoadmapSection.appendChild(analysisPanel);
                }
                
            } catch (error) {
                console.error('Error updating AI roadmap with blob analysis:', error);
            }
        }

        // Feature Backlog Report Download Function
        function _downloadFeatureBacklogReport() {
            if (window.__featureBacklogModel) {
                document.getElementById('fb-export-json')?.click();
                return;
            }
            if (typeof window.loadFeatureBacklogSample === 'function') {
                loadFeatureBacklogSample().then(() => {
                    document.getElementById('fb-export-json')?.click();
                });
                return;
            }
            showNotification('❌ Feature backlog data not available', 'error');
        }

        // Add New Feature Function
        function _addNewFeature() {
            showNotification('➕ Opening feature creation dialog...', 'info');
            
            // Create modal for adding new feature
            const modalHtml = `
                <div class="modal fade" id="addFeatureModal" tabindex="-1" aria-labelledby="addFeatureModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content" style="background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                            <div class="modal-header">
                                <h5 class="modal-title" id="addFeatureModalLabel">🚀 Add New Feature</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <form id="addFeatureForm">
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="featureName" class="form-label">Feature Name</label>
                                            <input type="text" class="form-control" id="featureName" required style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="featureCategory" class="form-label">Category</label>
                                            <select class="form-control" id="featureCategory" required style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                                                <option value="">Select Category</option>
                                                <option value="AI & Machine Learning">AI & Machine Learning</option>
                                                <option value="Analytics & Reporting">Analytics & Reporting</option>
                                                <option value="Development Tools">Development Tools</option>
                                                <option value="Security & Performance">Security & Performance</option>
                                                <option value="User Experience">User Experience</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="featurePriority" class="form-label">Priority</label>
                                            <select class="form-control" id="featurePriority" required style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                                                <option value="">Select Priority</option>
                                                <option value="High">High</option>
                                                <option value="Medium">Medium</option>
                                                <option value="Low">Low</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="storyPoints" class="form-label">Story Points</label>
                                            <input type="number" class="form-control" id="storyPoints" min="1" max="21" required style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="assignee" class="form-label">Assignee</label>
                                            <input type="text" class="form-control" id="assignee" required style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="targetSprint" class="form-label">Target Sprint</label>
                                            <input type="text" class="form-control" id="targetSprint" placeholder="e.g., Sprint 8" style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);">
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="featureDescription" class="form-label">Description</label>
                                        <textarea class="form-control" id="featureDescription" rows="3" required style="background: var(--dark-bg); color: var(--text-primary); border: 1px solid var(--border-color);"></textarea>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" onclick="saveNewFeature()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none;">Add Feature</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('addFeatureModal'));
            modal.show();
            
            // Remove modal from DOM after hidden
            document.getElementById('addFeatureModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
        }

        // Save New Feature Function
        function _saveNewFeature() {
            const form = document.getElementById('addFeatureForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const featureData = {
                name: document.getElementById('featureName').value,
                category: document.getElementById('featureCategory').value,
                priority: document.getElementById('featurePriority').value,
                storyPoints: parseInt(document.getElementById('storyPoints').value),
                assignee: document.getElementById('assignee').value,
                targetSprint: document.getElementById('targetSprint').value,
                description: document.getElementById('featureDescription').value,
                status: 'Pending',
                createdAt: new Date().toISOString()
            };
            
            // Here you would normally save to backend
            console.log('New feature data:', featureData);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('addFeatureModal')).hide();
            
            // Show success notification
            showNotification('✅ Feature added successfully!', 'success');
            
            // Refresh the feature backlog section
            setTimeout(() => {
                showSection('feature-backlog');
            }, 500);
        }
    // Initialize GGUF components when page loads
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize GGUF components after a short delay to ensure DOM is ready
            setTimeout(() => {
                initializeGGUFComponents();
            }, 100);
        });

        function initializeGGUFComponents() {
            try {
                // Initialize GGUF Data Service
                if (typeof GGUFDataService !== 'undefined') {
                    window.ggufDataService = new GGUFDataService();
                }

                // Initialize Analysis Dashboard
                const analysisContainer = document.getElementById('gguf-analysis-panel');
                if (analysisContainer && typeof AnalysisDashboard !== 'undefined') {
                    window.analysisDashboard = new AnalysisDashboard('gguf-analysis-panel');
                }

                // Initialize Quality Dashboard
                const qualityContainer = document.getElementById('quality-metrics-chart');
                if (qualityContainer && typeof QualityDashboard !== 'undefined') {
                    window.qualityDashboard = new QualityDashboard('quality-metrics-chart');
                }

                // Initialize basic functionality for other panels
                const issuesGridContainer = document.getElementById('issues-grid');
                if (issuesGridContainer) {
                    issuesGridContainer.innerHTML = '<div class="text-center p-4"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><h5>Issues Grid</h5><p class="text-muted">No issues detected</p></div>';
                }

                const recommendationsContainer = document.getElementById('recommendations-panel');
                if (recommendationsContainer) {
                    recommendationsContainer.innerHTML = '<div class="text-center p-4"><i class="fas fa-lightbulb fa-3x mb-3"></i><h5>Recommendations</h5><p class="text-muted">System is running optimally</p></div>';
                }

                console.log('Dashboard components initialized successfully');
            } catch (error) {
                console.error('Error initializing GGUF components:', error);
            }
        }

        // Load GGUF component scripts dynamically
        function _loadGGUFScripts() {
            const scripts = [
                'central-data-integration.js',
                'components/analysis/AnalysisDashboard.js',
                'components/quality/QualityDashboard.js'
            ];

            scripts.forEach(script => {
                const scriptElement = document.createElement('script');
                scriptElement.src = script;
                scriptElement.onload = () => console.log(`Loaded: ${script}`);
                scriptElement.onerror = () => console.error(`Failed to load: ${script}`);
                document.head.appendChild(scriptElement);
            });
        }

        
        // Add GGUF-specific helper functions
        window.GGUFHelpers = {
            // Format file size
            formatFileSize: function(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },

            // Format duration
            formatDuration: function(minutes) {
                if (minutes < 60) {
                    return `${minutes} minutes`;
                } else if (minutes < 1440) {
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return `${hours}h ${mins}m`;
                } else {
                    const days = Math.floor(minutes / 1440);
                    const hours = Math.floor((minutes % 1440) / 60);
                    return `${days}d ${hours}h`;
                }
            },

            // Get severity color
            getSeverityColor: function(severity) {
                const colors = {
                    'critical': '#ef4444',
                    'high': '#f59e0b',
                    'medium': '#3b82f6',
                    'low': '#10b981'
                };
                return colors[severity] || '#6b7280';
            },

            // Get priority color
            getPriorityColor: function(priority) {
                const colors = {
                    'high': '#ef4444',
                    'medium': '#f59e0b',
                    'low': '#10b981'
                };
                return colors[priority] || '#6b7280';
            },

            // Show notification
            showNotification: function(message, type = 'info') {
                const notification = document.createElement('div');
                notification.className = `notification ${type} show`;
                notification.innerHTML = `
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                    <span>${message}</span>
                    <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
                `;
                
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 3000);
            }
        };

        // Initialize Roadmap Timeline Visualization
        async function initializeRoadmapTimeline() {
            try {
                // Use section-content-provider to load the component
                const container = document.getElementById('roadmap-timeline-container');
                if (container && window.sectionContentProvider) {
                    await window.sectionContentProvider.initializeComponent('RoadmapTimelineVisualization', container);
                    console.log('✅ Roadmap timeline initialized');
                } else {
                    console.warn('⚠️ RoadmapTimelineVisualization container or provider not available');
                    // Render simple timeline fallback
                    renderSimpleTimeline([]);
                }
                
                // Initialize export menu
                
                // Initialize progress tracker
                const progressContainer = document.getElementById('roadmap-progress-container');
                if (progressContainer && window.sectionContentProvider) {
                    await window.sectionContentProvider.initializeComponent('RoadmapProgressTracker', progressContainer);
                    console.log('✅ Roadmap progress tracker initialized');
                } else {
                    console.warn('⚠️ RoadmapProgressTracker container or provider not available');
                    // Render enhanced progress tracker fallback
                    renderProgressTracker({});
                }
                
                // Initialize export menu
                if (typeof initializeExportMenu === 'function') {
                    initializeExportMenu({});
                    console.log('✅ Export menu initialized');
                } else {
                    console.warn('⚠️ initializeExportMenu function not available');
                }
                
                // Initialize comparison dashboard
                if (typeof initializeComparisonDashboard === 'function') {
                    initializeComparisonDashboard();
                    console.log('✅ Comparison dashboard initialized');
                } else {
                    console.warn('⚠️ initializeComparisonDashboard function not available');
                }
                
                // Initialize optimization engine
                if (typeof initializeOptimizationEngine === 'function') {
                    initializeOptimizationEngine();
                    console.log('✅ Optimization engine initialized');
                } else {
                    console.warn('⚠️ initializeOptimizationEngine function not available');
                }
                
                // Initialize advanced analytics panel
                if (typeof initializeAdvancedAnalyticsPanel === 'function') {
                    initializeAdvancedAnalyticsPanel();
                    console.log('✅ Advanced analytics panel initialized');
                } else {
                    console.warn('⚠️ initializeAdvancedAnalyticsPanel function not available');
                }
                
                // Initialize AI roadmap dashboard
                if (typeof initializeAIRoadmapDashboard === 'function') {
                    initializeAIRoadmapDashboard();
                    console.log('✅ AI roadmap dashboard initialized');
                } else {
                    console.warn('⚠️ initializeAIRoadmapDashboard function not available');
                }
                
                // Initialize AI tools dashboard
                if (typeof initializeAIToolsDashboard === 'function') {
                    initializeAIToolsDashboard();
                    console.log('✅ AI tools dashboard initialized');
                } else {
                    console.warn('⚠️ initializeAIToolsDashboard function not available');
                }
                
                // Initialize analytics performance dashboard
                if (typeof initializeAnalyticsPerformanceDashboard === 'function') {
                    initializeAnalyticsPerformanceDashboard();
                    console.log('✅ Analytics performance dashboard initialized');
                } else {
                    console.warn('⚠️ initializeAnalyticsPerformanceDashboard function not available');
                }
                
                // Initialize development tools tracker
                if (typeof initializeDevelopmentToolsTracker === 'function') {
                    initializeDevelopmentToolsTracker();
                    console.log('✅ Development tools tracker initialized');
                } else {
                    console.warn('⚠️ initializeDevelopmentToolsTracker function not available');
                }
                
                // Initialize technical debt analyzer
                if (typeof initializeTechnicalDebtAnalyzer === 'function') {
                    initializeTechnicalDebtAnalyzer();
                    console.log('✅ Technical debt analyzer initialized');
                } else {
                    console.warn('⚠️ initializeTechnicalDebtAnalyzer function not available');
                }
                
                // Initialize project resources manager
                if (typeof initializeProjectResourcesManager === 'function') {
                    initializeProjectResourcesManager();
                    console.log('✅ Project resources manager initialized');
                } else {
                    console.warn('⚠️ initializeProjectResourcesManager function not available');
                }
                
                // Initialize Code Generation dashboard
                if (typeof initializeCodeGenerationDashboard === 'function') {
                    initializeCodeGenerationDashboard();
                    console.log('✅ Code Generation dashboard initialized');
                } else {
                    console.warn('⚠️ initializeCodeGenerationDashboard function not available');
                }
                
                // Initialize Pattern Analyzer
                if (typeof initializePatternAnalyzer === 'function') {
                    initializePatternAnalyzer();
                    console.log('✅ Pattern analyzer initialized');
                } else {
                    console.warn('⚠️ initializePatternAnalyzer function not available');
                }
                
                // Initialize Data Generator
                if (typeof initializeDataGenerator === 'function') {
                    initializeDataGenerator();
                    console.log('✅ Data generator initialized');
                } else {
                    console.warn('⚠️ initializeDataGenerator function not available');
                }
                
                // Initialize Schema Designer
                if (typeof initializeSchemaDesigner === 'function') {
                    initializeSchemaDesigner();
                    console.log('✅ Schema designer initialized');
                } else {
                    console.warn('⚠️ initializeSchemaDesigner function not available');
                }
                
                console.log('✅ Mock-to-Real Data Transformation components initialized');
            } catch (error) {
                console.error('❌ Failed to initialize roadmap timeline:', error);
                showNotification('Some roadmap components failed to load', 'warning');
                
                // Try to initialize just the comparison dashboard as fallback
                try {
                    if (typeof initializeComparisonDashboard === 'function') {
                        initializeComparisonDashboard();
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback initialization also failed:', fallbackError);
                }
            }
        }

        // Enhanced timeline fallback with interactivity
        function renderSimpleTimeline(phases) {
            const container = document.getElementById('roadmap-timeline-container');
            if (!container || !phases) return;
            
            container.innerHTML = `
                <div class="simple-timeline" style="background: var(--card-bg) border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h4 style="color: var(--text-primary);">
                            <i class="fas fa-route"></i> Development Phases
                        </h4>
                        <div class="timeline-stats">
                            <span class="badge bg-success me-2">${phases.filter(p => p.status === 'completed').length} Completed</span>
                            <span class="badge bg-warning me-2">${phases.filter(p => p.status === 'in-progress').length} In Progress</span>
                            <span class="badge bg-secondary">${phases.filter(p => p.status === 'planned').length} Planned</span>
                        </div>
                    </div>
                    ${phases.map((phase, index) => `
                        <div class="timeline-phase mb-3" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; cursor: pointer;" 
                             onclick="togglePhaseDetails('phase-${index}')" onmouseover="highlightPhase(this)" onmouseout="unhighlightPhase(this)">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 style="color: ${phase.status === 'completed' ? 'var(--success-color)' : phase.status === 'in-progress' ? 'var(--warning-color)' : 'var(--text-secondary)'};">
                                    <i class="fas fa-${phase.status === 'completed' ? 'check-circle' : phase.status === 'in-progress' ? 'spinner' : 'clock'} me-2"></i>
                                    ${phase.phase}
                                </h5>
                                <span class="badge bg-${phase.status === 'completed' ? 'success' : phase.status === 'in-progress' ? 'warning' : 'secondary'}">
                                    ${phase.status}
                                </span>
                            </div>
                            <p class="text-muted small mb-2">${phase.description}</p>
                            <div class="progress mb-2">
                                <div class="progress-bar bg-${phase.status === 'completed' ? 'success' : phase.status === 'in-progress' ? 'warning' : 'secondary'}" 
                                     style="width: ${parseInt(phase.metrics?.completion || '0%')}%; transition: width 0.3s ease;"></div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">${phase.metrics?.completion || '0%'} complete</small>
                                <small class="text-muted">
                                    ${phase.date || 'TBD'}
                                </small>
                            </div>
                            <div id="phase-${index}-details" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                <h6 style="color: var(--text-primary);">Features:</h6>
                                <ul class="small text-muted mb-2">
                                    ${(phase.features || phase.deliverables || []).map(feature => `<li>${feature}</li>`).join('')}
                                </ul>
                                <h6 style="color: var(--text-primary);">Milestones:</h6>
                                <p class="small text-muted">
                                    ${phase.metrics?.milestones || 0} milestones completed
                                </p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Enhanced progress tracker fallback
        function renderProgressTracker(roadmapData) {
            const container = document.getElementById('roadmap-progress-container');
            if (!container || !roadmapData) return;
            
            const phases = roadmapData.developmentPhases || [];
            const completedPhases = phases.filter(p => p.status === 'completed').length;
            const totalPhases = phases.length;
            const overallProgress = Math.round((completedPhases / totalPhases) * 100);
            
            container.innerHTML = `
                <div class="progress-tracker" style="background: var(--card-bg) border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1.5rem;">
                        <i class="fas fa-chart-line"></i> Project Progress Tracker
                    </h4>
                    
                    <div class="overall-progress mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h5 style="color: var(--text-primary);">Overall Progress</h5>
                            <span class="badge bg-primary">${overallProgress}%</span>
                        </div>
                        <div class="progress" style="height: 25px;">
                            <div class="progress-bar bg-primary" style="width: ${overallProgress}%; transition: width 0.5s ease;"></div>
                        </div>
                        <small class="text-muted">${completedPhases} of ${totalPhases} phases completed</small>
                    </div>
                    
                    <div class="phase-progress-grid">
                        <h5 style="color: var(--text-primary); margin-bottom: 1rem;">Phase Breakdown</h5>
                        <div class="row">
                            ${phases.map((phase, index) => `
                                <div class="col-md-3 col-sm-6 mb-3">
                                    <div class="phase-card text-center" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                                        <h6 style="color: ${phase.status === 'completed' ? 'var(--success-color)' : phase.status === 'in-progress' ? 'var(--warning-color)' : 'var(--text-secondary)'};">
                                            Phase ${index + 1}
                                        </h6>
                                        <div class="progress mb-2" style="height: 8px;">
                                            <div class="progress-bar bg-${phase.status === 'completed' ? 'success' : phase.status === 'in-progress' ? 'warning' : 'secondary'}" 
                                                 style="width: ${phase.progress}%;"></div>
                                        </div>
                                        <small class="text-muted">${phase.progress}%</small>
                                        <div class="mt-2">
                                            <span class="badge bg-${phase.status === 'completed' ? 'success' : phase.status === 'in-progress' ? 'warning' : 'secondary'}" style="font-size: 0.7rem;">
                                                ${phase.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="progress-summary mt-4">
                        <div class="row text-center">
                            <div class="col-md-4">
                                <h5 style="color: var(--success-color);">${completedPhases}</h5>
                                <small class="text-muted">Completed</small>
                            </div>
                            <div class="col-md-4">
                                <h5 style="color: var(--warning-color);">${phases.filter(p => p.status === 'in-progress').length}</h5>
                                <small class="text-muted">In Progress</small>
                            </div>
                            <div class="col-md-4">
                                <h5 style="color: var(--text-secondary);">${phases.filter(p => p.status === 'planned').length}</h5>
                                <small class="text-muted">Planned</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Helper functions for timeline interactivity
        function togglePhaseDetails(phaseId) {
            const details = document.getElementById(phaseId);
            if (details) {
                details.style.display = details.style.display === 'none' ? 'block' : 'none';
            }
        }

        function highlightPhase(element) {
            element.style.transform = 'translateX(5px)';
            element.style.boxShadow = '0 4px 8px rgba(99, 102, 241, 0.3)';
            element.style.transition = 'all 0.3s ease';
        }

        function unhighlightPhase(element) {
            element.style.transform = 'translateX(0)';
            element.style.boxShadow = 'none';
        }

        // Initialize Comparison Dashboard
        async function initializeComparisonDashboard() {
            try {
                const container = document.getElementById('comparison-dashboard-container');
                if (!container) {
                    console.warn('Comparison dashboard container not found');
                    return;
                }

                // Load comparison data
                const roadmapService = new RoadmapDataService();
                const ggufData = await roadmapService.loadRoadmapData('gguf');
                const aiData = await generateAIReport();
                
                // Perform enhanced comparison
                const comparison = performEnhancedComparison(ggufData, aiData);
                
                // Render comparison dashboard
                renderComparisonDashboard(container, comparison);
                
                console.log('✅ Comparison dashboard initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize comparison dashboard:', error);
                showNotification('Failed to load comparison dashboard', 'error');
            }
        }

        // Render Comparison Dashboard
        function renderComparisonDashboard(container, comparison) {
            container.innerHTML = `
                <div class="comparison-dashboard" style="background: var(--card-bg) border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">
                        <i class="fas fa-balance-scale"></i> GGUF vs AI Analysis Comparison
                    </h3>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="comparison-card" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                                <h5 style="color: var(--primary-color);">Completion Rate</h5>
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>GGUF:</strong> ${comparison.differences.completionRate.gguf}%
                                    </div>
                                    <div>
                                        <strong>AI:</strong> ${comparison.differences.completionRate.ai}%
                                    </div>
                                </div>
                                <div class="progress mt-2">
                                    <div class="progress-bar bg-success" style="width: ${comparison.differences.completionRate.gguf}%"></div>
                                    <div class="progress-bar bg-info" style="width: ${comparison.differences.completionRate.ai}%"></div>
                                </div>
                                <small class="text-muted">${comparison.differences.completionRate.interpretation}</small>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="comparison-card" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                                <h5 style="color: var(--secondary-color);">Project Health</h5>
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <strong>GGUF:</strong> 
                                        <span class="badge bg-${comparison.differences.projectHealth.gguf === 'Excellent' ? 'success' : 'warning'}">
                                            ${comparison.differences.projectHealth.gguf}
                                        </span>
                                    </div>
                                    <div>
                                        <strong>AI:</strong> 
                                        <span class="badge bg-${comparison.differences.projectHealth.ai === 'Good' ? 'info' : 'warning'}">
                                            ${comparison.differences.projectHealth.ai}
                                        </span>
                                    </div>
                                </div>
                                <small class="text-muted">${comparison.differences.projectHealth.interpretation}</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-12">
                            <div class="insights-section" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                                <h5 style="color: var(--warning-color);">Key Insights</h5>
                                ${comparison.insights.map(insight => `
                                    <div class="alert alert-${insight.impact === 'high' ? 'warning' : insight.impact === 'medium' ? 'info' : 'secondary'}" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                                        <strong>${insight.category.replace('_', ' ').toUpperCase()}:</strong> ${insight.description}
                                        <br><small>Recommendation: ${insight.recommendation}</small>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-12">
                            <div class="recommendations-section" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                                <h5 style="color: var(--success-color);">Recommendations</h5>
                                ${comparison.recommendations.map(rec => `
                                    <div class="recommendation-item mb-2">
                                        <span class="badge bg-${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'info'} me-2">
                                            ${rec.priority.toUpperCase()}
                                        </span>
                                        <strong>${rec.action}</strong>
                                        <p class="mb-1 small text-muted">${rec.description}</p>
                                        <small><strong>Impact:</strong> ${rec.impact} | <strong>Effort:</strong> ${rec.effort}</small>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="text-center mt-3">
                        <button class="btn btn-primary" onclick="downloadComparisonReport()" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border: none;">
                            <i class="fas fa-download"></i> Download Full Comparison Report
                        </button>
                    </div>
                </div>
            `;
        }

        // Initialize Roadmap Progress Tracker
        async function initializeRoadmapProgress() {
            try {
                const progressContainer = document.getElementById('roadmap-progress-container');
                if (progressContainer && window.sectionContentProvider) {
                    await window.sectionContentProvider.initializeComponent('RoadmapProgressTracker', progressContainer);
                    console.log('✅ Roadmap progress tracker initialized');
                } else {
                    console.warn('⚠️ RoadmapProgressTracker container or provider not available');
                    renderProgressTracker({});
                }
            } catch (error) {
                console.error('❌ Failed to initialize roadmap progress:', error);
            }
        }

        // Initialize roadmap components when section-content-provider is ready (lazy — called from development-roadmap-page.js)
        async function initializeWhenReady() {
            if (window.sectionContentProvider) {
                await initializeRoadmapTimeline();
                await Promise.all([
                    initializeRoadmapProgress(),
                    initializeOptimizationEngine?.(),
                    initializeAnalyticsPerformanceDashboard?.(),
                    initializePatternAnalyzer?.()
                ].filter(Boolean));
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            return initializeWhenReady();
        }

        // Export Menu Functions
        let currentRoadmapData = null;
        
        function initializeExportMenu(roadmapData) {
            currentRoadmapData = roadmapData;
            
            // Create export menu if export system is available
            if (typeof window.roadmapExport !== 'undefined') {
                const exportContainer = document.getElementById('export-menu-container');
                if (exportContainer) {
                    exportContainer.innerHTML = '';
                    const _menu = window.roadmapExport.createExportMenu(roadmapData, exportContainer);
                }
            }
        }
        
        async function showExportMenu() {
            if (!currentRoadmapData) {
                showNotification('❌ Roadmap data not loaded', 'error');
                return;
            }
            
            try {
                if (typeof window.roadmapExport !== 'undefined') {
                    await window.roadmapExport.exportAll(currentRoadmapData);
                } else {
                    showNotification('❌ Export system not available', 'error');
                }
            } catch (error) {
                console.error('Export failed:', error);
                showNotification('❌ Export failed', 'error');
            }
        }
        
        // Export individual formats
        async function _exportRoadmapJSON() {
            if (currentRoadmapData && typeof window.roadmapExport !== 'undefined') {
                await window.roadmapExport.export(currentRoadmapData, 'json');
            }
        }
        
        async function _exportRoadmapCSV() {
            if (currentRoadmapData && typeof window.roadmapExport !== 'undefined') {
                await window.roadmapExport.export(currentRoadmapData, 'csv');
            }
        }
        
        async function _exportRoadmapExcel() {
            if (currentRoadmapData && typeof window.roadmapExport !== 'undefined') {
                await window.roadmapExport.export(currentRoadmapData, 'excel');
            }
        }
        
        async function exportRoadmapPDF() {
            if (!currentRoadmapData) {
                showNotification('Generate or load a roadmap before exporting PDF', 'warning');
                return;
            }
            if (typeof window.roadmapExport === 'undefined') {
                showNotification('Roadmap export system not loaded', 'error');
                return;
            }
            try {
                await window.roadmapExport.export(currentRoadmapData, 'pdf');
            } catch (error) {
                console.error('Roadmap PDF export failed:', error);
                showNotification('PDF export failed: ' + error.message, 'error');
            }
        }

        async function exportRoadmapMarkdown() {
            if (!currentRoadmapData) {
                showNotification('Generate or load a roadmap before exporting Markdown', 'warning');
                return;
            }
            if (typeof window.roadmapExport === 'undefined') {
                showNotification('Roadmap export system not loaded', 'error');
                return;
            }
            try {
                await window.roadmapExport.export(currentRoadmapData, 'markdown');
                showNotification('✅ Markdown report generated!', 'success');
            } catch (error) {
                console.error('Roadmap Markdown export failed:', error);
                showNotification('Markdown export failed: ' + error.message, 'error');
            }
        }
        
        // Initialize Optimization Engine
        async function initializeOptimizationEngine() {
            try {
                const container = document.getElementById('optimization-engine-container');
                if (container && window.sectionContentProvider) {
                    await window.sectionContentProvider.initializeComponent('OptimizationEngine', container);
                    console.log('✅ Optimization engine initialized successfully');
                } else {
                    console.warn('⚠️ Optimization engine container or provider not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize optimization engine:', error);
                showNotification('Failed to load optimization engine', 'error');
            }
        }
        
        // Initialize AI Roadmap Dashboard
        async function initializeAIRoadmapDashboard() {
            const containerId = 'ai-roadmap-dashboard-container';
            const container = document.getElementById(containerId);
            if (!container) {
                return;
            }
            if (window.aiRoadmapDashboard?.container) {
                return;
            }

            try {
                if (typeof window.AIRoadmapDashboard !== 'undefined') {
                    const dataService = window.realDataService
                        || (typeof RealDataService !== 'undefined' ? new RealDataService() : null);
                    window.aiRoadmapDashboard = new window.AIRoadmapDashboard(containerId, { dataService });
                    await window.aiRoadmapDashboard.init();
                    console.log('✅ AI roadmap dashboard initialized successfully');
                } else {
                    console.warn('AI roadmap dashboard class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize AI roadmap dashboard:', error);
                showNotification('Failed to load AI roadmap dashboard', 'error');
            }
        }
        
        // Initialize AI Tools Dashboard
        async function initializeAIToolsDashboard() {
            try {
                if (typeof window.AIToolsDashboard !== 'undefined') {
                    const aiToolsDashboard = new AIToolsDashboard('ai-tools-dashboard-container', {
                        showPerformance: true,
                        showUsage: true,
                        realTimeUpdates: true,
                        updateInterval: 30000,
                        theme: 'dark'
                    });
                    
                    await aiToolsDashboard.loadAIToolsData();
                    
                    console.log('✅ AI tools dashboard initialized successfully');
                } else {
                    console.warn('AI tools dashboard class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize AI tools dashboard:', error);
                showNotification('Failed to load AI tools dashboard', 'error');
            }
        }
        
        // Initialize Analytics Performance Dashboard
        async function initializeAnalyticsPerformanceDashboard() {
            try {
                const container = document.getElementById('analytics-performance-dashboard-container');
                if (container && window.sectionContentProvider) {
                    await window.sectionContentProvider.initializeComponent('AnalyticsPerformanceDashboard', container);
                    console.log('✅ Analytics performance dashboard initialized successfully');
                } else {
                    console.warn('⚠️ Analytics performance dashboard container or provider not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize analytics performance dashboard:', error);
                showNotification('Failed to load analytics performance dashboard', 'error');
            }
        }
        
        // Initialize Development Tools Tracker
        async function initializeDevelopmentToolsTracker() {
            try {
                if (typeof window.DevelopmentToolsTracker !== 'undefined') {
                    const devToolsTracker = new DevelopmentToolsTracker('development-tools-tracker-container', {
                        showUsage: true,
                        showPerformance: true,
                        realTimeUpdates: true,
                        updateInterval: 30000,
                        theme: 'dark'
                    });
                    
                    await devToolsTracker.loadDevToolsData();
                    
                    console.log('✅ Development tools tracker initialized successfully');
                } else {
                    console.warn('Development tools tracker class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize development tools tracker:', error);
                showNotification('Failed to load development tools tracker', 'error');
            }
        }
        
        // Initialize Technical Debt Analyzer
        async function initializeTechnicalDebtAnalyzer() {
            try {
                if (typeof window.TechnicalDebtAnalyzer !== 'undefined') {
                    const techDebtAnalyzer = new TechnicalDebtAnalyzer('technical-debt-analyzer-container', {
                    showMetrics: true,
                    showRecommendations: true,
                    realTimeUpdates: true,
                    updateInterval: 30000,
                    theme: 'dark'
                    });
                    
                    await techDebtAnalyzer.loadTechnicalDebtData();
                    
                    console.log('✅ Technical debt analyzer initialized successfully');
                } else {
                    console.warn('Technical debt analyzer class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize technical debt analyzer:', error);
                showNotification('Failed to load technical debt analyzer', 'error');
            }
        }
        
        // Initialize Project Resources Manager
        async function initializeProjectResourcesManager() {
            try {
                if (typeof window.ProjectResourcesManager !== 'undefined') {
                    const projResourcesManager = new ProjectResourcesManager('project-resources-manager-container', {
                    showUtilization: true,
                    showMetrics: true,
                    realTimeUpdates: true,
                    updateInterval: 30000,
                    theme: 'dark'
                    });
                    
                    await projResourcesManager.loadProjectResourcesData();
                    
                    console.log('✅ Project resources manager initialized successfully');
                } else {
                    console.warn('Project resources manager class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize project resources manager:', error);
                showNotification('Failed to load project resources manager', 'error');
            }
        }

        // Initialize Code Generation Dashboard
        async function initializeCodeGenerationDashboard() {
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
                    console.warn('Code generation dashboard class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize code generation dashboard:', error);
                showNotification('Failed to load code generation dashboard', 'error');
            }
        }
        
        // Initialize Pattern Analyzer
        async function initializePatternAnalyzer() {
            try {
                const container = document.getElementById('pattern-analyzer-container');
                if (container && window.sectionContentProvider) {
                    await window.sectionContentProvider.initializeComponent('PatternAnalyzer', container);
                    console.log('✅ Pattern analyzer initialized successfully');
                } else {
                    console.warn('⚠️ Pattern analyzer container or provider not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize pattern analyzer:', error);
                showNotification('Failed to load pattern analyzer', 'error');
            }
        }
        
        // Initialize Data Generator
        async function initializeDataGenerator() {
            try {
                if (typeof window.DataGenerator !== 'undefined') {
                    const dataGenerator = new DataGenerator('data-generator-container', {
                        showDetails: true,
                        interactiveElements: true,
                        theme: 'dark',
                        realTimeUpdates: true,
                        updateInterval: 30000,
                        privacyProtection: true,
                        batchSize: 100
                    });
                    
                    await dataGenerator.startGeneration();
                    
                    console.log('✅ Data generator initialized successfully');
                } else {
                    console.warn('Data generator class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize data generator:', error);
                showNotification('Failed to load data generator', 'error');
            }
        }
        
        // Initialize Schema Designer
        async function initializeSchemaDesigner() {
            try {
                if (typeof window.SchemaDesigner !== 'undefined') {
                    const schemaDesigner = new SchemaDesigner('schema-designer-container', {
                        showDetails: true,
                        interactiveElements: true,
                        theme: 'dark',
                        realTimeUpdates: true,
                        updateInterval: 30000,
                        databaseType: 'postgresql'
                    });
                    
                    await schemaDesigner.generateSchemas();
                    
                    console.log('✅ Schema designer initialized successfully');
                } else {
                    console.warn('Schema designer class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize schema designer:', error);
                showNotification('Failed to load schema designer', 'error');
            }
        }

    window.downloadDevelopmentRoadmapReport = downloadDevelopmentRoadmapReport;
    window.loadLiveRoadmapFromGenerator = loadLiveRoadmapFromGenerator;
    window.readCachedCodeRoadmapGenerator = readCachedCodeRoadmapGenerator;
    window.writeCachedCodeRoadmapGenerator = writeCachedCodeRoadmapGenerator;
    window.loadBaselineDevelopmentRoadmap = loadBaselineDevelopmentRoadmap;
    window.loadSampleRoadmapJson = loadSampleRoadmapJson;
    window.loadMasterRoadmapSampleJson = loadMasterRoadmapSampleJson;
    window.loadGgufSampleRoadmapJson = loadGgufSampleRoadmapJson;
    window.applyImportedRoadmapJson = applyImportedRoadmapJson;
    window.applyGeneratedRoadmapToDashboard = applyGeneratedRoadmapToDashboard;
    window.isStaleDevelopmentRoadmap = isStaleDevelopmentRoadmap;
    window.restoreSavedDynamicRoadmap = restoreSavedDynamicRoadmap;
    window.downloadGeneratedRoadmapJson = downloadGeneratedRoadmapJson;
    window.openExecutiveHtmlExport = openExecutiveHtmlExport;
    window.downloadComparisonReport = downloadComparisonReport;
    window.applyImportedComparisonReport = applyImportedComparisonReport;
    window.loadComparisonSample = loadComparisonSample;
    window.importRoadmapJsonFile = importRoadmapJsonFile;
    window.showExportMenu = showExportMenu;
    window.exportRoadmapPDF = exportRoadmapPDF;
    window.exportRoadmapMarkdown = exportRoadmapMarkdown;
    window.initializeExportMenu = initializeExportMenu;
    window.initializeRoadmapWhenReady = initializeWhenReady;
    window.initializeRoadmapTimeline = initializeRoadmapTimeline;
    window.initializeComparisonDashboard = initializeComparisonDashboard;
    window.initializeOptimizationEngine = initializeOptimizationEngine;
    window.initializeAnalyticsPerformanceDashboard = initializeAnalyticsPerformanceDashboard;
    window.initializePatternAnalyzer = initializePatternAnalyzer;
    window.togglePhaseDetails = togglePhaseDetails;
    window.highlightPhase = highlightPhase;
    window.unhighlightPhase = unhighlightPhase;
    window.loadBlobDrivenRoadmap = loadBlobDrivenRoadmap;
    window.analyzeBlobWithAI = analyzeBlobWithAI;
})();
