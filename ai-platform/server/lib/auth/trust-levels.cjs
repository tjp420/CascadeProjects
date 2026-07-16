// simplebeacon-ignore workspace-health
'use strict';

const { toClientError } = require('../../../shared-utils/index.cjs');
const createError = require('http-errors');

// Trust levels and their permissions
const trustLevels = {
  bronze: {
    level: 1,
    permissions: ['read:own', 'write:own', 'analyze:public'],
    rateLimitMultiplier: 1,
    features: ['basic_analysis', 'sample_data_basic'],
    mfaRequired: false
  },
  silver: {
    level: 2,
    permissions: ['read:own', 'write:own', 'read:shared', 'analyze:public', 'analyze:private'],
    rateLimitMultiplier: 2,
    features: ['advanced_analysis', 'sample_data_advanced', 'collaboration'],
    mfaRequired: false
  },
  gold: {
    level: 3,
    permissions: ['read:own', 'write:own', 'read:shared', 'write:shared', 'analyze:public', 'analyze:private', 'admin:basic'],
    rateLimitMultiplier: 5,
    features: ['enterprise_features', 'api_access', 'advanced_security'],
    mfaRequired: true
  }
};

// Rate limiting based on trust level
function getTrustLevelRateLimit(trustLevel) {
  const baseLimit = 100; // Base requests per 15 minutes
  const multiplier = trustLevels[trustLevel]?.rateLimitMultiplier || 1;
  return baseLimit * multiplier;
}

// Evaluate trust level from user profile
function evaluateTrustLevel(user) {
  if (!user || typeof user !== 'object') return 'bronze';
  const factors = {
    accountAge: Math.min((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24 * 30), 12),
    successfulAnalyses: user.successfulAnalyses || 0,
    securityIncidents: user.securityIncidents || 0,
    communityContributions: user.communityContributions || 0,
    verificationStatus: user.verificationStatus || 'none'
  };

  let score = 0;
  score += Math.min(factors.accountAge * 2.5, 30);
  score += Math.min(factors.successfulAnalyses * 0.5, 25);
  score -= Math.min(factors.securityIncidents * 10, 20);
  score += Math.min(factors.communityContributions * 3, 15);
  const verificationBonus = { none: 0, email: 5, phone: 7, enterprise: 10 };
  score += verificationBonus[factors.verificationStatus] || 0;

  if (score >= 70) return 'gold';
  if (score >= 40) return 'silver';
  return 'bronze';
}

// Authorization middleware factory
function authorize(requiredPermissions = []) {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: requiredPermissions,
        current: userPermissions
      });
    }

    next();
  };
}

// Trust level middleware
function requireTrustLevel(minimumLevel) {
  const levelOrder = { bronze: 1, silver: 2, gold: 3 };
  const requiredLevel = levelOrder[minimumLevel] || 1;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userLevel = levelOrder[req.user.trustLevel] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Trust level ${minimumLevel} or higher required`,
        current: req.user.trustLevel,
        required: minimumLevel
      });
    }

    next();
  };
}

/**
 * Determine whether a user is allowed to use write-heavy dashboard features
 * (team dashboard, scan triggers, exports, settings, admin actions).
 * Read-only views (audit, roadmap, results, trust, security, platform, quality)
 * do not require this.
 */
function canAccessDashboardWrite(user) {
  if (!user || typeof user !== 'object') return false;
  const levelOrder = { bronze: 1, silver: 2, gold: 3 };
  const userLevel = levelOrder[user.trustLevel] || 0;
  if (userLevel >= 2) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superuser') return true;
  const features = Array.isArray(user.features) ? user.features : [];
  if (features.map(String).map(s => s.toLowerCase()).includes('all_modules')) return true;
  if (features.map(String).map(s => s.toLowerCase()).includes('team_dashboard')) return true;
  const tier = String(user.tier || user.plan || '').toLowerCase();
  const paidTiers = ['silver', 'gold', 'pro', 'startup', 'enterprise', 'compliance', 'team'];
  if (paidTiers.includes(tier)) return true;
  return false;
}

module.exports = {
  trustLevels,
  getTrustLevelRateLimit,
  evaluateTrustLevel,
  authorize,
  requireTrustLevel,
  canAccessDashboardWrite
};
