const { generateLicenseToken, validateLicenseToken } = require('../packages/simplebeacon-cli/src/lib/license-token.js');

// Use the SAME secret the server uses (from coming-soon/.env)
const SERVER_SECRET = 'your-secret-here';

// Generate a token exactly like the server does
const token = generateLicenseToken(
    { email: 'admin@simplebeacon.ai', tier: 'developer', features: ['continuous_shield', 'ci_integration', 'export_reports'] },
    SERVER_SECRET,
    60 * 24 * 30  // 30 days
);

console.log('=== Generated token ===');
console.log(token);
console.log();

// Validate it like the CLI does
const result = validateLicenseToken(token, SERVER_SECRET);
console.log('=== Validation result ===');
console.log('Valid:', result.valid);
console.log('Error:', result.error || 'none');
if (result.claims) {
    console.log('Claims:');
    console.log('  Email:', result.claims.sub);
    console.log('  Tier:', result.claims.tier);
    console.log('  Issuer:', result.claims.iss);
    console.log('  Audience:', result.claims.aud);
    console.log('  Features:', result.claims.features);
    console.log('  Expires:', new Date(result.claims.exp * 1000).toISOString());
    console.log('  Scan quota:', result.claims.scanQuota);
}

// Now test with the WRONG secret (what a user without the secret would see)
console.log();
console.log('=== Validation with WRONG secret ===');
const wrongResult = validateLicenseToken(token, 'wrong-secret');
console.log('Valid:', wrongResult.valid);
console.log('Error:', wrongResult.error);
