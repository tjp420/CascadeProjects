/**
 * ML Code Analyzer Component
 * Uses machine learning to analyze code quality, complexity, and generate recommendations
 * Uses TensorFlow.js for browser-based ML inference
 */

export class MLCodeAnalyzer {
    constructor() {
        this.models = {
            quality: null,
            complexity: null,
            recommendations: null
        };
        this.modelStorageKey = 'ml_models';
        this.useML = false; // Start with rule-based until models are trained
        this.loadStoredModels();
    }

    /**
     * Load stored models from localStorage
     */
    loadStoredModels() {
        try {
            const storedModels = localStorage.getItem(this.modelStorageKey);
            if (storedModels) {
                const models = JSON.parse(storedModels);
                this.models = models;
                console.log('✅ ML models loaded from storage');
            }
        } catch (error) {
            console.error('Error loading ML models:', error);
        }
    }

    /**
     * Save models to localStorage
     */
    saveModels() {
        try {
            localStorage.setItem(this.modelStorageKey, JSON.stringify(this.models));
            console.log('✅ ML models saved to storage');
        } catch (error) {
            console.error('Error saving ML models:', error);
        }
    }

    /**
     * Extract features from code analysis data
     */
    extractFeatures(data, context = {}) {
        const analysis = data.analysis || {};
        const projectData = data.data || {};

        return {
            // Project structure features
            totalFiles: projectData.total_files || 0,
            totalDirectories: projectData.total_directories || 0,
            depth: projectData.depth || 0,
            
            // File type distribution
            fileTypes: projectData.file_types || {},
            largestFiles: projectData.largest_files || [],
            
            // Quality metrics
            codeQuality: analysis.overview?.codeQuality || 0,
            testCoverage: analysis.overview?.testCoverage || 0,
            technicalDebt: this.technicalDebtToNumeric(analysis.overview?.technicalDebt),
            maintainability: this.maintainabilityToNumeric(analysis.overview?.maintainability),
            healthScore: analysis.overview?.healthScore || 0,
            
            // Context features
            timestamp: new Date().toISOString(),
            context: context
        };
    }

    /**
     * Convert technical debt string to numeric value
     */
    technicalDebtToNumeric(debt) {
        const debtMap = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
        return debtMap[debt] || 2;
    }

    /**
     * Convert maintainability string to numeric value
     */
    maintainabilityToNumeric(maintainability) {
        const maintMap = { 'Poor': 1, 'Fair': 2, 'Good': 3, 'Excellent': 4 };
        return maintMap[maintainability] || 2;
    }

    /**
     * Calculate code quality using ML inference (or rule-based fallback)
     */
    async calculateCodeQuality(data, context = {}) {
        const features = this.extractFeatures(data, context);

        if (this.useML && this.models.quality) {
            // Use ML model for prediction
            return this.predictQuality(features);
        } else {
            // Use rule-based calculation as baseline
            return this.calculateQualityRuleBased(features);
        }
    }

    /**
     * Rule-based code quality calculation (baseline)
     */
    calculateQualityRuleBased(features) {
        let score = 50; // Base score

        // Adjust based on file structure
        if (features.depth <= 3) {
            score += 10;
        } else if (features.depth <= 5) {
            score += 5;
        } else {
            score -= 5;
        }

        // Adjust based on file count (moderate size is ideal)
        if (features.totalFiles > 100 && features.totalFiles < 1000) {
            score += 10;
        } else if (features.totalFiles >= 1000 && features.totalFiles < 5000) {
            score += 5;
        } else if (features.totalFiles >= 5000) {
            score -= 5;
        }

        // Adjust based on test coverage
        score += (features.testCoverage / 100) * 20;

        // Adjust based on technical debt
        const debtPenalty = (features.technicalDebt - 1) * 5;
        score -= debtPenalty;

        // Adjust based on maintainability
        const maintBonus = (features.maintainability - 1) * 5;
        score += maintBonus;

        // Clamp score between 0 and 100
        score = Math.max(0, Math.min(100, score));

        return {
            score: score,
            confidence: 0.7, // Rule-based has lower confidence
            factors: {
                structure: features.depth,
                testCoverage: features.testCoverage,
                technicalDebt: features.technicalDebt,
                maintainability: features.maintainability
            },
            method: 'rule_based'
        };
    }

    /**
     * Predict quality using ML model (placeholder for TensorFlow.js)
     */
    predictQuality(features) {
        // This is a placeholder for TensorFlow.js implementation
        // For now, fall back to rule-based
        console.log('🤖 Using ML quality prediction (not yet implemented)');
        return this.calculateQualityRuleBased(features);
    }

    /**
     * Assess complexity using ML inference (or rule-based fallback)
     */
    async assessComplexity(data, context = {}) {
        const features = this.extractFeatures(data, context);

        if (this.useML && this.models.complexity) {
            // Use ML model for prediction
            return this.predictComplexity(features);
        } else {
            // Use rule-based calculation as baseline
            return this.assessComplexityRuleBased(features);
        }
    }

    /**
     * Rule-based complexity assessment (baseline)
     */
    assessComplexityRuleBased(features) {
        let complexity = 'Medium';
        let score = 50;

        // Calculate complexity based on multiple factors
        const depthFactor = features.depth / 10 * 30;
        const fileFactor = Math.min(features.totalFiles / 1000 * 30, 30);
        const typeFactor = Object.keys(features.fileTypes).length / 10 * 20;

        score = 50 + depthFactor + fileFactor + typeFactor;
        score = Math.max(0, Math.min(100, score));

        if (score < 30) {
            complexity = 'Low';
        } else if (score < 70) {
            complexity = 'Medium';
        } else {
            complexity = 'High';
        }

        return {
            complexity,
            score,
            confidence: 0.7,
            factors: {
                depth: features.depth,
                fileCount: features.totalFiles,
                typeDiversity: Object.keys(features.fileTypes).length
            },
            method: 'rule_based'
        };
    }

    /**
     * Predict complexity using ML model (placeholder for TensorFlow.js)
     */
    predictComplexity(features) {
        // This is a placeholder for TensorFlow.js implementation
        console.log('🤖 Using ML complexity prediction (not yet implemented)');
        return this.assessComplexityRuleBased(features);
    }

    /**
     * Generate personalized recommendations
     */
    async generateRecommendations(userHistory, codeContext) {
        if (this.useML && this.models.recommendations) {
            // Use ML model for recommendations
            return this.predictRecommendations(userHistory, codeContext);
        } else {
            // Use content-based filtering as baseline
            return this.generateRecommendationsRuleBased(codeContext);
        }
    }

    /**
     * Rule-based recommendation generation (baseline)
     */
    generateRecommendationsRuleBased(codeContext) {
        const features = this.extractFeatures(codeContext);
        const recommendations = [];

        // Generate recommendations based on features
        if (features.testCoverage < 50) {
            recommendations.push({
                id: 'rec_1',
                title: 'Increase Test Coverage',
                description: `Test coverage is ${features.testCoverage}%. Aim for at least 80% to improve reliability.`,
                priority: 'high',
                category: 'testing'
            });
        }

        if (features.codeQuality < 80) {
            recommendations.push({
                id: 'rec_2',
                title: 'Improve Code Quality',
                description: `Code quality score is ${features.codeQuality}. Focus on reducing technical debt and improving maintainability.`,
                priority: 'high',
                category: 'quality'
            });
        }

        if (features.depth > 5) {
            recommendations.push({
                id: 'rec_3',
                title: 'Simplify Directory Structure',
                description: `Project depth is ${features.depth} levels. Consider flattening the structure for better maintainability.`,
                priority: 'medium',
                category: 'structure'
            });
        }

        if (features.technicalDebt > 2) {
            recommendations.push({
                id: 'rec_4',
                title: 'Reduce Technical Debt',
                description: 'Technical debt is elevated. Address high-priority debt items to improve long-term maintainability.',
                priority: 'high',
                category: 'technical_debt'
            });
        }

        return {
            recommendations,
            method: 'rule_based',
            confidence: 0.7
        };
    }

    /**
     * Predict recommendations using ML model (placeholder for TensorFlow.js)
     */
    predictRecommendations(userHistory, codeContext) {
        // This is a placeholder for TensorFlow.js implementation
        console.log('🤖 Using ML recommendation prediction (not yet implemented)');
        return this.generateRecommendationsRuleBased(codeContext);
    }

    /**
     * Train a simple model on collected data (placeholder)
     */
    async trainModel(trainingData, modelType) {
        console.log(`🤖 Training ${modelType} model...`);
        console.log(`Training data size: ${trainingData.length}`);

        // This is a placeholder for TensorFlow.js training
        // For MVP, we'll use rule-based models until sufficient data is collected
        console.log('⚠️ ML training not yet implemented - using rule-based models');

        return {
            status: 'not_implemented',
            message: 'ML training requires TensorFlow.js and sufficient training data'
        };
    }

    /**
     * Enable/disable ML inference
     */
    setUseML(enabled) {
        this.useML = enabled;
        console.log(`ML inference ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get model status
     */
    getModelStatus() {
        return {
            useML: this.useML,
            modelsAvailable: {
                quality: this.models.quality !== null,
                complexity: this.models.complexity !== null,
                recommendations: this.models.recommendations !== null
            },
            modelStorageKey: this.modelStorageKey
        };
    }

    /**
     * Clear stored models
     */
    clearModels() {
        this.models = {
            quality: null,
            complexity: null,
            recommendations: null
        };
        localStorage.removeItem(this.modelStorageKey);
        console.log('🧹 ML models cleared');
    }
}
