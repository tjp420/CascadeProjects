/**
 * Health Score Calculator Module
 * Implements realistic health scoring for mock data analysis
 */

/**
 * Health Score Calculator
 * Provides graduated scoring based on confidence, severity, and context
 */
export class HealthScoreCalculator {
    constructor() {
        this.weights = {
            high: 10,
            medium: 5,
            low: 2
        };
        
        this.confidenceMultipliers = {
            high: 1.0,    // 0.8+ confidence
            medium: 0.6,  // 0.5-0.8 confidence
            low: 0.3      // <0.5 confidence
        };
        
        this.baseScore = 100;
        this.maxPenalty = 70; // Maximum penalty, so score won't go below 30
    }

    /**
     * Calculate health score based on findings
     * @param {Array} findings - Array of mock data findings
     * @returns {Object} Health score with details
     */
    calculateHealthScore(findings) {
        if (!findings || findings.length === 0) {
            return {
                score: 100,
                grade: 'A',
                status: 'Excellent',
                details: {
                    totalFindings: 0,
                    weightedScore: 0,
                    penalty: 0,
                    confidence: 'high'
                }
            };
        }

        // Filter out low confidence findings from scoring
        const significantFindings = findings.filter(f => f.confidence >= 0.5);
        
        // Calculate weighted penalty
        const weightedPenalty = this.calculateWeightedPenalty(significantFindings);
        
        // Apply penalty with maximum cap
        const penalty = Math.min(weightedPenalty, this.maxPenalty);
        const score = Math.max(this.baseScore - penalty, 30);
        
        // Determine grade and status
        const { grade, status } = this.getGradeAndStatus(score);
        
        // Calculate overall confidence
        const overallConfidence = this.calculateOverallConfidence(findings);
        
        return {
            score: Math.round(score),
            grade,
            status,
            details: {
                totalFindings: findings.length,
                significantFindings: significantFindings.length,
                weightedScore: weightedPenalty,
                penalty,
                confidence: overallConfidence,
                breakdown: this.getScoreBreakdown(significantFindings)
            }
        };
    }

    /**
     * Calculate weighted penalty based on findings
     * @param {Array} findings - Array of findings
     * @returns {number} Weighted penalty score
     */
    calculateWeightedPenalty(findings) {
        let totalPenalty = 0;
        
        for (const finding of findings) {
            const severityWeight = this.weights[finding.severity] || this.weights.medium;
            const confidenceMultiplier = this.getConfidenceMultiplier(finding.confidence);
            
            // Apply both severity and confidence weighting
            const findingPenalty = severityWeight * confidenceMultiplier;
            totalPenalty += findingPenalty;
        }
        
        // Normalize penalty based on number of findings (avoid over-penalizing large projects)
        const normalizedPenalty = this.normalizePenalty(totalPenalty, findings.length);
        
        return normalizedPenalty;
    }

    /**
     * Get confidence multiplier based on confidence score
     * @param {number} confidence - Confidence score (0-1)
     * @returns {number} Confidence multiplier
     */
    getConfidenceMultiplier(confidence) {
        if (confidence >= 0.8) {
            return this.confidenceMultipliers.high;
        }
        if (confidence >= 0.5) {
            return this.confidenceMultipliers.medium;
        }
        return this.confidenceMultipliers.low;
    }

    /**
     * Normalize penalty based on project size
     * @param {number} penalty - Raw penalty
     * @param {number} findingCount - Number of findings
     * @returns {number} Normalized penalty
     */
    normalizePenalty(penalty, findingCount) {
        // Apply diminishing returns for large numbers of findings
        if (findingCount <= 10) {
            return penalty;
        } else if (findingCount <= 50) {
            return penalty * 0.8;
        } else if (findingCount <= 100) {
            return penalty * 0.6;
        } else {
            return penalty * 0.4;
        }
    }

    /**
     * Get grade and status based on score
     * @param {number} score - Health score
     * @returns {Object} Grade and status
     */
    getGradeAndStatus(score) {
        if (score >= 90) {
            return { grade: 'A', status: 'Excellent' };
        } else if (score >= 80) {
            return { grade: 'B', status: 'Good' };
        } else if (score >= 70) {
            return { grade: 'C', status: 'Fair' };
        } else if (score >= 60) {
            return { grade: 'D', status: 'Poor' };
        } else {
            return { grade: 'F', status: 'Critical' };
        }
    }

    /**
     * Calculate overall confidence
     * @param {Array} findings - Array of findings
     * @returns {string} Overall confidence level
     */
    calculateOverallConfidence(findings) {
        if (findings.length === 0) {
            return 'high';
        }
        
        const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
        
        if (avgConfidence >= 0.8) {
            return 'high';
        }
        if (avgConfidence >= 0.6) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Get detailed score breakdown
     * @param {Array} findings - Array of findings
     * @returns {Object} Score breakdown by category
     */
    getScoreBreakdown(findings) {
        const breakdown = {
            bySeverity: { high: 0, medium: 0, low: 0 },
            byCategory: {},
            byConfidence: { high: 0, medium: 0, low: 0 }
        };

        for (const finding of findings) {
            // Count by severity
            breakdown.bySeverity[finding.severity] = (breakdown.bySeverity[finding.severity] || 0) + 1;
            
            // Count by category
            breakdown.byCategory[finding.category] = (breakdown.byCategory[finding.category] || 0) + 1;
            
            // Count by confidence
            const confidenceLevel = this.getConfidenceLevel(finding.confidence);
            breakdown.byConfidence[confidenceLevel] = (breakdown.byConfidence[confidenceLevel] || 0) + 1;
        }

        return breakdown;
    }

    /**
     * Get confidence level string
     * @param {number} confidence - Confidence score
     * @returns {string} Confidence level
     */
    getConfidenceLevel(confidence) {
        if (confidence >= 0.8) {
            return 'high';
        }
        if (confidence >= 0.5) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Get health score recommendations
     * @param {Object} healthScore - Health score object
     * @returns {Array} Array of recommendations
     */
    getRecommendations(healthScore) {
        const recommendations = [];
        
        if (healthScore.score < 60) {
            recommendations.push({
                priority: 'high',
                title: 'Critical Mock Data Issues',
                description: 'High number of mock data patterns detected. Consider refactoring to use proper test data management.',
                action: 'Implement test data factories and mock management systems'
            });
        } else if (healthScore.score < 80) {
            recommendations.push({
                priority: 'medium',
                title: 'Mock Data Optimization',
                description: 'Some mock data patterns detected. Review and optimize test data usage.',
                action: 'Consolidate mock data and improve test organization'
            });
        }

        if (healthScore.details.confidence === 'low') {
            recommendations.push({
                priority: 'medium',
                title: 'Improve Pattern Detection',
                description: 'Low confidence in pattern detection suggests need for better mock data identification.',
                action: 'Refine pattern definitions and add context-aware filtering'
            });
        }

        return recommendations;
    }

    /**
     * Compare health scores over time
     * @param {Array} scores - Array of health score objects
     * @returns {Object} Comparison analysis
     */
    compareScores(scores) {
        if (scores.length < 2) {
            return { trend: 'insufficient_data', change: 0 };
        }

        const latest = scores[scores.length - 1];
        const previous = scores[scores.length - 2];
        
        const change = latest.score - previous.score;
        const trend = change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable';
        
        return {
            trend,
            change,
            latestScore: latest.score,
            previousScore: previous.score,
            improvement: change > 0
        };
    }
}

/**
 * Default health score calculator instance
 */
export const defaultHealthScoreCalculator = new HealthScoreCalculator();
