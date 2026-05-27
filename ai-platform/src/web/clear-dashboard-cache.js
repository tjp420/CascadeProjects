/**
 * Clear Dashboard Cache Script
 * Clears the DataEngine cache and forces refresh
 */

// This script can be run in the browser console to clear cache
if (typeof window !== 'undefined' && window.dashboard && window.dashboard.dataEngine) {
    console.log('🧹 Clearing dashboard cache...');
    window.dashboard.dataEngine.clearCache();
    console.log('✅ Cache cleared! Refreshing data...');
    window.dashboard.dataEngine.loadData().then(() => {
        console.log('🔄 Data refreshed successfully!');
    });
} else {
    console.log('❌ Dashboard not loaded yet. Please run this after the dashboard has loaded.');
}
