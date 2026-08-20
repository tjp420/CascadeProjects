/**
 * True-Positive Fixture: dbConnectionString engine
 * Engine ID: dbConnectionString
 * Expected Finding: Credential Pattern (severity: medium+)
 * Language: JavaScript
 *
 * Contains a database connection string with an embedded password.
 * Uses a non-allowlisted domain to avoid the example.com false-positive filter.
 */

const config = {
  database: {
    primary:
      "postgresql://admin:SuperSecretPass123!@prod-db.myapp.io:5432/appdb",
    replica: "mysql://root:password123@replica.myapp.io:3306/appdb",
  },
};

function getConnection() {
  return config.database.primary;
}

module.exports = { config, getConnection };
