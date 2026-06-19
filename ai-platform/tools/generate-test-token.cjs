/**
 * Generate a test license token for certificate-upload.html testing
 */
const { upsertSubscription } = require('../server/lib/simplebeacon-subscription-store.cjs');
const { generateLicenseToken } = require('../server/lib/simplebeacon-proxy.cjs');


const EMAIL = process.env.SIMPLEBEACON_OWNER_EMAIL;
const TIER = 'executive';
const PRODUCT = 'executive_clearance';
const SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET;

if (!SECRET) {
  console.error('ERROR: SIMPLEBEACON_LICENSE_SECRET is not set. Set it in your environment before generating test tokens.');
  process.exit(1);
}

const token = generateLicenseToken(
  { email: EMAIL, tier: TIER, product: PRODUCT, features: ['pdf-generation', 'certificate'] },
  SECRET,
  60 * 24 * 7 // 7 days
);

console.log('\n=== Test License Token Generated ===');
if (process.env.DEBUG_TOKENS === 'true') {
  console.log('Token:', token);
} else {
  console.log('Token: ***REDACTED*** (set DEBUG_TOKENS=true to reveal)');
}
console.log('');

// Register in subscription store
upsertSubscription(EMAIL, {
  email: EMAIL,
  subscriptionActive: true,
  stripeCustomerId: 'cus_test_001',
  subscriptionId: 'sub_test_001',
  product: PRODUCT,
  apiToken: `sb_${require('crypto').randomBytes(24).toString('hex')}`,
  apiCallsThisPeriod: 0,
  periodStart: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  licenseToken: token,
  licenseTier: TIER,
  complianceCertsThisPeriod: 0,
  complianceCertLimit: 5,
  certClientName: 'Test Client',
  certProjectName: 'Test Project',
  certMilestone: 'release',
  certOrgId: 'test-org'
}).then((record) => {
  console.log('Registered in subscription store:', record.email);
  console.log('License tier:', record.licenseTier);
  console.log('\nToken generated (set DEBUG_TOKENS=true to reveal)');
  console.log('');
}).catch((err) => {
  console.error('Failed to register:', err.message);
});
