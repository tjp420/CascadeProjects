// Security testing utilities

export const createMaliciousInput = () => ({
    // SQL injection attempts
    sqlInjection: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "admin'/*"
    ],
    // XSS attempts
    xss: [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>'
    ],
    // Command injection
    commandInjection: [
        '; rm -rf /',
        '| cat /etc/passwd',
        '$(whoami)'
    ],
    // Path traversal
    pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/passwd'
    ]
});

export const testInputValidation = (input, validator) => {
    try {
        validator(input);
        return { valid: true, error: null };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

export const testSecurityHeaders = (headers) => {
    const requiredHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security'
    ];
    
    const missingHeaders = requiredHeaders.filter(header => !headers[header]);
    
    return {
        hasAllHeaders: missingHeaders.length === 0,
        missingHeaders
    };
};

export const testEvalPrevention = (code) => {
    const evalPatterns = [
        /eval\s*\(/g,
        /new\s+Function\s*\(/g,
        /setTimeout\s*\(/g,
        /setInterval\s*\(/g
    ];
    
    const foundPatterns = [];
    evalPatterns.forEach(pattern => {
        const matches = code.match(pattern);
        if (matches) {
            foundPatterns.push(pattern.source);
        }
    });
    
    return {
        hasEvalUsage: foundPatterns.length > 0,
        foundPatterns
    };
};

export const testContentTypeValidation = (contentType, expectedType) => {
    return {
        isValid: contentType === expectedType,
        actual: contentType,
        expected: expectedType
    };
};
