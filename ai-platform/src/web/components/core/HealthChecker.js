/**
 * Health checker for monitoring system resources and dashboard status
 */

class HealthChecker {
    constructor() {
        this.checks = [];
        this.lastCheck = null;
        this.healthy = true;
    }

    addCheck(name, checkFunction) {
        this.checks.push({ name, check: checkFunction });
    }

    async runChecks() {
        const results = {
            timestamp: new Date().toISOString(),
            healthy: true,
            checks: {}
        };

        for (const { name, check } of this.checks) {
            try {
                const result = await check();
                results.checks[name] = {
                    status: 'pass',
                    result
                };
            } catch (error) {
                results.healthy = false;
                results.checks[name] = {
                    status: 'fail',
                    error: error.message
                };
            }
        }

        this.lastCheck = results;
        this.healthy = results.healthy;

        return results;
    }

    getHealthStatus() {
        if (!this.lastCheck) {
            return {
                status: 'unknown',
                message: 'Health check not yet run'
            };
        }

        return {
            status: this.healthy ? 'healthy' : 'unhealthy',
            timestamp: this.lastCheck.timestamp,
            checks: this.lastCheck.checks
        };
    }

    // Default health checks
    setupDefaultChecks() {
        // Check if dashboard is loaded
        this.addCheck('dashboard_loaded', () => {
            return window.dashboard !== undefined;
        });

        // Check if AI bridge is available
        this.addCheck('ai_bridge_available', () => {
            return window.dashboard?.ai !== undefined;
        });

        // Check if data engine is available
        this.addCheck('data_engine_available', () => {
            return window.dashboard?.dataEngine !== undefined;
        });

        // Check memory usage (if available)
        this.addCheck('memory_usage', () => {
            if (window.performance && window.performance.memory) {
                const used = window.performance.memory.usedJSHeapSize / 1048576;
                const total = window.performance.memory.totalJSHeapSize / 1048576;
                const percentage = (used / total) * 100;
                
                if (percentage > 90) {
                    throw new Error(`Memory usage high: ${percentage.toFixed(1)}%`);
                }
                
                return { used: used.toFixed(2), total: total.toFixed(2), percentage: percentage.toFixed(1) };
            }
            return { status: 'not_available' };
        });

        // Check if last analysis exists
        this.addCheck('last_analysis_available', () => {
            return window.lastAnalysis !== null;
        });

        // Check if project data store exists
        this.addCheck('project_data_store_available', () => {
            return window.projectDataStore !== undefined;
        });
    }

    async quickCheck() {
        // Run only critical checks
        const criticalChecks = this.checks.filter(c => 
            c.name.includes('dashboard') || 
            c.name.includes('ai_bridge') ||
            c.name.includes('data_engine')
        );

        const results = {
            timestamp: new Date().toISOString(),
            healthy: true,
            checks: {}
        };

        for (const { name, check } of criticalChecks) {
            try {
                const result = await check();
                results.checks[name] = {
                    status: 'pass',
                    result
                };
            } catch (error) {
                results.healthy = false;
                results.checks[name] = {
                    status: 'fail',
                    error: error.message
                };
            }
        }

        return results;
    }
}

// Create global health checker instance
window.healthChecker = new HealthChecker();
window.HealthChecker = HealthChecker;
