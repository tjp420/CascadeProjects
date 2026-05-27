# Critical Security Remediation Plan
**Generated:** 2026-05-20  
**Severity:** CRITICAL  
**Total Issues:** 104 (6 API Keys + 98 Credit Cards)

---

## 🚨 Executive Summary

This remediation plan addresses **critical security vulnerabilities** identified in the codebase:
- **6 Mock API Keys** that need to be replaced with environment variables
- **98 Sample Credit Card Numbers** that need to be removed or properly secured
- **Health Score Impact:** Current score 64/100 (Grade D) - remediation will improve to 85+/100 (Grade B)

---

## 🎯 Priority 1: Mock API Keys (CRITICAL)

### Issue Overview
6 mock/test API keys are hardcoded in the codebase, posing significant security risks:
- Exposure of test credentials in version control
- Potential accidental deployment to production
- Violation of security best practices

### Detailed Findings

| # | File | Line | API Key Pattern | Risk Level | Action Required |
|---|------|------|-----------------|------------|-----------------|
| 1 | `billing/stripe-integration.js` | 11 | `pk_test_your_key` | HIGH | Replace with env var |
| 2 | `server.js` | 8 | `sk_test_your_secret_key` | HIGH | Replace with env var |
| 3 | `src/javascript/extracted_script_2_1_2_3.js` | 9 | `pk_test_51234567890abcdef123456789` | CRITICAL | Remove or replace |
| 4 | `src/javascript/extracted_script_2.js` | 10 | `pk_test_1234567890abcdef123456789` | CRITICAL | Remove or replace |
| 5 | `src/javascript/extracted_script_1_1_2_3_4_5_6_7_8_9_10.js` | 10 | `pk_test_1234567890abcdef123456789` | CRITICAL | Remove or replace |
| 6 | `src/javascript/stripe-service.js` | 21 | `sk_test_51234567890abcdef` | CRITICAL | Replace with env var |

### Remediation Steps

#### Step 1: Environment Variable Setup
```bash
# Create .env file (if not exists)
touch .env

# Add Stripe keys
echo "STRIPE_PUBLIC_KEY=pk_test_your_actual_publishable_key" >> .env
echo "STRIPE_SECRET_KEY=sk_test_your_actual_secret_key" >> .env
echo "STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret" >> .env

# Add to .gitignore
echo ".env" >> .gitignore
echo "*.env.local" >> .gitignore
```

#### Step 2: Code Updates

**File: `billing/stripe-integration.js`**
```javascript
// BEFORE
this.stripePublicKey = typeof process !== 'undefined' && process.env?.STRIPE_PUBLIC_KEY
    ? process.env.STRIPE_PUBLIC_KEY
    : 'pk_test_your_key';

// AFTER
this.stripePublicKey = process.env.STRIPE_PUBLIC_KEY || '';
if (!this.stripePublicKey) {
    throw new Error('STRIPE_PUBLIC_KEY environment variable is required');
}
```

**File: `server.js`**
```javascript
// BEFORE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_secret_key');

// AFTER
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
}
const stripe = require('stripe')(stripeSecretKey);
```

**File: `src/javascript/stripe-service.js`**
```javascript
// BEFORE
this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51234567890abcdef', {

// AFTER
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
}
this.stripe = new Stripe(stripeSecretKey, {
```

#### Step 3: Remove Duplicate/Extracted Scripts
The following extracted script files contain hardcoded test keys and should be removed:
- `src/javascript/extracted_script_2_1_2_3.js`
- `src/javascript/extracted_script_2.js`  
- `src/javascript/extracted_script_1_1_2_3_4_5_6_7_8_9_10.js`

```bash
# Remove extracted scripts with hardcoded keys
rm src/javascript/extracted_script_2_1_2_3.js
rm src/javascript/extracted_script_2.js
rm src/javascript/extracted_script_1_1_2_3_4_5_6_7_8_9_10.js
```

---

## 💳 Priority 2: Sample Credit Cards (CRITICAL)

### Issue Overview
98 sample credit card numbers found across the codebase, primarily in:
- Test files and documentation
- Security scanner examples
- Test data files

### Detailed Findings

#### High Priority Files
| # | File | Credit Cards Found | Action Required |
|---|------|-------------------|-----------------|
| 1 | `emergency-security-scanner.js` | 4 test cards | Document as test data only |
| 2 | `docs/test_api_data.json` | 3 potential matches | Review and sanitize |
| 3 | `docs/api_data.json` | 3 potential matches | Review and sanitize |
| 4 | `STRIPE_SETUP_GUIDE.md` | 4 test cards | Document as examples |

#### Standard Test Credit Cards (Legitimate)
The following are standard Stripe test cards and are **acceptable** in test/documentation contexts:
- `4111111111111111` (Visa)
- `5555555555554444` (Mastercard)
- `378282246310005` (Amex)
- `6011111111111117` (Discover)

### Remediation Steps

#### Step 1: Audit Credit Card Usage
```bash
# Search for all credit card patterns
grep -r "4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}" --include="*.js" --include="*.py" --include="*.json" .
grep -r "5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}" --include="*.js" --include="*.py" --include="*.json" .
```

#### Step 2: Categorize Findings
- **Keep:** Standard test cards in test files and documentation (4 cards)
- **Remove:** Any real-looking credit card numbers in production code
- **Document:** Add comments explaining test card usage

#### Step 3: Update Security Scanner
**File: `emergency-security-scanner.js`**
Add documentation to clarify test card usage:
```javascript
// Standard Stripe test credit cards for development/testing only
// These are NOT real credit card numbers
// See: https://stripe.com/docs/testing
this.secureReplacements = {
  creditCards: {
    visa: "4111111111111111",        // Stripe test Visa
    mastercard: "5555555555554444",  // Stripe test Mastercard  
    amex: "378282246310005",          // Stripe test Amex
    discover: "6011111111111117"     // Stripe test Discover
  },
```

---

## 📊 Priority 3: Medium Severity Issues

### Test URLs (1,043 findings)
- **Issue:** Hardcoded localhost URLs in configuration files
- **Risk:** Medium - potential production deployment issues
- **Action:** Replace with environment-specific URLs

### Mock Databases (19 findings)
- **Issue:** Mock database connection strings
- **Risk:** Medium - potential production data exposure
- **Action:** Replace with environment variables

---

## 🔧 Implementation Timeline

### Phase 1: Critical API Keys (Day 1)
- [ ] Set up environment variables
- [ ] Update `billing/stripe-integration.js`
- [ ] Update `server.js`
- [ ] Update `src/javascript/stripe-service.js`
- [ ] Remove extracted script files
- [ ] Test application with environment variables

### Phase 2: Credit Card Review (Day 2)
- [ ] Audit all credit card findings
- [ ] Categorize as test vs. production data
- [ ] Add documentation to test files
- [ ] Remove any non-test credit card numbers
- [ ] Update security scanner documentation

### Phase 3: Medium Issues (Day 3)
- [ ] Replace hardcoded URLs with environment variables
- [ ] Update database connection strings
- [ ] Add configuration validation
- [ ] Document environment setup

### Phase 4: Verification (Day 4)
- [ ] Run security scan again
- [ ] Verify health score improvement
- [ ] Test all functionality
- [ ] Update documentation

---

## ✅ Success Criteria

### Technical Metrics
- [ ] Zero hardcoded API keys in production code
- [ ] All credit cards documented as test data or removed
- [ ] Environment variables properly configured
- [ ] Health score improved from 64 to 85+
- [ ] All tests passing

### Security Metrics
- [ ] No credentials in version control
- [ ] Proper .gitignore configuration
- [ ] Environment variable validation in place
- [ ] Security scan shows zero critical findings

### Operational Metrics
- [ ] Application runs correctly with environment variables
- [ ] Deployment process documented
- [ ] Team trained on environment variable usage
- [ ] Monitoring for future security issues

---

## 🛡️ Prevention Measures

### 1. Pre-commit Hooks
```bash
# Add pre-commit hook to detect credentials
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Check for hardcoded credentials
if git diff --cached --name-only | xargs grep -l "sk_test\|sk_live\|pk_test\|pk_live"; then
    echo "ERROR: Hardcoded API keys detected!"
    exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

### 2. CI/CD Integration
Add credential scanning to CI/CD pipeline:
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Scan for credentials
        run: |
          npm install -g trufflehog
          trufflehog --regex --entropy=False .
```

### 3. Environment Variable Documentation
Create `ENV_SETUP.md` with detailed setup instructions.

### 4. Regular Security Scans
Schedule weekly automated security scans.

---

## 📞 Support & Resources

### Documentation
- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [OWASP Credential Management](https://owasp.org/www-community/controls/Credential_Management)
- [Environment Variables Best Practices](https://12factor.net/config)

### Tools
- TruffleHog: Credential scanner
- GitLeaks: Secret scanner
- dotenv: Environment variable management

---

## 📝 Notes

- This plan prioritizes **critical security issues** first
- Test credit cards in documentation are acceptable if properly documented
- Environment variables should never be committed to version control
- All changes should be tested in development before production deployment

**Next Steps:** Begin Phase 1 implementation immediately.