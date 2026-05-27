/**
 * Feedback Collector Component
 * Collects user feedback on recommendations and analysis results
 */

export class FeedbackCollector {
    constructor() {
        this.feedbackData = new Map();
        this.feedbackAPI = '/api/feedback';
        this.storageKey = 'feedback_data';
        this.userId = this.getUserId();
        this.maxFeedback = 5000;
        
        this.loadStoredFeedback();
    }

    /**
     * Get or generate user ID
     */
    getUserId() {
        let userId = localStorage.getItem('ml_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('ml_user_id', userId);
        }
        return userId;
    }

    /**
     * Generate unique feedback ID
     */
    generateFeedbackId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Load stored feedback from localStorage
     */
    loadStoredFeedback() {
        try {
            const storedFeedback = localStorage.getItem(this.storageKey);
            if (storedFeedback) {
                const feedbackObj = JSON.parse(storedFeedback);
                this.feedbackData = new Map(Object.entries(feedbackObj));
            }
        } catch (error) {
            console.error('Error loading stored feedback:', error);
            this.feedbackData = new Map();
        }
    }

    /**
     * Save feedback to localStorage
     */
    saveFeedback() {
        try {
            if (this.feedbackData.size > this.maxFeedback) {
                const entries = Array.from(this.feedbackData.entries());
                const toKeep = entries.slice(-this.maxFeedback);
                this.feedbackData = new Map(toKeep);
            }
            localStorage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.feedbackData)));
        } catch (error) {
            console.error('Error saving feedback:', error);
        }
    }

    /**
     * Get current context
     */
    getCurrentContext() {
        return {
            url: window.location.href,
            tab: window.location.hash.replace('#', '') || 'overview',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Collect recommendation feedback
     */
    collectRecommendationFeedback(recommendationId, isHelpful, correction = null, context = {}) {
        const feedback = {
            id: this.generateFeedbackId(),
            type: 'recommendation',
            recommendationId,
            isHelpful,
            correction,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            context: {
                ...this.getCurrentContext(),
                ...context
            }
        };
        
        this.feedbackData.set(feedback.id, feedback);
        this.saveFeedback();
        this.sendFeedbackToServer(feedback);
        
        console.log(`📝 Feedback collected: ${isHelpful ? 'helpful' : 'not helpful'} for recommendation ${recommendationId}`);
        return feedback.id;
    }

    /**
     * Collect analysis feedback
     */
    collectAnalysisFeedback(analysisId, rating, comment = null, context = {}) {
        const feedback = {
            id: this.generateFeedbackId(),
            type: 'analysis',
            analysisId,
            rating, // 1-5 scale
            comment,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            context: {
                ...this.getCurrentContext(),
                ...context
            }
        };
        
        this.feedbackData.set(feedback.id, feedback);
        this.saveFeedback();
        this.sendFeedbackToServer(feedback);
        
        console.log(`📝 Analysis feedback collected: ${rating}/5 for analysis ${analysisId}`);
        return feedback.id;
    }

    /**
     * Collect general feedback
     */
    collectGeneralFeedback(category, message, context = {}) {
        const feedback = {
            id: this.generateFeedbackId(),
            type: 'general',
            category,
            message,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            context: {
                ...this.getCurrentContext(),
                ...context
            }
        };
        
        this.feedbackData.set(feedback.id, feedback);
        this.saveFeedback();
        this.sendFeedbackToServer(feedback);
        
        console.log(`📝 General feedback collected: ${category}`);
        return feedback.id;
    }

    /**
     * Send feedback to server
     */
    async sendFeedbackToServer(feedback) {
        try {
            const response = await fetch(this.feedbackAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedback)
            });
            
            if (response.ok) {
                console.log('✅ Feedback sent to server successfully');
            } else {
                console.warn('⚠️ Failed to send feedback to server, keeping locally');
            }
        } catch (error) {
            console.error('Error sending feedback to server:', error);
            // Feedback is already saved locally, so we continue
        }
    }

    /**
     * Get feedback statistics
     */
    getStatistics() {
        const feedbackArray = Array.from(this.feedbackData.values());
        
        const byType = {};
        const byRecommendation = {};
        const helpfulCount = feedbackArray.filter(f => f.type === 'recommendation' && f.isHelpful).length;
        const notHelpfulCount = feedbackArray.filter(f => f.type === 'recommendation' && !f.isHelpful).length;
        
        feedbackArray.forEach(f => {
            byType[f.type] = (byType[f.type] || 0) + 1;
            
            if (f.type === 'recommendation') {
                byRecommendation[f.recommendationId] = byRecommendation[f.recommendationId] || {
                    total: 0,
                    helpful: 0,
                    notHelpful: 0
                };
                byRecommendation[f.recommendationId].total++;
                if (f.isHelpful) {
                    byRecommendation[f.recommendationId].helpful++;
                } else {
                    byRecommendation[f.recommendationId].notHelpful++;
                }
            }
        });
        
        return {
            total: feedbackArray.length,
            byType,
            byRecommendation,
            recommendationAccuracy: helpfulCount + notHelpfulCount > 0 
                ? (helpfulCount / (helpfulCount + notHelpfulCount) * 100).toFixed(2) + '%'
                : 'N/A',
            helpfulCount,
            notHelpfulCount
        };
    }

    /**
     * Get feedback by recommendation ID
     */
    getFeedbackByRecommendation(recommendationId) {
        const feedbackArray = Array.from(this.feedbackData.values());
        return feedbackArray.filter(f => f.recommendationId === recommendationId);
    }

    /**
     * Get recent feedback
     */
    getRecentFeedback(limit = 10) {
        const feedbackArray = Array.from(this.feedbackData.values());
        return feedbackArray
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Export feedback data
     */
    exportFeedback(format = 'json') {
        const data = {
            userId: this.userId,
            exportTimestamp: new Date().toISOString(),
            feedback: Array.from(this.feedbackData.values()),
            statistics: this.getStatistics()
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(data);
        }
        
        return data;
    }

    /**
     * Convert feedback to CSV format
     */
    convertToCSV(data) {
        const headers = ['id', 'type', 'recommendationId', 'isHelpful', 'rating', 'correction', 'category', 'message', 'userId', 'timestamp'];
        const rows = data.feedback.map(f => {
            return headers.map(header => {
                const value = f[header];
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return value || '';
            }).join(',');
        });
        
        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Clear all feedback data
     */
    clearFeedback() {
        this.feedbackData.clear();
        localStorage.removeItem(this.storageKey);
        console.log('🧹 Feedback data cleared');
    }

    /**
     * Get feedback for model training
     */
    getTrainingData() {
        const feedbackArray = Array.from(this.feedbackData.values());
        
        // Transform feedback into training format
        return feedbackArray.map(f => ({
            type: f.type,
            label: f.isHelpful !== undefined ? (f.isHelpful ? 1 : 0) : (f.rating || 0),
            features: {
                recommendationId: f.recommendationId,
                category: f.category,
                timestamp: f.timestamp
            },
            context: f.context
        }));
    }
}
