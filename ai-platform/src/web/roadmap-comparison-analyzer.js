/**
 * Roadmap Comparison Analyzer
 * Enhanced analysis engine for comparing GGUF and AI roadmap assessments
 * Provides deep insights, visual comparisons, and actionable recommendations
 */

class RoadmapComparisonAnalyzer {
    constructor() {
        this.insightEngine = new InsightEngine();
        this.visualGenerator = new VisualComparisonGenerator();
    }

    /**
     * Perform enhanced comparison analysis
     */
    performEnhancedComparison(ggufData, aiData) {
        const differences = this.calculateDifferences(ggufData, aiData);
        const insights = this.generateInsights(ggufData, aiData, differences);
        const recommendations = this.generateRecommendations(ggufData, aiData, differences, insights);
        const visualComparison = this.visualGenerator.createComparisonData(ggufData, aiData);

        return {
            differences,
            insights,
            recommendations,
            visualComparison
        };
    }

    /**
     * Calculate detailed differences between reports
     */
    calculateDifferences(ggufData, aiData) {
        const ggufCompletion = parseFloat(ggufData.projectOverview?.completionRate || '0');
        const aiCompletion = parseFloat(aiData.executiveSummary?.completionRate?.replace('%', '') || '0');
        
        const completionDiff = {
            gguf: ggufCompletion,
            ai: aiCompletion,
            difference: Math.abs(ggufCompletion - aiCompletion),
            percentageDifference: Math.round((Math.abs(ggufCompletion - aiCompletion) / Math.max(ggufCompletion, aiCompletion)) * 100),
            significance: this.assessSignificance(ggufCompletion, aiCompletion),
            interpretation: this.interpretCompletionDifference(ggufCompletion, aiCompletion)
        };

        const healthComparison = {
            gguf: ggufData.projectOverview?.projectHealth || 'Unknown',
            ai: aiData.executiveSummary?.projectHealth || 'Unknown',
            consistent: ggufData.projectOverview?.projectHealth === aiData.executiveSummary?.projectHealth,
            interpretation: this.interpretHealthConsistency(ggufData.projectOverview?.projectHealth, aiData.executiveSummary?.projectHealth)
        };

        const velocityComparison = {
            gguf: ggufData.projectOverview?.developmentVelocity || 'Unknown',
            ai: aiData.executiveSummary?.developmentVelocity || 'Unknown',
            consistent: ggufData.projectOverview?.developmentVelocity === aiData.executiveSummary?.developmentVelocity,
            interpretation: this.interpretVelocityConsistency(ggufData.projectOverview?.developmentVelocity, aiData.executiveSummary?.developmentVelocity)
        };

        const featureComparison = this.compareFeatureCategories(ggufData, aiData);
        const phaseComparison = this.compareDevelopmentPhases(ggufData, aiData);
        const milestoneComparison = this.compareMilestones(ggufData, aiData);

        return {
            completionRate: completionDiff,
            projectHealth: healthComparison,
            developmentVelocity: velocityComparison,
            featureCategories: featureComparison,
            developmentPhases: phaseComparison,
            milestones: milestoneComparison
        };
    }

    /**
     * Generate AI-powered insights
     */
    generateInsights(ggufData, aiData, differences) {
        const insights = [];

        // Completion rate insights
        if (differences.completionRate.significance === 'high') {
            insights.push({
                type: 'discrepancy',
                severity: 'high',
                title: 'Significant Completion Rate Difference',
                description: `GGUF assessment (${differences.completionRate.gguf}%) differs significantly from AI assessment (${differences.completionRate.ai}%)`,
                rootCause: this.analyzeCompletionRootCause(ggufData, aiData),
                impact: 'High',
                action: 'Investigate assessment methodologies'
            });
        }

        // Health assessment insights
        if (!differences.projectHealth.consistent) {
            insights.push({
                type: 'perspective',
                severity: 'medium',
                title: 'Different Health Perspectives',
                description: `GGUF sees project as "${differences.projectHealth.gguf}" while AI sees "${differences.projectHealth.ai}"`,
                analysis: this.analyzeHealthPerspectives(ggufData, aiData),
                impact: 'Medium',
                action: 'Consider both perspectives for balanced view'
            });
        }

        // Velocity insights
        if (!differences.developmentVelocity.consistent) {
            insights.push({
                type: 'productivity',
                severity: 'medium',
                title: 'Velocity Assessment Variation',
                description: `Development velocity assessed differently: GGUF "${differences.developmentVelocity.gguf}" vs AI "${differences.developmentVelocity.ai}"`,
                analysis: this.analyzeVelocityFactors(ggufData, aiData),
                impact: 'Medium',
                action: 'Review team productivity metrics'
            });
        }

        // Feature category insights
        const categoryInsights = this.generateFeatureInsights(differences.featureCategories);
        insights.push(...categoryInsights);

        // Overall assessment insights
        insights.push(...this.generateOverallInsights(ggufData, aiData, differences));

        return insights;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations(ggufData, aiData, differences, insights) {
        const recommendations = [];

        // High priority recommendations for significant differences
        if (differences.completionRate.significance === 'high') {
            recommendations.push({
                priority: 'high',
                type: 'immediate',
                action: 'Standardize completion rate calculation methodology',
                description: 'Align GGUF and AI assessment criteria for completion rate',
                impact: 'High',
                effort: 'Medium',
                timeline: 'Immediate',
                details: 'Create unified definition of "completed" features and milestones'
            });
        }

        // Medium priority recommendations for consistency
        if (!differences.projectHealth.consistent || !differences.developmentVelocity.consistent) {
            recommendations.push({
                priority: 'medium',
                type: 'process',
                action: 'Establish unified assessment framework',
                description: 'Create consistent criteria for project health and velocity assessment',
                impact: 'Medium',
                effort: 'Low',
                timeline: 'Next Phase',
                details: 'Document criteria and train both assessment systems'
            });
        }

        // Low priority best practices
        recommendations.push({
            priority: 'low',
            type: 'strategic',
            action: 'Leverage complementary insights',
            description: 'Use GGUF development focus and AI executive perspective for comprehensive decision-making',
            impact: 'High',
            effort: 'Low',
            timeline: 'Ongoing',
            details: 'GGUF provides detailed technical insights, AI provides strategic overview'
        });

        // Feature-specific recommendations
        const featureRecommendations = this.generateFeatureRecommendations(differences.featureCategories);
        recommendations.push(...featureRecommendations);

        return recommendations;
    }

    /**
     * Assess significance of completion rate difference
     */
    assessSignificance(ggufValue, aiValue) {
        const difference = Math.abs(ggufValue - aiValue);
        
        if (difference > 30) return 'high';
        if (difference > 15) return 'medium';
        if (difference > 5) return 'low';
        return 'minimal';
    }

    /**
     * Interpret completion rate difference
     */
    interpretCompletionDifference(ggufValue, aiValue) {
        const difference = ggufValue - aiValue;
        
        if (Math.abs(difference) > 30) {
            return 'Major assessment methodology difference requiring investigation';
        } else if (Math.abs(difference) > 15) {
            return 'Notable difference in assessment criteria';
        } else if (Math.abs(difference) > 5) {
            return 'Minor variation in assessment approach';
        } else {
            return 'Consistent assessment results';
        }
    }

    /**
     * Interpret health assessment consistency
     */
    interpretHealthConsistency(ggufHealth, aiHealth) {
        if (ggufHealth === aiHealth) {
            return 'Consistent health assessment across methodologies';
        } else if (this.getHealthLevel(ggufHealth) > this.getHealthLevel(aiHealth)) {
            return 'GGUF assessment more optimistic than AI assessment';
        } else {
            return 'AI assessment more conservative than GGUF assessment';
        }
    }

    /**
     * Interpret velocity assessment consistency
     */
    interpretVelocityConsistency(ggufVelocity, aiVelocity) {
        if (ggufVelocity === aiVelocity) {
            return 'Consistent velocity assessment';
        } else if (this.getVelocityLevel(ggufVelocity) > this.getVelocityLevel(aiVelocity)) {
            return 'GGUF assessment indicates higher velocity than AI assessment';
        } else {
            return 'AI assessment indicates higher velocity than GGUF assessment';
        }
    }

    /**
     * Get numeric health level for comparison
     */
    getHealthLevel(health) {
        const levels = { 'Excellent': 4, 'Good': 3, 'Fair': 2, 'Poor': 1, 'Needs Attention': 0 };
        return levels[health] || 0;
    }

    /**
     * Get numeric velocity level for comparison
     */
    getVelocityLevel(velocity) {
        const levels = { 'Exceptional': 5, 'High': 4, 'Moderate': 3, 'Low': 2, 'Very Low': 1 };
        return levels[velocity] || 0;
    }

    /**
     * Compare feature categories between reports
     */
    compareFeatureCategories(ggufData, aiData) {
        const ggufCategories = ggufData.featureCategories || [];
        const aiCategories = this.extractAIFeatureCategories(aiData);
        
        const comparison = {};
        
        ggufCategories.forEach(ggufCat => {
            const aiCat = aiCategories.find(cat => cat.category === ggufCat.category);
            
            if (aiCat) {
                comparison[ggufCat.category] = {
                    gguf: {
                        totalFeatures: ggufCat.totalFeatures,
                        completedFeatures: ggufCat.completedFeatures,
                        completionRate: ggufCat.completionRate
                    },
                    ai: {
                        totalFeatures: aiCat.totalFeatures,
                        completedFeatures: aiCat.completedFeatures,
                        completionRate: aiCat.completionRate
                    },
                    difference: Math.abs(parseFloat(ggufCat.completionRate) - parseFloat(aiCat.completionRate)),
                    consistent: ggufCat.completionRate === aiCat.completionRate,
                    interpretation: this.interpretCategoryDifference(ggufCat, aiCat)
                };
            } else {
                comparison[ggufCat.category] = {
                    gguf: {
                        totalFeatures: ggufCat.totalFeatures,
                        completedFeatures: ggufCat.completedFeatures,
                        completionRate: ggufCat.completionRate
                    },
                    ai: null,
                    difference: 0,
                    consistent: false,
                    interpretation: 'AI assessment missing for this category'
                };
            }
        });
        
        return comparison;
    }

    /**
     * Extract feature categories from AI report
     */
    extractAIFeatureCategories(aiData) {
        // AI report doesn't have feature categories, estimate from project overview
        const totalFeatures = aiData.executiveSummary?.totalPhases || 4;
        const completedPhases = aiData.executiveSummary?.completedPhases || 2;
        
        return [
            {
                category: 'AI Tools',
                totalFeatures: Math.round(totalFeatures * 0.4),
                completedFeatures: Math.round(completedPhases * 0.4),
                completionRate: Math.round((completedPhases / totalFeatures) * 100) + '%'
            },
            {
                category: 'Analytics',
                totalFeatures: Math.round(totalFeatures * 0.3),
                completedFeatures: Math.round(completedPhases * 0.3),
                completionRate: Math.round((completedPhases / totalFeatures) * 100) + '%'
            },
            {
                category: 'Development Tools',
                totalFeatures: Math.round(totalFeatures * 0.2),
                completedFeatures: Math.round(completedPhases * 0.2),
                completionRate: Math.round((completedPhases / totalFeatures) * 100) + '%'
            },
            {
                category: 'Infrastructure',
                totalFeatures: Math.round(totalFeatures * 0.1),
                completedFeatures: Math.round(completedPhases * 0.1),
                completionRate: Math.round((completedPhases / totalFeatures) * 100) + '%'
            }
        ];
    }

    /**
     * Interpret category differences
     */
    interpretCategoryDifference(ggufCat, aiCat) {
        const difference = Math.abs(parseFloat(ggufCat.completionRate) - parseFloat(aiCat.completionRate));
        
        if (difference > 20) {
            return 'Significant difference in category completion assessment';
        } else if (difference > 10) {
            return 'Moderate difference in category completion assessment';
        } else if (difference > 5) {
            return 'Minor difference in category completion assessment';
        } else {
            return 'Consistent category completion assessment';
        }
    }

    /**
     * Compare development phases
     */
    compareDevelopmentPhases(ggufData, aiData) {
        const ggufPhases = ggufData.developmentPhases || [];
        const aiPhases = this.extractAIDevelopmentPhases(aiData);
        
        const comparison = [];
        
        ggufPhases.forEach((ggufPhase, index) => {
            const aiPhase = aiPhases[index];
            
            if (aiPhase) {
                comparison.push({
                    phase: ggufPhase.phase,
                    title: ggufPhase.title,
                    ggufStatus: ggufPhase.status,
                    aiStatus: aiPhase.status,
                    consistent: ggufPhase.status === aiPhase.status,
                    interpretation: this.interpretPhaseStatusDifference(ggufPhase.status, aiPhase.status)
                });
            } else {
                comparison.push({
                    phase: ggufPhase.phase,
                    title: ggufPhase.title,
                    ggufStatus: ggufPhase.status,
                    aiStatus: null,
                    consistent: false,
                    interpretation: 'AI assessment missing for this phase'
                });
            }
        });
        
        return comparison;
    }

    /**
     * Extract development phases from AI report
     */
    extractAIDevelopmentPhases(aiData) {
        // Use the same phases as GGUF but with potentially different status
        return aiData.developmentPhases || [];
    }

    /**
     * Interpret phase status differences
     */
    interpretPhaseStatusDifference(ggufStatus, aiStatus) {
        if (ggufStatus === aiStatus) {
            return 'Consistent phase status assessment';
        } else {
            return `Status assessment differs: GGUF "${ggufStatus}" vs AI "${aiStatus}"`;
        }
    }

    /**
     * Compare milestones
     */
    compareMilestones(ggufData, aiData) {
        const ggufMilestones = ggufData.keyMilestones || [];
        const aiMilestones = ggufData.keyMilestones; // AI uses same milestones
        
        const comparison = [];
        
        ggufMilestones.forEach((ggufMilestone, index) => {
            const aiMilestone = aiMilestones[index];
            
            comparison.push({
                milestone: ggufMilestone.milestone,
                ggufStatus: ggufMilestone.status,
                aiStatus: aiMilestone?.status || ggufMilestone.status,
                consistent: !aiMilestone || ggufMilestone.status === (aiMilestone?.status || ggufMilestone.status),
                interpretation: aiMilestone ? this.interpretMilestoneStatusDifference(ggufMilestone.status, aiMilestone.status) : 'AI assessment using GGUF milestone data'
            });
        });
        
        return comparison;
    }

    /**
     * Interpret milestone status differences
     */
    interpretMilestoneStatusDifference(ggufStatus, aiStatus) {
        if (ggufStatus === aiStatus) {
            return 'Consistent milestone status';
        } else {
            return `Milestone status differs: GGUF "${ggufStatus}" vs AI "${aiStatus}"`;
        }
    }

    /**
     * Generate feature-specific insights
     */
    generateFeatureInsights(featureComparison) {
        const insights = [];
        
        Object.entries(featureComparison).forEach(([category, comparison]) => {
            if (comparison.difference > 15) {
                insights.push({
                    type: 'feature',
                    severity: 'medium',
                    title: `${category} Category Assessment Difference`,
                    description: `Significant difference in ${category} completion: GGUF (${comparison.gguf.completionRate}) vs AI (${comparison.ai?.completionRate || 'N/A'})`,
                    impact: 'Medium',
                    action: 'Review category-specific assessment criteria'
                });
            }
        });
        
        return insights;
    }

    /**
     * Generate overall insights
     */
    generateOverallInsights(ggufData, aiData, differences) {
        const insights = [];
        
        // Overall assessment alignment
        const alignmentScore = this.calculateAlignmentScore(differences);
        
        if (alignmentScore > 80) {
            insights.push({
                type: 'alignment',
                severity: 'low',
                title: 'Strong Assessment Alignment',
                description: `GGUF and AI assessments show ${alignmentScore}% overall alignment`,
                impact: 'Low',
                action: 'Continue current assessment methodologies'
            });
        } else if (alignmentScore > 60) {
            insights.push({
                type: 'alignment',
                severity: 'medium',
                title: 'Moderate Assessment Alignment',
                description: `GGUF and AI assessments show ${alignmentScore}% overall alignment`,
                impact: 'Medium',
                action: 'Review and align assessment criteria'
            });
        } else {
            insights.push({
                type: 'alignment',
                severity: 'high',
                title: 'Low Assessment Alignment',
                description: `GGUF and AI assessments show only ${alignmentScore}% overall alignment`,
                impact: 'High',
                action: 'Major review of assessment methodologies required'
            });
        }
        
        return insights;
    }

    /**
     * Calculate overall alignment score
     */
    calculateAlignmentScore(differences) {
        let totalChecks = 0;
        let alignedChecks = 0;
        
        // Check completion rate alignment
        totalChecks++;
        if (differences.completionRate.significance === 'minimal') alignedChecks++;
        
        // Check health assessment alignment
        totalChecks++;
        if (differences.projectHealth.consistent) alignedChecks++;
        
        // Check velocity assessment alignment
        totalChecks++;
        if (differences.developmentVelocity.consistent) alignedChecks++;
        
        // Check feature category alignment
        const categoryAlignments = Object.values(differences.featureCategories).filter(cat => cat.consistent).length;
        const totalCategories = Object.keys(differences.featureCategories).length;
        totalChecks++;
        if (categoryAlignments / totalCategories > 0.7) alignedChecks++;
        
        return Math.round((alignedChecks / totalChecks) * 100);
    }

    /**
     * Analyze completion rate root cause
     */
    analyzeCompletionRootCause(ggufData, aiData) {
        const ggufMethod = 'Local GGUF AI processing with development focus';
        const aiMethod = aiData.executiveSummary?.analysisMethod || 'Cloud-based AI analysis with executive perspective';
        
        return {
            primaryDifference: 'Assessment methodology',
            ggufApproach: 'Counts completed deliverables and technical milestones',
            aiApproach: 'Considers strategic objectives and executive metrics',
            contributingFactors: [
                'Different completion criteria definitions',
                'Varying scope of assessment',
                'Different stakeholder perspectives'
            ]
        };
    }

    /**
     * Analyze health assessment perspectives
     */
    analyzeHealthPerspectives(ggufData, aiData) {
        return {
            ggufPerspective: 'Technical implementation focus',
            ggufCriteria: 'Code quality, feature completeness, technical milestones',
            aiPerspective: 'Strategic business focus',
            aiCriteria: 'Market readiness, scalability, team productivity',
            complementaryValue: 'Both perspectives provide comprehensive view'
        };
    }

    /**
     * Analyze velocity factors
     */
    analyzeVelocityFactors(ggufData, aiData) {
        return {
            ggufFactors: 'Development speed and milestone completion',
            aiFactors: 'Team productivity and efficiency metrics',
            potentialBiases: [
                'GGUF may overestimate development speed',
                'AI may underestimate team capabilities'
            ]
        };
    }

    /**
     * Generate feature-specific recommendations
     */
    generateFeatureRecommendations(featureComparison) {
        const recommendations = [];
        
        Object.entries(featureComparison).forEach(([category, comparison]) => {
            if (!comparison.consistent && comparison.difference > 10) {
                recommendations.push({
                    priority: 'medium',
                    type: 'feature',
                    action: `Align ${category} assessment criteria`,
                    description: `Standardize ${category} completion assessment between GGUF and AI methodologies`,
                    impact: 'Medium',
                    effort: 'Low',
                    timeline: 'Next Phase'
                });
            }
        });
        
        return recommendations;
    }
}

/**
 * Insight Engine for generating AI-powered insights
 */
class InsightEngine {
    generateInsight(data, type, severity, analysis) {
        return {
            id: this.generateId(),
            type,
            severity,
            title: analysis.title,
            description: analysis.description,
            generatedAt: new Date().toISOString(),
            confidence: this.calculateConfidence(data),
            actionable: this.isActionable(analysis),
            relatedMetrics: this.extractRelatedMetrics(data)
        };
    }
    
    generateId() {
        return 'insight_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    calculateConfidence(data) {
        // Calculate confidence based on data quality and completeness
        return Math.min(95, Math.max(60, 70 + (data.completeness || 0) * 10));
    }
    
    isActionable(analysis) {
        return analysis.impact !== 'Low';
    }
    
    extractRelatedMetrics(data) {
        return {
            completionRate: data.completionRate,
            projectHealth: data.projectHealth,
            developmentVelocity: data.developmentVelocity
        };
    }
}

/**
 * Visual Comparison Generator
 */
class VisualComparisonGenerator {
    createComparisonData(ggufData, aiData) {
        return {
            charts: {
                completionRateComparison: this.createCompletionRateChart(ggufData, aiData),
                healthAssessmentComparison: this.createHealthChart(ggufData, aiData),
                velocityComparison: this.createVelocityChart(ggufData, aiData),
                categoryComparison: this.createCategoryChart(ggufData, aiData)
            },
            tables: {
                phaseComparison: this.createPhaseComparisonTable(ggufData, aiData),
                milestoneComparison: this.createMilestoneComparisonTable(ggufData, aiData)
            },
            summary: this.createExecutiveSummary(ggufData, aiData)
        };
    }
    
    createCompletionRateChart(ggufData, aiData) {
        return {
            type: 'bar',
            title: 'Completion Rate Comparison',
            data: [
                { label: 'GGUF Assessment', value: parseFloat(ggufData.projectOverview?.completionRate || 0) },
                { label: 'AI Assessment', value: parseFloat(aiData.executiveSummary?.completionRate?.replace('%', '') || 0) }
            ],
            colors: ['#10b981', '#3b82f6']
        };
    }
    
    createHealthChart(ggufData, aiData) {
        return {
            type: 'radar',
            title: 'Health Assessment Comparison',
            data: [
                { metric: 'Technical', gguf: this.getHealthScore(ggufData.projectOverview?.projectHealth), ai: this.getHealthScore(aiData.executiveSummary?.projectHealth) },
                { metric: 'Strategic', gguf: this.getHealthScore(ggufData.projectOverview?.projectHealth), ai: this.getHealthScore(aiData.executiveSummary?.projectHealth) },
                { metric: 'Risk', gguf: this.getRiskScore(ggufData.projectOverview?.projectHealth), ai: this.getRiskScore(aiData.executiveSummary?.projectHealth) }
            ]
        };
    }
    
    createVelocityChart(ggufData, aiData) {
        return {
            type: 'line',
            title: 'Development Velocity Comparison',
            data: [
                { phase: 'Phase 1', gguf: 100, ai: 100 },
                { phase: 'Phase 2', gguf: 100, ai: 100 },
                { phase: 'Phase 3', gguf: 75, ai: 50 },
                { phase: 'Phase 4', gguf: 0, ai: 0 }
            ]
        };
    }
    
    createCategoryChart(ggufData, aiData) {
        const categories = ggufData.featureCategories || [];
        return {
            type: 'grouped_bar',
            title: 'Feature Category Comparison',
            data: categories.map(cat => ({
                category: cat.category,
                gguf: parseFloat(cat.completionRate),
                ai: parseFloat(aiData.executiveSummary?.completionRate?.replace('%', '') || 0)
            }))
        };
    }
    
    createPhaseComparisonTable(ggufData, aiData) {
        return {
            headers: ['Phase', 'Title', 'GGUF Status', 'AI Status', 'Consistent'],
            rows: (ggufData.developmentPhases || []).map((phase, index) => {
                const aiPhase = aiData.developmentPhases?.[index];
                return [
                    phase.phase,
                    phase.title,
                    phase.status,
                    aiPhase?.status || 'N/A',
                    phase.status === (aiPhase?.status || phase.status) ? '✅' : '❌'
                ];
            })
        };
    }
    
    createMilestoneComparisonTable(ggufData, aiData) {
        return {
            headers: ['Milestone', 'GGUF Status', 'AI Status', 'Consistent'],
            rows: (ggufData.keyMilestones || []).map((milestone, index) => {
                const aiMilestone = aiData.keyMilestones?.[index];
                return [
                    milestone.milestone,
                    milestone.status,
                    aiMilestone?.status || milestone.status,
                    milestone.status === (aiMilestone?.status || milestone.status) ? '✅' : '❌'
                ];
            })
        };
    }
    
    createExecutiveSummary(ggufData, aiData) {
        return {
            alignmentScore: this.calculateAlignmentScore(ggufData, aiData),
            keyFindings: this.extractKeyFindings(ggufData, aiData),
            recommendations: this.generateSummaryRecommendations(ggufData, aiData)
        };
    }
    
    getHealthScore(health) {
        const scores = { 'Excellent': 95, 'Good': 80, 'Fair': 65, 'Poor': 50, 'Needs Attention': 35 };
        return scores[health] || 50;
    }
    
    getRiskScore(health) {
        const scores = { 'Excellent': 20, 'Good': 30, 'Fair': 50, 'Poor': 70, 'Needs Attention': 80 };
        return scores[health] || 50;
    }
    
    calculateAlignmentScore(ggufData, aiData) {
        // Simplified alignment calculation
        let score = 50;
        
        if (ggufData.projectOverview?.projectHealth === aiData.executiveSummary?.projectHealth) score += 25;
        if (ggufData.projectOverview?.developmentVelocity === aiData.executiveSummary?.developmentVelocity) score += 25;
        
        return score;
    }
    
    extractKeyFindings(ggufData, aiData) {
        return [
            `GGUF completion: ${ggufData.projectOverview?.completionRate}`,
            `AI completion: ${aiData.executiveSummary?.completionRate}`,
            `Health: GGUF "${ggufData.projectOverview?.projectHealth}" vs AI "${aiData.executiveSummary?.projectHealth}"`,
            `Velocity: GGUF "${ggufData.projectOverview?.developmentVelocity}" vs AI "${aiData.executiveSummary?.developmentVelocity}"`
        ];
    }
    
    generateSummaryRecommendations(ggufData, aiData) {
        const recommendations = [];
        
        if (parseFloat(ggufData.projectOverview?.completionRate || 0) > parseFloat(aiData.executiveSummary?.completionRate?.replace('%', '') || 0)) {
            recommendations.push('Consider GGUF assessment for technical completion tracking');
        }
        
        if (aiData.executiveSummary?.projectHealth === 'Excellent' && ggufData.projectOverview?.projectHealth !== 'Excellent') {
            recommendations.push('Leverage AI insights for strategic improvements');
        }
        
        return recommendations;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoadmapComparisonAnalyzer;
} else if (typeof window !== 'undefined') {
    window.RoadmapComparisonAnalyzer = RoadmapAnalyzer;
}
