/**
 * Security Utilities Module
 * Provides input sanitization, validation, and security functions
 */

window.SecurityUtils = {
    /**
     * Sanitize user input to prevent XSS attacks
     * @param {string} input - Raw user input
     * @param {Object} options - Sanitization options
     * @returns {string} - Sanitized input
     */
    sanitizeInput: function(input, options = {}) {
        if (typeof input !== 'string') {
            return '';
        }

        const {
            allowHTML = false,
            maxLength = 1000,
            allowedTags = [],
            allowedAttributes = {}
        } = options;

        let sanitized = input;

        // Basic XSS prevention
        if (!allowHTML) {
            sanitized = sanitized
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        } else {
            // Allow specific HTML tags but sanitize attributes
            sanitized = this.sanitizeHTML(sanitized, allowedTags, allowedAttributes);
        }

        // Remove dangerous JavaScript patterns
        sanitized = sanitized
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/onload=/gi, '')
            .replace(/onerror=/gi, '')
            .replace(/onclick=/gi, '')
            .replace(/onmouseover=/gi, '')
            .replace(/onfocus=/gi, '')
            .replace(/onblur=/gi, '')
            .replace(/onchange=/gi, '')
            .replace(/onsubmit=/gi, '');

        // Limit length
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }

        return sanitized.trim();
    },

    /**
     * Sanitize HTML content with allowed tags and attributes
     * @param {string} html - HTML content
     * @param {Array} allowedTags - Array of allowed tag names
     * @param {Object} allowedAttributes - Object with allowed attributes per tag
     * @returns {string} - Sanitized HTML
     */
    sanitizeHTML: function(html, allowedTags = [], allowedAttributes = {}) {
        const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
        
        return html.replace(tagPattern, (match, tagName, attributes) => {
            const lowerTagName = tagName.toLowerCase();
            
            if (!allowedTags.includes(lowerTagName)) {
                return ''; // Remove disallowed tags
            }

            // Sanitize attributes
            if (attributes && allowedAttributes[lowerTagName]) {
                const sanitizedAttrs = this.sanitizeAttributes(attributes, allowedAttributes[lowerTagName]);
                return `<${lowerTagName}${sanitizedAttrs}>`;
            }

            return `<${lowerTagName}>`;
        });
    },

    /**
     * Sanitize HTML attributes
     * @param {string} attributes - Raw attributes string
     * @param {Array} allowedAttrs - Array of allowed attribute names
     * @returns {string} - Sanitized attributes
     */
    sanitizeAttributes: function(attributes, allowedAttrs) {
        const attrPattern = /(\w+)=["'][^"']*["']/g;
        let sanitized = '';

        let match;
        while ((match = attrPattern.exec(attributes)) !== null) {
            const attrName = match[1].toLowerCase();
            if (allowedAttrs.includes(attrName)) {
                sanitized += ` ${match[0]}`;
            }
        }

        return sanitized;
    },

    /**
     * Validate and sanitize JSON input
     * @param {string} jsonString - JSON string to validate
     * @returns {Object} - { valid: boolean, data: any, error: string }
     */
    validateJSON: function(jsonString) {
        try {
            // Remove dangerous patterns
            const sanitized = jsonString
                .replace(/eval\s*\(/gi, '')
                .replace(/Function\s*\(/gi, '')
                .replace(/setTimeout\s*\(/gi, '')
                .replace(/setInterval\s*\(/gi, '');

            const data = JSON.parse(sanitized);
            
            // Check for nested functions or dangerous objects
            if (this.containsDangerousContent(data)) {
                return {
                    valid: false,
                    data: null,
                    error: 'JSON contains potentially dangerous content'
                };
            }

            return {
                valid: true,
                data: data,
                error: null
            };
        } catch (error) {
            return {
                valid: false,
                data: null,
                error: `Invalid JSON: ${error.message}`
            };
        }
    },

    /**
     * Check if object contains dangerous content
     * @param {any} obj - Object to check
     * @returns {boolean} - True if dangerous content found
     */
    containsDangerousContent: function(obj) {
        if (typeof obj === 'function') {
            return true;
        }

        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (typeof obj[key] === 'function') {
                        return true;
                    }
                    if (typeof obj[key] === 'object' && this.containsDangerousContent(obj[key])) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    /**
     * Create safe script execution context
     * @param {string} code - Code to execute
     * @param {Object} context - Safe context object
     * @returns {any} - Result of code execution
     */
    safeScriptExecution: function(code, context = {}) {
        // Validate code for dangerous patterns
        const dangerousPatterns = [
            /eval\s*\(/gi,
            /Function\s*\(/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi,
            /document\.write/gi,
            /innerHTML\s*=/gi,
            /outerHTML\s*=/gi,
            /require\s*\(/gi,
            /import\s+.*\s+from/gi
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
                throw new Error(`Dangerous pattern detected: ${pattern.source}`);
            }
        }

        // Create safe execution context
        const safeContext = {
            console: {
                log: (...args) => console.log('[Safe Context]', ...args),
                error: (...args) => console.error('[Safe Context]', ...args),
                warn: (...args) => console.warn('[Safe Context]', ...args)
            },
            Math: Math,
            Date: Date,
            JSON: {
                parse: this.validateJSON.bind(this),
                stringify: JSON.stringify.bind(JSON)
            },
            ...context
        };

        // Dynamic execution disabled — client-side Function/eval removed for security compliance
        throw new Error('safeScriptExecution is disabled in browser security utils');
    },

    /**
     * Generate Content Security Policy header
     * @returns {string} - CSP header value
     */
    generateCSP: function() {
        const directives = [
            'default-src \'self\'',
            'script-src \'self\' \'unsafe-inline\' https://unpkg.com https://cdn.jsdelivr.net',
            'style-src \'self\' \'unsafe-inline\' https://cdnjs.cloudflare.com',
            'img-src \'self\' data: https:',
            'font-src \'self\' https://cdnjs.cloudflare.com',
            'connect-src \'self\' ws: wss:',
            'frame-src \'none\'',
            'object-src \'none\'',
            'base-uri \'self\'',
            'form-action \'self\'',
            'frame-ancestors \'none\'',
            'upgrade-insecure-requests'
        ];

        return directives.join('; ');
    },

    /**
     * Validate file upload
     * @param {File} file - File object
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result
     */
    validateFileUpload: function(file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10MB
            allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/json'],
            maxFiles = 1
        } = options;

        const result = {
            valid: true,
            errors: []
        };

        // Check file size
        if (file.size > maxSize) {
            result.valid = false;
            result.errors.push(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
        }

        // Check file type
        if (!allowedTypes.includes(file.type)) {
            result.valid = false;
            result.errors.push(`File type ${file.type} is not allowed`);
        }

        // Check file name for dangerous patterns
        const dangerousPatterns = [
            /\.exe$/i,
            /\.bat$/i,
            /\.cmd$/i,
            /\.scr$/i,
            /\.pif$/i,
            /\.com$/i,
            /\.js$/i,
            /\.vbs$/i,
            /\.jar$/i,
            /\.app$/i,
            /\.deb$/i,
            /\.rpm$/i,
            /\.dmg$/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(file.name)) {
                result.valid = false;
                result.errors.push(`File name contains dangerous pattern: ${pattern.source}`);
                break;
            }
        }

        return result;
    },

    /**
     * Rate limiting utility
     */
    RateLimiter: class {
        constructor(maxRequests = 100, windowMs = 60000) {
            this.maxRequests = maxRequests;
            this.windowMs = windowMs;
            this.requests = new Map();
        }

        isAllowed(identifier = 'default') {
            const now = Date.now();
            const windowStart = now - this.windowMs;

            if (!this.requests.has(identifier)) {
                this.requests.set(identifier, []);
            }

            const userRequests = this.requests.get(identifier);
            
            // Remove old requests outside the window
            const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
            this.requests.set(identifier, validRequests);

            if (validRequests.length >= this.maxRequests) {
                return false;
            }

            validRequests.push(now);
            return true;
        }

        reset(identifier = 'default') {
            this.requests.delete(identifier);
        }
    },

    /**
     * Initialize security headers for the server
     */
    initSecurityHeaders: function() {
        return {
            'Content-Security-Policy': this.generateCSP(),
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };
    }
};

// Auto-initialize
console.log('✅ Security Utils initialized');
window.SecurityUtils.RateLimiter = window.SecurityUtils.RateLimiter;
