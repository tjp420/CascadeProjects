const { generateLicenseToken } = require('../packages/simplebeacon-cli/src/lib/license-token');
const { sendEmail } = require('../server/lib/email-service.cjs');
const fs = require('fs');
const path = require('path');

// Generate a license token for EU AI Act Sprint ($2,499)
const token = generateLicenseToken({
  email: 'trevor_punt@live.com',
  tier: 'euai',
  features: ['simplebeacon', 'eu-ai-act', 'compliance']
}, 'simplebeacon-dev-insecure', 525600); // 1 year expiry

// Load email template
const templatePath = path.join(__dirname, '../../coming-soon/email-template-certificate-upload.html');
let html = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
const APP_URL = process.env.SIMPLEBEACON_APP_URL;
if (!APP_URL) {
  console.error('SIMPLEBEACON_APP_URL env var is required');
  process.exit(1);
}
const uploadUrl = `${APP_URL}/coming-soon/certificate-upload.html`;
const sessionId = 'sess_' + Date.now();
const invoiceId = 'INV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

html = html.replace('{{PRODUCT_NAME}}', 'EU AI Act Sprint ($2,499)');
html = html.replace('{{LICENSE_TOKEN}}', token);
html = html.replace('{{CERTIFICATE_UPLOAD_URL}}', uploadUrl);
html = html.replace('{{SESSION_ID}}', sessionId);
html = html.replace('{{DATE}}', date);
html = html.replace('{{INVOICE_ID}}', invoiceId);
html = html.replace('{{SCAN_COMMAND}}', 'npx simplebeacon scan --gate --offline --config .simplebeacon/config-full-coverage.json');

// Send email
(async () => {
  try {
    const result = await sendEmail({
      to: 'trevor_punt@live.com',
      subject: 'Your SimpleBeacon EU AI Act Sprint — Payment Confirmed',
      html: html,
      text: `Payment Confirmed — EU AI Act Sprint ($2,499)\n\nLicense Token: ${token}\n\nDashboard: ${uploadUrl}?session_id=${sessionId}\n\nInvoice: ${invoiceId}\nDate: ${date}`
    });
    console.log('Email result:', result);
  } catch (err) {
    console.error('Failed to send email:', err);
  }
})();
