/**
 * True-Positive Fixture: credentials engine
 * Engine ID: credentials
 * Expected Finding: Credential Pattern (severity: medium+)
 * Language: JavaScript
 *
 * Intentionally contains hardcoded API keys and passwords.
 * The matrix validation runner expects at least one Credential Pattern finding.
 */

const stripeKey =
  "sk_live_51ABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA";
const dbPassword = "SuperSecretPass123!";

function connectToApi() {
  const apiKey = "api_key_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3";
  return fetch("https://api.example.com/data", {
    headers: { Authorization: "Bearer " + apiKey },
  });
}

module.exports = { stripeKey, dbPassword, connectToApi };
