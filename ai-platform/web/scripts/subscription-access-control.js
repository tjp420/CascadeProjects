/**
 * Subscription Access Control System
 * Manages user access to features based on subscription tier
 */

class SubscriptionAccessControl {
    constructor() {
        this.currentUser = null;
        this.currentSubscription = null;
        this.apiBaseUrl = 'http://localhost:3002/api';
        
        // Define subscription tiers and their features
        this.tiers = {
            free: {
                name: 'Free',
                scansPerMonth: 10,
                features: [
                    'basic_analysis',
                    'limited_scans',
                    'community_support'
                ],
                restrictions: {
                    maxScansPerMonth: 10,
                    maxProjects: 1,
                    advancedFeatures: false,
                    apiAccess: false,
                    prioritySupport: false,
                    customReports: false
                }
            },
            basic: {
                name: 'Basic',
                scansPerMonth: 100,
                features: [
                    'basic_analysis',
                    'standard_scans',
                    'email_support',
                    'standard_reports'
                ],
                restrictions: {
                    maxScansPerMonth: 100,
                    maxProjects: 5,
                    advancedFeatures: false,
                    apiAccess: false,
                    prioritySupport: false,
                    customReports: false
                }
            },
            pro: {
                name: 'Pro',
                scansPerMonth: -1, // Unlimited
                features: [
                    'basic_analysis',
                    'advanced_analysis',
                    'unlimited_scans',
                    'priority_support',
                    'api_access',
                    'advanced_reports',
                    'custom_integrations'
                ],
                restrictions: {
                    maxScansPerMonth: -1, // Unlimited
                    maxProjects: -1, // Unlimited
                    advancedFeatures: true,
                    apiAccess: true,
                    prioritySupport: true,
                    customReports: true
                }
            },
            enterprise: {
                name: 'Enterprise',
                scansPerMonth: -1, // Unlimited
                features: [
                    'basic_analysis',
                    'advanced_analysis',
                    'unlimited_scans',
                    'dedicated_support',
                    'api_access',
                    'advanced_reports',
                    'custom_integrations',
                    'sla_guarantees',
                    'custom_development',
                    'team_collaboration'
                ],
                restrictions: {
                    maxScansPerMonth: -1, // Unlimited
                    maxProjects: -1, // Unlimited
                    advancedFeatures: true,
                    apiAccess: true,
                    prioritySupport: true,
                    customReports: true,
                    teamFeatures: true,
                    slaGuarantees: true
                }
            }
        };
    }

    /**
     * Initialize the access control system
     */
    async initialize() {
        // Load user from localStorage
        const storedUser = localStorage.getItem('dashboard_user');
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            await this.loadSubscriptionStatus();
        }
    }

    /**
     * Load subscription status from server
     */
    async loadSubscriptionStatus() {
        if (!this.currentUser) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/subscription-status?email=${this.currentUser.email}`);
            if (response.ok) {
                this.currentSubscription = await response.json();
                this.applyAccessRestrictions();
            }
        } catch (error) {
            console.error('Failed to load subscription status:', error);
            // Default to free tier on error
            this.currentSubscription = { status: 'none', tier: 'free' };
        }
    }

    /**
     * Get current tier (defaults to 'free' if no subscription)
     */
    getCurrentTier() {
        if (!this.currentSubscription || this.currentSubscription.status === 'none' || this.currentSubscription.status === 'canceled') {
            return 'free';
        }
        return this.currentSubscription.tier || 'free';
    }

    /**
     * Check if user has access to a specific feature
     */
    hasFeature(feature) {
        const tier = this.getCurrentTier();
        const tierConfig = this.tiers[tier];
        return tierConfig.features.includes(feature);
    }

    /**
     * Check if user can perform a specific action
     */
    canPerformAction(action) {
        const tier = this.getCurrentTier();
        const tierConfig = this.tiers[tier];
        
        switch (action) {
        case 'advanced_analysis':
            return tierConfig.restrictions.advancedFeatures;
        case 'api_access':
            return tierConfig.restrictions.apiAccess;
        case 'custom_reports':
            return tierConfig.restrictions.customReports;
        case 'unlimited_scans':
            return tierConfig.restrictions.maxScansPerMonth === -1;
        case 'priority_support':
            return tierConfig.restrictions.prioritySupport;
        case 'team_collaboration':
            return tierConfig.restrictions.teamFeatures;
        default:
            return true;
        }
    }

    /**
     * Get scan limit for current tier
     */
    getScanLimit() {
        const tier = this.getCurrentTier();
        return this.tiers[tier].restrictions.maxScansPerMonth;
    }

    /**
     * Get project limit for current tier
     */
    getProjectLimit() {
        const tier = this.getCurrentTier();
        return this.tiers[tier].restrictions.maxProjects;
    }

    /**
     * Check if user has exceeded scan limit
     */
    hasExceededScanLimit(scansUsed) {
        const limit = this.getScanLimit();
        if (limit === -1) {
            return false;
        } // Unlimited
        return scansUsed >= limit;
    }

    /**
     * Apply access restrictions to UI elements
     */
    applyAccessRestrictions() {
        const tier = this.getCurrentTier();
        const tierConfig = this.tiers[tier];

        // Disable advanced features for free/basic users
        if (!tierConfig.restrictions.advancedFeatures) {
            this.disableAdvancedFeatures();
        }

        // Disable API access for non-pro users
        if (!tierConfig.restrictions.apiAccess) {
            this.disableAPIAccess();
        }

        // Update scan limit display
        this.updateScanLimitDisplay();

        // Show upgrade prompts for restricted features
        this.showUpgradePrompts();
    }

    /**
     * Disable advanced features in the UI
     */
    disableAdvancedFeatures() {
        const advancedButtons = document.querySelectorAll('[data-feature="advanced"]');
        advancedButtons.forEach(button => {
            button.disabled = true;
            button.title = 'This feature requires a Pro or Enterprise subscription';
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.showUpgradeModal('advanced features');
            });
        });
    }

    /**
     * Disable API access in the UI
     */
    disableAPIAccess() {
        const apiButtons = document.querySelectorAll('[data-feature="api"]');
        apiButtons.forEach(button => {
            button.disabled = true;
            button.title = 'API access requires a Pro or Enterprise subscription';
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.showUpgradeModal('API access');
            });
        });
    }

    /**
     * Update scan limit display
     */
    updateScanLimitDisplay() {
        const limit = this.getScanLimit();
        const limitDisplay = document.getElementById('scan-limit-display');
        if (limitDisplay) {
            if (limit === -1) {
                limitDisplay.textContent = 'Unlimited scans';
            } else {
                limitDisplay.textContent = `${limit} scans/month`;
            }
        }
    }

    /**
     * Show upgrade prompts for restricted features
     */
    showUpgradePrompts() {
        const tier = this.getCurrentTier();
        if (tier === 'free' || tier === 'basic') {
            // Show upgrade banner
            this.showUpgradeBanner();
        }
    }

    /**
     * Show upgrade banner
     */
    showUpgradeBanner() {
        const existingBanner = document.getElementById('upgrade-banner');
        if (existingBanner) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'upgrade-banner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            text-align: center;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        banner.textContent = `
            <span style="margin-right: 15px /* Replaced innerHTML with textContent for safety */">🚀 Unlock unlimited scans and advanced features with Pro!</span>
            <button onclick="window.location.href='/web/pricing.html'" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            ">Upgrade Now</button>
            <button onclick="this.parentElement.remove()" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-left: 10px;
            ">✕</button>
        `;
        document.body.appendChild(banner);
        
        // Push content down
        document.body.style.paddingTop = '50px';
    }

    /**
     * Show upgrade modal
     */
    showUpgradeModal(feature) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        modal.textContent = `
            <div style="
                background: white /* Replaced innerHTML with textContent for safety */
                padding: 30px;
                border-radius: 16px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <h2 style="margin-bottom: 15px; color: #333;">Upgrade Required</h2>
                <p style="color: #666; margin-bottom: 20px;">
                    This feature requires a Pro subscription. Upgrade to unlock ${feature} and more!
                </p>
                <button onclick="window.location.href='/web/pricing.html'" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    margin-right: 10px;
                ">View Plans</button>
                <button onclick="this.closest('div').parentElement.remove()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                ">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Track usage (scans, API calls, etc.)
     */
    async trackUsage(actionType) {
        if (!this.currentUser) {
            return;
        }

        const usageKey = `usage_${actionType}_${new Date().getMonth()}_${new Date().getFullYear()}`;
        let usage = parseInt(localStorage.getItem(usageKey) || '0');
        usage++;
        localStorage.setItem(usageKey, usage.toString());

        // Check if limit exceeded
        if (actionType === 'scan') {
            const limit = this.getScanLimit();
            if (limit !== -1 && usage > limit) {
                this.showUpgradeModal('additional scans');
                return false;
            }
        }

        return true;
    }

    /**
     * Get usage statistics
     */
    getUsageStats() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const scansUsed = parseInt(localStorage.getItem(`usage_scan_${currentMonth}_${currentYear}`) || '0');
        const apiCalls = parseInt(localStorage.getItem(`usage_api_${currentMonth}_${currentYear}`) || '0');
        
        return {
            scans: scansUsed,
            apiCalls: apiCalls,
            month: currentMonth,
            year: currentYear
        };
    }
}

// Create global instance
const subscriptionAccess = new SubscriptionAccessControl();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await subscriptionAccess.initialize();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SubscriptionAccessControl, subscriptionAccess };
}