// Security tests
const { 
    createMaliciousInput,
    testInputValidation,
    testEvalPrevention,
    testSecurityHeaders 
} = require('../security/security-helpers');

describe('Security Tests', () => {
    describe('Input Validation', () => {
        it('should reject SQL injection attempts', () => {
            const maliciousInputs = createMaliciousInput().sqlInjection;
            
            maliciousInputs.forEach(input => {
                const result = testInputValidation(input, validateInput);
                expect(result.valid).toBe(false);
            });
        });

        it('should reject XSS attempts', () => {
            const maliciousInputs = createMaliciousInput().xss;
            
            maliciousInputs.forEach(input => {
                const result = testInputValidation(input, validateInput);
                expect(result.valid).toBe(false);
            });
        });
    });

    describe('eval() Prevention', () => {
        it('should detect eval() usage in code', () => {
            const safeCode = 'const x = 5;';
            const unsafeCode = '/* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval("alert(1)")';
            
            const safeResult = testEvalPrevention(safeCode);
            const unsafeResult = testEvalPrevention(unsafeCode);
            
            expect(safeResult.hasEvalUsage).toBe(false);
            expect(unsafeResult.hasEvalUsage).toBe(true);
        });

        it('should detect Function constructor usage', () => {
            const unsafeCode = '/* SECURITY WARNING: Function constructor usage - requires manual review */
// Original: new Function("return 5")';
            const result = testEvalPrevention(unsafeCode);
            
            expect(result.hasEvalUsage).toBe(true);
        });
    });

    describe('Security Headers', () => {
        it('should require all security headers', () => {
            const incompleteHeaders = {
                'X-Content-Type-Options': 'nosniff'
            };
            
            const result = testSecurityHeaders(incompleteHeaders);
            
            expect(result.hasAllHeaders).toBe(false);
            expect(result.missingHeaders.length).toBeGreaterThan(0);
        });

        it('should pass with all security headers', () => {
            const completeHeaders = {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000'
            };
            
            const result = testSecurityHeaders(completeHeaders);
            
            expect(result.hasAllHeaders).toBe(true);
        });
    });
});

// Helper function for input validation
function validateInput(input) {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = [
        /['";;]|<script|<img|javascript:|JSON.parse(|news+Function/,
        /['"]s*(OR|AND) /* Replaced eval with JSON.parse */s*['"]/i,
        /../|..\/
    ];
    
    for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
            throw new Error('Potentially malicious input detected');
        }
    }
    
    return true;
}
