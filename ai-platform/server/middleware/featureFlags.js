/**
 * Feature Flags and Progressive Trust Implementation
 * 
 * Implements feature flags for AI capabilities, progressive trust levels,
 * user trust scoring system, and trust-based access controls
 */

const logger = require('../lib/app-logger');

class FeatureFlags {
  constructor() {
    this.flags = new Map();
    this.userTrustScores = new Map();
    this.trustLevels = new Map();
    this.accessControls = new Map();
    this.initializeFlags();
    this.loadUserTrustData();
  }

  initializeFlags() {
    // Define feature flags with trust level requirements
    this.flags.set('advanced_ai_analysis', {
      enabled: true,
      requiredTrustLevel: 'bronze',
      description: 'Advanced AI code analysis capabilities',
      rolloutPercentage: 100
    });

    this.flags.set('real_time_collaboration', {
      enabled: true,
      requiredTrustLevel: 'silver',
      description: 'Real-time collaborative coding features',
      rolloutPercentage: 75
    });

    this.flags.set('enterprise_security', {
      enabled: true,
      requiredTrustLevel: 'gold',
      description: 'Enterprise-grade security features',
      rolloutPercentage: 50
    });

    this.flags.set('ai_model_training', {
      enabled: true,
      requiredTrustLevel: 'silver',
      description: 'Custom AI model training capabilities',
      rolloutPercentage: 60
    });

    this.flags.set('advanced_analytics', {
      enabled: true,
      requiredTrustLevel: 'bronze',
      description: 'Advanced analytics and reporting',
      rolloutPercentage: 100
    });

    this.flags.set('api_access', {
      enabled: true,
      requiredTrustLevel: 'gold',
      description: 'Full API access and integrations',
      rolloutPercentage: 40
    });

    this.flags.set('beta_features', {
      enabled: true,
      requiredTrustLevel: 'silver',
      description: 'Early access to beta features',
      rolloutPercentage: 30
    });

    this.flags.set('custom_models', {
      enabled: true,
      requiredTrustLevel: 'gold',
      description: 'Custom AI model deployment',
      rolloutPercentage: 25
    });

    logger.debug(`[FEATURES] Initialized ${this.flags.size} feature flags`);
  }

  loadUserTrustData() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const trustPath = path.join(__dirname, '../data/user-trust.json');
      if (fs.existsSync(trustPath)) {
        const data = fs.readFileSync(trustPath, 'utf8');
        const trustData = JSON.parse(data);
        
        trustData.users.forEach(user => {
          this.userTrustScores.set(user.userId, user.trustScore);
          this.trustLevels.set(user.userId, user.trustLevel);
        });
      }

      logger.debug(`[FEATURES] Loaded trust data for ${this.userTrustScores.size} users`);
    } catch (error) {
      logger.warn('[FEATURES] Failed to load user trust data:', error.message);
    }
  }

  saveUserTrustData() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const trustData = {
        users: Array.from(this.userTrustScores.entries()).map(([userId, score]) => ({
          userId,
          trustScore: score,
          trustLevel: this.trustLevels.get(userId) || 'bronze'
        })),
        lastUpdated: new Date().toISOString()
      };

      const trustPath = path.join(__dirname, '../data/user-trust.json');
      fs.writeFileSync(trustPath, JSON.stringify(trustData, null, 2));
    } catch (error) {
      console.error('[FEATURES] Failed to save user trust data:', error.message);
    }
  }

  // Check if user has access to a feature
  hasFeatureAccess(userId, featureName) {
    const flag = this.flags.get(featureName);
    if (!flag || !flag.enabled) {
      return {
        allowed: false,
        reason: 'Feature not available or disabled'
      };
    }

    const userTrustLevel = this.trustLevels.get(userId) || 'bronze';
    const requiredLevel = flag.requiredTrustLevel;

    // Check trust level requirement
    if (!this.isTrustLevelSufficient(userTrustLevel, requiredLevel)) {
      return {
        allowed: false,
        reason: `Trust level ${userTrustLevel} insufficient for ${featureName}. Required: ${requiredLevel}`,
        currentLevel: userTrustLevel,
        requiredLevel
      };
    }

    // Check rollout percentage
    if (!this.isInRollout(userId, flag.rolloutPercentage)) {
      return {
        allowed: false,
        reason: 'Feature not yet available for this user',
        rolloutPercentage: flag.rolloutPercentage
      };
    }

    return {
      allowed: true,
      reason: 'Access granted',
      trustLevel: userTrustLevel
    };
  }

  // Calculate user trust score
  calculateTrustScore(userId, userActivity) {
    const factors = {
      accountAge: this.calculateAccountAgeFactor(userId),
      activityLevel: this.calculateActivityFactor(userActivity),
      securityHistory: this.calculateSecurityFactor(userId),
      communityContribution: this.calculateCommunityFactor(userId),
      verificationStatus: this.calculateVerificationFactor(userId)
    };

    const weights = {
      accountAge: 0.2,
      activityLevel: 0.25,
      securityHistory: 0.25,
      communityContribution: 0.15,
      verificationStatus: 0.15
    };

    const score = Object.entries(factors).reduce((sum, [factor, value]) => {
      return sum + (value * weights[factor]);
    }, 0);

    const roundedScore = Math.round(Math.min(100, Math.max(0, score)));
    
    // Update user trust score
    this.userTrustScores.set(userId, roundedScore);
    
    // Update trust level based on score
    const newTrustLevel = this.getTrustLevelFromScore(roundedScore);
    this.trustLevels.set(userId, newTrustLevel);
    
    // Save updated data
    this.saveUserTrustData();

    logger.debug(`[FEATURES] Updated trust score for ${userId}: ${roundedScore} (${newTrustLevel})`);
    return {
      userId,
      trustScore: roundedScore,
      trustLevel: newTrustLevel,
      factors
    };
  }

  // Get user's current trust level
  getUserTrustLevel(userId) {
    return this.trustLevels.get(userId) || 'bronze';
  }

  // Get user's trust score
  getUserTrustScore(userId) {
    return this.userTrustScores.get(userId) || 50; // Default score
  }

  // Get all available features for a user
  getUserFeatures(userId) {
    const userTrustLevel = this.getUserTrustLevel(userId);
    const availableFeatures = [];

    this.flags.forEach((flag, featureName) => {
      const access = this.hasFeatureAccess(userId, featureName);
      if (access.allowed) {
        availableFeatures.push({
          name: featureName,
          description: flag.description,
          trustLevel: userTrustLevel,
          rolloutPercentage: flag.rolloutPercentage
        });
      }
    });

    return availableFeatures;
  }

  // Update feature flag configuration
  updateFeatureFlag(featureName, updates) {
    const flag = this.flags.get(featureName);
    if (!flag) {
      throw new Error(`Feature flag ${featureName} not found`);
    }

    Object.assign(flag, updates);
    logger.debug(`[FEATURES] Updated feature flag: ${featureName}`);
  }

  // Enable/disable feature for specific user
  setUserFeatureAccess(userId, featureName, enabled) {
    // Store user-specific override
    if (!this.accessControls.has(userId)) {
      this.accessControls.set(userId, {});
    }
    
    this.accessControls.get(userId)[featureName] = enabled;
    logger.debug(`[FEATURES] Set ${featureName} access for ${userId}: ${enabled}`);
  }

  // Get trust progression dashboard data
  getTrustProgression(userId) {
    const currentScore = this.getUserTrustScore(userId);
    const currentLevel = this.getUserTrustLevel(userId);
    const nextLevel = this.getNextTrustLevel(currentLevel);
    const nextLevelThreshold = this.getTrustLevelThreshold(nextLevel);

    const progression = {
      currentLevel,
      currentScore,
      nextLevel,
      nextLevelThreshold,
      progressToNext: nextLevel ? Math.round((currentScore / nextLevelThreshold) * 100) : 100,
      requirements: this.getTrustLevelRequirements(nextLevel),
      recommendations: this.getTrustLevelRecommendations(currentScore, currentLevel)
    };

    return progression;
  }

  // Helper methods
  isTrustLevelSufficient(current, required) {
    const levels = { bronze: 1, silver: 2, gold: 3 };
    return levels[current] >= levels[required];
  }

  isInRollout(userId, rolloutPercentage) {
    // Simple hash-based rollout
    const hash = this.hashUserId(userId);
    return (hash % 100) < rolloutPercentage;
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  calculateAccountAgeFactor(userId) {
    // Calculate account age factor (0-100)
    // This would typically use actual account creation date
    const accountAgeDays = this.getAccountAgeInDays(userId);
    return Math.min(100, (accountAgeDays / 365) * 100); // Max score at 1 year
  }

  calculateActivityFactor(userActivity) {
    if (!userActivity) return 30; // Default score

    const { logins, operations, lastActive } = userActivity;
    let score = 0;

    // Login frequency factor
    if (logins && logins > 0) {
      score += Math.min(40, (logins / 30) * 40); // Max 40 points for 30+ logins
    }

    // Operations factor
    if (operations && operations > 0) {
      score += Math.min(30, (operations / 100) * 30); // Max 30 points for 100+ operations
    }

    // Recency factor
    if (lastActive) {
      const daysSinceLastActive = this.getDaysSinceDate(lastActive);
      if (daysSinceLastActive <= 7) score += 30;
      else if (daysSinceLastActive <= 30) score += 20;
      else if (daysSinceLastActive <= 90) score += 10;
    }

    return Math.min(100, score);
  }

  calculateSecurityFactor(userId) {
    // Calculate security history factor
    const securityEvents = this.getUserSecurityEvents(userId);
    let score = 100;

    // Penalize for security incidents
    if (securityEvents.incidents > 0) {
      score -= securityEvents.incidents * 20;
    }

    // Reward for good security practices
    if (securityEvents.twoFactorEnabled) score += 10;
    if (securityEvents.passwordStrength === 'strong') score += 5;
    if (securityEvents.noFailedLogins) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  calculateCommunityFactor(userId) {
    // Calculate community contribution factor
    const contributions = this.getUserContributions(userId);
    let score = 0;

    if (contributions.forumPosts > 0) score += Math.min(20, contributions.forumPosts * 2);
    if (contributions.codeContributions > 0) score += Math.min(30, contributions.codeContributions * 3);
    if (contributions.bugReports > 0) score += Math.min(20, contributions.bugReports * 4);
    if (contributions.documentation > 0) score += Math.min(15, contributions.documentation * 3);
    if (contributions.mentoring > 0) score += Math.min(15, contributions.mentoring * 5);

    return Math.min(100, score);
  }

  calculateVerificationFactor(userId) {
    // Calculate verification status factor
    const verification = this.getUserVerification(userId);
    let score = 0;

    if (verification.email) score += 30;
    if (verification.phone) score += 25;
    if (verification.identity) score += 35;
    if (verification.enterprise) score += 10;

    return score;
  }

  getTrustLevelFromScore(score) {
    if (score >= 80) return 'gold';
    if (score >= 60) return 'silver';
    return 'bronze';
  }

  getNextTrustLevel(currentLevel) {
    const progression = { bronze: 'silver', silver: 'gold', gold: null };
    return progression[currentLevel];
  }

  getTrustLevelThreshold(level) {
    const thresholds = { bronze: 0, silver: 60, gold: 80 };
    return thresholds[level];
  }

  getTrustLevelRequirements(level) {
    const requirements = {
      bronze: {
        description: 'Basic access level',
        minimumScore: 0,
        features: ['Basic AI analysis', 'Standard reporting']
      },
      silver: {
        description: 'Enhanced access level',
        minimumScore: 60,
        features: ['Advanced analytics', 'Real-time collaboration', 'Beta features']
      },
      gold: {
        description: 'Premium access level',
        minimumScore: 80,
        features: ['Enterprise security', 'Full API access', 'Custom models']
      }
    };

    return requirements[level];
  }

  getTrustLevelRecommendations(score, currentLevel) {
    const recommendations = [];
    const nextLevel = this.getNextTrustLevel(currentLevel);

    if (nextLevel) {
      const threshold = this.getTrustLevelThreshold(nextLevel);
      const gap = threshold - score;

      if (gap > 0) {
        recommendations.push(`Increase trust score by ${gap} points to reach ${nextLevel} level`);
        
        if (gap > 30) {
          recommendations.push('Focus on account activity and community contributions');
        } else if (gap > 15) {
          recommendations.push('Improve security practices and verification status');
        } else {
          recommendations.push('Complete remaining verification steps');
        }
      }
    } else {
      recommendations.push('You have reached the highest trust level');
    }

    return recommendations;
  }

  // Placeholder methods (would connect to actual data sources)
  getAccountAgeInDays(_userId) {
    // Placeholder - would fetch from user database
    return 180; // 6 months
  }

  getDaysSinceDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
  }

  getUserSecurityEvents(_userId) {
    // Placeholder - would fetch from security logs
    return {
      incidents: 0,
      twoFactorEnabled: true,
      passwordStrength: 'strong',
      noFailedLogins: true
    };
  }

  getUserContributions(_userId) {
    // Placeholder - would fetch from community platform
    return {
      forumPosts: 5,
      codeContributions: 2,
      bugReports: 1,
      documentation: 3,
      mentoring: 0
    };
  }

  getUserVerification(_userId) {
    // Placeholder - would fetch from verification system
    return {
      email: true,
      phone: false,
      identity: false,
      enterprise: false
    };
  }

  // Get system-wide feature flag statistics
  getSystemStats() {
    const totalFlags = this.flags.size;
    const enabledFlags = Array.from(this.flags.values()).filter(flag => flag.enabled).length;
    const usersByLevel = { bronze: 0, silver: 0, gold: 0 };

    this.trustLevels.forEach(level => {
      usersByLevel[level]++;
    });

    return {
      totalFlags,
      enabledFlags,
      totalUsers: this.trustLevels.size,
      usersByLevel,
      averageTrustScore: this.calculateAverageTrustScore(),
      lastUpdated: new Date().toISOString()
    };
  }

  calculateAverageTrustScore() {
    if (this.userTrustScores.size === 0) return 0;
    
    const totalScore = Array.from(this.userTrustScores.values())
      .reduce((sum, score) => sum + score, 0);
    
    return Math.round(totalScore / this.userTrustScores.size);
  }

  // Bulk operations for admin
  bulkUpdateTrustScores(updates) {
    const results = [];
    
    updates.forEach(update => {
      const result = this.calculateTrustScore(update.userId, update.userActivity);
      results.push(result);
    });

    return results;
  }

  bulkUpdateFeatureFlags(flags) {
    const results = [];
    
    flags.forEach(flag => {
      try {
        this.updateFeatureFlag(flag.name, flag.updates);
        results.push({ name: flag.name, success: true });
      } catch (error) {
        results.push({ name: flag.name, success: false, error: error.message });
      }
    });

    return results;
  }
}

// Middleware for feature flag checking
const createFeatureFlagMiddleware = (featureFlags) => {
  return (featureName) => {
    return (req, res, next) => {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated to access this feature'
        });
      }

      const access = featureFlags.hasFeatureAccess(userId, featureName);
      
      if (!access.allowed) {
        return res.status(403).json({
          error: 'Feature access denied',
          message: access.reason,
          feature: featureName,
          currentLevel: access.currentLevel,
          requiredLevel: access.requiredLevel
        });
      }

      // Add feature access info to request
      req.featureAccess = {
        feature: featureName,
        trustLevel: access.trustLevel,
        allowed: true
      };

      next();
    };
  };
};

module.exports = {
  FeatureFlags,
  createFeatureFlagMiddleware
};
