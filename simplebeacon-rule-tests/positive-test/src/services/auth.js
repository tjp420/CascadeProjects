/**
 * Positive Test Case: Production Leak
 * Expected Behavior: FAIL - Should trigger credential finding
 * Reason: Contains hardcoded production API key
 * simplebeacon:production-leak-intent: test-positive-case - Intentional positive test case for SimpleBeacon rule validation
 */

const API_KEY = 'sk_live_51ABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA';

const productionConfig = {
  databaseUrl: 'postgresql://admin:SuperSecretPass123!@prod-db.example.com:5432/appdb',
  awsSecretKey: 'AKIAIOSFODNN7EXAMPLE',
  awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
};

function authenticateUser(username, password) {
  // This function uses the leaked credentials
  // Mock connection for test purposes
  const connection = { query: () => ({}) };
  return connection.query('SELECT * FROM users WHERE username = ?', [username]);
}

module.exports = { authenticateUser, productionConfig };
