/**
 * Clear Dashboard Cache
 * Clears browser cache to ensure fresh API data is used
 */

console.log('🧹 Clearing dashboard cache...');

// Clear localStorage
try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('dashboard') || key.includes('cache') || key.includes('data')) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
    
    console.log(`✅ Cleared ${keysToRemove.length} keys from localStorage`);
} catch (e) {
    console.error('❌ Error clearing localStorage:', e);
}

// Clear sessionStorage
try {
    sessionStorage.clear();
    console.log('✅ Cleared sessionStorage');
} catch (e) {
    console.error('❌ Error clearing sessionStorage:', e);
}

// Clear DataEngine cache if available
if (window.dashboard && window.dashboard.dataEngine && window.dashboard.dataEngine.cache) {
    try {
        window.dashboard.dataEngine.cache.clear();
        console.log('✅ Cleared DataEngine cache');
    } catch (e) {
        console.error('❌ Error clearing DataEngine cache:', e);
    }
}

// Clear lastAnalysis if available
if (window.lastAnalysis) {
    try {
        delete window.lastAnalysis;
        console.log('✅ Cleared lastAnalysis');
    } catch (e) {
        console.error('❌ Error clearing lastAnalysis:', e);
    }
}

console.log('🧹 Cache clearing complete!');
console.log('📝 Next steps:');
console.log('1. Refresh the dashboard (F5 or Ctrl+R)');
console.log('2. Generate a new checklist');
console.log('3. Verify that project essentials are now detected correctly');
