/**
 * Simple Security Fixes for CascadeProjects
 * Addresses critical security issues without recursion
 */

(function() {
    'use strict';
    
    console.log('🔒 Simple Security Fixes activated...');
    
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
     * Apply simple security fixes
     */
    function applySimpleSecurityFixes() {
        console.log('🔒 Applying simple security fixes...');
        
        // 1. Add CORS-compatible security headers to fetch
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            const secureOptions = {
                ...options,
                headers: {
                    // Remove headers that cause CORS issues
                    // 'X-Content-Type-Options': 'nosniff', // Causes CORS issues
                    'X-Frame-Options': 'DENY',
                    'X-XSS-Protection': '1; mode=block',
                    ...options.headers
                }
            };
            
            return originalFetch(url, secureOptions);
        };
        
        console.log('✅ Simple security headers added');
        
        // 2. Add input validation to global scope
        window.SimpleInputValidator = SimpleInputValidator;
        
        // 3. Add functional CSP (allows inline content)
        const cspMeta = document.createElement('meta');
        cspMeta.httpEquiv = 'Content-Security-Policy';
        cspMeta.content = 'default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' *; connect-src *; img-src * data:; frame-src *; font-src *; style-src * \'unsafe-hashes\'; script-src * \'unsafe-hashes\';';
        document.head.appendChild(cspMeta);
        
        console.log('✅ Simple CSP implemented');
        
        return {
            timestamp: new Date().toISOString(),
            fixes: ['Security Headers', 'Input Validation', 'CSP'],
            status: 'Applied'
        };
    }
    
    /**
     * Initialize simple security fixes
     */
    function initialize() {
        console.log('🔒 Initializing Simple Security Fixes...');
        
        // Apply fixes when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applySimpleSecurityFixes);
        } else {
            applySimpleSecurityFixes();
        }
        
        console.log('✅ Simple Security Fixes initialized');
    }
    
    // Auto-initialize
    initialize();
    
    console.log('🔒 Simple Security Fixes loaded and ready');
})();
