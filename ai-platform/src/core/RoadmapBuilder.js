/**
 * Roadmap Builder - Comprehensive roadmap generation system
 * Creates roadmaps from various data sources including URL analysis, GGUF data, and system metrics
 */

class RoadmapBuilder {
    constructor() {
        this.roadmapTemplates = new Map();
        this.dataSources = new Map();
        this.roadmapHistory = [];
        this.currentRoadmap = null;
        
        this.initializeTemplates();
        this.initializeDataSources();
    }

    /**
     * Initialize roadmap templates
     */
    initializeTemplates() {
        this.roadmapTemplates.set('standard', {
            name: 'Standard Development Roadmap',
            description: 'Classic software development roadmap with phases and milestones',
            phases: ['Foundation', 'Development', 'Testing', 'Deployment', 'Maintenance'],
            structure: 'linear',
            timeUnit: 'weeks',
            defaultDuration: 12
        });

        this.roadmapTemplates.set('agile', {
            name: 'Agile Sprint Roadmap',
            description: 'Agile methodology with sprints and iterative development',
            phases: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6'],
            structure: 'iterative',
            timeUnit: 'sprints',
            defaultDuration: 6
        });

        this.roadmapTemplates.set('technical', {
            name: 'Technical Implementation Roadmap',
            description: 'Technical roadmap focusing on architecture and implementation',
            phases: ['Architecture', 'Backend', 'Frontend', 'Integration', 'Optimization'],
            structure: 'technical',
            timeUnit: 'weeks',
            defaultDuration: 16
        });

        this.roadmapTemplates.set('product', {
            name: 'Product Launch Roadmap',
            description: 'Product-focused roadmap with market validation and launch phases',
            phases: ['Research', 'Design', 'Development', 'Testing', 'Launch', 'Growth'],
            structure: 'product',
            timeUnit: 'months',
            defaultDuration: 18
        });

        this.roadmapTemplates.set('security', {
            name: 'Security Implementation Roadmap',
            description: 'Security-focused roadmap with compliance and hardening phases',
            phases: ['Assessment', 'Planning', 'Implementation', 'Testing', 'Monitoring'],
            structure: 'security',
            timeUnit: 'weeks',
            defaultDuration: 20
        });
    }

    /**
     * Initialize available data sources
     */
    initializeDataSources() {
        this.dataSources.set('url-analysis', {
            name: 'URL Analysis Results',
            description: 'Website analysis data from URL analyzer',
            type: 'analysis',
            fields: ['structure', 'performance', 'seo', 'security', 'accessibility', 'content', 'technology', 'links'],
            priority: 'high'
        });

        this.dataSources.set('gguf-roadmap', {
            name: 'GGUF Roadmap Data',
            description: 'AI-powered roadmap analysis from GGUF model',
            type: 'roadmap',
            fields: ['projectOverview', 'developmentPhases', 'modelInfo', 'analysisOverview'],
            priority: 'high'
        });

        this.dataSources.set('directory-analysis', {
            name: 'Directory Analysis',
            description: 'Project structure and organization analysis',
            type: 'structure',
            fields: ['structure', 'metrics', 'insights', 'recommendations'],
            priority: 'medium'
        });

        this.dataSources.set('website-analysis', {
            name: 'Website Analysis',
            description: 'Comprehensive website analysis results',
            type: 'analysis',
            fields: ['structure', 'performance', 'seo', 'security', 'accessibility'],
            priority: 'medium'
        });

        this.dataSources.set('development-metrics', {
            name: 'Development Metrics',
            description: 'Current development performance and metrics',
            type: 'metrics',
            fields: ['velocity', 'quality', 'coverage', 'issues', 'commits'],
            priority: 'medium'
        });
    }

    /**
     * Create roadmap from multiple data sources
     */
    async createRoadmap(options = {}) {
        const {
            template = 'standard',
            dataSources = ['url-analysis', 'gguf-roadmap'],
            title = 'Generated Roadmap',
            description = 'Roadmap generated from system data',
            duration = null,
            customPhases = null
        } = options;

        try {
            console.log('🗺️ Creating roadmap from data sources...');
            
            // Validate template
            const selectedTemplate = this.roadmapTemplates.get(template);
            if (!selectedTemplate) {
                throw new Error(`Template "${template}" not found`);
            }

            // Collect data from specified sources
            const collectedData = await this.collectDataFromSources(dataSources);
            
            // Create roadmap structure
            const roadmapStructure = this.buildRoadmapStructure(
                selectedTemplate,
                collectedData,
                duration || selectedTemplate.defaultDuration,
                customPhases
            );

            // Generate roadmap content
            const roadmap = this.generateRoadmapContent(
                roadmapStructure,
                collectedData,
                title,
                description
            );

            // Add metadata
            roadmap.metadata = {
                id: this.generateRoadmapId(),
                template: template,
                dataSources: dataSources,
                title: title,
                description: description,
                createdAt: new Date().toISOString(),
                generatedFrom: 'system-data',
                version: '1.0'
            };

            this.currentRoadmap = roadmap;
            this.roadmapHistory.unshift(roadmap);

            console.log('✅ Roadmap created successfully');
            return roadmap;

        } catch (error) {
            console.error('❌ Failed to create roadmap:', error);
            throw error;
        }
    }

    /**
     * Collect data from specified data sources
     */
    async collectDataFromSources(sourceNames) {
        const collectedData = {};
        
        for (const sourceName of sourceNames) {
            const dataSource = this.dataSources.get(sourceName);
            if (!dataSource) {
                console.warn(`⚠️ Data source "${sourceName}" not found, skipping`);
                continue;
            }

            try {
                const data = await this.fetchDataSourceData(sourceName, dataSource);
                collectedData[sourceName] = data;
                console.log(`📊 Collected data from ${sourceName}`);
            } catch (error) {
                console.warn(`⚠️ Failed to collect data from ${sourceName}:`, error.message);
                collectedData[sourceName] = null;
            }
        }

        return collectedData;
    }

    /**
     * Fetch data from a specific data source
     */
    async fetchDataSourceData(sourceName, dataSource) {
        switch (sourceName) {
            case 'url-analysis':
                return this.fetchURLAnalysisData();
            case 'gguf-roadmap':
                return this.fetchGGUFData();
            case 'directory-analysis':
                return this.fetchDirectoryAnalysisData();
            case 'website-analysis':
                return this.fetchWebsiteAnalysisData();
            case 'development-metrics':
                return this.fetchDevelopmentMetricsData();
            default:
                throw new Error(`Unknown data source: ${sourceName}`);
        }
    }

    /**
     * Fetch URL analysis data
     */
    async fetchURLAnalysisData() {
        try {
            const response = await fetch('/api/url/history');
            const result = await response.json();
            
            if (result.success && result.history && result.history.length > 0) {
                // Get the most recent analysis
                const latestAnalysis = result.history[0];
                return this.extractURLAnalysisInsights(latestAnalysis);
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to fetch URL analysis data:', error);
            return null;
        }
    }

    /**
     * Extract insights from URL analysis
     */
    extractURLAnalysisInsights(analysis) {
        return {
            url: analysis.url,
            score: analysis.score,
            performance: {
                loadTime: analysis.results?.performance?.loadTime || 0,
                score: analysis.results?.performance?.score || 0,
                recommendations: analysis.results?.performance?.recommendations || []
            },
            seo: {
                score: analysis.results?.seo?.score || 0,
                titlePresent: analysis.results?.seo?.title?.present || false,
                descriptionPresent: analysis.results?.seo?.description?.present || false,
                headingStructure: analysis.results?.seo?.headings?.properOrder || false
            },
            security: {
                score: analysis.results?.security?.score || 0,
                httpsEnabled: analysis.results?.security?.https || false,
                securityHeaders: analysis.results?.security?.headers?.securityHeaders || 0
            },
            structure: {
                totalElements: analysis.results?.structure?.overview?.totalElements || 0,
                hasTitle: analysis.results?.structure?.overview?.hasTitle || false,
                imageCount: analysis.results?.structure?.overview?.imageCount || 0,
                linkCount: analysis.results?.structure?.overview?.linkCount || 0
            },
            technology: {
                frameworks: analysis.results?.technology?.frameworks || [],
                cms: analysis.results?.technology?.cms || [],
                analytics: analysis.results?.technology?.analytics || []
            }
        };
    }

    /**
     * Fetch GGUF roadmap data
     */
    async fetchGGUFData() {
        try {
            const response = await fetch('/api/gguf/report');
            const result = await response.json();
            
            if (result.success) {
                return this.extractGGUFInsights(result.data);
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to fetch GGUF data:', error);
            return null;
        }
    }

    /**
     * Extract insights from GGUF data
     */
    extractGGUFInsights(ggufData) {
        return {
            modelInfo: ggufData.modelInfo,
            projectOverview: ggufData.projectOverview,
            developmentPhases: ggufData.developmentPhases || [],
            analysisOverview: ggufData.analysisOverview,
            aiConfidence: ggufData.modelInfo?.confidence || 0,
            totalFeatures: ggufData.projectOverview?.totalFeatures || 0,
            completionRate: ggufData.projectOverview?.completionRate || '0%'
        };
    }

    /**
     * Fetch directory analysis data
     */
    async fetchDirectoryAnalysisData() {
        try {
            const response = await fetch('/api/directory/analyze?path=.');
            const result = await response.json();
            
            if (result.success) {
                return this.extractDirectoryInsights(result.data);
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to fetch directory analysis data:', error);
            return null;
        }
    }

    /**
     * Extract insights from directory analysis
     */
    extractDirectoryInsights(directoryData) {
        return {
            structure: directoryData.structure,
            metrics: directoryData.metrics,
            insights: directoryData.insights,
            recommendations: directoryData.recommendations,
            projectInfo: directoryData.projectInfo
        };
    }

    /**
     * Fetch website analysis data
     */
    async fetchWebsiteAnalysisData() {
        try {
            const response = await fetch('/api/website/analyze');
            const result = await response.json();
            
            if (result.success) {
                return this.extractWebsiteInsights(result.report);
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to fetch website analysis data:', error);
            return null;
        }
    }

    /**
     * Extract insights from website analysis
     */
    extractWebsiteInsights(websiteData) {
        return {
            overview: websiteData.overview,
            metrics: websiteData.qualityMetrics,
            recommendations: websiteData.recommendations,
            blueprint: websiteData.websiteBlueprint,
            implementation: websiteData.implementationPlan
        };
    }

    /**
     * Fetch development metrics data
     */
    async fetchDevelopmentMetricsData() {
        // Mock development metrics data
        return {
            velocity: {
                storyPoints: 45,
                tasksCompleted: 38,
                tasksTotal: 52,
                efficiency: 0.85
            },
            quality: {
                codeCoverage: 87.5,
                bugDensity: 2.3,
                codeQuality: 8.2,
                technicalDebt: 15
            },
            coverage: {
                unitTests: 87.5,
                integrationTests: 78.2,
                e2eTests: 65.4,
                totalCoverage: 82.3
            },
            issues: {
                total: 23,
                critical: 2,
                high: 8,
                medium: 10,
                low: 3
            },
            commits: {
                total: 156,
                today: 8,
                thisWeek: 34,
                contributors: 5
            }
        };
    }

    /**
     * Build roadmap structure
     */
    buildRoadmapStructure(template, data, duration, customPhases) {
        const phases = customPhases || template.phases;
        const timeUnit = template.timeUnit;
        
        const structure = {
            template: template.name,
            duration: duration,
            timeUnit: timeUnit,
            phases: phases.map((phaseName, index) => ({
                name: phaseName,
                order: index,
                duration: Math.ceil(duration / phases.length),
                timeUnit: timeUnit,
                status: this.determinePhaseStatus(index, phases.length, data),
                startDate: this.calculatePhaseStartDate(index, duration, timeUnit),
                endDate: this.calculatePhaseEndDate(index, phases.length, duration, timeUnit),
                dependencies: index > 0 ? [phases[index - 1]] : [],
                deliverables: this.generatePhaseDeliverables(phaseName, data),
                risks: this.identifyPhaseRisks(phaseName, index, data),
                metrics: this.generatePhaseMetrics(phaseName, data),
                resources: this.calculatePhaseResources(phaseName, data)
            }))
        };

        return structure;
    }

    /**
     * Determine phase status based on data
     */
    determinePhaseStatus(index, totalPhases, data) {
        // Use data insights to determine actual status
        if (data.ggufData && data.ggufData.developmentPhases) {
            const ggufPhases = data.ggufData.developmentPhases;
            if (ggufPhases[index]) {
                return ggufPhases[index].status;
            }
        }
        
        // Default status progression
        if (index === 0) return 'completed';
        if (index < totalPhases - 1) return 'in-progress';
        return 'planned';
    }

    /**
     * Calculate phase start date
     */
    calculatePhaseStartDate(index, totalDuration, timeUnit) {
        const startDate = new Date();
        const unitInMs = this.getTimeUnitInMs(timeUnit);
        const offset = index * (totalDuration / totalPhases) * unitInMs;
        return new Date(startDate.getTime() + offset);
    }

    /**
     * Calculate phase end date
     */
    calculatePhaseEndDate(index, totalPhases, totalDuration, timeUnit) {
        const startDate = this.calculatePhaseStartDate(index, totalDuration, timeUnit);
        const unitInMs = this.getTimeUnitInMs(timeUnit);
        const phaseDuration = (totalDuration / totalPhases) * unitInMs;
        return new Date(startDate.getTime() + phaseDuration);
    }

    /**
     * Get time unit in milliseconds
     */
    getTimeUnitInMs(timeUnit) {
        const units = {
            'days': 24 * 60 * 60 * 1000,
            'weeks': 7 * 24 * 60 * 60 * 1000,
            'months': 30 * 24 * 60 * 60 * 1000,
            'sprints': 2 * 7 * 24 * 60 * 60 * 1000
        };
        return units[timeUnit] || units['weeks'];
    }

    /**
     * Generate phase deliverables
     */
    generatePhaseDeliverables(phaseName, data) {
        const deliverables = [];
        
        // Extract deliverables from URL analysis data
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            
            if (phaseName.toLowerCase().includes('foundation') || phaseName.toLowerCase().includes('setup')) {
                if (urlData.structure.totalElements > 0) {
                    deliverables.push('Complete website structure analysis');
                }
                if (urlData.technology.frameworks.length > 0) {
                    deliverables.push(`Technology stack documentation: ${urlData.technology.frameworks.join(', ')}`);
                }
                if (urlData.security.httpsEnabled) {
                    deliverables.push('HTTPS security implementation');
                }
            }
            
            if (phaseName.toLowerCase().includes('development') || phaseName.toLowerCase().includes('implementation')) {
                if (urlData.seo.score < 80) {
                    deliverables.push('SEO optimization implementation');
                }
                if (urlData.performance.score < 70) {
                    deliverables.push('Performance optimization');
                }
                if (urlData.security.score < 70) {
                    deliverables.push('Security hardening');
                }
            }
            
            if (phaseName.toLowerCase().includes('testing') || phaseName.toLowerCase().includes('validation')) {
                if (urlData.structure.totalElements > 50) {
                    deliverables.push('Comprehensive testing suite');
                }
                if (urlData.accessibility && urlData.accessibility.score < 80) {
                    deliverables.push('Accessibility improvements');
                }
            }
        }
        
        // Extract deliverables from GGUF data
        if (data.ggufData) {
            const ggufData = data.ggufData;
            
            if (ggufData.developmentPhases) {
                const phaseIndex = this.findPhaseIndex(phaseName, ggufData.developmentPhases);
                if (phaseIndex >= 0 && ggufData.developmentPhases[phaseIndex]) {
                    const phase = ggufData.developmentPhases[phaseIndex];
                    deliverables.push(...phase.features);
                    deliverables.push(...phase.milestones);
                }
            }
        }
        
        // Ensure we have at least one deliverable
        if (deliverables.length === 0) {
            deliverables.push(`Complete ${phaseName} phase`);
        }
        
        return deliverables;
    }

    /**
     * Find phase index in GGUF data
     */
    findPhaseIndex(phaseName, phases) {
        return phases.findIndex(phase => 
            phase.phase.toLowerCase().includes(phaseName.toLowerCase()) ||
            phaseName.toLowerCase().includes(phase.phase.toLowerCase())
        );
    }

    /**
     * Identify phase risks
     */
    identifyPhaseRisks(phaseName, index, data) {
        const risks = [];
        
        // Analyze URL analysis risks
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            
            if (urlData.security.score < 60) {
                risks.push({
                    type: 'security',
                    severity: 'high',
                    description: 'Security issues detected that need immediate attention',
                    mitigation: 'Implement security best practices and conduct security audit'
                });
            }
            
            if (urlData.performance.score < 60) {
                risks.push({
                    type: 'performance',
                    severity: 'medium',
                    description: 'Performance issues may impact user experience',
                    mitigation: 'Optimize resources and implement performance monitoring'
                });
            }
            
            if (urlData.seo.score < 60) {
                risks.push({
                    type: 'seo',
                    severity: 'medium',
                    description: 'SEO issues may affect search engine ranking',
                    mitigation: 'Implement SEO best practices and conduct SEO audit'
                });
            }
        }
        
        // Analyze GGUF data risks
        if (data.ggufData) {
            const ggufData = data.ggufData;
            
            if (ggufData.aiConfidence < 80) {
                risks.push({
                    type: 'ai-confidence',
                    severity: 'medium',
                    description: 'AI confidence is below optimal threshold',
                    mitigation: 'Review AI model outputs and validate recommendations'
                });
            }
            
            if (ggufData.totalFeatures > 100) {
                risks.push({
                    type: 'scope',
                    severity: 'medium',
                    description: 'Large feature scope may impact timeline',
                    mitigation: 'Consider phase-based approach and prioritize features'
                });
            }
        }
        
        return risks;
    }

    /**
     * Generate phase metrics
     */
    generatePhaseMetrics(phaseName, data) {
        const metrics = {};
        
        // URL analysis metrics
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            metrics.overallScore = urlData.score || 0;
            metrics.performanceScore = urlData.performance?.score || 0;
            metrics.seoScore = urlData.seo?.score || 0;
            metrics.securityScore = urlData.security?.score || 0;
        }
        
        // GGUF data metrics
        if (data.ggufData) {
            metrics.aiConfidence = data.ggufData.aiConfidence || 0;
            metrics.featureCompletion = this.calculateFeatureCompletion(data.ggufData);
            metrics.projectHealth = data.ggufData.projectOverview?.projectHealth || 'Unknown';
        }
        
        // Development metrics
        if (data.developmentMetrics) {
            metrics.velocity = data.developmentMetrics.velocity;
            metrics.quality = data.developmentMetrics.quality;
            metrics.coverage = data.developmentMetrics.coverage;
        }
        
        return metrics;
    }

    /**
     * Calculate feature completion from GGUF data
     */
    calculateFeatureCompletion(ggufData) {
        if (!ggufData.projectOverview) return 0;
        
        const completed = ggufData.projectOverview.completedFeatures || 0;
        const total = ggufData.projectOverview.totalFeatures || 1;
        return Math.round((completed / total) * 100);
    }

    /**
     * Calculate phase resources
     */
    calculatePhaseResources(phaseName, data) {
        const resources = {
            team: [],
            skills: [],
            tools: [],
            budget: 0
        };
        
        // Extract resources from data
        if (data.directoryAnalysis && data.directoryAnalysis.projectInfo) {
            const projectInfo = data.directoryAnalysis.projectInfo;
            
            if (projectInfo.technologyStack) {
                resources.tools.push(...projectInfo.technologyStack);
            }
        }
        
        if (data.urlAnalysis && data.urlAnalysis.technology) {
            resources.tools.push(...data.urlAnalysis.technology.frameworks);
            resources.skills.push(...data.urlAnalysis.technology.frameworks.map(f => `${f} development`));
        }
        
        // Default team allocation based on phase complexity
        const teamSize = this.calculateTeamSize(phaseName, data);
        resources.team = Array(teamSize).fill(null).map((_, i) => `Team Member ${i + 1}`);
        
        return resources;
    }

    /**
     * Calculate team size based on phase complexity
     */
    calculateTeamSize(phaseName, data) {
        let baseSize = 3;
        
        // Adjust based on phase complexity
        if (phaseName.toLowerCase().includes('foundation') || phaseName.toLowerCase().includes('setup')) {
            baseSize = 2;
        } else if (phaseName.toLowerCase().includes('development') || phaseName.toLowerCase().includes('implementation')) {
            baseSize = 4;
        } else if (phaseName.toLowerCase().includes('testing') || phaseName.toLowerCase().includes('validation')) {
            baseSize = 3;
        } else if (phaseName.toLowerCase().includes('deployment') || phaseName.toLowerCase().includes('launch')) {
            baseSize = 5;
        }
        
        // Adjust based on data complexity
        if (data.urlAnalysis && data.urlAnalysis.structure.totalElements > 100) {
            baseSize += 1;
        }
        
        if (data.ggufData && data.ggufData.totalFeatures > 50) {
            baseSize += 1;
        }
        
        return baseSize;
    }

    /**
     * Generate comprehensive roadmap content
     */
    generateRoadmapContent(structure, data, title, description) {
        const content = {
            title: title,
            description: description,
            structure: structure,
            executiveSummary: this.generateExecutiveSummary(structure, data),
            phases: structure.phases.map(phase => ({
                ...phase,
                analysis: this.generatePhaseAnalysis(phase, data),
                timeline: this.generatePhaseTimeline(phase),
                recommendations: this.generatePhaseRecommendations(phase, data),
                dependencies: this.generateDependencyGraph(structure.phases),
                kpis: this.generatePhaseKPIs(phase, data)
            })),
            dependencies: this.generateDependencyGraph(structure.phases),
            risks: this.generateOverallRisks(structure, data),
            timeline: this.generateOverallTimeline(structure),
            resources: this.generateResourcePlan(structure, data),
            budget: this.generateBudgetEstimate(structure, data),
            quality: this.generateQualityPlan(structure, data),
            success: this.generateSuccessMetrics(structure, data)
        };
        
        return content;
    }

    /**
     * Generate executive summary
     */
    generateExecutiveSummary(structure, data) {
        const summary = {
            totalPhases: structure.phases.length,
            totalDuration: structure.duration,
            timeUnit: structure.timeUnit,
            estimatedStartDate: structure.phases[0]?.startDate,
            estimatedEndDate: structure.phases[structure.phases.length - 1]?.endDate,
            overallHealth: this.calculateOverallHealth(data),
            keyInsights: this.extractKeyInsights(data),
            primaryRisks: this.identifyPrimaryRisks(structure, data),
            recommendedActions: this.generateRecommendedActions(data),
            budgetEstimate: this.generateBudgetEstimate(structure, data),
            successProbability: this.calculateSuccessProbability(structure, data)
        };
        
        return summary;
    }

    /**
     * Generate phase analysis
     */
    generatePhaseAnalysis(phase, data) {
        return {
            objectives: this.generatePhaseObjectives(phase),
            currentStatus: phase.status,
            progress: this.calculatePhaseProgress(phase, data),
            blockers: this.identifyBlockers(phase, data),
            opportunities: this.identifyOpportunities(phase, data),
            dependencies: phase.dependencies,
            risks: phase.risks,
            metrics: phase.metrics,
            resources: phase.resources
        };
    }

    /**
     * Generate phase objectives
     */
    generatePhaseObjectives(phase) {
        const objectives = [];
        
        if (phase.name.toLowerCase().includes('foundation')) {
            objectives.push('Establish project foundation and infrastructure');
            objectives.push('Set up development environment and tools');
            objectives.push('Define project architecture and standards');
        } else if (phase.name.toLowerCase().includes('development')) {
            objectives.push('Implement core features and functionality');
            objectives.push('Build and test application components');
            objectives.push('Integrate with existing systems');
        } else if (phase.name.toLowerCase().includes('testing')) {
            objectives.push('Conduct comprehensive testing');
            objectives.push('Validate system functionality');
            objectives.push('Ensure quality standards are met');
        } else if (phase.name.toLowerCase().includes('deployment')) {
            objectives.push('Deploy application to production');
            objectives.push('Configure production infrastructure');
            objectives.push('Establish monitoring and alerting');
        } else if (phase.name.toLowerCase().includes('maintenance')) {
            objectives.push('Provide ongoing support and maintenance');
            objectives.push('Monitor system performance');
            objectives.push('Implement improvements and updates');
        }
        
        return objectives;
    }

    /**
     * Calculate phase progress
     */
    calculatePhaseProgress(phase, data) {
        if (phase.status === 'completed') return 100;
        if (phase.status === 'planned') return 0;
        
        // Calculate progress based on data insights
        let progress = 50; // Default for in-progress
        
        if (data.ggufData && data.ggufData.developmentPhases) {
            const phaseIndex = this.findPhaseIndex(phase.name, data.ggufData.developmentPhases);
            if (phaseIndex >= 0 && data.ggufData.developmentPhases[phaseIndex]) {
                progress = data.ggufData.developmentPhases[phaseIndex].progress || 50;
            }
        }
        
        return progress;
    }

    /**
     * Identify blockers
     */
    identifyBlockers(phase, data) {
        const blockers = [];
        
        // Analyze data for potential blockers
        if (data.urlAnalysis && data.urlAnalysis.security.score < 50) {
            blockers.push({
                type: 'security',
                description: 'Security vulnerabilities must be resolved before proceeding',
                priority: 'high'
            });
        }
        
        if (data.ggufData && data.ggufData.aiConfidence < 70) {
            blockers.push({
                type: 'ai-confidence',
                description: 'Low AI confidence indicates data quality issues',
                priority: 'medium'
            });
        }
        
        return blockers;
    }

    /**
     * Identify opportunities
     */
    identifyOpportunities(phase, data) {
        const opportunities = [];
        
        if (data.urlAnalysis && data.urlAnalysis.performance.score > 80) {
            opportunities.push({
                type: 'performance',
                description: 'Strong performance foundation enables rapid development',
                impact: 'high'
            });
        }
        
        if (data.ggufData && data.ggufData.aiConfidence > 90) {
            opportunities.push({
                type: 'ai-assistance',
                description: 'High AI confidence enables better decision making',
                impact: 'high'
            });
        }
        
        return opportunities;
    }

    /**
     * Generate phase timeline
     */
    generatePhaseTimeline(phase) {
        return {
            startDate: phase.startDate,
            endDate: phase.endDate,
            duration: phase.duration,
            milestones: phase.deliverables.map((deliverable, index) => ({
                name: deliverable,
                dueDate: new Date(phase.startDate.getTime() + (index + 1) * (phase.endDate - phase.startDate) / phase.deliverables.length),
                status: index === 0 ? 'completed' : index < phase.deliverables.length - 1 ? 'in-progress' : 'planned'
            }))
        };
    }

    /**
     * Generate phase recommendations
     */
    generatePhaseRecommendations(phase, data) {
        const recommendations = [];
        
        // Generate recommendations based on data analysis
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            
            if (urlData.seo.score < 70) {
                recommendations.push({
                    priority: 'high',
                    action: 'Implement SEO optimization',
                    description: 'Address SEO issues to improve search engine ranking',
                    impact: 'medium'
                });
            }
            
            if (urlData.performance.score < 70) {
                recommendations.push({
                    priority: 'medium',
                    action: 'Optimize website performance',
                    description: 'Improve load times and user experience',
                    impact: 'high'
                });
            }
            
            if (urlData.security.score < 70) {
                recommendations.push({
                    priority: 'high',
                    action: 'Implement security measures',
                    description: 'Address security vulnerabilities and implement best practices',
                    impact: 'high'
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Generate dependency graph
     */
    generateDependencyGraph(phases) {
        const dependencies = [];
        
        phases.forEach((phase, index) => {
            phase.dependencies.forEach(depIndex => {
                dependencies.push({
                    from: phases[depIndex]?.name || 'Unknown',
                    to: phase.name,
                    type: 'sequential',
                    strength: 'required'
                });
            });
        });
        
        return dependencies;
    }

    /**
     * Generate phase KPIs
     */
    generatePhaseKPIs(phase, data) {
        const kpis = {};
        
        if (phase.metrics) {
            kpis.scheduleAdherence = {
                target: 100,
                current: this.calculatePhaseProgress(phase, data),
                status: phase.metrics.overallScore >= 80 ? 'on-track' : 'at-risk'
            };
            
            kpis.qualityScore = {
                target: 85,
                current: phase.metrics.overallScore || 0,
                status: phase.metrics.overallScore >= 85 ? 'excellent' : 'needs-improvement'
            };
            
            kpis.resourceUtilization = {
                target: 80,
                current: 75, // Mock value
                status: 'optimal'
            };
        }
        
        return kpis;
    }

    /**
     * Generate overall risks
     */
    generateOverallRisks(structure, data) {
        const risks = [];
        const allRisks = [];
        
        // Collect all phase risks
        structure.phases.forEach(phase => {
            allRisks.push(...phase.risks);
        });
        
        // Categorize and prioritize risks
        const categorizedRisks = {
            technical: [],
            resource: [],
            timeline: [],
            quality: []
        };
        
        allRisks.forEach(risk => {
            if (!categorizedRisks[risk.type]) {
                categorizedRisks[risk.type] = [];
            }
            categorizedRisks[risk.type].push(risk);
        });
        
        // Generate overall risk assessment
        Object.entries(categorizedRisks).forEach(([category, categoryRisks]) => {
            if (categoryRisks.length > 0) {
                risks.push({
                    category: category,
                    count: categoryRisks.length,
                    severity: this.calculateRiskSeverity(categoryRisks),
                    topRisks: categoryRisks.slice(0, 3)
                });
            }
        });
        
        return risks;
    }

    /**
     * Calculate risk severity
     */
    calculateRiskSeverity(risks) {
        const highSeverity = risks.filter(r => r.severity === 'high').length;
        const mediumSeverity = risks.filter(r => r.severity === 'medium').length;
        const lowSeverity = risks.filter(r => r.severity === 'low').length;
        
        if (highSeverity > 0) return 'critical';
        if (mediumSeverity > 2) return 'high';
        if (highSeverity + mediumSeverity > 3) return 'medium';
        return 'low';
    }

    /**
     * Generate overall timeline
     */
    generateOverallTimeline(structure) {
        return {
            startDate: structure.phases[0]?.startDate,
            endDate: structure.phases[structure.phases.length - 1]?.endDate,
            phases: structure.phases.map(phase => ({
                name: phase.name,
                startDate: phase.startDate,
                endDate: phase.endDate,
                duration: phase.duration,
                status: phase.status
            })),
            milestones: this.generateMilestones(structure),
            criticalPath: this.generateCriticalPath(structure)
        };
    }

    /**
     * Generate milestones
     */
    generateMilestones(structure) {
        const milestones = [];
        
        structure.phases.forEach((phase, index) => {
            phase.deliverables.forEach((deliverable, deliverableIndex) => {
                milestones.push({
                    name: deliverable,
                    phase: phase.name,
                    date: new Date(phase.startDate.getTime() + (deliverableIndex + 1) * (phase.endDate - phase.startDate) / phase.deliverables.length),
                    type: 'deliverable',
                    status: deliverableIndex === 0 ? 'completed' : deliverableIndex < phase.deliverables.length - 1 ? 'in-progress' : 'planned'
                });
            });
        });
        
        return milestones.sort((a, b) => a.date - b.date);
    }

    /**
     * Generate critical path
     */
    generateCriticalPath(structure) {
        // For now, return all phases as critical path
        return structure.phases.map(phase => ({
            name: phase.name,
            duration: phase.duration,
            dependencies: phase.dependencies,
            critical: true
        }));
    }

    /**
     * Generate resource plan
     */
    generateResourcePlan(structure, data) {
        const resources = {
            team: [],
            skills: [],
            tools: [],
            budget: 0,
            timeline: structure.duration,
            allocation: {}
        };
        
        // Aggregate resources from all phases
        const skillMap = new Map();
        const toolMap = new Map();
        
        structure.phases.forEach(phase => {
            phase.resources.team.forEach(member => {
                if (!resources.team.includes(member)) {
                    resources.team.push(member);
                }
            });
            
            phase.resources.skills.forEach(skill => {
                skillMap.set(skill, (skillMap.get(skill) || 0) + 1);
            });
            
            phase.resources.tools.forEach(tool => {
                toolMap.set(tool, (toolMap.get(tool) || 0) + 1);
            });
        });
        
        resources.skills = Array.from(skillMap.entries()).map(([skill, count]) => ({
            skill,
            count,
            priority: count > 2 ? 'high' : count > 1 ? 'medium' : 'low'
        }));
        
        resources.tools = Array.from(toolMap.entries()).map(([tool, count]) => ({
            tool,
            count,
            priority: count > 2 ? 'high' : 'medium'
        }));
        
        // Calculate budget estimate
        resources.budget = this.calculateBudgetEstimate(structure, data);
        
        return resources;
    }

    /**
     * Calculate budget estimate
     */
    calculateBudgetEstimate(structure, data) {
        let budget = 0;
        
        // Base budget calculation
        const baseCostPerWeek = 10000; // $10,000 per week
        budget = structure.duration * baseCostPerWeek;
        
        // Adjust based on team size
        const avgTeamSize = structure.phases.reduce((sum, phase) => sum + phase.resources.team.length, 0) / structure.phases.length;
        budget *= (1 + (avgTeamSize - 3) * 0.2); // 20% increase per additional team member
        
        // Adjust based on complexity
        if (data.urlAnalysis && data.urlAnalysis.structure.totalElements > 100) {
            budget *= 1.2; // 20% increase for complex projects
        }
        
        return Math.round(budget);
    }

    /**
     * Generate quality plan
     */
    generateQualityPlan(structure, data) {
        return {
            standards: this.generateQualityStandards(),
            testing: this.generateTestingStrategy(structure),
            reviews: this.generateReviewProcess(structure),
            metrics: this.generateQualityMetrics(),
            automation: this.generateAutomationPlan()
        };
    }

    /**
     * Generate quality standards
     */
    generateQualityStandards() {
        return [
            {
                name: 'Code Quality',
                description: 'Maintain code quality standards and best practices',
                criteria: ['Code coverage > 80%', 'No critical issues', 'Documentation complete']
            },
            {
                name: 'Performance',
                description: 'Ensure application meets performance requirements',
                criteria: ['Load time < 3s', 'Score > 80', 'No memory leaks']
            },
            {
                name: 'Security',
                description: 'Implement security best practices',
                criteria: ['HTTPS enabled', 'No critical vulnerabilities', 'Security headers configured']
            },
            {
                name: 'Accessibility',
                description: 'Ensure accessibility compliance',
                criteria: ['WCAG 2.1 AA compliant', 'Proper semantic HTML', 'Keyboard navigation']
            }
        ];
    }

    /**
     * Generate testing strategy
     */
    generateTestingStrategy(structure) {
        return {
            unit: {
                coverage: '80%',
                tools: ['Jest', 'Mocha', 'Jasmine'],
                frequency: 'Every commit'
            },
            integration: {
                coverage: '70%',
                tools: ['Cypress', 'Playwright'],
                frequency: 'Every build'
            },
            e2e: {
                coverage: '60%',
                tools: ['Selenium', 'Playwright'],
                frequency: 'Before release'
            },
            performance: {
                tools: ['Lighthouse', 'WebPageTest'],
                frequency: 'Weekly'
            },
            security: {
                tools: ['OWASP ZAP', 'Burp Suite'],
                frequency: 'Monthly'
            }
        };
    }

    /**
     * Generate review process
     */
    generateReviewProcess(structure) {
        return {
            code: {
                frequency: 'Every Pull Request',
                reviewers: 2,
                tools: ['GitHub PR', 'GitLab MR']
            },
            design: {
                frequency: 'Major milestones',
                reviewers: 3,
                tools: ['Figma', 'Sketch']
            },
            architecture: {
                frequency: 'Phase completion',
                reviewers: 2,
                tools: ['Architecture review']
            },
            security: {
                frequency: 'Before deployment',
                reviewers: 2,
                tools: ['Security review']
            }
        };
    }

    /**
     * Generate quality metrics
     */
    generateQualityMetrics() {
        return {
            codeCoverage: {
                target: 80,
                current: 0,
                trend: 'stable'
            },
            defectDensity: {
                target: '< 2 per KLOC',
                current: 0,
                trend: 'decreasing'
            },
            technicalDebt: {
                target: '< 5 days',
                current: 0,
                trend: 'decreasing'
            },
            customerSatisfaction: {
                target: '4.5/5',
                current: 0,
                trend: 'increasing'
            }
        };
    }

    /**
     * Generate automation plan
     */
    generateAutomationPlan() {
        return {
            ci_cd: {
                tools: ['GitHub Actions', 'Jenkins', 'GitLab CI'],
                coverage: '80%',
                frequency: 'Every commit'
            },
            testing: {
                tools: ['Jest', 'Cypress', 'Playwright'],
                coverage: '75%',
                frequency: 'Every build'
            },
            deployment: {
                tools: ['Docker', 'Kubernetes', 'Azure DevOps'],
                frequency: 'Every release'
            },
            monitoring: {
                tools: ['Prometheus', 'Grafana', 'ELK Stack'],
                frequency: 'Continuous'
            }
        };
    }

    /**
     * Generate success metrics
     */
    generateSuccessMetrics(structure, data) {
        return {
            onTimeDelivery: {
                target: '90%',
                current: '85%',
                trend: 'improving'
            },
            budgetAdherence: {
                target: '95%',
                current: '92%',
                trend: 'stable'
            },
            qualityScore: {
                target: '85',
                current: '82',
                trend: 'improving'
            },
            stakeholderSatisfaction: {
                target: '4.2/5',
                current: '4.0/5',
                trend: 'improving'
            }
        };
    }

    /**
     * Calculate overall health
     */
    calculateOverallHealth(data) {
        let healthScore = 80; // Base score
        
        // Adjust based on data quality
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            healthScore = (healthScore + urlData.score) / 2;
        }
        
        if (data.ggufData) {
            const ggufData = data.ggufData;
            healthScore = (healthScore + ggufData.aiConfidence) / 2;
        }
        
        if (healthScore >= 90) return 'excellent';
        if (healthScore >= 75) return 'good';
        if (healthScore >= 60) return 'fair';
        return 'needs-improvement';
    }

    /**
     * Extract key insights
     */
    extractKeyInsights(data) {
        const insights = [];
        
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            
            if (urlData.security.httpsEnabled) {
                insights.push('Website has HTTPS security enabled');
            }
            
            if (urlData.performance.score > 80) {
                insights.push('Strong performance foundation');
            }
            
            if (urlData.technology.frameworks.length > 3) {
                insights.push('Diverse technology stack detected');
            }
        }
        
        if (data.ggufData) {
            const ggufData = data.ggufData;
            
            if (ggufData.aiConfidence > 90) {
                insights.push('High AI confidence in recommendations');
            }
            
            if (ggufData.projectOverview.projectHealth === 'Excellent') {
                insights.push('Project health is excellent');
            }
        }
        
        return insights;
    }

    /**
     * Identify primary risks
     */
    identifyPrimaryRisks(structure, data) {
        const risks = [];
        
        const allRisks = [];
        structure.phases.forEach(phase => {
            allRisks.push(...phase.risks);
        });
        
        // Get top 3 risks by severity
        const sortedRisks = allRisks.sort((a, b) => {
            const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
        
        return sortedRisks.slice(0, 3);
    }

    /**
     * Generate recommended actions
     */
    generateRecommendedActions(data) {
        const actions = [];
        
        if (data.urlAnalysis) {
            const urlData = data.urlAnalysis;
            
            if (urlData.seo.score < 70) {
                actions.push({
                    priority: 'high',
                    action: 'Implement SEO optimization',
                    timeline: '2-4 weeks',
                    owner: 'Development Team'
                });
            }
            
            if (urlData.performance.score < 70) {
                actions.push({
                    priority: 'medium',
                    action: 'Optimize website performance',
                    timeline: '3-6 weeks',
                    owner: 'Performance Team'
                });
            }
        }
        
        return actions;
    }

    /**
     * Calculate success probability
     */
    calculateSuccessProbability(structure, data) {
        let probability = 0.8; // Base probability
        
        // Adjust based on data quality
        if (data.urlAnalysis && data.urlAnalysis.score > 80) {
            probability += 0.1;
        }
        
        if (data.ggufData && data.ggufData.aiConfidence > 85) {
            probability += 0.1;
        }
        
        // Adjust based on risk level
        const totalRisks = structure.phases.reduce((sum, phase) => sum + phase.risks.length, 0);
        if (totalRisks > 5) {
            probability -= 0.2;
        }
        
        return Math.min(0.95, Math.max(0.3, probability));
    }

    /**
     * Get available templates
     */
    getAvailableTemplates() {
        return Array.from(this.roadmapTemplates.entries()).map(([key, template]) => ({
            id: key,
            name: template.name,
            description: template.description,
            phases: template.phases,
            timeUnit: template.timeUnit,
            defaultDuration: template.defaultDuration
        }));
    }

    /**
     * Get available data sources
     */
    getAvailableDataSources() {
        return Array.from(this.dataSources.entries()).map(([key, source]) => ({
            id: key,
            name: source.name,
            description: source.description,
            type: source.type,
            fields: source.fields,
            priority: source.priority
        }));
    }

    /**
     * Get roadmap history
     */
    getRoadmapHistory() {
        return this.roadmapHistory;
    }

    /**
     * Get current roadmap
     */
    getCurrentRoadmap() {
        return this.currentRoadmap;
    }

    /**
     * Generate roadmap ID
     */
    generateRoadmapId() {
        return `roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export roadmap to JSON
     */
    exportRoadmap(roadmapId = null) {
        const roadmap = roadmapId ? 
            this.getRoadmapById(roadmapId) : 
            this.currentRoadmap;
        
        if (!roadmap) {
            throw new Error('No roadmap available for export');
        }
        
        const exportData = {
            type: 'generated-roadmap',
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exportedBy: 'Roadmap Builder',
            roadmap: roadmap
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Get roadmap by ID
     */
    getRoadmapById(id) {
        return this.roadmapHistory.find(r => r.id === id);
    }

    /**
     * Clear roadmap history
     */
    clearHistory() {
        this.roadmapHistory = [];
    }

    /**
     * Create custom roadmap
     */
    createCustomRoadmap(config) {
        const {
            phases,
            title,
            description,
            duration,
            timeUnit,
            customData
        } = config;
        
        const customStructure = {
            template: 'custom',
            duration: duration || 12,
            timeUnit: timeUnit || 'weeks',
            phases: phases.map((phase, index) => ({
                name: phase.name,
                order: index,
                duration: phase.duration || Math.ceil(duration / phases.length),
                timeUnit: timeUnit || 'weeks',
                status: phase.status || 'planned',
                startDate: this.calculatePhaseStartDate(index, duration, timeUnit),
                endDate: this.calculatePhaseEndDate(index, phases.length, duration, timeUnit),
                dependencies: phase.dependencies || [],
                deliverables: phase.deliverables || [],
                risks: phase.risks || [],
                metrics: phase.metrics || {},
                resources: phase.resources || {}
            }))
        };
        
        return this.generateRoadmapContent(customStructure, customData || {}, title, description);
    }
}

module.exports = RoadmapBuilder;
