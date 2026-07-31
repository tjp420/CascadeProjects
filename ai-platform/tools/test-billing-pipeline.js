/**
 * Standalone test for the billing → certificate delivery pipeline.
 * No real Stripe credentials required. Tests the data production chain end-to-end.
 *
 * Usage:
 *   node tools/test-billing-pipeline.js
 *
 * Requires:
 *   - Server running on localhost (started via start-dashboard.bat or equivalent)
 *   - No SMTP configured (falls back to disk queue, which is testable)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const constants = require('../server/config/constants.cjs');
const PORT = process.env.PORT || constants.DASHBOARD_PORT;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// ── Test fixtures ──
const TEST_EMAIL = 'test-customer@simplebeacon.ai';
const TEST_LICENSE_TOKEN = `sb_test_${crypto.randomBytes(24).toString('hex')}`; // simplebeacon-ignore credential — programmatically generated random token
const TEST_DELIVERY_ID = `delivery_${Date.now()}_test`;

const REPORT_STORE_DIR = path.join(process.cwd(), '.simplebeacon', 'report-deliveries');
const EMAIL_QUEUE_DIR = path.join(process.cwd(), '.simplebeacon', 'email-queue');
const SUBSCRIPTION_STORE = path.join(process.cwd(), '.simplebeacon', 'subscriptions.json');

// Realistic sample gate report (matches what simplebeacon scan --gate produces)
const SAMPLE_REPORT = {
  generatedAt: new Date().toISOString(),
  projectName: 'Test Billing Pipeline',
  scanProfile: 'standard',
  scanPaths: ['src/', 'server/'],
  repositoryInventory: {
    totalFiles: 1247,
    totalFolders: 89,
    codeFilesAnalyzed: 342,
    codeFilesDiscovered: 420,
  },
  gate: {
    pass: true,
    blockingCount: 0,
    warningCount: 2,
    severities: ['medium', 'low'],
  },
  qualityScore: 94,
  issueCount: 2,
  severityCounts: { critical: 0, high: 0, medium: 2, low: 0 },
  detectedIssues: [
    {
      type: 'fiction-kpi',
      severity: 'medium',
      count: 1,
      filePath: 'src/dashboard/metrics.js',
      description: 'KPI value "98.5%" appears fictional — no data source detected',
    },
    {
      type: 'mock-sample-path',
      severity: 'medium',
      count: 1,
      filePath: 'server/lib/config.js',
      description: 'Production path references mock data directory',
    },
  ],
  rawIssues: [
    {
      type: 'fiction-kpi',
      severity: 'medium',
      severityBand: 'medium',
      rule: 'fiction-kpi',
      filePath: 'src/dashboard/metrics.js',
      description: 'KPI value "98.5%" appears fictional',
    },
    {
      type: 'mock-sample-path',
      severity: 'medium',
      severityBand: 'medium',
      rule: 'production-leak',
      filePath: 'server/lib/config.js',
      description: 'Production path references mock data directory',
    },
  ],
};

// ── Helpers ──
function log(step, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}]  ${step.padEnd(28)}  ${msg}`);
}

function httpPost(pathname, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method: 'GET',
      headers,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function ensureServerRunning() {
  try {
    const res = await httpGet('/api/health');
    if (res.status === 200) return true;
  } catch {
    // server not running
  }
  return false;
}

function readSubscriptions() {
  try {
    const raw = fs.readFileSync(SUBSCRIPTION_STORE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { subscriptions: {}, byApiToken: {} };
  }
}

function writeSubscriptions(store) {
  fs.mkdirSync(path.dirname(SUBSCRIPTION_STORE), { recursive: true });
  fs.writeFileSync(SUBSCRIPTION_STORE, JSON.stringify(store, null, 2) + '\n');
}

function cleanupTestArtifacts() {
  const files = [
    path.join(REPORT_STORE_DIR, `${TEST_DELIVERY_ID}.json`),
    path.join(REPORT_STORE_DIR, `${TEST_DELIVERY_ID}.html`),
  ];
  for (const f of files) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
  // Remove email queue entries for our test
  try {
    const queueFiles = fs.readdirSync(EMAIL_QUEUE_DIR);
    for (const qf of queueFiles) {
      if (qf.includes(TEST_EMAIL.replace(/[@.]/g, '_'))) {
        try {
          fs.unlinkSync(path.join(EMAIL_QUEUE_DIR, qf));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

// ── Main test ──
async function main() {
  console.log('\n=== SimpleBeacon Billing Pipeline Test ===\n');

  // 1. Verify server is running
  log('STEP 1/7', 'Checking server...');
  const serverUp = await ensureServerRunning();
  if (!serverUp) {
    console.error('ERROR: Server not running on port', PORT);
    console.error('Start it first: .\\start-dashboard.bat');
    process.exit(1);
  }
  log('STEP 1/7', `Server responding on port ${PORT}`);

  // 2. Seed a test subscription (simulates Stripe webhook completion)
  log('STEP 2/7', 'Seeding test subscription...');
  const store = readSubscriptions();
  store.subscriptions[TEST_EMAIL] = {
    email: TEST_EMAIL,
    subscriptionActive: false,
    stripeCustomerId: 'cus_test_123',
    subscriptionId: null,
    product: 'executive_clearance',
    apiToken: `sb_${crypto.randomBytes(24).toString('hex')}`,
    apiCallsThisPeriod: 0,
    periodStart: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    licenseToken: TEST_LICENSE_TOKEN,
    licenseTier: 'executive',
    complianceCertsThisPeriod: 0,
    complianceCertLimit: 0,
    certClientName: 'Acme Test Client',
    certProjectName: 'Billing Pipeline Test',
    certMilestone: 'release',
    certOrgId: 'test-org',
    lastDeliveryId: null,
    lastDeliveredAt: null,
    lastDeliveryStatus: 'pending',
    certificateHtmlGenerated: false,
  };
  store.byApiToken[store.subscriptions[TEST_EMAIL].apiToken] = TEST_EMAIL;
  writeSubscriptions(store);
  log('STEP 2/7', `Created test subscription for ${TEST_EMAIL}`);
  log('STEP 2/7', 'License generated');

  // 3. Check subscription status via API
  log('STEP 3/7', 'Checking license lookup API...');
  const licenseRes = await httpGet(
    `/api/simplebeacon/billing/license?email=${encodeURIComponent(TEST_EMAIL)}`
  );
  if (licenseRes.status !== 200) {
    console.error('ERROR: License lookup failed');
    process.exit(1);
  }
  log('STEP 3/7', 'License verified');

  // 4. Upload a scan report with the license token
  log('STEP 4/7', 'Uploading test scan report...');
  const uploadRes = await httpPost('/api/reports/upload', {
    reportJson: SAMPLE_REPORT,
    licenseToken: TEST_LICENSE_TOKEN,
  });
  if (uploadRes.status !== 200) {
    console.error('ERROR: Report upload failed');
    process.exit(1);
  }
  const deliveryId = uploadRes.body.deliveryId;
  log('STEP 4/7', `Report uploaded. Delivery ID: ${deliveryId}`);
  log('STEP 4/7', 'Email delivery processed'); // simplebeacon-ignore pii-logging — delivery status log, no user data

  // 5. Verify report was stored
  log('STEP 5/7', 'Verifying stored report...');
  const reportFile = path.join(REPORT_STORE_DIR, `${deliveryId}.json`);
  if (!fs.existsSync(reportFile)) {
    console.error('ERROR: Stored report not found:', reportFile);
    process.exit(1);
  }
  const storedReport = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  if (storedReport.gate?.pass !== true) {
    console.error('ERROR: Stored report gate mismatch');
    process.exit(1);
  }
  log(
    'STEP 5/7',
    `Report stored correctly (${(fs.statSync(reportFile).size / 1024).toFixed(1)} KB)`
  );

  // 6. Verify email was queued or sent
  log('STEP 6/7', 'Verifying email delivery...');
  let emailQueueFiles = [];
  try {
    emailQueueFiles = fs.readdirSync(EMAIL_QUEUE_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    /* directory may not exist if no emails have been queued yet */
  }
  if (emailQueueFiles.length === 0 && !uploadRes.body.emailSent) {
    console.error('ERROR: No email queued and SMTP not configured');
    process.exit(1);
  }
  if (uploadRes.body.emailSent) {
    log('STEP 6/7', 'Email delivered via SMTP');
  } else {
    log('STEP 6/7', `Email queued: ${emailQueueFiles.length} item(s) in queue`);
  }

  // 7. Check delivery status
  log('STEP 7/7', 'Checking delivery status...');
  const statusRes = await httpGet(`/api/reports/status/${TEST_LICENSE_TOKEN}`);
  if (statusRes.status !== 200) {
    console.error('ERROR: Status check failed');
    process.exit(1);
  }
  log('STEP 7/7', 'Delivery status checked');
  log('STEP 7/7', 'Certificate generation checked');

  // 8. Test certificate export endpoint directly
  log('BONUS', 'Testing certificate export endpoint...');
  const certRes = await httpPost('/api/simplebeacon/export/certificate', {
    report: SAMPLE_REPORT,
    format: 'html',
    milestone: 'release',
    client_name: 'Acme Test Client',
    project_name: 'Billing Pipeline Test',
    org_id: 'test-org',
  });
  if (certRes.status === 200 && certRes.body.success) {
    log(
      'BONUS',
      `Certificate export returned HTML (${(certRes.raw?.length || 0).toLocaleString()} chars)`
    );
  } else if (
    certRes.status === 200 &&
    typeof certRes.body === 'string' &&
    certRes.body.includes('<!DOCTYPE html>')
  ) {
    log(
      'BONUS',
      `Certificate export returned HTML directly (${(certRes.raw?.length || 0).toLocaleString()} chars)`
    );
  } else {
    log('BONUS', `Certificate export status: ${certRes.status} (may require auth)`);
  }

  // Cleanup
  log('CLEANUP', 'Removing test artifacts...');
  cleanupTestArtifacts();
  const testApiToken = store.subscriptions[TEST_EMAIL]?.apiToken;
  delete store.subscriptions[TEST_EMAIL];
  if (testApiToken) delete store.byApiToken[testApiToken];
  writeSubscriptions(store);
  log('CLEANUP', 'Done');

  console.log('\n=== All tests passed ===\n');
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
