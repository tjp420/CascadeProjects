# Mock Data Prevention Guidelines

**Created:** 2026-05-20  
**Purpose:** Establish comprehensive guidelines for preventing mock data in production code  
**Audience:** All developers, code reviewers, and security team members  

---

## 🎯 Purpose and Scope

These guidelines provide comprehensive standards for preventing mock data, test data, and placeholder values from appearing in production code. Following these guidelines ensures code security, professionalism, and maintainability while supporting development workflows.

### **Scope:**
- All source code files
- Configuration files
- Test files and fixtures
- Documentation and comments
- Database schemas and migrations
- API documentation and examples

---

## 🚨 What Constitutes Mock Data

### **Prohibited Patterns:**

**Email Addresses:**
- `user@example.com`
- `test@test.com`
- `admin@example.com`
- `john.doe@example.com`
- Any `@example.com` addresses

**Names:**
- `Test User`
- `John Doe`
- `Jane Smith`
- `Demo User`
- Generic placeholders without context

**URLs:**
- `https://api.example.com`
- `https://app.example.com`
- `http://localhost:3000` (in production code)
- `https://test-site.com`

**Credentials:**
- `password123`
- `admin123`
- `demo123`
- `secret_key`
- Any hardcoded passwords or API keys

**Phone Numbers:**
- `555-0123`
- `123-456-7890`
- Any obvious test phone numbers

---

## ✅ Approved Placeholder Patterns

### **Standard Placeholder Format:**

**Email Addresses:**
- `change_this_description@yourdomain.com`
- `replace_with_real_email@yourdomain.com`
- Environment variable: `process.env.EMAIL || 'change_this_email@yourdomain.com'`

**Names:**
- `Replace With Real User Name`
- `Replace With Real Team Member Name`
- `Replace With Real Company Name`
- Context-specific descriptive placeholders

**URLs:**
- `https://replace_with_real_api_url.com`
- `https://replace_with_real_app_url.com`
- Environment variable: `process.env.API_URL || 'https://replace_with_real_api_url.com'`

**Credentials:**
- Always use environment variables
- Never include fallback values that look real
- Document required environment variables

**Test Data:**
- `replace_with_test_user_email@yourdomain.com`
- `replace_with_integration_test_data@yourdomain.com`
- Clearly marked as test data in comments

---

## 🔧 Implementation Guidelines

### **1. Environment Variables**

**Always use environment variables for sensitive data:**

```javascript
// ❌ BAD - Hardcoded value
const apiKey = 'sk_test_123456789';

// ✅ GOOD - Environment variable
const apiKey = process.env.STRIPE_API_KEY;
if (!apiKey) {
  throw new Error('STRIPE_API_KEY environment variable is required');
}
```

**With descriptive fallback for development:**

```javascript
// ✅ GOOD - Clear placeholder
const apiKey = process.env.STRIPE_API_KEY || 'replace_with_real_stripe_api_key';
```

### **2. Configuration Files**

**Use environment-specific configuration:**

```javascript
// config.js
const config = {
  apiUrl: process.env.API_URL || 'https://replace_with_real_api_url.com',
  email: process.env.ADMIN_EMAIL || 'change_this_admin_email@yourdomain.com',
  stripeKey: process.env.STRIPE_KEY || 'replace_with_real_stripe_key'
};
```

**Document required environment variables:**

```javascript
/**
 * Required Environment Variables:
 * - API_URL: Production API endpoint
 * - ADMIN_EMAIL: Administrator email address
 * - STRIPE_KEY: Stripe API key for payments
 */
```

### **3. Test Data Management**

**Separate test data from production code:**

```javascript
// ❌ BAD - Test data in production code
const defaultUser = {
  email: 'test@example.com',
  name: 'Test User'
};

// ✅ GOOD - Descriptive placeholder
const defaultUser = {
  email: 'replace_with_default_user_email@yourdomain.com',
  name: 'Replace With Real Default User Name'
};
```

**Use test data fixtures:**

```javascript
// tests/fixtures/users.js
export const testUsers = {
  valid: {
    email: 'replace_with_test_valid_user@yourdomain.com',
    name: 'Replace With Real Test User Name'
  },
  invalid: {
    email: 'replace_with_test_invalid_email@yourdomain.com',
    name: 'Replace With Real Test Invalid Name'
  }
};
```

### **4. Database and API Examples**

**Use realistic but clearly placeholder data:**

```sql
-- ❌ BAD - Test data in migrations
INSERT INTO users (email, name) VALUES ('test@example.com', 'Test User');

-- ✅ GOOD - Descriptive placeholder
INSERT INTO users (email, name) VALUES ('change_this_email@yourdomain.com', 'Replace With Real User Name');
```

**Document placeholder requirements:**

```sql
-- NOTE: Replace change_this_email@yourdomain.com with real email
-- This is a placeholder for initial admin user setup
```

### **5. Documentation and Comments**

**Clearly mark placeholders in documentation:**

```markdown
## Configuration

Replace the following placeholder values with your actual configuration:

- `change_this_api_url.com` - Your actual API endpoint
- `change_this_admin_email@yourdomain.com` - Administrator email address
```

**Use code comments for inline placeholders:**

```javascript
// TODO: Replace change_this_email@yourdomain.com with real admin email
const adminEmail = 'change_this_admin_email@yourdomain.com';
```

---

## 🔍 Detection and Prevention

### **Automated Detection Patterns**

**Implement regex patterns for detection:**

```javascript
// Mock data detection patterns
const mockDataPatterns = [
  /@example\.com/,                    // Test emails
  /test.*@.*\.com/,                   // Test email patterns
  /(john|jane)\.doe@/,               // Common fake names
  /password123|admin123|demo123/,     // Common test passwords
  /https?:\/\/(api|app)\.example\.com/, // Test URLs
  /localhost:\d+/,                    // Localhost in production code
  /555-\d{4}/,                        // Test phone numbers
];
```

### **Pre-commit Hooks**

**Implement pre-commit validation:**

```bash
#!/bin/bash
# pre-commit hook for mock data detection

# Check for common mock data patterns
if git diff --cached --name-only | xargs grep -l "@example.com"; then
  echo "❌ ERROR: Found mock data patterns in staged files"
  echo "Please replace test emails with descriptive placeholders"
  exit 1
fi

# Check for hardcoded credentials
if git diff --cached --name-only | xargs grep -lE "(password|api_key|secret)\s*=\s*['\"]"; then
  echo "❌ ERROR: Found hardcoded credentials in staged files"
  echo "Please use environment variables for sensitive data"
  exit 1
fi

echo "✅ No mock data patterns detected"
```

### **CI/CD Integration**

**Add to CI/CD pipeline:**

```yaml
# .github/workflows/security-scan.yml
name: Mock Data Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Scan for mock data
        run: |
          # Run mock data detection script
          python scripts/mock_data_scanner.py
          # Check for prohibited patterns
          grep -r "@example.com" src/ && exit 1 || true
```

---

## 📋 Code Review Checklist

### **Before Submitting Code:**

- [ ] No hardcoded emails, passwords, or API keys
- [ ] All test data uses descriptive placeholders
- [ ] Environment variables used for configuration
- [ ] No example.com or test URLs in production code
- [ ] Placeholder values clearly marked as placeholders
- [ ] Environment variables documented in code comments
- [ ] Test data separated from production code
- [ ] No localhost references in production code
- [ ] Phone numbers use realistic or placeholder patterns
- [ ] API keys and secrets use environment variables

### **Code Review Process:**

1. **Automated Check:** CI/CD pipeline runs mock data detection
2. **Manual Review:** Reviewer checks for prohibited patterns
3. **Security Review:** Security team validates sensitive data handling
4. **Documentation Review:** Ensure placeholders are documented

---

## 🎓 Training and Education

### **Developer Training Topics:**

1. **Security Best Practices:**
   - Why mock data is a security risk
   - How to properly handle sensitive data
   - Environment variable management
   - Secret management strategies

2. **Code Quality Standards:**
   - Professional placeholder patterns
   - Code clarity and maintainability
   - Test data management
   - Documentation standards

3. **Tool Usage:**
   - Pre-commit hook setup
   - Mock data detection tools
   - CI/CD integration
   - Dashboard monitoring

### **Onboarding Checklist:**

- [ ] Review mock data prevention guidelines
- [ ] Set up pre-commit hooks
- [ ] Complete security training
- [ ] Understand environment variable patterns
- [ ] Learn placeholder conventions
- [ ] Review code review checklist

---

## 🚨 Incident Response

### **If Mock Data is Detected:**

1. **Immediate Action:**
   - Identify all affected files
   - Assess security impact
   - Notify security team
   - Do not deploy to production

2. **Remediation Process:**
   - Replace with approved placeholders
   - Update environment variables
   - Document changes
   - Update related documentation

3. **Prevention:**
   - Root cause analysis
   - Update detection patterns
   - Improve training
   - Enhance automated detection

### **Escalation Matrix:**

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| Critical (credentials) | Immediate | Security team, CTO |
| High (test emails in prod) | Within 4 hours | Tech lead, security team |
| Medium (poor placeholders) | Within 24 hours | Team lead |
| Low (documentation) | Within 1 week | Developer |

---

## 📊 Monitoring and Metrics

### **Key Metrics:**

- **Mock Data Incidents:** Number of detections per sprint
- **Remediation Time:** Average time to resolve issues
- **Prevention Rate:** Percentage of code reviews catching issues
- **Training Compliance:** Percentage of team trained

### **Dashboard Tracking:**

- Real-time mock data metrics
- Historical trends and patterns
- Automated alerts and notifications
- Team performance metrics

---

## 🔄 Continuous Improvement

### **Regular Reviews:**

- **Monthly:** Review detection patterns and update
- **Quarterly:** Update guidelines based on lessons learned
- **Annually:** Comprehensive training program review

### **Feedback Loop:**

1. Collect feedback from developers
2. Analyze detection patterns
3. Update guidelines and tools
4. Communicate changes to team

### **Tool Enhancement:**

- Regular updates to detection patterns
- Integration with new security tools
- Automation of manual processes
- Enhanced reporting capabilities

---

## 📚 Additional Resources

### **Internal Documentation:**
- `DOCUMENTATION_STANDARDS.md` - Documentation guidelines
- `TECHNICAL_DEBT_SPRINT_PLAN.md` - Sprint planning and tracking
- `MOCK_DATA_REMEDIATION_COMPLETE_FINAL.md` - Remediation case study

### **External Resources:**
- OWASP Security Guidelines
- NIST Cybersecurity Framework
- Industry best practices for secret management

### **Tools and Scripts:**
- `security_monitor.py` - Security monitoring script
- `mock_data_scanner.py` - Mock data detection tool
- Pre-commit hooks repository
- CI/CD integration templates

---

## 📞 Support and Contacts

### **Security Team:**
- **Email:** security@yourdomain.com
- **Slack:** #security-channel
- **Response Time:** Within 4 hours for critical issues

### **Development Support:**
- **Tech Lead:** tech-lead@yourdomain.com
- **Code Review:** code-review@yourdomain.com
- **Documentation:** docs@yourdomain.com

---

**Guidelines Version:** 1.0  
**Last Updated:** 2026-05-20  
**Next Review:** 2026-08-20  
**Maintained By:** Security Team  

**Compliance Status:** ✅ ACTIVE  
**Training Status:** ✅ REQUIRED FOR ALL DEVELOPERS  
**Enforcement:** ✅ AUTOMATED VIA CI/CD