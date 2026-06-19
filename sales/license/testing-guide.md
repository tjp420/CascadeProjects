# License Validation Testing Guide

## Overview

This guide covers end-to-end testing of the AI Slop Cop license validation flow.

## Prerequisites

- VSCode installed
- AI Slop Cop extension installed (v0.5.9+)
- Node.js 18+ installed
- Access to token generator script
- Test email account

## Test Environment Setup

### 1. Install Extension

```bash
# From VSIX
code --install-extension ai-slop-cop-0.5.9.vsix

# Or from marketplace (if published)
code --install-extension simplebeacon.ai-slop-cop
```

### 2. Verify Installation

1. Open VSCode
2. Check Activity Bar for AI Slop Cop icon
3. Open sidebar to verify it loads

## Test Scenarios

### Test 1: Free Tier (No License)

**Objective:** Verify extension works without license token

**Steps:**
1. Open VSCode
2. Open AI Slop Cop sidebar
3. Verify tier shows "Free"
4. Run a scan on a JavaScript file
5. Verify basic rules work (debug-artifact, etc.)
6. Verify Pro features are disabled

**Expected Results:**
- Tier displays as "Free"
- Basic scanning works
- Pro features show upgrade prompt
- No errors in console

### Test 2: Token Generation

**Objective:** Verify token generation works correctly

**Steps:**
```bash
# Generate Pro token
cd packages/simplebeacon-cli
node bin/generate-license-token.cjs pro

# Generate Enterprise token
node bin/generate-license-token.cjs enterprise
```

**Expected Results:**
- Token is generated successfully
- Token is a valid JWT string
- No errors in output

**Verification:**
```bash
# Decode token to verify structure
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d
```

Should contain:
```json
{
  "tier": "pro",
  "exp": 1234567890,
  "iat": 1234567890
}
```

### Test 3: Pro Token Activation

**Objective:** Verify Pro token activates correctly

**Steps:**
1. Generate a Pro token
2. Open VSCode Settings (`Ctrl+,`)
3. Search for "simplebeacon.licenseToken"
4. Paste the token
5. Open AI Slop Cop sidebar
6. Verify tier shows "Pro"

**Expected Results:**
- Token is accepted
- Tier displays as "Pro"
- Pro features are enabled
- No validation errors

### Test 4: Enterprise Token Activation

**Objective:** Verify Enterprise token activates correctly

**Steps:**
1. Generate an Enterprise token
2. Replace license token in settings
3. Reload VSCode window
4. Open AI Slop Cop sidebar
5. Verify tier shows "Enterprise"

**Expected Results:**
- Token is accepted
- Tier displays as "Enterprise"
- Enterprise features are enabled
- No validation errors

### Test 5: Invalid Token

**Objective:** Verify invalid tokens are rejected

**Steps:**
1. Set license token to "invalid-token"
2. Reload VSCode window
3. Open AI Slop Cop sidebar
4. Check for error message

**Expected Results:**
- Token is rejected
- Error message displayed
- Tier reverts to "Free"
- Extension still works in Free mode

### Test 6: Expired Token

**Objective:** Verify expired tokens are rejected

**Steps:**
1. Generate a token with past expiration
2. Set as license token
3. Reload VSCode window
4. Check for error message

**Expected Results:**
- Token is rejected
- Error message about expiration
- Tier reverts to "Free"

**To generate expired token:**
Modify token generator temporarily to set `exp` to past timestamp.

### Test 7: Token Persistence

**Objective:** Verify token persists across sessions

**Steps:**
1. Set valid Pro token
2. Close VSCode
3. Reopen VSCode
4. Open AI Slop Cop sidebar
5. Verify tier still shows "Pro"

**Expected Results:**
- Token is saved in settings
- Tier persists across sessions
- No re-authentication required

### Test 8: Token Revocation (Future)

**Objective:** Verify revocation check works (when implemented)

**Steps:**
1. Activate Pro token
2. Mark token as revoked in database
3. Trigger revocation check
4. Verify features are disabled

**Expected Results:**
- Revocation status checked
- Features disabled if revoked
- User notified of revocation

### Test 9: Tier Feature Verification

**Objective:** Verify features match tier

**Free Tier:**
- [x] Basic scanning (24 rules)
- [x] Gate evaluation
- [ ] CLI scanning
- [ ] Export reports
- [ ] Custom rules

**Pro Tier:**
- [x] All Free features
- [x] Full scanning (38 engines)
- [x] CLI scanning
- [x] Export reports
- [ ] Team management

**Enterprise Tier:**
- [x] All Pro features
- [x] Team management
- [x] Custom rules
- [x] Dedicated support

### Test 10: CLI License Validation

**Objective:** Verify CLI respects license token

**Steps:**
```bash
# Set environment variable
export SIMPLEBEACON_LICENSE_TOKEN="your-token"

# Run scan
npx simplebeacon scan --gate

# Verify Pro features work
npx simplebeacon scan --full --gate
```

**Expected Results:**
- CLI reads token from env var
- Pro features enabled with valid token
- Free mode without token

## Automated Tests

### Test Script

Create `test-license-validation.js`:

```javascript
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

const LICENSE_SECRET = 'fb578fe0edf57520edd3b1b53477fbafb20a43ee3d0162feb02974ca990cca54';

function generateToken(tier) {
  const token = execSync(`node packages/simplebeacon-cli/bin/generate-license-token.cjs ${tier}`).toString().trim();
  return token;
}

function validateToken(token) {
  try {
    const decoded = jwt.verify(token, LICENSE_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function runTests() {
  console.log('Running license validation tests...\n');
  
  // Test 1: Generate Pro token
  console.log('Test 1: Generate Pro token');
  const proToken = generateToken('pro');
  console.log('Token generated:', proToken.substring(0, 20) + '...');
  
  // Test 2: Validate Pro token
  console.log('\nTest 2: Validate Pro token');
  const proValidation = validateToken(proToken);
  console.log('Valid:', proValidation.valid);
  console.log('Tier:', proValidation.decoded.tier);
  
  // Test 3: Generate Enterprise token
  console.log('\nTest 3: Generate Enterprise token');
  const entToken = generateToken('enterprise');
  console.log('Token generated:', entToken.substring(0, 20) + '...');
  
  // Test 4: Validate Enterprise token
  console.log('\nTest 4: Validate Enterprise token');
  const entValidation = validateToken(entToken);
  console.log('Valid:', entValidation.valid);
  console.log('Tier:', entValidation.decoded.tier);
  
  // Test 5: Invalid token
  console.log('\nTest 5: Invalid token');
  const invalidValidation = validateToken('invalid-token');
  console.log('Valid:', invalidValidation.valid);
  console.log('Error:', invalidValidation.error);
  
  console.log('\nAll tests completed!');
}

runTests();
```

**Run tests:**
```bash
node test-license-validation.js
```

## Integration Tests

### Test with VSCode Extension API

Create `test-extension-api.js`:

```javascript
const vscode = require('vscode');

async function testLicenseValidation() {
  // Test setting license token
  const config = vscode.workspace.getConfiguration('simplebeacon');
  await config.update('licenseToken', 'test-token', vscode.ConfigurationTarget.Global);
  
  // Test reading license token
  const token = config.get('licenseToken');
  console.log('License token:', token);
  
  // Test tier detection
  const tier = getTier(); // Extension function
  console.log('Detected tier:', tier.tier);
}
```

## Performance Tests

### Token Validation Speed

```javascript
const jwt = require('jsonwebtoken');
const LICENSE_SECRET = 'fb578fe0edf57520edd3b1b53477fbafb20a43ee3d0162feb02974ca990cca54';

const token = 'your-test-token';

// Measure validation time
const start = Date.now();
for (let i = 0; i < 1000; i++) {
  jwt.verify(token, LICENSE_SECRET);
}
const end = Date.now();

console.log(`1000 validations in ${end - start}ms`);
console.log(`Average: ${(end - start) / 1000}ms per validation`);
```

**Target:** < 1ms per validation

## Security Tests

### Test 1: Token Tampering

**Objective:** Verify tampered tokens are rejected

**Steps:**
1. Generate valid token
2. Modify token payload
3. Attempt to validate
4. Verify rejection

**Expected:** Validation fails

### Test 2: Secret Rotation

**Objective:** Verify old tokens fail after secret rotation

**Steps:**
1. Generate token with old secret
2. Update LICENSE_SECRET
3. Attempt to validate
4. Verify rejection

**Expected:** Validation fails

### Test 3: Replay Attack

**Objective:** Verify replay protection (if implemented)

**Steps:**
1. Use same token multiple times
2. Check if replay is detected
3. Verify behavior

**Expected:** Depends on implementation

## Test Checklist

- [ ] Free tier works without token
- [ ] Pro token generation works
- [ ] Enterprise token generation works
- [ ] Pro token activates correctly
- [ ] Enterprise token activates correctly
- [ ] Invalid tokens are rejected
- [ ] Expired tokens are rejected
- [ ] Token persists across sessions
- [ ] CLI respects license token
- [ ] Features match tier
- [ ] Token validation is fast (< 1ms)
- [ ] Tampered tokens are rejected
- [ ] Secret rotation invalidates old tokens

## Common Issues

### Issue: Token not activating

**Solutions:**
- Verify token is copied correctly (no extra spaces)
- Check LICENSE_SECRET matches generator
- Verify token hasn't expired
- Check VSCode settings syntax

### Issue: Tier not updating

**Solutions:**
- Reload VSCode window
- Check for errors in Output panel
- Verify token is valid
- Clear settings and try again

### Issue: CLI not using token

**Solutions:**
- Verify environment variable is set
- Check variable name (SIMPLEBEACON_LICENSE_TOKEN)
- Try using --config with token
- Check CLI version

## Test Report Template

```markdown
# License Validation Test Report

**Date:** [Date]
**Tester:** [Name]
**Extension Version:** [Version]
**Token Generator Version:** [Version]

## Test Results

| Test | Status | Notes |
|------|--------|-------|
| Free tier | [PASS/FAIL] | |
| Pro generation | [PASS/FAIL] | |
| Enterprise generation | [PASS/FAIL] | |
| Pro activation | [PASS/FAIL] | |
| Enterprise activation | [PASS/FAIL] | |
| Invalid token | [PASS/FAIL] | |
| Expired token | [PASS/FAIL] | |
| Token persistence | [PASS/FAIL] | |
| CLI validation | [PASS/FAIL] | |
| Feature verification | [PASS/FAIL] | |

## Issues Found

1. [Description]
2. [Description]

## Recommendations

1. [Recommendation]
2. [Recommendation]

## Sign-off

**Tester:** [Name]
**Date:** [Date]
```

## Next Steps

After successful testing:
1. Document any issues found
2. Fix critical issues
3. Update documentation
4. Prepare for production deployment
5. Set up monitoring for token validation
