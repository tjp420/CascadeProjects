/**
 * Negative Test Case: Ignored Directory Path
 * Expected Behavior: PASS - Should NOT trigger credential finding
 * Reason: File is placed in server/lib/fixtures/ which should be ignored by ignore patterns
 * This file contains actual credential patterns that would normally trigger findings, but the path exclusion should prevent scanning
 * simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case for SimpleBeacon rule validation
 */

const leakedCredentials = {
  // simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case credentials for SimpleBeacon rule validation
  stripeSecretKey: 'sk_test_1234567890123456', // simplebeacon:production-leak-intent: test-negative-case - Intentional negative test case stripe key
  awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
  awsSecretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  databasePassword: 'RealProductionPassword123!',
  apiToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real.token.here'
};

function getCredentials() {
  return leakedCredentials;
}

module.exports = { getCredentials, leakedCredentials };
