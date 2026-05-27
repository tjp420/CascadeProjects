/**
 * Dashboard Performance Optimizations
 *
 * This file contains performance optimization utilities and monitoring
 * for the AI Coding Intelligence Dashboard.
 */

// Performance monitoring utilities
const PerformanceMonitor = {
    metrics: {},

    init() {
    // Start performance monitoring
        if ('performance' in window) {
            window.addEventListener('load', () => {
                this.collectMetrics();
            });
        }
    },

    collectMetrics() {
        const perfData = performance.getEntriesByType('navigation')[0];
        this.metrics = {
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint(),
        };

        console.log('🚀 Performance Metrics:', this.metrics);
        this.reportMetrics();
    },

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const fp = paintEntries.find((entry) => entry.name === 'first-paint');
        return fp ? fp.startTime : null;
    },

    getFirstContentfulPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
        return fcp ? fcp.startTime : null;
    },

    reportMetrics() {
    // Report metrics to console (could be sent to analytics)
        if (this.metrics.domContentLoaded > 1000) {
            console.warn('⚠️ Slow DOM content loaded:', this.metrics.domContentLoaded + 'ms');
        }
        if (this.metrics.loadComplete > 3000) {
            console.warn('⚠️ Slow page load:', this.metrics.loadComplete + 'ms');
        }
    },
};

// Resource loading optimization
const ResourceOptimizer = {
    preloadCriticalResources() {
    // Preload critical CSS
        this.preloadResource('dashboard-styles.css', 'style');

        // Preconnect to CDNs
        this.addPreconnect('https://cdnjs.cloudflare.com');
        this.addPreconnect('https://cdn.jsdelivr.net');
    },

    preloadResource(href, as) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = as;
        document.head.appendChild(link);
    },

    addPreconnect(origin) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        document.head.appendChild(link);
    },

    optimizeExternalScripts() {
    // Add defer to external scripts for non-critical functionality
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach((script) => {
            if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
                // Check if script is critical
                if (!this.isCriticalScript(script.src)) {
                    script.defer = true;
                }
            }
        });
    },

    isCriticalScript(src) {
    // Define which scripts are critical for initial render
        const criticalScripts = [
            'chart.js', // Needed for charts
            'security', // Security fixes
        ];

        return criticalScripts.some((critical) => src.includes(critical));
    },
};

// Loading state management
const LoadingManager = {
    showLoading() {
        const loader = document.createElement('div');
        loader.id = 'dashboard-loader';
        loader.textContent = `
      <div class="loader-container">
        <div class="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    ` /* Replaced innerHTML with textContent for safety */
        loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(26, 26, 46, 0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    `;
        document.body.appendChild(loader);

        // Add spinner styles
        if (!document.getElementById('loader-styles')) {
            const style = document.createElement('style');
            style.id = 'loader-styles';
            style.textContent = `
        .loader-container {
          text-align: center;
          color: white;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid rgba(255,255,255,0.3);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
            document.head.appendChild(style);
        }
    },

    hideLoading() {
        const loader = document.getElementById('dashboard-loader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.3s ease';
            setTimeout(() => loader.remove(), 300);
        }
    },
};

// Lazy loading for images and heavy components
const LazyLoader = {
    init() {
        this.setupIntersectionObserver();
    },

    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            observer.unobserve(img);
                        }
                    }
                });
            });

            // Observe images with data-src attribute
            document.querySelectorAll('img[data-src]').forEach((img) => {
                imageObserver.observe(img);
            });
        }
    },

    loadComponent(componentId, callback) {
    // Lazy load dashboard components
        const element = document.getElementById(componentId);
        if (element && !element.dataset.loaded) {
            // Simulate component loading
            setTimeout(() => {
                element.dataset.loaded = 'true';
                if (callback) {
                    callback();
                }
            }, 100);
        }
    },
};

// Initialize optimizations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PerformanceMonitor.init();
        ResourceOptimizer.preloadCriticalResources();
        ResourceOptimizer.optimizeExternalScripts();
        LazyLoader.init();
    });
} else {
    // DOM already loaded
    PerformanceMonitor.init();
    ResourceOptimizer.preloadCriticalResources();
    ResourceOptimizer.optimizeExternalScripts();
    LazyLoader.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PerformanceMonitor,
        ResourceOptimizer,
        LoadingManager,
        LazyLoader,
    };
}
