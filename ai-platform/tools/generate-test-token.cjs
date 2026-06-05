/**
 * Generate a test license token for certificate-upload.html testing
 */
const { generateLicenseToken } = require('../packages/simplebeacon-cli/src/lib/license-token.js');
const { upsertSubscription } = require('../server/lib/simplebeacon-subscription-store.cjs');

const EMAIL = 'trevor_punt@live.com';
const TIER = 'executive';
const PRODUCT = 'executive_clearance';

const token = generateLicenseToken(
  { email: EMAIL, tier: TIER, product: PRODUCT, features: ['pdf-generation', 'certificate'] },
  'simplebeacon-dev-insecure',
  60 * 24 * 7 // 7 days
);

console.log('\n=== Test License Token Generated ===');
console.log('Token:', token);
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
  console.log('\nPaste this token into certificate-upload.html:');
  console.log(token);
  console.log('');
}).catch((err) => {
  console.error('Failed to register:', err.message);
});
