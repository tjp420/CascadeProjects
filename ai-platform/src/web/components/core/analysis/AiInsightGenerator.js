/**
 * AI Insight Generator - Generates insights from analysis results
 * Provides intelligent insights and actionable recommendations
 */

export class AiInsightGenerator {
    constructor() {
        this.insightTemplates = this.initializeTemplates();
        this.insightCategories = [
            'performance',
            'quality',
            'maintainability',
            'security',
            'architecture',
            'best_practices'
        ];
    }

    /**
     * Generate comprehensive insights from analysis data
     * @param {Object} analysis - Analysis results
     * @returns {Array} Generated insights
     */
    generateInsights(analysis) {
        const insights = [];
        
        // Generate insights from different aspects
        insights.push(...this.generatePerformanceInsights(analysis));
        insights.push(...this.generateQualityInsights(analysis));
        insights.push(...this.generateMaintainabilityInsights(analysis));
        insights.push(...this.generateArchitectureInsights(analysis));
        insights.push(...this.generateBestPracticeInsights(analysis));
        
        // Sort insights by priority and relevance
        return this.prioritizeInsights(insights);
    }

    /**
     * Generate performance-related insights
     * @param {Object} analysis - Analysis results
     * @returns {Array} Performance insights
     */
    generatePerformanceInsights(analysis) {
        const insights = [];
        const projectAnalysis = analysis.project_analysis || {};
        
        // File size performance insight
        if (projectAnalysis.size) {
            const { category, file_count } = projectAnalysis.size;
            
            if (category === 'large') {
                insights.push({
                    type: 'performance',
                    severity: 'medium',
                    title: 'Large Project Performance Considerations',
                    message: `Project has ${file_count} files which may impact performance`,
                    recommendation: 'Consider implementing lazy loading and code splitting',
                    impact: 'medium',
                    effort: 'medium'
                });
            }
        }
        
        // Complexity performance insight
        if (projectAnalysis.complexity) {
            const { score, level } = projectAnalysis.complexity;
            
            if (level === 'high') {
                insights.push({
                    type: 'performance',
                    severity: 'high',
                    title: 'High Complexity Impact on Performance',
                    message: `Complexity score of ${score} may affect runtime performance`,
                    recommendation: 'Refactor complex modules and implement performance monitoring',
                    impact: 'high',
                    effort: 'high'
                });
            }
        }
        
        return insights;
    }

    /**
     * Generate quality-related insights
     * @param {Object} analysis - Analysis results
     * @returns {Array} Quality insights
     */
    generateQualityInsights(analysis) {
        const insights = [];
        const qualityAssessment = analysis.quality_assessment || {};
        
        // Test coverage insight
        if (qualityAssessment.metrics) {
            const { test_coverage } = qualityAssessment.metrics;
            
            if (test_coverage === 'missing') {
                insights.push({
                    type: 'quality',
                    severity: 'high',
                    title: 'Missing Test Coverage',
                    message: 'No test files detected in the project',
                    recommendation: 'Implement unit tests to ensure code quality and reliability',
                    impact: 'high',
                    effort: 'high'
                });
            }
        }
        
        // Documentation quality insight
        if (qualityAssessment.metrics) {
            const { documentation } = qualityAssessment.metrics;
            
            if (documentation === 'incomplete') {
                insights.push({
                    type: 'quality',
                    severity: 'medium',
                    title: 'Incomplete Documentation',
                    message: 'Project lacks comprehensive documentation',
                    recommendation: 'Add README.md, API documentation, and code comments',
                    impact: 'medium',
                    effort: 'medium'
                });
            }
        }
        
        return insights;
    }

    /**
     * Generate maintainability-related insights
     * @param {Object} analysis - Analysis results
     * @returns {Array} Maintainability insights
     */
    generateMaintainabilityInsights(analysis) {
        const insights = [];
        const projectAnalysis = analysis.project_analysis || {};
        
        // Organization insight
        if (projectAnalysis.structure) {
            const { organization } = projectAnalysis.structure;
            
            if (organization && organization.organization_score < 70) {
                insights.push({
                    type: 'maintainability',
                    severity: 'medium',
                    title: 'Project Organization Issues',
                    message: `Organization score: ${organization.organization_score}/100`,
                    recommendation: 'Improve project structure with better separation of concerns',
                    impact: 'medium',
                    effort: 'medium'
                });
            }
        }
        
        // Technology diversity insight
        if (projectAnalysis.technologies) {
            const technologies = projectAnalysis.technologies;
            
            if (technologies.primary && technologies.primary.length > 5) {
                insights.push({
                    type: 'maintainability',
                    severity: 'medium',
                    title: 'High Technology Diversity',
                    message: `Project uses ${technologies.primary.length} primary technologies`,
                    recommendation: 'Consider consolidating technologies or establishing clear patterns',
                    impact: 'medium',
                    effort: 'medium'
                });
            }
        }
        
        return insights;
    }

    /**
     * Generate architecture-related insights
     * @param {Object} analysis - Analysis results
     * @returns {Array} Architecture insights
     */
    generateArchitectureInsights(analysis) {
        const insights = [];
        const projectAnalysis = analysis.project_analysis || {};
        
        // Architecture pattern insight
        if (projectAnalysis.structure) {
            const { architecture } = projectAnalysis.structure;
            
            if (architecture === 'multi_technology') {
                insights.push({
                    type: 'architecture',
                    severity: 'low',
                    title: 'Multi-Technology Architecture',
                    message: 'Project uses multiple technology stacks',
                    recommendation: 'Ensure proper integration patterns and API contracts',
                    impact: 'low',
                    effort: 'medium'
                });
            }
        }
        
        // Pattern insight
        if (projectAnalysis.structure) {
            const { patterns } = projectAnalysis.structure;
            
            if (patterns.length === 0) {
                insights.push({
                    type: 'architecture',
                    severity: 'medium',
                    title: 'Undefined Architecture Patterns',
                    message: 'No clear architectural patterns detected',
                    recommendation: 'Establish clear architectural patterns and design principles',
                    impact: 'medium',
                    effort: 'high'
                });
            }
        }
        
        return insights;
    }

    /**
     * Generate best practice insights
     * @param {Object} analysis - Analysis results
     * @returns {Array} Best practice insights
     */
    generateBestPracticeInsights(analysis) {
        const insights = [];
        const projectAnalysis = analysis.project_analysis || {};
        
        // Naming conventions insight
        if (projectAnalysis.structure) {
            const { organization } = projectAnalysis.structure;
            
            if (organization && !organization.has_tests) {
                insights.push({
                    type: 'best_practices',
                    severity: 'medium',
                    title: 'Missing Testing Best Practices',
                    message: 'Project lacks proper testing structure',
                    recommendation: 'Implement testing best practices with proper test organization',
                    impact: 'medium',
                    effort: 'medium'
                });
            }
        }
        
        // Configuration management insight
        if (projectAnalysis.structure) {
            const { organization } = projectAnalysis.structure;
            
            if (organization && !organization.has_config) {
                insights.push({
                    type: 'best_practices',
                    severity: 'medium',
                    title: 'Missing Configuration Management',
                    message: 'Project lacks proper configuration files',
                    recommendation: 'Add configuration management best practices',
                    impact: 'medium',
                    effort: 'low'
                });
            }
        }
        
        return insights;
    }

    /**
     * Prioritize insights by importance and urgency
     * @param {Array} insights - Array of insights
     * @returns {Array} Prioritized insights
     */
    prioritizeInsights(insights) {
        return insights.sort((a, b) => {
            // Sort by severity first
            const severityOrder = { high: 3, medium: 2, low: 1 };
            const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
            
            if (severityDiff !== 0) {
                return severityDiff;
            }
            
            // Then by impact
            const impactOrder = { high: 3, medium: 2, low: 1 };
            const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
            
            if (impactDiff !== 0) {
                return impactDiff;
            }
            
            // Finally by effort (lower effort first)
            const effortOrder = { low: 1, medium: 2, high: 3 };
            return effortOrder[a.effort] - effortOrder[b.effort];
        });
    }

    /**
     * Generate actionable recommendations from insights
     * @param {Array} insights - Array of insights
     * @returns {Object} Actionable recommendations
     */
    generateRecommendations(insights) {
        const recommendations = {
            immediate: [],
            short_term: [],
            long_term: [],
            ongoing: []
        };
        
        insights.forEach(insight => {
            const recommendation = {
                title: insight.title,
                description: insight.message,
                action: insight.recommendation,
                priority: insight.severity,
                impact: insight.impact,
                effort: insight.effort,
                category: insight.type
            };
            
            // Categorize by urgency and effort
            if (insight.severity === 'high' && insight.effort === 'low') {
                recommendations.immediate.push(recommendation);
            } else if (insight.severity === 'high') {
                recommendations.short_term.push(recommendation);
            } else if (insight.effort === 'low') {
                recommendations.short_term.push(recommendation);
            } else if (insight.severity === 'medium') {
                recommendations.long_term.push(recommendation);
            } else {
                recommendations.ongoing.push(recommendation);
            }
        });
        
        return recommendations;
    }

    /**
     * Generate summary of insights
     * @param {Array} insights - Array of insights
     * @returns {Object} Insight summary
     */
    generateSummary(insights) {
        const summary = {
            total: insights.length,
            by_severity: {
                high: 0,
                medium: 0,
                low: 0
            },
            by_category: {},
            by_impact: {
                high: 0,
                medium: 0,
                low: 0
            },
            top_priorities: []
        };
        
        insights.forEach(insight => {
            // Count by severity
            summary.by_severity[insight.severity]++;
            
            // Count by category
            if (!summary.by_category[insight.type]) {
                summary.by_category[insight.type] = 0;
            }
            summary.by_category[insight.type]++;
            
            // Count by impact
            summary.by_impact[insight.impact]++;
        });
        
        // Get top priorities
        summary.top_priorities = insights
            .filter(insight => insight.severity === 'high')
            .slice(0, 5)
            .map(insight => ({
                title: insight.title,
                severity: insight.severity,
                impact: insight.impact
            }));
        
        return summary;
    }

    /**
     * Initialize insight templates
     * @returns {Object} Insight templates
     */
    initializeTemplates() {
        return {
            performance: {
                large_project: {
                    threshold: 1000,
                    message: 'Large project may impact performance',
                    recommendation: 'Implement performance optimizations'
                },
                high_complexity: {
                    threshold: 80,
                    message: 'High complexity affects performance',
                    recommendation: 'Refactor complex modules'
                }
            },
            quality: {
                missing_tests: {
                    message: 'No test coverage detected',
                    recommendation: 'Implement comprehensive testing'
                },
                missing_docs: {
                    message: 'Documentation is incomplete',
                    recommendation: 'Add comprehensive documentation'
                }
            },
            maintainability: {
                poor_organization: {
                    threshold: 70,
                    message: 'Project organization needs improvement',
                    recommendation: 'Improve code organization'
                },
                tech_diversity: {
                    threshold: 5,
                    message: 'Too many technologies may impact maintainability',
                    recommendation: 'Consolidate technologies'
                }
            }
        };
    }

    /**
     * Generate trend insights from historical data
     * @param {Array} historicalAnalysis - Array of historical analysis data
     * @returns {Array} Trend insights
     */
    generateTrendInsights(historicalAnalysis) {
        const insights = [];
        
        if (historicalAnalysis.length < 2) {
            return insights;
        }
        
        const latest = historicalAnalysis[historicalAnalysis.length - 1];
        const previous = historicalAnalysis[historicalAnalysis.length - 2];
        
        // Quality trend
        const qualityTrend = latest.quality_assessment.overall_score - previous.quality_assessment.overall_score;
        if (qualityTrend < -10) {
            insights.push({
                type: 'trend',
                severity: 'medium',
                title: 'Declining Code Quality',
                message: `Quality score decreased by ${Math.abs(qualityTrend)} points`,
                recommendation: 'Review recent changes and address quality issues',
                trend: 'declining'
            });
        } else if (qualityTrend > 10) {
            insights.push({
                type: 'trend',
                severity: 'low',
                title: 'Improving Code Quality',
                message: `Quality score improved by ${qualityTrend} points`,
                recommendation: 'Continue current quality practices',
                trend: 'improving'
            });
        }
        
        // Size trend
        const sizeTrend = latest.project_analysis.size.file_count - previous.project_analysis.size.file_count;
        if (sizeTrend > 100) {
            insights.push({
                type: 'trend',
                severity: 'low',
                title: 'Rapid Project Growth',
                message: `Project grew by ${sizeTrend} files`,
                recommendation: 'Ensure architecture scales with growth',
                trend: 'growing'
            });
        }
        
        return insights;
    }

    /**
     * Generate predictive insights
     * @param {Object} analysis - Current analysis
     * @param {Array} historicalData - Historical data
     * @returns {Array} Predictive insights
     */
    generatePredictiveInsights(analysis, historicalData) {
        const insights = [];
        
        // Predict future complexity
        const currentComplexity = analysis.project_analysis.complexity.score;
        const growthRate = this.calculateGrowthRate(historicalData);
        
        if (growthRate > 0.1) { // 10% growth rate
            const futureComplexity = currentComplexity * (1 + growthRate * 3); // 3 periods ahead
            
            if (futureComplexity > 80) {
                insights.push({
                    type: 'predictive',
                    severity: 'medium',
                    title: 'Future Complexity Concerns',
                    message: `Projected complexity score: ${Math.round(futureComplexity)}`,
                    recommendation: 'Plan for complexity management now',
                    prediction: 'high_complexity'
                });
            }
        }
        
        // Predict maintainability issues
        const currentFiles = analysis.project_analysis.size.file_count;
        if (currentFiles > 500 && growthRate > 0.05) {
            insights.push({
                type: 'predictive',
                severity: 'medium',
                title: 'Future Maintainability Risks',
                message: 'Project may become difficult to maintain',
                recommendation: 'Implement modular architecture patterns',
                prediction: 'maintainability_issues'
            });
        }
        
        return insights;
    }

    /**
     * Calculate growth rate from historical data
     * @param {Array} historicalData - Historical analysis data
     * @returns {number} Growth rate
     */
    calculateGrowthRate(historicalData) {
        if (historicalData.length < 2) {
            return 0;
        }
        
        const latest = historicalData[historicalData.length - 1];
        const earliest = historicalData[0];
        
        const latestFiles = latest.project_analysis.size.file_count;
        const earliestFiles = earliest.project_analysis.size.file_count;
        
        if (earliestFiles === 0) {
            return 0;
        }
        
        return (latestFiles - earliestFiles) / earliestFiles;
    }

    /**
     * Format insight for display
     * @param {Object} insight - Insight object
     * @returns {Object} Formatted insight
     */
    formatInsight(insight) {
        return {
            id: this.generateInsightId(insight),
            title: insight.title,
            message: insight.message,
            recommendation: insight.recommendation,
            severity: insight.severity,
            impact: insight.impact,
            effort: insight.effort,
            category: insight.type,
            icon: this.getInsightIcon(insight.type),
            color: this.getInsightColor(insight.severity),
            actions: this.generateActions(insight)
        };
    }

    /**
     * Generate unique insight ID
     * @param {Object} insight - Insight object
     * @returns {string} Insight ID
     */
    generateInsightId(insight) {
        const base = `${insight.type}_${insight.title}`;
        return base.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    /**
     * Get insight icon by type
     * @param {string} type - Insight type
     * @returns {string} Icon name
     */
    getInsightIcon(type) {
        const icons = {
            performance: '⚡',
            quality: '✅',
            maintainability: '🔧',
            security: '🔒',
            architecture: '🏗️',
            best_practices: '📋',
            trend: '📈',
            predictive: '🔮'
        };
        
        return icons[type] || '💡';
    }

    /**
     * Get insight color by severity
     * @param {string} severity - Insight severity
     * @returns {string} Color code
     */
    getInsightColor(severity) {
        const colors = {
            high: '#dc3545',
            medium: '#ffc107',
            low: '#28a745'
        };
        
        return colors[severity] || '#6c757d';
    }

    /**
     * Generate actionable steps for insight
     * @param {Object} insight - Insight object
     * @returns {Array} Actionable steps
     */
    generateActions(insight) {
        const actions = [];
        
        // Add primary action
        actions.push({
            type: 'primary',
            title: 'Implement Recommendation',
            description: insight.recommendation,
            effort: insight.effort
        });
        
        // Add secondary actions based on type
        if (insight.type === 'quality' && insight.severity === 'high') {
            actions.push({
                type: 'secondary',
                title: 'Review Code Quality Standards',
                description: 'Establish and enforce code quality guidelines',
                effort: 'medium'
            });
        }
        
        if (insight.type === 'performance') {
            actions.push({
                type: 'secondary',
                title: 'Monitor Performance Metrics',
                description: 'Set up performance monitoring and alerting',
                effort: 'low'
            });
        }
        
        return actions;
    }
}
