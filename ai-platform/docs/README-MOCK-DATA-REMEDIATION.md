# Mock Data Remediation Guide

This guide provides a comprehensive approach to addressing the critical mock data issues identified in your codebase.

## Current Status

- **Health Score**: 30% (F) - Critical
- **Total Findings**: 1,642 across 263 files
- **Severity Breakdown**: 15 High, 1,488 Medium, 139 Low
- **Top Issues**: test_data (827), mock_functions (574), test_emails (189)

## Quick Start

### 1. Run Automated Remediation

```bash
# Dry run to see what would be changed
node scripts/remediation-runner.js --dry-run --verbose

# Apply remediations with backups
node scripts/remediation-runner.js --target ./src --verbose
```

### 2. Review Reports

After running the remediation script, check the generated reports:

- `remediation-reports/remediation-report.json` - Detailed findings and plans
- `remediation-reports/remediation-summary.md` - Human-readable summary

## Manual Remediation Patterns

### Replace Hardcoded Emails

**Before:**
```javascript
const email = 'test@example.com';
```

**After:**
```javascript
import { generateTestEmail } from '../utils/test-data-generator.js';
const email = generateTestEmail();
```

### Replace Hardcoded Phone Numbers

**Before:**
```javascript
const phone = '+1-555-123-4567';
```

**After:**
```javascript
import { generateTestPhone } from '../utils/test-data-generator.js';
const phone = generateTestPhone();
```

### Replace Hardcoded Test Data

**Before:**
```javascript
const userData = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User'
};
```

**After:**
```javascript
import { generateTestUser } from '../utils/test-data-generator.js';
const userData = generateTestUser({
    name: 'Test User'
});
```

### Replace Mock Functions

**Before:**
```javascript
const mockFn = jest.fn().mockReturnValue('test');
```

**After:**
```javascript
import { MockFactory } from '../utils/mock-factory.js';
const mockFn = MockFactory.createMockFunction('testFunction', 'test');
```

## File-Specific Templates

### Python Test Files

```python
from utils.test_data_generator import generate_test_email, generate_test_user
from utils.test_fixtures import UserFixtures

class TestUserService:
    def setUp(self):
        self.test_user = UserFixtures.valid_user
        
    def test_user_creation(self):
        email = generate_test_email()
        user_data = generate_test_user({"email": email})
        # Test implementation
```

### JavaScript Test Files

```javascript
import { generateTestEmail, generateTestUser } from '../utils/test-data-generator.js';
import { UserFixtures } from '../utils/test-fixtures.js';

describe('UserService', () => {
    test('should create user successfully', () => {
        const email = generateTestEmail();
        const userData = generateTestUser({ email });
        // Test implementation
    });
});
```

### Java Test Files

```java
import utils.TestDataGenerator;
import utils.test.fixtures.UserFixtures;

class UserServiceTest {
    @Test
    void shouldCreateUserSuccessfully() {
        String email = TestDataGenerator.generateTestEmail();
        UserData userData = TestDataGenerator.generateTestUser(email);
        // Test implementation
    }
}
```

## Priority-Based Approach

### Phase 1: High Severity Issues (15 findings)
1. Review and fix all high-severity findings first
2. Focus on hardcoded sensitive data
3. Implement environment-specific configurations

### Phase 2: Major Categories
1. **Test Data (827 findings)**: Replace with generated fixtures
2. **Mock Functions (574 findings)**: Standardize with MockFactory
3. **Email Patterns (189 findings)**: Use email generators

### Phase 3: File-Specific Remediation
1. Focus on top problem files:
   - `test_user_service.py` (55 findings)
   - `test_api_client_new.py` (42 findings)
   - `MLDataCollector.test.js` (41 findings)

## Utility Functions Available

### Test Data Generator (`utils/test-data-generator.js`)
- `generateTestEmail()` - Generate unique test emails
- `generateTestPhone()` - Generate test phone numbers
- `generateTestDate()` - Generate test dates
- `generateTestId()` - Generate test IDs
- `generateTestUser()` - Generate complete user objects
- `getTestConfig()` - Environment-specific configurations

### Mock Factory (`utils/mock-factory.js`)
- `MockFactory.createMockFunction()` - Standardized mocks
- `MockFactory.createMockHttpClient()` - HTTP client mocks
- `MockFactory.createMockDatabase()` - Database mocks
- `MockCleanup` - Automatic mock cleanup

### Test Fixtures (`utils/test-fixtures.js`)
- `UserFixtures` - Predefined user data
- `ApiFixtures` - API response templates
- `DatabaseFixtures` - Sample database data
- `AuthFixtures` - Authentication test data

## Best Practices

### 1. Use Generated Data
- Always generate test data instead of hardcoding
- Use meaningful generators for realistic data
- Ensure data is unique between test runs

### 2. Standardize Mock Patterns
- Use MockFactory for consistent mock creation
- Implement proper cleanup with MockCleanup
- Track mock calls and assertions

### 3. Environment-Specific Configuration
- Use `getTestConfig()` for environment-specific values
- Separate test, development, and production configs
- Never hardcode credentials or URLs

### 4. Centralized Fixtures
- Use test fixtures for common data patterns
- Create reusable data templates
- Maintain fixtures alongside test files

## Validation and Monitoring

### 1. Re-scan After Changes
```bash
# Run scanner again to verify improvements
node scripts/mock-data-scanner.js --target ./src
```

### 2. Target Health Score
- **Goal**: Improve from 30% to 70%+ (B grade)
- **Target**: Reduce findings by 80%+
- **Target**: Eliminate all high-severity issues

### 3. Continuous Monitoring
- Integrate scanner into CI/CD pipeline
- Set health score thresholds for PR validation
- Regular scheduled scans for regression detection

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure utility files are in the correct path
2. **Generator Not Working**: Check if crypto.randomUUID() is available
3. **Mock Cleanup Issues**: Verify MockCleanup is used in tearDown/afterEach

### Getting Help

1. Check the generated remediation reports for specific guidance
2. Review the remediation patterns in `utils/mock-patterns-remediation.js`
3. Use the dry-run mode to preview changes before applying

## Success Metrics

### Immediate Goals
- [ ] Fix all 15 high-severity findings
- [ ] Reduce total findings below 500
- [ ] Improve health score above 50%

### Long-term Goals
- [ ] Achieve 70%+ health score
- [ ] Establish coding standards for test data
- [ ] Integrate automated scanning into development workflow

## Resources

- [Mock Data Scanner Documentation](./modules/mock-data-scanner.js)
- [Test Data Generator API](./utils/test-data-generator.js)
- [Mock Factory Reference](./utils/mock-factory.js)
- [Remediation Patterns Guide](./utils/mock-patterns-remediation.js)
