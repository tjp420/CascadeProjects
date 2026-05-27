/**
 * Enhanced Components Loader
 * 
 * Loads and initializes all enhanced dashboard components
 */

(function() {
    'use strict';

    console.log('🚀 Loading enhanced dashboard components...');

    // Initialize Event Manager
    if (typeof EventManagerEnhanced !== 'undefined') {
        window.eventManager = new EventManagerEnhanced();
        console.log('✅ Event Manager Enhanced initialized');
    }

    // Initialize Performance Optimizer
    if (typeof PerformanceOptimizer !== 'undefined') {
        window.performanceOptimizer = new PerformanceOptimizer();
        console.log('✅ Performance Optimizer initialized');
    }

    // Initialize Dashboard UI Enhancer
    if (typeof DashboardUIEnhancer !== 'undefined') {
        window.dashboardUI = new DashboardUIEnhancer();
        console.log('✅ Dashboard UI Enhancer initialized');
    }

    // Initialize Enhanced Code Analyzer
    if (typeof EnhancedCodeAnalyzer !== 'undefined') {
        window.enhancedAnalyzer = new EnhancedCodeAnalyzer();
        console.log('✅ Enhanced Code Analyzer initialized');
    }

    // Initialize Advanced Visualizations
    if (typeof AdvancedVisualizations !== 'undefined') {
        window.advancedViz = new AdvancedVisualizations();
        console.log('✅ Advanced Visualizations initialized');
    }

    // Initialize Enhanced Report Generator
    if (typeof EnhancedReportGenerator !== 'undefined') {
        window.enhancedReportGen = new EnhancedReportGenerator();
        console.log('✅ Enhanced Report Generator initialized');
    }

    // Make enhanced components available globally
    window.enhancedComponents = {
        eventManager: window.eventManager,
        performanceOptimizer: window.performanceOptimizer,
        dashboardUI: window.dashboardUI,
        enhancedAnalyzer: window.enhancedAnalyzer,
        advancedViz: window.advancedViz,
        enhancedReportGen: window.enhancedReportGen
    };

    console.log('✅ All enhanced components loaded successfully');

    // Notify that components are ready
    if (typeof CustomEvent !== 'undefined') {
        const event = new CustomEvent('enhancedComponentsLoaded');
        document.dispatchEvent(event);
    }
})();