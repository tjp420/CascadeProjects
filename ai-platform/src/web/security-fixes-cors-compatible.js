/**
 * CORS-Compatible Security Fixes for CascadeProjects
 * Addresses security without breaking API connectivity
 */

(function() {
    'use strict';
    
    console.log('🔒 CORS-Compatible Security Fixes activated...');
    
    /**
     * Simple input validator
     */
    class SimpleInputValidator {
        /**
         * Basic sanitization
         * @param {string} input - Input to sanitize
         * @returns {string} Sanitized input
         */
        static sanitize(input) {
            if (typeof input !== 'string') {
                return input;
            }
            
            // Remove obvious SQL injection patterns
            return input
                .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '')
                .replace(/(--|\/\*|\*\/|;|')/g, '')
                .replace(/[<>]/g, '')
                .trim();
        }
    }
    
    /**
     * Apply CORS-compatible security fixes
     */
    function applyCorsCompatibleFixes() {
        console.log('🔒 Applying CORS-compatible security fixes...');
        
        // 1. Add minimal security headers that don't cause CORS issues
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            const secureOptions = {
                ...options,
                headers: {
                    // Only add headers that don't cause CORS issues
                    'X-Requested-With': 'XMLHttpRequest',
                    ...options.headers
                }
            };
            
            return originalFetch(url, secureOptions);
        };
        
        console.log('✅ CORS-compatible security headers added');
        
        // 2. Add input validation to global scope
        window.SimpleInputValidator = SimpleInputValidator;
        
        // 3. Add permissive CSP (minimal restrictions)
        const cspMeta = document.createElement('meta');
        cspMeta.httpEquiv = 'Content-Security-Policy';
        cspMeta.content = 'default-src * \'unsafe-inline\' \'unsafe-eval\'; connect-src *; img-src * data:; frame-src *; font-src *; style-src * \'unsafe-hashes\'; script-src * \'unsafe-hashes\';';
        document.head.appendChild(cspMeta);
        
        console.log('✅ Permissive CSP implemented');
        
        return {
            timestamp: new Date().toISOString(),
            fixes: ['CORS-Compatible Headers', 'Input Validation', 'Permissive CSP'],
            status: 'Applied'
        };
    }
    
    /**
     * Initialize CORS-compatible security fixes
     */
    function initialize() {
        console.log('🔒 Initializing CORS-Compatible Security Fixes...');
        
        // Apply fixes when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyCorsCompatibleFixes);
        } else {
            applyCorsCompatibleFixes();
        }
        
        console.log('✅ CORS-Compatible Security Fixes initialized');
    }
    
    // Auto-initialize
    initialize();
    
    console.log('🔒 CORS-Compatible Security Fixes loaded and ready');
})();
